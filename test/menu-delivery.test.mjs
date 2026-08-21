import { afterEach, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'

import { sendSingleMenu } from '../plugins/main-menu.js'

const BOT_JID = '595000000000@s.whatsapp.net'
const MESSAGE = {
  chat: '595111111111@s.whatsapp.net',
  sender: '595111111111@s.whatsapp.net',
  key: { id: 'message-id' },
}

describe('sendSingleMenu', () => {
  let previousDb
  let previousRcanal

  beforeEach(() => {
    previousDb = global.db
    previousRcanal = global.rcanal
    global.db = { data: { settings: { [BOT_JID]: {} } } }
    delete global.rcanal
  })

  afterEach(() => {
    global.db = previousDb
    global.rcanal = previousRcanal
  })

  test('envía texto universal con mención y mensaje citado', async () => {
    const calls = []
    const conn = {
      user: { jid: BOT_JID },
      async sendMessage(...args) { calls.push(args) },
    }

    await sendSingleMenu(MESSAGE, conn, 'Menú universal')

    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], MESSAGE.chat)
    assert.deepEqual(calls[0][1], {
      text: 'Menú universal',
      mentions: [MESSAGE.sender],
    })
    assert.deepEqual(calls[0][2], { quoted: MESSAGE })
  })

  test('usa imagen con caption cuando existe un banner válido', async () => {
    const calls = []
    global.db.data.settings[BOT_JID].banner = path.resolve('frontend-next/public/oguricap-avatar.png')
    const conn = {
      user: { jid: BOT_JID },
      async sendMessage(...args) { calls.push(args) },
    }

    await sendSingleMenu(MESSAGE, conn, 'Menú con banner')

    assert.equal(calls.length, 1)
    assert.ok(Buffer.isBuffer(calls[0][1].image))
    assert.equal(calls[0][1].caption, 'Menú con banner')
    assert.deepEqual(calls[0][1].mentions, [MESSAGE.sender])
  })

  test('hace exactamente un fallback simple si falla el payload enriquecido', async () => {
    const calls = []
    global.rcanal = { contextInfo: { externalAdReply: { title: 'Canal' } } }
    const conn = {
      user: { jid: BOT_JID },
      async sendMessage(...args) {
        calls.push(args)
        if (calls.length === 1) throw new Error('unsupported contextInfo')
      },
    }

    await sendSingleMenu(MESSAGE, conn, 'Menú fallback')

    assert.equal(calls.length, 2)
    assert.ok(calls[0][1].contextInfo)
    assert.deepEqual(calls[1][1], { text: 'Menú fallback' })
  })

  test('propaga el fallo definitivo del fallback', async () => {
    global.rcanal = { contextInfo: { externalAdReply: { title: 'Canal' } } }
    let attempts = 0
    const conn = {
      user: { jid: BOT_JID },
      async sendMessage() {
        attempts += 1
        throw new Error(attempts === 1 ? 'enriched failed' : 'fallback failed')
      },
    }

    await assert.rejects(
      sendSingleMenu(MESSAGE, conn, 'Menú imposible'),
      /fallback failed/,
    )
    assert.equal(attempts, 2)
  })
})
