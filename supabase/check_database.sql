-- Script kiểm tra database hiện tại
-- Chạy script này để xem database đã có đủ các cột và indexes chưa

-- ============================================
-- 1. Kiểm tra các cột trong bảng users
-- ============================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE 
        WHEN column_name IN ('phone', 'account_handle', 'email_verified', 'phone_verified', 
                             'reset_token', 'reset_token_expires', 'password_hash') 
        THEN '✅ Cần thiết'
        ELSE 'ℹ️ Có sẵn'
    END as status
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- ============================================
-- 2. Kiểm tra các indexes trên bảng users
-- ============================================
SELECT 
    indexname,
    indexdef,
    CASE 
        WHEN indexname IN ('idx_users_email', 'idx_users_phone', 'idx_users_account_handle', 
                          'idx_users_link_id', 'idx_users_role', 'idx_users_status') 
        THEN '✅ Cần thiết'
        ELSE 'ℹ️ Có sẵn'
    END as status
FROM pg_indexes
WHERE tablename = 'users'
ORDER BY indexname;

-- ============================================
-- 3. Kiểm tra các constraints trên bảng users
-- ============================================
SELECT 
    constraint_name,
    constraint_type,
    CASE 
        WHEN constraint_name IN ('users_role_check', 'users_status_check', 
                                'users_email_key', 'users_account_handle_key') 
        THEN '✅ Cần thiết'
        ELSE 'ℹ️ Có sẵn'
    END as status
FROM information_schema.table_constraints
WHERE table_name = 'users'
ORDER BY constraint_name;

-- ============================================
-- 4. Kiểm tra CHECK constraint cho role
-- ============================================
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'users'::regclass
AND contype = 'c'
AND conname LIKE '%role%';

-- ============================================
-- 5. Kiểm tra CHECK constraint cho status
-- ============================================
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'users'::regclass
AND contype = 'c'
AND conname LIKE '%status%';

-- ============================================
-- 6. Tóm tắt: Các cột còn thiếu
-- ============================================
SELECT 
    'Các cột còn thiếu:' as summary,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone') 
        THEN '❌ phone' ELSE '✅ phone' END as phone,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'account_handle') 
        THEN '❌ account_handle' ELSE '✅ account_handle' END as account_handle,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email_verified') 
        THEN '❌ email_verified' ELSE '✅ email_verified' END as email_verified,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone_verified') 
        THEN '❌ phone_verified' ELSE '✅ phone_verified' END as phone_verified,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'reset_token') 
        THEN '❌ reset_token' ELSE '✅ reset_token' END as reset_token,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'reset_token_expires') 
        THEN '❌ reset_token_expires' ELSE '✅ reset_token_expires' END as reset_token_expires;

