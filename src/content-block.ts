import { type BookConfig, type ElementMapping } from './config'
import { type PageSpec, specsFromConfig, getSpec, contentWidth, contentHeight } from './page-spec'
import { prepare as pretextPrepare, layout as pretextLayout } from '@chenglou/pretext'

// Re-exports from config are handled by index.ts

export type BreakBefore = 'auto' | 'always' | 'avoid'
export type BreakAfter = 'auto' | 'always' | 'avoid'
export type BreakInside = 'auto' | 'avoid'

export interface ContentBlock {
  element: Element
  pageName: string | null
  breakBefore: BreakBefore
  breakAfter: BreakAfter
  breakInside: BreakInside
  orphans: number
  widows: number
  measuredHeightPx: number
  isFullPage: boolean
  chapterTitle: string | null
}

function elementMatches(element: Element, selector: string): boolean {
  try {
    return element.matches(selector)
  } catch {
    // In environments where matches() isn't available (e.g., some test setups),
    // fall back to tag-name or single-class matching.
    const tag = element.tagName.toLowerCase()
    const cls = element.className || ''
    if (typeof cls !== 'string') return selector === tag
    if (selector.startsWith('.')) {
      const className = selector.slice(1)
      return cls.split(/\s+/).includes(className)
    }
    return selector === tag
  }
}

function findElementType(element: Element, config: BookConfig): ElementMapping | null {
  for (const mapping of config.elementTypes) {
    if (elementMatches(element, mapping.selector)) return mapping
  }
  return null
}

function detectPageName(element: Element, config: BookConfig): string | null {
  const cls = element.className || ''
  if (typeof cls !== 'string') return null

  for (const mapping of config.elementTypes) {
    if (mapping.pageName && elementMatches(element, mapping.selector)) {
      return mapping.pageName
    }
  }
  return null
}

function detectBreakBefore(element: Element): BreakBefore {
  const style = (element as HTMLElement).style
  if (style?.breakBefore === 'page' || style?.pageBreakBefore === 'always') return 'always'
  if (style?.breakBefore === 'avoid' || style?.pageBreakBefore === 'avoid') return 'avoid'
  const computed = window.getComputedStyle(element)
  if (computed.breakBefore === 'page' || computed.pageBreakBefore === 'always') return 'always'
  if (computed.breakBefore === 'avoid' || computed.pageBreakBefore === 'avoid') return 'avoid'
  return 'auto'
}

function detectBreakAfter(element: Element): BreakAfter {
  const style = (element as HTMLElement).style
  if (style?.breakAfter === 'page' || style?.pageBreakAfter === 'always') return 'always'
  if (style?.breakAfter === 'avoid' || style?.pageBreakAfter === 'avoid') return 'avoid'
  return 'auto'
}

function detectBreakInside(element: Element, config: BookConfig): BreakInside {
  const style = (element as HTMLElement).style
  if (style?.breakInside === 'avoid' || style?.pageBreakInside === 'avoid') return 'avoid'
  const computed = window.getComputedStyle(element)
  if (computed.breakInside === 'avoid' || computed.pageBreakInside === 'avoid') return 'avoid'

  const mapping = findElementType(element, config)
  if (mapping) return mapping.breakInside

  const tag = element.tagName.toLowerCase()
  if (tag === 'figure' || tag === 'table' || tag === 'img') return 'avoid'
  if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') return 'avoid'

  return 'auto'
}

function detectChapterTitle(element: Element): string | null {
  const tag = element.tagName.toLowerCase()
  // Check all heading levels, not just h1
  const headingTags = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
  if (headingTags.has(tag)) {
    return element.textContent?.replace(/\s+/g, ' ').trim() || null
  }
  const heading = element.querySelector?.('h1, h2, h3, h4, h5, h6')
  if (heading) return heading.textContent?.replace(/\s+/g, ' ').trim() || null
  return null
}

function isFullPageElement(element: Element, config: BookConfig): boolean {
  const cls = element.className || ''
  if (typeof cls !== 'string') return false
  const elementClasses = cls.split(/\s+/)
  return elementClasses.some(c => config.fullPageClasses.includes(c))
}

function isLeafBlock(element: Element, config: BookConfig): boolean {
  const tag = element.tagName.toLowerCase()

  if (['h1', 'h2', 'h3', 'h4', 'p', 'pre', 'blockquote', 'figure', 'img', 'table', 'ul', 'ol'].includes(tag)) {
    return true
  }

  const mapping = findElementType(element, config)
  if (mapping) {
    if (mapping.isFullPage) return false
    if (mapping.pageName && !mapping.measureAs) return false
    if (mapping.measureAs === 'fixed' && mapping.pageName) return false
    if (mapping.measureAs) return true
  }

  return false
}

function isContainer(element: Element, config: BookConfig): boolean {
  for (const sel of config.containerSelectors) {
    if (elementMatches(element, sel)) return true
  }
  const mapping = findElementType(element, config)
  if (mapping?.pageName && !mapping.isFullPage) return true
  return false
}

function makeBlock(
  element: Element,
  config: BookConfig,
  inheritedPageName: string | null = null
): ContentBlock {
  const pageName = detectPageName(element, config) || inheritedPageName
  const isFullPage = isFullPageElement(element, config)

  return {
    element,
    pageName,
    breakBefore: detectBreakBefore(element),
    breakAfter: detectBreakAfter(element),
    breakInside: detectBreakInside(element, config),
    orphans: 3,
    widows: 3,
    measuredHeightPx: 0,
    isFullPage,
    chapterTitle: detectChapterTitle(element),
  }
}

const MAX_WALK_DEPTH = 100

export function collectContentBlocks(
  root: Element,
  config: BookConfig
): ContentBlock[] {
  const blocks: ContentBlock[] = []

  function walk(parent: Element, inheritedPageName: string | null = null, depth: number = 0): void {
    if (depth > MAX_WALK_DEPTH) {
      console.warn(
        `[folio] DOM walk depth exceeded ${MAX_WALK_DEPTH}. ` +
        'Check for deeply nested containers. Some content may not be paginated.'
      )
      return
    }
    const children = Array.from(parent.children)

    for (const child of children) {
      const pageName = detectPageName(child, config) || inheritedPageName
      const isFullPageEl = isFullPageElement(child, config)

      if (isFullPageEl) {
        blocks.push(makeBlock(child, config, inheritedPageName))
        continue
      }

      if (isContainer(child, config)) {
        walk(child, pageName, depth + 1)
        continue
      }

      if (isLeafBlock(child, config)) {
        blocks.push(makeBlock(child, config, pageName))
        continue
      }

      if (child.children.length > 0) {
        walk(child, pageName, depth + 1)
      } else {
        blocks.push(makeBlock(child, config, pageName))
      }
    }
  }

  walk(root)
  return blocks
}

function measureText(
  text: string,
  font: string,
  width: number,
  lineHeight: number,
  padding: number = 0,
  whiteSpace?: 'pre-wrap' | 'normal'
): number {
  try {
    const opts = whiteSpace ? { whiteSpace: whiteSpace as any } : undefined
    const prepared = pretextPrepare(text, font, opts)
    const { height } = pretextLayout(prepared, width, lineHeight)
    return height + padding
  } catch {
    return Math.ceil(text.length / 60) * lineHeight + padding
  }
}

export function measureBlock(
  block: ContentBlock,
  spec: PageSpec,
  config: BookConfig
): number {
  const element = block.element as HTMLElement
  const widthPx = contentWidth(spec)

  if (block.isFullPage) {
    return spec.heightPx
  }

  const mapping = findElementType(element, config)
  const tag = element.tagName.toLowerCase()

  if (mapping?.measureAs === 'fixed' && mapping.fixedHeight) {
    return mapping.fixedHeight
  }

  if (tag === 'pre') {
    const pre = element
    const code = pre.querySelector('code') || pre
    const text = code.textContent || ''
    const font = mapping?.font || config.fonts.code
    const lh = font.lineHeight
    const pad = mapping?.heightPadding ?? 18
    return measureText(text, font.font, widthPx - 16, lh, pad, 'pre-wrap')
  }

  if (mapping?.measureAs === 'text' && mapping.font) {
    const text = element.textContent || ''
    const w = mapping.contentWidth ?? widthPx
    const pad = mapping.heightPadding ?? 8
    return measureText(text, mapping.font.font, w, mapping.font.lineHeight, pad)
  }

  if (mapping?.measureAs === 'heading' && mapping.font) {
    const text = element.textContent || ''
    return measureText(text, mapping.font.font, widthPx, mapping.font.lineHeight, mapping.heightPadding ?? 12)
  }

  if (tag === 'img') {
    const naturalHeight = (element as HTMLImageElement).naturalHeight || 200
    const naturalWidth = (element as HTMLImageElement).naturalWidth || 200
    const scale = Math.min(1, widthPx / naturalWidth)
    const scaledHeight = naturalHeight * scale
    const maxVh = spec.heightPx * 0.45
    return Math.min(scaledHeight, maxVh) + (mapping?.heightPadding ?? 16)
  }

  if (tag === 'figure') {
    const img = element.querySelector('img')
    let imgHeight = 200
    if (img) {
      const naturalHeight = img.naturalHeight || 200
      const naturalWidth = img.naturalWidth || 200
      const scale = Math.min(1, widthPx / naturalWidth)
      imgHeight = Math.min(naturalHeight * scale, spec.heightPx * 0.45)
    }
    const caption = element.querySelector('figcaption')
    const captionHeight = caption ? 20 : 0
    return imgHeight + captionHeight + (mapping?.heightPadding ?? 20)
  }

  if (tag === 'ul' || tag === 'ol') {
    const items = element.querySelectorAll('li')
    return items.length * 16 + 12
  }

  if (tag === 'table') {
    const rows = element.querySelectorAll('tr')
    return rows.length * 24 + 24
  }

  return element.getBoundingClientRect().height
}

export function measureAllBlocks(
  blocks: ContentBlock[],
  config: BookConfig
): void {
  const specs = specsFromConfig(config.pageSpecs)

  for (const block of blocks) {
    const specName = block.pageName || 'default'
    const spec = getSpec(specs, specName)
    block.measuredHeightPx = measureBlock(block, spec, config)
  }
}
