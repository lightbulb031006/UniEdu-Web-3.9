-- Supabase Database Schema for Unicorns Edu
-- Run this SQL in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    phone TEXT, -- Số điện thoại (có thể dùng để đăng nhập)
    password TEXT NOT NULL, -- Password hash (bcrypt/argon2) hoặc plaintext (tạm thời)
    password_hash TEXT, -- Password hash riêng (nếu cần migrate)
    name TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student', 'assistant', 'visitor')),
    province TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')), -- pending: chờ xác thực email/SĐT
    link_id TEXT, -- Links to teacher/student/assistant ID (e.g., 'S001', 'T001', 'A001')
    account_handle TEXT UNIQUE, -- Username/handle for login (e.g., 'hocsinh1', 'giaovien1')
    assistant_type TEXT CHECK (assistant_type IN ('technical', 'lesson_plan')), -- Only for assistant role
    email_verified BOOLEAN DEFAULT FALSE, -- Đã xác thực email chưa
    phone_verified BOOLEAN DEFAULT FALSE, -- Đã xác thực SĐT chưa
    reset_token TEXT, -- Token để reset password
    reset_token_expires TIMESTAMP WITH TIME ZONE, -- Thời hạn token reset
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index cho tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_account_handle ON users(account_handle) WHERE account_handle IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_link_id ON users(link_id) WHERE link_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ============================================
-- TEACHERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS teachers (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    birth_date DATE,
    university TEXT,
    high_school TEXT,
    province TEXT,
    specialization TEXT,
    bank_account TEXT,
    bank_qr_link TEXT,
    photo_url TEXT,
    roles JSONB DEFAULT '[]'::jsonb, -- Array of staff roles: ['teacher', 'lesson_plan', 'accountant', 'cskh_sale', 'communication']
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CLASSES TABLE (MUST BE CREATED BEFORE STUDENTS)
-- ============================================
CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'paused', 'ended')),
    max_students INTEGER DEFAULT 15,
    tuition_per_session INTEGER DEFAULT 0,
    schedule JSONB DEFAULT '[]'::jsonb, -- Array of {day, time}
    custom_teacher_allowances JSONB DEFAULT '{}'::jsonb, -- {teacherId: amount}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STUDENTS TABLE (NOW CAN REFERENCE CLASSES)
-- ============================================
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT,
    school TEXT,
    province TEXT,
    birth_year INTEGER,
    parent_name TEXT,
    parent_phone TEXT,
    -- NOTE: class_id column removed - use student_classes table for many-to-many relationship
    -- class_id TEXT REFERENCES classes(id) ON DELETE SET NULL, -- DEPRECATED: Use student_classes table instead
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    gender TEXT DEFAULT 'male' CHECK (gender IN ('male', 'female')),
    goal TEXT,
    last_attendance TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CLASS_TEACHERS JUNCTION TABLE (Many-to-Many)
-- ============================================
CREATE TABLE IF NOT EXISTS class_teachers (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    custom_allowance INTEGER, -- Override for this specific teacher-class combination
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(class_id, teacher_id)
);

-- ============================================
-- STUDENT_CLASSES JUNCTION TABLE (Many-to-Many)
-- ============================================
CREATE TABLE IF NOT EXISTS student_classes (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, class_id)
);

-- ============================================
-- SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    duration DECIMAL(4,2) DEFAULT 2.0, -- hours
    coefficient DECIMAL(3,1) DEFAULT 1.0,
    notes TEXT,
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid', 'deposit')),
    allowance_amount INTEGER, -- Trợ cấp giáo viên (NULL nếu chưa tính/set)
    subsidy_original INTEGER, -- Giá trị trợ cấp ban đầu (NULL nếu chưa chỉnh sửa)
    subsidy_modified_by TEXT, -- ID/email của admin chỉnh sửa (NULL nếu chưa chỉnh sửa)
    subsidy_modified_at TIMESTAMP WITH TIME ZONE, -- Thời gian chỉnh sửa (NULL nếu chưa chỉnh sửa)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ATTENDANCE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    present BOOLEAN DEFAULT true,
    remark TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, student_id)
);

-- ============================================
-- PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('paid', 'pending', 'cancelled')),
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PAYROLL TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payroll (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- Format: YYYY-MM
    total_hours DECIMAL(6,2) DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    base_rate INTEGER DEFAULT 0,
    bonus INTEGER DEFAULT 0,
    total_pay INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(teacher_id, month)
);

-- ============================================
-- REVENUE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS revenue (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- Format: YYYY-MM
    enrolled_count INTEGER DEFAULT 0,
    tuition_per_student INTEGER DEFAULT 0,
    total_revenue INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(class_id, month)
);

-- ============================================
-- WALLET TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('topup', 'loan', 'advance', 'repayment')),
    amount INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    date DATE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- COSTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS costs (
    id TEXT PRIMARY KEY,
    month TEXT NOT NULL, -- Format: YYYY-MM
    category TEXT NOT NULL,
    amount INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- BONUSES TABLE (for staff bonuses/rewards)
-- ============================================
CREATE TABLE IF NOT EXISTS bonuses (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    work_type TEXT NOT NULL, -- Type of work: 'Gia sư', 'Giáo án', 'Kế toán', 'CSKH & SALE', 'Truyền thông', 'Khác'
    amount INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid', 'deposit')),
    note TEXT,
    month TEXT NOT NULL, -- Format: YYYY-MM (for filtering by month)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- HOME POSTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS home_posts (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('intro','news','docs','policy')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    tags JSONB DEFAULT '[]'::jsonb,
    badge TEXT,
    author_id TEXT,
    author_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CATEGORIES TABLE (for class types)
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ASSISTANTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS assistants (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    assistant_type TEXT NOT NULL CHECK (assistant_type IN ('technical', 'lesson_plan')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    user_id TEXT, -- Reference to users table
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ASSISTANT_PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS assistant_payments (
    id TEXT PRIMARY KEY,
    assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('paid', 'pending', 'deposit')),
    date DATE NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ASSISTANT_TASKS TABLE (for technical assistants)
-- ============================================
CREATE TABLE IF NOT EXISTS assistant_tasks (
    id TEXT PRIMARY KEY,
    assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
    contest TEXT,
    problem_name TEXT,
    date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('paid', 'pending', 'deposit')),
    link TEXT,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- LESSON_PLANS TABLE (legacy, for assistant-detail page)
-- ============================================
CREATE TABLE IF NOT EXISTS lesson_plans (
    id TEXT PRIMARY KEY,
    assistant_id TEXT REFERENCES assistants(id) ON DELETE SET NULL,
    type TEXT CHECK (type IN ('resource', 'completed_task')),
    resource_link TEXT,
    tag TEXT,
    level TEXT,
    lesson_name TEXT,
    cost INTEGER DEFAULT 0,
    date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('paid', 'pending', 'deposit')),
    contest_uploaded TEXT,
    link TEXT,
    completed_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- DOCUMENTS TABLE (for coding/programming materials)
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    tags JSONB DEFAULT '[]'::jsonb, -- Array of tag strings
    uploaded_by TEXT, -- User ID who uploaded
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- LESSON_RESOURCES TABLE (for lesson plan resources)
-- ============================================
CREATE TABLE IF NOT EXISTS lesson_resources (
    id TEXT PRIMARY KEY,
    resource_link TEXT NOT NULL,
    title TEXT,
    description TEXT,
    tags JSONB DEFAULT '[]'::jsonb, -- Array of tag strings
    created_by TEXT, -- User ID who created
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- LESSON_TASKS TABLE (for task assignments)
-- ============================================
CREATE TABLE IF NOT EXISTS lesson_tasks (
    id TEXT PRIMARY KEY,
    assistant_id TEXT REFERENCES assistants(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    due_date DATE,
    created_by TEXT, -- User ID who created
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- LESSON_OUTPUTS TABLE (for completed lesson plans)
-- ============================================
CREATE TABLE IF NOT EXISTS lesson_outputs (
    id TEXT PRIMARY KEY,
    tag TEXT,
    level TEXT,
    lesson_name TEXT NOT NULL,
    original_title TEXT, -- Original title with source (e.g., "Light - VNOI")
    cost INTEGER DEFAULT 0,
    date DATE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('paid', 'pending', 'deposit')),
    contest_uploaded TEXT,
    link TEXT,
    completed_by TEXT, -- Name of person who completed
    assistant_id TEXT REFERENCES assistants(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES for better performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_sessions_class_id ON sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_sessions_teacher_id ON sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
CREATE INDEX IF NOT EXISTS idx_attendance_session_id ON attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_class_id ON payments(class_id);
CREATE INDEX IF NOT EXISTS idx_payroll_teacher_id ON payroll(teacher_id);
CREATE INDEX IF NOT EXISTS idx_payroll_month ON payroll(month);
CREATE INDEX IF NOT EXISTS idx_class_teachers_class_id ON class_teachers(class_id);
CREATE INDEX IF NOT EXISTS idx_class_teachers_teacher_id ON class_teachers(teacher_id);
CREATE INDEX IF NOT EXISTS idx_student_classes_student_id ON student_classes(student_id);
CREATE INDEX IF NOT EXISTS idx_student_classes_class_id ON student_classes(class_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_student_id ON wallet_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_home_posts_category ON home_posts(category);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_assistants_user_id ON assistants(user_id);
CREATE INDEX IF NOT EXISTS idx_assistants_type ON assistants(assistant_type);
CREATE INDEX IF NOT EXISTS idx_assistant_payments_assistant_id ON assistant_payments(assistant_id);
CREATE INDEX IF NOT EXISTS idx_assistant_payments_date ON assistant_payments(date);
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_assistant_id ON assistant_tasks(assistant_id);
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_date ON assistant_tasks(date);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_assistant_id ON lesson_plans(assistant_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_type ON lesson_plans(type);
CREATE INDEX IF NOT EXISTS idx_lesson_resources_created_at ON lesson_resources(created_at);
CREATE INDEX IF NOT EXISTS idx_lesson_tasks_assistant_id ON lesson_tasks(assistant_id);
CREATE INDEX IF NOT EXISTS idx_lesson_tasks_status ON lesson_tasks(status);
CREATE INDEX IF NOT EXISTS idx_lesson_tasks_due_date ON lesson_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_lesson_outputs_date ON lesson_outputs(date);
CREATE INDEX IF NOT EXISTS idx_lesson_outputs_status ON lesson_outputs(status);
CREATE INDEX IF NOT EXISTS idx_lesson_outputs_tag ON lesson_outputs(tag);
CREATE INDEX IF NOT EXISTS idx_bonuses_staff_id ON bonuses(staff_id);
CREATE INDEX IF NOT EXISTS idx_bonuses_month ON bonuses(month);
CREATE INDEX IF NOT EXISTS idx_bonuses_status ON bonuses(status);

-- ============================================
-- ROW LEVEL SECURITY (RLS) Policies
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
ALTER TABLE bonuses ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (adjust based on your needs)
-- For now, we'll allow all operations (you can restrict later)
-- Drop existing policies if they exist, then create new ones
DROP POLICY IF EXISTS "Allow all for authenticated users" ON users;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON teachers;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON students;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON classes;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON sessions;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON attendance;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON payments;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON payroll;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON revenue;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON wallet_transactions;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON costs;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON categories;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON class_teachers;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON student_classes;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON home_posts;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON documents;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON assistants;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON assistant_payments;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON assistant_tasks;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON lesson_plans;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON lesson_resources;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON lesson_tasks;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON lesson_outputs;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON bonuses;

CREATE POLICY "Allow all for authenticated users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON teachers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON classes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON payroll FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON revenue FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON wallet_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON costs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON class_teachers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON student_classes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON home_posts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON assistants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON assistant_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON assistant_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON lesson_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON lesson_resources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON lesson_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON lesson_outputs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON bonuses FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- FUNCTIONS for updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at (drop existing first)
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_teachers_updated_at ON teachers;
DROP TRIGGER IF EXISTS update_students_updated_at ON students;
DROP TRIGGER IF EXISTS update_classes_updated_at ON classes;
DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
DROP TRIGGER IF EXISTS update_payroll_updated_at ON payroll;
DROP TRIGGER IF EXISTS update_revenue_updated_at ON revenue;
DROP TRIGGER IF EXISTS update_wallet_transactions_updated_at ON wallet_transactions;
DROP TRIGGER IF EXISTS update_costs_updated_at ON costs;
DROP TRIGGER IF EXISTS update_home_posts_updated_at ON home_posts;
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
DROP TRIGGER IF EXISTS update_assistants_updated_at ON assistants;
DROP TRIGGER IF EXISTS update_assistant_payments_updated_at ON assistant_payments;
DROP TRIGGER IF EXISTS update_assistant_tasks_updated_at ON assistant_tasks;
DROP TRIGGER IF EXISTS update_lesson_plans_updated_at ON lesson_plans;
DROP TRIGGER IF EXISTS update_lesson_resources_updated_at ON lesson_resources;
DROP TRIGGER IF EXISTS update_lesson_tasks_updated_at ON lesson_tasks;
DROP TRIGGER IF EXISTS update_lesson_outputs_updated_at ON lesson_outputs;
DROP TRIGGER IF EXISTS update_bonuses_updated_at ON bonuses;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON teachers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payroll_updated_at BEFORE UPDATE ON payroll FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_revenue_updated_at BEFORE UPDATE ON revenue FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wallet_transactions_updated_at BEFORE UPDATE ON wallet_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_costs_updated_at BEFORE UPDATE ON costs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_home_posts_updated_at BEFORE UPDATE ON home_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assistants_updated_at BEFORE UPDATE ON assistants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assistant_payments_updated_at BEFORE UPDATE ON assistant_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assistant_tasks_updated_at BEFORE UPDATE ON assistant_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lesson_plans_updated_at BEFORE UPDATE ON lesson_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lesson_resources_updated_at BEFORE UPDATE ON lesson_resources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- ============================================
-- LESSON_TOPICS TABLE (for organizing lessons by topics)
-- ============================================
CREATE TABLE IF NOT EXISTS lesson_topics (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE, -- true for "Tất cả" and Level 0-5
    level INTEGER, -- 0-5 for default level topics, NULL for custom topics
    created_by TEXT, -- User ID who created (NULL for default topics)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- LESSON_TOPIC_LINKS TABLE (many-to-many relationship)
-- ============================================
CREATE TABLE IF NOT EXISTS lesson_topic_links (
    id TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL REFERENCES lesson_topics(id) ON DELETE CASCADE,
    lesson_output_id TEXT NOT NULL REFERENCES lesson_outputs(id) ON DELETE CASCADE,
    order_index INTEGER DEFAULT 0, -- Order within the topic
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(topic_id, lesson_output_id)
);

-- Indexes for lesson_topics
CREATE INDEX IF NOT EXISTS idx_lesson_topics_is_default ON lesson_topics(is_default);
CREATE INDEX IF NOT EXISTS idx_lesson_topics_level ON lesson_topics(level);

-- Indexes for lesson_topic_links
CREATE INDEX IF NOT EXISTS idx_lesson_topic_links_topic_id ON lesson_topic_links(topic_id);
CREATE INDEX IF NOT EXISTS idx_lesson_topic_links_lesson_output_id ON lesson_topic_links(lesson_output_id);
CREATE INDEX IF NOT EXISTS idx_lesson_topic_links_order ON lesson_topic_links(topic_id, order_index);

-- RLS Policies for lesson_topics
ALTER TABLE lesson_topics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON lesson_topics;
CREATE POLICY "Allow all for authenticated users" ON lesson_topics FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for lesson_topic_links
ALTER TABLE lesson_topic_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON lesson_topic_links;
CREATE POLICY "Allow all for authenticated users" ON lesson_topic_links FOR ALL USING (true) WITH CHECK (true);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_lesson_topics_updated_at ON lesson_topics;
CREATE TRIGGER update_lesson_topics_updated_at BEFORE UPDATE ON lesson_topics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lesson_topic_links_updated_at ON lesson_topic_links;
CREATE TRIGGER update_lesson_topic_links_updated_at BEFORE UPDATE ON lesson_topic_links FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lesson_tasks_updated_at BEFORE UPDATE ON lesson_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lesson_outputs_updated_at BEFORE UPDATE ON lesson_outputs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bonuses_updated_at BEFORE UPDATE ON bonuses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

