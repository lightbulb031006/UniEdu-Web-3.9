-- Migration: Remove class_id column from students table (Simple Version)
-- Date: 2025-11-30
-- 
-- Lý do:
--   - class_id là trường legacy từ mối quan hệ one-to-many (1 học sinh → 1 lớp)
--   - Hệ thống hiện dùng many-to-many qua bảng student_classes (1 học sinh → nhiều lớp)
--   - class_id không còn được sử dụng hoặc cập nhật bởi ứng dụng
--   - Tất cả dữ liệu đã được lưu trong bảng student_classes
--
-- Lưu ý: PostgreSQL sẽ tự động xóa foreign key constraint và index khi xóa cột

-- Xóa cột class_id
-- PostgreSQL sẽ tự động xóa foreign key constraint và index liên quan
ALTER TABLE students 
    DROP COLUMN IF EXISTS class_id;

-- Xác nhận đã xóa thành công
-- Nếu cột vẫn tồn tại, sẽ có warning nhưng không có lỗi
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
          AND table_name = 'students' 
          AND column_name = 'class_id'
    ) THEN
        RAISE WARNING 'Cột class_id vẫn tồn tại. Vui lòng kiểm tra lại.';
    ELSE
        RAISE NOTICE '✅ Đã xóa thành công cột class_id khỏi bảng students';
    END IF;
END $$;

