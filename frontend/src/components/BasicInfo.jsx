import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, Minus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchSummary } from '../api/transactions';

export function BasicInfo({ onOpenCreditModal, onOpenDebitModal, userId, refreshKey }) {
  const [monthlyData, setMonthlyData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [summary, setSummary] = useState({ balance: 0, total_income: 0, total_expenses: 0 });

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const data = await fetchSummary(userId);
        if (data?.monthlyTrend) {
          setMonthlyData(data.monthlyTrend.map(m => ({ month: m.month, income: Number(m.income) || 0, expenses: Number(m.expenses) || 0 })));
        }
        if (data?.categoryBreakdown) {
          setCategoryData(data.categoryBreakdown.map(c => ({ category: c.category, amount: Number(c.amount) || 0 })));
        }
        if (data?.summary) {
          setSummary({
            balance: Number(data.summary.balance) || 0,
            total_income: Number(data.summary.total_income) || 0,
            total_expenses: Number(data.summary.total_expenses) || 0,
          });
        }
      } catch (err) {
        console.warn('Summary fetch failed:', err.message);
      }
    })();
  }, [userId, refreshKey]);
  return (
    <div className="basic-info">
      <div className="basic-info-inner">
        <div className="basic-info-header">
          <h2 className="basic-info-title">Financial Overview</h2>
          <div className="button-group">
            <button 
              onClick={onOpenCreditModal}
              className="btn btn-credit"
            >
              <Plus className="w-4 h-4" />
              Add Credit
            </button>
            <button 
              onClick={onOpenDebitModal}
              className="btn btn-debit"
            >
              <Minus className="w-4 h-4" />
              Add Debit
            </button>
          </div>
        </div>
        
        <div className="charts-grid">
          {/* Income vs Expenses Chart */}
          <div className="chart-card">
            <h3 className="chart-title">Income vs Expenses</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Area type="monotone" dataKey="income" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Category Spending Chart */}
          <div className="chart-card">
            <h3 className="chart-title">Spending by Category</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis dataKey="category" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Bar dataKey="amount" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="summary-grid">
          <div>
            <p className="summary-label">Total Balance</p>
            <p className="summary-value green">${summary.balance.toLocaleString(undefined, { minimumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="summary-label">This Month Income</p>
            <p className="summary-value blue">${summary.total_income.toLocaleString(undefined, { minimumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="summary-label">This Month Expenses</p>
            <p className="summary-value red">${summary.total_expenses.toLocaleString(undefined, { minimumFractionDigits: 0 })}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
