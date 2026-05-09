import { describe, it, expect } from 'vitest'
import { splitHighlightedHTML, DEFAULT_FRAGMENTATION_CONFIG } from '../src/code-fragmenter'

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

  it('handles unclosed tags gracefully', () => {
    const html = '<span class="a">hello\nworld'
    const result = splitHighlightedHTML(html)
    expect(result).toHaveLength(2)
    // Both lines should reference the span
    expect(result[0]).toContain('<span class="a">')
    expect(result[1]).toContain('<span class="a">')
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
