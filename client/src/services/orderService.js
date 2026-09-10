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

  async list({ status, search, from, to } = {}) {
    const { data } = await api.get('/orders', { params: { status, search, from, to } });
    return data.data;
  },

  async getById(id) {
    const { data } = await api.get(`/orders/${id}`);
    return data.data;
  },

  async updateStatus(id, status, note) {
    const { data } = await api.put(`/orders/${id}/status`, { status, note });
    return data;
  },
};
