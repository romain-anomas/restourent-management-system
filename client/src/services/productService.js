import api from './api';

export const productService = {
  async getAll({ category, search, limit, all } = {}) {
    const { data } = await api.get('/products', { params: { category, search, limit, all: all ? '1' : undefined } });
    return data.data;
  },

  async getById(id) {
    const { data } = await api.get(`/products/${id}`);
    return data.data;
  },

  async getLowStock() {
    const { data } = await api.get('/products/low-stock');
    return data.data;
  },

  /**
   * `payload` is a plain object; if it contains an `imageFile`, this is
   * sent as multipart/form-data, otherwise as a normal JSON-ish form body.
   */
  async create(payload) {
    const formData = toFormData(payload);
    const { data } = await api.post('/products', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async update(id, payload) {
    const formData = toFormData(payload);
    const { data } = await api.put(`/products/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async toggleStatus(id, isActive) {
    const { data } = await api.patch(`/products/${id}/status`, { isActive });
    return data;
  },

  async remove(id) {
    const { data } = await api.delete(`/products/${id}`);
    return data;
  },
};

function toFormData(payload) {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (key === 'imageFile' && value) {
      formData.append('image', value);
    } else if (key !== 'imageFile') {
      formData.append(key, value);
    }
  });
  return formData;
}
