# Hướng Dẫn Chạy Migration Wallet Transaction Types

## Vấn Đề

Lỗi 500 khi gia hạn hoặc hoàn trả sessions do database chưa hỗ trợ type `'extend'` và `'refund'` trong bảng `wallet_transactions`.

## Giải Pháp

Cần chạy migration `add_wallet_transaction_types.sql` để thêm 2 type mới vào constraint của bảng `wallet_transactions`.

## Cách 1: Chạy qua Supabase Dashboard (Khuyến nghị)

1. Đăng nhập vào Supabase Dashboard
2. Vào **SQL Editor**
3. Copy toàn bộ nội dung file `supabase/migrations/add_wallet_transaction_types.sql`
4. Paste vào SQL Editor
5. Click **Run** để chạy migration

## Cách 2: Chạy qua psql (Command Line)

```bash
# Kết nối đến database
psql -h <your-db-host> -U <your-username> -d <your-database-name>

# Chạy migration
\i supabase/migrations/add_wallet_transaction_types.sql
```

Hoặc:

```bash
psql -h <your-db-host> -U <your-username> -d <your-database-name> -f supabase/migrations/add_wallet_transaction_types.sql
```

## Cách 3: Chạy từng bước thủ công

Nếu gặp lỗi, có thể chạy từng bước:

```sql
-- Bước 1: Xóa constraint cũ
ALTER TABLE wallet_transactions 
DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

-- Bước 2: Thêm constraint mới với 6 types
ALTER TABLE wallet_transactions 
ADD CONSTRAINT wallet_transactions_type_check 
CHECK (type IN ('topup', 'loan', 'advance', 'repayment', 'extend', 'refund'));
```

## Kiểm Tra

Sau khi chạy migration, kiểm tra xem constraint đã được cập nhật chưa:

```sql
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'wallet_transactions'::regclass
AND conname = 'wallet_transactions_type_check';
```

Kết quả mong đợi: Constraint phải chứa 6 types: `'topup'`, `'loan'`, `'advance'`, `'repayment'`, `'extend'`, `'refund'`

## Lưu Ý

- Migration này **an toàn** và không làm mất dữ liệu
- Chỉ mở rộng constraint để cho phép thêm 2 type mới
- Sau khi migration thành công, hệ thống sẽ hoạt động bình thường với gia hạn và hoàn trả sessions

## Các Type Wallet Transaction

- `'topup'`: Nạp tiền - **Tính vào doanh thu**
- `'loan'`: Vay tiền - Không tính vào doanh thu
- `'advance'`: Ứng tiền - Không tính vào doanh thu
- `'repayment'`: Trả nợ - Không tính vào doanh thu
- `'extend'`: Gia hạn buổi học - **Không tính vào doanh thu** (mới)
- `'refund'`: Hoàn trả buổi học - **Không tính vào doanh thu** (mới)

