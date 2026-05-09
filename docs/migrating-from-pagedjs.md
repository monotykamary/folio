# Migrating from Paged.js

This guide helps you migrate an existing Paged.js book PDF pipeline to Folio.

## Why Migrate?

| | Paged.js | Folio |
|---|---|---|
| DOM restructuring | Rewrites DOM into `.pagedjs_page` divs | No restructuring |
| Stabilization code | 800+ lines to undo DOM changes | Not needed |
| Double pagination | Paged.js + Chrome both paginate | Chrome only |
| Page numbers | PyMuPDF stamping | Chrome's `displayHeaderFooter` |
| Code fragmentation | `prepareFragmentableCodeBlocks()` re-highlights | `fragmentCodeBlocks()` preserves existing highlights |
| Typical consumer script | ~1,000 lines | ~500 lines |

## Step 1: Remove Paged.js Dependencies

```diff
- await page.addScriptTag({ path: 'vendor/pagedjs/paged.polyfill.js' })
- await page.waitForFunction(() => window.PagedPolyfill)
+ await page.addScriptTag({ path: 'node_modules/@monotykamary/folio/vendor/folio.bundle.js' })
+ await page.waitForFunction(() => window.Folio?.paginate)
```

Or include it as a script tag in your HTML:

```html
- <script src="vendor/pagedjs/paged.polyfill.js"></script>
+ <script src="node_modules/@monotykamary/folio/vendor/folio.bundle.js"></script>
```

## Step 2: Replace `paged.preview()` with `Folio.paginate()`

Paged.js's `preview()` restructures the DOM. Folio's `paginate()` does the
same job — measuring, page-breaking, CSS injection, code fragmentation —
but without any DOM restructuring.

### Before: Paged.js

```js
const handlers = {
  afterRendered(pages) {
    // Fix up page content after paged.js renders
  },
}
window.PagedPolyfill.registerHandlers(handlers)
await page.evaluate(() => window.PagedPolyfill.preview())
```

### After: Folio one-call

```js
await page.evaluate((config) => {
  const result = window.Folio.paginate(config)
  console.log(`Estimated ${result.pagination.pages.length} pages`)
}, config)
```

### After: Folio step-by-step

If you need more control over each step:

```js
await page.evaluate((config) => {
  const { collectContentBlocks, measureAllBlocks, breakPages,
          injectPaginatedDOM, fragmentCodeBlocks } = window.Folio
  const blocks = collectContentBlocks(document.body, config)
  measureAllBlocks(blocks, config)
  const result = breakPages(blocks, config)
  injectPaginatedDOM(result, config)
  fragmentCodeBlocks()
}, config)
```

## Step 3: Remove Stabilization/Freeze/Stamp Code

Delete these functions entirely — they existed solely to undo paged.js's DOM restructuring:

- `stabilizePagedPreviewForPdf()` — needed to undo paged.js DOM restructuring
- `freezePagedPreviewToStaticPages()` — needed to make paged.js output printable
- `waitForStaticPagesReady()` — needed to wait for frozen pages to settle
- `stampPdfPageNumbers()` — needed because paged.js page numbers weren't captured by Chrome

Folio doesn't restructure the DOM, so none of these are needed.
If you used `paginate()`, code fragmentation and CSS injection are already done.
If you're calling functions individually, add:

```js
await page.evaluate(() => window.Folio.fragmentCodeBlocks())
```

Chrome handles page numbers natively:

```js
await page.pdf({
  displayHeaderFooter: true,
  footerTemplate: `<div style="font-size:9px; text-align:center; padding-top:4px;">
    <span class="pageNumber"></span>
  </div>`,
  margin: { top: '0', bottom: '0', left: '0', right: '0' },
})
```

## Step 4: Replace Code Block Fragmentation

### Before: `prepareFragmentableCodeBlocks()`

Paged.js's fragmentation re-highlights each line from scratch using `hljs.highlight()`. This works but requires highlight.js to be available and can be slow.

### After: `fragmentCodeBlocks()`

Folio's fragmentation preserves existing syntax highlighting by tracking open `<span>` tags across `\n` boundaries. It's faster and works with any highlighter.

```js
const result = await page.evaluate(() => window.Folio.fragmentCodeBlocks())
console.log(`Fragmented ${result.fragmentedCount} code blocks`)
```

If you had custom CSS for `.paged-pre-line`, update the class names:

```diff
- .paged-pre-line {
+ .folio-line {
    break-inside: avoid;
  }
```

Or configure Folio to use your existing class names:

```js
fragmentCodeBlocks({
  containerClass: 'paged-pre',
  lineClass: 'paged-pre-line',
  lineDataAttr: 'data-paged-pre-line',
})
```

## Step 5: Add Folio Config

Create a `BookConfig` object. This is where all your book-specific knowledge goes:

```js
const config = {
  pageWidth: '7in',
  pageHeight: '10in',
  pageSpecs: {
    cover: pageSpecFromInches({ widthIn: 7, heightIn: 10 }),
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
  elementTypes: [
    { selector: 'h1', breakInside: 'avoid', measureAs: 'heading', font: { ... } },
    { selector: 'p', breakInside: 'auto', measureAs: 'text', font: { ... } },
    { selector: '.cover', pageName: 'cover', isFullPage: true, measureAs: 'fixed', fixedHeight: 960 },
    // ... add all your element types
  ],
  fullPageClasses: ['cover'],
  containerSelectors: ['.chapter-content'],
  romanPageTypes: ['frontmatter'],
  fonts: {
    body: { font: '10px Georgia, serif', fontSize: 10, lineHeight: 14.7 },
    heading: { font: '600 14px Georgia, serif', fontSize: 14, lineHeight: 18.2 },
    code: { font: '8px monospace', fontSize: 8, lineHeight: 12 },
  },
}
```

## Step 6: Update CSS

### Remove Paged.js CSS

```diff
- .pagedjs_page { ... }
- .pagedjs_pagebox { ... }
- .pagedjs_page_content { ... }
- .pagedjs_margin-bottom { ... }
```

### Add Folio-compatible CSS

```css
@media print {
  @page { margin: 0; }
  @page cover { margin: 0; }
  @page chapter {
    margin: 0.75in 0.875in 1in 0.875in;
  }

  /* Full-bleed pages */
  .cover { page-break-after: always; }
  .fullpage-illustration { page-break-before: always; page-break-after: always; }

  /* Chapter breaks */
  .chapter { page-break-before: always; }

  /* Code line fragments */
  .folio-line { break-inside: avoid; }
  .folio-line[data-empty="true"] { height: 1em; }
  pre { break-inside: auto; }
}
```

## Step 7: Post-Processing

If you used PyMuPDF for stamping page numbers, you no longer need it for that. You may still need it for:

- **Orphan image strip removal** — Chrome creates these after full-bleed pages
- **Fullpage image overflow** — Chrome ignores `object-fit` in print

See [chrome-quirks.md](chrome-quirks.md) for these PyMuPDF workarounds.

## Common Pitfalls

### "My elements are being pushed to the next page"

Check that `pre { break-inside: auto; }` is in your print CSS. The default `break-inside: avoid` prevents code blocks from splitting across pages.

### "Pages are numbered twice"

Suppress CSS `@bottom-center` and use only Chrome's `footerTemplate`:

```css
@page { @bottom-center { content: none; } }
```

### "Content doesn't fill the page"

Make sure `page.pdf()` uses `margin: 0` and let CSS `@page` rules handle the actual margins. This prevents Chrome from double-applying margins.

### "Code blocks lost their highlighting"

Folio's `fragmentCodeBlocks()` preserves existing highlight.js spans. Make sure `hljs.highlightAll()` has run **before** calling `fragmentCodeBlocks()`.
