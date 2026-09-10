import api from './api';

async function fetchReport(endpoint, params) {
  const { data } = await api.get(`/reports/${endpoint}`, { params });
  return data.data;
}

async function downloadCsv(endpoint, params, filename) {
  const response = await api.get(`/reports/${endpoint}`, { params: { ...params, format: 'csv' }, responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const reportService = {
  getDaily: (date) => fetchReport('daily', { date }),
  getWeekly: (date) => fetchReport('weekly', { date }),
  getMonthly: (year, month) => fetchReport('monthly', { year, month }),
  getCustom: (from, to) => fetchReport('custom', { from, to }),

  exportDaily: (date) => downloadCsv('daily', { date }, `daily-report-${date}.csv`),
  exportWeekly: (date, label) => downloadCsv('weekly', { date }, `weekly-report-${label}.csv`),
  exportMonthly: (year, month) => downloadCsv('monthly', { year, month }, `monthly-report-${year}-${month}.csv`),
  exportCustom: (from, to) => downloadCsv('custom', { from, to }, `report-${from}_to_${to}.csv`),
};
