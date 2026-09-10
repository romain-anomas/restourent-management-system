import api from './api';

export const workerService = {
  async list({ search } = {}) {
    const { data } = await api.get('/workers', { params: { search } });
    return data.data;
  },

  async getById(id) {
    const { data } = await api.get(`/workers/${id}`);
    return data.data;
  },

  async create(payload) {
    const { data } = await api.post('/workers', payload);
    return data;
  },

  async update(id, payload) {
    const { data } = await api.put(`/workers/${id}`, payload);
    return data;
  },

  async toggleStatus(id, status) {
    const { data } = await api.patch(`/workers/${id}/status`, { status });
    return data;
  },

  async resetPassword(id, newPassword) {
    const { data } = await api.post(`/workers/${id}/reset-password`, { newPassword });
    return data;
  },
};
