import { api } from './client';

export function fetchJobs(userId) {
  return api.get(`/api/jobs/${encodeURIComponent(userId)}`);
}

export function createJob(payload) {
  return api.post('/api/jobs', payload);
}

export function updateJob(jobId, payload) {
  return api.patch(`/api/jobs/${encodeURIComponent(jobId)}`, payload);
}

export function fetchShifts(userId, month) {
  const monthQuery = month ? `?month=${encodeURIComponent(month)}` : '';
  return api.get(`/api/shifts/${encodeURIComponent(userId)}${monthQuery}`);
}

export function clockInShift(payload) {
  return api.post('/api/shifts/clock-in', payload);
}

export function clockOutShift(shiftId, payload) {
  return api.patch(`/api/shifts/${encodeURIComponent(shiftId)}/clock-out`, payload);
}

export function updateShift(shiftId, payload) {
  return api.patch(`/api/shifts/${encodeURIComponent(shiftId)}`, payload);
}

export function fetchPayCycleEstimate(userId, year, month) {
  const query = new URLSearchParams();
  if (year) {
    query.set('year', String(year));
  }
  if (month) {
    query.set('month', String(month));
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return api.get(`/api/shifts/pay-cycle/${encodeURIComponent(userId)}${suffix}`);
}
