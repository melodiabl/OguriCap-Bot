/**
 * Admin User Initialization
 * Ensures the default admin user exists for the JWT system.
 *
 * Behavior:
 * - Ensures an admin user with `PANEL_ADMIN_USER` exists.
 * - By default, syncs its password to `PANEL_ADMIN_PASS` (set `PANEL_ADMIN_SYNC_PASSWORD=0` to disable).
 */

import bcrypt from 'bcryptjs'

function getBcryptRounds() {
  const parsed = Number.parseInt(String(process.env.BCRYPT_ROUNDS || ''), 10)
  if (!Number.isFinite(parsed)) return 10
  return Math.min(Math.max(parsed, 4), 15)
}

export async function initializeAdminUser() {
  try {
    if (!global.db || !global.db.data) {
      console.warn('ƒsÿ‹÷? Global database not available for admin initialization')
      return false
    }

    if (!global.db.data.usuarios) {
      global.db.data.usuarios = {}
      console.log('ƒo. Initialized usuarios structure in database')
    }

    const adminUsername = (process.env.PANEL_ADMIN_USER || 'admin').trim() || 'admin'
    const adminRole = (process.env.PANEL_ADMIN_ROLE || 'owner').trim() || 'owner'
    const adminPlainPassword = process.env.PANEL_ADMIN_PASS || 'admin123'
    const syncPassword = process.env.PANEL_ADMIN_SYNC_PASSWORD !== '0'

    const usuarios = global.db.data.usuarios
    const usersList = Object.values(usuarios || {})
    let adminUser = usersList.find((u) => u?.username === adminUsername)

    const bcryptRounds = getBcryptRounds()

    if (!adminUser) {
      const existingIds = Object.keys(usuarios)
        .map((id) => Number.parseInt(id, 10))
        .filter((id) => Number.isFinite(id))
      const newId = existingIds.length ? Math.max(...existingIds) + 1 : 1

      const hashedPassword = await bcrypt.hash(adminPlainPassword, bcryptRounds)
      usuarios[newId] = {
        id: newId,
        username: adminUsername,
        password: hashedPassword,
        rol: adminRole,
        fecha_registro: new Date().toISOString(),
        created_at: new Date().toISOString(),
        activo: true,
        require_password_change: false,
        default_admin: true,
      }
      adminUser = usuarios[newId]

      console.log('✅ Default admin user created successfully')
      console.log(`   Username: ${adminUsername}`)
      console.log(`   Password: ${adminPlainPassword}`)
      console.log(`   Role: ${adminRole}`)
    } else {
      let changed = false

      if (adminUser.rol !== adminRole) {
        adminUser.rol = adminRole
        changed = true
      }

      if (adminUser.activo !== true) {
        adminUser.activo = true
        changed = true
      }

      if (syncPassword) {
        const matches = await bcrypt.compare(adminPlainPassword, adminUser.password || '')
        if (!matches) {
          adminUser.password = await bcrypt.hash(adminPlainPassword, bcryptRounds)
          adminUser.password_synced_at = new Date().toISOString()
          changed = true
          console.log(`✅ Admin password synced from env for user '${adminUsername}'`)
        }
      }

      if (changed) {
        adminUser.updated_at = new Date().toISOString()
      }
    }

    if (global.db.write) {
      await global.db.write()
    }

    return true
  } catch (error) {
    console.error('ƒ?O Error initializing admin user:', error)
    return false
  }
}

// Auto-initialize when imported
if (global.db) {
  initializeAdminUser().catch(console.error)
}

