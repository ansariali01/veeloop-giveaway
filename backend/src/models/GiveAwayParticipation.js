const mongoose = require("mongoose");

const giveawayParticipationSchema = new mongoose.Schema(
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

        status: {
            type: String,
            enum: ["ACTIVE", "CANCELLED"],
            default: "ACTIVE"
        },

        deviceHash: {
            type: String
        },

        transactionId: {
            type: String,
            required: true
        },

        joinedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// One user can participate only once in a giveaway
giveawayParticipationSchema.index(
    { userId: 1, giveawayId: 1 },
    { unique: true }
);

giveawayParticipationSchema.index({ deviceHash: 1 });
module.exports =
  mongoose.models.GiveawayParticipation ||
  mongoose.model("GiveawayParticipation", giveawayParticipationSchema);