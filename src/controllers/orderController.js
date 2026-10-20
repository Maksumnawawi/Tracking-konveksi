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
        res.render('admin/order-create', {
            title: 'Buat SPK / Order Baru',
            error: null,
            formData: {}
        });
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
    }
};

module.exports = OrderController;
