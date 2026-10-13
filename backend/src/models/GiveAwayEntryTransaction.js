const mongoose = require("mongoose");

const giveawayEntryTransactionSchema = new mongoose.Schema(
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

        prizeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Prize",
            required: true
        },

        currency: {
            type: String,
            enum: ["VE", "SVE", "TOKEN"],
            required: true
        },

        amount: {
            type: Number,
            required: true,
            min: 1
        },

        type: {
            type: String,
            enum: ["ENTRY", "REVERSAL"],
            required: true
        },

        status: {
            type: String,
            enum: ["PENDING", "SUCCESS", "FAILED", "REVERSED"],
            default: "PENDING"
        },

        balanceBefore: {
            type: Number,
            required: true,
            min: 0
        },

        balanceAfter: {
            type: Number,
            required: true,
            min: 0
        },

        transactionId: {
            type: String,
            required: true,
            unique: true
        },

         idempotencyKey: {
                    type: String,
                    required: true,
                    unique: true,
                    sparse: true
                }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "GiveawayEntryTransaction",
    giveawayEntryTransactionSchema
);