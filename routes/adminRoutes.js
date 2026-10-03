const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/authMiddleware');

// All admin routes require authenticated session with role = 'admin'
router.use(requireAdmin);

// GET /api/admin/users - List all registered users
router.get('/users', adminController.getAdminUsers);

// GET /api/admin/results - List training results across all users
router.get('/results', adminController.getAdminResults);

// GET /api/admin/stats - Calculate company-wide training statistics
router.get('/stats', adminController.getAdminStats);

// GET /api/admin/users/:userId/results - View specific employee training history
router.get('/users/:userId/results', adminController.getEmployeeHistory);

module.exports = router;
