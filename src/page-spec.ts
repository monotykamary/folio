import { type PageSpecConfig, inches } from './config'

// Re-exports from config are handled by index.ts

export interface PageSpec {
  name: string
  widthPx: number
  heightPx: number
  topMarginPx: number
  bottomMarginPx: number
  leftMarginPx: number
  rightMarginPx: number
  hasHeader: boolean
  hasFooter: boolean
}

export function specsFromConfig(
  pageSpecs: Record<string, PageSpecConfig>
): Record<string, PageSpec> {
  const result: Record<string, PageSpec> = {}
  for (const [name, cfg] of Object.entries(pageSpecs)) {
    result[name] = {
      name,
      widthPx: cfg.width,
      heightPx: cfg.height,
      topMarginPx: cfg.marginTop,
      bottomMarginPx: cfg.marginBottom,
      leftMarginPx: cfg.marginLeft,
      rightMarginPx: cfg.marginRight,
      hasHeader: cfg.hasHeader,
      hasFooter: cfg.hasFooter,
    }
  }
  return result
}

export function getSpec(
  specs: Record<string, PageSpec>,
  name: string
): PageSpec {
  return specs[name] || specs['default']!
}

export function contentWidth(spec: PageSpec): number {
  return spec.widthPx - spec.leftMarginPx - spec.rightMarginPx
}

export function contentHeight(spec: PageSpec): number {
  return spec.heightPx - spec.topMarginPx - spec.bottomMarginPx
}
