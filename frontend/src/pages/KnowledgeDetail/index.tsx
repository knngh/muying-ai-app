import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { useKnowledgeStore } from '@/stores/knowledgeStore'
import { usePageTitle } from '@/hooks'
import { storage } from '@/utils/storage'
import {
  addArticleHeadingAnchors,
  buildKnowledgeReadingMeta,
  extractArticleOutline,
  formatKnowledgeStageLabel,
  formatRichArticleContent,
  formatSourceLabel,
  normalizeKnowledgeLabel,
  normalizePlainText,
  resolveKnowledgeDisplayContent,
  sanitizeAuthoritySourceUrl,
  toReadableUrl,
} from '@/utils/knowledgeText'
import styles from './KnowledgeDetail.module.css'

export function KnowledgeDetail() {
  const { id: slug } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
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
    const saved = await likeArticle(currentArticle.id)
    setToast(saved ? (currentArticle.isLiked ? '已取消点赞' : '点赞成功') : '点赞失败，请重试')
  }

  const handleFavorite = async () => {
    if (!currentArticle) return
    const saved = await favoriteArticle(currentArticle.id)
    setToast(saved ? (currentArticle.isFavorited ? '已取消收藏' : '收藏成功') : '收藏失败，请重试')
  }

  const goBack = () => {
    const query = location.state?.knowledgeSearch
    navigate(typeof query === 'string' && query ? `/knowledge?${query}` : '/knowledge')
  }

  const isLoggedIn = Boolean(storage.getItem('token'))

  const handleAskAi = () => {
    navigate(isLoggedIn ? '/chat' : '/login')
  }

  const displayContent = useMemo(() => resolveKnowledgeDisplayContent(currentArticle), [currentArticle])
  const displayTitle = displayContent.title
  const sourceLabel = formatSourceLabel(currentArticle?.sourceOrg || currentArticle?.source || '')
  const detailLabels = Array.from(new Set([
    currentArticle?.category?.name,
    currentArticle?.stage ? formatKnowledgeStageLabel(currentArticle.stage) : '',
    currentArticle?.topic ? normalizeKnowledgeLabel(currentArticle.topic) : '',
    ...(currentArticle?.tags?.map(tag => tag.name) || []),
  ].filter((label): label is string => Boolean(label?.trim()) && formatSourceLabel(label) !== sourceLabel)))
  usePageTitle(displayTitle || undefined)

  const summaryText = useMemo(() => (
    normalizePlainText(displayContent.summary)
    || '当前文章暂未提供摘要，可先查看正文和来源信息。'
  ), [displayContent.summary])

  const readingContent = currentArticle?.readingLayout?.verified
    ? currentArticle.readingLayout.html
    : displayContent.content || displayContent.summary || ''
  const contentHtml = useMemo(() => {
    const rawContent = readingContent
    return DOMPurify.sanitize(addArticleHeadingAnchors(formatRichArticleContent(rawContent)))
  }, [readingContent])
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
  const contentOutline = useMemo(() => {
    return extractArticleOutline(contentHtml)
  }, [contentHtml])

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

  const copyLink = async (url: string, message: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setToast(message)
    } catch {
      setToast('复制失败，请手动复制浏览器地址或原文链接')
    }
  }
  const handleCopySourceLink = () => {
    if (displaySourceUrl) void copyLink(displaySourceUrl, '来源链接已复制')
  }

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <span className={styles.loadingDot} />
        <span>正在加载文章...</span>
      </div>
    )
  }

  if (!currentArticle) {
    return (
      <div className={styles.emptyState}>
        <h1>{error ? '加载文章失败' : '文章不存在或已删除'}</h1>
        {error ? <p role="alert">{error}</p> : null}
        {error && slug ? <button type="button" className={styles.primaryButton} onClick={() => fetchArticleDetail(slug)}>重新加载</button> : null}
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
      {toast ? <div role="status" className={styles.toast}>{toast}</div> : null}

      <button type="button" className={styles.backButton} onClick={goBack}>
        返回列表
      </button>

      <article className={styles.articleCard}>
        <header className={styles.articleHeader}>
          <div className={styles.tagRow}>
            {(currentArticle.sourceOrg || currentArticle.source) ? (
              <span className={`${styles.metaTag} ${styles.metaTagSource}`}>
                {sourceLabel}
              </span>
            ) : null}
            {detailLabels.map(label => (
              <span key={label} className={styles.metaTag}>{label}</span>
            ))}
          </div>

          <h1>{displayTitle}</h1>

          <div className={styles.metaRow}>
            {currentArticle.author ? <span>作者：{currentArticle.author}</span> : null}
            {displayDate ? <span>{currentArticle.sourceUpdatedAt ? '来源日期' : '收录日期'}：{displayDate}</span> : null}
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

        <div className={styles.readingMetaCard}>
          <span>{readingMeta.estimatedMinutesLabel}</span>
          <span>{readingMeta.contentModeLabel}</span>
          {currentArticle.sourceLanguage ? <span>{currentArticle.sourceLanguage === 'zh' ? '中文原文' : '英文原文'}</span> : null}
          {displaySourceUrl ? <a href={displaySourceUrl} target="_blank" rel="noopener noreferrer">阅读原文</a> : null}
        </div>

        {contentOutline.length > 0 ? (
          <details className={styles.outlineCard} key={slug}>
            <summary className={styles.outlineHeader}>
              <span className={styles.outlineKicker}>正文目录</span>
              <strong>{contentOutline.length} 个章节</strong>
            </summary>
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
          </details>
        ) : null}

        <div
          className={`article-content ${styles.content}`}
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />

        <section className={styles.askAiCard}>
          <div className={styles.askAiCopy}>
            <span className={styles.askAiKicker}>AI 育儿顾问</span>
            <p className={styles.askAiDesc}>
              {isLoggedIn
                ? '宝宝的情况和这篇文章不完全一样？把具体疑问告诉 AI 顾问，获得结合权威资料的个性化解答。'
                : '注册后免费向 AI 育儿顾问提问，每天 3 次，解答基于 WHO、美国儿科学会、英国 NHS 等权威资料。'}
            </p>
          </div>
          <button type="button" className={styles.askAiButton} onClick={handleAskAi}>
            {isLoggedIn ? '去提问' : '免费注册提问'}
          </button>
        </section>

        {displaySourceUrl ? (
          <section className={styles.sourceBox}>
            <span>原始来源</span>
            <a href={displaySourceUrl} target="_blank" rel="noopener noreferrer">打开原始来源 <span aria-hidden="true">↗</span></a>
            <strong>{toReadableUrl(displaySourceUrl)}</strong>
            <button type="button" onClick={handleCopySourceLink}>
              复制来源链接
            </button>
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
              void copyLink(window.location.href, '链接已复制')
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
