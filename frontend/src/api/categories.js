import { api } from './client';

export function fetchCategories(userId) {
  return api.get(`/api/categories/${encodeURIComponent(userId)}`);
}

export function createCategory({ user_id, name, type, color }) {
  return api.post('/api/categories', { user_id, name, type, color });
}
