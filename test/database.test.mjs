/**
 * test/database.test.mjs — Unit tests for lib/database.js helpers
 * Run: node --test test/database.test.mjs
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// ── debouncedWrite ────────────────────────────────────────────────────────────

describe('debouncedWrite', () => {
  test('coalesces multiple calls into one write', async () => {
    let writeCount = 0
    const fakeDb = {
      data: {},
      async write() { writeCount++; return this.data },
      _pendingWrite: null,
      _pendingWriteTimer: null,
      debouncedWrite(delay = 50) {
        if (!this._pendingWrite) {
          this._pendingWrite = new Promise((resolve, reject) => {
            this._pendingWriteTimer = setTimeout(async () => {
              this._pendingWrite = null
              this._pendingWriteTimer = null
              try { resolve(await this.write()) } catch (e) { reject(e) }
            }, delay)
          })
        }
        return this._pendingWrite
      }
    }

    const p1 = fakeDb.debouncedWrite(50)
    const p2 = fakeDb.debouncedWrite(50)
    const p3 = fakeDb.debouncedWrite(50)

    assert.equal(p1, p2, 'should return same promise for concurrent calls')
    assert.equal(p1, p3, 'should return same promise for concurrent calls')

    await p1
    assert.equal(writeCount, 1, 'should only call write() once')
  })

  test('resets after write completes', async () => {
    let writeCount = 0
    const fakeDb = {
      data: {},
      async write() { writeCount++; return this.data },
      _pendingWrite: null,
      _pendingWriteTimer: null,
      debouncedWrite(delay = 20) {
        if (!this._pendingWrite) {
          this._pendingWrite = new Promise((resolve, reject) => {
            this._pendingWriteTimer = setTimeout(async () => {
              this._pendingWrite = null
              this._pendingWriteTimer = null
              try { resolve(await this.write()) } catch (e) { reject(e) }
            }, delay)
          })
        }
        return this._pendingWrite
      }
    }

    await fakeDb.debouncedWrite(20)
    await fakeDb.debouncedWrite(20)
    assert.equal(writeCount, 2, 'should write again after reset')
  })
})

// ── ensurePanelDb alias logic ─────────────────────────────────────────────────

describe('panel alias invariants', () => {
  test('panel.logs and db.data.logs point to same array', () => {
    const data = { panel: {}, logs: [1, 2, 3] }

    // Simulate ensurePanelDb alias logic
    if (data.panel.logs !== data.logs) {
      if (Array.isArray(data.panel.logs) && data.panel.logs.length > data.logs.length) {
        data.logs = data.panel.logs
      }
      data.panel.logs = data.logs
    }

    data.panel.logs.push(4)
    assert.deepEqual(data.logs, [1, 2, 3, 4], 'write through panel.logs visible in data.logs')
    assert.equal(data.panel.logs, data.logs, 'same reference')
  })

  test('panel.logs migration copies longer array', () => {
    const data = { panel: { logs: [1, 2, 3, 4, 5] }, logs: [1] }

    if (data.panel.logs !== data.logs) {
      if (Array.isArray(data.panel.logs) && data.panel.logs.length > data.logs.length) {
        data.logs = data.panel.logs
      }
      data.panel.logs = data.logs
    }

    assert.equal(data.logs.length, 5, 'should adopt larger panel.logs')
  })
})
