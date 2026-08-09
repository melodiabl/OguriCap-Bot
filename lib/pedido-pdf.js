import fs from 'fs'
import path from 'path'
import PDFDocumentImport from 'pdfkit'

const safeString = (v) => (v == null ? '' : typeof v === 'string' ? v : String(v))

const ensureDir = (dirPath) => {
  try {
    fs.mkdirSync(dirPath, { recursive: true })
  } catch {}
}

const formatDateTime = (iso) => {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return safeString(iso || '')
    return d.toISOString().replace('T', ' ').slice(0, 19)
  } catch {
    return safeString(iso || '')
  }
}

export async function generatePedidoSummaryPdf({ pedido, selected, outputDir } = {}) {
  const PDFDocument = PDFDocumentImport?.default || PDFDocumentImport
  if (typeof PDFDocument !== 'function') throw new Error('pdfkit no disponible')

  const dir = outputDir ? path.resolve(outputDir) : path.resolve(process.cwd(), 'storage', 'pedidos')
  ensureDir(dir)

  const pedidoId = safeString(pedido?.id || '').replace(/[^0-9]/g, '') || '0'
  const filename = `pedido_${pedidoId || '0'}_resumen.pdf`
  const filePath = path.join(dir, filename)

  await new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 48,
        info: {
          Title: `Pedido #${pedidoId} - Resumen`,
          Author: 'Oguri Bot',
        },
      })

      const stream = fs.createWriteStream(filePath)
      stream.on('finish', resolve)
      stream.on('error', reject)
      doc.pipe(stream)

      doc.fontSize(20).text(`Pedido #${pedidoId}`, { align: 'left' })
      doc.moveDown(0.2)
      doc.fontSize(12).fillColor('#444').text('Resumen de procesamiento automático', { align: 'left' })
      doc.moveDown(1)

      doc.fillColor('#000')
      doc.fontSize(12).text(`Título: ${safeString(pedido?.titulo || 'Sin título')}`)
      doc.moveDown(0.3)
      doc.text(`Descripción: ${safeString(pedido?.descripcion || 'Sin descripción')}`)
      doc.moveDown(0.3)
      if (pedido?.temporada != null && safeString(pedido.temporada).trim()) {
        doc.text(`Temporada: ${safeString(pedido.temporada)}`)
        doc.moveDown(0.3)
      }
      const capFrom = safeString(pedido?.capitulo_desde || pedido?.capitulo || '').trim()
      const capTo = safeString(pedido?.capitulo_hasta || '').trim()
      if (capFrom) {
        const capTxt = capTo && capTo !== capFrom ? `${capFrom}-${capTo}` : capFrom
        doc.text(`Capítulo(s): ${capTxt}`)
        doc.moveDown(0.3)
      }
      doc.text(`Usuario: ${safeString(pedido?.usuario || '')}`)
      doc.moveDown(0.3)
      doc.text(`Fecha: ${formatDateTime(pedido?.fecha_creacion || pedido?.created_at || new Date().toISOString())}`)
      doc.moveDown(1)

      doc.fontSize(14).text('Resultado seleccionado', { underline: true })
      doc.moveDown(0.5)
      doc.fontSize(12).text(`Origen: ${safeString(selected?.source || '-')}`)
      doc.moveDown(0.2)
      doc.text(`ID: ${safeString(selected?.id || '-')}`)
      doc.moveDown(0.2)
      doc.text(`Título: ${safeString(selected?.title || '-')}`)
      const filenameSel = safeString(selected?.filename || '').trim()
      if (filenameSel) {
        doc.moveDown(0.2)
        doc.text(`Archivo: ${filenameSel}`)
      }
      const formatSel = safeString(selected?.format || '').trim()
      if (formatSel) {
        doc.moveDown(0.2)
        doc.text(`Formato: ${formatSel}`)
      }
      const contentType = safeString(selected?.contentType || '').trim()
      if (contentType) {
        doc.moveDown(0.2)
        doc.text(`Tipo de contenido: ${contentType.toUpperCase()}`)
        if (contentType.toLowerCase() !== 'main') {
          doc.moveDown(0.2)
          doc.fillColor('#b45309').text('Advertencia: Este contenido no forma parte de la historia principal.')
          doc.fillColor('#000')
        }
      }
      const coverageType = safeString(selected?.coverageType || '').trim()
      if (coverageType) {
        doc.moveDown(0.2)
        doc.text(`Cobertura: ${coverageType}`)
      }
      const contentSource = safeString(selected?.contentSource || '').trim()
      if (contentSource) {
        doc.moveDown(0.2)
        doc.text(`Fuente de contenido: ${contentSource}`)
      }
      if (selected?.season != null) {
        doc.moveDown(0.2)
        doc.text(`Temporada: ${safeString(selected.season)}`)
      }
      const chFrom = safeString(selected?.chapterFrom || '').trim()
      const chTo = safeString(selected?.chapterTo || '').trim()
      if (chFrom) {
        const chTxt = chTo && chTo !== chFrom ? `${chFrom}-${chTo}` : chFrom
        doc.moveDown(0.2)
        doc.text(`Capítulo(s): ${chTxt}`)
      } else if (selected?.chapter != null) {
        doc.moveDown(0.2)
        doc.text(`Capítulo: ${safeString(selected.chapter)}`)
      }
      const sizeMB = typeof selected?.sizeMB === 'number' && Number.isFinite(selected.sizeMB) ? selected.sizeMB : null
      if (sizeMB != null) {
        doc.moveDown(0.2)
        doc.text(`Tamaño: ${safeString(sizeMB)} MB`)
      }
      const pageCount = typeof selected?.pageCount === 'number' && Number.isFinite(selected.pageCount) ? selected.pageCount : null
      if (pageCount != null) {
        doc.moveDown(0.2)
        doc.text(`Páginas (estimado): ${safeString(pageCount)}`)
      }
      if (selected?.score != null) {
        doc.moveDown(0.2)
        doc.text(`Score: ${safeString(selected.score)}`)
      }
      doc.moveDown(1.2)

      doc.fontSize(10).fillColor('#666').text('Generado automáticamente por Oguri Bot.', { align: 'left' })
      doc.moveDown(0.2)
      doc.text(`Estado final: COMPLETADO`, { align: 'left' })
      doc.moveDown(0.2)
      doc.text('Procesado por: BOT', { align: 'left' })

      doc.end()
    } catch (err) {
      reject(err)
    }
  })

  return { filePath, filename }
}

export const generatePedidoPDF = generatePedidoSummaryPdf
