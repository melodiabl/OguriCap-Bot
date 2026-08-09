import { readFileSync, writeFileSync } from 'fs'

let handler = async (m, { conn, args, usedPrefix, command, isOwner }) => {
  if (!isOwner) return m.reply('❌ Solo el propietario puede usar este comando')
  
  const subCommand = args[0]?.toLowerCase()
  
  if (!subCommand) {
    const config = global.db?.data?.panel?.whatsapp?.subbots || {}
    const status = config.useFixedCodes ? '🔒 Activado' : '🎲 Desactivado'
    
    return m.reply(`
🤖 *CONFIGURACIÓN DE SUBBOTS*

📊 *Estado actual:*
• Códigos fijos: ${status}
• Prefijo: ${config.codePrefix || 'SUB-'}
• Longitud: ${config.codeLength || 8}
• Códigos personalizados: ${config.allowCustomCodes ? '✅' : '❌'}

📝 *Comandos disponibles:*
• \`${usedPrefix + command} on\` - Activar códigos fijos
• \`${usedPrefix + command} off\` - Desactivar códigos fijos
• \`${usedPrefix + command} prefix <texto>\` - Cambiar prefijo
• \`${usedPrefix + command} length <número>\` - Cambiar longitud
• \`${usedPrefix + command} status\` - Ver estado actual

💡 *Ejemplo de código generado:*
${config.codePrefix || 'SUB-'}1234 (basado en el número del usuario)
    `.trim())
  }
  
  try {
    // Asegurar que existe la estructura
    if (!global.db.data.panel) global.db.data.panel = {}
    if (!global.db.data.panel.whatsapp) global.db.data.panel.whatsapp = {}
    if (!global.db.data.panel.whatsapp.subbots) {
      global.db.data.panel.whatsapp.subbots = {
        useFixedCodes: false,
        codePrefix: 'SUB-',
        codeLength: 8,
        allowCustomCodes: true
      }
    }
    
    const config = global.db.data.panel.whatsapp.subbots
    
    switch (subCommand) {
      case 'on':
      case 'activar':
        config.useFixedCodes = true
        await m.reply('✅ Códigos fijos para subbots activados')
        break
        
      case 'off':
      case 'desactivar':
        config.useFixedCodes = false
        await m.reply('❌ Códigos fijos para subbots desactivados (usarán códigos aleatorios)')
        break
        
      case 'prefix':
      case 'prefijo':
        const newPrefix = args[1]
        if (!newPrefix) return m.reply('❌ Especifica un prefijo. Ejemplo: `' + usedPrefix + command + ' prefix BOT-`')
        config.codePrefix = newPrefix.toUpperCase()
        await m.reply(`✅ Prefijo cambiado a: ${config.codePrefix}`)
        break
        
      case 'length':
      case 'longitud':
        const newLength = parseInt(args[1])
        if (!newLength || newLength < 4 || newLength > 12) {
          return m.reply('❌ La longitud debe ser un número entre 4 y 12')
        }
        config.codeLength = newLength
        await m.reply(`✅ Longitud cambiada a: ${config.codeLength} caracteres`)
        break
        
      case 'status':
      case 'estado':
        const statusText = config.useFixedCodes ? '🔒 Activado' : '🎲 Desactivado'
        await m.reply(`
📊 *ESTADO ACTUAL:*
• Códigos fijos: ${statusText}
• Prefijo: ${config.codePrefix}
• Longitud: ${config.codeLength}
• Códigos personalizados: ${config.allowCustomCodes ? '✅' : '❌'}

💡 *Próximo código ejemplo:*
${config.codePrefix}1234
        `.trim())
        break
        
      case 'test':
      case 'prueba':
        const testCode = generateTestCode(config)
        await m.reply(`🧪 *Código de prueba generado:*\n\`${testCode}\`\n\n💡 Este sería el formato para un nuevo subbot`)
        break
        
      default:
        await m.reply(`❌ Subcomando no reconocido: ${subCommand}\n\nUsa \`${usedPrefix + command}\` para ver la ayuda`)
    }
    
    // Guardar cambios en la base de datos
    await global.db.write()
    
  } catch (error) {
    console.error('Error en subbot-config:', error)
    await m.reply('❌ Error al procesar el comando: ' + error.message)
  }
}

function generateTestCode(config) {
  const prefix = config.codePrefix || 'SUB-'
  const length = config.codeLength || 8
  
  // Generar código de prueba
  let baseCode = '1234'
  while (baseCode.length < (length - prefix.length)) {
    baseCode += String(Math.floor(Math.random() * 10))
  }
  
  return (prefix + baseCode).slice(0, length)
}

handler.help = ['subbotconfig', 'sbconfig']
handler.tags = ['owner']
handler.command = /^(subbotconfig|sbconfig)$/i
handler.owner = true

export default handler