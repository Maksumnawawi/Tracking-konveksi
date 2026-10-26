const StageModel = require('../models/stageModel');
const OrderModel = require('../models/orderModel');
const QcModel = require('../models/qcModel');
const NotificationModel = require('../models/notificationModel');
const { ROLE_LABELS, ROLE_BADGES } = require('../utils/workflowConfig');
const { formatDurationDetailed, formatDurationClock, getActiveDurationSeconds } = require('../utils/durationHelper');

const StageController = {
    showDivisionQueue(req, res) {
        const user = req.session.user;
        let activeRole = user.role;

        // Admin bisa switch view divisi antrean lewat query ?view_role=jahit
        if (user.role === 'admin' && req.query.view_role) {
            activeRole = req.query.view_role;
        }

        const queue = StageModel.getQueueForRole(activeRole);
        const history = StageModel.getCompletedHistoryForRole(activeRole);
        const notifications = NotificationModel.getByRole(activeRole);

        // Tambahkan kalkulasi realtime seconds
        queue.forEach(item => {
            item.currentSeconds = getActiveDurationSeconds(item);
        });

        const inProgressList = queue.filter(q => q.status === 'IN_PROGRESS');
        const pausedList = queue.filter(q => q.status === 'PAUSED');
        const waitingList = queue.filter(q => q.status === 'WAITING');

        res.render('division/queue', {
            title: `Meja Kerja - ${ROLE_LABELS[activeRole] || activeRole}`,
            activeRole,
            inProgressList,
            pausedList,
            waitingList,
            history,
            notifications,
            ROLE_LABELS,
            ROLE_BADGES,
            formatDurationDetailed,
            formatDurationClock,
            getActiveDurationSeconds,
            successMsg: req.query.msg || null,
            errorMsg: req.query.err || null
        });
    },

    markNotificationRead(req, res) {
        const notifId = parseInt(req.params.id);
        NotificationModel.markAsRead(notifId);
        return res.redirect('/division/queue');
    },

    handleStageAction(req, res) {
        try {
            const stageId = parseInt(req.params.id);
            const { action, jump_to_role } = req.body; // 'start', 'pause', 'resume', 'complete'
            const userId = req.session.user.id;
            const userRole = req.session.user.role;

            const stage = StageModel.getById(stageId);
            if (!stage) {
                if (req.xhr || req.headers.accept?.includes('application/json')) {
                    return res.status(404).json({ success: false, error: 'Stage tidak ditemukan' });
                }
                return res.redirect('/division/queue?err=Stage%20tidak%20ditemukan');
            }

            // Validasi hak akses divisi
            if (userRole !== 'admin' && stage.assigned_role !== userRole) {
                const msg = `Hanya ${ROLE_LABELS[stage.assigned_role]} yang berhak mengubah tahapan ini`;
                if (req.xhr || req.headers.accept?.includes('application/json')) {
                    return res.status(403).json({ success: false, error: msg });
                }
                return res.redirect(`/division/queue?err=${encodeURIComponent(msg)}`);
            }

            let result;
            if (action === 'start') {
                result = StageModel.startStage(stageId, userId);
            } else if (action === 'pause') {
                result = StageModel.pauseStage(stageId, userId);
            } else if (action === 'resume') {
                result = StageModel.resumeStage(stageId, userId);
            } else if (action === 'complete') {
                // Jika tahapan adalah QC & Packing, pastikan data QC tersimpan
                const isQcStage = stage.stage_name.toLowerCase().includes('qc');
                if (isQcStage) {
                    const { pcs_passed, pcs_reject, reject_reason, rework_notes } = req.body;
                    
                    if (pcs_passed === undefined || pcs_passed === '') {
                        const msg = 'Tahap QC & Packing wajib memasukkan jumlah Pcs Lolos dan Pcs Reject!';
                        if (req.xhr || req.headers.accept?.includes('application/json')) {
                            return res.status(400).json({ success: false, error: msg });
                        }
                        return res.redirect(`/division/queue?err=${encodeURIComponent(msg)}`);
                    }

                    const passed = parseInt(pcs_passed) || 0;
                    const reject = parseInt(pcs_reject) || 0;

                    // Simpan hasil QC
                    QcModel.saveResult({
                        order_id: stage.order_id,
                        order_stage_id: stageId,
                        inspector_user_id: userId,
                        total_checked: passed + reject,
                        pcs_passed: passed,
                        pcs_reject: reject,
                        reject_reason: reject_reason || '',
                        rework_notes: rework_notes || ''
                    });
                }

                result = StageModel.completeStage(stageId, userId, jump_to_role || null);
            } else {
                return res.status(400).json({ success: false, error: 'Aksi tidak dikenal' });
            }

            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.json({ success: true, action, result });
            }

            let msg = 'Status berhasil diperbarui';
            if (action === 'complete') {
                msg = result.isFinalStage 
                    ? 'Pesanan telah selesai seluruh tahapan produksi!' 
                    : `Tahap selesai! Otomatis diteruskan ke ${ROLE_LABELS[result.nextStage.role]} (${result.nextStage.name})`;
            }

            return res.redirect(`/division/queue?msg=${encodeURIComponent(msg)}`);
        } catch (err) {
            console.error('Error handleStageAction:', err);
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(500).json({ success: false, error: err.message });
            }
            return res.redirect(`/division/queue?err=${encodeURIComponent(err.message)}`);
        }
    }
};

module.exports = StageController;
