const express = require("express");

const authenticateUser = require("../middleware/authMiddleWare");
const adminMiddleware = require("../middleware/adminMiddleWare");
const { joinLimiter } = require("../middleware/rateLimitMiddleWare");

const {
    getCurrentGiveaway,
    getGiveawayById
} = require("../controllers/giveAwayController");

const {
    joinGiveaway
} = require("../controllers/giveAwayJoinController");

const {
    selectGiveawayWinners
} = require("../controllers/giveawayWinnerController");

const {
    submitPrizeClaim
} = require("../controllers/prizeClaimController");

const {
    getGiveawayWinners,
    getPreviousGiveawayWinners,
    getMyGiveawayClaim
} = require("../controllers/giveawayWinnerReadController");

const router = express.Router();

router.get("/current", getCurrentGiveaway);

router.get(
    "/previous/winners",
    getPreviousGiveawayWinners
);

router.get("/:id/winners", getGiveawayWinners);

router.get(
    "/:id/my-claim",
    authenticateUser,
    getMyGiveawayClaim
);

router.post(
    "/:id/join",
    joinLimiter,
    authenticateUser,
    joinGiveaway
);

router.post(
    "/:id/claim",
    authenticateUser,
    submitPrizeClaim
);

router.post(
    "/:id/select-winners",
    authenticateUser,
    adminMiddleware,
    selectGiveawayWinners
);

router.get("/:id", getGiveawayById);

module.exports = router;