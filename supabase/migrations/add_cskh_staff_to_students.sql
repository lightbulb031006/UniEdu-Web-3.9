-- Add CSKH staff assignment fields to students table
-- These fields track which CSKH staff member is assigned to a student

ALTER TABLE students
ADD COLUMN IF NOT EXISTS cskh_staff_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS cskh_assigned_date DATE,
ADD COLUMN IF NOT EXISTS cskh_unassigned_date DATE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_students_cskh_staff_id ON students(cskh_staff_id) WHERE cskh_staff_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN students.cskh_staff_id IS 'ID của nhân sự CSKH được phân công cho học sinh này';
COMMENT ON COLUMN students.cskh_assigned_date IS 'Ngày bắt đầu phân công CSKH';
COMMENT ON COLUMN students.cskh_unassigned_date IS 'Ngày kết thúc phân công CSKH';

