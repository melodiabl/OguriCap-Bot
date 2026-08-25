import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeMelodiaYouTubeResults, selectMusicVideo } from '../plugins/downloads-play.js'

test('play accepts the normalized MelodiaAPI search contract', () => {
 const videos = normalizeMelodiaYouTubeResults([{ videoId: 'YuMW7h25Euo', title: 'Canción official audio', channel: 'Canal', duration: '3:10', imageUrl: 'https://img.test/a.jpg' }])
 const selected = selectMusicVideo(videos)
 assert.equal(selected.videoId, 'YuMW7h25Euo')
 assert.equal(selected.author.name, 'Canal')
 assert.equal(selected.timestamp, '3:10')
})
