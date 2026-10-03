const bcrypt = require('bcryptjs');
const db = require('./db');

async function initDatabaseSchema() {
    try {
        // 1. Ensure company_registration_requests table exists
        const createTableSql = `
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
        `;
        await db.query(createTableSql);

        // Helper to add missing columns to existing tables safely
        async function addColumnIfNotExists(tableName, columnName, columnDef) {
            const [cols] = await db.query(
                `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [tableName, columnName]
            );
            if (!cols || cols.length === 0) {
                await db.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
                console.log(`✅ Database migration: added column '${columnName}' to '${tableName}'`);
            }
        }

        // 2. Ensure users table has company_id, department, must_change_password columns (Stage 6.6)
        await addColumnIfNotExists('users', 'company_id', 'INT DEFAULT NULL');
        await addColumnIfNotExists('users', 'department', 'VARCHAR(100) DEFAULT NULL');
        await addColumnIfNotExists('users', 'must_change_password', 'TINYINT(1) DEFAULT 0');

        // 3. Seed development Super Admin account if not present
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

        console.log('✅ Database Schema initialized: company_registration_requests, users schema & super_admin ready.');
    } catch (err) {
        console.error('❌ Database Schema Initialization Error:', err);
    }
}

module.exports = { initDatabaseSchema };

