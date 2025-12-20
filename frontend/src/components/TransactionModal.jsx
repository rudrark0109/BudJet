import { X } from 'lucide-react';
import { useState, useEffect } from 'react';

const DEBIT_CATEGORIES = [
  'Public Transport',
  'Raw Food',
  'Takeouts',
  'Lifestyle',
  'Luxury',
  'Electronics',
  'Uber/Lyft'
];

export function TransactionModal({ isOpen, onClose, type }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [customCategories, setCustomCategories] = useState([]);
  const [dateTime, setDateTime] = useState('');

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

  const handleSubmit = () => {
    // Handle transaction submission here
    console.log({
      type,
      amount,
      description,
      category: type === 'debit' ? category : undefined,
      dateTime
    });
    
    // Reset form
    setAmount('');
    setDescription('');
    setCategory('');
    setCustomCategories([]);
    onClose();
  };

  if (!isOpen) return null;

  const allCategories = [...DEBIT_CATEGORIES, ...customCategories];

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
                {allCategories.map((cat) => (
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
                ))}
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
            disabled={!amount || !description || (type === 'debit' && !category)}
            className={`btn ${
              !amount || !description || (type === 'debit' && !category)
                ? 'btn-disabled'
                : type === 'credit'
                ? 'btn-credit'
                : 'btn-debit'
            }`}
          >
            Add Transaction
          </button>
        </div>
      </div>
    </div>
  );
}
