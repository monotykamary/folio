import { describe, it, expect, beforeEach } from 'vitest'
import { JSDOM } from 'jsdom'
import { injectPaginatedDOM } from '../src/dom-injector'
import type { BookConfig, PageSpecConfig } from '../src/config'
import type { PaginationResult, Page } from '../src/page-breaker'
import type { ContentBlock } from '../src/content-block'

const DEFAULT_SPEC: PageSpecConfig = {
  width: 672, height: 960,
  marginTop: 72, marginBottom: 96,
  marginLeft: 84, marginRight: 84,
  hasHeader: true, hasFooter: true,
}

const COVER_SPEC: PageSpecConfig = {
  width: 672, height: 960,
  marginTop: 0, marginBottom: 0,
  marginLeft: 0, marginRight: 0,
  hasHeader: false, hasFooter: false,
}

const SIMPLE_CONFIG: BookConfig = {
  pageWidth: '7in',
  pageHeight: '10in',
  pageSpecs: { default: DEFAULT_SPEC, cover: COVER_SPEC },
  elementTypes: [
    { selector: 'h1', breakInside: 'avoid', measureAs: 'heading' },
    { selector: 'p', breakInside: 'auto', measureAs: 'text' },
    { selector: 'figure', breakInside: 'avoid', measureAs: 'image' },
  ],
  fullPageClasses: ['cover'],
  containerSelectors: [],
  romanPageTypes: [],
  fonts: {
    body: { font: '10px Georgia, serif', fontSize: 10, lineHeight: 14.7 },
    heading: { font: '600 14px Georgia, serif', fontSize: 14, lineHeight: 18.2 },
    code: { font: '8px monospace', fontSize: 8, lineHeight: 12 },
  },
}

function mockPagination(pageNames: string[]): PaginationResult {
  return {
    pages: pageNames.map((name, i) => ({
      index: i,
      pageName: name,
      spec: { name, widthPx: 672, heightPx: 960, topMarginPx: 0, bottomMarginPx: 0, leftMarginPx: 0, rightMarginPx: 0, hasHeader: false, hasFooter: true },
      blocks: [] as ContentBlock[],
      headerText: null,
      pageLabel: String(i + 1),
    })),
    totalArabic: pageNames.length,
    totalRoman: 0,
  }
}

function setupDOM(): JSDOM {
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>')
  globalThis.window = dom.window as any
  globalThis.document = dom.window.document as any
  globalThis.HTMLElement = dom.window.HTMLElement as any
  globalThis.Element = dom.window.Element as any
  return dom
}

describe('injectPaginatedDOM()', () => {
  it('injects a style element with id folio-injection-style', () => {
    const dom = setupDOM()
    const result = injectPaginatedDOM(mockPagination(['default']), SIMPLE_CONFIG)
    const style = dom.window.document.getElementById('folio-injection-style')
    expect(style).not.toBeNull()
    expect(style?.tagName).toBe('STYLE')
  })

  it('removes previous injection before adding new one', () => {
    const dom = setupDOM()
    injectPaginatedDOM(mockPagination(['default']), SIMPLE_CONFIG)
    injectPaginatedDOM(mockPagination(['default']), SIMPLE_CONFIG)
    const styles = dom.window.document.querySelectorAll('#folio-injection-style')
    expect(styles).toHaveLength(1)
  })

  it('generates @page rules for each page spec', () => {
    const dom = setupDOM()
    injectPaginatedDOM(mockPagination(['default']), SIMPLE_CONFIG)
    const style = dom.window.document.getElementById('folio-injection-style')
    const css = style?.textContent || ''
    expect(css).toContain('@page default')
    expect(css).toContain('@page cover')
  })

  it('includes break-inside: avoid rules for avoid-type selectors', () => {
    const dom = setupDOM()
    injectPaginatedDOM(mockPagination(['default']), SIMPLE_CONFIG)
    const style = dom.window.document.getElementById('folio-injection-style')
    const css = style?.textContent || ''
    expect(css).toContain('h1')
    expect(css).toContain('break-inside: avoid')
  })

  it('includes pre break-inside: auto override', () => {
    const dom = setupDOM()
    injectPaginatedDOM(mockPagination(['default']), SIMPLE_CONFIG)
    const style = dom.window.document.getElementById('folio-injection-style')
    const css = style?.textContent || ''
    expect(css).toContain('pre')
    expect(css).toContain('break-inside: auto')
  })

  it('includes folio-line break-inside: avoid', () => {
    const dom = setupDOM()
    injectPaginatedDOM(mockPagination(['default']), SIMPLE_CONFIG)
    const style = dom.window.document.getElementById('folio-injection-style')
    const css = style?.textContent || ''
    expect(css).toContain('.folio-line')
    expect(css).toContain('break-inside: avoid')
  })

  it('wraps rules in @media print', () => {
    const dom = setupDOM()
    injectPaginatedDOM(mockPagination(['default']), SIMPLE_CONFIG)
    const style = dom.window.document.getElementById('folio-injection-style')
    const css = style?.textContent || ''
    expect(css).toContain('@media print')
  })

  it('returns injected count', () => {
    setupDOM()
    const result = injectPaginatedDOM(mockPagination(['default', 'cover']), SIMPLE_CONFIG)
    expect(result.injectedPages).toBe(2)
  })

  it('handles empty pagination', () => {
    setupDOM()
    const result = injectPaginatedDOM({ pages: [], totalArabic: 0, totalRoman: 0 }, SIMPLE_CONFIG)
    expect(result.injectedPages).toBe(0)
  })

  it('sets @page base margin to 0', () => {
    const dom = setupDOM()
    injectPaginatedDOM(mockPagination(['default']), SIMPLE_CONFIG)
    const style = dom.window.document.getElementById('folio-injection-style')
    const css = style?.textContent || ''
    expect(css).toContain('@page { margin: 0; }')
  })

  it('injects page: CSS property for element types with pageName', () => {
    const dom = setupDOM()
    const configWithPageProps: BookConfig = {
      ...SIMPLE_CONFIG,
      elementTypes: [
        ...SIMPLE_CONFIG.elementTypes,
        { selector: '.cover-page', pageName: 'cover', breakInside: 'avoid', measureAs: 'fixed', fixedHeight: 960, isFullPage: true },
        { selector: '.title-page', pageName: 'title-page', breakInside: 'avoid', measureAs: 'fixed', fixedHeight: 960, isFullPage: true },
        { selector: '.chapter', pageName: 'chapter', breakInside: 'auto', measureAs: 'fixed', fixedHeight: 70 },
      ],
    }
    injectPaginatedDOM(mockPagination(['default']), configWithPageProps)
    const style = dom.window.document.getElementById('folio-injection-style')
    const css = style?.textContent || ''
    expect(css).toContain('.cover-page { page: cover; }')
    expect(css).toContain('.title-page { page: title-page; }')
    expect(css).toContain('.chapter { page: chapter; }')
  })

  it('does not inject page: property for element types without pageName', () => {
    const dom = setupDOM()
    injectPaginatedDOM(mockPagination(['default']), SIMPLE_CONFIG)
    const style = dom.window.document.getElementById('folio-injection-style')
    const css = style?.textContent || ''
    // h1, p, figure don't have pageName, so no page: properties expected
    expect(css).not.toContain('{ page:')
  })
})
