import api from './api';

export const tableService = {
  async getPublicTables() {
    const { data } = await api.get('/tables/public');
    return data.data;
  },

  async getGuestSession(sessionId, token) {
    const { data } = await api.get(`/tables/public/session/${sessionId}`, { headers: { 'x-table-session-token': token } });
    return data.data;
  },

  async list(params) {
    const { data } = await api.get('/tables', { params });
    return data.data;
  },

  async getSeatingPlan() {
    const { data } = await api.get('/tables/seating-plan');
    return data.data;
  },

  async getOrders(tableId) {
    const { data } = await api.get(`/tables/${tableId}/orders`);
    return data.data;
  },

  async create(payload) {
    const { data } = await api.post('/tables', payload);
    return data.data;
  },

  async update(id, payload) {
    const { data } = await api.put(`/tables/${id}`, payload);
    return data.data;
  },

  async remove(id) {
    const { data } = await api.delete(`/tables/${id}`);
    return data;
  },

  async openSession(tableId) {
    const { data } = await api.post(`/tables/${tableId}/session`);
    return data.data;
  },

  async closeSession(tableId) {
    const { data } = await api.post(`/tables/${tableId}/session/close`);
    return data.data;
  },
};
