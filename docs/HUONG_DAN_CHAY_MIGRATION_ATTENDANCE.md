# Hướng Dẫn Chạy Migration

## Migration 1: Attendance Status (Thêm trạng thái điểm danh)

## Migration 2: Wallet Transaction Types (Thêm type extend/refund)

## Vấn Đề

Lỗi 500 khi lưu điểm danh do database chưa có cột `status` trong bảng `attendance`.

## Giải Pháp

Cần chạy migration `add_attendance_status.sql` để thêm cột `status` vào bảng `attendance`.

## Cách 1: Chạy qua Supabase Dashboard (Khuyến nghị)

1. Đăng nhập vào Supabase Dashboard
2. Vào **SQL Editor**
3. Copy toàn bộ nội dung file `supabase/migrations/add_attendance_status.sql`
4. Paste vào SQL Editor
5. Click **Run** để chạy migration

## Cách 2: Chạy qua psql (Command Line)

```bash
# Kết nối đến database
psql -h <your-db-host> -U <your-username> -d <your-database-name>

# Chạy migration
\i supabase/migrations/add_attendance_status.sql
```

Hoặc:

```bash
psql -h <your-db-host> -U <your-username> -d <your-database-name> -f supabase/migrations/add_attendance_status.sql
```

## Cách 3: Chạy từng bước thủ công

Nếu gặp lỗi, có thể chạy từng bước:

```sql
-- Bước 1: Thêm cột status
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT NULL;

-- Bước 2: Migrate dữ liệu cũ
UPDATE attendance 
SET status = CASE 
  WHEN present = true THEN 'present'
  WHEN present = false THEN 'absent'
  ELSE 'absent'
END
WHERE status IS NULL;

-- Bước 3: Set NOT NULL
ALTER TABLE attendance 
ALTER COLUMN status SET NOT NULL,
ALTER COLUMN status SET DEFAULT 'present';

-- Bước 4: Thêm constraint
ALTER TABLE attendance 
ADD CONSTRAINT attendance_status_check 
CHECK (status IN ('present', 'excused', 'absent'));

-- Bước 5: Tạo index
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
CREATE INDEX IF NOT EXISTS idx_attendance_session_status ON attendance(session_id, status);
```

## Kiểm Tra

Sau khi chạy migration, kiểm tra xem cột `status` đã được tạo chưa:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'attendance' AND column_name = 'status';
```

Kết quả mong đợi:
- `column_name`: `status`
- `data_type`: `character varying` hoặc `varchar`
- `is_nullable`: `NO`
- `column_default`: `'present'::character varying`

## Lưu Ý

- Migration này **an toàn** và không làm mất dữ liệu
- Dữ liệu cũ sẽ được migrate tự động: `present=true` → `status='present'`, `present=false` → `status='absent'`
- Cột `present` vẫn được giữ lại để tương thích ngược
- Sau khi migration thành công, hệ thống sẽ hoạt động bình thường với 3 trạng thái điểm danh

