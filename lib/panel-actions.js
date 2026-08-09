/**
 * Módulo de acciones del panel que se aplican al bot
 * Sincroniza las acciones del panel con la base de datos del bot
 */

import { emitBotStatus, emitGrupoUpdated, emitNotification, emitAporteUpdated, emitPedidoUpdated } from './socket-io.js'

/**
 * Activa/desactiva el bot globalmente
 */
export async function setBotGlobalState(isOn) {
  if (!global.db?.data?.panel) return { success: false, error: 'DB no disponible' }
  
  global.db.data.panel.botGlobalState = {
    isOn: Boolean(isOn),
    lastUpdated: new Date().toISOString()
  }
  
  // Emitir evento
  emitBotStatus()
  emitNotification({
    type: isOn ? 'success' : 'warning',
    title: isOn ? 'Bot Activado' : 'Bot Desactivado',
    message: isOn ? 'El bot está activo globalmente' : 'El bot está desactivado globalmente'
  })
  
  return { success: true, isOn }
}

/**
 * Establece el mensaje cuando el bot está desactivado
 */
export function setBotGlobalOffMessage(message) {
  if (!global.db?.data?.panel) return { success: false, error: 'DB no disponible' }
  
  global.db.data.panel.botGlobalOffMessage = String(message || '')
  return { success: true, message }
}

/**
 * Activa/desactiva el bot en un grupo específico
 */
export async function setGroupBotState(jid, enabled) {
  if (!global.db?.data?.chats) return { success: false, error: 'DB no disponible' }
  
  const chat = global.db.data.chats[jid]
  if (!chat) {
    global.db.data.chats[jid] = { isBanned: !enabled }
  } else {
    chat.isBanned = !enabled
  }
  
  // Emitir evento
  emitGrupoUpdated({ jid, isBanned: !enabled, botEnabled: enabled })
  
  return { success: true, jid, enabled }
}

/**
 * Actualiza la configuración de un grupo
 */
export async function updateGroupConfig(jid, config) {
  if (!global.db?.data?.chats) return { success: false, error: 'DB no disponible' }
  
  const chat = global.db.data.chats[jid] || (global.db.data.chats[jid] = {})
  
  // Aplicar configuración
  if ('isBanned' in config) chat.isBanned = Boolean(config.isBanned)
  if ('botEnabled' in config) chat.isBanned = !Boolean(config.botEnabled)
  if ('modoadmin' in config) chat.modoadmin = Boolean(config.modoadmin)
  if ('antiLink' in config) chat.antiLink = Boolean(config.antiLink)
  if ('welcome' in config) chat.welcome = Boolean(config.welcome)
  if ('nsfw' in config) chat.nsfw = Boolean(config.nsfw)
  if ('economy' in config) chat.economy = Boolean(config.economy)
  if ('gacha' in config) chat.gacha = Boolean(config.gacha)
  if ('isMute' in config) chat.isMute = Boolean(config.isMute)
  
  // Emitir evento
  emitGrupoUpdated({ jid, ...chat })
  
  return { success: true, jid, config: chat }
}

/**
 * Banea/desbanea un usuario
 */
export async function setUserBanned(userId, banned, reason = '') {
  if (!global.db?.data?.users) return { success: false, error: 'DB no disponible' }
  
  const jid = userId.includes('@') ? userId : `${userId}@s.whatsapp.net`
  const user = global.db.data.users[jid]
  
  if (!user) {
    global.db.data.users[jid] = { banned: Boolean(banned), bannedReason: reason }
  } else {
    user.banned = Boolean(banned)
    user.bannedReason = reason
  }
  
  emitNotification({
    type: banned ? 'warning' : 'success',
    title: banned ? 'Usuario Baneado' : 'Usuario Desbaneado',
    message: `Usuario ${jid.split('@')[0]} ${banned ? 'baneado' : 'desbaneado'}`
  })
  
  return { success: true, userId: jid, banned, reason }
}

/**
 * Establece un usuario como premium
 */
export async function setUserPremium(userId, premium, duration = 0) {
  if (!global.db?.data?.users) return { success: false, error: 'DB no disponible' }
  
  const jid = userId.includes('@') ? userId : `${userId}@s.whatsapp.net`
  const user = global.db.data.users[jid] || (global.db.data.users[jid] = {})
  
  user.premium = Boolean(premium)
  if (premium && duration > 0) {
    user.premiumTime = Date.now() + (duration * 24 * 60 * 60 * 1000) // días a ms
  } else if (!premium) {
    user.premiumTime = 0
  }
  
  return { success: true, userId: jid, premium, premiumTime: user.premiumTime }
}

/**
 * Actualiza el estado de un aporte
 */
export async function updateAporteEstado(id, estado, motivo = '') {
  if (!global.db?.data?.aportes) return { success: false, error: 'DB no disponible' }
  
  const aporte = global.db.data.aportes.find(a => a.id === id)
  if (!aporte) return { success: false, error: 'Aporte no encontrado' }
  
  aporte.estado = estado
  if (motivo) aporte.motivo_rechazo = motivo
  aporte.fecha_procesado = new Date().toISOString()
  
  // Emitir evento
  emitAporteUpdated(aporte)
  
  return { success: true, aporte }
}

/**
 * Actualiza el estado de un pedido
 */
export async function updatePedidoEstado(id, estado) {
  if (!global.db?.data?.panel?.pedidos) return { success: false, error: 'DB no disponible' }
  
  const pedido = global.db.data.panel.pedidos[id]
  if (!pedido) return { success: false, error: 'Pedido no encontrado' }
  
  pedido.estado = estado
  pedido.fecha_actualizacion = new Date().toISOString()
  
  // Emitir evento
  emitPedidoUpdated(pedido)
  
  return { success: true, pedido }
}

/**
 * Envía un mensaje a un chat desde el panel
 */
export async function sendMessageFromPanel(jid, message, options = {}) {
  const conn = global.conn
  if (!conn) return { success: false, error: 'Bot no conectado' }
  
  try {
    let result
    
    if (options.image) {
      result = await conn.sendFile(jid, options.image, 'image.jpg', message)
    } else if (options.video) {
      result = await conn.sendFile(jid, options.video, 'video.mp4', message)
    } else if (options.audio) {
      result = await conn.sendFile(jid, options.audio, 'audio.mp3', message, null, { mimetype: 'audio/mp4', ptt: options.ptt || false })
    } else if (options.document) {
      result = await conn.sendFile(jid, options.document, options.filename || 'document', message)
    } else {
      result = await conn.sendMessage(jid, { text: message })
    }
    
    return { success: true, messageId: result?.key?.id }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Envía un mensaje a múltiples chats (broadcast)
 */
export async function broadcastMessage(jids, message, options = {}) {
  const conn = global.conn
  if (!conn) return { success: false, error: 'Bot no conectado' }
  
  const results = []
  for (const jid of jids) {
    try {
      const result = await sendMessageFromPanel(jid, message, options)
      results.push({ jid, ...result })
      // Pequeño delay para evitar spam
      await new Promise(r => setTimeout(r, 500))
    } catch (error) {
      results.push({ jid, success: false, error: error.message })
    }
  }
  
  return { success: true, results }
}

/**
 * Obtiene información de un grupo
 */
export async function getGroupInfo(jid) {
  const conn = global.conn
  if (!conn) return { success: false, error: 'Bot no conectado' }
  
  try {
    const metadata = await conn.groupMetadata(jid)
    const chat = global.db?.data?.chats?.[jid] || {}
    
    return {
      success: true,
      group: {
        jid,
        subject: metadata.subject,
        desc: metadata.desc,
        owner: metadata.owner,
        creation: metadata.creation,
        participants: metadata.participants?.length || 0,
        admins: metadata.participants?.filter(p => p.admin)?.length || 0,
        config: {
          isBanned: chat.isBanned || false,
          modoadmin: chat.modoadmin || false,
          antiLink: chat.antiLink || false,
          welcome: chat.welcome || false,
          nsfw: chat.nsfw || false,
          economy: chat.economy !== false,
          gacha: chat.gacha !== false,
          isMute: chat.isMute || false
        }
      }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Obtiene la lista de grupos del bot
 */
export async function getBotGroups() {
  const conn = global.conn
  if (!conn) return { success: false, error: 'Bot no conectado' }
  
  try {
    const groups = await conn.groupFetchAllParticipating()
    const result = Object.values(groups).map(g => {
      const chat = global.db?.data?.chats?.[g.id] || {}
      return {
        jid: g.id,
        subject: g.subject,
        desc: g.desc,
        participants: g.participants?.length || 0,
        botEnabled: !chat.isBanned
      }
    })
    
    return { success: true, groups: result }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Expulsa a un usuario de un grupo
 */
export async function kickUser(groupJid, userJid) {
  const conn = global.conn
  if (!conn) return { success: false, error: 'Bot no conectado' }
  
  try {
    const jid = userJid.includes('@') ? userJid : `${userJid}@s.whatsapp.net`
    await conn.groupParticipantsUpdate(groupJid, [jid], 'remove')
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Promueve/degrada a un usuario en un grupo
 */
export async function setGroupAdmin(groupJid, userJid, promote = true) {
  const conn = global.conn
  if (!conn) return { success: false, error: 'Bot no conectado' }
  
  try {
    const jid = userJid.includes('@') ? userJid : `${userJid}@s.whatsapp.net`
    await conn.groupParticipantsUpdate(groupJid, [jid], promote ? 'promote' : 'demote')
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export default {
  setBotGlobalState,
  setBotGlobalOffMessage,
  setGroupBotState,
  updateGroupConfig,
  setUserBanned,
  setUserPremium,
  updateAporteEstado,
  updatePedidoEstado,
  sendMessageFromPanel,
  broadcastMessage,
  getGroupInfo,
  getBotGroups,
  kickUser,
  setGroupAdmin
}
