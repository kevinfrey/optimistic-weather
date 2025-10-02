import { useState } from 'react'
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
import { fetchOptimisticForecast } from '@/services/openWeather'
import type { OptimisticForecast } from '@/types/weather'

type Units = 'metric' | 'imperial'

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

function App() {
  const [query, setQuery] = useState('')
  const [units, setUnits] = useState<Units>('imperial')
  const [forecast, setForecast] = useState<OptimisticForecast | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastQuery, setLastQuery] = useState<string | null>(null)

  const runSearch = async (searchQuery: string, requestedUnits: Units) => {
    setLoading(true)
    setError(null)

    try {
      const data = await fetchOptimisticForecast(searchQuery, requestedUnits)
      setForecast(data)
      setLastQuery(searchQuery)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load the forecast right now.'
      setError(message)
      setForecast(null)
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
    runSearch(query, units)
  }

  const handleUnitsSelect = (nextUnits: Units | '') => {
    if (!nextUnits || nextUnits === units) {
      return
    }
    setUnits(nextUnits)
    if (lastQuery) {
      runSearch(lastQuery, nextUnits)
    }
  }

  const handleQuickPick = (preset: string) => {
    setQuery(preset)
    runSearch(preset, units)
  }

  const unitsLabel = units === 'metric' ? 'Metric (°C)' : 'Imperial (°F)'

  return (
    <div className="relative">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-16">
        <header className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500">
            Optimistic Weather
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Flip every forecast into a reason to smile
          </h1>
          <p className="text-base text-slate-600">
            Powered by OpenWeather and a healthy dose of silver linings.
          </p>
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
                  {loading ? 'Curating optimism…' : 'Reveal the bright side'}
                </Button>
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickPick('Lisbon, Portugal')}
                disabled={loading}
              >
                Lisbon
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickPick('Sydney, Australia')}
                disabled={loading}
              >
                Sydney
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickPick('Seattle, WA')}
                disabled={loading}
              >
                Seattle
              </Button>
            </div>

          </CardContent>
        </Card>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm font-medium text-rose-700 shadow-sm">
            {error}
          </div>
        )}
        {loading && !forecast && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm font-medium text-sky-700 shadow-sm">
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
