import api from './api';

export const paymentService = {
  async checkMomoStatus(orderNumber) {
    const { data } = await api.get(`/payments/momo/status/${orderNumber}`);
    return data.data;
  },

  async retryMomoRequest(orderNumber) {
    const { data } = await api.post(`/payments/momo/retry/${orderNumber}`);
    return data;
  },

  async validateMomoNumber(phone) {
    const { data } = await api.get(`/payments/momo/validate/${encodeURIComponent(phone)}`);
    return data.data.valid; // true | false | null
  },

  async retryCardCheckout(orderNumber) {
    const { data } = await api.post(`/payments/card/checkout/${encodeURIComponent(orderNumber)}`);
    return data.data.checkoutUrl;
  },

  async verifyCardPayment(orderNumber, { transactionId, txRef }) {
    const { data } = await api.post(`/payments/card/verify/${encodeURIComponent(orderNumber)}`, { transactionId, txRef });
    return data.data;
  },
};
