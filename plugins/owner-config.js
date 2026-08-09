let handler = async (m, { args, usedPrefix }) => {
  const store = global.db.data.config || (global.db.data.config = {})
  const sub = String(args[0] || '').toLowerCase()

  if (sub === 'set') {
    const key = String(args[1] || '').trim()
    const value = args.slice(2).join(' ')
    if (!key) return m.reply(`Uso: ${usedPrefix}config set <clave> <valor>`)
    store[key] = value
    return m.reply(`Config guardado: ${key} = ${value}`)
  }

  if (sub === 'get') {
    const key = String(args[1] || '').trim()
    if (!key) return m.reply(`Uso: ${usedPrefix}config get <clave>`)
    if (!(key in store)) return m.reply('Clave no definida.')
    return m.reply(`${key} = ${store[key]}`)
  }

  if (sub === 'del') {
    const key = String(args[1] || '').trim()
    if (!key) return m.reply(`Uso: ${usedPrefix}config del <clave>`)
    if (!(key in store)) return m.reply('Clave no definida.')
    delete store[key]
    return m.reply(`Config eliminado: ${key}`)
  }

  if (sub === 'list') {
    const keys = Object.keys(store)
    if (!keys.length) return m.reply('No hay configuraciones guardadas.')
    const list = keys.sort().map(k => `${k} = ${store[k]}`).join('\n')
    return m.reply(`Config guardado\n\n${list}`)
  }

  return m.reply(`Uso:\n${usedPrefix}config get <clave>\n${usedPrefix}config set <clave> <valor>\n${usedPrefix}config del <clave>\n${usedPrefix}config list`)
}

handler.help = ['config']
handler.tags = ['owner']
handler.command = ['config']
handler.owner = true

export default handler
