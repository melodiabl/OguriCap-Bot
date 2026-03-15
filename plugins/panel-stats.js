/**
 * Plugin para ver estadísticas del panel desde el bot
 */

const formatUptime = (ms) => {
  const seconds = Math.floor(ms / 1000)
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

let handler = async (m, { args, usedPrefix, command, conn, isOwner }) => {
  const panel = global.db.data.panel || {}
  const users = global.db.data.users || {}
  const chats = global.db.data.chats || {}
  const aportes = global.db.data.aportes || []

  switch (command) {
    case 'panelstats':
    case 'estadisticas': {
      if (!isOwner) return m.reply('❌ Solo el owner puede ver las estadísticas del panel')

      const totalUsuarios = Object.keys(users).length
      const usuariosPremium = Object.values(users).filter(u => u.premium).length
      const usuariosBaneados = Object.values(users).filter(u => u.banned).length

      const totalGrupos = Object.keys(chats).length
      const gruposActivos = Object.values(chats).filter(c => !c.isBanned).length
      const gruposInactivos = totalGrupos - gruposActivos

      const totalAportes = aportes.length
      const aportesPendientes = aportes.filter(a => a.estado === 'pendiente').length
      const aportesAprobados = aportes.filter(a => a.estado === 'aprobado').length

      const totalPedidos = Object.keys(panel.pedidos || {}).length
      const pedidosPendientes = Object.values(panel.pedidos || {}).filter(p => p.estado === 'pendiente').length
      const pedidosCompletados = Object.values(panel.pedidos || {}).filter(p => p.estado === 'completado').length

      const totalSubbots = Object.keys(panel.subbots || {}).length
      const subbotsOnline = (global.conns || []).filter(c => c?.user).length

      const botGlobal = panel.botGlobalState?.isOn !== false ? '✅ Activo' : '❌ Desactivado'
      const uptime = formatUptime(Date.now() - (global.conn?.uptime || Date.now()))

      const msg = [
        `📊 *Estadísticas del Panel*`,
        ``,
        `🤖 *Bot Principal*`,
        `├ Estado: ${botGlobal}`,
        `├ Uptime: ${uptime}`,
        `└ Subbots: ${subbotsOnline}/${totalSubbots} online`,
        ``,
        `👥 *Usuarios*`,
        `├ Total: ${totalUsuarios}`,
        `├ Premium: ${usuariosPremium}`,
        `└ Baneados: ${usuariosBaneados}`,
        ``,
        `💬 *Grupos*`,
        `├ Total: ${totalGrupos}`,
        `├ Activos: ${gruposActivos}`,
        `└ Inactivos: ${gruposInactivos}`,
        ``,
        `📦 *Aportes*`,
        `├ Total: ${totalAportes}`,
        `├ Pendientes: ${aportesPendientes}`,
        `└ Aprobados: ${aportesAprobados}`,
        ``,
        `📋 *Pedidos*`,
        `├ Total: ${totalPedidos}`,
        `├ Pendientes: ${pedidosPendientes}`,
        `└ Completados: ${pedidosCompletados}`,
        ``,
        `💾 *Sistema*`,
        `├ RAM: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
        `└ Node: ${process.version}`,
        ``,
        `🌐 *Panel Web*`,
        `${(process.env.PANEL_URL || process.env.NEXT_PUBLIC_API_URL || '').trim() || 'http://localhost:3000'}`
      ].join('\n')

      return m.reply(msg)
    }

    case 'botstatus':
    case 'statusbot': {
      const isConnected = global.conn?.user ? true : false
      const phone = global.conn?.user?.id?.split(':')[0] || 'N/A'
      const botGlobal = panel.botGlobalState?.isOn !== false
      const uptime = formatUptime(Date.now() - (global.conn?.uptime || Date.now()))

      const totalSubbots = Object.keys(panel.subbots || {}).length
      const subbotsOnline = (global.conns || []).filter(c => c?.user).length

      const msg = [
        `🤖 *Estado del Bot*`,
        ``,
        `📱 *Bot Principal*`,
        `├ Conexión: ${isConnected ? '✅ Conectado' : '❌ Desconectado'}`,
        `├ Número: ${phone}`,
        `├ Estado Global: ${botGlobal ? '✅ Activo' : '❌ Desactivado'}`,
        `└ Uptime: ${uptime}`,
        ``,
        `🔌 *Subbots*`,
        `├ Total: ${totalSubbots}`,
        `├ Online: ${subbotsOnline}`,
        `└ Offline: ${totalSubbots - subbotsOnline}`,
        ``,
        `💾 *Recursos*`,
        `├ RAM: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
        `├ CPU: ${process.cpuUsage ? 'Activo' : 'N/A'}`,
        `└ Plataforma: ${process.platform}`
      ].join('\n')

      return m.reply(msg)
    }

    case 'gruposlista':
    case 'listgroups': {
      if (!isOwner) return m.reply('❌ Solo el owner puede ver la lista de grupos')

      const grupos = Object.entries(chats)
        .filter(([jid]) => jid.endsWith('@g.us'))
        .map(([jid, config]) => ({
          jid,
          activo: !config.isBanned,
          antilink: config.antiLink,
          welcome: config.welcome
        }))
        .slice(0, 20)

      if (!grupos.length) {
        return m.reply('📋 No hay grupos registrados')
      }

      const msg = [
        `📋 *Lista de Grupos* (${grupos.length})`,
        ``,
        ...grupos.map((g, i) => {
          const status = g.activo ? '✅' : '❌'
          return `${i + 1}. ${status} ${g.jid.split('@')[0]}`
        })
      ].join('\n')

      return m.reply(msg)
    }

    default:
      return null
  }
}

handler.help = ['panelstats', 'botstatus', 'gruposlista']
handler.tags = ['owner', 'info']
handler.command = ['panelstats', 'estadisticas', 'botstatus', 'statusbot', 'gruposlista', 'listgroups']

export default handler
