import { useEffect, useRef, useState } from 'react'
import api from '@/api'
import type { NameLibraryItem, NameLibraryQuery, NameLibraryResponse } from '../../../../shared/types/name-library'
import { MAX_NAME_FAVORITES, NAME_DISCLOSURE, NAME_FAVORITES_KEY, nameCopyText, nameFavoriteKey, readNameFavorites } from '../../../../shared/utils/name-library'
import styles from './Names.module.css'

const initialFilters: NameLibraryQuery = { surname: '', gender: 'all', nameLength: 2, avoid: '' }
const genderLabels = { boy: '男孩', girl: '女孩', neutral: '中性' }

export function Names() {
  const [filters, setFilters] = useState(initialFilters)
  const appliedFilters = useRef(initialFilters)
  const requestId = useRef(0)
  const [result, setResult] = useState<NameLibraryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const failedAppend = useRef(false)
  const [notice, setNotice] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [favorites, setFavorites] = useState<NameLibraryItem[]>(() => {
    try { return readNameFavorites(JSON.parse(localStorage.getItem(NAME_FAVORITES_KEY) || '[]')) } catch { return [] }
  })

  async function search(query: NameLibraryQuery, page = 1) {
    const id = ++requestId.current
    setLoading(true)
    setError('')
    if (page === 1) setResult(null)
    try {
      const response = await api.get<NameLibraryResponse>('/names', { params: { ...query, page, pageSize: 12 } })
      if (id !== requestId.current) return
      setResult(previous => ({ ...response, list: page === 1 ? response.list : [...(previous?.list || []), ...response.list] }))
    } catch (failure) {
      if (id !== requestId.current) return
      failedAppend.current = page > 1
      setError(failure instanceof Error ? failure.message : '加载失败，请重试')
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }

  useEffect(() => {
    void search(initialFilters)
    return () => { requestId.current += 1 }
  }, [])

  const isFavorite = (item: NameLibraryItem) => favorites.some(saved => nameFavoriteKey(saved) === nameFavoriteKey(item))
  const toggleFavorite = (item: NameLibraryItem) => {
    if (!isFavorite(item) && favorites.length >= MAX_NAME_FAVORITES) {
      setNotice('最多收藏 100 个名字，请先移除一些')
      return
    }
    const next = isFavorite(item) ? favorites.filter(saved => nameFavoriteKey(saved) !== nameFavoriteKey(item)) : [...favorites, item]
    try {
      localStorage.setItem(NAME_FAVORITES_KEY, JSON.stringify(next))
      setFavorites(next)
      setNotice(isFavorite(item) ? '已取消收藏' : '已保存到本机收藏')
    } catch { setNotice('本机存储失败，请重试') }
  }
  const copyName = async (item: NameLibraryItem) => {
    try {
      await navigator.clipboard.writeText(nameCopyText(item))
      setNotice('已复制候选名，可发给家人讨论')
    } catch { setNotice('复制失败，请检查浏览器剪贴板权限') }
  }
  const visibleNames = favoritesOnly ? favorites : result?.list || []
  const nextPage = (result?.pagination.page || 0) + 1
  const hasMore = result && result.pagination.page < result.pagination.totalPages

  return <div className={styles.page}>
    <header>
      <span className={styles.eyebrow}>起名灵感 · 预览</span>
      <h1>给宝宝挑一个喜欢的名字</h1>
      <p>从名字的读音与含义出发，收藏心仪的候选名。</p>
      <p className={styles.disclosure}>{NAME_DISCLOSURE}</p>
    </header>
    <form className={styles.filters} onSubmit={event => {
      event.preventDefault()
      appliedFilters.current = { ...filters }
      setFavoritesOnly(false)
      void search(appliedFilters.current)
    }}>
      <label>姓氏<input value={filters.surname} maxLength={4} placeholder="可留空" onChange={event => setFilters({ ...filters, surname: event.target.value })} /></label>
      <label>性别偏好<select value={filters.gender} onChange={event => setFilters({ ...filters, gender: event.target.value as NameLibraryQuery['gender'] })}>
        <option value="all">不限性别</option><option value="girl">女孩</option><option value="boy">男孩</option><option value="neutral">中性</option>
      </select></label>
      <label>字数（不含姓氏）<select value={filters.nameLength} onChange={event => setFilters({ ...filters, nameLength: Number(event.target.value) as 1 | 2 })}>
        <option value={2}>双字名</option><option value={1}>单字名</option>
      </select></label>
      <label>避讳字<input value={filters.avoid} maxLength={30} placeholder="如：安、宁" onChange={event => setFilters({ ...filters, avoid: event.target.value })} /></label>
      <button type="submit">筛选</button>
      <p className={styles.hint}>性别偏好仅为风格标签；读音仅标注名字部分。</p>
    </form>
    <div className={styles.resultHead}>
      <h2>{favoritesOnly ? `本机收藏 (${favorites.length})` : result ? `候选名字 · 共 ${result.pagination.total} 个` : '候选名字'}</h2>
      <button type="button" onClick={() => setFavoritesOnly(!favoritesOnly)}>{favoritesOnly ? '返回结果' : `收藏 (${favorites.length})`}</button>
    </div>
    {favoritesOnly && <p className={styles.hint}>收藏保存在当前浏览器，复制候选名后可自行发给家人讨论。</p>}
    <p className={styles.notice} role="status">{notice}</p>
    {!favoritesOnly && error && <div role="alert" className={styles.state}>{error} <button type="button" disabled={loading} onClick={() => void search(appliedFilters.current, failedAppend.current ? nextPage : 1)}>重试</button></div>}
    {!favoritesOnly && loading && <p role="status">正在加载名字资料…</p>}
    {!visibleNames.length && (favoritesOnly || (!loading && !error)) && <p className={styles.state}>{favoritesOnly ? '还没有收藏，点击名字下方的收藏按钮即可保存。' : '没有符合条件的名字，试试减少避讳字或放宽偏好。'}</p>}
    <div className={styles.results} aria-busy={loading}>
      {visibleNames.map(item => <article key={nameFavoriteKey(item)} className={styles.card}>
        <h3>{item.fullName}</h3><span>{item.pinyin}</span>
        <div className={styles.tags}>{genderLabels[item.gender]} · AI 辅助整理</div>
        <p>{item.meaning}</p><p className={styles.hint}>参考：{item.source}</p>
        {item.sourceQuote && <p className={styles.hint}>原句：{item.sourceQuote}</p>}
        <div className={styles.actions}>
          <button type="button" aria-pressed={isFavorite(item)} onClick={() => toggleFavorite(item)}>{isFavorite(item) ? '取消收藏' : '收藏'}</button>
          <button type="button" onClick={() => void copyName(item)}>复制候选名</button>
        </div>
      </article>)}
    </div>
    {!favoritesOnly && hasMore && <button className={styles.more} type="button" disabled={loading} onClick={() => void search(appliedFilters.current, nextPage)}>{loading ? '加载中…' : '加载更多'}</button>}
  </div>
}
