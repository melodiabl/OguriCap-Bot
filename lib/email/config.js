import fs from 'fs'
import path from 'path'

function readPanelSmtpConfig() {
  try {
    const mainConfigPath = path.join(process.cwd(), '.config', 'main.json')
    if (!fs.existsSync(mainConfigPath)) return null
    const raw = fs.readFileSync(mainConfigPath, 'utf8')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const emailCfg = parsed?.notifications?.email || null
    const smtpCfg = emailCfg?.smtp || null
    if (!smtpCfg || typeof smtpCfg !== 'object') return null
    return {
      enabled: emailCfg?.enabled,
      host: String(smtpCfg.host || '').trim(),
      port: smtpCfg.port,
      secure: typeof smtpCfg.secure === 'boolean' ? smtpCfg.secure : null,
      user: String(smtpCfg.user || '').trim(),
      pass: String(smtpCfg.pass || '').replace(/\s+/g, '').trim(),
      from: String(smtpCfg.from || '').trim(),
      replyTo: String(smtpCfg.replyTo || '').trim(),
    }
  } catch {
    return null
  }
}

export function getSmtpConfig() {
  const panelSmtp = readPanelSmtpConfig()
  const host = (panelSmtp?.host || process.env.SMTP_HOST || '').trim()
  const panelPortRaw = panelSmtp?.port == null ? '' : String(panelSmtp.port).trim()
  const envPortRaw = String(process.env.SMTP_PORT || '').trim()
  const port = Number(panelPortRaw || envPortRaw || 587)
  const envSecureRaw = String(process.env.SMTP_SECURE || '').trim().toLowerCase()
  const secure = typeof panelSmtp?.secure === 'boolean'
    ? panelSmtp.secure
    : envSecureRaw
      ? ['1', 'true', 'yes'].includes(envSecureRaw)
      : false
  const user = (panelSmtp?.user || process.env.SMTP_USER || '').trim()
  const pass = String(panelSmtp?.pass || process.env.SMTP_PASS || '').replace(/\s+/g, '').trim()
  const from = (panelSmtp?.from || process.env.SMTP_FROM || user || '').trim()
  const replyTo = (panelSmtp?.replyTo || process.env.SMTP_REPLY_TO || '').trim()
  if (!host) return null
  if (!Number.isFinite(port) || port <= 0) return null
  if (!from) return null
  return { host, port, secure, user, pass, from, replyTo }
}

export function getBrandConfig() {
  const panelUrl = (process.env.PANEL_URL || '').trim() || 'https://melodiaauris.qzz.io'
  const primary = (process.env.EMAIL_BRAND_PRIMARY || '').trim() || '#6366f1'
  const secondary = (process.env.EMAIL_BRAND_SECONDARY || '').trim() || '#7c3aed'
  const background = (process.env.EMAIL_BRAND_BG || '').trim() || '#0b1020'
  const card = (process.env.EMAIL_BRAND_CARD || '').trim() || '#111827'
  const name = (process.env.EMAIL_BRAND_NAME || '').trim() || 'Oguri Bot'
  const product = (process.env.EMAIL_BRAND_PRODUCT || '').trim() || 'Panel'
  return { panelUrl, primary, secondary, background, card, name, product }
}

export function getSmtpMode(config) {
  const port = Number(config?.port || 0)
  const wantsTls = Boolean(config?.secure)
  if (port === 465) return 'implicit-tls'
  if (wantsTls) return 'starttls'
  return 'plain'
}

export function getSmtpWarnings(config) {
  if (!config) return ['Configura el host SMTP para activar los correos.']
  const warnings = []
  const port = Number(config.port || 0)
  if (!config.user || !config.pass) warnings.push('Faltan credenciales SMTP para autenticación.')
  if (port === 465 && !config.secure) warnings.push('Puerto 465 detectado: conviene activar el modo seguro.')
  if (port === 587 && config.secure) warnings.push('Puerto 587 detectado: se usará STARTTLS automáticamente.')
  if (!config.replyTo) warnings.push('No definiste Reply-To; se usará el remitente por defecto.')
  return warnings
}

export function getSmtpTransportHint(config) {
  if (!config) return 'Configura el SMTP para ver recomendaciones.'
  const mode = getSmtpMode(config)
  if (mode === 'implicit-tls') return 'TLS implícito sobre 465.'
  if (mode === 'starttls') return 'STARTTLS sobre 587 o puerto similar.'
  return 'Conexión sin TLS explícito. Verifica si tu proveedor exige STARTTLS.'
}
