-- Migration: Add denormalized columns for faster loading
-- This adds columns to store class IDs and teacher IDs directly in tables
-- to avoid expensive joins and improve load performance

-- ============================================
-- 1. Add columns to teachers table
-- ============================================
ALTER TABLE teachers
ADD COLUMN IF NOT EXISTS active_class_ids JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS taught_class_ids JSONB DEFAULT '[]'::jsonb;

-- Add comments
COMMENT ON COLUMN teachers.active_class_ids IS 'Array of class IDs that this teacher is currently teaching (from class_teachers table). Updated automatically when teacher is added/removed from class.';
COMMENT ON COLUMN teachers.taught_class_ids IS 'Array of class IDs that this teacher has ever taught (from sessions table). Updated automatically when session is created.';

-- ============================================
-- 2. Add column to classes table
-- ============================================
ALTER TABLE classes
ADD COLUMN IF NOT EXISTS teacher_ids JSONB DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN classes.teacher_ids IS 'Array of teacher IDs that are currently teaching this class (from class_teachers table). Updated automatically when teacher is added/removed from class.';

-- ============================================
-- 3. Create indexes for faster queries
-- ============================================
-- Index for querying teachers by active class
CREATE INDEX IF NOT EXISTS idx_teachers_active_class_ids ON teachers USING GIN (active_class_ids);

-- Index for querying teachers by taught class
CREATE INDEX IF NOT EXISTS idx_teachers_taught_class_ids ON teachers USING GIN (taught_class_ids);

-- Index for querying classes by teacher
CREATE INDEX IF NOT EXISTS idx_classes_teacher_ids ON classes USING GIN (teacher_ids);

-- ============================================
-- 4. Populate initial data from existing tables
-- ============================================

-- Populate active_class_ids from class_teachers
UPDATE teachers
SET active_class_ids = COALESCE(
  (
    SELECT jsonb_agg(DISTINCT class_id ORDER BY class_id)
    FROM class_teachers
    WHERE class_teachers.teacher_id = teachers.id
  ),
  '[]'::jsonb
);

-- Populate taught_class_ids from sessions
UPDATE teachers
SET taught_class_ids = COALESCE(
  (
    SELECT jsonb_agg(DISTINCT class_id ORDER BY class_id)
    FROM sessions
    WHERE sessions.teacher_id = teachers.id
  ),
  '[]'::jsonb
);

-- Populate teacher_ids in classes from class_teachers
UPDATE classes
SET teacher_ids = COALESCE(
  (
    SELECT jsonb_agg(DISTINCT teacher_id ORDER BY teacher_id)
    FROM class_teachers
    WHERE class_teachers.class_id = classes.id
  ),
  '[]'::jsonb
);

-- ============================================
-- 5. Create function to sync teacher active_class_ids
-- ============================================
CREATE OR REPLACE FUNCTION sync_teacher_active_class_ids(p_teacher_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE teachers
  SET active_class_ids = COALESCE(
    (
      SELECT jsonb_agg(DISTINCT class_id ORDER BY class_id)
      FROM class_teachers
      WHERE class_teachers.teacher_id = p_teacher_id
    ),
    '[]'::jsonb
  )
  WHERE id = p_teacher_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. Create function to sync class teacher_ids
-- ============================================
CREATE OR REPLACE FUNCTION sync_class_teacher_ids(p_class_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE classes
  SET teacher_ids = COALESCE(
    (
      SELECT jsonb_agg(DISTINCT teacher_id ORDER BY teacher_id)
      FROM class_teachers
      WHERE class_teachers.class_id = p_class_id
    ),
    '[]'::jsonb
  )
  WHERE id = p_class_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Create function to sync teacher taught_class_ids
-- ============================================
CREATE OR REPLACE FUNCTION sync_teacher_taught_class_ids(p_teacher_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE teachers
  SET taught_class_ids = COALESCE(
    (
      SELECT jsonb_agg(DISTINCT class_id ORDER BY class_id)
      FROM sessions
      WHERE sessions.teacher_id = p_teacher_id
    ),
    '[]'::jsonb
  )
  WHERE id = p_teacher_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. Create triggers to maintain denormalized data
-- ============================================

-- Trigger: Update teacher active_class_ids and class teacher_ids when class_teachers changes
CREATE OR REPLACE FUNCTION trigger_sync_class_teacher_denormalized()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Sync teacher's active_class_ids
    PERFORM sync_teacher_active_class_ids(NEW.teacher_id);
    -- Sync class's teacher_ids
    PERFORM sync_class_teacher_ids(NEW.class_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Sync teacher's active_class_ids
    PERFORM sync_teacher_active_class_ids(OLD.teacher_id);
    -- Sync class's teacher_ids
    PERFORM sync_class_teacher_ids(OLD.class_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on class_teachers
DROP TRIGGER IF EXISTS trg_sync_class_teacher_denormalized ON class_teachers;
CREATE TRIGGER trg_sync_class_teacher_denormalized
  AFTER INSERT OR DELETE ON class_teachers
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_class_teacher_denormalized();

-- Trigger: Update teacher taught_class_ids when session is created/updated
CREATE OR REPLACE FUNCTION trigger_sync_teacher_taught_class_ids()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.teacher_id IS NOT NULL THEN
      PERFORM sync_teacher_taught_class_ids(NEW.teacher_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.teacher_id IS NOT NULL THEN
      PERFORM sync_teacher_taught_class_ids(OLD.teacher_id);
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on sessions
DROP TRIGGER IF EXISTS trg_sync_teacher_taught_class_ids ON sessions;
CREATE TRIGGER trg_sync_teacher_taught_class_ids
  AFTER INSERT OR UPDATE OR DELETE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_teacher_taught_class_ids();

-- ============================================
-- NOTES:
-- ============================================
-- 1. These columns are denormalized for performance
-- 2. They are automatically maintained by triggers
-- 3. Use these columns for fast lookups instead of joining tables
-- 4. The data is always in sync with class_teachers and sessions tables
-- ============================================

