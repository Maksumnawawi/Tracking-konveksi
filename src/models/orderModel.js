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

    getNextPoNumber(targetDate = null) {
        // Format tanggal 'YYYY-MM-DD' sesuai zona waktu Indonesia (Asia/Jakarta)
        let todayStr;
        try {
            todayStr = targetDate || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
        } catch(e) {
            todayStr = targetDate || new Date().toISOString().slice(0, 10);
        }

        // Ambil prefix bulan 'YYYY-MM' (reset nomor urut PO ke 1 setiap bulan baru)
        const monthStr = todayStr.slice(0, 7);

        // Cari nomor PO terbesar khusus untuk bulan ini
        const row = db.get(`
            SELECT MAX(CAST(po_number AS INTEGER)) as max_po 
            FROM orders 
            WHERE substr(tgl_masuk, 1, 7) = ? 
               OR substr(created_at, 1, 7) = ?
        `, [monthStr, monthStr]);

        if (!row || !row.max_po || isNaN(row.max_po)) {
            return 1;
        }
        return parseInt(row.max_po) + 1;
    },

    create(data, creatorId) {
        let todayStr;
        try {
            todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
        } catch(e) {
            todayStr = new Date().toISOString().slice(0, 10);
        }

        const tglMasuk = data.tgl_masuk || todayStr;

        // Generate auto nomor SPK jika tidak diinput
        const dateStr = tglMasuk.replace(/-/g, '').slice(0, 6); // e.g. 202610
        const countRow = db.get(`SELECT COUNT(*) as cnt FROM orders`);
        const nextNum = String((countRow ? countRow.cnt : 0) + 1).padStart(3, '0');
        const orderNumber = data.order_number || `SPK-${dateStr}-${nextNum}`;

        // Generate unique tracking code jika tidak diinput
        const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
        const trackingCode = data.tracking_code || `TRK-${randomHex}`;

        // Nomor PO otomatis berurutan harian (reset ke 1 setiap hari baru) atau sesuai input admin
        let poNumber = parseInt(data.po_number);
        if (isNaN(poNumber) || poNumber < 1) {
            poNumber = this.getNextPoNumber(tglMasuk);
        }

        const totalPcs = 
            (parseInt(data.size_xs) || 0) +
            (parseInt(data.size_s) || 0) +
            (parseInt(data.size_m) || 0) +
            (parseInt(data.size_l) || 0) +
            (parseInt(data.size_xl) || 0) +
            (parseInt(data.size_2xl) || 0) +
            (parseInt(data.size_3xl) || 0) +
            (parseInt(data.size_4xl) || 0) +
            (parseInt(data.size_5xl) || 0);

        const category = (data.category || 'kaos').toLowerCase(); // 'kaos' atau 'jersey'
        const workflow = WORKFLOW_CONFIG[category] || WORKFLOW_CONFIG['kaos'];

        const tglJadi = data.tgl_jadi || data.deadline_date || '';
        const tintaType = data.tinta_type || data.print_type || 'PLASTISOL';
        const finishingType = data.finishing_type || 'PRES DOFT';
        const warnaKaos = data.warna_kaos || 'HITAM, PUTIH';
        const shippingCourier = data.shipping_courier || 'TUNAI';

        let warnaSablonDepan = data.warna_sablon_depan || '';
        if (Array.isArray(warnaSablonDepan)) warnaSablonDepan = warnaSablonDepan.join(',');
        let warnaSablonBelakang = data.warna_sablon_belakang || '';
        if (Array.isArray(warnaSablonBelakang)) warnaSablonBelakang = warnaSablonBelakang.join(',');

        // Insert Order
        const insertOrderSql = `
            INSERT INTO orders (
                order_number, tracking_code, customer_name, customer_phone,
                article_name, category, fabric_type, print_type, notes,
                deadline_date, size_xs, size_s, size_m, size_l, size_xl,
                size_2xl, size_3xl, size_4xl, size_5xl, total_pcs, status, created_by,
                po_number, tgl_masuk, tgl_jadi, tinta_type, finishing_type, warna_kaos,
                warna_sablon_depan, warna_sablon_belakang, shipping_courier,
                mockup_front_url, mockup_back_url, free_qty, customer_address,
                items_breakdown_json, price_matrix_json, total_price, down_payment, remaining_payment,
                nota_number, nota_month, nota_notes, collar_type, collar_notes, category_notes, variant_notes
            ) VALUES (
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, 'WAITING', ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?
            )
        `;

        const orderResult = db.run(insertOrderSql, [
            orderNumber,
            trackingCode,
            data.customer_name,
            data.customer_phone || '',
            data.article_name,
            category,
            data.fabric_type || '',
            data.print_type || tintaType,
            data.notes || '',
            tglJadi || null,
            parseInt(data.size_xs) || 0,
            parseInt(data.size_s) || 0,
            parseInt(data.size_m) || 0,
            parseInt(data.size_l) || 0,
            parseInt(data.size_xl) || 0,
            parseInt(data.size_2xl) || 0,
            parseInt(data.size_3xl) || 0,
            parseInt(data.size_4xl) || 0,
            parseInt(data.size_5xl) || 0,
            totalPcs > 0 ? totalPcs : (parseInt(data.total_pcs) || 1),
            creatorId || 1,
            poNumber,
            tglMasuk,
            tglJadi,
            tintaType,
            finishingType,
            warnaKaos,
            warnaSablonDepan,
            warnaSablonBelakang,
            shippingCourier,
            data.mockup_front_url || '',
            data.mockup_back_url || '',
            parseInt(data.free_qty) || 0,
            data.customer_address || '',
            data.items_breakdown_json || '[]',
            data.price_matrix_json || '{}',
            parseInt(data.total_price) || 0,
            parseInt(data.down_payment) || 0,
            parseInt(data.remaining_payment) || 0,
            data.nota_number || String(poNumber),
            data.nota_month || new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
            data.nota_notes || '',
            data.collar_type || '',
            data.collar_notes || '',
            data.category_notes || '',
            data.variant_notes || ''
        ]);

        const orderId = orderResult.lastInsertRowid;

        const nowIso = new Date().toISOString();

        // Pilihan divisi aktif (Opsi A: Alur Fleksibel)
        const rawActiveDivs = data['active_divisions[]'] || data.active_divisions;
        const activeDivs = Array.isArray(rawActiveDivs) 
            ? rawActiveDivs 
            : (rawActiveDivs ? [rawActiveDivs] : null);

        const activeWorkflow = (activeDivs && activeDivs.length > 0)
            ? workflow.filter(st => activeDivs.includes(st.role))
            : workflow;

        let firstStageId = null;
        let firstRole = null;

        activeWorkflow.forEach((step, idx) => {
            const stageOrder = idx + 1;
            const insertStageSql = `
                INSERT INTO order_stages (
                    order_id, stage_name, stage_order, assigned_role, 
                    status
                ) VALUES (?, ?, ?, ?, 'WAITING')
            `;
            const stageRes = db.run(insertStageSql, [
                orderId, step.name, stageOrder, step.role
            ]);

            if (idx === 0) {
                firstStageId = stageRes.lastInsertRowid;
                firstRole = step.role;
            }
        });

        // Semua divisi mulai dari WAITING (bebas scan kapan saja oleh tim terkait)
        db.run(
            `UPDATE orders SET current_stage_id = ?, current_role = ?, status = 'WAITING' WHERE id = ?`,
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
            (parseInt(data.size_3xl) || 0) +
            (parseInt(data.size_4xl) || 0) +
            (parseInt(data.size_5xl) || 0);

        const sql = `
            UPDATE orders SET
                po_number = COALESCE(NULLIF(?, 0), po_number),
                customer_name = ?,
                customer_phone = ?,
                customer_address = COALESCE(?, customer_address),
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
                size_4xl = ?,
                size_5xl = ?,
                items_breakdown_json = COALESCE(NULLIF(?, ''), items_breakdown_json),
                total_pcs = ?,
                collar_type = COALESCE(?, collar_type),
                collar_notes = COALESCE(?, collar_notes),
                category_notes = COALESCE(?, category_notes),
                variant_notes = COALESCE(?, variant_notes)
            WHERE id = ?
        `;

        return db.run(sql, [
            parseInt(data.po_number) || 0,
            data.customer_name,
            data.customer_phone || '',
            data.customer_address || '',
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
            parseInt(data.size_4xl) || 0,
            parseInt(data.size_5xl) || 0,
            data.items_breakdown_json || '',
            totalPcs > 0 ? totalPcs : (parseInt(data.total_pcs) || 1),
            data.collar_type || '',
            data.collar_notes || '',
            data.category_notes || '',
            data.variant_notes || '',
            orderId
        ]);
    },

    updateNota(orderId, data) {
        const sql = `
            UPDATE orders SET
                customer_address = ?,
                nota_number = ?,
                nota_month = ?,
                items_breakdown_json = ?,
                price_matrix_json = ?,
                total_price = ?,
                down_payment = ?,
                remaining_payment = ?,
                free_qty = ?,
                nota_notes = ?,
                total_pcs = COALESCE(NULLIF(?, 0), total_pcs),
                size_xs = COALESCE(?, size_xs),
                size_s = COALESCE(?, size_s),
                size_m = COALESCE(?, size_m),
                size_l = COALESCE(?, size_l),
                size_xl = COALESCE(?, size_xl),
                size_2xl = COALESCE(?, size_2xl),
                size_3xl = COALESCE(?, size_3xl),
                size_4xl = COALESCE(?, size_4xl),
                size_5xl = COALESCE(?, size_5xl)
            WHERE id = ?
        `;
        return db.run(sql, [
            data.customer_address || '',
            data.nota_number || '',
            data.nota_month || '',
            data.items_breakdown_json || '[]',
            data.price_matrix_json || '{}',
            parseInt(data.total_price) || 0,
            parseInt(data.down_payment) || 0,
            parseInt(data.remaining_payment) || 0,
            parseInt(data.free_qty) || 0,
            data.nota_notes || '',
            parseInt(data.total_pcs) || 0,
            parseInt(data.size_xs) || 0,
            parseInt(data.size_s) || 0,
            parseInt(data.size_m) || 0,
            parseInt(data.size_l) || 0,
            parseInt(data.size_xl) || 0,
            parseInt(data.size_2xl) || 0,
            parseInt(data.size_3xl) || 0,
            parseInt(data.size_4xl) || 0,
            parseInt(data.size_5xl) || 0,
            orderId
        ]);
    },

    updatePOK(orderId, data) {
        let warnaSablonDepan = data.warna_sablon_depan || '';
        if (Array.isArray(warnaSablonDepan)) warnaSablonDepan = warnaSablonDepan.join(',');
        let warnaSablonBelakang = data.warna_sablon_belakang || '';
        if (Array.isArray(warnaSablonBelakang)) warnaSablonBelakang = warnaSablonBelakang.join(',');

        const sql = `
            UPDATE orders SET
                po_number = ?,
                tgl_masuk = ?,
                tgl_jadi = ?,
                tinta_type = ?,
                finishing_type = ?,
                warna_kaos = ?,
                warna_sablon_depan = ?,
                warna_sablon_belakang = ?,
                shipping_courier = ?,
                mockup_front_url = COALESCE(NULLIF(?, ''), mockup_front_url),
                mockup_back_url = COALESCE(NULLIF(?, ''), mockup_back_url)
            WHERE id = ?
        `;
        return db.run(sql, [
            parseInt(data.po_number) || 1,
            data.tgl_masuk || '',
            data.tgl_jadi || '',
            data.tinta_type || '',
            data.finishing_type || '',
            data.warna_kaos || '',
            warnaSablonDepan,
            warnaSablonBelakang,
            data.shipping_courier || 'TUNAI',
            data.mockup_front_url || '',
            data.mockup_back_url || '',
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

