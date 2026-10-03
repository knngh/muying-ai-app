import { create } from 'zustand'
import {
  MAX_NAME_FAVORITES,
  NAME_FAVORITES_KEY,
  nameFavoriteKey,
  namesApi,
  readNameFavorites,
  type NameLibraryItem,
  type NameLibraryQuery,
  type NameLibraryResponse,
} from '@/api/tools'
import { storage } from '@/utils/storage'
import { useAppStore } from './appStore'

function favoritesStorageKey() {
  return `${NAME_FAVORITES_KEY}:${useAppStore.getState().user?.id || 'guest'}`
}

export type NamesView = 'all' | 'favorites'

export const DEFAULT_NAMES_QUERY: NameLibraryQuery = {
  gender: 'all',
  nameLength: 2,
  page: 1,
  pageSize: 12,
}

interface NamesState {
  query: NameLibraryQuery
  response: NameLibraryResponse | null
  favorites: NameLibraryItem[]
  view: NamesView
  loading: boolean
  error: string | null
  fetchList: (query?: NameLibraryQuery) => Promise<void>
  loadFavorites: () => void
  toggleFavorite: (item: NameLibraryItem) => void
  setView: (view: NamesView) => void
}

// localStorage 只经 SafeStorage；JSON.parse / 结构异常都兜底为空数组
function readStoredFavorites(): NameLibraryItem[] {
  const raw = storage.getItem(favoritesStorageKey())
  if (!raw) return []
  try {
    return readNameFavorites(JSON.parse(raw))
  } catch {
    return []
  }
}

export const useNamesStore = create<NamesState>((set, get) => ({
  query: { ...DEFAULT_NAMES_QUERY },
  response: null,
  favorites: [],
  view: 'all',
  loading: false,
  error: null,

  fetchList: async (query) => {
    const nextQuery = { ...get().query, ...query }
    set({ loading: true, error: null })
    try {
      const response = await namesApi.getList(nextQuery)
      set({ response, query: nextQuery, loading: false })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '获取名字列表失败', loading: false })
    }
  },

  loadFavorites: () => {
    set({ favorites: readStoredFavorites() })
  },

  toggleFavorite: (item) => {
    const { favorites } = get()
    const key = nameFavoriteKey(item)
    const exists = favorites.some((favorite) => nameFavoriteKey(favorite) === key)

    if (exists) {
      const next = favorites.filter((favorite) => nameFavoriteKey(favorite) !== key)
      storage.setItem(favoritesStorageKey(), JSON.stringify(next))
      set({ favorites: next, error: null })
      return
    }

    if (favorites.length >= MAX_NAME_FAVORITES) {
      set({ error: `收藏已满（上限 ${MAX_NAME_FAVORITES} 个）` })
      return
    }

    const next = [...favorites, item]
    storage.setItem(favoritesStorageKey(), JSON.stringify(next))
    set({ favorites: next, error: null })
  },

  setView: (view) => {
    set({ view })
  },
}))
