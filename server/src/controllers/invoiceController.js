const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const invoiceService = require('../services/invoiceService');
const { logActivity } = require('../services/activityLogService');

/**
 * POST /api/invoices/generate/:orderId - admin/worker.
 * Idempotent: returns the existing invoice if one was already generated
 * for this order rather than creating a duplicate.
 */
const generateInvoice = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.createInvoiceForOrder(req.params.orderId, req.user.id);

  await logActivity({
    userId: req.user.id,
    action: 'generate_invoice',
    description: `Generated invoice ${invoice.invoice_number} for order ${invoice.order_number}`,
    relatedType: 'invoice',
    relatedId: invoice.id,
  });

  res.status(201).json({ success: true, message: 'Invoice ready.', data: invoice });
});

/** GET /api/invoices - admin/worker. List with search + payment status filter. */
const listInvoices = asyncHandler(async (req, res) => {
  const { search, paymentStatus } = req.query;
  const where = [];
  const params = [];

  if (search) {
    where.push('(i.invoice_number LIKE ? OR o.order_number LIKE ? OR o.customer_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (paymentStatus) {
    where.push('i.payment_status = ?');
    params.push(paymentStatus);
  }

  const [rows] = await pool.query(
    `SELECT i.id, i.invoice_number, i.grand_total, i.payment_status, i.created_at,
            o.order_number, o.customer_name
     FROM invoices i
     JOIN orders o ON o.id = i.order_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY i.created_at DESC
     LIMIT 300`,
    params
  );

  res.json({ success: true, data: rows });
});

/** GET /api/invoices/:id - admin/worker. Full invoice detail for on-screen preview. */
const getInvoice = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.getInvoiceById(req.params.id);
  res.json({ success: true, data: invoice });
});

/** GET /api/invoices/:id/pdf - admin/worker. Streams a generated PDF. */
const downloadInvoicePdf = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.getInvoiceById(req.params.id);
  const pdfBuffer = await invoiceService.buildInvoicePdf(invoice);

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`,
    'Content-Length': pdfBuffer.length,
  });
  res.send(pdfBuffer);
});

/** PATCH /api/invoices/:id/payment-status - admin only. */
const updatePaymentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { paymentStatus } = req.body;

  if (!['unpaid', 'paid', 'refunded'].includes(paymentStatus)) {
    throw new ApiError(400, 'Invalid payment status.');
  }

  const [rows] = await pool.query('SELECT id, invoice_number FROM invoices WHERE id = ?', [id]);
  if (!rows[0]) throw new ApiError(404, 'Invoice not found.');

  await pool.query('UPDATE invoices SET payment_status = ? WHERE id = ?', [paymentStatus, id]);
  await pool.query(
    `UPDATE orders o JOIN invoices i ON i.order_id = o.id SET o.payment_status = ? WHERE i.id = ?`,
    [paymentStatus, id]
  );

  await logActivity({
    userId: req.user.id,
    action: 'update_invoice_payment_status',
    description: `Set invoice ${rows[0].invoice_number} payment status to ${paymentStatus}`,
    relatedType: 'invoice',
    relatedId: Number(id),
  });

  res.json({ success: true, message: 'Payment status updated.' });
});

module.exports = { generateInvoice, listInvoices, getInvoice, downloadInvoicePdf, updatePaymentStatus };
