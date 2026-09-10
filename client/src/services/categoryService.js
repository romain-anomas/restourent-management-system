import api from './api';

export const categoryService = {
  async getAll({ all } = {}) {
    const { data } = await api.get('/categories', { params: { all: all ? '1' : undefined } });
    return data.data;
  },

  async create(payload) {
    const { data } = await api.post('/categories', payload);
    return data;
  },

  async update(id, payload) {
    const { data } = await api.put(`/categories/${id}`, payload);
    return data;
  },

  async toggleStatus(id, isActive) {
    const { data } = await api.patch(`/categories/${id}/status`, { isActive });
    return data;
  },

  async remove(id) {
    const { data } = await api.delete(`/categories/${id}`);
    return data;
  },
};
