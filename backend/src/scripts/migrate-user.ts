/**
 * Script to migrate user from old localStorage format to Supabase
 * Usage: npx ts-node src/scripts/migrate-user.ts <email> <password> [name] [role]
 * Example: npx ts-node src/scripts/migrate-user.ts admin@example.com mypassword "Admin User" admin
 */

import supabase from '../config/database';
import { hashPassword } from '../services/authService';

async function migrateUser() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] || 'User';
  const role = process.argv[5] || 'admin';

  if (!email || !password) {
    console.error('❌ Usage: npx ts-node src/scripts/migrate-user.ts <email> <password> [name] [role]');
    console.error('   Example: npx ts-node src/scripts/migrate-user.ts admin@example.com mypassword "Admin User" admin');
    process.exit(1);
  }

  console.log('🔄 Migrating user to Supabase...\n');
  console.log(`   Email: ${email}`);
  console.log(`   Name: ${name}`);
  console.log(`   Role: ${role}\n`);

  // Check if user already exists
  const { data: existing } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('email', email.toLowerCase())
    .single();

  if (existing) {
    console.log('⚠️  User already exists!');
    console.log(`   ID: ${existing.id}`);
    console.log(`   Email: ${existing.email}`);
    console.log(`   Role: ${existing.role}`);
    console.log('\n💡 Updating password...');

    // Update password
    const hashedPassword = await hashPassword(password);
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password: hashedPassword,
        name,
        role,
        status: 'active',
      })
      .eq('id', existing.id);

    if (updateError) {
      console.error('❌ Error updating user:', updateError);
      process.exit(1);
    }

    console.log('✅ User password updated successfully!');
    console.log(`   You can now login with: ${email} / ${password}`);
    process.exit(0);
  }

  // Create new user
  const hashedPassword = await hashPassword(password);
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role,
      status: 'active',
    })
    .select('id, email, name, role')
    .single();

  if (error) {
    console.error('❌ Error creating user:', error);
    process.exit(1);
  }

  console.log('✅ User migrated successfully!');
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Name: ${user.name}`);
  console.log(`   Role: ${user.role}`);
  console.log(`\n💡 You can now login with: ${email} / ${password}`);
}

migrateUser()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

