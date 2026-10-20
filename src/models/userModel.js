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
    }
};

module.exports = UserModel;

