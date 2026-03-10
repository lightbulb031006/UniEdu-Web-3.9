/**
 * Migration: Create app_settings table and add deduction_percent column
 * Run once: npx ts-node backend/src/migrations/add_deduction_settings.ts
 */

import supabase from '../config/database';

async function migrate() {
    console.log('🔄 Running migration: add_deduction_settings...');

    // 1. Create app_settings table
    try {
        const { error } = await supabase.rpc('exec_sql', {
            sql: `
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
        });
        if (error) {
            console.warn('⚠️  Could not create app_settings via RPC. Trying direct approach...');
            // Try inserting a dummy row — if table exists this will work or fail gracefully
            const { error: insertErr } = await supabase
                .from('app_settings')
                .upsert({ key: '_test', value: 'test' }, { onConflict: 'key' });
            if (insertErr) {
                console.error('❌ app_settings table does not exist. Please create it manually:');
                console.error(`
  CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
        `);
            } else {
                // Clean up test row
                await supabase.from('app_settings').delete().eq('key', '_test');
                console.log('✅ app_settings table already exists');
            }
        } else {
            console.log('✅ app_settings table created');
        }
    } catch (err) {
        console.error('❌ Error creating app_settings:', err);
    }

    // 2. Add deduction_percent column to teachers
    try {
        const { error } = await supabase.rpc('exec_sql', {
            sql: `ALTER TABLE teachers ADD COLUMN IF NOT EXISTS deduction_percent NUMERIC DEFAULT NULL;`
        });
        if (error) {
            console.warn('⚠️  Could not add column via RPC. Checking if column exists...');
            const { error: checkErr } = await supabase
                .from('teachers')
                .select('deduction_percent')
                .limit(1);
            if (checkErr) {
                console.error('❌ deduction_percent column does not exist. Please add it manually:');
                console.error('  ALTER TABLE teachers ADD COLUMN deduction_percent NUMERIC DEFAULT NULL;');
            } else {
                console.log('✅ deduction_percent column already exists');
            }
        } else {
            console.log('✅ deduction_percent column added to teachers');
        }
    } catch (err) {
        console.error('❌ Error adding column:', err);
    }

    console.log('🏁 Migration complete');
}

migrate().catch(console.error);
