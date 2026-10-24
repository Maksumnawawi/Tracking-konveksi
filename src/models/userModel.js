const db = require('../config/database');

const UserModel = {
    findByUsername(username) {
        return db.get('SELECT * FROM users WHERE username = ?', [username]);
    },

    findById(id) {
        return db.get('SELECT id, username, full_name, role, division_name, phone, created_at FROM users WHERE id = ?', [id]);
    },

    getAll() {
        return db.query('SELECT id, username, full_name, role, division_name, phone FROM users ORDER BY id ASC');
    },

    getByRole(role) {
        return db.query('SELECT id, username, full_name, role, division_name FROM users WHERE role = ?', [role]);
    },

    updatePassword(id, passwordHash) {
        db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
        db.saveDatabase();
        return true;
    },

    updateFullName(id, fullName) {
        db.run('UPDATE users SET full_name = ? WHERE id = ?', [fullName, id]);
        db.saveDatabase();
        return true;
    },

    updateUser(id, data) {
        const fields = [];
        const params = [];
        if (data.full_name !== undefined) {
            fields.push('full_name = ?');
            params.push(data.full_name);
        }
        if (data.password_hash !== undefined) {
            fields.push('password_hash = ?');
            params.push(data.password_hash);
        }
        if (data.phone !== undefined) {
            fields.push('phone = ?');
            params.push(data.phone);
        }
        if (fields.length === 0) return false;
        params.push(id);
        db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
        db.saveDatabase();
        return true;
    }
};

module.exports = UserModel;

