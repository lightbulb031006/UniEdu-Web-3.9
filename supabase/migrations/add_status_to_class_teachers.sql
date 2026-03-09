-- Migration: Add status and removed_at to class_teachers table
-- This allows tracking of teacher-class assignments even after removal
-- Run this in Supabase SQL Editor

-- Add status column to track active/inactive assignments
ALTER TABLE class_teachers 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

-- Add removed_at timestamp to track when teacher was removed from class
ALTER TABLE class_teachers 
ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster queries on status
CREATE INDEX IF NOT EXISTS idx_class_teachers_status ON class_teachers(status) WHERE status = 'inactive';

-- Update existing records to have status = 'active' (if not already set)
UPDATE class_teachers 
SET status = 'active' 
WHERE status IS NULL;

-- Add comment to explain the purpose
COMMENT ON COLUMN class_teachers.status IS 'Status of teacher-class assignment: active (currently teaching) or inactive (previously taught, kept for history)';
COMMENT ON COLUMN class_teachers.removed_at IS 'Timestamp when teacher was removed from class (NULL if still active)';

