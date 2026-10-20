const express = require('express');
const router = express.Router();
const StageController = require('../controllers/stageController');
const { isAuthenticated } = require('../middleware/authMiddleware');

router.use(isAuthenticated);

router.get('/queue', StageController.showDivisionQueue);
router.post('/stage/:id/action', StageController.handleStageAction);
router.post('/notifications/:id/read', StageController.markNotificationRead);

module.exports = router;
