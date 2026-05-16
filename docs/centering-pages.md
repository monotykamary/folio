# Centering Pages

Title pages, part dividers, and dedications need their content centered on the page. This is harder than it sounds in a print context because Chrome's named `@page` rules don't always apply, and flexbox centering breaks when the page's margin is wrong.

## The Problem

Your CSS says:

```css
.title-page {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 10in;
}
```

But Chrome's `@page title-page { margin: 0 }` doesn't apply for pages right after `@page :first`. So your title page gets the default 0.75in/0.875in margins, and the flex centering is relative to the *margined* area — not the full page.

## Solution: CSS `transform`

The most reliable workaround is to use `transform` to shift content into the visual center. This works because `transform` doesn't affect Chrome's page-break calculations.

### Title Page Centering

```css
@media print {
  .title-page {
    /* width: 100% prevents overflow clipping when Chrome's named @page
       bug causes fallback to the unnamed @page with non-zero margins.
       A fixed width (e.g. 7in) would overflow the narrower content area
       and get clipped, shifting content left. */
    width: 100% !important;
    /* Use transform for vertical centering since Chrome's print renderer
       doesn't reliably support flexbox centering. */
    transform: translateY(1.5in) !important;
    padding: 1in !important;
  }
}
```

The values are calculated for a page where `@page title-page { margin: 0 }` is correctly applied (full-bleed). The `padding: 1in` provides horizontal centering. The `translateY` shifts content to vertical center:
- Page height: 10in
- Padding: 1in top + 1in bottom
- Content area: 8in tall
- Content height: ~5in (title + subtitle + author + copyright)
- Shift: (8 - 5) / 2 ≈ 1.5in

**Why `width: 100%` instead of a fixed width?** When Chrome's named `@page` bug causes the title page to fall back to the unnamed `@page { margin: 0.875in left }`, the content area is only 5.25in wide. A fixed `width: 7in` would overflow by 1.75in and get clipped — shifting all content left. `width: 100%` adapts to the actual content area width regardless of which `@page` rule Chrome uses.

#### How to Calculate the Values

1. Generate the PDF without any transform
2. Use PyMuPDF to find the current center of content:

```python
import fitz
doc = fitz.open('output.pdf')
page = doc[title_page_index]
blocks = page.get_text('dict')['blocks']

y_positions = []
for b in blocks:
    if b['type'] == 0:
        for line in b['lines']:
            for span in line['spans']:
                y_positions.append(span['origin'][1])

current_cy = (min(y_positions) + max(y_positions)) / 2

# Target center for 7x10in page
target_cy = 360  # 720pt / 2 = 360 (in points at 72dpi)

print(f'Adjust translateY by: {(target_cy - current_cy)/54:.2f}in')  # ~54dpi intermediate
```

**Note**: Chrome resolves CSS `in` units at an intermediate DPI (~54, not 72 or 96) during print layout. The exact value varies — measure empirically.

### Part Divider Centering

Part dividers are typically shorter content (a title and subtitle) centered vertically. The `@page part { margin: 0; }` must be redundantly injected (see chrome-quirks.md §3) for the full-bleed layout to work. The `translateY` value positions the top of the content so its visual center aligns with the page center:

```css
@media print {
  .part-divider {
    padding: 0 !important;
    transform: translateY(4.05in) !important;
  }
}
```

### Dedication Centering

Dedications are typically short enough that `padding: 2in` centers them on the page without needing `transform`:

```css
@media print {
  .dedication {
    justify-content: center !important;
    align-items: center !important;
    padding: 2in !important;
  }
}
```

## Why Not `flex` or `grid`?

Flex centering (`justify-content: center; align-items: center`) works in screen mode but breaks in print when the `@page` margin isn't applied correctly. The flex container's available space is relative to the margined area, not the full page.

Similarly, `position: absolute; top: 50%; transform: translateY(-50%)` doesn't work because Chrome's print renderer positions absolutely-placed elements relative to the margin box, not the page box.

## Why `transform` Works

`transform: translate()` is applied after layout — it moves the rendered content visually without affecting the flow or page-break calculations. Chrome's page-breaking algorithm uses the pre-transform position, so adding a transform doesn't cause content to reflow or shift to a different page.

This is a deliberate tradeoff: you're visually adjusting the position without changing the structural layout. For print, this is exactly what you want — the content stays on the same page, just positioned correctly.
