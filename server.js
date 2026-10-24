const path = require('path');
const express = require('express');
const session = require('express-session');
const { initDatabase } = require('./src/config/database');

const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const divisionRoutes = require('./src/routes/divisionRoutes');
const trackingRoutes = require('./src/routes/trackingRoutes');
const { ROLE_LABELS, ROLE_BADGES } = require('./src/utils/workflowConfig');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy for Vercel HTTPS cookies
app.set('trust proxy', 1);

// Set View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Body Parser Middleware
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.json({ limit: '25mb' }));

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Session Middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'wip-konveksi-jersey-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // 24 jam
    }
}));

// Global Context Middleware
app.use((req, res, next) => {
    res.locals.currentUser = req.session.user || null;
    res.locals.currentPath = req.path;
    res.locals.ROLE_LABELS = ROLE_LABELS;
    res.locals.ROLE_BADGES = ROLE_BADGES;
    next();
});

// Middleware memastikan Database SQLite terinisialisasi (penting untuk Serverless cold-start)
let dbPromise = null;
app.use(async (req, res, next) => {
    try {
        if (!dbPromise) {
            dbPromise = initDatabase();
        }
        await dbPromise;
        next();
    } catch (err) {
        console.error('Fatal Database Error:', err);
        res.status(500).send(`Gagal terhubung ke database: ${err.message}`);
    }
});

// Root Route Redirection
app.get('/', (req, res) => {
    if (req.session && req.session.user) {
        if (req.session.user.role === 'admin') {
            return res.redirect('/admin/dashboard');
        } else {
            return res.redirect('/division/queue');
        }
    }
    return res.redirect('/login');
});

// Mount Routes
app.use('/', authRoutes);
app.use('/admin', adminRoutes);
app.use('/division', divisionRoutes);
app.use('/track', trackingRoutes);

// 404 Handler
app.use((req, res) => {
    res.status(404).render('tracking/public-track', {
        title: '404 - Halaman Tidak Ditemukan',
        order: null,
        searchCode: '',
        error: 'Halaman yang Anda tuju tidak ditemukan (404).'
    });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Application Error:', err);
    res.status(500).send(`Terjadi kesalahan pada server: ${err.message}`);
});

// Start Server untuk lokal development
async function startServer() {
    try {
        console.log('Menginisialisasi database SQLite...');
        await initDatabase();
        console.log('Database SQLite berhasil diinisialisasi.');

        app.listen(PORT, () => {
            console.log(`=======================================================`);
            console.log(`🚀 Aplikasi WIP Tracking Konveksi & Jersey Siap!`);
            console.log(`📍 URL Internal Dashboard : http://localhost:${PORT}`);
            console.log(`📍 URL Tracking Publik     : http://localhost:${PORT}/track/TRK-KAOS99`);
            console.log(`📍 Halaman Login Divisi    : http://localhost:${PORT}/login`);
            console.log(`=======================================================`);
        });
    } catch (err) {
        console.error('Fatal error saat inisialisasi server:', err);
        process.exit(1);
    }
}

if (!process.env.VERCEL && require.main === module) {
    startServer();
}

module.exports = app;
