const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const db = require('../config/db');

/**
 * PASSING SCORE REQUIREMENT (Stage 5.1)
 * A training result is eligible for a certificate if percentage >= 70%
 */
const MIN_PASSING_PERCENTAGE = 70.0;

/**
 * POST /api/certificates
 * Issue or retrieve a certificate for an eligible completed training result
 */
async function createCertificate(req, res) {
    try {
        // 1. Authenticate Session
        if (!req.session || !req.session.user || !req.session.user.id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        const userId = req.session.user.id;
        const { training_result_id } = req.body;

        if (!training_result_id || isNaN(training_result_id)) {
            return res.status(400).json({
                success: false,
                message: "Valid training_result_id is required."
            });
        }

        // 2. Fetch Training Result from DB
        const [results] = await db.query(
            `SELECT id, user_id, total_score, percentage, status, completed_at
             FROM training_results
             WHERE id = ?`,
            [training_result_id]
        );

        if (!results || results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Training result record not found."
            });
        }

        const trainingResult = results[0];

        // 3. Ownership Verification
        if (trainingResult.user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. You can only request certificates for your own training sessions."
            });
        }

        // 4. Completion Status Check
        if (trainingResult.status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: "Certificate cannot be issued for an incomplete training session."
            });
        }

        // 5. Server-Side Passing Score Verification (>= 70%)
        const resultPct = Number(trainingResult.percentage);
        if (isNaN(resultPct) || resultPct < MIN_PASSING_PERCENTAGE) {
            return res.status(400).json({
                success: false,
                message: `Training score (${resultPct}%) does not meet the passing requirement of ${MIN_PASSING_PERCENTAGE}% for certification.`
            });
        }

        // 6. Duplicate Certificate Check
        const [existingCerts] = await db.query(
            `SELECT id, certificate_uuid, certificate_number, training_result_id, issued_at, status
             FROM certificates
             WHERE training_result_id = ?`,
            [training_result_id]
        );

        if (existingCerts && existingCerts.length > 0) {
            const existing = existingCerts[0];
            return res.status(200).json({
                success: true,
                message: "Certificate already issued for this training session.",
                certificate: {
                    id: existing.id,
                    certificate_uuid: existing.certificate_uuid,
                    certificate_number: existing.certificate_number,
                    training_result_id: existing.training_result_id,
                    total_score: trainingResult.total_score,
                    percentage: String(trainingResult.percentage),
                    issued_at: existing.issued_at,
                    status: existing.status
                }
            });
        }

        // 7. Generate UUID and Unique Certificate Number
        const certificateUuid = crypto.randomUUID();

        // Calculate next sequential certificate number (Format: SL360-YYYY-XXXXXX)
        const [[{ maxId }]] = await db.query('SELECT MAX(id) AS maxId FROM certificates');
        const nextSeq = (maxId || 0) + 1;
        const currentYear = new Date().getFullYear();
        const certificateNumber = `SL360-${currentYear}-${String(nextSeq).padStart(6, '0')}`;

        // 8. Insert Certificate into DB
        const [insertResult] = await db.query(
            `INSERT INTO certificates (certificate_uuid, user_id, training_result_id, certificate_number, status)
             VALUES (?, ?, ?, ?, 'issued')`,
            [certificateUuid, userId, training_result_id, certificateNumber]
        );

        const newCertId = insertResult.insertId;

        // Fetch inserted certificate record
        const [[newCert]] = await db.query(
            `SELECT id, certificate_uuid, certificate_number, training_result_id, issued_at, status
             FROM certificates
             WHERE id = ?`,
            [newCertId]
        );

        return res.status(201).json({
            success: true,
            message: "Certificate issued successfully.",
            certificate: {
                id: newCert.id,
                certificate_uuid: newCert.certificate_uuid,
                certificate_number: newCert.certificate_number,
                training_result_id: newCert.training_result_id,
                total_score: trainingResult.total_score,
                percentage: String(trainingResult.percentage),
                issued_at: newCert.issued_at,
                status: newCert.status
            }
        });

    } catch (err) {
        console.error("Create Certificate Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to process certificate request."
        });
    }
}

/**
 * GET /api/certificates
 * Returns certificates belonging strictly to the authenticated employee
 */
async function getEmployeeCertificates(req, res) {
    try {
        if (!req.session || !req.session.user || !req.session.user.id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        const userId = req.session.user.id;

        const [certificates] = await db.query(
            `SELECT
                c.id,
                c.certificate_uuid,
                c.certificate_number,
                c.training_result_id,
                u.full_name,
                u.employee_id,
                tr.total_score,
                tr.percentage,
                tr.training_duration_seconds,
                tr.completed_at AS training_completed_at,
                c.issued_at,
                c.status
            FROM certificates c
            JOIN users u ON c.user_id = u.id
            JOIN training_results tr ON c.training_result_id = tr.id
            WHERE c.user_id = ?
            ORDER BY c.issued_at DESC`,
            [userId]
        );

        return res.status(200).json({
            success: true,
            certificates: certificates || []
        });

    } catch (err) {
        console.error("Get Employee Certificates Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to retrieve certificates."
        });
    }
}

/**
 * GET /api/certificates/:certificateId
 * Returns specific certificate belonging to authenticated employee
 */
async function getSingleCertificate(req, res) {
    try {
        if (!req.session || !req.session.user || !req.session.user.id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        const userId = req.session.user.id;
        const certificateId = req.params.certificateId;

        if (!certificateId || isNaN(certificateId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid certificate ID."
            });
        }

        const [results] = await db.query(
            `SELECT
                c.id,
                c.certificate_uuid,
                c.certificate_number,
                c.user_id,
                c.training_result_id,
                u.full_name,
                u.employee_id,
                tr.total_score,
                tr.percentage,
                tr.training_duration_seconds,
                tr.completed_at AS training_completed_at,
                c.issued_at,
                c.status
            FROM certificates c
            JOIN users u ON c.user_id = u.id
            JOIN training_results tr ON c.training_result_id = tr.id
            WHERE c.id = ?`,
            [certificateId]
        );

        if (!results || results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Certificate not found."
            });
        }

        const cert = results[0];

        // Ownership Verification: User can only access their own certificate
        if (cert.user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. You can only view your own certificates."
            });
        }

        return res.status(200).json({
            success: true,
            certificate: cert
        });

    } catch (err) {
        console.error("Get Single Certificate Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to retrieve certificate details."
        });
    }
}

/**
 * GET /api/certificates/verify/:certificateNumber
 * Public endpoint to verify certificate authenticity
 */
async function verifyCertificatePublic(req, res) {
    try {
        const certNum = req.params.certificateNumber;

        if (!certNum || typeof certNum !== 'string' || !certNum.trim()) {
            return res.status(400).json({
                success: false,
                valid: false,
                message: "Please provide a valid certificate number."
            });
        }

        const [results] = await db.query(
            `SELECT
                c.certificate_number,
                c.status,
                c.issued_at,
                u.full_name,
                u.employee_id,
                tr.total_score,
                tr.percentage,
                tr.completed_at AS training_completed_at
            FROM certificates c
            JOIN users u ON c.user_id = u.id
            JOIN training_results tr ON c.training_result_id = tr.id
            WHERE c.certificate_number = ?`,
            [certNum.trim()]
        );

        if (!results || results.length === 0) {
            return res.status(404).json({
                success: false,
                valid: false,
                message: "Invalid or unrecognized certificate number."
            });
        }

        const cert = results[0];

        return res.status(200).json({
            success: true,
            valid: true,
            certificate: {
                certificate_number: cert.certificate_number,
                status: cert.status,
                employee_name: cert.full_name,
                employee_id: cert.employee_id || 'N/A',
                training_title: "Manual Handling Safety Training",
                score: cert.total_score,
                percentage: String(cert.percentage),
                completion_date: cert.training_completed_at,
                issue_date: cert.issued_at
            }
        });

    } catch (err) {
        console.error("Verify Certificate Error:", err);
        return res.status(500).json({
            success: false,
            valid: false,
            message: "Unable to verify certificate at this time."
        });
    }
}

/**
 * GET /api/certificates/:certificateId/pdf
 * Generates and downloads official PDF certificate
 */
async function generateCertificatePdf(req, res) {
    try {
        if (!req.session || !req.session.user || !req.session.user.id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        const userId = req.session.user.id;
        const certificateId = req.params.certificateId;

        if (!certificateId || isNaN(certificateId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid certificate ID."
            });
        }

        // Retrieve certificate record from database
        const [results] = await db.query(
            `SELECT
                c.id,
                c.certificate_uuid,
                c.certificate_number,
                c.user_id,
                c.training_result_id,
                u.full_name,
                u.employee_id,
                tr.total_score,
                tr.percentage,
                tr.training_duration_seconds,
                tr.completed_at AS training_completed_at,
                c.issued_at,
                c.status
            FROM certificates c
            JOIN users u ON c.user_id = u.id
            JOIN training_results tr ON c.training_result_id = tr.id
            WHERE c.id = ?`,
            [certificateId]
        );

        if (!results || results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Certificate not found."
            });
        }

        const cert = results[0];

        // Ownership Verification: Must belong to current logged in employee
        if (cert.user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. You can only download your own certificate PDF."
            });
        }

        // Format dates
        const completionDate = cert.training_completed_at
            ? new Date(cert.training_completed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : 'N/A';

        const issueDate = cert.issued_at
            ? new Date(cert.issued_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : 'N/A';

        // Set Response Headers for PDF Download
        const filename = `SafeLift360-Certificate-${cert.certificate_number}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Initialize PDFDocument (A4 Landscape: 841.89 x 595.28 points)
        const doc = new PDFDocument({
            size: 'A4',
            layout: 'landscape',
            margin: 0
        });

        // Pipe PDF stream to HTTP response
        doc.pipe(res);

        const width = 841.89;
        const height = 595.28;

        // Outer Dark Navy Border
        doc.rect(15, 15, width - 30, height - 30)
           .lineWidth(4)
           .strokeColor('#0b1020')
           .stroke();

        // Inner Gold Accent Border
        doc.rect(25, 25, width - 50, height - 50)
           .lineWidth(2)
           .strokeColor('#10b981')
           .stroke();

        // Corner Ornaments
        doc.rect(30, 30, 10, 10).fill('#047857');
        doc.rect(width - 40, 30, 10, 10).fill('#047857');
        doc.rect(30, height - 40, 10, 10).fill('#047857');
        doc.rect(width - 40, height - 40, 10, 10).fill('#047857');

        // Header Title
        doc.font('Helvetica-Bold')
           .fontSize(28)
           .fillColor('#047857')
           .text('SAFELIFT 360', 0, 65, { align: 'center' });

        doc.font('Helvetica')
           .fontSize(10)
           .fillColor('#64748b')
           .text('WORKPLACE SAFETY ASSESSMENT SYSTEM', { align: 'center' });

        doc.moveDown(1.5);

        // Certificate Main Heading
        doc.font('Helvetica-Bold')
           .fontSize(26)
           .fillColor('#0f172a')
           .text('CERTIFICATE OF COMPLETION', { align: 'center' });

        doc.moveDown(0.5);

        // Subtitle
        doc.font('Helvetica-Oblique')
           .fontSize(13)
           .fillColor('#475569')
           .text('This is to certify that', { align: 'center' });

        doc.moveDown(0.8);

        // Employee Name
        doc.font('Helvetica-Bold')
           .fontSize(26)
           .fillColor('#0f172a')
           .text(cert.full_name.toUpperCase(), { align: 'center' });

        doc.moveDown(0.6);

        // Achievement Text
        doc.font('Helvetica')
           .fontSize(13)
           .fillColor('#475569')
           .text('has successfully completed the accredited training course', { align: 'center' });

        doc.moveDown(0.6);

        // Training Title
        doc.font('Helvetica-Bold')
           .fontSize(18)
           .fillColor('#047857')
           .text('MANUAL HANDLING SAFETY TRAINING', { align: 'center' });

        doc.moveDown(1.2);

        // Results Line
        doc.font('Helvetica-Bold')
           .fontSize(14)
           .fillColor('#0f172a')
           .text(`FINAL SCORE: ${cert.total_score} / 100 (${Math.round(cert.percentage)}%)`, { align: 'center' });

        doc.moveDown(1.5);

        // Details Grid (2 Columns)
        const leftX = 120;
        const rightX = width / 2 + 40;
        const currentY = doc.y;

        doc.font('Helvetica')
           .fontSize(11)
           .fillColor('#334155');

        doc.text(`Completion Date: ${completionDate}`, leftX, currentY);
        doc.text(`Issue Date: ${issueDate}`, leftX, currentY + 18);
        doc.text(`Certificate No: ${cert.certificate_number}`, rightX, currentY);
        doc.text(`Status: ${cert.status.toUpperCase()}`, rightX, currentY + 18);

        // Footer Divider Line
        doc.moveTo(60, height - 100)
           .lineTo(width - 60, height - 100)
           .lineWidth(1)
           .strokeColor('#cbd5e1')
           .stroke();

        // Footer / Signatures
        const footerY = height - 85;

        doc.font('Helvetica-Bold')
           .fontSize(11)
           .fillColor('#0f172a')
           .text('SafeLift 360 Certification Board', 80, footerY);

        doc.font('Helvetica')
           .fontSize(9)
           .fillColor('#64748b')
           .text('Authorized Digital Certification', 80, footerY + 14);

        doc.font('Helvetica-Bold')
           .fontSize(10)
           .fillColor('#047857')
           .text(`Verify Online: /verify.html?cert=${cert.certificate_number}`, width - 360, footerY, { align: 'right' });

        doc.font('Helvetica')
           .fontSize(9)
           .fillColor('#64748b')
           .text(`UUID: ${cert.certificate_uuid}`, width - 360, footerY + 14, { align: 'right' });

        // Finalize PDF Stream
        doc.end();

    } catch (err) {
        console.error("Generate Certificate PDF Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to generate PDF certificate."
        });
    }
}

module.exports = {
    createCertificate,
    getEmployeeCertificates,
    getSingleCertificate,
    verifyCertificatePublic,
    generateCertificatePdf
};
