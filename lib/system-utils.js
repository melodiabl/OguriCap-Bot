import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execPromise = promisify(exec)

/**
 * Realiza una limpieza profunda del sistema para liberar espacio.
 * - Limpia archivos temporales.
 * - Elimina logs antiguos.
 * - Limpia caché de sesiones de Baileys (archivos de sincronización innecesarios).
 */
export async function performDeepCleanup() {
  const results = {
    tempFiles: 0,
    sessionCache: 0,
    logs: 0,
    errors: []
  }

  const root = process.cwd()
  const pathsToClean = [
    path.join(root, 'tmp'),
    path.join(root, 'logs'),
    path.join(root, 'Sessions/SubBot')
  ]

  // 1. Limpiar carpetas temporales y logs
  for (const dir of [pathsToClean[0], pathsToClean[1]]) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir)
        for (const file of files) {
          const filePath = path.join(dir, file)
          const stats = fs.statSync(filePath)
          // No borrar el directorio en sí, solo archivos de más de 1 hora
          if (stats.isFile() && (Date.now() - stats.mtimeMs > 3600000)) {
            fs.unlinkSync(filePath)
            if (dir.endsWith('tmp')) results.tempFiles++
            else results.logs++
          }
        }
      } catch (err) {
        results.errors.push(`Error en ${dir}: ${err.message}`)
      }
    }
  }

  // 2. Limpiar caché de sesiones (Baileys app-state-sync / pre-keys consumidos)
  // Estos archivos se acumulan y pueden ocupar mucho espacio.
  // Sólo se tocan pre-key-* y app-state-sync-key-* viejos; nunca creds.json,
  // session-* (sesiones Signal por contacto) ni sender-key-* (grupos).
  const cleanSessionDir = (sessionPath, maxAgeMs) => {
    const sessionFiles = fs.readdirSync(sessionPath)
    for (const file of sessionFiles) {
      if (file.startsWith('app-state-sync-key') || file.startsWith('pre-key-')) {
        const filePath = path.join(sessionPath, file)
        const stats = fs.statSync(filePath)
        if (Date.now() - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath)
          results.sessionCache++
        }
      }
    }
  }

  const subbotRoot = pathsToClean[2]
  if (fs.existsSync(subbotRoot)) {
    try {
      const subbots = fs.readdirSync(subbotRoot)
      for (const subbot of subbots) {
        const sessionPath = path.join(subbotRoot, subbot)
        if (fs.statSync(sessionPath).isDirectory()) {
          cleanSessionDir(sessionPath, 86400000) // 24 horas
        }
      }
    } catch (err) {
      results.errors.push(`Error en sessions: ${err.message}`)
    }
  }

  // Sesión principal: se acumulan miles de pre-keys (ralentiza el arranque y la auth).
  // Margen más conservador (7 días) por ser la sesión crítica.
  const mainSession = path.join(root, 'Sessions/Principal')
  if (fs.existsSync(mainSession)) {
    try {
      cleanSessionDir(mainSession, 7 * 86400000)
    } catch (err) {
      results.errors.push(`Error en sesión principal: ${err.message}`)
    }
  }

  return results
}
