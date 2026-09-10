export default function StatCard({ label, value, icon: Icon, tone = 'default' }) {
  const toneClasses = {
    default: 'bg-white text-ink-900',
    danger: 'bg-red-50 text-red-700',
    success: 'bg-green-50 text-green-700',
  };

  return (
    <div className={`rounded-xl p-4 shadow-sm ring-1 ring-black/5 ${toneClasses[tone]}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        {Icon && <Icon className="text-gray-300" size={18} />}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
