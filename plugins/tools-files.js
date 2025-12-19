import fs from 'fs'
import path from 'path'
import { lookup } from 'mime-types'
import AdmZip from 'adm-zip'

const formatBytes = (value) => {
  const num = Number(value || 0)
  if (!Number.isFinite(num) || num <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = num
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit++
  }
  const fixed = size >= 10 || unit === 0 ? 0 : 1
  return `${size.toFixed(fixed)} ${units[unit]}`
}

const sanitizeName = (value) => {
  const cleaned = String(value || '')
    .replace(/[<>:"/\\|?*]+/g, '')
    .replace(/\s+/g, '_')
    .trim()
  return cleaned || 'archivo'
}

const getTextInput = (m, text) => {
  if (text && text.trim()) return text.trim()
  const q = m.quoted || {}
  return (q.text || q.caption || '').trim()
}

const splitTitleAndBody = (input) => {
  const parts = String(input || '').split('|').map(s => s.trim())
  if (parts.length >= 2) {
    const title = parts.shift()
    const body = parts.join('|').trim()
    return { title, body }
  }
  return { title: 'documento', body: String(input || '').trim() }
}

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true })
}

const downloadToFile = async (q, label) => {
  const msg = q.msg || q
  const mime = msg.mimetype || q.mediaType || ''
  if (!mime || typeof q.download !== 'function') return null
  const downloaded = await q.download(true)
  const targetDir = path.join(process.cwd(), 'tmp', label)
  ensureDir(targetDir)

  if (typeof downloaded === 'string' && fs.existsSync(downloaded)) {
    const base = path.basename(downloaded)
    const dest = path.join(targetDir, base)
    if (dest !== downloaded) {
      try {
        fs.renameSync(downloaded, dest)
      } catch {
        fs.copyFileSync(downloaded, dest)
      }
    }
    return dest
  }

  if (Buffer.isBuffer(downloaded)) {
    const ext = mime.split('/')[1] || 'bin'
    const dest = path.join(targetDir, `file_${Date.now()}.${ext}`)
    fs.writeFileSync(dest, downloaded)
    return dest
  }

  return null
}

const listFiles = (dir) => {
  const results = []
  const stack = [dir]
  while (stack.length) {
    const current = stack.pop()
    const entries = fs.readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
      } else if (entry.isFile()) {
        const stat = fs.statSync(full)
        results.push({
          path: full,
          size: stat.size,
          rel: path.relative(process.cwd(), full)
        })
      }
    }
  }
  return results
}

const toAscii = (value) => String(value || '').replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?')

const wrapLines = (text, maxLen) => {
  const lines = []
  for (const line of String(text || '').split(/\r?\n/)) {
    if (line.length <= maxLen) {
      lines.push(line)
      continue
    }
    let rest = line
    while (rest.length > maxLen) {
      lines.push(rest.slice(0, maxLen))
      rest = rest.slice(maxLen)
    }
    if (rest) lines.push(rest)
  }
  return lines
}

const createSimplePdf = (text) => {
  const safe = toAscii(text)
  const lines = wrapLines(safe, 90)
  const contentLines = ['BT', '/F1 12 Tf', '72 720 Td']
  for (const line of lines) {
    const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
    contentLines.push(`(${escaped}) Tj`)
    contentLines.push('0 -14 Td')
  }
  contentLines.push('ET')
  const content = contentLines.join('\n')

  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj'
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'binary'))
    pdf += obj + '\n'
  }

  const xrefOffset = Buffer.byteLength(pdf, 'binary')
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let i = 1; i <= objects.length; i++) {
    const off = String(offsets[i]).padStart(10, '0')
    pdf += `${off} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return Buffer.from(pdf, 'binary')
}

const runZip = (inputPath, outputZip) => {
  const zip = new AdmZip()
  const stat = fs.statSync(inputPath)
  if (stat.isDirectory()) {
    zip.addLocalFolder(inputPath)
  } else {
    zip.addLocalFile(inputPath)
  }
  zip.writeZip(outputZip)
}

const runUnzip = (zipPath, destDir) => {
  const zip = new AdmZip(zipPath)
  zip.extractAllTo(destDir, true)
}

let handler = async (m, { conn, args, text, usedPrefix, command }) => {
  try {
    switch (command) {
      case 'file': {
        const q = m.quoted ? m.quoted : m
        const msg = q.msg || q
        const mime = msg.mimetype || q.mediaType || ''
        const fileName = msg.fileName || 'archivo'
        const fileLength = Number(msg.fileLength || msg.fileLengthLow || 0)

        if (mime) {
          const info = [
            `nombre: ${fileName}`,
            `tipo: ${mime}`,
            `tamano: ${formatBytes(fileLength)}`
          ].join('\n')
          return m.reply(`Info de archivo\n\n${info}`)
        }

        if (!args || !args.length) {
          return m.reply(`Uso: ${usedPrefix}file (responde a un archivo) o ${usedPrefix}file <ruta_local>`)
        }

        const inputPath = args.join(' ')
        if (!fs.existsSync(inputPath)) return m.reply('Archivo no encontrado.')
        const stat = fs.statSync(inputPath)
        const mimeType = lookup(inputPath) || 'application/octet-stream'
        const info = [
          `nombre: ${path.basename(inputPath)}`,
          `tipo: ${mimeType}`,
          `tamano: ${formatBytes(stat.size)}`,
          `ruta: ${path.relative(process.cwd(), inputPath)}`
        ].join('\n')
        return m.reply(`Info de archivo\n\n${info}`)
      }
      case 'doc': {
        const input = getTextInput(m, text)
        if (!input) return m.reply(`Uso: ${usedPrefix}doc titulo | contenido`)
        const { title, body } = splitTitleAndBody(input)
        const safeTitle = sanitizeName(title || 'documento')
        const dir = path.join(process.cwd(), 'tmp', 'docs')
        ensureDir(dir)
        const filePath = path.join(dir, `${safeTitle}.doc`)
        fs.writeFileSync(filePath, body || ' ')
        await conn.sendMessage(m.chat, { document: fs.readFileSync(filePath), mimetype: 'application/msword', fileName: `${safeTitle}.doc` }, { quoted: m })
        return
      }
      case 'pdf': {
        const input = getTextInput(m, text)
        if (!input) return m.reply(`Uso: ${usedPrefix}pdf titulo | contenido`)
        const { title, body } = splitTitleAndBody(input)
        const safeTitle = sanitizeName(title || 'documento')
        const dir = path.join(process.cwd(), 'tmp', 'docs')
        ensureDir(dir)
        const filePath = path.join(dir, `${safeTitle}.pdf`)
        const buffer = createSimplePdf(body || ' ')
        fs.writeFileSync(filePath, buffer)
        await conn.sendMessage(m.chat, { document: fs.readFileSync(filePath), mimetype: 'application/pdf', fileName: `${safeTitle}.pdf` }, { quoted: m })
        return
      }
      case 'zip': {
        let inputPath = null
        const target = m.quoted ? m.quoted : m
        if (target) inputPath = await downloadToFile(target, 'zip')
        if (!inputPath && args && args.length) {
          const candidate = args.join(' ')
          if (fs.existsSync(candidate)) inputPath = candidate
        }
        if (!inputPath) {
          return m.reply(`Uso: ${usedPrefix}zip (responde a un archivo) o ${usedPrefix}zip <ruta_local>`)
        }

        const base = path.basename(inputPath, path.extname(inputPath)) || 'archivo'
        const outDir = path.join(process.cwd(), 'tmp', 'archives')
        ensureDir(outDir)
        const zipPath = path.join(outDir, `${sanitizeName(base)}.zip`)

        await runZip(inputPath, zipPath)
        await conn.sendMessage(m.chat, { document: fs.readFileSync(zipPath), mimetype: 'application/zip', fileName: path.basename(zipPath) }, { quoted: m })
        return
      }
      case 'unzip': {
        let zipPath = null
        const target = m.quoted ? m.quoted : m
        if (target) zipPath = await downloadToFile(target, 'zip')
        if (!zipPath && args && args.length) {
          const candidate = args.join(' ')
          if (fs.existsSync(candidate)) zipPath = candidate
        }
        if (!zipPath) {
          return m.reply(`Uso: ${usedPrefix}unzip (responde a un .zip) o ${usedPrefix}unzip <ruta_local>`)
        }

        const base = path.basename(zipPath, path.extname(zipPath)) || 'extraido'
        const outDir = path.join(process.cwd(), 'tmp', 'unzipped', `${sanitizeName(base)}_${Date.now()}`)
        ensureDir(outDir)

        await runUnzip(zipPath, outDir)
        const files = listFiles(outDir)
        if (!files.length) return m.reply('Archivo descomprimido, pero no se encontraron archivos.')

        const preview = files.slice(0, 20).map((file, i) => {
          return `${i + 1}. ${file.rel} (${formatBytes(file.size)})`
        }).join('\n')

        let msg = `Descomprimido: ${files.length} archivo(s)\n${preview}`
        if (files.length > 20) msg += '\n...'
        msg += `\ncarpeta: ${path.relative(process.cwd(), outDir)}`
        return m.reply(msg)
      }
      default:
        return null
    }
  } catch (e) {
    return m.reply(`Error: ${e.message || e}`)
  }
}

handler.help = ['file', 'doc', 'pdf', 'zip', 'unzip']
handler.tags = ['tools']
handler.command = ['file', 'doc', 'pdf', 'zip', 'unzip']

export default handler
