import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyChatTarget, selectBroadcastTargets, countTargetTypes } from '../lib/chat-targets.js'

test('clasifica canales por JID aunque tipo diga group', () => {
  assert.equal(classifyChatTarget({ wa_jid: '123@newsletter', tipo: 'group' }), 'channel')
  assert.equal(classifyChatTarget({ wa_jid: 'status@broadcast' }), 'channel')
})

test('clasifica comunidades usando metadata actual y legacy', () => {
  assert.equal(classifyChatTarget({ wa_jid: '1@g.us', isCommunity: true }), 'community')
  assert.equal(classifyChatTarget({ wa_jid: '2@g.us', isCommunityAnnounce: 'true' }), 'community')
  assert.equal(classifyChatTarget({ wa_jid: '3@g.us', tipo: 'community' }), 'community')
  assert.equal(classifyChatTarget({ wa_jid: '4@g.us', linkedParent: '1@g.us' }), 'group')
})

test('selecciona categorías sin mezclar grupos, canales y comunidades', () => {
  const records = [
    { wa_jid: 'g@g.us' },
    { wa_jid: 'c@newsletter' },
    { wa_jid: 'm@g.us', isCommunity: true },
  ]
  assert.deepEqual(selectBroadcastTargets(records, { groups: true }), ['g@g.us'])
  assert.deepEqual(selectBroadcastTargets(records, { channels: true }), ['c@newsletter'])
  assert.deepEqual(selectBroadcastTargets(records, { communities: true }), ['m@g.us'])
  assert.deepEqual(countTargetTypes(records, ['g@g.us', 'c@newsletter', 'm@g.us']), { groups: 1, channels: 1, communities: 1 })
})
