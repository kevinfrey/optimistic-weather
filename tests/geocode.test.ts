import { describe, expect, it } from 'vitest'
import type { GeoLocation } from '@/types/weather'
import { __internal } from '@/services/openWeather'

const sampleOptions: GeoLocation[] = [
  { name: 'Cincinnati', lat: 39.1031, lon: -84.512, state: 'OH', country: 'US' },
  { name: 'Centerville', lat: 39.628, lon: -84.159, state: 'OH', country: 'US' },
]

const sydneyOptions: GeoLocation[] = [
  { name: 'Sydney', lat: -33.8688, lon: 151.2093, state: 'New South Wales', country: 'AU' },
  { name: 'Sydney', lat: 46.1368, lon: -60.1942, state: 'Nova Scotia', country: 'CA' },
]

const seattleOptions: GeoLocation[] = [
  { name: 'Seattle', lat: 47.6062, lon: -122.3321, state: 'Washington', country: 'US' },
  { name: 'Seattle', lat: 21.1743, lon: -104.833, state: 'Jalisco', country: 'MX' },
]

const seattleStateMissing: GeoLocation[] = [
  { name: 'Seattle', lat: 47.6062, lon: -122.3321, country: 'US' },
  { name: 'Seattle', lat: 21.1743, lon: -104.833, state: 'Jalisco', country: 'MX' },
]

describe('geocoding helpers', () => {
  it('selects the closest matching location label for misspelled queries', () => {
    const match = __internal.pickBestMatch('Cincinatti, OH, US', sampleOptions)
    expect(match?.name).toBe('Cincinnati')
  })

  it('prioritises country matches when the query names a country', () => {
    const match = __internal.pickBestMatch('Sydney, Australia', sydneyOptions)
    expect(match?.country).toBe('AU')
  })

  it('accounts for US state hints when differentiating same-name cities', () => {
    const match = __internal.pickBestMatch('Seattle, WA', seattleOptions)
    expect(match?.state).toBe('Washington')
    expect(match?.country).toBe('US')
  })

  it('still prefers the US city when state metadata is missing', () => {
    const match = __internal.pickBestMatch('Seatle, WA', seattleStateMissing)
    expect(match?.country).toBe('US')
  })

  it('treats perfect matches as zero distance', () => {
    expect(__internal.levenshteinDistance('Lisbon', 'Lisbon')).toBe(0)
  })

  it('zip regex captures postal code and country when provided', () => {
    const result = __internal.ZIP_QUERY_REGEX.exec('94103, us')
    expect(result?.[1]).toBe('94103')
    expect(result?.[2]).toBe('us')
  })

  it('zip regex ignores plain city queries to avoid false positives', () => {
    const result = __internal.ZIP_QUERY_REGEX.exec('Lisbon, PT')
    expect(result).toBeNull()
  })

  it('deduplicates repeating geo results while keeping unique entries', () => {
    const items: GeoLocation[] = [
      { name: 'Paris', lat: 48.8566, lon: 2.3522, country: 'FR' },
      { name: 'Paris', lat: 48.8566, lon: 2.3522, country: 'FR' },
      { name: 'Paris', lat: 33.6609, lon: -95.5555, state: 'Texas', country: 'US' },
    ]

    const deduped = __internal.dedupeLocations(items)

    expect(deduped).toHaveLength(2)
    expect(deduped.some((location) => location.country === 'FR')).toBe(true)
    expect(deduped.some((location) => location.country === 'US')).toBe(true)
  })
})
