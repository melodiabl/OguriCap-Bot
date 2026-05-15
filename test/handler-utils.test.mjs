/**
 * test/handler-utils.test.mjs — Unit tests for handler.js utility functions
 * Run: node --test test/handler-utils.test.mjs
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// ── getDayKey ─────────────────────────────────────────────────────────────────

describe('getDayKey', () => {
  const getDayKey = (d = new Date()) => new Date(d).toISOString().slice(0, 10)

  test('returns YYYY-MM-DD format', () => {
    const key = getDayKey(new Date('2026-05-09T15:30:00Z'))
    assert.match(key, /^\d{4}-\d{2}-\d{2}$/)
    assert.equal(key, '2026-05-09')
  })

  test('defaults to today', () => {
    const key = getDayKey()
    assert.match(key, /^\d{4}-\d{2}-\d{2}$/)
  })
})

// ── botGlobalState dual-path read ─────────────────────────────────────────────

describe('botGlobalState dual-path read', () => {
  test('reads from db.data.botGlobalState first', () => {
    const data = {
      botGlobalState: { isOn: false },
      panel: { botGlobalState: { isOn: true } }
    }
    const globalState = data?.botGlobalState ?? data?.panel?.botGlobalState
    assert.equal(globalState?.isOn, false, 'should prefer db.data.botGlobalState')
  })

  test('falls back to panel.botGlobalState when missing', () => {
    const data = { panel: { botGlobalState: { isOn: true } } }
    const globalState = data?.botGlobalState ?? data?.panel?.botGlobalState
    assert.equal(globalState?.isOn, true, 'should use panel.botGlobalState as fallback')
  })

  test('returns undefined when both missing', () => {
    const data = {}
    const globalState = data?.botGlobalState ?? data?.panel?.botGlobalState
    assert.equal(globalState, undefined)
  })
})

// ── disabledPlugins dual-path read ────────────────────────────────────────────

describe('disabledPlugins dual-path read', () => {
  test('reads from db.data.disabledPlugins first', () => {
    const data = {
      disabledPlugins: { 'myPlugin.js': { disabled: true, message: 'off' } },
      panel: { disabledPlugins: {} }
    }
    const cfg = data?.disabledPlugins?.['myPlugin.js'] ?? data?.panel?.disabledPlugins?.['myPlugin.js']
    assert.ok(cfg?.disabled)
    assert.equal(cfg?.message, 'off')
  })

  test('falls back to panel when missing in root', () => {
    const data = {
      panel: { disabledPlugins: { 'myPlugin.js': { disabled: true, message: 'panel-off' } } }
    }
    const cfg = data?.disabledPlugins?.['myPlugin.js'] ?? data?.panel?.disabledPlugins?.['myPlugin.js']
    assert.equal(cfg?.message, 'panel-off')
  })
})
