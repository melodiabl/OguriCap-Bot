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

  // 2. Limpiar caché de sesiones (Baileys app-state-sync)
  // Estos archivos se acumulan y pueden ocupar mucho espacio
  const subbotRoot = pathsToClean[2]
  if (fs.existsSync(subbotRoot)) {
    try {
      const subbots = fs.readdirSync(subbotRoot)
      for (const subbot of subbots) {
        const sessionPath = path.join(subbotRoot, subbot)
        if (fs.statSync(sessionPath).isDirectory()) {
          const sessionFiles = fs.readdirSync(sessionPath)
          for (const file of sessionFiles) {
            // Archivos de sincronización de estado de app y pre-keys antiguos son candidatos
            if (file.startsWith('app-state-sync') || file.startsWith('pre-key-')) {
              const filePath = path.join(sessionPath, file)
              const stats = fs.statSync(filePath)
              // Borrar solo si tienen más de 24 horas para no romper sesiones activas
              if (Date.now() - stats.mtimeMs > 86400000) {
                fs.unlinkSync(filePath)
                results.sessionCache++
              }
            }
          }
        }
      }
    } catch (err) {
      results.errors.push(`Error en sessions: ${err.message}`)
    }
  }

  return results
}
