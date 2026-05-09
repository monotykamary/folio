import { describe, it, expect, beforeEach } from 'vitest'
import { JSDOM } from 'jsdom'
import { collectContentBlocks, measureAllBlocks } from '../src/content-block'
import type { BookConfig, PageSpecConfig } from '../src/config'

const DEFAULT_SPEC: PageSpecConfig = {
  width: 672, height: 960,
  marginTop: 72, marginBottom: 96,
  marginLeft: 84, marginRight: 84,
  hasHeader: true, hasFooter: true,
}

const SIMPLE_CONFIG: BookConfig = {
  pageWidth: '7in',
  pageHeight: '10in',
  pageSpecs: { default: DEFAULT_SPEC },
  elementTypes: [
    { selector: 'h1', breakInside: 'avoid', measureAs: 'heading', font: { font: '600 22px Georgia, serif', fontSize: 22, lineHeight: 28.6 } },
    { selector: 'h2', breakInside: 'avoid', measureAs: 'heading', font: { font: '600 18px Georgia, serif', fontSize: 18, lineHeight: 23.4 } },
    { selector: 'p', breakInside: 'auto', measureAs: 'text', font: { font: '10px Georgia, serif', fontSize: 10, lineHeight: 14.7 } },
    { selector: 'pre', breakInside: 'auto', measureAs: 'text', font: { font: '8px monospace', fontSize: 8, lineHeight: 12 } },
    { selector: 'figure', breakInside: 'avoid', measureAs: 'image' },
    { selector: 'ul', breakInside: 'auto', measureAs: 'list' },
    { selector: 'ol', breakInside: 'auto', measureAs: 'list' },
    { selector: 'table', breakInside: 'auto', measureAs: 'table' },
  ],
  fullPageClasses: ['cover'],
  containerSelectors: ['.chapter-content'],
  romanPageTypes: [],
  fonts: {
    body: { font: '10px Georgia, serif', fontSize: 10, lineHeight: 14.7 },
    heading: { font: '600 14px Georgia, serif', fontSize: 14, lineHeight: 18.2 },
    code: { font: '8px monospace', fontSize: 8, lineHeight: 12 },
  },
}

function setupDOM(html: string): JSDOM {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  })
  // Mock window.getComputedStyle
  const { window } = dom
  const originalGetComputedStyle = window.getComputedStyle
  window.getComputedStyle = (elt: Element) => {
    const style = originalGetComputedStyle.call(window, elt)
    return new Proxy(style, {
      get(target, prop) {
        if (prop === 'breakBefore') return 'auto'
        if (prop === 'breakAfter') return 'auto'
        if (prop === 'breakInside') return 'auto'
        if (prop === 'pageBreakBefore') return 'auto'
        if (prop === 'pageBreakInside') return 'auto'
        return (target as any)[prop]
      }
    })
  }
  // Set global for module resolution
  globalThis.window = window as any
  globalThis.document = window.document
  globalThis.HTMLElement = window.HTMLElement as any
  globalThis.Element = window.Element as any
  globalThis.HTMLImageElement = window.HTMLImageElement as any
  return dom
}

describe('collectContentBlocks()', () => {
  it('collects paragraphs', () => {
    const dom = setupDOM('<p>Hello</p><p>World</p>')
    const root = dom.window.document.body
    const blocks = collectContentBlocks(root, SIMPLE_CONFIG)
    expect(blocks.length).toBe(2)
    expect(blocks.every(b => b.breakInside === 'auto')).toBe(true)
  })

  it('collects headings with breakInside: avoid', () => {
    const dom = setupDOM('<h1>Title</h1>')
    const root = dom.window.document.body
    const blocks = collectContentBlocks(root, SIMPLE_CONFIG)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].breakInside).toBe('avoid')
  })

  it('detects chapter titles from h1', () => {
    const dom = setupDOM('<h1>Introduction</h1>')
    const root = dom.window.document.body
    const blocks = collectContentBlocks(root, SIMPLE_CONFIG)
    expect(blocks[0].chapterTitle).toBe('Introduction')
  })

  it('detects chapter titles from containing h1', () => {
    const dom = setupDOM('<div><h1>Abstract</h1><p>Text</p></div>')
    const root = dom.window.document.body
    const blocks = collectContentBlocks(root, SIMPLE_CONFIG)
    // The div isn't a container so its children are walked
    expect(blocks.some(b => b.chapterTitle === 'Abstract')).toBe(true)
  })

  it('walks into container selectors', () => {
    const dom = setupDOM('<div class="chapter-content"><p>Inside</p></div>')
    const root = dom.window.document.body
    const blocks = collectContentBlocks(root, SIMPLE_CONFIG)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].element.textContent).toBe('Inside')
  })

  it('handles full-page elements', () => {
    const dom = setupDOM('<div class="cover"><img src="x.png"></div>')
    const root = dom.window.document.body
    const blocks = collectContentBlocks(root, SIMPLE_CONFIG)
    expect(blocks.some(b => b.isFullPage)).toBe(true)
  })

  it('handles mixed content', () => {
    const dom = setupDOM(`
      <h1>Chapter</h1>
      <p>First paragraph.</p>
      <p>Second paragraph.</p>
      <figure><img src="fig.png"></figure>
      <p>Third paragraph.</p>
    `)
    const root = dom.window.document.body
    const blocks = collectContentBlocks(root, SIMPLE_CONFIG)
    expect(blocks.length).toBeGreaterThanOrEqual(4)
  })

  it('handles nested elements', () => {
    const dom = setupDOM(`
      <section>
        <p>Outer paragraph.</p>
        <div>
          <p>Inner paragraph.</p>
        </div>
      </section>
    `)
    const root = dom.window.document.body
    const blocks = collectContentBlocks(root, SIMPLE_CONFIG)
    expect(blocks.length).toBeGreaterThanOrEqual(2)
    expect(blocks.every(b => b.element.textContent?.includes('paragraph'))).toBe(true)
  })

  it('returns empty array for empty root', () => {
    const dom = setupDOM('')
    const blocks = collectContentBlocks(dom.window.document.body, SIMPLE_CONFIG)
    expect(blocks).toHaveLength(0)
  })

  it('sets pageName for elements matching a pageName mapping', () => {
    const config: BookConfig = {
      ...SIMPLE_CONFIG,
      elementTypes: [
        ...SIMPLE_CONFIG.elementTypes,
        { selector: '.part-divider', pageName: 'part', breakInside: 'avoid', measureAs: 'fixed', fixedHeight: 960 },
      ],
    }
    const dom = setupDOM('<div class="part-divider"><h1>Part I</h1></div>')
    const root = dom.window.document.body
    const blocks = collectContentBlocks(root, config)
    expect(blocks.some(b => b.pageName === 'part')).toBe(true)
  })

  it('detects breakBefore from inline style', () => {
    const dom = setupDOM('<p style="break-before: page">Hello</p>')
    const root = dom.window.document.body
    const blocks = collectContentBlocks(root, SIMPLE_CONFIG)
    expect(blocks[0].breakBefore).toBe('always')
  })
})

describe('measureAllBlocks()', () => {
  it('sets measuredHeightPx for text blocks (falls back without Pretext)', () => {
    const dom = setupDOM('<p>Short text</p>')
    const root = dom.window.document.body
    const blocks = collectContentBlocks(root, SIMPLE_CONFIG)
    measureAllBlocks(blocks, SIMPLE_CONFIG)
    // Without Pretext available, it falls back to getBoundingClientRect or estimation
    expect(blocks[0].measuredHeightPx).toBeGreaterThanOrEqual(0)
  })

  it('sets measuredHeightPx for heading blocks', () => {
    const dom = setupDOM('<h1>Title</h1>')
    const root = dom.window.document.body
    const blocks = collectContentBlocks(root, SIMPLE_CONFIG)
    measureAllBlocks(blocks, SIMPLE_CONFIG)
    expect(blocks[0].measuredHeightPx).toBeGreaterThanOrEqual(0)
  })

  it('handles empty paragraphs', () => {
    const dom = setupDOM('<p></p>')
    const root = dom.window.document.body
    const blocks = collectContentBlocks(root, SIMPLE_CONFIG)
    measureAllBlocks(blocks, SIMPLE_CONFIG)
    expect(blocks[0].measuredHeightPx).toBeGreaterThanOrEqual(0)
  })
})
