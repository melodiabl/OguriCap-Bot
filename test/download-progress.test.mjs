import test from 'node:test'
import assert from 'node:assert/strict'
import {
  estimateAudioBytes,
  isYoutubeShortUrl,
  selectMusicVideo,
  selectProgressTotal
} from '../plugins/downloads-play.js'

test('estimates streamed MP3 size from duration and bitrate', () => {
  assert.equal(estimateAudioBytes(304, 128), 4_864_000)
})

test('uses estimated size when a streaming response has no Content-Length', () => {
  assert.equal(selectProgressTotal(null, '4852644', 4_864_000), 4_852_644)
})

test('prefers the exact Content-Length over an estimate', () => {
  assert.equal(selectProgressTotal('4852000', '4852644', 4_864_000), 4_852_000)
})

test('falls back to the local estimate when the API sends no size headers', () => {
  assert.equal(selectProgressTotal(null, null, 4_864_000), 4_864_000)
})

test('recognizes YouTube Shorts URLs', () => {
  assert.equal(isYoutubeShortUrl('https://youtube.com/shorts/abcdefghijk'), true)
  assert.equal(isYoutubeShortUrl('https://youtube.com/watch?v=abcdefghijk'), false)
})

test('selects a music video and ignores Shorts and unrelated videos', () => {
  const result = selectMusicVideo([
    { type: 'video', title: 'Funny short', url: 'https://youtube.com/shorts/abcdefghijk', videoId: 'abcdefghijk', author: { name: 'Memes' } },
    { type: 'video', title: 'Unrelated documentary', url: 'https://youtube.com/watch?v=bbbbbbbbbbb', videoId: 'bbbbbbbbbbb', author: { name: 'Docs' } },
    { type: 'video', title: 'My Song (Official Video)', url: 'https://youtube.com/watch?v=ccccccccccc', videoId: 'ccccccccccc', author: { name: 'Artist' } }
  ])

  assert.equal(result.videoId, 'ccccccccccc')
})

test('returns null when there is no related music video', () => {
  assert.equal(selectMusicVideo([
    { type: 'video', title: 'Cooking tutorial', url: 'https://youtube.com/watch?v=ddddddddddd', videoId: 'ddddddddddd', author: { name: 'Chef' } }
  ]), null)
})
