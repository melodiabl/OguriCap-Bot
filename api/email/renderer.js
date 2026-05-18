import { getBrandConfig } from './config.js'

export function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }
  return String(text || '').replace(/[&<>"']/g, m => map[m])
}

function sanitizeUrl(url) {
  const str = String(url || '').trim()
  if (!str) return ''
  try {
    const parsed = new URL(str)
    return ['https:', 'http:'].includes(parsed.protocol) ? str : ''
  } catch {
    return ''
  }
}

export function renderDataBlock({ label, value, badge = '', badgeColor = 'green' }) {
  const palette = {
    green:    { badgeBg: '#dcfce7', badgeText: '#15803d' },
    teal:     { badgeBg: '#ccfbf1', badgeText: '#0f766e' },
    pink:     { badgeBg: '#fce7f3', badgeText: '#be185d' },
    gray:     { badgeBg: '#f3f4f6', badgeText: '#4b5563' },
    gold:     { badgeBg: '#fef3c7', badgeText: '#b45309' },
    lavender: { badgeBg: '#ede9fe', badgeText: '#6d28d9' },
  }
  const c = palette[badgeColor] || palette.green
  const safeLabel = escapeHtml(label)
  const safeValue = escapeHtml(value)
  const safeBadge = escapeHtml(badge)
  const badgeHtml = safeBadge
    ? `<td style="text-align:right;vertical-align:middle;white-space:nowrap;padding-left:12px;"><span style="display:inline-block;background:${c.badgeBg};color:${c.badgeText};font-size:11px;font-weight:700;padding:4px 10px;border-radius:4px;letter-spacing:0.5px;">${safeBadge}</span></td>`
    : ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:6px;margin-bottom:10px;"><tr><td style="padding:14px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="vertical-align:middle;"><span style="color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;display:block;margin-bottom:3px;">${safeLabel}</span><span style="color:#111827;font-size:16px;font-weight:700;">${safeValue}</span></td>${badgeHtml}</tr></table></td></tr></table>`
}

const TYPE_PALETTE = {
  success: {
    accent: '#16a34a',
    accentLight: '#dcfce7',
    accentText: '#15803d',
    badgeLabel: 'EXITOSO',
  },
  danger: {
    accent: '#dc2626',
    accentLight: '#fee2e2',
    accentText: '#b91c1c',
    badgeLabel: 'ACCIÓN REQUERIDA',
  },
  warning: {
    accent: '#d97706',
    accentLight: '#fef3c7',
    accentText: '#b45309',
    badgeLabel: 'AVISO IMPORTANTE',
  },
  info: {
    accent: '#2563eb',
    accentLight: '#dbeafe',
    accentText: '#1d4ed8',
    badgeLabel: 'VERIFICACIÓN',
  },
}

/**
 * Renders the branded panel email HTML layout (v3 — Minimalist SaaS / light theme).
 * @param {string} params.contentHtml - Pre-composed HTML injected verbatim.
 *   Callers MUST escape user-supplied strings with escapeHtml() before
 *   passing them in, or use renderDataBlock() for structured data rows.
 * @param {'success'|'danger'|'warning'|'info'} [params.type='success'] - Color theme.
 * @param {string} [params.icon=''] - Emoji icon rendered in the header area.
 */
export function renderPanelEmail({ subject, preheader, title, contentHtml, ctaUrl, ctaText, type = 'success', icon = '' }) {
  const brand = getBrandConfig()
  const p = TYPE_PALETTE[type] || TYPE_PALETTE.success
  const safePreheader = escapeHtml(preheader || '')
  const safeTitle = escapeHtml(title || '')
  const safeCtaText = escapeHtml(ctaText || '')
  const safeCtaUrl = sanitizeUrl(ctaUrl)
  const year = new Date().getFullYear()
  const iconHtml = icon ? `<div style="font-size:32px;margin-bottom:16px;line-height:1;">${escapeHtml(icon)}</div>` : ''

  const ctaHtml = safeCtaUrl && safeCtaText
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:32px;"><tr><td style="background:${p.accent};border-radius:6px;"><a href="${safeCtaUrl}" target="_blank" style="display:block;padding:16px 24px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;text-align:center;letter-spacing:0.2px;">${safeCtaText} &rarr;</a></td></tr></table>`
    : ''

  return `<!doctype html>
<html lang="es">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;font-size:1px;color:transparent;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${safePreheader}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f9fc;">
      <tr><td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="max-width:520px;width:100%;">
          <tr><td style="padding-bottom:24px;text-align:left;">
            <span style="font-size:15px;font-weight:800;color:#111827;letter-spacing:-0.3px;">${escapeHtml(brand.name)}</span>
            <span style="font-size:13px;color:#9ca3af;margin-left:8px;">· Panel de Control</span>
          </td></tr>
          <tr><td style="background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04);">
            <div style="height:4px;background:${p.accent};"></div>
            <div style="padding:36px 40px 28px;">
              ${iconHtml}
              <span style="display:inline-block;background:${p.accentLight};color:${p.accentText};font-size:10px;font-weight:800;padding:4px 10px;border-radius:4px;letter-spacing:1.2px;margin-bottom:16px;">${p.badgeLabel}</span>
              <h1 style="margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;line-height:1.25;color:#111827;">${safeTitle}</h1>
            </div>
            <div style="padding:0 40px 40px;">
              <div style="color:#374151;font-size:15px;line-height:1.7;">${contentHtml}</div>
              ${ctaHtml}
              <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;line-height:1.6;">Si no fuiste vos quien realizó esta acción, podés ignorar este email.</p>
            </div>
          </td></tr>
          <tr><td style="padding-top:24px;text-align:center;">
            <p style="margin:0 0 4px;color:#9ca3af;font-size:12px;">&copy; ${year} ${escapeHtml(brand.name)} &bull; Todos los derechos reservados</p>
            <p style="margin:0;color:#d1d5db;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Oguri Power System</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`.trim()
}
