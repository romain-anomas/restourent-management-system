import api from './api';

export const invoiceService = {
  async generate(orderId) {
    const { data } = await api.post(`/invoices/generate/${orderId}`);
    return data.data;
  },

  async list({ search, paymentStatus } = {}) {
    const { data } = await api.get('/invoices', { params: { search, paymentStatus } });
    return data.data;
  },

  async getById(id) {
    const { data } = await api.get(`/invoices/${id}`);
    return data.data;
  },

  async updatePaymentStatus(id, paymentStatus) {
    const { data } = await api.patch(`/invoices/${id}/payment-status`, { paymentStatus });
    return data;
  },

  /**
   * Fetches the PDF as a blob (the endpoint needs the JWT bearer header,
   * so a plain <a href> can't be used) and opens it in a new tab - the
   * browser's native PDF viewer then handles printing/saving.
   */
  async openPdf(id) {
    const response = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },

  /** Downloads the PDF directly instead of opening it. */
  async downloadPdf(id, filename) {
    const response = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `invoice-${id}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
