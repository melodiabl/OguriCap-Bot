import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildMenuIndex,
  buildAllMenuPages,
  resolveMenuCategory,
  menuObject,
} from '../plugins/main-menu.js'
import menuHandler from '../plugins/main-menu.js'

test('resuelve categorías en español, inglés y sin tilde', () => {
  assert.equal(resolveMenuCategory('economía'), 'economia')
  assert.equal(resolveMenuCategory('downloads'), 'downloads')
  assert.equal(resolveMenuCategory('descargas'), 'downloads')
  assert.equal(resolveMenuCategory('grupos'), 'grupo')
  assert.equal(resolveMenuCategory('desconocida'), null)
})

test('la portada es breve y enlaza todas las categorías', () => {
  const text = buildMenuIndex({ prefix: '.', botname: 'OguriCap', sender: '1234' })

  assert.match(text, /OGURICAP/i)
  assert.match(text, /\.menu economia/)
  assert.match(text, /\.allmenu/)
  assert.ok(Buffer.byteLength(text, 'utf8') < 4000)
  assert.ok(!text.includes(menuObject.economia))
})

test('allmenu se pagina sin perder categorías ni superar el límite', () => {
  const pages = buildAllMenuPages({ prefix: '.', maxBytes: 4000 })

  assert.ok(pages.length > 1)
  for (const page of pages) assert.ok(Buffer.byteLength(page, 'utf8') <= 4000)
  const joined = pages.join('\n')
  for (const category of Object.keys(menuObject)) {
    assert.ok(joined.includes(menuObject[category].replaceAll('$prefix', '.')))
  }
  assert.match(pages[0], /Parte 1 de \d+/)
})

function createMenuRuntime() {
  const sent = []
  const conn = {
    user: { jid: '100@s.whatsapp.net' },
    async sendMessage(chat, payload) {
      sent.push({ chat, payload })
      return { key: { id: String(sent.length) } }
    },
  }
  global.conn = conn
  global.botname = 'OguriCap'
  global.owner = [['100', 'Owner']]
  global.db = { data: { users: {}, settings: { '100@s.whatsapp.net': {} }, panel: { subbots: {} } } }
  const message = { chat: 'chat@s.whatsapp.net', sender: '200@s.whatsapp.net' }
  return { conn, message, sent }
}

test('el handler envía únicamente la categoría solicitada como texto', async () => {
  const { conn, message, sent } = createMenuRuntime()
  await menuHandler(message, { conn, usedPrefix: '.', command: 'menu', args: ['descargas'] })

  assert.equal(sent.length, 1)
  assert.match(sent[0].payload.text, /OGURICAP · DESCARGAS/)
  assert.match(sent[0].payload.text, /\.play/)
  assert.ok(!sent[0].payload.text.includes(menuObject.economia))
})

test('el handler responde ante una categoría desconocida', async () => {
  const { conn, message, sent } = createMenuRuntime()
  await menuHandler(message, { conn, usedPrefix: '.', command: 'menu', args: ['inventada'] })

  assert.equal(sent.length, 1)
  assert.match(sent[0].payload.text, /No encontré la categoría/)
})

test('allmenu entrega todas las páginas como mensajes separados', async () => {
  const { conn, message, sent } = createMenuRuntime()
  await menuHandler(message, { conn, usedPrefix: '.', command: 'allmenu', args: [] })

  assert.ok(sent.length > 1)
  assert.match(sent[0].payload.text, /Parte 1 de \d+/)
  assert.match(sent.at(-1).payload.text, new RegExp(`Parte ${sent.length} de ${sent.length}`))
})
