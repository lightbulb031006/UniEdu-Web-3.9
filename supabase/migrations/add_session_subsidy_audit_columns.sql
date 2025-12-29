-- Migration: Add subsidy audit columns to sessions table
-- Date: 2025-12-03
-- 
-- Lý do:
--   - Cho phép admin chỉnh sửa thủ công trợ cấp giáo viên cho các buổi học đã tạo
--   - Lưu trữ giá trị trợ cấp ban đầu và thông tin chỉnh sửa để audit log
--   - Theo dõi ai đã chỉnh sửa và khi nào
--
-- Các cột được thêm:
--   - allowance_amount: Số tiền trợ cấp giáo viên (có thể NULL, tính tự động khi tạo)
--   - subsidy_original: Giá trị trợ cấp ban đầu (NULL nếu chưa chỉnh sửa)
--   - subsidy_modified_by: ID/email của admin chỉnh sửa (NULL nếu chưa chỉnh sửa)
--   - subsidy_modified_at: Thời gian chỉnh sửa (NULL nếu chưa chỉnh sửa)

-- Thêm cột allowance_amount (nếu chưa có)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
          AND table_name = 'sessions' 
          AND column_name = 'allowance_amount'
    ) THEN
        ALTER TABLE sessions 
            ADD COLUMN allowance_amount INTEGER;
        
        RAISE NOTICE '✅ Đã thêm cột allowance_amount vào bảng sessions';
    ELSE
        RAISE NOTICE 'ℹ️ Cột allowance_amount đã tồn tại, bỏ qua';
    END IF;
END $$;

-- Thêm cột subsidy_original
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
          AND table_name = 'sessions' 
          AND column_name = 'subsidy_original'
    ) THEN
        ALTER TABLE sessions 
            ADD COLUMN subsidy_original INTEGER;
        
        RAISE NOTICE '✅ Đã thêm cột subsidy_original vào bảng sessions';
    ELSE
        RAISE NOTICE 'ℹ️ Cột subsidy_original đã tồn tại, bỏ qua';
    END IF;
END $$;

-- Thêm cột subsidy_modified_by
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
          AND table_name = 'sessions' 
          AND column_name = 'subsidy_modified_by'
    ) THEN
        ALTER TABLE sessions 
            ADD COLUMN subsidy_modified_by TEXT;
        
        RAISE NOTICE '✅ Đã thêm cột subsidy_modified_by vào bảng sessions';
    ELSE
        RAISE NOTICE 'ℹ️ Cột subsidy_modified_by đã tồn tại, bỏ qua';
    END IF;
END $$;

-- Thêm cột subsidy_modified_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
          AND table_name = 'sessions' 
          AND column_name = 'subsidy_modified_at'
    ) THEN
        ALTER TABLE sessions 
            ADD COLUMN subsidy_modified_at TIMESTAMP WITH TIME ZONE;
        
        RAISE NOTICE '✅ Đã thêm cột subsidy_modified_at vào bảng sessions';
    ELSE
        RAISE NOTICE 'ℹ️ Cột subsidy_modified_at đã tồn tại, bỏ qua';
    END IF;
END $$;

-- Xác nhận các cột đã được thêm thành công
DO $$
DECLARE
    missing_columns TEXT[] := ARRAY[]::TEXT[];
    required_columns TEXT[] := ARRAY['allowance_amount', 'subsidy_original', 'subsidy_modified_by', 'subsidy_modified_at'];
    col TEXT;
BEGIN
    FOREACH col IN ARRAY required_columns
    LOOP
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public'
              AND table_name = 'sessions' 
              AND column_name = col
        ) THEN
            missing_columns := array_append(missing_columns, col);
        END IF;
    END LOOP;
    
    IF array_length(missing_columns, 1) > 0 THEN
        RAISE WARNING 'Các cột sau chưa được thêm: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE '✅ Tất cả các cột đã được thêm thành công';
    END IF;
END $$;

