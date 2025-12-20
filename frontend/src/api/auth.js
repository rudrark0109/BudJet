import { api } from './client';

export function fetchUserProfile(uid) {
  return api.get(`/api/auth/user/${encodeURIComponent(uid)}`);
}

export function registerUser({ uid, email, displayName }) {
  return api.post('/api/auth/register', { uid, email, displayName });
}

export function loginUser(uid) {
  return api.post('/api/auth/login', { uid });
}
