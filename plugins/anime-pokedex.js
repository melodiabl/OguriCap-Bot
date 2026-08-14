// PokeAPI (pokeapi.co): gratuita y estable. some-random-api devuelve 403 desde el VPS.
import fetch from 'node-fetch'

let handler = async (m, { conn, text, usedPrefix }) => {
try {
if (!text) return conn.reply(m.chat, `❀ Por favor, ingresa el nombre del Pokemon que quiere buscar.`, m)
await m.react('🕒')
const name = text.trim().toLowerCase()
const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(name)}`)
if (!res.ok) {
await m.react('✖️')
return conn.reply(m.chat, `ꕥ No se encontró el Pokémon *${text}*.`, m)
}
const p = await res.json()
let description = ''
try {
const sres = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${p.id}`)
if (sres.ok) {
const species = await sres.json()
const entry = species.flavor_text_entries?.find(e => e.language?.name === 'es') || species.flavor_text_entries?.find(e => e.language?.name === 'en')
description = (entry?.flavor_text || '').replace(/\s+/g, ' ').trim()
}
} catch {}
const tipos = p.types?.map(t => t.type?.name).filter(Boolean).join(', ') || 'Desconocido'
const habilidades = p.abilities?.map(a => a.ability?.name).filter(Boolean).join(', ') || 'Desconocido'
const aipokedex = `❀ *Pokedex - Información*\n\n> • *Nombre* » ${p.name}\n> • *ID* » ${p.id}\n> • *Tipo* » ${tipos}\n> • *Habilidades* » ${habilidades}\n> • *Tamaño* » ${p.height / 10} m\n> • *Peso* » ${p.weight / 10} kg${description ? `\n> • *Descripción* » ${description}` : ''}\n\n> ¡Encuentra más detalles sobre este Pokémon en la Pokedex!\n\n> https://www.pokemon.com/es/pokedex/${p.name.toLowerCase()}`
const sprite = p.sprites?.other?.['official-artwork']?.front_default || p.sprites?.front_default || null
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
