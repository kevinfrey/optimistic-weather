import { memo } from 'react'
import { motion } from 'framer-motion'
import type { OptimisticHourlyOutlook } from '@/types/weather'

interface HourlyCarouselProps {
  hours: OptimisticHourlyOutlook[]
  units: 'metric' | 'imperial'
}

const MAX_HOURS = 12

const formatHourLabel = (date: Date) =>
  date.toLocaleTimeString([], {
    hour: 'numeric',
  })

const HourlyCarousel = ({ hours, units }: HourlyCarouselProps) => {
  if (!hours.length) {
    return null
  }

  const visibleHours = hours.slice(0, MAX_HOURS)
  const temperatures = visibleHours.map((hour) => hour.temperature)
  const minTemp = Math.min(...temperatures)
  const maxTemp = Math.max(...temperatures)
  const tempRange = Math.max(maxTemp - minTemp, 1)

  return (
    <section aria-label="Next hours outlook" className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">Next few hours</h3>
      <div className="grid grid-cols-12 gap-2 sm:gap-3">
        {visibleHours.map((hour) => {
          const hourLabel = formatHourLabel(hour.time)
          const normalizedTemp = (hour.temperature - minTemp) / tempRange
          const temperatureFill = 25 + normalizedTemp * 70

          return (
            <motion.div
              key={hour.id}
              layout
              className="flex flex-col items-center gap-1 text-slate-500"
              aria-label={`${hourLabel}: ${Math.round(hour.temperature)} degrees`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">{hourLabel}</span>
              <div className="relative flex h-24 w-full items-end justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-slate-100 to-slate-200">
                <motion.div
                  layout
                  style={{ height: `${temperatureFill}%` }}
                  className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-gradient-to-b from-orange-300 via-orange-400 to-orange-500 shadow-[0_10px_20px_-14px_rgba(249,115,22,0.55)]"
                />
                <span className="relative z-10 pb-2 text-xs font-semibold text-white drop-shadow-sm">
                  {Math.round(hour.temperature)}°
                </span>
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}

export default memo(HourlyCarousel)
