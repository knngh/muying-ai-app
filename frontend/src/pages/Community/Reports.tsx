import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { authApi } from '@/api/modules'
import { communityApi, type CommunityReportItem } from '@/api/community'
import { useAppStore } from '@/stores/appStore'
import styles from './Reports.module.css'

const reasonLabelMap: Record<string, string> = {
  spam: '广告引流',
  abuse: '辱骂攻击',
  misinformation: '错误信息',
  privacy: '隐私泄露',
  illegal: '违法违规',
  other: '其他问题',
}

const statusLabelMap: Record<string, string> = {
  pending: '待处理',
  reviewed: '已处理',
  rejected: '已驳回',
}

const actionLabelMap: Record<string, string> = {
  none: '无动作',
  hide_post: '隐藏帖子',
  delete_comment: '删除评论',
}

export function CommunityReports() {
  const navigate = useNavigate()
  const user = useAppStore((state) => state.user)
  const setUser = useAppStore((state) => state.setUser)
  const [loading, setLoading] = useState(true)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [reports, setReports] = useState<CommunityReportItem[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<'pending' | 'reviewed' | 'rejected' | ''>('pending')
  const [targetTypeFilter, setTargetTypeFilter] = useState<'post' | 'comment' | ''>('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [toast, setToast] = useState('')

  const ensureAdmin = useCallback(async () => {
    try {
      const currentUser = user || await authApi.me()
      if (!user) {
        setUser(currentUser)
      }

      if (currentUser.username !== 'admin') {
        setToast('仅管理员可访问举报处理页')
        navigate('/community', { replace: true })
        return
      }

      setIsAdmin(true)
    } catch {
      setToast('请先登录管理员账号')
      navigate('/login', { replace: true })
    }
  }, [navigate, setUser, user])

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const result = await communityApi.getReports({
        page,
        pageSize,
        status: statusFilter || undefined,
        targetType: targetTypeFilter || undefined,
      })
      setReports(result.list || [])
      setTotal(result.pagination?.total || 0)
    } catch {
      setToast('获取举报列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, statusFilter, targetTypeFilter])

  useEffect(() => {
    void ensureAdmin()
  }, [ensureAdmin])

  useEffect(() => {
    if (!isAdmin) return
    void fetchReports()
  }, [fetchReports, isAdmin])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 1800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleProcess = async (
    report: CommunityReportItem,
    nextStatus: 'reviewed' | 'rejected',
    actionTaken?: 'none' | 'hide_post' | 'delete_comment',
  ) => {
    const isApprove = nextStatus === 'reviewed'
    const content = isApprove
      ? `将把该举报标记为已处理，并执行「${actionLabelMap[actionTaken || 'none']}」。`
      : '将把该举报标记为已驳回。'

    if (!window.confirm(content)) {
      return
    }

    try {
      setSubmittingId(report.id)
      await communityApi.handleReport(report.id, {
        status: nextStatus,
        actionTaken,
        decisionReason: isApprove
          ? `管理员确认执行：${actionLabelMap[actionTaken || 'none']}`
          : '管理员判定举报不成立',
      })
      setToast(isApprove ? '举报已处理' : '举报已驳回')
      await fetchReports()
    } catch {
      setToast(isApprove ? '处理失败' : '驳回失败')
    } finally {
      setSubmittingId(null)
    }
  }

  if (loading && !isAdmin) {
    return (
      <div className={styles.loadingState}>
        <span className={styles.loadingDot} />
        <span>正在校验管理员权限...</span>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {toast ? <div className={styles.toast}>{toast}</div> : null}

      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Moderation</span>
          <h1>社区举报处理</h1>
          <p>查看 AI 自动判定结果，并对待处理项进行人工覆写。</p>
        </div>
      </section>

      <section className={styles.statsCard}>
        <div className={styles.statsGrid}>
          <div>
            <span>当前页数量</span>
            <strong>{reports.length}</strong>
          </div>
          <div>
            <span>总举报数</span>
            <strong>{total}</strong>
          </div>
          <div>
            <span>默认管理员</span>
            <strong>admin</strong>
          </div>
        </div>
      </section>

      <section className={styles.filterCard}>
        <div className={styles.filterRow}>
          <label className={styles.filterField}>
            <span>筛选状态</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setPage(1)
                setStatusFilter(event.target.value as 'pending' | 'reviewed' | 'rejected' | '')
              }}
            >
              <option value="">全部</option>
              <option value="pending">待处理</option>
              <option value="reviewed">已处理</option>
              <option value="rejected">已驳回</option>
            </select>
          </label>

          <label className={styles.filterField}>
            <span>筛选目标类型</span>
            <select
              value={targetTypeFilter}
              onChange={(event) => {
                setPage(1)
                setTargetTypeFilter(event.target.value as 'post' | 'comment' | '')
              }}
            >
              <option value="">全部</option>
              <option value="post">帖子</option>
              <option value="comment">评论</option>
            </select>
          </label>

          <label className={styles.filterField}>
            <span>每页条数</span>
            <select
              value={String(pageSize)}
              onChange={(event) => {
                setPage(1)
                setPageSize(Number(event.target.value))
              }}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </label>

          <button type="button" className={styles.primaryButton} onClick={() => void fetchReports()}>
            刷新列表
          </button>
        </div>
      </section>

      <section className={styles.listSection}>
        {loading ? (
          <div className={styles.loadingState}>
            <span className={styles.loadingDot} />
            <span>正在加载举报记录...</span>
          </div>
        ) : reports.length === 0 ? (
          <div className={styles.emptyState}>暂无举报记录</div>
        ) : (
          <div className={styles.reportList}>
            {reports.map((report) => {
              const targetTitle = report.targetType === 'post'
                ? (report.post?.title || '帖子已不可见')
                : `评论 #${report.comment?.id || '-'}`
              const targetContent = report.targetType === 'post'
                ? report.post?.content
                : report.comment?.content
              const targetAuthor = report.targetType === 'post'
                ? (report.post?.author?.nickname || report.post?.author?.username)
                : (report.comment?.author?.nickname || report.comment?.author?.username)
              const pending = report.status === 'pending'
              const defaultAction = report.targetType === 'post' ? 'hide_post' : 'delete_comment'

              return (
                <article key={report.id} className={styles.reportCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.badgeRow}>
                      <span className={`${styles.badge} ${styles[`status_${report.status}`] || ''}`}>
                        {statusLabelMap[report.status] || report.status}
                      </span>
                      <span className={styles.badge}>{report.targetType === 'post' ? '帖子' : '评论'}</span>
                      <span className={styles.badge}>{report.handledByAI ? 'AI已处理' : '人工/待处理'}</span>
                    </div>
                    <div className={styles.metaText}>
                      举报人：{report.reporter?.nickname || report.reporter?.username || '-'}
                    </div>
                  </div>

                  <div className={styles.sectionBlock}>
                    <span className={styles.blockLabel}>举报信息</span>
                    <strong>{reasonLabelMap[report.reason] || report.reason}</strong>
                    <p>提交时间：{dayjs(report.createdAt).format('YYYY-MM-DD HH:mm')}</p>
                    {report.description ? <p>举报补充：{report.description}</p> : null}
                  </div>

                  <div className={styles.sectionBlock}>
                    <span className={styles.blockLabel}>被举报内容</span>
                    <strong>{targetTitle}</strong>
                    <p>作者：{targetAuthor || '-'}</p>
                    <p className={styles.contentPreview}>{targetContent || '内容已被处理或不存在'}</p>
                  </div>

                  <div className={styles.sectionBlock}>
                    <span className={styles.blockLabel}>处理结果</span>
                    <p>动作：{actionLabelMap[report.actionTaken] || report.actionTaken}</p>
                    <p>{report.decisionReason || '暂无处理说明'}</p>
                    <p>处理时间：{report.handledAt ? dayjs(report.handledAt).format('YYYY-MM-DD HH:mm') : '未处理'}</p>
                  </div>

                  <div className={styles.actionRow}>
                    {pending ? (
                      <>
                        <button
                          type="button"
                          className={styles.primaryButton}
                          disabled={submittingId === report.id}
                          onClick={() => handleProcess(report, 'reviewed', defaultAction)}
                        >
                          {submittingId === report.id ? '处理中...' : (report.targetType === 'post' ? '通过并隐藏帖子' : '通过并删除评论')}
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          disabled={submittingId === report.id}
                          onClick={() => handleProcess(report, 'reviewed', 'none')}
                        >
                          仅标记已处理
                        </button>
                        <button
                          type="button"
                          className={styles.dangerButton}
                          disabled={submittingId === report.id}
                          onClick={() => handleProcess(report, 'rejected', 'none')}
                        >
                          驳回举报
                        </button>
                      </>
                    ) : (
                      <span className={styles.metaText}>已完成</span>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            上一页
          </button>
          <span>第 {page} / {totalPages} 页</span>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            下一页
          </button>
        </div>
      </section>
    </div>
  )
}
