const db = require('../config/database');
const { WORKFLOW_CONFIG } = require('../utils/workflowConfig');

const OrderModel = {
    getAll(filters = {}) {
        let sql = `
            SELECT o.*, 
                   s.stage_name AS active_stage_name,
                   s.assigned_role AS active_stage_role,
                   s.status AS active_stage_status,
                   s.total_active_seconds AS active_stage_seconds,
                   s.last_timer_started_at AS active_stage_timer_started,
                   u.full_name AS creator_name
            FROM orders o
            LEFT JOIN order_stages s ON o.current_stage_id = s.id
            LEFT JOIN users u ON o.created_by = u.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.status) {
            sql += ` AND o.status = ?`;
            params.push(filters.status);
        }

        if (filters.category) {
            sql += ` AND o.category = ?`;
            params.push(filters.category);
        }

        if (filters.search) {
            sql += ` AND (o.order_number LIKE ? OR o.customer_name LIKE ? OR o.article_name LIKE ? OR o.tracking_code LIKE ?)`;
            const searchParam = `%${filters.search}%`;
            params.push(searchParam, searchParam, searchParam, searchParam);
        }

        sql += ` ORDER BY o.id DESC`;
        return db.query(sql, params);
    },

    getById(id) {
        const sql = `
            SELECT o.*, 
                   s.stage_name AS active_stage_name,
                   s.assigned_role AS active_stage_role,
                   s.status AS active_stage_status,
                   u.full_name AS creator_name
            FROM orders o
            LEFT JOIN order_stages s ON o.current_stage_id = s.id
            LEFT JOIN users u ON o.created_by = u.id
            WHERE o.id = ?
        `;
        return db.get(sql, [id]);
    },

    getByTrackingCode(trackingCode) {
        const sql = `
            SELECT o.*, 
                   s.stage_name AS active_stage_name,
                   s.assigned_role AS active_stage_role,
                   s.status AS active_stage_status
            FROM orders o
            LEFT JOIN order_stages s ON o.current_stage_id = s.id
            WHERE UPPER(o.tracking_code) = UPPER(?)
        `;
        return db.get(sql, [trackingCode]);
    },

    create(data, creatorId) {
        // Generate auto nomor SPK jika tidak diinput
        const dateStr = new Date().toISOString().slice(0, 7).replace('-', ''); // e.g. 202610
        const countRow = db.get(`SELECT COUNT(*) as cnt FROM orders`);
        const nextNum = String((countRow ? countRow.cnt : 0) + 1).padStart(3, '0');
        const orderNumber = data.order_number || `SPK-${dateStr}-${nextNum}`;

        // Generate unique tracking code jika tidak diinput
        const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
        const trackingCode = data.tracking_code || `TRK-${randomHex}`;

        const totalPcs = 
            (parseInt(data.size_xs) || 0) +
            (parseInt(data.size_s) || 0) +
            (parseInt(data.size_m) || 0) +
            (parseInt(data.size_l) || 0) +
            (parseInt(data.size_xl) || 0) +
            (parseInt(data.size_2xl) || 0) +
            (parseInt(data.size_3xl) || 0);

        const category = data.category.toLowerCase(); // 'kaos' atau 'jersey'
        const workflow = WORKFLOW_CONFIG[category];
        if (!workflow || workflow.length === 0) {
            throw new Error(`Kategori ${category} tidak valid atau workflow belum didefinisikan`);
        }

        // Insert Order
        const insertOrderSql = `
            INSERT INTO orders (
                order_number, tracking_code, customer_name, customer_phone,
                article_name, category, fabric_type, print_type, notes,
                deadline_date, size_xs, size_s, size_m, size_l, size_xl,
                size_2xl, size_3xl, total_pcs, status, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WAITING', ?)
        `;

        const orderResult = db.run(insertOrderSql, [
            orderNumber,
            trackingCode,
            data.customer_name,
            data.customer_phone || '',
            data.article_name,
            category,
            data.fabric_type || '',
            data.print_type || '',
            data.notes || '',
            data.deadline_date || null,
            parseInt(data.size_xs) || 0,
            parseInt(data.size_s) || 0,
            parseInt(data.size_m) || 0,
            parseInt(data.size_l) || 0,
            parseInt(data.size_xl) || 0,
            parseInt(data.size_2xl) || 0,
            parseInt(data.size_3xl) || 0,
            totalPcs > 0 ? totalPcs : (parseInt(data.total_pcs) || 1),
            creatorId || 1
        ]);

        const orderId = orderResult.lastInsertRowid;

        // Buat tahapan (order_stages) secara berurutan sesuai alur kategori
        let firstStageId = null;
        let firstRole = null;

        workflow.forEach((step, idx) => {
            const stageOrder = idx + 1;
            const insertStageSql = `
                INSERT INTO order_stages (order_id, stage_name, stage_order, assigned_role, status)
                VALUES (?, ?, ?, ?, ?)
            `;
            const initialStatus = idx === 0 ? 'WAITING' : 'WAITING';
            const stageRes = db.run(insertStageSql, [orderId, step.name, stageOrder, step.role, initialStatus]);

            if (idx === 0) {
                firstStageId = stageRes.lastInsertRowid;
                firstRole = step.role;
            }
        });

        // Set current_stage_id dan current_role di pesanan
        db.run(
            `UPDATE orders SET current_stage_id = ?, current_role = ? WHERE id = ?`,
            [firstStageId, firstRole, orderId]
        );

        return { orderId, orderNumber, trackingCode };
    },

    update(orderId, data) {
        const totalPcs = 
            (parseInt(data.size_xs) || 0) +
            (parseInt(data.size_s) || 0) +
            (parseInt(data.size_m) || 0) +
            (parseInt(data.size_l) || 0) +
            (parseInt(data.size_xl) || 0) +
            (parseInt(data.size_2xl) || 0) +
            (parseInt(data.size_3xl) || 0);

        const sql = `
            UPDATE orders SET
                customer_name = ?,
                customer_phone = ?,
                article_name = ?,
                fabric_type = ?,
                print_type = ?,
                notes = ?,
                deadline_date = ?,
                size_xs = ?,
                size_s = ?,
                size_m = ?,
                size_l = ?,
                size_xl = ?,
                size_2xl = ?,
                size_3xl = ?,
                total_pcs = ?
            WHERE id = ?
        `;

        return db.run(sql, [
            data.customer_name,
            data.customer_phone || '',
            data.article_name,
            data.fabric_type || '',
            data.print_type || '',
            data.notes || '',
            data.deadline_date || null,
            parseInt(data.size_xs) || 0,
            parseInt(data.size_s) || 0,
            parseInt(data.size_m) || 0,
            parseInt(data.size_l) || 0,
            parseInt(data.size_xl) || 0,
            parseInt(data.size_2xl) || 0,
            parseInt(data.size_3xl) || 0,
            totalPcs > 0 ? totalPcs : (parseInt(data.total_pcs) || 1),
            orderId
        ]);
    },

    cancel(orderId, reason, userId) {
        // Tandai order CANCELLED
        db.run(`UPDATE orders SET status = 'CANCELLED' WHERE id = ?`, [orderId]);
        
        // Hentikan timer stage aktif jika sedang berjalan
        const order = db.get(`SELECT current_stage_id FROM orders WHERE id = ?`, [orderId]);
        if (order && order.current_stage_id) {
            db.run(`
                UPDATE order_stages 
                SET status = 'PAUSED', last_timer_started_at = NULL 
                WHERE id = ? AND status = 'IN_PROGRESS'
            `, [order.current_stage_id]);
        }

        // Catat ke time_logs
        db.run(`
            INSERT INTO time_logs (order_stage_id, order_id, user_id, action, notes)
            VALUES (?, ?, ?, 'CANCELLED', ?)
        `, [order && order.current_stage_id ? order.current_stage_id : 1, orderId, userId, reason || 'Dibatalkan oleh Owner']);

        return true;
    },

    getDashboardStats() {
        const totalOrders = db.get(`SELECT COUNT(*) as cnt FROM orders`);
        const waitingOrders = db.get(`SELECT COUNT(*) as cnt FROM orders WHERE status = 'WAITING'`);
        const inProgressOrders = db.get(`SELECT COUNT(*) as cnt FROM orders WHERE status = 'IN_PROGRESS'`);
        const pausedOrders = db.get(`SELECT COUNT(*) as cnt FROM orders WHERE status = 'PAUSED'`);
        const completedOrders = db.get(`SELECT COUNT(*) as cnt FROM orders WHERE status = 'COMPLETED'`);
        
        const kaosOrders = db.get(`SELECT COUNT(*) as cnt FROM orders WHERE category = 'kaos'`);
        const jerseyOrders = db.get(`SELECT COUNT(*) as cnt FROM orders WHERE category = 'jersey'`);

        // Total pcs dalam produksi
        const totalPcs = db.get(`SELECT SUM(total_pcs) as sum_pcs FROM orders WHERE status != 'COMPLETED'`);

        // Antrean per role
        const roleQueue = db.query(`
            SELECT current_role, COUNT(*) as cnt 
            FROM orders 
            WHERE status != 'COMPLETED' AND current_role IS NOT NULL 
            GROUP BY current_role
        `);

        return {
            total: totalOrders ? totalOrders.cnt : 0,
            waiting: waitingOrders ? waitingOrders.cnt : 0,
            inProgress: inProgressOrders ? inProgressOrders.cnt : 0,
            paused: pausedOrders ? pausedOrders.cnt : 0,
            completed: completedOrders ? completedOrders.cnt : 0,
            kaos: kaosOrders ? kaosOrders.cnt : 0,
            jersey: jerseyOrders ? jerseyOrders.cnt : 0,
            activePcs: totalPcs && totalPcs.sum_pcs ? totalPcs.sum_pcs : 0,
            roleQueue
        };
    }
};

module.exports = OrderModel;

