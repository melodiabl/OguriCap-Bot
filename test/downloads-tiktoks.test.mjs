import test from 'node:test'
import assert from 'node:assert/strict'
import { createTikTokCaption } from '../plugins/downloads-tiktoks.js'

test('TikTok caption includes complete normalized information', () => {
  const caption = createTikTokCaption({
    title: 'Video', author: { nickname: 'Autor', unique_id: 'autor' }, duration: 19,
    created_at: 1700000000, stats: { likes: 10, comments: 2, views: 30, shares: 4 },
    music: { title: 'Audio', author: 'Músico' }
  }, 'https://tiktok.com/video')
  for (const value of ['🅣𝗂𝗄𝖳𝗈𝗄', 'Video', 'Autor', '@autor', '19s', 'Likes: 10', 'Comentarios: 2', 'Vistas: 30', 'Compartidos: 4', 'Audio — Músico', 'https://tiktok.com/video']) {
    assert.ok(caption.includes(value), value)
  }
})
