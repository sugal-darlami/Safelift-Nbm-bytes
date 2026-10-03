const bcrypt = require('bcryptjs');
const db = require('../config/db');

/**
 * Helper to validate email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    return emailRegex.test(email);
}

/**
 * POST /api/auth/register
 * Handles user account registration
 */
async function registerUser(req, res) {
    try {
        const { full_name, email, password, employee_id } = req.body;

        // 1. Backend Validation
        if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter your full name."
            });
        }

        if (!email || typeof email !== 'string' || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter your email address."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        if (!password || typeof password !== 'string') {
            return res.status(400).json({
                success: false,
                message: "Please enter your password."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters long."
            });
        }

        const cleanEmployeeId = (employee_id && typeof employee_id === 'string' && employee_id.trim())
            ? employee_id.trim()
            : null;

        // 2. Check for duplicate email (parameterized query)
        const [existingUsers] = await db.query(
            'SELECT id FROM users WHERE email = ? LIMIT 1',
            [normalizedEmail]
        );

        if (existingUsers && existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        // 3. Hash Password using bcrypt (salt rounds = 10)
        const password_hash = await bcrypt.hash(password, 10);

        // 4. Insert into database (role forced to 'employee', parameterized query)
        await db.query(
            'INSERT INTO users (full_name, email, password_hash, employee_id, role) VALUES (?, ?, ?, ?, ?)',
            [full_name.trim(), normalizedEmail, password_hash, cleanEmployeeId, 'employee']
        );

        // 5. Success Response
        return res.status(201).json({
            success: true,
            message: "Account created successfully."
        });

    } catch (err) {
        console.error("Registration Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to create account. Please try again."
        });
    }
}

/**
 * POST /api/auth/login
 * Authenticates user credentials and creates session
 */
async function loginUser(req, res) {
    try {
        const { email, password } = req.body;

        // 1. Validation
        if (!email || typeof email !== 'string' || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter your email address."
            });
        }

        if (!password || typeof password !== 'string' || !password) {
            return res.status(400).json({
                success: false,
                message: "Please enter your password."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // 2. Query user from database (parameterized query)
        const [rows] = await db.query(
            'SELECT id, full_name, email, password_hash, employee_id, role, company_id FROM users WHERE email = ? LIMIT 1',
            [normalizedEmail]
        );

        if (!rows || rows.length === 0) {
            // Check if there is a pending or rejected company registration request for this email
            const [companyReqs] = await db.query(
                'SELECT status FROM company_registration_requests WHERE email = ? LIMIT 1',
                [normalizedEmail]
            );

            if (companyReqs && companyReqs.length > 0) {
                const reqStatus = companyReqs[0].status;
                if (reqStatus === 'rejected') {
                    return res.status(403).json({
                        success: false,
                        message: "Your company registration request has been rejected. Please contact SafeLift 360 support."
                    });
                } else if (reqStatus === 'pending') {
                    return res.status(403).json({
                        success: false,
                        message: "Your company registration request is currently awaiting review."
                    });
                }
            }

            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const user = rows[0];

        // 3. Compare password hash
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        // 4. Create Session
        const userSession = {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            employee_id: user.employee_id,
            role: user.role,
            company_id: user.company_id
        };

        req.session.user = userSession;

        // 5. Success Response (password_hash never returned)
        return res.status(200).json({
            success: true,
            message: "Login successful.",
            user: userSession
        });

    } catch (err) {
        console.error("Login Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to process login. Please try again."
        });
    }
}

/**
 * POST /api/auth/logout
 * Destroys current user session
 */
function logoutUser(req, res) {
    if (!req.session) {
        return res.status(200).json({
            success: true,
            message: "Logged out successfully."
        });
    }

    req.session.destroy((err) => {
        if (err) {
            console.error("Logout Session Destroy Error:", err);
            return res.status(500).json({
                success: false,
                message: "Unable to log out completely."
            });
        }

        res.clearCookie('connect.sid');
        return res.status(200).json({
            success: true,
            message: "Logged out successfully."
        });
    });
}

/**
 * GET /api/auth/me
 * Returns the currently logged in user session info
 */
function getMe(req, res) {
    if (req.session && req.session.user) {
        return res.status(200).json({
            success: true,
            user: req.session.user
        });
    }

    return res.status(401).json({
        success: false,
        message: "Not authenticated."
    });
}

module.exports = {
    registerUser,
    loginUser,
    logoutUser,
    getMe
};
