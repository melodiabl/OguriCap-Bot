import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml, renderPanelEmail } from '../lib/email/renderer.js'

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
})
