import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import dns from 'node:dns'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getAud, downloadStreamToFile, downloadToFile, fetchFromApis } from '../plugins/downloads-play.js'

async function server(t, handle) {
 const app = http.createServer(handle)
 await new Promise(resolve => app.listen(0, '127.0.0.1', resolve))
 t.after(() => new Promise(resolve => { app.close(resolve); app.closeAllConnections() }))
 return `http://127.0.0.1:${app.address().port}`
}

test('play recovers a blocked Melodia download through the current backup without exposing its key', async t => {
 let backupRequest
 const base = await server(t, async (req, res) => {
  if (req.url.startsWith('/primary/')) {
   assert.equal(req.headers['x-api-key'], 'fixture-private-key')
   res.writeHead(502, { 'content-type': 'application/json' })
   return res.end(JSON.stringify({ status: false, error: 'Provider blocked' }))
  }
  backupRequest = { method: req.method, url: new URL(req.url, base), headers: req.headers }
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ status: true, result: { url: 'https://media.googlevideo.com/fixture.m4a' } }))
 })
 const original = global.APIs, oldUrl = process.env.NEXRAY_API_URL
 global.APIs = { MelodyApi: { url: base + '/primary', key: 'fixture-private-key' }, delirius: { url: base + '/retired' }, yupra: { url: base + '/retired' } }
 process.env.NEXRAY_API_URL = base
 t.after(() => { global.APIs = original; if (oldUrl === undefined) delete process.env.NEXRAY_API_URL; else process.env.NEXRAY_API_URL = oldUrl })
 const result = await getAud('https://www.youtube.com/watch?v=PbD5tyvPycw')
 assert.equal(result?.api, 'Nexray')
 assert.equal(result.url, 'https://media.googlevideo.com/fixture.m4a')
 assert.equal(backupRequest.method, 'GET')
 assert.equal(backupRequest.url.pathname, '/downloader/v1/ytmp3')
 assert.equal(backupRequest.headers['x-api-key'], undefined)
 assert.equal(backupRequest.url.searchParams.get('url'), 'https://www.youtube.com/watch?v=PbD5tyvPycw')
 assert.equal(backupRequest.url.toString().includes('fixture-private-key'), false)
})

test('play skips a failed raw provider and does not request the retired backup domains', async t => {
 const calls = []
 const base = await server(t, (req, res) => {
  calls.push(req.url)
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ status: true, result: { url: 'https://media.googlevideo.com/audio.m4a' } }))
 })
 const original = global.APIs, oldUrl = process.env.NEXRAY_API_URL
 global.APIs = { MelodyApi: { url: base + '/primary', key: 'fixture' } }
 process.env.NEXRAY_API_URL = base
 t.after(() => { global.APIs = original; if (oldUrl === undefined) delete process.env.NEXRAY_API_URL; else process.env.NEXRAY_API_URL = oldUrl })
 const result = await getAud('https://www.youtube.com/watch?v=PbD5tyvPycw', 0, { skipMelodia: true })
 assert.equal(result?.api, 'Nexray')
 assert.equal(calls.length, 1)
 assert.equal(new URL(calls[0], base).pathname, '/downloader/v1/ytmp3')
})

test('search results without www and short links use one canonical YouTube URL for conversion', async t => {
 const inputs = []
 const base = await server(t, (req, res) => {
  inputs.push(new URL(req.url, base).searchParams.get('url'))
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ status: true, result: { url: 'https://media.googlevideo.com/audio.m4a' } }))
 })
 const original = global.APIs, oldUrl = process.env.NEXRAY_API_URL
 global.APIs = {}
 process.env.NEXRAY_API_URL = base
 t.after(() => { global.APIs = original; if (oldUrl === undefined) delete process.env.NEXRAY_API_URL; else process.env.NEXRAY_API_URL = oldUrl })
 for (const url of ['https://youtube.com/watch?v=PbD5tyvPycw', 'https://youtu.be/PbD5tyvPycw?si=tracking']) await getAud(url)
 assert.deepEqual(inputs, ['https://www.youtube.com/watch?v=PbD5tyvPycw', 'https://www.youtube.com/watch?v=PbD5tyvPycw'])
})

test('the full audio download sends Range bytes=0- and writes the complete file', async t => {
 const audio = Buffer.from('fixture-audio-content')
 const base = await server(t, (req, res) => {
  if (req.headers.range !== 'bytes=0-') { res.writeHead(403); return res.end() }
  res.writeHead(206, { 'content-type': 'audio/mp4' }); res.end(audio)
 })
 const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'oguri-range-test-'))
 t.after(() => fs.rm(directory, { recursive: true, force: true }))
 const file = path.join(directory, 'audio.m4a')
 assert.equal(await downloadToFile(base, file), audio.length)
 assert.deepEqual(await fs.readFile(file), audio)
})

test('an HTTP200 HTML page is rejected before FFmpeg receives it', async t => {
 const base = await server(t, (req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<html>Not an audio file</html>') })
 const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'oguri-html-test-'))
 t.after(() => fs.rm(directory, { recursive: true, force: true }))
 await assert.rejects(downloadToFile(base, path.join(directory, 'audio.mp3')), /content-type|audio|multimedia/i)
})

test('audio uses IPv4 when a media host also advertises an unusable IPv6 address', async t => {
 const base = await server(t, (req, res) => { res.writeHead(200, { 'content-type': 'audio/mp4' }); res.end('fixture audio') })
 const original = dns.lookup
 dns.lookup = (hostname, options, callback) => {
  if (hostname !== 'dualstack.media.test') return original(hostname, options, callback)
  const ipv4 = options?.family === 4
  const address = ipv4 ? '127.0.0.1' : '::1', family = ipv4 ? 4 : 6
  if (options?.all) callback(null, [{ address, family }])
  else callback(null, address, family)
 }
 t.after(() => { dns.lookup = original })
 const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'oguri-ipv4-test-'))
 t.after(() => fs.rm(directory, { recursive: true, force: true }))
 const url = new URL(base)
 url.hostname = 'dualstack.media.test'
 assert.equal(await downloadToFile(url.toString(), path.join(directory, 'audio.m4a')), 13)
})

test('provider errors and malformed download links are not accepted as playable audio', async t => {
 const base = await server(t, (req, res) => {
  res.writeHead(req.url === '/error' ? 502 : 200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ url: req.url === '/bad' ? 'file:///etc/passwd' : 'https://ryin.info/audio.mp3' }))
 })
 for (const suffix of ['/error', '/bad']) {
  assert.equal(await fetchFromApis([{ api: 'fixture', endpoint: base + suffix, extractor: body => body.url }]), null)
 }
})

test('a Cloudflare HTML failure produces a useful error instead of displaying page markup', async t => {
 const base = await server(t, (req, res) => { res.writeHead(502, { 'content-type': 'text/html' }); res.end('<!DOCTYPE html><html>Bad gateway</html>') })
 const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'oguri-error-test-'))
 t.after(() => fs.rm(directory, { recursive: true, force: true }))
 await assert.rejects(downloadStreamToFile(base, path.join(directory, 'audio.mp3')), error => {
  assert.match(error.message, /HTTP 502/)
  assert.doesNotMatch(error.message, /DOCTYPE|<html>/i)
  return true
 })
})
