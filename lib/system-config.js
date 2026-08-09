/**
 * Configuración del Sistema
 * Centraliza toda la configuración del bot y panel
 */

import fs from 'fs'
import path from 'path'

class SystemConfig {
  constructor() {
    this.config = new Map()
    this.watchers = new Map()
    this.loadDefaultConfig()
  }

  // Cargar configuración por defecto
  loadDefaultConfig() {
    // Configuración del sistema
    this.set('system', {
      name: 'OguriCap Bot',
      version: '1.8.2',
      environment: process.env.NODE_ENV || 'development',
      debug: process.env.DEBUG === 'true',
      port: parseInt(process.env.PORT) || 3001,
      panelPort: parseInt(process.env.PANEL_PORT) || 3000
    })

    // Configuración de notificaciones
    this.set('notifications', {
      enabled: true,
      types: {
        info: { enabled: true, color: 'blue' },
        success: { enabled: true, color: 'green' },
        warning: { enabled: true, color: 'yellow' },
        error: { enabled: true, color: 'red' },
        critical: { enabled: true, color: 'magenta' }
      },
      channels: {
        socket: true,
        console: true,
        file: false,
        webhook: false
      }
    })

    // Configuración de monitoreo
    this.set('monitoring', {
      enabled: true,
      interval: 5000,
      metrics: {
        system: true,
        bot: true,
        database: true,
        performance: true
      },
      alerts: {
        enabled: true,
        thresholds: {
          cpu: { warning: 70, critical: 90 },
          memory: { warning: 80, critical: 95 },
          disk: { warning: 85, critical: 95 }
        }
      }
    })

    // Configuración de reportes
    this.set('reports', {
      enabled: true,
      types: {
        daily: { enabled: true, time: '02:00' },
        weekly: { enabled: true, day: 'monday', time: '03:00' },
        monthly: { enabled: false, day: 1, time: '04:00' }
      },
      retention: {
        days: 30,
        autoCleanup: true
      }
    })

    // Configuración de seguridad
    this.set('security', {
      rateLimit: {
        enabled: true,
        window: 15 * 60 * 1000, // 15 minutos
        max: 100 // máximo 100 requests por ventana
      },
      auth: {
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 horas
        maxLoginAttempts: 5,
        lockoutTime: 30 * 60 * 1000 // 30 minutos
      },
      encryption: {
        algorithm: 'aes-256-gcm',
        keyLength: 32
      }
    })

    // Configuración del bot
    this.set('bot', {
      prefix: process.env.BOT_PREFIX || '.',
      owner: process.env.BOT_OWNER || '',
      autoRead: true,
      autoTyping: false,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowedFileTypes: ['image', 'video', 'audio', 'document'],
      commandCooldown: 3000 // 3 segundos
    })

    // Configuración de la base de datos
    this.set('database', {
      type: 'json',
      file: 'database.json',
      backup: {
        enabled: true,
        interval: 6 * 60 * 60 * 1000, // cada 6 horas
        retention: 7 // mantener 7 backups
      },
      compression: false
    })

    console.log('⚙️ Configuración por defecto cargada')
  }

  // Obtener valor de configuración
  get(key, defaultValue = null) {
    const keys = key.split('.')
    let value = this.config

    for (const k of keys) {
      if (value instanceof Map) {
        value = value.get(k)
      } else if (typeof value === 'object' && value !== null) {
        value = value[k]
      } else {
        return defaultValue
      }

      if (value === undefined) {
        return defaultValue
      }
    }

    return value
  }

  // Establecer valor de configuración
  set(key, value) {
    const keys = key.split('.')
    const lastKey = keys.pop()
    let current = this.config

    for (const k of keys) {
      if (!current.has(k)) {
        current.set(k, new Map())
      }
      current = current.get(k)
    }

    current.set(lastKey, value)
    this.notifyWatchers(key, value)
  }

  // Actualizar configuración parcialmente
  update(key, updates) {
    const current = this.get(key)
    if (typeof current === 'object' && current !== null) {
      const merged = { ...current, ...updates }
      this.set(key, merged)
    } else {
      this.set(key, updates)
    }
  }

  // Observar cambios en configuración
  watch(key, callback) {
    if (!this.watchers.has(key)) {
      this.watchers.set(key, new Set())
    }
    this.watchers.get(key).add(callback)

    // Retornar función para cancelar el watch
    return () => {
      const watchers = this.watchers.get(key)
      if (watchers) {
        watchers.delete(callback)
        if (watchers.size === 0) {
          this.watchers.delete(key)
        }
      }
    }
  }

  // Notificar a los observadores
  notifyWatchers(key, value) {
    const watchers = this.watchers.get(key)
    if (watchers) {
      watchers.forEach(callback => {
        try {
          callback(value, key)
        } catch (error) {
          console.error(`Error en watcher para ${key}:`, error)
        }
      })
    }
  }

  // Cargar configuración desde archivo
  loadFromFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        this.mergeConfig(data)
        console.log(`⚙️ Configuración cargada desde ${filePath}`)
      }
    } catch (error) {
      console.error(`Error cargando configuración desde ${filePath}:`, error)
    }
  }

  // Guardar configuración a archivo
  saveToFile(filePath) {
    try {
      const data = this.toJSON()
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
      console.log(`⚙️ Configuración guardada en ${filePath}`)
    } catch (error) {
      console.error(`Error guardando configuración en ${filePath}:`, error)
    }
  }

  // Fusionar configuración
  mergeConfig(data) {
    const merge = (target, source) => {
      for (const [key, value] of Object.entries(source)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          if (!target.has(key)) {
            target.set(key, new Map())
          }
          merge(target.get(key), value)
        } else {
          target.set(key, value)
        }
      }
    }

    merge(this.config, data)
  }

  // Convertir a JSON
  toJSON() {
    const mapToObject = (map) => {
      const obj = {}
      for (const [key, value] of map) {
        if (value instanceof Map) {
          obj[key] = mapToObject(value)
        } else {
          obj[key] = value
        }
      }
      return obj
    }

    return mapToObject(this.config)
  }

  // Validar configuración
  validate() {
    const errors = []

    // Validar configuración del sistema
    const system = this.get('system')
    if (!system.name) errors.push('system.name es requerido')
    if (!system.version) errors.push('system.version es requerido')
    if (isNaN(system.port)) errors.push('system.port debe ser un número')

    // Validar configuración del bot
    const bot = this.get('bot')
    if (!bot.prefix) errors.push('bot.prefix es requerido')

    // Validar configuración de monitoreo
    const monitoring = this.get('monitoring')
    if (monitoring.enabled && isNaN(monitoring.interval)) {
      errors.push('monitoring.interval debe ser un número')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  // Obtener configuración para un componente específico
  getComponentConfig(component) {
    return this.get(component, {})
  }

  // Restablecer configuración por defecto
  reset() {
    this.config.clear()
    this.loadDefaultConfig()
    console.log('⚙️ Configuración restablecida a valores por defecto')
  }

  // Obtener estadísticas de configuración
  getStats() {
    const countKeys = (map, prefix = '') => {
      let count = 0
      for (const [key, value] of map) {
        count++
        if (value instanceof Map) {
          count += countKeys(value, `${prefix}${key}.`)
        }
      }
      return count
    }

    return {
      totalKeys: countKeys(this.config),
      watchers: this.watchers.size,
      components: Array.from(this.config.keys())
    }
  }
}

// Instancia singleton
const systemConfig = new SystemConfig()

// Cargar configuración personalizada si existe
const configFile = path.join(process.cwd(), 'config.json')
systemConfig.loadFromFile(configFile)

export default systemConfig