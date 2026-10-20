const db = require('../config/database');

const TimeLogModel = {
    getByOrderId(orderId) {
        const sql = `
            SELECT t.*, u.full_name AS user_name, u.role AS user_role, s.stage_name
            FROM time_logs t
            JOIN users u ON t.user_id = u.id
            JOIN order_stages s ON t.order_stage_id = s.id
            WHERE t.order_id = ?
            ORDER BY t.id ASC
        `;
        return db.query(sql, [orderId]);
    },

    getByStageId(stageId) {
        const sql = `
            SELECT t.*, u.full_name AS user_name, u.role AS user_role
            FROM time_logs t
            JOIN users u ON t.user_id = u.id
            WHERE t.order_stage_id = ?
            ORDER BY t.id ASC
        `;
        return db.query(sql, [stageId]);
    }
};

module.exports = TimeLogModel;

