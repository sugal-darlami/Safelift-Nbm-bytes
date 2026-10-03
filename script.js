/* =========================================================
   SAFELIFT 360 — TRAINING LOGIC
   ========================================================= */

/* =========================================================
   STATE
   ========================================================= */

let totalScore = 0;
let currentScenario = 1;
let answered = false;
let videoFinished = false;

// 100-Mark Assessment System State
let loadInspectionScore = 0;
let routeCheckScore = 0;
let safeLiftScore = 0;
let safetyPrecautionsScore = 0;
let safetyPrecautionsReviewed = false;
let trainingResultSaved = false;

let scenarioScored = {
    1: false,
    2: false,
    3: false
};

let usedOptions = {
    1: [],
    2: [],
    3: []
};

let completedScenarios = {
    1: false,
    2: false,
    3: false
};

let scenarioAttempts = {
    1: 0,
    2: 0,
    3: 0
};

let timerInterval = null;
let elapsedSeconds = 0;
let timerRunning = false;

const hotspotElements = {};


/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const elements = {
    startScreen: document.getElementById("startScreen"),
    startTrainingBtn: document.getElementById("startTrainingBtn"),

    trainingScreen: document.getElementById("trainingScreen"),
    scenarioNumber: document.getElementById("scenarioProgressCount") || document.getElementById("scenarioNumber"),
    scenarioProgressCount: document.getElementById("scenarioProgressCount"),
    scenarioChecklist: document.getElementById("scenarioChecklist"),
    checkItem1: document.getElementById("checkItem1"),
    checkItem2: document.getElementById("checkItem2"),
    checkItem3: document.getElementById("checkItem3"),
    trainingTimer: document.getElementById("trainingTimer"),
    timerDisplay: document.getElementById("timerDisplay"),
    score: document.getElementById("score"),

    questionPanel: document.getElementById("questionPanel"),
    challengeBadge: document.getElementById("challengeBadge"),
    challengeTitle: document.getElementById("challengeTitle"),
    challengeSubtitle: document.getElementById("challengeSubtitle"),
    assessmentStatus: document.getElementById("assessmentStatus"),
    statusMarks: document.getElementById("statusMarks"),
    statusAttempt: document.getElementById("statusAttempt"),
    statusRemaining: document.getElementById("statusRemaining"),
    questionText: document.getElementById("questionText"),
    answers: document.getElementById("answers"),

    feedback: document.getElementById("feedback"),
    feedbackTitle: document.getElementById("feedbackTitle"),
    feedbackMessage: document.getElementById("feedbackMessage"),

    nextButton: document.getElementById("nextButton"),
    retryButton: document.getElementById("retryButton"),
    exitButton: document.getElementById("exitButton"),

    videoModal: document.getElementById("videoModal"),
    trainingVideo: document.getElementById("trainingVideo"),
    videoBadge: document.getElementById("videoBadge"),
    videoTitle: document.getElementById("videoTitle"),
    videoMessage: document.getElementById("videoMessage"),
    videoTimerNotice: document.getElementById("videoTimerNotice"),
    nextVideoButton: document.getElementById("nextVideoButton"),

    endScreen: document.getElementById("endScreen"),
    finalScenarios: document.getElementById("finalScenarios"),
    finalScore: document.getElementById("finalScore"),
    finalAccuracy: document.getElementById("finalAccuracy"),
    finalTime: document.getElementById("finalTime"),
    performanceHeadline: document.getElementById("performanceHeadline"),
    performanceMessage: document.getElementById("performanceMessage"),

    // Assessment Breakdown
    breakdownLoad: document.getElementById("breakdownLoad"),
    breakdownRoute: document.getElementById("breakdownRoute"),
    breakdownLift: document.getElementById("breakdownLift"),
    breakdownSafety: document.getElementById("breakdownSafety"),
    breakdownTotal: document.getElementById("breakdownTotal")
};

/* =========================================================
   SCORING HELPERS
   ========================================================= */

function getScenarioScore(scenarioNumber) {
    if (scenarioNumber === 1) return loadInspectionScore;
    if (scenarioNumber === 2) return routeCheckScore;
    if (scenarioNumber === 3) return safeLiftScore;
    return 0;
}

function awardScenarioScore(scenarioNumber, score) {
    if (scenarioScored[scenarioNumber]) {
        return;
    }
    scenarioScored[scenarioNumber] = true;

    if (scenarioNumber === 1) {
        loadInspectionScore = score;
    } else if (scenarioNumber === 2) {
        routeCheckScore = score;
    } else if (scenarioNumber === 3) {
        safeLiftScore = score;
    }

    updateTotalScore();
}

function updateTotalScore() {
    totalScore =
        loadInspectionScore +
        routeCheckScore +
        safeLiftScore +
        safetyPrecautionsScore;

    if (elements.score) {
        elements.score.textContent = `${totalScore} / 100`;
    }
}

function updateAssessmentStatus(scenarioNumber) {
    if (!elements.assessmentStatus) {
        return;
    }

    if (!scenarioNumber) {
        elements.assessmentStatus.style.display = "none";
        return;
    }

    elements.assessmentStatus.style.display = "flex";
    const attemptsUsed = scenarioAttempts[scenarioNumber] || 0;
    const currentAttempt = Math.min(attemptsUsed + 1, 4);
    const attemptsRemaining = Math.max(4 - attemptsUsed, 0);

    if (elements.statusMarks) {
        elements.statusMarks.textContent = "30";
    }
    if (elements.statusAttempt) {
        elements.statusAttempt.textContent = `${currentAttempt} of 4`;
    }
    if (elements.statusRemaining) {
        elements.statusRemaining.textContent = `${attemptsRemaining}`;
    }
}


/* =========================================================
   TRAINING TIMER
   ========================================================= */

function formatTime(totalSec) {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const formattedMins = String(mins).padStart(2, "0");
    const formattedSecs = String(secs).padStart(2, "0");
    return `${formattedMins}:${formattedSecs}`;
}

function startTimer() {
    if (timerRunning) {
        return;
    }

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    timerRunning = true;

    timerInterval = setInterval(() => {
        elapsedSeconds++;
        updateTimerDisplay();
    }, 1000);

    updateTimerDisplay();
}

function pauseTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    timerRunning = false;
    updateTimerDisplay(true);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    timerRunning = false;
}

function resetTimer() {
    stopTimer();
    elapsedSeconds = 0;
    updateTimerDisplay();
}

function updateTimerDisplay(isPaused = false) {
    if (elements.timerDisplay) {
        elements.timerDisplay.textContent =
            formatTime(elapsedSeconds) + (isPaused ? " ⏸" : "");
    }
}


/* =========================================================
   TRAINING DATA
   ========================================================= */

const scenarios = {
    1: {
        name: "LOAD INSPECTION",
        subtitle: "Identify the safest action before handling this load.",
        title: "Question — Load Inspection",

        question:
            "You have found the load. Before lifting it, what should you do first?",

        options: [
            "Lift it immediately",
            "Assess the load and check whether it is safe to handle",
            "Pull the box towards you quickly",
            "Use one hand to test the box"
        ],

        correctAnswer: 1,

        feedback:
            "The first step is to assess the load and consider whether it can be safely handled.",

        video: {
            path: "assets/Q1_Load_Assessment.mp4",
            title: "Correct Answer — Load Inspection",
            message:
                "Watch the training video. When it finishes, click Next Question."
        }
    },

    2: {
        name: "ROUTE CHECK",
        subtitle: "Ensure the path of movement is safe and unobstructed.",
        title: "Question — Route Check",

        question:
            "Before carrying the load, what should you check?",

        options: [
            "Whether the route is clear and suitable",
            "Whether you can carry it as quickly as possible",
            "Whether you can carry it with one hand",
            "Whether you can avoid looking at the route"
        ],

        correctAnswer: 0,

        feedback:
            "Before carrying the load, check that the route is clear and suitable.",

        video: {
            path: "assets/Q2_Route_Check.mp4",
            title: "Correct Answer — Route Check",
            message:
                "Watch the training video. When it finishes, click Next Question."
        }
    },

    3: {
        name: "SAFE LIFT",
        subtitle: "Apply proper posture and stable manual handling technique.",
        title: "Question — Safe Handling",

        question:
            "When handling the load, which approach is safest?",

        options: [
            "Move quickly and twist while carrying",
            "Use a stable position, secure grip and controlled movement",
            "Hold the load away from your body",
            "Carry the load without checking your position"
        ],

        correctAnswer: 1,

        feedback:
            "The safer approach is to use a stable position, secure grip and controlled movement.",

        video: {
            path: "assets/Q3_Safe_Handling.mp4",
            title: "Correct Answer — Safe Handling",
            message:
                "Watch the training video. When it finishes, click Finish Training."
        }
    }
};


/* =========================================================
   START TRAINING
   ========================================================= */

elements.startTrainingBtn.onclick = () => {
    elements.startScreen.classList.add("hidden");
    startTimer();
};


/* =========================================================
   PANORAMA
   ========================================================= */

const viewer = pannellum.viewer("panorama", {
    type: "equirectangular",
    panorama: "assets/warehouse.jpg",

    autoLoad: true,
    showControls: true,

    hfov: 100,
    pitch: 0,
    yaw: 0,

    hotSpots: [
        {
            pitch: -10,
            yaw: 5,
            type: "custom",
            cssClass: "training-hotspot",

            createTooltipFunc: createTrainingHotspot,

            createTooltipArgs: {
                icon: "📦",
                title: "LOAD INSPECTION",
                label: "CLICK TO INSPECT",
                scenarioNumber: 1,
                action: () => startScenario(1)
            }
        },

        {
            pitch: -5,
            yaw: 80,
            type: "custom",
            cssClass: "training-hotspot",

            createTooltipFunc: createTrainingHotspot,

            createTooltipArgs: {
                icon: "🚧",
                title: "ROUTE CHECK",
                label: "CLICK TO INSPECT",
                scenarioNumber: 2,
                action: () => startScenario(2)
            }
        },

        {
            pitch: -8,
            yaw: -70,
            type: "custom",
            cssClass: "training-hotspot",

            createTooltipFunc: createTrainingHotspot,

            createTooltipArgs: {
                icon: "🏋️",
                title: "SAFE LIFT",
                label: "CLICK TO INSPECT",
                scenarioNumber: 3,
                action: () => startScenario(3)
            }
        },

        {
            pitch: -5,
            yaw: 150,
            type: "custom",
            cssClass: "training-hotspot",

            createTooltipFunc: createTrainingHotspot,

            createTooltipArgs: {
                icon: "⚠️",
                title: "SAFETY CHECK",
                label: "CLICK FOR INFO",
                action: showSafetyInfo
            }
        }
    ]
});


/* =========================================================
   HOTSPOT CREATION
   ========================================================= */

function createTrainingHotspot(hotSpotDiv, args) {
    hotSpotDiv.classList.add("training-hotspot");

    if (args.scenarioNumber) {
        hotSpotDiv.dataset.scenario = args.scenarioNumber;

        // Store the hotspot and its original action
        hotspotElements[args.scenarioNumber] = {
            element: hotSpotDiv,
            action: args.action
        };
    }

    hotSpotDiv.innerHTML = `
        <div class="object-marker">
            <div class="object-icon">
                ${args.icon}
            </div>

            <div class="object-pulse"></div>
        </div>

        <div class="object-label">
            <strong>${args.title}</strong>
            <small>${args.label}</small>
        </div>
    `;

    hotSpotDiv.onclick = function () {
        if (
            args.scenarioNumber &&
            completedScenarios[args.scenarioNumber]
        ) {
            return;
        }

        args.action();
    };
}


/* =========================================================
   START SCENARIO
   ========================================================= */

function startScenario(scenarioNumber) {
    // Stop completed scenarios from opening again
    if (completedScenarios[scenarioNumber]) {
        return;
    }

    if (answered) {
        return;
    }

    currentScenario = scenarioNumber;
    answered = false;

    hideFeedback();
    showQuestion(scenarioNumber);
}

/* =========================================================
   SHOW QUESTION
   ========================================================= */

function showQuestion(scenarioNumber) {
    const scenario = scenarios[scenarioNumber];

    if (!scenario) {
        return;
    }

    elements.questionPanel.classList.add("active");

    if (elements.challengeBadge) {
        elements.challengeBadge.textContent = scenario.name || "ASSESSMENT SCENARIO";
    }
    elements.challengeTitle.textContent = scenario.title;
    if (elements.challengeSubtitle) {
        elements.challengeSubtitle.textContent = scenario.subtitle || "";
        elements.challengeSubtitle.style.display = scenario.subtitle ? "block" : "none";
    }
    elements.questionText.textContent = scenario.question;

    updateAssessmentStatus(scenarioNumber);

    elements.answers.innerHTML = "";

    const selectedOptions = usedOptions[scenarioNumber] || [];

    scenario.options.forEach((option, index) => {
        const button = document.createElement("button");

        button.className = "answer-button";
        button.textContent = option;

        if (selectedOptions.includes(index)) {
            button.classList.add("incorrect-choice");
            button.disabled = true;
        } else {
            button.onclick = () => {
                checkAnswer(index);
            };
        }

        elements.answers.appendChild(button);
    });
}


/* =========================================================
   CHECK ANSWER
   ========================================================= */

function checkAnswer(selectedAnswer) {
    if (answered) {
        return;
    }

    const scenario = scenarios[currentScenario];

    if (!scenario) {
        return;
    }

    if (!usedOptions[currentScenario]) {
        usedOptions[currentScenario] = [];
    }

    // Do not allow repeatedly selecting the same wrong option
    if (usedOptions[currentScenario].includes(selectedAnswer)) {
        return;
    }

    usedOptions[currentScenario].push(selectedAnswer);

    // Record attempt for the current scenario
    scenarioAttempts[currentScenario] = (scenarioAttempts[currentScenario] || 0) + 1;
    const currentAttempt = scenarioAttempts[currentScenario];

    const answerButtons = elements.answers.querySelectorAll(".answer-button");
    const clickedButton = answerButtons[selectedAnswer];

    const isCorrect = selectedAnswer === scenario.correctAnswer;

    if (isCorrect) {
        answered = true;

        if (clickedButton) {
            clickedButton.classList.add("correct-choice");
        }
        disableButtons();

        // Scoring:
        // Attempt 1: 30 marks
        // Attempt 2: 20 marks
        // Attempt 3: 10 marks
        // Attempt 4: 5 marks
        let marksEarned = 5;
        if (currentAttempt === 1) {
            marksEarned = 30;
        } else if (currentAttempt === 2) {
            marksEarned = 20;
        } else if (currentAttempt === 3) {
            marksEarned = 10;
        } else {
            marksEarned = 5;
        }

        awardScenarioScore(currentScenario, marksEarned);

        const titleText = `✓ Correct`;
        const feedbackMsg = `Correct — ${marksEarned} / 30 marks\n\nMarks Earned:\n${marksEarned} / 30\n\n${scenario.feedback}`;
        showFeedback(titleText, feedbackMsg, true);
    } else {
        // Incorrect answer
        if (clickedButton) {
            clickedButton.classList.add("incorrect-choice");
            clickedButton.disabled = true;
        }

        const remainingAttempts = 4 - currentAttempt;

        if (remainingAttempts > 0) {
            // Still has attempts remaining (attempts 1, 2, or 3)
            const remainingWord = remainingAttempts === 1 ? "1 attempt remaining." : `${remainingAttempts} attempts remaining.`;
            const msg = `That isn't the safest choice.\n\n${remainingWord}`;
            showFeedback("Not quite.", msg, false, false);
        } else {
            // All 4 attempts exhausted -> 0 marks
            answered = true;
            disableButtons();

            awardScenarioScore(currentScenario, 0);

            const reviewMsg = `No more attempts remaining.\nScore Earned: 0 / 30\n\nCorrect Answer:\n${scenario.options[scenario.correctAnswer]}\n\nWhy:\n${scenario.feedback}`;
            showFeedback("Assessment Review", reviewMsg, false, true);
        }
    }
}


/* =========================================================
   TRAINING VIDEO
   ========================================================= */

function playTrainingVideo(scenario) {
    // Immediately pause active training timer while video modal is open
    pauseTimer();

    const video = elements.trainingVideo;

    videoFinished = false;

    if (elements.videoBadge) {
        elements.videoBadge.textContent = "TRAINING REVIEW COMPLETE";
    }
    elements.videoTitle.textContent = scenario.video.title;
    elements.videoMessage.textContent =
        "Watch the demonstration video to reinforce the correct safety procedure, or press Continue at any time.";

    elements.nextVideoButton.disabled = false;
    elements.nextVideoButton.textContent = "Continue";

    video.src = scenario.video.path;
    video.currentTime = 0;

    elements.videoModal.classList.add("show");

    const playPromise = video.play();

    if (playPromise !== undefined) {
        playPromise.catch(() => {
            // Autoplay may be blocked by the browser.
            // The user can press the video play button.
        });
    }
}


/* =========================================================
   VIDEO FINISHED
   ========================================================= */

elements.trainingVideo.addEventListener("ended", () => {
    videoFinished = true;

    elements.nextVideoButton.disabled = false;

    elements.videoMessage.textContent =
        currentScenario === 3
            ? "Video complete. Press Continue to finish the training."
            : "Video complete. Press Continue to proceed.";
});


/* =========================================================
   CONTINUE AFTER VIDEO
   ========================================================= */

function continueAfterVideo() {
    closeTrainingVideo();

    elements.questionPanel.classList.remove("active");

    completeCurrentScenario();

    // If training is still ongoing (fewer than 3 completed), resume active training timer
    if (getCompletedCount() < 3) {
        startTimer();
    }
}


/* =========================================================
   COMPLETE CURRENT SCENARIO
   ========================================================= */

function completeCurrentScenario() {
    // Prevent the same scenario from being completed twice
    if (completedScenarios[currentScenario]) {
        return;
    }

    completedScenarios[currentScenario] = true;

    // Find the completed hotspot
    const completedHotspot = document.querySelector(
        `[data-scenario="${currentScenario}"]`
    );

    if (completedHotspot) {
        completedHotspot.classList.add("completed");
        completedHotspot.onclick = null;
        completedHotspot.style.pointerEvents = "none";

        const labelSmall = completedHotspot.querySelector(".object-label small");
        if (labelSmall) {
            labelSmall.textContent = "✓ COMPLETED";
        }
    }

    const completedCount = getCompletedCount();

    updateProgress(completedCount);

    if (completedCount === 3) {
        finishTraining();
        return;
    }

    answered = false;
}


/* =========================================================
   GET COMPLETED SCENARIOS
   ========================================================= */

function getCompletedCount() {
    return Object.values(completedScenarios)
        .filter(Boolean)
        .length;
}


/* =========================================================
   UPDATE PROGRESS
   ========================================================= */

function updateProgress(completedCount) {
    if (elements.scenarioProgressCount) {
        elements.scenarioProgressCount.textContent = `Scenarios: ${completedCount} / 3`;
    }
    if (elements.scenarioNumber && elements.scenarioNumber !== elements.scenarioProgressCount) {
        elements.scenarioNumber.textContent = `Explore: ${completedCount}/3 completed`;
    }

    // Update checklist items dynamically from completedScenarios state
    const checklistData = [
        { el: elements.checkItem1, completed: completedScenarios[1], title: "Load Inspection" },
        { el: elements.checkItem2, completed: completedScenarios[2], title: "Route Check" },
        { el: elements.checkItem3, completed: completedScenarios[3], title: "Safe Lift" }
    ];

    checklistData.forEach(item => {
        if (item.el) {
            if (item.completed) {
                item.el.classList.add("completed");
                item.el.innerHTML = `<span class="check-icon">✓</span> ${item.title}`;
            } else {
                item.el.classList.remove("completed");
                item.el.innerHTML = `<span class="check-icon">○</span> ${item.title}`;
            }
        }
    });
}


/* =========================================================
   FINISH TRAINING
   ========================================================= */

function finishTraining() {
    stopTimer();

    if (elements.scenarioNumber) {
        elements.scenarioNumber.textContent = "Completed: 3/3";
    }
    if (elements.scenarioProgressCount) {
        elements.scenarioProgressCount.textContent = "Scenarios: 3 / 3";
    }

    const completedCount = getCompletedCount();
    updateTotalScore();

    if (elements.finalScenarios) {
        elements.finalScenarios.textContent = `${completedCount} / 3`;
    }
    if (elements.finalScore) {
        elements.finalScore.textContent = `${totalScore} / 100`;
    }
    if (elements.finalAccuracy) {
        elements.finalAccuracy.textContent = `${totalScore}%`;
    }
    if (elements.finalTime) {
        elements.finalTime.textContent = formatTime(elapsedSeconds);
    }

    // Populate Assessment Breakdown Table
    if (elements.breakdownLoad) {
        elements.breakdownLoad.textContent = `${loadInspectionScore} / 30`;
    }
    if (elements.breakdownRoute) {
        elements.breakdownRoute.textContent = `${routeCheckScore} / 30`;
    }
    if (elements.breakdownLift) {
        elements.breakdownLift.textContent = `${safeLiftScore} / 30`;
    }
    if (elements.breakdownSafety) {
        elements.breakdownSafety.textContent = `${safetyPrecautionsScore} / 10`;
    }
    if (elements.breakdownTotal) {
        elements.breakdownTotal.textContent = `${totalScore} / 100`;
    }

    let headline = "Safety starts with awareness.";
    let message =
        "Remember to assess the load, check your route, and use safe handling techniques.";

    if (totalScore === 100) {
        headline = "Perfect Score! Safety Champion.";
        message =
            "Outstanding! You achieved 100/100 across all assessment scenarios and safety precautions.";
    } else if (totalScore >= 70) {
        headline = "Great Job! Well Prepared.";
        message =
            "You completed all scenarios successfully. Keep practicing safe handling principles in the warehouse.";
    } else {
        headline = "Training Completed!";
        message =
            "You finished all scenarios. Review the safe handling guidelines and precautions to sharpen your skills.";
    }

    if (elements.performanceHeadline) {
        elements.performanceHeadline.textContent = headline;
    }
    if (elements.performanceMessage) {
        elements.performanceMessage.textContent = message;
    }

    elements.trainingScreen.style.display = "none";
    elements.endScreen.classList.add("active");

    // Persist completed training result to backend API (Stage 4.1)
    saveTrainingResultToBackend();
}


/* =========================================================
   CLOSE TRAINING VIDEO
   ========================================================= */

function closeTrainingVideo() {
    const video = elements.trainingVideo;

    video.pause();
    video.currentTime = 0;
    video.src = "";

    elements.videoModal.classList.remove("show");

    videoFinished = false;
}


/* =========================================================
   SKIP VIDEO
   ========================================================= */

function skipTrainingVideo() {
    closeTrainingVideo();

    elements.questionPanel.classList.add("active");
}


/* =========================================================
   DISABLE ANSWERS
   ========================================================= */

function disableButtons() {
    document
        .querySelectorAll(".answer-button")
        .forEach(button => {
            button.disabled = true;
        });
}


/* =========================================================
   FEEDBACK
   ========================================================= */

function showFeedback(title, message, correct, isAttemptsExhausted = false) {
    elements.feedbackTitle.textContent = title;
    elements.feedbackMessage.style.whiteSpace = "pre-line";
    elements.feedbackMessage.textContent = message;

    elements.feedback.classList.remove(
        "correct",
        "incorrect"
    );

    if (correct) {
        elements.feedback.classList.add("correct");

        elements.retryButton.style.display = "none";
        elements.exitButton.style.display = "none";

        elements.nextButton.textContent = "Continue to Video →";
        elements.nextButton.style.display = "inline-block";
    } else if (isAttemptsExhausted) {
        elements.feedback.classList.add("incorrect");

        elements.retryButton.style.display = "none";
        elements.exitButton.style.display = "none";

        // Learner proceeds to video after fourth wrong answer review
        elements.nextButton.textContent = "Continue to Video →";
        elements.nextButton.style.display = "inline-block";
    } else {
        elements.feedback.classList.add("incorrect");

        elements.nextButton.style.display = "none";

        elements.retryButton.textContent = "Try Again";
        elements.retryButton.style.display = "inline-block";
        elements.exitButton.style.display = "none";
    }

    elements.feedback.classList.add("show");
}


/* =========================================================
   PROCEED TO VIDEO
   ========================================================= */

function proceedToVideo() {
    hideFeedback();

    elements.questionPanel.classList.remove("active");

    const scenario = scenarios[currentScenario];

    if (scenario) {
        playTrainingVideo(scenario);
    }
}

// Alias for backwards compatibility
const nextChallenge = proceedToVideo;


/* =========================================================
   HIDE FEEDBACK
   ========================================================= */

function hideFeedback() {
    elements.feedback.classList.remove("show");
}


/* =========================================================
   RETRY QUESTION
   ========================================================= */

function retryQuestion() {
    hideFeedback();
    answered = false;
    updateAssessmentStatus(currentScenario);
}


/* =========================================================
   EXIT TRAINING
   ========================================================= */

function exitTraining() {
    location.reload();
}


/* =========================================================
   RESTART TRAINING
   ========================================================= */

function restartTraining() {
    // Reset all assessment score state
    loadInspectionScore = 0;
    routeCheckScore = 0;
    safeLiftScore = 0;
    safetyPrecautionsScore = 0;
    safetyPrecautionsReviewed = false;
    trainingResultSaved = false;
    totalScore = 0;

    scenarioScored = {
        1: false,
        2: false,
        3: false
    };

    usedOptions = {
        1: [],
        2: [],
        3: []
    };

    scenarioAttempts = {
        1: 0,
        2: 0,
        3: 0
    };

    completedScenarios = {
        1: false,
        2: false,
        3: false
    };

    currentScenario = 1;
    answered = false;
    videoFinished = false;

    // Reset and start timer fresh from 00:00 for the new training session
    resetTimer();
    startTimer();

    // Re-enable all scenario hotspots
    for (let i = 1; i <= 3; i++) {
        const hotspotData = hotspotElements[i];

        if (hotspotData) {
            hotspotData.element.style.pointerEvents = "auto";
            hotspotData.element.classList.remove("completed");

            const labelSmall = hotspotData.element.querySelector(".object-label small");
            if (labelSmall) {
                labelSmall.textContent = "CLICK TO INSPECT";
            }

            hotspotData.element.onclick = function () {
                if (completedScenarios[i]) {
                    return;
                }
                hotspotData.action();
            };
        }
    }

    elements.score.textContent = "0 / 100";
    updateProgress(0);

    elements.endScreen.classList.remove("active");

    elements.trainingScreen.style.display = "block";

    elements.questionPanel.classList.remove("active");

    hideFeedback();
    closeTrainingVideo();
}


/* =========================================================
   SAFETY PRECAUTIONS (10 MARKS)
   ========================================================= */

function showSafetyInfo() {
    answered = false;

    hideFeedback();

    if (elements.challengeBadge) {
        elements.challengeBadge.textContent = "SAFETY PRECAUTIONS";
    }
    elements.challengeTitle.textContent = "Safety Precautions";
    if (elements.challengeSubtitle) {
        elements.challengeSubtitle.textContent = "Review these essential guidelines before completing your training.";
        elements.challengeSubtitle.style.display = "block";
    }
    elements.questionText.textContent =
        "Before beginning manual handling, identify hazards, check your surroundings and make sure the working area is safe.";

    if (elements.assessmentStatus) {
        elements.assessmentStatus.style.display = "none";
    }

    renderSafetyContent();
    elements.questionPanel.classList.add("active");
}

function renderSafetyContent() {
    if (!safetyPrecautionsReviewed) {
        elements.answers.innerHTML = `
            <div class="safety-precautions-header">
                <span class="safety-badge">SAFETY PRECAUTIONS</span>
                <span class="safety-points-badge">10 marks</span>
                <span class="safety-status-chip unreviewed">Not Reviewed &bull; 0 / 10</span>
            </div>
            <div class="safety-info">
                <p>✓ Check for obstacles</p>
                <p>✓ Check the floor and working area</p>
                <p>✓ Make sure there is enough space</p>
                <p>✓ Plan the movement before handling the load</p>
            </div>
            <p class="safety-review-prompt">
                Review these precautions before completing your training.
            </p>
            <button id="confirmSafetyBtn" class="confirm-safety-btn">
                I've Reviewed the Safety Precautions
            </button>
            <button id="closeSafetyBtn" class="close-panel-btn">
                Close & Return to Warehouse
            </button>
        `;

        const confirmBtn = document.getElementById("confirmSafetyBtn");
        if (confirmBtn) {
            confirmBtn.onclick = confirmSafetyPrecautions;
        }
    } else {
        elements.answers.innerHTML = `
            <div class="safety-precautions-header">
                <span class="safety-badge">SAFETY PRECAUTIONS</span>
                <span class="safety-points-badge">10 marks</span>
                <span class="safety-status-chip reviewed">✓ Reviewed &bull; 10 / 10</span>
            </div>
            <div class="safety-info">
                <p>✓ Check for obstacles</p>
                <p>✓ Check the floor and working area</p>
                <p>✓ Make sure there is enough space</p>
                <p>✓ Plan the movement before handling the load</p>
            </div>
            <div class="safety-reviewed-box">
                <div class="safety-reviewed-status">✓ Safety Precautions Reviewed</div>
                <div class="safety-reviewed-score">10 / 10 marks awarded</div>
            </div>
            <button id="closeSafetyBtn" class="close-panel-btn">
                Close & Return to Warehouse
            </button>
        `;
    }

    const closeBtn = document.getElementById("closeSafetyBtn");
    if (closeBtn) {
        closeBtn.onclick = closeSafetyInfo;
    }
}

function confirmSafetyPrecautions() {
    if (!safetyPrecautionsReviewed) {
        safetyPrecautionsReviewed = true;
        safetyPrecautionsScore = 10;
        updateTotalScore();
    }
    renderSafetyContent();
}

function closeSafetyInfo() {
    elements.questionPanel.classList.remove("active");
}

/* =========================================================
   STAGE 3.2 — AUTHENTICATION CHECK & USER DISPLAY
   ========================================================= */
(function checkAuthStatus() {
    fetch('/api/auth/me')
        .then(res => {
            if (!res.ok) {
                window.location.href = 'login.html';
                return null;
            }
            return res.json();
        })
        .then(data => {
            if (!data) return;
            if (data.success && data.user) {
                renderLoggedInUser(data.user);
            } else {
                window.location.href = 'login.html';
            }
        })
        .catch(err => {
            console.error('Authentication check failed:', err);
            window.location.href = 'login.html';
        });
})();

function renderLoggedInUser(user) {
    const userBadge = document.getElementById('userBadge');
    const userNameDisplay = document.getElementById('userNameDisplay');
    const portalLinkWrap = document.querySelector('.login-portal-link-wrap');

    if (userNameDisplay) {
        userNameDisplay.textContent = user.full_name;
    }

    if (userBadge) {
        userBadge.style.display = 'flex';
    }

    if (portalLinkWrap) {
        const dashboardUrl = user.role === 'admin' ? 'admin.html' : 'dashboard.html';
        portalLinkWrap.innerHTML = `
            <a href="${dashboardUrl}" class="portal-dashboard-btn">← Dashboard</a>
        `;
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    initHistoryUI();
}

function handleLogout() {
    fetch('/api/auth/logout', { method: 'POST' })
        .finally(() => {
            window.location.href = 'login.html';
        });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* =========================================================
   STAGE 4.1 — PERSIST TRAINING RESULT TO BACKEND
   ========================================================= */
function saveTrainingResultToBackend() {
    if (trainingResultSaved) {
        return;
    }
    trainingResultSaved = true;

    const payload = {
        load_inspection_score: loadInspectionScore,
        route_check_score: routeCheckScore,
        safe_lift_score: safeLiftScore,
        safety_precautions_score: safetyPrecautionsScore,
        total_score: totalScore,
        percentage: totalScore,
        training_duration_seconds: elapsedSeconds,
        status: "completed"
    };

    fetch('/api/training/results', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.result_id) {
                console.log('SafeLift 360: Training result saved to database successfully (ID:', data.result_id, ')');

                // If score meets passing percentage (>= 70%), issue certificate (Stage 5.1)
                if (totalScore >= 70) {
                    fetch('/api/certificates', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ training_result_id: data.result_id })
                    })
                        .then(cRes => cRes.json())
                        .then(cData => {
                            if (cData.success && cData.certificate) {
                                console.log('SafeLift 360: Certificate issued successfully (Cert #:', cData.certificate.certificate_number, ')');
                            }
                        })
                        .catch(cErr => console.error('SafeLift 360: Error issuing certificate:', cErr));
                }
            } else {
                console.warn('SafeLift 360: Backend returned notice while saving result:', data.message);
            }
        })
        .catch(err => {
            console.error('SafeLift 360: Error persisting training result to backend:', err);
        });
}

/* =========================================================
   STAGE 4.2 — TRAINING HISTORY UI & FETCH HANDLERS
   ========================================================= */

function initHistoryUI() {
    const historyBtn = document.getElementById('historyBtn');
    const closeHistoryBtn = document.getElementById('closeHistoryBtn');
    const historyModal = document.getElementById('historyModal');

    if (historyBtn) {
        historyBtn.onclick = openHistoryModal;
    }

    if (closeHistoryBtn) {
        closeHistoryBtn.onclick = closeHistoryModal;
    }

    if (historyModal) {
        historyModal.onclick = function (e) {
            if (e.target === historyModal) {
                closeHistoryModal();
            }
        };
    }
}

function openHistoryModal() {
    const historyModal = document.getElementById('historyModal');
    if (historyModal) {
        historyModal.style.display = 'flex';
        fetchAndRenderTrainingHistory();
    }
}

function closeHistoryModal() {
    const historyModal = document.getElementById('historyModal');
    if (historyModal) {
        historyModal.style.display = 'none';
    }
}

function fetchAndRenderTrainingHistory() {
    const container = document.getElementById('historyModalContent');
    if (!container) return;

    // Loading State
    container.innerHTML = `
        <div class="history-loading">
            ⏳ Loading training history...
        </div>
    `;

    fetch('/api/training/results')
        .then(res => {
            if (!res.ok) {
                throw new Error('Failed to fetch history');
            }
            return res.json();
        })
        .then(data => {
            if (!data.success || !Array.isArray(data.results)) {
                throw new Error(data.message || 'Invalid server response');
            }

            renderHistoryResults(container, data.results);
        })
        .catch(err => {
            console.error('Fetch history error:', err);
            container.innerHTML = `
                <div class="history-error">
                    ⚠️ Unable to load training history. Please try again.
                    <br><br>
                    <button onclick="fetchAndRenderTrainingHistory()" style="background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #34d399; padding: 6px 14px; border-radius: 8px; font-weight: 700; cursor: pointer;">
                        Retry
                    </button>
                </div>
            `;
        });
}

function renderHistoryResults(container, results) {
    if (!results || results.length === 0) {
        container.innerHTML = `
            <div class="history-empty-state">
                <div class="empty-icon">📋</div>
                <h3>No Training History</h3>
                <p>You have not completed a SafeLift 360 training session yet.</p>
                <p class="empty-subnote">Complete your first training session to see your results here.</p>
            </div>
        `;
        return;
    }

    let html = '';
    results.forEach((item, index) => {
        const formattedDate = formatDateString(item.completed_at);
        const formattedDuration = formatTime(item.training_duration_seconds || 0);

        html += `
            <div class="history-session-card">
                <div class="session-card-header">
                    <div>
                        <div class="session-title">Training Session #${results.length - index}</div>
                        <div class="session-date">📅 ${escapeHtml(formattedDate)}</div>
                    </div>
                    <span class="session-status-chip">${escapeHtml((item.status || 'completed').toUpperCase())}</span>
                </div>

                <div class="session-main-stats">
                    <div class="main-stat-item">
                        <span class="stat-label">Score</span>
                        <span class="stat-value">${item.total_score} / 100</span>
                    </div>
                    <div class="main-stat-item">
                        <span class="stat-label">Percentage</span>
                        <span class="stat-value">${Math.round(item.percentage)}%</span>
                    </div>
                    <div class="main-stat-item">
                        <span class="stat-label">Duration</span>
                        <span class="stat-value" style="color: #cbd5e1;">${formattedDuration}</span>
                    </div>
                </div>

                <div>
                    <div class="session-breakdown-title">Assessment Breakdown</div>
                    <div class="session-breakdown-grid">
                        <div class="breakdown-item">
                            <span>Load Inspection:</span>
                            <span class="breakdown-val">${item.load_inspection_score} / 30</span>
                        </div>
                        <div class="breakdown-item">
                            <span>Route Check:</span>
                            <span class="breakdown-val">${item.route_check_score} / 30</span>
                        </div>
                        <div class="breakdown-item">
                            <span>Safe Lift:</span>
                            <span class="breakdown-val">${item.safe_lift_score} / 30</span>
                        </div>
                        <div class="breakdown-item">
                            <span>Safety Precautions:</span>
                            <span class="breakdown-val">${item.safety_precautions_score} / 10</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function formatDateString(isoString) {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return String(isoString);
    }
}


