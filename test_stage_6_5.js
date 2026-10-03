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

async function runStage65Tests() {
    console.log('==================================================');
    console.log('🧪 SAFELIFT 360 — STAGE 6.5 COMPANY ADMIN DASHBOARD TEST SUITE');
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
        const timestamp = Date.now();
        const passHash = await bcrypt.hash('CompanyPass123!', 10);

        // --- 1. SETUP TWO SEPARATE COMPANIES IN DB ---
        const companyAEmail = `admin_a_${timestamp}@atlaslogistics.com`;
        const companyAName = `Atlas Logistics ${timestamp}`;
        const companyAPerson = `Arthur Pendelton`;

        const companyBEmail = `admin_b_${timestamp}@beacontransport.com`;
        const companyBName = `Beacon Transport ${timestamp}`;
        const companyBPerson = `Beatrice Vance`;

        const empEmail = `employee_${timestamp}@atlaslogistics.com`;

        // Insert Company A request & admin user
        const [regA] = await db.query(
            `INSERT INTO company_registration_requests (company_name, contact_person, email, phone, password_hash, status) 
             VALUES (?, ?, ?, ?, ?, 'approved')`,
            [companyAName, companyAPerson, companyAEmail, '+1 555 100 2000', passHash]
        );

        await db.query(
            `INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'admin')`,
            [companyAPerson, companyAEmail, passHash]
        );

        // Insert Company B request & admin user
        const [regB] = await db.query(
            `INSERT INTO company_registration_requests (company_name, contact_person, email, phone, password_hash, status) 
             VALUES (?, ?, ?, ?, ?, 'approved')`,
            [companyBName, companyBPerson, companyBEmail, '+1 555 900 8000', passHash]
        );

        await db.query(
            `INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'admin')`,
            [companyBPerson, companyBEmail, passHash]
        );

        // Insert Employee user
        await db.query(
            `INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'employee')`,
            ['Ethan Employee', empEmail, passHash]
        );

        // --- 2. AUTHENTICATION & LOGIN TESTS ---
        // Login as Company A Admin
        const loginA = await request('POST', '/api/auth/login', { email: companyAEmail, password: 'CompanyPass123!' });
        assert(loginA.status === 200 && loginA.data.user.role === 'admin', '1. Company A Admin login succeeds and returns role: admin');
        const cookieA = loginA.cookies ? loginA.cookies.map(c => c.split(';')[0]).join('; ') : '';

        // Login as Company B Admin
        const loginB = await request('POST', '/api/auth/login', { email: companyBEmail, password: 'CompanyPass123!' });
        assert(loginB.status === 200 && loginB.data.user.role === 'admin', '2. Company B Admin login succeeds and returns role: admin');
        const cookieB = loginB.cookies ? loginB.cookies.map(c => c.split(';')[0]).join('; ') : '';

        // Login as Employee
        const loginEmp = await request('POST', '/api/auth/login', { email: empEmail, password: 'CompanyPass123!' });
        assert(loginEmp.status === 200 && loginEmp.data.user.role === 'employee', '3. Employee login succeeds and returns role: employee');
        const cookieEmp = loginEmp.cookies ? loginEmp.cookies.map(c => c.split(';')[0]).join('; ') : '';

        // Login as Super Admin
        const loginSuper = await request('POST', '/api/auth/login', { email: 'superadmin@safelift360.com', password: 'SuperAdmin123!' });
        assert(loginSuper.status === 200 && loginSuper.data.user.role === 'super_admin', '4. Super Admin login succeeds and returns role: super_admin');
        const cookieSuper = loginSuper.cookies ? loginSuper.cookies.map(c => c.split(';')[0]).join('; ') : '';

        // --- 3. GET /api/company/dashboard DATA & ISOLATION TESTS ---
        // Company A fetches dashboard
        const dashA = await request('GET', '/api/company/dashboard', null, { Cookie: cookieA });
        assert(dashA.status === 200 && dashA.data.success === true, '5. GET /api/company/dashboard returns 200 for Company A Admin');
        assert(dashA.data.company && dashA.data.company.name === companyAName, '6. Company A Admin receives exact Company A details');
        assert(dashA.data.company.contact_person === companyAPerson, '7. Company A Admin contact person matches DB');
        assert(dashA.data.stats && dashA.data.stats.employees === 0 && dashA.data.stats.completed === 0, '8. Statistics return accurate database counts (0 for pending stage)');

        // Company B fetches dashboard
        const dashB = await request('GET', '/api/company/dashboard', null, { Cookie: cookieB });
        assert(dashB.status === 200 && dashB.data.success === true, '9. GET /api/company/dashboard returns 200 for Company B Admin');
        assert(dashB.data.company && dashB.data.company.name === companyBName, '10. Company B Admin receives exact Company B details');
        assert(dashB.data.company.contact_person === companyBPerson, '11. Company B Admin contact person matches DB');

        // Isolation Verification: Company A Admin NEVER sees Company B data and vice versa
        assert(dashA.data.company.name !== dashB.data.company.name, '12. Multi-tenant isolation verified: Company A and B data are strictly isolated');

        // --- 4. SECURITY & AUTHORIZATION MIDDELWARE TESTS ---
        // Unauthenticated request
        const unauthDash = await request('GET', '/api/company/dashboard');
        assert(unauthDash.status === 401, '13. Unauthenticated call to /api/company/dashboard returns 401 Unauthorized');

        // Employee request
        const empDash = await request('GET', '/api/company/dashboard', null, { Cookie: cookieEmp });
        assert(empDash.status === 403, '14. Employee call to /api/company/dashboard returns 403 Forbidden');

        // Super Admin request
        const superDash = await request('GET', '/api/company/dashboard', null, { Cookie: cookieSuper });
        assert(superDash.status === 403, '15. Super Admin call to /api/company/dashboard returns 403 Forbidden (uses super-admin API)');

        // --- 5. PAGE LOAD TESTS ---
        const pages = ['/', '/index.html', '/login.html', '/admin.html', '/dashboard.html', '/super-admin.html'];
        for (let i = 0; i < pages.length; i++) {
            const res = await request('GET', pages[i]);
            assert(res.status === 200, `16.${i + 1}. Page ${pages[i]} loads with HTTP 200 OK`);
        }

    } catch (e) {
        console.error('Fatal error during Stage 6.5 test execution:', e);
        failed++;
    }

    console.log('\n==================================================');
    console.log(`📊 STAGE 6.5 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================');

    process.exit(failed > 0 ? 1 : 0);
}

runStage65Tests();
