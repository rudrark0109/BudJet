import { api } from './client';

export function fetchBudgets(userId) {
  return api.get(`/api/budgets/${encodeURIComponent(userId)}`);
}
