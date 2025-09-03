/**
 * Database Migration Script: Hash Existing Passwords
 * 
 * This script updates existing hospital staff accounts to use bcrypt hashed passwords
 * instead of plain text passwords. Run this ONCE after deploying the new authentication system.
 * 
 * Usage: node scripts/hashExistingPasswords.js
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import HospitalStaff from '../models/HospitalStaff.js';

dotenv.config();

const SALT_ROUNDS = 12;
const DEFAULT_PASSWORD = 'password123'; // Current default password

async function hashExistingPasswords() {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to database');

    // Find all staff members without hashed passwords
    const staffMembers = await HospitalStaff.find({
      $or: [
        { hashedPassword: { $exists: false } },
        { hashedPassword: null },
        { hashedPassword: '' }
      ]
    });

    console.log(`📋 Found ${staffMembers.length} staff members to update`);

    if (staffMembers.length === 0) {
      console.log('✅ No staff members need password updates');
      return;
    }

    // Hash the default password
    console.log('🔐 Hashing default password...');
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    // Update all staff members
    const updatePromises = staffMembers.map(async (staff) => {
      try {
        await HospitalStaff.findByIdAndUpdate(staff._id, {
          hashedPassword: hashedPassword,
          loginAttempts: 0,
          lastFailedLogin: null
        });
        console.log(`✅ Updated password for ${staff.email}`);
        return { success: true, email: staff.email };
      } catch (error) {
        console.error(`❌ Failed to update ${staff.email}:`, error.message);
        return { success: false, email: staff.email, error: error.message };
      }
    });

    const results = await Promise.all(updatePromises);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`\n📊 Migration Results:`);
    console.log(`   ✅ Successfully updated: ${successful}`);
    console.log(`   ❌ Failed to update: ${failed}`);

    if (failed > 0) {
      console.log('\n❌ Failed updates:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`   - ${r.email}: ${r.error}`);
      });
    }

    console.log('\n🔒 Important Security Notes:');
    console.log('   1. All staff members now have hashed passwords');
    console.log('   2. Default password is still "password123"');
    console.log('   3. Instruct staff to change their passwords immediately');
    console.log('   4. Consider implementing password change enforcement');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from database');
  }
}

// Create a new admin user with strong password
async function createSecureAdmin() {
  try {
    const email = 'admin@citygeneralhospital.com';
    const strongPassword = process.env.ADMIN_PASSWORD || 'SecureAdmin@2025!';
    
    console.log('\n🔐 Creating secure admin account...');
    
    // Check if admin already exists
    const existingAdmin = await HospitalStaff.findOne({ email });
    if (existingAdmin) {
      console.log('ℹ️  Admin account already exists, updating password...');
      
      const hashedPassword = await bcrypt.hash(strongPassword, SALT_ROUNDS);
      await HospitalStaff.findByIdAndUpdate(existingAdmin._id, {
        hashedPassword: hashedPassword,
        loginAttempts: 0,
        lastFailedLogin: null,
        role: 'admin',
        permissions: {
          viewDashboard: true,
          manageDrivers: true,
          viewRides: true,
          manageHospitalInfo: true,
          viewAnalytics: true
        }
      });
      
      console.log('✅ Admin password updated');
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Password: ${strongPassword}`);
    } else {
      console.log('ℹ️  No existing admin found');
      console.log('ℹ️  Please create an admin account through the API or manually in the database');
    }
    
  } catch (error) {
    console.error('❌ Failed to create/update admin:', error);
  }
}

// Run the migration
async function runMigration() {
  console.log('🚀 Starting password migration...\n');
  
  await hashExistingPasswords();
  await createSecureAdmin();
  
  console.log('\n✅ Migration completed!');
  console.log('\n⚠️  IMPORTANT: Change default passwords before production!');
  
  process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration();
}

export { hashExistingPasswords, createSecureAdmin };
