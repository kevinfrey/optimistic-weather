import AsyncStorage from '@react-native-async-storage/async-storage'
import type { SearchHistoryEntry } from '../types/weather'

const HISTORY_KEY = 'optimistic-weather-history-v1'

export const loadHistoryEntries = async (): Promise<SearchHistoryEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as SearchHistoryEntry[]
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
  } catch (error) {
    console.warn('Failed to load history', error)
    return []
  }
}

export const persistHistoryEntries = async (entries: SearchHistoryEntry[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
  } catch (error) {
    console.warn('Failed to persist history', error)
  }
}

export const clearHistoryEntries = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY)
  } catch (error) {
    console.warn('Failed to clear history', error)
  }
}
