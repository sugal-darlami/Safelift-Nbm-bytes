const express = require('express');
const router = express.Router();
const trainingController = require('../controllers/trainingController');

// POST /api/training/results - Save completed training session
router.post('/results', trainingController.saveTrainingResult);

// GET /api/training/results - Retrieve authenticated user's training history
router.get('/results', trainingController.getTrainingResults);

module.exports = router;
