import { useEffect, useMemo, useState } from 'react';
import { Navbar } from './components/Navbar';
import { getUserId } from './api/client';
import { createTransaction } from './api/transactions';
import {
  clockInShift,
  clockOutShift,
  createJob,
  deleteShift,
  fetchJobs,
  fetchPayCycleEstimate,
  fetchShifts,
  updateJob,
  updateShift,
} from './api/shifts';

function nowAsTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function todayAsDate() {
  return new Date().toISOString().split('T')[0];
}

function monthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function fortnightLabel(payout) {
  const today = new Date();
  const m = today.toLocaleString('default', { month: 'short' });
  const y = today.getFullYear();
  if (payout === '16th') return `${m} 1–15 ${y}`;
  const last = new Date(y, today.getMonth() + 1, 0).getDate();
  return `${m} 16–${last} ${y}`;
}

export default function ShiftsPage() {
  const userId = useMemo(() => getUserId(), []);

  const [jobs, setJobs] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [payCycle, setPayCycle] = useState(null);
  const [month, setMonth] = useState(monthValue());
  const [status, setStatus] = useState('');

  const [jobName, setJobName] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');

  const [draftByJob, setDraftByJob] = useState({});

  function ensureDraft(jobId) {
    return (
      draftByJob[jobId] || {
        shift_date: todayAsDate(),
        clock_in: nowAsTime(),
        clock_out: nowAsTime(),
      }
    );
  }

  async function loadData() {
    if (!userId) return;
    try {
      const [jobRows, shiftRows, payCycleData] = await Promise.all([
        fetchJobs(userId),
        fetchShifts(userId, month),
        fetchPayCycleEstimate(userId, Number(month.split('-')[0]), Number(month.split('-')[1])),
      ]);
      setJobs(jobRows);
      setShifts(shiftRows);
      setPayCycle(payCycleData);
    } catch (err) {
      setStatus(err.message);
    }
  }

  useEffect(() => {
    loadData();
  }, [userId, month]);

  // Fortnight stats computed from current shifts list
  const fortnightStats = useMemo(() => {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const isFirstHalf = dayOfMonth <= 15;
    const fortnightStart = isFirstHalf ? 1 : 16;
    const fortnightEnd = isFirstHalf ? 15 : new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    const selectedYear = Number(month.split('-')[0]);
    const selectedMonth = Number(month.split('-')[1]);
    const isCurrentMonth = selectedYear === today.getFullYear() && selectedMonth === (today.getMonth() + 1);

    const relevant = isCurrentMonth
      ? shifts.filter((s) => {
          const d = new Date(s.shift_date);
          const day = d.getDate();
          return day >= fortnightStart && day <= fortnightEnd;
        })
      : shifts;

    const totalHours = relevant.reduce((sum, s) => sum + Number(s.hours_worked || 0), 0);
    const uniqueDays = new Set(relevant.map((s) => String(s.shift_date).split('T')[0])).size;
    const avgHoursPerDay = uniqueDays > 0 ? totalHours / uniqueDays : 0;

    return { totalHours, avgHoursPerDay, uniqueDays, isCurrentMonth, fortnightStart, fortnightEnd };
  }, [shifts, month]);

  async function handleCreateJob(e) {
    e.preventDefault();
    if (!jobName.trim() || !hourlyRate) {
      setStatus('Enter both job name and hourly pay.');
      return;
    }
    try {
      await createJob({ user_id: userId, name: jobName.trim(), hourly_rate: Number(hourlyRate) });
      setJobName('');
      setHourlyRate('');
      setStatus('Job added.');
      await loadData();
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function handleClockIn(jobId) {
    const draft = ensureDraft(jobId);
    try {
      await clockInShift({ user_id: userId, job_id: jobId, shift_date: draft.shift_date, clock_in: draft.clock_in });
      setStatus('Clock in saved.');
      await loadData();
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function handleClockOut(jobId, shiftId) {
    const draft = ensureDraft(jobId);
    if (!shiftId) { setStatus('No active shift found for this job.'); return; }
    try {
      await clockOutShift(shiftId, { user_id: userId, clock_out: draft.clock_out });
      setStatus('Clock out saved.');
      await loadData();
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function handleUpdateShift(jobId, shiftId) {
    const draft = ensureDraft(jobId);
    if (!shiftId) { setStatus('Pick a shift from the history list to edit times.'); return; }
    try {
      await updateShift(shiftId, { user_id: userId, shift_date: draft.shift_date, clock_in: draft.clock_in, clock_out: draft.clock_out });
      setStatus('Shift updated.');
      await loadData();
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function handleUpdateRate(job) {
    const rate = Number(prompt(`Update hourly pay for ${job.name}`, String(job.hourly_rate)));
    if (!Number.isFinite(rate)) return;
    try {
      await updateJob(job.id, { user_id: userId, hourly_rate: rate });
      setStatus('Hourly pay updated.');
      await loadData();
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function handleDeleteShift(shiftId) {
    if (!confirm('Delete this shift? This cannot be undone.')) return;
    try {
      await deleteShift(shiftId, userId);
      setStatus('Shift deleted.');
      await loadData();
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function handleSalaryReceived(amount, label) {
    if (!amount || amount <= 0) { setStatus('No pending salary to record.'); return; }
    try {
      await createTransaction({
        user_id: userId,
        amount,
        description: `Salary received — ${label}`,
        type: 'income',
        transaction_date: todayAsDate(),
      });
      setStatus(`$${amount.toFixed(2)} recorded as income.`);
    } catch (err) {
      setStatus(err.message);
    }
  }

  const activeShiftByJobId = useMemo(() => {
    const map = {};
    for (const s of shifts) {
      if (!s.clock_out && !map[s.job_id]) map[s.job_id] = s;
    }
    return map;
  }, [shifts]);

  const cardStyle = {
    border: '1px solid #334155',
    background: 'rgba(15, 23, 42, 0.65)',
    borderRadius: '12px',
    padding: '14px',
  };

  const inputStyle = {
    background: '#0f172a',
    border: '1px solid #334155',
    color: '#e2e8f0',
    padding: '8px 10px',
    borderRadius: '8px',
  };

  return (
    <div className="main-container">
      <div className="gradient-blob"></div>
      <div className="content-wrapper">
        <Navbar />
        <div style={{ padding: '80px 24px 24px 24px' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ color: '#fff', fontSize: '28px', marginBottom: '4px' }}>Shift Time Entry</h1>
            <p style={{ color: '#cbd5e1', marginBottom: '20px' }}>
              Track jobs, clock in/out times, and expected salary for semi-monthly payouts.
            </p>

            {/* Month selector */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '18px' }}>
              <label style={{ color: '#cbd5e1' }}>Month</label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Quick stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '18px' }}>
              <div style={{ ...cardStyle, padding: '16px' }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>
                  Avg Hours / Day Worked
                </div>
                <div style={{ color: '#fff', fontSize: '26px', fontWeight: 700 }}>
                  {fortnightStats.avgHoursPerDay.toFixed(1)}h
                </div>
                <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>
                  across {fortnightStats.uniqueDays} day{fortnightStats.uniqueDays !== 1 ? 's' : ''}
                  {fortnightStats.isCurrentMonth ? ` · this fortnight` : ''}
                </div>
              </div>
              <div style={{ ...cardStyle, padding: '16px' }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>
                  Total Hours
                  {fortnightStats.isCurrentMonth
                    ? ` · Fortnight (${fortnightStats.fortnightStart}–${fortnightStats.fortnightEnd})`
                    : ' · Month'}
                </div>
                <div style={{ color: '#fff', fontSize: '26px', fontWeight: 700 }}>
                  {fortnightStats.totalHours.toFixed(1)}h
                </div>
                <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>
                  {shifts.length} shift{shifts.length !== 1 ? 's' : ''} logged
                </div>
              </div>
            </div>

            {/* Add job form */}
            <form
              onSubmit={handleCreateJob}
              style={{ ...cardStyle, marginBottom: '18px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}
            >
              <input
                placeholder="Job name"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                style={{ flex: '1 1 220px', ...inputStyle }}
              />
              <input
                placeholder="Hourly pay"
                type="number"
                step="0.01"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                style={{ width: '160px', ...inputStyle }}
              />
              <button type="submit" className="btn" style={{ background: '#2563eb' }}>
                Add Job
              </button>
            </form>

            {/* Job cards */}
            <div style={{ display: 'grid', gap: '14px', marginBottom: '18px' }}>
              {jobs.map((job) => {
                const active = activeShiftByJobId[job.id];
                const draft = ensureDraft(job.id);
                const latestShiftForJob = shifts.find((s) => s.job_id === job.id);

                return (
                  <div key={job.id} style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                      <div>
                        <div style={{ color: '#fff', fontSize: '18px', fontWeight: 600 }}>{job.name}</div>
                        <div style={{ color: '#94a3b8' }}>${Number(job.hourly_rate).toFixed(2)} / hour</div>
                      </div>
                      <button className="btn" onClick={() => handleUpdateRate(job)} style={{ background: '#374151' }}>
                        Edit Hourly Pay
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                      <input
                        type="date"
                        value={draft.shift_date}
                        onChange={(e) =>
                          setDraftByJob((prev) => ({ ...prev, [job.id]: { ...ensureDraft(job.id), shift_date: e.target.value } }))
                        }
                        style={inputStyle}
                      />
                      <input
                        type="time"
                        value={draft.clock_in}
                        onChange={(e) =>
                          setDraftByJob((prev) => ({ ...prev, [job.id]: { ...ensureDraft(job.id), clock_in: e.target.value } }))
                        }
                        style={inputStyle}
                      />
                      <input
                        type="time"
                        value={draft.clock_out}
                        onChange={(e) =>
                          setDraftByJob((prev) => ({ ...prev, [job.id]: { ...ensureDraft(job.id), clock_out: e.target.value } }))
                        }
                        style={inputStyle}
                      />
                      <button className="btn" onClick={() => handleClockIn(job.id)} style={{ background: '#16a34a' }}>
                        Clock In
                      </button>
                      <button className="btn" onClick={() => handleClockOut(job.id, active?.id)} style={{ background: '#dc2626' }}>
                        Clock Out
                      </button>
                      <button className="btn" onClick={() => handleUpdateShift(job.id, latestShiftForJob?.id)} style={{ background: '#2563eb' }}>
                        Save Edit
                      </button>
                    </div>

                    <div style={{ marginTop: '8px', color: '#94a3b8', fontSize: '13px' }}>
                      {active
                        ? `Active shift: started ${active.clock_in} on ${String(active.shift_date).split('T')[0]}`
                        : 'No active shift'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Shifts history table */}
            <div style={{ ...cardStyle, marginBottom: '18px' }}>
              <h2 style={{ color: '#fff', fontSize: '18px', marginBottom: '8px' }}>Shifts in Selected Month</h2>
              {shifts.length === 0 ? (
                <p style={{ color: '#94a3b8' }}>No shifts recorded yet.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', color: '#e2e8f0' }}>
                    <thead>
                      <tr>
                        {['Date', 'Job', 'In', 'Out', 'Hours', 'Expected', ''].map((h, i) => (
                          <th key={h} style={{ textAlign: i >= 4 ? 'right' : 'left', borderBottom: '1px solid #334155', padding: '8px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {shifts.map((s) => (
                        <tr key={s.id}>
                          <td style={{ borderBottom: '1px solid #1f2937', padding: '8px' }}>{String(s.shift_date).split('T')[0]}</td>
                          <td style={{ borderBottom: '1px solid #1f2937', padding: '8px' }}>{s.job_name}</td>
                          <td style={{ borderBottom: '1px solid #1f2937', padding: '8px' }}>{s.clock_in}</td>
                          <td style={{ borderBottom: '1px solid #1f2937', padding: '8px' }}>{s.clock_out || '-'}</td>
                          <td style={{ borderBottom: '1px solid #1f2937', padding: '8px', textAlign: 'right' }}>{Number(s.hours_worked || 0).toFixed(2)}</td>
                          <td style={{ borderBottom: '1px solid #1f2937', padding: '8px', textAlign: 'right' }}>${Number(s.expected_earnings || 0).toFixed(2)}</td>
                          <td style={{ borderBottom: '1px solid #1f2937', padding: '8px', textAlign: 'right' }}>
                            <button
                              onClick={() => handleDeleteShift(s.id)}
                              style={{ background: 'transparent', border: '1px solid #7f1d1d', color: '#f87171', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontSize: '12px' }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Expected salary — moved to bottom */}
            {payCycle && (
              <div style={cardStyle}>
                <h2 style={{ color: '#fff', fontSize: '18px', marginBottom: '12px' }}>Expected Salary</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ background: '#111827', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '12px' }}>Days 1–15 (paid on 16th)</div>
                    <div style={{ color: '#4ade80', fontSize: '20px', fontWeight: 600 }}>
                      ${payCycle.expected_payouts.payout_on_16th.toFixed(2)}
                    </div>
                  </div>
                  <div style={{ background: '#111827', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '12px' }}>Days 16–end (paid on 1st)</div>
                    <div style={{ color: '#60a5fa', fontSize: '20px', fontWeight: 600 }}>
                      ${payCycle.expected_payouts.payout_on_1st_next_month.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    className="btn"
                    style={{ background: '#15803d', flex: '1 1 auto' }}
                    onClick={() =>
                      handleSalaryReceived(payCycle.expected_payouts.payout_on_16th, fortnightLabel('16th'))
                    }
                  >
                    Pending Salary Received — 16th Payout (${payCycle.expected_payouts.payout_on_16th.toFixed(2)})
                  </button>
                  <button
                    className="btn"
                    style={{ background: '#1d4ed8', flex: '1 1 auto' }}
                    onClick={() =>
                      handleSalaryReceived(payCycle.expected_payouts.payout_on_1st_next_month, fortnightLabel('1st'))
                    }
                  >
                    Pending Salary Received — 1st Payout (${payCycle.expected_payouts.payout_on_1st_next_month.toFixed(2)})
                  </button>
                </div>
              </div>
            )}

            {status && <p style={{ marginTop: '12px', color: '#fbbf24' }}>{status}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
