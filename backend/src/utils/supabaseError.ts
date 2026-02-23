/**
 * Format Supabase/network errors with underlying cause for easier debugging.
 * When fetch fails, the real reason (e.g. ECONNREFUSED, ENOTFOUND) is often in error.cause.
 * Uses type assertion for cause to support TS lib < es2022.
 */
export function formatSupabaseError(error: unknown, context: string): string {
  const msg = error instanceof Error ? error.message : String(error);
  const errWithCause = error as { cause?: unknown; code?: string };
  const rawCause = errWithCause.cause;
  const cause =
    rawCause instanceof Error
      ? (rawCause as Error & { code?: string }).message ||
        (rawCause as Error & { code?: string }).code
      : errWithCause.code ?? (typeof rawCause === 'object' && rawCause !== null && 'message' in rawCause ? String((rawCause as { message?: string }).message) : undefined);
  const suffix = cause ? ` (${cause})` : '';
  return `Failed to ${context}: ${msg}${suffix}`;
}
