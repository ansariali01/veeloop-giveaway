const mongoose = require("mongoose");

const prizeClaimSchema = new mongoose.Schema(
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

        winnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "GiveawayWinner",
            required: true
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        prizeType: {
            type: String,
            enum: ["PHYSICAL", "GIFT_CARD"],
            required: true
        },

        // Physical prize information
        fullName: {
            type: String,
            trim: true
        },

        phone: {
            type: String,
            trim: true
        },

        address: {
            type: String,
            trim: true
        },

        city: {
            type: String,
            trim: true
        },

        state: {
            type: String,
            trim: true
        },

        pinCode: {
            type: String,
            trim: true
        },

        // Gift card information
        email: {
            type: String,
            trim: true,
            lowercase: true
        },

        status: {
            type: String,
            enum: [
                "SUBMITTED",
                "PROCESSING",
                "COMPLETED",
                "REJECTED"
            ],
            default: "SUBMITTED"
        },

        submittedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// One winner can submit only one claim
prizeClaimSchema.index(
    { winnerId: 1 },
    { unique: true }
);

module.exports = mongoose.model(
    "PrizeClaim",
    prizeClaimSchema
);