# Hướng Dẫn Chạy Migrations

## Tổng Quan

Có 2 migrations cần chạy để hệ thống hoạt động đầy đủ:

1. **Migration Attendance Status**: Thêm trạng thái điểm danh (Học/Phép/Vắng)
2. **Migration Wallet Transaction Types**: Thêm type extend/refund cho wallet transactions

## Migration 1: Attendance Status

**File:** `supabase/migrations/add_attendance_status.sql`

**Mục đích:** Thêm cột `status` vào bảng `attendance` để hỗ trợ 3 trạng thái điểm danh.

**Cách chạy:**
1. Mở Supabase Dashboard → SQL Editor
2. Copy nội dung file `supabase/migrations/add_attendance_status.sql`
3. Paste và chạy

**Chi tiết:** Xem `docs/HUONG_DAN_CHAY_MIGRATION_ATTENDANCE.md`

## Migration 2: Wallet Transaction Types

**File:** `supabase/migrations/add_wallet_transaction_types.sql`

**Mục đích:** Thêm type `'extend'` và `'refund'` vào constraint của bảng `wallet_transactions`.

**Cách chạy:**
1. Mở Supabase Dashboard → SQL Editor
2. Copy nội dung file `supabase/migrations/add_wallet_transaction_types.sql`
3. Paste và chạy

**Chi tiết:** Xem `docs/HUONG_DAN_CHAY_MIGRATION_WALLET_TYPES.md`

## Thứ Tự Chạy Migration

**Quan trọng:** Có thể chạy theo bất kỳ thứ tự nào, nhưng khuyến nghị:

1. Chạy Migration 1 trước (Attendance Status)
2. Sau đó chạy Migration 2 (Wallet Transaction Types)

## Kiểm Tra Sau Khi Chạy

### Kiểm tra Migration 1 (Attendance Status):

```sql
-- Kiểm tra cột status đã tồn tại chưa
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'attendance' AND column_name = 'status';

-- Kiểm tra constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'attendance'::regclass
AND conname = 'attendance_status_check';
```

### Kiểm tra Migration 2 (Wallet Transaction Types):

```sql
-- Kiểm tra constraint
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'wallet_transactions'::regclass
AND conname = 'wallet_transactions_type_check';
```

Constraint phải chứa: `('topup', 'loan', 'advance', 'repayment', 'extend', 'refund')`

## Lưu Ý

- Cả 2 migrations đều **an toàn** và không làm mất dữ liệu
- Có thể chạy lại nhiều lần (sử dụng `IF NOT EXISTS` và `DROP CONSTRAINT IF EXISTS`)
- Sau khi chạy xong cả 2 migrations, hệ thống sẽ hoạt động đầy đủ với:
  - 3 trạng thái điểm danh (Học/Phép/Vắng)
  - Gia hạn và hoàn trả sessions không tính vào doanh thu

