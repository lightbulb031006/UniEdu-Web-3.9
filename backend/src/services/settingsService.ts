/**
 * Settings Service
 * Manages app-level settings stored in the database
 * Uses app_settings table (key-value) for global settings
 * Uses deduction_percent column on teachers table for per-teacher overrides
 */

import supabase from '../config/database';

/**
 * Get a setting value by key from app_settings table
 * Returns null if key doesn't exist or table doesn't exist
 */
export async function getSetting(key: string): Promise<string | null> {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', key)
            .single();

        if (error) return null;
        return data?.value ?? null;
    } catch {
        return null;
    }
}

/**
 * Set a setting value by key (upsert)
 */
export async function setSetting(key: string, value: string): Promise<void> {
    try {
        const { error } = await supabase
            .from('app_settings')
            .upsert({ key, value }, { onConflict: 'key' });

        if (error) {
            // Table might not exist — try to create it
            if (error.code === '42P01' || error.message?.includes('does not exist')) {
                await ensureAppSettingsTable();
                // Retry
                await supabase
                    .from('app_settings')
                    .upsert({ key, value }, { onConflict: 'key' });
            } else {
                console.error('[Settings] Failed to set setting:', error.message);
            }
        }
    } catch (err) {
        console.error('[Settings] Error setting value:', err);
    }
}

/**
 * Get deduction settings:
 * - globalPercent from app_settings
 * - individualDeductions from teachers.deduction_percent
 */
export async function getDeductionSettings(): Promise<{
    globalPercent: number;
    individualDeductions: Record<string, number>;
}> {
    // Get global default
    const globalStr = await getSetting('staff_deduction_percent');
    const globalPercent = globalStr ? Number(globalStr) : 0;

    // Get per-teacher overrides
    const individualDeductions: Record<string, number> = {};
    try {
        const { data, error } = await supabase
            .from('teachers')
            .select('id, deduction_percent')
            .not('deduction_percent', 'is', null);

        if (!error && data) {
            for (const teacher of data) {
                if (teacher.deduction_percent != null) {
                    individualDeductions[teacher.id] = Number(teacher.deduction_percent);
                }
            }
        }
    } catch {
        // Column might not exist yet, that's fine
    }

    return { globalPercent, individualDeductions };
}

/**
 * Save deduction settings:
 * - globalPercent → app_settings
 * - individualDeductions → teachers.deduction_percent
 */
export async function saveDeductionSettings(
    globalPercent: number,
    individualDeductions: Record<string, number>
): Promise<void> {
    // Save global
    await setSetting('staff_deduction_percent', String(globalPercent));

    // Save per-teacher overrides
    // First, reset all teachers to null (clear old overrides)
    try {
        await supabase
            .from('teachers')
            .update({ deduction_percent: null })
            .not('id', 'is', null); // update all rows
    } catch {
        // Column might not exist, will be created on first write
    }

    // Then set individual overrides
    for (const [teacherId, percent] of Object.entries(individualDeductions)) {
        try {
            await supabase
                .from('teachers')
                .update({ deduction_percent: percent })
                .eq('id', teacherId);
        } catch {
            // Ignore individual failures
        }
    }
}

/**
 * Ensure app_settings table exists (creates via raw SQL if needed)
 */
async function ensureAppSettingsTable(): Promise<void> {
    try {
        await supabase.rpc('exec_sql', {
            sql: `CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`
        });
    } catch {
        console.warn('[Settings] Could not auto-create app_settings table. Please create it manually in Supabase.');
    }
}
