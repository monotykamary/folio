<p align="center">
  <img src="https://raw.githubusercontent.com/monotykamary/folio/main/assets/folio-hero.png" alt="Folio hero illustration" width="600">
</p>

<h1 align="center">@monotykamary/folio</h1>

<p align="center">
  <strong>Turn HTML into a paginated book PDF.</strong>
</p>

<p align="center">
  Measure with <a href="https://github.com/chenglou/pretext">Pretext</a>, paginate with Chrome — no DOM restructuring, no stabilization, no double-pagination.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@monotykamary/folio"><img src="https://img.shields.io/npm/v/@monotykamary/folio" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/monotykamary/folio?logo=opensourceinitiative&logoColor=white" alt="license"></a>
</p>

---

## Get a book PDF in 30 seconds

```sh
npm install @monotykamary/folio
```

### Option A: Script tag in your HTML

Add the script, call `paginate()`, print from the browser:

```html
<script src="node_modules/@monotykamary/folio/vendor/folio.bundle.js"></script>
<script>
  Folio.paginate({
    pageWidth: '7in',
    pageHeight: '10in',
    pageSpecs: { default: { width: 672, height: 960, marginTop: 72, marginBottom: 96, marginLeft: 84, marginRight: 84, hasHeader: true, hasFooter: true } },
    elementTypes: [
      { selector: 'h1', breakInside: 'avoid', measureAs: 'heading', font: { font: '600 22px Georgia, serif', fontSize: 22, lineHeight: 28.6 } },
      { selector: 'p', breakInside: 'auto', measureAs: 'text', font: { font: '10px Georgia, serif', fontSize: 10, lineHeight: 14.7 } },
      { selector: 'figure', breakInside: 'avoid', measureAs: 'image' },
      { selector: 'pre', breakInside: 'auto', measureAs: 'text', font: { font: '8px monospace', fontSize: 8, lineHeight: 12 } },
    ],
    fullPageClasses: [],
    containerSelectors: [],
    romanPageTypes: [],
    fonts: {
      body: { font: '10px Georgia, serif', fontSize: 10, lineHeight: 14.7 },
      heading: { font: '600 14px Georgia, serif', fontSize: 14, lineHeight: 18.2 },
      code: { font: '8px monospace', fontSize: 8, lineHeight: 12 },
    },
  }).then(result => {
    console.log(`Estimated ${result.pagination.pages.length} pages`)
    window.print()
  })
</script>
```

### Option B: Playwright / Puppeteer

Load the bundle from Node, generate the PDF programmatically:

```js
import { chromium } from 'playwright'
import { resolve } from 'path'

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('http://localhost:8080/my-book.html', { waitUntil: 'networkidle' })

// Load Folio (includes Pretext — no separate script needed)
await page.addScriptTag({
  path: resolve('node_modules/@monotykamary/folio/vendor/folio.bundle.js')
})

// One-call: measure, paginate, inject CSS, fragment code blocks
await page.evaluate(() => window.Folio.paginate(window.FolioConfig))

// Generate the PDF
await page.emulateMedia({ media: 'print' })
await page.pdf({
  path: 'my-book.pdf',
  width: '7in', height: '10in',
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

That's it. Your HTML + `@page` CSS rules → paginated PDF.

## How it works

```
┌──────────────────────────────────────────────────────┐
│                    Your HTML                         │
│         + CSS @page rules for layout                 │
└──────────────────────┬───────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │    Folio + Pretext      │
          │                         │
          │  • Walks the DOM        │
          │  • Measures text        │
          │  • Estimates pages      │
          │  • Fragments code       │
          │  • Injects CSS          │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │   Chrome page.pdf()     │
          │                         │
          │  Uses your @page CSS    │
          │  for actual pagination  │
          │  and rendering          │
          └────────────┬────────────┘
                       │
              ┌────────▼────────┐
              │   Book PDF 📖   │
              └─────────────────┘
```

**Folio never restructures your DOM.** It measures content to estimate pagination and injects CSS to help Chrome's native print renderer do its job. Chrome handles the actual page breaks — no double-pagination, no stabilization, no freeze/stamp pipeline.

## Adding measurement

The quick-start examples work great for simple books. For more control over page estimation (roman numeral frontmatter, per-element measurement, custom page types), define a `BookConfig`:

```js
const config = {
  pageWidth: '7in',
  pageHeight: '10in',

  // Named page types — each can have its own margins, header/footer
  pageSpecs: {
    cover:     { width: 672, height: 960, marginTop: 0, ...rest: 0, hasHeader: false, hasFooter: false },
    chapter:  { width: 672, height: 960, marginTop: 72, marginBottom: 96, marginLeft: 84, marginRight: 84, hasHeader: true, hasFooter: true },
    default:  { width: 672, height: 960, marginTop: 72, marginBottom: 96, marginLeft: 84, marginRight: 84, hasHeader: true, hasFooter: true },
  },

  // How Folio recognizes and measures your HTML elements
  elementTypes: [
    // Standard HTML — Folio measures these with Pretext
    { selector: 'h1', breakInside: 'avoid', measureAs: 'heading',
      font: { font: '600 22px Georgia, serif', fontSize: 22, lineHeight: 28.6 } },
    { selector: 'p', breakInside: 'auto', measureAs: 'text',
      font: { font: '10px Georgia, serif', fontSize: 10, lineHeight: 14.7 } },
    { selector: 'figure', breakInside: 'avoid', measureAs: 'image' },

    // Named pages — elements that define a page's layout
    { selector: '.cover', pageName: 'cover', isFullPage: true, measureAs: 'fixed', fixedHeight: 960 },
    { selector: '.chapter', pageName: 'chapter' },

    // Custom elements with their own measurement rules
    { selector: '.callout', breakInside: 'avoid', measureAs: 'text',
      font: { font: '9.5px Georgia, serif', fontSize: 9.5, lineHeight: 13.8 },
      contentWidth: 540, heightPadding: 24 },
  ],

  // Full-bleed pages (zero margins)
  fullPageClasses: ['cover'],

  // Structural containers — Folio walks into these, doesn't measure as a block
  containerSelectors: ['.chapter-content'],

  // Frontmatter gets roman numerals (i, ii, iii...)
  romanPageTypes: ['frontmatter'],

  // Fallback fonts for unlabeled elements
  fonts: {
    body:    { font: '10px Georgia, serif', fontSize: 10, lineHeight: 14.7 },
    heading: { font: '600 14px Georgia, serif', fontSize: 14, lineHeight: 18.2 },
    code:    { font: '8px monospace', fontSize: 8, lineHeight: 12 },
  },
}
```

Then either call `paginate()` for the one-shot path:

```js
const result = await window.Folio.paginate(config)
console.log(`Estimated ${result.pagination.pages.length} pages`)
console.log(`  ${result.pagination.totalRoman} roman, ${result.pagination.totalArabic} arabic`)
```

Or use the individual functions for step-by-step control:

```js
const { collectContentBlocks, measureAllBlocks, breakPages,
        injectPaginatedDOM, fragmentCodeBlocks } = window.Folio

const blocks = collectContentBlocks(document.body, config)
measureAllBlocks(blocks, config)
const result = breakPages(blocks, config)
injectPaginatedDOM(result, config)
fragmentCodeBlocks()
```

### Helper: `pageSpecFromInches()`

Writing pixel values is error-prone. Use the helper:

```js
import { pageSpecFromInches } from '@monotykamary/folio'

pageSpecFromInches({
  widthIn: 7, heightIn: 10,
  marginTopIn: 0.75, marginBottomIn: 1,
  marginLeftIn: 0.875, marginRightIn: 0.875,
  hasHeader: true, hasFooter: true,
})
```

## Page anatomy

A book page in Folio has three zones. Your `@page` CSS controls the margins:

```
┌───────────────────────────────────────┐
│  margin-top                           │
│  ┌──────────────────────────────────┐ │
│  │  [header — running chapter name] │ │  ← hasHeader
│  │                                  │ │
│  │         content area             │ │
│  │                                  │ │
│  │    Your paragraphs, code,        │ │
│  │    images, tables, callouts...   │ │
│  │                                  │ │
│  │                                  │ │
│  │  [footer — page number]          │ │  ← hasFooter
│  └──────────────────────────────────┘ │
│  margin-bottom                        │
└───────────────────────────────────────┘
```

- **`page.pdf(margin: 0)`** — Always. Folio uses CSS `@page` rules for margins, not Chrome's API.
- **`displayHeaderFooter: true`** — Chrome renders the header/footer inside the margin area.
- **`hasHeader` / `hasFooter`** — In your page spec, tells Folio whether to assign header text / page labels.

## Code blocks that break across pages

Chrome applies `break-inside: avoid` to `<pre>` elements, pushing entire code blocks to the next page. A 25-line code block can leave a 6-inch gap.

Folio fragments code blocks into line-level `<div>`s:

```js
await page.evaluate(() => {
  const result = window.Folio.fragmentCodeBlocks()
  console.log(`Fragmented ${result.fragmentedCount} blocks into ${result.totalLines} lines`)
})
```

Each line still has `break-inside: avoid` (no mid-line breaks), but the block **can** break between lines. Syntax highlighting is preserved — Folio tracks open `<span>` tags and closes/reopens them at line boundaries.

See [docs/code-fragmentation.md](docs/code-fragmentation.md) for details and configuration.

## Full-bleed pages

Covers, title pages, part dividers — pages with zero margins where content extends to the edges:

```css
@media print {
  @page cover { margin: 0; }
  @page fullpage-image { margin: 0; }
}
```

```js
// In your config:
elementTypes: [
  { selector: '.cover', pageName: 'cover', isFullPage: true,
    measureAs: 'fixed', fixedHeight: 960 },
  { selector: '.fullpage-illustration', pageName: 'fullpage-image',
    isFullPage: true, measureAs: 'fixed', fixedHeight: 960 },
],
fullPageClasses: ['cover', 'fullpage-illustration'],
```

Folio places full-page elements on their own page. See [docs/full-bleed-pages.md](docs/full-bleed-pages.md) for fullpage illustrations, part dividers, and Chrome's `object-fit` bug.

## Page numbering

Frontmatter gets roman numerals, body gets arabic — the standard convention:

```js
romanPageTypes: ['frontmatter'],
```

Chrome's `footerTemplate` renders the numbers:

```js
await page.pdf({
  displayHeaderFooter: true,
  footerTemplate: `
    <div style="font-size:9px; font-family:sans-serif; color:#666;
                width:100%; text-align:center; padding-top:4px;">
      <span class="pageNumber"></span>
    </div>`,
  // ...
})
```

Suppress page numbers on full-bleed pages by setting `hasFooter: false` in their page spec. See [docs/page-numbering.md](docs/page-numbering.md).

## Migrating from Paged.js

Folio was built as a Paged.js replacement. The migration is straightforward:

1. **Remove** `paged.polyfill.js` and all Paged.js hooks
2. **Delete** `stabilizePagedPreviewForPdf`, `freezePagedPreviewToStaticPages`, `waitForStaticPagesReady`, `stampPdfPageNumbers` — Folio doesn't need any of these
3. **Replace** `paged.preview()` with `Folio.paginate(config)` — same one-call convenience, no DOM restructuring
4. **Replace** `prepareFragmentableCodeBlocks()` with `fragmentCodeBlocks()` — preserves existing highlighting instead of re-highlighting
5. **Add** a `BookConfig` with your page types, element types, and fonts
6. **Update** CSS: remove `.pagedjs_page` rules, add `@page` named-page rules
7. **Use** Chrome's `displayHeaderFooter` for page numbers instead of PyMuPDF stamping

See [docs/migrating-from-pagedjs.md](docs/migrating-from-pagedjs.md) for the full step-by-step guide.

### Why not Paged.js?

Paged.js restructures your DOM into `.pagedjs_page` divs. This causes:

- **Double pagination** — Paged.js paginates, then Chrome re-paginates on print
- **800+ lines of stabilization** — You need `stabilizePagedPreviewForPdf`, `freezePagedPreviewToStaticPages`, `waitForStaticPagesReady`, and `stampPdfPageNumbers` to undo the DOM restructuring so Chrome can actually print it
- **Header/footer conflicts** — Paged.js renders headers/footers as DOM elements that conflict with Chrome's own

## API Reference

### `paginate(config, options?) → { pagination, fragmentation, injected }`

The one-call convenience. Measures, paginates, injects CSS, and fragments code blocks — everything you need in a single function.

```js
const result = await window.Folio.paginate(config)
result.pagination.pages.length  // estimated page count
result.fragmentation             // { fragmentedCount, totalLines } or null
result.injected                  // whether CSS was injected
```

Options:

| Option | Default | Description |
|---|---|---|
| `root` | `<main>` or `<body>` | Root element to paginate |
| `fragmentation` | default config | `FragmentationConfig` to customize, or `false` to skip |
| `injectCSS` | `true` | Inject `@page` rules and `break-inside` selectors from config |

This is equivalent to calling the individual functions manually:

```js
// paginate(config) does all of this:
const blocks = collectContentBlocks(root, config)
measureAllBlocks(blocks, config)
const pagination = breakPages(blocks, config)
injectPaginatedDOM(pagination, config)
const fragmentation = fragmentCodeBlocks()
```

### `fragmentCodeBlocks(config?) → { fragmentedCount, totalLines }`

Fragment `<pre>` elements into line-level `<div>`s. Short blocks (< 8 lines) are left alone.

```js
// With defaults:
window.Folio.fragmentCodeBlocks()

// Custom thresholds and class names:
window.Folio.fragmentCodeBlocks({
  minLinesToFragment: 4,
  containerClass: 'my-code',
  lineClass: 'my-line',
  lineDataAttr: 'data-line',
})
```

### `collectContentBlocks(root, config) → ContentBlock[]`

Walk the DOM and collect leaf-level content blocks. Uses your `elementTypes` for detection, `fullPageClasses` for full-bleed, `containerSelectors` for structural containers.

```js
const blocks = window.Folio.collectContentBlocks(document.body, config)
// blocks[i] = { element, pageName, breakInside, measuredHeightPx, isFullPage, ... }
```

### `measureAllBlocks(blocks, config)`

Measure all blocks using Pretext's text measurement. Populates `ContentBlock.measuredHeightPx` in place.

```js
window.Folio.measureAllBlocks(blocks, config)
// blocks[0].measuredHeightPx → 42.5
```

### `breakPages(blocks, config) → PaginationResult`

Run the page-breaking algorithm. Pure function — no DOM side effects.

```js
const result = window.Folio.breakPages(blocks, config)
result.pages        // Page[] — page assignments
result.totalArabic  // Number of body pages
result.totalRoman   // Number of frontmatter pages
```

### `injectPaginatedDOM(result, config) → InjectionResult`

Inject CSS `@page` rules and `break-inside` selectors from your config into the document.

```js
window.Folio.injectPaginatedDOM(result, config)
```

### `waitForAssetsReady() → { imageCount, loadedImages }`

Wait for all images and fonts to finish loading before generating the PDF.

```js
const { imageCount, loadedImages } = await window.Folio.waitForAssetsReady()
```

### `splitHighlightedHTML(html) → string[]`

Split syntax-highlighted HTML into per-line strings, preserving open `<span>` tags across newlines. Used internally by `fragmentCodeBlocks()`, but available for custom use.

```js
window.Folio.splitHighlightedHTML('<span class="hljs-keyword">SELECT</span> id\nFROM users')
// → ['<span class="hljs-keyword">SELECT</span> id</span>',
//    '<span class="hljs-keyword">FROM</span> users']
```

### Config types

<details>
<summary><strong>BookConfig</strong></summary>

| Field | Type | Description |
|---|---|---|
| `pageWidth` | `string` | CSS length (`'7in'`, `'210mm'`) |
| `pageHeight` | `string` | CSS length (`'10in'`, `'297mm'`) |
| `pageSpecs` | `Record<string, PageSpecConfig>` | Named page types with dimensions + margins |
| `elementTypes` | `ElementMapping[]` | How to detect, classify, and measure elements |
| `fullPageClasses` | `string[]` | CSS classes for full-bleed pages |
| `containerSelectors` | `string[]` | Selectors for structural containers (walked into) |
| `romanPageTypes` | `string[]` | Page types that get roman numeral labels |
| `fonts` | `{ body, heading, code }` | Default font specs for fallback measurement |

</details>

<details>
<summary><strong>ElementMapping</strong></summary>

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

</details>

<details>
<summary><strong>FontSpec</strong></summary>

| Field | Type | Description |
|---|---|---|
| `font` | `string` | CSS font shorthand (`'10px Georgia, serif'`) |
| `fontSize` | `number` | Font size in px |
| `lineHeight` | `number` | Line height in px |

</details>

<details>
<summary><strong>PageSpecConfig</strong></summary>

| Field | Type | Description |
|---|---|---|
| `width` | `number` | Page width in px (at 96dpi) |
| `height` | `number` | Page height in px (at 96dpi) |
| `marginTop` | `number` | Top margin in px |
| `marginBottom` | `number` | Bottom margin in px |
| `marginLeft` | `number` | Left margin in px |
| `marginRight` | `number` | Right margin in px |
| `hasHeader` | `boolean` | Show running header on this page type |
| `hasFooter` | `boolean` | Show page number on this page type |

Use `pageSpecFromInches()` to create one from inch values instead of pixel math.

</details>

## Architecture

| Module | Responsibility |
|---|---|
| `config.ts` | Type definitions + helpers (`inches()`, `pageSpecFromInches()`) |
| `page-spec.ts` | Page dimension math (content area, margins) |
| `content-block.ts` | DOM walking + Pretext text measurement |
| `page-breaker.ts` | Pure page-breaking algorithm + `paginate()` convenience |
| `dom-injector.ts` | CSS injection for Chrome's native pagination |
| `code-fragmenter.ts` | `<pre>` → line-level `<div>` splitting |

The page-breaking algorithm is pure — it takes measured blocks and produces page assignments. No DOM manipulation, no side effects.

## What Folio does NOT do

- **HTML → PDF rendering** — Chrome does that via `page.pdf()`
- **Post-processing** — Orphan page removal and image fixes are Chrome workarounds (see [docs/chrome-quirks.md](docs/chrome-quirks.md))
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
