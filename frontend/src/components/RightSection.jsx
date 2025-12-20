import { PieChart, TrendingUp, BarChart3 } from 'lucide-react';
import { PieChart as RePieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

import { useEffect, useState } from 'react';
import { fetchSummary } from '../api/transactions';
import { fetchBudgets } from '../api/budgets';

export function RightSection({ userId, refreshKey }) {
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [weeklyTrend, setWeeklyTrend] = useState([]);
  const [savingsGoals, setSavingsGoals] = useState([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const data = await fetchSummary(userId);
        if (data?.categoryBreakdown) {
          setCategoryBreakdown(
            data.categoryBreakdown.map(c => ({ name: c.category, value: Number(c.amount) || 0, color: c.color || '#3b82f6' }))
          );
        }
        if (data?.monthlyTrend) {
          setWeeklyTrend(
            data.monthlyTrend.map(m => ({
              day: m.month,
              amount: Number(m.expenses) || 0,
            }))
          );
        }
      } catch (err) {
        console.warn('Summary fetch failed:', err.message);
      }
      try {
        const budgets = await fetchBudgets(userId);
        setSavingsGoals((budgets || []).map(b => ({
          goal: b.category_name,
          current: Number(b.current) || 0,
          target: Number(b.target) || 0,
          color: b.color,
        })));
      } catch (err) {
        console.warn('Budgets fetch failed:', err.message);
      }
    })();
  }, [userId, refreshKey]);
  return (
    <div className="right-section">
      <div className="spacing-8">
        <div className="section-title">
          <PieChart />
          <h3>Expense Breakdown</h3>
        </div>
        
        <div className="card">
          <ResponsiveContainer width="100%" height={200}>
            <RePieChart>
              <Pie
                data={categoryBreakdown}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {categoryBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
            </RePieChart>
          </ResponsiveContainer>
          <div className="legend">
            {categoryBreakdown.map((item) => (
              <div key={item.name} className="legend-item">
                <div className="flex items-center gap-2">
                  <div className="legend-color" style={{ backgroundColor: item.color }}></div>
                  <span className="legend-label">{item.name}</span>
                </div>
                <span className="legend-value">${item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="spacing-8">
        <div className="section-title">
          <TrendingUp />
          <h3>Weekly Trend</h3>
        </div>
        
        <div className="card">
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={weeklyTrend}>
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <div className="section-title">
          <BarChart3 />
          <h3>Savings Goals</h3>
        </div>
        
        <div className="goals-container">
          {savingsGoals.map((goal) => {
            const percentage = (goal.current / goal.target) * 100;
            return (
              <div key={goal.goal} className="goal-card">
                <div className="goal-header">
                  <span className="goal-name">{goal.goal}</span>
                  <span className="goal-percent">{percentage.toFixed(0)}%</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <div className="goal-footer">
                  <span>${goal.current}</span>
                  <span>${goal.target}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
