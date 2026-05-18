import { getSmtpMode } from '../config.js'

export class SmtpProvider {
  constructor(config) {
    this.config = config
  }

  getMode() {
    return getSmtpMode(this.config)
  }

  buildOptions() {
    const config = this.config
    const port = Number(config.port || 0)
    const auth = config.user && config.pass ? { user: config.user, pass: config.pass } : undefined
    const mode = this.getMode()

    const options = {
      host: config.host,
      port,
      secure: mode === 'implicit-tls',
      auth,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5,
    }

    if (mode === 'starttls') options.requireTLS = true
    return options
  }

  async createTransporter() {
    const { default: nodemailer } = await import('nodemailer')
    return nodemailer.createTransport(this.buildOptions())
  }

  normalizeError(error) {
    const message = String(error?.message || error || '').trim()
    if (/wrong version number/i.test(message)) {
      return 'TLS/puerto incompatibles. Usa puerto 465 con seguro activado, o 587 con STARTTLS.'
    }
    return message || 'SMTP error'
  }
}
