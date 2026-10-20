const { ROLE_LABELS, ROLE_BADGES } = require('../utils/workflowConfig');

function isAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        res.locals.currentUser = req.session.user;
        res.locals.ROLE_LABELS = ROLE_LABELS;
        res.locals.ROLE_BADGES = ROLE_BADGES;
        return next();
    }
    
    // Simpan returnUrl jika GET
    if (req.method === 'GET' && req.originalUrl !== '/logout') {
        req.session.returnUrl = req.originalUrl;
    }
    return res.redirect('/login');
}

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.redirect('/login');
        }

        const userRole = req.session.user.role;

        // Admin selalu punya hak akses ke semua halaman jika diperlukan
        if (userRole === 'admin' || allowedRoles.includes(userRole)) {
            return next();
        }

        return res.status(403).render('auth/login', {
            title: 'Akses Ditolak',
            error: `Divisi Anda (${ROLE_LABELS[userRole] || userRole}) tidak memiliki izin mengakses halaman tersebut.`,
            users: []
        });
    };
}

module.exports = {
    isAuthenticated,
    requireRole
};

