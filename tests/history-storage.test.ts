import { describe, expect, it } from 'vitest'
import type { SearchHistoryEntry } from '@/types/weather'
import {
  HISTORY_STORAGE_KEY,
  clearHistoryEntries,
  loadHistoryEntries,
  persistHistoryEntries,
} from '@/lib/history-storage'

interface MemoryStore {
  data: Record<string, string>
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const createMemoryStorage = (): MemoryStore => ({
  data: {},
  getItem(key) {
    return key in this.data ? this.data[key] : null
  },
  setItem(key, value) {
    this.data[key] = value
  },
  removeItem(key) {
    delete this.data[key]
  },
})

describe('history storage helpers', () => {
  it('returns an empty array when storage is empty', () => {
    const storage = createMemoryStorage()
    expect(loadHistoryEntries(storage)).toEqual([])
  })

  it('ignores malformed JSON payloads', () => {
    const storage = createMemoryStorage()
    storage.setItem(HISTORY_STORAGE_KEY, '{ malformed')
    expect(loadHistoryEntries(storage)).toEqual([])
  })

  it('persists and retrieves search history entries', () => {
    const storage = createMemoryStorage()
    const entries: SearchHistoryEntry[] = [
      {
        id: '1',
        query: 'Seattle, WA',
        timestamp: 1,
        success: true,
        locationLabel: 'Seattle, WA, US',
      },
    ]

    persistHistoryEntries(entries, storage)
    expect(storage.getItem(HISTORY_STORAGE_KEY)).toBe(JSON.stringify(entries))
    expect(loadHistoryEntries(storage)).toEqual(entries)
  })

  it('clears entries from storage', () => {
    const storage = createMemoryStorage()
    storage.setItem(HISTORY_STORAGE_KEY, '[]')
    clearHistoryEntries(storage)
    expect(storage.getItem(HISTORY_STORAGE_KEY)).toBeNull()
  })
})
