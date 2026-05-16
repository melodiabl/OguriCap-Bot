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
    green: { bg: 'rgba(37,211,102,0.06)', border: 'rgba(37,211,102,0.18)', badgeBg: 'rgba(37,211,102,0.15)', badgeText: '#25d366', badgeBorder: 'rgba(37,211,102,0.35)' },
    teal:  { bg: 'rgba(45,212,191,0.05)', border: 'rgba(45,212,191,0.14)', badgeBg: 'rgba(45,212,191,0.12)', badgeText: '#2dd4bf', badgeBorder: 'rgba(45,212,191,0.28)' },
    pink:  { bg: 'rgba(255,77,141,0.05)', border: 'rgba(255,77,141,0.14)', badgeBg: 'rgba(255,77,141,0.12)', badgeText: '#ff4d8d', badgeBorder: 'rgba(255,77,141,0.28)' },
    gray:    { bg: 'rgba(132,150,142,0.06)', border: 'rgba(132,150,142,0.14)', badgeBg: 'rgba(132,150,142,0.12)', badgeText: '#84968e', badgeBorder: 'rgba(132,150,142,0.25)' },
    gold:    { bg: 'rgba(251,191,36,0.05)', border: 'rgba(251,191,36,0.14)', badgeBg: 'rgba(251,191,36,0.12)', badgeText: '#fbbf24', badgeBorder: 'rgba(251,191,36,0.28)' },
    lavender:{ bg: 'rgba(129,140,248,0.05)', border: 'rgba(129,140,248,0.14)', badgeBg: 'rgba(129,140,248,0.12)', badgeText: '#818cf8', badgeBorder: 'rgba(129,140,248,0.28)' },
  }
  const c = palette[badgeColor] || palette.green
  const safeLabel = escapeHtml(label)
  const safeValue = escapeHtml(value)
  const safeBadge = escapeHtml(badge)
  const badgeHtml = safeBadge
    ? `<td style="text-align:right;vertical-align:middle;"><span style="display:inline-block;background:${c.badgeBg};color:${c.badgeText};border:1px solid ${c.badgeBorder};font-size:11px;font-weight:700;padding:5px 12px;border-radius:50px;letter-spacing:0.8px;">${safeBadge}</span></td>`
    : ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.bg};border:1px solid ${c.border};border-radius:12px;margin-bottom:12px;"><tr><td style="padding:14px 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="vertical-align:middle;"><span style="color:#84968e;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;display:block;margin-bottom:3px;">${safeLabel}</span><span style="color:#f2f6f3;font-size:17px;font-weight:800;">${safeValue}</span></td>${badgeHtml}</tr></table></td></tr></table>`
}

const TYPE_PALETTE = {
  success: {
    primary: '#25d366',
    headerGradient: 'linear-gradient(135deg,rgba(37,211,102,0.18) 0%,rgba(45,212,191,0.08) 100%)',
    headerBorder: 'rgba(37,211,102,0.25)',
    iconBg: 'rgba(37,211,102,0.15)',
    iconBorder: 'rgba(37,211,102,0.3)',
    badgeBg: 'rgba(37,211,102,0.15)',
    badgeColor: '#25d366',
    badgeBorder: 'rgba(37,211,102,0.3)',
    badgeLabel: 'EXITOSO',
    titleColor: '#a7f3c7',
    ctaGradient: 'linear-gradient(135deg,#25d366 0%,#2dd4bf 100%)',
    ctaColor: '#060807',
  },
  danger: {
    primary: '#ff4d8d',
    headerGradient: 'linear-gradient(135deg,rgba(255,77,141,0.18) 0%,rgba(225,29,72,0.08) 100%)',
    headerBorder: 'rgba(255,77,141,0.25)',
    iconBg: 'rgba(255,77,141,0.15)',
    iconBorder: 'rgba(255,77,141,0.3)',
    badgeBg: 'rgba(255,77,141,0.15)',
    badgeColor: '#ff4d8d',
    badgeBorder: 'rgba(255,77,141,0.3)',
    badgeLabel: 'ACCIÓN REQUERIDA',
    titleColor: '#ffb3d0',
    ctaGradient: 'linear-gradient(135deg,#ff4d8d 0%,#e11d48 100%)',
    ctaColor: '#ffffff',
  },
  warning: {
    primary: '#fbbf24',
    headerGradient: 'linear-gradient(135deg,rgba(251,191,36,0.14) 0%,rgba(245,158,11,0.06) 100%)',
    headerBorder: 'rgba(251,191,36,0.22)',
    iconBg: 'rgba(251,191,36,0.15)',
    iconBorder: 'rgba(251,191,36,0.3)',
    badgeBg: 'rgba(251,191,36,0.15)',
    badgeColor: '#fbbf24',
    badgeBorder: 'rgba(251,191,36,0.3)',
    badgeLabel: 'AVISO IMPORTANTE',
    titleColor: '#fde68a',
    ctaGradient: 'linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%)',
    ctaColor: '#060807',
  },
  info: {
    primary: '#2dd4bf',
    headerGradient: 'linear-gradient(135deg,rgba(45,212,191,0.14) 0%,rgba(129,140,248,0.08) 100%)',
    headerBorder: 'rgba(45,212,191,0.22)',
    iconBg: 'rgba(45,212,191,0.15)',
    iconBorder: 'rgba(45,212,191,0.3)',
    badgeBg: 'rgba(45,212,191,0.15)',
    badgeColor: '#2dd4bf',
    badgeBorder: 'rgba(45,212,191,0.3)',
    badgeLabel: 'VERIFICACIÓN',
    titleColor: '#99f6e4',
    ctaGradient: 'linear-gradient(135deg,#2dd4bf 0%,#818cf8 100%)',
    ctaColor: '#060807',
  },
}

/**
 * Renders the branded panel email HTML layout (v2).
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

  const iconHtml = icon
    ? `<div style="width:52px;height:52px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:26px;margin-bottom:12px;background:${p.iconBg};border:1px solid ${p.iconBorder};">${escapeHtml(icon)}</div>`
    : ''

  const headerHtml = `
    <div style="padding:28px 36px 20px;background:${p.headerGradient};border-bottom:1px solid ${p.headerBorder};">
      ${iconHtml}
      <div style="display:inline-block;background:${p.badgeBg};color:${p.badgeColor};border:1px solid ${p.badgeBorder};font-size:10px;font-weight:800;padding:4px 12px;border-radius:50px;letter-spacing:1.5px;margin-bottom:10px;">${p.badgeLabel}</div>
      <h1 style="margin:0;font-size:26px;font-weight:900;letter-spacing:-0.5px;line-height:1.15;color:${p.titleColor};">${safeTitle}</h1>
    </div>`

  const ctaHtml = safeCtaUrl && safeCtaText
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="background:${p.ctaGradient};border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.3);"><a href="${safeCtaUrl}" target="_blank" style="display:block;padding:17px;color:${p.ctaColor};font-size:15px;font-weight:900;text-decoration:none;text-align:center;letter-spacing:0.5px;">${safeCtaText}</a></td></tr></table>`
    : ''

  return `<!doctype html>
<html lang="es">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#060807;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;font-size:1px;color:transparent;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${safePreheader}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#060807;">
      <tr><td align="center" style="padding:36px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="500" style="max-width:500px;width:100%;">
          <tr><td style="text-align:center;padding-bottom:24px;">
            <div style="display:inline-block;border:1px solid rgba(37,211,102,0.2);border-radius:50px;padding:8px 20px;background:rgba(37,211,102,0.05);">
              <span style="color:#25d366;font-size:18px;vertical-align:middle;">✦</span>
              <span style="color:#f2f6f3;font-size:14px;font-weight:900;letter-spacing:2px;vertical-align:middle;margin-left:8px;">${escapeHtml(brand.name.toUpperCase())}</span>
            </div>
            <div style="color:#3d504a;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;margin-top:8px;">El Monstruo de las Cenizas</div>
          </td></tr>
          <tr><td style="background:linear-gradient(160deg,#0f1a14 0%,#0c1410 100%);border-radius:20px;border:1px solid rgba(37,211,102,0.22);box-shadow:0 0 0 1px rgba(45,212,191,0.04),0 8px 32px rgba(0,0,0,0.6),0 0 60px rgba(37,211,102,0.07);overflow:hidden;">
            ${headerHtml}
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="padding:28px 36px 36px;">
                <div style="color:#b2c5ba;font-size:15px;line-height:1.75;margin-bottom:28px;">${contentHtml}</div>
                ${ctaHtml}
                <p style="color:#2d4038;font-size:12px;text-align:center;margin:20px 0 0;line-height:1.6;">Si no fuiste vos quien realizó esta acción, podés ignorar este email.</p>
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="text-align:center;padding-top:20px;">
            <p style="margin:0 0 4px;color:#2d4038;font-size:12px;">&copy; ${year} ${escapeHtml(brand.name)} &bull; El Monstruo de las Cenizas</p>
            <p style="margin:0;color:#1e2e26;font-size:10px;letter-spacing:2px;text-transform:uppercase;">Powered by Oguri Power System</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`.trim()
}
