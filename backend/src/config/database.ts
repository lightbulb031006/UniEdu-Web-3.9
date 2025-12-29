/**
 * Supabase Database Configuration
 * Uses SERVICE_ROLE_KEY for backend operations (bypasses RLS)
 */

import { createClient } from '@supabase/supabase-js';
import env from './env';

// ⚠️ SECURITY: Service role key bypasses Row Level Security
// Only use this in backend, never expose to client!
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export default supabase;

