import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComponentType, FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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
import {
  fetchOptimisticForecast,
  reverseGeocode,
  searchLocationSuggestions,
  formatUsLocationLabel,
} from '@/services/openWeather'
import type {
  Coordinates,
  GeoLocation,
  OptimisticForecast,
  SearchHistoryEntry,
} from '@/types/weather'
import type { OptimisticHighlight } from '@/types/weather'
import type { LocationSuggestion } from '@/services/openWeather'
import {
  clearHistoryEntries,
  loadHistoryEntries,
  persistHistoryEntries,
} from '@/lib/history-storage'
import {
  Loader2,
  Navigation,
  SunMedium,
  ThermometerSun,
  UmbrellaOff,
  X,
  Droplets,
  Binoculars,
  Wind,
} from 'lucide-react'
import TenDayOutlook from '@/components/forecast/TenDayOutlook'
import RadarView from '@/components/radar/RadarView'
import HourlyCarousel from '@/components/forecast/HourlyCarousel'

type Units = 'metric' | 'imperial'
type ActivePanel = 'outlook' | 'radar'
const UNIT_STORAGE_KEY = 'optimistic-weather-units-v1'
const PANEL_STORAGE_KEY = 'optimistic-weather-panel-v1'
const HISTORY_LIMIT = 8
const MIN_AUTOCOMPLETE_QUERY_LENGTH = 2

const formatLocationSuggestionLabel = (location: GeoLocation) => formatUsLocationLabel(location)

const formatTemperature = (value: number, units: Units) => {
  const rounded = Math.round(value)
  const suffix = units === 'metric' ? '°C' : '°F'
  return `${rounded}${suffix}`
}

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
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [searchVisible, setSearchVisible] = useState(false)
  const [autoLocateAttempted, setAutoLocateAttempted] = useState(false)
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null)
  const suggestionRequestIdRef = useRef(0)
  const [pendingSearchValue, setPendingSearchValue] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<ActivePanel | null>(() => {
    if (typeof window === 'undefined') {
      return null
    }
    const stored = window.localStorage.getItem(PANEL_STORAGE_KEY) as ActivePanel | null
    return stored === 'outlook' || stored === 'radar' ? stored : null
  })

  useEffect(() => {
    persistHistoryEntries(history)
  }, [history])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(UNIT_STORAGE_KEY, units)
  }, [units])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    if (activePanel) {
      window.localStorage.setItem(PANEL_STORAGE_KEY, activePanel)
    } else {
      window.localStorage.removeItem(PANEL_STORAGE_KEY)
    }
  }, [activePanel])

  useEffect(() => {
    if (!searchVisible) {
      setSuggestions([])
      setSuggestionsError(null)
      setSuggestionsLoading(false)
      return
    }

    const trimmedQuery = query.trim()
    if (trimmedQuery.length < MIN_AUTOCOMPLETE_QUERY_LENGTH) {
      setSuggestions([])
      setSuggestionsError(null)
      setSuggestionsLoading(false)
      return
    }

    const requestId = suggestionRequestIdRef.current + 1
    suggestionRequestIdRef.current = requestId
    setSuggestionsLoading(true)
    setSuggestionsError(null)

    const timeoutId = window.setTimeout(() => {
      void searchLocationSuggestions(trimmedQuery)
        .then((results) => {
          if (suggestionRequestIdRef.current !== requestId) {
            return
          }
          setSuggestions(results)
          if (!results.length) {
            setSuggestionsError(`No matches found for "${trimmedQuery}".`)
          }
        })
        .catch((err) => {
          if (suggestionRequestIdRef.current !== requestId) {
            return
          }
          const message = err instanceof Error
            ? err.message
            : 'Unable to suggest locations right now.'
          setSuggestions([])
          setSuggestionsError(message)
        })
        .finally(() => {
          if (suggestionRequestIdRef.current === requestId) {
            setSuggestionsLoading(false)
          }
        })
    }, 200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [query, searchVisible])


  const recordHistory = useCallback((entry: Omit<SearchHistoryEntry, 'id'>) => {
    const id = crypto?.randomUUID ? crypto.randomUUID() : `hist-${Date.now()}`
    setHistory((prev) => {
      const filtered = prev.filter((item) => item.query.toLowerCase() !== entry.query.toLowerCase())
      const nextEntries = [{ ...entry, id }, ...filtered]
      return nextEntries.slice(0, HISTORY_LIMIT)
    })
  }, [])

  const runSearch = async (searchQuery: string, requestedUnits: Units) => {
    suggestionRequestIdRef.current += 1
    setSuggestions([])
    setSuggestionsError(null)
    setSuggestionsLoading(false)
    setPendingSearchValue(null)
    setLoading(true)
    setError(null)
    setActivePanel(null)

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
      setSearchVisible(false)
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
    const finalQuery = (pendingSearchValue ?? trimmedQuery).trim()
    if (!finalQuery) {
      setError('Enter a city, state, or zip to see the optimistic outlook.')
      return
    }
    void runSearch(finalQuery, units)
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

  const handleSuggestionSelect = (suggestion: LocationSuggestion) => {
    const nextQuery = suggestion.searchValue
    setQuery(nextQuery)
    setPendingSearchValue(suggestion.searchValue)
    void runSearch(suggestion.searchValue, units)
  }

  const handleHistorySelect = (entry: SearchHistoryEntry) => {
    setQuery(entry.query)
    setPendingSearchValue(null)
    void runSearch(entry.query, units)
  }

  const handleHistoryDelete = (id: string) => {
    setHistory((prev) => prev.filter((entry) => entry.id !== id))
  }

  const handleHistoryClear = () => {
    setHistory([])
    clearHistoryEntries()
  }

  const trimmedQuery = query.trim()
  const shouldShowSuggestions = searchVisible && trimmedQuery.length >= MIN_AUTOCOMPLETE_QUERY_LENGTH
  const errorMessage = error ?? geoError

  const drynessHighlight = forecast?.highlights.find((highlight) =>
    highlight.id === 'dryness'
    || highlight.id === 'refresh'
    || highlight.heroStatLabel?.toLowerCase().includes('dry'),
  )
  const faceMeltHighlight = forecast?.highlights.find((highlight) =>
    highlight.id === 'clouds'
    || highlight.heroStatLabel?.toLowerCase().includes('sun splash'),
  )
  const highlightIconMap: Record<string, ComponentType<{ className?: string }>> = {
    dryness: UmbrellaOff,
    refresh: UmbrellaOff,
    clouds: SunMedium,
    'feels-like': ThermometerSun,
    cooler: ThermometerSun,
    warmer: ThermometerSun,
    humidity: Droplets,
    hydration: Droplets,
    visibility: Binoculars,
    'cozy-views': Binoculars,
    breeze: Wind,
    'wind-energy': Wind,
  }

  const secondaryHighlights = forecast
    ? forecast.highlights.filter((highlight) => {
        if (highlight.id === drynessHighlight?.id || highlight.id === faceMeltHighlight?.id) {
          return false
        }
        return Boolean(highlightIconMap[highlight.id])
      })
    : []

  const highlightCards: OptimisticHighlight[] = []
  if (drynessHighlight) {
    highlightCards.push(drynessHighlight)
  }
  if (faceMeltHighlight) {
    highlightCards.push(faceMeltHighlight)
  }
  if (secondaryHighlights.length) {
    highlightCards.push(...secondaryHighlights)
  }

  const renderHighlightCard = (highlight: OptimisticHighlight) => {
    const Icon = highlightIconMap[highlight.id] ?? ThermometerSun
    const metricText = [highlight.metricLabel, highlight.metricValue].filter(Boolean).join(' · ')

    return (
      <motion.div
        key={highlight.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 160, damping: 20 }}
        className="flex h-full flex-col gap-3 rounded-3xl border border-white/70 bg-white/85 p-5 shadow-[0_18px_38px_-28px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:shadow-xl"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 via-sky-100 to-white text-sky-600">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">{highlight.title}</p>
            {highlight.heroStatValue ? (
              <p className="text-2xl font-semibold text-slate-900">{highlight.heroStatValue}</p>
            ) : null}
            {highlight.heroStatLabel ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">{highlight.heroStatLabel}</p>
            ) : null}
          </div>
        </div>
        <div className="flex min-h-[60px] flex-col gap-2 text-left text-slate-500">
          <p className="text-sm font-medium text-slate-700">{highlight.takeaway}</p>
          {highlight.detail ? <p className="text-xs text-slate-500">{highlight.detail}</p> : null}
        </div>
        {metricText ? (
          <p className="mt-auto text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">{metricText}</p>
        ) : null}
      </motion.div>
    )
  }

  const runCoordsSearch = useCallback(async (coords: Coordinates, labelHint?: string) => {
    setLoading(true)
    setError(null)
    setGeoError(null)
    setActivePanel(null)

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
      setSearchVisible(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'We could not load your local forecast.'
      setError(message)
      setGeoError(message)
      setForecast(null)
    } finally {
      setLoading(false)
    }
  }, [units, recordHistory])

  useEffect(() => {
    if (searchVisible || autoLocateAttempted || forecast || loading) {
      return
    }
    if (!geoSupported || !navigator.geolocation) {
      setSearchVisible(true)
      setAutoLocateAttempted(true)
      return
    }
    setAutoLocateAttempted(true)
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
        setSearchVisible(true)
      },
      {
        enableHighAccuracy: false,
        maximumAge: 1000 * 60 * 5,
        timeout: 1000 * 10,
      },
    )
  }, [searchVisible, autoLocateAttempted, forecast, loading, geoSupported, runCoordsSearch])

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported in this browser.')
      return
    }

    setLoading(true)
    setGeoError(null)
    setActivePanel(null)

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

  const extendedOutlook = forecast?.extendedOutlook

  const handlePanelSelect = (value: ActivePanel | '') => {
    if (!value) {
      setActivePanel(null)
      return
    }
    setActivePanel(value)
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/70 to-amber-50/40">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-16">
        <header className="space-y-2 text-left sm:text-center">
          <div className="flex flex-col items-start gap-1 sm:items-center">
            <span className="relative inline-flex items-center justify-center text-4xl font-black uppercase tracking-[0.4em] text-transparent sm:text-5xl">
              <span
                className="absolute inset-0 -scale-x-100 transform bg-gradient-to-r from-[#ff6ec7] via-[#ffb347] to-[#32fff0] opacity-80 blur-md"
                aria-hidden
              />
              <span className="relative bg-gradient-to-r from-[#ff6ec7] via-[#ffdd55] to-[#32fff0] bg-clip-text drop-shadow-[0_0_18px_rgba(255,136,206,0.55)]">
                Bright Side
              </span>
            </span>
            <span className="relative inline-flex items-center justify-center text-2xl font-semibold uppercase tracking-[0.35em] text-transparent sm:text-3xl">
              <span
                className="absolute inset-0 -scale-x-100 transform bg-gradient-to-r from-[#ff6ec7] via-[#ffb347] to-[#32fff0] opacity-70 blur-md"
                aria-hidden
              />
              <span className="relative bg-gradient-to-r from-[#ff6ec7] via-[#ffdd55] to-[#32fff0] bg-clip-text drop-shadow-[0_0_14px_rgba(255,136,206,0.45)]">
                Weather
              </span>
            </span>
          </div>
        </header>

        <AnimatePresence>
          {searchVisible ? (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ type: 'spring', stiffness: 120, damping: 18 }}
              className="flex flex-col gap-6 lg:flex-row lg:items-start"
            >
              <Card className="flex-1 border-none bg-white/80 shadow-[0_24px_65px_-32px_rgba(15,23,42,0.45)] backdrop-blur-xl">
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
                  <div className="space-y-2">
                    <div className="relative">
                      <Input
                        id="location"
                        type="text"
                        placeholder="e.g. Louisville, KY or 40299"
                        value={query}
                        onChange={(event) => {
                          setQuery(event.target.value)
                          setPendingSearchValue(null)
                        }}
                        autoComplete="off"
                        ref={searchInputRef}
                        className="pr-10"
                      />
                      {query && (
                        <button
                          type="button"
                          onClick={() => {
                            setQuery('')
                            setError(null)
                            setSuggestions([])
                            setSuggestionsError(null)
                            setSuggestionsLoading(false)
                            setPendingSearchValue(null)
                            searchInputRef.current?.focus()
                          }}
                          className="absolute inset-y-0 right-2 flex items-center text-slate-400 transition hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                          aria-label="Clear search"
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                    </div>
                    {shouldShowSuggestions && (suggestionsLoading || suggestions.length > 0 || suggestionsError) && (
                      <div className="rounded-2xl border border-slate-200/80 bg-white/95 shadow-md">
                        {suggestionsLoading ? (
                          <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-600">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            Looking for matching places…
                          </div>
                        ) : suggestions.length > 0 ? (
                          <ul className="divide-y divide-slate-100">
                            {suggestions.map((suggestion) => {
                              const { location, searchValue } = suggestion
                              const label = formatLocationSuggestionLabel(location)
                              const key = `${searchValue}:${location.lat}:${location.lon}`
                              const helperText = searchValue.toLowerCase() === label.toLowerCase()
                                ? 'Tap to search this spot'
                                : `Search using "${searchValue}"`

                              return (
                                <li key={key}>
                                  <button
                                    type="button"
                                    onClick={() => handleSuggestionSelect(suggestion)}
                                    className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                                  >
                                    <span className="text-sm font-medium text-slate-900">{label}</span>
                                    <span className="text-xs text-slate-500">{helperText}</span>
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        ) : suggestionsError ? (
                          <div className="px-4 py-3 text-sm text-slate-500">{suggestionsError}</div>
                        ) : null}
                      </div>
                    )}
                  </div>
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

              </CardContent>
            </Card>

              {history.length > 0 && (
                <aside className="w-full lg:w-72 lg:flex-shrink-0">
                  <div className="flex h-full flex-col gap-4 rounded-3xl border border-white/70 bg-white/75 p-4 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.45)] backdrop-blur-xl">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                        Recent
                      </p>
                      <p className="text-xs text-slate-500">Tap to replay optimism instantly.</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500"
                        onClick={() => setHistoryMenuOpen((open) => !open)}
                      >
                        Manage
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-slate-500 hover:text-slate-700"
                        onClick={handleHistoryClear}
                        disabled={!history.length}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {history.map((entry) => (
                      <div key={entry.id} className="group relative flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex h-auto min-w-[8rem] flex-col items-start gap-1 whitespace-normal rounded-xl border-slate-200 bg-white/90 px-3 py-2 text-left shadow-sm transition hover:border-slate-300 hover:bg-white"
                          onClick={() => handleHistorySelect(entry)}
                          disabled={loading}
                        >
                          <span className="text-sm font-semibold text-slate-900">
                            {entry.success ? entry.locationLabel ?? entry.query : entry.query}
                          </span>
                          <span className="text-xs text-slate-500">
                            {entry.success ? 'Bright side locked in' : entry.errorMessage ?? 'No forecast found'} · {formatRelativeTime(entry.timestamp)}
                          </span>
                        </Button>
                        {historyMenuOpen && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-rose-600 hover:text-rose-700"
                            onClick={() => handleHistoryDelete(entry.id)}
                            aria-label={`Remove ${entry.locationLabel ?? entry.query} from history`}
                          >
                            <X className="h-4 w-4" aria-hidden />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  </div>
                </aside>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>

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
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 110, damping: 18 }}
          >
            <Card className="border-none bg-white/65 shadow-[0_24px_65px_-30px_rgba(15,23,42,0.55)] backdrop-blur-xl">
              <CardContent className="space-y-8 p-6 sm:p-8">
              <div className="space-y-6 rounded-[32px] bg-white/80 p-6 sm:p-8 shadow-inner ring-1 ring-white/60">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Right now</p>
                    <h2 className="text-3xl font-semibold text-slate-900 sm:text-4xl">{forecast.locationLabel}</h2>
                    <p className="text-base text-slate-600">{forecast.skySummary}</p>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <div className="text-right">
                      <span className="text-5xl font-bold text-slate-900 sm:text-6xl">
                        {formatTemperature(forecast.temperature.current, units)}
                      </span>
                      <p className="text-sm text-slate-500">
                        Feels {formatTemperature(forecast.temperature.feelsLike, units)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSearchVisible((visible) => !visible)}
                      disabled={loading}
                      className="rounded-full border-slate-300 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white"
                    >
                      {searchVisible ? 'Done searching' : 'Change location'}
                    </Button>
                  </div>
                </div>

                {forecast.hourlyOutlook?.length ? (
                  <HourlyCarousel hours={forecast.hourlyOutlook} units={units} />
                ) : null}

                {highlightCards.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {highlightCards.map(renderHighlightCard)}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-start justify-end gap-4">
                <ToggleGroup
                  type="single"
                  value={activePanel ?? ''}
                  onValueChange={handlePanelSelect}
                  className="rounded-full bg-white/80 p-1 text-sm shadow-inner ring-1 ring-white/60"
                  aria-label="Select forecast view"
                  disabled={loading && !forecast}
                >
                  <ToggleGroupItem
                    value="outlook"
                    className="rounded-full px-4 py-1.5 transition data-[state=on]:bg-slate-900 data-[state=on]:text-white data-[state=on]:shadow"
                  >
                    This Week
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="radar"
                    className="rounded-full px-4 py-1.5 transition data-[state=on]:bg-slate-900 data-[state=on]:text-white data-[state=on]:shadow"
                  >
                    Live radar
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {activePanel === 'outlook' ? (
                <TenDayOutlook
                  days={extendedOutlook?.days ?? []}
                  units={units}
                  isComplete={extendedOutlook?.isComplete ?? false}
                  message={extendedOutlook?.message}
                  isLoading={loading && !(extendedOutlook && extendedOutlook.days.length > 0)}
                  onRetry={lastQuery ? () => { void runSearch(lastQuery, units) } : undefined}
                />
              ) : null}

              {activePanel === 'radar' && forecast ? (
                <RadarView
                  coordinates={forecast.coordinates}
                  locationLabel={forecast.locationLabel}
                  isLoading={loading}
                />
              ) : null}
            </CardContent>
          </Card>
          </motion.div>
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

        {/* intentionally no floating footer nav */}
      </div>
    </div>
  )
}

export default App
