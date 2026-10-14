const bcrypt = require('bcryptjs');
const db = require('./db');

async function initDatabaseSchema() {
    try {
        // 1. Ensure users table exists with primary key
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                full_name VARCHAR(100) NOT NULL,
                email VARCHAR(150) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                employee_id VARCHAR(50) DEFAULT NULL,
                role VARCHAR(30) NOT NULL DEFAULT 'employee',
                company_id INT DEFAULT NULL,
                department VARCHAR(100) DEFAULT NULL,
                must_change_password TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 2. Ensure company_registration_requests table exists
        await db.query(`
            CREATE TABLE IF NOT EXISTS company_registration_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_name VARCHAR(255) NOT NULL,
                contact_person VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                phone VARCHAR(50) DEFAULT NULL,
                password_hash VARCHAR(255) NOT NULL,
                status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_company_reg_email (email),
                INDEX idx_company_reg_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 3. Ensure training_results table exists
        await db.query(`
            CREATE TABLE IF NOT EXISTS training_results (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                load_inspection_score INT NOT NULL DEFAULT 0,
                route_check_score INT NOT NULL DEFAULT 0,
                safe_lift_score INT NOT NULL DEFAULT 0,
                safety_precautions_score INT NOT NULL DEFAULT 0,
                total_score INT NOT NULL DEFAULT 0,
                percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
                training_duration_seconds INT NOT NULL DEFAULT 0,
                completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) NOT NULL DEFAULT 'completed',
                INDEX idx_training_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 4. Ensure certificates table exists
        await db.query(`
            CREATE TABLE IF NOT EXISTS certificates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                certificate_uuid VARCHAR(100) NOT NULL UNIQUE,
                user_id INT NOT NULL,
                training_result_id INT NOT NULL,
                certificate_number VARCHAR(100) NOT NULL,
                issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) NOT NULL DEFAULT 'issued',
                INDEX idx_cert_uuid (certificate_uuid)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 5. Seed development Super Admin account if not present
        const superAdminEmail = 'superadmin@safelift360.com';
        const [existingSuperAdmin] = await db.query(
            'SELECT id FROM users WHERE email = ? LIMIT 1',
            [superAdminEmail]
        );

        if (!existingSuperAdmin || existingSuperAdmin.length === 0) {
            const superAdminPasswordHash = await bcrypt.hash('SuperAdmin123!', 10);
            await db.query(
                `INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)`,
                ['System Administrator', superAdminEmail, superAdminPasswordHash, 'super_admin']
            );
            console.log(`👑 Super Admin account seeded: ${superAdminEmail}`);
        }

        console.log('✅ Database Schema initialized successfully: all tables and super_admin ready.');
    } catch (err) {
        console.error('❌ Database Schema Initialization Error:', err);
    }
}

module.exports = { initDatabaseSchema };