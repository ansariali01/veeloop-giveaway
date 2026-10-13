
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        passwordHash: {
            type: String,
            select: false
        },

        role: {
            type: String,
            enum: ["USER", "ADMIN"],
            default: "USER",
            required: true
        },

        veBalance: {
            type: Number,
            default: 0,
            min: 0
        },

        sveBalance: {
            type: Number,
            default: 0,
            min: 0
        },

        tokenBalance: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("User", userSchema);