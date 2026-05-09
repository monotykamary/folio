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
Chrome supports CSS named pages (`@page title-page { margin: 0; }`) but they don't apply reliably for pages immediately after `@page :first`.

### What Works
- `@page :first { margin: 0; }` — always works
- `@page cover { margin: 0; }` — works for pages with `page: cover` set via CSS
- `@page fullpage { margin: 0; }` — works for pages after chapter content

### What Doesn't Work Reliably
- `@page title-page { margin: 0; }` on the page right after the cover (`:first`)

### Workaround
Use CSS `transform` to simulate the effect of zero margins:

```css
.title-page {
  /* Instead of relying on @page title-page { margin: 0 } */
  transform: translateX(0.875in);  /* compensate for missing margin */
}
```

See [centering-pages.md](centering-pages.md) for detailed centering techniques.

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
