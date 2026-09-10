import api from './api';

export const dashboardService = {
  async getStats() {
    const { data } = await api.get('/dashboard');
    return data.data;
  },
};
