# Chrome Print Quirks

Chrome's print renderer has several bugs and limitations that affect book PDF generation. This document catalogs the ones Folio users are likely to encounter and how to work around them.

## 1. Orphan Image Strips After Full-Bleed Pages

### Problem
After a full-bleed page (cover, fullpage illustration), Chrome creates an orphan page containing a small image strip (typically ~378×36px) — a remnant of the full-bleed image that didn't fit on the original page. On the next page, there may also be a completely blank page.

### Cause
Chrome's print renderer doesn't fully clip images at page boundaries when `@page { margin: 0 }` is used. The overflow spills onto a new page.

### Workaround
PyMuPDF post-processing to detect and remove orphan pages:

```python
import fitz  # PyMuPDF

doc = fitz.open('output.pdf')
removed = []
for i in range(doc.page_count - 1, -1, -1):
    page = doc[i]
    text = page.get_text().strip()
    blocks = page.get_text('dict')['blocks']
    img_blocks = [b for b in blocks if b['type'] == 1]

    # Page with only a page number + small image = orphan
    is_only_pnum = len(text) <= 3 and text.isdigit()
    has_small_img = any(
        (b['bbox'][2] - b['bbox'][0]) < 400 or (b['bbox'][3] - b['bbox'][1]) < 100
        for b in img_blocks
    )
    if is_only_pnum and has_small_img:
        removed.append(i)
    # Completely blank page
    if is_only_pnum and not img_blocks:
        removed.append(i)

for i in removed:
    doc.delete_page(i)
doc.save('output.pdf')
```

## 2. Fullpage Image Overflow

### Problem
Images with a 2:3 aspect ratio (e.g., 1024×1536) rendered on a full-bleed page overflow vertically by ~36px. The image renders at the full page width (504pt) but at its natural aspect ratio (504×756pt) — 36px taller than the 720pt page.

### Cause
Chrome's print renderer ignores `object-fit: cover` on `<img>` elements. It renders the image at its natural dimensions scaled to fit the width, without clipping at the page boundary.

### Workaround
PyMuPDF content stream editing — replace the image transform matrix:

```python
import fitz

doc = fitz.open('output.pdf')
for i in range(doc.page_count):
    page = doc[i]
    for cxref in page.get_contents():
        stream = doc.xref_stream(cxref)
        if not stream:
            continue
        # Chrome's internal coords: 2100×3000 (0.24 scale → 504×720pt)
        # Images get height 3150 (3150×0.24=756pt, overflowing by 36pt)
        # Replace with 3000 (3000×0.24=720pt, exact fit)
        new_stream = stream.replace(
            b'2100 0 0 -3150 0 3150 cm',
            b'2100 0 0 -3000 0 3000 cm'
        )
        if new_stream != stream:
            doc.update_stream(cxref, new_stream)
doc.save('output.pdf')
```

**Note**: The exact transform values depend on your image's aspect ratio. The `3150` value is `(756/720) × 3000`. For different image ratios, calculate the replacement height as `(page_height_pt / 0.24)`. The 5% vertical stretch from 2:3 to 7:10 is barely noticeable.

## 3. Named `@page` Rules Don't Always Apply

### Problem
Chrome supports CSS named pages (`@page cover { margin: 0; }`) but they don't apply reliably. When a named `@page` rule fails, the page falls back to the unnamed `@page { ... }` rule. This causes cascading failures because Folio injects `@page { margin: 0; }` as the unnamed fallback (to satisfy the `page.pdf({ margin: 0 })` contract) — so any page whose named rule doesn't apply gets **zero margins** instead of its intended layout.

### Which Pages Are Affected
- **`@page title-page { margin: 0; }`** — fails often for pages immediately after `:first` (the cover). The title page gets the unnamed `margin: 0` fallback instead of zero margins, causing flex-centered content to misalign.
- **`@page fullpage-image { margin: 0; }`** — fails when the `page:` CSS property name doesn't match between `injectPaginatedDOM` (which uses `pageName` from the config) and the user's static CSS.
- **`@page frontmatter { ... }`** — fails for dedication, ToC, and other frontmatter pages, causing them to lose their margins and page number style (roman → arabic).
- **`@page chapter { ... }`** — fails less often but can cause chapter pages to lose their running headers.

### Why It Happens
Chrome's `@page` implementation is unreliable in print mode. The `page:` CSS property on elements and the matching `@page <name>` rule don't always connect. This is a Chrome bug, not a CSS spec issue — the same CSS works in other browsers.

### Symptoms
When a named `@page` rule fails:
1. **Zero-margin pages (cover, title, fullpage)** get the unnamed `@page { margin: 0 }` — they still have zero margins, which happens to be correct. But content that relied on named-page-specific behavior (like running header suppression) won't get it.
2. **Margin-bearing pages (frontmatter, chapter)** get the unnamed `@page { margin: 0 }` instead of their intended margins. Content overflows, centering breaks, page numbers vanish.
3. **CSS margin boxes** (`@bottom-center`) from the named `@page` rule don't render. Page numbers fall back to the unnamed rule's margin box behavior.

### Workaround: Redundant Named Page Injection
The only reliable approach is **belt-and-suspenders**: explicitly re-inject EVERY named `@page` rule in your own `<style>` element after calling `injectPaginatedDOM()`. This ensures that even when Chrome's named page bug triggers, a correct named `@page` rule exists in a later stylesheet.

```js
await page.evaluate((config) => {
  // Let Folio inject generic @page + page: properties
  window.Folio.injectPaginatedDOM(paginationResult, config)

  // Then re-state every named @page rule explicitly as a safety net.
  // Chrome's last-css-wins means these override Folio's rules
  // when the named page bug tries to fall back.
  const style = document.createElement('style')
  style.textContent = `
    @media print {
      /* Keep the unnamed fallback at safe margins, not zero.
         This is the critical safety net — when any named page
         fails, the fallback is safe instead of margin: 0. */
      @page {
        margin: 0.75in 0.875in 1in 0.875in;
      }

      /* Re-state every named page rule */
      @page default { margin: 0.75in 0.875in 1in 0.875in; }
      @page cover { margin: 0; @top-center: none; @bottom-center: none; }
      @page title-page { margin: 0; @top-center: none; @bottom-center: none; }
      @page part { margin: 0; @top-center: none; @bottom-center: none; }
      @page frontmatter { margin: 0.75in 0.875in 1in 0.875in; }
      @page chapter { margin: 0.75in 0.875in 1in 0.875in; }
      @page fullpage { margin: 0; @top-center: none; @bottom-center: none; }
      @page fullpage-image { margin: 0; @top-center: none; @bottom-center: none; }
    }
  `
  document.head.appendChild(style)
}, config)
```

### Workaround: Transform-Based Centering
For full-bleed pages with centered content (title page, part dividers), don't rely on flexbox centering — Chrome's print renderer doesn't support it reliably even when `@page margins` are correct. Use `transform: translate()` instead:

```css
.title-page {
  width: 100%;  /* adapts to actual content area width */
  transform: translateY(1.5in) !important;
}
```

The `width: 100%` prevents overflow when the content area is narrower than expected (e.g., 5.25in instead of 7in). See [centering-pages.md](centering-pages.md) for calibration techniques.

### Workaround: CSS Margin Boxes vs displayHeaderFooter
`displayHeaderFooter: true` renders page numbers on every page with no way to exclude the cover. CSS `@page margin boxes` (`@bottom-center`) support per-page control via named `@page` rules — but they depend on those rules working. The safe approach is:

- Use CSS margin boxes for page numbers (per-page control)
- Suppress margin boxes on the unnamed `@page` fallback so pages don't get duplicate numbers
- Accept that when Chrome's named page bug triggers, page numbering may fall back to arabic instead of roman for frontmatter

### Why This Matters for Folio Users
Folio's `injectPaginatedDOM()` injects `@page` rules and `page:` CSS properties from your `BookConfig`. This is correct per the CSS spec. But Chrome's bug means you should **always** re-state your `@page` rules redundantly in your own print CSS as described above. Folio handles the generic scaffolding; your redundant rules are the safety net.

## 4. `object-fit` Ignored in Print Mode

### Problem
Chrome's print renderer ignores `object-fit: cover` and `object-fit: contain` on `<img>` elements. Images are rendered at their natural dimensions scaled to fit the containing element's width.

### What Was Tried
| Approach | Result |
|---|---|
| `object-fit: cover !important` | No effect |
| `background-image` + `display: none` on `<img>` | Pages disappeared entirely |
| Explicit `img.style.width/height` | Pages reflowed/disappeared |
| PyMuPDF content stream editing | ✅ Works (see above) |

## 5. Page Numbers in Headers/Footers

### Problem
Chrome's `displayHeaderFooter: true` renders page numbers in both the header and footer. If you also have CSS `@bottom-center` content (from paged.js or other CSS), you get duplicate page numbers.

### Workaround
Suppress CSS margin boxes and use only Chrome's `footerTemplate`:

```css
@media print {
  @page {
    @top-center { content: none; }
    @bottom-center { content: none; }
  }
}
```

```js
await page.pdf({
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',  // empty header
  footerTemplate: `
    <div style="font-size:9px; font-family:sans-serif; color:#666;
                width:100%; text-align:center; padding-top:4px;">
      <span class="pageNumber"></span>
    </div>`,
  margin: { top: '0', bottom: '0', left: '0', right: '0' },
})
```

The `margin: 0` in `page.pdf()` prevents Chrome from adding its own margins on top of your CSS `@page` margins.

## 6. CSS `in` Units Resolve at Unexpected DPI

### Problem
When using `transform: translateX(1.15in)` in print CSS, the actual pixel shift may not match what 72dpi would predict (82.8px). Chrome resolves CSS inch units at an intermediate DPI during print layout.

### Workaround
Empirically measure the actual shift and adjust. Use PyMuPDF to inspect the rendered page and find the visual center:

```python
import fitz
doc = fitz.open('output.pdf')
page = doc[0]
blocks = page.get_text('dict')['blocks']
# Calculate the center of mass of content blocks
# Compare against the page center (504/2 = 252pt for 7in width)
```

Typical intermediate DPI is ~54 (0.5625× of 96dpi), making `1in` ≈ 54px instead of 72px or 96px.
