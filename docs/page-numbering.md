# Page Numbering

Folio supports roman numeral page labels for frontmatter and arabic numerals for the body — the standard convention for printed books.

## How It Works

The `breakPages()` algorithm assigns a `pageLabel` to each page in the `PaginationResult`:

- Pages whose `pageName` is in `config.romanPageTypes` get lowercase roman numerals: i, ii, iii, iv, ...
- All other pages with `hasFooter: true` get arabic numerals: 1, 2, 3, ...

## Config

```js
const config = {
  romanPageTypes: ['frontmatter'],

  pageSpecs: {
    frontmatter: pageSpecFromInches({
      widthIn: 7, heightIn: 10,
      marginTopIn: 0.75, marginBottomIn: 1,
      marginLeftIn: 0.875, marginRightIn: 0.875,
      hasHeader: false,
      hasFooter: true,  // shows roman numeral
    }),
    chapter: pageSpecFromInches({
      widthIn: 7, heightIn: 10,
      marginTopIn: 0.75, marginBottomIn: 1,
      marginLeftIn: 0.875, marginRightIn: 0.875,
      hasHeader: true,
      hasFooter: true,  // shows arabic numeral
    }),
  },

  // ...
}
```

## Rendering Page Numbers

Folio does **not** render page numbers — Chrome does. Use `displayHeaderFooter: true` in your `page.pdf()` call:

```js
await page.pdf({
  displayHeaderFooter: true,
  margin: { top: '0', bottom: '0', left: '0', right: '0' },
  headerTemplate: '<div></div>',
  footerTemplate: `
    <div style="font-size:9px; font-family:sans-serif; color:#666;
                width:100%; text-align:center; padding-top:4px;">
      <span class="pageNumber"></span>
    </div>`,
})
```

### Why Not CSS `@bottom-center`?

You can also use CSS margin boxes for page numbers:

```css
@page chapter {
  @bottom-center {
    content: counter(page);
  }
}
```

But this conflicts with Chrome's `displayHeaderFooter` — you'll get duplicate page numbers. The recommended approach is to suppress CSS margin boxes and use Chrome's `footerTemplate` exclusively:

```css
@media print {
  @page {
    @top-center { content: none; }
    @bottom-center { content: none; }
  }
}
```

## Suppressing Page Numbers on Specific Pages

Full-bleed pages (cover, part dividers, fullpage illustrations) typically don't show page numbers. Set `hasFooter: false` in their page spec:

```js
pageSpecs: {
  cover: { ..., hasFooter: false },
  part: { ..., hasFooter: false },
  'fullpage-image': { ..., hasFooter: false },
  frontmatter: { ..., hasFooter: true },
  chapter: { ..., hasFooter: true },
}
```

## Running Headers

Pages with `hasHeader: true` get a `headerText` property in the `PaginationResult`. The header text is the `chapterTitle` of the most recent heading-level block. To render it:

```js
footerTemplate: `
  <div style="width:100%; font-size:9px; font-family:sans-serif; color:#666;">
    <div style="float:left; padding-left:0.875in;">
      <span class="title"></span>  <!-- Chrome fills this with h1 text -->
    </div>
    <div style="float:right; padding-right:0.875in;">
      <span class="pageNumber"></span>
    </div>
  </div>`,
```

Chrome's `headerTemplate` and `footerTemplate` support a few special classes:
- `pageNumber` — current page number
- `totalPages` — total page count
- `title` — document title
- `url` — document URL
- `date` — current date

For chapter-specific running headers, you'll need to inject them via CSS (`string-set` / `content: string()`) or accept Chrome's default `title` behavior.
