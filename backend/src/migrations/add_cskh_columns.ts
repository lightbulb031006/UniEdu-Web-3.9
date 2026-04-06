/**
 * Migration: Add CSKH-related columns to students table
 * Adds: cskh_staff_id, cskh_assigned_date, cskh_unassigned_date
 * 
 * Run: npx ts-node src/migrations/add_cskh_columns.ts
 */

import supabase from '../config/database';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sflzjijayybmdelrquzg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmbHpqaWpheXlibWRlbHJxdXpnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI3NDc1OCwiZXhwIjoyMDg1ODUwNzU4fQ.DKLl2uzuy2M-mvnW0NVDNZi9nRq6g0lufjjlFRgl3a4';

async function runSQL(sql: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
      // Try the SQL endpoint instead
      const response2 = await fetch(`${SUPABASE_URL}/pg/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({ query: sql }),
      });
      
      if (!response2.ok) {
        return { success: false, error: `HTTP ${response2.status}: ${await response2.text()}` };
      }
    }
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function migrate() {
  console.log('🔄 Checking students table columns...');
  
  // Check existing columns
  const { data: testData } = await supabase
    .from('students')
    .select('*')
    .limit(1);
  
  const existingCols = testData && testData.length > 0 ? Object.keys(testData[0]) : [];
  console.log('📋 Existing columns:', existingCols.join(', '));
  
  const columnsToAdd = [
    { name: 'cskh_staff_id', type: 'text', default: null },
    { name: 'cskh_assigned_date', type: 'date', default: null },
    { name: 'cskh_unassigned_date', type: 'date', default: null },
  ];
  
  const missingColumns = columnsToAdd.filter(col => !existingCols.includes(col.name));
  
  if (missingColumns.length === 0) {
    console.log('✅ All CSKH columns already exist. No migration needed.');
    process.exit(0);
  }
  
  console.log('❌ Missing columns:', missingColumns.map(c => c.name).join(', '));
  console.log('');
  console.log('📋 Please run the following SQL in Supabase SQL Editor to add the missing columns:');
  console.log('');
  console.log('================================================================');
  
  const sqlStatements: string[] = [];
  for (const col of missingColumns) {
    const sql = `ALTER TABLE students ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`;
    sqlStatements.push(sql);
  }
  
  // Also add FK constraint for cskh_staff_id -> teachers.id (if cskh_staff_id is being added)
  if (missingColumns.find(c => c.name === 'cskh_staff_id')) {
    sqlStatements.push(`-- Optional: Add foreign key constraint (uncomment if desired)`);
    sqlStatements.push(`-- ALTER TABLE students ADD CONSTRAINT fk_cskh_staff FOREIGN KEY (cskh_staff_id) REFERENCES teachers(id) ON DELETE SET NULL;`);
  }
  
  console.log(sqlStatements.join('\n'));
  console.log('================================================================');
  console.log('');
  console.log('🔗 Go to: https://supabase.com/dashboard/project/sflzjijayybmdelrquzg/sql/new');
  console.log('');
  
  // Try to add columns programmatically via direct SQL
  console.log('🔄 Attempting to add columns programmatically...');
  
  for (const col of missingColumns) {
    const sql = `ALTER TABLE students ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`;
    console.log(`  Adding ${col.name}...`);
    const result = await runSQL(sql);
    if (result.success) {
      console.log(`  ✅ ${col.name} added successfully`);
    } else {
      console.log(`  ❌ Could not add ${col.name} programmatically: ${result.error}`);
      console.log(`  ℹ️ Please add manually via Supabase SQL Editor`);
    }
  }
  
  // Verify
  console.log('\n🔄 Verifying...');
  const { error: verifyErr } = await supabase
    .from('students')
    .select('id, cskh_staff_id')
    .limit(1);
  
  if (verifyErr) {
    console.log('❌ Column still missing. Please add manually via Supabase dashboard.');
  } else {
    console.log('✅ All columns verified successfully!');
  }
  
  process.exit(0);
}

migrate();
