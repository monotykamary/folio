// Public API for @monotykamary/folio.
// Re-exports all types and config helpers. The browser-entry.ts bundle
// exposes these on window.Folio for Playwright/Puppeteer consumers.

export { type BookConfig, type PageSpecConfig, type ElementMapping, type FontSpec, inches, pageSpecFromInches } from './config'
export { type PageSpec, specsFromConfig, getSpec, contentWidth, contentHeight } from './page-spec'
export { type ContentBlock, type BreakBefore, type BreakAfter, type BreakInside, collectContentBlocks, measureBlock, measureAllBlocks } from './content-block'
export { type Page, type PaginationResult, type PaginateOptions, type PaginateResult, breakPages, paginateDocument, paginate } from './page-breaker'
export { injectPaginatedDOM, waitForAssetsReady, type InjectionResult } from './dom-injector'
export { fragmentCodeBlocks, splitHighlightedHTML, DEFAULT_FRAGMENTATION_CONFIG, type FragmentationConfig, type FragmentationResult } from './code-fragmenter'
