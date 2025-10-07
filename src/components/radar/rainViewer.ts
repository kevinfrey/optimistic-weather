import type { Coordinates } from '@/types/weather'

export const buildRainViewerUrl = ({ lat, lon }: Coordinates, refreshKey: number) => {
  const zoom = 8
  const params = new URLSearchParams({
    loc: `${lat.toFixed(2)},${lon.toFixed(2)},${zoom}`,
    oFa: '1',
    oC: '1',
    opacity: '0.85',
    layer: 'radar',
    animation: '1',
    key: String(refreshKey),
  })
  return `https://www.rainviewer.com/map.html?${params.toString()}`
}

export const __internal = {
  buildRainViewerUrl,
}
