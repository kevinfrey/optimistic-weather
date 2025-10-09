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

export interface DailyTemperature {
  day: number
  min: number
  max: number
  night?: number
  eve?: number
  morn?: number
}

export interface DailyForecastEntry {
  dt: number
  sunrise?: number
  sunset?: number
  moonrise?: number
  moonset?: number
  temp: DailyTemperature
  feels_like?: Record<string, number>
  pressure?: number
  humidity?: number
  weather: ForecastWeather[]
  clouds?: number
  wind_speed?: number
  wind_gust?: number
  wind_deg?: number
  pop?: number
  rain?: number
  snow?: number
}

export interface HourlyForecastEntry {
  dt: number
  temp: number
  feels_like: number
  weather?: ForecastWeather[]
  pop?: number
}

export interface ExtendedForecastResponse {
  lat: number
  lon: number
  timezone: string
  timezone_offset: number
  daily: DailyForecastEntry[]
  hourly?: HourlyForecastEntry[]
}

export interface LegacyDailyForecastEntry {
  dt: number
  sunrise?: number
  sunset?: number
  temp: DailyTemperature
  feels_like?: Record<string, number>
  pressure?: number
  humidity?: number
  weather: ForecastWeather[]
  clouds?: number
  speed?: number
  gust?: number
  deg?: number
  pop?: number
  rain?: number
  snow?: number
}

export interface LegacyDailyForecastResponse {
  city: {
    timezone: number
  }
  list: LegacyDailyForecastEntry[]
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
  extendedOutlook?: OptimisticExtendedOutlook
  hourlyOutlook?: OptimisticHourlyOutlook[]
  coordinates: Coordinates
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

export interface OptimisticDailyOutlook {
  date: Date
  high: number
  low: number
  dayAverage: number
  precipitationChancePercent: number | null
  condition: string
  description: string
  sunrise?: Date
  sunset?: Date
  source: 'onecall'
}

export interface OptimisticExtendedOutlook {
  days: OptimisticDailyOutlook[]
  isComplete: boolean
  message?: string
}

export interface OptimisticHourlyOutlook {
  id: string
  time: Date
  temperature: number
  feelsLike: number
  precipitationChancePercent: number | null
  condition: string
  description: string
  icon?: string
}
