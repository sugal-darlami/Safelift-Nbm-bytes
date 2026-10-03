/**
 * SafeLift 360 — Public Certificate Verification Logic (Stage 5.2)
 */

(function () {
    'use strict';

    const verifyForm = document.getElementById('verifyForm');
    const certInput = document.getElementById('certInput');
    const resultContainer = document.getElementById('resultContainer');

    document.addEventListener('DOMContentLoaded', initVerifyPage);

    function initVerifyPage() {
        const urlParams = new URLSearchParams(window.location.search);
        const certParam = urlParams.get('cert');

        if (certParam && certInput) {
            certInput.value = certParam.trim();
            performVerification(certParam.trim());
        }

        if (verifyForm) {
            verifyForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const certNum = certInput ? certInput.value.trim() : '';
                if (certNum) {
                    performVerification(certNum);
                }
            });
        }
    }

    async function performVerification(certificateNumber) {
        if (!resultContainer) return;

        resultContainer.style.display = 'flex';
        resultContainer.innerHTML = `
            <div style="text-align: center; color: #94a3b8; padding: 16px;">
                ⏳ Verifying certificate <strong>${escapeHtml(certificateNumber)}</strong>...
            </div>
        `;

        try {
            const res = await fetch(`/api/certificates/verify/${encodeURIComponent(certificateNumber)}`);
            const data = await res.json();

            if (res.ok && data.success && data.valid && data.certificate) {
                renderValidResult(data.certificate);
            } else {
                renderInvalidResult(data.message || 'Invalid or unrecognized certificate number.');
            }

        } catch (err) {
            console.error('Verification error:', err);
            renderInvalidResult('Network error. Unable to verify certificate at this time.');
        }
    }

    function renderValidResult(cert) {
        const completionFormatted = formatDateString(cert.completion_date);
        const issueFormatted = formatDateString(cert.issue_date);

        resultContainer.innerHTML = `
            <div class="status-valid">
                <span>✓</span> OFFICIAL VALID CERTIFICATE
            </div>

            <div class="result-grid">
                <div class="result-item" style="grid-column: 1 / -1;">
                    <span>Issued To</span>
                    <strong style="font-size: 16px; color: #f8fafc;">${escapeHtml(cert.employee_name)}</strong>
                </div>

                <div class="result-item" style="grid-column: 1 / -1;">
                    <span>Course Title</span>
                    <strong style="color: #38bdf8;">${escapeHtml(cert.training_title)}</strong>
                </div>

                <div class="result-item">
                    <span>Certificate No.</span>
                    <strong style="color: #34d399;">${escapeHtml(cert.certificate_number)}</strong>
                </div>

                <div class="result-item">
                    <span>Final Score</span>
                    <strong style="color: #10b981;">${cert.score} / 100 (${Math.round(cert.percentage)}%)</strong>
                </div>

                <div class="result-item">
                    <span>Completion Date</span>
                    <strong>${escapeHtml(completionFormatted)}</strong>
                </div>

                <div class="result-item">
                    <span>Issue Date</span>
                    <strong>${escapeHtml(issueFormatted)}</strong>
                </div>
            </div>
        `;
    }

    function renderInvalidResult(message) {
        resultContainer.innerHTML = `
            <div class="status-invalid">
                <span>⚠️</span> VERIFICATION FAILED
            </div>
            <p style="color: #f87171; font-size: 14px; margin: 0;">
                ${escapeHtml(message)}
            </p>
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                Please verify the certificate number and try again. Official SafeLift 360 certificate numbers follow the format: <code>SL360-YYYY-XXXXXX</code>.
            </p>
        `;
    }

    function formatDateString(isoString) {
        if (!isoString) return 'N/A';
        try {
            const date = new Date(isoString);
            return date.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } catch (e) {
            return String(isoString);
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
