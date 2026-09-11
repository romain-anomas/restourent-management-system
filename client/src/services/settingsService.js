import api from './api';

export const settingsService = {
  async getPublic() {
    const { data } = await api.get('/settings/public');
    return data.data;
  },

  async getAdmin() {
    const { data } = await api.get('/settings');
    return data.data;
  },

  async update(payload) {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (key === 'logoFile' && value) {
        formData.append('image', value);
      } else if (key !== 'logoFile') {
        formData.append(key, value);
      }
    });
    const { data } = await api.put('/settings', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
};
