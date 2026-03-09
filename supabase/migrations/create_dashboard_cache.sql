-- Migration: Create dashboard_cache table
-- Run this in Supabase SQL Editor

-- ============================================
-- DASHBOARD CACHE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dashboard_cache (
    cache_key TEXT PRIMARY KEY, -- Format: 'dashboard:month:2024-01' or 'quickview:2024'
    cache_type TEXT NOT NULL CHECK (cache_type IN ('dashboard', 'quickview')),
    data JSONB NOT NULL, -- Cached data as JSON
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- TTL expiration time
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_dashboard_cache_key ON dashboard_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_dashboard_cache_type ON dashboard_cache(cache_type);
CREATE INDEX IF NOT EXISTS idx_dashboard_cache_expires ON dashboard_cache(expires_at);

-- RLS Policies (if needed)
ALTER TABLE dashboard_cache ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write cache
DROP POLICY IF EXISTS "Allow authenticated users to manage cache" ON dashboard_cache;
CREATE POLICY "Allow authenticated users to manage cache" 
ON dashboard_cache 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_dashboard_cache_updated_at ON dashboard_cache;
CREATE TRIGGER update_dashboard_cache_updated_at 
BEFORE UPDATE ON dashboard_cache 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

