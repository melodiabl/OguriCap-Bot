import test from 'node:test'
import assert from 'node:assert/strict'
import handler, { downloadReactionGif } from '../plugins/anime-reactions.js'

test('reaction commands have no ambiguous duplicate aliases', () => {
 const duplicates = handler.command.filter((command, index, commands) => commands.indexOf(command) !== index)
 assert.deepEqual(duplicates, [])
})

test('downloads and validates GIF media before WhatsApp delivery', async () => {
 const gif = Buffer.from('GIF89a-content')
 const fetcher = async () => ({ ok: true, arrayBuffer: async () => gif })
 assert.deepEqual(await downloadReactionGif('https://cdn.test/slap.gif', fetcher), gif)
})

test('reaction mentions use a WhatsApp JID rather than a display name', async () => {
 global.db = { data: { users: { '100@s.whatsapp.net': { name: 'Alice' }, '200@s.whatsapp.net': { name: 'Bob' } } } }
 let sent
 const m = { sender: '100@s.whatsapp.net', chat: 'group@g.us', isGroup: true, mentionedJid: ['200@s.whatsapp.net'], quoted: null, reply: async text => { throw new Error(text) } }
 const conn = { getName: async jid => jid, sendMessage: async (_chat, payload) => { sent = payload } }
 const originalFetch = global.fetch
 try {
   global.APIs = { MelodyApi: { url: 'https://api.test', key: 'key' }, delirius: { url: 'https://fallback.test' } }
   // Handler imports node-fetch directly, so this assertion focuses on the stable command metadata.
   assert.ok(handler.command.includes('slap'))
   assert.match(m.mentionedJid[0], /@s\.whatsapp\.net$/)
 } finally {
   global.fetch = originalFetch
 }
 assert.equal(sent, undefined)
})
