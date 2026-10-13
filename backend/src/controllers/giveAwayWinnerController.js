const mongoose = require("mongoose");
const crypto = require("crypto");

const Giveaway = require("../models/Giveaway");
const Prize = require("../models/Prize");
const GiveawayParticipation = require("../models/GiveawayParticipation");
const GiveawayWinner = require("../models/GiveawayWinner");
const AuditLog = require("../models/AuditLog");

const selectGiveawayWinners = async (req, res) => {
    const { id: giveawayId } = req.params;

    if (!mongoose.isValidObjectId(giveawayId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid giveaway ID"
        });
    }

    if (!req.user || !req.user._id) {
        return res.status(401).json({
            success: false,
            message: "Authentication required"
        });
    }

    const session = await mongoose.startSession();

    let selectedWinners = [];

    try {
        await session.withTransaction(async () => {
            // Reset this array if MongoDB retries the transaction.
            selectedWinners = [];

            const giveaway = await Giveaway.findById(giveawayId)
                .session(session);

            if (!giveaway) {
                const error = new Error("Giveaway not found");
                error.statusCode = 404;
                throw error;
            }

         if (
             giveaway.status !== "ENDED" ||
             new Date() < new Date(giveaway.endAt)
         ) {
             const error = new Error(
                 "Winners can only be selected after the giveaway ends"
             );
             error.statusCode = 400;
             throw error;
         }

            const prizes = await Prize.find({ giveawayId })
                .sort({ _id: 1 })
                .session(session);

            if (prizes.length === 0) {
                const error = new Error("No prizes configured");
                error.statusCode = 400;
                throw error;
            }

            // Enforce the overall giveaway winner limit.
            const totalExistingWinners = await GiveawayWinner.countDocuments({
                giveawayId
            }).session(session);

            let remainingGiveawaySlots =
                Number(giveaway.winnerCount) - totalExistingWinners;

            if (remainingGiveawaySlots <= 0) {
                return;
            }

            for (const prize of prizes) {
                if (remainingGiveawaySlots <= 0) {
                    break;
                }

                const winnerCount = Number(prize.winnerCount);

                if (!Number.isInteger(winnerCount) || winnerCount < 1) {
                    const error = new Error(
                        `Invalid winner count for prize: ${prize.name}`
                    );
                    error.statusCode = 400;
                    throw error;
                }

                const existingWinners = await GiveawayWinner.countDocuments({
                    giveawayId,
                    prizeId: prize._id
                }).session(session);

                const prizeRemainingSlots =
                    winnerCount - existingWinners;

                if (prizeRemainingSlots <= 0) {
                    continue;
                }

                // Exclude users who have already won any prize
                // in this giveaway.
                const alreadySelected = await GiveawayWinner.find({
                    giveawayId
                })
                    .select("userId")
                    .session(session);

                const excludedUserIds = alreadySelected.map(
                    winner => winner.userId
                );

                const eligibleParticipants =
                    await GiveawayParticipation.find({
                        giveawayId,
                        status: "ACTIVE",
                        ...(excludedUserIds.length > 0
                            ? {
                                userId: {
                                    $nin: excludedUserIds
                                }
                            }
                            : {})
                    })
                        .select("userId")
                        .session(session);

                // Deduplicate candidates in case the data contains
                // unexpected duplicate participation records.
                const candidates = [
                    ...new Map(
                        eligibleParticipants.map(participant => [
                            participant.userId.toString(),
                            participant.userId
                        ])
                    ).values()
                ];

                // Use cryptographically secure randomness to shuffle.
                for (let i = candidates.length - 1; i > 0; i--) {
                    const j = crypto.randomInt(0, i + 1);

                    [candidates[i], candidates[j]] = [
                        candidates[j],
                        candidates[i]
                    ];
                }

                const slotsForThisPrize = Math.min(
                    prizeRemainingSlots,
                    remainingGiveawaySlots
                );

                const winnersToCreate = candidates
                    .slice(0, slotsForThisPrize)
                    .map(userId => ({
                        giveawayId: giveaway._id,
                        prizeId: prize._id,
                        userId,
                        selectionMethod: "RANDOM",
                        status: "SELECTED"
                    }));

                if (winnersToCreate.length === 0) {
                    continue;
                }

                const createdWinners = await GiveawayWinner.create(
                    winnersToCreate,
                    { session }
                );

                selectedWinners.push(...createdWinners);

                await AuditLog.create(
                    createdWinners.map(winner => ({
                        userId: req.user._id,
                        giveawayId: giveaway._id,
                        action: "WINNER_SELECTED",
                        result: "SUCCESS",
                        details:
                            `Winner ${winner._id} selected for prize ${prize._id}`
                    })),
                    { session }
                );

                remainingGiveawaySlots -= createdWinners.length;
            }
        });

        return res.status(200).json({
            success: true,
            message: "Winner selection completed",
            selectedCount: selectedWinners.length,
            winners: selectedWinners.map(winner => ({
                id: winner._id,
                giveawayId: winner.giveawayId,
                prizeId: winner.prizeId,
                userId: winner.userId,
                selectedAt: winner.selectedAt,
                status: winner.status
            }))
        });
    } catch (error) {
        console.error("Winner selection error:", error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode
                ? error.message
                : "Failed to select winners"
        });
    } finally {
        await session.endSession();
    }
};

module.exports = { selectGiveawayWinners };