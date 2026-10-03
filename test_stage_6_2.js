const http = require('http');
const bcrypt = require('bcryptjs');
const db = require('./config/db');

function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const reqHeaders = {
            ...headers
        };
        if (payload) {
            reqHeaders['Content-Type'] = 'application/json';
            reqHeaders['Content-Length'] = Buffer.byteLength(payload);
        }

        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: reqHeaders
        }, (res) => {
            let resData = '';
            res.on('data', chunk => resData += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(resData);
                } catch (e) {
                    parsed = resData;
                }
                resolve({ status: res.statusCode, data: parsed, raw: resData });
            });
        });

        req.on('error', err => reject(err));
        if (payload) req.write(payload);
        req.end();
    });
}

async function runStage62Tests() {
    console.log('==================================================');
    console.log('🧪 SAFELIFT 360 — STAGE 6.2 COMPREHENSIVE TEST SUITE');
    console.log('==================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition, testName, detail = '') {
        if (condition) {
            console.log(`✅ PASS: ${testName}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
            failed++;
        }
    }

    try {
        // --- 0. PREPARE TEST ACCOUNTS IN USERS TABLE ---
        const testEmpEmail = 'stage62_emp_test@workplace.com';
        const testAdminEmail = 'stage62_admin_test@workplace.com';
        const passHash = await bcrypt.hash('Password123!', 10);

        const [existingEmp] = await db.query('SELECT id FROM users WHERE email = ?', [testEmpEmail]);
        if (!existingEmp || existingEmp.length === 0) {
            await db.query(
                'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
                ['Stage62 Test Employee', testEmpEmail, passHash, 'employee']
            );
        }

        const [existingAdmin] = await db.query('SELECT id FROM users WHERE email = ?', [testAdminEmail]);
        if (!existingAdmin || existingAdmin.length === 0) {
            await db.query(
                'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
                ['Stage62 Test Admin', testAdminEmail, passHash, 'admin']
            );
        }

        // --- 1. HEALTH CHECKS ---
        const hRes = await request('GET', '/api/health');
        assert(hRes.status === 200 && hRes.data.status === 'ok', '1. GET /api/health returns 200 OK');

        const dbRes = await request('GET', '/api/db-health');
        assert(dbRes.status === 200 && dbRes.data.status === 'ok', '2. GET /api/db-health returns 200 OK');

        // --- 2. COMPANY REGISTRATION VALIDATION TESTS ---
        const invalid1 = await request('POST', '/api/company/register', {
            company_name: '',
            contact_person: 'Jane Doe',
            email: 'test_company_valid@workplace.com',
            password: 'Password123!',
            confirm_password: 'Password123!'
        });
        assert(invalid1.status === 400 && invalid1.data.success === false, '3. Missing company_name is rejected with 400');

        const invalid2 = await request('POST', '/api/company/register', {
            company_name: 'Apex Safety Solutions',
            contact_person: '',
            email: 'test_company_valid@workplace.com',
            password: 'Password123!',
            confirm_password: 'Password123!'
        });
        assert(invalid2.status === 400 && invalid2.data.success === false, '4. Missing contact_person is rejected with 400');

        const invalid3 = await request('POST', '/api/company/register', {
            company_name: 'Apex Safety Solutions',
            contact_person: 'Jane Doe',
            email: 'invalid-email-format',
            password: 'Password123!',
            confirm_password: 'Password123!'
        });
        assert(invalid3.status === 400 && invalid3.data.success === false, '5. Invalid email format is rejected with 400');

        const invalid4 = await request('POST', '/api/company/register', {
            company_name: 'Apex Safety Solutions',
            contact_person: 'Jane Doe',
            email: 'jane@apexsafety.com',
            password: 'Password123!',
            confirm_password: 'DifferentPassword123!'
        });
        assert(invalid4.status === 400 && invalid4.data.success === false, '6. Password mismatch is rejected with 400');

        const invalid5 = await request('POST', '/api/company/register', {
            company_name: 'Apex Safety Solutions',
            contact_person: 'Jane Doe',
            email: 'jane@apexsafety.com',
            password: 'short',
            confirm_password: 'short'
        });
        assert(invalid5.status === 400 && invalid5.data.success === false, '7. Password under 8 characters is rejected with 400');

        // --- 3. VALID COMPANY REGISTRATION SUCCESS TEST ---
        const testCompanyEmail = `test_company_${Date.now()}@logistics.com`;
        const testPassword = 'SecurePassword123!';
        const regRes = await request('POST', '/api/company/register', {
            company_name: 'Apex Logistics Corp',
            contact_person: 'Robert Miller',
            email: testCompanyEmail,
            phone: '+44 20 7946 0912',
            password: testPassword,
            confirm_password: testPassword
        });

        assert(regRes.status === 201 && regRes.data.success === true, '8. Valid company registration returns HTTP 201');
        assert(!regRes.data.password_hash, '9. Response NEVER contains password_hash');

        // --- 4. DATABASE INTEGRITY CHECKS ---
        const [rows] = await db.query(
            'SELECT id, company_name, contact_person, email, phone, password_hash, status FROM company_registration_requests WHERE email = ?',
            [testCompanyEmail]
        );

        assert(rows && rows.length === 1, '10. Request is inserted into MySQL company_registration_requests table');
        if (rows && rows.length === 1) {
            const row = rows[0];
            assert(row.company_name === 'Apex Logistics Corp', '11. company_name saved correctly');
            assert(row.contact_person === 'Robert Miller', '12. contact_person saved correctly');
            assert(row.status === 'pending', '13. New company registration status is strictly set to pending');
            assert(row.password_hash !== testPassword, '14. Plain-text password is NOT stored');
            assert(row.password_hash.startsWith('$2a$') || row.password_hash.startsWith('$2b$'), '15. Password is stored as a valid bcrypt hash');
        }

        // --- 5. DUPLICATE EMAIL REJECTION TEST ---
        const dupRes = await request('POST', '/api/company/register', {
            company_name: 'Apex Logistics Copy',
            contact_person: 'Robert Miller',
            email: testCompanyEmail,
            password: testPassword,
            confirm_password: testPassword
        });
        assert(dupRes.status === 409 && dupRes.data.success === false, '16. Duplicate company registration request is rejected with 409');

        // --- 6. NO AUTOMATIC LOGIN TEST ---
        const meRes = await request('GET', '/api/auth/me');
        assert(meRes.status === 401 && meRes.data.success === false, '17. Company registration does NOT automatically create a logged-in user session');

        // --- 7. EXISTING AUTHENTICATION REGRESSION TESTS ---
        const empLogin = await request('POST', '/api/auth/login', {
            email: testEmpEmail,
            password: 'Password123!'
        });
        assert(empLogin.status === 200 && empLogin.data.success === true, '18. Existing employee login still works');

        const adminLogin = await request('POST', '/api/auth/login', {
            email: testAdminEmail,
            password: 'Password123!'
        });
        assert(adminLogin.status === 200 && adminLogin.data.success === true, '19. Existing admin login still works');

        // --- 8. STATIC PAGES RESOLUTION TESTS ---
        const pages = ['/', '/index.html', '/register.html', '/login.html', '/dashboard.html', '/admin.html', '/training.html'];
        for (let i = 0; i < pages.length; i++) {
            const pRes = await request('GET', pages[i]);
            assert(pRes.status === 200, `20.${i + 1}. Page ${pages[i]} loads with HTTP 200`);
        }

    } catch (e) {
        console.error('Fatal error during test execution:', e);
        failed++;
    }

    console.log('\n==================================================');
    console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================');

    process.exit(failed > 0 ? 1 : 0);
}

runStage62Tests();
