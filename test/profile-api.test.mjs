import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'

// Mock del pool de PG
let _metadata = { email: 'test@test.com' }
const mockPool = {
  query: async (sql, params) => {
    if (sql.includes('SELECT metadata')) {
      return { rows: [{ metadata: _metadata }] }
    }
    if (sql.includes('UPDATE usuarios SET metadata')) {
      const newMeta = JSON.parse(params[0])
      _metadata = { ..._metadata, ...newMeta }
      return { rows: [{ metadata: _metadata }] }
    }
    return { rows: [] }
  }
}

before(() => {
  global.db = { pool: mockPool }
})

describe('pgGetUserMetadata', () => {
  it('returns metadata object for existing user', async () => {
    const { pgGetUserMetadata } = await import('../api/lib/pg-usuarios.js')
    const meta = await pgGetUserMetadata('testuser')
    assert.equal(meta.email, 'test@test.com')
  })

  it('returns empty object when user not found', async () => {
    const mockEmpty = { query: async () => ({ rows: [] }) }
    global.db = { pool: mockEmpty }
    const { pgGetUserMetadata } = await import('../api/lib/pg-usuarios.js')
    const meta = await pgGetUserMetadata('ghost')
    assert.deepEqual(meta, {})
    global.db = { pool: mockPool }
  })
})

describe('pgUpdateUserMetadata', () => {
  it('merges new fields into existing metadata', async () => {
    const { pgUpdateUserMetadata } = await import('../api/lib/pg-usuarios.js')
    await pgUpdateUserMetadata('testuser', { notification_prefs: { login_new_device: false } })
    assert.equal(_metadata.notification_prefs?.login_new_device, false)
  })
})

describe('pgAddKnownDevice', () => {
  it('adds a device to known_devices array', async () => {
    _metadata = { email: 'test@test.com' }
    const { pgAddKnownDevice } = await import('../api/lib/pg-usuarios.js')
    const device = { hash: 'abc123', ip: '1.2.3.4', browser: 'Chrome', os: 'Windows', ua: 'Mozilla/5.0', first_seen: new Date().toISOString(), last_seen: new Date().toISOString() }
    await pgAddKnownDevice('testuser', device)
    assert.ok(Array.isArray(_metadata.known_devices))
    assert.equal(_metadata.known_devices[0].hash, 'abc123')
  })

  it('updates last_seen if device hash already exists', async () => {
    _metadata.known_devices = [{ hash: 'abc123', ip: '1.2.3.4', last_seen: '2020-01-01T00:00:00Z' }]
    const { pgAddKnownDevice } = await import('../api/lib/pg-usuarios.js')
    const newTime = new Date().toISOString()
    await pgAddKnownDevice('testuser', { hash: 'abc123', ip: '1.2.3.4', last_seen: newTime })
    assert.equal(_metadata.known_devices.length, 1)
    assert.equal(_metadata.known_devices[0].last_seen, newTime)
  })
})

describe('pgRevokeDevice', () => {
  it('removes device by hash', async () => {
    _metadata.known_devices = [{ hash: 'abc123' }, { hash: 'def456' }]
    const { pgRevokeDevice } = await import('../api/lib/pg-usuarios.js')
    await pgRevokeDevice('testuser', 'abc123')
    assert.equal(_metadata.known_devices.length, 1)
    assert.equal(_metadata.known_devices[0].hash, 'def456')
  })
})
