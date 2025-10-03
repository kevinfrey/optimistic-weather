import type { SearchHistoryEntry } from '@/types/weather'

export const HISTORY_STORAGE_KEY = 'optimistic-weather-history-v1'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const getDefaultStorage = (): StorageLike | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }
  return window.localStorage
}

export const loadHistoryEntries = (
  storage: StorageLike | undefined = getDefaultStorage(),
): SearchHistoryEntry[] => {
  if (!storage) {
    return []
  }

  try {
    const raw = storage.getItem(HISTORY_STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as SearchHistoryEntry[]) : []
  } catch (error) {
    console.warn('Unable to parse stored history entries.', error)
    return []
  }
}

export const persistHistoryEntries = (
  entries: SearchHistoryEntry[],
  storage: StorageLike | undefined = getDefaultStorage(),
) => {
  if (!storage) {
    return
  }

  try {
    storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries))
  } catch (error) {
    console.warn('Unable to persist search history.', error)
  }
}

export const clearHistoryEntries = (
  storage: StorageLike | undefined = getDefaultStorage(),
) => {
  if (!storage) {
    return
  }

  try {
    storage.removeItem(HISTORY_STORAGE_KEY)
  } catch (error) {
    console.warn('Unable to clear search history.', error)
  }
}
