/**
 * api/routes/store.js — /api/store/*
 * WooCommerce/WordPress connector for the bot panel and internal automations.
 */
import { json, getJwtAuth, safeString, clampInt } from '../middleware/core.js'

const CACHE_TTL_MS = 60 * 1000
const cache = new Map()

function isAdmin(user) {
  return ['owner', 'admin', 'administrador'].includes(safeString(user?.rol || '').toLowerCase())
}

function storeConfig() {
  const baseUrl = safeString(process.env.WOO_URL || process.env.WP_URL || '').replace(/\/+$/, '')
  const ck = safeString(process.env.WOO_CK || process.env.WC_CONSUMER_KEY || '')
  const cs = safeString(process.env.WOO_CS || process.env.WC_CONSUMER_SECRET || '')
  return { baseUrl, ck, cs, ready: Boolean(baseUrl && ck && cs) }
}

function authHeader(cfg) {
  return 'Basic ' + Buffer.from(cfg.ck + ':' + cfg.cs).toString('base64')
}

function cleanHtml(value, max = 400) {
  return safeString(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function publicProduct(product) {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku || '',
    price: product.price || '',
    regular_price: product.regular_price || '',
    sale_price: product.sale_price || '',
    stock_status: product.stock_status || '',
    categories: (product.categories || []).map(c => ({ id: c.id, name: c.name, slug: c.slug })),
    attributes: (product.attributes || []).map(a => ({ name: a.name, options: a.options || [] })),
    short_description: cleanHtml(product.short_description, 240),
    permalink: product.permalink || '',
    images: (product.images || []).slice(0, 3).map(i => ({ src: i.src, alt: i.alt || product.name || '' })),
  }
}

function publicOrder(order) {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    total: order.total,
    currency: order.currency,
    date_created: order.date_created,
    payment_method_title: order.payment_method_title,
    line_items: (order.line_items || []).map(i => ({
      name: i.name,
      quantity: i.quantity,
      total: i.total,
      sku: i.sku || '',
    })),
  }
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Number(process.env.WOO_TIMEOUT_MS || 8000))
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const text = await response.text()
    let body = null
    try { body = text ? JSON.parse(text) : null } catch { body = text }
    if (!response.ok) {
      const error = new Error(`woo_http_${response.status}`)
      error.status = response.status
      error.body = body
      throw error
    }
    return body
  } finally {
    clearTimeout(timeout)
  }
}

async function cached(key, load) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return { value: hit.value, cached: true }
  const value = await load()
  cache.set(key, { at: Date.now(), value })
  return { value, cached: false }
}

async function requireAdminOrApiKey(req) {
  const apiKey = safeString(process.env.PANEL_API_KEY || '')
  const given = safeString(req.headers['x-api-key'] || '')
  if (apiKey && given && given === apiKey) return { ok: true, via: 'api_key' }
  const auth = await getJwtAuth(req)
  if (!auth.ok) return auth
  if (!isAdmin(auth.user)) return { ok: false, status: 403, error: 'Permisos insuficientes' }
  return { ok: true, via: 'jwt', user: auth.user }
}

export async function handleStore({ req, res, url }) {
  const pathname = url.pathname
  const method = req.method.toUpperCase()
  const cfg = storeConfig()

  if (!pathname.startsWith('/api/store')) return null
  if (method !== 'GET') return json(res, 405, { error: 'Metodo no permitido' })
  if (!cfg.ready) return json(res, 503, { status: 'error', error: 'WooCommerce no configurado' })

  const wcHeaders = { Authorization: authHeader(cfg), Accept: 'application/json' }
  const wc = path => `${cfg.baseUrl}/wp-json/wc/v3${path}`
  const wp = path => `${cfg.baseUrl}/wp-json/wp/v2${path}`

  try {
    if (pathname === '/api/store/health') {
      const [wpRoot, products, categories] = await Promise.all([
        fetchJson(`${cfg.baseUrl}/wp-json/`),
        fetchJson(wc('/products?per_page=1&status=publish'), { headers: wcHeaders }),
        fetchJson(wc('/products/categories?per_page=1&hide_empty=true'), { headers: wcHeaders }),
      ])
      return json(res, 200, {
        status: 'ok',
        store: cfg.baseUrl,
        wordpress: Boolean(wpRoot?.namespaces),
        products: Array.isArray(products) ? products.length : 0,
        categories: Array.isArray(categories) ? categories.length : 0,
        cache_ttl_ms: CACHE_TTL_MS,
      })
    }

    if (pathname === '/api/store/categories') {
      const perPage = clampInt(url.searchParams.get('per_page'), { min: 1, max: 100, fallback: 100 })
      const key = `categories:${perPage}`
      const { value, cached: wasCached } = await cached(key, () =>
        fetchJson(wc(`/products/categories?per_page=${perPage}&hide_empty=true`), { headers: wcHeaders })
      )
      return json(res, 200, {
        cached: wasCached,
        categories: (Array.isArray(value) ? value : []).map(c => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          count: c.count,
        })),
      })
    }

    if (pathname === '/api/store/products') {
      const search = safeString(url.searchParams.get('search') || '').trim()
      const category = safeString(url.searchParams.get('category') || '').trim()
      const perPage = clampInt(url.searchParams.get('per_page'), { min: 1, max: 20, fallback: 10 })
      const params = new URLSearchParams({ status: 'publish', per_page: String(perPage) })
      if (search) params.set('search', search)
      if (category) params.set('category', category)
      const key = `products:${params.toString()}`
      const { value, cached: wasCached } = await cached(key, () =>
        fetchJson(wc(`/products?${params.toString()}`), { headers: wcHeaders })
      )
      return json(res, 200, {
        cached: wasCached,
        query: { search, category, per_page: perPage },
        products: (Array.isArray(value) ? value : []).map(publicProduct),
      })
    }

    if (pathname === '/api/store/pages') {
      const search = safeString(url.searchParams.get('search') || '').trim()
      const perPage = clampInt(url.searchParams.get('per_page'), { min: 1, max: 10, fallback: 5 })
      const params = new URLSearchParams({ per_page: String(perPage), _fields: 'id,title,excerpt,link,modified' })
      if (search) params.set('search', search)
      const key = `pages:${params.toString()}`
      const { value, cached: wasCached } = await cached(key, () => fetchJson(wp(`/pages?${params.toString()}`)))
      return json(res, 200, {
        cached: wasCached,
        pages: (Array.isArray(value) ? value : []).map(p => ({
          id: p.id,
          title: cleanHtml(p.title?.rendered || '', 120),
          excerpt: cleanHtml(p.excerpt?.rendered || '', 280),
          link: p.link || '',
          modified: p.modified || '',
        })),
      })
    }

    if (pathname === '/api/store/context') {
      const query = safeString(url.searchParams.get('q') || url.searchParams.get('query') || '').trim()
      const productParams = new URLSearchParams({ status: 'publish', per_page: '6' })
      if (query) productParams.set('search', query)
      const [products, categories, pages] = await Promise.all([
        cached(`context-products:${productParams.toString()}`, () => fetchJson(wc(`/products?${productParams.toString()}`), { headers: wcHeaders })),
        cached('context-categories', () => fetchJson(wc('/products/categories?per_page=20&hide_empty=true'), { headers: wcHeaders })),
        query
          ? cached(`context-pages:${query}`, () => fetchJson(wp(`/pages?per_page=3&_fields=title,excerpt,link&search=${encodeURIComponent(query)}`)))
          : Promise.resolve({ value: [], cached: true }),
      ])
      const productLines = (Array.isArray(products.value) ? products.value : []).map(p => {
        const item = publicProduct(p)
        return `${item.name} | Gs ${Number(item.price || 0).toLocaleString('es-PY')} | ${item.stock_status} | ${item.permalink}`
      })
      const categoryLines = (Array.isArray(categories.value) ? categories.value : []).map(c => `${c.name}: ${c.count}`)
      const pageLines = (Array.isArray(pages.value) ? pages.value : []).map(p => `${cleanHtml(p.title?.rendered, 80)}: ${cleanHtml(p.excerpt?.rendered, 220)} ${p.link || ''}`)
      return json(res, 200, {
        cached: products.cached && categories.cached && pages.cached,
        query,
        context: [
          'CATALOGO KANGULAB EN VIVO',
          productLines.length ? `Productos:\n- ${productLines.join('\n- ')}` : 'Productos: sin coincidencias.',
          categoryLines.length ? `Categorias:\n- ${categoryLines.join('\n- ')}` : '',
          pageLines.length ? `Paginas informativas:\n- ${pageLines.join('\n- ')}` : '',
        ].filter(Boolean).join('\n\n'),
      })
    }

    if (pathname === '/api/store/orders') {
      const auth = await requireAdminOrApiKey(req)
      if (!auth.ok) return json(res, auth.status || 401, { error: auth.error || 'No autorizado' })
      const search = safeString(url.searchParams.get('search') || '').trim()
      const perPage = clampInt(url.searchParams.get('per_page'), { min: 1, max: 20, fallback: 5 })
      const params = new URLSearchParams({ per_page: String(perPage), orderby: 'date', order: 'desc' })
      if (search) params.set('search', search)
      const orders = await fetchJson(wc(`/orders?${params.toString()}`), { headers: wcHeaders })
      return json(res, 200, {
        query: { search, per_page: perPage },
        orders: (Array.isArray(orders) ? orders : []).map(publicOrder),
      })
    }

    return json(res, 404, { error: 'Ruta no encontrada' })
  } catch (error) {
    return json(res, error.status || 502, {
      status: 'error',
      error: safeString(error.message || error).slice(0, 160),
    })
  }
}
