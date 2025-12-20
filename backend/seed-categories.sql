-- Sample categories for testing
-- Replace 'YOUR_USER_ID' with your actual Firebase UID

-- Expense categories
INSERT INTO categories (user_id, name, type, color) VALUES
('YOUR_USER_ID', 'Food', 'expense', '#E8684A'),
('YOUR_USER_ID', 'Transport', 'expense', '#5B8FF9'),
('YOUR_USER_ID', 'Shopping', 'expense', '#6DC8EC'),
('YOUR_USER_ID', 'Bills', 'expense', '#9270CA'),
('YOUR_USER_ID', 'Entertainment', 'expense', '#FFD666'),
('YOUR_USER_ID', 'Healthcare', 'expense', '#FF85C0'),
('YOUR_USER_ID', 'Education', 'expense', '#95DE64')
ON CONFLICT DO NOTHING;

-- Income categories
INSERT INTO categories (user_id, name, type, color) VALUES
('YOUR_USER_ID', 'Salary', 'income', '#52C41A'),
('YOUR_USER_ID', 'Freelance', 'income', '#13C2C2'),
('YOUR_USER_ID', 'Investment', 'income', '#2F54EB'),
('YOUR_USER_ID', 'Gift', 'income', '#FA8C16')
ON CONFLICT DO NOTHING;
