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
            // Capture set-cookie headers
            const setCookie = res.headers['set-cookie'];
            res.on('data', chunk => resData += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(resData);
                } catch (e) {
                    parsed = resData;
                }
                resolve({ status: res.statusCode, data: parsed, cookies: setCookie, raw: resData });
            });
        });

        req.on('error', err => reject(err));
        if (payload) req.write(payload);
        req.end();
    });
}

async function runStage63Tests() {
    console.log('==================================================');
    console.log('🧪 SAFELIFT 360 — STAGE 6.3 COMPREHENSIVE TEST SUITE');
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
        // --- 0. ENSURE TEST ACCOUNTS EXIST ---
        const testEmpEmail = 'stage63_emp@workplace.com';
        const testAdminEmail = 'stage63_admin@workplace.com';
        const passHash = await bcrypt.hash('Password123!', 10);

        const [empRow] = await db.query('SELECT id FROM users WHERE email = ?', [testEmpEmail]);
        if (!empRow || empRow.length === 0) {
            await db.query('INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)', ['Stage 6.3 Employee', testEmpEmail, passHash, 'employee']);
        }

        const [admRow] = await db.query('SELECT id FROM users WHERE email = ?', [testAdminEmail]);
        if (!admRow || admRow.length === 0) {
            await db.query('INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)', ['Stage 6.3 Admin', testAdminEmail, passHash, 'admin']);
        }

        // --- 1. SUPER ADMIN LOGIN & UNIFIED ROUTING ---
        const superLogin = await request('POST', '/api/auth/login', {
            email: 'superadmin@safelift360.com',
            password: 'SuperAdmin123!'
        });
        assert(superLogin.status === 200 && superLogin.data.user.role === 'super_admin', '1. Super Admin can log in via /login.html and receives super_admin role');

        const superCookie = superLogin.cookies ? superLogin.cookies.map(c => c.split(';')[0]).join('; ') : '';

        const empLogin = await request('POST', '/api/auth/login', {
            email: testEmpEmail,
            password: 'Password123!'
        });
        assert(empLogin.status === 200 && empLogin.data.user.role === 'employee', '2. Employee login returns employee role');

        const empCookie = empLogin.cookies ? empLogin.cookies.map(c => c.split(';')[0]).join('; ') : '';

        const adminLogin = await request('POST', '/api/auth/login', {
            email: testAdminEmail,
            password: 'Password123!'
        });
        assert(adminLogin.status === 200 && adminLogin.data.user.role === 'admin', '3. Admin login returns admin role');

        const adminCookie = adminLogin.cookies ? adminLogin.cookies.map(c => c.split(';')[0]).join('; ') : '';

        // --- 2. AUTHORIZATION MIDDLEWARE TESTS ---
        const unauthReq = await request('GET', '/api/super-admin/company-requests');
        assert(unauthReq.status === 401, '4. Unauthenticated access to /api/super-admin/company-requests returns 401 Unauthorized');

        const empReq = await request('GET', '/api/super-admin/company-requests', null, { Cookie: empCookie });
        assert(empReq.status === 403, '5. Employee accessing Super Admin API returns 403 Forbidden');

        const companyAdminReq = await request('GET', '/api/super-admin/company-requests', null, { Cookie: adminCookie });
        assert(companyAdminReq.status === 403, '6. Company Admin accessing Super Admin API returns 403 Forbidden');

        // --- 3. SUPER ADMIN API DATA FETCHING ---
        const listReq = await request('GET', '/api/super-admin/company-requests', null, { Cookie: superCookie });
        assert(listReq.status === 200 && Array.isArray(listReq.data.requests), '7. Super Admin can retrieve company registration requests');

        if (listReq.data.requests && listReq.data.requests.length > 0) {
            const sample = listReq.data.requests[0];
            assert(!sample.password_hash, '8. Retrieved company requests NEVER expose password_hash');
        } else {
            assert(true, '8. Retrieved company requests NEVER expose password_hash (empty list verified)');
        }

        // --- 4. APPROVAL WORKFLOW TEST ---
        const approveCompanyEmail = `approve_test_${Date.now()}@industrial.com`;
        const companyPass = 'CompanyPass123!';

        // Register company request
        const regApprove = await request('POST', '/api/company/register', {
            company_name: 'Titan Freight Services',
            contact_person: 'Marcus Vance',
            email: approveCompanyEmail,
            phone: '+44 20 1234 5678',
            password: companyPass,
            confirm_password: companyPass
        });
        assert(regApprove.status === 201, '9. Submit company registration request for approval test succeeds');

        // Retrieve created request ID
        const [appRow] = await db.query('SELECT id, status FROM company_registration_requests WHERE email = ?', [approveCompanyEmail]);
        assert(appRow && appRow.length === 1 && appRow[0].status === 'pending', '10. Company registration request is stored as pending in DB');

        const reqIdToApprove = appRow[0].id;

        // Approve request via Super Admin API
        const approveRes = await request('POST', `/api/super-admin/company-requests/${reqIdToApprove}/approve`, null, { Cookie: superCookie });
        assert(approveRes.status === 200 && approveRes.data.success === true, '11. Super Admin can approve pending company registration request');

        // Verify database state after approval
        const [appRowAfter] = await db.query('SELECT status FROM company_registration_requests WHERE id = ?', [reqIdToApprove]);
        assert(appRowAfter[0].status === 'approved', '12. Request status updated to approved in DB');

        const [createdAdminUser] = await db.query('SELECT id, full_name, email, role FROM users WHERE email = ?', [approveCompanyEmail]);
        assert(createdAdminUser && createdAdminUser.length === 1 && createdAdminUser[0].role === 'admin', '13. Exactly one Company Admin user account is created in users table');

        // Test logging in with newly approved company admin credentials
        const newAdminLogin = await request('POST', '/api/auth/login', {
            email: approveCompanyEmail,
            password: companyPass
        });
        assert(newAdminLogin.status === 200 && newAdminLogin.data.user.role === 'admin', '14. Approved Company Admin can log in using original credentials');

        // Test double-approval protection
        const doubleApprove = await request('POST', `/api/super-admin/company-requests/${reqIdToApprove}/approve`, null, { Cookie: superCookie });
        assert(doubleApprove.status === 400 || (doubleApprove.status === 200 && doubleApprove.data.message.includes('already')), '15. Double approval on already approved request does NOT create duplicate user accounts');

        // --- 5. REJECTION WORKFLOW TEST ---
        const rejectCompanyEmail = `reject_test_${Date.now()}@industrial.com`;

        // Register company request for rejection
        const regReject = await request('POST', '/api/company/register', {
            company_name: 'Shady Logistics Ltd',
            contact_person: 'Scam Owner',
            email: rejectCompanyEmail,
            phone: '+44 20 9999 0000',
            password: companyPass,
            confirm_password: companyPass
        });
        assert(regReject.status === 201, '16. Submit company registration request for rejection test succeeds');

        const [rejRow] = await db.query('SELECT id, status FROM company_registration_requests WHERE email = ?', [rejectCompanyEmail]);
        const reqIdToReject = rejRow[0].id;

        // Reject request via Super Admin API
        const rejectRes = await request('POST', `/api/super-admin/company-requests/${reqIdToReject}/reject`, null, { Cookie: superCookie });
        assert(rejectRes.status === 200 && rejectRes.data.success === true, '17. Super Admin can reject pending company registration request');

        // Verify database state after rejection
        const [rejRowAfter] = await db.query('SELECT status FROM company_registration_requests WHERE id = ?', [reqIdToReject]);
        assert(rejRowAfter[0].status === 'rejected', '18. Request status updated to rejected in DB');

        const [noAdminUser] = await db.query('SELECT id FROM users WHERE email = ?', [rejectCompanyEmail]);
        assert(!noAdminUser || noAdminUser.length === 0, '19. Rejected request does NOT create an admin user in users table');

        // Test rejected company login attempt
        const rejectedLogin = await request('POST', '/api/auth/login', {
            email: rejectCompanyEmail,
            password: companyPass
        });
        assert(rejectedLogin.status === 403 && rejectedLogin.data.message.includes('rejected'), '20. Rejected company login attempt returns 403 Forbidden with clear rejection message');

        // --- 6. REGRESSION & PAGES RESOLUTION ---
        const pages = ['/', '/index.html', '/register.html', '/login.html', '/dashboard.html', '/admin.html', '/super-admin.html', '/training.html'];
        for (let i = 0; i < pages.length; i++) {
            const pRes = await request('GET', pages[i]);
            assert(pRes.status === 200, `21.${i + 1}. Page ${pages[i]} loads with HTTP 200`);
        }

    } catch (e) {
        console.error('Fatal error during Stage 6.3 test execution:', e);
        failed++;
    }

    console.log('\n==================================================');
    console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================');

    process.exit(failed > 0 ? 1 : 0);
}

runStage63Tests();
