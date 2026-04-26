import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { articleApi } from '@/api/modules'
import type { Article } from '@/api/modules'
import styles from './Home.module.css'

const featureCards = [
  {
    badge: 'AI',
    title: 'AI智能问答',
    description: '快速获得结构化建议、常见问题解法和下一步行动提示。',
    path: '/chat',
  },
  {
    badge: 'CAL',
    title: '孕育日历',
    description: '把产检、提醒和关键节点整理成连续时间线。',
    path: '/calendar',
  },
  {
    badge: 'MED',
    title: '科学指导',
    description: '优先查看权威来源整理过的知识与阶段化内容。',
    path: '/knowledge',
  },
]

const quickLinks = [
  { label: '孕早期', detail: '1-12周', path: '/knowledge?stage=first-trimester' },
  { label: '孕中期', detail: '13-27周', path: '/knowledge?stage=second-trimester' },
  { label: '孕晚期', detail: '28-40周', path: '/knowledge?stage=third-trimester' },
  { label: '产检日历', detail: '查看日程', path: '/calendar' },
]

export function Home() {
  const navigate = useNavigate()
  const [recommendedArticles, setRecommendedArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchRecommended()
  }, [])

  const fetchRecommended = async () => {
    setLoading(true)
    try {
      const response = await articleApi.getList({ pageSize: 5, sort: 'recommended' })
      const result = response as unknown as { list: Article[] }
      setRecommendedArticles(result.list || [])
    } catch (error) {
      console.error('获取推荐文章失败:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.heroEyebrow}>Mother & Baby Intelligence</span>
          <h1 className={styles.heroTitle}>欢迎使用母婴AI助手</h1>
          <p className={styles.heroDescription}>
            用一个更清晰的入口，串起孕期提问、权威知识、日历记录和阶段化内容。
          </p>
          <div className={styles.heroActions}>
            <button type="button" className={styles.primaryButton} onClick={() => navigate('/chat')}>
              开始咨询
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => navigate('/knowledge')}>
              浏览知识库
            </button>
          </div>
        </div>
        <div className={styles.heroPanel}>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>入口聚合</span>
            <strong>问答 / 知识 / 日历</strong>
            <p>减少页面跳转成本，把高频操作尽量收束到同一条使用路径。</p>
          </div>
          <div className={styles.metricGrid}>
            <div>
              <span>Focus</span>
              <strong>阶段化阅读</strong>
            </div>
            <div>
              <span>Source</span>
              <strong>权威机构内容</strong>
            </div>
            <div>
              <span>Flow</span>
              <strong>从阅读到记录</strong>
            </div>
            <div>
              <span>Mode</span>
              <strong>桌面与移动兼容</strong>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionEyebrow}>Core Features</span>
            <h2>高频能力入口</h2>
          </div>
        </div>
        <div className={styles.featureGrid}>
          {featureCards.map((feature) => (
            <button
              key={feature.title}
              type="button"
              className={styles.featureCard}
              onClick={() => navigate(feature.path)}
            >
              <span className={styles.featureBadge}>{feature.badge}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionEyebrow}>Reading Queue</span>
            <h2>推荐阅读</h2>
          </div>
          <button
            type="button"
            className={styles.textButton}
            onClick={() => navigate('/knowledge')}
          >
            查看更多
          </button>
        </div>
        <div className={styles.articlePanel}>
          {loading ? (
            <div className={styles.loadingState}>
              <span className={styles.loadingDot} />
              <span>正在加载推荐内容</span>
            </div>
          ) : recommendedArticles.length > 0 ? (
            recommendedArticles.map((article) => (
              <button
                key={article.slug}
                type="button"
                className={styles.articleItem}
                onClick={() => navigate(`/knowledge/${article.slug}`)}
              >
                <div className={styles.articleTitleRow}>
                  <h3>{article.title}</h3>
                  {article.category?.name ? (
                    <span className={styles.categoryTag}>{article.category.name}</span>
                  ) : null}
                </div>
                <p>{article.summary || '当前文章暂未提供摘要，可进入详情查看。'}</p>
              </button>
            ))
          ) : (
            <div className={styles.emptyState}>暂无推荐内容</div>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionEyebrow}>Quick Access</span>
            <h2>阶段快捷入口</h2>
          </div>
        </div>
        <div className={styles.quickGrid}>
          {quickLinks.map((item) => (
            <button
              key={item.label}
              type="button"
              className={styles.quickCard}
              onClick={() => navigate(item.path)}
            >
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
