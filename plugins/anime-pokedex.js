// PokeAPI (pokeapi.co): gratuita y estable. some-random-api devuelve 403 desde el VPS.
import fetch from 'node-fetch'

let handler = async (m, { conn, text, usedPrefix }) => {
try {
if (!text) return conn.reply(m.chat, `❀ Por favor, ingresa el nombre del Pokemon que quiere buscar.`, m)
await m.react('🕒')
const name = text.trim().toLowerCase()
let p, description = ''
try {
const api = global.APIs.MelodyApi
if (!api?.url || !api?.key) throw new Error('MelodiaAPI no configurada')
const res = await fetch(`${api.url}/search/pokemon?q=${encodeURIComponent(name)}&apikey=${encodeURIComponent(api.key)}`)
const json = await res.json()
if (!res.ok || !json.status || !json.result?.name) throw new Error(json.error || 'MelodiaAPI no disponible')
p = json.result
description = p.description || ''
} catch {
const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(name)}`)
if (!res.ok) return conn.reply(m.chat, `ꕥ No se encontró el Pokémon *${text}*.`, m)
const raw = await res.json()
p = { id: raw.id, name: raw.name, types: raw.types?.map(t => t.type?.name), abilities: raw.abilities?.map(a => a.ability?.name), heightMeters: raw.height / 10, weightKg: raw.weight / 10, image: raw.sprites?.other?.['official-artwork']?.front_default || raw.sprites?.front_default }
try {
const sres = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${raw.id}`)
if (sres.ok) { const species = await sres.json(); const entry = species.flavor_text_entries?.find(e => e.language?.name === 'es') || species.flavor_text_entries?.find(e => e.language?.name === 'en'); description = (entry?.flavor_text || '').replace(/\s+/g, ' ').trim() }
} catch {}
}
const tipos = p.types?.join(', ') || 'Desconocido'
const habilidades = p.abilities?.join(', ') || 'Desconocido'
const aipokedex = `❀ *Pokedex - Información*\n\n> • *Nombre* » ${p.name}\n> • *ID* » ${p.id}\n> • *Tipo* » ${tipos}\n> • *Habilidades* » ${habilidades}\n> • *Tamaño* » ${p.heightMeters} m\n> • *Peso* » ${p.weightKg} kg${description ? `\n> • *Descripción* » ${description}` : ''}\n\n> ¡Encuentra más detalles sobre este Pokémon en la Pokedex!\n\n> https://www.pokemon.com/es/pokedex/${p.name.toLowerCase()}`
const sprite = p.image || null
if (sprite) {
await conn.sendMessage(m.chat, { image: { url: sprite }, caption: aipokedex }, { quoted: m })
} else {
conn.reply(m.chat, aipokedex, m)
}
await m.react('✔️')
} catch (error) {
await m.react('✖️')
await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
}}

handler.help = ['pokedex']
handler.tags = ['fun']
handler.command = ['pokedex']
handler.group = true

export default handler
