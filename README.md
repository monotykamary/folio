<p align="center">
  <img src="https://raw.githubusercontent.com/monotykamary/folio/main/assets/folio-hero.png" alt="Folio hero illustration" width="600">
</p>

<h1 align="center">@monotykamary/folio</h1>

<p align="center">
  <em>Book PDF pagination using <a href="https://github.com/chenglou/pretext">@chenglou/pretext</a> for text measurement and Chrome's native <code>page.pdf()</code> for rendering.</em>
</p>

<p align="center">
  Replaces <a href="https://pagedjs.org/">Paged.js</a> for book PDF generation.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@monotykamary/folio"><img src="https://img.shields.io/npm/v/@monotykamary/folio" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/monotykamary/folio?logo=opensourceinitiative&logoColor=white" alt="license"></a>
</p>

## Why not Paged.js?

Paged.js takes over pagination by restructuring your DOM into `.pagedjs_page` divs. This causes:

- **Double pagination** — Paged.js paginates, then Chrome re-paginates on print
- **800+ lines of stabilization** — You need `stabilizePagedPreviewForPdf`, `freezePagedPreviewToStaticPages`, `waitForStaticPagesReady`, and `stampPdfPageNumbers` to undo the DOM restructuring so Chrome can actually print it
- **Header/footer conflicts** — Paged.js renders headers/footers as DOM elements that conflict with Chrome's own

**Folio's approach**: measure with Pretext, paginate with Chrome's native engine. No DOM restructuring, no stabilization, no double-pagination.

## How it works

```
Your HTML document
  ↓
You provide a BookConfig (page sizes, element types, fonts)
  ↓
Folio collects and measures content blocks using Pretext
  ↓
Page-breaking algorithm estimates page assignments
  ↓
Folio fragments code blocks for cross-page breaking
  ↓
Chrome's page.pdf() uses CSS @page rules for actual pagination
  ↓
PDF output
```

## Installation

```sh
npm install @monotykamary/folio @chenglou/pretext
```

## Quick Start

### 1. Define your book config

```js
import { inches, pageSpecFromInches } from '@monotykamary/folio'

const config = {
  pageWidth: '7in',
  pageHeight: '10in',
  pageSpecs: {
    cover: pageSpecFromInches({ widthIn: 7, heightIn: 10 }),
    'title-page': pageSpecFromInches({ widthIn: 7, heightIn: 10 }),
    frontmatter: pageSpecFromInches({
      widthIn: 7, heightIn: 10,
      marginTopIn: 0.75, marginBottomIn: 1,
      marginLeftIn: 0.875, marginRightIn: 0.875,
      hasFooter: true,
    }),
    chapter: pageSpecFromInches({
      widthIn: 7, heightIn: 10,
      marginTopIn: 0.75, marginBottomIn: 1,
      marginLeftIn: 0.875, marginRightIn: 0.875,
      hasHeader: true, hasFooter: true,
    }),
    default: pageSpecFromInches({
      widthIn: 7, heightIn: 10,
      marginTopIn: 0.75, marginBottomIn: 1,
      marginLeftIn: 0.875, marginRightIn: 0.875,
      hasHeader: true, hasFooter: true,
    }),
  },

  // How to detect, classify, and measure HTML elements
  elementTypes: [
    // Standard HTML elements
    { selector: 'h1', pageName: null, breakInside: 'avoid', measureAs: 'heading',
      font: { font: '600 22px Georgia, serif', fontSize: 22, lineHeight: 28.6 } },
    { selector: 'h2', pageName: null, breakInside: 'avoid', measureAs: 'heading',
      font: { font: '600 14px Georgia, serif', fontSize: 14, lineHeight: 18.2 } },
    { selector: 'p', pageName: null, breakInside: 'auto', measureAs: 'text',
      font: { font: '10px Georgia, serif', fontSize: 10, lineHeight: 14.7 } },
    { selector: 'pre', pageName: null, breakInside: 'auto', measureAs: 'text',
      font: { font: '8px monospace', fontSize: 8, lineHeight: 12 } },
    { selector: 'figure', pageName: null, breakInside: 'avoid', measureAs: 'image' },
    { selector: 'table', pageName: null, breakInside: 'avoid', measureAs: 'table' },

    // Named page types — elements that define a page's margin/layout
    { selector: '.cover', pageName: 'cover', breakInside: 'avoid',
      isFullPage: true, measureAs: 'fixed', fixedHeight: 960 },
    { selector: '.title-page', pageName: 'title-page', breakInside: 'avoid',
      isFullPage: true, measureAs: 'fixed', fixedHeight: 960 },
    { selector: '.chapter-start', pageName: 'chapter', breakInside: 'auto' },

    // Custom content elements with their own measurement rules
    { selector: '.callout', pageName: null, breakInside: 'avoid', measureAs: 'text',
      font: { font: '9.5px Georgia, serif', fontSize: 9.5, lineHeight: 13.8 },
      contentWidth: 540, heightPadding: 24 },
  ],

  // CSS class names that indicate full-bleed (zero-margin) pages
  fullPageClasses: ['cover', 'title-page'],

  // Structural containers — walked into, not measured as a whole
  containerSelectors: ['.chapter-content'],

  // Page types that get roman numeral labels
  romanPageTypes: ['frontmatter'],

  // Default font specs for fallback measurement
  fonts: {
    body: { font: '10px Georgia, serif', fontSize: 10, lineHeight: 14.7 },
    heading: { font: '600 14px Georgia, serif', fontSize: 14, lineHeight: 18.2 },
    code: { font: '8px monospace', fontSize: 8, lineHeight: 12 },
  },
}
```

### 2. Use with Playwright

```js
import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto('http://localhost:9999', { waitUntil: 'networkidle' })

// Load the Pretext + Folio bundles
await page.addScriptTag({ path: 'node_modules/@chenglou/pretext/dist/layout.js' })
await page.addScriptTag({ path: 'vendor/folio.bundle.js' })

// Measure and estimate pagination
const result = await page.evaluate((config) => {
  const { collectContentBlocks, measureAllBlocks, breakPages } = window.Folio
  const blocks = collectContentBlocks(document.body, config)
  measureAllBlocks(blocks, config)
  return breakPages(blocks, config)
}, config)

console.log(`Estimated ${result.pages.length} pages`)

// Fragment code blocks so they can break across pages
await page.evaluate(() => {
  window.Folio.fragmentCodeBlocks()
})

// Generate PDF — Chrome handles pagination natively
await page.emulateMedia({ media: 'print' })
await page.pdf({
  width: config.pageWidth,
  height: config.pageHeight,
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  margin: { top: '0', bottom: '0', left: '0', right: '0' },
  headerTemplate: '<div></div>',
  footerTemplate: `
    <div style="font-size:9px; font-family:sans-serif; color:#666;
                width:100%; text-align:center; padding-top:4px;">
      <span class="pageNumber"></span>
    </div>`,
})

await browser.close()
```

## API

### Config Types

#### `BookConfig`
Top-level configuration object:

| Field | Type | Description |
|---|---|---|
| `pageWidth` | `string` | CSS length, e.g. `'7in'` or `'210mm'` |
| `pageHeight` | `string` | CSS length, e.g. `'10in'` or `'297mm'` |
| `pageSpecs` | `Record<string, PageSpecConfig>` | Named page types with dimensions + margins |
| `elementTypes` | `ElementMapping[]` | How to detect, classify, and measure elements |
| `fullPageClasses` | `string[]` | CSS classes for full-bleed pages |
| `containerSelectors` | `string[]` | Selectors for structural containers (walked into) |
| `romanPageTypes` | `string[]` | Page types that get roman numeral labels |
| `fonts` | `{ body, heading, code }` | Default font specs for fallback measurement |

#### `ElementMapping`
Per-element-type configuration:

| Field | Type | Description |
|---|---|---|
| `selector` | `string` | CSS selector to match elements |
| `pageName` | `string \| null` | Which named page type (null = inherit) |
| `breakInside` | `'auto' \| 'avoid'` | break-inside behavior |
| `measureAs` | `'text' \| 'heading' \| 'image' \| 'list' \| 'table' \| 'fixed'` | Measurement heuristic |
| `font` | `FontSpec?` | Font for text measurement |
| `isFullPage` | `boolean?` | Full-bleed page element? |
| `fixedHeight` | `number?` | Fixed height in px (for `measureAs: 'fixed'`) |
| `contentWidth` | `number?` | Width override for measurement |
| `heightPadding` | `number?` | Extra height padding (px) |

#### `FontSpec`
| Field | Type | Description |
|---|---|---|
| `font` | `string` | CSS font shorthand |
| `fontSize` | `number` | Font size in px |
| `lineHeight` | `number` | Line height in px |

### Core Functions

#### `collectContentBlocks(root, config) → ContentBlock[]`
Walk the DOM and collect leaf-level content blocks. Uses `elementTypes` for detection and `fullPageClasses` / `containerSelectors` for classification.

#### `measureAllBlocks(blocks, config)`
Measure all blocks using Pretext's text measurement. Populates `ContentBlock.measuredHeightPx`.

#### `breakPages(blocks, config) → PaginationResult`
Run the page-breaking algorithm. Returns `{ pages, totalArabic, totalRoman }` with page assignments and labels (roman numerals for frontmatter, arabic for body).

#### `fragmentCodeBlocks(config?) → FragmentationResult`
Fragment `<pre>` code blocks into line-level `<div>` elements so Chrome can break them across pages. See [docs/code-fragmentation.md](docs/code-fragmentation.md).

#### `splitHighlightedHTML(html) → string[]`
Split syntax-highlighted HTML into per-line strings, preserving open `<span>` tags across newlines.

### DOM Injection

#### `injectPaginatedDOM(result, config) → InjectionResult`
Inject print-specific CSS from config (`@page` rules, break-inside selectors).

#### `waitForAssetsReady() → { imageCount, loadedImages }`
Wait for all images and fonts to load before printing.

### Helpers

#### `inches(n) → number`
Convert inches to CSS pixels (at 96dpi).

#### `pageSpecFromInches(opts) → PageSpecConfig`
Create a page spec from inch values.

## Architecture

| Module | Responsibility |
|---|---|
| `config.ts` | Type definitions for configuration |
| `page-spec.ts` | Page dimension math (content area, margins) |
| `content-block.ts` | DOM walking + Pretext text measurement |
| `page-breaker.ts` | Pure page-breaking algorithm |
| `dom-injector.ts` | CSS injection for Chrome's native pagination |
| `code-fragmenter.ts` | `<pre>` → line-level `<div>` splitting |

The page-breaking algorithm is pure — it takes measured blocks and produces page assignments. No DOM manipulation, no side effects.

## What Folio does NOT do

- **HTML → PDF rendering** — Chrome does that via `page.pdf()`
- **Post-processing** — Orphan page removal and image fixes are Chrome-specific workarounds that belong in your consumer script (see [docs/chrome-quirks.md](docs/chrome-quirks.md))
- **Book-specific styling** — Centering transforms, custom CSS — that's your job
- **Header/footer layout** — Chrome's `displayHeaderFooter` handles this

## Documentation

- [Code Fragmentation](docs/code-fragmentation.md) — How `<pre>` blocks are split for cross-page breaking
- [Chrome Print Quirks](docs/chrome-quirks.md) — Known Chrome bugs and workarounds
- [Full-Bleed Pages](docs/full-bleed-pages.md) — Cover, part dividers, fullpage illustrations
- [Page Numbering](docs/page-numbering.md) — Roman numerals for frontmatter, arabic for body
- [Centering Pages](docs/centering-pages.md) — Title pages, part dividers, dedications
- [Migrating from Paged.js](docs/migrating-from-pagedjs.md) — Step-by-step migration guide

## License

MIT
