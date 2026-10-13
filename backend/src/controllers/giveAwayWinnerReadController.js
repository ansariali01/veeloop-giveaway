const mongoose = require("mongoose");

const Giveaway = require("../models/Giveaway");
const GiveawayWinner = require("../models/GiveawayWinner");
const Prize = require("../models/Prize");
const PrizeClaim = require("../models/PrizeClaim");

const maskUserId = (userId) => {
    if (!userId) {
        return "WINNER";
    }

    const value = userId.toString();

    if (value.length <= 6) {
        return "WINNER";
    }

    return `${value.slice(0, 4)}****${value.slice(-2)}`;
};

/**
 * GET /api/giveaways/:id/winners
 *
 * Returns winners only after the giveaway has ended.
 */
const getGiveawayWinners = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                code: "INVALID_GIVEAWAY_ID",
                message: "Invalid giveaway ID"
            });
        }

        const giveaway = await Giveaway.findById(id);

        if (!giveaway) {
            return res.status(404).json({
                success: false,
                code: "GIVEAWAY_NOT_FOUND",
                message: "Giveaway not found"
            });
        }

        const now = new Date();

        if (now < giveaway.endAt) {
            return res.status(400).json({
                success: false,
                code: "WINNERS_NOT_AVAILABLE",
                message: "Winners are not available until the giveaway ends"
            });
        }

        const winners = await GiveawayWinner.find({
            giveawayId: giveaway._id
        })
            .populate("prizeId", "name prizeType")
            .sort({ selectedAt: 1 });

        return res.status(200).json({
            success: true,
            data: {
                giveawayId: giveaway._id,
                title: giveaway.title,
                winners: winners.map((winner) => ({
                    winnerId: winner._id,
                    user: maskUserId(winner.userId),
                    prize: winner.prizeId
                        ? {
                              name: winner.prizeId.name,
                              prizeType: winner.prizeId.prizeType
                          }
                        : null,
                    selectedAt: winner.selectedAt,
                    status: winner.status
                }))
            }
        });
    } catch (error) {
        console.error("Error fetching giveaway winners:", error);

        return res.status(500).json({
            success: false,
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch giveaway winners"
        });
    }
};

/**
 * GET /api/giveaways/previous/winners
 *
 * Returns winners from previous ended giveaways.
 *
 * Sensitive claim information is never returned.
 */
const getPreviousGiveawayWinners = async (req, res) => {
    try {
        const now = new Date();

        const endedGiveaways = await Giveaway.find({
            endAt: {
                $lte: now
            }
        })
            .select("_id title description startAt endAt winnerCount")
            .sort({ endAt: -1 });

        if (endedGiveaways.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    giveaways: []
                }
            });
        }

        const giveawayIds = endedGiveaways.map(
            (giveaway) => giveaway._id
        );

        const winners = await GiveawayWinner.find({
            giveawayId: {
                $in: giveawayIds
            }
        })
            .populate("prizeId", "name prizeType")
            .sort({ selectedAt: 1 });

        const winnersByGiveaway = new Map();

        for (const winner of winners) {
            const giveawayId = winner.giveawayId.toString();

            if (!winnersByGiveaway.has(giveawayId)) {
                winnersByGiveaway.set(giveawayId, []);
            }

            winnersByGiveaway.get(giveawayId).push({
                winnerId: winner._id,
                user: maskUserId(winner.userId),
                prize: winner.prizeId
                    ? {
                          name: winner.prizeId.name,
                          prizeType: winner.prizeId.prizeType
                      }
                    : null,
                selectedAt: winner.selectedAt,
                status: winner.status
            });
        }

        const giveawayHistory = endedGiveaways.map((giveaway) => ({
            giveawayId: giveaway._id,
            title: giveaway.title,
            description: giveaway.description,
            startAt: giveaway.startAt,
            endAt: giveaway.endAt,
            winnerCount: giveaway.winnerCount,
            winners:
                winnersByGiveaway.get(giveaway._id.toString()) || []
        }));

        return res.status(200).json({
            success: true,
            data: {
                giveaways: giveawayHistory
            }
        });
    } catch (error) {
        console.error(
            "Error fetching previous giveaway winners:",
            error
        );

        return res.status(500).json({
            success: false,
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch previous giveaway winners"
        });
    }
};

/**
 * GET /api/giveaways/:id/my-claim
 *
 * Returns the authenticated user's winner/claim status.
 * Sensitive claim details are never exposed.
 */
const getMyGiveawayClaim = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                code: "INVALID_GIVEAWAY_ID",
                message: "Invalid giveaway ID"
            });
        }

        if (!user || !user._id) {
            return res.status(401).json({
                success: false,
                code: "LOGIN_REQUIRED",
                message: "Authentication required"
            });
        }

        const giveaway = await Giveaway.findById(id);

        if (!giveaway) {
            return res.status(404).json({
                success: false,
                code: "GIVEAWAY_NOT_FOUND",
                message: "Giveaway not found"
            });
        }

        const now = new Date();

        if (now < giveaway.endAt) {
            return res.status(200).json({
                success: true,
                data: {
                    isWinner: false,
                    claimStatus: "NOT_AVAILABLE"
                }
            });
        }

        const winner = await GiveawayWinner.findOne({
            giveawayId: giveaway._id,
            userId: user._id
        });

        if (!winner) {
            return res.status(200).json({
                success: true,
                data: {
                    isWinner: false,
                    claimStatus: "NOT_A_WINNER"
                }
            });
        }

        const prize = await Prize.findById(winner.prizeId).select(
            "name prizeType"
        );

        const claim = await PrizeClaim.findOne({
            winnerId: winner._id,
            userId: user._id
        }).select("status submittedAt");

        return res.status(200).json({
            success: true,
            data: {
                isWinner: true,
                winnerId: winner._id,
                prize: prize
                    ? {
                          name: prize.name,
                          prizeType: prize.prizeType
                      }
                    : null,
                claimStatus: claim
                    ? claim.status
                    : "NOT_SUBMITTED",
                submittedAt: claim ? claim.submittedAt : null
            }
        });
    } catch (error) {
        console.error("Error fetching user's claim status:", error);

        return res.status(500).json({
            success: false,
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch claim status"
        });
    }
};

module.exports = {
    getGiveawayWinners,
    getPreviousGiveawayWinners,
    getMyGiveawayClaim
};