// Sistema de Plugins Avanzado con Hot-Reload y Marketplace

import fs from 'fs'
import path from 'path'
import { Worker } from 'worker_threads'
import { EventEmitter } from 'events'
import crypto from 'crypto'
import auditLogger, { AUDIT_EVENTS } from './audit-logger.js'
import notificationSystem, { NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES } from './notification-system.js'

// Estados de plugins
export const PLUGIN_STATES = {
  INACTIVE: 'inactive',
  LOADING: 'loading',
  ACTIVE: 'active',
  ERROR: 'error',
  DISABLED: 'disabled',
  UPDATING: 'updating'
}

// Tipos de plugins
export const PLUGIN_TYPES = {
  COMMAND: 'command',
  MIDDLEWARE: 'middleware',
  SCHEDULER: 'scheduler',
  WEBHOOK: 'webhook',
  UI_COMPONENT: 'ui_component',
  API_EXTENSION: 'api_extension',
  INTEGRATION: 'integration',
  UTILITY: 'utility'
}

// Permisos de plugins
export const PLUGIN_PERMISSIONS = {
  READ_MESSAGES: 'read_messages',
  SEND_MESSAGES: 'send_messages',
  ACCESS_DATABASE: 'access_database',
  MODIFY_SETTINGS: 'modify_settings',
  NETWORK_ACCESS: 'network_access',
  FILE_SYSTEM: 'file_system',
  EXECUTE_COMMANDS: 'execute_commands',
  ACCESS_LOGS: 'access_logs'
}

class PluginSystem extends EventEmitter {
  constructor() {
    super()
    this.plugins = new Map() // ID -> Plugin
    this.activePlugins = new Set()
    this.pluginWorkers = new Map() // ID -> Worker
    this.pluginWatchers = new Map() // ID -> FSWatcher
    this.marketplace = new Map() // ID -> MarketplacePlugin
    this.pluginHooks = new Map() // Hook -> [Plugin IDs]
    this.sandboxes = new Map() // ID -> Sandbox
    
    this.pluginsDir = path.join(process.cwd(), 'plugins')
    this.marketplaceDir = path.join(process.cwd(), 'marketplace')
    
    this.initializeDirectories()
    this.loadInstalledPlugins()
    this.startMarketplaceSync()
  }

  /**
   * Inicializar directorios necesarios
   */
  initializeDirectories() {
    const dirs = [this.pluginsDir, this.marketplaceDir, path.join(this.pluginsDir, 'disabled')]
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    })
  }

  /**
   * Cargar plugins instalados
   */
  async loadInstalledPlugins() {
    try {
      const pluginDirs = fs.readdirSync(this.pluginsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory() && dirent.name !== 'disabled')
        .map(dirent => dirent.name)

      for (const pluginId of pluginDirs) {
        await this.loadPlugin(pluginId)
      }

      console.log(`[Plugin System] Loaded ${this.plugins.size} plugins`)
    } catch (error) {
      console.error('[Plugin System] Error loading plugins:', error)
    }
  }

  /**
   * Cargar un plugin específico
   */
  async loadPlugin(pluginId) {
    try {
      const pluginPath = path.join(this.pluginsDir, pluginId)
      const manifestPath = path.join(pluginPath, 'plugin.json')
      
      if (!fs.existsSync(manifestPath)) {
        throw new Error(`Plugin manifest not found: ${manifestPath}`)
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      
      // Validar manifest
      this.validatePluginManifest(manifest)
      
      const plugin = {
        id: pluginId,
        ...manifest,
        path: pluginPath,
        state: PLUGIN_STATES.LOADING,
        loadedAt: new Date().toISOString(),
        error: null,
        metrics: {
          loadTime: 0,
          executionCount: 0,
          errorCount: 0,
          lastExecution: null
        }
      }

      this.plugins.set(pluginId, plugin)

      // Crear sandbox para el plugin
      await this.createPluginSandbox(plugin)

      // Cargar el código del plugin
      await this.loadPluginCode(plugin)

      // Configurar hot-reload
      this.setupHotReload(plugin)

      // Activar plugin si está habilitado
      if (plugin.enabled !== false) {
        await this.activatePlugin(pluginId)
      }

      // Log de auditoría
      await auditLogger.log(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, {
        level: 'info',
        details: {
          action: 'plugin_loaded',
          pluginId,
          pluginName: plugin.name,
          version: plugin.version
        }
      })

      return plugin
    } catch (error) {
      console.error(`[Plugin System] Error loading plugin ${pluginId}:`, error)
      
      if (this.plugins.has(pluginId)) {
        const plugin = this.plugins.get(pluginId)
        plugin.state = PLUGIN_STATES.ERROR
        plugin.error = error.message
      }

      throw error
    }
  }

  /**
   * Validar manifest del plugin
   */
  validatePluginManifest(manifest) {
    const required = ['name', 'version', 'description', 'main', 'type']
    
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Missing required field in plugin manifest: ${field}`)
      }
    }

    if (!Object.values(PLUGIN_TYPES).includes(manifest.type)) {
      throw new Error(`Invalid plugin type: ${manifest.type}`)
    }

    if (manifest.permissions) {
      for (const permission of manifest.permissions) {
        if (!Object.values(PLUGIN_PERMISSIONS).includes(permission)) {
          throw new Error(`Invalid plugin permission: ${permission}`)
        }
      }
    }
  }

  /**
   * Crear sandbox para plugin
   */
  async createPluginSandbox(plugin) {
    const sandbox = {
      id: plugin.id,
      permissions: plugin.permissions || [],
      api: this.createPluginAPI(plugin),
      globals: {
        console: {
          log: (...args) => console.log(`[Plugin:${plugin.id}]`, ...args),
          error: (...args) => console.error(`[Plugin:${plugin.id}]`, ...args),
          warn: (...args) => console.warn(`[Plugin:${plugin.id}]`, ...args)
        },
        setTimeout,
        setInterval,
        clearTimeout,
        clearInterval,
        Buffer,
        process: {
          env: { ...process.env },
          version: process.version,
          platform: process.platform
        }
      }
    }

    this.sandboxes.set(plugin.id, sandbox)
    return sandbox
  }

  /**
   * Crear API para plugin
   */
  createPluginAPI(plugin) {
    const api = {
      // API básica
      getPluginInfo: () => ({
        id: plugin.id,
        name: plugin.name,
        version: plugin.version
      }),

      // Logging
      log: (level, message, data = {}) => {
        auditLogger.log(`PLUGIN_${level.toUpperCase()}`, {
          level,
          details: {
            pluginId: plugin.id,
            message,
            ...data
          }
        })
      },

      // Notificaciones
      notify: async (notification) => {
        if (!this.hasPermission(plugin, PLUGIN_PERMISSIONS.SEND_MESSAGES)) {
          throw new Error('Plugin does not have permission to send notifications')
        }

        return await notificationSystem.send({
          ...notification,
          category: NOTIFICATION_CATEGORIES.SYSTEM,
          metadata: {
            source: 'plugin',
            pluginId: plugin.id
          }
        })
      },

      // Hooks
      registerHook: (hookName, callback) => {
        if (!this.pluginHooks.has(hookName)) {
          this.pluginHooks.set(hookName, [])
        }
        this.pluginHooks.get(hookName).push({
          pluginId: plugin.id,
          callback
        })
      },

      // Storage del plugin
      storage: {
        get: (key) => this.getPluginStorage(plugin.id, key),
        set: (key, value) => this.setPluginStorage(plugin.id, key, value),
        delete: (key) => this.deletePluginStorage(plugin.id, key),
        clear: () => this.clearPluginStorage(plugin.id)
      }
    }

    // APIs condicionales basadas en permisos
    if (this.hasPermission(plugin, PLUGIN_PERMISSIONS.ACCESS_DATABASE)) {
      api.database = {
        get: () => global.db?.data,
        save: () => global.db?.write?.()
      }
    }

    if (this.hasPermission(plugin, PLUGIN_PERMISSIONS.SEND_MESSAGES)) {
      api.bot = {
        sendMessage: async (jid, message) => {
          if (global.conn && typeof global.conn.sendMessage === 'function') {
            return await global.conn.sendMessage(jid, message)
          }
          throw new Error('Bot not connected')
        }
      }
    }

    if (this.hasPermission(plugin, PLUGIN_PERMISSIONS.NETWORK_ACCESS)) {
      api.http = {
        fetch: (...args) => fetch(...args),
        axios: null // Se cargará dinámicamente si está disponible
      }
    }

    return api
  }

  /**
   * Verificar permisos del plugin
   */
  hasPermission(plugin, permission) {
    return plugin.permissions && plugin.permissions.includes(permission)
  }

  /**
   * Cargar código del plugin
   */
  async loadPluginCode(plugin) {
    const startTime = Date.now()
    
    try {
      const mainFile = path.join(plugin.path, plugin.main)
      
      if (!fs.existsSync(mainFile)) {
        throw new Error(`Plugin main file not found: ${mainFile}`)
      }

      // Crear worker para ejecutar el plugin de forma aislada
      const worker = new Worker(`
        const { parentPort } = require('worker_threads');
        const fs = require('fs');
        const path = require('path');
        
        parentPort.on('message', async ({ action, data }) => {
          try {
            if (action === 'load') {
              const pluginCode = fs.readFileSync(data.mainFile, 'utf8');
              const pluginModule = eval(pluginCode);
              
              if (typeof pluginModule.init === 'function') {
                await pluginModule.init(data.api);
              }
              
              parentPort.postMessage({ success: true, action: 'loaded' });
            } else if (action === 'execute') {
              // Ejecutar función del plugin
              const result = await pluginModule[data.method](...data.args);
              parentPort.postMessage({ success: true, result });
            }
          } catch (error) {
            parentPort.postMessage({ success: false, error: error.message });
          }
        });
      `, { eval: true })

      this.pluginWorkers.set(plugin.id, worker)

      // Cargar plugin en el worker
      await new Promise((resolve, reject) => {
        worker.once('message', ({ success, error }) => {
          if (success) {
            resolve()
          } else {
            reject(new Error(error))
          }
        })

        worker.postMessage({
          action: 'load',
          data: {
            mainFile,
            api: this.sandboxes.get(plugin.id).api
          }
        })
      })

      plugin.metrics.loadTime = Date.now() - startTime
      plugin.state = PLUGIN_STATES.INACTIVE

    } catch (error) {
      plugin.state = PLUGIN_STATES.ERROR
      plugin.error = error.message
      throw error
    }
  }

  /**
   * Activar plugin
   */
  async activatePlugin(pluginId) {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`)
    }

    if (plugin.state === PLUGIN_STATES.ACTIVE) {
      return plugin
    }

    try {
      plugin.state = PLUGIN_STATES.LOADING

      // Ejecutar hook de activación si existe
      const worker = this.pluginWorkers.get(pluginId)
      if (worker) {
        await new Promise((resolve, reject) => {
          worker.once('message', ({ success, error }) => {
            if (success) {
              resolve()
            } else {
              reject(new Error(error))
            }
          })

          worker.postMessage({
            action: 'execute',
            data: {
              method: 'activate',
              args: []
            }
          })
        })
      }

      plugin.state = PLUGIN_STATES.ACTIVE
      this.activePlugins.add(pluginId)

      // Emitir evento
      this.emit('pluginActivated', plugin)

      // Notificación
      await notificationSystem.send({
        type: NOTIFICATION_TYPES.SUCCESS,
        title: 'Plugin Activado',
        message: `El plugin "${plugin.name}" se ha activado correctamente`,
        category: NOTIFICATION_CATEGORIES.SYSTEM
      })

      console.log(`[Plugin System] Activated plugin: ${plugin.name} v${plugin.version}`)
      return plugin

    } catch (error) {
      plugin.state = PLUGIN_STATES.ERROR
      plugin.error = error.message
      throw error
    }
  }

  /**
   * Desactivar plugin
   */
  async deactivatePlugin(pluginId) {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`)
    }

    try {
      // Ejecutar hook de desactivación si existe
      const worker = this.pluginWorkers.get(pluginId)
      if (worker) {
        try {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout')), 5000)
            
            worker.once('message', ({ success, error }) => {
              clearTimeout(timeout)
              if (success) {
                resolve()
              } else {
                reject(new Error(error))
              }
            })

            worker.postMessage({
              action: 'execute',
              data: {
                method: 'deactivate',
                args: []
              }
            })
          })
        } catch (error) {
          console.warn(`[Plugin System] Error deactivating plugin ${pluginId}:`, error.message)
        }

        // Terminar worker
        await worker.terminate()
        this.pluginWorkers.delete(pluginId)
      }

      plugin.state = PLUGIN_STATES.INACTIVE
      this.activePlugins.delete(pluginId)

      // Limpiar hooks del plugin
      for (const [hookName, hooks] of this.pluginHooks) {
        const filtered = hooks.filter(h => h.pluginId !== pluginId)
        if (filtered.length === 0) {
          this.pluginHooks.delete(hookName)
        } else {
          this.pluginHooks.set(hookName, filtered)
        }
      }

      // Emitir evento
      this.emit('pluginDeactivated', plugin)

      console.log(`[Plugin System] Deactivated plugin: ${plugin.name}`)
      return plugin

    } catch (error) {
      plugin.state = PLUGIN_STATES.ERROR
      plugin.error = error.message
      throw error
    }
  }

  /**
   * Configurar hot-reload para plugin
   */
  setupHotReload(plugin) {
    if (this.pluginWatchers.has(plugin.id)) {
      this.pluginWatchers.get(plugin.id).close()
    }

    const watcher = fs.watch(plugin.path, { recursive: true }, async (eventType, filename) => {
      if (filename && (filename.endsWith('.js') || filename.endsWith('.json'))) {
        console.log(`[Plugin System] File changed in plugin ${plugin.id}: ${filename}`)
        
        try {
          // Recargar plugin
          await this.reloadPlugin(plugin.id)
        } catch (error) {
          console.error(`[Plugin System] Error reloading plugin ${plugin.id}:`, error)
        }
      }
    })

    this.pluginWatchers.set(plugin.id, watcher)
  }

  /**
   * Recargar plugin
   */
  async reloadPlugin(pluginId) {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`)
    }

    const wasActive = plugin.state === PLUGIN_STATES.ACTIVE

    try {
      plugin.state = PLUGIN_STATES.UPDATING

      // Desactivar si estaba activo
      if (wasActive) {
        await this.deactivatePlugin(pluginId)
      }

      // Recargar
      await this.loadPlugin(pluginId)

      // Reactivar si estaba activo
      if (wasActive) {
        await this.activatePlugin(pluginId)
      }

      // Notificación
      await notificationSystem.send({
        type: NOTIFICATION_TYPES.INFO,
        title: 'Plugin Recargado',
        message: `El plugin "${plugin.name}" se ha recargado correctamente`,
        category: NOTIFICATION_CATEGORIES.SYSTEM
      })

    } catch (error) {
      plugin.state = PLUGIN_STATES.ERROR
      plugin.error = error.message
      throw error
    }
  }

  /**
   * Instalar plugin desde marketplace
   */
  async installPlugin(pluginId, source = 'marketplace') {
    try {
      let pluginData

      if (source === 'marketplace') {
        pluginData = this.marketplace.get(pluginId)
        if (!pluginData) {
          throw new Error(`Plugin not found in marketplace: ${pluginId}`)
        }
      } else if (source === 'url') {
        // Descargar desde URL
        pluginData = await this.downloadPluginFromUrl(pluginId)
      } else if (source === 'file') {
        // Instalar desde archivo local
        pluginData = await this.installPluginFromFile(pluginId)
      }

      // Crear directorio del plugin
      const pluginPath = path.join(this.pluginsDir, pluginData.id)
      if (fs.existsSync(pluginPath)) {
        throw new Error(`Plugin already installed: ${pluginData.id}`)
      }

      fs.mkdirSync(pluginPath, { recursive: true })

      // Extraer archivos del plugin
      await this.extractPluginFiles(pluginData, pluginPath)

      // Cargar plugin
      await this.loadPlugin(pluginData.id)

      // Log de auditoría
      await auditLogger.log(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, {
        level: 'info',
        details: {
          action: 'plugin_installed',
          pluginId: pluginData.id,
          source,
          version: pluginData.version
        }
      })

      return this.plugins.get(pluginData.id)

    } catch (error) {
      console.error(`[Plugin System] Error installing plugin:`, error)
      throw error
    }
  }

  /**
   * Desinstalar plugin
   */
  async uninstallPlugin(pluginId) {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`)
    }

    try {
      // Desactivar si está activo
      if (plugin.state === PLUGIN_STATES.ACTIVE) {
        await this.deactivatePlugin(pluginId)
      }

      // Cerrar watcher
      if (this.pluginWatchers.has(pluginId)) {
        this.pluginWatchers.get(pluginId).close()
        this.pluginWatchers.delete(pluginId)
      }

      // Limpiar sandbox
      this.sandboxes.delete(pluginId)

      // Eliminar archivos
      const pluginPath = path.join(this.pluginsDir, pluginId)
      if (fs.existsSync(pluginPath)) {
        fs.rmSync(pluginPath, { recursive: true, force: true })
      }

      // Limpiar storage del plugin
      this.clearPluginStorage(pluginId)

      // Remover de memoria
      this.plugins.delete(pluginId)

      // Log de auditoría
      await auditLogger.log(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, {
        level: 'info',
        details: {
          action: 'plugin_uninstalled',
          pluginId,
          pluginName: plugin.name
        }
      })

      console.log(`[Plugin System] Uninstalled plugin: ${plugin.name}`)

    } catch (error) {
      console.error(`[Plugin System] Error uninstalling plugin:`, error)
      throw error
    }
  }

  /**
   * Ejecutar hook
   */
  async executeHook(hookName, ...args) {
    const hooks = this.pluginHooks.get(hookName) || []
    const results = []

    for (const hook of hooks) {
      try {
        const plugin = this.plugins.get(hook.pluginId)
        if (plugin && plugin.state === PLUGIN_STATES.ACTIVE) {
          const result = await hook.callback(...args)
          results.push({ pluginId: hook.pluginId, result })
          
          plugin.metrics.executionCount++
          plugin.metrics.lastExecution = new Date().toISOString()
        }
      } catch (error) {
        console.error(`[Plugin System] Error executing hook ${hookName} for plugin ${hook.pluginId}:`, error)
        
        const plugin = this.plugins.get(hook.pluginId)
        if (plugin) {
          plugin.metrics.errorCount++
        }
      }
    }

    return results
  }

  /**
   * Storage del plugin
   */
  getPluginStorage(pluginId, key) {
    if (typeof global.loadDatabase === 'function') global.loadDatabase()
    const storage = global.db?.data?.pluginStorage?.[pluginId] || {}
    return key ? storage[key] : storage
  }

  setPluginStorage(pluginId, key, value) {
    if (typeof global.loadDatabase === 'function') global.loadDatabase()
    if (!global.db?.data) return
    
    global.db.data.pluginStorage ||= {}
    global.db.data.pluginStorage[pluginId] ||= {}
    global.db.data.pluginStorage[pluginId][key] = value
    
    if (typeof global.db.write === 'function') global.db.write()
  }

  deletePluginStorage(pluginId, key) {
    if (typeof global.loadDatabase === 'function') global.loadDatabase()
    if (!global.db?.data?.pluginStorage?.[pluginId]) return
    
    delete global.db.data.pluginStorage[pluginId][key]
    if (typeof global.db.write === 'function') global.db.write()
  }

  clearPluginStorage(pluginId) {
    if (typeof global.loadDatabase === 'function') global.loadDatabase()
    if (!global.db?.data?.pluginStorage) return
    
    delete global.db.data.pluginStorage[pluginId]
    if (typeof global.db.write === 'function') global.db.write()
  }

  /**
   * Sincronizar marketplace
   */
  async startMarketplaceSync() {
    // Sincronizar cada hora
    setInterval(async () => {
      try {
        await this.syncMarketplace()
      } catch (error) {
        console.error('[Plugin System] Error syncing marketplace:', error)
      }
    }, 60 * 60 * 1000)

    // Sincronización inicial
    await this.syncMarketplace()
  }

  async syncMarketplace() {
    try {
      // En un sistema real, esto haría fetch a un marketplace remoto
      const marketplaceUrl = process.env.PLUGIN_MARKETPLACE_URL || 'https://api.whatsappbot.com/plugins'
      
      // Por ahora, cargar plugins locales del directorio marketplace
      const marketplaceFiles = fs.readdirSync(this.marketplaceDir)
        .filter(file => file.endsWith('.json'))

      for (const file of marketplaceFiles) {
        const pluginData = JSON.parse(fs.readFileSync(path.join(this.marketplaceDir, file), 'utf8'))
        this.marketplace.set(pluginData.id, pluginData)
      }

      console.log(`[Plugin System] Synced ${this.marketplace.size} plugins from marketplace`)
    } catch (error) {
      console.error('[Plugin System] Error syncing marketplace:', error)
    }
  }

  /**
   * Obtener información de todos los plugins
   */
  getAllPlugins() {
    return Array.from(this.plugins.values()).map(plugin => ({
      ...plugin,
      isActive: this.activePlugins.has(plugin.id)
    }))
  }

  /**
   * Obtener plugins activos
   */
  getActivePlugins() {
    return Array.from(this.activePlugins).map(id => this.plugins.get(id))
  }

  /**
   * Obtener marketplace
   */
  getMarketplace() {
    return Array.from(this.marketplace.values())
  }

  /**
   * Obtener estadísticas del sistema de plugins
   */
  getStats() {
    const plugins = this.getAllPlugins()
    
    return {
      total: plugins.length,
      active: this.activePlugins.size,
      inactive: plugins.filter(p => p.state === PLUGIN_STATES.INACTIVE).length,
      error: plugins.filter(p => p.state === PLUGIN_STATES.ERROR).length,
      byType: plugins.reduce((acc, plugin) => {
        acc[plugin.type] = (acc[plugin.type] || 0) + 1
        return acc
      }, {}),
      totalExecutions: plugins.reduce((sum, p) => sum + p.metrics.executionCount, 0),
      totalErrors: plugins.reduce((sum, p) => sum + p.metrics.errorCount, 0),
      marketplace: this.marketplace.size
    }
  }

  /**
   * Limpiar recursos
   */
  async cleanup() {
    // Desactivar todos los plugins
    for (const pluginId of this.activePlugins) {
      try {
        await this.deactivatePlugin(pluginId)
      } catch (error) {
        console.error(`Error deactivating plugin ${pluginId}:`, error)
      }
    }

    // Cerrar watchers
    for (const watcher of this.pluginWatchers.values()) {
      watcher.close()
    }

    console.log('[Plugin System] Cleanup completed')
  }
}

// Instancia singleton
const pluginSystem = new PluginSystem()

// Limpiar al cerrar la aplicación
process.on('SIGINT', async () => {
  await pluginSystem.cleanup()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await pluginSystem.cleanup()
  process.exit(0)
})

export default pluginSystem