/**
 * Inicializador del Sistema
 * Asegura que todos los componentes estén correctamente inicializados
 */

import fs from 'fs'
import path from 'path'

class SystemInitializer {
  constructor() {
    this.initialized = false
    this.components = new Map()
    this.errors = []
  }

  // Registrar componente para inicialización
  registerComponent(name, initFunction, options = {}) {
    this.components.set(name, {
      name,
      init: initFunction,
      required: options.required !== false,
      timeout: options.timeout || 10000,
      dependencies: options.dependencies || []
    })
  }

  // Inicializar todos los componentes
  async initialize() {
    if (this.initialized) {
      console.log('⚠️ Sistema ya inicializado')
      return true
    }

    console.log('🚀 Iniciando sistema...')
    
    try {
      // Verificar directorios necesarios
      await this.ensureDirectories()
      
      // Inicializar componentes en orden de dependencias
      const initOrder = this.resolveDependencies()
      
      for (const componentName of initOrder) {
        const component = this.components.get(componentName)
        if (!component) continue

        try {
          console.log(`📦 Inicializando ${componentName}...`)
          
          const result = await Promise.race([
            component.init(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), component.timeout)
            )
          ])

          if (result === false && component.required) {
            throw new Error(`Componente requerido ${componentName} falló al inicializar`)
          }

          console.log(`✅ ${componentName} inicializado`)
          
        } catch (error) {
          const errorMsg = `Error inicializando ${componentName}: ${error.message}`
          console.error(`❌ ${errorMsg}`)
          this.errors.push(errorMsg)
          
          if (component.required) {
            throw new Error(`Componente crítico ${componentName} falló: ${error.message}`)
          }
        }
      }

      this.initialized = true
      console.log('🎉 Sistema inicializado correctamente')
      
      if (this.errors.length > 0) {
        console.warn(`⚠️ Se encontraron ${this.errors.length} errores no críticos:`)
        this.errors.forEach(error => console.warn(`  - ${error}`))
      }

      return true

    } catch (error) {
      console.error('💥 Error crítico durante la inicialización:', error.message)
      return false
    }
  }

  // Resolver orden de dependencias
  resolveDependencies() {
    const resolved = []
    const resolving = new Set()
    
    const resolve = (name) => {
      if (resolved.includes(name)) return
      if (resolving.has(name)) {
        throw new Error(`Dependencia circular detectada: ${name}`)
      }
      
      resolving.add(name)
      const component = this.components.get(name)
      
      if (component) {
        component.dependencies.forEach(dep => resolve(dep))
        resolved.push(name)
      }
      
      resolving.delete(name)
    }

    for (const name of this.components.keys()) {
      resolve(name)
    }

    return resolved
  }

  // Asegurar que existan los directorios necesarios
  async ensureDirectories() {
    const directories = [
      'Sessions',
      'storage',
      'storage/media',
      'logs',
      'tmp',
      '.monitoring',
      '.monitoring/reports',
      '.monitoring/logs',
      '.monitoring/alerts'
    ]

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
        console.log(`📁 Directorio creado: ${dir}`)
      }
    }
  }

  // Inicializar componentes por defecto
  initializeDefaultComponents() {
    // Base de datos
    this.registerComponent('database', async () => {
      if (typeof global.loadDatabase === 'function') {
        await global.loadDatabase()
        console.log('💾 Base de datos cargada')
        return true
      }
      return false
    }, { required: true })

    // Sistema de datos en tiempo real
    this.registerComponent('real-time-data', async () => {
      try {
        const { default: realTimeData } = await import('./real-time-data.js')
        if (!realTimeData.isRunning) {
          realTimeData.start()
        }
        return true
      } catch (error) {
        console.error('Error cargando sistema de datos en tiempo real:', error)
        return false
      }
    }, { dependencies: ['database'] })

    // Sistema de notificaciones
    this.registerComponent('notification-system', async () => {
      try {
        const { default: notificationSystem } = await import('./notification-system.js')
        if (!notificationSystem.isRunning) {
          notificationSystem.start()
        }
        return true
      } catch (error) {
        console.error('Error cargando sistema de notificaciones:', error)
        return false
      }
    })

    // Sistema de reportes
    this.registerComponent('reporting-system', async () => {
      try {
        const { default: reportingSystem } = await import('./reporting-system.js')
        if (!reportingSystem.isRunning) {
          reportingSystem.start()
        }
        return true
      } catch (error) {
        console.error('Error cargando sistema de reportes:', error)
        return false
      }
    }, { dependencies: ['notification-system'] })

    // Sistema de alertas
    this.registerComponent('alert-system', async () => {
      try {
        const { default: alertSystem } = await import('./alert-system.js')
        if (!alertSystem.isRunning) {
          alertSystem.start()
        }
        return true
      } catch (error) {
        console.error('Error cargando sistema de alertas:', error)
        return false
      }
    }, { dependencies: ['notification-system'] })

    // Socket.IO
    this.registerComponent('socket-io', async () => {
      try {
        const { initializeSocketIO } = await import('./socket-io.js')
        // Socket.IO se inicializa cuando se crea el servidor HTTP
        return true
      } catch (error) {
        console.error('Error verificando Socket.IO:', error)
        return false
      }
    })

    // Sistema de verificación de salud
    this.registerComponent('health-check', async () => {
      try {
        const { default: systemHealthCheck } = await import('./system-health-check.js')
        if (!systemHealthCheck.isRunning) {
          systemHealthCheck.start()
        }
        return true
      } catch (error) {
        console.error('Error cargando sistema de verificación:', error)
        return false
      }
    }, { required: false })

    console.log('📋 Componentes por defecto registrados')
  }

  // Verificar estado del sistema
  getSystemStatus() {
    return {
      initialized: this.initialized,
      components: Array.from(this.components.keys()),
      errors: this.errors,
      timestamp: new Date().toISOString()
    }
  }

  // Reinicializar sistema
  async reinitialize() {
    console.log('🔄 Reinicializando sistema...')
    this.initialized = false
    this.errors = []
    return await this.initialize()
  }
}

// Instancia singleton
const systemInitializer = new SystemInitializer()

// Inicializar componentes por defecto
systemInitializer.initializeDefaultComponents()

export default systemInitializer