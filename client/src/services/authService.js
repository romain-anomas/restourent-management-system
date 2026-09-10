import api from './api';

export const authService = {
  async login({ email, password, role }) {
    const { data } = await api.post('/auth/login', { email, password, role });
    return data.data; // { token, user }
  },

  async getCurrentUser() {
    const { data } = await api.get('/auth/me');
    return data.data;
  },

  async changePassword({ currentPassword, newPassword }) {
    const { data } = await api.post('/auth/change-password', { currentPassword, newPassword });
    return data;
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  },
};
