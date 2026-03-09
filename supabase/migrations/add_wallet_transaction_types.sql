-- Migration: Add 'extend' and 'refund' types to wallet_transactions
-- These types are for extending sessions (payment) and refunding sessions (refund)
-- They should NOT be counted as revenue

-- Step 1: Drop the existing constraint
ALTER TABLE wallet_transactions 
DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

-- Step 2: Add new constraint with extended types
ALTER TABLE wallet_transactions 
ADD CONSTRAINT wallet_transactions_type_check 
CHECK (type IN ('topup', 'loan', 'advance', 'repayment', 'extend', 'refund'));

-- Step 3: Add comment to document the types
COMMENT ON COLUMN wallet_transactions.type IS 'Transaction type: topup (nạp tiền - tính vào doanh thu), loan/advance (vay/ứng - không tính vào doanh thu), repayment (trả nợ), extend (gia hạn buổi học - không tính vào doanh thu), refund (hoàn trả buổi học - không tính vào doanh thu)';

