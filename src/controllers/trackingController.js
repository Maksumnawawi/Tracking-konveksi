const OrderModel = require('../models/orderModel');
const StageModel = require('../models/stageModel');
const QcModel = require('../models/qcModel');
const { ROLE_LABELS } = require('../utils/workflowConfig');
const { formatDurationDetailed } = require('../utils/durationHelper');

const TrackingController = {
    showPublicTrack(req, res) {
        const queryCode = (req.params.code || '').trim();
        
        // Cari via tracking_code terlebih dahulu
        let order = OrderModel.getByTrackingCode(queryCode);
        
        if (!order) {
            const all = OrderModel.getAll();
            const cleanQuery = queryCode.toUpperCase().replace(/\s+/g, '');
            const numericPo = queryCode.replace(/[^0-9]/g, '');

            order = all.find(o => {
                if (o.order_number && o.order_number.toUpperCase() === cleanQuery) return true;
                if (o.tracking_code && o.tracking_code.toUpperCase() === cleanQuery) return true;
                // Match nomor PO
                if (numericPo && o.po_number && parseInt(o.po_number) === parseInt(numericPo)) return true;
                // Match no telp
                if (numericPo.length >= 4 && o.customer_phone && o.customer_phone.includes(numericPo)) return true;
                return false;
            });
        }

        if (!order) {
            return res.render('tracking/public-track', {
                title: 'Lacak Pesanan Konveksi',
                order: null,
                searchCode: queryCode,
                error: `Kode tracking atau nomor pesanan "${queryCode}" tidak ditemukan. Pastikan kode yang Anda masukkan benar.`
            });
        }

        const stages = StageModel.getStagesByOrderId(order.id);
        const qcResult = QcModel.getByOrderId(order.id);

        // Hitung progres persentase
        const totalStages = stages.length;
        const completedStages = stages.filter(s => s.status === 'COMPLETED').length;
        const inProgressStages = stages.filter(s => s.status === 'IN_PROGRESS').length;
        
        let progressPercent = 0;
        if (totalStages > 0) {
            if (order.status === 'COMPLETED') {
                progressPercent = 100;
            } else {
                progressPercent = Math.round(((completedStages + (inProgressStages ? 0.5 : 0)) / totalStages) * 100);
            }
        }

        res.render('tracking/public-track', {
            title: `Lacak Produksi: ${order.article_name}`,
            order,
            stages,
            qcResult,
            progressPercent,
            totalStages,
            completedStages,
            ROLE_LABELS,
            formatDurationDetailed,
            searchCode: queryCode,
            error: null
        });
    }
};

module.exports = TrackingController;

