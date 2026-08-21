import axios from 'axios'
import { melodiaRequest, withFallback } from '../lib/melodia-api.js'

let handler = async (m, { conn, usedPrefix, text }) => {
if (!text) {
return conn.reply(m.chat, `❀ Por favor, ingresa una *IP*.`, m)
}
try {
await m.react('🕒')
const data = await withFallback(
async () => {
const payload = await melodiaRequest('/tools/ip-tracker', { params: { ip: text } })
const geo = payload?.data
if (!payload?.status || !geo) throw new Error(payload?.error || 'IP no encontrada')
return { status: 'success', query: geo.ip, country: geo.country, countryCode: geo.country_code, regionName: geo.region, region: '', city: geo.city, district: '', zip: geo.zipcode, timezone: geo.timezone, isp: geo.isp, org: geo.organization, as: geo.asn, mobile: false, hosting: false }
},
async () => (await axios.get(`http://ip-api.com/json/${encodeURIComponent(text)}?fields=status,message,country,countryCode,region,regionName,city,district,zip,lat,lon,timezone,isp,org,as,mobile,hosting,query`, { timeout: 12_000 })).data
)
if (String(data.status) !== "success") {
throw new Error(data.message || "Falló")
}
let ipsearch = `✧ *I N F O - I P* ✧
» IP : ${data.query}
» País : ${data.country}
» Código de País : ${data.countryCode}
» Provincia : ${data.regionName}
» Código de Provincia : ${data.region}
» Ciudad : ${data.city}
» Distrito : ${data.district}
» Código Postal : ${data.zip}
» Zona Horaria : ${data.timezone}
» ISP : ${data.isp}
» Organización : ${data.org}
» AS : ${data.as}
» Mobile : ${data.mobile ? "Si" : "No"}
» Hosting : ${data.hosting ? "Si" : "No"}`.trim()
conn.reply(m.chat, ipsearch, m)
await m.react('✔️')
} catch (error) {
await m.react('✖️')
conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
}}

handler.help = ['ip <alamat ip>']
handler.tags = ['owner']
handler.command = ['ip']

export default handler
