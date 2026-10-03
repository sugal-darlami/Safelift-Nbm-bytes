/**
 * Authentication & Authorization Middleware for SafeLift 360
 */

// Middleware to ensure user is authenticated
function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required. Please log in.'
        });
    }
    next();
}

// Middleware to ensure authenticated user has 'admin' role
function requireAdmin(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required. Please log in.'
        });
    }

    if (req.session.user.role !== 'admin' && req.session.user.role !== 'super_admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Administrator privileges required.'
        });
    }

    next();
}

// Middleware to ensure authenticated user has 'super_admin' role
function requireSuperAdmin(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required. Please log in.'
        });
    }

    if (req.session.user.role !== 'super_admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Super Administrator privileges required.'
        });
    }

    next();
}

module.exports = {
    requireAuth,
    requireAdmin,
    requireSuperAdmin
};
