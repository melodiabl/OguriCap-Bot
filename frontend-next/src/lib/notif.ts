/**
 * notif.ts — Mapa de notificaciones por dominio
 *
 * Uso:
 *   import { notif } from '@/lib/notif'
 *   notif.pedidos.creado()
 *   notif.grupos.sincronizados()
 *   notif.auth.bienvenido('Admin')
 */

import { notifications as n } from '@/lib/notifications'

// Re-export para que las páginas solo necesiten: import { notif, notify } from '@/lib/notif'
export { notify, notifications, requestWebPush } from '@/lib/notifications'

export const notif = {

  // ─── Auth ──────────────────────────────────────────────────────────────────
  auth: {
    bienvenido:          (rol: string, extra = '') => n.success(`¡Bienvenido como ${rol}!`, { message: extra || undefined }),
    registrado:          ()           => n.success('Registro exitoso', { message: 'Tu rol es Usuario. Revisá tu email de confirmación.' }),
    sesionCerrada:       ()           => n.success('Sesión cerrada correctamente'),
    passwordActualizado: ()           => n.success('Contraseña actualizada', { message: 'Iniciá sesión para continuar.' }),
    tokenInvalido:       ()           => n.error('Token inválido'),
    debeSeleccionarRol:  ()           => n.error('Debes seleccionar un rol para continuar'),
    turnstileFallo:      ()           => n.error('Error en la verificación de Turnstile'),
    turnstileRequerido:  ()           => n.error('Por favor completa la verificación de Turnstile'),
    passwordCorto:       ()           => n.error('La contraseña debe tener al menos 6 caracteres'),
    passwordNoCoincide:  ()           => n.error('Las contraseñas no coinciden'),
    usuarioCorto:        ()           => n.error('El usuario debe tener al menos 3 caracteres'),
    emailInvalido:       ()           => n.error('Email inválido'),
  },

  // ─── Bot ───────────────────────────────────────────────────────────────────
  bot: {
    activado:            ()           => n.success('Bot activado globalmente'),
    desactivado:         ()           => n.success('Bot desactivado globalmente'),
    desconectado:        ()           => n.success('Bot desconectado'),
    configGuardada:      ()           => n.success('Configuración del bot guardada'),
    apagadoGlobal:       ()           => n.error('El bot está apagado globalmente'),
    errorConectar:       (e?: string) => n.error('Error al conectar', { message: e }),
    errorDesconectar:    (e?: string) => n.error('Error al desconectar', { message: e }),
    errorEstado:         (e?: string) => n.error('Error al cambiar estado del bot', { message: e }),
    conectando:          (method: string) => n.info(`Iniciando conexión vía ${method.toUpperCase()}...`),
  },

  // ─── Grupos ────────────────────────────────────────────────────────────────
  grupos: {
    sincronizados:       ()           => n.success('Grupos sincronizados correctamente'),
    actualizados:        (n2: number) => n.success(`Actualizados ${n2} grupos`),
    botActivado:         (nombre: string) => n.success(`Bot activado en ${nombre}`),
    botDesactivado:      (nombre: string) => n.success(`Bot desactivado en ${nombre}`),
    proveedorMarcado:    (es: boolean) => n.success(`Grupo ${es ? 'marcado como' : 'desmarcado de'} proveedor`),
    errorCargar:         ()           => n.error('Error al cargar grupos'),
    errorSincronizar:    ()           => n.error('El bot debe estar conectado para sincronizar grupos'),
    errorCargarLista:    ()           => n.error('No pude cargar la lista de grupos (revisá sesión/token del panel).'),
    obteniendo:          ()           => n.info('Obteniendo grupos de WhatsApp...'),
  },

  // ─── Pedidos ───────────────────────────────────────────────────────────────
  pedidos: {
    creado:              ()           => n.success('Pedido creado correctamente'),
    eliminado:           ()           => n.success('Pedido eliminado'),
    procesado:           ()           => n.success('Pedido procesado y listado'),
    actualizado:         (estado: string) => n.success(`Pedido actualizado a ${estado}`),
    errorCrear:          ()           => n.error('Error al crear pedido'),
    errorEliminar:       (e?: string) => n.error('Error al eliminar pedido', { message: e }),
    errorActualizar:     ()           => n.error('Error al actualizar pedido'),
    errorCargar:         ()           => n.error('Error al cargar pedidos'),
    errorProcesar:       (e?: string) => n.error('Error procesando pedido', { message: e }),
    tituloRequerido:     ()           => n.error('El título es requerido'),
    mensajeRequerido:    ()           => n.error('El mensaje es requerido'),
  },

  // ─── Aportes ───────────────────────────────────────────────────────────────
  aportes: {
    creado:              ()           => n.success('Aporte creado exitosamente'),
    eliminado:           ()           => n.success('Aporte eliminado'),
    estadoActualizado:   (estado: string) => n.success(`Aporte ${estado}`),
    errorCrear:          (e?: string) => n.error('Error al crear aporte', { message: e }),
    errorEliminar:       (e?: string) => n.error('Error al eliminar aporte', { message: e }),
    errorCargar:         ()           => n.error('Error al cargar aportes'),
  },

  // ─── Subbots ───────────────────────────────────────────────────────────────
  subbots: {
    qrCreado:            ()           => n.success('¡Instancia QR creada! Espera al código QR.'),
    codigoCreado:        ()           => n.success('Instancia creada. Generando código...'),
    eliminado:           ()           => n.success('Subbot eliminado'),
    normalizado:         (migrated: number, online: number, conflicts: number) =>
                                         n.success(`Normalizado: ${migrated} • online: ${online} • conflictos: ${conflicts}`),
    reindexado:          (count: number, removed: number) =>
                                         n.success(`Reindex completado (${count})${removed ? ` • symlinks rotos: ${removed}` : ''}`),
    errorEliminar:       (e?: string) => n.error('Error al eliminar subbot', { message: e }),
    errorQR:             (e?: string) => n.error('Error al crear la instancia QR', { message: e }),
    errorCodigo:         (e?: string) => n.error('Error al crear la instancia por código', { message: e }),
    errorCargar:         ()           => n.error('No se pudieron cargar los subbots'),
    errorNormalizar:     (e?: string) => n.error('No se pudo normalizar las carpetas de subbots', { message: e }),
    errorReindexar:      (e?: string) => n.error('No se pudo reindexar los subbots', { message: e }),
  },

  // ─── Scheduler ─────────────────────────────────────────────────────────────
  scheduler: {
    creado:              ()           => n.success('Mensaje programado creado exitosamente'),
    actualizado:         ()           => n.success('Mensaje programado actualizado'),
    eliminado:           ()           => n.success('Mensaje programado eliminado'),
    activado:            (on: boolean) => n.success(on ? 'Mensaje activado' : 'Mensaje pausado'),
    errorCrear:          (e?: string) => n.error('Error al crear mensaje programado', { message: e }),
    errorActualizar:     (e?: string) => n.error('Error al actualizar mensaje', { message: e }),
    errorEliminar:       ()           => n.error('Error al eliminar mensaje'),
    errorCargar:         ()           => n.error('Error al cargar mensajes programados'),
    fechaRequerida:      ()           => n.error('Selecciona una fecha para el mensaje único'),
    diaRequerido:        ()           => n.error('Selecciona al menos un día para el mensaje semanal'),
    asuntoRequerido:     ()           => n.error('El asunto es requerido'),
    destinoRequerido:    ()           => n.warning('Ingresa un correo de destino'),
    jidRequerido:        ()           => n.error('Ingresa un JID destino (ej: 1203630...@g.us)'),
  },

  // ─── Tareas ────────────────────────────────────────────────────────────────
  tareas: {
    ejecutada:           ()           => n.success('Tarea ejecutada'),
    eliminada:           ()           => n.success('Tarea eliminada'),
    activada:            (on: boolean) => n.success(on ? 'Tarea habilitada' : 'Tarea pausada'),
    errorEjecutar:       ()           => n.error('Error ejecutando tarea'),
    errorEliminar:       ()           => n.error('Error eliminando tarea'),
    errorActualizar:     ()           => n.error('Error actualizando tarea'),
    errorCargar:         ()           => n.error('Error cargando tareas'),
    nombreRequerido:     ()           => n.error('El nombre de la regla es requerido'),
  },

  // ─── Alertas ───────────────────────────────────────────────────────────────
  alertas: {
    reconocida:          ()           => n.success('Alerta reconocida'),
    resuelta:            ()           => n.success('Alerta resuelta'),
    reglaCreada:         ()           => n.success('Regla creada correctamente'),
    reglaActivada:       (on: boolean) => n.success(on ? 'Regla habilitada' : 'Regla deshabilitada'),
    suprimir:            (mins: number) => n.success(`Regla suprimida por ${mins} minutos`),
    critica:             (nombre: string) => n.error(`Alerta Crítica: ${nombre}`),
    warning:             (nombre: string) => n.warning(`Alerta: ${nombre}`),
    recurso:             (res: string, estado: string) => n.warning(`Alerta: ${res} en estado ${estado}`),
    errorReconocer:      ()           => n.error('Error reconociendo alerta'),
    errorResolver:       ()           => n.error('Error resolviendo alerta'),
    errorCrearRegla:     (e?: string) => n.error('Error al crear regla', { message: e }),
    errorActualizarRegla: ()          => n.error('Error actualizando regla'),
    errorSuprimir:       ()           => n.error('Error suprimiendo regla'),
    errorCargar:         ()           => n.error('Error cargando alertas'),
  },

  // ─── Logs ──────────────────────────────────────────────────────────────────
  logs: {
    exportados:          ()           => n.success('Logs exportados'),
    limpiados:           ()           => n.success('Logs limpiados'),
    copiado:             ()           => n.success('Log copiado al portapapeles'),
    errorExportar:       ()           => n.error('Error exportando logs'),
    errorLimpiar:        ()           => n.error('Error limpiando logs'),
    errorCargar:         ()           => n.error('Error cargando logs'),
  },

  // ─── Configuración ─────────────────────────────────────────────────────────
  config: {
    guardada:            ()           => n.success('Configuración guardada correctamente'),
    sistemaGuardada:     ()           => n.success('Configuración del sistema guardada'),
    actualizada:         ()           => n.success('Configuración actualizada'),
    importada:           ()           => n.success('Configuración importada. Reiniciando vista...'),
    smtpValido:          ()           => n.success('Configuración SMTP válida'),
    emailPrueba:         ()           => n.success('Email de prueba enviado'),
    ipAgregada:          ()           => n.success('IP agregada correctamente'),
    autoGuardadoIP:      (on: boolean) => n.success(`Auto-guardado de IP ${on ? 'activado' : 'desactivado'}`),
    mantenimiento:       (on: boolean) => n.success(`Mantenimiento ${on ? 'activado' : 'desactivado'}`),
    rollback:            ()           => n.success('Sistema revertido correctamente'),
    umbrales:            ()           => n.success('Umbrales actualizados'),
    errorGuardar:        (e?: string) => n.error('Error al guardar configuración del bot', { message: e }),
    errorSistema:        (e?: string) => n.error('Error al guardar configuración del sistema', { message: e }),
    errorImportar:       ()           => n.error('Archivo de configuración inválido'),
    errorExportar:       ()           => n.error('Error al exportar configuración'),
    errorRollback:       ()           => n.error('Error al realizar rollback'),
    errorSmtp:           ()           => n.error('Fallo en la verificación SMTP'),
    errorEmail:          (e?: string) => n.error('Error al enviar email de prueba', { message: e }),
    errorIP:             ()           => n.error('Error al agregar IP'),
    errorMantenimiento:  ()           => n.error('Error al cambiar modo mantenimiento'),
    errorUmbrales:       ()           => n.error('Error actualizando umbrales'),
    mantenimientoActivo: ()           => n.warning('El sistema está en modo de mantenimiento'),
    mantenimientoAdmin:  ()           => n.warning('El sistema está en modo de mantenimiento. Solo los administradores pueden acceder.'),
    camposRequeridos:    ()           => n.error('Completa todos los campos requeridos'),
  },

  // ─── Usuarios ──────────────────────────────────────────────────────────────
  usuarios: {
    eliminado:           ()           => n.success('Usuario eliminado'),
    rolActualizado:      (admin: boolean) => n.success(`Usuario ${admin ? 'promovido a admin' : 'degradado a miembro'}`),
    baneado:             (on: boolean) => n.success(on ? 'Usuario baneado' : 'Usuario desbaneado'),
    estadoActualizado:   ()           => n.success('Estado actualizado'),
    errorCargar:         ()           => n.error('Error al cargar usuarios'),
    errorComunidad:      ()           => n.error('Error al cargar usuarios de la comunidad'),
    errorRol:            (e?: string) => n.error('Error al cambiar rol del usuario', { message: e }),
    errorEstado:         (e?: string) => n.error('Error al cambiar estado del usuario', { message: e }),
    permisos:            ()           => n.error('Permisos insuficientes'),
    loteError:           ()           => n.error('Error en operación en lote'),
  },

  // ─── Analytics ─────────────────────────────────────────────────────────────
  analytics: {
    exportados:          ()           => n.success('Datos exportados correctamente'),
    reporteGenerado:     ()           => n.success('Reporte generado'),
    reporteEliminado:    ()           => n.success('Reporte eliminado'),
    metricasExportadas:  ()           => n.success('Métricas exportadas'),
    monitoreoIniciado:   ()           => n.success('Monitoreo iniciado'),
    monitoreoDetenido:   ()           => n.success('Monitoreo detenido'),
    errorExportar:       ()           => n.error('Error exportando datos'),
    errorReporte:        (e?: string) => n.error('Error generando reporte', { message: e }),
    errorEliminarReporte: ()          => n.error('Error eliminando reporte'),
    errorMetricas:       ()           => n.error('Error exportando métricas'),
    errorMonitoreo:      ()           => n.error('Error al cambiar estado del monitoreo'),
    errorCargar:         ()           => n.error('Error cargando analytics'),
  },

  // ─── Multimedia ────────────────────────────────────────────────────────────
  multimedia: {
    subido:              ()           => n.success('Archivo subido y clasificado'),
    eliminado:           ()           => n.success('Archivo eliminado'),
    enviado:             ()           => n.success('Enviado por WhatsApp'),
    variosSubidos:       (c: number) => n.success(`${c} archivo(s) subido(s) correctamente`),
    errorSubir:          (e?: string) => n.error('Error al subir archivos', { message: e }),
    errorEliminar:       (e?: string) => n.error('Error eliminando archivo', { message: e }),
    errorEnviar:         (e?: string) => n.error('Error enviando', { message: e }),
    errorCargar:         ()           => n.error('Error al cargar multimedia'),
    errorBiblioteca:     (e?: string) => n.error('Error cargando biblioteca', { message: e }),
    archivoGrande:       (nombre: string) => n.warning(`${nombre} es demasiado grande (máximo 50MB)`),
    archivoMuyGrande:    ()           => n.warning('Archivo muy grande. Usa el link de descarga.'),
  },

  // ─── Broadcast ─────────────────────────────────────────────────────────────
  broadcast: {
    enviado:             (dest: string) => n.success(`Mensaje enviado exitosamente`, { message: dest }),
    emailEnviado:        (count: number) => n.success(`Email broadcast enviado a ${count} usuarios`),
    pushEnviada:         ()           => n.success('Notificación push enviada'),
    broadcastCompleto:   ()           => n.success('Broadcast completo enviado a todos los usuarios'),
    errorEnviar:         (e?: string) => n.error('Error al enviar broadcast', { message: e }),
    errorEmail:          (e?: string) => n.error('Error al enviar email', { message: e }),
    errorPush:           (e?: string) => n.error('Error al enviar push', { message: e }),
    mensajeRequerido:    ()           => n.error('El mensaje es requerido'),
    destinoRequerido:    ()           => n.warning('Ingresa un correo de destino'),
  },

  // ─── Proveedores ───────────────────────────────────────────────────────────
  proveedores: {
    creado:              ()           => n.success('Proveedor creado'),
    eliminado:           ()           => n.success('Proveedor eliminado'),
    voto:                ()           => n.success('Voto registrado'),
    errorCargar:         ()           => n.error('Error al cargar datos'),
    errorVotar:          ()           => n.error('Error al votar'),
    errorEstado:         ()           => n.error('Error al cambiar estado de proveedor'),
  },

  // ─── AI Chat ───────────────────────────────────────────────────────────────
  ai: {
    descripcionMejorada: ()           => n.success('Descripción mejorada'),
    guardado:            ()           => n.success('Mensaje guardado'),
    errorIA:             (e?: string) => n.error('Error usando IA', { message: e }),
    errorGuardar:        (e?: string) => n.error('No se pudo guardar', { message: e }),
    errorRespuesta:      (e?: string) => n.error('La IA no devolvió contenido', { message: e }),
    sinContenido:        ()           => n.error('La IA no devolvió contenido'),
  },

  // ─── General ───────────────────────────────────────────────────────────────
  ui: {
    copiado:             ()           => n.success('Copiado al portapapeles'),
    exportado:           ()           => n.success('Datos exportados correctamente'),
    descartado:          ()           => n.info('Cambios descartados'),
    autoRefresh:         (on: boolean) => n.info(`Actualización automática ${on ? 'activada' : 'desactivada'}`),
    preset:              (label: string) => n.info(`Preset ${label} aplicado`),
    permisos:            ()           => n.error('Permisos insuficientes'),
    errorCargar:         ()           => n.error('Error al cargar datos'),
    errorGuardar:        (e?: string) => n.error('Error al guardar', { message: e }),
    errorEliminar:       (e?: string) => n.error('Error al eliminar', { message: e }),
    errorEstado:         (e?: string) => n.error('Error al actualizar estado', { message: e }),
    camposRequeridos:    ()           => n.error('Completa todos los campos requeridos'),
  },
}
