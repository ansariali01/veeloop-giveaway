const rateLimit = require("express-rate-limit");

const joinLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many giveaway join attempts, please try again later"
    }
});

module.exports = {
    joinLimiter
};