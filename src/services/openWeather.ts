import type {
  ForecastEntry,
  ForecastResponse,
  GeoLocation,
  OptimisticForecast,
  OptimisticHighlight,
  OptimisticExtendedOutlook,
  OptimisticDailyOutlook,
  OptimisticHourlyOutlook,
  Coordinates,
  ExtendedForecastResponse,
  DailyForecastEntry,
  HourlyForecastEntry,
  LegacyDailyForecastResponse,
  LegacyDailyForecastEntry,
} from '../types/weather'

const API_BASE = 'https://api.openweathermap.org'
const EXTENDED_OUTLOOK_REQUIRED_DAYS = 10
const HOURLY_OUTLOOK_LIMIT = 12
const EXTENDED_OUTLOOK_LIMITED_MESSAGE = 'Extended outlook limited by available data.'
const EXTENDED_OUTLOOK_UNAVAILABLE_MESSAGE = 'Extended outlook unavailable for this location right now.'

const regionDisplayNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null

export const US_STATE_CODE_TO_NAME = new Map<string, string>([
  ['AL', 'Alabama'],
  ['AK', 'Alaska'],
  ['AZ', 'Arizona'],
  ['AR', 'Arkansas'],
  ['CA', 'California'],
  ['CO', 'Colorado'],
  ['CT', 'Connecticut'],
  ['DE', 'Delaware'],
  ['FL', 'Florida'],
  ['GA', 'Georgia'],
  ['HI', 'Hawaii'],
  ['ID', 'Idaho'],
  ['IL', 'Illinois'],
  ['IN', 'Indiana'],
  ['IA', 'Iowa'],
  ['KS', 'Kansas'],
  ['KY', 'Kentucky'],
  ['LA', 'Louisiana'],
  ['ME', 'Maine'],
  ['MD', 'Maryland'],
  ['MA', 'Massachusetts'],
  ['MI', 'Michigan'],
  ['MN', 'Minnesota'],
  ['MS', 'Mississippi'],
  ['MO', 'Missouri'],
  ['MT', 'Montana'],
  ['NE', 'Nebraska'],
  ['NV', 'Nevada'],
  ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'],
  ['NY', 'New York'],
  ['NC', 'North Carolina'],
  ['ND', 'North Dakota'],
  ['OH', 'Ohio'],
  ['OK', 'Oklahoma'],
  ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'],
  ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'],
  ['SD', 'South Dakota'],
  ['TN', 'Tennessee'],
  ['TX', 'Texas'],
  ['UT', 'Utah'],
  ['VT', 'Vermont'],
  ['VA', 'Virginia'],
  ['WA', 'Washington'],
  ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'],
  ['WY', 'Wyoming'],
  ['DC', 'District of Columbia'],
])

export const US_STATE_NAME_TO_CODE = new Map<string, string>(
  Array.from(US_STATE_CODE_TO_NAME.entries()).map(([code, name]) => [name.toLowerCase(), code]),
)

const assertApiKey = () => {
  const key = import.meta.env.VITE_OPENWEATHER_API_KEY as string | undefined
  if (!key) {
    throw new Error('Missing OpenWeather API key. Add VITE_OPENWEATHER_API_KEY to your environment.')
  }
  return key
}

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url)
  if (!response.ok) {
    const message = await response.text()
    throw new Error(`OpenWeather error (${response.status}): ${message}`)
  }
  return response.json() as Promise<T>
}

const levenshteinDistance = (a: string, b: string): number => {
  const lenA = a.length
  const lenB = b.length
  const dp: number[][] = []

  for (let i = 0; i <= lenA; i += 1) {
    dp[i] = []
    for (let j = 0; j <= lenB; j += 1) {
      dp[i][j] = 0
    }
  }

  for (let i = 0; i <= lenA; i += 1) {
    dp[i][0] = i
  }
  for (let j = 0; j <= lenB; j += 1) {
    dp[0][j] = j
  }

  for (let i = 1; i <= lenA; i += 1) {
    for (let j = 1; j <= lenB; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      )
    }
  }

  return dp[lenA][lenB]
}

const pickBestMatch = (query: string, options: GeoLocation[]): GeoLocation | null => {
  if (!options.length) {
    return null
  }

  const normalizedQuery = query.trim().toLowerCase()
  const rawTokens = query
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean)
  const normalizedTokens = rawTokens.map((token) => token.toLowerCase())
  const uppercaseTokens = rawTokens.map((token) => token.toUpperCase())
  const tokenSet = new Set(normalizedTokens)

  const matchesCountryFromOption = (countryCode: string) => {
    const isoLower = countryCode.toLowerCase()
    if (tokenSet.has(isoLower)) {
      return true
    }
    const countryName = regionDisplayNames?.of(countryCode)?.toLowerCase()
    return countryName ? normalizedQuery.includes(countryName) : false
  }

  const hasCountryHints = options.some((option) => matchesCountryFromOption(option.country))

  const queryStateHints = new Set<string>()
  normalizedTokens.forEach((token) => {
    if (US_STATE_NAME_TO_CODE.has(token)) {
      queryStateHints.add(token)
      const code = US_STATE_NAME_TO_CODE.get(token)
      if (code) {
        queryStateHints.add(code.toLowerCase())
      }
    }
  })
  uppercaseTokens.forEach((token) => {
    if (US_STATE_CODE_TO_NAME.has(token)) {
      queryStateHints.add(token.toLowerCase())
      const name = US_STATE_CODE_TO_NAME.get(token)
      if (name) {
        queryStateHints.add(name.toLowerCase())
      }
    }
  })
  const hasStateHints = queryStateHints.size > 0

  const matchesStateFromOption = (option: GeoLocation) => {
    if (!option.state) {
      return false
    }
    const normalizedState = option.state.toLowerCase()
    if (queryStateHints.has(normalizedState)) {
      return true
    }
    if (uppercaseTokens.includes(option.state.toUpperCase())) {
      return true
    }
    if (option.country.toUpperCase() === 'US') {
      const stateCode = US_STATE_NAME_TO_CODE.get(normalizedState)
      if (stateCode && queryStateHints.has(stateCode.toLowerCase())) {
        return true
      }
    }
    return false
  }

  const scored: { option: GeoLocation; score: number }[] = options.map((option) => {
    const locationLabelParts = [option.name]
    if (option.state) {
      locationLabelParts.push(option.state)
    }
    locationLabelParts.push(option.country)
    const label = locationLabelParts.join(', ').toLowerCase()
    const distance = levenshteinDistance(normalizedQuery, label)

    const matchesCountryHint = matchesCountryFromOption(option.country)
    const matchesStateHint = matchesStateFromOption(option)
    const isUsOption = option.country.toUpperCase() === 'US'

    let score = distance
    if (matchesCountryHint) {
      score -= 40
    } else if (hasCountryHints) {
      score += 20
    }
    if (matchesStateHint) {
      score -= 25
    } else if (hasStateHints) {
      score += 15
      if (isUsOption) {
        score -= 10
      } else {
        score += 10
      }
    }

    return { option, score }
  })

  scored.sort((a, b) => a.score - b.score)
  return scored[0]?.option ?? null
}

const geocode = async (query: string): Promise<GeoLocation[]> => {
  const apiKey = assertApiKey()
  const encodedQuery = encodeURIComponent(query.trim())
  const url = `${API_BASE}/geo/1.0/direct?q=${encodedQuery}&limit=5&appid=${apiKey}`
  return fetchJson<GeoLocation[]>(url)
}

const ZIP_QUERY_REGEX = /^(?=.*\d)([A-Za-z0-9-]{3,10})(?:\s*,\s*([A-Za-z]{2}))?$/

const buildLocationKey = (location: GeoLocation) => [
  location.name.trim().toLowerCase(),
  location.state?.trim().toLowerCase() ?? '',
  location.country.trim().toUpperCase(),
  location.lat,
  location.lon,
].join('|')

const dedupeLocations = (locations: GeoLocation[]): GeoLocation[] => {
  const seen = new Set<string>()
  return locations.filter((location) => {
    const key = buildLocationKey(location)

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

export const formatUsLocationLabel = (location: GeoLocation): string => {
  const parts = [location.name]
  if (location.state) {
    const normalizedState = US_STATE_NAME_TO_CODE.get(location.state.toLowerCase())
    const stateCode = normalizedState
      ? normalizedState.toUpperCase()
      : location.state.length === 2
        ? location.state.toUpperCase()
        : location.state
    parts.push(stateCode)
  }
  return parts.join(', ')
}

const filterUsLocations = (locations: GeoLocation[]): GeoLocation[] =>
  locations.filter((location) => location.country?.toUpperCase() === 'US')

export interface LocationSuggestion {
  location: GeoLocation
  searchValue: string
}

const dedupeSuggestions = (items: LocationSuggestion[]): LocationSuggestion[] => {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = buildLocationKey(item.location)
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

export const searchLocationSuggestions = async (query: string): Promise<LocationSuggestion[]> => {
  const trimmedQuery = query.trim()
  if (trimmedQuery.length < 2) {
    return []
  }

  const suggestions: LocationSuggestion[] = []

  const zipCandidate = ZIP_QUERY_REGEX.exec(trimmedQuery)
  if (zipCandidate) {
    const [, zip, rawCountry] = zipCandidate
    const country = (rawCountry ?? 'US').toUpperCase()
    if (country === 'US') {
      const zipResult = await geocodeByZip(zip, country)
      if (zipResult) {
        suggestions.push({
          location: zipResult,
          searchValue: zip,
        })
      }
    }
  }

  const primaryResults = filterUsLocations(await geocode(trimmedQuery))
  const bestPrimary = pickBestMatch(trimmedQuery, primaryResults)
  if (bestPrimary) {
    suggestions.push({ location: bestPrimary, searchValue: formatUsLocationLabel(bestPrimary) })
    primaryResults.forEach((result) => {
      if (result !== bestPrimary) {
        suggestions.push({
          location: result,
          searchValue: formatUsLocationLabel(result),
        })
      }
    })
  } else {
    primaryResults.forEach((result) => {
      suggestions.push({
        location: result,
        searchValue: formatUsLocationLabel(result),
      })
    })
  }

  if (trimmedQuery.includes(',')) {
    const [cityOnly] = trimmedQuery.split(',')
    const fallbackQuery = cityOnly.trim()
    if (fallbackQuery.length >= 2 && fallbackQuery.toLowerCase() !== trimmedQuery.toLowerCase()) {
      const fallbackResults = filterUsLocations(await geocode(fallbackQuery))
      fallbackResults.forEach((result) => {
        suggestions.push({ location: result, searchValue: formatUsLocationLabel(result) })
      })
    }
  }

  return dedupeSuggestions(suggestions).slice(0, 5)
}

export const reverseGeocode = async ({ lat, lon }: Coordinates): Promise<GeoLocation> => {
  const apiKey = assertApiKey()
  const url = `${API_BASE}/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${apiKey}`
  const results = await fetchJson<GeoLocation[]>(url)
  if (!results.length) {
    throw new Error('Unable to determine your current city from coordinates. Try searching manually.')
  }
  return results[0]
}

const geocodeByZip = async (zip: string, country: string): Promise<GeoLocation | null> => {
  const apiKey = assertApiKey()
  const encodedZip = encodeURIComponent(`${zip},${country}`)
  const url = `${API_BASE}/geo/1.0/zip?zip=${encodedZip}&appid=${apiKey}`
  try {
    const result = await fetchJson<{
      zip: string
      name: string
      lat: number
      lon: number
      country: string
    }>(url)
    return {
      name: result.name,
      lat: result.lat,
      lon: result.lon,
      country: result.country,
    }
  } catch {
    return null
  }
}

export const geocodeLocation = async (query: string): Promise<GeoLocation> => {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    throw new Error('Enter a location to search for a forecast.')
  }

  const zipCandidate = ZIP_QUERY_REGEX.exec(trimmedQuery)
  if (zipCandidate) {
    const [, zip, country] = zipCandidate
    const zipResult = await geocodeByZip(zip, (country ?? 'US').toUpperCase())
    if (zipResult) {
      return zipResult
    }
  }

  const primaryResults = filterUsLocations(await geocode(trimmedQuery))
  let match = pickBestMatch(trimmedQuery, primaryResults)

  if (!match && trimmedQuery.includes(',')) {
    const [cityOnly] = trimmedQuery.split(',')
    const fallbackResults = filterUsLocations(await geocode(cityOnly))
    match = pickBestMatch(cityOnly, fallbackResults)
  }

  if (!match) {
    throw new Error(`Could not find a place that matches "${query}". Double-check the spelling or try nearby cities.`)
  }

  return match
}

const clampPopPercent = (value: number | undefined): number | null => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null
  }
  const ratio = Math.min(Math.max(value, 0), 1)
  return Math.round(ratio * 100)
}

const toDateWithOffset = (timestamp: number | undefined, offsetSeconds: number): Date | undefined => {
  if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) {
    return undefined
  }
  return new Date((timestamp + offsetSeconds) * 1000)
}

const fetchPrimaryDailyForecast = async (
  lat: number,
  lon: number,
  units: 'metric' | 'imperial',
): Promise<ExtendedForecastResponse | null> => {
  // OpenWeather One Call 3.0 exposes up to 16 daily entries; we ingest and trim to 10.
  const apiKey = assertApiKey()
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    units,
    exclude: 'current,minutely,alerts',
    appid: apiKey,
  })
  const url = `${API_BASE}/data/3.0/onecall?${params.toString()}`

  try {
    return await fetchJson<ExtendedForecastResponse>(url)
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Extended daily forecast unavailable:', error)
    }
    return null
  }
}

const fetchLegacyDailyForecast = async (
  lat: number,
  lon: number,
  units: 'metric' | 'imperial',
): Promise<LegacyDailyForecastResponse | null> => {
  const apiKey = assertApiKey()
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    units,
    cnt: String(EXTENDED_OUTLOOK_REQUIRED_DAYS + 2),
    appid: apiKey,
  })
  const url = `${API_BASE}/data/2.5/forecast/daily?${params.toString()}`

  try {
    return await fetchJson<LegacyDailyForecastResponse>(url)
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Legacy daily forecast unavailable:', error)
    }
    return null
  }
}

const normalizeLegacyDailyEntry = (entry: LegacyDailyForecastEntry): DailyForecastEntry => ({
  dt: entry.dt,
  sunrise: entry.sunrise,
  sunset: entry.sunset,
  temp: entry.temp,
  feels_like: entry.feels_like,
  pressure: entry.pressure,
  humidity: entry.humidity,
  weather: entry.weather,
  clouds: entry.clouds,
  wind_speed: entry.speed,
  wind_gust: entry.gust,
  wind_deg: entry.deg,
  pop: entry.pop,
  rain: entry.rain,
  snow: entry.snow,
})

const mergeDailyEntries = (
  primary: DailyForecastEntry[],
  fallback: DailyForecastEntry[],
): DailyForecastEntry[] => {
  const keyed = new Map<string, DailyForecastEntry>()

  const apply = (entries: DailyForecastEntry[]) => {
    entries.forEach((entry) => {
      const key = new Date(entry.dt * 1000).toISOString().slice(0, 10)
      if (!keyed.has(key)) {
        keyed.set(key, entry)
      }
    })
  }

  apply(primary)
  apply(fallback)

  return Array.from(keyed.values())
    .sort((a, b) => a.dt - b.dt)
    .slice(0, EXTENDED_OUTLOOK_REQUIRED_DAYS)
}

const buildExtendedOutlook = (
  dailyEntries: DailyForecastEntry[] | undefined,
  timezoneOffsetSeconds: number,
): OptimisticDailyOutlook[] => {
  if (!dailyEntries?.length) {
    return []
  }

  return dailyEntries
    .filter((entry): entry is DailyForecastEntry =>
      !!entry
      && typeof entry.temp?.max === 'number'
      && !Number.isNaN(entry.temp.max)
      && typeof entry.temp?.min === 'number'
      && !Number.isNaN(entry.temp.min),
    )
    .slice(0, 10)
    .map((entry) => {
      const primary = entry.weather?.[0]
      const dayAverage = typeof entry.temp.day === 'number'
        ? entry.temp.day
        : (entry.temp.max + entry.temp.min) / 2

      return {
        date: new Date((entry.dt + timezoneOffsetSeconds) * 1000),
        high: entry.temp.max,
        low: entry.temp.min,
        dayAverage,
        precipitationChancePercent: clampPopPercent(entry.pop),
        condition: primary?.main ?? 'Clear',
        description: primary?.description ?? primary?.main ?? 'Clear skies',
        sunrise: toDateWithOffset(entry.sunrise, timezoneOffsetSeconds),
        sunset: toDateWithOffset(entry.sunset, timezoneOffsetSeconds),
        source: 'onecall',
      }
    })
}

const buildHourlyOutlook = (
  hourlyEntries: HourlyForecastEntry[] | undefined,
  timezoneOffsetSeconds: number,
): OptimisticHourlyOutlook[] => {
  if (!hourlyEntries?.length) {
    return []
  }

  return hourlyEntries
    .filter((entry): entry is HourlyForecastEntry => typeof entry?.temp === 'number' && !Number.isNaN(entry.temp))
    .slice(0, HOURLY_OUTLOOK_LIMIT)
    .map((entry) => {
      const primary = entry.weather?.[0]

      return {
        id: `hour-${entry.dt}`,
        time: new Date((entry.dt + timezoneOffsetSeconds) * 1000),
        temperature: entry.temp,
        feelsLike: typeof entry.feels_like === 'number' ? entry.feels_like : entry.temp,
        precipitationChancePercent: clampPopPercent(entry.pop),
        condition: primary?.main ?? 'Clear',
        description: primary?.description ?? primary?.main ?? 'Clear skies',
        icon: primary?.icon,
      }
    })
}

export const __internal = {
  levenshteinDistance,
  pickBestMatch,
  geocodeByZip,
  ZIP_QUERY_REGEX,
  dedupeLocations,
  buildExtendedOutlook,
  buildHourlyOutlook,
}

const fetchForecast = async (
  lat: number,
  lon: number,
  units: 'metric' | 'imperial',
): Promise<ForecastResponse> => {
  const apiKey = assertApiKey()
  const url = `${API_BASE}/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${units}&appid=${apiKey}`
  return fetchJson<ForecastResponse>(url)
}

const fetchDailyForecast = async (
  lat: number,
  lon: number,
  units: 'metric' | 'imperial',
): Promise<ExtendedForecastResponse | null> => {
  const primary = await fetchPrimaryDailyForecast(lat, lon, units)
  if (primary?.daily?.length && primary.daily.length >= EXTENDED_OUTLOOK_REQUIRED_DAYS) {
    return primary
  }

  const fallback = await fetchLegacyDailyForecast(lat, lon, units)
  if (!fallback?.list?.length) {
    return primary
  }

  const fallbackAsDaily = fallback.list.map(normalizeLegacyDailyEntry)
  const timezoneOffset = fallback.city.timezone ?? 0

  if (!primary) {
    return {
      lat,
      lon,
      timezone: 'legacy',
      timezone_offset: timezoneOffset,
      daily: fallbackAsDaily,
    }
  }

  const merged = mergeDailyEntries(primary.daily ?? [], fallbackAsDaily)
  return {
    ...primary,
    daily: merged,
    timezone_offset: primary.timezone_offset ?? timezoneOffset,
  }
}

const average = (values: number[]) => {
  if (!values.length) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const toMiles = (meters: number) => meters / 1609.34
const toKilometers = (meters: number) => meters / 1000
const metersPerSecondToKph = (mps: number) => mps * 3.6

const buildSkySummary = (entry: ForecastEntry): string => {
  const primary = entry.weather?.[0]
  const condition = primary?.main ?? 'Clear'
  const cloudiness = entry.clouds?.all ?? 0

  switch (condition) {
    case 'Clear':
      return 'Sun-forward skies and bright horizons on deck.'
    case 'Clouds':
      return cloudiness > 70
        ? 'Soft, filtered daylight keeps the vibe relaxed.'
        : 'Blue sky breaks trade places with playful clouds.'
    case 'Rain':
    case 'Drizzle':
      return 'Nature is topping off the reservoirs—perfect excuse for a cozy plan.'
    case 'Thunderstorm':
      return 'Electric skies bring drama—front-row seats from indoors highly encouraged.'
    case 'Snow':
      return 'Fresh flakes incoming—ideal backdrop for quiet walks and winter photos.'
    case 'Mist':
    case 'Fog':
    case 'Haze':
      return 'Dreamy mist sets the scene—time to embrace the cinematic atmosphere.'
    default:
      return 'Atmosphere is mixing things up—a great day to follow your curiosity.'
  }
}

const craftHighlights = (
  horizon: ForecastEntry[],
  units: 'metric' | 'imperial',
  timezoneOffsetSeconds: number,
): OptimisticHighlight[] => {
  if (!horizon.length) {
    return []
  }

  const normalizedPopValues = horizon.map((entry) => {
    const value = entry.pop ?? 0
    if (Number.isNaN(value)) {
      return 0
    }
    return Math.min(Math.max(value, 0), 1)
  })

  const popsWithData = horizon
    .map((entry) => entry.pop)
    .filter((pop): pop is number => typeof pop === 'number' && !Number.isNaN(pop))

  const wetBlocks = horizon.filter((entry) => {
    const precipitationVolume = (entry.rain?.['3h'] ?? 0) + (entry.snow?.['3h'] ?? 0)
    const wetWeather = entry.weather.some((condition) =>
      ['Rain', 'Drizzle', 'Thunderstorm', 'Snow'].includes(condition.main),
    )
    const highPop = (entry.pop ?? 0) >= 0.4
    return precipitationVolume > 0 || wetWeather || highPop
  }).length

  const avgPopValue = normalizedPopValues.length ? average(normalizedPopValues) : 0
  const dryShareFromPop = 1 - avgPopValue
  const wetPenalty = 1 - wetBlocks / horizon.length
  let drynessRatio = dryShareFromPop * Math.max(wetPenalty, 0)
  drynessRatio = Math.max(0, Math.min(1, drynessRatio))
  const avgDryness = Math.round(drynessRatio * 100)
  const rainChancePercent = Math.round((1 - drynessRatio) * 100)
  const first = horizon[0]

  const cloudOpenings = Math.round(average(horizon.map((entry) => 100 - (entry.clouds?.all ?? 0))))
  const avgCloudCover = Math.round(average(horizon.map((entry) => entry.clouds?.all ?? 0)))
  const humidity = first.main.humidity
  const feelsGap = first.main.feels_like - first.main.temp
  const visibilityMeters = first.visibility
  const windSpeed = first.wind.speed
  const gust = first.wind.gust

  const isMetric = units === 'metric'
  const visibilityValue = isMetric ? toKilometers(visibilityMeters) : toMiles(visibilityMeters)
  const visibilityUnits = isMetric ? 'km' : 'mi'
  const windValue = isMetric ? metersPerSecondToKph(windSpeed) : windSpeed
  const windUnits = isMetric ? 'km/h' : 'mph'
  const gustValue = gust ? (isMetric ? metersPerSecondToKph(gust) : gust) : undefined
  const unitsSuffix = units === 'metric' ? '°C' : '°F'
  const feelsOffset = Math.round(feelsGap)
  const feelsOffsetDisplay = `${Math.abs(feelsOffset)}${unitsSuffix}`
  const feelsSignedDisplay = feelsOffset === 0
    ? `0${unitsSuffix}`
    : `${feelsOffset > 0 ? '+' : ''}${feelsOffset}${unitsSuffix}`

  const highlights: OptimisticHighlight[] = []

  highlights.push(
    avgDryness >= 55
      ? {
          id: 'dryness',
          title: 'Dry Skies Bias',
          takeaway: `${avgDryness}% odds you stay splash-free.`,
          detail: avgDryness === 100
            ? 'Skies look bone-dry—perfect excuse to plan something outside.'
            : 'Still, a pocket umbrella doubles as a sunshade—win-win.',
          heroStatValue: `${avgDryness}%`,
          heroStatLabel: 'Dry skies odds',
          metricLabel: 'Rain chance',
          metricValue: `${rainChancePercent}%`,
        }
      : {
          id: 'refresh',
          title: 'Sky Refills Incoming',
          takeaway: `${avgDryness}% dry-window potential between the refills.`,
          detail: popsWithData.length
            ? `Rain chances near ${rainChancePercent}% mean the plants win—use the ${avgDryness}% dry breaks for fresh air or errand dashes.`
            : 'Radar hints at on-and-off showers—embrace indoor cozy time and watch for quick clearing moments.',
          heroStatValue: `${avgDryness}%`,
          heroStatLabel: 'Dry window odds',
          metricLabel: 'Rain chance',
          metricValue: `${rainChancePercent}%`,
        },
  )

  highlights.push({
    id: 'clouds',
    title: 'Face Melt Factor',
    takeaway: `${cloudOpenings}% odds the sun shows up so hard your face melts (in the best way).`,
    detail: 'Cue the SPF and the grin—the sky’s ready for full-send sunshine sessions.',
    heroStatValue: `${cloudOpenings}%`,
    heroStatLabel: 'Sun splash',
    metricLabel: 'Avg cloud cover',
    metricValue: `${avgCloudCover}%`,
  })

  if (Math.abs(feelsGap) <= 1.5) {
    highlights.push({
      id: 'feels-like',
      title: 'Comfort Index',
      takeaway: 'Feels-like temps match the actual read—no wardrobe curveballs.',
      heroStatValue: feelsOffsetDisplay,
      heroStatLabel: 'Feels diff',
      metricLabel: 'Feels difference',
      metricValue: feelsSignedDisplay,
    })
  } else if (feelsGap < 0) {
    highlights.push({
      id: 'cooler',
      title: 'Built-In Breeze',
      takeaway: `Feels about ${Math.abs(feelsOffset)}° cooler than the thermometer—prime for active plans.`,
      heroStatValue: feelsOffsetDisplay,
      heroStatLabel: 'Feels cooler',
      metricLabel: 'Feels difference',
      metricValue: feelsSignedDisplay,
    })
  } else {
    highlights.push({
      id: 'warmer',
      title: 'Cozy Warmth',
      takeaway: `Feels around ${feelsOffset}° warmer—nature's heated blanket.`,
      heroStatValue: feelsOffsetDisplay,
      heroStatLabel: 'Feels warmer',
      metricLabel: 'Feels difference',
      metricValue: feelsSignedDisplay,
    })
  }

  if (humidity <= 60) {
    highlights.push({
      id: 'humidity',
      title: 'Ideal Hair Day',
      takeaway: `${humidity}% humidity keeps frizz in check and comfort high.`,
      heroStatValue: `${humidity}%`,
      heroStatLabel: 'Humidity',
      metricLabel: 'Humidity',
      metricValue: `${humidity}%`,
    })
  } else {
    highlights.push({
      id: 'hydration',
      title: 'Humidity Bonus',
      takeaway: `${humidity}% humidity means houseplants and skin stay happily hydrated.`,
      heroStatValue: `${humidity}%`,
      heroStatLabel: 'Humidity',
      metricLabel: 'Humidity',
      metricValue: `${humidity}%`,
    })
  }

  if (visibilityMeters >= 8000) {
    highlights.push({
      id: 'visibility',
      title: 'Long-Range Views',
      takeaway: `Visibility stretches roughly ${visibilityValue.toFixed(1)} ${visibilityUnits}—panorama time!`,
      heroStatValue: `${visibilityValue.toFixed(1)} ${visibilityUnits}`,
      heroStatLabel: 'Visibility',
      metricLabel: 'Visibility',
      metricValue: `${visibilityValue.toFixed(1)} ${visibilityUnits}`,
    })
  } else {
    const nextSunset = new Date((horizon[0].dt + timezoneOffsetSeconds) * 1000)
    highlights.push({
      id: 'cozy-views',
      title: 'Cozy Vibes',
      takeaway: 'Soft-focus air invites slow moments and window-watching.',
      detail: `Queue up a playlist and enjoy the diffused light toward ${nextSunset.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })}.`,
      heroStatValue: `${visibilityValue.toFixed(1)} ${visibilityUnits}`,
      heroStatLabel: 'Visibility',
      metricLabel: 'Visibility',
      metricValue: `${visibilityValue.toFixed(1)} ${visibilityUnits}`,
    })
  }

  const gentleBreezeThreshold = isMetric ? 25 : 15.5
  const breezy = windValue <= gentleBreezeThreshold

  highlights.push(
    breezy
      ? {
          id: 'breeze',
          title: 'Friendly Breeze',
          takeaway: `${windValue.toFixed(1)} ${windUnits} winds keep the air feeling fresh.`,
          detail: 'Perfect kite or sail training weather.',
          heroStatValue: `${windValue.toFixed(1)} ${windUnits}`,
          heroStatLabel: 'Wind speed',
          metricLabel: gustValue ? 'Wind / gust' : 'Wind speed',
          metricValue: gustValue
            ? `${windValue.toFixed(1)} / ${gustValue.toFixed(1)} ${windUnits}`
            : `${windValue.toFixed(1)} ${windUnits}`,
        }
      : {
          id: 'wind-energy',
          title: 'Wind Energy Mode',
          takeaway: `${windValue.toFixed(1)} ${windUnits} winds—renewable energy fans, rejoice!`,
          detail: gustValue
            ? `Gusts near ${gustValue.toFixed(1)} ${windUnits}. Secure loose items then enjoy the drama.`
            : 'Secure patio furniture, then lean into the dynamic skies.',
          heroStatValue: `${windValue.toFixed(1)} ${windUnits}`,
          heroStatLabel: 'Wind speed',
          metricLabel: gustValue ? 'Wind / gust' : 'Wind speed',
          metricValue: gustValue
            ? `${windValue.toFixed(1)} / ${gustValue.toFixed(1)} ${windUnits}`
            : `${windValue.toFixed(1)} ${windUnits}`,
        },
  )

  return highlights
}

export const fetchOptimisticForecast = async (
  query: string,
  units: 'metric' | 'imperial' = 'metric',
): Promise<OptimisticForecast> => {
  const location = await geocodeLocation(query)
  const forecast = await fetchForecast(location.lat, location.lon, units)
  const extendedResponse = await fetchDailyForecast(location.lat, location.lon, units)
  const horizon = forecast.list.slice(0, 8) // roughly the next 24 hours
  const first = horizon[0]
  const temps = horizon.map((entry) => entry.main.temp)

  const temperature = {
    current: first.main.temp,
    feelsLike: first.main.feels_like,
    high: Math.max(...temps),
    low: Math.min(...temps),
    units,
  } as const

  const skySummary = buildSkySummary(first)
  const highlights = craftHighlights(horizon, units, forecast.city.timezone)

  let extendedOutlook: OptimisticExtendedOutlook | undefined
  let hourlyOutlook: OptimisticHourlyOutlook[] | undefined
  if (extendedResponse) {
    const days = buildExtendedOutlook(extendedResponse.daily, extendedResponse.timezone_offset ?? 0)
    if (days.length) {
      const isComplete = days.length >= EXTENDED_OUTLOOK_REQUIRED_DAYS
      extendedOutlook = {
        days,
        isComplete,
        message: isComplete ? undefined : EXTENDED_OUTLOOK_LIMITED_MESSAGE,
      }
    } else {
      extendedOutlook = {
        days: [],
        isComplete: false,
        message: EXTENDED_OUTLOOK_UNAVAILABLE_MESSAGE,
      }
    }

    const hourlyEntries = extendedResponse.hourly
    if (hourlyEntries?.length) {
      hourlyOutlook = buildHourlyOutlook(hourlyEntries, extendedResponse.timezone_offset ?? 0)
    }
  } else {
    extendedOutlook = {
      days: [],
      isComplete: false,
      message: EXTENDED_OUTLOOK_UNAVAILABLE_MESSAGE,
    }
  }

  const nextUpdateDate = new Date((first.dt + forecast.city.timezone) * 1000)

  return {
    locationLabel: formatUsLocationLabel(location),
    nextUpdate: nextUpdateDate,
    temperature,
    skySummary,
    highlights,
    extendedOutlook,
    hourlyOutlook,
    coordinates: {
      lat: location.lat,
      lon: location.lon,
    },
  }
}
