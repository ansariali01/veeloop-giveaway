const mongoose = require("mongoose");

const giveawaySchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            required: true,
            trim: true
        },

        status: {
            type: String,
            enum: ["UPCOMING", "ACTIVE", "ENDED", "ARCHIVED"],
            default: "UPCOMING"
        },

        startAt: {
            type: Date,
            required: true
        },

        endAt: {
            type: Date,
            required: true
        },

        winnerCount: {
            type: Number,
            required: true,
            min: 1
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Giveaway", giveawaySchema);