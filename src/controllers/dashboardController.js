const OrderModel = require('../models/orderModel');
const QcModel = require('../models/qcModel');
const NotificationModel = require('../models/notificationModel');
const { ROLE_LABELS, ROLE_BADGES } = require('../utils/workflowConfig');
const { formatDurationDetailed, formatDurationClock, getActiveDurationSeconds } = require('../utils/durationHelper');

const DashboardController = {
    showDashboard(req, res) {
        const stats = OrderModel.getDashboardStats();
        const qcStats = QcModel.getOverallStats();
        const recentOrders = OrderModel.getAll();
        const recentNotifications = NotificationModel.getRecent(5);

        // Siapkan antrean per role yang lengkap (role: count)
        const roleOrderCount = {
            desain: 0,
            print_sablon: 0,
            potong: 0,
            jahit: 0,
            qc_packing: 0,
            kirim: 0
        };

        if (stats.roleQueue && Array.isArray(stats.roleQueue)) {
            stats.roleQueue.forEach(rq => {
                if (roleOrderCount[rq.current_role] !== undefined) {
                    roleOrderCount[rq.current_role] = rq.cnt;
                }
            });
        }

        res.render('admin/dashboard', {
            title: 'Monitoring Produksi Konveksi - WIP Control Room',
            stats,
            qcStats,
            roleOrderCount,
            recentOrders: recentOrders.slice(0, 10),
            recentNotifications,
            ROLE_LABELS,
            ROLE_BADGES,
            formatDurationDetailed,
            formatDurationClock,
            getActiveDurationSeconds
        });
    }
};

module.exports = DashboardController;
