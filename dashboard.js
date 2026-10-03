/**
 * SafeLift 360 — Employee Dashboard Logic (Stage 4.4)
 */

(function () {
    'use strict';

    // State Variables
    let currentUser = null;

    // DOM Elements
    const navUserName = document.getElementById('navUserName');
    const navEmployeeId = document.getElementById('navEmployeeId');
    const avatarInitial = document.getElementById('avatarInitial');
    const welcomeHeading = document.getElementById('welcomeHeading');
    const dashboardLogoutBtn = document.getElementById('dashboardLogoutBtn');

    const statCompletedCount = document.getElementById('statCompletedCount');
    const statLatestScore = document.getElementById('statLatestScore');
    const statLatestPct = document.getElementById('statLatestPct');
    const statLatestDate = document.getElementById('statLatestDate');

    const profileFullName = document.getElementById('profileFullName');
    const profileEmail = document.getElementById('profileEmail');
    const profileEmployeeId = document.getElementById('profileEmployeeId');

    const dashboardHistoryContainer = document.getElementById('dashboardHistoryContainer');

    // Initialize Dashboard
    document.addEventListener('DOMContentLoaded', initDashboard);

    async function initDashboard() {
        try {
            // 1. Verify User Authentication Session
            const res = await fetch('/api/auth/me');
            if (!res.ok) {
                window.location.href = 'login.html';
                return;
            }

            const data = await res.json();
            if (!data.success || !data.user) {
                window.location.href = 'login.html';
                return;
            }

            // Role Security Check: Admins should be redirected to admin.html
            if (data.user.role === 'admin') {
                window.location.href = 'admin.html';
                return;
            }

            currentUser = data.user;
            renderUserProfile(currentUser);

            // Attach Logout Handler
            if (dashboardLogoutBtn) {
                dashboardLogoutBtn.addEventListener('click', handleLogout);
            }

            // 2. Fetch Employee Training Results Summary & History
            await loadEmployeeTrainingResults();

            // 3. Fetch Employee Certificates (Stage 5.1)
            await loadEmployeeCertificates();

        } catch (err) {
            console.error('Dashboard initialization error:', err);
            window.location.href = 'login.html';
        }
    }

    function renderUserProfile(user) {
        const initial = user.full_name ? user.full_name.charAt(0).toUpperCase() : 'E';
        if (avatarInitial) avatarInitial.textContent = initial;

        if (navUserName) navUserName.textContent = user.full_name;
        if (navEmployeeId) navEmployeeId.textContent = user.employee_id ? `ID: ${user.employee_id}` : 'N/A';
        if (welcomeHeading) welcomeHeading.textContent = `Welcome back, ${user.full_name}!`;

        if (profileFullName) profileFullName.textContent = user.full_name;
        if (profileEmail) profileEmail.textContent = user.email;
        if (profileEmployeeId) profileEmployeeId.textContent = user.employee_id || 'N/A';
    }

    async function loadEmployeeTrainingResults() {
        if (!dashboardHistoryContainer) return;

        try {
            const res = await fetch('/api/training/results');
            if (!res.ok) {
                throw new Error('Failed to load training results.');
            }

            const data = await res.json();
            if (!data.success || !Array.isArray(data.results)) {
                throw new Error(data.message || 'Invalid response from server.');
            }

            const results = data.results;

            // Render Stat Cards Summary
            const completedCount = results.length;
            if (statCompletedCount) statCompletedCount.textContent = completedCount;

            if (completedCount > 0) {
                const latest = results[0]; // Newest first
                if (statLatestScore) statLatestScore.innerHTML = `${latest.total_score} <span style="font-size: 16px; color: #94a3b8;">/ 100</span>`;
                if (statLatestPct) statLatestPct.textContent = `${Math.round(latest.percentage)}%`;
                if (statLatestDate) statLatestDate.textContent = formatDateString(latest.completed_at);
            } else {
                if (statLatestScore) statLatestScore.textContent = '-';
                if (statLatestPct) statLatestPct.textContent = '-';
                if (statLatestDate) statLatestDate.textContent = 'None yet';
            }

            // Render Training History List
            renderHistoryList(results);

        } catch (err) {
            console.error('Error loading training results:', err);
            if (dashboardHistoryContainer) {
                dashboardHistoryContainer.innerHTML = `
                    <div style="text-align: center; color: #f87171; padding: 24px;">
                        ⚠️ Unable to load training history. Please refresh the page.
                    </div>
                `;
            }
        }
    }

    function renderHistoryList(results) {
        if (!dashboardHistoryContainer) return;

        if (!results || results.length === 0) {
            dashboardHistoryContainer.innerHTML = `
                <div class="empty-history-state">
                    <div class="empty-history-icon">📋</div>
                    <h4 style="font-size: 16px; font-weight: 700; color: #f8fafc; margin: 0;">No Training Completed Yet</h4>
                    <p style="font-size: 13px; color: #94a3b8; margin: 0; max-width: 380px;">
                        You have not completed any SafeLift 360 training sessions yet. Click "Start Training Simulation" above to launch your first session!
                    </p>
                </div>
            `;
            return;
        }

        let html = '';
        results.forEach((item, index) => {
            const formattedDate = formatDateString(item.completed_at);
            const formattedDuration = formatTime(item.training_duration_seconds || 0);

            html += `
                <div class="history-session-card">
                    <div class="session-card-header">
                        <div>
                            <div class="session-title">Training Session #${results.length - index}</div>
                            <div class="session-date">📅 ${escapeHtml(formattedDate)}</div>
                        </div>
                        <span class="session-status-chip">${escapeHtml((item.status || 'completed').toUpperCase())}</span>
                    </div>

                    <div class="session-main-stats">
                        <div class="main-stat-item">
                            <span class="stat-label">Score</span>
                            <span class="stat-value">${item.total_score} / 100</span>
                        </div>
                        <div class="main-stat-item">
                            <span class="stat-label">Percentage</span>
                            <span class="stat-value">${Math.round(item.percentage)}%</span>
                        </div>
                        <div class="main-stat-item">
                            <span class="stat-label">Duration</span>
                            <span class="stat-value" style="color: #cbd5e1;">${formattedDuration}</span>
                        </div>
                    </div>

                    <div>
                        <div class="session-breakdown-title">Assessment Breakdown</div>
                        <div class="session-breakdown-grid">
                            <div class="breakdown-item">
                                <span>Load Inspection:</span>
                                <span class="breakdown-val">${item.load_inspection_score} / 30</span>
                            </div>
                            <div class="breakdown-item">
                                <span>Route Check:</span>
                                <span class="breakdown-val">${item.route_check_score} / 30</span>
                            </div>
                            <div class="breakdown-item">
                                <span>Safe Lift:</span>
                                <span class="breakdown-val">${item.safe_lift_score} / 30</span>
                            </div>
                            <div class="breakdown-item">
                                <span>Safety Precautions:</span>
                                <span class="breakdown-val">${item.safety_precautions_score} / 10</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        dashboardHistoryContainer.innerHTML = html;
    }

    function handleLogout() {
        fetch('/api/auth/logout', { method: 'POST' })
            .finally(() => {
                window.location.href = 'login.html';
            });
    }

    function formatDateString(isoString) {
        if (!isoString) return 'N/A';
        try {
            const date = new Date(isoString);
            return date.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return String(isoString);
        }
    }

    function formatTime(totalSec) {
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        const formattedMins = String(mins).padStart(2, "0");
        const formattedSecs = String(secs).padStart(2, "0");
        return `${formattedMins}:${formattedSecs}`;
    }

    async function loadEmployeeCertificates() {
        const certContainer = document.getElementById('dashboardCertificatesContainer');
        const certBadge = document.getElementById('certCountBadge');
        if (!certContainer) return;

        try {
            const res = await fetch('/api/certificates');
            if (!res.ok) throw new Error('Failed to fetch certificates');

            const data = await res.json();
            if (!data.success || !Array.isArray(data.certificates)) {
                throw new Error(data.message || 'Invalid certificates response');
            }

            const certs = data.certificates;
            if (certBadge) {
                certBadge.textContent = `${certs.length} Earned`;
            }

            renderCertificatesList(certContainer, certs);

        } catch (err) {
            console.error('Error loading certificates:', err);
            if (certContainer) {
                certContainer.innerHTML = `
                    <div style="text-align: center; color: #94a3b8; padding: 20px;">
                        ⚠️ Unable to load certificates right now.
                    </div>
                `;
            }
        }
    }

    function renderCertificatesList(container, certificates) {
        if (!certificates || certificates.length === 0) {
            container.innerHTML = `
                <div class="empty-history-state">
                    <div class="empty-history-icon">🏆</div>
                    <h4 style="font-size: 16px; font-weight: 700; color: #f8fafc; margin: 0;">No Certificates Earned Yet</h4>
                    <p style="font-size: 13px; color: #94a3b8; margin: 0; max-width: 420px;">
                        Complete a manual handling training session with a passing score of 70% or higher to earn your official SafeLift 360 certificate.
                    </p>
                </div>
            `;
            return;
        }

        let html = '';
        certificates.forEach(cert => {
            const issueDateFormatted = formatDateString(cert.issued_at);

            html += `
                <div class="history-session-card" style="border-left: 4px solid #10b981;">
                    <div class="session-card-header">
                        <div>
                            <div class="session-title" style="display: flex; align-items: center; gap: 8px; font-size: 15px;">
                                📜 <strong>Manual Handling Safety Training</strong>
                            </div>
                            <div style="font-size: 12px; color: #38bdf8; margin-top: 4px;">
                                Certificate No: <code>${escapeHtml(cert.certificate_number)}</code>
                            </div>
                        </div>
                        <span class="session-status-chip">✓ ${escapeHtml((cert.status || 'issued').toUpperCase())}</span>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-top: 8px;">
                        <div style="font-size: 13px; color: #cbd5e1;">
                            Score: <strong style="color: #10b981;">${cert.total_score} / 100 (${Math.round(cert.percentage)}%)</strong>
                            <span style="margin: 0 8px; color: #64748b;">•</span>
                            Issued: <span style="color: #cbd5e1;">${escapeHtml(issueDateFormatted)}</span>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <a href="certificate.html?id=${cert.id}" class="btn-start-training" style="padding: 7px 14px; font-size: 12px; border-radius: 8px; text-decoration: none;">
                                👁️ View Certificate
                            </a>
                            <a href="/api/certificates/${cert.id}/pdf" class="btn-start-training" style="padding: 7px 14px; font-size: 12px; border-radius: 8px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); color: #38bdf8; text-decoration: none;">
                                📥 Download PDF
                            </a>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function escapeJsString(str) {
        if (!str) return '';
        return String(str)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"');
    }
})();
