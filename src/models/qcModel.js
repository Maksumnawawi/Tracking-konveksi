const db = require('../config/database');

const QcModel = {
    saveResult(data) {
        const total = parseInt(data.total_checked) || (parseInt(data.pcs_passed) + parseInt(data.pcs_reject)) || 1;
        const passed = parseInt(data.pcs_passed) || 0;
        const reject = parseInt(data.pcs_reject) || 0;
        const percentage = Number(((passed / total) * 100).toFixed(2));

        const sql = `
            INSERT INTO qc_results (
                order_id, order_stage_id, inspector_user_id,
                total_checked, pcs_passed, pcs_reject,
                pass_percentage, reject_reason, rework_notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(order_id) DO UPDATE SET
                order_stage_id = excluded.order_stage_id,
                inspector_user_id = excluded.inspector_user_id,
                total_checked = excluded.total_checked,
                pcs_passed = excluded.pcs_passed,
                pcs_reject = excluded.pcs_reject,
                pass_percentage = excluded.pass_percentage,
                reject_reason = excluded.reject_reason,
                rework_notes = excluded.rework_notes,
                created_at = CURRENT_TIMESTAMP
        `;

        return db.run(sql, [
            data.order_id,
            data.order_stage_id,
            data.inspector_user_id,
            total,
            passed,
            reject,
            percentage,
            data.reject_reason || '',
            data.rework_notes || ''
        ]);
    },

    getByOrderId(orderId) {
        const sql = `
            SELECT q.*, u.full_name AS inspector_name, u.role AS inspector_role
            FROM qc_results q
            JOIN users u ON q.inspector_user_id = u.id
            WHERE q.order_id = ?
        `;
        return db.get(sql, [orderId]);
    },

    getOverallStats() {
        const sql = `
            SELECT 
                COUNT(*) as total_inspections,
                SUM(total_checked) as sum_checked,
                SUM(pcs_passed) as sum_passed,
                SUM(pcs_reject) as sum_reject,
                AVG(pass_percentage) as avg_pass_rate
            FROM qc_results
        `;
        return db.get(sql);
    }
};

module.exports = QcModel;

