import { useEffect, useMemo, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import * as Location from 'expo-location'

import type {
  Coordinates,
  OptimisticForecast,
  SearchHistoryEntry,
} from './src/types/weather'
import {
  fetchOptimisticForecast,
  reverseGeocode,
} from './src/services/openWeather'
import {
  clearHistoryEntries,
  loadHistoryEntries,
  persistHistoryEntries,
} from './src/storage/history'

const HISTORY_LIMIT = 8

type Units = 'metric' | 'imperial'

const formatTemperature = (value: number, units: Units) => {
  const rounded = Math.round(value)
  return `${rounded}${units === 'metric' ? '°C' : '°F'}`
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

const createHistoryId = () => `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`

const quickPicks = ['Lisbon, Portugal', 'Sydney, Australia', 'Seattle, WA']

function App() {
  const [query, setQuery] = useState('')
  const [units, setUnits] = useState<Units>('imperial')
  const [forecast, setForecast] = useState<OptimisticForecast | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [lastQuery, setLastQuery] = useState<string | null>(null)
  const [history, setHistory] = useState<SearchHistoryEntry[]>([])
  const [historyMenuOpen, setHistoryMenuOpen] = useState(false)

  useEffect(() => {
    void (async () => {
      const entries = await loadHistoryEntries()
      setHistory(entries)
    })()
  }, [])

  useEffect(() => {
    void persistHistoryEntries(history)
  }, [history])

  const errorMessage = error ?? geoError

  const recordHistory = (entry: Omit<SearchHistoryEntry, 'id'>) => {
    const id = createHistoryId()
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

  const handleSearchSubmit = () => {
    if (!query.trim()) {
      setError('Enter a city, state, or zip to see the optimistic outlook.')
      return
    }
    void runSearch(query, units)
  }

  const handleQuickPick = (preset: string) => {
    setQuery(preset)
    void runSearch(preset, units)
  }

  const handleUnitsChange = (nextUnits: Units) => {
    if (nextUnits === units) {
      return
    }
    setUnits(nextUnits)
    if (lastQuery) {
      void runSearch(lastQuery, nextUnits)
    }
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
    void clearHistoryEntries()
  }

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

  const handleUseLocation = async () => {
    try {
      setLoading(true)
      setGeoError(null)
      const { status } = await Location.requestForegroundPermissionsAsync()
      const granted = status === Location.PermissionStatus.GRANTED
      if (!granted) {
        setLoading(false)
        setGeoError('Permission denied. You can still search manually for any city or zip.')
        return
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Platform.OS === 'ios' ? Location.Accuracy.High : Location.Accuracy.Balanced,
      })
      void runCoordsSearch({ lat: position.coords.latitude, lon: position.coords.longitude })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to determine your location.'
      setGeoError(message)
      setLoading(false)
    }
  }

  const unitsLabel = useMemo(
    () => (units === 'metric' ? 'Metric (°C)' : 'Imperial (°F)'),
    [units],
  )

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.brand}>Bright Side</Text>
          <Text style={styles.tagline}>Flip every forecast into a reason to smile.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Find the bright side</Text>
          <Text style={styles.cardDescription}>
            Drop in any city, zip code, or landmark and we will surface the upbeat bits.
          </Text>

          <View style={styles.formField}>
            <Text style={styles.label}>Where should we look?</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="e.g. Seattle, WA or 94103"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              returnKeyType="search"
              onSubmitEditing={handleSearchSubmit}
            />
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleSearchSubmit}
              disabled={loading}
              accessibilityRole="button"
            >
              {loading ? (
                <>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={[styles.buttonText, styles.primaryButtonText]}>Curating optimism…</Text>
                </>
              ) : (
                <Text style={[styles.buttonText, styles.primaryButtonText]}>Reveal the bright side</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton, loading && styles.disabledButton]}
              onPress={() => {
                void handleUseLocation()
              }}
              disabled={loading}
              accessibilityRole="button"
            >
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>Use my location</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.toggleGroup}>
            {(['imperial', 'metric'] as Units[]).map((option) => {
              const isSelected = option === units
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.toggleButton, isSelected && styles.toggleButtonSelected]}
                  onPress={() => handleUnitsChange(option)}
                  disabled={loading}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      isSelected ? styles.toggleTextSelected : undefined,
                    ]}
                  >
                    {option === 'imperial' ? 'Fahrenheit (°F)' : 'Celsius (°C)'}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <View style={styles.quickPicksRow}>
            <Text style={styles.quickPickLabel}>Need inspiration?</Text>
            <View style={styles.quickPills}>
              {quickPicks.map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={styles.quickPill}
                  onPress={() => handleQuickPick(preset)}
                  disabled={loading}
                >
                  <Text style={styles.quickPillText}>{preset.split(',')[0]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {history.length > 0 && (
          <View style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <View>
                <Text style={styles.historyTitle}>Recent</Text>
                <Text style={styles.historyCaption}>Tap to replay optimism instantly.</Text>
              </View>
              <View style={styles.historyActions}>
                <TouchableOpacity onPress={() => setHistoryMenuOpen((open) => !open)}>
                  <Text style={styles.historyManage}>{historyMenuOpen ? 'Close' : 'Manage'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleHistoryClear}>
                  <Text style={styles.historyClear}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.historyList}>
              {history.map((entry) => (
                <View key={entry.id} style={styles.historyItem}>
                  <TouchableOpacity
                    style={styles.historyButton}
                    onPress={() => handleHistorySelect(entry)}
                    disabled={loading}
                  >
                    <Text style={styles.historyButtonTitle} numberOfLines={1}>
                      {entry.success ? entry.locationLabel ?? entry.query : entry.query}
                    </Text>
                    <Text style={styles.historyButtonSubtitle} numberOfLines={2}>
                      {entry.success
                        ? 'Bright side locked in'
                        : entry.errorMessage ?? 'No forecast found'}
                      {' · '}
                      {formatRelativeTime(entry.timestamp)}
                    </Text>
                  </TouchableOpacity>
                  {historyMenuOpen && (
                    <TouchableOpacity
                      style={styles.historyDelete}
                      onPress={() => handleHistoryDelete(entry.id)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.historyDeleteText}>×</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {errorMessage && (
          <View style={styles.feedbackError}>
            <Text style={styles.feedbackText}>{errorMessage}</Text>
          </View>
        )}

        {loading && !forecast && (
          <View style={styles.feedbackInfo}>
            <ActivityIndicator size="small" color="#0369a1" />
            <Text style={styles.feedbackInfoText}>Gathering your optimistic outlook…</Text>
          </View>
        )}

        {forecast ? (
          <View style={styles.forecastCard}>
            <View style={styles.forecastHeader}>
              <Text style={styles.forecastTitle}>{forecast.locationLabel}</Text>
              <Text style={styles.forecastSubtitle}>{forecast.skySummary}</Text>
            </View>

            <View style={styles.temperatureTile}>
              <View>
                <Text style={styles.temperatureValue}>
                  {formatTemperature(forecast.temperature.current, units)}
                </Text>
                <Text style={styles.temperatureFeelsLike}>
                  Feels like {formatTemperature(forecast.temperature.feelsLike, units)}
                </Text>
              </View>
              <View>
                <Text style={styles.tempExtremesLabel}>High</Text>
                <Text style={styles.tempExtremeValue}>
                  {formatTemperature(forecast.temperature.high, units)}
                </Text>
                <Text style={[styles.tempExtremesLabel, styles.tempExtremeSpacer]}>Low</Text>
                <Text style={styles.tempExtremeValue}>
                  {formatTemperature(forecast.temperature.low, units)}
                </Text>
              </View>
            </View>

            <View style={styles.highlightsGrid}>
              {forecast.highlights.map((highlight) => (
                <View key={highlight.id} style={styles.highlightCard}>
                  <View style={styles.highlightCardBackground} aria-hidden />
                  <View style={styles.highlightCardContent}>
                    {(highlight.heroStatValue ?? highlight.heroStatLabel) && (
                      <View style={styles.highlightHeroRow}>
                        {highlight.heroStatValue ? (
                          <Text style={styles.highlightHeroValue}>{highlight.heroStatValue}</Text>
                        ) : null}
                        {highlight.heroStatLabel ? (
                          <Text style={styles.highlightHeroLabel}>{highlight.heroStatLabel}</Text>
                        ) : null}
                      </View>
                    )}
                    <View style={styles.highlightBody}>
                      <Text style={styles.highlightTitle}>{highlight.title}</Text>
                      <Text style={styles.highlightTakeaway}>{highlight.takeaway}</Text>
                      {highlight.detail ? (
                        <Text style={styles.highlightDetail}>{highlight.detail}</Text>
                      ) : null}
                    </View>
                    {highlight.metricLabel && highlight.metricValue ? (
                      <View style={styles.highlightMetricPill}>
                        <Text style={styles.highlightMetricLabel}>{highlight.metricLabel}</Text>
                        <Text style={styles.highlightMetricValue}>{highlight.metricValue}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>

            <Text style={styles.forecastFooter}>
              Next snapshot around {formatTime(forecast.nextUpdate)} · Units: {unitsLabel}
            </Text>
          </View>
        ) : (
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderTitle}>Optimism loading…</Text>
            <Text style={styles.placeholderSubtitle}>
              Plug in any location and we will reframe the forecast with bright spots—from blue-sky windows to
              humidity perks.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 24,
  },
  header: {
    marginTop: 24,
    alignItems: 'center',
    gap: 8,
  },
  brand: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 4,
    color: '#0f172a',
    textTransform: 'uppercase',
  },
  tagline: {
    fontSize: 16,
    textAlign: 'center',
    color: '#334155',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 6,
    gap: 20,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardDescription: {
    fontSize: 14,
    color: '#475569',
  },
  formField: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 14, android: 10, default: 12 }),
    backgroundColor: '#f8fafc',
    fontSize: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#0f172a',
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#0f172a',
    backgroundColor: '#ffffff',
  },
  secondaryButtonText: {
    color: '#0f172a',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  toggleGroup: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    padding: 6,
  },
  toggleButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  toggleButtonSelected: {
    backgroundColor: '#ffffff',
  },
  toggleText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  toggleTextSelected: {
    color: '#0f172a',
  },
  quickPicksRow: {
    gap: 12,
  },
  quickPickLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  quickPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: '#f8fafc',
  },
  quickPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  historyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4,
    gap: 16,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#64748b',
  },
  historyCaption: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  historyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyManage: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: '#334155',
  },
  historyClear: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
  },
  historyList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyButton: {
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: 220,
    gap: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  historyButtonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  historyButtonSubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  historyDelete: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
  },
  historyDeleteText: {
    fontSize: 18,
    lineHeight: 18,
    color: '#b91c1c',
  },
  feedbackError: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    padding: 16,
  },
  feedbackText: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  feedbackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#bae6fd',
    backgroundColor: '#e0f2fe',
    padding: 16,
  },
  feedbackInfoText: {
    color: '#0369a1',
    fontSize: 14,
    fontWeight: '600',
  },
  forecastCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 24,
    gap: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 7,
  },
  forecastHeader: {
    gap: 6,
  },
  forecastTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  forecastSubtitle: {
    fontSize: 16,
    color: '#0ea5e9',
    fontWeight: '600',
  },
  temperatureTile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    padding: 20,
  },
  temperatureValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#0f172a',
  },
  temperatureFeelsLike: {
    fontSize: 14,
    color: '#475569',
    marginTop: 8,
  },
  tempExtremesLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  tempExtremeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  tempExtremeSpacer: {
    marginTop: 12,
  },
  highlightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  highlightCard: {
    position: 'relative',
    overflow: 'hidden',
    flexBasis: '48%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 6,
  },
  highlightCardBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(224, 242, 254, 0.55)',
  },
  highlightCardContent: {
    flex: 1,
    padding: 20,
    gap: 12,
  },
  highlightHeroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
  },
  highlightHeroValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  highlightHeroLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: '#64748b',
  },
  highlightBody: {
    gap: 6,
    flexGrow: 1,
  },
  highlightTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  highlightTakeaway: {
    fontSize: 13,
    color: '#1e293b',
  },
  highlightDetail: {
    fontSize: 12,
    color: '#64748b',
  },
  highlightMetricPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  highlightMetricLabel: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  highlightMetricValue: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '700',
  },
  forecastFooter: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'right',
  },
  placeholderCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    padding: 24,
    gap: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#cbd5f5',
  },
  placeholderTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  placeholderSubtitle: {
    fontSize: 14,
    color: '#475569',
  },
})

export default App
