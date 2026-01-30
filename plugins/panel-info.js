/**
 * Plugin para mostrar información del panel web
 */

let handler = async (m, { args, usedPrefix, command, conn }) => {
  const panelUrl =
    (process.env.PANEL_URL || process.env.NEXT_PUBLIC_API_URL || '').trim() ||
    'http://localhost:3000'
  
  switch (command) {
    case 'panel':
    case 'panelweb':
    case 'dashboard': {
      const msg = [
        `🌐 *Panel Web de Administración*`,
        ``,
        `📱 *Acceso al Panel:*`,
        `${panelUrl}`,
        ``,
        `⚡ *Características:*`,
        `├ 📊 Dashboard con estadísticas`,
        `├ 👥 Gestión de usuarios`,
        `├ 💬 Administración de grupos`,
        `├ 🤖 Control de subbots`,
        `├ 📦 Gestión de aportes`,
        `├ 📋 Sistema de pedidos`,
        `├ 🔔 Notificaciones en tiempo real`,
        `├ 📈 Analytics avanzados`,
        `├ ⚙️ Configuración del sistema`,
        `├ 📝 Logs del sistema`,
        `└ 🔧 Monitoreo de recursos`,
        ``,
        `🔐 *Acceso:*`,
        `Para obtener acceso al panel, usa:`,
        `${usedPrefix}registro`,
        ``,
        `💡 *Tip:* El panel funciona mejor en`,
        `navegadores modernos como Chrome,`,
        `Firefox o Safari.`
      ].join('\n')

      return m.reply(msg)
    }

    case 'panelhelp':
    case 'ayudapanel': {
      const msg = [
        `❓ *Ayuda del Panel Web*`,
        ``,
        `🌐 *URL del Panel:*`,
        `${panelUrl}`,
        ``,
        `📋 *Comandos Relacionados:*`,
        `├ ${usedPrefix}registro - Registrarse en el panel`,
        `├ ${usedPrefix}panel - Información del panel`,
        `├ ${usedPrefix}panelstats - Estadísticas (owner)`,
        `└ ${usedPrefix}reportar - Reportar problemas`,
        ``,
        `🔧 *Funciones Principales:*`,
        ``,
        `📊 *Dashboard*`,
        `• Estadísticas en tiempo real`,
        `• Gráficos de actividad`,
        `• Estado del bot y subbots`,
        ``,
        `👥 *Gestión de Usuarios*`,
        `• Lista de usuarios registrados`,
        `• Gestión de permisos`,
        `• Usuarios premium`,
        ``,
        `💬 *Administración de Grupos*`,
        `• Lista de grupos activos`,
        `• Configuración por grupo`,
        `• Estadísticas de actividad`,
        ``,
        `🤖 *Control de SubBots*`,
        `• Crear nuevos subbots`,
        `• Ver códigos QR`,
        `• Gestionar conexiones`,
        ``,
        `📦 *Sistema de Aportes*`,
        `• Revisar aportes pendientes`,
        `• Aprobar/rechazar contenido`,
        `• Gestión de categorías`,
        ``,
        `🔔 *Notificaciones*`,
        `• Alertas del sistema`,
        `• Reportes de usuarios`,
        `• Notificaciones personalizadas`,
        ``,
        `⚙️ *Configuración*`,
        `• Ajustes del bot`,
        `• Configuración de alertas`,
        `• Gestión de logs`,
        ``,
        `❓ *¿Necesitas ayuda?*`,
        `Usa ${usedPrefix}reportar para enviar`,
        `un reporte a los administradores.`
      ].join('\n')

      return m.reply(msg)
    }

    default:
      return null
  }
}

handler.help = ['panel', 'panelhelp']
handler.tags = ['info']
handler.command = ['panel', 'panelweb', 'dashboard', 'panelhelp', 'ayudapanel']

export default handler
