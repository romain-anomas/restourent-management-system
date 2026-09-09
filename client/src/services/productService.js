import api from './api';

export const productService = {
  async getAll({ category, search, limit } = {}) {
    const { data } = await api.get('/products', { params: { category, search, limit } });
    return data.data;
  },

  async getById(id) {
    const { data } = await api.get(`/products/${id}`);
    return data.data;
  },
};
