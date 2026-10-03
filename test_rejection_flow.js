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

async function runRejectionTest() {
    console.log('==================================================');
    console.log('🔍 SAFELIFT 360 — REJECTION WORKFLOW END-TO-END TEST');
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
        // Step 1: Submit a test company registration
        const testEmail = `reject_test_${Date.now()}@unapproved.com`;
        const testPassword = 'Password123!';
        const regRes = await request('POST', '/api/company/register', {
            company_name: 'Unverified Logistics Ltd',
            contact_person: 'Fake Owner',
            email: testEmail,
            phone: '+44 20 9999 8888',
            password: testPassword,
            confirm_password: testPassword
        });
        assert(regRes.status === 201 && regRes.data.success === true, 1, 'Submit test company registration succeeds with HTTP 201');

        // Step 2: Verify it appears as pending in DB
        const [pendingRows] = await db.query('SELECT id, status FROM company_registration_requests WHERE email = ?', [testEmail]);
        assert(pendingRows && pendingRows.length === 1 && pendingRows[0].status === 'pending', 2, 'Company registration is inserted into DB with status = pending');

        const requestId = pendingRows[0].id;

        // Step 3: Log in as Super Admin
        const superLogin = await request('POST', '/api/auth/login', {
            email: 'superadmin@safelift360.com',
            password: 'SuperAdmin123!'
        });
        assert(superLogin.status === 200 && superLogin.data.user.role === 'super_admin', 3, 'Super Admin logs in successfully and receives role = super_admin');

        const superCookie = superLogin.cookies ? superLogin.cookies.map(c => c.split(';')[0]).join('; ') : '';

        // Step 4: Retrieve pending request via Super Admin API
        const getReqs = await request('GET', '/api/super-admin/company-requests', null, { Cookie: superCookie });
        const targetReq = getReqs.data.requests.find(r => r.id === requestId);
        assert(targetReq !== undefined && targetReq.status === 'pending', 4, 'Pending company request retrieved in Super Admin requests list');

        // Step 5: Reject the request via POST /api/super-admin/company-requests/:id/reject
        const rejectRes = await request('POST', `/api/super-admin/company-requests/${requestId}/reject`, null, { Cookie: superCookie });
        assert(rejectRes.status === 200 && rejectRes.data.success === true, 5, 'Reject API call returns HTTP 200 with success = true');

        // Step 6: Verify database status becomes 'rejected'
        const [rejectedRows] = await db.query('SELECT status FROM company_registration_requests WHERE id = ?', [requestId]);
        assert(rejectedRows && rejectedRows[0].status === 'rejected', 6, 'Database record status updated to rejected');

        // Step 7: Verify no admin user was created in users table
        const [userRows] = await db.query('SELECT id FROM users WHERE email = ?', [testEmail]);
        assert(!userRows || userRows.length === 0, 7, 'No user account was created in users table for rejected company');

        // Step 8 & 9: Attempt login with rejected company's credentials -> verify HTTP 403 and message
        const rejectedLoginRes = await request('POST', '/api/auth/login', {
            email: testEmail,
            password: testPassword
        });
        assert(
            rejectedLoginRes.status === 403 && 
            rejectedLoginRes.data.success === false && 
            rejectedLoginRes.data.message.includes('rejected'),
            8,
            'Rejected company login attempt is blocked with HTTP 403 and clear rejection message'
        );

        // Step 10: Verify dashboard list displays status as 'rejected'
        const getReqsAfter = await request('GET', '/api/super-admin/company-requests', null, { Cookie: superCookie });
        const updatedReq = getReqsAfter.data.requests.find(r => r.id === requestId);
        assert(updatedReq && updatedReq.status === 'rejected', 9, 'Super Admin API list displays request status as rejected');

        // Step 11: Verify duplicate rejection on already rejected request returns 400 Bad Request
        const dupReject = await request('POST', `/api/super-admin/company-requests/${requestId}/reject`, null, { Cookie: superCookie });
        assert(dupReject.status === 400, 10, 'Subsequent rejection attempt on already rejected request is safely rejected with HTTP 400');

    } catch (err) {
        console.error('Fatal error during rejection test:', err);
        failed++;
    }

    console.log('\n==================================================');
    console.log(`📊 REJECTION WORKFLOW TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================');

    process.exit(failed > 0 ? 1 : 0);
}

runRejectionTest();
