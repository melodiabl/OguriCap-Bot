import { getSmtpConfig } from '../config.js'
import { SmtpProvider } from './smtp.js'

export function getActiveProvider() {
  const config = getSmtpConfig()
  if (!config) return null
  return new SmtpProvider(config)
}
