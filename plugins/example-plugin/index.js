// Plugin de Ejemplo - Demuestra las capacidades del sistema de plugins

class ExamplePlugin {
  constructor() {
    this.name = 'Plugin de Ejemplo'
    this.version = '1.0.0'
    this.api = null
    this.config = {
      prefix: '/',
      maxExecutions: 100,
      cooldown: 5000
    }
    this.executionCount = 0
    this.lastExecution = new Map() // userId -> timestamp
  }

  /**
   * Inicializar plugin
   */
  async init(api) {
    this.api = api
    
    // Registrar hooks
    api.registerHook('message_received', this.onMessageReceived.bind(this))
    api.registerHook('bot_started', this.onBotStarted.bind(this))
    
    // Log de inicialización
    api.log('info', 'Plugin de ejemplo inicializado correctamente')
    
    // Cargar configuración desde storage
    const savedConfig = await api.storage.get('config')
    if (savedConfig) {
      this.config = { ...this.config, ...savedConfig }
    }
    
    console.log(`[${this.name}] Plugin inicializado`)
  }

  /**
   * Activar plugin
   */
  async activate() {
    console.log(`[${this.name}] Plugin activado`)
    
    // Notificar activación
    await this.api.notify({
      type: 'success',
      title: 'Plugin Activado',
      message: `${this.name} se ha activado correctamente`
    })
    
    // Resetear contadores
    this.executionCount = 0
    this.lastExecution.clear()
  }

  /**
   * Desactivar plugin
   */
  async deactivate() {
    console.log(`[${this.name}] Plugin desactivado`)
    
    // Guardar estadísticas
    await this.api.storage.set('stats', {
      executionCount: this.executionCount,
      lastDeactivated: new Date().toISOString()
    })
  }

  /**
   * Hook: Mensaje recibido
   */
  async onMessageReceived(message) {
    try {
      // Solo procesar mensajes que empiecen con el prefijo
      if (!message.text || !message.text.startsWith(this.config.prefix)) {
        return
      }

      const command = message.text.split(' ')[0].toLowerCase()
      
      // Comando de ejemplo
      if (command === '/ejemplo') {
        await this.handleExampleCommand(message)
      }
      
      // Comando de estadísticas
      if (command === '/stats') {
        await this.handleStatsCommand(message)
      }
      
      // Comando de configuración
      if (command === '/config') {
        await this.handleConfigCommand(message)
      }

    } catch (error) {
      console.error(`[${this.name}] Error processing message:`, error)
      this.api.log('error', 'Error procesando mensaje', { error: error.message })
    }
  }

  /**
   * Hook: Bot iniciado
   */
  async onBotStarted() {
    console.log(`[${this.name}] Bot iniciado - Plugin listo`)
    
    // Cargar estadísticas
    const stats = await this.api.storage.get('stats')
    if (stats) {
      console.log(`[${this.name}] Estadísticas cargadas:`, stats)
    }
  }

  /**
   * Manejar comando /ejemplo
   */
  async handleExampleCommand(message) {
    const userId = message.from
    const now = Date.now()
    
    // Verificar cooldown
    if (this.lastExecution.has(userId)) {
      const lastTime = this.lastExecution.get(userId)
      if (now - lastTime < this.config.cooldown) {
        const remaining = Math.ceil((this.config.cooldown - (now - lastTime)) / 1000)
        await this.api.bot.sendMessage(message.chat, {
          text: `⏰ Espera ${remaining} segundos antes de usar este comando nuevamente.`
        })
        return
      }
    }
    
    // Verificar límite de ejecuciones
    if (this.executionCount >= this.config.maxExecutions) {
      await this.api.bot.sendMessage(message.chat, {
        text: '🚫 Se ha alcanzado el límite máximo de ejecuciones para este plugin.'
      })
      return
    }
    
    // Procesar comando
    const args = message.text.split(' ').slice(1)
    const userMessage = args.join(' ') || 'Hola desde el plugin!'
    
    const response = `🔌 **Plugin de Ejemplo**\n\n` +
                    `📝 Mensaje: ${userMessage}\n` +
                    `👤 Usuario: ${userId}\n` +
                    `📊 Ejecución #${this.executionCount + 1}\n` +
                    `⏰ Hora: ${new Date().toLocaleString()}\n\n` +
                    `✨ ¡Plugin funcionando correctamente!`
    
    await this.api.bot.sendMessage(message.chat, { text: response })
    
    // Actualizar contadores
    this.executionCount++
    this.lastExecution.set(userId, now)
    
    // Log de ejecución
    this.api.log('info', 'Comando ejemplo ejecutado', {
      userId,
      executionCount: this.executionCount,
      message: userMessage
    })
  }

  /**
   * Manejar comando /stats
   */
  async handleStatsCommand(message) {
    const stats = await this.api.storage.get('stats') || {}
    const pluginInfo = this.api.getPluginInfo()
    
    const response = `📊 **Estadísticas del Plugin**\n\n` +
                    `🔌 Nombre: ${pluginInfo.name}\n` +
                    `📦 Versión: ${pluginInfo.version}\n` +
                    `🎯 Ejecuciones actuales: ${this.executionCount}\n` +
                    `📈 Ejecuciones totales: ${stats.executionCount || 0}\n` +
                    `👥 Usuarios únicos: ${this.lastExecution.size}\n` +
                    `⚙️ Límite máximo: ${this.config.maxExecutions}\n` +
                    `⏱️ Cooldown: ${this.config.cooldown / 1000}s\n` +
                    `📅 Última desactivación: ${stats.lastDeactivated || 'N/A'}`
    
    await this.api.bot.sendMessage(message.chat, { text: response })
  }

  /**
   * Manejar comando /config
   */
  async handleConfigCommand(message) {
    const args = message.text.split(' ').slice(1)
    
    if (args.length === 0) {
      // Mostrar configuración actual
      const response = `⚙️ **Configuración del Plugin**\n\n` +
                      `🔧 Prefijo: ${this.config.prefix}\n` +
                      `🎯 Máx. ejecuciones: ${this.config.maxExecutions}\n` +
                      `⏱️ Cooldown: ${this.config.cooldown / 1000}s\n\n` +
                      `💡 Uso: /config <clave> <valor>`
      
      await this.api.bot.sendMessage(message.chat, { text: response })
      return
    }
    
    if (args.length === 2) {
      const [key, value] = args
      
      // Actualizar configuración
      switch (key) {
        case 'maxExecutions':
          const maxExec = parseInt(value)
          if (maxExec > 0 && maxExec <= 1000) {
            this.config.maxExecutions = maxExec
            await this.api.storage.set('config', this.config)
            await this.api.bot.sendMessage(message.chat, {
              text: `✅ Máximo de ejecuciones actualizado a: ${maxExec}`
            })
          } else {
            await this.api.bot.sendMessage(message.chat, {
              text: '❌ Valor inválido. Debe ser entre 1 y 1000.'
            })
          }
          break
          
        case 'cooldown':
          const cooldown = parseInt(value) * 1000
          if (cooldown >= 1000 && cooldown <= 60000) {
            this.config.cooldown = cooldown
            await this.api.storage.set('config', this.config)
            await this.api.bot.sendMessage(message.chat, {
              text: `✅ Cooldown actualizado a: ${cooldown / 1000}s`
            })
          } else {
            await this.api.bot.sendMessage(message.chat, {
              text: '❌ Valor inválido. Debe ser entre 1 y 60 segundos.'
            })
          }
          break
          
        default:
          await this.api.bot.sendMessage(message.chat, {
            text: '❌ Configuración no válida. Opciones: maxExecutions, cooldown'
          })
      }
    }
  }
}

// Exportar instancia del plugin
const examplePlugin = new ExamplePlugin()

// Funciones requeridas por el sistema de plugins
module.exports = {
  init: (api) => examplePlugin.init(api),
  activate: () => examplePlugin.activate(),
  deactivate: () => examplePlugin.deactivate()
}