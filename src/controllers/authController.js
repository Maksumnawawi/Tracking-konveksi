const bcrypt = require('bcryptjs');
const UserModel = require('../models/userModel');
const { ROLE_LABELS, ROLE_BADGES } = require('../utils/workflowConfig');

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

        // Verifikasi kata sandi via hash atau default sementara (admin123 / 123456 / password123)
        const match = bcrypt.compareSync(password, user.password_hash) ||
            (user.username === 'admin' && (password === 'admin123' || password === 'password123')) ||
            (user.username !== 'admin' && (password === '123456' || password === 'password123'));

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
    },

    // Ganti Kata Sandi untuk Akun Sendiri atau oleh Admin
    changePassword(req, res) {
        try {
            if (!req.session || !req.session.user) {
                return res.status(401).json({ success: false, message: 'Harap masuk ke sistem terlebih dahulu.' });
            }

            const currentUserId = req.session.user.id;
            const currentUserRole = req.session.user.role;
            const { target_user_id, new_password, confirm_password } = req.body;

            if (!new_password || new_password.trim().length < 4) {
                return res.status(400).json({ success: false, message: 'Kata sandi baru minimal 4 karakter.' });
            }

            if (confirm_password && new_password !== confirm_password) {
                return res.status(400).json({ success: false, message: 'Konfirmasi kata sandi tidak cocok.' });
            }

            let userIdToUpdate = currentUserId;
            if (target_user_id && currentUserRole === 'admin') {
                userIdToUpdate = parseInt(target_user_id);
            }

            const hash = bcrypt.hashSync(new_password.trim(), 10);
            UserModel.updatePassword(userIdToUpdate, hash);

            return res.json({ 
                success: true, 
                message: 'Kata sandi berhasil diperbarui!' 
            });
        } catch (err) {
            console.error('Error changePassword:', err);
            return res.status(500).json({ success: false, message: 'Gagal memperbarui sandi: ' + err.message });
        }
    },

    // Halaman Penuh Kelola Tim & Kepala Divisi Khusus Admin
    showUsersPage(req, res) {
        try {
            if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
                return res.redirect('/admin/dashboard');
            }
            const users = UserModel.getAll();
            return res.render('admin/users', {
                title: 'Kelola Tim & Kepala Divisi',
                users,
                currentUser: req.session.user,
                currentPath: '/admin/users',
                successMsg: req.query.msg || null,
                errorMsg: req.query.err || null,
                ROLE_LABELS,
                ROLE_BADGES
            });
        } catch (err) {
            console.error('Error showUsersPage:', err);
            return res.redirect('/admin/dashboard');
        }
    },

    // Admin API: Ambil semua user untuk modal tim
    getUsersApi(req, res) {
        try {
            if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Hanya Admin yang berwenang.' });
            }
            const users = UserModel.getAll();
            return res.json({ success: true, users });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    },

    // Admin: Update Nama Kepala, Nama Divisi, Kontak & Kata Sandi Divisi
    adminUpdateUser(req, res) {
        try {
            const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
            if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
                if (isJson) return res.status(403).json({ success: false, message: 'Hanya Admin yang berwenang.' });
                return res.redirect('/login');
            }

            const { user_id, full_name, division_name, phone, new_password } = req.body;
            if (!user_id) {
                if (isJson) return res.status(400).json({ success: false, message: 'ID pengguna tidak valid.' });
                return res.redirect('/admin/users?err=' + encodeURIComponent('ID pengguna tidak valid.'));
            }

            const dataToUpdate = {};
            if (full_name !== undefined) {
                dataToUpdate.full_name = full_name.trim();
            }
            if (division_name !== undefined) {
                dataToUpdate.division_name = division_name.trim();
            }
            if (phone !== undefined) {
                dataToUpdate.phone = phone.trim();
            }
            if (new_password && new_password.trim().length >= 4) {
                dataToUpdate.password_hash = bcrypt.hashSync(new_password.trim(), 10);
            }

            UserModel.updateUser(parseInt(user_id), dataToUpdate);

            // Jika admin mengedit akunnya sendiri, update session
            if (req.session.user.id === parseInt(user_id)) {
                if (dataToUpdate.full_name) req.session.user.full_name = dataToUpdate.full_name;
                if (dataToUpdate.division_name) req.session.user.division_name = dataToUpdate.division_name;
            }

            const labelName = dataToUpdate.full_name || dataToUpdate.division_name || 'Akun';
            if (isJson) {
                return res.json({ success: true, message: `Data ${labelName} berhasil disimpan!` });
            }
            return res.redirect('/admin/users?msg=' + encodeURIComponent(`Perubahan data untuk ${labelName} berhasil disimpan!`));
        } catch (err) {
            console.error('Error adminUpdateUser:', err);
            const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
            if (isJson) {
                return res.status(500).json({ success: false, message: 'Gagal update user: ' + err.message });
            }
            return res.redirect('/admin/users?err=' + encodeURIComponent('Gagal update: ' + err.message));
        }
    }
};

module.exports = AuthController;
