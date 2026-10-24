const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');
const OrderController = require('../controllers/orderController');
const { isAuthenticated, requireRole } = require('../middleware/authMiddleware');

// Semua rute admin hanya bisa diakses oleh role 'admin' (Owner)
router.use(isAuthenticated);
router.use(requireRole('admin'));

router.get('/dashboard', DashboardController.showDashboard);
router.get('/orders', OrderController.showOrdersList);
router.get('/orders/new', OrderController.showCreateForm);
router.post('/orders/new', OrderController.createOrder);
router.get('/orders/:id', OrderController.showOrderDetail);
router.get('/orders/:id/edit', OrderController.showEditForm);
router.post('/orders/:id/edit', OrderController.updateOrder);
router.post('/orders/:id/cancel', OrderController.cancelOrder);
router.get('/orders/:id/spk', OrderController.showSpkPrint);
router.post('/orders/:id/spk/update', OrderController.updateOrderPOK);
router.get('/orders/:id/nota', OrderController.showNotaCheck);
router.post('/orders/:id/nota', OrderController.saveNota);
router.get('/orders/:id/nota/print', OrderController.showNotaPrint);

module.exports = router;
