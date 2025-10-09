import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import TenDayOutlook from '@/components/forecast/TenDayOutlook'
import type { OptimisticDailyOutlook } from '@/types/weather'

const makeOutlook = (overrides: Partial<OptimisticDailyOutlook> = {}): OptimisticDailyOutlook => ({
  date: new Date('2025-05-10T12:00:00Z'),
  high: 70,
  low: 52,
  dayAverage: 61,
  precipitationChancePercent: 30,
  condition: 'Clouds',
  description: 'few clouds',
  source: 'onecall',
  ...overrides,
})

describe('TenDayOutlook', () => {
  it('renders optimistic daily cards', () => {
    const days = [
      makeOutlook(),
      makeOutlook({ date: new Date('2025-05-11T12:00:00Z') }),
    ]

    const html = renderToStaticMarkup(
      <TenDayOutlook days={days} units="imperial" isComplete message={undefined} />,
    )

    expect(html).toContain('10-day Bright Side outlook')
    expect(html).toContain('Today')
    expect(html).toContain('Clouds')
    expect(html).toContain('70°F')
    expect(html).toContain('stay splash-free')
  })

  it('shows fallback message when loading', () => {
    const html = renderToStaticMarkup(
      <TenDayOutlook days={[]} units="metric" isComplete={false} message="Limited data" isLoading />,
    )

    expect(html).toContain('Gathering long-range optimism')
  })

  it('surfaces retry action when no data available', () => {
    const html = renderToStaticMarkup(
      <TenDayOutlook
        days={[]}
        units="metric"
        isComplete={false}
        message="Limited data"
        onRetry={() => undefined}
      />,
    )

    expect(html).toContain('Limited data')
    expect(html).toContain('Try again')
  })
})
