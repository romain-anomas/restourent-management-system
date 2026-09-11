import api from './api';

export const notificationService = {
  async list({ unreadOnly } = {}) {
    const { data } = await api.get('/notifications', { params: { unreadOnly: unreadOnly ? '1' : undefined } });
    return { items: data.data, unreadCount: data.unreadCount };
  },

  async markAsRead(id) {
    const { data } = await api.patch(`/notifications/${id}/read`);
    return data;
  },

  async markAllAsRead() {
    const { data } = await api.patch('/notifications/read-all');
    return data;
  },
};
