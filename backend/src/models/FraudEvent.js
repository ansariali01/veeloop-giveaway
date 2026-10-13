const mongoose = require("mongoose");

const fraudEventSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },

        giveawayId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Giveaway",
            required: true
        },

        deviceHash: {
            type: String
        },

        riskScore: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },

        reason: {
            type: String,
            required: true,
            trim: true
        },

        signals: {
            type: [String],
            default: []
        },

        action: {
            type: String,
            enum: [
                "ALLOWED",
                "FLAGGED",
                "BLOCKED",
                "REVIEW"
            ],
            required: true
        },

        createdAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "FraudEvent",
    fraudEventSchema
);