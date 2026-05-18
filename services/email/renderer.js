import { getBrandConfig } from './config.js'

const ICONS = {
  'check-circle':          `<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />`,
  'lock':                  `<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />`,
  'shield':                `<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />`,
  'bell':                  `<path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />`,
  'user':                  `<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />`,
  'trash':                 `<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />`,
  'cog':                   `<path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />`,
  'device-phone':          `<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3" />`,
  'x-circle':              `<path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />`,
  'clock':                 `<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />`,
  'arrow-path':            `<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />`,
  'exclamation-triangle':  `<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />`,
  'cpu-chip':              `<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />`,
  'heart':                 `<path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />`,
  'document':              `<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />`,
  'rocket':                `<path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />`,
  'currency':              `<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />`,
}

function renderIcon(name, accentColor, accentLight) {
  const path = ICONS[name]
  if (!path) return ''
  return `<div style="width:48px;height:48px;border-radius:12px;background:${accentLight};margin-bottom:20px;text-align:center;line-height:48px;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;">${path}</svg></div>`
}

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
export function renderPanelEmail({ subject, preheader, title, contentHtml, ctaUrl, ctaText, type = 'success', icon = '', securityFooter = false }) {
  const brand = getBrandConfig()
  const p = TYPE_PALETTE[type] || TYPE_PALETTE.success
  const safePreheader = escapeHtml(preheader || '')
  const safeTitle = escapeHtml(title || '')
  const safeCtaText = escapeHtml(ctaText || '')
  const safeCtaUrl = sanitizeUrl(ctaUrl)
  const year = new Date().getFullYear()
  const iconHtml = icon ? renderIcon(icon, p.accent, p.accentLight) : ''

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
              ${securityFooter ? `<p style="color:#9ca3af;font-size:12px;margin:24px 0 0;line-height:1.6;">Si no fuiste vos quien realizó esta acción, podés ignorar este email.</p>` : ''}
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
