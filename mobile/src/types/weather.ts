export interface GeoLocation {
  name: string
  lat: number
  lon: number
  state?: string
  country: string
}

export interface ForecastWeather {
  id: number
  main: string
  description: string
  icon: string
}

export interface ForecastEntry {
  dt: number
  main: {
    temp: number
    feels_like: number
    temp_min: number
    temp_max: number
    pressure: number
    sea_level?: number
    grnd_level?: number
    humidity: number
  }
  weather: ForecastWeather[]
  clouds: {
    all: number
  }
  wind: {
    speed: number
    deg: number
    gust?: number
  }
  visibility: number
  pop: number
  rain?: Record<string, number>
  snow?: Record<string, number>
}

export interface ForecastResponse {
  cod: string
  message: number
  cnt: number
  list: ForecastEntry[]
  city: {
    id: number
    name: string
    coord: {
      lat: number
      lon: number
    }
    country: string
    population: number
    timezone: number
    sunrise: number
    sunset: number
  }
}

export interface OptimisticHighlight {
  id: string
  title: string
  takeaway: string
  detail?: string
  metricLabel?: string
  metricValue?: string
  heroStatValue?: string
  heroStatLabel?: string
}

export interface OptimisticForecast {
  locationLabel: string
  nextUpdate: Date
  temperature: {
    current: number
    feelsLike: number
    high: number
    low: number
    units: 'metric' | 'imperial'
  }
  skySummary: string
  highlights: OptimisticHighlight[]
}

export interface Coordinates {
  lat: number
  lon: number
}

export interface SearchHistoryEntry {
  id: string
  query: string
  timestamp: number
  success: boolean
  locationLabel?: string
  errorMessage?: string
}
