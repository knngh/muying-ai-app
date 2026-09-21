export type NameGender = 'boy' | 'girl' | 'neutral'

export interface NameLibraryItem {
  id: string
  givenName: string
  fullName: string
  gender: NameGender
  pinyin: string
  meaning: string
  source: string
  sourceQuote?: string
  contentOrigin: 'ai_assisted'
}

export interface NameLibraryQuery {
  surname?: string
  gender?: NameGender | 'all'
  nameLength?: 1 | 2
  avoid?: string
  page?: number
  pageSize?: number
}

export interface NameLibraryResponse {
  version: string
  disclosure: string
  list: NameLibraryItem[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}
