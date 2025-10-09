import type { OptimisticDailyOutlook } from '@/types/weather'
import { cn } from '@/lib/utils'
import OptimisticDailyHeadline from './OptimisticDailyHeadline'

interface TenDayOutlookProps {
  days: OptimisticDailyOutlook[]
  units: 'metric' | 'imperial'
  isComplete: boolean
  message?: string
  isLoading?: boolean
  onRetry?: () => void
}

const formatDayLabel = (date: Date) => {
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' })
  const day = date.getDate()
  return `${weekday} ${day}`
}

const isWeekend = (date: Date) => {
  const day = date.getDay()
  return day === 0 || day === 6
}

const formatTemperature = (value: number, units: 'metric' | 'imperial') => {
  const suffix = units === 'metric' ? '°C' : '°F'
  return `${Math.round(value)}${suffix}`
}

interface DailyCardProps {
  outlook: OptimisticDailyOutlook
  units: 'metric' | 'imperial'
  isToday: boolean
}

const DailyCard = ({ outlook, units, isToday }: DailyCardProps) => {
  const weekend = isWeekend(outlook.date)

  return (
    <div
      className={cn(
        'group flex min-w-0 flex-col gap-3 rounded-3xl border border-white/70 bg-white/80 p-4 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.4)] backdrop-blur-lg transition hover:-translate-y-1 hover:shadow-xl',
        weekend && 'border-amber-200/80 bg-amber-50/70',
        isToday && 'border-sky-300/80 bg-sky-50/80',
      )}
    >
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <span className="text-slate-700">
          {isToday ? 'Today' : formatDayLabel(outlook.date)}
        </span>
        <span className="rounded-full bg-slate-900/90 px-2 py-0.5 text-[10px] font-bold text-white shadow">
          {outlook.condition}
        </span>
      </div>
      <div className="flex h-full flex-col justify-between">
        <OptimisticDailyHeadline outlook={outlook} units={units} />
        <div className="flex items-baseline gap-2 text-slate-700">
          <span className="text-xl font-semibold text-slate-900">
            {formatTemperature(outlook.high, units)}
          </span>
          <span className="text-sm font-medium text-slate-500">
            {formatTemperature(outlook.low, units)} low
          </span>
        </div>
      </div>
    </div>
  )
}

export const TenDayOutlook = ({
  days,
  units,
  isComplete,
  message,
  isLoading,
  onRetry,
}: TenDayOutlookProps) => {
  if (isLoading) {
    return (
      <section className="rounded-3xl border border-white/70 bg-white/75 p-5 text-sm text-slate-600 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.35)] backdrop-blur-lg">
        Gathering long-range optimism…
      </section>
    )
  }

  if (!days.length) {
    return (
      <section className="rounded-3xl border border-white/70 bg-white/75 p-5 text-sm text-slate-600 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.35)] backdrop-blur-lg">
        <p>{message ?? 'We could not collect the extended outlook for this location right now.'}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex items-center rounded-full border border-slate-300/80 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
          >
            Try again
          </button>
        ) : null}
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-slate-900">10-day Bright Side outlook</h3>
        {!isComplete && message ? (
          <span className="text-xs text-slate-500">{message}</span>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {days.map((day, index) => (
          <DailyCard key={day.date.getTime()} outlook={day} units={units} isToday={index === 0} />
        ))}
      </div>
    </section>
  )
}

export default TenDayOutlook
