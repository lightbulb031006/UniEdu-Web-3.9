-- Add date and status columns to costs table
-- These columns are optional and used by the frontend

ALTER TABLE costs 
ADD COLUMN IF NOT EXISTS date DATE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'paid' CHECK (status IN ('paid', 'pending'));

-- Add index for date if needed
CREATE INDEX IF NOT EXISTS idx_costs_date ON costs(date) WHERE date IS NOT NULL;

-- Add index for status if needed
CREATE INDEX IF NOT EXISTS idx_costs_status ON costs(status) WHERE status IS NOT NULL;

