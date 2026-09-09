const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const orderService = require('../services/orderService');
const { createNotification } = require('../services/notificationService');

/**
 * POST /api/orders
 * Public checkout endpoint. Body:
 *   { customerName, customerPhone, customerAddress?, notes?, items: [{productId, quantity}] }
 */
const createOrder = asyncHandler(async (req, res) => {
  const { customerName, customerPhone, customerAddress, notes, items } = req.body;

  if (!customerName?.trim() || !customerPhone?.trim()) {
    throw new ApiError(400, 'Customer name and phone number are required.');
  }

  const order = await orderService.createOrder({
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim(),
    customerAddress: customerAddress?.trim(),
    notes: notes?.trim(),
    items,
  });

  // Notify staff of the new order (both admin and worker dashboards will read this)
  await createNotification({
    recipientRole: 'all',
    type: 'new_order',
    title: 'New order received',
    message: `Order ${order.orderNumber} from ${customerName} - ${order.items.length} item(s)`,
    relatedType: 'order',
    relatedId: order.id,
  });

  res.status(201).json({
    success: true,
    message: 'Order placed successfully.',
    data: order,
  });
});

/**
 * GET /api/orders/track/:orderNumber
 * Public. Used by the order-confirmation page (and by customers checking status later).
 */
const trackOrder = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderByNumber(req.params.orderNumber);
  res.json({ success: true, data: order });
});

module.exports = { createOrder, trackOrder };
