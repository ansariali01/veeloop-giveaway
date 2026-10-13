const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                code: "LOGIN_REQUIRED",
                message: "Authentication required"
            });
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                code: "LOGIN_REQUIRED",
                message: "Authentication token required"
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({
                success: false,
                code: "LOGIN_REQUIRED",
                message: "User not found"
            });
        }

        req.user = user;

        next();
    } catch (error) {
        console.error("Authentication error:", error);

        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError"
        ) {
            return res.status(401).json({
                success: false,
                code: "INVALID_TOKEN",
                message: "Invalid or expired authentication token"
            });
        }

        return res.status(401).json({
            success: false,
            code: "LOGIN_REQUIRED",
            message: "Authentication failed"
        });
    }
};

module.exports = authenticateUser;