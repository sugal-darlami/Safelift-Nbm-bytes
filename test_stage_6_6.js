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
            port: 3005,
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

async function runStage66Tests() {
    console.log('==================================================');
    console.log('🧪 SAFELIFT 360 — STAGE 6.6 EMPLOYEE MANAGEMENT TEST SUITE');
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

        // --- 1. SETUP TEST COMPANIES IN DATABASE ---
        const companyAEmail = `admin_a_${timestamp}@alphafreight.com`;
        const companyAName = `Alpha Freight ${timestamp}`;
        const companyAPerson = `Alan Archer`;

        const companyBEmail = `admin_b_${timestamp}@betalogistics.com`;
        const companyBName = `Beta Logistics ${timestamp}`;
        const companyBPerson = `Barbara Brown`;

        // Register & Approve Company A
        const [regA] = await db.query(
            `INSERT INTO company_registration_requests (company_name, contact_person, email, phone, password_hash, status) 
             VALUES (?, ?, ?, ?, ?, 'approved')`,
            [companyAName, companyAPerson, companyAEmail, '+1 555 111 2222', passHash]
        );
        const compAId = regA.insertId;

        await db.query(
            `INSERT INTO users (full_name, email, password_hash, role, company_id) VALUES (?, ?, ?, 'admin', ?)`,
            [companyAPerson, companyAEmail, passHash, compAId]
        );

        // Register & Approve Company B
        const [regB] = await db.query(
            `INSERT INTO company_registration_requests (company_name, contact_person, email, phone, password_hash, status) 
             VALUES (?, ?, ?, ?, ?, 'approved')`,
            [companyBName, companyBPerson, companyBEmail, '+1 555 333 4444', passHash]
        );
        const compBId = regB.insertId;

        await db.query(
            `INSERT INTO users (full_name, email, password_hash, role, company_id) VALUES (?, ?, ?, 'admin', ?)`,
            [companyBPerson, companyBEmail, passHash, compBId]
        );

        // --- 2. AUTHENTICATION & LOGIN ---
        const loginA = await request('POST', '/api/auth/login', { email: companyAEmail, password: 'CompanyPass123!' });
        assert(loginA.status === 200 && loginA.data.user.role === 'admin', '1. Company A Admin login succeeds');
        const cookieA = loginA.cookies ? loginA.cookies.map(c => c.split(';')[0]).join('; ') : '';

        const loginB = await request('POST', '/api/auth/login', { email: companyBEmail, password: 'CompanyPass123!' });
        assert(loginB.status === 200 && loginB.data.user.role === 'admin', '2. Company B Admin login succeeds');
        const cookieB = loginB.cookies ? loginB.cookies.map(c => c.split(';')[0]).join('; ') : '';

        const loginSuper = await request('POST', '/api/auth/login', { email: 'superadmin@safelift360.com', password: 'SuperAdmin123!' });
        assert(loginSuper.status === 200 && loginSuper.data.user.role === 'super_admin', '3. Super Admin login succeeds');
        const cookieSuper = loginSuper.cookies ? loginSuper.cookies.map(c => c.split(';')[0]).join('; ') : '';

        // --- 3. GET /api/company/employees (INITIAL EMPTY STATE) ---
        const listAInitial = await request('GET', '/api/company/employees', null, { Cookie: cookieA });
        assert(listAInitial.status === 200 && Array.isArray(listAInitial.data.employees) && listAInitial.data.employees.length === 0, '4. Company Admin can access GET /api/company/employees (initially empty)');

        // --- 4. CREATE FIRST EMPLOYEE BY COMPANY A ADMIN (AUTO EMP-001) ---
        const empAEmail = `john_emp_${timestamp}@alphafreight.com`;
        const empAPassword = 'TempEmpPass123!';

        const createEmpA = await request('POST', '/api/company/employees', {
            full_name: 'John Smith',
            email: empAEmail,
            department: 'Warehouse Operations',
            password: empAPassword
        }, { Cookie: cookieA });

        assert(createEmpA.status === 201 && createEmpA.data.success === true, '5. Company Admin can create an employee without providing employee_id');
        assert(createEmpA.data.employee.employee_id === 'EMP-001', '6. First employee in Company A is automatically assigned EMP-001 server-side');
        assert(createEmpA.data.employee.role === 'employee', '7. Created employee account has role = employee');
        assert(createEmpA.data.employee.must_change_password === 1, '8. Created employee has must_change_password flag set');

        // --- 5. CREATE SECOND EMPLOYEE BY COMPANY A ADMIN (AUTO EMP-002) ---
        const empA2Email = `jane_emp_${timestamp}@alphafreight.com`;
        const createEmpA2 = await request('POST', '/api/company/employees', {
            full_name: 'Jane Doe',
            email: empA2Email,
            department: 'Safety & Compliance',
            password: 'TempEmpPass123!'
        }, { Cookie: cookieA });

        assert(createEmpA2.status === 201 && createEmpA2.data.employee.employee_id === 'EMP-002', '9. Second employee in Company A automatically receives EMP-002');

        // --- 6. DATABASE VERIFICATION ---
        const [dbEmpRows] = await db.query('SELECT * FROM users WHERE email = ?', [empAEmail]);
        assert(dbEmpRows && dbEmpRows.length === 1, '10. Employee record inserted in database');
        const dbEmp = dbEmpRows[0];
        assert(dbEmp.password_hash !== empAPassword && dbEmp.password_hash.startsWith('$2'), '11. Employee password is securely hashed in database (not plain text)');
        assert(dbEmp.company_id === compAId, '12. Employee is automatically associated with Company A in database');
        assert(dbEmp.employee_id === 'EMP-001', '13. Employee record in database contains generated EMP-001');

        // --- 7. CREATED EMPLOYEE CAN LOG IN VIA /api/auth/login ---
        const empLogin = await request('POST', '/api/auth/login', {
            email: empAEmail,
            password: empAPassword
        });
        assert(empLogin.status === 200 && empLogin.data.user.role === 'employee', '14. Created employee can log in via existing /api/auth/login API');
        const cookieEmp = empLogin.cookies ? empLogin.cookies.map(c => c.split(';')[0]).join('; ') : '';

        // --- 8. MULTI-TENANT ISOLATION & COMPANY-SPECIFIC IDS ---
        // Create 1st employee for Company B
        const empBEmail = `sarah_emp_${timestamp}@betalogistics.com`;
        const createEmpB = await request('POST', '/api/company/employees', {
            full_name: 'Sarah Connor',
            email: empBEmail,
            department: 'Fleet Logistics',
            password: 'TempEmpPass123!'
        }, { Cookie: cookieB });

        assert(createEmpB.status === 201 && createEmpB.data.employee.employee_id === 'EMP-001', '15. Company B Admin creates 1st employee and receives EMP-001 (company-specific ID isolation)');

        // Company A lists employees (should see 2 employees)
        const listA = await request('GET', '/api/company/employees', null, { Cookie: cookieA });
        assert(listA.data.employees.length === 2 && listA.data.employees.some(e => e.email === empAEmail), '16. Company A Admin ONLY sees employees belonging to Company A');

        // Company B lists employees (should see 1 employee)
        const listB = await request('GET', '/api/company/employees', null, { Cookie: cookieB });
        assert(listB.data.employees.length === 1 && listB.data.employees[0].email === empBEmail, '17. Company B Admin ONLY sees employees belonging to Company B');

        // Verify summary card stats updated on dashboard API
        const dashA = await request('GET', '/api/company/dashboard', null, { Cookie: cookieA });
        assert(dashA.data.stats.employees === 2, '18. Dashboard stats reflect live employee count (2 for Company A)');

        // --- 9. VALIDATION & SECURITY TESTS ---
        // Duplicate email
        const dupEmail = await request('POST', '/api/company/employees', {
            full_name: 'Duplicate Smith',
            email: empAEmail,
            department: 'Safety',
            password: 'TempEmpPass123!'
        }, { Cookie: cookieA });
        assert(dupEmail.status === 409, '19. Duplicate email is rejected with 409 Conflict');

        // Missing full_name
        const missingName = await request('POST', '/api/company/employees', {
            email: `bad_${timestamp}@alphafreight.com`,
            department: 'Safety',
            password: 'TempEmpPass123!'
        }, { Cookie: cookieA });
        assert(missingName.status === 400, '20. Missing full_name is rejected with 400 Bad Request');

        // Missing department
        const missingDept = await request('POST', '/api/company/employees', {
            full_name: 'No Dept User',
            email: `nodept_${timestamp}@alphafreight.com`,
            password: 'TempEmpPass123!'
        }, { Cookie: cookieA });
        assert(missingDept.status === 400, '21. Missing department is rejected with 400 Bad Request');

        // Short password
        const shortPass = await request('POST', '/api/company/employees', {
            full_name: 'Short Pass User',
            email: `shortpass_${timestamp}@alphafreight.com`,
            department: 'Safety',
            password: 'short'
        }, { Cookie: cookieA });
        assert(shortPass.status === 400, '22. Temporary password under 8 characters is rejected with 400 Bad Request');

        // --- 10. AUTHORIZATION SECURITY TESTS ---
        const unauthGet = await request('GET', '/api/company/employees');
        assert(unauthGet.status === 401, '23. Unauthenticated call to GET /api/company/employees returns 401 Unauthorized');

        const unauthPost = await request('POST', '/api/company/employees', { full_name: 'Test' });
        assert(unauthPost.status === 401, '24. Unauthenticated call to POST /api/company/employees returns 401 Unauthorized');

        const empGet = await request('GET', '/api/company/employees', null, { Cookie: cookieEmp });
        assert(empGet.status === 403, '25. Employee call to GET /api/company/employees returns 403 Forbidden');

        const empPost = await request('POST', '/api/company/employees', { full_name: 'Test' }, { Cookie: cookieEmp });
        assert(empPost.status === 403, '26. Employee call to POST /api/company/employees returns 403 Forbidden');

        const superGet = await request('GET', '/api/company/employees', null, { Cookie: cookieSuper });
        assert(superGet.status === 403, '27. Super Admin call to GET /api/company/employees returns 403 Forbidden');

        const superPost = await request('POST', '/api/company/employees', { full_name: 'Test' }, { Cookie: cookieSuper });
        assert(superPost.status === 403, '28. Super Admin call to POST /api/company/employees returns 403 Forbidden');

        // --- 11. INJECTED EMPLOYEE_ID AND COMPANY_ID ARE IGNORED ---
        const tamperPost = await request('POST', '/api/company/employees', {
            full_name: 'Tamper Hack',
            email: `hack_${timestamp}@hacker.com`,
            employee_id: 'EMP-9999', // Injected ID should be IGNORED
            company_id: compBId,     // Injected Company ID should be IGNORED
            department: 'Hacking',
            password: 'TempEmpPass123!'
        }, { Cookie: cookieA });

        assert(tamperPost.status === 201, '29. Injected employee_id and company_id request succeeds without error');
        assert(tamperPost.data.employee.employee_id === 'EMP-003', '30. Backend assigns auto-generated EMP-003 instead of injected EMP-9999');
        const [tamperDb] = await db.query('SELECT company_id, employee_id FROM users WHERE email = ?', [`hack_${timestamp}@hacker.com`]);
        assert(tamperDb[0].company_id === compAId && tamperDb[0].employee_id === 'EMP-003', '31. Database reflects Company A association and auto-generated EMP-003');

    } catch (e) {
        console.error('Fatal error during Stage 6.6 test execution:', e);
        failed++;
    }

    console.log('\n==================================================');
    console.log(`📊 STAGE 6.6 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================');

    process.exit(failed > 0 ? 1 : 0);
}

runStage66Tests();
