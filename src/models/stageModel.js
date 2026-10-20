const db = require('../config/database');

const StageModel = {
    getStagesByOrderId(orderId) {
        const sql = `
            SELECT s.*, u.full_name AS completed_by_name
            FROM order_stages s
            LEFT JOIN users u ON s.completed_by_user_id = u.id
            WHERE s.order_id = ?
            ORDER BY s.stage_order ASC
        `;
        return db.query(sql, [orderId]);
    },

    getById(stageId) {
        const sql = `
            SELECT s.*, o.order_number, o.article_name, o.customer_name, o.category, o.total_pcs, o.deadline_date
            FROM order_stages s
            JOIN orders o ON s.order_id = o.id
            WHERE s.id = ?
        `;
        return db.get(sql, [stageId]);
    },

    /**
     * Mengambil daftar antrean order untuk role tertentu
     * PIC divisi hanya melihat order yang berada pada tahapannya
     */
    getQueueForRole(role) {
        let sql = `
            SELECT s.*, 
                   o.id AS order_id,
                   o.order_number,
                   o.tracking_code,
                   o.customer_name,
                   o.customer_phone,
                   o.article_name,
                   o.category,
                   o.fabric_type,
                   o.print_type,
                   o.notes,
                   o.deadline_date,
                   o.total_pcs,
                   o.status AS order_status,
                   o.size_xs, o.size_s, o.size_m, o.size_l, o.size_xl, o.size_2xl, o.size_3xl
            FROM order_stages s
            JOIN orders o ON s.order_id = o.id
            WHERE s.assigned_role = ?
              AND o.current_stage_id = s.id
              AND o.status != 'COMPLETED'
            ORDER BY 
                CASE 
                    WHEN s.status = 'IN_PROGRESS' THEN 1
                    WHEN s.status = 'PAUSED' THEN 2
                    WHEN s.status = 'WAITING' THEN 3
                    ELSE 4
                END,
                o.deadline_date ASC,
                o.id ASC
        `;
        return db.query(sql, [role]);
    },

    /**
     * Mengambil riwayat order yang pernah diselesaikan oleh role ini
     */
    getCompletedHistoryForRole(role, limit = 20) {
        let sql = `
            SELECT s.*, 
                   o.id AS order_id,
                   o.order_number,
                   o.tracking_code,
                   o.customer_name,
                   o.article_name,
                   o.category,
                   o.total_pcs,
                   o.deadline_date,
                   o.status AS order_status,
                   u.full_name AS completed_by_name
            FROM order_stages s
            JOIN orders o ON s.order_id = o.id
            LEFT JOIN users u ON s.completed_by_user_id = u.id
            WHERE s.assigned_role = ?
              AND s.status = 'COMPLETED'
            ORDER BY s.completed_at DESC
            LIMIT ?
        `;
        return db.query(sql, [role, limit]);
    },

    /**
     * AKSI: MULAI (START)
     */
    startStage(stageId, userId) {
        const stage = db.get('SELECT * FROM order_stages WHERE id = ?', [stageId]);
        if (!stage) throw new Error('Stage tidak ditemukan');

        const now = new Date().toISOString();
        const startedAt = stage.started_at ? stage.started_at : now;

        // Update stage status
        db.run(`
            UPDATE order_stages 
            SET status = 'IN_PROGRESS',
                started_at = ?,
                last_timer_started_at = ?
            WHERE id = ?
        `, [startedAt, now, stageId]);

        // Update order status
        db.run(`UPDATE orders SET status = 'IN_PROGRESS' WHERE id = ?`, [stage.order_id]);

        // Log ke time_logs
        db.run(`
            INSERT INTO time_logs (order_stage_id, order_id, user_id, action, duration_seconds, timestamp)
            VALUES (?, ?, ?, 'START', 0, ?)
        `, [stageId, stage.order_id, userId, now]);

        return { success: true, status: 'IN_PROGRESS' };
    },

    /**
     * AKSI: JEDA (PAUSE) - Hitung durasi aktif bersih, hentikan timer
     */
    pauseStage(stageId, userId) {
        const stage = db.get('SELECT * FROM order_stages WHERE id = ?', [stageId]);
        if (!stage) throw new Error('Stage tidak ditemukan');
        if (stage.status !== 'IN_PROGRESS') throw new Error('Stage tidak sedang berjalan');

        const now = new Date();
        const nowIso = now.toISOString();
        let elapsed = 0;

        if (stage.last_timer_started_at) {
            const startTime = new Date(stage.last_timer_started_at).getTime();
            elapsed = Math.max(0, Math.floor((now.getTime() - startTime) / 1000));
        }

        const newTotalActive = (stage.total_active_seconds || 0) + elapsed;

        // Update stage: status PAUSED, tambahkan elapsed, kosongkan last_timer_started_at
        db.run(`
            UPDATE order_stages 
            SET status = 'PAUSED',
                total_active_seconds = ?,
                last_timer_started_at = NULL
            WHERE id = ?
        `, [newTotalActive, stageId]);

        // Update status order
        db.run(`UPDATE orders SET status = 'PAUSED' WHERE id = ?`, [stage.order_id]);

        // Log ke time_logs
        db.run(`
            INSERT INTO time_logs (order_stage_id, order_id, user_id, action, duration_seconds, timestamp)
            VALUES (?, ?, ?, 'PAUSE', ?, ?)
        `, [stageId, stage.order_id, userId, elapsed, nowIso]);

        return { success: true, status: 'PAUSED', addedSeconds: elapsed, totalActive: newTotalActive };
    },

    /**
     * AKSI: LANJUTKAN (RESUME) dari status jeda
     */
    resumeStage(stageId, userId) {
        const stage = db.get('SELECT * FROM order_stages WHERE id = ?', [stageId]);
        if (!stage) throw new Error('Stage tidak ditemukan');

        const now = new Date().toISOString();

        db.run(`
            UPDATE order_stages 
            SET status = 'IN_PROGRESS',
                last_timer_started_at = ?
            WHERE id = ?
        `, [now, stageId]);

        db.run(`UPDATE orders SET status = 'IN_PROGRESS' WHERE id = ?`, [stage.order_id]);

        db.run(`
            INSERT INTO time_logs (order_stage_id, order_id, user_id, action, duration_seconds, timestamp)
            VALUES (?, ?, ?, 'RESUME', 0, ?)
        `, [stageId, stage.order_id, userId, now]);

        return { success: true, status: 'IN_PROGRESS' };
    },

    /**
     * AKSI: SELESAI (COMPLETE) - Otomatis lempar ke antrean divisi berikutnya
     */
    completeStage(stageId, userId) {
        const stage = db.get('SELECT * FROM order_stages WHERE id = ?', [stageId]);
        if (!stage) throw new Error('Stage tidak ditemukan');

        const now = new Date();
        const nowIso = now.toISOString();
        let elapsed = 0;

        if (stage.status === 'IN_PROGRESS' && stage.last_timer_started_at) {
            const startTime = new Date(stage.last_timer_started_at).getTime();
            elapsed = Math.max(0, Math.floor((now.getTime() - startTime) / 1000));
        }

        const finalTotalActive = (stage.total_active_seconds || 0) + elapsed;

        // Tandai stage ini COMPLETED
        db.run(`
            UPDATE order_stages 
            SET status = 'COMPLETED',
                total_active_seconds = ?,
                last_timer_started_at = NULL,
                completed_at = ?,
                completed_by_user_id = ?
            WHERE id = ?
        `, [finalTotalActive, nowIso, userId, stageId]);

        // Catat log
        db.run(`
            INSERT INTO time_logs (order_stage_id, order_id, user_id, action, duration_seconds, timestamp)
            VALUES (?, ?, ?, 'COMPLETE', ?, ?)
        `, [stageId, stage.order_id, userId, elapsed, nowIso]);

        // Cari tahap berikutnya (stage_order = current + 1)
        const nextStage = db.get(`
            SELECT * FROM order_stages 
            WHERE order_id = ? AND stage_order = ?
        `, [stage.order_id, stage.stage_order + 1]);

        if (nextStage) {
            // Pindahkan order ke antrean divisi berikutnya
            db.run(`
                UPDATE orders 
                SET current_stage_id = ?,
                    current_role = ?,
                    status = 'WAITING'
                WHERE id = ?
            `, [nextStage.id, nextStage.assigned_role, stage.order_id]);

            return {
                success: true,
                isFinalStage: false,
                nextStage: {
                    id: nextStage.id,
                    name: nextStage.stage_name,
                    role: nextStage.assigned_role
                }
            };
        } else {
            // Tahapan terakhir selesai (Order Beres Semua!)
            db.run(`
                UPDATE orders 
                SET current_role = NULL,
                    status = 'COMPLETED',
                    completed_at = ?
                WHERE id = ?
            `, [nowIso, stage.order_id]);

            return {
                success: true,
                isFinalStage: true,
                message: 'Pesanan telah selesai seluruh tahapan produksi!'
            };
        }
    }
};

module.exports = StageModel;

