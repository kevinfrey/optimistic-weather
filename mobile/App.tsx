import { useEffect, useMemo, useRef, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import * as Location from 'expo-location'
import { LinearGradient } from 'expo-linear-gradient'
import MaskedView from '@react-native-masked-view/masked-view'

import type {
  Coordinates,
  OptimisticForecast,
  OptimisticHighlight,
  LocationSuggestion,
  SearchHistoryEntry,
} from './src/types/weather'
import {
  fetchOptimisticForecast,
  reverseGeocode,
  searchLocationSuggestions,
  formatUsLocationLabel,
} from './src/services/openWeather'
import {
  clearHistoryEntries,
  loadHistoryEntries,
  persistHistoryEntries,
} from './src/storage/history'

const HISTORY_LIMIT = 8

type Units = 'metric' | 'imperial'

const GRADIENT_COLORS = ['#ff6ec7', '#ffdd55', '#32fff0']

const GradientText = ({ text, style }: { text: string; style: TextStyle }) => (
  <MaskedView maskElement={<Text style={[style, styles.gradientMask]}>{text}</Text>}>
    <LinearGradient
      colors={GRADIENT_COLORS}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.gradientContainer}
    >
      <Text style={[style, styles.gradientFill]}>{text}</Text>
    </LinearGradient>
  </MaskedView>
)

const formatTemperature = (value: number, units: Units) => {
  const rounded = Math.round(value)
  return `${rounded}${units === 'metric' ? '°C' : '°F'}`
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

const createHistoryId = () => `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`

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
  const [searchVisible, setSearchVisible] = useState(false)
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null)
  const autoLocateAttemptedRef = useRef(false)
  const suggestionRequestIdRef = useRef(0)

  const highlightIconMap = useMemo<Record<string, string>>(
    () => ({
      dryness: '☀️',
      refresh: '🌧️',
      clouds: '😎',
      'feels-like': '🧥',
      cooler: '🧣',
      warmer: '🔥',
      humidity: '💧',
      hydration: '💧',
      visibility: '🔭',
      'cozy-views': '🌫️',
      breeze: '🍃',
      'wind-energy': '🌬️',
    }),
    [],
  )

  const highlightCards = useMemo(
    () => (forecast ? forecast.highlights.filter((highlight) => highlightIconMap[highlight.id]) : []),
    [forecast, highlightIconMap],
  )

  useEffect(() => {
    void (async () => {
      const entries = await loadHistoryEntries()
      setHistory(entries)
    })()
  }, [])

  useEffect(() => {
    void persistHistoryEntries(history)
  }, [history])

  useEffect(() => {
    if (autoLocateAttemptedRef.current) {
      return
    }
    autoLocateAttemptedRef.current = true
    void handleUseLocation()
  }, [])

  useEffect(() => {
    if (!loading && !forecast && (error || geoError)) {
      setSearchVisible(true)
    }
  }, [loading, forecast, error, geoError])

  useEffect(() => {
    if (!searchVisible) {
      setSuggestions([])
      setSuggestionsError(null)
      setSuggestionsLoading(false)
      return
    }

    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setSuggestions([])
      setSuggestionsError(null)
      setSuggestionsLoading(false)
      return
    }

    const requestId = suggestionRequestIdRef.current + 1
    suggestionRequestIdRef.current = requestId
    setSuggestionsLoading(true)
    setSuggestionsError(null)

    const timeoutId = setTimeout(() => {
      void searchLocationSuggestions(trimmed)
        .then((results) => {
          if (suggestionRequestIdRef.current !== requestId) {
            return
          }
          setSuggestions(results)
          if (!results.length) {
            setSuggestionsError(`No matches found for "${trimmed}".`)
          }
        })
        .catch((err) => {
          if (suggestionRequestIdRef.current !== requestId) {
            return
          }
          const message = err instanceof Error ? err.message : 'Unable to suggest locations right now.'
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
      clearTimeout(timeoutId)
    }
  }, [query, searchVisible])

  useEffect(() => {
    if (autoLocateAttemptedRef.current) {
      return
    }
    autoLocateAttemptedRef.current = true
    void handleUseLocation()
  }, [])

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
      setQuery(searchQuery)
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
      setSearchVisible(true)
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

  const handleSuggestionSelect = (suggestion: LocationSuggestion) => {
    setQuery(suggestion.searchValue)
    setSearchVisible(false)
    setSuggestions([])
    setSuggestionsError(null)
    setSuggestionsLoading(false)
    void runSearch(suggestion.searchValue, units)
  }

  const renderHighlightCard = (highlight: OptimisticHighlight) => {
    const icon = highlightIconMap[highlight.id] ?? '✨'
    const metricText = [highlight.metricLabel, highlight.metricValue].filter(Boolean).join(' · ')

    return (
      <View key={highlight.id} style={styles.highlightCard}>
        <View style={styles.highlightHeaderRow}>
          <View style={styles.highlightIconBubble}>
            <Text style={styles.highlightIcon}>{icon}</Text>
          </View>
          <View style={styles.highlightHeaderTexts}>
            <Text style={styles.highlightTitle}>{highlight.title}</Text>
            {highlight.heroStatValue ? (
              <Text style={styles.highlightHeroValue}>{highlight.heroStatValue}</Text>
            ) : null}
            {highlight.heroStatLabel ? (
              <Text style={styles.highlightHeroLabel}>{highlight.heroStatLabel}</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.highlightBodyText}>
          <Text style={styles.highlightTakeaway}>{highlight.takeaway}</Text>
        </View>
        {metricText ? (
          <Text style={styles.highlightFooter}>{metricText}</Text>
        ) : null}
      </View>
    )
  }

  const renderHourlySection = () => {
    const hours = forecast?.hourlyOutlook ?? []
    if (!hours.length) {
      return null
    }

    const temps = hours.map((hour) => hour.temperature)
    const minTemp = Math.min(...temps)
    const maxTemp = Math.max(...temps)
    const tempRange = Math.max(maxTemp - minTemp, 1)

    return (
      <View style={styles.hourlySection}>
        <Text style={styles.sectionLabel}>Next few hours</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hourlyScrollContent}
        >
          {hours.map((hour) => {
            const normalized = (hour.temperature - minTemp) / tempRange
            const barHeight = 40 + normalized * 80
            const label = hour.time.toLocaleTimeString([], { hour: 'numeric' })

            return (
              <View key={hour.id} style={styles.hourlyColumn}>
                <Text style={styles.hourlyTemp}>{Math.round(hour.temperature)}°</Text>
                <View style={[styles.hourlyBar, { height: barHeight }]} />
                <Text style={styles.hourlyLabel}>{label}</Text>
              </View>
            )
          })}
        </ScrollView>
      </View>
    )
  }

  const runCoordsSearch = async (coords: Coordinates, labelHint?: string) => {
    setLoading(true)
    setError(null)
    setGeoError(null)

    try {
      const place = await reverseGeocode(coords)
      const queryLabel = labelHint ?? formatUsLocationLabel(place)

      const data = await fetchOptimisticForecast(queryLabel, units)
      setForecast(data)
      setLastQuery(queryLabel)
      setQuery(queryLabel)
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
      setSearchVisible(true)
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
        setSearchVisible(true)
        return
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Platform.OS === 'ios' ? Location.Accuracy.High : Location.Accuracy.Balanced,
      })
      setSearchVisible(false)
      void runCoordsSearch({ lat: position.coords.latitude, lon: position.coords.longitude })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to determine your location.'
      setGeoError(message)
      setLoading(false)
      setSearchVisible(true)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.brandLockup}>
            <GradientText text="Bright" style={styles.brandWord} />
            <GradientText text="Side" style={styles.brandWord} />
          </View>
          <GradientText text="Weather" style={styles.brandTag} />
        </View>

        {(searchVisible || !forecast) && (
          <View style={styles.card}>
            <View style={styles.searchHeaderRow}>
              <Text style={styles.cardTitle}>Find the bright side</Text>
              {forecast ? (
                <TouchableOpacity onPress={() => setSearchVisible(false)}>
                  <Text style={styles.dismissSearch}>Hide</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.cardDescription}>
              Drop in any city, zip code, or landmark and we will surface the upbeat bits.
            </Text>

            <View style={styles.formField}>
              <Text style={styles.label}>Where should we look?</Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="e.g. Louisville, KY or 40299"
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

            {(suggestionsLoading || suggestions.length > 0 || suggestionsError) && (
              <View style={styles.suggestionsContainer}>
                {suggestionsLoading ? (
                  <View style={styles.suggestionRow}>
                    <ActivityIndicator size="small" color="#0f172a" />
                    <Text style={styles.suggestionLoading}>Looking for matches…</Text>
                  </View>
                ) : suggestions.length > 0 ? (
                  suggestions.map((suggestion) => (
                    <TouchableOpacity
                      key={`${suggestion.location.lat}:${suggestion.location.lon}`}
                      style={styles.suggestionItem}
                      onPress={() => handleSuggestionSelect(suggestion)}
                      disabled={loading}
                    >
                      <Text style={styles.suggestionPrimary}>{suggestion.searchValue}</Text>
                      <Text style={styles.suggestionSecondary}>Tap to search</Text>
                    </TouchableOpacity>
                  ))
                ) : suggestionsError ? (
                  <Text style={styles.suggestionError}>{suggestionsError}</Text>
                ) : null}
              </View>
            )}
          </View>
        )}

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
            <View style={styles.forecastHeaderRow}>
              <View style={styles.forecastHeader}>
                <Text style={styles.forecastTitle}>{forecast.locationLabel}</Text>
                <Text style={styles.forecastSubtitle}>{forecast.skySummary}</Text>
              </View>
              <TouchableOpacity
                style={styles.changeButton}
                onPress={() => setSearchVisible(true)}
                disabled={loading}
              >
                <Text style={styles.changeButtonText}>Change</Text>
              </TouchableOpacity>
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

            {renderHourlySection()}

            {highlightCards.length ? (
              <View style={styles.highlightSection}>
                {highlightCards.map(renderHighlightCard)}
              </View>
            ) : null}

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
    gap: 4,
  },
  brandLockup: {
    flexDirection: 'row',
    gap: 6,
  },
  brandWord: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: '#ffffff',
  },
  brandTag: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 8,
    textTransform: 'uppercase',
    color: '#ffffff',
  },
  gradientMask: {
    color: '#000',
    backgroundColor: 'transparent',
  },
  gradientContainer: {
    paddingHorizontal: 4,
  },
  gradientFill: {
    opacity: 0,
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
  searchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dismissSearch: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
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
  suggestionsContainer: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  suggestionLoading: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 4,
  },
  suggestionPrimary: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  suggestionSecondary: {
    fontSize: 12,
    color: '#64748b',
  },
  suggestionError: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 13,
    color: '#b91c1c',
    fontWeight: '600',
  },
  hourlySection: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#475569',
  },
  hourlyScrollContent: {
    paddingVertical: 6,
    paddingRight: 16,
    flexDirection: 'row',
    gap: 14,
  },
  hourlyColumn: {
    width: 48,
    alignItems: 'center',
    gap: 6,
  },
  hourlyTemp: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  hourlyBar: {
    width: 16,
    borderRadius: 10,
    backgroundColor: '#fb923c',
  },
  hourlyLabel: {
    fontSize: 12,
    color: '#64748b',
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
  forecastHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  forecastHeader: {
    gap: 6,
    flex: 1,
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
  changeButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2563eb',
    backgroundColor: '#e0f2fe',
  },
  changeButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1d4ed8',
    letterSpacing: 1,
    textTransform: 'uppercase',
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
  highlightSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  highlightCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4,
    flexBasis: '48%',
    flexGrow: 1,
    gap: 12,
  },
  highlightHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  highlightIconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0f2fe',
  },
  highlightIcon: {
    fontSize: 20,
  },
  highlightHeaderTexts: {
    flex: 1,
    gap: 2,
  },
  highlightTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  highlightHeroValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  highlightHeroLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  highlightBodyText: {
    flexGrow: 1,
  },
  highlightTakeaway: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  highlightFooter: {
    marginTop: 'auto',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#64748b',
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
