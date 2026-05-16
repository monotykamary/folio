import { describe, it, expect, vi } from 'vitest'
import { breakPages, type Page, type PaginationResult } from '../src/page-breaker'
import type { ContentBlock, BreakBefore, BreakAfter, BreakInside } from '../src/content-block'
import type { BookConfig, PageSpecConfig } from '../src/config'
import { specsFromConfig } from '../src/page-spec'

// Helpers to create mock blocks without DOM
function mockBlock(overrides: Partial<ContentBlock> & { measuredHeightPx: number }): ContentBlock {
  return {
    element: null as any,
    pageName: null,
    breakBefore: 'auto' as BreakBefore,
    breakAfter: 'auto' as BreakAfter,
    breakInside: 'auto' as BreakInside,
    orphans: 3,
    widows: 3,
    isFullPage: false,
    chapterTitle: null,
    ...overrides,
  }
}

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

const FRONTMATTER_SPEC: PageSpecConfig = {
  width: 672, height: 960,
  marginTop: 72, marginBottom: 96,
  marginLeft: 84, marginRight: 84,
  hasHeader: false, hasFooter: true,
}

const BASE_CONFIG: BookConfig = {
  pageWidth: '7in',
  pageHeight: '10in',
  pageSpecs: { default: DEFAULT_SPEC, cover: COVER_SPEC },
  elementTypes: [],
  fullPageClasses: [],
  containerSelectors: [],
  romanPageTypes: [],
  fonts: {
    body: { font: '10px Georgia, serif', fontSize: 10, lineHeight: 14.7 },
    heading: { font: '600 14px Georgia, serif', fontSize: 14, lineHeight: 18.2 },
    code: { font: '8px monospace', fontSize: 8, lineHeight: 12 },
  },
}

describe('breakPages()', () => {
  it('warns when an avoid-block is taller than the page content area', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Content height is 792px. A 1000px avoid-block can't fit even on an empty page.
    const blocks = [mockBlock({ measuredHeightPx: 1000, breakInside: 'avoid' })]
    const result = breakPages(blocks, BASE_CONFIG)
    expect(result.pages).toHaveLength(1)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[folio] Block with break-inside:avoid')
    )
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('1000px')
    )
    warnSpy.mockRestore()
  })

  it('does not warn when an avoid-block fits on a fresh page', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const blocks = [mockBlock({ measuredHeightPx: 700, breakInside: 'avoid' })]
    const result = breakPages(blocks, BASE_CONFIG)
    expect(result.pages).toHaveLength(1)
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('does not set seenArabic flag (variable was removed)', () => {
    // This tests that the removed seenArabic variable doesn't cause issues.
    // The variable was set but never read, so removing it is a no-op.
    const blocks = [mockBlock({ measuredHeightPx: 100, chapterTitle: 'Chapter 1' })]
    const result = breakPages(blocks, BASE_CONFIG)
    expect(result.pages[0].headerText).toBe('Chapter 1')
    expect(result.totalArabic).toBe(1)
    expect(result.totalRoman).toBe(0)
  })


  it('places a single small block on one page', () => {
    const blocks = [mockBlock({ measuredHeightPx: 100 })]
    const result = breakPages(blocks, BASE_CONFIG)
    expect(result.pages).toHaveLength(1)
    expect(result.pages[0].blocks).toHaveLength(1)
  })

  it('places multiple blocks that fit on one page', () => {
    // Content height is 792px (960 - 72 - 96)
    const blocks = [
      mockBlock({ measuredHeightPx: 200 }),
      mockBlock({ measuredHeightPx: 300 }),
      mockBlock({ measuredHeightPx: 200 }),
    ]
    const result = breakPages(blocks, BASE_CONFIG)
    expect(result.pages).toHaveLength(1)
    expect(result.pages[0].blocks).toHaveLength(3)
  })

  it('breaks to a new page when content exceeds available height', () => {
    const blocks = [
      mockBlock({ measuredHeightPx: 700 }),
      mockBlock({ measuredHeightPx: 200 }),
    ]
    const result = breakPages(blocks, BASE_CONFIG)
    expect(result.pages.length).toBeGreaterThanOrEqual(2)
    expect(result.pages[1].blocks[0].measuredHeightPx).toBe(200)
  })

  it('handles breakBefore: always', () => {
    const blocks = [
      mockBlock({ measuredHeightPx: 100 }),
      mockBlock({ measuredHeightPx: 100, breakBefore: 'always' }),
    ]
    const result = breakPages(blocks, BASE_CONFIG)
    expect(result.pages).toHaveLength(2)
    expect(result.pages[0].blocks).toHaveLength(1)
    expect(result.pages[1].blocks).toHaveLength(1)
  })

  it('handles breakAfter: always', () => {
    const blocks = [
      mockBlock({ measuredHeightPx: 100, breakAfter: 'always' }),
      mockBlock({ measuredHeightPx: 100 }),
    ]
    const result = breakPages(blocks, BASE_CONFIG)
    expect(result.pages).toHaveLength(2)
  })

  it('places full-page elements on their own page', () => {
    const blocks = [
      mockBlock({ measuredHeightPx: 100 }),
      mockBlock({ measuredHeightPx: 960, isFullPage: true, pageName: 'cover' }),
      mockBlock({ measuredHeightPx: 100 }),
    ]
    const result = breakPages(blocks, BASE_CONFIG)
    // Full-page element gets its own page
    const coverPage = result.pages.find(p => p.pageName === 'cover')
    expect(coverPage).toBeDefined()
    expect(coverPage!.blocks).toHaveLength(1)
    expect(coverPage!.blocks[0].isFullPage).toBe(true)
  })

  it('avoids breaking inside breakInside: avoid blocks', () => {
    // Content height is 792px. 700px used. A 200px avoid block won't fit.
    const blocks = [
      mockBlock({ measuredHeightPx: 700 }),
      mockBlock({ measuredHeightPx: 200, breakInside: 'avoid' }),
    ]
    const result = breakPages(blocks, BASE_CONFIG)
    // The avoid block should start on a new page
    expect(result.pages.length).toBeGreaterThanOrEqual(2)
    const lastPage = result.pages[result.pages.length - 1]
    expect(lastPage.blocks.some(b => b.breakInside === 'avoid')).toBe(true)
  })

  it('starts a new page when pageName changes', () => {
    const blocks = [
      mockBlock({ measuredHeightPx: 100 }),
      mockBlock({ measuredHeightPx: 100, pageName: 'cover' }),
    ]
    const result = breakPages(blocks, BASE_CONFIG)
    expect(result.pages.length).toBeGreaterThanOrEqual(2)
    expect(result.pages[result.pages.length - 1].pageName).toBe('cover')
  })

  it('assigns running headers from chapter titles', () => {
    const blocks = [
      mockBlock({ measuredHeightPx: 100, chapterTitle: 'Chapter 1' }),
      mockBlock({ measuredHeightPx: 100 }),
    ]
    const result = breakPages(blocks, BASE_CONFIG)
    expect(result.pages[0].headerText).toBe('Chapter 1')
  })

  it('suppresses header when hasHeader is false', () => {
    const blocks = [
      mockBlock({ measuredHeightPx: 100, chapterTitle: 'Chapter 1', pageName: 'cover' }),
    ]
    const result = breakPages(blocks, BASE_CONFIG)
    expect(result.pages[0].headerText).toBeNull()
  })

  it('produces arabic page labels for body pages', () => {
    const blocks = [mockBlock({ measuredHeightPx: 100 })]
    const result = breakPages(blocks, BASE_CONFIG)
    expect(result.pages[0].pageLabel).toBe('1')
  })

  it('produces roman numeral labels for frontmatter pages', () => {
    const config: BookConfig = {
      ...BASE_CONFIG,
      pageSpecs: { default: DEFAULT_SPEC, frontmatter: FRONTMATTER_SPEC },
      romanPageTypes: ['frontmatter'],
    }
    // Large blocks force page breaks, and pageName differs so pages get separate specs
    const blocks = [
      mockBlock({ measuredHeightPx: 700, pageName: 'frontmatter' }),
      mockBlock({ measuredHeightPx: 700, pageName: 'frontmatter' }),
      mockBlock({ measuredHeightPx: 700 }),
    ]
    const result = breakPages(blocks, config)
    // Check roman pages exist and have lowercase roman labels
    const romanPages = result.pages.filter(p => config.romanPageTypes.includes(p.pageName))
    expect(romanPages.length).toBeGreaterThanOrEqual(1)
    for (const p of romanPages) {
      expect(p.pageLabel).toMatch(/^[ivxlcdm]+$/)
    }
    // Non-frontmatter pages with footers get arabic labels
    const arabicPages = result.pages.filter(
      p => !config.romanPageTypes.includes(p.pageName) && p.pageLabel !== null
    )
    if (arabicPages.length > 0) {
      for (const p of arabicPages) {
        expect(p.pageLabel).toMatch(/^\d+$/)
      }
    }
  })

  it('suppresses page labels when hasFooter is false', () => {
    const blocks = [
      mockBlock({ measuredHeightPx: 960, isFullPage: true, pageName: 'cover' }),
    ]
    const result = breakPages(blocks, BASE_CONFIG)
    expect(result.pages[0].pageLabel).toBeNull()
  })

  it('counts totalArabic and totalRoman correctly', () => {
    const config: BookConfig = {
      ...BASE_CONFIG,
      pageSpecs: { default: DEFAULT_SPEC, frontmatter: FRONTMATTER_SPEC },
      romanPageTypes: ['frontmatter'],
    }
    const blocks = [
      mockBlock({ measuredHeightPx: 100, pageName: 'frontmatter' }),
      mockBlock({ measuredHeightPx: 100 }),
      mockBlock({ measuredHeightPx: 100 }),
    ]
    const result = breakPages(blocks, config)
    // Always at least some pages
    expect(result.pages.length).toBeGreaterThanOrEqual(1)
    // Roman + arabic totals match page count (for footer-bearing pages)
    const footerPages = result.pages.filter(p => p.pageLabel !== null).length
    expect(result.totalRoman + result.totalArabic).toBe(footerPages)
  })

  it('handles an empty block list', () => {
    const result = breakPages([], BASE_CONFIG)
    expect(result.pages).toHaveLength(0)
    expect(result.totalArabic).toBe(0)
    expect(result.totalRoman).toBe(0)
  })

  it('handles many blocks across many pages', () => {
    // 20 blocks of 200px each = 4000px total
    // Content height per page: 792px → ~3-4 blocks per page → ~5-7 pages
    const blocks = Array.from({ length: 20 }, () => mockBlock({ measuredHeightPx: 200 }))
    const result = breakPages(blocks, BASE_CONFIG)
    expect(result.pages.length).toBeGreaterThanOrEqual(5)
    expect(result.pages.length).toBeLessThanOrEqual(9)
  })

  it('carries running header across pages within same chapter', () => {
    const blocks = [
      mockBlock({ measuredHeightPx: 100, chapterTitle: 'Intro' }),
      mockBlock({ measuredHeightPx: 700 }),
      mockBlock({ measuredHeightPx: 100 }),
    ]
    const result = breakPages(blocks, BASE_CONFIG)
    // Both pages should reference 'Intro'
    for (const page of result.pages) {
      if (page.headerText) {
        expect(page.headerText).toBe('Intro')
      }
    }
  })
})

describe('toRoman (via breakPages)', () => {
  it('generates correct roman numerals', () => {
    const config: BookConfig = {
      ...BASE_CONFIG,
      pageSpecs: { default: DEFAULT_SPEC, frontmatter: FRONTMATTER_SPEC },
      romanPageTypes: ['frontmatter'],
    }
    // Create enough frontmatter blocks to get several roman pages
    const blocks = Array.from({ length: 5 }, () =>
      mockBlock({ measuredHeightPx: 100, pageName: 'frontmatter' })
    )
    const result = breakPages(blocks, config)
    const romanLabels = result.pages
      .filter(p => config.romanPageTypes.includes(p.pageName))
      .map(p => p.pageLabel)
    // Should be i, ii, iii, etc.
    expect(romanLabels[0]).toBe('i')
    if (romanLabels.length > 1) expect(romanLabels[1]).toBe('ii')
    if (romanLabels.length > 2) expect(romanLabels[2]).toBe('iii')
    if (romanLabels.length > 3) expect(romanLabels[3]).toBe('iv')
  })

  it('respects breakThreshold: 0 fills pages to capacity before breaking', () => {
    const config: BookConfig = { ...BASE_CONFIG, breakThreshold: 0 }
    // 8 blocks of 100px = 800px. Block 7 overflows (700+100=800 > 792).
    // remaining = 792-700 = 92. 92 > 0*792 = 0 → push to current page.
    // All 8 blocks fit on 1 page.
    const blocks = Array.from({ length: 8 }, () =>
      mockBlock({ measuredHeightPx: 100 })
    )
    const result = breakPages(blocks, config)
    expect(result.pages).toHaveLength(1)
    expect(result.pages[0].blocks).toHaveLength(8)
  })

  it('respects breakThreshold: 1 forces early break on overflow', () => {
    const config: BookConfig = { ...BASE_CONFIG, breakThreshold: 1 }
    // 8 blocks of 100px. Block 7 overflows (800 > 792).
    // remaining = 92. 92 > 1*792 = 792 → NO → flush, start new page.
    const blocks = Array.from({ length: 8 }, () =>
      mockBlock({ measuredHeightPx: 100 })
    )
    const result = breakPages(blocks, config)
    expect(result.pages).toHaveLength(2)
  })

  it('resets to default page type after a fullpage element', () => {
    const config: BookConfig = {
      ...BASE_CONFIG,
      pageSpecs: { default: DEFAULT_SPEC, cover: COVER_SPEC },
    }
    const blocks = [
      mockBlock({ measuredHeightPx: 100 }),
      mockBlock({ measuredHeightPx: 960, isFullPage: true, pageName: 'cover' }),
      mockBlock({ measuredHeightPx: 100 }),
    ]
    const result = breakPages(blocks, config)
    // After the cover page, the next block should be on a 'default' page
    // (not inheriting 'cover' and its zero margins)
    expect(result.pages).toHaveLength(3)
    expect(result.pages[0].pageName).toBe('default')
    expect(result.pages[1].pageName).toBe('cover')
    expect(result.pages[2].pageName).toBe('default')
  })
})
