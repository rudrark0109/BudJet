import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, Minus } from 'lucide-react';

const monthlyData = [
  { month: 'Jan', income: 4500, expenses: 3200 },
  { month: 'Feb', income: 4200, expenses: 3500 },
  { month: 'Mar', income: 4800, expenses: 3100 },
  { month: 'Apr', income: 4600, expenses: 3400 },
  { month: 'May', income: 5000, expenses: 3600 },
  { month: 'Jun', income: 4700, expenses: 3300 },
];

const categoryData = [
  { category: 'Food', amount: 1200 },
  { category: 'Transport', amount: 450 },
  { category: 'Shopping', amount: 800 },
  { category: 'Bills', amount: 950 },
  { category: 'Entertainment', amount: 300 },
];

export function BasicInfo({ onOpenCreditModal, onOpenDebitModal }) {
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
            <p className="summary-value green">$8,450</p>
          </div>
          <div>
            <p className="summary-label">This Month Income</p>
            <p className="summary-value blue">$4,700</p>
          </div>
          <div>
            <p className="summary-label">This Month Expenses</p>
            <p className="summary-value red">$3,300</p>
          </div>
        </div>
      </div>
    </div>
  );
}
