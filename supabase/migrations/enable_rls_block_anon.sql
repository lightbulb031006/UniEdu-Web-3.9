-- ============================================
-- ROW LEVEL SECURITY (RLS) - Block Anon Key
-- ============================================
--
-- This migration enables RLS and blocks anonymous access
-- by NOT creating any policies (default: deny all)
--
-- Access methods:
-- 1. Service Role Key (bypasses RLS) - Backend only!
-- 2. RPC Functions with SECURITY DEFINER - Recommended
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

-- Drop all existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- ============================================
-- RESULT: All tables now have RLS enabled
-- but NO policies = ALL ACCESS BLOCKED
-- ============================================
--
-- To allow access, you MUST:
--
-- 1. Use Service Role Key (Backend only!)
--    const supabase = createClient(URL, SERVICE_ROLE_KEY);
--
-- 2. Create RPC Functions (Recommended)
--    CREATE FUNCTION get_students() ...
--    SECURITY DEFINER; -- Bypasses RLS
--
-- ============================================
--
-- Example RPC function with authorization:
--
-- CREATE OR REPLACE FUNCTION get_students_for_user(p_user_role TEXT, p_user_id TEXT)
-- RETURNS TABLE(id TEXT, full_name TEXT, ...) AS $$
-- BEGIN
--     -- Authorization logic
--     IF p_user_role = 'admin' THEN
--         RETURN QUERY SELECT * FROM students;
--     ELSIF p_user_role = 'student' THEN
--         RETURN QUERY SELECT * FROM students WHERE id = p_user_id;
--     ELSE
--         RETURN; -- Empty result
--     END IF;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
--
-- ============================================

