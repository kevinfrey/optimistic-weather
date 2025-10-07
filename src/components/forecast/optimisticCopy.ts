import type { OptimisticDailyOutlook } from '@/types/weather'

const formatTemperature = (value: number, units: 'metric' | 'imperial') => {
  const suffix = units === 'metric' ? '°C' : '°F'
  return `${Math.round(value)}${suffix}`
}

const getTemperatureMood = (avg: number, units: 'metric' | 'imperial') => {
  const celsius = units === 'metric' ? avg : ((avg - 32) * 5) / 9

  if (celsius <= 0) {
    return 'Bundle up.'
  }
  if (celsius <= 10) {
    return 'Crisp layers.'
  }
  if (celsius <= 18) {
    return 'Sweater-perfect.'
  }
  if (celsius <= 26) {
    return 'Just-right temps.'
  }
  if (celsius <= 32) {
    return 'Poolside warm.'
  }
  return 'Shade recommended.'
}

const buildDrynessSnippet = (outlook: OptimisticDailyOutlook) => {
  if (typeof outlook.precipitationChancePercent !== 'number') {
    return {
      headline: 'Weather wildcard.',
      caption: 'Surprises likely.',
    }
  }

  const dryPercent = 100 - outlook.precipitationChancePercent

  if (dryPercent >= 80) {
    return {
      headline: 'Sun streak ahead.',
      caption: `${dryPercent}% dry hours.`,
    }
  }

  if (dryPercent >= 60) {
    return {
      headline: 'Dry breaks queued.',
      caption: `${dryPercent}% stay splash-free.`,
    }
  }

  if (dryPercent >= 40) {
    return {
      headline: 'Sunny pulses mix in.',
      caption: `${dryPercent}% bright pockets.`,
    }
  }

  if (dryPercent >= 25) {
    return {
      headline: 'Showers with gaps.',
      caption: `${dryPercent}% quick clears.`,
    }
  }

  return {
    headline: 'Cozy rain stretch.',
    caption: 'Few dry windows.',
  }
}

const isWeekend = (date: Date) => {
  const day = date.getDay()
  return day === 0 || day === 6
}

const addWeekendFlavor = (message: string, date: Date) => {
  if (!isWeekend(date)) {
    return message
  }
  if (date.getDay() === 6) {
    return `${message} Saturday vibes.`
  }
  return `${message} Sunday reset.`
}

export const buildOptimisticDailyStory = (
  outlook: OptimisticDailyOutlook,
  units: 'metric' | 'imperial',
) => {
  const dryness = buildDrynessSnippet(outlook)
  const tempMood = getTemperatureMood(outlook.dayAverage, units)
  const headline = addWeekendFlavor(dryness.headline, outlook.date)

  return {
    headline,
    detail: dryness.caption,
    mood: tempMood,
    temperatureSummary: `${formatTemperature(outlook.high, units)} high / ${formatTemperature(outlook.low, units)} low`,
  }
}

export const __internal = {
  formatTemperature,
  buildDrynessSnippet,
}
