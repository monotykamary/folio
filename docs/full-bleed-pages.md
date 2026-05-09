# Full-Bleed Pages

Full-bleed pages have zero margins — content extends to the page edges. Common examples: covers, title pages, part dividers, full-page illustrations.

## Setup

### 1. Register the page type in your config

```js
const config = {
  pageSpecs: {
    cover: pageSpecFromInches({ widthIn: 7, heightIn: 10 }),
    // No margins → full bleed
  },
  // ...
}
```

### 2. Register the element type

```js
elementTypes: [
  {
    selector: '.cover',
    pageName: 'cover',
    breakInside: 'avoid',
    isFullPage: true,
    measureAs: 'fixed',
    fixedHeight: 960,  // 10in × 96dpi
  },
],
```

The `isFullPage: true` flag tells Folio to place this element on its own page and flush immediately after.

### 3. Add the `@page` rule

```css
@media print {
  @page cover {
    margin: 0;
  }
}
```

### 4. Ensure the element fills the page

Your CSS should make the element fill the entire page area:

```css
.cover {
  width: 100%;
  height: 100vh;
  box-sizing: border-box;
}
```

Or in your print CSS:

```css
@media print {
  .cover {
    width: 100%;
    height: 10in;  /* match your page height */
  }
}
```

## Full-Page Illustrations

Full-page illustrations are images that fill the entire page. They require special handling because Chrome ignores `object-fit` in print mode.

### HTML Structure

```html
<div class="fullpage-illustration">
  <img src="illustration.jpg" alt="...">
</div>
```

### Config Registration

```js
elementTypes: [
  {
    selector: '.fullpage-illustration',
    pageName: 'fullpage-image',
    breakInside: 'avoid',
    isFullPage: true,
    measureAs: 'fixed',
    fixedHeight: 960,
  },
],
fullPageClasses: ['fullpage-illustration'],
```

### CSS

```css
@media print {
  @page fullpage-image {
    margin: 0;
  }

  .fullpage-illustration {
    width: 100%;
    height: 10in;
    overflow: hidden;  /* Chrome may overflow by ~36px */
  }
}
```

### The Overflow Problem

Chrome renders images at their natural aspect ratio scaled to fit the page width. A 2:3 image on a 7×10 page will be 504×756pt — 36pt taller than the 720pt page. The bottom is clipped by `overflow: hidden`, but Chrome may also create an orphan page with a small image strip.

See [chrome-quirks.md](chrome-quirks.md) for PyMuPDF workarounds for both the overflow and orphan page issues.

## Part Dividers

Part dividers are full-bleed pages with centered text (e.g., "PART II — Patterns"). They're similar to covers but need vertical centering.

```css
@media print {
  @page part {
    margin: 0;
  }

  .part-divider {
    page-break-before: always;
    break-before: page;
    page-break-after: always;
    break-after: page;
  }
}
```

For centering, see [centering-pages.md](centering-pages.md).

## Multiple Full-Bleed Pages in Sequence

Chrome handles sequences of full-bleed pages correctly — each gets its own `@page` rule applied:

```
Cover (margin: 0) → Title Page (margin: 0) → Part Divider (margin: 0)
```

Each page break is implicit from the `isFullPage` flag in the element type registration.
