import { describe, it, expect } from 'vitest'
import { specsFromConfig, getSpec, contentWidth, contentHeight } from '../src/page-spec'
import type { PageSpecConfig } from '../src/config'

const DEFAULT_SPEC: PageSpecConfig = {
  width: 672, height: 960,
  marginTop: 72, marginBottom: 96,
  marginLeft: 84, marginRight: 84,
  hasHeader: true, hasFooter: true,
}

const COVER_SPEC: PageSpecConfig = {
  width: 672, height: 960,
  marginTop: 0, marginBottom: 0,
  marginLeft: 0, marginRight: 0,
  hasHeader: false, hasFooter: false,
}

const CHAPTER_SPEC: PageSpecConfig = {
  width: 672, height: 960,
  marginTop: 72, marginBottom: 96,
  marginLeft: 84, marginRight: 84,
  hasHeader: true, hasFooter: true,
}

describe('specsFromConfig()', () => {
  it('converts config records to PageSpec records', () => {
    const specs = specsFromConfig({ default: DEFAULT_SPEC, cover: COVER_SPEC })
    expect(specs.default.name).toBe('default')
    expect(specs.default.widthPx).toBe(672)
    expect(specs.default.heightPx).toBe(960)
    expect(specs.cover.name).toBe('cover')
  })

  it('preserves margin values', () => {
    const specs = specsFromConfig({ default: DEFAULT_SPEC })
    expect(specs.default.topMarginPx).toBe(72)
    expect(specs.default.bottomMarginPx).toBe(96)
    expect(specs.default.leftMarginPx).toBe(84)
    expect(specs.default.rightMarginPx).toBe(84)
  })

  it('preserves header/footer flags', () => {
    const specs = specsFromConfig({ default: DEFAULT_SPEC, cover: COVER_SPEC })
    expect(specs.default.hasHeader).toBe(true)
    expect(specs.default.hasFooter).toBe(true)
    expect(specs.cover.hasHeader).toBe(false)
    expect(specs.cover.hasFooter).toBe(false)
  })
})

describe('getSpec()', () => {
  it('returns the named spec', () => {
    const specs = specsFromConfig({ default: DEFAULT_SPEC, cover: COVER_SPEC })
    expect(getSpec(specs, 'cover').name).toBe('cover')
  })

  it('falls back to default for unknown names', () => {
    const specs = specsFromConfig({ default: DEFAULT_SPEC })
    expect(getSpec(specs, 'nonexistent').name).toBe('default')
  })
})

describe('contentWidth()', () => {
  it('subtracts left and right margins', () => {
    const specs = specsFromConfig({ default: DEFAULT_SPEC })
    // 672 - 84 - 84 = 504
    expect(contentWidth(specs.default)).toBe(504)
  })

  it('returns full width for zero-margin specs', () => {
    const specs = specsFromConfig({ cover: COVER_SPEC })
    expect(contentWidth(specs.cover)).toBe(672)
  })
})

describe('contentHeight()', () => {
  it('subtracts top and bottom margins', () => {
    const specs = specsFromConfig({ default: DEFAULT_SPEC })
    // 960 - 72 - 96 = 792
    expect(contentHeight(specs.default)).toBe(792)
  })

  it('returns full height for zero-margin specs', () => {
    const specs = specsFromConfig({ cover: COVER_SPEC })
    expect(contentHeight(specs.cover)).toBe(960)
  })
})
