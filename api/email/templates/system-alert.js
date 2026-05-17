import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildSystemAlertEmail({ metric, value, threshold, since = '', level = 'warning' }) {
  const brand = getBrandConfig()
  const safeMetric    = escapeHtml(String(metric || ''))
  const safeValue     = escapeHtml(String(value || ''))
  const safeThreshold = escapeHtml(String(threshold || ''))
  const isCritical    = level === 'critical'
  const subject       = `${isCritical ? '🚨' : '⚠️'} Alerta del sistema: ${safeMetric} — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">El sistema detectó una métrica que supera el umbral configurado.</p>` +
    renderDataBlock({ label: 'Métrica', value: safeMetric, badgeColor: 'gray' }) +
    renderDataBlock({ label: 'Valor actual', value: safeValue, badge: isCritical ? 'CRÍTICO' : 'ALTO', badgeColor: isCritical ? 'pink' : 'gold' }) +
    renderDataBlock({ label: 'Umbral', value: safeThreshold, badgeColor: 'gray' })

  if (since) contentHtml += renderDataBlock({ label: 'Desde', value: escapeHtml(String(since)), badgeColor: 'gray' })

  const text =
    `Alerta del sistema — ${brand.name}\n\nMétrica: ${String(metric || '')}\nValor: ${String(value || '')}\nUmbral: ${String(threshold || '')}\n` +
    (since ? `Desde: ${since}\n` : '') +
    `\nDiagnósticos: ${brand.panelUrl}`

  const html = renderPanelEmail({
    subject, preheader: `${String(metric || '')} superó el umbral de ${String(threshold || '')}`,
    title: `Alerta: ${safeMetric}`, contentHtml,
    ctaUrl: brand.panelUrl, ctaText: 'Ver diagnósticos',
    type: isCritical ? 'danger' : 'warning', icon: isCritical ? '🚨' : '⚠️',
  })

  return { subject, html, text }
}

export async function sendSystemAlertEmail({ to, metric, value, threshold, since = '', level = 'warning' }) {
  const { subject, html, text } = buildSystemAlertEmail({ metric, value, threshold, since, level })
  return sendMail({ to, subject, html, text })
}
