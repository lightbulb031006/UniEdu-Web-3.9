/**
 * Migration: Add cskh_default_profit_percent column to teachers table
 * This column stores the default CSKH profit percent per staff member
 * 
 * Run: npx ts-node src/migrations/add_cskh_default_profit_percent.ts
 * 
 * Or manually run in Supabase SQL Editor:
 *   ALTER TABLE teachers ADD COLUMN IF NOT EXISTS cskh_default_profit_percent NUMERIC DEFAULT 10;
 */

import supabase from '../config/database';

async function migrate() {
  console.log('🔄 Adding cskh_default_profit_percent column to teachers table...');

  // Check if column already exists
  const { data: testData } = await supabase
    .from('teachers')
    .select('*')
    .limit(1);

  const existingCols = testData && testData.length > 0 ? Object.keys(testData[0]) : [];
  
  if (existingCols.includes('cskh_default_profit_percent')) {
    console.log('✅ Column cskh_default_profit_percent already exists. No migration needed.');
    process.exit(0);
  }

  console.log('❌ Column cskh_default_profit_percent is missing.');
  console.log('');
  console.log('📋 Please run the following SQL in Supabase SQL Editor:');
  console.log('');
  console.log('================================================================');
  console.log('ALTER TABLE teachers ADD COLUMN IF NOT EXISTS cskh_default_profit_percent NUMERIC DEFAULT 10;');
  console.log('================================================================');
  console.log('');
  console.log('🔗 Go to: https://supabase.com/dashboard/project/sflzjijayybmdelrquzg/sql/new');

  process.exit(0);
}

migrate();
