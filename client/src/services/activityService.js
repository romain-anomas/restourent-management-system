import api from './api';

export const activityService = {
  async list({ userId } = {}) {
    const { data } = await api.get('/activity', { params: { userId } });
    return data.data;
  },
};
