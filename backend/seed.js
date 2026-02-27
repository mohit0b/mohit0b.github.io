/**
 * Seed script to create demo users
 * Run: node seed.js
 */

const bcrypt = require('bcrypt');
const db = require('./config/database');

async function seedUsers() {
  try {
    // Initialize database first
    await db.initialize();
    
    console.log('Creating demo users...');

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    try {
      await db.query(
        `INSERT INTO users (name, email, password_hash, role, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        ['Admin User', 'admin@linknode.com', adminPassword, 'admin', true]
      );
      console.log('✓ Admin user created: admin@linknode.com / admin123');
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        console.log('✓ Admin user already exists');
      } else {
        throw err;
      }
    }

    // Create driver user
    const driverPassword = await bcrypt.hash('driver123', 12);
    try {
      await db.query(
        `INSERT INTO users (name, email, password_hash, role, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        ['Driver User', 'driver@linknode.com', driverPassword, 'driver', true]
      );
      console.log('✓ Driver user created: driver@linknode.com / driver123');
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        console.log('✓ Driver user already exists');
      } else {
        throw err;
      }
    }

    console.log('\nDemo accounts ready!');
    console.log('Admin: admin@linknode.com / admin123');
    console.log('Driver: driver@linknode.com / driver123');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding users:', error);
    process.exit(1);
  }
}

seedUsers();
