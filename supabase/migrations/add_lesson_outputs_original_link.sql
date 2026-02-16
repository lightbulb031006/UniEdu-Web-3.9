-- Add original_link (link gốc) to lesson_outputs
ALTER TABLE lesson_outputs
ADD COLUMN IF NOT EXISTS original_link TEXT;

COMMENT ON COLUMN lesson_outputs.original_link IS 'Link gốc (URL nguồn bài)';
