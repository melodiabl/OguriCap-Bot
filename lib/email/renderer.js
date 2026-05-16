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
    gray:  { bg: 'rgba(132,150,142,0.06)', border: 'rgba(132,150,142,0.14)', badgeBg: 'rgba(132,150,142,0.12)', badgeText: '#84968e', badgeBorder: 'rgba(132,150,142,0.25)' },
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

/**
 * Renders the branded panel email HTML layout (v2).
 * @param {string} params.contentHtml - Pre-composed HTML injected verbatim.
 *   Callers MUST escape user-supplied strings with escapeHtml() before
 *   passing them in, or use renderDataBlock() for structured data rows.
 */
export function renderPanelEmail({ subject, preheader, title, contentHtml, ctaUrl, ctaText }) {
  const brand = getBrandConfig()
  const safePreheader = escapeHtml(preheader || '')
  const safeTitle = escapeHtml(title || '')
  const safeCtaText = escapeHtml(ctaText || '')
  const safeCtaUrl = sanitizeUrl(ctaUrl)
  const year = new Date().getFullYear()

  const ctaHtml = safeCtaUrl && safeCtaText
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="background:linear-gradient(135deg,#25d366 0%,#2dd4bf 100%);border-radius:12px;box-shadow:0 4px 24px rgba(37,211,102,0.4),0 2px 8px rgba(45,212,191,0.2);"><a href="${safeCtaUrl}" target="_blank" style="display:block;padding:17px;color:#060807;font-size:15px;font-weight:900;text-decoration:none;text-align:center;letter-spacing:0.5px;">${safeCtaText}</a></td></tr></table>`
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
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="34%" height="4" style="background:#25d366;line-height:4px;font-size:0;"></td>
                <td width="33%" height="4" style="background:#2dd4bf;line-height:4px;font-size:0;"></td>
                <td width="33%" height="4" style="background:#ff4d8d;line-height:4px;font-size:0;"></td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="padding:40px 36px 36px;">
                <h1 style="margin:0 0 12px;font-size:32px;font-weight:900;letter-spacing:-1px;line-height:1.1;color:#f2f6f3;">${safeTitle}</h1>
                <div style="height:1px;background:linear-gradient(90deg,rgba(37,211,102,0.4) 0%,rgba(45,212,191,0.2) 50%,transparent 100%);margin:20px 0;"></div>
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
