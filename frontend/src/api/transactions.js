import { api } from './client';

export function fetchTransactions(userId) {
  return api.get(`/api/transactions/${encodeURIComponent(userId)}`);
}

export function fetchSummary(userId) {
  return api.get(`/api/transactions/summary/${encodeURIComponent(userId)}`);
}

export function createTransaction(payload) {
  return api.post('/api/transactions', payload);
}
