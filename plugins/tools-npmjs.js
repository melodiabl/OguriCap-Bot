import { exec } from 'child_process'
import fs from 'fs'
import fetch from 'node-fetch'

let handler = async (m, { conn, text, usedPrefix, command }) => {
if (!text) return m.reply(`❀ Por favor, ingresa el nombre de un paquete de NPMJs y versión (opcional).`)
async function npmdownloader(pkg, pkgver) {
try {
await m.react('🕒')
try {
const api = global.APIs.MelodyApi
if (!api?.url || !api?.key) throw new Error('MelodiaAPI no configurada')
const response = await fetch(`${api.url}/tools/npm-package?q=${encodeURIComponent(pkg)}&version=${encodeURIComponent(pkgver)}&apikey=${encodeURIComponent(api.key)}`)
const json = await response.json()
if (!response.ok || !json.status || !json.result?.tarball) throw new Error(json.error || 'Paquete no encontrado')
const archive = await fetch(json.result.tarball)
if (!archive.ok) throw new Error('No se pudo descargar el paquete')
const data = await archive.arrayBuffer().then(buffer => Buffer.from(buffer))
await conn.sendMessage(m.chat, { document: data, mimetype: 'application/gzip', fileName: `${json.result.name.replace('/', '-')}-${json.result.version}.tgz`, caption: `» Nombre: ${json.result.name}\n» Versión: ${json.result.version}\n» Descripción: ${json.result.description || 'Sin descripción'}\n» Link: ${json.result.homepage}` }, { quoted: m })
return
} catch {}
const filePath = await new Promise((resolve, reject) => {
exec(`npm pack ${pkg}@${pkgver}`, (error, stdout) => {
if (error) {
m.reply('Error')
console.error(`exec error: ${error}`)
reject(error)
return
}
resolve(stdout.trim())
}) })
const fileName = filePath.split('/').pop();
const data = await fs.promises.readFile(filePath)
let Link;
if (pkgver === 'latest') {
Link = `https://www.npmjs.com/package/${pkg}`
} else {
Link = `https://www.npmjs.com/package/${pkg}/v/${pkgver}`
}
const pkgInfo = await new Promise((resolve, reject) => {
exec(`npm view ${pkg} description`, (error, stdout) => {
if (error) {
console.error(`Error al obtener la descripción: ${error}`)
reject('No se pudo obtener la descripción.')
return
}
resolve(stdout.trim())
}) })
await conn.sendMessage(m.chat, {document: data, mimetype: "application/zip", fileName: fileName, caption: `» Nombre: ${fileName}\n» Versión: ${pkgver}\n» Descripción: ${pkgInfo}\n» Link: ${Link}`},{ quoted: m })
await fs.promises.unlink(filePath)
} catch (err) {
console.error(`⚠︎ Error: ${err}`)
}}
try {
const [text2, ver] = text.split(",")
await npmdownloader(text2.trim(), ver ? ver.trim() : 'latest')
await m.react('✔️')
} catch (error) {
await m.react('✖️')
m.reply(`⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`)
}}

handler.help = ["npmdl"]
handler.tags = ["tools"]
handler.command = ["npmdownloader", "npmjs", "npmdl", "npm"]

export default handler
