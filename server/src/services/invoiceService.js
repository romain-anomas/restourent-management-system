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

/** Builds a variable-length 80 mm receipt invoice, suitable for thermal printers. */
async function buildInvoicePdf(invoice) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const width = (80 / 25.4) * 72;
  const margin = 13;
  const contentWidth = width - margin * 2;
  const brandColor = rgb(0.92, 0.34, 0.05);
  const gray = rgb(0.45, 0.45, 0.45);
  const darkText = rgb(0.1, 0.1, 0.1);
  const rulesColor = rgb(0.78, 0.78, 0.78);
  const operations = [];
  const pushText = (value, options = {}) => {
    const text = String(value ?? '');
    const size = options.size || 9;
    const selectedFont = options.bold ? bold : font;
    const words = text.split(/\s+/).filter(Boolean);
    const wrapped = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (selectedFont.widthOfTextAtSize(candidate, size) <= contentWidth) {
        current = candidate;
        continue;
      }
      if (current) wrapped.push(current);
      current = '';
      for (const char of word) {
        const next = current + char;
        if (selectedFont.widthOfTextAtSize(next, size) > contentWidth && current) {
          wrapped.push(current);
          current = char;
        } else current = next;
      }
    }
    if (current) wrapped.push(current);
    if (!wrapped.length) wrapped.push('');
    wrapped.forEach((line) => operations.push({
      type: 'text', text: line, size, font: selectedFont,
      color: options.color || darkText, align: options.align || 'left', gap: options.gap ?? 2,
    }));
  };
  const pushPair = (label, value, options = {}) => {
    const size = options.size || 9;
    const selectedFont = options.bold ? bold : font;
    const left = String(label);
    const right = String(value ?? '');
    const available = contentWidth - selectedFont.widthOfTextAtSize(left, size) - selectedFont.widthOfTextAtSize(right, size) - 8;
    if (available >= 4) {
      operations.push({ type: 'pair', left, right, size, font: selectedFont, color: options.color || darkText, gap: options.gap ?? 4 });
    } else {
      pushText(left, { size, bold: options.bold, color: options.color, gap: 0 });
      pushText(right, { size, bold: options.bold, color: options.color, align: 'right', gap: options.gap ?? 4 });
    }
  };
  const pushRule = () => operations.push({ type: 'rule', gap: 7 });
  const currency = invoice.restaurant.currency || 'RWF';
  const fmt = (n) => `${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })} ${currency}`;

  // Store name and contact details
  pushText(invoice.restaurant.restaurant_name || 'Restaurant', { size: 14, bold: true, color: brandColor, align: 'center', gap: 3 });
  if (invoice.restaurant.address) pushText(invoice.restaurant.address, { size: 8, color: gray, align: 'center', gap: 1 });
  if (invoice.restaurant.phone) pushText(`Tel: ${invoice.restaurant.phone}`, { size: 8, color: gray, align: 'center', gap: 1 });
  if (invoice.restaurant.email) pushText(invoice.restaurant.email, { size: 8, color: gray, align: 'center', gap: 1 });
  pushRule();

  pushText('INVOICE / SALES RECEIPT', { size: 11, bold: true, align: 'center', gap: 5 });
  pushPair('Invoice:', invoice.invoice_number, { size: 8 });
  pushPair('Order:', invoice.order_number, { size: 8 });
  pushPair('Date:', new Date(invoice.created_at).toLocaleString(), { size: 8 });
  pushPair('Payment:', String(invoice.payment_status || 'unpaid').toUpperCase(), { size: 8, gap: 5 });
  pushRule();

  pushText('CUSTOMER', { size: 8, bold: true, color: gray, gap: 3 });
  pushText(invoice.customer_name || 'Walk-in customer', { size: 9, bold: true, gap: 2 });
  if (invoice.customer_phone) pushText(invoice.customer_phone, { size: 8, color: gray, gap: 2 });
  if (invoice.customer_address) pushText(invoice.customer_address, { size: 8, color: gray, gap: 3 });
  pushRule();

  pushText('ITEMS', { size: 8, bold: true, color: gray, gap: 4 });
  for (const item of invoice.items || []) {
    pushText(item.product_name, { size: 9, bold: true, gap: 2 });
    const quantity = Number(item.quantity).toLocaleString('en-US', { maximumFractionDigits: 2 });
    pushPair(`${quantity} × ${fmt(item.unit_price)}`, fmt(item.line_total), { size: 8, gap: 5 });
  }
  pushRule();

  pushPair('Subtotal', fmt(invoice.subtotal), { size: 8, color: gray, gap: 4 });
  if (Number(invoice.discount) > 0) pushPair('Discount', `-${fmt(invoice.discount)}`, { size: 8, color: gray, gap: 4 });
  if (Number(invoice.tax) > 0) pushPair('Tax / VAT', fmt(invoice.tax), { size: 8, color: gray, gap: 4 });
  pushRule();
  pushPair('TOTAL TO PAY', fmt(invoice.grand_total), { size: 11, bold: true, gap: 7 });
  pushRule();
  pushText('Thank you for your order!', { size: 9, bold: true, align: 'center', gap: 3 });
  pushText(`Issued by: ${invoice.issued_by_name || 'System'}`, { size: 7, color: gray, align: 'center', gap: 0 });

  const top = 12;
  const bottom = 12;
  const height = top + bottom + operations.reduce((sum, operation) => sum + (operation.type === 'rule' ? 10 : operation.size + operation.gap), 0);
  const page = doc.addPage([width, height]);
  let y = height - top;
  for (const operation of operations) {
    if (operation.type === 'rule') {
      y -= 3;
      page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.6, color: rulesColor });
      y -= 7;
      continue;
    }

    y -= operation.size;
    if (operation.type === 'pair') {
      page.drawText(operation.left, { x: margin, y, size: operation.size, font: operation.font, color: operation.color });
      const valueWidth = operation.font.widthOfTextAtSize(operation.right, operation.size);
      page.drawText(operation.right, { x: width - margin - valueWidth, y, size: operation.size, font: operation.font, color: operation.color });
    } else {
      const textWidth = operation.font.widthOfTextAtSize(operation.text, operation.size);
      const x = operation.align === 'center' ? (width - textWidth) / 2
        : operation.align === 'right' ? width - margin - textWidth : margin;
      page.drawText(operation.text, { x, y, size: operation.size, font: operation.font, color: operation.color });
    }
    y -= operation.gap;
  }

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

module.exports = { createInvoiceForOrder, getInvoiceById, buildInvoicePdf, generateInvoiceNumber };
