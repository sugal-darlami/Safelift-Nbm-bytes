const db = require('../config/db');

/**
 * GET /api/admin/users
 * Returns list of registered users (password_hash omitted)
 */
async function getAdminUsers(req, res) {
    try {
        const [users] = await db.query(
            `SELECT id, full_name, email, employee_id, role, created_at
             FROM users
             ORDER BY created_at DESC`
        );

        return res.status(200).json({
            success: true,
            users: users || []
        });

    } catch (err) {
        console.error("Get Admin Users Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to retrieve users list."
        });
    }
}

/**
 * GET /api/admin/results
 * Returns training results across all users with joined user information
 */
async function getAdminResults(req, res) {
    try {
        const [results] = await db.query(
            `SELECT
                tr.id AS id,
                tr.user_id AS user_id,
                u.full_name AS full_name,
                u.email AS email,
                u.employee_id AS employee_id,
                tr.load_inspection_score,
                tr.route_check_score,
                tr.safe_lift_score,
                tr.safety_precautions_score,
                tr.total_score,
                tr.percentage,
                tr.training_duration_seconds,
                tr.completed_at,
                tr.status
            FROM training_results tr
            JOIN users u ON tr.user_id = u.id
            ORDER BY tr.completed_at DESC`
        );

        return res.status(200).json({
            success: true,
            results: results || []
        });

    } catch (err) {
        console.error("Get Admin Results Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to retrieve training results."
        });
    }
}

/**
 * GET /api/admin/stats
 * Calculates company-wide statistics
 */
async function getAdminStats(req, res) {
    try {
        // Total Registered Users
        const [[{ total_users }]] = await db.query('SELECT COUNT(*) AS total_users FROM users');

        // Total Employees (role = 'employee')
        const [[{ total_employees }]] = await db.query("SELECT COUNT(*) AS total_employees FROM users WHERE role = 'employee'");

        // Total Completed Training Sessions
        const [[{ completed_sessions }]] = await db.query('SELECT COUNT(*) AS completed_sessions FROM training_results');

        // Number of employees who completed at least 1 session
        const [[{ employees_completed }]] = await db.query(
            `SELECT COUNT(DISTINCT tr.user_id) AS employees_completed
             FROM training_results tr
             JOIN users u ON tr.user_id = u.id
             WHERE u.role = 'employee'`
        );

        // Average score and percentage across all sessions
        const [[avgRow]] = await db.query('SELECT AVG(total_score) AS avg_score, AVG(percentage) AS avg_pct FROM training_results');

        const totalEmployeesCount = Number(total_employees) || 0;
        const completedEmployeesCount = Number(employees_completed) || 0;
        const pendingEmployeesCount = Math.max(0, totalEmployeesCount - completedEmployeesCount);

        const avgScoreVal = avgRow.avg_score !== null ? Number(Number(avgRow.avg_score).toFixed(1)) : 0;
        const avgPctVal = avgRow.avg_pct !== null ? Number(Number(avgRow.avg_pct).toFixed(1)) : 0;

        return res.status(200).json({
            success: true,
            stats: {
                total_users: Number(total_users) || 0,
                total_employees: totalEmployeesCount,
                completed_sessions: Number(completed_sessions) || 0,
                employees_completed: completedEmployeesCount,
                employees_pending: pendingEmployeesCount,
                average_score: avgScoreVal,
                average_percentage: avgPctVal
            }
        });

    } catch (err) {
        console.error("Get Admin Stats Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to calculate admin statistics."
        });
    }
}

/**
 * GET /api/admin/users/:userId/results
 * Returns training history for a specific employee
 */
async function getEmployeeHistory(req, res) {
    try {
        const targetUserId = req.params.userId;

        if (!targetUserId || isNaN(targetUserId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID specified."
            });
        }

        const [results] = await db.query(
            `SELECT
                tr.id,
                tr.user_id,
                tr.load_inspection_score,
                tr.route_check_score,
                tr.safe_lift_score,
                tr.safety_precautions_score,
                tr.total_score,
                tr.percentage,
                tr.training_duration_seconds,
                tr.completed_at,
                tr.status
            FROM training_results tr
            WHERE tr.user_id = ?
            ORDER BY tr.completed_at DESC`,
            [targetUserId]
        );

        return res.status(200).json({
            success: true,
            results: results || []
        });

    } catch (err) {
        console.error("Get Employee History Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to retrieve employee history."
        });
    }
}

module.exports = {
    getAdminUsers,
    getAdminResults,
    getAdminStats,
    getEmployeeHistory
};
