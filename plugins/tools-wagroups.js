import fetch from 'node-fetch'

// El proveedor de búsqueda de grupos (adonix) cerró y no hay alternativa estable.
// Aviso claro en vez de error críptico; reactivar cuando exista proveedor.
const handler = async (m, { conn, text, usedPrefix, command }) => {
if (!text) return conn.reply(m.chat, `❍ Escribe el nombre del grupo a buscar.\nEj: *${usedPrefix + command} Memes*`, m)
return conn.reply(m.chat, `ꕥ La búsqueda de grupos de WhatsApp está temporalmente fuera de servicio (el proveedor externo cerró). Estamos buscando un reemplazo.`, m)
}

handler.command = ['wagroups']
handler.tags = ['search']
handler.help = ['wpgroups', 'wagroups', 'wgrupos']

export default handler
