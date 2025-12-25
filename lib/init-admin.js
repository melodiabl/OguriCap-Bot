/**
 * Admin User Initialization
 * Creates default admin user if no users exist in the JWT system
 */

import bcrypt from 'bcryptjs';

export async function initializeAdminUser() {
  try {
    // Ensure global.db exists and is loaded
    if (!global.db || !global.db.data) {
      console.warn('⚠️ Global database not available for admin initialization');
      return false;
    }

    // Initialize usuarios structure if it doesn't exist
    if (!global.db.data.usuarios) {
      global.db.data.usuarios = {};
      console.log('✅ Initialized usuarios structure in database');
    }

    // Check if any users exist
    const existingUsers = Object.keys(global.db.data.usuarios);
    if (existingUsers.length > 0) {
      console.log(`ℹ️ Admin user already exists (${existingUsers.length} users found)`);
      return true;
    }

    // Create default admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    global.db.data.usuarios[1] = {
      id: 1,
      username: 'admin',
      password: adminPassword,
      rol: 'owner',
      fecha_registro: new Date().toISOString(),
      created_at: new Date().toISOString(),
      activo: true,
      require_password_change: false
    };

    // Save the database
    if (global.db.write) {
      await global.db.write();
    }

    console.log('✅ Default admin user created successfully');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('   Role: owner');
    
    return true;

  } catch (error) {
    console.error('❌ Error initializing admin user:', error);
    return false;
  }
}

// Auto-initialize when imported
if (global.db) {
  initializeAdminUser().catch(console.error);
}