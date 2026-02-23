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

/**
 * Run a minimal query to verify Supabase is reachable.
 * Call once at startup; logs a clear warning if connection fails.
 */
export async function checkSupabaseConnection(): Promise<void> {
  try {
    const { error } = await supabase.from('teachers').select('id').limit(1);
    if (error) {
      console.warn(
        '[Supabase] Connection check returned an error:',
        error.message,
        (error as { cause?: Error }).cause
          ? `(${(error as { cause?: Error }).cause})`
          : ''
      );
      return;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const errWithCause = err as Error & { cause?: unknown };
    const rawCause = errWithCause.cause;
    const cause =
      rawCause instanceof Error
        ? (rawCause as Error & { code?: string }).message ||
          (rawCause as Error & { code?: string }).code
        : typeof rawCause === 'object' && rawCause !== null && 'message' in rawCause
          ? String((rawCause as { message?: string }).message)
          : '';
    console.warn(
      '[Supabase] Cannot reach database. Requests will fail until this is fixed.\n' +
        '  Error: ' +
        msg +
        (cause ? ` (${cause})` : '') +
        '\n  Check: SUPABASE_URL in .env (e.g. https://xxx.supabase.co), network, firewall/proxy.'
    );
  }
}

export default supabase;

