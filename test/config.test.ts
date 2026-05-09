import { describe, it, expect } from 'vitest'
import { inches, pageSpecFromInches } from '../src/config'
import type { PageSpecConfig } from '../src/config'

describe('inches()', () => {
  it('converts 1 inch to 96px', () => {
    expect(inches(1)).toBe(96)
  })

  it('converts 7 inches to 672px', () => {
    expect(inches(7)).toBe(672)
  })

  it('converts 0 inches to 0px', () => {
    expect(inches(0)).toBe(0)
  })

  it('converts fractional inches', () => {
    expect(inches(0.5)).toBe(48)
    expect(inches(0.875)).toBe(84)
    expect(inches(1.25)).toBe(120)
  })
})

describe('pageSpecFromInches()', () => {
  it('creates a spec from inch values', () => {
    const spec = pageSpecFromInches({
      widthIn: 7, heightIn: 10,
      marginTopIn: 0.75, marginBottomIn: 1,
      marginLeftIn: 0.875, marginRightIn: 0.875,
      hasHeader: true, hasFooter: true,
    })

    expect(spec.width).toBe(672)
    expect(spec.height).toBe(960)
    expect(spec.marginTop).toBe(72)
    expect(spec.marginBottom).toBe(96)
    expect(spec.marginLeft).toBe(84)
    expect(spec.marginRight).toBe(84)
    expect(spec.hasHeader).toBe(true)
    expect(spec.hasFooter).toBe(true)
  })

  it('defaults margins to 0', () => {
    const spec = pageSpecFromInches({ widthIn: 7, heightIn: 10 })
    expect(spec.marginTop).toBe(0)
    expect(spec.marginBottom).toBe(0)
    expect(spec.marginLeft).toBe(0)
    expect(spec.marginRight).toBe(0)
  })

  it('defaults hasHeader/hasFooter to false', () => {
    const spec = pageSpecFromInches({ widthIn: 7, heightIn: 10 })
    expect(spec.hasHeader).toBe(false)
    expect(spec.hasFooter).toBe(false)
  })

  it('creates a cover-like spec with zero margins', () => {
    const spec = pageSpecFromInches({ widthIn: 7, heightIn: 10 })
    expect(spec.width).toBe(672)
    expect(spec.height).toBe(960)
    expect(spec.marginTop).toBe(0)
  })
})
