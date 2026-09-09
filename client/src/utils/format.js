export function formatMoney(amount, currency = 'RWF') {
  const value = Number(amount) || 0;
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${currency}`;
}
