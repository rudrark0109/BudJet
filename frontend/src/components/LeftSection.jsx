import { TrendingUp, ShoppingBag, Coffee, Car, Home, Zap, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchTransactions } from '../api/transactions';

function iconFor(category, type) {
  if (type === 'income') return TrendingUp;
  switch ((category || '').toLowerCase()) {
    case 'food': return Coffee;
    case 'transport': return Car;
    case 'shopping': return ShoppingBag;
    case 'bills': return Zap;
    case 'rent': return Home;
    default: return ShoppingBag;
  }
}

function timeAgo(iso) {
  try {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)} sec ago`;
    if (diff < 3600) return `${Math.floor(diff/60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)} hours ago`;
    const days = Math.floor(diff/86400);
    return days === 1 ? '1 day ago' : `${days} days ago`;
  } catch {
    return '';
  }
}

export function LeftSection({ userId, refreshKey }) {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const list = await fetchTransactions(userId);
        setTransactions(list || []);
      } catch (err) {
        console.warn('Transactions fetch failed:', err.message);
      }
    })();
  }, [userId, refreshKey]);
  return (
    <div className="left-section">
      <div className="transactions-header">
        <h2 className="transactions-title">Recent Transactions</h2>
        <button className="view-all-btn">View All</button>
      </div>
      
      <div className="transactions-list">
        {transactions.map((transaction) => {
          const Icon = iconFor(transaction.category_name, transaction.type);
          const isIncome = transaction.type === 'income';
          const amount = Number(transaction.amount) || 0;
          const title = transaction.description || (isIncome ? 'Income' : (transaction.category_name || 'Expense'));
          const when = timeAgo(transaction.created_at || transaction.transaction_date);
          
          return (
            <div 
              key={transaction.id}
              className="transaction-item"
            >
              <div className="transaction-content">
                <div className={`transaction-icon ${isIncome ? 'income' : 'expense'}`}>
                  <Icon />
                </div>
                
                <div className="transaction-details">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="transaction-name">{title}</h3>
                      <div className="transaction-meta">
                        <span className="transaction-category">{transaction.category_name || (isIncome ? 'Income' : 'Expense')}</span>
                        <span className="transaction-category">•</span>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span className="transaction-category">{when}</span>
                        </div>
                      </div>
                    </div>
                    <div className={`text-right flex-shrink-0 ${
                      isIncome ? 'text-green-400' : 'text-red-400'
                    }`}>
                      <p className="font-mono">
                        {isIncome ? '+' : ''}{amount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
