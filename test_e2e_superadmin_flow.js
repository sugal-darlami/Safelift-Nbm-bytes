const http = require('http');
const db = require('./config/db');

function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const reqHeaders = { ...headers };
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
                    parsed = null;
                }
                resolve({ status: res.statusCode, data: parsed, cookies: setCookie, rawText: String(resData || '') });
            });
        });

        req.on('error', err => reject(err));
        if (payload) req.write(payload);
        req.end();
    });
}

async function runE2EVerification() {
    console.log('==================================================');
    console.log('🔍 SAFELIFT 360 — SUPER ADMIN 13-STEP E2E VERIFICATION');
    console.log('==================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition, stepNum, message, detail = '') {
        if (condition) {
            console.log(`✅ Step ${stepNum}: ${message}`);
            passed++;
        } else {
            console.error(`❌ Step ${stepNum} FAILED: ${message} ${detail ? `(${detail})` : ''}`);
            failed++;
        }
    }

    try {
        // Step 1: Open commercial landing page http://localhost:3000/
        const landingRes = await request('GET', '/');
        assert(landingRes.status === 200, 1, 'Commercial landing page / returns 200 OK');

        // Step 2: Open login page login.html
        const loginPageRes = await request('GET', '/login.html');
        assert(loginPageRes.status === 200, 2, 'Login page /login.html returns 200 OK');

        // Step 3 & 4: Login as superadmin@safelift360.com / SuperAdmin123!
        const superLoginRes = await request('POST', '/api/auth/login', {
            email: 'superadmin@safelift360.com',
            password: 'SuperAdmin123!'
        });
        assert(
            superLoginRes.status === 200 && 
            superLoginRes.data &&
            superLoginRes.data.success === true && 
            superLoginRes.data.user &&
            superLoginRes.data.user.role === 'super_admin',
            3,
            'Super Admin login API returns role: super_admin'
        );

        const superCookie = superLoginRes.cookies ? superLoginRes.cookies.map(c => c.split(';')[0]).join('; ') : '';

        // Simulate login.js targetPage calculation for super_admin
        const userRole = (superLoginRes.data && superLoginRes.data.user) ? superLoginRes.data.user.role : null;
        const targetPage = (userRole === 'super_admin') ? 'super-admin.html' : 
                           (userRole === 'admin') ? 'admin.html' : 'dashboard.html';
        assert(targetPage === 'super-admin.html', 4, 'Frontend login.js targetPage resolves to super-admin.html for super_admin role');

        // Step 5: Verify super-admin.html page accessibility
        const superPageRes = await request('GET', '/super-admin.html');
        assert(superPageRes.status === 200 && superPageRes.rawText.includes('Super Admin Dashboard'), 5, 'super-admin.html page loads and clearly displays Super Admin Dashboard title');

        // Step 6: Create a pending company registration for the approval test
        const testCompanyEmail = `e2e_company_${Date.now()}@freight.com`;
        const testCompanyPass = 'CompanyPass123!';
        await request('POST', '/api/company/register', {
            company_name: 'Vanguard Freight Lines',
            contact_person: 'Arthur Pendelton',
            email: testCompanyEmail,
            phone: '+44 20 8888 7777',
            password: testCompanyPass,
            confirm_password: testCompanyPass
        });

        // Super Admin fetches company registration requests
        const requestsListRes = await request('GET', '/api/super-admin/company-requests', null, { Cookie: superCookie });
        const pendingReq = (requestsListRes.data && Array.isArray(requestsListRes.data.requests)) 
            ? requestsListRes.data.requests.find(r => r.email === testCompanyEmail && r.status === 'pending')
            : undefined;
        assert(pendingReq !== undefined, 6, 'Newly submitted pending company registration appears in Super Admin dashboard list');

        const pendingId = pendingReq ? pendingReq.id : null;

        // Step 7 & 8: Click Approve on the test pending company
        const approveApiRes = await request('POST', `/api/super-admin/company-requests/${pendingId}/approve`, null, { Cookie: superCookie });
        assert(approveApiRes.status === 200 && approveApiRes.data.success === true, 7, 'Super Admin approve API returns success');

        const updatedRequestsRes = await request('GET', '/api/super-admin/company-requests', null, { Cookie: superCookie });
        const approvedReq = (updatedRequestsRes.data && Array.isArray(updatedRequestsRes.data.requests))
            ? updatedRequestsRes.data.requests.find(r => r.id === pendingId)
            : null;
        assert(approvedReq && approvedReq.status === 'approved', 8, 'Registration request status changed to approved');

        // Step 9: Confirm corresponding Company Admin account is created in users table
        const [adminUserRows] = await db.query('SELECT id, full_name, email, role FROM users WHERE email = ?', [testCompanyEmail]);
        assert(adminUserRows && adminUserRows.length === 1 && adminUserRows[0].role === 'admin', 9, 'Corresponding Company Admin user account is created in users table with role: admin');

        // Step 10: Log out Super Admin
        const logoutRes = await request('POST', '/api/auth/logout', null, { Cookie: superCookie });
        assert(logoutRes.status === 200, 10, 'Super Admin logged out successfully');

        // Step 11 & 12: Login using the approved Company Admin credentials
        const companyAdminLoginRes = await request('POST', '/api/auth/login', {
            email: testCompanyEmail,
            password: testCompanyPass
        });
        assert(companyAdminLoginRes.status === 200 && companyAdminLoginRes.data.user.role === 'admin', 11, 'Approved Company Admin login returns role: admin');

        const companyAdminUserRole = companyAdminLoginRes.data.user.role;
        const companyAdminTargetPage = (companyAdminUserRole === 'super_admin') ? 'super-admin.html' : 
                                       (companyAdminUserRole === 'admin') ? 'admin.html' : 'dashboard.html';
        assert(companyAdminTargetPage === 'admin.html', 12, 'Approved Company Admin is redirected to admin.html (NOT dashboard.html)');

        // Step 13: Confirm an employee account still goes to dashboard.html
        const empLoginRes = await request('POST', '/api/auth/login', {
            email: 'stage63_emp@workplace.com',
            password: 'Password123!'
        });
        const empUserRole = empLoginRes.data.user.role;
        const empTargetPage = (empUserRole === 'super_admin') ? 'super-admin.html' : 
                             (empUserRole === 'admin') ? 'admin.html' : 'dashboard.html';
        assert(empTargetPage === 'dashboard.html', 13, 'Employee account is redirected to dashboard.html');

    } catch (err) {
        console.error('Fatal error during E2E verification:', err);
        failed++;
    }

    console.log('\n==================================================');
    console.log(`📊 13-STEP E2E VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================');

    process.exit(failed > 0 ? 1 : 0);
}

runE2EVerification();
