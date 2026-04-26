import { auth } from '../firebase';

const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function buildAuthHeader(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) {
    return {};
  }

  try {
    const token = await user.getIdToken(forceRefresh);
    if (!token) {
      return {};
    }
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

async function request(path, options = {}, retry = true) {
  const url = `${baseUrl}${path}`;
  const authHeader = await buildAuthHeader();
  const headers = {
    'Content-Type': 'application/json',
    ...authHeader,
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401 && retry) {
    const refreshedHeader = await buildAuthHeader(true);
    const retryHeaders = { 'Content-Type': 'application/json', ...refreshedHeader, ...(options.headers || {}) };
    const retryRes = await fetch(url, { ...options, headers: retryHeaders });
    if (!retryRes.ok) {
      let message = `HTTP ${retryRes.status}`;
      try {
        const data = await retryRes.json();
        message = data.error || message;
      } catch {}
      throw new Error(message);
    }
    try {
      return await retryRes.json();
    } catch {
      return null;
    }
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {}
    throw new Error(message);
  }
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path, body) => request(path, { method: 'DELETE', body: JSON.stringify(body) }),
};

export function getUserId() {
  // Try Firebase UID from localStorage
  return localStorage.getItem('uid') || localStorage.getItem('userId') || '';
}
