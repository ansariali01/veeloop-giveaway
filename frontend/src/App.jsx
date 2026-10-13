import { useEffect, useState } from "react";
import "./App.css";

const API_BASE_URL = "http://localhost:5000/api";

function createIdempotencyKey() {
    if (window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}`;
}

function getDeviceId() {
    const existingDeviceId =
        localStorage.getItem("veloop_device_id");

    if (existingDeviceId) {
        return existingDeviceId;
    }

    const deviceId = createIdempotencyKey();

    localStorage.setItem(
        "veloop_device_id",
        deviceId
    );

    return deviceId;
}

function App() {
    const [giveaway, setGiveaway] = useState(null);
    const [prizes, setPrizes] = useState([]);

    const [loading, setLoading] = useState(true);

    const [countdown, setCountdown] = useState({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
    });

    const [joiningPrizeId, setJoiningPrizeId] =
        useState(null);

    const [joinMessage, setJoinMessage] =
        useState("");

    const [joinError, setJoinError] =
        useState("");

    const [claimInfo, setClaimInfo] =
        useState(null);

    const [claimLoading, setClaimLoading] =
        useState(false);

    const [claimForm, setClaimForm] = useState({
        fullName: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        pinCode: "",
        email: ""
    });

    const [claimSubmitting, setClaimSubmitting] =
        useState(false);

    const [claimMessage, setClaimMessage] =
        useState("");

    const [claimError, setClaimError] =
        useState("");

    const [previousWinners, setPreviousWinners] =
        useState([]);

    const [
        previousWinnersLoading,
        setPreviousWinnersLoading
    ] = useState(true);

    const [
        previousWinnersError,
        setPreviousWinnersError
    ] = useState("");

    /*
     * Load current giveaway and current user's claim status.
     */
    useEffect(() => {
        const loadGiveaway = async () => {
            try {
                setLoading(true);
                setJoinError("");

                const response = await fetch(
                    `${API_BASE_URL}/giveaways/current`
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                            "Failed to load giveaway"
                    );
                }

                const currentGiveaway =
                    data.data.giveaway;

                setGiveaway(currentGiveaway);
                setPrizes(data.data.prizes || []);

                /*
                 * Claim status is only useful when a giveaway
                 * has ended, but loading it here is safe because
                 * the backend returns NOT_AVAILABLE while active.
                 */
                if (currentGiveaway?._id) {
                    try {
                        setClaimLoading(true);

                        const claimResponse =
                            await fetch(
                                `${API_BASE_URL}/giveaways/${currentGiveaway._id}/my-claim`
                            );

                        const claimData =
                            await claimResponse.json();

                        if (claimResponse.ok) {
                            setClaimInfo(
                                claimData.data || null
                            );
                        }
                    } catch (claimLoadError) {
                        console.error(
                            "Claim status loading error:",
                            claimLoadError
                        );
                    } finally {
                        setClaimLoading(false);
                    }
                }
            } catch (error) {
                console.error(
                    "Giveaway loading error:",
                    error
                );

                setJoinError(
                    error.message ||
                        "Unable to load giveaway"
                );
            } finally {
                setLoading(false);
            }
        };

        loadGiveaway();
    }, []);

    /*
     * Live countdown.
     *
     * Backend remains the source of truth for the actual
     * giveaway status. This countdown is only a visual timer.
     */
    useEffect(() => {
        if (!giveaway) {
            return;
        }

        const updateCountdown = () => {
            const now = Date.now();

            let targetTime = null;

            if (giveaway.status === "UPCOMING") {
                targetTime = new Date(
                    giveaway.startAt
                ).getTime();
            } else if (giveaway.status === "ACTIVE") {
                targetTime = new Date(
                    giveaway.endAt
                ).getTime();
            }

            if (!targetTime) {
                setCountdown({
                    days: 0,
                    hours: 0,
                    minutes: 0,
                    seconds: 0
                });

                return;
            }

            const difference = Math.max(
                targetTime - now,
                0
            );

            const totalSeconds = Math.floor(
                difference / 1000
            );

            setCountdown({
                days: Math.floor(
                    totalSeconds / 86400
                ),
                hours: Math.floor(
                    (totalSeconds % 86400) / 3600
                ),
                minutes: Math.floor(
                    (totalSeconds % 3600) / 60
                ),
                seconds: totalSeconds % 60
            });
        };

        updateCountdown();

        const intervalId = setInterval(
            updateCountdown,
            1000
        );

        return () => {
            clearInterval(intervalId);
        };
    }, [giveaway]);

    /*
     * Load previous completed giveaways and their winners.
     */
    useEffect(() => {
        const loadPreviousWinners = async () => {
            try {
                setPreviousWinnersLoading(true);
                setPreviousWinnersError("");

                const response = await fetch(
                    `${API_BASE_URL}/giveaways/previous/winners`
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                            "Failed to load previous winners"
                    );
                }

                setPreviousWinners(
                    data.data?.giveaways || []
                );
            } catch (error) {
                console.error(
                    "Previous winners loading error:",
                    error
                );

                setPreviousWinnersError(
                    "Unable to load previous winners"
                );
            } finally {
                setPreviousWinnersLoading(false);
            }
        };

        loadPreviousWinners();
    }, []);

    /*
     * Join giveaway.
     */
    const handleJoinGiveaway = async (prizeId) => {
        if (!giveaway?._id) {
            return;
        }

        setJoiningPrizeId(prizeId);
        setJoinMessage("");
        setJoinError("");

        try {
            const deviceId = getDeviceId();

            const idempotencyKey =
                createIdempotencyKey();

            const response = await fetch(
                `${API_BASE_URL}/giveaways/${giveaway._id}/join`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                        "Idempotency-Key":
                            idempotencyKey,
                        "x-device-id":
                            deviceId
                    },
                    body: JSON.stringify({
                        prizeId
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                        "Unable to join giveaway"
                );
            }

            setJoinMessage(
                data.message ||
                    "You have successfully joined the giveaway!"
            );
        } catch (error) {
            console.error(
                "Join giveaway error:",
                error
            );

            setJoinError(
                error.message ||
                    "Unable to join giveaway"
            );
        } finally {
            setJoiningPrizeId(null);
        }
    };

    /*
     * Claim form input.
     */
    const handleClaimInputChange = (event) => {
        const { name, value } =
            event.target;

        setClaimForm((previous) => ({
            ...previous,
            [name]: value
        }));
    };

    /*
     * Submit prize claim.
     */
    const handleSubmitClaim = async (event) => {
        event.preventDefault();

        setClaimMessage("");
        setClaimError("");

        if (!giveaway?._id) {
            return;
        }

        if (!claimInfo?.isWinner) {
            setClaimError(
                "Only the selected winner can submit a claim."
            );

            return;
        }

        setClaimSubmitting(true);

        try {
            const prizeType =
                claimInfo.prize?.prizeType;

            let body;

            if (prizeType === "PHYSICAL") {
                body = {
                    fullName:
                        claimForm.fullName.trim(),
                    phone:
                        claimForm.phone.trim(),
                    address:
                        claimForm.address.trim(),
                    city:
                        claimForm.city.trim(),
                    state:
                        claimForm.state.trim(),
                    pinCode:
                        claimForm.pinCode.trim()
                };
            } else if (
                prizeType === "GIFT_CARD"
            ) {
                body = {
                    email:
                        claimForm.email
                            .trim()
                            .toLowerCase()
                };
            } else {
                setClaimError(
                    "Unsupported prize type."
                );

                return;
            }

            const response = await fetch(
                `${API_BASE_URL}/giveaways/${giveaway._id}/claim`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify(body)
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                        "Unable to submit claim"
                );
            }

            setClaimMessage(
                data.message ||
                    "Your prize claim has been submitted."
            );

            setClaimInfo((previous) => ({
                ...previous,
                claimStatus: "SUBMITTED"
            }));
        } catch (error) {
            console.error(
                "Prize claim error:",
                error
            );

            setClaimError(
                error.message ||
                    "Unable to submit prize claim"
            );
        } finally {
            setClaimSubmitting(false);
        }
    };

    /*
     * Loading state.
     */
if (loading) {
    return (
        <main className="app">
            <div className="veloop-loader">
                <div className="loader-reward">
                    <span>VE</span>
                </div>

                <p className="loader-eyebrow">
                    VELOOP REWARDS
                </p>

                <h1>
                    Unlocking rewards...
                </h1>

                <p className="loader-message">
                    Checking active giveaways
                </p>

                <div className="loader-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
            <section className="info-section">
                <div className="section-heading">
                    <p className="section-eyebrow">HOW IT WORKS</p>
                    <h2>How to participate</h2>
                </div>

                <div className="steps-grid">
                    <div className="info-card">
                        <span className="step-number">01</span>
                        <h3>Choose a prize</h3>
                        <p>
                            Select the available giveaway prize you want to enter.
                        </p>
                    </div>

                    <div className="info-card">
                        <span className="step-number">02</span>
                        <h3>Pay the entry fee</h3>
                        <p>
                            Confirm your entry using the required VELOOP currency.
                        </p>
                    </div>

                    <div className="info-card">
                        <span className="step-number">03</span>
                        <h3>Wait for the draw</h3>
                        <p>
                            Eligible participants are entered into the random winner
                            selection after the giveaway ends.
                        </p>
                    </div>

                    <div className="info-card">
                        <span className="step-number">04</span>
                        <h3>Claim your prize</h3>
                        <p>
                            If you win, follow the claim instructions shown for your
                            prize.
                        </p>
                    </div>
                </div>
            </section>

            <section className="info-section rules-section">
                <div className="section-heading">
                    <p className="section-eyebrow">IMPORTANT</p>
                    <h2>Giveaway rules</h2>
                </div>

                <div className="rules-card">
                    <ul>
                        <li>One participation is allowed per user for this giveaway.</li>
                        <li>
                            The entry fee and currency are determined by the backend.
                        </li>
                        <li>
                            Winners are selected only after the giveaway has ended.
                        </li>
                        <li>
                            A user cannot win multiple prizes in the same giveaway.
                        </li>
                        <li>
                            Prize claims are available only to the selected winner.
                        </li>
                    </ul>
                </div>
            </section>

            <section className="info-section faq-section">
                <div className="section-heading">
                    <p className="section-eyebrow">NEED HELP?</p>
                    <h2>FAQ</h2>
                </div>

                <div className="faq-grid">
                    <details className="faq-card">
                        <summary>Can I enter more than once?</summary>
                        <p>
                            No. The backend allows one participation per user for a
                            giveaway.
                        </p>
                    </details>

                    <details className="faq-card">
                        <summary>When are winners selected?</summary>
                        <p>
                            Winners are selected after the giveaway reaches its end time.
                        </p>
                    </details>

                    <details className="faq-card">
                        <summary>Can I claim a prize if I did not win?</summary>
                        <p>
                            No. Prize claims are restricted to the authenticated winner.
                        </p>
                    </details>

                    <details className="faq-card">
                        <summary>What information is needed to claim?</summary>
                        <p>
                            Physical prizes require delivery information, while gift
                            cards require an email address.
                        </p>
                    </details>
                </div>
            </section>
        </main>
    );
}

    /*
     * No current giveaway.
     */
    if (!giveaway) {
        return (
            <main className="app">
                <div className="error-card">
                    <p className="eyebrow">
                        VELOOP REWARDS
                    </p>

                    <h1>
                        No giveaway available
                    </h1>

                    <p>
                        There is currently no
                        giveaway available.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="app">
            {/* HERO */}
            <section className="hero">
                <p className="eyebrow">
                    VELOOP REWARDS
                </p>

                <h1>
                    {giveaway.title}
                </h1>

                <p className="description">
                    {giveaway.description}
                </p>

                <div
                    className={`status-badge ${giveaway.status.toLowerCase()}`}
                >
                    {giveaway.status}
                </div>

                {/* COUNTDOWN */}
                {giveaway.status !== "ENDED" &&
                    giveaway.status !== "ARCHIVED" && (
                        <div className="countdown-card">
                            <p className="countdown-label">
                                {giveaway.status ===
                                "UPCOMING"
                                    ? "STARTS IN"
                                    : "ENDS IN"}
                            </p>

                            <div className="countdown-grid">
                                <div className="countdown-item">
                                    <strong>
                                        {String(
                                            countdown.days
                                        ).padStart(
                                            2,
                                            "0"
                                        )}
                                    </strong>

                                    <span>
                                        Days
                                    </span>
                                </div>

                                <div className="countdown-item">
                                    <strong>
                                        {String(
                                            countdown.hours
                                        ).padStart(
                                            2,
                                            "0"
                                        )}
                                    </strong>

                                    <span>
                                        Hours
                                    </span>
                                </div>

                                <div className="countdown-item">
                                    <strong>
                                        {String(
                                            countdown.minutes
                                        ).padStart(
                                            2,
                                            "0"
                                        )}
                                    </strong>

                                    <span>
                                        Minutes
                                    </span>
                                </div>

                                <div className="countdown-item">
                                    <strong>
                                        {String(
                                            countdown.seconds
                                        ).padStart(
                                            2,
                                            "0"
                                        )}
                                    </strong>

                                    <span>
                                        Seconds
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
            </section>

            {/* GIVEAWAY DETAILS */}
            <section className="card">
                <div className="section-header">
                    <div>
                        <p className="section-label">
                            CURRENT GIVEAWAY
                        </p>

                        <h2>
                            Giveaway Details
                        </h2>
                    </div>
                </div>

                <div className="details-grid">
                    <div className="detail">
                        <span>
                            Status
                        </span>

                        <strong>
                            {giveaway.status}
                        </strong>
                    </div>

                    <div className="detail">
                        <span>
                            Starts
                        </span>

                        <strong>
                            {new Date(
                                giveaway.startAt
                            ).toLocaleString()}
                        </strong>
                    </div>

                    <div className="detail">
                        <span>
                            Ends
                        </span>

                        <strong>
                            {new Date(
                                giveaway.endAt
                            ).toLocaleString()}
                        </strong>
                    </div>

                    <div className="detail">
                        <span>
                            Winners
                        </span>

                        <strong>
                            {giveaway.winnerCount}
                        </strong>
                    </div>
                </div>
            </section>

            {/* PRIZES */}
            <section className="card">
                <div className="section-header">
                    <div>
                        <p className="section-label">
                            AVAILABLE PRIZES
                        </p>

                        <h2>
                            Win Exciting Prizes
                        </h2>
                    </div>
                </div>

                {prizes.length === 0 ? (
                    <p className="info-message">
                        No prizes are currently
                        configured.
                    </p>
                ) : (
                    <div className="prizes">
                        {prizes.map((prize) => (
                            <div
                                className="prize-card"
                                key={prize._id}
                            >
                                <div className="prize-content">
                                    <p className="prize-type">
                                        {prize.prizeType}
                                    </p>

                                    <h3>
                                        {prize.name}
                                    </h3>

                                    <p>
                                        {
                                            prize.description
                                        }
                                    </p>

                                    <div className="prize-details">
                                        <span>
                                            Entry fee
                                        </span>

                                        <strong>
                                            {
                                                prize.entryAmount
                                            }{" "}
                                            {
                                                prize.entryCurrency
                                            }
                                        </strong>
                                    </div>

                                    <div className="prize-details">
                                        <span>
                                            Winners
                                        </span>

                                        <strong>
                                            {
                                                prize.winnerCount
                                            }
                                        </strong>
                                    </div>
                                </div>

                                {giveaway.status ===
                                    "ACTIVE" && (
                                    <button
                                        className="join-button"
                                        disabled={
                                            joiningPrizeId ===
                                            prize._id
                                        }
                                        onClick={() =>
                                            handleJoinGiveaway(
                                                prize._id
                                            )
                                        }
                                    >
                                        {joiningPrizeId ===
                                        prize._id
                                            ? "Joining..."
                                            : "Join Giveaway"}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {joinMessage && (
                    <div className="success-message">
                        {joinMessage}
                    </div>
                )}

                {joinError && (
                    <div className="error-message">
                        {joinError}
                    </div>
                )}

                {giveaway.status ===
                    "UPCOMING" && (
                    <p className="info-message">
                        The giveaway has not started
                        yet.
                    </p>
                )}

                {giveaway.status ===
                    "ENDED" && (
                    <p className="info-message">
                        This giveaway has ended.
                    </p>
                )}
            </section>

            {/* WINNER STATUS / CLAIM */}
            {giveaway.status === "ENDED" && (
                <section className="card">
                    <div className="section-header">
                        <div>
                            <p className="section-label">
                                YOUR RESULT
                            </p>

                            <h2>
                                Winner Status
                            </h2>
                        </div>
                    </div>

                    {claimLoading ? (
                        <p className="info-message">
                            Checking your winner status...
                        </p>
                    ) : !claimInfo?.isWinner ? (
                        <div className="info-message">
                            <p>
                                You were not selected
                                as a winner for this
                                giveaway.
                            </p>
                        </div>
                    ) : (
                        <div>
                            <div className="success-message">
                                <strong>
                                    Congratulations!
                                </strong>

                                <p>
                                    You won{" "}
                                    {claimInfo.prize
                                        ?.name ||
                                        "a prize"}.
                                </p>

                                <p>
                                    Status: Winner
                                </p>
                            </div>

                            {claimInfo.claimStatus ===
                                "SUBMITTED" ||
                            claimInfo.claimStatus ===
                                "PROCESSING" ||
                            claimInfo.claimStatus ===
                                "COMPLETED" ? (
                                <div className="info-message">
                                    <strong>
                                        Claim Submitted
                                    </strong>

                                    <p>
                                        Your prize claim
                                        has been received
                                        and will be
                                        processed by the
                                        team.
                                    </p>

                                    <p>
                                        Status:{" "}
                                        {
                                            claimInfo.claimStatus
                                        }
                                    </p>
                                </div>
                            ) : (
                                <form
                                    className="claim-form"
                                    onSubmit={
                                        handleSubmitClaim
                                    }
                                >
                                    <h3>
                                        Claim Your Prize
                                    </h3>

                                    <p>
                                        {
                                            claimInfo.prize
                                                ?.name
                                        }
                                    </p>

                                    {claimInfo.prize
                                        ?.prizeType ===
                                        "PHYSICAL" ? (
                                        <>
                                            <label>
                                                Full Name

                                                <input
                                                    type="text"
                                                    name="fullName"
                                                    value={
                                                        claimForm.fullName
                                                    }
                                                    onChange={
                                                        handleClaimInputChange
                                                    }
                                                    required
                                                />
                                            </label>

                                            <label>
                                                Phone Number

                                                <input
                                                    type="tel"
                                                    name="phone"
                                                    value={
                                                        claimForm.phone
                                                    }
                                                    onChange={
                                                        handleClaimInputChange
                                                    }
                                                    required
                                                />
                                            </label>

                                            <label>
                                                Complete Address

                                                <textarea
                                                    name="address"
                                                    value={
                                                        claimForm.address
                                                    }
                                                    onChange={
                                                        handleClaimInputChange
                                                    }
                                                    required
                                                />
                                            </label>

                                            <label>
                                                City

                                                <input
                                                    type="text"
                                                    name="city"
                                                    value={
                                                        claimForm.city
                                                    }
                                                    onChange={
                                                        handleClaimInputChange
                                                    }
                                                    required
                                                />
                                            </label>

                                            <label>
                                                State

                                                <input
                                                    type="text"
                                                    name="state"
                                                    value={
                                                        claimForm.state
                                                    }
                                                    onChange={
                                                        handleClaimInputChange
                                                    }
                                                    required
                                                />
                                            </label>

                                            <label>
                                                PIN Code

                                                <input
                                                    type="text"
                                                    name="pinCode"
                                                    value={
                                                        claimForm.pinCode
                                                    }
                                                    onChange={
                                                        handleClaimInputChange
                                                    }
                                                    required
                                                />
                                            </label>
                                        </>
                                    ) : (
                                        <label>
                                            Email Address

                                            <input
                                                type="email"
                                                name="email"
                                                value={
                                                    claimForm.email
                                                }
                                                onChange={
                                                    handleClaimInputChange
                                                }
                                                required
                                            />
                                        </label>
                                    )}

                                    {claimMessage && (
                                        <div className="success-message">
                                            {
                                                claimMessage
                                            }
                                        </div>
                                    )}

                                    {claimError && (
                                        <div className="error-message">
                                            {claimError}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        className="join-button"
                                        disabled={
                                            claimSubmitting
                                        }
                                    >
                                        {claimSubmitting
                                            ? "Submitting..."
                                            : "Submit Claim"}
                                    </button>
                                </form>
                            )}
                        </div>
                    )}
                </section>
            )}

            {/* PREVIOUS WINNERS */}
            <section className="card">
                <div className="section-header">
                    <div>
                        <p className="section-label">
                            GIVEAWAY HISTORY
                        </p>

                        <h2>
                            Previous Winners
                        </h2>
                    </div>
                </div>

                {previousWinnersLoading ? (
                    <p className="info-message">
                        Loading previous winners...
                    </p>
                ) : previousWinnersError ? (
                    <div className="error-message">
                        {previousWinnersError}
                    </div>
                ) : previousWinners.length ===
                  0 ? (
                    <p className="info-message">
                        Previous winners will appear
                        here after a giveaway is
                        completed.
                    </p>
                ) : (
                    <div className="prizes">
                        {previousWinners.map(
                            (history) => (
                                <div
                                    className="prize-card"
                                    key={
                                        history.giveawayId
                                    }
                                >
                                    <div className="prize-content">
                                        <p className="prize-type">
                                            COMPLETED GIVEAWAY
                                        </p>

                                        <h3>
                                            {
                                                history.title
                                            }
                                        </h3>

                                        <p>
                                            {
                                                history.description
                                            }
                                        </p>

                                        {history.winners
                                            ?.length >
                                        0 ? (
                                            history.winners.map(
                                                (
                                                    winner
                                                ) => (
                                                    <div
                                                        className="prize-details"
                                                        key={
                                                            winner.winnerId
                                                        }
                                                    >
                                                        <span>
                                                            Winner
                                                        </span>

                                                        <strong>
                                                            {
                                                                winner.user
                                                            }
                                                        </strong>

                                                        <span>
                                                            Prize
                                                        </span>

                                                        <strong>
                                                            {
                                                                winner
                                                                    .prize
                                                                    ?.name
                                                            }
                                                        </strong>

                                                        <span>
                                                            Date
                                                        </span>

                                                        <strong>
                                                            {new Date(
                                                                winner.selectedAt
                                                            ).toLocaleDateString()}
                                                        </strong>

                                                        <span>
                                                            Status
                                                        </span>

                                                        <strong>
                                                            {
                                                                winner.status
                                                            }
                                                        </strong>
                                                    </div>
                                                )
                                            )
                                        ) : (
                                            <p className="info-message">
                                                No winners
                                                have been
                                                recorded
                                                for this
                                                giveaway.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                )}
            </section>
        </main>
    );
}

export default App;