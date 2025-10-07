import { useMemo, useState } from 'react'
import type { Coordinates } from '@/types/weather'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { buildRainViewerUrl } from './rainViewer'

interface RadarViewProps {
  coordinates: Coordinates
  locationLabel: string
  isLoading?: boolean
}

export const RadarView = ({ coordinates, locationLabel, isLoading }: RadarViewProps) => {
  const [refreshKey, setRefreshKey] = useState(0)

  const viewerUrl = useMemo(
    () => buildRainViewerUrl(coordinates, refreshKey),
    [coordinates, refreshKey],
  )

  return (
    <Card className="border-slate-200/70 bg-white/80">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg font-semibold text-slate-900">Live radar snapshot</CardTitle>
          <p className="text-xs text-slate-500">Centered on {locationLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={isLoading}
          >
            Refresh frames
          </Button>
          <a
            href="https://www.rainviewer.com/"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Data by RainViewer
          </a>
        </div>
      </CardHeader>
      <CardContent className="overflow-hidden rounded-xl border border-slate-200 shadow-inner">
        <iframe
          key={viewerUrl}
          title={`Radar for ${locationLabel}`}
          src={viewerUrl}
          className="h-[400px] w-full rounded-xl"
          allowFullScreen
        />
      </CardContent>
    </Card>
  )
}

export default RadarView
