export function formatMoney(amount, currency = 'RWF') {
  const value = Number(amount) || 0;
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${currency}`;
}

export function formatTableLabel(table) {
  if (!table) return 'Table';
  const number = table.table_number ? `Table ${table.table_number}` : 'Table';
  return table.table_name ? `${number} · ${table.table_name}` : number;
}
