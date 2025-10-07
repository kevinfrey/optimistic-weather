import { describe, expect, it } from 'vitest'
import type { DailyForecastEntry } from '@/types/weather'
import { __internal } from '@/services/openWeather'

const createDailyEntry = (overrides: Partial<DailyForecastEntry> = {}): DailyForecastEntry => ({
  dt: 1_700_000_000,
  temp: {
    day: 22,
    max: 26,
    min: 16,
  },
  weather: [
    {
      id: 500,
      main: 'Rain',
      description: 'light rain',
      icon: '10d',
    },
  ],
  pop: 0.4,
  ...overrides,
})

describe('buildExtendedOutlook', () => {
  it('converts entries into capped 10-day outlook', () => {
    const entries = Array.from({ length: 12 }, (_, index) =>
      createDailyEntry({ dt: 1_700_000_000 + index * 86_400 }),
    )

    const result = __internal.buildExtendedOutlook(entries, 0)

    expect(result).toHaveLength(10)
    expect(result[0]?.precipitationChancePercent).toBe(40)
    expect(result[0]?.condition).toBe('Rain')
    expect(result[0]?.description).toBe('light rain')
    expect(result[0]?.source).toBe('onecall')
  })

  it('clamps precipitation probability and tolerates missing values', () => {
    const entries: DailyForecastEntry[] = [
      createDailyEntry({ pop: 1.7 }),
      createDailyEntry({ pop: undefined, dt: 1_700_086_400 }),
    ]

    const result = __internal.buildExtendedOutlook(entries, 0)

    expect(result[0]?.precipitationChancePercent).toBe(100)
    expect(result[1]?.precipitationChancePercent).toBeNull()
  })

  it('filters out entries missing temperature bounds', () => {
    const entries: DailyForecastEntry[] = [
      {
        dt: 1_700_000_000,
        temp: { day: 20, max: Number.NaN, min: 15 } as unknown as DailyForecastEntry['temp'],
        weather: [],
      },
      createDailyEntry({ dt: 1_700_086_400 }),
    ]

    const result = __internal.buildExtendedOutlook(entries, 0)

    expect(result).toHaveLength(1)
    expect(result[0]?.date.getTime()).toBe((1_700_086_400) * 1000)
  })

  it('applies timezone offsets to sunrise and sunset', () => {
    const offsetSeconds = 3_600
    const entry = createDailyEntry({ sunrise: 100, sunset: 200 })

    const [first] = __internal.buildExtendedOutlook([entry], offsetSeconds)

    expect(first?.sunrise?.getTime()).toBe((100 + offsetSeconds) * 1000)
    expect(first?.sunset?.getTime()).toBe((200 + offsetSeconds) * 1000)
  })
})
