import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../plugins/group-setprimary.js'

test('setprimary persists before confirming success', async () => {
  let writes = 0
  let replies = 0
  global.botname = 'Oguri'
  global.conns = []
  global.conn = { user: { jid: '100@s.whatsapp.net' } }
  global.db = {
    data: { chats: { 'group@g.us': { primaryBot: null } } },
    write: async () => { writes += 1 }
  }
  const m = { chat: 'group@g.us', mentionedJid: ['100@s.whatsapp.net'], quoted: null }
  const conn = { reply: async () => { replies += 1 } }
  await handler(m, { conn, usedPrefix: '.' })
  assert.equal(global.db.data.chats[m.chat].primaryBot, '100@s.whatsapp.net')
  assert.equal(writes, 1)
  assert.equal(replies, 1)
})

test('setprimary accepts a device-qualified socket JID', async () => {
  global.botname = 'Oguri'
  global.conns = [{ user: { jid: '200:7@s.whatsapp.net' }, isConnected: true }]
  global.conn = { user: { jid: '100@s.whatsapp.net' } }
  global.db = { data: { chats: { 'group@g.us': {} } }, write: async () => {} }
  const m = { chat: 'group@g.us', mentionedJid: ['200@s.whatsapp.net'], quoted: null }
  await handler(m, { conn: { reply: async () => {} }, usedPrefix: '.' })
  assert.equal(global.db.data.chats[m.chat].primaryBot, '200:7@s.whatsapp.net')
})
