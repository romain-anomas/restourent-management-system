import api from './api';

export const workerStockService = {
  async list({ status, workerId } = {}) {
    const { data } = await api.get('/worker-stock', { params: { status, workerId } });
    return data.data;
  },

  async getById(id) {
    const { data } = await api.get(`/worker-stock/${id}`);
    return data.data;
  },

  async create(payload) {
    const { data } = await api.post('/worker-stock', payload);
    return data;
  },

  async review(id, action, notes) {
    const { data } = await api.put(`/worker-stock/${id}/review`, { action, notes });
    return data;
  },
};
