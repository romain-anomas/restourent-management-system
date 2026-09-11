const express = require('express');
const router = express.Router();
const { listActivity } = require('../controllers/activityController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('admin', 'worker'), listActivity);

module.exports = router;
