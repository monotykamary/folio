// Configuration types for folio.
// All book-specific knowledge lives in the consumer's config — the library
// itself knows nothing about specific class names, fonts, or page dimensions.

export interface PageSpecConfig {
  /** Page dimensions in CSS px (at 96dpi) */
  width: number
  height: number
  /** Margins in CSS px */
  marginTop: number
  marginBottom: number
  marginLeft: number
  marginRight: number
  /** Whether this page type shows a running header */
  hasHeader: boolean
  /** Whether this page type shows a page number footer */
  hasFooter: boolean
}

export interface FontSpec {
  /** CSS font shorthand, e.g. '10px "Garamond", Georgia, serif' */
  font: string
  /** Font size in px */
  fontSize: number
  /** Line height in px */
  lineHeight: number
}

export interface ElementMapping {
  /** CSS selector for this element type */
  selector: string
  /** Which page type this element belongs to (null = inherit from parent) */
  pageName: string | null
  /** break-inside behavior */
  breakInside: 'auto' | 'avoid'
  /** Font spec for text measurement (null for non-text elements) */
  font?: FontSpec
  /** Content width override (px). Defaults to page content width - padding */
  contentWidth?: number
  /** Vertical padding/margin added to measured height (px) */
  heightPadding?: number
  /** Is this a full-bleed page element? */
  isFullPage?: boolean
  /** Measurement method override */
  measureAs?: 'text' | 'image' | 'list' | 'table' | 'heading' | 'fixed'
  /** Fixed height for 'fixed' measureAs (px) */
  fixedHeight?: number
}

export interface BookConfig {
  /** Page dimensions: CSS length string, e.g. '7in 10in' */
  pageWidth: string
  pageHeight: string

  /** Named page type specs keyed by name */
  pageSpecs: Record<string, PageSpecConfig>

  /** Element type registrations — tells the library how to detect, classify,
   *  and measure different HTML element types. */
  elementTypes: ElementMapping[]

  /** CSS class names that indicate full-bleed pages */
  fullPageClasses: string[]

  /** Container selectors — elements whose children are the leaf blocks */
  containerSelectors: string[]

  /** ROMAN-numeraled page types (frontmatter) */
  romanPageTypes: string[]

  /** Default font specs for fallback measurement */
  fonts: {
    body: FontSpec
    heading: FontSpec
    code: FontSpec
  }
}

/** Helper: inch → px at 96dpi */
export function inches(n: number): number {
  return n * 96
}

/** Helper: create a PageSpecConfig from inch values */
export function pageSpecFromInches(opts: {
  widthIn: number
  heightIn: number
  marginTopIn?: number
  marginBottomIn?: number
  marginLeftIn?: number
  marginRightIn?: number
  hasHeader?: boolean
  hasFooter?: boolean
}): PageSpecConfig {
  return {
    width: inches(opts.widthIn),
    height: inches(opts.heightIn),
    marginTop: inches(opts.marginTopIn ?? 0),
    marginBottom: inches(opts.marginBottomIn ?? 0),
    marginLeft: inches(opts.marginLeftIn ?? 0),
    marginRight: inches(opts.marginRightIn ?? 0),
    hasHeader: opts.hasHeader ?? false,
    hasFooter: opts.hasFooter ?? false,
  }
}
