
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const readline = require("readline");
const User = require("../models/User");

const ADMIN_USER_ID = "6ac38b62b6dc3be7f7c5c2f7";

async function main() {
    if (process.env.NODE_ENV === "production") {
        throw new Error("This development script cannot run in production");
    }

    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is missing from your local environment");
    }

    await mongoose.connect(process.env.MONGO_URI);

    const admin = await User.findById(ADMIN_USER_ID);

    if (!admin || admin.role !== "ADMIN") {
        throw new Error("The expected test admin account was not found");
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const password = await new Promise((resolve) => {
        rl.question("Enter a new local test-admin password: ", resolve);
    });

    rl.close();

    if (password.length < 12) {
        throw new Error("Use a password of at least 12 characters");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await User.updateOne(
        { _id: ADMIN_USER_ID, role: "ADMIN" },
        { $set: { passwordHash } }
    );

    console.log("Test admin password saved as a hash.");
    console.log("You can now log in using the admin account's email.");
}

main()
    .catch((error) => {
        console.error("Setup failed:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect().catch(() => {});
    });
