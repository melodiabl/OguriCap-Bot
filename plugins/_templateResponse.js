import baileys from 'baileys'

const { proto, generateWAMessage, areJidsSameUser } = baileys.default || baileys
const BRIDGE_ENABLED = process.env.INTERACTIVE_BRIDGE === '1'

function getInteractivePayload(message = {}) {
  const buttons = message?.buttonsResponseMessage
  const template = message?.templateButtonReplyMessage
  const list = message?.listResponseMessage
  const interactive = message?.interactiveResponseMessage

  if (buttons) {
    return {
      id: String(buttons.selectedButtonId || '').trim(),
      text: String(buttons.selectedDisplayText || '').trim(),
      type: 'buttonsResponseMessage',
    }
  }

  if (template) {
    return {
      id: String(template.selectedId || '').trim(),
      text: String(template.selectedDisplayText || '').trim(),
      type: 'templateButtonReplyMessage',
    }
  }

  if (list) {
    return {
      id: String(list.singleSelectReply?.selectedRowId || '').trim(),
      text: String(list.title || '').trim(),
      type: 'listResponseMessage',
    }
  }

  if (interactive) {
    let parsedId = ''
    let parsedText = ''
    try {
      const raw =
        interactive?.nativeFlowResponseMessage?.paramsJson ||
        interactive?.paramsJson ||
        ''
      if (typeof raw === 'string' && raw.trim()) {
        const json = JSON.parse(raw)
        parsedId = String(
          json?.id ||
            json?.selectedId ||
            json?.selectedRowId ||
            json?.rowId ||
            json?.selectedButtonId ||
            ''
        ).trim()
        parsedText = String(
          json?.text ||
            json?.title ||
            json?.display_text ||
            ''
        ).trim()
      }
    } catch {
      // ignore invalid paramsJson
    }
    return {
      id: parsedId,
      text: parsedText,
      type: 'interactiveResponseMessage',
    }
  }

  return null
}

function isCommandId(conn, idText = '') {
  const id = String(idText || '').trim()
  if (!id) return false

  const strRegex = (str) => str.replace(/[|\\{}()[\]^$+*?.\-]/g, '\\$&')
  for (const plugin of Object.values(global.plugins || {})) {
    if (!plugin || plugin.disabled || typeof plugin !== 'function' || !plugin.command) continue
    if (!global?.opts?.restrict && plugin.tags?.includes('admin')) continue

    const pfx = plugin.customPrefix || conn?.prefix || global.prefix
    const match = (
      pfx instanceof RegExp
        ? [[pfx.exec(id), pfx]]
        : Array.isArray(pfx)
          ? pfx.map((p) => {
              const re = p instanceof RegExp ? p : new RegExp(strRegex(p))
              return [re.exec(id), re]
            })
          : typeof pfx === 'string'
            ? [[new RegExp(strRegex(pfx)).exec(id), new RegExp(strRegex(pfx))]]
            : [[[], new RegExp()]]
    ).find((x) => x[1])

    const usedPrefix = (match?.[0] || [])[0]
    if (!usedPrefix) continue

    const noPrefix = id.replace(usedPrefix, '').trim()
    const [command = ''] = noPrefix.split(/\s+/)
    const cmd = String(command || '').toLowerCase()
    if (!cmd) continue

    const ok =
      plugin.command instanceof RegExp
        ? plugin.command.test(cmd)
        : Array.isArray(plugin.command)
          ? plugin.command.some((c) => (c instanceof RegExp ? c.test(cmd) : c === cmd))
          : typeof plugin.command === 'string'
            ? plugin.command === cmd
            : false

    if (ok) return true
  }

  return false
}

export async function all(m, { chatUpdate }) {
  try {
    if (!BRIDGE_ENABLED) return
    if (m?.isBaileys) return
    if (!m?.message || typeof m.message !== 'object') return

    const payload = getInteractivePayload(m.message)
    if (!payload) return

    const id = String(payload.id || '').trim()
    const text = String(payload.text || '').trim()
    const outgoingText = isCommandId(this, id) ? id : (id || text)
    if (!outgoingText) return

    const generated = await generateWAMessage(
      m.chat,
      { text: outgoingText, mentions: m.mentionedJid || [] },
      {
        userJid: this.user?.id || this.user?.jid,
        quoted: m.quoted?.fakeObj,
      }
    )

    generated.key.fromMe = areJidsSameUser(m.sender, this.user?.id || this.user?.jid)
    // Mantener ID original evita que serialize marque el mensaje como "isBaileys"
    generated.key.id = m.key?.id || generated.key.id
    generated.pushName = m.name
    if (m.isGroup) generated.key.participant = generated.participant = m.sender

    const upsert = {
      ...(chatUpdate || {}),
      messages: [proto.WebMessageInfo.fromObject(generated)].map((v) => ((v.conn = this), v)),
      type: 'append',
    }

    this.ev.emit('messages.upsert', upsert)
  } catch {
    // ignore
  }
}
