import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createTransaction } from '../api/transactions';
import { fetchCategories, createCategory } from '../api/categories';

const DEBIT_CATEGORIES = [
  'Public Transport',
  'Raw Food',
  'Takeouts',
  'Lifestyle',
  'Luxury',
  'Electronics',
  'Uber/Lyft'
];

export function TransactionModal({ isOpen, onClose, type, userId, onTransactionAdded }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [customCategories, setCustomCategories] = useState([]);
  const [dateTime, setDateTime] = useState('');
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Set default datetime when modal opens
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';

      // Fetch categories for the user (expense only)
      if (type === 'debit' && userId) {
        setLoadingCats(true);
        fetchCategories(userId)
          .then((cats) => {
            setExpenseCategories(
              (cats || []).filter((c) => (c.type || '').toLowerCase() === 'expense')
            );
          })
          .catch(() => {
            // Fallback to defaults if API fails
            setExpenseCategories([]);
          })
          .finally(() => setLoadingCats(false));
      }
    } else {
      // Re-enable body scroll
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleCategoryClick = (cat) => {
    setCategory(cat);
  };

  const handleCategoryInputKeyDown = (e) => {
    if (e.key === 'Enter' && category.trim()) {
      e.preventDefault();
      const trimmedCategory = category.trim();
      const allCategories = [...DEBIT_CATEGORIES, ...customCategories];
      
      if (!allCategories.includes(trimmedCategory)) {
        setCustomCategories([...customCategories, trimmedCategory]);
      }
    }
  };

  const handleSubmit = async () => {
    if (!userId) {
      setError('Missing user session. Please sign in.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const amt = parseFloat(amount);
      if (Number.isNaN(amt) || amt <= 0) {
        throw new Error('Please enter a valid amount');
      }

      const mappedType = type === 'credit' ? 'income' : 'expense';

      // Prepare category_id for expenses (debit)
      let category_id = null;
      if (mappedType === 'expense') {
        const nameTrim = (category || '').trim();
        if (!nameTrim) {
          throw new Error('Please select or enter a category');
        }
        const match = expenseCategories.find(
          (c) => (c.name || '').toLowerCase() === nameTrim.toLowerCase()
        );
        if (match) {
          category_id = match.id;
        } else {
          // Create category then use its id
          const created = await createCategory({
            user_id: userId,
            name: nameTrim,
            type: 'expense',
          });
          category_id = created?.id || null;
        }
      }

      // Format date as YYYY-MM-DD for backend
      const datePart = (dateTime || '').split('T')[0] || new Date().toISOString().split('T')[0];

      await createTransaction({
        user_id: userId,
        category_id,
        amount: amt,
        description: description || null,
        type: mappedType,
        transaction_date: datePart,
      });

      // Notify parent to refresh data
      if (onTransactionAdded) {
        onTransactionAdded();
      }

      // Reset form
      setAmount('');
      setDescription('');
      setCategory('');
      setCustomCategories([]);
      onClose();
    } catch (e) {
      setError(e?.message || 'Failed to add transaction');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const backendCategoryNames = expenseCategories.map((c) => c.name);
  const allCategories = [
    ...backendCategoryNames,
    ...DEBIT_CATEGORIES,
    ...customCategories,
  ];

  return (
    <div className="modal-overlay">
      {/* Backdrop */}
      <div 
        className="modal-backdrop"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="modal-content">
        {/* Header */}
        <div className="modal-header">
          <h3 className="modal-title">
            Add {type === 'credit' ? 'Credit' : 'Debit'} Transaction
          </h3>
          <button 
            onClick={onClose}
            className="modal-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="modal-form">
          {error && (
            <div className="form-error">
              {error}
            </div>
          )}
          {/* Amount */}
          <div>
            <label className="form-label">
              Amount ($)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="form-input"
            />
          </div>

          {/* Description */}
          <div>
            <label className="form-label">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description"
              className="form-input"
            />
          </div>

          {/* Category (Debit only) */}
          {type === 'debit' && (
            <div>
              <label className="form-label">
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                onKeyDown={handleCategoryInputKeyDown}
                placeholder="Type or select a category"
                className="form-input"
              />
              
              {/* Category Pills */}
              <div className="category-pills">
                {loadingCats ? (
                  <span className="form-help-text">Loading categories…</span>
                ) : (
                  allCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleCategoryClick(cat)}
                    className={`pill ${
                      category === cat
                        ? 'pill-active'
                        : 'pill-inactive'
                    }`}
                  >
                    {cat}
                  </button>
                  ))
                )}
              </div>
              <p className="form-help-text">
                Press Enter to add a new category
              </p>
            </div>
          )}

          {/* Date & Time */}
          <div>
            <label className="form-label">
              Date & Time
            </label>
            <input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            onClick={handleSubmit}
            disabled={
              submitting ||
              !amount ||
              !description ||
              (type === 'debit' && !category)
            }
            className={`btn ${
              submitting || !amount || !description || (type === 'debit' && !category)
                ? 'btn-disabled'
                : type === 'credit'
                ? 'btn-credit'
                : 'btn-debit'
            }`}
          >
            {submitting ? 'Adding…' : 'Add Transaction'}
          </button>
        </div>
      </div>
    </div>
  );
}
