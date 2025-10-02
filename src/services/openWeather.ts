import type {
  ForecastEntry,
  ForecastResponse,
  GeoLocation,
  OptimisticForecast,
  OptimisticHighlight,
} from '../types/weather'

const API_BASE = 'https://api.openweathermap.org'

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

export const geocodeLocation = async (query: string): Promise<GeoLocation> => {
  const apiKey = assertApiKey()
  const encodedQuery = encodeURIComponent(query.trim())
  const url = `${API_BASE}/geo/1.0/direct?q=${encodedQuery}&limit=1&appid=${apiKey}`
  const results = await fetchJson<GeoLocation[]>(url)
  if (!results.length) {
    throw new Error(`Could not find a place called "${query}". Try a city, state/country combo.`)
  }
  return results[0]
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

  const pops = horizon.map((entry) => entry.pop ?? 0)
  const avgDryness = Math.round((1 - average(pops)) * 100)
  const first = horizon[0]

  const cloudOpenings = Math.round(average(horizon.map((entry) => 100 - (entry.clouds?.all ?? 0))))
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

  const highlights: OptimisticHighlight[] = []

  highlights.push(
    avgDryness >= 50
      ? {
          id: 'dryness',
          title: 'Dry Skies Bias',
          takeaway: `${avgDryness}% odds you stay splash-free.`,
          detail: "Still, a pocket umbrella doubles as a sunshade—win-win.",
        }
      : {
          id: 'refresh',
          title: 'Sky Refills Incoming',
          takeaway: 'Showers lined up to refresh the plants and clear the air.',
          detail: `${Math.round(average(pops) * 100)}% rain chance means gardens are celebrating—perfect for indoor creativity.`,
        },
  )

  highlights.push({
    id: 'clouds',
    title: 'Blue-Sky Windows',
    takeaway: `${cloudOpenings}% of the next stretch features blue-sky cameos.`,
    detail: 'Great lighting for photos and quick outdoor breaks.',
  })

  if (Math.abs(feelsGap) <= 1.5) {
    highlights.push({
      id: 'feels-like',
      title: 'Comfort Index',
      takeaway: 'Feels-like temps match the actual read—no wardrobe curveballs.',
    })
  } else if (feelsGap < 0) {
    highlights.push({
      id: 'cooler',
      title: 'Built-In Breeze',
      takeaway: `Feels about ${Math.abs(Math.round(feelsGap))}° cooler than the thermometer—prime for active plans.`,
    })
  } else {
    highlights.push({
      id: 'warmer',
      title: 'Cozy Warmth',
      takeaway: `Feels around ${Math.round(feelsGap)}° warmer—nature's heated blanket.`,
    })
  }

  if (humidity <= 60) {
    highlights.push({
      id: 'humidity',
      title: 'Ideal Hair Day',
      takeaway: `${humidity}% humidity keeps frizz in check and comfort high.`,
    })
  } else {
    highlights.push({
      id: 'hydration',
      title: 'Humidity Bonus',
      takeaway: `${humidity}% humidity means houseplants and skin stay happily hydrated.`,
    })
  }

  if (visibilityMeters >= 8000) {
    highlights.push({
      id: 'visibility',
      title: 'Long-Range Views',
      takeaway: `Visibility stretches roughly ${visibilityValue.toFixed(1)} ${visibilityUnits}—panorama time!`,
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
        }
      : {
          id: 'wind-energy',
          title: 'Wind Energy Mode',
          takeaway: `${windValue.toFixed(1)} ${windUnits} winds—renewable energy fans, rejoice!`,
          detail: gustValue
            ? `Gusts near ${gustValue.toFixed(1)} ${windUnits}. Secure loose items then enjoy the drama.`
            : 'Secure patio furniture, then lean into the dynamic skies.',
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

  const locationLabelParts = [location.name]
  if (location.state) {
    locationLabelParts.push(location.state)
  }
  locationLabelParts.push(location.country)

  const nextUpdateDate = new Date((first.dt + forecast.city.timezone) * 1000)

  return {
    locationLabel: locationLabelParts.join(', '),
    nextUpdate: nextUpdateDate,
    temperature,
    skySummary,
    highlights,
  }
}
