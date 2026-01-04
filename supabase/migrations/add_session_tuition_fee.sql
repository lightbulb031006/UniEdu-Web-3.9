-- Add tuition_fee column to sessions table
-- This field stores the tuition fee amount for each session
-- It is fixed when the session is created and can be manually edited

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS tuition_fee INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN sessions.tuition_fee IS 'Học phí của buổi học (số tiền học sinh đóng cho buổi đó). Được cố định khi tạo buổi học, có thể sửa thủ công.';

-- Create index for performance (if needed for queries)
-- CREATE INDEX IF NOT EXISTS idx_sessions_tuition_fee ON sessions(tuition_fee) WHERE tuition_fee > 0;

