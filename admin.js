/**
 * SafeLift 360 — Company Admin Dashboard Logic
 * Displays company workspace identity, live dynamic training statistics,
 * employee training progress, and multi-tenant training results.
 */

(function () {
    'use strict';

    // State Variables
    let currentUser = null;
    let companyData = null;
    let companyEmployees = [];

    // DOM Elements - Header & Profile
    const headerCompanyNameDisplay = document.getElementById('headerCompanyNameDisplay');
    const adminNameDisplay = document.getElementById('adminNameDisplay');
    const adminAvatar = document.getElementById('adminAvatar');
    const companyNameDisplay = document.getElementById('companyNameDisplay');
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');

    // DOM Elements - Summary Stats Cards
    const statEmployees = document.getElementById('statEmployees');
    const statCompleted = document.getElementById('statCompleted');
    const statPending = document.getElementById('statPending');
    const statAvgScore = document.getElementById('statAvgScore');

    // DOM Elements - Overview Grid
    const overviewCompanyName = document.getElementById('overviewCompanyName');
    const overviewContactPerson = document.getElementById('overviewContactPerson');
    const overviewEmail = document.getElementById('overviewEmail');
    const overviewStatus = document.getElementById('overviewStatus');

    // DOM Elements - Company Settings Grid
    const settingsCompanyName = document.getElementById('settingsCompanyName');
    const settingsContactPerson = document.getElementById('settingsContactPerson');
    const settingsEmail = document.getElementById('settingsEmail');
    const settingsPhone = document.getElementById('settingsPhone');
    const settingsStatus = document.getElementById('settingsStatus');

    // DOM Elements - Employee Management
    const companyEmployeeTableBody = document.getElementById('companyEmployeeTableBody');
    const openAddEmployeeModalBtn = document.getElementById('openAddEmployeeModalBtn');
    const addEmployeeModal = document.getElementById('addEmployeeModal');
    const closeAddEmployeeModalBtn = document.getElementById('closeAddEmployeeModalBtn');
    const closeAddEmployeeModalCross = document.getElementById('closeAddEmployeeModalCross');
    const addEmployeeForm = document.getElementById('addEmployeeForm');
    const submitAddEmployeeBtn = document.getElementById('submitAddEmployeeBtn');

    // DOM Elements - Training Results
    const companyTrainingResultsTableBody = document.getElementById('companyTrainingResultsTableBody');

    // Form inputs & alert
    const empFullNameInput = document.getElementById('empFullNameInput');
    const empEmailInput = document.getElementById('empEmailInput');
    const empDeptInput = document.getElementById('empDeptInput');
    const empPasswordInput = document.getElementById('empPasswordInput');
    const empModalAlert = document.getElementById('empModalAlert');
    const empModalAlertText = document.getElementById('empModalAlertText');

    // DOM Elements - Tabs
    const tabButtons = document.querySelectorAll('.nav-tab');
    const tabPanes = document.querySelectorAll('.tab-pane');

    // Initialize Page Security & Data Loading
    document.addEventListener('DOMContentLoaded', initCompanyAdminDashboard);

    async function initCompanyAdminDashboard() {
        try {
            // 1. Verify session & role on server via /api/auth/me
            const meRes = await fetch('/api/auth/me');
            if (!meRes.ok) {
                window.location.href = 'login.html';
                return;
            }

            const meData = await meRes.json();
            if (!meData.success || !meData.user) {
                window.location.href = 'login.html';
                return;
            }

            const user = meData.user;

            // 2. Strict Role-Based Access & Redirection
            if (user.role === 'super_admin') {
                window.location.href = 'super-admin.html';
                return;
            } else if (user.role === 'employee') {
                window.location.href = 'dashboard.html';
                return;
            } else if (user.role !== 'admin') {
                window.location.href = 'login.html';
                return;
            }

            currentUser = user;

            // 3. Attach Event Listeners
            if (adminLogoutBtn) {
                adminLogoutBtn.addEventListener('click', handleAdminLogout);
            }

            setupTabNavigation();
            setupEmployeeModalListeners();

            // 4. Fetch Company Dashboard, Employees, and Training Results Data
            await Promise.all([
                loadCompanyDashboardData(),
                loadCompanyEmployees(),
                loadCompanyTrainingResults()
            ]);

        } catch (err) {
            console.error('Company Admin initialization error:', err);
            window.location.href = 'login.html';
        }
    }

    async function loadCompanyDashboardData() {
        try {
            const res = await fetch('/api/company/dashboard');

            if (res.status === 401) {
                window.location.href = 'login.html';
                return;
            } else if (res.status === 403) {
                if (currentUser && currentUser.role === 'super_admin') {
                    window.location.href = 'super-admin.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
                return;
            }

            const data = await res.json();
            if (!data.success || !data.company) {
                console.error('Failed to load company dashboard data:', data.message);
                return;
            }

            companyData = data.company;
            const stats = data.stats || {};

            // Render Prominent Company Header & Workspace Branding
            if (headerCompanyNameDisplay) {
                headerCompanyNameDisplay.textContent = `${(companyData.name || 'COMPANY').toUpperCase()} WORKSPACE`;
            }

            if (adminNameDisplay) {
                adminNameDisplay.textContent = companyData.contact_person || currentUser.full_name || 'Administrator';
            }

            if (adminAvatar) {
                const nameStr = companyData.contact_person || currentUser.full_name || 'A';
                adminAvatar.textContent = nameStr.charAt(0).toUpperCase();
            }

            if (companyNameDisplay) {
                companyNameDisplay.textContent = companyData.name || 'Company Workspace';
            }

            // Render Stat Cards (Database-driven stats)
            if (statEmployees) statEmployees.textContent = stats.employees !== undefined ? stats.employees : 0;
            if (statCompleted) statCompleted.textContent = stats.completed !== undefined ? stats.completed : 0;
            if (statPending) statPending.textContent = stats.pending !== undefined ? stats.pending : 0;
            if (statAvgScore) statAvgScore.textContent = `${stats.averageScore !== undefined ? stats.averageScore : 0}%`;

            // Render Workspace Overview Card
            if (overviewCompanyName) overviewCompanyName.textContent = companyData.name || '-';
            if (overviewContactPerson) overviewContactPerson.textContent = companyData.contact_person || '-';
            if (overviewEmail) overviewEmail.textContent = companyData.email || '-';
            if (overviewStatus) overviewStatus.textContent = (companyData.status || 'approved').toUpperCase();

            // Render Company Settings Tab
            if (settingsCompanyName) settingsCompanyName.textContent = companyData.name || '-';
            if (settingsContactPerson) settingsContactPerson.textContent = companyData.contact_person || '-';
            if (settingsEmail) settingsEmail.textContent = companyData.email || '-';
            if (settingsPhone) settingsPhone.textContent = companyData.phone || 'N/A';
            if (settingsStatus) settingsStatus.textContent = (companyData.status || 'approved').toUpperCase();

        } catch (err) {
            console.error('Error fetching company dashboard data:', err);
        }
    }

    async function loadCompanyEmployees() {
        try {
            const res = await fetch('/api/company/employees');
            if (!res.ok) {
                renderEmployeeTable([]);
                return;
            }

            const data = await res.json();
            companyEmployees = (data.success && Array.isArray(data.employees)) ? data.employees : [];

            renderEmployeeTable(companyEmployees);

        } catch (err) {
            console.error('Error loading company employees:', err);
            renderEmployeeTable([]);
        }
    }

    function renderEmployeeTable(employees) {
        if (!companyEmployeeTableBody) return;

        if (!employees || employees.length === 0) {
            companyEmployeeTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: #94a3b8; padding: 36px 20px; font-size: 14px;">
                        No employees have been added yet.
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        employees.forEach(emp => {
            const createdDateStr = formatDate(emp.created_at);
            const isCompleted = emp.training_status === 'Completed';
            const statusChip = isCompleted
                ? `<span style="color:#10b981; background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); padding:4px 10px; border-radius:6px; font-size:12px; font-weight:600;">✓ Completed</span>`
                : `<span style="color:#fbbf24; background:rgba(251,191,36,0.15); border:1px solid rgba(251,191,36,0.3); padding:4px 10px; border-radius:6px; font-size:12px; font-weight:600;">⏳ Pending</span>`;

            const scoreDisplay = emp.score != null ? `<strong style="color: #38bdf8;">${emp.score}%</strong>` : `<span style="color: #64748b;">—</span>`;

            html += `
                <tr>
                    <td><strong style="color: #f8fafc;">${escapeHtml(emp.full_name)}</strong></td>
                    <td>${escapeHtml(emp.email)}</td>
                    <td><code>${escapeHtml(emp.employee_id || 'N/A')}</code></td>
                    <td>${escapeHtml(emp.department || 'N/A')}</td>
                    <td>${statusChip}</td>
                    <td>${scoreDisplay}</td>
                    <td>${escapeHtml(createdDateStr)}</td>
                    <td><span style="color: #10b981; font-size: 12px; font-weight: 600;">Active</span></td>
                </tr>
            `;
        });

        companyEmployeeTableBody.innerHTML = html;
    }

    async function loadCompanyTrainingResults() {
        try {
            const res = await fetch('/api/company/training-results');
            if (!res.ok) {
                renderTrainingResultsTable([]);
                return;
            }

            const data = await res.json();
            const results = (data.success && Array.isArray(data.results)) ? data.results : [];
            renderTrainingResultsTable(results);

        } catch (err) {
            console.error('Error loading training results:', err);
            renderTrainingResultsTable([]);
        }
    }

    function renderTrainingResultsTable(results) {
        if (!companyTrainingResultsTableBody) return;

        if (!results || results.length === 0) {
            companyTrainingResultsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: #94a3b8; padding: 36px 20px; font-size: 14px;">
                        No employee records found.
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        results.forEach(tr => {
            const isCompleted = tr.status === 'Completed';
            const completedDateStr = tr.completed_at ? formatDate(tr.completed_at) : '<span style="color: #64748b;">—</span>';
            const scoreDisplay = isCompleted && tr.percentage != null
                ? `<strong style="color: #38bdf8;">${tr.percentage}%</strong>`
                : `<span style="color: #64748b;">—</span>`;

            const statusChip = isCompleted
                ? `<span style="color: #10b981; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">✓ Completed</span>`
                : `<span style="color: #fbbf24; background: rgba(251, 191, 36, 0.15); border: 1px solid rgba(251, 191, 36, 0.3); padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">⏳ Pending</span>`;

            html += `
                <tr>
                    <td><strong style="color: #f8fafc;">${escapeHtml(tr.employee_name)}</strong></td>
                    <td><code>${escapeHtml(tr.employee_id || 'N/A')}</code></td>
                    <td>${escapeHtml(tr.department || 'N/A')}</td>
                    <td>${scoreDisplay}</td>
                    <td>${statusChip}</td>
                    <td>${completedDateStr}</td>
                </tr>
            `;
        });

        companyTrainingResultsTableBody.innerHTML = html;
    }

    function setupTabNavigation() {
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');

                tabButtons.forEach(b => b.classList.remove('active'));
                tabPanes.forEach(p => {
                    p.classList.remove('active');
                    p.classList.add('hidden');
                });

                btn.classList.add('active');
                const activePane = document.getElementById(`tab-${targetTab}`);
                if (activePane) {
                    activePane.classList.remove('hidden');
                    activePane.classList.add('active');
                }

                if (targetTab === 'dashboard') {
                    loadCompanyDashboardData();
                } else if (targetTab === 'employees') {
                    loadCompanyEmployees();
                } else if (targetTab === 'results') {
                    loadCompanyTrainingResults();
                }
            });
        });
    }

    function setupEmployeeModalListeners() {
        if (openAddEmployeeModalBtn) {
            openAddEmployeeModalBtn.addEventListener('click', openModal);
        }

        if (closeAddEmployeeModalBtn) {
            closeAddEmployeeModalBtn.addEventListener('click', closeModal);
        }

        if (closeAddEmployeeModalCross) {
            closeAddEmployeeModalCross.addEventListener('click', closeModal);
        }

        if (addEmployeeModal) {
            addEmployeeModal.addEventListener('click', (e) => {
                if (e.target === addEmployeeModal) {
                    closeModal();
                }
            });
        }

        if (addEmployeeForm) {
            addEmployeeForm.addEventListener('submit', handleCreateEmployeeSubmit);
        }
    }

    function openModal() {
        hideModalAlert();
        if (addEmployeeForm) addEmployeeForm.reset();
        if (addEmployeeModal) addEmployeeModal.style.display = 'flex';
        if (empFullNameInput) empFullNameInput.focus();
    }

    function closeModal() {
        if (addEmployeeModal) addEmployeeModal.style.display = 'none';
        hideModalAlert();
    }

    function showModalAlert(message) {
        if (!empModalAlert || !empModalAlertText) return;
        empModalAlertText.textContent = message;
        empModalAlert.style.display = 'flex';
    }

    function hideModalAlert() {
        if (empModalAlert) empModalAlert.style.display = 'none';
    }

    async function handleCreateEmployeeSubmit(e) {
        e.preventDefault();
        hideModalAlert();

        const fullName = empFullNameInput ? empFullNameInput.value.trim() : '';
        const email = empEmailInput ? empEmailInput.value.trim() : '';
        const dept = empDeptInput ? empDeptInput.value.trim() : '';
        const password = empPasswordInput ? empPasswordInput.value : '';

        if (!fullName || !email || !dept || !password) {
            showModalAlert('Please fill out all required fields.');
            return;
        }

        if (password.length < 8) {
            showModalAlert('Temporary password must be at least 8 characters long.');
            return;
        }

        const originalBtnText = submitAddEmployeeBtn ? submitAddEmployeeBtn.innerHTML : '';
        if (submitAddEmployeeBtn) {
            submitAddEmployeeBtn.disabled = true;
            submitAddEmployeeBtn.innerHTML = '<span>Creating...</span>';
        }

        try {
            const res = await fetch('/api/company/employees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: fullName,
                    email: email,
                    department: dept,
                    password: password
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                closeModal();
                await Promise.all([
                    loadCompanyEmployees(),
                    loadCompanyDashboardData(),
                    loadCompanyTrainingResults()
                ]);
            } else {
                showModalAlert(data.message || 'Unable to create employee account.');
            }

        } catch (err) {
            console.error('Error creating employee:', err);
            showModalAlert('Network error. Unable to connect to server.');
        } finally {
            if (submitAddEmployeeBtn) {
                submitAddEmployeeBtn.disabled = false;
                submitAddEmployeeBtn.innerHTML = originalBtnText;
            }
        }
    }

    async function handleAdminLogout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (err) {
            console.error('Logout error:', err);
        } finally {
            window.location.href = 'login.html';
        }
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } catch (e) {
            return String(dateStr);
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
})();
