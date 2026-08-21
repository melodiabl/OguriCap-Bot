import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildMenuIndex,
  buildMenuInteractiveButtons,
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

test('el selector interactivo incluye una opción por categoría', () => {
  const buttons = buildMenuInteractiveButtons('.')
  const params = JSON.parse(buttons[0].buttonParamsJson)
  const rows = params.sections[0].rows

  assert.equal(buttons[0].name, 'single_select')
  assert.equal(rows.length, Object.keys(menuObject).length)
  assert.equal(rows[0].id, '.menu economia')
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

test('allmenu entrega un solo selector y nunca hace spam', async () => {
  const { conn, message, sent } = createMenuRuntime()
  await menuHandler(message, { conn, usedPrefix: '.', command: 'allmenu', args: [] })

  assert.equal(sent.length, 1)
  assert.equal(sent[0].payload.interactiveButtons[0].name, 'single_select')
  assert.ok(!sent[0].payload.text.includes(menuObject.economia))
})
