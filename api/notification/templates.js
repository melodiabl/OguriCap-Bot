import { NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES, NOTIFICATION_CHANNELS, NOTIFICATION_PRIORITIES } from './types.js'

export function buildTemplates() {
  const m = new Map()

  m.set('bot_connected', {
    title: '🤖 Bot Principal En Línea',
    message: 'La conexión con WhatsApp se ha establecido correctamente. El bot ya está procesando mensajes.',
    type: NOTIFICATION_TYPES.SUCCESS,
    category: NOTIFICATION_CATEGORIES.BOT,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER]
  })

  m.set('bot_disconnected', {
    title: '⚠️ Bot Principal Desconectado',
    message: 'Se ha perdido la conexión con WhatsApp. Razón: {reason}. El sistema intentará reconectar automáticamente.',
    type: NOTIFICATION_TYPES.ERROR,
    category: NOTIFICATION_CATEGORIES.BOT,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
  })

  m.set('command_error', {
    title: '❌ Error de Ejecución',
    message: 'No se pudo completar el comando "{command}". Error: {error}',
    type: NOTIFICATION_TYPES.WARNING,
    category: NOTIFICATION_CATEGORIES.COMMAND,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    channels: [NOTIFICATION_CHANNELS.SOCKET]
  })

  m.set('security_alert', {
    title: 'Alerta de Seguridad',
    message: 'Se ha detectado actividad sospechosa',
    type: NOTIFICATION_TYPES.CRITICAL,
    category: NOTIFICATION_CATEGORIES.SECURITY,
    priority: NOTIFICATION_PRIORITIES.CRITICAL,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL, NOTIFICATION_CHANNELS.WEBHOOK]
  })

  m.set('maintenance_start', {
    title: 'Mantenimiento Iniciado',
    message: 'El sistema ha entrado en modo de mantenimiento',
    type: NOTIFICATION_TYPES.WARNING,
    category: NOTIFICATION_CATEGORIES.MAINTENANCE,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER]
  })

  m.set('user_login', {
    title: '🔑 Acceso al Panel',
    message: 'El usuario @{username} ha iniciado sesión correctamente desde {ip}.',
    type: NOTIFICATION_TYPES.INFO,
    category: NOTIFICATION_CATEGORIES.USER,
    priority: NOTIFICATION_PRIORITIES.LOW,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.EMAIL]
  })

  m.set('user_registered', {
    title: '👤 Nuevo Registro',
    message: 'Se ha registrado un nuevo usuario: @{username} ({email}).',
    type: NOTIFICATION_TYPES.SUCCESS,
    category: NOTIFICATION_CATEGORIES.USER,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
  })

  m.set('user_updated', {
    title: 'Usuario Actualizado',
    message: 'Se han actualizado los datos del usuario: {username}',
    type: NOTIFICATION_TYPES.INFO,
    category: NOTIFICATION_CATEGORIES.USER,
    priority: NOTIFICATION_PRIORITIES.LOW,
    channels: [NOTIFICATION_CHANNELS.SOCKET]
  })

  m.set('user_deleted', {
    title: 'Usuario Eliminado',
    message: 'Se ha eliminado la cuenta del usuario: {username}',
    type: NOTIFICATION_TYPES.WARNING,
    category: NOTIFICATION_CATEGORIES.USER,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
  })

  m.set('system_restart', {
    title: 'Sistema Reiniciado',
    message: 'El sistema de Oguri Bot se ha reiniciado correctamente',
    type: NOTIFICATION_TYPES.SUCCESS,
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
  })

  m.set('system_error', {
    title: '🚨 Error Crítico del Sistema',
    message: 'Se ha detectado un fallo grave: {error}. Por favor, revisa los logs del terminal.',
    type: NOTIFICATION_TYPES.CRITICAL,
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    priority: NOTIFICATION_PRIORITIES.CRITICAL,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL, NOTIFICATION_CHANNELS.WEBHOOK]
  })

  m.set('subbot_created', {
    title: 'Subbot Creado',
    message: 'Se ha creado una nueva instancia de subbot: {subbotCode}',
    type: NOTIFICATION_TYPES.SUCCESS,
    category: NOTIFICATION_CATEGORIES.BOT,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER]
  })

  m.set('subbot_disconnected', {
    title: 'Subbot Desconectado',
    message: 'El subbot {subbotCode} se ha desconectado',
    type: NOTIFICATION_TYPES.WARNING,
    category: NOTIFICATION_CATEGORIES.BOT,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER],
    emailCondition: (data) => data?.createdFrom === 'panel'
  })

  m.set('subbot_connected', {
    title: '🤖 Subbot En Línea',
    message: 'El subbot {subbotCode} se ha conectado correctamente y está listo.',
    type: NOTIFICATION_TYPES.SUCCESS,
    category: NOTIFICATION_CATEGORIES.BOT,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER],
    emailCondition: (data) => data?.createdFrom === 'panel'
  })

  m.set('subbot_deleted', {
    title: '🗑️ Subbot Eliminado',
    message: 'Tu subbot {subbotCode} ha sido eliminado por {deletedBy}. Si crees que esto fue un error, contacta con el administrador.',
    type: NOTIFICATION_TYPES.WARNING,
    category: NOTIFICATION_CATEGORIES.BOT,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.EMAIL],
    emailCondition: (data) => !!data?.emailTo,
  })

  m.set('subbot_deleted_by_cleanup', {
    title: '👋 ¡Oh, hasta pronto! Sesión eliminada',
    message: 'Oh {ownerName}, parece que te has desconectado de nuestros servicios. Tu subbot {subbotCode} fue eliminado automáticamente por el sistema de limpieza al detectar que no tenía una sesión activa válida. ¡Hasta pronto! Si esto fue un error, contáctanos.',
    type: NOTIFICATION_TYPES.WARNING,
    category: NOTIFICATION_CATEGORIES.BOT,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.EMAIL],
    emailCondition: (data) => !!data?.emailTo,
  })

  m.set('subbot_error', {
    title: 'Error en Subbot',
    message: 'Error en subbot {subbotCode}: {error}',
    type: NOTIFICATION_TYPES.ERROR,
    category: NOTIFICATION_CATEGORIES.BOT,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
  })

  m.set('subbot_updated', {
    title: 'Subbot Actualizado',
    message: 'Se han actualizado los ajustes del subbot {subbotCode}',
    type: NOTIFICATION_TYPES.INFO,
    category: NOTIFICATION_CATEGORIES.BOT,
    priority: NOTIFICATION_PRIORITIES.LOW,
    channels: [NOTIFICATION_CHANNELS.SOCKET]
  })

  m.set('login_failed', {
    title: 'Intento de Login Fallido',
    message: 'Intento de acceso fallido para el usuario {username} desde {ip}',
    type: NOTIFICATION_TYPES.WARNING,
    category: NOTIFICATION_CATEGORIES.SECURITY,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
  })

  m.set('backup_completed', {
    title: 'Backup Completado',
    message: 'El respaldo del sistema se ha realizado exitosamente',
    type: NOTIFICATION_TYPES.SUCCESS,
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.EMAIL]
  })

  m.set('backup_failed', {
    title: 'Error en Backup',
    message: 'Ha fallado el proceso de respaldo del sistema: {error}',
    type: NOTIFICATION_TYPES.CRITICAL,
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    priority: NOTIFICATION_PRIORITIES.CRITICAL,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
  })

  m.set('subbot_qr_generated', {
    title: 'QR Generado',
    message: 'Nuevo código QR disponible para el subbot {subbotCode}',
    type: NOTIFICATION_TYPES.INFO,
    category: NOTIFICATION_CATEGORIES.BOT,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    channels: [NOTIFICATION_CHANNELS.SOCKET]
  })

  m.set('subbot_pairing_code_generated', {
    title: 'Código de Vinculación',
    message: 'Nuevo código de vinculación ({pairingCode}) generado para el subbot {subbotCode}',
    type: NOTIFICATION_TYPES.INFO,
    category: NOTIFICATION_CATEGORIES.BOT,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    channels: [NOTIFICATION_CHANNELS.SOCKET]
  })

  m.set('task_started', {
    title: 'Tarea Iniciada',
    message: 'La tarea "{taskName}" ha comenzado su ejecución',
    type: NOTIFICATION_TYPES.INFO,
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    priority: NOTIFICATION_PRIORITIES.LOW,
    channels: [NOTIFICATION_CHANNELS.SOCKET]
  })

  m.set('task_completed', {
    title: 'Tarea Completada',
    message: 'La tarea "{taskName}" finalizó exitosamente en {duration}ms',
    type: NOTIFICATION_TYPES.SUCCESS,
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    channels: [NOTIFICATION_CHANNELS.SOCKET]
  })

  m.set('task_failed', {
    title: 'Error en Tarea',
    message: 'La tarea "{taskName}" falló: {error}',
    type: NOTIFICATION_TYPES.ERROR,
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
  })

  m.set('high_memory_usage', {
    title: 'Uso de Memoria Alto',
    message: 'El uso de memoria del sistema está en {usage}% (Heap: {used}MB/{total}MB)',
    type: NOTIFICATION_TYPES.WARNING,
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
  })

  m.set('restore_started', {
    title: 'Restauración Iniciada',
    message: 'Se ha iniciado la restauración del backup: {backupId}',
    type: NOTIFICATION_TYPES.WARNING,
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    priority: NOTIFICATION_PRIORITIES.URGENT,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
  })

  m.set('restore_completed', {
    title: 'Restauración Completada',
    message: 'El backup {backupId} se restauró exitosamente ({restoredFiles} archivos)',
    type: NOTIFICATION_TYPES.SUCCESS,
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    priority: NOTIFICATION_PRIORITIES.CRITICAL,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
  })

  m.set('restore_failed', {
    title: 'Error en Restauración',
    message: 'Falló la restauración del backup {backupId}: {error}',
    type: NOTIFICATION_TYPES.CRITICAL,
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    priority: NOTIFICATION_PRIORITIES.CRITICAL,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
  })

  m.set('password_changed', {
    title: 'Contraseña Cambiada',
    message: 'La contraseña del usuario {username} ha sido actualizada',
    type: NOTIFICATION_TYPES.SUCCESS,
    category: NOTIFICATION_CATEGORIES.SECURITY,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.EMAIL]
  })

  m.set('password_reset_requested', {
    title: 'Restablecimiento de Contraseña',
    message: 'Se ha solicitado un restablecimiento de contraseña para {username}',
    type: NOTIFICATION_TYPES.WARNING,
    category: NOTIFICATION_CATEGORIES.SECURITY,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.EMAIL]
  })

  m.set('role_updated', {
    title: 'Rol de Usuario Actualizado',
    message: 'El rol de {username} ha cambiado: {oldRole} -> {newRole}',
    type: NOTIFICATION_TYPES.INFO,
    category: NOTIFICATION_CATEGORIES.USER,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
  })

  m.set('high_cpu_usage', {
    title: 'Uso de CPU Alto',
    message: 'La carga del sistema es inusualmente alta: {load}%',
    type: NOTIFICATION_TYPES.WARNING,
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
  })

  m.set('low_disk_space', {
    title: 'Espacio en Disco Bajo',
    message: 'Queda poco espacio en el disco: {available}GB disponibles ({percent}%)',
    type: NOTIFICATION_TYPES.CRITICAL,
    category: NOTIFICATION_CATEGORIES.SYSTEM,
    priority: NOTIFICATION_PRIORITIES.CRITICAL,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
  })

  m.set('unauthorized_access', {
    title: 'Intento de Acceso No Autorizado',
    message: 'Se ha bloqueado un intento de acceso desde la IP {ip} al recurso {resource}',
    type: NOTIFICATION_TYPES.CRITICAL,
    category: NOTIFICATION_CATEGORIES.SECURITY,
    priority: NOTIFICATION_PRIORITIES.CRITICAL,
    channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
  })

  return m
}
