const { summarizeSalesOrders, resolveTableStatus, calculateTableSessionTotal } = require('../src/services/reportService');

describe('sales aggregation logic', () => {
  test('counts only paid completed orders in total sales', () => {
    const orders = [
      { payment_status: 'paid', status: 'completed', total_amount: 12000, created_at: '2026-09-27 10:00:00' },
      { payment_status: 'paid', status: 'completed', total_amount: 8500, created_at: '2026-09-27 18:00:00' },
      { payment_status: 'unpaid', status: 'pending', total_amount: 5000, created_at: '2026-09-27 15:00:00' },
      { payment_status: 'paid', status: 'cancelled', total_amount: 3000, created_at: '2026-09-27 09:00:00' },
      { payment_status: 'refunded', status: 'completed', total_amount: 7000, created_at: '2026-09-27 11:00:00' },
    ];

    const summary = summarizeSalesOrders(orders, '2026-09-27', '2026-09-27');

    expect(summary.totalSales).toBe(20500);
    expect(summary.numberOfOrders).toBe(2);
    expect(summary.paidOrders).toBe(2);
    expect(summary.pendingOrders).toBe(0);
    expect(summary.cancelledOrders).toBe(0);
  });

  test('handles custom date ranges and does not count cancelled or unpaid orders', () => {
    const orders = [
      { payment_status: 'paid', status: 'completed', total_amount: 1000, created_at: '2026-09-01 08:00:00' },
      { payment_status: 'unpaid', status: 'confirmed', total_amount: 2000, created_at: '2026-09-10 09:00:00' },
      { payment_status: 'paid', status: 'completed', total_amount: 3000, created_at: '2026-09-15 11:30:00' },
      { payment_status: 'cancelled', status: 'cancelled', total_amount: 1500, created_at: '2026-09-20 17:00:00' },
      { payment_status: 'paid', status: 'completed', total_amount: 4000, created_at: '2026-09-30 20:00:00' },
    ];

    const summary = summarizeSalesOrders(orders, '2026-09-01', '2026-09-30');

    expect(summary.totalSales).toBe(8000);
    expect(summary.numberOfOrders).toBe(3);
    expect(summary.paidOrders).toBe(3);
  });
});

describe('table session logic', () => {
  test('keeps all dine-in orders in the same active table session total', () => {
    const orders = [
      { id: 1, total_amount: 8000, table_session_id: 10, payment_status: 'paid', status: 'completed' },
      { id: 2, total_amount: 5500, table_session_id: 10, payment_status: 'paid', status: 'completed' },
      { id: 3, total_amount: 3000, table_session_id: 10, payment_status: 'unpaid', status: 'confirmed' },
    ];

    expect(calculateTableSessionTotal(orders)).toBe(16500);
    expect(resolveTableStatus('ORDERING')).toBe('ORDERING');
  });
});
