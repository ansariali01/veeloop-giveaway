
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const router = express.Router();

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                code: "INVALID_INPUT",
                message: "Email and password are required"
            });
        }

        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET is not configured");
            return res.status(500).json({
                success: false,
                code: "SERVER_CONFIGURATION_ERROR",
                message: "Login is temporarily unavailable"
            });
        }

        const user = await User.findOne({
            email: email.trim().toLowerCase()
        }).select("+passwordHash");

        if (!user || !user.passwordHash) {
            return res.status(401).json({
                success: false,
                code: "INVALID_CREDENTIALS",
                message: "Invalid email or password"
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            user.passwordHash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                code: "INVALID_CREDENTIALS",
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            { userId: user._id.toString() },
            process.env.JWT_SECRET,
            { expiresIn: "2h" }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            success: false,
            code: "LOGIN_FAILED",
            message: "Login failed"
        });
    }
});

module.exports = router;
