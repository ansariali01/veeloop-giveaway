const crypto = require("crypto");

const createDeviceHash = (deviceIdentifier) => {
    if (!deviceIdentifier) {
        return null;
    }

    return crypto
        .createHash("sha256")
        .update(deviceIdentifier)
        .digest("hex");
};

module.exports = createDeviceHash;