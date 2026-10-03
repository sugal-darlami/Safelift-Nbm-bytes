const db = require('../config/db');

/**
 * POST /api/training/results
 * Saves completed training session scores to MySQL
 */
async function saveTrainingResult(req, res) {
    try {
        // 1. Session Authentication Check
        if (!req.session || !req.session.user || !req.session.user.id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        const userId = req.session.user.id;
        const {
            load_inspection_score,
            route_check_score,
            safe_lift_score,
            safety_precautions_score,
            total_score,
            percentage,
            training_duration_seconds,
            status
        } = req.body;

        // 2. Required Fields Check
        if (
            load_inspection_score === undefined ||
            route_check_score === undefined ||
            safe_lift_score === undefined ||
            safety_precautions_score === undefined ||
            total_score === undefined ||
            percentage === undefined ||
            training_duration_seconds === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required training result scores."
            });
        }

        // Convert inputs to numbers
        const loadScore = Number(load_inspection_score);
        const routeScore = Number(route_check_score);
        const liftScore = Number(safe_lift_score);
        const safetyScore = Number(safety_precautions_score);
        const totScore = Number(total_score);
        const pct = Number(percentage);
        const durationSec = Number(training_duration_seconds);
        const finalStatus = (status && typeof status === 'string' && status.trim()) ? status.trim() : 'completed';

        // 3. Scenario Score Allowed Values Validation (0, 5, 10, 20, 30)
        const validScenarioScores = [0, 5, 10, 20, 30];
        if (!validScenarioScores.includes(loadScore)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Load Inspection score value."
            });
        }
        if (!validScenarioScores.includes(routeScore)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Route Check score value."
            });
        }
        if (!validScenarioScores.includes(liftScore)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Safe Lift score value."
            });
        }

        // 4. Safety Precautions Allowed Values Validation (0, 10)
        const validSafetyScores = [0, 10];
        if (!validSafetyScores.includes(safetyScore)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Safety Precautions score value."
            });
        }

        // 5. Training Duration Validation (Non-negative number)
        if (isNaN(durationSec) || durationSec < 0) {
            return res.status(400).json({
                success: false,
                message: "Training duration must be 0 or greater."
            });
        }

        // 6. Total Score Calculation Consistency Validation
        const calculatedTotal = loadScore + routeScore + liftScore + safetyScore;
        if (totScore !== calculatedTotal) {
            return res.status(400).json({
                success: false,
                message: "Score values are inconsistent."
            });
        }

        if (isNaN(totScore) || totScore < 0 || totScore > 100) {
            return res.status(400).json({
                success: false,
                message: "Total score must be between 0 and 100."
            });
        }

        // 7. Percentage Validation (0 to 100)
        if (isNaN(pct) || pct < 0 || pct > 100) {
            return res.status(400).json({
                success: false,
                message: "Percentage must be between 0 and 100."
            });
        }

        // 8. Parameterized Database Insert
        const [result] = await db.query(
            `INSERT INTO training_results (
                user_id,
                load_inspection_score,
                route_check_score,
                safe_lift_score,
                safety_precautions_score,
                total_score,
                percentage,
                training_duration_seconds,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                loadScore,
                routeScore,
                liftScore,
                safetyScore,
                totScore,
                pct,
                durationSec,
                finalStatus
            ]
        );

        // 9. Success Response (201 Created)
        return res.status(201).json({
            success: true,
            message: "Training result saved successfully.",
            result_id: result.insertId
        });

    } catch (err) {
        console.error("Save Training Result Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to save training result. Please try again."
        });
    }
}

/**
 * GET /api/training/results
 * Returns the authenticated user's training result history
 */
async function getTrainingResults(req, res) {
    try {
        // 1. Session Authentication Check
        if (!req.session || !req.session.user || !req.session.user.id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        // Extract user_id strictly from authenticated session
        const userId = req.session.user.id;

        // 2. Query training results ordered by completed_at DESC
        const [results] = await db.query(
            `SELECT
                id,
                load_inspection_score,
                route_check_score,
                safe_lift_score,
                safety_precautions_score,
                total_score,
                percentage,
                training_duration_seconds,
                completed_at,
                status
            FROM training_results
            WHERE user_id = ?
            ORDER BY completed_at DESC`,
            [userId]
        );

        // 3. Return results array (or empty array if no results)
        return res.status(200).json({
            success: true,
            results: results || []
        });

    } catch (err) {
        console.error("Get Training Results Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to retrieve training history. Please try again."
        });
    }
}

module.exports = {
    saveTrainingResult,
    getTrainingResults
};
