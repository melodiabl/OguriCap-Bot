import fetch from 'node-fetch'
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { generateWAMessageFromContent, generateWAMessageContent, proto } from 'baileys'

const S = {}

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

function slug(name) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function ytdlp(url, out) {
  return new Promise((res, rej) => {
    const p = spawn('yt-dlp', [url, '-o', out, '--no-playlist', '-f', 'best[ext=mp4]/best', '--quiet', '--no-warnings'])
    p.on('close', c => (c === 0 ? res() : rej(new Error(`yt-dlp ${c}`))))
    p.on('error', rej)
  })
}

async function sendNative(conn, jid, body, footer, buttons, quoted) {
  const msg = generateWAMessageFromContent(jid, {
    viewOnceMessage: {
      message: {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        interactiveMessage: proto.Message.InteractiveMessage.fromObject({
          body: proto.Message.InteractiveMessage.Body.fromObject({ text: body }),
          footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: footer }),
          header: proto.Message.InteractiveMessage.Header.fromObject({ hasMediaAttachment: false }),
          nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
            buttons,
            messageParamsJson: '',
          }),
        }),
      },
    },
  }, { userJid: conn.user.jid, quoted })
  await conn.relayMessage(jid, msg.message, { messageId: msg.key.id })
}

// ── PASO 1: Buscar ─────────────────────────────────────────────────────────
async function stepBuscar(m, conn, query, p) {
  await m.react('🕒')
  const json = await get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=10&sfw=true`)
  const results = json.data
  if (!results?.length) {
    await m.react('❌')
    return conn.reply(m.chat, `❌ Sin resultados para *${query}*`, m)
  }

  S[m.sender] = { results }

  const sections = [{
    title: `Resultados (${results.length})`,
    rows: results.map((a, i) => ({
      header: a.title,
      title: `${a.type || '?'} · ${a.episodes || '?'} eps · ⭐${a.score || '?'}`,
      description: `${a.year || '?'}`,
      id: `${p}animesel ${i}`,
    })),
  }]

  const buttons = [{
    name: 'single_select',
    buttonParamsJson: JSON.stringify({ title: '📋 Seleccionar anime', sections }),
  }]

  await m.react('✅')
  await sendNative(conn, m.chat, `🎌 *Resultados para "${query}"*`, 'Selecciona un anime', buttons, m)
}

// ── PASO 2: Seleccionar ────────────────────────────────────────────────────
async function stepSelect(m, conn, idx, p) {
  const s = S[m.sender]
  if (!s?.results) return conn.reply(m.chat, `❌ Primero usa *${p}anime <nombre>*`, m)

  const anime = s.results[idx]
  s.anime = anime
  s.slug = slug(anime.title)

  const body = [
    `🎌 *${anime.title}*`,
    anime.title_japanese ? `🇯🇵 ${anime.title_japanese}` : null,
    `📺 ${anime.type || '?'} · 🎬 ${anime.episodes || '?'} eps · ⭐${anime.score || '?'}`,
    `📊 ${anime.status || '?'}`,
    `🏷️ ${anime.genres?.map(g => g.name).join(', ') || '?'}`,
    '',
    (anime.synopsis || 'Sin sinopsis').slice(0, 300) + (anime.synopsis?.length > 300 ? '...' : ''),
  ].filter(Boolean).join('\n')

  const buttons = [
    {
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({ display_text: '📺 Ver en AnimeFLV', id: `${p}animeeps` }),
    },
    {
      name: 'cta_url',
      buttonParamsJson: JSON.stringify({
        display_text: '🔍 Buscar en AnimeFLV',
        url: `https://www3.animeflv.net/browse?q=${encodeURIComponent(anime.title)}`,
        merchant_url: `https://www3.animeflv.net/browse?q=${encodeURIComponent(anime.title)}`,
      }),
    },
  ]

  if (anime.images?.jpg?.large_image_url) {
    const media = await generateWAMessageContent({ image: { url: anime.images.jpg.large_image_url } }, { upload: conn.waUploadToServer })
    const msg = generateWAMessageFromContent(m.chat, {
      viewOnceMessage: {
        message: {
          messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
          interactiveMessage: proto.Message.InteractiveMessage.fromObject({
            body: proto.Message.InteractiveMessage.Body.fromObject({ text: body }),
            footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: 'Anime Info' }),
            header: proto.Message.InteractiveMessage.Header.fromObject({
              hasMediaAttachment: true,
              imageMessage: media.imageMessage,
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
              buttons,
              messageParamsJson: '',
            }),
          }),
        },
      },
    }, { userJid: conn.user.jid, quoted: m })
    return conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
  }

  await sendNative(conn, m.chat, body, 'Anime Info', buttons, m)
}

// ── PASO 3: Episodios ──────────────────────────────────────────────────────
async function stepEpisodes(m, conn, p) {
  const s = S[m.sender]
  if (!s?.anime) return conn.reply(m.chat, `❌ Primero usa *${p}anime <nombre>*`, m)

  const totalEps = s.anime.episodes || 12
  const eps = Array.from({ length: Math.min(totalEps, 100) }, (_, i) => i + 1)

  const sections = [{
    title: `Episodios (${eps.length})`,
    rows: eps.map(num => ({
      header: `Episodio ${num}`,
      title: `Ep ${num}`,
      description: '▶️',
      id: `${p}animewatch ${num}`,
    })),
  }]

  const buttons = [{
    name: 'single_select',
    buttonParamsJson: JSON.stringify({ title: '▶️ Seleccionar episodio', sections }),
  }]

  await sendNative(conn, m.chat,
    `📺 *${s.anime.title}*\n🌐 AnimeFLV · ${eps.length} episodios\n\n` +
    `🔗 Link directo: https://www3.animeflv.net/anime/${s.slug}`,
    'Selecciona un episodio',
    buttons, m)
}

// ── PASO 4: Descargar ──────────────────────────────────────────────────────
async function stepWatch(m, conn, epNum, p) {
  const s = S[m.sender]
  if (!s?.anime || !s?.slug) return conn.reply(m.chat, `❌ Primero usa *${p}anime <nombre>*`, m)

  await m.react('🕒')

  const url = `https://www3.animeflv.net/ver/${s.slug}-${epNum}`

  const buttons = [
    {
      name: 'cta_url',
      buttonParamsJson: JSON.stringify({
        display_text: '▶️ Ver en AnimeFLV',
        url,
        merchant_url: url,
      }),
    },
    {
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({ display_text: '⬇️ Intentar descargar', id: `${p}animedl ${epNum}` }),
    },
  ]

  await m.react('✅')
  await sendNative(conn, m.chat,
    `📺 *${s.anime.title}* — Episodio ${epNum}\n\n` +
    `🔗 ${url}\n\n` +
    `💡 Toca "Ver en AnimeFLV" para reproducir online\n` +
    `💡 O "Intentar descargar" para que el bot lo descargue (puede fallar)`,
    'AnimeFLV',
    buttons, m)
}

// ── PASO 5: Descargar (intento) ────────────────────────────────────────────
async function stepDownload(m, conn, epNum, p) {
  const s = S[m.sender]
  if (!s?.anime || !s?.slug) return conn.reply(m.chat, `❌ Primero usa *${p}anime <nombre>*`, m)

  await m.react('🕒')
  await conn.reply(m.chat, `⬇️ Intentando descargar *${s.anime.title}* — Ep ${epNum}...\n⚠️ Esto puede fallar si AnimeFLV tiene protección`, m)

  const url = `https://www3.animeflv.net/ver/${s.slug}-${epNum}`
  const tmp = path.join(os.tmpdir(), `anime_${m.sender.split('@')[0]}_${Date.now()}.mp4`)

  try {
    await ytdlp(url, tmp)
    if (fs.existsSync(tmp) && fs.statSync(tmp).size > 10000) {
      await m.react('📤')
      await conn.sendFile(m.chat, tmp, `${s.slug}-ep${epNum}.mp4`,
        `🎌 *${s.anime.title}* — Ep ${epNum} · 🌐 AnimeFLV`, m)
      await m.react('✅')
      fs.unlink(tmp, () => {})
      return
    }
  } catch {}

  await m.react('❌')
  const buttons = [{
    name: 'cta_url',
    buttonParamsJson: JSON.stringify({
      display_text: '▶️ Ver en AnimeFLV',
      url,
      merchant_url: url,
    }),
  }]
  await sendNative(conn, m.chat,
    `❌ No pude descargar el episodio.\n\n` +
    `📺 *${s.anime.title}* — Ep ${epNum}\n` +
    `🔗 ${url}\n\n` +
    `💡 AnimeFLV tiene protección anti-bot. Usa el botón para ver online.`,
    'AnimeFLV',
    buttons, m)
  fs.unlink(tmp, () => {})
}

// ── HANDLER ────────────────────────────────────────────────────────────────
let handler = async (m, { conn, command, text, usedPrefix }) => {
  const p = usedPrefix
  try {
    if (command === 'anime') {
      if (!text) return conn.reply(m.chat, `🎌 Uso: *${p}anime* <nombre>`, m)
      return await stepBuscar(m, conn, text, p)
    }
    if (command === 'animesel') return await stepSelect(m, conn, parseInt(text) || 0, p)
    if (command === 'animeeps') return await stepEpisodes(m, conn, p)
    if (command === 'animewatch') return await stepWatch(m, conn, parseInt(text) || 1, p)
    if (command === 'animedl') return await stepDownload(m, conn, parseInt(text) || 1, p)
  } catch (e) {
    console.error('[ANIME]', e.message)
    await m.react('❌')
    return conn.reply(m.chat, `⚠️ Error: ${e.message}`, m)
  }
}

handler.help = ['anime <nombre>']
handler.tags = ['anime']
handler.command = ['anime', 'animesel', 'animeeps', 'animewatch', 'animedl']

export default handler
