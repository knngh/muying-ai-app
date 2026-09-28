import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNamesStore, DEFAULT_NAMES_QUERY } from '@/stores/namesStore'
import {
  NAME_DISCLOSURE,
  nameCopyText,
  nameFavoriteKey,
  type NameGender,
  type NameLibraryItem,
} from '@/api/tools'
import styles from './Names.module.css'

const genderOptions: { value: NameGender | 'all'; label: string }[] = [
  { value: 'all', label: '不限' },
  { value: 'girl', label: '女孩' },
  { value: 'boy', label: '男孩' },
  { value: 'neutral', label: '中性' },
]

const genderLabels: Record<NameGender, string> = {
  girl: '女孩',
  boy: '男孩',
  neutral: '中性',
}

const genderTagClass: Record<NameGender, string> = {
  girl: styles.genderGirl,
  boy: styles.genderBoy,
  neutral: styles.genderNeutral,
}

const COPY_RESET_MS = 1500

export function Names() {
  const {
    query,
    response,
    favorites,
    view,
    loading,
    error,
    fetchList,
    loadFavorites,
    toggleFavorite,
    setView,
  } = useNamesStore()

  const [surname, setSurname] = useState(query.surname || '')
  const [gender, setGender] = useState<NameGender | 'all'>(query.gender || 'all')
  const [nameLength, setNameLength] = useState<1 | 2>(query.nameLength || 2)
  const [avoid, setAvoid] = useState(query.avoid || '')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const copyTimerRef = useRef<number | null>(null)

  useEffect(() => {
    loadFavorites()
    fetchList()
  }, [loadFavorites, fetchList])

  useEffect(() => () => {
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
  }, [])

  const favoriteKeys = useMemo(
    () => new Set(favorites.map((item) => nameFavoriteKey(item))),
    [favorites],
  )

  const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    fetchList({
      surname: surname.trim() || undefined,
      gender,
      nameLength,
      avoid: avoid.trim() || undefined,
      page: 1,
      pageSize: DEFAULT_NAMES_QUERY.pageSize,
    })
  }

  const handleCopy = (item: NameLibraryItem) => {
    const key = nameFavoriteKey(item)
    navigator.clipboard
      .writeText(nameCopyText(item))
      .then(() => {
        setCopiedKey(key)
        if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
        copyTimerRef.current = window.setTimeout(() => setCopiedKey(null), COPY_RESET_MS)
      })
      .catch(() => {
        setCopiedKey(null)
      })
  }

  const pagination = response?.pagination
  const currentPage = pagination?.page ?? 1
  const totalPages = Math.max(pagination?.totalPages ?? 1, 1)
  const total = pagination?.total ?? 0

  const changePage = (page: number) => {
    if (loading) return
    fetchList({ page })
  }

  const visibleList = view === 'favorites' ? favorites : response?.list ?? []

  const renderNameCard = (item: NameLibraryItem) => {
    const key = nameFavoriteKey(item)
    const isFavorite = favoriteKeys.has(key)
    const isCopied = copiedKey === key

    return (
      <article key={key} className={styles.nameCard}>
        <div className={styles.nameTopRow}>
          <div>
            <h3 className={styles.nameTitle}>{item.fullName}</h3>
            <p className={styles.namePinyin}>{item.pinyin}</p>
          </div>
          <span className={`${styles.genderTag} ${genderTagClass[item.gender]}`}>
            {genderLabels[item.gender]}
          </span>
        </div>

        <p className={styles.nameMeaning}>{item.meaning}</p>

        <div className={styles.nameSource}>
          <p className={styles.sourceText}>出处：{item.source}</p>
          {item.sourceQuote ? <p className={styles.sourceQuote}>{item.sourceQuote}</p> : null}
        </div>

        <div className={styles.cardActions}>
          <button
            type="button"
            className={isFavorite
              ? `${styles.favoriteButton} ${styles.favoriteButtonActive}`
              : styles.favoriteButton}
            onClick={() => toggleFavorite(item)}
          >
            {isFavorite ? '已收藏 ♥' : '收藏 ♥'}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={() => handleCopy(item)}>
            {isCopied ? '已复制' : '复制'}
          </button>
        </div>
      </article>
    )
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Names</span>
          <h1>宝宝起名</h1>
          <p>按姓氏、性别偏好和单双字筛选候选名，附拼音、寓意与经典出处，把心仪的名字收藏在本机慢慢挑选。</p>
        </div>
      </section>

      <div className={styles.disclosureBar}>{NAME_DISCLOSURE}</div>

      <section className={styles.filterCard}>
        <form className={styles.filterForm} onSubmit={handleFilterSubmit}>
          <div className={styles.filterGrid}>
            <label className={styles.filterField}>
              <span>姓氏</span>
              <input
                value={surname}
                maxLength={4}
                onChange={(event) => setSurname(event.target.value)}
                placeholder="例如：李（可空）"
              />
            </label>

            <label className={styles.filterField}>
              <span>性别偏好</span>
              <select
                value={gender}
                onChange={(event) => setGender(event.target.value as NameGender | 'all')}
              >
                {genderOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className={styles.filterField}>
              <span>避讳字</span>
              <input
                value={avoid}
                maxLength={30}
                onChange={(event) => setAvoid(event.target.value)}
                placeholder="想避开的名字用字（可空）"
              />
            </label>
          </div>

          <div className={styles.filterActions}>
            <div className={styles.lengthGroup}>
              <span className={styles.filterLabel}>单双字</span>
              <div className={styles.lengthToggles}>
                <button
                  type="button"
                  className={nameLength === 1
                    ? `${styles.secondaryButton} ${styles.buttonActive}`
                    : styles.secondaryButton}
                  onClick={() => setNameLength(1)}
                >
                  单字名
                </button>
                <button
                  type="button"
                  className={nameLength === 2
                    ? `${styles.secondaryButton} ${styles.buttonActive}`
                    : styles.secondaryButton}
                  onClick={() => setNameLength(2)}
                >
                  双字名
                </button>
              </div>
            </div>
            <button type="submit" className={styles.primaryButton} disabled={loading}>
              {loading ? '筛选中...' : '筛选'}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.listSection}>
        <div className={styles.listHeader}>
          <div>
            <span className={styles.eyebrow}>Library</span>
            <h2>{view === 'favorites' ? '我的收藏' : '候选名字'}</h2>
          </div>
          <div className={styles.viewTabs}>
            <button
              type="button"
              className={view === 'all'
                ? `${styles.secondaryButton} ${styles.buttonActive}`
                : styles.secondaryButton}
              onClick={() => setView('all')}
            >
              全部
            </button>
            <button
              type="button"
              className={view === 'favorites'
                ? `${styles.secondaryButton} ${styles.buttonActive}`
                : styles.secondaryButton}
              onClick={() => setView('favorites')}
            >
              收藏（{favorites.length}）
            </button>
          </div>
        </div>

        {error ? <div className={styles.errorBar}>{error}</div> : null}
        {view === 'all' && loading ? <div className={styles.loadingBar}>正在加载名字库...</div> : null}

        {visibleList.length > 0 ? (
          <div className={styles.nameGrid}>{visibleList.map(renderNameCard)}</div>
        ) : view === 'all' && loading ? null : (
          <div className={styles.emptyState}>
            {view === 'favorites'
              ? '还没有收藏的名字，在名字卡上点「收藏 ♥」保存心仪选项。'
              : '当前筛选条件下暂无名字，试试放宽条件。'}
          </div>
        )}

        {view === 'all' && response ? (
          <div className={styles.paginationRow}>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={loading || currentPage <= 1}
              onClick={() => changePage(currentPage - 1)}
            >
              上一页
            </button>
            <span className={styles.paginationMeta}>
              第 {currentPage}/{totalPages} 页 · 共 {total} 个名字
            </span>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={loading || currentPage >= totalPages}
              onClick={() => changePage(currentPage + 1)}
            >
              下一页
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
