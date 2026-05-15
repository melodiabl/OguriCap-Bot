/**
 * lib/web-push.js
 * Server-side Web Push (VAPID) — send notifications to subscribed browsers.
 */
import webpush from 'web-push'

let initialized = false

function init() {
  if (initialized) return
  const pub = process.env.VAPID_PUBLIC_KEY?.trim()
  const priv = process.env.VAPID_PRIVATE_KEY?.trim()
  const email = process.env.VAPID_EMAIL?.trim() || 'mailto:admin@localhost'
  if (!pub || !priv) return
  webpush.setVapidDetails(email, pub, priv)
  initialized = true
}

/**
 * Send a push notification to a single subscription object.
 * @param {object} subscription - PushSubscription from the browser
 * @param {object} payload - { title, body, icon, badge, url, tag }
 */
export async function sendPush(subscription, payload) {
  init()
  if (!initialized) return { ok: false, error: 'VAPID not configured' }
  try {
    await webpush.sendNotification(subscription, JSON.stringify({
      title: payload.title || 'OguriCap Bot',
      body: payload.body || '',
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/icon-96x96.png',
      tag: payload.tag || `push-${Date.now()}`,
      url: payload.url || '/',
      data: payload.data || {},
    }))
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message, statusCode: err.statusCode }
  }
}

/**
 * Broadcast push to all stored subscriptions. Removes expired ones (410/404).
 * @param {object} panelDb
 * @param {object} payload
 */
export async function broadcastPush(panelDb, payload) {
  init()
  if (!initialized) return
  const subs = Array.isArray(panelDb?.pushSubscriptions) ? panelDb.pushSubscriptions : []
  if (!subs.length) return

  const expired = []
  await Promise.all(subs.map(async (sub) => {
    const result = await sendPush(sub.subscription, payload)
    if (!result.ok && (result.statusCode === 410 || result.statusCode === 404)) {
      expired.push(sub.id)
    }
  }))

  if (expired.length) {
    panelDb.pushSubscriptions = subs.filter(s => !expired.includes(s.id))
    if (global.db?.write) await global.db.write()
  }
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null
}
