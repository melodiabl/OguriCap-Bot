import fetch from "node-fetch"

let handler = async (m, { conn, usedPrefix }) => {
try {
await m.react('🕒')
let cita
try {
const api = global.APIs.MelodyApi
if (!api?.url || !api?.key) throw new Error('MelodiaAPI no configurada')
const res = await fetch(`${api.url}/anime/couple?apikey=${encodeURIComponent(api.key)}`)
const json = await res.json()
if (!res.ok || !json.status || !json.result?.male || !json.result?.female) throw new Error(json.error || 'Sin resultados')
cita = { cowo: json.result.male, cewe: json.result.female }
} catch {
const data = await (await fetch('https://raw.githubusercontent.com/ShirokamiRyzen/WAbot-DB/main/fitur_db/ppcp.json')).json()
cita = data[Math.floor(Math.random() * data.length)]
}
let cowi = await (await fetch(cita.cowo)).arrayBuffer().then(b => Buffer.from(b))
await conn.sendFile(m.chat, cowi, '', '*Masculino* ♂', m)
let ciwi = await (await fetch(cita.cewe)).arrayBuffer().then(b => Buffer.from(b))
await conn.sendFile(m.chat, ciwi, '', '*Femenina* ♀', m)
await m.react('✔️')
} catch (error) {
await m.react('✖️')
await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
}}

handler.help = ['ppcouple']
handler.tags = ['anime']
handler.command = ['ppcp', 'ppcouple']
handler.group = true

export default handler
