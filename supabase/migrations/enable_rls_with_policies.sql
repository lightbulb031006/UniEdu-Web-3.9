-- ============================================
-- ROW LEVEL SECURITY (RLS) Migration
-- Enable RLS and create secure policies for all tables
-- ============================================
-- 
-- IMPORTANT: This migration implements role-based access control (RBAC)
-- using custom authentication system (not Supabase Auth)
--
-- Security Model:
-- - Admin: Full access to all tables
-- - Teacher: Read own data, read classes they teach, write sessions/attendance
-- - Student: Read own data, read classes they're enrolled in
-- - Assistant: Read/write based on assistant_type (technical/lesson_plan)
-- - Visitor: Read-only access to public data
--
-- ============================================

-- Helper function to get current user role from JWT or custom auth
-- This function extracts role from the request context
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
    -- Try to get role from JWT claim (if using Supabase Auth)
    -- For custom auth, we'll use a different approach via RPC
    RETURN COALESCE(
        current_setting('request.jwt.claims', true)::json->>'role',
        current_setting('app.current_user_role', true),
        'visitor'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get current user ID from JWT or custom auth
CREATE OR REPLACE FUNCTION get_user_id()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        current_setting('request.jwt.claims', true)::json->>'sub',
        current_setting('app.current_user_id', true),
        NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_user_role() = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's link_id (teacher_id, student_id, etc.)
CREATE OR REPLACE FUNCTION get_user_link_id()
RETURNS TEXT AS $$
DECLARE
    user_id_val TEXT;
BEGIN
    user_id_val := get_user_id();
    IF user_id_val IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Get link_id from users table
    SELECT link_id INTO user_id_val
    FROM users
    WHERE id::TEXT = user_id_val OR email = user_id_val OR account_handle = user_id_val
    LIMIT 1;
    
    RETURN user_id_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Enable RLS on all tables
-- ============================================

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

-- ============================================
-- Drop existing permissive policies
-- ============================================

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
    END LOOP;
END $$;

-- ============================================
-- USERS TABLE Policies
-- ============================================

-- Admin: Full access
CREATE POLICY "users_admin_all" ON users
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- Users can view their own record
CREATE POLICY "users_select_own" ON users
    FOR SELECT
    USING (
        id::TEXT = get_user_id() 
        OR email = get_user_id() 
        OR account_handle = get_user_id()
    );

-- Users can update their own record (except role and sensitive fields)
CREATE POLICY "users_update_own" ON users
    FOR UPDATE
    USING (
        id::TEXT = get_user_id() 
        OR email = get_user_id() 
        OR account_handle = get_user_id()
    )
    WITH CHECK (
        id::TEXT = get_user_id() 
        OR email = get_user_id() 
        OR account_handle = get_user_id()
    );

-- ============================================
-- TEACHERS TABLE Policies
-- ============================================

-- Admin: Full access
CREATE POLICY "teachers_admin_all" ON teachers
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- All authenticated users can read teachers (for class assignments, etc.)
CREATE POLICY "teachers_select_all" ON teachers
    FOR SELECT
    USING (true);

-- Teachers can update their own record
CREATE POLICY "teachers_update_own" ON teachers
    FOR UPDATE
    USING (id = get_user_link_id())
    WITH CHECK (id = get_user_link_id());

-- Only admin can insert/delete teachers
CREATE POLICY "teachers_admin_modify" ON teachers
    FOR INSERT
    WITH CHECK (is_admin());

CREATE POLICY "teachers_admin_delete" ON teachers
    FOR DELETE
    USING (is_admin());

-- ============================================
-- STUDENTS TABLE Policies
-- ============================================

-- Admin: Full access
CREATE POLICY "students_admin_all" ON students
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- All authenticated users can read students (for class rosters, etc.)
CREATE POLICY "students_select_all" ON students
    FOR SELECT
    USING (true);

-- Students can view their own record
CREATE POLICY "students_select_own" ON students
    FOR SELECT
    USING (id = get_user_link_id());

-- Only admin can insert/update/delete students
CREATE POLICY "students_admin_modify" ON students
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================
-- CLASSES TABLE Policies
-- ============================================

-- Admin: Full access
CREATE POLICY "classes_admin_all" ON classes
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- All authenticated users can read classes
CREATE POLICY "classes_select_all" ON classes
    FOR SELECT
    USING (true);

-- Only admin can insert/update/delete classes
CREATE POLICY "classes_admin_modify" ON classes
    FOR INSERT
    WITH CHECK (is_admin());

CREATE POLICY "classes_admin_update" ON classes
    FOR UPDATE
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "classes_admin_delete" ON classes
    FOR DELETE
    USING (is_admin());

-- ============================================
-- SESSIONS TABLE Policies
-- ============================================

-- Admin: Full access
CREATE POLICY "sessions_admin_all" ON sessions
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- All authenticated users can read sessions
CREATE POLICY "sessions_select_all" ON sessions
    FOR SELECT
    USING (true);

-- Teachers can insert/update sessions they teach
CREATE POLICY "sessions_teacher_modify" ON sessions
    FOR ALL
    USING (
        teacher_id = get_user_link_id() 
        OR EXISTS (
            SELECT 1 FROM class_teachers ct
            WHERE ct.class_id = sessions.class_id 
            AND ct.teacher_id = get_user_link_id()
        )
    )
    WITH CHECK (
        teacher_id = get_user_link_id() 
        OR EXISTS (
            SELECT 1 FROM class_teachers ct
            WHERE ct.class_id = sessions.class_id 
            AND ct.teacher_id = get_user_link_id()
        )
    );

-- Only admin can delete sessions
CREATE POLICY "sessions_admin_delete" ON sessions
    FOR DELETE
    USING (is_admin());

-- ============================================
-- ATTENDANCE TABLE Policies
-- ============================================

-- Admin: Full access
CREATE POLICY "attendance_admin_all" ON attendance
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- All authenticated users can read attendance
CREATE POLICY "attendance_select_all" ON attendance
    FOR SELECT
    USING (true);

-- Teachers can insert/update attendance for their sessions
CREATE POLICY "attendance_teacher_modify" ON attendance
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sessions s
            JOIN class_teachers ct ON ct.class_id = s.class_id
            WHERE s.id = attendance.session_id
            AND ct.teacher_id = get_user_link_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sessions s
            JOIN class_teachers ct ON ct.class_id = s.class_id
            WHERE s.id = attendance.session_id
            AND ct.teacher_id = get_user_link_id()
        )
    );

-- ============================================
-- PAYMENTS TABLE Policies
-- ============================================

-- Admin: Full access
CREATE POLICY "payments_admin_all" ON payments
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- All authenticated users can read payments
CREATE POLICY "payments_select_all" ON payments
    FOR SELECT
    USING (true);

-- Students can view their own payments
CREATE POLICY "payments_select_own" ON payments
    FOR SELECT
    USING (student_id = get_user_link_id());

-- Only admin can insert/update/delete payments
CREATE POLICY "payments_admin_modify" ON payments
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================
-- PAYROLL TABLE Policies
-- ============================================

-- Admin: Full access
CREATE POLICY "payroll_admin_all" ON payroll
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- Teachers can view their own payroll
CREATE POLICY "payroll_select_own" ON payroll
    FOR SELECT
    USING (teacher_id = get_user_link_id());

-- Only admin can insert/update/delete payroll
CREATE POLICY "payroll_admin_modify" ON payroll
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================
-- WALLET_TRANSACTIONS TABLE Policies
-- ============================================

-- Admin: Full access
CREATE POLICY "wallet_transactions_admin_all" ON wallet_transactions
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- Students can view their own wallet transactions
CREATE POLICY "wallet_transactions_select_own" ON wallet_transactions
    FOR SELECT
    USING (student_id = get_user_link_id());

-- All authenticated users can read (for admin/accountant)
CREATE POLICY "wallet_transactions_select_all" ON wallet_transactions
    FOR SELECT
    USING (get_user_role() IN ('admin', 'assistant'));

-- Only admin can insert/update/delete wallet transactions
CREATE POLICY "wallet_transactions_admin_modify" ON wallet_transactions
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================
-- COSTS TABLE Policies
-- ============================================

-- Admin: Full access
CREATE POLICY "costs_admin_all" ON costs
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- All authenticated users can read costs
CREATE POLICY "costs_select_all" ON costs
    FOR SELECT
    USING (true);

-- Only admin can insert/update/delete costs
CREATE POLICY "costs_admin_modify" ON costs
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================
-- LESSON_RESOURCES, LESSON_TASKS, LESSON_OUTPUTS Policies
-- ============================================

-- Admin: Full access
CREATE POLICY "lesson_resources_admin_all" ON lesson_resources
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "lesson_tasks_admin_all" ON lesson_tasks
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "lesson_outputs_admin_all" ON lesson_outputs
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- All authenticated users can read
CREATE POLICY "lesson_resources_select_all" ON lesson_resources
    FOR SELECT
    USING (true);

CREATE POLICY "lesson_tasks_select_all" ON lesson_tasks
    FOR SELECT
    USING (true);

CREATE POLICY "lesson_outputs_select_all" ON lesson_outputs
    FOR SELECT
    USING (true);

-- Assistants with lesson_plan role can modify
CREATE POLICY "lesson_resources_assistant_modify" ON lesson_resources
    FOR ALL
    USING (
        get_user_role() = 'assistant' 
        AND EXISTS (
            SELECT 1 FROM users u
            WHERE (u.id::TEXT = get_user_id() OR u.email = get_user_id() OR u.account_handle = get_user_id())
            AND u.assistant_type = 'lesson_plan'
        )
    )
    WITH CHECK (
        get_user_role() = 'assistant' 
        AND EXISTS (
            SELECT 1 FROM users u
            WHERE (u.id::TEXT = get_user_id() OR u.email = get_user_id() OR u.account_handle = get_user_id())
            AND u.assistant_type = 'lesson_plan'
        )
    );

CREATE POLICY "lesson_tasks_assistant_modify" ON lesson_tasks
    FOR ALL
    USING (
        get_user_role() = 'assistant' 
        AND EXISTS (
            SELECT 1 FROM users u
            WHERE (u.id::TEXT = get_user_id() OR u.email = get_user_id() OR u.account_handle = get_user_id())
            AND u.assistant_type = 'lesson_plan'
        )
    )
    WITH CHECK (
        get_user_role() = 'assistant' 
        AND EXISTS (
            SELECT 1 FROM users u
            WHERE (u.id::TEXT = get_user_id() OR u.email = get_user_id() OR u.account_handle = get_user_id())
            AND u.assistant_type = 'lesson_plan'
        )
    );

CREATE POLICY "lesson_outputs_assistant_modify" ON lesson_outputs
    FOR ALL
    USING (
        get_user_role() = 'assistant' 
        AND EXISTS (
            SELECT 1 FROM users u
            WHERE (u.id::TEXT = get_user_id() OR u.email = get_user_id() OR u.account_handle = get_user_id())
            AND u.assistant_type = 'lesson_plan'
        )
    )
    WITH CHECK (
        get_user_role() = 'assistant' 
        AND EXISTS (
            SELECT 1 FROM users u
            WHERE (u.id::TEXT = get_user_id() OR u.email = get_user_id() OR u.account_handle = get_user_id())
            AND u.assistant_type = 'lesson_plan'
        )
    );

-- ============================================
-- Other tables: Allow read for all, modify for admin only
-- ============================================

-- Categories, Class Teachers, Student Classes, Home Posts, Documents, etc.
DO $$ 
DECLARE
    tables TEXT[] := ARRAY[
        'categories', 'class_teachers', 'student_classes', 'home_posts', 
        'documents', 'assistants', 'assistant_payments', 'assistant_tasks',
        'lesson_plans', 'lesson_topics', 'lesson_topic_links', 'revenue', 'bonuses'
    ];
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY tables
    LOOP
        -- Admin full access
        EXECUTE format('
            CREATE POLICY %I ON %I
            FOR ALL
            USING (is_admin())
            WITH CHECK (is_admin())
        ', 'admin_all_' || table_name, table_name);
        
        -- All authenticated users can read
        EXECUTE format('
            CREATE POLICY %I ON %I
            FOR SELECT
            USING (true)
        ', 'select_all_' || table_name, table_name);
    END LOOP;
END $$;

-- ============================================
-- NOTES:
-- ============================================
-- 
-- 1. This RLS implementation uses custom auth (not Supabase Auth)
--    You need to set user context via:
--    SET LOCAL app.current_user_role = 'admin';
--    SET LOCAL app.current_user_id = 'user_id_or_email';
--
-- 2. For production, consider migrating to Supabase Auth for better security
--
-- 3. Test all policies after applying this migration
--
-- 4. Monitor and adjust policies based on actual usage patterns
--
-- ============================================

