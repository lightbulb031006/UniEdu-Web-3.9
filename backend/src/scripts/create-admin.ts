/**
 * Script to create admin account in Supabase
 * Usage: npx ts-node src/scripts/create-admin.ts <email> <password> [name]
 * Example: npx ts-node src/scripts/create-admin.ts admin@example.com mypassword "Admin User"
 */

import supabase from '../config/database';
import { hashPassword } from '../services/authService';

async function createAdmin() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] || 'Admin User';

  if (!email || !password) {
    console.error('❌ Usage: npx ts-node src/scripts/create-admin.ts <email> <password> [name]');
    console.error('   Example: npx ts-node src/scripts/create-admin.ts admin@example.com mypassword "Admin User"');
    process.exit(1);
  }

  console.log('🔐 Creating admin account...\n');
  console.log(`   Email: ${email}`);
  console.log(`   Name: ${name}`);
  console.log(`   Role: admin\n`);

  // Check if admin already exists
  const { data: existing } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email.toLowerCase())
    .single();

  if (existing) {
    console.log('⚠️  Admin account already exists!');
    console.log(`   ID: ${existing.id}`);
    console.log(`   Email: ${existing.email}`);
    console.log('\n💡 To update password, use Supabase dashboard or update directly in database.');
    process.exit(1);
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create admin account
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role: 'admin',
      status: 'active',
    })
    .select('id, email, name, role')
    .single();

  if (error) {
    console.error('❌ Error creating admin account:', error);
    process.exit(1);
  }

  console.log('✅ Admin account created successfully!');
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Name: ${user.name}`);
  console.log(`   Role: ${user.role}`);
  console.log('\n💡 You can now login with this account.');
}

createAdmin()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

