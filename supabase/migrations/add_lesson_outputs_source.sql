-- Add source (nguồn) to lesson_outputs - separate from original_title
ALTER TABLE lesson_outputs
ADD COLUMN IF NOT EXISTS source TEXT;

COMMENT ON COLUMN lesson_outputs.source IS 'Nguồn bài (codeforces, Unicorns, LQDOJ, ...)';
