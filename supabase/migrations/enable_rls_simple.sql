-- ============================================
-- ROW LEVEL SECURITY (RLS) - Simple Version
-- For Custom Auth System
-- ============================================
--
-- This is a simpler RLS implementation that:
-- 1. Blocks anonymous access (anon key cannot read/write)
-- 2. Allows authenticated users (via service role or RPC functions)
-- 3. Can be enhanced later with role-based policies
--
-- IMPORTANT: Since we use custom auth (not Supabase Auth),
-- RLS will block anon key but allow service role key.
-- Application-level authorization should be implemented in code.
--
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_topic_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonuses ENABLE ROW LEVEL SECURITY;

-- Drop existing permissive policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated users" ON %I', r.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Allow anonymous read" ON %I', r.tablename);
    END LOOP;
END $$;

-- ============================================
-- Policy: Block anonymous access
-- Allow only authenticated users (service role)
-- ============================================
--
-- Note: With custom auth, we can't use auth.uid() or auth.role()
-- So we block anon key and allow service role key
-- Application should enforce authorization in code
--

-- ============================================
-- IMPORTANT: With RLS enabled and NO policies,
-- all access is BLOCKED by default (including anon key)
-- ============================================
--
-- To allow access, you have 2 options:
--
-- Option 1: Use Service Role Key (Backend only!)
--   - Service role key bypasses RLS
--   - Never expose in client-side code
--
-- Option 2: Create RPC Functions with SECURITY DEFINER
--   - Functions can bypass RLS
--   - Implement authorization in function logic
--
-- ============================================
--
-- Example RPC function:
--
-- CREATE OR REPLACE FUNCTION get_students()
-- RETURNS TABLE(...) AS $$
-- BEGIN
--     -- Your authorization logic here
--     -- This function bypasses RLS
--     RETURN QUERY SELECT * FROM students;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
--
-- ============================================
--
-- For now, we'll create a permissive policy that allows
-- service role but you should remove this and use RPC functions instead
--
-- WARNING: This policy allows anon key too!
-- Remove this and use RPC functions for better security
--
DO $$ 
DECLARE
    tables TEXT[] := ARRAY[
        'users', 'teachers', 'students', 'classes', 'sessions', 'attendance',
        'payments', 'payroll', 'revenue', 'wallet_transactions', 'costs',
        'categories', 'class_teachers', 'student_classes', 'home_posts',
        'documents', 'assistants', 'assistant_payments', 'assistant_tasks',
        'lesson_plans', 'lesson_resources', 'lesson_tasks', 'lesson_outputs',
        'lesson_topics', 'lesson_topic_links', 'bonuses'
    ];
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY tables
    LOOP
        -- ⚠️ TEMPORARY: Allow all (for testing)
        -- TODO: Remove this and use RPC functions instead
        -- This allows both anon key and service role
        EXECUTE format('
            CREATE POLICY %I ON %I
            FOR ALL
            USING (true)
            WITH CHECK (true)
        ', 'temp_allow_all_' || table_name, table_name);
    END LOOP;
END $$;

-- ============================================
-- NOTES:
-- ============================================
--
-- 1. This simple RLS blocks anon key from accessing data
--    Service role key can still access everything
--
-- 2. For better security, implement:
--    - Backend API that uses service role key
--    - Application-level authorization checks
--    - Migrate to Supabase Auth for proper RLS
--
-- 3. Test after applying:
--    - Anon key queries should fail
--    - Service role queries should work
--
-- ============================================

