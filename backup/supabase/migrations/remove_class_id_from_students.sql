-- Migration: Remove class_id column from students table
-- Date: 2025-11-30
-- Reason: 
--   - class_id is a legacy field from one-to-many relationship (1 student → 1 class)
--   - System now uses many-to-many relationship via student_classes table (1 student → many classes)
--   - class_id is no longer used or updated by the application
--   - All data is now stored in student_classes junction table

-- Step 1: Find and drop the foreign key constraint (if exists)
-- PostgreSQL automatically creates constraint names, so we need to find it first
DO $$
DECLARE
    constraint_name TEXT;
    col_attnum INTEGER;
BEGIN
    -- Get the column attribute number for class_id
    SELECT attnum INTO col_attnum
    FROM pg_attribute
    WHERE attrelid = 'students'::regclass
      AND attname = 'class_id';
    
    -- Find the foreign key constraint name for class_id
    IF col_attnum IS NOT NULL THEN
        SELECT conname INTO constraint_name
        FROM pg_constraint
        WHERE conrelid = 'students'::regclass
          AND confrelid = 'classes'::regclass
          AND conkey = ARRAY[col_attnum]
          AND contype = 'f'
        LIMIT 1;
        
        -- Drop the constraint if it exists
        IF constraint_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE students DROP CONSTRAINT IF EXISTS %I', constraint_name);
            RAISE NOTICE 'Dropped foreign key constraint: %', constraint_name;
        END IF;
    END IF;
END $$;

-- Step 2: Drop the class_id column
-- This will automatically drop any indexes on this column as well
-- Note: Dropping a column automatically drops any constraints on that column
ALTER TABLE students 
    DROP COLUMN IF EXISTS class_id;

-- Verify the column is removed
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'students' 
        AND column_name = 'class_id'
    ) THEN
        RAISE EXCEPTION 'Column class_id still exists after drop attempt';
    ELSE
        RAISE NOTICE 'Successfully removed class_id column from students table';
    END IF;
END $$;

-- Note: 
-- - All class relationships are now stored in student_classes table
-- - No data loss: the application was already using student_classes as the source of truth
-- - The old class_id values were legacy data and not being read or updated

