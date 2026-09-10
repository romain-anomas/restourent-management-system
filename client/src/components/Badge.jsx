const COLOR_MAP = {
  // Order statuses
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  confirmed: 'bg-blue-50 text-blue-700 ring-blue-200',
  preparing: 'bg-purple-50 text-purple-700 ring-purple-200',
  ready: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  completed: 'bg-green-50 text-green-700 ring-green-200',
  cancelled: 'bg-red-50 text-red-700 ring-red-200',
  // Generic
  active: 'bg-green-50 text-green-700 ring-green-200',
  disabled: 'bg-red-50 text-red-700 ring-red-200',
  paid: 'bg-green-50 text-green-700 ring-green-200',
  unpaid: 'bg-amber-50 text-amber-700 ring-amber-200',
  refunded: 'bg-gray-100 text-gray-600 ring-gray-200',
  approved: 'bg-green-50 text-green-700 ring-green-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
  deducted: 'bg-blue-50 text-blue-700 ring-blue-200',
  default: 'bg-gray-100 text-gray-600 ring-gray-200',
};

export default function Badge({ status, children }) {
  const key = (status || '').toLowerCase();
  const classes = COLOR_MAP[key] || COLOR_MAP.default;

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${classes}`}>
      {children || status}
    </span>
  );
}
