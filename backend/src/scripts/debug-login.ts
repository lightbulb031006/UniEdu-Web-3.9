/**
 * Script to debug login issues
 * Usage: npx ts-node src/scripts/debug-login.ts <email>
 */

import supabase from '../config/database';

async function debugLogin() {
  const email = process.argv[2];

  if (!email) {
    console.error('❌ Usage: npx ts-node src/scripts/debug-login.ts <email>');
    process.exit(1);
  }

  const loginInput = email.trim().toLowerCase();
  console.log('🔍 Debugging login for:', loginInput);
  console.log('');

  // 1. Check exact email match
  console.log('1️⃣ Checking exact email match...');
  const { data: exactMatch, error: exactError } = await supabase
    .from('users')
    .select('id, email, password, name, role, status, phone, account_handle')
    .eq('email', loginInput)
    .single();

  if (exactError) {
    console.log('   ❌ No exact match found');
    console.log(`   Error: ${exactError.message}`);
  } else {
    console.log('   ✅ Found user:');
    console.log(`      ID: ${exactMatch.id}`);
    console.log(`      Email: ${exactMatch.email}`);
    console.log(`      Name: ${exactMatch.name}`);
    console.log(`      Role: ${exactMatch.role}`);
    console.log(`      Status: ${exactMatch.status}`);
    console.log(`      Password: ${exactMatch.password ? (exactMatch.password.startsWith('$2') ? 'Hashed (bcrypt)' : `Plaintext (${exactMatch.password.length} chars)`) : 'Missing'}`);
    console.log(`      Phone: ${exactMatch.phone || 'N/A'}`);
    console.log(`      Account Handle: ${exactMatch.account_handle || 'N/A'}`);
  }

  console.log('');

  // 2. Check with ilike (case-insensitive)
  console.log('2️⃣ Checking with case-insensitive search...');
  const { data: ilikeMatch, error: ilikeError } = await supabase
    .from('users')
    .select('id, email, password, name, role, status')
    .ilike('email', `%${loginInput}%`)
    .limit(5);

  if (ilikeError || !ilikeMatch || ilikeMatch.length === 0) {
    console.log('   ❌ No matches found with ilike');
  } else {
    console.log(`   ✅ Found ${ilikeMatch.length} potential match(es):`);
    ilikeMatch.forEach((user, idx) => {
      console.log(`      ${idx + 1}. ${user.email} (${user.role}, ${user.status})`);
    });
  }

  console.log('');

  // 3. Check all users with similar email
  console.log('3️⃣ Checking all users (for debugging)...');
  const { data: allUsers, error: allError } = await supabase
    .from('users')
    .select('id, email, role, status')
    .limit(10);

  if (allError) {
    console.log(`   ❌ Error: ${allError.message}`);
  } else {
    console.log(`   📋 Found ${allUsers?.length || 0} user(s) in database:`);
    allUsers?.forEach((user, idx) => {
      console.log(`      ${idx + 1}. ${user.email} (${user.role}, ${user.status})`);
    });
  }

  console.log('');
  console.log('💡 Recommendations:');
  if (!exactMatch) {
    console.log('   - User does not exist in Supabase');
    console.log('   - Run: npx ts-node src/scripts/migrate-user.ts <email> <password> [name] [role]');
  } else if (exactMatch.status !== 'active') {
    console.log('   - User exists but status is not "active"');
    console.log('   - Update status to "active" in Supabase');
  } else if (!exactMatch.password) {
    console.log('   - User exists but has no password');
    console.log('   - Run: npx ts-node src/scripts/migrate-user.ts <email> <password> [name] [role]');
  } else {
    console.log('   - User exists and looks good');
    console.log('   - Try: npx ts-node src/scripts/test-login.ts <email> <password>');
  }
}

debugLogin()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

