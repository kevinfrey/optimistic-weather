import { describe, expect, it } from 'vitest'
import { buildRainViewerUrl } from '@/components/radar/rainViewer'

describe('RadarView internal helpers', () => {
  it('generates RainViewer embed URLs with coordinates and key', () => {
    const url = buildRainViewerUrl({ lat: 47.6062, lon: -122.3321 }, 3)
    expect(url).toContain('loc=47.61%2C-122.33%2C8')
    expect(url).toContain('key=3')
    expect(url).toContain('rainviewer')
  })
})
