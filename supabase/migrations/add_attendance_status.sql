-- Migration: Add status field to attendance table
-- Change from present (boolean) to status (enum: present, excused, absent)

-- Step 1: Add new status column (nullable for migration)
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT NULL;

-- Step 2: Migrate existing data: present=true -> status='present', present=false -> status='absent'
UPDATE attendance 
SET status = CASE 
  WHEN present = true THEN 'present'
  WHEN present = false THEN 'absent'
  ELSE 'absent'
END
WHERE status IS NULL;

-- Step 3: Set NOT NULL constraint after data migration
ALTER TABLE attendance 
ALTER COLUMN status SET NOT NULL,
ALTER COLUMN status SET DEFAULT 'present';

-- Step 4: Add check constraint to ensure valid values
ALTER TABLE attendance 
ADD CONSTRAINT attendance_status_check 
CHECK (status IN ('present', 'excused', 'absent'));

-- Step 5: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
CREATE INDEX IF NOT EXISTS idx_attendance_session_status ON attendance(session_id, status);

-- Step 6: Keep present column for backward compatibility (can be removed later)
-- For now, we'll keep it but it will be deprecated
COMMENT ON COLUMN attendance.present IS 'Deprecated: Use status column instead. Will be removed in future version.';
COMMENT ON COLUMN attendance.status IS 'Attendance status: present (có mặt), excused (nghỉ có phép), absent (vắng mặt)';

