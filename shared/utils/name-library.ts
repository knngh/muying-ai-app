import type { NameLibraryItem } from '../types/name-library'

// Device-local, deliberately separate from article favorites and account records.
export const NAME_FAVORITES_KEY = 'beihu.nameFavorites.v1'
export const MAX_NAME_FAVORITES = 100
export const NAME_DISCLOSURE = '名字释义由 AI 辅助整理，样本待人工复核；仅供文化参考，不提供重名统计或吉凶判断。'

export const nameFavoriteKey = (item: NameLibraryItem) => `${item.id}:${item.fullName}`

export function readNameFavorites(value: unknown): NameLibraryItem[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.filter((item): item is NameLibraryItem => {
    if (!item || typeof item !== 'object') return false
    const fields = ['id', 'givenName', 'fullName', 'pinyin', 'meaning', 'source']
    if (!fields.every(field => typeof item[field] === 'string' && item[field].length > 0 && item[field].length <= 500)) return false
    if (!['boy', 'girl', 'neutral'].includes(item.gender) || item.contentOrigin !== 'ai_assisted') return false
    if (item.sourceQuote !== undefined && (typeof item.sourceQuote !== 'string' || item.sourceQuote.length > 500)) return false
    const key = nameFavoriteKey(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, MAX_NAME_FAVORITES)
}

export function nameCopyText(item: NameLibraryItem): string {
  return [
    `${item.fullName}（名字读音：${item.pinyin}）`, item.meaning,
    `参考：${item.source}`, item.sourceQuote || '', NAME_DISCLOSURE,
  ].filter(Boolean).join('\n')
}
