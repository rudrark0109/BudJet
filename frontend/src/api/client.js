const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });
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
};

export function getUserId() {
  // Try Firebase UID from localStorage
  return localStorage.getItem('uid') || localStorage.getItem('userId') || '';
}
