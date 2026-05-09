import { describe, it, expect, beforeEach } from 'vitest'
import { JSDOM } from 'jsdom'
import { splitHighlightedHTML, fragmentCodeBlocks, DEFAULT_FRAGMENTATION_CONFIG } from '../src/code-fragmenter'

describe('splitHighlightedHTML()', () => {
  it('splits simple text by newlines', () => {
    const result = splitHighlightedHTML('hello\nworld')
    expect(result).toEqual(['hello', 'world'])
  })

  it('handles a single line with no newlines', () => {
    const result = splitHighlightedHTML('hello')
    expect(result).toEqual(['hello'])
  })

  it('preserves span tags across line boundaries', () => {
    const html = '<span class="hljs-keyword">const</span> x\n<span class="hljs-keyword">let</span> y'
    const result = splitHighlightedHTML(html)
    expect(result).toHaveLength(2)
    // First line: opens span, closes at newline
    expect(result[0]).toContain('<span class="hljs-keyword">const</span>')
    expect(result[0]).toContain('x')
    expect(result[0]).toContain('</span>')
    // Second line: reopens span
    expect(result[1]).toContain('<span class="hljs-keyword">let</span>')
    expect(result[1]).toContain('y')
  })

  it('preserves multi-level nesting across lines', () => {
    const html = '<span class="a"><span class="b">hello\nworld</span></span>'
    const result = splitHighlightedHTML(html)
    expect(result).toHaveLength(2)
    // Both lines should contain the span content
    expect(result[0]).toContain('hello')
    expect(result[1]).toContain('world')
    // Both lines should reopen the nested spans
    expect(result[0]).toContain('<span class="a">')
    expect(result[0]).toContain('<span class="b">')
    expect(result[1]).toContain('<span class="a">')
    expect(result[1]).toContain('<span class="b">')
  })

  it('handles self-closing tags', () => {
    const html = 'line1<br/>line2'
    const result = splitHighlightedHTML(html)
    expect(result).toEqual(['line1<br/>line2'])
  })

  it('handles empty input', () => {
    const result = splitHighlightedHTML('')
    expect(result).toEqual([''])
  })

  it('handles trailing newline', () => {
    const result = splitHighlightedHTML('hello\n')
    // Trailing newline produces a single line (empty current line is skipped)
    expect(result).toEqual(['hello'])
  })

  it('handles multiple consecutive newlines', () => {
    const result = splitHighlightedHTML('a\n\nb')
    expect(result).toHaveLength(3)
    expect(result[0]).toBe('a')
    expect(result[1]).toBe('')
    expect(result[2]).toBe('b')
  })

  it('preserves highlighting spanning the entire block', () => {
    const html = '<span class="hljs-string">"hello\nworld"</span>'
    const result = splitHighlightedHTML(html)
    expect(result).toHaveLength(2)
    // Line 1 opens the span, line 2 reopens it
    expect(result[0]).toContain('hljs-string')
    expect(result[1]).toContain('hljs-string')
  })

  it('handles closing tag at line boundary', () => {
    const html = '<span class="a">hello</span>\n<span class="b">world</span>'
    const result = splitHighlightedHTML(html)
    expect(result).toHaveLength(2)
    expect(result[0]).toContain('hello')
    expect(result[1]).toContain('world')
  })

  it('handles `>` inside attribute values (e.g. title="a > b")', () => {
    const html = '<span title="a > b">hello</span>'
    const result = splitHighlightedHTML(html)
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('title="a > b"')
    expect(result[0]).toContain('hello')
  })

  it('handles `<` inside double-quoted attribute values', () => {
    const html = '<span data-foo="a < b">text</span>'
    const result = splitHighlightedHTML(html)
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('data-foo="a < b"')
  })

  it('handles `<` inside single-quoted attribute values', () => {
    const html = "<span data-bar='x < y'>text</span>"
    const result = splitHighlightedHTML(html)
    expect(result).toHaveLength(1)
    expect(result[0]).toContain("data-bar='x < y'")
  })

  it('does not push void elements (e.g., <br>) onto the open-tag stack', () => {
    const html = 'line1<br>line2'
    const result = splitHighlightedHTML(html)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('line1<br>line2')
  })

  it('does not push self-closing void tags with slash (e.g., <br/>)', () => {
    const html = 'a<br/>b\nc<br/>d'
    const result = splitHighlightedHTML(html)
    expect(result).toHaveLength(2)
    expect(result[0]).toBe('a<br/>b')
    expect(result[1]).toBe('c<br/>d')
  })

  it('handles <img> as a void element', () => {
    const html = '<img src="x.png">caption'
    const result = splitHighlightedHTML(html)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('<img src="x.png">caption')
  })

  it('handles <hr> as a void element', () => {
    const html = 'before<hr>after'
    const result = splitHighlightedHTML(html)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('before<hr>after')
  })
})

describe('fragmentCodeBlocks()', () => {
  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
      runScripts: 'outside-only',
      pretendToBeVisual: true,
    })
    globalThis.window = dom.window as any
    globalThis.document = dom.window.document
    globalThis.HTMLElement = dom.window.HTMLElement as any
    globalThis.Element = dom.window.Element as any
  })

  it('fragments a <pre> with enough lines into .folio-code > .folio-line divs', () => {
    document.body.innerHTML = `<pre><code>line1
line2
line3
line4
line5
line6
line7
line8
line9
line10</code></pre>`
    const result = fragmentCodeBlocks({ ...DEFAULT_FRAGMENTATION_CONFIG, minLinesToFragment: 8 })
    expect(result.fragmentedCount).toBe(1)
    expect(result.totalLines).toBe(10)

    const container = document.querySelector('.folio-code')
    expect(container).not.toBeNull()
    expect(container!.children.length).toBe(10)
    expect(container!.children[0].className).toBe('folio-line')
    expect(container!.querySelector('[data-first]')).not.toBeNull()
    expect(container!.querySelector('[data-last]')).not.toBeNull()
  })

  it('skips short <pre> blocks below minLinesToFragment', () => {
    document.body.innerHTML = `<pre><code>a\nb\nc</code></pre>`
    const result = fragmentCodeBlocks({ ...DEFAULT_FRAGMENTATION_CONFIG, minLinesToFragment: 8 })
    expect(result.fragmentedCount).toBe(0)
    expect(result.totalLines).toBe(0)
    expect(document.querySelector('pre')).not.toBeNull()
  })

  it('preserves syntax highlighting spans across lines', () => {
    document.body.innerHTML = `<pre><code class="language-js"><span class="hljs-keyword">const</span> x = 1\n<span class="hljs-keyword">let</span> y = 2</code></pre>`
    const result = fragmentCodeBlocks({ ...DEFAULT_FRAGMENTATION_CONFIG, minLinesToFragment: 2 })
    expect(result.fragmentedCount).toBe(1)
    expect(result.totalLines).toBe(2)

    const lines = document.querySelectorAll('.folio-line')
    expect(lines[0].querySelector('code')?.innerHTML).toContain('hljs-keyword')
    expect(lines[1].querySelector('code')?.innerHTML).toContain('hljs-keyword')
  })

  it('preserves filename label from .code-block wrapper', () => {
    document.body.innerHTML = `
      <div class="code-block">
        <div class="code-filename">test.js</div>
        <pre><code>line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10</code></pre>
      </div>
    `
    const result = fragmentCodeBlocks({ ...DEFAULT_FRAGMENTATION_CONFIG, minLinesToFragment: 8 })
    expect(result.fragmentedCount).toBe(1)
    const container = document.querySelector('.folio-code')
    expect(container).not.toBeNull()
    expect(container!.querySelector('.code-filename')?.textContent).toBe('test.js')
  })

  it('marks empty lines with data-empty', () => {
    document.body.innerHTML = `<pre><code>line1\n\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10</code></pre>`
    const result = fragmentCodeBlocks({ ...DEFAULT_FRAGMENTATION_CONFIG, minLinesToFragment: 8 })
    expect(result.fragmentedCount).toBe(1)
    expect(result.totalLines).toBe(10)

    const emptyLine = document.querySelector('.folio-line[data-empty]')
    expect(emptyLine).not.toBeNull()
    expect(emptyLine!.textContent?.trim()).toBe('')
  })

  it('preserves trailing blank lines', () => {
    // "a\nb\nc\n" has 3 lines + trailing newline
    document.body.innerHTML = `<pre><code>line1\nline2\nline3\n</code></pre>`
    const result = fragmentCodeBlocks({ ...DEFAULT_FRAGMENTATION_CONFIG, minLinesToFragment: 3 })
    expect(result.fragmentedCount).toBe(1)
    // Should be 3 lines (trailing newline is just the terminator)
    expect(result.totalLines).toBe(3)

    // With intentional trailing blank: "a\nb\nc\n\n" → 4 lines (a, b, c, blank)
    document.body.innerHTML = `<pre><code>line1\nline2\nline3\n\n</code></pre>`
    const result2 = fragmentCodeBlocks({ ...DEFAULT_FRAGMENTATION_CONFIG, minLinesToFragment: 4 })
    expect(result2.fragmentedCount).toBe(1)
    expect(result2.totalLines).toBe(4)
  })
})

describe('DEFAULT_FRAGMENTATION_CONFIG', () => {
  it('has expected defaults', () => {
    expect(DEFAULT_FRAGMENTATION_CONFIG.minLinesToFragment).toBe(8)
    expect(DEFAULT_FRAGMENTATION_CONFIG.containerClass).toBe('folio-code')
    expect(DEFAULT_FRAGMENTATION_CONFIG.lineClass).toBe('folio-line')
    expect(DEFAULT_FRAGMENTATION_CONFIG.lineDataAttr).toBe('data-folio-line')
  })
})
