/**
 * SafeLift 360 — Stage 6.7 Comprehensive Integration Test Suite
 * Validates real training results integration, dynamic Company Admin stats,
 * multi-tenant isolation, and tamper resistance.
 */

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

function extractCookieHeader(setCookieHeader) {
    if (!setCookieHeader || !setCookieHeader.length) return '';
    return setCookieHeader.map(c => c.split(';')[0]).join('; ');
}

async function runTests() {
    console.log("=== STARTING STAGE 6.7 TRAINING RESULTS INTEGRATION TEST SUITE ===\n");
    let passedCount = 0;
    let failedCount = 0;

    function assert(condition, message, detail = '') {
        if (condition) {
            console.log(`[PASS] ${message}`);
            passedCount++;
        } else {
            console.error(`[FAIL] ${message} ${detail ? `(${detail})` : ''}`);
            failedCount++;
        }
    }

    try {
        const timestamp = Date.now();
        const compA_Name = `Integration Corp A ${timestamp}`;
        const compA_Email = `admin_a_${timestamp}@corpa.com`;
        const compB_Name = `Integration Corp B ${timestamp}`;
        const compB_Email = `admin_b_${timestamp}@corpb.com`;
        const password = 'CompanyPass123!';
        const passwordHash = await bcrypt.hash(password, 10);

        // 1. Setup Company A in database
        const [regA] = await db.query(
            `INSERT INTO company_registration_requests (company_name, contact_person, email, phone, password_hash, status) 
             VALUES (?, ?, ?, ?, ?, 'approved')`,
            [compA_Name, 'Admin A', compA_Email, '+1 555 111 2222', passwordHash]
        );
        const compAId = regA.insertId;

        const [insertCompA] = await db.query(
            "INSERT INTO users (full_name, email, password_hash, role, company_id) VALUES (?, ?, ?, 'admin', ?)",
            ['Admin A', compA_Email, passwordHash, compAId]
        );

        // 2. Setup Company B in database
        const [regB] = await db.query(
            `INSERT INTO company_registration_requests (company_name, contact_person, email, phone, password_hash, status) 
             VALUES (?, ?, ?, ?, ?, 'approved')`,
            [compB_Name, 'Admin B', compB_Email, '+1 555 333 4444', passwordHash]
        );
        const compBId = regB.insertId;

        const [insertCompB] = await db.query(
            "INSERT INTO users (full_name, email, password_hash, role, company_id) VALUES (?, ?, ?, 'admin', ?)",
            ['Admin B', compB_Email, passwordHash, compBId]
        );

        // 3. Login as Admin A
        const loginResA = await request('POST', '/api/auth/login', {
            email: compA_Email,
            password: password
        });
        const cookieA = extractCookieHeader(loginResA.cookies);
        const headersA = { 'Cookie': cookieA };

        assert(loginResA.status === 200 && loginResA.data.success, "Admin A logged in successfully", JSON.stringify(loginResA.data));

        // 4. Admin A creates 3 Employees: Alice, Bob, Charlie (Company A)
        const aliceEmail = `alice_${timestamp}@corpa.com`;
        const bobEmail = `bob_${timestamp}@corpa.com`;
        const charlieAEmail = `charlie_a_${timestamp}@corpa.com`;

        const createAliceRes = await request('POST', '/api/company/employees', {
            full_name: "Alice Smith",
            email: aliceEmail,
            department: "Safety Logistics",
            password: password
        }, headersA);
        assert(createAliceRes.status === 201 && createAliceRes.data.success, "Admin A created Employee Alice (Company A)");

        const createBobRes = await request('POST', '/api/company/employees', {
            full_name: "Bob Jones",
            email: bobEmail,
            department: "Forklift Ops",
            password: password
        }, headersA);
        assert(createBobRes.status === 201 && createBobRes.data.success, "Admin A created Employee Bob (Company A)");

        const createCharlieARes = await request('POST', '/api/company/employees', {
            full_name: "Charlie Davis",
            email: charlieAEmail,
            department: "Quality Assurance",
            password: password
        }, headersA);
        assert(createCharlieARes.status === 201 && createCharlieARes.data.success, "Admin A created Employee Charlie (Company A)");

        // 5. Login as Admin B and create Employee Dave (Company B)
        const loginResB = await request('POST', '/api/auth/login', {
            email: compB_Email,
            password: password
        });
        const cookieB = extractCookieHeader(loginResB.cookies);
        const headersB = { 'Cookie': cookieB };

        assert(loginResB.status === 200 && loginResB.data.success, "Admin B logged in successfully");

        const daveBEmail = `dave_b_${timestamp}@corpb.com`;
        const createDaveBRes = await request('POST', '/api/company/employees', {
            full_name: "Dave Miller",
            email: daveBEmail,
            department: "Receiving",
            password: password
        }, headersB);
        assert(createDaveBRes.status === 201 && createDaveBRes.data.success, "Admin B created Employee Dave (Company B)");

        // 6. Check Initial Company A Stats (3 Employees, 0 Completed, 3 Pending, 0% Avg Score)
        const initDashA = await request('GET', '/api/company/dashboard', null, headersA);
        assert(initDashA.status === 200, "Admin A fetched dashboard");
        assert(initDashA.data.stats.employees === 3, "Company A initial employees count = 3", JSON.stringify(initDashA.data.stats));
        assert(initDashA.data.stats.completed === 0, "Company A initial completed count = 0", JSON.stringify(initDashA.data.stats));
        assert(initDashA.data.stats.pending === 3, "Company A initial pending count = 3", JSON.stringify(initDashA.data.stats));
        assert(initDashA.data.stats.averageScore === 0, "Company A initial average score = 0%", JSON.stringify(initDashA.data.stats));

        // 7. Alice logs in and completes training with score 92%
        const loginAliceRes = await request('POST', '/api/auth/login', {
            email: aliceEmail,
            password: password
        });
        const headersAlice = { 'Cookie': extractCookieHeader(loginAliceRes.cookies) };

        const aliceTrainingRes = await request('POST', '/api/training/results', {
            load_inspection_score: 30,
            route_check_score: 30,
            safe_lift_score: 20,
            safety_precautions_score: 10,
            total_score: 90,
            percentage: 92,
            training_duration_seconds: 120,
            status: "Completed"
        }, headersAlice);
        assert(aliceTrainingRes.status === 201 && aliceTrainingRes.data.success, "Alice completed training with 92% score", JSON.stringify(aliceTrainingRes.data));

        // 8. Verify Dashboard after Alice completes (3 Employees, 1 Completed, 2 Pending, 92% Avg Score)
        const dashAfterAlice = await request('GET', '/api/company/dashboard', null, headersA);
        assert(dashAfterAlice.status === 200, "Admin A fetched dashboard after Alice completed");
        assert(dashAfterAlice.data.stats.employees === 3, "Company A employees count = 3", JSON.stringify(dashAfterAlice.data.stats));
        assert(dashAfterAlice.data.stats.completed === 1, "Company A completed count = 1 (Alice)", JSON.stringify(dashAfterAlice.data.stats));
        assert(dashAfterAlice.data.stats.pending === 2, "Company A pending count = 2 (Bob & Charlie)", JSON.stringify(dashAfterAlice.data.stats));
        assert(dashAfterAlice.data.stats.averageScore === 92, "Company A average score = 92%", JSON.stringify(dashAfterAlice.data.stats));

        // 9. Bob logs in and completes training with score 76% (Pending -> Completed transition)
        const loginBobRes = await request('POST', '/api/auth/login', {
            email: bobEmail,
            password: password
        });
        const headersBob = { 'Cookie': extractCookieHeader(loginBobRes.cookies) };

        const bobTrainingRes = await request('POST', '/api/training/results', {
            load_inspection_score: 30,
            route_check_score: 30,
            safe_lift_score: 10,
            safety_precautions_score: 0,
            total_score: 70,
            percentage: 76,
            training_duration_seconds: 150,
            status: "Completed"
        }, headersBob);
        assert(bobTrainingRes.status === 201 && bobTrainingRes.data.success, "Bob completed training with 76% score", JSON.stringify(bobTrainingRes.data));

        // 10. Fetch Company A Dashboard and verify 3 Employees, 2 Completed, 1 Pending, 84% Average Score ((92 + 76) / 2)
        const updatedDashA = await request('GET', '/api/company/dashboard', null, headersA);
        assert(updatedDashA.status === 200, "Admin A fetched updated dashboard");
        assert(updatedDashA.data.stats.employees === 3, "Company A total employees = 3", JSON.stringify(updatedDashA.data.stats));
        assert(updatedDashA.data.stats.completed === 2, "Company A completed count = 2 (Alice & Bob)", JSON.stringify(updatedDashA.data.stats));
        assert(updatedDashA.data.stats.pending === 1, "Company A pending count = 1 (Charlie)", JSON.stringify(updatedDashA.data.stats));
        assert(updatedDashA.data.stats.averageScore === 84, "Company A average score = 84% ((92 + 76) / 2)", JSON.stringify(updatedDashA.data.stats));

        // 11. Fetch Company A Employees list & verify training_status and scores
        const empListA = await request('GET', '/api/company/employees', null, headersA);
        assert(empListA.status === 200 && empListA.data.employees.length === 3, "Admin A fetched 3 employees", JSON.stringify(empListA.data));
        const aliceInList = empListA.data.employees ? empListA.data.employees.find(e => e.email === aliceEmail) : null;
        const bobInList = empListA.data.employees ? empListA.data.employees.find(e => e.email === bobEmail) : null;
        const charlieInList = empListA.data.employees ? empListA.data.employees.find(e => e.email === charlieAEmail) : null;

        assert(aliceInList && aliceInList.training_status === 'Completed' && aliceInList.score === 92, "Alice record shows Completed with 92%", JSON.stringify(aliceInList));
        assert(bobInList && bobInList.training_status === 'Completed' && bobInList.score === 76, "Bob record shows Completed with 76%", JSON.stringify(bobInList));
        assert(charlieInList && charlieInList.training_status === 'Pending' && charlieInList.score === null, "Charlie record shows Pending with N/A score", JSON.stringify(charlieInList));

        // 12. Fetch Company A Training Results endpoint (All 3 Company A employees listed)
        const resultsA = await request('GET', '/api/company/training-results', null, headersA);
        assert(resultsA.status === 200 && Array.isArray(resultsA.data.results) && resultsA.data.results.length === 3, "Admin A fetched 3 company training results", JSON.stringify(resultsA.data));
        assert(resultsA.data.results && resultsA.data.results.some(r => r.employee_name === "Alice Smith" && r.percentage === 92 && r.status === "Completed"), "Alice result present as Completed 92%");
        assert(resultsA.data.results && resultsA.data.results.some(r => r.employee_name === "Bob Jones" && r.percentage === 76 && r.status === "Completed"), "Bob result present as Completed 76%");
        assert(resultsA.data.results && resultsA.data.results.some(r => r.employee_name === "Charlie Davis" && r.status === "Pending"), "Charlie result present as Pending —");

        // 13. Multi-tenant Isolation Test: Verify Admin B CANNOT see Company A's data
        const dashB = await request('GET', '/api/company/dashboard', null, headersB);
        assert(dashB.status === 200, "Admin B fetched dashboard");
        assert(dashB.data.stats.employees === 1, "Company B employees count = 1 (Dave only)");
        assert(dashB.data.stats.completed === 0, "Company B completed count = 0");
        assert(dashB.data.stats.pending === 1, "Company B pending count = 1");
        assert(dashB.data.stats.averageScore === 0, "Company B average score = 0%");

        const empListB = await request('GET', '/api/company/employees', null, headersB);
        assert(empListB.status === 200 && empListB.data.employees.length === 1, "Company B employees list has exactly 1 employee");
        assert(empListB.data.employees[0].email === daveBEmail, "Company B employee is Dave");

        const resultsB = await request('GET', '/api/company/training-results', null, headersB);
        assert(resultsB.status === 200 && Array.isArray(resultsB.data.results) && resultsB.data.results.length === 1, "Company B training results list has 1 employee (Dave)");
        assert(resultsB.data.results[0].employee_name === "Dave Miller" && resultsB.data.results[0].status === "Pending", "Dave listed as Pending for Company B");

        // 14. Security Tampering Test: Pass fake company_id in query params to attempt cross-tenant leakage
        const leakAttempt = await request('GET', `/api/company/training-results?company_id=${compAId}`, null, headersB);
        assert(leakAttempt.status === 200 && Array.isArray(leakAttempt.data.results) && leakAttempt.data.results.length === 1, "Tamper Resistance: Admin B specifying Company A's company_id in query params still returns Company B's data only");
        assert(leakAttempt.data.results[0].employee_name === "Dave Miller", "Tamper Resistance: Returned employee is Dave (Company B)");

    } catch (err) {
        console.error("Test execution exception:", err.stack || err.message);
        failedCount++;
    }

    console.log("\n==================================================");
    console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log("==================================================\n");

    if (failedCount > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests();
