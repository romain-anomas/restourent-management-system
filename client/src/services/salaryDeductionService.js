import api from './api';

export const salaryDeductionService = {
  async list({ status, workerId } = {}) {
    const { data } = await api.get('/salary-deductions', { params: { status, workerId } });
    return data.data;
  },

  async review(id, action) {
    const { data } = await api.put(`/salary-deductions/${id}/review`, { action });
    return data;
  },
};
