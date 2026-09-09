const express = require('express');
const router = express.Router();
const { createOrder, trackOrder } = require('../controllers/orderController');

router.post('/', createOrder);
router.get('/track/:orderNumber', trackOrder);

module.exports = router;
