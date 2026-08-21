export const PUBLIC_SELF_COMMANDS = new Set([
  'menu',
  'menú',
  'help',
  'allmenu',
  'ayuda',
])

export function canUseCommandInSelfMode({ isOwner, selfMode, command }) {
  if (isOwner || !selfMode) return true
  return PUBLIC_SELF_COMMANDS.has(String(command || '').toLowerCase())
}
