import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml, renderPanelEmail, renderDataBlock } from '../services/email/renderer.js'

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
  test('paleta: contiene verde #16a34a', () => assert.ok(html.includes('#16a34a')))
  test('paleta: contiene fondo verde #dcfce7', () => assert.ok(html.includes('#dcfce7')))
  test('paleta: type=danger contiene rojo #dc2626', () => {
    const h = renderPanelEmail({ subject: 's', preheader: '', title: 'T', contentHtml: 'c', ctaUrl: '', ctaText: '', type: 'danger' })
    assert.ok(h.includes('#dc2626'))
  })
  test('branding: contiene Oguri Bot', () => assert.ok(html.includes('Oguri Bot')))
  test('branding: contiene Oguri Power System', () => assert.ok(html.includes('Oguri Power System')))
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
    assert.ok(block.includes('#0f766e'))
  })
  test('usa color pink cuando badgeColor=pink', () => {
    const block = renderDataBlock({ label: 'X', value: 'Y', badge: 'B', badgeColor: 'pink' })
    assert.ok(block.includes('#be185d'))
  })
  test('default badgeColor=green contiene #15803d', () => {
    const block = renderDataBlock({ label: 'X', value: 'Y', badge: 'B' })
    assert.ok(block.includes('#15803d'))
  })
})

describe('renderPanelEmail — type/icon', () => {
  test('type=danger genera header con color rojo', () => {
    const h = renderPanelEmail({ subject: 's', preheader: '', title: 'T', contentHtml: 'c', ctaUrl: '', ctaText: '', type: 'danger' })
    assert.ok(h.includes('#dc2626'))
  })
  test('type=warning genera header con color dorado', () => {
    const h = renderPanelEmail({ subject: 's', preheader: '', title: 'T', contentHtml: 'c', ctaUrl: '', ctaText: '', type: 'warning' })
    assert.ok(h.includes('#d97706'))
  })
  test('type=info genera header con color azul', () => {
    const h = renderPanelEmail({ subject: 's', preheader: '', title: 'T', contentHtml: 'c', ctaUrl: '', ctaText: '', type: 'info' })
    assert.ok(h.includes('#2563eb'))
  })
  test('type=success (default) genera header verde', () => {
    const h = renderPanelEmail({ subject: 's', preheader: '', title: 'T', contentHtml: 'c', ctaUrl: '', ctaText: '' })
    assert.ok(h.includes('#16a34a'))
  })
  test('icon conocido se renderiza como SVG', () => {
    const h = renderPanelEmail({ subject: 's', preheader: '', title: 'T', contentHtml: 'c', ctaUrl: '', ctaText: '', icon: 'rocket' })
    assert.ok(h.includes('<svg'))
  })
})

describe('renderDataBlock — gold y lavender', () => {
  test('badgeColor=gold contiene #fbbf24', () => {
    const b = renderDataBlock({ label: 'X', value: 'Y', badge: 'B', badgeColor: 'gold' })
    assert.ok(b.includes('#b45309'))
  })
  test('badgeColor=lavender contiene #818cf8', () => {
    const b = renderDataBlock({ label: 'X', value: 'Y', badge: 'B', badgeColor: 'lavender' })
    assert.ok(b.includes('#6d28d9'))
  })
})
