import api from './api';

export const inventoryService = {
  async listTransactions({ productId, type, from, to } = {}) {
    const { data } = await api.get('/inventory', { params: { productId, type, from, to } });
    return data.data;
  },

  async stockIn(payload) {
    const { data } = await api.post('/inventory/stock-in', payload);
    return data;
  },

  async stockOut(payload) {
    const { data } = await api.post('/inventory/stock-out', payload);
    return data;
  },

  async adjustment(payload) {
    const { data } = await api.post('/inventory/adjustment', payload);
    return data;
  },
};
