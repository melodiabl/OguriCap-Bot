import type { ToastPayload } from './types'

export function onTaskCreated(data: any): ToastPayload {
  const t      = data?.task ?? data
  const nombre = t?.nombre ?? t?.name ?? t?.title ?? 'nueva tarea'
  return {
    level:    'info',
    title:    'Tarea creada',
    message:  `Tarea "${nombre}" programada`,
    duration: 3000,
    dedupKey: `task:created:${nombre}`,
  }
}

export function onTaskExecuted(data: any): ToastPayload {
  const nombre = data?.taskName ?? data?.nombre ?? data?.name ?? 'tarea'
  const ok     = data?.success ?? data?.exitCode === 0
  return {
    level:       ok ? 'success' : 'error',
    title:       ok ? 'Tarea ejecutada' : 'Tarea fallida',
    message:     ok ? `"${nombre}" completada exitosamente` : `"${nombre}" falló durante la ejecución`,
    duration:    ok ? 3000 : 5000,
    dedupKey:    `task:executed:${nombre}:${ok}`,
    dedupWindow: 3000,
  }
}
