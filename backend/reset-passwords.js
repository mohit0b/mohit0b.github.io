/**
 * Reset demo user passwords
 * Run: node reset-passwords.js
 */

const bcrypt = require('bcrypt');
const db = require('./config/database');

async function resetPasswords() {
  try {
    await db.initialize();
    
    console.log('Resetting demo user passwords...');
    
    // Reset admin password
    const adminHash = await bcrypt.hash('admin123', 12);
    await db.query(
      'UPDATE users SET password_hash = ? WHERE email = ?',
      [adminHash, 'admin@linknode.com']
    );
    console.log('✓ Admin password reset: admin@linknode.com / admin123');
    
    // Reset driver password
    const driverHash = await bcrypt.hash('driver123', 12);
    await db.query(
      'UPDATE users SET password_hash = ? WHERE email = ?',
      [driverHash, 'driver@linknode.com']
    );
    console.log('✓ Driver password reset: driver@linknode.com / driver123');
    
    console.log('\nDone! You can now login with the demo accounts.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetPasswords();
