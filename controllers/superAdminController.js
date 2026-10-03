const db = require('../config/db');

/**
 * GET /api/super-admin/company-requests
 * Retrieves all company registration requests (excluding password_hash)
 */
async function getCompanyRequests(req, res) {
    try {
        const [rows] = await db.query(
            `SELECT id, company_name, contact_person, email, phone, status, created_at, updated_at 
             FROM company_registration_requests 
             ORDER BY created_at DESC`
        );

        return res.status(200).json({
            success: true,
            requests: rows || []
        });
    } catch (err) {
        console.error("Get Company Requests Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to retrieve company registration requests."
        });
    }
}

/**
 * POST /api/super-admin/company-requests/:id/approve
 * Approves a pending company registration request and creates the Company Admin account
 */
async function approveCompanyRequest(req, res) {
    try {
        const requestId = req.params.id;

        if (!requestId || isNaN(Number(requestId))) {
            return res.status(400).json({
                success: false,
                message: "Invalid registration request ID."
            });
        }

        // 1. Fetch registration request from database (parameterized query)
        const [rows] = await db.query(
            `SELECT id, company_name, contact_person, email, phone, password_hash, status 
             FROM company_registration_requests 
             WHERE id = ? LIMIT 1`,
            [requestId]
        );

        if (!rows || rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Company registration request not found."
            });
        }

        const regRequest = rows[0];

        // 2. Prevent duplicate approval or approving already processed requests
        if (regRequest.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Request cannot be approved because its status is already '${regRequest.status}'.`
            });
        }

        const normalizedEmail = regRequest.email.trim().toLowerCase();

        // 3. Check if an account already exists in users for this email
        const [existingUsers] = await db.query(
            'SELECT id FROM users WHERE email = ? LIMIT 1',
            [normalizedEmail]
        );

        if (existingUsers && existingUsers.length > 0) {
            // Update request status to approved to sync state, but do not create duplicate user
            await db.query(
                'UPDATE company_registration_requests SET status = ? WHERE id = ?',
                ['approved', requestId]
            );
            return res.status(200).json({
                success: true,
                message: "Request marked as approved. Account for this email already exists."
            });
        }

        // 4. Create the new Company Admin account using the existing bcrypt password_hash
        await db.query(
            `INSERT INTO users (full_name, email, password_hash, role, company_id) VALUES (?, ?, ?, ?, ?)`,
            [regRequest.contact_person.trim(), normalizedEmail, regRequest.password_hash, 'admin', regRequest.id]
        );


        // 5. Update company_registration_requests status to 'approved'
        await db.query(
            'UPDATE company_registration_requests SET status = ? WHERE id = ?',
            ['approved', requestId]
        );

        return res.status(200).json({
            success: true,
            message: `Company '${regRequest.company_name}' approved successfully! Admin account created for ${regRequest.email}.`
        });

    } catch (err) {
        console.error("Approve Company Request Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to approve company registration request. Please try again."
        });
    }
}

/**
 * POST /api/super-admin/company-requests/:id/reject
 * Rejects a pending company registration request without creating a user account
 */
async function rejectCompanyRequest(req, res) {
    try {
        const requestId = req.params.id;

        if (!requestId || isNaN(Number(requestId))) {
            return res.status(400).json({
                success: false,
                message: "Invalid registration request ID."
            });
        }

        // 1. Fetch registration request from database (parameterized query)
        const [rows] = await db.query(
            `SELECT id, company_name, status 
             FROM company_registration_requests 
             WHERE id = ? LIMIT 1`,
            [requestId]
        );

        if (!rows || rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Company registration request not found."
            });
        }

        const regRequest = rows[0];

        // 2. Verify request is currently pending
        if (regRequest.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Request cannot be rejected because its status is already '${regRequest.status}'.`
            });
        }

        // 3. Update status to 'rejected'
        await db.query(
            'UPDATE company_registration_requests SET status = ? WHERE id = ?',
            ['rejected', requestId]
        );

        return res.status(200).json({
            success: true,
            message: `Registration request for '${regRequest.company_name}' has been rejected.`
        });

    } catch (err) {
        console.error("Reject Company Request Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to reject company registration request. Please try again."
        });
    }
}

module.exports = {
    getCompanyRequests,
    approveCompanyRequest,
    rejectCompanyRequest
};
