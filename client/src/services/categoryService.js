import api from './api';

export const categoryService = {
  async getAll() {
    const { data } = await api.get('/categories');
    return data.data;
  },
};
