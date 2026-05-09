import { type BookConfig } from './config'
import { type PaginationResult } from './page-breaker'

export interface InjectionResult {
  injectedPages: number
}

// Inject print-specific CSS from config into the document.
// These are the generic rules — the consumer adds their own book-specific
// rules (transforms, custom class overrides) separately.
export function injectPaginatedDOM(
  result: PaginationResult,
  config: BookConfig
): InjectionResult {
  document.getElementById('folio-injection-style')?.remove()

  // Build @page rules from config
  const pageRules = Object.entries(config.pageSpecs).map(([name, spec]) => {
    const margin = `${spec.marginTop}px ${spec.marginRight}px ${spec.marginBottom}px ${spec.marginLeft}px`
    return `@page ${name} { margin: ${margin}; }`
  }).join('\n')

  // Build break-inside: avoid rules from element types
  const avoidBreakSelectors = config.elementTypes
    .filter(m => m.breakInside === 'avoid')
    .map(m => m.selector)

  const style = document.createElement('style')
  style.id = 'folio-injection-style'
  style.textContent = `
    @media print {
      @page { margin: 0; }
      ${pageRules}

      ${avoidBreakSelectors.length > 0 ? `${avoidBreakSelectors.join(',\n      ')} {\n        break-inside: avoid;\n        page-break-inside: avoid;\n      }` : ''}

      h1, h2, h3, h4 {
        break-after: avoid;
        page-break-after: avoid;
      }

      pre {
        break-inside: auto;
        page-break-inside: auto;
      }

      .folio-line {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .folio-line[data-empty="true"] {
        height: 1em;
      }
    }
  `
  document.head.appendChild(style)

  return {
    injectedPages: result.pages.length,
  }
}

export async function waitForAssetsReady(): Promise<{
  imageCount: number
  loadedImages: number
}> {
  const images = Array.from(document.querySelectorAll('img'))
  await Promise.all(images.map(async img => {
    if (!img.complete) {
      await new Promise<void>(resolve => {
        img.addEventListener('load', () => resolve(), { once: true })
        img.addEventListener('error', () => resolve(), { once: true })
      })
    }
    if (typeof img.decode === 'function') {
      try { await img.decode() } catch { /* ignore */ }
    }
  }))

  if (document.fonts?.ready) {
    await document.fonts.ready
  }

  await new Promise(resolve => requestAnimationFrame(resolve))
  await new Promise(resolve => requestAnimationFrame(resolve))

  return {
    imageCount: images.length,
    loadedImages: images.filter(img => img.complete).length,
  }
}
