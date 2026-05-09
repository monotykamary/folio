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
    /* Force zero margins via transform instead of @page */
    transform: translate(1.15in, 2.17in) !important;
    justify-content: center !important;
    align-items: center !important;
    padding: 1in !important;
  }
}
```

The values are calculated as:
- `translateX(1.15in)` — compensates for the left margin that Chrome incorrectly applies (0.875in) plus adjusts for content offset
- `translateY(2.17in)` — shifts content from its natural position to the page center

#### How to Calculate the Values

1. Generate the PDF without any transform
2. Use PyMuPDF to find the current center of content on the title page:

```python
import fitz
doc = fitz.open('output.pdf')
page = doc[title_page_index]
blocks = page.get_text('dict')['blocks']

y_positions = []
x_centers = []
for b in blocks:
    if b['type'] == 0:
        for line in b['lines']:
            for span in line['spans']:
                y_positions.append(span['origin'][1])
                x_centers.append((span['bbox'][0] + span['bbox'][2]) / 2)

current_cy = (min(y_positions) + max(y_positions)) / 2
current_cx = sum(x_centers) / len(x_centers)

# Target center for 7×10in page
target_cy = 360  # 720pt / 2 = 360 (in points at 72dpi)
target_cx = 252  # 504pt / 2

print(f'Current center: ({current_cx:.0f}, {current_cy:.0f})pt')
print(f'Target center: ({target_cx}, {target_cy})pt')
print(f'Adjust translateX by: {(target_cx - current_cx)/54:.2f}in')  # ~54dpi intermediate
print(f'Adjust translateY by: {(target_cy - current_cy)/54:.2f}in')
```

**Note**: Chrome resolves CSS `in` units at an intermediate DPI (~54, not 72 or 96) during print layout. The exact value varies — measure empirically.

### Part Divider Centering

Part dividers are typically shorter content (a title and subtitle) centered vertically:

```css
@media print {
  .part-divider {
    padding: 0 !important;
    transform: translateY(4.05in) !important;
  }
}
```

The translateY value positions the top of the content so its visual center aligns with the page center.

### Dedication Centering

````css
@media print {
  .dedication {
    justify-content: center !important;
    align-items: center !important;
    padding: 2in !important;
  }
}
````

Dedications are typically short enough that `padding: 2in` centers them on the page without needing `transform`.

## Why Not `flex` or `grid`?

Flex centering (`justify-content: center; align-items: center`) works in screen mode but breaks in print when the `@page` margin isn't applied correctly. The flex container's available space is relative to the margined area, not the full page.

Similarly, `position: absolute; top: 50%; transform: translateY(-50%)` doesn't work because Chrome's print renderer positions absolutely-placed elements relative to the margin box, not the page box.

## Why `transform` Works

`transform: translate()` is applied after layout — it moves the rendered content visually without affecting the flow or page-break calculations. Chrome's page-breaking algorithm uses the pre-transform position, so adding a transform doesn't cause content to reflow or shift to a different page.

This is a deliberate tradeoff: you're visually adjusting the position without changing the structural layout. For print, this is exactly what you want — the content stays on the same page, just positioned correctly.
