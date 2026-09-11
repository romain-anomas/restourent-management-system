const express = require('express');
const router = express.Router();
const { listNotifications, markAsRead, markAllAsRead } = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin', 'worker'));

router.get('/', listNotifications);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);

module.exports = router;
