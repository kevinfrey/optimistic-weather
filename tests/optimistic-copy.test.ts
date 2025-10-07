import { describe, expect, it } from 'vitest'
import { buildOptimisticDailyStory } from '@/components/forecast/optimisticCopy'
import type { OptimisticDailyOutlook } from '@/types/weather'

const baseOutlook: OptimisticDailyOutlook = {
  date: new Date('2025-05-10T12:00:00Z'),
  high: 74,
  low: 56,
  dayAverage: 65,
  precipitationChancePercent: 20,
  condition: 'Clouds',
  description: 'scattered clouds',
  source: 'onecall',
}

describe('buildOptimisticDailyStory', () => {
  it('celebrates high dry percentages', () => {
    const story = buildOptimisticDailyStory(baseOutlook, 'metric')
    expect(story.headline).toContain('Sun streak ahead')
    expect(story.detail).toContain('80% dry hours')
  })

  it('handles heavy precipitation with an optimistic twist', () => {
    const rainy = { ...baseOutlook, precipitationChancePercent: 90 }
    const story = buildOptimisticDailyStory(rainy, 'metric')
    expect(story.headline).toContain('Cozy rain stretch')
    expect(story.detail).toContain('Few dry windows')
  })

  it('adds weekend flavour', () => {
    const saturday = {
      ...baseOutlook,
      date: new Date('2025-05-17T12:00:00Z'), // Saturday
    }
    const story = buildOptimisticDailyStory(saturday, 'imperial')
    expect(story.headline).toContain('Saturday vibes')
    expect(story.temperatureSummary).toContain('74°F')
  })

  it('supports missing precipitation data', () => {
    const mystery = { ...baseOutlook, precipitationChancePercent: null }
    const story = buildOptimisticDailyStory(mystery, 'metric')
    expect(story.headline).toContain('Weather wildcard')
    expect(story.detail).toContain('Surprises likely')
  })
})
