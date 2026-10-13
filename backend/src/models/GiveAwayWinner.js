
const mongoose = require("mongoose");

const giveawayWinnerSchema = new mongoose.Schema(
    {
        giveawayId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Giveaway",
            required: true
        },

        prizeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Prize",
            required: true
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        selectionMethod: {
            type: String,
            enum: ["RANDOM", "ADMIN"],
            required: true
        },

        selectedAt: {
            type: Date,
            default: Date.now
        },

        status: {
            type: String,
            enum: ["SELECTED", "CLAIMED", "EXPIRED"],
            default: "SELECTED"
        }
    },
    {
        timestamps: true
    }
);

// Prevent the same user from winning the same giveaway twice.
giveawayWinnerSchema.index(
    { giveawayId: 1, userId: 1 },
    { unique: true }
);

module.exports = mongoose.model(
    "GiveawayWinner",
    giveawayWinnerSchema
);