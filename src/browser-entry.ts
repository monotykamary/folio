// Browser bundle entry point for @monotykamary/folio.
// Bundles @chenglou/pretext + page-breaking + DOM injection + code
// fragmentation into a single IIFE that exposes window.Folio.

import { prepare, layout, prepareWithSegments, layoutWithLines } from '@chenglou/pretext'
import { specsFromConfig, getSpec, contentWidth, contentHeight, type PageSpec } from './page-spec'
import {
  collectContentBlocks,
  measureBlock,
  measureAllBlocks,
  type ContentBlock,
  type BreakBefore,
  type BreakAfter,
  type BreakInside,
} from './content-block'
import { breakPages, paginateDocument, type Page, type PaginationResult } from './page-breaker'
import { injectPaginatedDOM, waitForAssetsReady } from './dom-injector'
import {
  fragmentCodeBlocks,
  splitHighlightedHTML,
  DEFAULT_FRAGMENTATION_CONFIG,
  type FragmentationConfig,
  type FragmentationResult,
} from './code-fragmenter'
import { type BookConfig, type PageSpecConfig, type ElementMapping, type FontSpec, inches, pageSpecFromInches } from './config'

window.Pretext = { prepare, layout, prepareWithSegments, layoutWithLines }
window.Folio = {
  Pretext: window.Pretext,

  specsFromConfig,
  getSpec,
  contentWidth,
  contentHeight,

  collectContentBlocks,
  measureBlock,
  measureAllBlocks,

  breakPages,
  paginateDocument,

  injectPaginatedDOM,
  waitForAssetsReady,

  fragmentCodeBlocks,
  splitHighlightedHTML,
  DEFAULT_FRAGMENTATION_CONFIG,

  inches,
  pageSpecFromInches,
}

// Type declarations for window augmentation
declare global {
  interface Window {
    Pretext: typeof import('@chenglou/pretext')
    Folio: {
      Pretext: typeof import('@chenglou/pretext')
      specsFromConfig: typeof specsFromConfig
      getSpec: typeof getSpec
      contentWidth: typeof contentWidth
      contentHeight: typeof contentHeight
      collectContentBlocks: typeof collectContentBlocks
      measureBlock: typeof measureBlock
      measureAllBlocks: typeof measureAllBlocks
      breakPages: typeof breakPages
      paginateDocument: typeof paginateDocument
      injectPaginatedDOM: typeof injectPaginatedDOM
      waitForAssetsReady: typeof waitForAssetsReady
      fragmentCodeBlocks: typeof fragmentCodeBlocks
      splitHighlightedHTML: typeof splitHighlightedHTML
      DEFAULT_FRAGMENTATION_CONFIG: typeof DEFAULT_FRAGMENTATION_CONFIG
      inches: typeof inches
      pageSpecFromInches: typeof pageSpecFromInches
    }
  }
}
