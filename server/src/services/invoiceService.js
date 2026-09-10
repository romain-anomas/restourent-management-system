const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { pool, withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');

async function generateInvoiceNumber(conn) {
  const [settingsRows] = await conn.query('SELECT invoice_prefix FROM restaurant_settings LIMIT 1');
  const prefix = settingsRows[0]?.invoice_prefix || 'INV';
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const [countRows] = await conn.query(`SELECT COUNT(*) AS cnt FROM invoices WHERE DATE(created_at) = CURDATE()`);
  const sequence = String(Number(countRows[0].cnt) + 1).padStart(4, '0');

  return `${prefix}-${datePart}-${sequence}`;
}

/**
 * Creates an invoice for an order, idempotently - if one already exists
 * for this order, returns the existing invoice instead of creating a
 * duplicate. Figures are copied from the order at generation time (the
 * order's totals are already final/validated from checkout).
 */
async function createInvoiceForOrder(orderId, userId) {
  return withTransaction(async (conn) => {
    const [existing] = await conn.query('SELECT id FROM invoices WHERE order_id = ? LIMIT 1', [orderId]);
    if (existing.length > 0) {
      return getInvoiceById(existing[0].id);
    }

    const [orderRows] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    const order = orderRows[0];
    if (!order) throw new ApiError(404, 'Order not found.');

    const invoiceNumber = await generateInvoiceNumber(conn);

    const [result] = await conn.query(
      `INSERT INTO invoices (invoice_number, order_id, issued_by, subtotal, discount, tax, grand_total, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [invoiceNumber, orderId, userId, order.subtotal, order.discount, order.tax, order.total_amount, order.payment_status]
    );

    return getInvoiceById(result.insertId, conn);
  });
}

/** Fetches a single invoice with its order + line items + restaurant info. */
async function getInvoiceById(invoiceId, conn = pool) {
  const [rows] = await conn.query(
    `SELECT i.*, o.order_number, o.customer_name, o.customer_phone, o.customer_address, o.notes AS order_notes,
            o.status AS order_status, u.full_name AS issued_by_name
     FROM invoices i
     JOIN orders o ON o.id = i.order_id
     LEFT JOIN users u ON u.id = i.issued_by
     WHERE i.id = ? LIMIT 1`,
    [invoiceId]
  );
  const invoice = rows[0];
  if (!invoice) throw new ApiError(404, 'Invoice not found.');

  const [items] = await conn.query(
    `SELECT product_name, unit_price, quantity, line_total FROM order_items WHERE order_id = ?`,
    [invoice.order_id]
  );

  const [settingsRows] = await conn.query(
    `SELECT restaurant_name, phone, email, address, currency FROM restaurant_settings LIMIT 1`
  );

  return { ...invoice, items, restaurant: settingsRows[0] || {} };
}

/**
 * Builds a single-page A4 invoice PDF from invoice data (as returned by
 * getInvoiceById) and returns it as a Buffer, ready to stream to the client.
 */
async function buildInvoicePdf(invoice) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 in points
  const { width, height } = page.getSize();

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  let y = height - margin;
  const brandColor = rgb(0.92, 0.34, 0.05); // matches the app's brand-600 orange
  const gray = rgb(0.45, 0.45, 0.45);
  const darkText = rgb(0.1, 0.1, 0.1);

  const drawText = (text, x, yPos, opts = {}) => {
    page.drawText(String(text ?? ''), { x, y: yPos, size: opts.size || 10, font: opts.bold ? bold : font, color: opts.color || darkText });
  };

  // Header: restaurant info (left) + invoice meta (right)
  drawText(invoice.restaurant.restaurant_name || 'Restaurant', margin, y, { size: 18, bold: true, color: brandColor });
  y -= 18;
  if (invoice.restaurant.address) { drawText(invoice.restaurant.address, margin, y, { size: 9, color: gray }); y -= 12; }
  if (invoice.restaurant.phone) { drawText(`Tel: ${invoice.restaurant.phone}`, margin, y, { size: 9, color: gray }); y -= 12; }
  if (invoice.restaurant.email) { drawText(invoice.restaurant.email, margin, y, { size: 9, color: gray }); y -= 12; }

  const rightX = width - margin - 180;
  let ry = height - margin;
  drawText('INVOICE', rightX, ry, { size: 16, bold: true }); ry -= 18;
  drawText(`Invoice #: ${invoice.invoice_number}`, rightX, ry, { size: 9, color: gray }); ry -= 12;
  drawText(`Order #: ${invoice.order_number}`, rightX, ry, { size: 9, color: gray }); ry -= 12;
  drawText(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, rightX, ry, { size: 9, color: gray }); ry -= 12;
  drawText(`Payment: ${invoice.payment_status.toUpperCase()}`, rightX, ry, { size: 9, color: gray });

  y -= 25;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 25;

  // Bill to
  drawText('Bill To', margin, y, { size: 10, bold: true }); y -= 14;
  drawText(invoice.customer_name, margin, y, { size: 10 }); y -= 13;
  drawText(invoice.customer_phone, margin, y, { size: 9, color: gray }); y -= 13;
  if (invoice.customer_address) { drawText(invoice.customer_address, margin, y, { size: 9, color: gray }); y -= 13; }

  y -= 15;

  // Items table header
  const col = { name: margin, qty: 330, price: 400, total: 480 };
  page.drawRectangle({ x: margin, y: y - 6, width: width - margin * 2, height: 22, color: rgb(0.97, 0.97, 0.97) });
  drawText('Item', col.name + 5, y, { size: 9, bold: true });
  drawText('Qty', col.qty, y, { size: 9, bold: true });
  drawText('Unit Price', col.price, y, { size: 9, bold: true });
  drawText('Total', col.total, y, { size: 9, bold: true });
  y -= 24;

  const currency = invoice.restaurant.currency || 'RWF';
  const fmt = (n) => `${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })} ${currency}`;

  invoice.items.forEach((item) => {
    if (y < 120) return; // guard against overflow on very long orders (single-page invoice)
    drawText(item.product_name, col.name + 5, y, { size: 9.5 });
    drawText(String(item.quantity), col.qty, y, { size: 9.5 });
    drawText(fmt(item.unit_price), col.price, y, { size: 9.5 });
    drawText(fmt(item.line_total), col.total, y, { size: 9.5 });
    y -= 18;
  });

  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 20;

  const totalsX = 400;
  drawText('Subtotal', totalsX, y, { size: 9.5, color: gray });
  drawText(fmt(invoice.subtotal), col.total, y, { size: 9.5 }); y -= 16;
  if (Number(invoice.discount) > 0) {
    drawText('Discount', totalsX, y, { size: 9.5, color: gray });
    drawText(`-${fmt(invoice.discount)}`, col.total, y, { size: 9.5 }); y -= 16;
  }
  if (Number(invoice.tax) > 0) {
    drawText('Tax', totalsX, y, { size: 9.5, color: gray });
    drawText(fmt(invoice.tax), col.total, y, { size: 9.5 }); y -= 16;
  }
  drawText('Grand Total', totalsX, y, { size: 11, bold: true });
  drawText(fmt(invoice.grand_total), col.total, y, { size: 11, bold: true });

  // Footer
  const footerY = 60;
  page.drawLine({ start: { x: margin, y: footerY + 20 }, end: { x: width - margin, y: footerY + 20 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
  drawText('Thank you for your order!', margin, footerY, { size: 9, color: gray });
  drawText(`Issued by: ${invoice.issued_by_name || 'System'}`, margin, footerY - 14, { size: 8, color: gray });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

module.exports = { createInvoiceForOrder, getInvoiceById, buildInvoicePdf, generateInvoiceNumber };
