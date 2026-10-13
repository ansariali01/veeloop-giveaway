const mongoose = require("mongoose");

const prizeSchema = new mongoose.Schema(
    {
        giveawayId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Giveaway",
            required: true
        },

        name: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            trim: true
        },

        prizeType: {
            type: String,
            enum: ["PHYSICAL", "GIFT_CARD"],
            required: true
        },

        entryCurrency: {
            type: String,
            enum: ["VE", "SVE", "TOKEN"],
            required: true
        },

        entryAmount: {
            type: Number,
            required: true,
            min: 1
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

module.exports = mongoose.model("Prize", prizeSchema);