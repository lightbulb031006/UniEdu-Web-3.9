# Migration: Remove class_id from students table

## Mục đích

Xóa cột `class_id` khỏi bảng `students` vì:
- Đây là trường legacy từ mối quan hệ one-to-many (1 học sinh → 1 lớp)
- Hệ thống hiện tại sử dụng many-to-many qua bảng `student_classes` (1 học sinh → nhiều lớp)
- Trường `class_id` không còn được sử dụng hoặc cập nhật bởi ứng dụng
- Tất cả dữ liệu đã được lưu trong bảng `student_classes`

## Cách chạy

### Option 1: Chạy trong Supabase SQL Editor

1. Mở Supabase Dashboard
2. Vào SQL Editor
3. Copy toàn bộ nội dung file `remove_class_id_from_students.sql`
4. Paste và chạy (Run)

### Option 2: Chạy bằng psql

```bash
psql -h [your-supabase-host] -U postgres -d postgres -f supabase/migrations/remove_class_id_from_students.sql
```

## Kiểm tra sau khi chạy

1. Kiểm tra cột đã được xóa:
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'students' 
  AND column_name = 'class_id';
-- Kết quả: Không có dòng nào (cột đã bị xóa)
```

2. Kiểm tra bảng students vẫn hoạt động:
```sql
SELECT id, full_name, email, status 
FROM students 
LIMIT 5;
```

3. Kiểm tra dữ liệu trong student_classes (nguồn dữ liệu thực sự):
```sql
SELECT COUNT(*) as total_records
FROM student_classes;
```

## Lưu ý

- ✅ **An toàn**: Migration này không làm mất dữ liệu
- ✅ **Không ảnh hưởng**: Ứng dụng đã không đọc từ `class_id` nữa
- ✅ **Đã kiểm tra**: Ứng dụng đã được cập nhật để không lưu vào `class_id`

## Rollback (nếu cần)

Nếu cần rollback (không khuyến khích), có thể chạy:

```sql
-- Thêm lại cột (không có foreign key)
ALTER TABLE students 
    ADD COLUMN class_id TEXT;
```

Nhưng lưu ý: Dữ liệu cũ sẽ không được khôi phục.

