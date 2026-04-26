import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useKnowledgeStore } from '@/stores/knowledgeStore'
import type { Article } from '@/api/modules'
import {
  buildKnowledgeSourceDigest,
  buildKnowledgeVariantReadingSuggestion,
  buildKnowledgeVariantFilterFeedback,
  buildKnowledgeVariantRecommendation,
  buildKnowledgeRepresentativeReason,
  buildKnowledgeVariantDifference,
  buildKnowledgeVariantPreview,
  buildKnowledgeReadingMeta,
  filterKnowledgeVariants,
  formatKnowledgeStageLabel,
  formatSourceLabel,
  getLocalizedFallbackTitle,
  groupKnowledgeArticles,
  isGenericForeignTitle,
  normalizePlainText,
  sortKnowledgeVariants,
} from '@/utils/knowledgeText'
import styles from './Knowledge.module.css'

const stageOptions = [
  { label: '全部阶段', value: '' },
  { label: '备孕期', value: 'preparation' },
  { label: '孕早期 (1-12周)', value: 'first-trimester' },
  { label: '孕中期 (13-27周)', value: 'second-trimester' },
  { label: '孕晚期 (28-40周)', value: 'third-trimester' },
  { label: '0-6月', value: '0-6-months' },
  { label: '6-12月', value: '6-12-months' },
  { label: '1-3岁', value: '1-3-years' },
]

const variantFilterOptions = [
  { label: '全部版本', value: 'all' },
  { label: '仅中文源', value: 'zh' },
  { label: '最近版本', value: 'latest' },
] as const

const variantSortOptions = [
  { label: '推荐顺序', value: 'recommended' },
  { label: '最近更新', value: 'recent' },
  { label: '中文优先', value: 'zhFirst' },
] as const

export function Knowledge() {
  const navigate = useNavigate()
  const {
    articles,
    categories,
    tags,
    total,
    page,
    loading,
    keyword,
    selectedCategory,
    selectedTag,
    selectedStage,
    fetchArticles,
    fetchCategories,
    fetchTags,
    setCategory,
    setTag,
    setStage,
    setKeyword,
    search,
    likeArticle,
    favoriteArticle,
  } = useKnowledgeStore()
  const [searchInput, setSearchInput] = useState(keyword)
  const [expandedVariantGroups, setExpandedVariantGroups] = useState<Record<string, boolean>>({})
  const [variantFilterModes, setVariantFilterModes] = useState<Record<string, 'all' | 'zh' | 'latest'>>({})
  const [variantSortModes, setVariantSortModes] = useState<Record<string, 'recommended' | 'recent' | 'zhFirst'>>({})

  useEffect(() => {
    fetchArticles({ reset: true })
    fetchCategories()
    fetchTags()
  }, [fetchArticles, fetchCategories, fetchTags])

  useEffect(() => {
    setSearchInput(keyword)
  }, [keyword])

  const handleSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextKeyword = searchInput.trim()
    if (nextKeyword) {
      await search(nextKeyword)
      return
    }

    setKeyword('')
    fetchArticles({ reset: true })
  }

  const handleSearchClear = () => {
    setSearchInput('')
    setKeyword('')
    fetchArticles({ reset: true })
  }

  const loadMore = () => {
    if (!loading && articles.length < total) {
      fetchArticles({ page: page + 1 })
    }
  }

  const goToDetail = (slug: string) => {
    navigate(`/knowledge/${slug}`)
  }

  const getDisplayTitle = (article: Article) => {
    if (!isGenericForeignTitle(article.title)) {
      return article.title
    }

    return getLocalizedFallbackTitle({
      topic: article.topic,
      stage: article.stage,
      categoryName: article.category?.name,
    })
  }

  const getDisplaySummary = (article: Article) => (
    normalizePlainText(article.summary)
    || '围绕当前阶段整理出的权威知识要点，可进入详情继续阅读来源与正文。'
  )

  const getDisplayDate = (article: Article) => {
    const value = article.sourceUpdatedAt || article.publishedAt || article.createdAt
    if (!value) return ''

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ''
    return parsed.toLocaleDateString('zh-CN')
  }

  const getReadingMeta = (article: Article) => buildKnowledgeReadingMeta(article)
  const displayedArticleGroups = useMemo(() => groupKnowledgeArticles(articles), [articles])
  const mergedArticleCount = useMemo(
    () => displayedArticleGroups.reduce((count, group) => count + group.mergedCount, 0),
    [displayedArticleGroups],
  )

  useEffect(() => {
    const validSlugs = new Set(displayedArticleGroups.map((group) => group.article.slug))
    setExpandedVariantGroups((current) => Object.fromEntries(
      Object.entries(current).filter(([slug, expanded]) => expanded && validSlugs.has(slug)),
    ))
    setVariantFilterModes((current) => Object.fromEntries(
      Object.entries(current).filter(([slug]) => validSlugs.has(slug)),
    ) as Record<string, 'all' | 'zh' | 'latest'>)
    setVariantSortModes((current) => Object.fromEntries(
      Object.entries(current).filter(([slug]) => validSlugs.has(slug)),
    ) as Record<string, 'recommended' | 'recent' | 'zhFirst'>)
  }, [displayedArticleGroups])

  const toggleVariantGroup = (slug: string) => {
    setExpandedVariantGroups((current) => ({
      ...current,
      [slug]: !current[slug],
    }))
  }

  const setVariantFilterMode = (slug: string, mode: 'all' | 'zh' | 'latest') => {
    setVariantFilterModes((current) => ({
      ...current,
      [slug]: mode,
    }))
  }

  const setVariantSortMode = (slug: string, mode: 'recommended' | 'recent' | 'zhFirst') => {
    setVariantSortModes((current) => ({
      ...current,
      [slug]: mode,
    }))
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Knowledge Index</span>
          <h1>知识库</h1>
          <p>浏览专业母婴知识，按阶段和主题快速找到更贴近当前处境的内容。</p>
        </div>
        <div className={styles.heroMeta}>
          <strong>{total || articles.length}</strong>
          <span>当前结果</span>
        </div>
      </section>

      <section className={styles.filterPanel}>
        <form className={styles.searchForm} onSubmit={handleSearchSubmit}>
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="搜索知识..."
            className={styles.searchInput}
          />
          {searchInput ? (
            <button type="button" className={styles.secondaryButton} onClick={handleSearchClear}>
              清空
            </button>
          ) : null}
          <button type="submit" className={styles.primaryButton}>
            搜索
          </button>
        </form>

        <div className={styles.filterGrid}>
          <label className={styles.filterField}>
            <span>分类</span>
            <select
              value={selectedCategory || ''}
              onChange={(event) => setCategory(event.target.value || null)}
            >
              <option value="">全部分类</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.filterField}>
            <span>阶段</span>
            <select
              value={selectedStage || ''}
              onChange={(event) => setStage(event.target.value || null)}
            >
              {stageOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {tags.length > 0 ? (
        <section className={styles.tagPanel}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Topics</span>
              <h2>热门标签</h2>
            </div>
            {selectedTag ? (
              <button type="button" className={styles.textButton} onClick={() => setTag(null)}>
                清除标签
              </button>
            ) : null}
          </div>
          <div className={styles.tagList}>
            {tags.slice(0, 12).map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={selectedTag === tag.slug ? `${styles.tagChip} ${styles.tagChipActive}` : styles.tagChip}
                onClick={() => setTag(selectedTag === tag.slug ? null : tag.slug)}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.listSection}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.eyebrow}>Results</span>
            <h2>知识内容</h2>
          </div>
          <span className={styles.resultMeta}>
            {displayedArticleGroups.length} / {total || displayedArticleGroups.length}
            {mergedArticleCount > 0 ? ` · 已合并 ${mergedArticleCount} 篇重复来源` : ''}
          </span>
        </div>

        {loading && displayedArticleGroups.length === 0 ? (
          <div className={styles.loadingState}>
            <span className={styles.loadingDot} />
            <span>正在加载知识内容...</span>
          </div>
        ) : displayedArticleGroups.length > 0 ? (
          <>
            <div className={styles.articleList}>
              {displayedArticleGroups.map((group) => {
                const article = group.article
                const groupKey = article.slug
                const isExpanded = Boolean(expandedVariantGroups[groupKey])
                const variantFilterMode = variantFilterModes[groupKey] || 'all'
                const variantSortMode = variantSortModes[groupKey] || 'recommended'
                const filteredVariants = filterKnowledgeVariants(article, group.variants, variantFilterMode)
                const visibleVariants = sortKnowledgeVariants(filteredVariants, variantSortMode)
                const variantSourceDigest = buildKnowledgeSourceDigest([article, ...visibleVariants])
                const variantReadingSuggestion = buildKnowledgeVariantReadingSuggestion([article, ...visibleVariants])
                const variantFilterFeedback = buildKnowledgeVariantFilterFeedback(article, group.variants, variantFilterMode)
                const variantRecommendation = buildKnowledgeVariantRecommendation(article, group.variants)
                const representativeReason = buildKnowledgeRepresentativeReason(article, group.variants)

                return (
                <article
                  key={groupKey}
                  className={styles.articleCard}
                  onClick={() => goToDetail(article.slug)}
                >
                  {article.coverImage ? (
                    <img
                      src={article.coverImage}
                      alt={article.title}
                      className={styles.articleImage}
                    />
                  ) : null}
                  <div className={styles.articleBody}>
                    <div className={styles.articleTagRow}>
                      {(article.sourceOrg || article.source) ? (
                        <span className={`${styles.metaTag} ${styles.metaTagSource}`}>
                          {formatSourceLabel(article.sourceOrg || article.source)}
                        </span>
                      ) : null}
                      {article.category ? (
                        <span className={styles.metaTag}>{article.category.name}</span>
                      ) : null}
                      {article.stage ? (
                        <span className={styles.metaTag}>{formatKnowledgeStageLabel(article.stage)}</span>
                      ) : null}
                      {article.tags?.slice(0, 3).map((tag) => (
                        <span key={tag.id} className={styles.metaTag}>
                          {tag.name}
                        </span>
                      ))}
                    </div>

                    <h3>{getDisplayTitle(article)}</h3>
                    <div className={styles.readingMetaRow}>
                      <span className={styles.readingMetaBadge}>{getReadingMeta(article).estimatedMinutesLabel}</span>
                      <span className={styles.readingMetaBadge}>{getReadingMeta(article).textLengthLabel}</span>
                      <span className={styles.readingMetaBadge}>{getReadingMeta(article).sectionLabel}</span>
                    </div>
                    <p className={styles.articleSummary}>{getDisplaySummary(article)}</p>
                    {representativeReason ? (
                      <div className={styles.representativeReason}>
                        <span className={styles.representativeReasonBadge}>{representativeReason.badge}</span>
                        <span className={styles.representativeReasonText}>{representativeReason.description}</span>
                      </div>
                    ) : null}
                    {group.mergedCount > 0 ? (
                      <div className={styles.variantPanel}>
                        <button
                          type="button"
                          className={styles.variantToggle}
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleVariantGroup(groupKey)
                          }}
                        >
                          {isExpanded ? '收起同源版本' : `还有 ${group.mergedCount} 个同源版本`}
                        </button>
                        {isExpanded ? (
                          <div className={styles.variantList}>
                            {variantRecommendation ? (
                              <div className={styles.variantRecommendation}>
                                <div className={styles.variantRecommendationCopy}>
                                  <span className={styles.variantRecommendationLabel}>{variantRecommendation.actionLabel}</span>
                                  <span className={styles.variantRecommendationText}>{variantRecommendation.description}</span>
                                </div>
                                <button
                                  type="button"
                                  className={styles.variantRecommendationButton}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    goToDetail(variantRecommendation.article.slug)
                                  }}
                                >
                                  直接查看
                                </button>
                              </div>
                            ) : null}
                            {group.variants.length > 1 ? (
                              <div className={styles.variantFilterRow}>
                                {variantFilterOptions.map((option) => (
                                  <button
                                    key={`${groupKey}-${option.value}`}
                                    type="button"
                                    className={variantFilterMode === option.value ? `${styles.variantFilterChip} ${styles.variantFilterChipActive}` : styles.variantFilterChip}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      setVariantFilterMode(groupKey, option.value)
                                    }}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                            {filteredVariants.length > 1 ? (
                              <div className={styles.variantSortRow}>
                                {variantSortOptions.map((option) => (
                                  <button
                                    key={`${groupKey}-sort-${option.value}`}
                                    type="button"
                                    className={variantSortMode === option.value ? `${styles.variantSortChip} ${styles.variantSortChipActive}` : styles.variantSortChip}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      setVariantSortMode(groupKey, option.value)
                                    }}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                            {variantFilterFeedback ? (
                              <div className={styles.variantFilterFeedback}>
                                <span className={styles.variantFilterFeedbackLabel}>{variantFilterFeedback.label}</span>
                                <span className={styles.variantFilterFeedbackText}>{variantFilterFeedback.description}</span>
                              </div>
                            ) : null}
                            <div className={styles.variantSourceDigest}>
                              <span className={styles.variantSourceDigestLabel}>{variantSourceDigest.summaryLabel}</span>
                              <span className={styles.variantSourceDigestText}>{variantSourceDigest.description}</span>
                            </div>
                            <div className={styles.variantReadingSuggestion}>
                              <span className={styles.variantReadingSuggestionLabel}>{variantReadingSuggestion.label}</span>
                              <span className={styles.variantReadingSuggestionText}>{variantReadingSuggestion.description}</span>
                            </div>
                            {visibleVariants.length > 0 ? visibleVariants.map((variant) => {
                              const variantDifference = buildKnowledgeVariantDifference(article, variant)
                              const variantPreview = buildKnowledgeVariantPreview(variant)

                              return (
                              <button
                                key={variant.slug}
                                type="button"
                                className={styles.variantItem}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  goToDetail(variant.slug)
                                }}
                              >
                                <span className={styles.variantTitle}>{getDisplayTitle(variant)}</span>
                                <span className={styles.variantMeta}>{variantPreview.sourceLabel}</span>
                                <span className={styles.variantHintRow}>
                                  {variantDifference.badges.map((badge) => (
                                    <span key={`${variant.slug}-hint-${badge}`} className={styles.variantHintBadge}>
                                      {badge}
                                    </span>
                                  ))}
                                </span>
                                <span className={styles.variantChipRow}>
                                  {variantPreview.chips.map((chip) => (
                                    <span key={`${variant.slug}-${chip}`} className={styles.variantChip}>
                                      {chip}
                                    </span>
                                  ))}
                                </span>
                              </button>
                              )
                            }) : (
                              <div className={styles.variantEmpty}>当前同源版本里没有符合筛选条件的结果。</div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className={styles.articleFooter}>
                      <div className={styles.articleStats}>
                        {getDisplayDate(article) ? <span>{getDisplayDate(article)}</span> : null}
                        <span>阅读 {article.viewCount}</span>
                        <span>点赞 {article.likeCount}</span>
                        <span>收藏 {article.collectCount}</span>
                      </div>

                      <div className={styles.articleActions}>
                        <button
                          type="button"
                          className={article.isLiked ? `${styles.iconButton} ${styles.iconButtonActive}` : styles.iconButton}
                          onClick={(event) => {
                            event.stopPropagation()
                            likeArticle(article.id)
                          }}
                        >
                          {article.isLiked ? '已点赞' : '点赞'}
                        </button>
                        <button
                          type="button"
                          className={article.isFavorited ? `${styles.iconButton} ${styles.iconButtonActive}` : styles.iconButton}
                          onClick={(event) => {
                            event.stopPropagation()
                            favoriteArticle(article.id)
                          }}
                        >
                          {article.isFavorited ? '已收藏' : '收藏'}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
                )
              })}
            </div>

            {articles.length < total ? (
              <div className={styles.loadMoreRow}>
                <button type="button" className={styles.primaryButton} onClick={loadMore} disabled={loading}>
                  {loading ? '加载中...' : `加载更多 (${articles.length}/${total})`}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className={styles.emptyState}>暂无相关内容</div>
        )}
      </section>
    </div>
  )
}
