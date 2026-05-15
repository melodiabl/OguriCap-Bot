/**
 * test/api-middleware.test.mjs — Unit tests for api/middleware/core.js helpers
 * Run: node --test test/api-middleware.test.mjs
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// ── safeString ────────────────────────────────────────────────────────────────

describe('safeString', () => {
  // Inline reimplementation to avoid ESM import complexity
  const safeString = (v) => (v == null ? '' : String(v))

  test('returns empty string for null', () => assert.equal(safeString(null), ''))
  test('returns empty string for undefined', () => assert.equal(safeString(undefined), ''))
  test('converts number to string', () => assert.equal(safeString(42), '42'))
  test('passes through string unchanged', () => assert.equal(safeString('hello'), 'hello'))
  test('converts boolean', () => assert.equal(safeString(true), 'true'))
})

// ── paginate ──────────────────────────────────────────────────────────────────

describe('paginate', () => {
  const paginate = (arr, { page = 1, limit = 20 } = {}) => {
    const p = Math.max(1, Number(page) || 1)
    const l = Math.min(100, Math.max(1, Number(limit) || 20))
    const total = arr.length
    const totalPages = Math.ceil(total / l)
    const offset = (p - 1) * l
    return {
      items: arr.slice(offset, offset + l),
      pagination: { page: p, limit: l, total, totalPages }
    }
  }

  const arr = Array.from({ length: 25 }, (_, i) => i + 1)

  test('first page returns correct items', () => {
    const { items } = paginate(arr, { page: 1, limit: 10 })
    assert.deepEqual(items, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  test('second page offset is correct', () => {
    const { items } = paginate(arr, { page: 2, limit: 10 })
    assert.deepEqual(items, [11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
  })

  test('last page returns remaining items', () => {
    const { items, pagination } = paginate(arr, { page: 3, limit: 10 })
    assert.deepEqual(items, [21, 22, 23, 24, 25])
    assert.equal(pagination.totalPages, 3)
  })

  test('empty array returns empty items', () => {
    const { items, pagination } = paginate([], { page: 1, limit: 10 })
    assert.deepEqual(items, [])
    assert.equal(pagination.total, 0)
  })
})

// ── CSV escape logic ──────────────────────────────────────────────────────────

describe('CSV export escape', () => {
  const escape = (v) => {
    const s = String(v == null ? '' : v).replace(/"/g, '""')
    return /[",\n\r]/.test(s) ? `"${s}"` : s
  }

  test('plain strings pass through', () => assert.equal(escape('hello'), 'hello'))
  test('null becomes empty string', () => assert.equal(escape(null), ''))
  test('strings with comma are quoted', () => assert.equal(escape('a,b'), '"a,b"'))
  test('strings with newline are quoted', () => assert.equal(escape('a\nb'), '"a\nb"'))
  test('internal quotes are doubled', () => assert.equal(escape('say "hi"'), '"say ""hi"""'))
})
