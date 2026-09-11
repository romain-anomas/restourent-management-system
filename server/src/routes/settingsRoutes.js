const express = require('express');
const router = express.Router();
const { getPublicSettings, getSettings, updateSettings } = require('../controllers/settingsController');
const { authenticate, authorize } = require('../middleware/auth');
const { handleProductImageUpload } = require('../middleware/upload');

router.get('/public', getPublicSettings);

router.get('/', authenticate, authorize('admin'), getSettings);
router.put('/', authenticate, authorize('admin'), handleProductImageUpload, updateSettings);

module.exports = router;
