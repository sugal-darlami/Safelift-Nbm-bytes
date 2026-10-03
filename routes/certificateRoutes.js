const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificateController');
const { requireAuth } = require('../middleware/authMiddleware');

// Public Certificate Verification Endpoint (No Auth Required)
router.get('/verify/:certificateNumber', certificateController.verifyCertificatePublic);

// Authenticated Employee Certificate Endpoints
router.use(requireAuth);

// POST /api/certificates - Issue or fetch existing certificate for an eligible training result
router.post('/', certificateController.createCertificate);

// GET /api/certificates - Retrieve certificates for authenticated employee
router.get('/', certificateController.getEmployeeCertificates);

// GET /api/certificates/:certificateId/pdf - Generate and download official PDF certificate
router.get('/:certificateId/pdf', certificateController.generateCertificatePdf);

// GET /api/certificates/:certificateId - Retrieve single certificate by ID for authenticated employee
router.get('/:certificateId', certificateController.getSingleCertificate);

module.exports = router;
