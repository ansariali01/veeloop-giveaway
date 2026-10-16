const mongoose = require("mongoose");

const Giveaway = require("../models/GiveAway");
const GiveawayWinner = require("../models/GiveAwayWinner");
const Prize = require("../models/Prize");
const PrizeClaim = require("../models/PrizeClaim");
const AuditLog = require("../models/AuditLog");

const submitPrizeClaim = async (req, res) => {
    const { id: giveawayId } = req.params;

    // Validate giveaway ID
    if (!mongoose.isValidObjectId(giveawayId)) {
        return res.status(400).json({
            success: false,
            code: "INVALID_GIVEAWAY_ID",
            message: "Invalid giveaway ID"
        });
    }

    // Authentication check
    if (!req.user || !req.user._id) {
        return res.status(401).json({
            success: false,
            code: "LOGIN_REQUIRED",
            message: "Authentication required"
        });
    }

    const userId = req.user._id;

    try {
        // 1. Find the giveaway
        const giveaway = await Giveaway.findById(giveawayId);

        if (!giveaway) {
            return res.status(404).json({
                success: false,
                code: "GIVEAWAY_NOT_FOUND",
                message: "Giveaway not found"
            });
        }

        // 2. Claims are only allowed after the giveaway ends
        if (new Date() < new Date(giveaway.endAt)) {
            return res.status(400).json({
                success: false,
                code: "CLAIM_NOT_AVAILABLE",
                message: "Prize claims are only available after the giveaway ends"
            });
        }

        // 3. Find the winner using the authenticated user's ID.
        //    Never trust winnerId or userId from the request body.
        const winner = await GiveawayWinner.findOne({
            giveawayId,
            userId,
            status: "SELECTED"
        });

        if (!winner) {
            return res.status(403).json({
                success: false,
                code: "NOT_A_WINNER",
                message: "You are not an eligible winner for this giveaway"
            });
        }

        // 4. Find the prize belonging to this winner
        const prize = await Prize.findOne({
            _id: winner.prizeId,
            giveawayId
        });

        if (!prize) {
            return res.status(404).json({
                success: false,
                code: "PRIZE_NOT_FOUND",
                message: "Prize configuration not found"
            });
        }

        // 5. PrizeClaim requires a prize type
        //
        // The Prize model must provide either:
        // PHYSICAL or GIFT_CARD.
        if (!prize.prizeType) {
            return res.status(400).json({
                success: false,
                code: "PRIZE_TYPE_NOT_CONFIGURED",
                message: "Prize type has not been configured"
            });
        }

        if (!["PHYSICAL", "GIFT_CARD"].includes(prize.prizeType)) {
            return res.status(400).json({
                success: false,
                code: "INVALID_PRIZE_TYPE",
                message: "Invalid prize type"
            });
        }

        // 6. Check whether this winner has already submitted a claim
        const existingClaim = await PrizeClaim.findOne({
            winnerId: winner._id
        });

        if (existingClaim) {
            return res.status(409).json({
                success: false,
                code: "CLAIM_ALREADY_SUBMITTED",
                message: "A claim has already been submitted for this prize"
            });
        }

        const {
            fullName,
            phone,
            address,
            city,
            state,
            pinCode,
            email
        } = req.body || {};

        // 7. Validate PHYSICAL prize claim
        if (prize.prizeType === "PHYSICAL") {
            const requiredFields = {
                fullName,
                phone,
                address,
                city,
                state,
                pinCode
            };

            const missingFields = Object.entries(requiredFields)
                .filter(
                    ([, value]) =>
                        typeof value !== "string" ||
                        value.trim().length === 0
                )
                .map(([field]) => field);

            if (missingFields.length > 0) {
                return res.status(400).json({
                    success: false,
                    code: "MISSING_CLAIM_FIELDS",
                    message: "All physical prize claim fields are required",
                    missingFields
                });
            }
        }

        // 8. Validate GIFT_CARD claim
        if (prize.prizeType === "GIFT_CARD") {
            if (
                typeof email !== "string" ||
                email.trim().length === 0
            ) {
                return res.status(400).json({
                    success: false,
                    code: "EMAIL_REQUIRED",
                    message: "Email is required for a gift card claim"
                });
            }

            const normalizedEmail = email.trim().toLowerCase();

            // Basic server-side email validation
            const emailPattern =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailPattern.test(normalizedEmail)) {
                return res.status(400).json({
                    success: false,
                    code: "INVALID_EMAIL",
                    message: "Please provide a valid email address"
                });
            }
        }

        // 9. Create the claim and mark the winner as claimed
        const session = await mongoose.startSession();

        let createdClaim;

        try {
            await session.withTransaction(async () => {
                const claimData = {
                    giveawayId: giveaway._id,
                    prizeId: prize._id,
                    winnerId: winner._id,
                    userId,
                    prizeType: prize.prizeType,
                    status: "SUBMITTED"
                };

                if (prize.prizeType === "PHYSICAL") {
                    claimData.fullName = fullName.trim();
                    claimData.phone = phone.trim();
                    claimData.address = address.trim();
                    claimData.city = city.trim();
                    claimData.state = state.trim();
                    claimData.pinCode = pinCode.trim();
                }

                if (prize.prizeType === "GIFT_CARD") {
                    claimData.email = email.trim().toLowerCase();
                }

                const claims = await PrizeClaim.create(
                    [claimData],
                    { session }
                );

                createdClaim = claims[0];

                // Only change SELECTED → CLAIMED.
                // This also protects against a race between two requests.
                const updatedWinner =
                    await GiveawayWinner.findOneAndUpdate(
                        {
                            _id: winner._id,
                            status: "SELECTED"
                        },
                        {
                            $set: {
                                status: "CLAIMED"
                            }
                        },
                        {
                            new: true,
                            session
                        }
                    );

                if (!updatedWinner) {
                    const error = new Error(
                        "Winner claim could not be completed"
                    );

                    error.statusCode = 409;
                    throw error;
                }

                // Audit the claim without storing sensitive claim
                // information in the audit details.
                await AuditLog.create(
                    [
                        {
                            userId,
                            giveawayId: giveaway._id,
                            action: "CLAIM_SUBMITTED",
                            result: "SUCCESS",
                            details:
                                `Prize claim ${createdClaim._id} submitted`
                        }
                    ],
                    { session }
                );
            });
        } finally {
            await session.endSession();
        }

        // 10. Do NOT return sensitive claim information
        return res.status(201).json({
            success: true,
            message: "Prize claim submitted successfully",
            claim: {
                id: createdClaim._id,
                giveawayId: createdClaim.giveawayId,
                prizeId: createdClaim.prizeId,
                prizeType: createdClaim.prizeType,
                status: createdClaim.status,
                submittedAt: createdClaim.submittedAt
            }
        });
    } catch (error) {
        console.error("Prize claim error:", error);

        // Unique winnerId index protection
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                code: "CLAIM_ALREADY_SUBMITTED",
                message: "A claim has already been submitted for this prize"
            });
        }

        return res.status(error.statusCode || 500).json({
            success: false,
            code:
                error.statusCode
                    ? "CLAIM_FAILED"
                    : "INTERNAL_SERVER_ERROR",
            message:
                error.statusCode
                    ? error.message
                    : "Failed to submit prize claim"
        });
    }
};

module.exports = {
    submitPrizeClaim
};