/**
 * SafeLift 360 — Super Admin Dashboard Logic (Stage 6.3)
 */

(function () {
    'use strict';

    // State
    let currentUser = null;
    let allRequests = [];
    let activeFilter = 'all';
    let pendingAction = null; // { type: 'approve'|'reject', id: number, name: string }

    // DOM Elements
    const requestsTableBody = document.getElementById('requestsTableBody');
    const refreshBtn = document.getElementById('refreshBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const filterButtons = document.querySelectorAll('.filter-btn');

    // Stat Elements
    const statPendingCount = document.getElementById('statPendingCount');
    const statApprovedCount = document.getElementById('statApprovedCount');
    const statRejectedCount = document.getElementById('statRejectedCount');
    const statTotalCount = document.getElementById('statTotalCount');

    // Modal Elements
    const confirmModal = document.getElementById('confirmModal');
    const modalIcon = document.getElementById('modalIcon');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalCancelBtn = document.getElementById('modalCancelBtn');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');

    /**
     * 1. Check Session & Access Authorization
     */
    async function checkSuperAdminSession() {
        try {
            const response = await fetch('/api/auth/me');
            const data = await response.json();

            if (!response.ok || !data.success || !data.user) {
                window.location.href = 'login.html';
                return false;
            }

            currentUser = data.user;

            if (currentUser.role !== 'super_admin') {
                if (currentUser.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
                return false;
            }

            return true;
        } catch (err) {
            console.error('Session verification error:', err);
            window.location.href = 'login.html';
            return false;
        }
    }

    /**
     * 2. Format Date Helper
     */
    function formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateStr;
        }
    }

    /**
     * 3. Fetch Company Requests
     */
    async function fetchRequests() {
        if (!requestsTableBody) return;

        requestsTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <div class="empty-icon">⌛</div>
                    <p>Fetching company registration requests...</p>
                </td>
            </tr>
        `;

        try {
            const response = await fetch('/api/super-admin/company-requests');
            const data = await response.json();

            if (response.ok && data.success) {
                allRequests = data.requests || [];
                updateStats();
                renderTable();
            } else {
                requestsTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="empty-state" style="color: #f87171;">
                            <div class="empty-icon">⚠️</div>
                            <p>${data.message || 'Failed to load company requests.'}</p>
                        </td>
                    </tr>
                `;
            }
        } catch (err) {
            console.error('Fetch requests error:', err);
            requestsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state" style="color: #f87171;">
                        <div class="empty-icon">⚠️</div>
                        <p>Network error loading registration requests.</p>
                    </td>
                </tr>
            `;
        }
    }

    /**
     * 4. Update Summary Statistics
     */
    function updateStats() {
        const pending = allRequests.filter(r => r.status === 'pending').length;
        const approved = allRequests.filter(r => r.status === 'approved').length;
        const rejected = allRequests.filter(r => r.status === 'rejected').length;
        const total = allRequests.length;

        if (statPendingCount) statPendingCount.textContent = pending;
        if (statApprovedCount) statApprovedCount.textContent = approved;
        if (statRejectedCount) statRejectedCount.textContent = rejected;
        if (statTotalCount) statTotalCount.textContent = total;
    }

    /**
     * 5. Render Table Rows based on Filter
     */
    function renderTable() {
        if (!requestsTableBody) return;

        let filtered = allRequests;
        if (activeFilter !== 'all') {
            filtered = allRequests.filter(r => r.status === activeFilter);
        }

        if (filtered.length === 0) {
            requestsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <div class="empty-icon">📭</div>
                        <p>No company registration requests found (${activeFilter}).</p>
                    </td>
                </tr>
            `;
            return;
        }

        const rowsHtml = filtered.map(req => {
            const dateDisplay = formatDate(req.created_at);
            const phoneDisplay = req.phone || '<span style="opacity: 0.5;">None</span>';
            
            let statusBadge = '';
            let actionButtons = '';

            if (req.status === 'pending') {
                statusBadge = `<span class="badge badge-pending">Pending</span>`;
                actionButtons = `
                    <div class="action-group" style="justify-content: flex-end;">
                        <button class="btn-act-approve" data-id="${req.id}" data-name="${escapeHtml(req.company_name)}">Approve</button>
                        <button class="btn-act-reject" data-id="${req.id}" data-name="${escapeHtml(req.company_name)}">Reject</button>
                    </div>
                `;
            } else if (req.status === 'approved') {
                statusBadge = `<span class="badge badge-approved">Approved ✓</span>`;
                actionButtons = `<div style="text-align: right; color: #10b981; font-weight: 600; font-size: 0.85rem;">Account Active</div>`;
            } else {
                statusBadge = `<span class="badge badge-rejected">Rejected ✗</span>`;
                actionButtons = `<div style="text-align: right; color: #f87171; font-weight: 600; font-size: 0.85rem;">Rejected</div>`;
            }

            return `
                <tr>
                    <td class="company-cell">${escapeHtml(req.company_name)}</td>
                    <td class="contact-cell">${escapeHtml(req.contact_person)}</td>
                    <td class="email-cell">${escapeHtml(req.email)}</td>
                    <td>${phoneDisplay}</td>
                    <td style="color: #94a3b8; font-size: 0.85rem;">${dateDisplay}</td>
                    <td>${statusBadge}</td>
                    <td>${actionButtons}</td>
                </tr>
            `;
        }).join('');

        requestsTableBody.innerHTML = rowsHtml;
        attachActionListeners();
    }

    /**
     * Escape HTML string helper
     */
    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Attach Event Listeners to Approve / Reject buttons
     */
    function attachActionListeners() {
        const approveBtns = document.querySelectorAll('.btn-act-approve');
        const rejectBtns = document.querySelectorAll('.btn-act-reject');

        approveBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name');
                openConfirmation('approve', id, name);
            });
        });

        rejectBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name');
                openConfirmation('reject', id, name);
            });
        });
    }

    /**
     * Open Action Confirmation Modal
     */
    function openConfirmation(type, id, companyName) {
        pendingAction = { type, id, companyName };

        if (!confirmModal || !modalTitle || !modalMessage || !modalConfirmBtn) return;

        modalConfirmBtn.disabled = false;

        if (type === 'approve') {
            modalIcon.textContent = '🛡️';
            modalTitle.textContent = 'Approve Company Registration';
            modalMessage.textContent = `Are you sure you want to approve "${companyName}" as a SafeLift 360 customer? This will create their company administrator account.`;
            modalConfirmBtn.className = 'btn-modal-confirm-approve';
            modalConfirmBtn.textContent = 'Approve Company';
        } else {
            modalIcon.textContent = '⚠️';
            modalTitle.textContent = 'Reject Company Registration';
            modalMessage.textContent = `Are you sure you want to reject the registration request for "${companyName}"? No account will be created.`;
            modalConfirmBtn.className = 'btn-modal-confirm-reject';
            modalConfirmBtn.textContent = 'Reject Request';
        }

        confirmModal.style.display = 'flex';
    }

    /**
     * Close Confirmation Modal
     */
    function closeModal() {
        if (confirmModal) confirmModal.style.display = 'none';
        if (modalConfirmBtn) modalConfirmBtn.disabled = false;
        pendingAction = null;
    }

    /**
     * Process Approve or Reject API Request
     */
    async function executePendingAction() {
        if (!pendingAction) return;

        const { type, id } = pendingAction;
        modalConfirmBtn.disabled = true;
        modalConfirmBtn.textContent = 'Processing...';

        try {
            const url = `/api/super-admin/company-requests/${id}/${type}`;
            const response = await fetch(url, { method: 'POST' });
            const data = await response.json();

            closeModal();
            if (response.ok && data.success) {
                fetchRequests();
            } else {
                alert(data.message || `Failed to ${type} request.`);
            }
        } catch (err) {
            console.error(`Action ${type} error:`, err);
            alert(`Network error processing ${type} request.`);
            closeModal();
        }
    }

    /**
     * Logout Handler
     */
    async function handleLogout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = 'login.html';
        } catch (err) {
            console.error('Logout error:', err);
            window.location.href = 'login.html';
        }
    }

    /**
     * Initialize Page
     */
    async function init() {
        const isSuperAdmin = await checkSuperAdminSession();
        if (!isSuperAdmin) return;

        fetchRequests();

        // Refresh button
        if (refreshBtn) {
            refreshBtn.addEventListener('click', fetchRequests);
        }

        // Logout button
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }

        // Filter buttons
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeFilter = btn.getAttribute('data-filter');
                renderTable();
            });
        });

        // Modal Cancel / Confirm
        if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeModal);
        if (modalConfirmBtn) modalConfirmBtn.addEventListener('click', executePendingAction);

        if (confirmModal) {
            confirmModal.addEventListener('click', (e) => {
                if (e.target === confirmModal) closeModal();
            });
        }
    }

    // Run Initialization when DOM is ready
    document.addEventListener('DOMContentLoaded', init);

})();
