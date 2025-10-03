import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { fetchOptimisticForecast, reverseGeocode } from '@/services/openWeather'
import type { Coordinates, OptimisticForecast, SearchHistoryEntry } from '@/types/weather'
import {
  clearHistoryEntries,
  loadHistoryEntries,
  persistHistoryEntries,
} from '@/lib/history-storage'
import { Loader2, Navigation } from 'lucide-react'

type Units = 'metric' | 'imperial'
const UNIT_STORAGE_KEY = 'optimistic-weather-units-v1'
const HISTORY_LIMIT = 8

const formatTemperature = (value: number, units: Units) => {
  const rounded = Math.round(value)
  const suffix = units === 'metric' ? '°C' : '°F'
  return `${rounded}${suffix}`
}

const formatTime = (date: Date) =>
  date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })

const formatRelativeTime = (timestamp: number) => {
  const diffMs = Date.now() - timestamp
  const diffMinutes = Math.round(diffMs / 60000)
  if (diffMinutes < 1) {
    return 'just now'
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }
  const diffDays = Math.round(diffHours / 24)
  return `${diffDays}d ago`
}

function App() {
  const [query, setQuery] = useState('')
  const [units, setUnits] = useState<Units>(() => {
    if (typeof window === 'undefined') {
      return 'imperial'
    }
    const stored = window.localStorage.getItem(UNIT_STORAGE_KEY)
    return stored === 'metric' || stored === 'imperial' ? stored : 'imperial'
  })
  const [forecast, setForecast] = useState<OptimisticForecast | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastQuery, setLastQuery] = useState<string | null>(null)
  const [history, setHistory] = useState<SearchHistoryEntry[]>(() => loadHistoryEntries())
  const [historyMenuOpen, setHistoryMenuOpen] = useState(false)
  const [geoSupported] = useState(() => typeof navigator !== 'undefined' && !!navigator.geolocation)
  const [geoError, setGeoError] = useState<string | null>(null)

  useEffect(() => {
    persistHistoryEntries(history)
  }, [history])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(UNIT_STORAGE_KEY, units)
  }, [units])

  const recordHistory = (entry: Omit<SearchHistoryEntry, 'id'>) => {
    const id = crypto?.randomUUID ? crypto.randomUUID() : `hist-${Date.now()}`
    setHistory((prev) => {
      const filtered = prev.filter((item) => item.query.toLowerCase() !== entry.query.toLowerCase())
      const nextEntries = [{ ...entry, id }, ...filtered]
      return nextEntries.slice(0, HISTORY_LIMIT)
    })
  }

  const runSearch = async (searchQuery: string, requestedUnits: Units) => {
    setLoading(true)
    setError(null)

    try {
      const data = await fetchOptimisticForecast(searchQuery, requestedUnits)
      setForecast(data)
      setLastQuery(searchQuery)
      recordHistory({
        query: searchQuery,
        success: true,
        timestamp: Date.now(),
        locationLabel: data.locationLabel,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load the forecast right now.'
      setError(message)
      setForecast(null)
      recordHistory({
        query: searchQuery,
        success: false,
        timestamp: Date.now(),
        errorMessage: message,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!query.trim()) {
      setError('Enter a city, state, or zip to see the optimistic outlook.')
      return
    }
    void runSearch(query, units)
  }

  const handleUnitsSelect = (nextUnits: Units | '') => {
    if (!nextUnits || nextUnits === units) {
      return
    }
    setUnits(nextUnits)
    if (lastQuery) {
      void runSearch(lastQuery, nextUnits)
    }
  }

  const handleQuickPick = (preset: string) => {
    setQuery(preset)
    void runSearch(preset, units)
  }

  const handleHistorySelect = (entry: SearchHistoryEntry) => {
    setQuery(entry.query)
    void runSearch(entry.query, units)
  }

  const handleHistoryDelete = (id: string) => {
    setHistory((prev) => prev.filter((entry) => entry.id !== id))
  }

  const handleHistoryClear = () => {
    setHistory([])
    clearHistoryEntries()
  }

  const errorMessage = error ?? geoError

  const runCoordsSearch = async (coords: Coordinates, labelHint?: string) => {
    setLoading(true)
    setError(null)
    setGeoError(null)

    try {
      const place = await reverseGeocode(coords)
      const labelParts = [place.name]
      if (place.state) {
        labelParts.push(place.state)
      }
      labelParts.push(place.country)
      const queryLabel = labelHint ?? labelParts.join(', ')

      const data = await fetchOptimisticForecast(queryLabel, units)
      setForecast(data)
      setLastQuery(queryLabel)
      recordHistory({
        query: queryLabel,
        success: true,
        timestamp: Date.now(),
        locationLabel: data.locationLabel,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'We could not load your local forecast.'
      setError(message)
      setGeoError(message)
      setForecast(null)
    } finally {
      setLoading(false)
    }
  }

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported in this browser.')
      return
    }

    setLoading(true)
    setGeoError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        void runCoordsSearch({ lat: latitude, lon: longitude })
      },
      (geoErr) => {
        setLoading(false)
        switch (geoErr.code) {
          case geoErr.PERMISSION_DENIED:
            setGeoError('Permission denied. You can still search manually for any city or zip.')
            break
          case geoErr.POSITION_UNAVAILABLE:
            setGeoError('Location unavailable right now. Try again soon or search manually.')
            break
          case geoErr.TIMEOUT:
            setGeoError('Location lookup timed out. Try again or search manually.')
            break
          default:
            setGeoError('Unable to determine your location.')
        }
      },
      {
        enableHighAccuracy: false,
        maximumAge: 1000 * 60 * 5,
        timeout: 1000 * 10,
      },
    )
  }

  const unitsLabel = units === 'metric' ? 'Metric (°C)' : 'Imperial (°F)'

  return (
    <div className="relative">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-16">
        <header className="space-y-3 text-center">
          <div className="flex justify-center">
            <span className="relative inline-flex items-center justify-center text-5xl font-black uppercase tracking-[0.4em] text-transparent sm:text-6xl">
              <span className="absolute inset-0 -scale-x-100 transform bg-gradient-to-r from-[#ff6ec7] via-[#ffb347] to-[#32fff0] opacity-80 blur-md" aria-hidden />
              <span className="relative bg-gradient-to-r from-[#ff6ec7] via-[#ffdd55] to-[#32fff0] bg-clip-text drop-shadow-[0_0_18px_rgba(255,136,206,0.55)]">
                Bright Side
              </span>
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800 sm:text-3xl">
            Flip every forecast into a reason to smile
          </h1>
        </header>

        <Card className="border-slate-200/70 bg-white/85 shadow-xl backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-semibold text-slate-900">Find the bright side</CardTitle>
            <CardDescription className="text-slate-600">
              Drop in any city, zip code, or landmark and we will surface the upbeat bits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="location">
                  Where should we look?
                </label>
                <Input
                  id="location"
                  type="text"
                  placeholder="e.g. Seattle, WA or 94103"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  autoComplete="off"
                />
              </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Curating optimism…
                  </span>
                ) : (
                  'Reveal the bright side'
                )}
              </Button>
              {geoSupported && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUseLocation}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <Navigation className="h-4 w-4" aria-hidden />
                  Use my location
                </Button>
              )}
              <ToggleGroup
                type="single"
                value={units}
                onValueChange={handleUnitsSelect}
                disabled={loading}
                  className="rounded-full border border-slate-200 bg-slate-100/60 p-1 text-sm shadow-inner"
                  aria-label="Select temperature units"
                >
                  <ToggleGroupItem
                    value="imperial"
                    className="rounded-full px-4"
                    aria-pressed={units === 'imperial'}
                  >
                    Fahrenheit (°F)
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="metric"
                    className="rounded-full px-4"
                    aria-pressed={units === 'metric'}
                  >
                    Celsius (°C)
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span className="font-semibold text-slate-700">Need inspiration?</span>
              {['Lisbon, Portugal', 'Sydney, Australia', 'Seattle, WA'].map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickPick(preset)}
                  disabled={loading}
                >
                  {preset.split(',')[0]}
                </Button>
              ))}
            </div>

          </CardContent>
        </Card>

        {history.length > 0 && (
          <Card className="border-slate-200/70 bg-white/85 shadow-lg backdrop-blur-sm">
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-xl font-semibold text-slate-900">Recent searches</CardTitle>
                <CardDescription className="text-slate-600">
                  Tap a location to instantly replay its optimistic outlook.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500"
                  onClick={() => setHistoryMenuOpen((open) => !open)}
                >
                  Manage
                </Button>
                <Button variant="outline" size="sm" onClick={handleHistoryClear} disabled={!history.length}>
                  Clear all
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-slate-200">
                {history.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col sm:max-w-md">
                      <span className="text-sm font-semibold text-slate-900">
                        {entry.success ? entry.locationLabel ?? entry.query : entry.query}
                      </span>
                      <span className="text-xs text-slate-500">
                        {entry.success ? 'Bright side locked in' : entry.errorMessage ?? 'No forecast found'} ·
                        {' '}
                        {formatRelativeTime(entry.timestamp)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-w-[88px]"
                        onClick={() => handleHistorySelect(entry)}
                        disabled={loading}
                      >
                        Re-run
                      </Button>
                      {historyMenuOpen && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-600"
                          onClick={() => handleHistoryDelete(entry.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm font-medium text-rose-700 shadow-sm">
            {errorMessage}
          </div>
        )}
        {loading && !forecast && (
          <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm font-medium text-sky-700 shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Gathering your optimistic outlook…
          </div>
        )}

        {forecast ? (
          <Card className="border-slate-200/70 bg-white/90 shadow-2xl backdrop-blur">
            <CardHeader className="space-y-2">
              <CardTitle className="text-3xl font-semibold text-slate-900">
                {forecast.locationLabel}
              </CardTitle>
              <CardDescription className="text-base text-sky-600">
                {forecast.skySummary}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-6 rounded-2xl bg-slate-50/80 p-6 ring-1 ring-inset ring-slate-200">
                <div className="space-y-2">
                  <p className="text-5xl font-semibold text-slate-900">
                    {formatTemperature(forecast.temperature.current, units)}
                  </p>
                  <p className="text-sm text-slate-600">
                    Feels like {formatTemperature(forecast.temperature.feelsLike, units)}
                  </p>
                </div>
                <div className="space-y-2 text-sm text-slate-600">
                  <p className="font-semibold text-slate-800">
                    High {formatTemperature(forecast.temperature.high, units)}
                  </p>
                  <p className="font-semibold text-slate-800">
                    Low {formatTemperature(forecast.temperature.low, units)}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {forecast.highlights.map((highlight) => (
                  <div
                    key={highlight.id}
                    className="flex h-full flex-col gap-2 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50/90 via-white/90 to-indigo-50/70 p-4 shadow-sm"
                  >
                    <h3 className="text-lg font-semibold text-slate-900">{highlight.title}</h3>
                    <p className="text-sm font-medium text-slate-700">{highlight.takeaway}</p>
                    {highlight.detail && <p className="text-xs text-slate-500">{highlight.detail}</p>}
                    {highlight.metricLabel && highlight.metricValue && (
                      <div className="mt-auto flex items-center justify-between text-xs text-slate-500">
                        <span>{highlight.metricLabel}</span>
                        <span className="font-semibold text-slate-700">{highlight.metricValue}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="justify-end text-xs text-muted-foreground">
              Next snapshot around {formatTime(forecast.nextUpdate)} · Units: {unitsLabel}
            </CardFooter>
          </Card>
        ) : (
          <Card className="border-dashed border-slate-300 bg-white/70 backdrop-blur">
            <CardContent className="space-y-4 p-8">
              <h2 className="text-2xl font-semibold text-slate-900">Optimism loading…</h2>
              <p className="text-sm text-slate-600">
                Plug in any location and we will reframe the forecast with bright spots—from blue-sky windows
                to humidity perks.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default App
