import { type BookConfig } from './config'
import { type PageSpec, specsFromConfig, getSpec, contentHeight, contentWidth } from './page-spec'
import { type ContentBlock, measureAllBlocks, collectContentBlocks } from './content-block'

export interface Page {
  index: number
  pageName: string
  spec: PageSpec
  blocks: ContentBlock[]
  headerText: string | null
  pageLabel: string | null
}

export interface PaginationResult {
  pages: Page[]
  totalArabic: number
  totalRoman: number
}

function toRoman(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return ''
  const numerals: [string, number][] = [
    ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400],
    ['C', 100], ['XC', 90], ['L', 50], ['XL', 40],
    ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1],
  ]
  let remaining = Math.floor(value)
  let output = ''
  for (const [symbol, amount] of numerals) {
    while (remaining >= amount) {
      output += symbol
      remaining -= amount
    }
  }
  return output
}

export function breakPages(
  blocks: ContentBlock[],
  config: BookConfig
): PaginationResult {
  const specs = specsFromConfig(config.pageSpecs)
  const pages: Page[] = []
  let currentBlocks: ContentBlock[] = []
  let currentY = 0
  let currentSpec = getSpec(specs, 'default')
  let currentPageName = 'default'
  let runningHeader: string | null = null
  const romanTypes = new Set(config.romanPageTypes)

  function flushPage(label: string | null = null): Page {
    const headerText = currentBlocks.length > 0 && currentBlocks.some(b => b.chapterTitle)
      ? currentBlocks.find(b => b.chapterTitle)?.chapterTitle || runningHeader
      : runningHeader

    const page: Page = {
      index: pages.length,
      pageName: currentPageName,
      spec: currentSpec,
      blocks: currentBlocks,
      headerText: currentSpec.hasHeader ? headerText : null,
      pageLabel: label,
    }
    pages.push(page)
    return page
  }

  function startNewPage(pageName: string): void {
    currentBlocks = []
    currentPageName = pageName
    currentSpec = getSpec(specs, pageName)
    currentY = 0
  }

  function availableHeight(): number {
    return contentHeight(currentSpec)
  }

  for (const block of blocks) {
    const blockPageName = block.pageName || (romanTypes.has(currentPageName) ? currentPageName : 'default')
    const blockSpec = getSpec(specs, blockPageName)

    if (block.chapterTitle) {
      runningHeader = block.chapterTitle
    }

    if (block.isFullPage) {
      if (currentBlocks.length > 0) {
        flushPage()
      }

      startNewPage(blockPageName)
      currentBlocks.push(block)
      currentY = block.measuredHeightPx
      flushPage()
      continue
    }

    if (block.breakBefore === 'always') {
      if (currentBlocks.length > 0) {
        flushPage()
      }
      startNewPage(blockPageName)
    }

    const pageNameChanged = blockPageName !== 'default' && blockPageName !== currentPageName
    if (pageNameChanged && currentBlocks.length > 0) {
      flushPage()
      startNewPage(blockPageName)
    } else if (pageNameChanged) {
      startNewPage(blockPageName)
    }

    const avail = availableHeight()

    if (block.breakInside === 'avoid' && currentY + block.measuredHeightPx > avail) {
      if (currentBlocks.length > 0) {
        flushPage()
      }
      startNewPage(blockPageName)
      if (block.measuredHeightPx > availableHeight()) {
        const tagName = block.element ? block.element.tagName.toLowerCase() : 'unknown'
        console.warn(
          `[folio] Block with break-inside:avoid (${tagName}) ` +
          `measures ${block.measuredHeightPx}px but page content area is only ` +
          `${availableHeight()}px. It will overflow the page.`
        )
      }
    }

    if (currentY + block.measuredHeightPx > avail && currentBlocks.length > 0) {
      if (block.breakInside === 'avoid') {
        flushPage()
        startNewPage(blockPageName)
      } else {
        const remaining = avail - currentY
        if (remaining > avail * 0.3) {
          currentBlocks.push(block)
          currentY += block.measuredHeightPx
          if (block.breakAfter === 'always') {
            flushPage()
            startNewPage('default')
          }
          continue
        }
        flushPage()
        startNewPage(blockPageName)
      }
    }

    currentBlocks.push(block)
    currentY += block.measuredHeightPx

    if (block.breakAfter === 'always') {
      flushPage()
      startNewPage('default')
    }
  }

  if (currentBlocks.length > 0) {
    flushPage()
  }

  let arabicPage = 1
  let romanPage = 1
  for (const page of pages) {
    if (page.spec.hasFooter) {
      if (romanTypes.has(page.pageName)) {
        page.pageLabel = toRoman(romanPage).toLowerCase()
        romanPage++
      } else {
        page.pageLabel = String(arabicPage)
        arabicPage++
      }
    }
  }

  return {
    pages,
    totalArabic: arabicPage - 1,
    totalRoman: romanPage - 1,
  }
}

export async function paginateDocument(config: BookConfig): Promise<PaginationResult> {
  const root = document.querySelector('main') || document.body

  const blocks = collectContentBlocks(root, config)
  measureAllBlocks(blocks, config)

  const result = breakPages(blocks, config)
  return result
}

export interface PaginateOptions {
  /** Root element to paginate. Defaults to <main> or document.body. */
  root?: Element
  /** Fragmentation config for code blocks. Pass false to skip fragmentation. */
  fragmentation?: FragmentationConfig | false
  /** Inject @page CSS rules from config into the document. Default: true. */
  injectCSS?: boolean
}

export interface PaginateResult {
  pagination: PaginationResult
  fragmentation: FragmentationResult | null
  injected: boolean
}

// One-call convenience: measure, paginate, inject CSS, fragment code blocks.
// This is the “script-tag-and-go" entry point — include folio.bundle.js,
// call Folio.paginate(config), then print.
export async function paginate(
  config: BookConfig,
  options: PaginateOptions = {}
): Promise<PaginateResult> {
  const root = options.root || document.querySelector('main') || document.body

  // 1. Measure and paginate
  const blocks = collectContentBlocks(root, config)
  measureAllBlocks(blocks, config)
  const pagination = breakPages(blocks, config)

  // 2. Inject @page CSS from config
  let injected = false
  if (options.injectCSS !== false) {
    const { injectPaginatedDOM } = await import('./dom-injector')
    const result = injectPaginatedDOM(pagination, config)
    injected = result.injectedPages > 0
  }

  // 3. Fragment code blocks
  let fragmentation: FragmentationResult | null = null
  if (options.fragmentation !== false) {
    const { fragmentCodeBlocks } = await import('./code-fragmenter')
    fragmentation = fragmentCodeBlocks(
      options.fragmentation || undefined
    )
  }

  return { pagination, fragmentation, injected }
}
