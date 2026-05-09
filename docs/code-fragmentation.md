# Code Fragmentation

Chrome's `break-inside: avoid` on `<pre>` elements prevents code blocks from splitting across pages. When a long code block doesn't fit on the current page, Chrome pushes the entire block to the next page — leaving a gap that can be 3–6 inches.

## The Problem

```
Page 42:                        Page 43:
  ...text...                     
  ...text...                     <pre>long code block
                                  that used to be on
  [6 INCH GAP]                   page 42 but got pushed
                                  here entirely</pre>
```

## The Solution

Folio fragments each `<pre>` with ≥8 lines into individual line-level `<div>` elements. Each line has `break-inside: avoid` (won't split mid-line), but the container as a whole **can** break between lines.

### Before

```html
<pre><code class="language-sql">SELECT product_id, price
FROM products
WHERE category = 'electronics'
ORDER BY price DESC
LIMIT 100;</code></pre>
```

### After

```html
<div class="folio-code">
  <div class="folio-line" data-folio-line="true" data-first="true">
    <code class="language-sql hljs">
      <span class="hljs-keyword">SELECT</span> product_id, price
    </code>
  </div>
  <div class="folio-line" data-folio-line="true">
    <code class="language-sql hljs">
      <span class="hljs-keyword">FROM</span> products
    </code>
  </div>
  <!-- ... more lines ... -->
  <div class="folio-line" data-folio-line="true" data-last="true">
    <code class="language-sql hljs">LIMIT <span class="hljs-number">100</span>;</code>
  </div>
</div>
```

## Syntax Highlighting Preservation

The `splitHighlightedHTML()` function walks the highlighted HTML character by character. When it encounters a `\n`, it:

1. Closes all open `<span>` tags (e.g. `</span>` for `hljs-keyword`)
2. Adds the line to the result
3. Re-opens the same tags on the next line

This means syntax highlighting from highlight.js, Prism, or any other highlighter is preserved across line breaks within the same code block.

### Example: Multi-line Highlight Span

Input HTML:
```html
<span class="hljs-comment">-- This is a long
comment that spans
multiple lines</span>
```

Becomes:
```html
<!-- line 1 -->
<span class="hljs-comment">-- This is a long</span>
<!-- line 2 -->
<span class="hljs-comment">comment that spans</span>
<!-- line 3 -->
<span class="hljs-comment">multiple lines</span>
```

## Configuration

```js
const result = fragmentCodeBlocks({
  minLinesToFragment: 8,      // only fragment blocks with ≥8 lines
  containerClass: 'folio-code', // class for the container <div>
  lineClass: 'folio-line',     // class for each line <div>
  lineDataAttr: 'data-folio-line',
  filenameClass: 'code-filename',
  codeBlockClass: 'code-block',
})
// result = { fragmentedCount: 42, totalLines: 876 }
```

### Code Blocks with Filenames

If your code blocks are wrapped with a filename label:

```html
<div class="code-block">
  <div class="code-filename">product_catalog.sql</div>
  <pre><code>...</code></pre>
</div>
```

Folio detects the `.code-block` wrapper and moves the `.code-filename` into the fragment container, then replaces the entire `.code-block` with the fragment.

## Effect on Page Count

In production use, fragmenting 132 code blocks reduced the page count from 295 → 282 (13 fewer pages from eliminating gaps). The worst case was a code block that left a 5.8-inch gap on its page because it was 25 lines long and got pushed entirely to the next page.

## Short Code Blocks

Code blocks with <8 lines stay as `<pre>` elements. They're short enough that if they don't fit, the gap is small. You can adjust the threshold:

```js
fragmentCodeBlocks({ minLinesToFragment: 4 })  // fragment more aggressively
```
