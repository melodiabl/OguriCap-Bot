import { emitTerminalLine } from './socket-io.js'

let installed = false
let nextId = 1

const state = {
  stdoutCarry: '',
  stderrCarry: '',
  maxLines: 2000,
  buffer: [],
}

function coerceString(chunk, encoding) {
  if (typeof chunk === 'string') return chunk
  if (Buffer.isBuffer(chunk)) return chunk.toString(typeof encoding === 'string' ? encoding : 'utf8')
  try {
    return String(chunk)
  } catch {
    return ''
  }
}

function pushLine(stream, line) {
  const ts = new Date().toISOString()
  const clean = String(line || '').replace(/\r$/, '')
  const entry = { id: nextId++, timestamp: ts, stream, line: clean }

  state.buffer.push(entry)
  if (state.buffer.length > state.maxLines) {
    state.buffer.splice(0, state.buffer.length - state.maxLines)
  }

  emitTerminalLine(entry)
}

function consumeChunk(stream, chunkStr) {
  if (!chunkStr) return

  const carryKey = stream === 'stderr' ? 'stderrCarry' : 'stdoutCarry'
  state[carryKey] += chunkStr

  let idx
  while ((idx = state[carryKey].indexOf('\n')) !== -1) {
    const line = state[carryKey].slice(0, idx)
    state[carryKey] = state[carryKey].slice(idx + 1)
    pushLine(stream, line)
  }
}

export function installTerminalMirror(opts = {}) {
  if (installed) return
  installed = true

  const max = Number(opts.maxLines ?? process.env.PANEL_TERMINAL_MAX ?? 2000)
  if (Number.isFinite(max) && max > 0) state.maxLines = max

  const origStdoutWrite = process.stdout.write.bind(process.stdout)
  const origStderrWrite = process.stderr.write.bind(process.stderr)

  process.stdout.write = function patchedStdoutWrite(chunk, encoding, cb) {
    try {
      consumeChunk('stdout', coerceString(chunk, encoding))
    } catch {}
    return origStdoutWrite(chunk, encoding, cb)
  }

  process.stderr.write = function patchedStderrWrite(chunk, encoding, cb) {
    try {
      consumeChunk('stderr', coerceString(chunk, encoding))
    } catch {}
    return origStderrWrite(chunk, encoding, cb)
  }
}

export function getTerminalLines(limit = 200) {
  const lim = Number(limit)
  const n = Number.isFinite(lim) && lim > 0 ? Math.min(lim, state.buffer.length) : state.buffer.length
  return state.buffer.slice(state.buffer.length - n)
}

export function clearTerminalLines() {
  state.stdoutCarry = ''
  state.stderrCarry = ''
  state.buffer = []
}

export default {
  installTerminalMirror,
  getTerminalLines,
  clearTerminalLines,
}

