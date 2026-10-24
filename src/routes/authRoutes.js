const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { isAuthenticated } = require('../middleware/authMiddleware');

router.get('/login', AuthController.showLogin);
router.post('/login', AuthController.login);
router.get('/logout', AuthController.logout);

// Ganti Password & Kelola Tim
router.post('/auth/change-password', isAuthenticated, AuthController.changePassword);
router.get('/admin/users/api', isAuthenticated, AuthController.getUsersApi);
router.post('/admin/users/update', isAuthenticated, AuthController.adminUpdateUser);

module.exports = router;
