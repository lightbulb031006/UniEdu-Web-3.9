/**
 * Script to check if admin account exists in Supabase
 * Run with: npx ts-node src/scripts/check-admin-account.ts
 */

import supabase from '../config/database';

async function checkAdminAccount() {
  console.log('🔍 Checking for admin accounts in Supabase...\n');

  // Query all admin users
  const { data: admins, error } = await supabase
    .from('users')
    .select('id, email, name, role, status, password')
    .eq('role', 'admin');

  if (error) {
    console.error('❌ Error querying admin accounts:', error);
    return;
  }

  if (!admins || admins.length === 0) {
    console.log('⚠️  No admin accounts found in Supabase!');
    console.log('\n💡 You may need to:');
    console.log('   1. Create an admin account manually in Supabase');
    console.log('   2. Or migrate your old admin account from localStorage');
    return;
  }

  console.log(`✅ Found ${admins.length} admin account(s):\n`);
  admins.forEach((admin, index) => {
    console.log(`Admin ${index + 1}:`);
    console.log(`  - ID: ${admin.id}`);
    console.log(`  - Email: ${admin.email}`);
    console.log(`  - Name: ${admin.name || 'N/A'}`);
    console.log(`  - Status: ${admin.status}`);
    console.log(`  - Password: ${admin.password ? (admin.password.startsWith('$2') ? 'Hashed (bcrypt)' : 'Plaintext (legacy)') : 'Missing'}`);
    console.log('');
  });

  // Check for specific email if provided
  const checkEmail = process.argv[2];
  if (checkEmail) {
    console.log(`\n🔍 Checking for email: ${checkEmail}`);
    const found = admins.find((a) => a.email?.toLowerCase() === checkEmail.toLowerCase());
    if (found) {
      console.log('✅ Found!');
      console.log(`  - ID: ${found.id}`);
      console.log(`  - Status: ${found.status}`);
      console.log(`  - Password type: ${found.password ? (found.password.startsWith('$2') ? 'Hashed' : 'Plaintext') : 'Missing'}`);
    } else {
      console.log('❌ Not found!');
    }
  }
}

checkAdminAccount()
  .then(() => {
    console.log('\n✅ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

