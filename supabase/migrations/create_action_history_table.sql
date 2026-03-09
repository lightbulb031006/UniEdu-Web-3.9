-- Create action_history table for tracking all CRUD operations
-- This table stores history of all create, update, delete, and undo actions

CREATE TABLE IF NOT EXISTS action_history (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email TEXT,
    user_role TEXT,
    entity_type TEXT NOT NULL, -- 'student', 'teacher', 'class', 'payment', 'cost', 'category', 'lesson_plan', etc.
    entity_id TEXT, -- ID of the entity that was modified
    action_type TEXT NOT NULL CHECK (action_type IN ('create', 'update', 'delete', 'undo')),
    before_value JSONB, -- Snapshot of entity before the action (for update/delete)
    after_value JSONB, -- Snapshot of entity after the action (for create/update)
    changed_fields JSONB, -- For update actions: { field1: { old: '...', new: '...' } }
    description TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_action_history_user_id ON action_history(user_id);
CREATE INDEX IF NOT EXISTS idx_action_history_entity_type ON action_history(entity_type);
CREATE INDEX IF NOT EXISTS idx_action_history_entity_id ON action_history(entity_id);
CREATE INDEX IF NOT EXISTS idx_action_history_action_type ON action_history(action_type);
CREATE INDEX IF NOT EXISTS idx_action_history_created_at ON action_history(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE action_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own actions, admins can see all
CREATE POLICY "Users can view their own actions" ON action_history
    FOR SELECT
    USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

-- Policy: Only authenticated users can insert (via backend service)
CREATE POLICY "Authenticated users can insert actions" ON action_history
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

