import type { OptimisticDailyOutlook } from '@/types/weather'
import { buildOptimisticDailyStory } from './optimisticCopy'

interface OptimisticDailyHeadlineProps {
  outlook: OptimisticDailyOutlook
  units: 'metric' | 'imperial'
}

export const OptimisticDailyHeadline = ({ outlook, units }: OptimisticDailyHeadlineProps) => {
  const story = buildOptimisticDailyStory(outlook, units)

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-semibold leading-snug text-slate-800">
        {story.headline}
      </p>
      {story.detail ? (
        <p className="text-xs text-slate-500">{story.detail}</p>
      ) : null}
    </div>
  )
}

export default OptimisticDailyHeadline
