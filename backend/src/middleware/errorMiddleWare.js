const errorHandler = (err, req, res, next) => {
    console.error("Unhandled error:", err);

    return res.status(500).json({
        success: false,
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected server error occurred"
    });
};

module.exports = errorHandler;