import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { useKnowledgeStore } from '@/stores/knowledgeStore'
import {
  addArticleHeadingAnchors,
  buildKnowledgeReadingMeta,
  buildKnowledgeReadingPath,
  extractArticleOutline,
  formatKnowledgeStageLabel,
  formatRichArticleContent,
  formatSourceLabel,
  getLocalizedFallbackTitle,
  normalizeKnowledgeLabel,
  isGenericForeignTitle,
  normalizePlainText,
  sanitizeAuthoritySourceUrl,
  toReadableUrl,
} from '@/utils/knowledgeText'
import styles from './KnowledgeDetail.module.css'

export function KnowledgeDetail() {
  const { id: slug } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [toast, setToast] = useState('')
  const [scrollProgress, setScrollProgress] = useState(0)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const {
    currentArticle,
    loading,
    error,
    fetchArticleDetail,
    likeArticle,
    favoriteArticle,
  } = useKnowledgeStore()

  useEffect(() => {
    if (slug) {
      fetchArticleDetail(slug)
    }
  }, [fetchArticleDetail, slug])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 1800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const handleLike = async () => {
    if (!currentArticle) return
    await likeArticle(currentArticle.id)
    setToast(currentArticle.isLiked ? '已取消点赞' : '点赞成功')
  }

  const handleFavorite = async () => {
    if (!currentArticle) return
    await favoriteArticle(currentArticle.id)
    setToast(currentArticle.isFavorited ? '已取消收藏' : '收藏成功')
  }

  const goBack = () => {
    navigate('/knowledge')
  }

  const displayTitle = useMemo(() => {
    if (!currentArticle) return ''
    if (!isGenericForeignTitle(currentArticle.title)) {
      return currentArticle.title
    }

    return getLocalizedFallbackTitle({
      topic: currentArticle.topic,
      stage: currentArticle.stage,
      categoryName: currentArticle.category?.name,
    })
  }, [currentArticle])

  const summaryText = useMemo(() => (
    normalizePlainText(currentArticle?.summary)
    || '当前文章暂未提供摘要，可先查看正文和来源信息。'
  ), [currentArticle?.summary])

  const contentHtml = useMemo(() => {
    const rawContent = currentArticle?.content || currentArticle?.summary || ''
    return DOMPurify.sanitize(addArticleHeadingAnchors(formatRichArticleContent(rawContent)))
  }, [currentArticle?.content, currentArticle?.summary])
  const readingMeta = useMemo(() => buildKnowledgeReadingMeta(currentArticle), [currentArticle])

  useEffect(() => {
    const updateReadingProgress = () => {
      const root = document.documentElement
      const maxScroll = Math.max(root.scrollHeight - window.innerHeight, 0)
      const nextProgress = maxScroll > 0
        ? Math.min(100, Math.max(0, Math.round((window.scrollY / maxScroll) * 100)))
        : 100

      setScrollProgress(nextProgress)
      setShowBackToTop(window.scrollY > 360)
    }

    updateReadingProgress()
    window.addEventListener('scroll', updateReadingProgress, { passive: true })
    window.addEventListener('resize', updateReadingProgress)

    return () => {
      window.removeEventListener('scroll', updateReadingProgress)
      window.removeEventListener('resize', updateReadingProgress)
    }
  }, [contentHtml])
  const readingPath = useMemo(() => buildKnowledgeReadingPath(currentArticle), [currentArticle])
  const contentOutline = useMemo(() => {
    const rawContent = currentArticle?.content || currentArticle?.summary || ''
    return extractArticleOutline(rawContent)
  }, [currentArticle?.content, currentArticle?.summary])

  const displayDate = useMemo(() => {
    const value = currentArticle?.sourceUpdatedAt || currentArticle?.publishedAt || currentArticle?.createdAt
    if (!value) return ''

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ''
    return parsed.toLocaleDateString('zh-CN')
  }, [currentArticle?.createdAt, currentArticle?.publishedAt, currentArticle?.sourceUpdatedAt])

  const displaySourceUrl = useMemo(() => (
    sanitizeAuthoritySourceUrl(
      currentArticle?.sourceUrl,
      currentArticle?.sourceOrg || currentArticle?.source || '',
    )
  ), [currentArticle?.source, currentArticle?.sourceOrg, currentArticle?.sourceUrl])

  const handleJumpToSection = (sectionId: string) => {
    const target = document.getElementById(sectionId)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleBackToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <span className={styles.loadingDot} />
        <span>正在加载文章...</span>
      </div>
    )
  }

  if (error || !currentArticle) {
    return (
      <div className={styles.emptyState}>
        <h1>文章不存在或已删除</h1>
        <button type="button" className={styles.primaryButton} onClick={goBack}>
          返回列表
        </button>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.progressRail} aria-hidden="true">
        <span className={styles.progressFill} style={{ width: `${scrollProgress}%` }} />
      </div>
      {toast ? <div className={styles.toast}>{toast}</div> : null}

      <button type="button" className={styles.backButton} onClick={goBack}>
        返回列表
      </button>

      <article className={styles.articleCard}>
        <header className={styles.articleHeader}>
          <div className={styles.tagRow}>
            {(currentArticle.sourceOrg || currentArticle.source) ? (
              <span className={`${styles.metaTag} ${styles.metaTagSource}`}>
                {formatSourceLabel(currentArticle.sourceOrg || currentArticle.source)}
              </span>
            ) : null}
            {currentArticle.category ? (
              <span className={styles.metaTag}>{currentArticle.category.name}</span>
            ) : null}
            {currentArticle.stage ? (
              <span className={styles.metaTag}>{formatKnowledgeStageLabel(currentArticle.stage)}</span>
            ) : null}
            {currentArticle.topic ? (
              <span className={styles.metaTag}>{normalizeKnowledgeLabel(currentArticle.topic)}</span>
            ) : null}
            {currentArticle.tags?.map((tag) => (
              <span key={tag.id} className={styles.metaTag}>{tag.name}</span>
            ))}
          </div>

          <h1>{displayTitle}</h1>

          <div className={styles.metaRow}>
            {currentArticle.author ? <span>作者：{currentArticle.author}</span> : null}
            {displayDate ? <span>来源更新：{displayDate}</span> : null}
            <span>{currentArticle.viewCount} 阅读</span>
            <span>{currentArticle.likeCount} 点赞</span>
          </div>
        </header>

        {currentArticle.coverImage ? (
          <img
            src={currentArticle.coverImage}
            alt={currentArticle.title}
            className={styles.coverImage}
          />
        ) : null}

        <p className={styles.summary}>{summaryText}</p>

        <section className={styles.readingMetaCard}>
          <div className={styles.readingMetaHeader}>
            <span className={styles.readingMetaKicker}>阅读速览</span>
            <strong>{readingMeta.contentModeLabel}</strong>
          </div>
          <div className={styles.readingMetaGrid}>
            <div className={styles.readingMetaItem}>
              <span>建议阅读</span>
              <strong>{readingMeta.estimatedMinutesLabel}</strong>
            </div>
            <div className={styles.readingMetaItem}>
              <span>正文体量</span>
              <strong>{readingMeta.textLengthLabel}</strong>
            </div>
            <div className={styles.readingMetaItem}>
              <span>结构信息</span>
              <strong>{readingMeta.sectionLabel}</strong>
            </div>
          </div>
        </section>

        <section className={styles.readingPathCard}>
          <span className={styles.readingPathKicker}>{readingPath.kicker}</span>
          <h2 className={styles.readingPathTitle}>{readingPath.title}</h2>
          <p className={styles.readingPathDesc}>{readingPath.description}</p>
          <ol className={styles.readingPathList}>
            {readingPath.items.map((item) => (
              <li key={item.title} className={styles.readingPathItem}>
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </li>
            ))}
          </ol>
        </section>

        {contentOutline.length > 0 ? (
          <section className={styles.outlineCard}>
            <div className={styles.outlineHeader}>
              <span className={styles.outlineKicker}>正文目录</span>
              <strong>{contentOutline.length} 个章节</strong>
            </div>
            <div className={styles.outlineList}>
              {contentOutline.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.outlineItem} ${item.level === 3 ? styles.outlineItemSub : ''}`}
                  onClick={() => handleJumpToSection(item.id)}
                >
                  <span>{item.level === 1 ? '总览' : item.level === 2 ? '章节' : '要点'}</span>
                  <strong>{item.title}</strong>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <div
          className={`article-content ${styles.content}`}
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />

        {displaySourceUrl ? (
          <section className={styles.sourceBox}>
            <span>原始来源</span>
            <strong>{toReadableUrl(displaySourceUrl)}</strong>
            <a href={displaySourceUrl} target="_blank" rel="noreferrer">
              查看机构原文
            </a>
          </section>
        ) : null}

        <footer className={styles.actions}>
          <button
            type="button"
            className={currentArticle.isLiked ? `${styles.primaryButton} ${styles.activeButton}` : styles.primaryButton}
            onClick={handleLike}
          >
            {currentArticle.isLiked ? '已点赞' : '点赞'} ({currentArticle.likeCount})
          </button>
          <button
            type="button"
            className={currentArticle.isFavorited ? `${styles.secondaryButton} ${styles.activeButton}` : styles.secondaryButton}
            onClick={handleFavorite}
          >
            {currentArticle.isFavorited ? '已收藏' : '收藏'} ({currentArticle.collectCount})
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => {
              navigator.clipboard.writeText(window.location.href)
              setToast('链接已复制')
            }}
          >
            分享
          </button>
        </footer>
      </article>

      <div className={styles.floatingTools}>
        <div className={styles.progressBadge}>已阅读 {scrollProgress}%</div>
        {showBackToTop ? (
          <button type="button" className={styles.backTopButton} onClick={handleBackToTop}>
            回到顶部
          </button>
        ) : null}
      </div>
    </div>
  )
}
