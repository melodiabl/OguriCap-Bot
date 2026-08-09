import ws from 'ws'
import { generateWAMessageContent, generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'

function safeString(value) {
  return typeof value === 'string' ? value : (value == null ? '' : String(value))
}

function getSockReadyState(sock) {
  return (
    sock?.ws?.socket?.readyState ??
    sock?.ws?.readyState ??
    sock?.ws?.ws?.readyState ??
    null
  )
}

function isSockOnline(sock) {
  if (!sock) return false
  const rs = getSockReadyState(sock)
  if (typeof rs === 'number') return rs !== ws.CLOSED
  return Boolean(sock?.user || sock?.isInit)
}

function normalizePhone(value) {
  return safeString(value).replace(/[^0-9]/g, '')
}

function normalizePhoneFromJid(jid) {
  const raw = safeString(jid).trim().split('@')[0] || ''
  const base = raw.includes(':') ? raw.split(':')[0] : raw
  return normalizePhone(base)
}

function extractSockJid(sock) {
  return (
    sock?.user?.jid ||
    sock?.user?.id ||
    sock?.authState?.creds?.me?.jid ||
    sock?.authState?.creds?.me?.id ||
    ''
  )
}

function formatUptime(ms) {
  const value = Number(ms)
  if (!Number.isFinite(value) || value <= 0) return 'Activo recientemente'

  const seconds = Math.floor(value / 1000)
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (secs > 0 || !parts.length) parts.push(`${secs}s`)
  return parts.join(' ')
}

async function getCarouselImageMessage(conn) {
  try {
    const imageSource = Buffer.isBuffer(global?.catalogo)
      ? global.catalogo
      : (safeString(global?.icono).trim() ? { url: safeString(global.icono).trim() } : null)

    if (!imageSource) return null

    const media = await generateWAMessageContent(
      { image: imageSource },
      { upload: conn.waUploadToServer }
    )

    return media?.imageMessage || null
  } catch {
    return null
  }
}

function collectActiveBots(currentConn) {
  const records = []
  const seen = new Set()
  const mainNumber = normalizePhoneFromJid(extractSockJid(global.conn))

  const pushSock = (sock, forcedMain = false) => {
    if (!sock || !isSockOnline(sock)) return

    const jid = extractSockJid(sock)
    const number = normalizePhoneFromJid(jid)
    if (!number || seen.has(number)) return

    const isMain = forcedMain || (mainNumber && number === mainNumber)
    const uptimeStart = Number(sock?.uptime || 0)
    const uptimeMs = uptimeStart > 0 ? Date.now() - uptimeStart : 0
    const name = safeString(sock?.user?.name || sock?.authState?.creds?.me?.name || '').trim()

    records.push({
      number,
      jid: `${number}@s.whatsapp.net`,
      isMain,
      uptimeMs,
      name,
    })

    seen.add(number)
  }

  pushSock(currentConn, false)
  pushSock(global.conn, true)

  const subConns = Array.isArray(global.conns) ? global.conns : []
  for (const sock of subConns) {
    if (!sock || sock === global.conn || sock === currentConn) continue
    pushSock(sock, false)
  }

  return records.sort((a, b) => {
    if (a.isMain !== b.isMain) return a.isMain ? -1 : 1
    return a.number.localeCompare(b.number)
  })
}

async function sendFallbackText(m, conn, allBots, shownBots, groupCount) {
  const lines = shownBots.map((bot, index) => {
    const type = bot.isMain ? 'Principal' : 'Sub-Bot'
    const name = bot.name ? ` | ${bot.name}` : ''
    return `${index + 1}. +${bot.number} (${type}) | ${formatUptime(bot.uptimeMs)}${name}`
  })

  const totalSubs = Math.max(0, allBots.length - 1)
  const summary = [
    '*「 ✦ 」 Lista de bots activos*',
    '',
    `❀ Principal: *${allBots.some((bot) => bot.isMain) ? 1 : 0}*`,
    `✿ Subs: *${totalSubs}*`,
    m?.isGroup ? `❏ En este grupo: *${groupCount}* bots` : null,
    '',
    lines.length ? lines.join('\n') : '✧ No hay bots activos para mostrar.',
  ].filter(Boolean).join('\n')

  const mentions = shownBots.map((bot) => bot.jid)
  const baseRcanal = global?.rcanal

  if (baseRcanal?.contextInfo) {
    const rcanalPayload = {
      ...baseRcanal,
      contextInfo: {
        ...baseRcanal.contextInfo,
        mentionedJid: mentions,
      },
    }
    await conn.sendMessage(m.chat, { text: summary, ...rcanalPayload }, { quoted: m })
    return
  }

  await conn.sendMessage(m.chat, { text: summary, mentions }, { quoted: m })
}

async function sendInteractiveCarousel(m, conn, { usedPrefix, allBots, shownBots, groupCount }) {
  if (typeof conn?.relayMessage !== 'function') return false

  const p = safeString(usedPrefix || '#').trim() || '#'
  const label = safeString(global?.botname || 'Oguri Bot').trim() || 'Oguri Bot'
  const totalSubs = Math.max(0, allBots.length - 1)
  const cardList = Array.isArray(shownBots) ? shownBots : []

  if (!cardList.length) return false

  const imageMessage = await getCarouselImageMessage(conn)

  const cards = cardList.map((bot, idx) => {
    const type = bot.isMain ? 'Principal' : 'Sub-Bot'
    const absolute = idx + 1
    const body = [
      `Bot ${absolute}`,
      `Numero: +${bot.number}`,
      `Tipo: ${type}`,
      `Uptime: ${formatUptime(bot.uptimeMs)}`,
      bot.name ? `Nombre: ${bot.name}` : null,
    ].filter(Boolean).join('\n')

    const buttons = [
      {
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({
          display_text: 'Abrir chat',
          url: `https://wa.me/${bot.number}`,
          merchant_url: `https://wa.me/${bot.number}`,
        }),
      },
      {
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({ display_text: 'Estado', id: `${p}status` }),
      },
    ]

    return {
      body: proto.Message.InteractiveMessage.Body.fromObject({ text: body }),
      footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: label }),
      header: proto.Message.InteractiveMessage.Header.fromObject({
        title: `+${bot.number}`,
        subtitle: '',
        hasMediaAttachment: Boolean(imageMessage),
        imageMessage: imageMessage || null,
      }),
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
        buttons,
        messageParamsJson: '',
      }),
    }
  })

  const summaryText = [
    '*「 ✦ 」 Bots activos*',
    `❀ Principal: *${allBots.some((bot) => bot.isMain) ? 1 : 0}*`,
    `✿ Subs: *${totalSubs}*`,
    m?.isGroup ? `❏ En este grupo: *${groupCount}* bots` : null,
    `📋 Listados: *${cardList.length}*`,
  ].filter(Boolean).join('\n')

  const message = generateWAMessageFromContent(
    m.chat,
    {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
          },
          interactiveMessage: proto.Message.InteractiveMessage.fromObject({
            body: proto.Message.InteractiveMessage.Body.fromObject({ text: summaryText }),
            footer: proto.Message.InteractiveMessage.Footer.fromObject({
              text: `Usa ${p}status para ver estado general`,
            }),
            header: proto.Message.InteractiveMessage.Header.fromObject({ hasMediaAttachment: false }),
            carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({ cards }),
          }),
        },
      },
    },
    {
      quoted: m,
      userJid: conn?.user?.jid,
      upload: conn.waUploadToServer,
    }
  )

  await conn.relayMessage(m.chat, message.message, { messageId: message.key.id })

  return true
}

const handler = async (m, { conn, usedPrefix, participants }) => {
  try {
    const allBots = collectActiveBots(conn)
    if (!allBots.length) {
      await m.reply('✧ No hay bots activos en este momento.')
      return
    }

    const participantNumbers = new Set(
      (Array.isArray(participants) ? participants : [])
        .map((p) => normalizePhoneFromJid(p?.id || p?.jid || ''))
        .filter(Boolean)
    )

    const groupBots = m?.isGroup
      ? allBots.filter((bot) => participantNumbers.has(bot.number))
      : allBots

    const shownBots = m?.isGroup
      ? (groupBots.length ? groupBots : allBots)
      : allBots

    const groupCount = groupBots.length

    try {
      const ok = await sendInteractiveCarousel(m, conn, {
        usedPrefix,
        allBots,
        shownBots,
        groupCount,
      })
      if (ok) return
    } catch (error) {
      console.error('[BOTLIST] compatible-carousel failed:', error?.message || error)
    }

    await sendFallbackText(m, conn, allBots, shownBots, groupCount)
  } catch (error) {
    const p = safeString(usedPrefix || '#').trim() || '#'
    await m.reply(
      `⚠︎ Se ha producido un problema.\n` +
      `> Usa *${p}report* para informarlo.\n\n` +
      `${error?.message || error}`
    )
  }
}

handler.tags = ['serbot']
handler.help = ['botlist', 'bots']
handler.command = ['botlist', 'listbots', 'listbot', 'bots', 'sockets', 'socket']

export default handler
