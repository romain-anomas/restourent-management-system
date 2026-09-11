import api from './api';

export const expenseService = {
  async list({ category, from, to, search } = {}) {
    const { data } = await api.get('/expenses', { params: { category, from, to, search } });
    return { items: data.data, total: data.total };
  },

  async create(payload) {
    const { data } = await api.post('/expenses', payload);
    return data;
  },

  async update(id, payload) {
    const { data } = await api.put(`/expenses/${id}`, payload);
    return data;
  },

  async remove(id) {
    const { data } = await api.delete(`/expenses/${id}`);
    return data;
  },
};
