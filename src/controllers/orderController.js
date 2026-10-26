const OrderModel = require('../models/orderModel');
const StageModel = require('../models/stageModel');
const TimeLogModel = require('../models/timeLogModel');
const QcModel = require('../models/qcModel');
const NotificationModel = require('../models/notificationModel');
const { generateQRCodeDataUrl } = require('../utils/qrHelper');
const { ROLE_LABELS, ROLE_BADGES } = require('../utils/workflowConfig');
const { formatDurationDetailed, formatDurationClock, getActiveDurationSeconds } = require('../utils/durationHelper');

const OrderController = {
    showOrdersList(req, res) {
        const { status, category, search } = req.query;
        const orders = OrderModel.getAll({ status, category, search });

        res.render('admin/orders-list', {
            title: 'Daftar Semua Pesanan (SPK)',
            orders,
            filters: { status, category, search },
            ROLE_LABELS,
            ROLE_BADGES,
            formatDurationDetailed
        });
    },

    showCreateForm(req, res) {
        let todayWib;
        try {
            todayWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
        } catch(e) {
            todayWib = new Date().toISOString().slice(0, 10);
        }

        const nextPoNumber = OrderModel.getNextPoNumber(todayWib);
        res.render('admin/order-create', {
            title: 'Buat SPK / Order Baru',
            error: null,
            nextPoNumber,
            formData: {
                po_number: nextPoNumber,
                tgl_masuk: todayWib,
                tinta_type: 'PLASTISOL',
                finishing_type: 'PRES DOFT',
                warna_kaos: 'HITAM, PUTIH',
                shipping_courier: 'TUNAI'
            }
        });
    },

    getNextPoNumberApi(req, res) {
        const date = req.query.date;
        const nextPoNumber = OrderModel.getNextPoNumber(date);
        return res.json({ success: true, nextPoNumber });
    },

    createOrder(req, res) {
        try {
            const {
                customer_name, customer_phone, article_name, category,
                fabric_type, print_type, notes, deadline_date,
                size_xs, size_s, size_m, size_l, size_xl, size_2xl, size_3xl
            } = req.body;

            if (!customer_name || !article_name || !category) {
                return res.render('admin/order-create', {
                    title: 'Buat SPK / Order Baru',
                    error: 'Nama pelanggan, nama artikel, dan kategori produk wajib diisi!',
                    formData: req.body
                });
            }

            const totalPcs = 
                (parseInt(size_xs) || 0) +
                (parseInt(size_s) || 0) +
                (parseInt(size_m) || 0) +
                (parseInt(size_l) || 0) +
                (parseInt(size_xl) || 0) +
                (parseInt(size_2xl) || 0) +
                (parseInt(size_3xl) || 0);

            if (totalPcs <= 0 && !req.body.total_pcs) {
                return res.render('admin/order-create', {
                    title: 'Buat SPK / Order Baru',
                    error: 'Masukkan jumlah rincian ukuran baju (minimal 1 pcs)!',
                    formData: req.body
                });
            }

            const created = OrderModel.create(req.body, req.session.user ? req.session.user.id : 1);

            return res.redirect(`/admin/orders/${created.orderId}?created=1`);
        } catch (err) {
            console.error('Error createOrder:', err);
            return res.render('admin/order-create', {
                title: 'Buat SPK / Order Baru',
                error: 'Terjadi kesalahan sistem: ' + err.message,
                formData: req.body
            });
        }
    },

    showOrderDetail(req, res) {
        const orderId = req.params.id;
        const order = OrderModel.getById(orderId);

        if (!order) {
            return res.status(404).render('auth/login', {
                title: 'Order Tidak Ditemukan',
                error: 'Order dengan ID tersebut tidak ditemukan.',
                users: []
            });
        }

        const stages = StageModel.getStagesByOrderId(orderId);
        const timeLogs = TimeLogModel.getByOrderId(orderId);
        const qcResult = QcModel.getByOrderId(orderId);
        const notifications = NotificationModel.getByOrderId(orderId);

        // Hitung total durasi produksi aktif keseluruhan
        let grandTotalSeconds = 0;
        stages.forEach(st => {
            const activeSec = getActiveDurationSeconds(st);
            st.currentActiveSeconds = activeSec;
            grandTotalSeconds += activeSec;
        });

        res.render('admin/order-detail', {
            title: `Detail Pesanan ${order.order_number}`,
            order,
            stages,
            timeLogs,
            qcResult,
            notifications,
            grandTotalSeconds,
            ROLE_LABELS,
            ROLE_BADGES,
            formatDurationDetailed,
            formatDurationClock,
            getActiveDurationSeconds,
            isCreated: req.query.created === '1',
            successMsg: req.query.msg || null,
            errorMsg: req.query.err || null
        });
    },

    // Form Edit Pesanan Khusus Owner
    showEditForm(req, res) {
        const orderId = req.params.id;
        const order = OrderModel.getById(orderId);

        if (!order) {
            return res.redirect('/admin/orders');
        }

        res.render('admin/order-edit', {
            title: `Edit Pesanan: ${order.order_number}`,
            order,
            error: null,
            ROLE_LABELS
        });
    },

    // Simpan Perubahan Pesanan & Kirim Notifikasi ke Divisi Terkait
    updateOrder(req, res) {
        try {
            const orderId = parseInt(req.params.id);
            const currentOrder = OrderModel.getById(orderId);
            if (!currentOrder) {
                return res.redirect('/admin/orders');
            }

            const {
                customer_name, customer_phone, article_name,
                fabric_type, print_type, notes, deadline_date,
                size_xs, size_s, size_m, size_l, size_xl, size_2xl, size_3xl,
                revision_notes
            } = req.body;

            const oldTotalPcs = currentOrder.total_pcs;
            const newTotalPcs = 
                (parseInt(size_xs) || 0) +
                (parseInt(size_s) || 0) +
                (parseInt(size_m) || 0) +
                (parseInt(size_l) || 0) +
                (parseInt(size_xl) || 0) +
                (parseInt(size_2xl) || 0) +
                (parseInt(size_3xl) || 0);

            // Simpan update ke database
            OrderModel.update(orderId, req.body);

            // Cek apakah ada perubahan jumlah (penambahan / pengurangan order)
            const diff = newTotalPcs - oldTotalPcs;
            const currentRole = currentOrder.current_role || 'all';
            const currentRoleName = ROLE_LABELS[currentRole] || currentRole;

            if (diff !== 0) {
                const diffText = diff > 0 ? `+${diff} pcs (penambahan)` : `${diff} pcs (pengurangan)`;
                NotificationModel.create({
                    order_id: orderId,
                    target_role: 'all', // Disiarkan ke semua meja divisi agar operator tahu ada revisi Qty
                    type: 'QTY_CHANGE',
                    title: `Perubahan Jumlah Order (${diffText})`,
                    message: `Owner telah mengubah jumlah pesanan ${currentOrder.order_number} (${currentOrder.article_name}) dari ${oldTotalPcs} pcs menjadi ${newTotalPcs} pcs (Posisi pengerjaan saat ini: ${currentRoleName}). Catatan Owner: ${revision_notes || 'Penyesuaian pesanan dari pelanggan'}`,
                    old_value: `${oldTotalPcs} pcs`,
                    new_value: `${newTotalPcs} pcs`,
                    created_by: req.session.user.id
                });
            } else if (revision_notes || notes !== currentOrder.notes) {
                NotificationModel.create({
                    order_id: orderId,
                    target_role: 'all',
                    type: 'SPEC_UPDATE',
                    title: `Pembaruan Spesifikasi SPK`,
                    message: `Owner memperbarui instruksi pesanan ${currentOrder.order_number} (${currentRoleName}): ${revision_notes || notes}`,
                    created_by: req.session.user.id
                });
            }

            return res.redirect(`/admin/orders/${orderId}?msg=${encodeURIComponent('Pesanan berhasil diperbarui & notifikasi telah dikirim ke meja divisi!')}`);
        } catch (err) {
            console.error('Error updateOrder:', err);
            return res.redirect(`/admin/orders/${req.params.id}/edit?err=${encodeURIComponent(err.message)}`);
        }
    },

    // Pembatalan Pesanan Oleh Owner
    cancelOrder(req, res) {
        try {
            const orderId = parseInt(req.params.id);
            const currentOrder = OrderModel.getById(orderId);
            if (!currentOrder) {
                return res.redirect('/admin/orders');
            }

            const { reason } = req.body;
            OrderModel.cancel(orderId, reason, req.session.user.id);

            const currentRoleName = ROLE_LABELS[currentOrder.current_role] || currentOrder.current_role;

            // Buat notifikasi pembatalan penting untuk semua divisi & meja aktif
            NotificationModel.create({
                order_id: orderId,
                target_role: 'all',
                type: 'ORDER_CANCELLED',
                title: `⛔ PESANAN DIBATALKAN OLEH OWNER`,
                message: `Pesanan ${currentOrder.order_number} (${currentOrder.article_name}) telah DIBATALKAN oleh Owner. Divisi terkait (${currentRoleName}) dimohon segera menghentikan proses pengerjaan. Alasan: ${reason || 'Pembatalan dari pemesan'}`,
                created_by: req.session.user.id
            });

            return res.redirect(`/admin/orders/${orderId}?msg=${encodeURIComponent('Pesanan telah resmi dibatalkan & notifikasi telah disiarkan ke lantai produksi.')}`);
        } catch (err) {
            console.error('Error cancelOrder:', err);
            return res.redirect(`/admin/orders/${req.params.id}?err=${encodeURIComponent(err.message)}`);
        }
    },

    async showSpkPrint(req, res) {
        const orderId = req.params.id;
        const order = OrderModel.getById(orderId);

        if (!order) {
            return res.status(404).send('Pesanan tidak ditemukan');
        }

        const stages = StageModel.getStagesByOrderId(orderId);

        // Buat QR Code link public tracking
        const host = req.headers.host || 'localhost:3000';
        const protocol = req.protocol || 'http';
        const publicTrackUrl = `${protocol}://${host}/track/${order.tracking_code}`;
        const qrCodeDataUrl = await generateQRCodeDataUrl(publicTrackUrl);

        res.render('admin/spk-print', {
            order,
            stages,
            publicTrackUrl,
            qrCodeDataUrl,
            ROLE_LABELS,
            printDate: new Date().toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            })
        });
    },

    updateOrderPOK(req, res) {
        try {
            const orderId = req.params.id;
            OrderModel.updatePOK(orderId, req.body);
            return res.redirect(`/admin/orders/${orderId}/spk?saved=1`);
        } catch (err) {
            console.error('Error updateOrderPOK:', err);
            return res.redirect(`/admin/orders/${req.params.id}/spk?err=${encodeURIComponent(err.message)}`);
        }
    },

    showNotaCheck(req, res) {
        const orderId = req.params.id;
        const order = OrderModel.getById(orderId);

        if (!order) {
            return res.status(404).send('Pesanan tidak ditemukan');
        }

        let items = [];
        try {
            items = order.items_breakdown_json ? JSON.parse(order.items_breakdown_json) : [];
        } catch (e) {
            items = [];
        }

        if (!Array.isArray(items) || items.length === 0) {
            // Default 1 baris berdasarkan warna & ukuran di order
            items = [{
                name: order.warna_kaos ? order.warna_kaos.split(',')[0].trim() + ' PENDEK' : 'KAOS PENDEK',
                qty_xs: parseInt(order.size_xs) || 0,
                qty_s: parseInt(order.size_s) || 0,
                qty_m: parseInt(order.size_m) || 0,
                qty_l: parseInt(order.size_l) || 0,
                qty_xl: parseInt(order.size_xl) || 0,
                qty_2xl: parseInt(order.size_2xl) || 0,
                qty_3xl: parseInt(order.size_3xl) || 0,
                qty_4xl: parseInt(order.size_4xl) || 0,
                qty_5xl: parseInt(order.size_5xl) || 0
            }];

            // Jika ada warna kedua, tambahkan baris kedua
            const colors = (order.warna_kaos || '').split(',').map(c => c.trim()).filter(Boolean);
            if (colors.length > 1) {
                items.push({
                    name: colors[1] + ' PENDEK',
                    qty_xs: 0,
                    qty_s: 0,
                    qty_m: 0,
                    qty_l: 0,
                    qty_xl: 0,
                    qty_2xl: 0,
                    qty_3xl: 0,
                    qty_4xl: 0,
                    qty_5xl: 0
                });
            }
        }

        let priceMatrix = {
            xs: 67000,
            s: 67000,
            m: 67000,
            l: 67000,
            xl: 67000,
            '2xl': 72000,
            '3xl': 77000,
            '4xl': 82000,
            '5xl': 87000
        };

        try {
            if (order.price_matrix_json) {
                const parsedPrices = JSON.parse(order.price_matrix_json);
                priceMatrix = { ...priceMatrix, ...parsedPrices };
            }
        } catch (e) {}

        res.render('admin/nota-check', {
            title: `Cek Nota - PO #${order.po_number || order.id} (${order.customer_name})`,
            order,
            items,
            priceMatrix,
            saved: req.query.saved === '1'
        });
    },

    saveNota(req, res) {
        try {
            const orderId = req.params.id;
            const {
                customer_address,
                nota_number,
                nota_month,
                nota_notes,
                down_payment,
                free_qty,
                price_m,
                price_l,
                price_xl,
                price_2xl,
                price_3xl,
                price_xs,
                price_s,
                price_4xl,
                price_5xl,
                item_names,
                item_m,
                item_l,
                item_xl,
                item_2xl,
                item_3xl,
                item_xs,
                item_s,
                item_4xl,
                item_5xl
            } = req.body;

            const priceMatrix = {
                xs: parseInt(price_xs) || 67000,
                s: parseInt(price_s) || 67000,
                m: parseInt(price_m) || 67000,
                l: parseInt(price_l) || 67000,
                xl: parseInt(price_xl) || 67000,
                '2xl': parseInt(price_2xl) || 72000,
                '3xl': parseInt(price_3xl) || 77000,
                '4xl': parseInt(price_4xl) || 82000,
                '5xl': parseInt(price_5xl) || 87000
            };

            // Susun item rows
            const items = [];
            let grandTotal = 0;

            const names = Array.isArray(item_names) ? item_names : [item_names].filter(Boolean);
            const mArr = Array.isArray(item_m) ? item_m : [item_m];
            const lArr = Array.isArray(item_l) ? item_l : [item_l];
            const xlArr = Array.isArray(item_xl) ? item_xl : [item_xl];
            const xxlArr = Array.isArray(item_2xl) ? item_2xl : [item_2xl];
            const xxxlArr = Array.isArray(item_3xl) ? item_3xl : [item_3xl];
            const xsArr = Array.isArray(item_xs) ? item_xs : [item_xs];
            const sArr = Array.isArray(item_s) ? item_s : [item_s];
            const fxlArr = Array.isArray(item_4xl) ? item_4xl : [item_4xl];
            const ffxlArr = Array.isArray(item_5xl) ? item_5xl : [item_5xl];

            names.forEach((name, idx) => {
                const q_xs = parseInt(xsArr[idx]) || 0;
                const q_s = parseInt(sArr[idx]) || 0;
                const q_m = parseInt(mArr[idx]) || 0;
                const q_l = parseInt(lArr[idx]) || 0;
                const q_xl = parseInt(xlArr[idx]) || 0;
                const q_2xl = parseInt(xxlArr[idx]) || 0;
                const q_3xl = parseInt(xxxlArr[idx]) || 0;
                const q_4xl = parseInt(fxlArr[idx]) || 0;
                const q_5xl = parseInt(ffxlArr[idx]) || 0;

                const rowSubtotal = 
                    (q_xs * priceMatrix.xs) +
                    (q_s * priceMatrix.s) +
                    (q_m * priceMatrix.m) +
                    (q_l * priceMatrix.l) +
                    (q_xl * priceMatrix.xl) +
                    (q_2xl * priceMatrix['2xl']) +
                    (q_3xl * priceMatrix['3xl']) +
                    (q_4xl * priceMatrix['4xl']) +
                    (q_5xl * priceMatrix['5xl']);

                grandTotal += rowSubtotal;

                items.push({
                    name,
                    qty_xs: q_xs,
                    qty_s: q_s,
                    qty_m: q_m,
                    qty_l: q_l,
                    qty_xl: q_xl,
                    qty_2xl: q_2xl,
                    qty_3xl: q_3xl,
                    qty_4xl: q_4xl,
                    qty_5xl: q_5xl,
                    subtotal: rowSubtotal
                });
            });

            const dp = parseInt(down_payment) || 0;
            const remaining = Math.max(0, grandTotal - dp);

            OrderModel.updateNota(orderId, {
                customer_address,
                nota_number,
                nota_month,
                nota_notes,
                items_breakdown_json: JSON.stringify(items),
                price_matrix_json: JSON.stringify(priceMatrix),
                total_price: grandTotal,
                down_payment: dp,
                remaining_payment: remaining,
                free_qty: parseInt(free_qty) || 0
            });

            return res.redirect(`/admin/orders/${orderId}/nota?saved=1`);
        } catch (err) {
            console.error('Error saveNota:', err);
            return res.redirect(`/admin/orders/${req.params.id}/nota?err=${encodeURIComponent(err.message)}`);
        }
    },

    showNotaPrint(req, res) {
        const orderId = req.params.id;
        const order = OrderModel.getById(orderId);

        if (!order) {
            return res.status(404).send('Pesanan tidak ditemukan');
        }

        let items = [];
        try {
            items = order.items_breakdown_json ? JSON.parse(order.items_breakdown_json) : [];
        } catch (e) {}

        let priceMatrix = {
            xs: 67000,
            s: 67000,
            m: 67000,
            l: 67000,
            xl: 67000,
            '2xl': 72000,
            '3xl': 77000,
            '4xl': 82000,
            '5xl': 87000
        };
        try {
            if (order.price_matrix_json) {
                priceMatrix = { ...priceMatrix, ...JSON.parse(order.price_matrix_json) };
            }
        } catch (e) {}

        res.render('admin/nota-print', {
            order,
            items,
            priceMatrix,
            printDate: new Date().toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            })
        });
    }
};

module.exports = OrderController;
