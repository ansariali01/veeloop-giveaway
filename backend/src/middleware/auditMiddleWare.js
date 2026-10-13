const User = require("../models/User");

const authenticateUser = async (req, res, next) => {
    try {
        // Temporary test authentication.
        // Later this will be replaced with JWT authentication.
        const userId = "6ab65e4bd54b6db1a3ba6753";

        const user = await User.findById(userId);

        if (!user) {
            return res.status(401).json({
                success: false,
                code: "LOGIN_REQUIRED",
                message: "User authentication required"
            });
        }

        req.user = user;

        next();
    } catch (error) {
        console.error("Authentication error:", error);

        return res.status(401).json({
            success: false,
            code: "LOGIN_REQUIRED",
            message: "Authentication failed"
        });
    }
};

module.exports = authenticateUser;