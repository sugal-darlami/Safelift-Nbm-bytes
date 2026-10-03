const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminController');
const { requireSuperAdmin } = require('../middleware/authMiddleware');

// All routes in this module require Super Admin authorization
router.use(requireSuperAdmin);

// GET /api/super-admin/company-requests - Retrieve company registration requests
router.get('/company-requests', superAdminController.getCompanyRequests);

// POST /api/super-admin/company-requests/:id/approve - Approve request
router.post('/company-requests/:id/approve', superAdminController.approveCompanyRequest);

// POST /api/super-admin/company-requests/:id/reject - Reject request
router.post('/company-requests/:id/reject', superAdminController.rejectCompanyRequest);

module.exports = router;
