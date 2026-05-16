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

/**
 * Renders the branded panel email HTML layout.
 * @param {Object} params
 * @param {string} params.contentHtml - Pre-composed HTML. Caller is responsible for
 *   escaping any user-controlled values. Use escapeHtml() for plain text fragments.
 */
export function renderPanelEmail({ subject, preheader, title, contentHtml, ctaUrl, ctaText }) {
  const brand = getBrandConfig()
  const safePreheader = escapeHtml(preheader || '')
  const safeTitle = escapeHtml(title || '')
  const safeCtaText = escapeHtml(ctaText || '')
  const safeCtaUrl = sanitizeUrl(ctaUrl)

  const oguriPurple = '#5b3dad'
  const oguriLavender = '#b7a6e6'
  const oguriSilver = '#cbd5e1'

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:${brand.background};font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <div style="display:none;font-size:1px;color:transparent;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
      ${safePreheader}
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${brand.background};">
      <tr>
        <td align="center" style="padding: 40px 10px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;border-collapse:separate;">
            <tr>
              <td style="padding-bottom: 20px; text-align: left;">
                <span style="color:${oguriSilver}; font-weight: 800; font-size: 20px; letter-spacing: -0.5px;">
                  <span style="color:${oguriPurple};">✦</span> ${brand.name.toUpperCase()}
                </span>
              </td>
            </tr>

            <tr>
              <td style="background-color:${brand.card}; border: 1px solid #2d3748; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.4);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse;">
                  <tr>
                    <td width="33.3%" height="4" style="background-color:${oguriPurple};"></td>
                    <td width="33.3%" height="4" style="background-color:${oguriSilver};"></td>
                    <td width="33.3%" height="4" style="background-color:${oguriLavender};"></td>
                  </tr>
                  <tr>
                    <td colspan="3" style="padding: 40px 30px;">
                      <h1 style="margin: 0 0 20px 0; color: #ffffff; font-size: 28px; font-weight: 800; line-height: 1.2;">
                        ${safeTitle}
                      </h1>
                      <div style="color: ${oguriSilver}; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                        ${contentHtml}
                      </div>

                      ${safeCtaUrl && safeCtaText ? `
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="border-radius: 8px; background-color: ${oguriPurple};">
                            <a href="${safeCtaUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                              ${safeCtaText}
                            </a>
                          </td>
                        </tr>
                      </table>
                      ` : ''}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding-top: 30px; text-align: center;">
                <p style="margin: 0; color: #718096; font-size: 13px;">
                  &copy; ${new Date().getFullYear()} ${escapeHtml(brand.name)} &bull; El Monstruo de las Cenizas
                </p>
                <p style="margin: 10px 0 0 0; color: #4a5568; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">
                  Powered by Oguri Power System
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim()
}
