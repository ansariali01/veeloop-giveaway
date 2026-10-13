require("dotenv").config();

const mongoose = require("mongoose");
const User = require("./models/User");

async function createTestUser() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        const user = await User.create({
            name: "Test User",
            email: "testuser@veloop.com",
            veBalance: 1000,
            sveBalance: 500,
            tokenBalance: 5000
        });

        console.log("Test user created:");
        console.log(user);

        await mongoose.disconnect();
    } catch (error) {
        console.error("Error:", error);
    }
}

createTestUser();