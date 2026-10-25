import { useState } from 'react';
import toast from 'react-hot-toast';
import { FiDownload, FiPrinter } from 'react-icons/fi';
import { reportService } from '../../services/reportService';
import { formatMoney } from '../../utils/format';
import LoadingScreen from '../../components/LoadingScreen';

const TABS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'custom', label: 'Custom' },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminReports() {
  const [tab, setTab] = useState('daily');
  const [date, setDate] = useState(todayStr());
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [customFrom, setCustomFrom] = useState(todayStr());
  const [customTo, setCustomTo] = useState(todayStr());

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const generate = async () => {
    setLoading(true);
    setReport(null);
    try {
      let data;
      if (tab === 'daily') data = await reportService.getDaily(date);
      else if (tab === 'weekly') data = await reportService.getWeekly(date);
      else if (tab === 'monthly') data = await reportService.getMonthly(year, month);
      else data = await reportService.getCustom(customFrom, customTo);
      setReport(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate report.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      if (tab === 'daily') await reportService.exportDaily(date);
      else if (tab === 'weekly') await reportService.exportWeekly(date, report?.period.from || date);
      else if (tab === 'monthly') await reportService.exportMonthly(year, month);
      else await reportService.exportCustom(customFrom, customTo);
    } catch {
      toast.error('Failed to export report.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="mb-5 no-print">
        <h1 className="text-xl font-bold text-ink-900">Reports</h1>
        <p className="text-sm text-gray-500">Business performance over a chosen period, calculated from real data.</p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2 no-print">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setReport(null); }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t.id ? 'bg-brand-600 text-white' : 'border border-gray-200 text-gray-600 hover:border-brand-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm no-print">
        {tab === 'daily' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        )}
        {tab === 'weekly' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Any date in the week</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        )}
        {tab === 'monthly' && (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Month</label>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Year</label>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </>
        )}
        {tab === 'custom' && (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">From</label>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">To</label>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </>
        )}
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Generating...' : 'Generate Report'}
        </button>

        {report && (
          <div className="ml-auto flex gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <FiDownload size={14} /> Export CSV
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FiPrinter size={14} /> Print
            </button>
          </div>
        )}
      </div>

      {loading && <LoadingScreen label="Crunching the numbers..." />}

      {report && !loading && (
        <div>
          <h2 className="mb-4 text-sm font-semibold text-gray-500">
            Report period: {report.period.from} to {report.period.to}
          </h2>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <ReportStat label="Total Sales" value={formatMoney(report.finance.totalSales || report.orders.totalSales || 0)} />
            <ReportStat label="Total Orders" value={report.orders.total} />
            <ReportStat label="Paid Orders" value={report.orders.paidOrders || report.orders.completed || 0} />
            <ReportStat label="Cancelled Orders" value={report.orders.cancelledOrders || report.orders.cancelled || 0} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <ReportStat label="Pending Orders" value={report.orders.pendingOrders || report.orders.pending || 0} />
            <ReportStat label="Revenue" value={formatMoney(report.finance.revenue)} />
            <ReportStat label="Expenses" value={formatMoney(report.finance.expenses)} />
            <ReportStat
              label="Estimated Profit"
              value={formatMoney(report.finance.estimatedProfit)}
              tone={report.finance.estimatedProfit >= 0 ? 'success' : 'danger'}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <ReportStat label="Stock In (units)" value={report.stockMovements.stockIn} />
            <ReportStat label="Stock Out (units)" value={report.stockMovements.stockOut} />
            <ReportStat label="Adjustments" value={report.stockMovements.adjustments} />
            <ReportStat label="Worker Takings" value={report.stockMovements.workerTakings} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-ink-900">Top Products Sold</h3>
              {report.productsSold.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">No sales in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[320px] text-sm">
                    <thead className="text-left text-xs uppercase text-gray-400">
                      <tr><th className="pb-2">Product</th><th className="pb-2">Qty</th><th className="pb-2 text-right">Revenue</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {report.productsSold.map((p, i) => (
                        <tr key={i}>
                          <td className="py-1.5">{p.name}</td>
                          <td className="py-1.5">{p.quantity}</td>
                          <td className="py-1.5 text-right">{formatMoney(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-ink-900">Worker Activity</h3>
              {report.workerActivity.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">No worker activity in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[240px] text-sm">
                    <thead className="text-left text-xs uppercase text-gray-400">
                      <tr><th className="pb-2">Worker</th><th className="pb-2 text-right">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {report.workerActivity.map((w, i) => (
                        <tr key={i}>
                          <td className="py-1.5">{w.worker_name}</td>
                          <td className="py-1.5 text-right">{w.actions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!report && !loading && (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center text-sm text-gray-500 no-print">
          Choose a period and click "Generate Report" to see results.
        </div>
      )}
    </div>
  );
}

function ReportStat({ label, value, tone = 'default' }) {
  const toneClasses = { default: 'bg-white text-ink-900', danger: 'bg-red-50 text-red-700', success: 'bg-green-50 text-green-700' };
  return (
    <div className={`rounded-xl p-4 shadow-sm ring-1 ring-black/5 ${toneClasses[tone]}`}>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
}
