function isTruthy(value) {
  return value === true || value === 1 || String(value || '').toLowerCase() === 'true'
}

export function getTargetJid(target = {}) {
  return String(target?.wa_jid || target?.jid || '').trim()
}

export function classifyChatTarget(target = {}) {
  const jid = getTargetJid(target).toLowerCase()
  const storedType = String(target?.tipo || target?.type || '').trim().toLowerCase()

  if (jid.endsWith('@newsletter') || jid.endsWith('@broadcast')) return 'channel'
  if (isTruthy(target?.isCommunity) || isTruthy(target?.isCommunityAnnounce)) return 'community'
  if (storedType === 'channel' || storedType === 'community') return storedType
  return 'group'
}

export function selectBroadcastTargets(groups, targets = {}) {
  const records = Array.isArray(groups) ? groups : Object.values(groups || {})
  const specific = Array.isArray(targets?.specific) ? targets.specific.filter(Boolean) : []
  if (specific.length) return [...new Set(specific)]

  const enabledTypes = new Set([
    targets?.groups && 'group',
    targets?.channels && 'channel',
    targets?.communities && 'community',
  ].filter(Boolean))

  return [...new Set(records
    .filter((record) => enabledTypes.has(classifyChatTarget(record)))
    .map(getTargetJid)
    .filter(Boolean))]
}

export function countTargetTypes(groups, jids) {
  const records = Array.isArray(groups) ? groups : Object.values(groups || {})
  const byJid = new Map(records.map((record) => [getTargetJid(record), record]))
  const stats = { groups: 0, channels: 0, communities: 0 }
  for (const jid of jids || []) {
    const type = classifyChatTarget(byJid.get(jid) || { wa_jid: jid })
    if (type === 'channel') stats.channels++
    else if (type === 'community') stats.communities++
    else stats.groups++
  }
  return stats
}
