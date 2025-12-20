import { PieChart, TrendingUp, BarChart3 } from 'lucide-react';
import { PieChart as RePieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

const categoryBreakdown = [
  { name: 'Food', value: 1200, color: '#3b82f6' },
  { name: 'Transport', value: 450, color: '#8b5cf6' },
  { name: 'Shopping', value: 800, color: '#ec4899' },
  { name: 'Bills', value: 950, color: '#f59e0b' },
  { name: 'Entertainment', value: 300, color: '#10b981' },
];

const weeklyTrend = [
  { day: 'Mon', amount: 120 },
  { day: 'Tue', amount: 180 },
  { day: 'Wed', amount: 95 },
  { day: 'Thu', amount: 210 },
  { day: 'Fri', amount: 150 },
  { day: 'Sat', amount: 280 },
  { day: 'Sun', amount: 190 },
];

const savingsGoals = [
  { goal: 'Emergency Fund', current: 3500, target: 5000 },
  { goal: 'Vacation', current: 1200, target: 2000 },
  { goal: 'New Laptop', current: 800, target: 1500 },
];

export function RightSection() {
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
