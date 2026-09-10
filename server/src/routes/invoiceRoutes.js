const express = require('express');
const router = express.Router();
const {
  generateInvoice, listInvoices, getInvoice, downloadInvoicePdf, updatePaymentStatus,
} = require('../controllers/invoiceController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin', 'worker'));

router.get('/', listInvoices);
router.post('/generate/:orderId', generateInvoice);
router.get('/:id', getInvoice);
router.get('/:id/pdf', downloadInvoicePdf);
router.patch('/:id/payment-status', authorize('admin'), updatePaymentStatus);

module.exports = router;
