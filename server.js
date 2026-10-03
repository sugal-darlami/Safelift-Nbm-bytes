require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const trainingRoutes = require('./routes/trainingRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// JSON & URL-encoded Body Parsing Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express Session Middleware (Stage 3.2)
app.use(session({
    secret: process.env.SESSION_SECRET || 'safelift360_default_session_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // http in local development
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// General Server Health Check API Endpoint (Stage 2.2)
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'SafeLift 360 API'
    });
});

// MySQL Database Health Check API Endpoint (Stage 2.3)
app.get('/api/db-health', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT 1 AS result');
        if (rows && rows.length > 0) {
            return res.status(200).json({
                status: 'ok',
                database: 'connected'
            });
        }
        throw new Error('Database query returned empty result.');
    } catch (err) {
        console.error('Database Health Check Error:', err.message);
        return res.status(500).json({
            status: 'error',
            database: 'disconnected',
            message: err.message
        });
    }
});

// Authentication Routes (Stage 3.1 & 3.2)
app.use('/api/auth', authRoutes);

// Training Results Routes (Stage 4.1 & 4.2)
app.use('/api/training', trainingRoutes);

// Admin Oversight Routes (Stage 4.3)
app.use('/api/admin', adminRoutes);

// Certificate Data & Eligibility Routes (Stage 5.1)
const certificateRoutes = require('./routes/certificateRoutes');
app.use('/api/certificates', certificateRoutes);

// Company Registration Routes (Stage 6.2)
const companyRoutes = require('./routes/companyRoutes');
app.use('/api/company', companyRoutes);

// Super Admin Management Routes (Stage 6.3)
const superAdminRoutes = require('./routes/superAdminRoutes');
app.use('/api/super-admin', superAdminRoutes);

// Initialize DB schema automatically
const { initDatabaseSchema } = require('./config/dbInit');
initDatabaseSchema();

// Route to serve 360° training simulation directly
app.get('/training', (req, res) => {
    res.sendFile(path.join(__dirname, 'training.html'));
});

// Serve existing SafeLift 360 static frontend files from current directory
app.use(express.static(__dirname));

// Fallback 404 Handler for missing resources
app.use((req, res) => {
    res.status(404).send('404 Not Found - SafeLift 360 Resource does not exist.');
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// Start Node.js + Express Server
app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 SafeLift 360 Express Server is running!`);
    console.log(`🌐 Server URL: http://localhost:${PORT}`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`🗄️ DB Health Check: http://localhost:${PORT}/api/db-health`);
    console.log(`==================================================`);
});
