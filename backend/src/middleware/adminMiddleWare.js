const adminMiddleware = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            code: "LOGIN_REQUIRED",
            message: "Authentication required"
        });
    }

    if (req.user.role !== "ADMIN") {
        return res.status(403).json({
            success: false,
            code: "ADMIN_ACCESS_REQUIRED",
            message: "Administrator access required"
        });
    }

    next();
};

module.exports = adminMiddleware;