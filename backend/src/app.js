const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const errorHandler = require("./middleware/errorMiddleware");

const giveawayRoutes = require("./routes/giveawayRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests, please try again later"
    }
});

// Security middleware
app.use(helmet());

app.use(
    cors({
        origin: "http://localhost:5173"
    })
);

// Parse JSON request bodies
app.use(express.json({ limit: "10kb" }));

// Global API rate limiting
app.use("/api", apiLimiter);

// Authentication routes
app.use("/api/auth", authRoutes);

// Giveaway routes
app.use("/api/giveaways", giveawayRoutes);

// Test route
app.get("/", (req, res) => {
    res.json({
        message: "VELOOP Giveaway API is running"
    });
});

// Centralized error handling
app.use(errorHandler);

module.exports = app;