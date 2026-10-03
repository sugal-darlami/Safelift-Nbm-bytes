/**
 * SafeLift 360 — Official Certificate View Logic (Stage 5.2)
 */

(function () {
    'use strict';

    let currentCertId = null;

    // DOM Elements
    const certRecipientName = document.getElementById('certRecipientName');
    const certScoreDisplay = document.getElementById('certScoreDisplay');
    const certPctDisplay = document.getElementById('certPctDisplay');
    const certNumberDisplay = document.getElementById('certNumberDisplay');
    const certStatusDisplay = document.getElementById('certStatusDisplay');
    const certCompletionDate = document.getElementById('certCompletionDate');
    const certIssueDate = document.getElementById('certIssueDate');
    const certVerifyLink = document.getElementById('certVerifyLink');
    const certUuidDisplay = document.getElementById('certUuidDisplay');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');

    document.addEventListener('DOMContentLoaded', initCertificateView);

    async function initCertificateView() {
        // Parse certificate ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        currentCertId = urlParams.get('id');

        if (!currentCertId) {
            // Attempt to fetch user's certificates if no ID specified
            try {
                const listRes = await fetch('/api/certificates');
                if (listRes.ok) {
                    const listData = await listRes.json();
                    if (listData.success && listData.certificates && listData.certificates.length > 0) {
                        currentCertId = listData.certificates[0].id;
                    }
                }
            } catch (e) {
                console.error('Error fetching fallback certificate:', e);
            }
        }

        if (!currentCertId) {
            alert('No certificate ID specified.');
            window.location.href = 'dashboard.html';
            return;
        }

        // Attach PDF download button listener
        if (downloadPdfBtn) {
            downloadPdfBtn.addEventListener('click', () => {
                window.location.href = `/api/certificates/${currentCertId}/pdf`;
            });
        }

        // Fetch single certificate details from authenticated API
        await loadCertificateDetails(currentCertId);
    }

    async function loadCertificateDetails(certId) {
        try {
            const res = await fetch(`/api/certificates/${certId}`);

            if (res.status === 401) {
                window.location.href = 'login.html';
                return;
            }

            if (res.status === 403) {
                alert('Access denied. You can only view your own certificates.');
                window.location.href = 'dashboard.html';
                return;
            }

            if (!res.ok) {
                throw new Error('Certificate not found.');
            }

            const data = await res.json();
            if (!data.success || !data.certificate) {
                throw new Error('Invalid certificate payload.');
            }

            renderCertificate(data.certificate);

        } catch (err) {
            console.error('Error loading certificate:', err);
            alert('Unable to load certificate details.');
            window.location.href = 'dashboard.html';
        }
    }

    function renderCertificate(cert) {
        if (certRecipientName) {
            certRecipientName.textContent = cert.full_name || 'Employee';
        }
        if (certScoreDisplay) {
            certScoreDisplay.textContent = `${cert.total_score} / 100`;
        }
        if (certPctDisplay) {
            certPctDisplay.textContent = `${Math.round(cert.percentage)}%`;
        }
        if (certNumberDisplay) {
            certNumberDisplay.textContent = cert.certificate_number || 'N/A';
        }
        if (certStatusDisplay) {
            certStatusDisplay.textContent = (cert.status || 'ISSUED').toUpperCase();
        }
        if (certCompletionDate) {
            certCompletionDate.textContent = formatDateString(cert.training_completed_at);
        }
        if (certIssueDate) {
            certIssueDate.textContent = formatDateString(cert.issued_at);
        }

        const verifyUrl = `verify.html?cert=${encodeURIComponent(cert.certificate_number || '')}`;
        if (certVerifyLink) {
            certVerifyLink.href = verifyUrl;
            certVerifyLink.textContent = `Verify online at ${cert.certificate_number}`;
        }
        if (certUuidDisplay) {
            certUuidDisplay.textContent = `UUID: ${cert.certificate_uuid || 'N/A'}`;
        }
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
})();
