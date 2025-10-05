import type {
  ForecastEntry,
  ForecastResponse,
  GeoLocation,
  OptimisticForecast,
  OptimisticHighlight,
  Coordinates,
} from '../types/weather'

const API_BASE = 'https://api.openweathermap.org'

const regionDisplayNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null

const US_STATE_CODE_TO_NAME = new Map<string, string>([
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

const US_STATE_NAME_TO_CODE = new Map<string, string>(
  Array.from(US_STATE_CODE_TO_NAME.entries()).map(([code, name]) => [name.toLowerCase(), code]),
)

const assertApiKey = () => {
  const key = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY as string | undefined
  if (!key) {
    throw new Error('Missing OpenWeather API key. Set EXPO_PUBLIC_OPENWEATHER_API_KEY in your app config.')
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

const ZIP_QUERY_REGEX = /^([A-Za-z0-9-]{3,10})(?:\s*,\s*([A-Za-z]{2}))?$/

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

  const primaryResults = await geocode(trimmedQuery)
  let match = pickBestMatch(trimmedQuery, primaryResults)

  if (!match && trimmedQuery.includes(',')) {
    const [cityOnly] = trimmedQuery.split(',')
    const fallbackResults = await geocode(cityOnly)
    match = pickBestMatch(cityOnly, fallbackResults)
  }

  if (!match) {
    throw new Error(`Could not find a place that matches "${query}". Double-check the spelling or try nearby cities.`)
  }

  return match
}

export const __internal = {
  levenshteinDistance,
  pickBestMatch,
  geocodeByZip,
  ZIP_QUERY_REGEX,
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

const average = (values: number[]) => {
  if (!values.length) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

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
      return 'Fresh flurries dial up the magic—perfect for cocoa refills.'
    case 'Mist':
    case 'Fog':
      return 'Hazy horizons invite slow moments and calm playlists.'
    default:
      return 'Skies shifting with a friendly mix—embrace the surprises.'
  }
}

const buildHighlights = (
  entries: ForecastEntry[],
  units: 'metric' | 'imperial',
): OptimisticHighlight[] => {
  if (!entries.length) {
    return []
  }

  const midday = entries[Math.min(4, entries.length - 1)]
  const evening = entries[Math.min(8, entries.length - 1)]

  const humidities = entries.map((entry) => entry.main.humidity)
  const averageHumidity = Math.round(average(humidities))

  const windSpeeds = entries.map((entry) => entry.wind.speed)
  const averageWind = average(windSpeeds)

  const visibilityValues = entries.map((entry) => entry.visibility)
  const averageVisibility = average(visibilityValues)

  const chanceOfRain = Math.max(...entries.map((entry) => entry.pop ?? 0)) * 100
  const roundedRainChance = Math.round(chanceOfRain)
  const dryWindowPercent = Math.max(0, 100 - roundedRainChance)

  const visibilityText = units === 'imperial'
    ? `${averageVisibility > 16093 ? '10+' : (averageVisibility / 1609.34).toFixed(1)} mi`
    : `${averageVisibility > 10000 ? '10+' : (averageVisibility / 1000).toFixed(1)} km`

  const windText = units === 'imperial'
    ? `${(averageWind * 2.237).toFixed(1)} mph`
    : `${metersPerSecondToKph(averageWind).toFixed(1)} km/h`

  const highlights: OptimisticHighlight[] = [
    {
      id: 'sky-window',
      title: 'Sun break window',
      takeaway: buildSkySummary(midday),
      detail: `Sweet spot around ${new Date(midday.dt * 1000).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })}.`,
      heroStatValue: new Date(midday.dt * 1000).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      }),
      heroStatLabel: 'Next pop of sun',
    },
    {
      id: 'evening-vibes',
      title: 'Evening vibes',
      takeaway: buildSkySummary(evening),
      detail: 'Line up your golden-hour stroll or night-in playlist.',
      heroStatValue: new Date(evening.dt * 1000).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      }),
      heroStatLabel: 'Evening outlook',
    },
    {
      id: 'humidity-perk',
      title: 'Humidity perks',
      takeaway: averageHumidity < 40
        ? 'Crisp air keeps everything feeling light.'
        : 'Moisture in the air keeps skin glowing and plants thrilled.',
      heroStatValue: `${averageHumidity}%`,
      heroStatLabel: 'Avg humidity',
      metricLabel: 'Avg humidity',
      metricValue: `${averageHumidity}%`,
    },
    {
      id: 'visibility',
      title: 'Visibility outlook',
      takeaway: averageVisibility > 8000
        ? 'Clear views ahead—perfect for scenic detours.'
        : 'Soft horizon today—lean into indoor comforts.',
      heroStatValue: visibilityText,
      heroStatLabel: 'Avg visibility',
      metricLabel: 'Avg visibility',
      metricValue: visibilityText,
    },
    {
      id: 'wind',
      title: 'Comfort breeze',
      takeaway: averageWind < 3
        ? 'Barely a breeze—plan the rooftop hangout.'
        : 'A gentle flow keeps things fresh without hat drama.',
      heroStatValue: windText,
      heroStatLabel: 'Avg wind',
      metricLabel: 'Avg wind',
      metricValue: windText,
    },
    {
      id: 'chance-of-rain',
      title: 'Chance of rain',
      takeaway: dryWindowPercent > 0
        ? `${dryWindowPercent}% shot to dart outside between refills.`
        : 'Atmosphere on hydration duty—channel the cozy indoor energy.',
      heroStatValue: `${dryWindowPercent}%`,
      heroStatLabel: 'Dry window odds',
      metricLabel: 'Rain potential',
      metricValue: `${roundedRainChance}%`,
    },
  ]

  return highlights
}

export const fetchOptimisticForecast = async (
  query: string,
  units: 'metric' | 'imperial',
): Promise<OptimisticForecast> => {
  const location = await geocodeLocation(query)
  const forecast = await fetchForecast(location.lat, location.lon, units)
  if (!forecast.list.length) {
    throw new Error('No forecast data available right now. Try again soon!')
  }

  const current = forecast.list[0]
  const locationLabelParts = [forecast.city.name]
  if (forecast.city.country) {
    locationLabelParts.push(forecast.city.country)
  }

  return {
    locationLabel: locationLabelParts.join(', '),
    nextUpdate: new Date(current.dt * 1000 + 1000 * 60 * 60),
    temperature: {
      current: current.main.temp,
      feelsLike: current.main.feels_like,
      high: Math.max(...forecast.list.slice(0, 8).map((entry) => entry.main.temp_max)),
      low: Math.min(...forecast.list.slice(0, 8).map((entry) => entry.main.temp_min)),
      units,
    },
    skySummary: buildSkySummary(current),
    highlights: buildHighlights(forecast.list.slice(0, 12), units),
  }
}
