export default function ComingSoon({ title }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
      <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-gray-500">
        This section will be built in an upcoming phase and will connect to real data from the database.
      </p>
    </div>
  );
}
