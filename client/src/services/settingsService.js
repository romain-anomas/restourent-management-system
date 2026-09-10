import api from './api';

export const settingsService = {
  async getPublic() {
    const { data } = await api.get('/settings/public');
    return data.data;
  },
};
