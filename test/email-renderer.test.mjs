import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml, renderPanelEmail, renderDataBlock } from '../api/email/renderer.js'

describe('escapeHtml', () => {
  test('escapa &', () => assert.equal(escapeHtml('a & b'), 'a &amp; b'))
  test('escapa <', () => assert.equal(escapeHtml('<script>'), '&lt;script&gt;'))
  test('escapa "', () => assert.equal(escapeHtml('"hello"'), '&quot;hello&quot;'))
  test("escapa '", () => assert.equal(escapeHtml("it's"), 'it&#039;s'))
  test('null → string vacío', () => assert.equal(escapeHtml(null), ''))
  test('sin caracteres especiales → sin cambios', () => assert.equal(escapeHtml('hello world'), 'hello world'))
})

describe('renderPanelEmail', () => {
  const html = renderPanelEmail({
    subject: 'Test subject',
    preheader: 'Preview text',
    title: 'Hello World',
    contentHtml: '<p>Content</p>',
    ctaUrl: 'https://example.com',
    ctaText: 'Click me',
  })

  test('retorna string HTML', () => assert.ok(typeof html === 'string'))
  test('contiene el título', () => assert.ok(html.includes('Hello World')))
  test('contiene el CTA', () => assert.ok(html.includes('Click me')))
  test('contiene el preheader', () => assert.ok(html.includes('Preview text')))
  test('contiene el href del CTA', () => assert.ok(html.includes('https://example.com')))
  test('sin CTA si ctaUrl vacío', () => {
    const h = renderPanelEmail({ subject: 's', preheader: '', title: 't', contentHtml: 'c', ctaUrl: '', ctaText: '' })
    assert.ok(!h.includes('href=""'))
  })
  test('rechaza ctaUrl con esquema javascript:', () => {
    const h = renderPanelEmail({ subject: 's', preheader: '', title: 't', contentHtml: 'c', ctaUrl: 'javascript:alert(1)', ctaText: 'click' })
    assert.ok(!h.includes('javascript:'))
  })
  test('paleta: contiene verde #25d366', () => assert.ok(html.includes('#25d366')))
  test('paleta: contiene teal #2dd4bf', () => assert.ok(html.includes('#2dd4bf')))
  test('paleta: type=danger contiene rosa #ff4d8d', () => {
    const h = renderPanelEmail({ subject: 's', preheader: '', title: 'T', contentHtml: 'c', ctaUrl: '', ctaText: '', type: 'danger' })
    assert.ok(h.includes('#ff4d8d'))
  })
  test('branding: contiene El Monstruo de las Cenizas', () => assert.ok(html.includes('El Monstruo de las Cenizas')))
  test('branding: contiene Powered by Oguri Power System', () => assert.ok(html.includes('Powered by Oguri Power System')))
})

describe('renderDataBlock', () => {
  test('retorna string con label y value', () => {
    const block = renderDataBlock({ label: 'Rol', value: 'Admin' })
    assert.ok(typeof block === 'string')
    assert.ok(block.includes('Rol'))
    assert.ok(block.includes('Admin'))
  })
  test('escapa HTML en value', () => {
    const block = renderDataBlock({ label: 'X', value: '<script>' })
    assert.ok(!block.includes('<script>'))
    assert.ok(block.includes('&lt;script&gt;'))
  })
  test('escapa HTML en label', () => {
    const block = renderDataBlock({ label: '<b>Label</b>', value: 'v' })
    assert.ok(!block.includes('<b>'))
  })
  test('incluye badge cuando se proporciona', () => {
    const block = renderDataBlock({ label: 'Estado', value: 'OK', badge: 'ACTIVO' })
    assert.ok(block.includes('ACTIVO'))
  })
  test('no incluye markup de badge cuando badge está vacío', () => {
    const block = renderDataBlock({ label: 'Estado', value: 'OK' })
    assert.ok(!block.includes('letter-spacing:0.8px'))
  })
  test('usa color teal cuando badgeColor=teal', () => {
    const block = renderDataBlock({ label: 'X', value: 'Y', badge: 'B', badgeColor: 'teal' })
    assert.ok(block.includes('#2dd4bf'))
  })
  test('usa color pink cuando badgeColor=pink', () => {
    const block = renderDataBlock({ label: 'X', value: 'Y', badge: 'B', badgeColor: 'pink' })
    assert.ok(block.includes('#ff4d8d'))
  })
  test('default badgeColor=green contiene #25d366', () => {
    const block = renderDataBlock({ label: 'X', value: 'Y', badge: 'B' })
    assert.ok(block.includes('#25d366'))
  })
})

describe('renderPanelEmail — type/icon', () => {
  test('type=danger genera header con color rosa', () => {
    const h = renderPanelEmail({ subject: 's', preheader: '', title: 'T', contentHtml: 'c', ctaUrl: '', ctaText: '', type: 'danger' })
    assert.ok(h.includes('#ff4d8d'))
  })
  test('type=warning genera header con color dorado', () => {
    const h = renderPanelEmail({ subject: 's', preheader: '', title: 'T', contentHtml: 'c', ctaUrl: '', ctaText: '', type: 'warning' })
    assert.ok(h.includes('#fbbf24'))
  })
  test('type=info genera header con color teal', () => {
    const h = renderPanelEmail({ subject: 's', preheader: '', title: 'T', contentHtml: 'c', ctaUrl: '', ctaText: '', type: 'info' })
    assert.ok(h.includes('#2dd4bf'))
  })
  test('type=success (default) genera header verde', () => {
    const h = renderPanelEmail({ subject: 's', preheader: '', title: 'T', contentHtml: 'c', ctaUrl: '', ctaText: '' })
    assert.ok(h.includes('#25d366'))
  })
  test('icon se renderiza en el header', () => {
    const h = renderPanelEmail({ subject: 's', preheader: '', title: 'T', contentHtml: 'c', ctaUrl: '', ctaText: '', icon: '🚀' })
    assert.ok(h.includes('🚀'))
  })
})

describe('renderDataBlock — gold y lavender', () => {
  test('badgeColor=gold contiene #fbbf24', () => {
    const b = renderDataBlock({ label: 'X', value: 'Y', badge: 'B', badgeColor: 'gold' })
    assert.ok(b.includes('#fbbf24'))
  })
  test('badgeColor=lavender contiene #818cf8', () => {
    const b = renderDataBlock({ label: 'X', value: 'Y', badge: 'B', badgeColor: 'lavender' })
    assert.ok(b.includes('#818cf8'))
  })
})
