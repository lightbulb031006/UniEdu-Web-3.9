/**
 * Migration: Add 'gender' column to students table
 * Run: npx ts-node backend/src/migrations/add_gender_column.ts
 */

import supabase from '../config/database';

async function migrate() {
  console.log('🔄 Running migration: add_gender_column...');

  // Try to add gender column using a simple update approach
  // First, check if the column exists by doing a select
  const { data: testData, error: testError } = await supabase
    .from('students')
    .select('gender')
    .limit(1);

  if (testError && testError.code === '42703') {
    console.log('❌ Column "gender" does not exist. Need to add it via Supabase dashboard.');
    console.log('');
    console.log('📋 Please run this SQL in Supabase SQL Editor:');
    console.log('');
    console.log("   ALTER TABLE students ADD COLUMN IF NOT EXISTS gender text DEFAULT 'male';");
    console.log('');
    console.log('🔗 Go to: https://supabase.com/dashboard → SQL Editor');
    process.exit(1);
  } else if (testError) {
    console.error('❌ Unexpected error:', testError);
    process.exit(1);
  } else {
    console.log('✅ Column "gender" already exists. No migration needed.');
  }
}

migrate();
