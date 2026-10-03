const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { requireAuth } = require('../middleware/authMiddleware');

// POST /api/company/register - Submit Company Registration Request
router.post('/register', companyController.registerCompanyRequest);

// GET /api/company/dashboard - Fetch Company Admin Dashboard info for authenticated admin
router.get('/dashboard', requireAuth, companyController.getCompanyDashboard);

// GET /api/company/employees - Fetch employees for authenticated Company Admin's company
router.get('/employees', requireAuth, companyController.getCompanyEmployees);

// GET /api/company/training-results - Fetch training results for authenticated Company Admin's company
router.get('/training-results', requireAuth, companyController.getCompanyTrainingResults);

// POST /api/company/employees - Create new employee for authenticated Company Admin's company
router.post('/employees', requireAuth, companyController.createCompanyEmployee);

module.exports = router;


