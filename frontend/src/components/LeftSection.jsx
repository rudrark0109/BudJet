import { TrendingUp, ShoppingBag, Coffee, Car, Home, Zap, Clock } from 'lucide-react';

const transactions = [
  { id: 1, name: 'Grocery Shopping', category: 'Food', amount: -85.50, date: '2 hours ago', type: 'expense', icon: ShoppingBag },
  { id: 2, name: 'Salary Deposit', category: 'Income', amount: 4700.00, date: '1 day ago', type: 'income', icon: TrendingUp },
  { id: 3, name: 'Coffee Shop', category: 'Food', amount: -12.30, date: '1 day ago', type: 'expense', icon: Coffee },
  { id: 4, name: 'Uber Ride', category: 'Transport', amount: -18.75, date: '2 days ago', type: 'expense', icon: Car },
  { id: 5, name: 'Electricity Bill', category: 'Bills', amount: -95.00, date: '3 days ago', type: 'expense', icon: Zap },
  { id: 6, name: 'Rent Payment', category: 'Bills', amount: -1200.00, date: '4 days ago', type: 'expense', icon: Home },
  { id: 7, name: 'Freelance Project', category: 'Income', amount: 850.00, date: '5 days ago', type: 'income', icon: TrendingUp },
  { id: 8, name: 'Restaurant', category: 'Food', amount: -65.40, date: '5 days ago', type: 'expense', icon: Coffee },
  { id: 9, name: 'Online Shopping', category: 'Shopping', amount: -145.99, date: '6 days ago', type: 'expense', icon: ShoppingBag },
  { id: 10, name: 'Gas Station', category: 'Transport', amount: -52.00, date: '1 week ago', type: 'expense', icon: Car },
];

export function LeftSection() {
  return (
    <div className="left-section">
      <div className="transactions-header">
        <h2 className="transactions-title">Recent Transactions</h2>
        <button className="view-all-btn">View All</button>
      </div>
      
      <div className="transactions-list">
        {transactions.map((transaction) => {
          const Icon = transaction.icon;
          const isIncome = transaction.type === 'income';
          
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
                      <h3 className="transaction-name">{transaction.name}</h3>
                      <div className="transaction-meta">
                        <span className="transaction-category">{transaction.category}</span>
                        <span className="transaction-category">•</span>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span className="transaction-category">{transaction.date}</span>
                        </div>
                      </div>
                    </div>
                    <div className={`text-right flex-shrink-0 ${
                      isIncome ? 'text-green-400' : 'text-red-400'
                    }`}>
                      <p className="font-mono">
                        {isIncome ? '+' : ''}{transaction.amount.toFixed(2)}
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
