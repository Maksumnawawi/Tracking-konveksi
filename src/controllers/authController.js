const bcrypt = require('bcryptjs');
const UserModel = require('../models/userModel');

const AuthController = {
    showLogin(req, res) {
        if (req.session && req.session.user) {
            if (req.session.user.role === 'admin') {
                return res.redirect('/admin/dashboard');
            } else {
                return res.redirect('/division/queue');
            }
        }

        const users = UserModel.getAll();
        res.render('auth/login', {
            title: 'Masuk Sistem - WIP Konveksi & Jersey',
            users,
            error: null,
            success: null
        });
    },

    // Login Form dengan Verifikasi Password (Untuk Semua Akun Termasuk Owner)
    login(req, res) {
        const { username, password } = req.body;
        const users = UserModel.getAll();

        if (!username || !password) {
            return res.render('auth/login', {
                title: 'Masuk Sistem',
                users,
                error: 'Pilih akun dan masukkan kata sandi!',
                success: null
            });
        }

        const user = UserModel.findByUsername(username.trim());
        if (!user) {
            return res.render('auth/login', {
                title: 'Masuk Sistem',
                users,
                error: 'Akun tidak ditemukan!',
                success: null
            });
        }

        const match = bcrypt.compareSync(password, user.password_hash);
        if (!match) {
            return res.render('auth/login', {
                title: 'Masuk Sistem',
                users,
                error: `Kata sandi salah untuk akun ${user.division_name}!`,
                success: null
            });
        }

        req.session.user = {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role: user.role,
            division_name: user.division_name
        };

        const returnUrl = req.session.returnUrl;
        delete req.session.returnUrl;

        if (returnUrl) {
            return res.redirect(returnUrl);
        }

        if (user.role === 'admin') {
            return res.redirect('/admin/dashboard');
        } else {
            return res.redirect('/division/queue');
        }
    },

    logout(req, res) {
        req.session.destroy(() => {
            res.redirect('/login');
        });
    }
};

module.exports = AuthController;
