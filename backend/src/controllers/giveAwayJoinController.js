const mongoose = require("mongoose");
const crypto = require("crypto");
const createDeviceHash = require("../utils/deviceHash");

const Giveaway = require("../models/GiveAway");
const Prize = require("../models/Prize");
const User = require("../models/User");
const GiveawayParticipation = require("../models/GiveAwayParticipation");
const GiveawayEntryTransaction = require("../models/GiveawayEntryTransaction");
const AuditLog = require("../models/AuditLog");
const FraudEvent = require("../models/FraudEvent");

const joinGiveaway = async (req, res) => {
    let session;

    try {
        session = await mongoose.startSession();

        const { id } = req.params;
        const user = req.user;
        const idempotencyKey = req.headers["idempotency-key"];

        // Validate giveaway ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                code: "INVALID_GIVEAWAY_ID",
                message: "Invalid giveaway ID"
            });
        }

        // Validate authenticated user
        if (!user || !user._id) {
            return res.status(401).json({
                success: false,
                code: "LOGIN_REQUIRED",
                message: "User authentication required"
            });
        }

        // Validate idempotency key
        if (!idempotencyKey) {
            return res.status(400).json({
                success: false,
                code: "IDEMPOTENCY_KEY_REQUIRED",
                message: "Idempotency-Key header is required"
            });
        }

        if (
            typeof idempotencyKey !== "string" ||
            idempotencyKey.length > 100
        ) {
            return res.status(400).json({
                success: false,
                code: "INVALID_IDEMPOTENCY_KEY",
                message: "Invalid Idempotency-Key"
            });
        }

        // Read and validate the selected prize
        // Entry amount and currency always come from the database.
        const { prizeId } = req.body || {};

        if (
            !prizeId ||
            !mongoose.Types.ObjectId.isValid(prizeId)
        ) {
            return res.status(400).json({
                success: false,
                code: "INVALID_PRIZE_ID",
                message: "Invalid prize ID"
            });
        }

        // Hash the client-provided device identifier
        const deviceIdentifier = req.headers["x-device-id"];
        const deviceHash = createDeviceHash(deviceIdentifier);

        const deviceSignals = deviceHash
            ? ["DEVICE_ID_PRESENT"]
            : ["DEVICE_ID_MISSING"];

        // Return the previous result if this exact request was already processed.
        const existingTransaction =
            await GiveawayEntryTransaction.findOne({
                userId: user._id,
                idempotencyKey
            });

        if (existingTransaction) {
            return res.status(200).json({
                success: true,
                message: "Request already processed",
                data: {
                    giveawayId: existingTransaction.giveawayId,
                    prizeId: existingTransaction.prizeId,
                    entryCurrency: existingTransaction.currency,
                    entryAmount: existingTransaction.amount,
                    transactionId: existingTransaction.transactionId
                }
            });
        }

        // Load giveaway
        const giveaway = await Giveaway.findById(id);

        if (!giveaway) {
            return res.status(404).json({
                success: false,
                code: "GIVEAWAY_NOT_FOUND",
                message: "Giveaway not found"
            });
        }

        // Backend-controlled lifecycle checks
        const now = new Date();

        if (
            giveaway.status !== "ACTIVE" ||
            now < giveaway.startAt
        ) {
            return res.status(400).json({
                success: false,
                code: "GIVEAWAY_NOT_ACTIVE",
                message: "Giveaway is not active"
            });
        }

        if (now >= giveaway.endAt) {
            return res.status(400).json({
                success: false,
                code: "GIVEAWAY_ENDED",
                message: "Giveaway has ended"
            });
        }

        // Load the exact prize for this giveaway
        const prize = await Prize.findOne({
            _id: prizeId,
            giveawayId: giveaway._id
        });

        if (!prize) {
            return res.status(404).json({
                success: false,
                code: "PRIZE_NOT_FOUND",
                message: "Prize not found"
            });
        }

        // Reject users who have already participated
        const existingParticipation =
            await GiveawayParticipation.findOne({
                userId: user._id,
                giveawayId: giveaway._id
            });

        if (existingParticipation) {
            return res.status(409).json({
                success: false,
                code: "ALREADY_PARTICIPATING",
                message: "You have already participated in this giveaway"
            });
        }

        /*
         * FRAUD CHECK:
         *
         * If the device hash already belongs to another participant
         * in this giveaway, record a fraud event.
         *
         * We do NOT automatically block the join because multiple
         * legitimate users may share the same device.
         */
        let existingDeviceParticipation = null;

        if (deviceHash) {
            existingDeviceParticipation =
                await GiveawayParticipation.findOne({
                    giveawayId: giveaway._id,
                    deviceHash,
                    userId: { $ne: user._id }
                });
        }

        const deviceReuseDetected = Boolean(existingDeviceParticipation);

        if (deviceReuseDetected) {
            deviceSignals.push("DEVICE_REUSED_BY_ANOTHER_USER");
        }

        // Determine the correct balance field
        let balanceBefore;
        let balanceAfter;
        let balanceField;

        if (prize.entryCurrency === "VE") {
            balanceField = "veBalance";
        } else if (prize.entryCurrency === "SVE") {
            balanceField = "sveBalance";
        } else if (prize.entryCurrency === "TOKEN") {
            balanceField = "tokenBalance";
        } else {
            return res.status(400).json({
                success: false,
                code: "INVALID_ENTRY_CURRENCY",
                message: "Unsupported entry currency"
            });
        }

        // Check balance
        const currentBalance = user[balanceField];

        if (
            typeof currentBalance !== "number" ||
            currentBalance < prize.entryAmount
        ) {
            return res.status(400).json({
                success: false,
                code: "INSUFFICIENT_BALANCE",
                message: "Insufficient balance"
            });
        }

        const transactionId = crypto.randomUUID();

        // Deduct fee and create all related records atomically
        await session.withTransaction(async () => {
            const updateUser = await User.findOneAndUpdate(
                {
                    _id: user._id,
                    [balanceField]: {
                        $gte: prize.entryAmount
                    }
                },
                {
                    $inc: {
                        [balanceField]: -prize.entryAmount
                    }
                },
                {
                    session,
                    new: true
                }
            );

            if (!updateUser) {
                const error = new Error("Insufficient balance");
                error.code = "INSUFFICIENT_BALANCE";
                throw error;
            }

            balanceAfter = updateUser[balanceField];
            balanceBefore = balanceAfter + prize.entryAmount;

            // Create participation record
            await GiveawayParticipation.create(
                [
                    {
                        userId: user._id,
                        giveawayId: giveaway._id,
                        prizeId: prize._id,
                        entryCurrency: prize.entryCurrency,
                        entryAmount: prize.entryAmount,
                        status: "ACTIVE",
                        deviceHash,
                        transactionId
                    }
                ],
                {
                    session,
                    ordered: true
                }
            );

            // Record financial transaction
            await GiveawayEntryTransaction.create(
                [
                    {
                        userId: user._id,
                        giveawayId: giveaway._id,
                        prizeId: prize._id,
                        currency: prize.entryCurrency,
                        amount: prize.entryAmount,
                        type: "ENTRY",
                        status: "SUCCESS",
                        balanceBefore,
                        balanceAfter,
                        transactionId,
                        idempotencyKey
                    }
                ],
                {
                    session,
                    ordered: true
                }
            );

            // Log successful participation and fee deduction
            await AuditLog.create(
                [
                    {
                        userId: user._id,
                        action: "JOIN_GIVEAWAY",
                        giveawayId: giveaway._id,
                        amount: prize.entryAmount,
                        currency: prize.entryCurrency,
                        result: "SUCCESS",
                        requestId: transactionId,
                        deviceHash
                    },
                    {
                        userId: user._id,
                        action: "ENTRY_FEE_DEDUCTED",
                        giveawayId: giveaway._id,
                        amount: prize.entryAmount,
                        currency: prize.entryCurrency,
                        result: "SUCCESS",
                        requestId: transactionId,
                        deviceHash
                    }
                ],
                {
                    session,
                    ordered: true
                }
            );

            // Missing device ID is a low-confidence fraud signal.
            if (!deviceHash) {
                await FraudEvent.create(
                    [
                        {
                            userId: user._id,
                            giveawayId: giveaway._id,
                            deviceHash: null,
                            riskScore: 10,
                            reason: "Device identifier missing",
                            signals: deviceSignals,
                            action: "REVIEW"
                        }
                    ],
                    {
                        session,
                        ordered: true
                    }
                );
            }

            // Reused device is a stronger fraud signal.
            if (deviceReuseDetected) {
                await FraudEvent.create(
                    [
                        {
                            userId: user._id,
                            giveawayId: giveaway._id,
                            deviceHash,
                            riskScore: 60,
                            reason:
                                "Device identifier already used by another participant in this giveaway",
                            signals: deviceSignals,
                            action: "FLAGGED"
                        }
                    ],
                    {
                        session,
                        ordered: true
                    }
                );
            }
        });

        return res.status(201).json({
            success: true,
            message: "Successfully joined giveaway",
            data: {
                giveawayId: giveaway._id,
                prizeId: prize._id,
                entryCurrency: prize.entryCurrency,
                entryAmount: prize.entryAmount,
                transactionId
            }
        });
    } catch (error) {
        console.error("Error joining giveaway:", error);

        if (error.code === "INSUFFICIENT_BALANCE") {
            return res.status(400).json({
                success: false,
                code: "INSUFFICIENT_BALANCE",
                message: "Insufficient balance"
            });
        }

        // Handle duplicate transaction or participation requests.
        if (error.code === 11000) {
            try {
                const userId = req.user?._id;
                const idempotencyKey =
                    req.headers["idempotency-key"];

                if (userId && idempotencyKey) {
                    const existingTransaction =
                        await GiveawayEntryTransaction.findOne({
                            userId,
                            idempotencyKey
                        });

                    if (existingTransaction) {
                        return res.status(200).json({
                            success: true,
                            message: "Request already processed",
                            data: {
                                giveawayId:
                                    existingTransaction.giveawayId,
                                prizeId:
                                    existingTransaction.prizeId,
                                entryCurrency:
                                    existingTransaction.currency,
                                entryAmount:
                                    existingTransaction.amount,
                                transactionId:
                                    existingTransaction.transactionId
                            }
                        });
                    }
                }

                if (userId && req.params.id) {
                    const existingParticipation =
                        await GiveawayParticipation.findOne({
                            userId,
                            giveawayId: req.params.id
                        });

                    if (existingParticipation) {
                        return res.status(409).json({
                            success: false,
                            code: "ALREADY_PARTICIPATING",
                            message:
                                "You have already participated in this giveaway"
                        });
                    }
                }
            } catch (lookupError) {
                console.error(
                    "Error checking duplicate request:",
                    lookupError
                );
            }
        }

        return res.status(500).json({
            success: false,
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to join giveaway"
        });
    } finally {
        if (session) {
            await session.endSession();
        }
    }
};

module.exports = {
    joinGiveaway
};