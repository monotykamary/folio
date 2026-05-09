// Code block fragmentation: split <pre> elements into line-level <div>s
// so Chrome can break code blocks across pages. Without this, Chrome's
// break-inside: avoid on <pre> pushes entire blocks to the next page.

export interface FragmentationResult {
  fragmentedCount: number
  totalLines: number
}

export interface FragmentationConfig {
  /** Minimum number of lines a <pre> must have to be fragmented.
   *  Shorter code blocks stay as <pre> and may push to next page. */
  minLinesToFragment: number

  /** CSS class for the container <div> replacing <pre> */
  containerClass: string

  /** CSS class for each line-level <div> */
  lineClass: string

  /** Data attribute name for line markers */
  lineDataAttr: string

  /** CSS class for filename label wrapper, if code blocks use them */
  filenameClass: string

  /** CSS class for the code-block wrapper that may contain filename + <pre> */
  codeBlockClass: string
}

export const DEFAULT_FRAGMENTATION_CONFIG: FragmentationConfig = {
  minLinesToFragment: 8,
  containerClass: 'folio-code',
  lineClass: 'folio-line',
  lineDataAttr: 'data-folio-line',
  filenameClass: 'code-filename',
  codeBlockClass: 'code-block',
}

// Split highlighted HTML into per-line HTML strings, preserving
// open spans across line boundaries so syntax highlighting continues.
export function splitHighlightedHTML(html: string): string[] {
  const result: string[] = []
  let currentLine = ''
  const openTagStack: { name: string; fullTag: string }[] = []
  let i = 0

  while (i < html.length) {
    if (html[i] === '<') {
      const tagEnd = html.indexOf('>', i)
      if (tagEnd === -1) { currentLine += html.slice(i); break }
      const tag = html.substring(i, tagEnd + 1)
      currentLine += tag

      if (tag.startsWith('</')) {
        const tagName = tag.match(/<\/(\w+)/)
        if (tagName && openTagStack.length > 0) openTagStack.pop()
      } else if (!tag.endsWith('/>')) {
        const tagMatch = tag.match(/^<(\w+[^>]*)/)
        if (tagMatch) openTagStack.push({ name: tagMatch[1], fullTag: tag })
      }
      i = tagEnd + 1
    } else if (html[i] === '\n') {
      const closeTags = openTagStack.slice().reverse().map(t => `</${t.name}>`).join('')
      const reopenTags = openTagStack.map(t => t.fullTag).join('')
      result.push(currentLine + closeTags)
      currentLine = reopenTags
      i++
    } else {
      currentLine += html[i]
      i++
    }
  }

  if (currentLine) result.push(currentLine)
  return result.length > 0 ? result : ['']
}

// Fragment all <pre> code blocks in the document that meet the line threshold.
export function fragmentCodeBlocks(
  config: FragmentationConfig = DEFAULT_FRAGMENTATION_CONFIG
): FragmentationResult {
  let fragmentedCount = 0
  let totalLines = 0

  document.querySelectorAll('pre').forEach(pre => {
    const code = pre.querySelector('code') || pre
    const text = code.textContent || ''
    const lines = text.replace(/\r\n/g, '\n').split('\n')
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()

    if (lines.length < config.minLinesToFragment) return

    const container = document.createElement('div')
    container.className = [config.containerClass, pre.className, code.className]
      .filter(Boolean).join(' ').trim()

    // Preserve the filename label if wrapped in a code-block container
    const codeBlock = pre.closest(`.${config.codeBlockClass}`)
    if (codeBlock) {
      const filename = codeBlock.querySelector(`.${config.filenameClass}`)
      if (filename && codeBlock.querySelector('pre') === pre) {
        container.appendChild(filename.cloneNode(true))
      }
    }

    const htmlLines = splitHighlightedHTML(code.innerHTML)

    htmlLines.forEach((lineHtml, idx) => {
      const lineDiv = document.createElement('div')
      lineDiv.className = config.lineClass
      lineDiv.setAttribute(config.lineDataAttr, 'true')
      if (idx === 0) lineDiv.setAttribute('data-first', 'true')
      if (idx === htmlLines.length - 1) lineDiv.setAttribute('data-last', 'true')

      if (lineHtml.replace(/<[^>]+>/g, '').trim().length === 0) {
        lineDiv.setAttribute('data-empty', 'true')
      } else {
        const codeSpan = document.createElement('code')
        codeSpan.className = [code.className, 'hljs'].filter(Boolean).join(' ')
        codeSpan.innerHTML = lineHtml
        lineDiv.appendChild(codeSpan)
      }
      container.appendChild(lineDiv)
    })

    // Replace the <pre> (or its code-block parent) with the fragment container
    if (codeBlock && codeBlock.querySelector('pre') === pre) {
      codeBlock.replaceWith(container)
    } else {
      pre.replaceWith(container)
    }
    fragmentedCount++
    totalLines += htmlLines.length
  })

  return { fragmentedCount, totalLines }
}
