const mongoose = require("mongoose");
const Giveaway = require("../models/Giveaway");
const Prize = require("../models/Prize");

const getCurrentGiveaway = async (req, res) => {
    try {
        const now = new Date();

        const giveaway = await Giveaway.findOne({
            startAt: { $lte: now },
            endAt: { $gte: now },
            status: "ACTIVE"
        }).sort({ startAt: -1 });

        if (!giveaway) {
            return res.status(404).json({
                success: false,
                message: "No active giveaway found"
            });
        }

        const prizes = await Prize.find({
            giveawayId: giveaway._id
        });

        return res.status(200).json({
            success: true,
            data: {
                giveaway,
                prizes
            }
        });
    } catch (error) {
        console.error("Error fetching current giveaway:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch current giveaway"
        });
    }
};

const getGiveawayById = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate MongoDB ObjectId before querying the database
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
                message: "Giveaway not found"
            });
        }

        const prizes = await Prize.find({
            giveawayId: giveaway._id
        });

        return res.status(200).json({
            success: true,
            data: {
                giveaway,
                prizes
            }
        });
    } catch (error) {
        console.error("Error fetching giveaway:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch giveaway"
        });
    }
};

module.exports = {
    getCurrentGiveaway,
    getGiveawayById
};