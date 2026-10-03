const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Authentication Routes
router.post('/register', authController.registerUser);
router.post('/login', authController.loginUser);
router.post('/logout', authController.logoutUser);
router.get('/me', authController.getMe);

module.exports = router;
