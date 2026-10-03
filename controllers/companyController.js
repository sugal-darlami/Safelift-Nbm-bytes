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
 * POST /api/company/register
 * Submits a new company registration request (status = pending)
 */
async function registerCompanyRequest(req, res) {
    try {
        const { company_name, contact_person, email, phone, password, confirm_password } = req.body;

        // 1. Validate Company Name
        if (!company_name || typeof company_name !== 'string' || !company_name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter your company name."
            });
        }

        // 2. Validate Contact Person Name
        if (!contact_person || typeof contact_person !== 'string' || !contact_person.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter the contact person / owner name."
            });
        }

        // 3. Validate Email
        if (!email || typeof email !== 'string' || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter your business email address."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid business email address."
            });
        }

        // 4. Validate Password
        if (!password || typeof password !== 'string') {
            return res.status(400).json({
                success: false,
                message: "Please enter a password."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters long."
            });
        }

        // 5. Validate Password Confirmation
        if (!confirm_password || typeof confirm_password !== 'string') {
            return res.status(400).json({
                success: false,
                message: "Please confirm your password."
            });
        }

        if (password !== confirm_password) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match."
            });
        }

        const cleanPhone = (phone && typeof phone === 'string' && phone.trim()) ? phone.trim() : null;

        // 6. Check for duplicate email in company_registration_requests (parameterized query)
        const [existingRequests] = await db.query(
            'SELECT id, status FROM company_registration_requests WHERE email = ? LIMIT 1',
            [normalizedEmail]
        );

        if (existingRequests && existingRequests.length > 0) {
            return res.status(409).json({
                success: false,
                message: "A company registration request with this email address has already been submitted."
            });
        }

        // 7. Check for duplicate email in existing users table (parameterized query)
        const [existingUsers] = await db.query(
            'SELECT id FROM users WHERE email = ? LIMIT 1',
            [normalizedEmail]
        );

        if (existingUsers && existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: "An account with this email address already exists."
            });
        }

        // 8. Hash Password securely using bcrypt
        const password_hash = await bcrypt.hash(password, 10);

        // 9. Insert Company Registration Request (status forced to 'pending')
        await db.query(
            `INSERT INTO company_registration_requests 
             (company_name, contact_person, email, phone, password_hash, status) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [company_name.trim(), contact_person.trim(), normalizedEmail, cleanPhone, password_hash, 'pending']
        );

        // 10. Success Response (No automatic session, password_hash never returned)
        return res.status(201).json({
            success: true,
            message: "Company registration request submitted successfully. It is currently awaiting review."
        });

    } catch (err) {
        console.error("Company Registration Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to submit company registration request. Please try again."
        });
    }
}

/**
 * Helper to resolve company object for an admin user
 */
async function getCompanyForAdmin(adminUser) {
    // 1. Query company_registration_requests by admin's email
    const [rows] = await db.query(
        `SELECT id, company_name, contact_person, email, phone, status, created_at 
         FROM company_registration_requests 
         WHERE email = ? AND status = 'approved' LIMIT 1`,
        [adminUser.email]
    );

    if (rows && rows.length > 0) {
        const reg = rows[0];
        // Ensure user has company_id set in users table
        if (!adminUser.company_id) {
            await db.query('UPDATE users SET company_id = ? WHERE id = ?', [reg.id, adminUser.id]);
            adminUser.company_id = reg.id;
        }
        return {
            id: reg.id,
            name: reg.company_name,
            contact_person: reg.contact_person,
            email: reg.email,
            phone: reg.phone || 'N/A',
            status: reg.status,
            created_at: reg.created_at
        };
    }

    // 2. Check if user already has company_id set
    if (adminUser.company_id) {
        const [compRows] = await db.query(
            `SELECT id, company_name, contact_person, email, phone, status, created_at 
             FROM company_registration_requests 
             WHERE id = ? LIMIT 1`,
            [adminUser.company_id]
        );
        if (compRows && compRows.length > 0) {
            const comp = compRows[0];
            return {
                id: comp.id,
                name: comp.company_name,
                contact_person: comp.contact_person,
                email: comp.email,
                phone: comp.phone || 'N/A',
                status: comp.status,
                created_at: comp.created_at
            };
        }
    }

    // 3. Fallback for test/seeded admins without registration request
    const fallbackId = adminUser.company_id || adminUser.id || 999;
    return {
        id: fallbackId,
        name: adminUser.full_name ? `${adminUser.full_name}'s Company` : 'Company Workspace',
        contact_person: adminUser.full_name || 'Admin',
        email: adminUser.email,
        phone: 'N/A',
        status: 'approved',
        created_at: new Date()
    };
}

/**
 * GET /api/company/dashboard
 * Retrieves company information and stats for the authenticated Company Admin
 */
async function getCompanyDashboard(req, res) {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please log in."
            });
        }

        if (req.session.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Access denied. Company Administrator privileges required."
            });
        }

        const companyInfo = await getCompanyForAdmin(req.session.user);

        // 1. Live total employee count from database
        const [[{ total_employees }]] = await db.query(
            "SELECT COUNT(*) AS total_employees FROM users WHERE company_id = ? AND role = 'employee'",
            [companyInfo.id]
        );

        // 2. Live completed count & average score across LATEST completed training results per employee
        const [[trStats]] = await db.query(
            `SELECT 
                COUNT(*) AS completed_employees,
                AVG(latest_tr.percentage) AS avg_percentage
             FROM users u
             INNER JOIN (
                SELECT tr1.user_id, tr1.percentage
                FROM training_results tr1
                INNER JOIN (
                    SELECT user_id, MAX(id) AS max_id
                    FROM training_results
                    WHERE LOWER(status) = 'completed'
                    GROUP BY user_id
                ) latest ON tr1.id = latest.max_id
             ) latest_tr ON u.id = latest_tr.user_id
             WHERE u.company_id = ? AND u.role = 'employee'`,
            [companyInfo.id]
        );

        const totalEmp = Number(total_employees) || 0;
        const completedEmp = Number(trStats ? trStats.completed_employees : 0) || 0;
        const pendingEmp = Math.max(0, totalEmp - completedEmp);
        const avgScore = trStats && trStats.avg_percentage != null ? Math.round(Number(trStats.avg_percentage)) : 0;

        const stats = {
            employees: totalEmp,
            completed: completedEmp,
            pending: pendingEmp,
            averageScore: avgScore
        };

        return res.status(200).json({
            success: true,
            company: companyInfo,
            stats: stats
        });

    } catch (err) {
        console.error("Get Company Dashboard Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to retrieve company dashboard details."
        });
    }
}

/**
 * GET /api/company/employees
 * Retrieves all employees belonging to the authenticated Company Admin's company with latest training status & score
 */
async function getCompanyEmployees(req, res) {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please log in."
            });
        }

        if (req.session.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Access denied. Company Administrator privileges required."
            });
        }

        const company = await getCompanyForAdmin(req.session.user);

        const [employees] = await db.query(
            `SELECT 
                u.id, u.full_name, u.email, u.employee_id, u.department, u.role, u.must_change_password, u.created_at,
                tr.status AS training_status,
                tr.percentage AS score,
                tr.completed_at
             FROM users u
             LEFT JOIN (
                SELECT user_id, status, percentage, completed_at
                FROM training_results
                WHERE id IN (
                    SELECT MAX(id) FROM training_results GROUP BY user_id
                )
             ) tr ON u.id = tr.user_id
             WHERE u.company_id = ? AND u.role = 'employee' 
             ORDER BY u.created_at DESC`,
            [company.id]
        );

        const formattedEmployees = (employees || []).map(emp => {
            const rawStatus = emp.training_status ? String(emp.training_status).toLowerCase() : '';
            return {
                ...emp,
                training_status: rawStatus === 'completed' ? 'Completed' : 'Pending',
                score: emp.score != null ? Number(emp.score) : null
            };
        });

        return res.status(200).json({
            success: true,
            employees: formattedEmployees
        });

    } catch (err) {
        console.error("Get Company Employees Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to retrieve company employees."
        });
    }
}

/**
 * GET /api/company/training-results
 * Retrieves all training results for employees belonging to the authenticated Company Admin's company
 */
async function getCompanyTrainingResults(req, res) {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please log in."
            });
        }

        if (req.session.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Access denied. Company Administrator privileges required."
            });
        }

        const company = await getCompanyForAdmin(req.session.user);

        const [results] = await db.query(
            `SELECT 
                u.id AS user_id,
                u.full_name AS employee_name,
                u.employee_id,
                u.department,
                tr.id,
                tr.total_score,
                tr.percentage,
                tr.status,
                tr.completed_at
             FROM users u
             LEFT JOIN (
                SELECT tr1.id, tr1.user_id, tr1.total_score, tr1.percentage, tr1.status, tr1.completed_at
                FROM training_results tr1
                INNER JOIN (
                    SELECT user_id, MAX(id) AS max_id
                    FROM training_results
                    GROUP BY user_id
                ) latest ON tr1.id = latest.max_id
             ) tr ON u.id = tr.user_id
             WHERE u.company_id = ? AND u.role = 'employee'
             ORDER BY tr.completed_at DESC, u.created_at DESC`,
            [company.id]
        );

        const formattedResults = (results || []).map(r => {
            const isCompleted = r.status && String(r.status).toLowerCase() === 'completed';
            return {
                id: r.id,
                user_id: r.user_id,
                employee_name: r.employee_name,
                employee_id: r.employee_id,
                department: r.department,
                total_score: r.total_score,
                percentage: isCompleted && r.percentage != null ? Number(r.percentage) : null,
                status: isCompleted ? 'Completed' : 'Pending',
                completed_at: isCompleted ? r.completed_at : null
            };
        });

        return res.status(200).json({
            success: true,
            results: formattedResults
        });

    } catch (err) {
        console.error("Get Company Training Results Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to retrieve company training results."
        });
    }
}

/**
 * Helper to generate next server-side unique Employee ID for a company (EMP-001, EMP-002, etc.)
 */
async function generateNextEmployeeId(companyId) {
    const [rows] = await db.query(
        "SELECT employee_id FROM users WHERE company_id = ? AND employee_id IS NOT NULL",
        [companyId]
    );

    let maxNum = 0;
    const existingSet = new Set();

    if (rows && rows.length > 0) {
        for (const r of rows) {
            if (r.employee_id) {
                existingSet.add(r.employee_id.toUpperCase());
                const match = r.employee_id.match(/^EMP-(\d+)$/i);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (num > maxNum) {
                        maxNum = num;
                    }
                }
            }
        }
    }

    let candidateNum = maxNum + 1;
    let candidateId = `EMP-${String(candidateNum).padStart(3, '0')}`;

    while (existingSet.has(candidateId.toUpperCase())) {
        candidateNum++;
        candidateId = `EMP-${String(candidateNum).padStart(3, '0')}`;
    }

    return candidateId;
}

/**
 * POST /api/company/employees
 * Creates a new employee account belonging to the authenticated Company Admin's company
 */
async function createCompanyEmployee(req, res) {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please log in."
            });
        }

        if (req.session.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Access denied. Company Administrator privileges required."
            });
        }

        const { full_name, email, department, password } = req.body;

        // 1. Validation - Full Name
        if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter the employee's full name."
            });
        }

        // 2. Validation - Email
        if (!email || typeof email !== 'string' || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter the employee's email address."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        // 3. Validation - Department
        if (!department || typeof department !== 'string' || !department.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter a department."
            });
        }

        const cleanDepartment = department.trim();

        // 4. Validation - Temporary Password
        if (!password || typeof password !== 'string') {
            return res.status(400).json({
                success: false,
                message: "Please enter a temporary password."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Temporary password must be at least 8 characters long."
            });
        }

        // Identify company from authenticated session ONLY
        const company = await getCompanyForAdmin(req.session.user);

        // 5. Check for duplicate email in users table
        const [existingUsers] = await db.query(
            'SELECT id FROM users WHERE email = ? LIMIT 1',
            [normalizedEmail]
        );

        if (existingUsers && existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: "An account with this email address already exists."
            });
        }

        // Check for duplicate email in company_registration_requests table
        const [existingReqs] = await db.query(
            'SELECT id FROM company_registration_requests WHERE email = ? LIMIT 1',
            [normalizedEmail]
        );

        if (existingReqs && existingReqs.length > 0) {
            return res.status(409).json({
                success: false,
                message: "An account with this email address already exists."
            });
        }

        // 6. Automatically generate unique Employee ID server-side for this company
        const generatedEmployeeId = await generateNextEmployeeId(company.id);

        // 7. Hash temporary password securely using bcrypt (salt rounds = 10)
        const password_hash = await bcrypt.hash(password, 10);

        // 8. Insert employee into users table (role = 'employee', company_id derived from admin session)
        const [insertRes] = await db.query(
            `INSERT INTO users (full_name, email, password_hash, employee_id, department, role, company_id, must_change_password) 
             VALUES (?, ?, ?, ?, ?, 'employee', ?, 1)`,
            [full_name.trim(), normalizedEmail, password_hash, generatedEmployeeId, cleanDepartment, company.id]
        );

        return res.status(201).json({
            success: true,
            message: `Employee '${full_name.trim()}' created successfully.`,
            employee: {
                id: insertRes.insertId,
                full_name: full_name.trim(),
                email: normalizedEmail,
                employee_id: generatedEmployeeId,
                department: cleanDepartment,
                role: 'employee',
                must_change_password: 1
            }
        });

    } catch (err) {
        console.error("Create Company Employee Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to create employee account. Please try again."
        });
    }
}

module.exports = {
    registerCompanyRequest,
    getCompanyDashboard,
    getCompanyEmployees,
    getCompanyTrainingResults,
    createCompanyEmployee
};



