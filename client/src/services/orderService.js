import api from './api';

export const orderService = {
  async create(payload) {
    const { data } = await api.post('/orders', payload);
    return data.data;
  },

  async trackByNumber(orderNumber) {
    const { data } = await api.get(`/orders/track/${orderNumber}`);
    return data.data;
  },
};
