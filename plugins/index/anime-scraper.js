import axios from 'axios'
import cheerio from 'cheerio'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import m3u8Parser from 'm3u8-parser'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const animeSites = {
  gogoanime: {
    base: 'https://gogoanime.pe',
    search: (q) => `https://gogoanime.pe/search.html?keyword=${encodeURIComponent(q)}`,
    parseSearch: ($) => {
      const results = []
      $('.items .img a, .film-list .name a, .last-episodes .item .name a').each((i, el) => {
        const href = $(el).attr('href')
        if (href) {
          results.push({
            title: $(el).attr('title') || $(el).find('img').attr('alt') || $(el).text().trim(),
            url: href.startsWith('http') ? href : 'https:' + href,
            img: $(el).find('img').attr('src') || $(el).find('img').attr('data-src')
          })
        }
      })
      return results
    },
    getEpisodes: async (url) => {
      try {
        const res = await axios.get(url, { 
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://gogoanime.pe/'
          }, 
          timeout: 15000 
        })
        const $ = cheerio.load(res.data)
        const episodes = []
        $('#episode_related a, .episode-list a, ul#episode_page li a').each((i, el) => {
          const href = $(el).attr('href')
          if (href) {
            episodes.push({
              ep: $(el).text().trim(),
              url: href.startsWith('http') ? href : 'https://gogoanime.pe' + href
            })
          }
        })
        return episodes.length ? episodes.reverse() : episodes
      } catch (e) {
        console.error('Error getEpisodes:', e.message)
        return []
      }
    },
    getVideoServers: async (episodeUrl) => {
      try {
        const res = await axios.get(episodeUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://gogoanime.pe/'
          },
          timeout: 15000
        })
        const $ = cheerio.load(res.data)
        const servers = []
        
        $('.anime_muti_link li a, .mirror_link a').each((i, el) => {
          const href = $(el).attr('data-video') || $(el).attr('href')
          const name = $(el).text().trim() || $(el).attr('title')
          if (href) {
            servers.push({ name, url: href.startsWith('//') ? 'https:' + href : href })
          }
        })
        
        return servers
      } catch {
        return []
      }
    }
  },
  animeflv: {
    base: 'https://www3.animeflv.net',
    search: (q) => `https://www3.animeflv.net/browse?q=${encodeURIComponent(q)}`,
    parseSearch: ($) => {
      const results = []
      $('.ListAnimes .Anime, .AnimeList .Anime, .lista-animes .anime').each((i, el) => {
        const link = $(el).find('a').first()
        results.push({
          title: $(el).find('.Title, h3, .titulo').text().trim() || link.attr('title'),
          url: link.attr('href')?.startsWith('http') ? link.attr('href') : 'https://www3.animeflv.net' + link.attr('href'),
          img: $(el).find('img').attr('src')
        })
      })
      return results
    },
    getDownloadLink: async (episodeUrl) => {
      try {
        const res = await axios.get(episodeUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Language': 'es-ES,es;q=0.9'
          },
          timeout: 15000,
          maxRedirects: 3
        })
        
        const $ = cheerio.load(res.data)
        let downloadUrl = null
        
        $('#download, .btn-download, a[href*="download"], .fakelink').each((i, el) => {
          const href = $(el).attr('href') || $(el).attr('data-url')
          if (href && (href.includes('.mp4') || href.includes('drive') || href.includes('mediafire'))) {
            downloadUrl = href
          }
        })
        
        return downloadUrl
      } catch {
        return null
      }
    }
  },
  jkanime: {
    base: 'https://jkanime.net',
    search: (q) => `https://jkanime.net/?s=${encodeURIComponent(q)}`,
    parseSearch: ($) => {
      const results = []
      $('.list-series .item a, .result-item a, .anime-list-item a').each((i, el) => {
        results.push({
          title: $(el).find('img').attr('alt') || $(el).attr('title') || $(el).find('.title, h3').text().trim(),
          url: $(el).attr('href'),
          img: $(el).find('img').attr('src')
        })
      })
      return results
    }
  },
  tioanime: {
    base: 'https://tioanime.com',
    search: (q) => `https://tioanime.com/directorio?q=${encodeURIComponent(q)}`,
    parseSearch: ($) => {
      const results = []
      $('.directorio .tit a, .anime-list-item a').each((i, el) => {
        results.push({
          title: $(el).text().trim() || $(el).attr('title'),
          url: 'https://tioanime.com' + $(el).attr('href'),
          img: $(el).find('img').attr('src')
        })
      })
      return results
    }
  }
}

const extractDirectLink = async (url) => {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': new URL(url).origin,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      },
      timeout: 20000,
      maxRedirects: 3
    })
    
    const $ = cheerio.load(res.data)
    const sources = []
    
    $('video source, iframe, [data-video], [data-src], .anime_muti_link li a, .vddiv iframe, .mirrors a').each((i, el) => {
      let src = $(el).attr('src') || $(el).attr('data-video') || $(el).attr('data-src') || $(el).attr('href')
      if (src && !src.includes('javascript') && !src.includes('#') && !src.includes('ads')) {
        if (src.startsWith('//')) src = 'https:' + src
        if (src.startsWith('/')) src = new URL(url).origin + src
        sources.push(src)
      }
    })
    
    const directSources = sources.filter(s => 
      s.includes('.mp4') || 
      s.includes('.m3u8') || 
      s.includes('tomatomatela') ||
      s.includes('rapidvid') ||
      s.includes('streamtape')
    )
    
    return directSources[0] || sources[0] || null
  } catch (e) {
    console.error('Error extrayendo link:', e.message)
    return null
  }
}

const parseM3U8 = async (m3u8Url) => {
  try {
    const res = await axios.get(m3u8Url, { timeout: 10000 })
    const parser = new m3u8Parser()
    parser.push(res.data)
    parser.end()
    return parser.manifest.segments.map(s => s.uri).filter(u => u)
  } catch {
    return []
  }
}

const downloadVideo = async (url, filepath) => {
  const writer = fs.createWriteStream(filepath)
  const response = await axios({ 
    url, 
    method: 'GET', 
    responseType: 'stream', 
    timeout: 120000,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': new URL(url).origin
    }
  })
  response.data.pipe(writer)
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve)
    writer.on('error', reject)
  })
}

const handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) return m.reply(`*Comandos de Anime:*

${usedPrefix}anime <nombre> - Buscar anime
${usedPrefix}animeep <url> - Ver episodios
${usedPrefix}animedl <url> - Link directo (sin redirecciones)
${usedPrefix}animedown <url> - Descargar episodio

_Ejemplo: ${usedPrefix}anime naruto_`)

  if (command === 'anime' || command === 'animesearch') {
    const results = []
    
    for (const [siteName, site] of Object.entries(animeSites)) {
      try {
        const res = await axios.get(site.search(text), {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
          },
          timeout: 10000
        })
        const $ = cheerio.load(res.data)
        const found = site.parseSearch($)
        results.push(...found.map(r => ({ ...r, site: siteName })))
      } catch (e) {
        console.error(`Error en ${siteName}:`, e.message)
      }
    }
    
    if (!results.length) return m.reply('No se encontraron resultados para: ' + text)
    
    let msg = `*Resultados para:* ${text}\n\n`
    results.slice(0, 8).forEach((a, i) => {
      msg += `${i + 1}. *${a.title}*\n   ${a.url}\n   _${a.site}_\n\n`
    })
    msg += `\n_Usa ${usedPrefix}animeep <url> para ver episodios_`
    
    await conn.sendMessage(m.chat, { text: msg }, { quoted: m })
  }
  
  if (command === 'animeep') {
    const site = Object.values(animeSites).find(s => text.includes(s.base))
    if (!site?.getEpisodes) return m.reply('Sitio no soportado para episodios')
    
    const episodes = await site.getEpisodes(text)
    if (!episodes.length) return m.reply('No se encontraron episodios')
    
    let msg = `*Episodios disponibles:*\n\n`
    episodes.slice(0, 15).forEach((ep, i) => {
      msg += `${i + 1}. ${ep.ep}: ${ep.url}\n`
    })
    msg += `\n_Usa ${usedPrefix}animedl <url> para obtener link directo_`
    
    await conn.sendMessage(m.chat, { text: msg }, { quoted: m })
  }
  
  if (command === 'animedl') {
    await conn.sendMessage(m.chat, { text: '⏳ Extrayendo link directo (eliminando redirecciones)...' }, { quoted: m })
    
    let directUrl = await extractDirectLink(text)
    
    if (!directUrl) {
      const site = animeSites.gogoanime
      if (site?.getVideoServers) {
        const servers = await site.getVideoServers(text)
        if (servers.length) {
          let msg = '*📺 Servidores disponibles:*\n\n'
          servers.forEach((s, i) => {
            msg += `${i + 1}. *${s.name || 'Server ' + (i+1)}*\n   ${s.url}\n\n`
          })
          return await conn.sendMessage(m.chat, { text: msg }, { quoted: m })
        }
      }
      return m.reply('❌ No se pudo obtener el link directo.\n💡 El sitio puede tener protección anti-bot activa.')
    }
    
    let msg = `*✓ Link Directo Obtenido:*\n\n${directUrl}\n\n`
    
    if (directUrl.includes('.m3u8')) {
      msg += '_📺 Stream HLS detectado (m3u8)_'
      const segments = await parseM3U8(directUrl)
      if (segments.length) {
        msg += `\n_Segmentos: ${segments.length}_`
      }
    } else if (directUrl.includes('.mp4')) {
      msg += '_🎬 Video MP4 directo_'
    }
    
    await conn.sendMessage(m.chat, { text: msg }, { quoted: m })
  }
  
  if (command === 'animedown') {
    await conn.sendMessage(m.chat, { text: '⏳ Obteniendo link y preparando descarga...' }, { quoted: m })
    
    let directUrl = await extractDirectLink(text)
    
    if (!directUrl) {
      const site = Object.values(animeSites).find(s => text.includes(s.base))
      if (site?.getDownloadLink) {
        directUrl = await site.getDownloadLink(text)
      }
      if (!directUrl) {
        return m.reply('❌ No se pudo obtener el link directo.\n\n💡 *Alternativas:*\n• Usa .animedl para ver servidores\n• Algunos sitios tienen protección anti-bot\n• Intenta con otro episodio o sitio')
      }
    }
    
    if (directUrl.includes('.m3u8')) {
      return m.reply('⚠️ El link es m3u8 (HLS Stream).\n💡 Usa .animedl para obtener el link y reproducir en VLC u otro reproductor compatible.')
    }
    
    const filename = `anime_${Date.now()}.mp4`
    const tmpDir = path.join(__dirname, '..', '..', 'tmp')
    
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
    
    const filepath = path.join(tmpDir, filename)
    
    try {
      await conn.sendMessage(m.chat, { text: '📥 Descargando video...\n_Esto puede tardar unos minutos_' }, { quoted: m })
      await downloadVideo(directUrl, filepath)
      
      const stats = fs.statSync(filepath)
      if (stats.size > 50 * 1024 * 1024) {
        await conn.sendMessage(m.chat, {
          document: fs.readFileSync(filepath),
          fileName: filename,
          caption: '✓ *Descargado exitosamente*'
        }, { quoted: m })
      } else {
        await conn.sendMessage(m.chat, {
          video: fs.readFileSync(filepath),
          caption: '✓ *Descargado exitosamente*'
        }, { quoted: m })
      }
      
      fs.unlinkSync(filepath)
    } catch (e) {
      m.reply('❌ Error descargando: ' + e.message + '\n\n💡 Intenta con otro servidor usando .animedl')
    }
  }
}

handler.help = ['anime <query>', 'animeep <url>', 'animedl <url>', 'animedown <url>']
handler.tags = ['anime', 'scraper', 'download']
handler.command = /^(anime|animesearch|animeep|animedl|animedown)$/i

export default handler
