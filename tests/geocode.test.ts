import { describe, expect, it } from 'vitest'
import type { GeoLocation } from '@/types/weather'
import { __internal } from '@/services/openWeather'

const sampleOptions: GeoLocation[] = [
  { name: 'Cincinnati', lat: 39.1031, lon: -84.512, state: 'OH', country: 'US' },
  { name: 'Centerville', lat: 39.628, lon: -84.159, state: 'OH', country: 'US' },
]

describe('geocoding helpers', () => {
  it('selects the closest matching location label for misspelled queries', () => {
    const match = __internal.pickBestMatch('Cincinatti, OH, US', sampleOptions)
    expect(match?.name).toBe('Cincinnati')
  })

  it('treats perfect matches as zero distance', () => {
    expect(__internal.levenshteinDistance('Lisbon', 'Lisbon')).toBe(0)
  })

  it('zip regex captures postal code and country when provided', () => {
    const result = __internal.ZIP_QUERY_REGEX.exec('94103, us')
    expect(result?.[1]).toBe('94103')
    expect(result?.[2]).toBe('us')
  })
})
