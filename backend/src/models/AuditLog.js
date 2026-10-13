const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId
        },

        action: {
            type: String,
            enum: [
                "JOIN_GIVEAWAY",
                "ENTRY_FEE_DEDUCTED",
                "JOIN_REJECTED",
                "DUPLICATE_ATTEMPT",
                "FRAUD_FLAGGED",
                "CLAIM_SUBMITTED",
                "WINNER_SELECTED"
            ],
            required: true
        },

        giveawayId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Giveaway"
        },

        amount: {
            type: Number,
            min: 0
        },

        currency: {
            type: String,
            enum: ["VE", "SVE", "TOKEN"]
        },

        result: {
            type: String,
            enum: ["SUCCESS", "FAILED", "BLOCKED", "REJECTED"],
            required: true
        },

        requestId: {
            type: String
        },

        details: {
            type: String,
            trim: true
        },

        ipAddress: {
            type: String
        },

        deviceHash: {
            type: String
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "AuditLog",
    auditLogSchema
);