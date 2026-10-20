const db = require('../config/database');

const NotificationModel = {
    create(data) {
        const sql = `
            INSERT INTO order_notifications (
                order_id, target_role, type, title, message,
                old_value, new_value, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        return db.run(sql, [
            data.order_id,
            data.target_role || 'all',
            data.type || 'REVISION',
            data.title,
            data.message,
            data.old_value || null,
            data.new_value || null,
            data.created_by || 1
        ]);
    },

    getByRole(role, unreadOnly = false) {
        let sql = `
            SELECT n.*, o.order_number, o.article_name, o.customer_name, u.full_name as author_name
            FROM order_notifications n
            JOIN orders o ON n.order_id = o.id
            LEFT JOIN users u ON n.created_by = u.id
            WHERE (n.target_role = ? OR n.target_role = 'all')
        `;
        const params = [role];

        if (unreadOnly) {
            sql += ` AND n.is_read = 0`;
        }

        sql += ` ORDER BY n.id DESC LIMIT 20`;
        return db.query(sql, params);
    },

    getByOrderId(orderId) {
        const sql = `
            SELECT n.*, u.full_name as author_name
            FROM order_notifications n
            LEFT JOIN users u ON n.created_by = u.id
            WHERE n.order_id = ?
            ORDER BY n.id DESC
        `;
        return db.query(sql, [orderId]);
    },

    getRecent(limit = 15) {
        const sql = `
            SELECT n.*, o.order_number, o.article_name, o.customer_name, u.full_name as author_name
            FROM order_notifications n
            JOIN orders o ON n.order_id = o.id
            LEFT JOIN users u ON n.created_by = u.id
            ORDER BY n.id DESC
            LIMIT ?
        `;
        return db.query(sql, [limit]);
    },

    markAsRead(id) {
        return db.run(`UPDATE order_notifications SET is_read = 1 WHERE id = ?`, [id]);
    },

    markAllAsReadForRole(role) {
        return db.run(`UPDATE order_notifications SET is_read = 1 WHERE (target_role = ? OR target_role = 'all')`, [role]);
    }
};

module.exports = NotificationModel;

