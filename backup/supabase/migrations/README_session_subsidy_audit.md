# Migration: Add Session Subsidy Audit Columns

## Mô tả
Thêm các cột audit log vào bảng `sessions` để hỗ trợ tính năng chỉnh sửa thủ công trợ cấp giáo viên bởi admin.

## Các cột được thêm

1. **`allowance_amount`** (INTEGER, NULL)
   - Số tiền trợ cấp giáo viên cho buổi học
   - NULL nếu chưa được tính/set
   - Được tính tự động khi tạo buổi học hoặc chỉnh sửa bởi admin

2. **`subsidy_original`** (INTEGER, NULL)
   - Giá trị trợ cấp ban đầu khi tạo buổi học
   - NULL nếu chưa chỉnh sửa (chưa có chỉnh sửa thủ công)
   - Được set khi admin chỉnh sửa lần đầu tiên

3. **`subsidy_modified_by`** (TEXT, NULL)
   - ID hoặc email của admin đã chỉnh sửa trợ cấp
   - NULL nếu chưa chỉnh sửa

4. **`subsidy_modified_at`** (TIMESTAMP WITH TIME ZONE, NULL)
   - Thời gian chỉnh sửa trợ cấp lần cuối
   - NULL nếu chưa chỉnh sửa

## Cách chạy migration

### Cách 1: Qua Supabase Dashboard (Khuyến nghị)

1. Mở **Supabase Dashboard** → **SQL Editor**
2. Copy toàn bộ nội dung file `add_session_subsidy_audit_columns.sql`
3. Paste vào SQL Editor
4. Click **Run** để chạy migration
5. Kiểm tra kết quả trong console (sẽ có thông báo "✅ Tất cả các cột đã được thêm thành công")

### Cách 2: Qua CLI (nếu có cấu hình)

```bash
psql -h <your-supabase-host> -U postgres -d postgres -f supabase/migrations/add_session_subsidy_audit_columns.sql
```

## Kiểm tra sau khi chạy

Chạy query sau để xác nhận các cột đã được thêm:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sessions'
  AND column_name IN ('allowance_amount', 'subsidy_original', 'subsidy_modified_by', 'subsidy_modified_at')
ORDER BY column_name;
```

Kết quả mong đợi:
- `allowance_amount` | `integer` | `YES`
- `subsidy_modified_at` | `timestamp with time zone` | `YES`
- `subsidy_modified_by` | `text` | `YES`
- `subsidy_original` | `integer` | `YES`

## Rollback (nếu cần)

Nếu muốn xóa các cột này (không khuyến nghị sau khi có dữ liệu):

```sql
ALTER TABLE sessions 
    DROP COLUMN IF EXISTS allowance_amount,
    DROP COLUMN IF EXISTS subsidy_original,
    DROP COLUMN IF EXISTS subsidy_modified_by,
    DROP COLUMN IF EXISTS subsidy_modified_at;
```

## Lưu ý

- Migration này an toàn: chỉ thêm cột mới, không xóa hoặc sửa dữ liệu hiện có
- Các cột đều nullable, không ảnh hưởng đến dữ liệu cũ
- Nếu cột đã tồn tại, migration sẽ bỏ qua (idempotent)

## Liên quan

- Tính năng: Chỉnh sửa trợ cấp giáo viên inline trong form buổi học
- File liên quan: `assets/js/pages/classes.js` - hàm `updateSessionAllowance`

