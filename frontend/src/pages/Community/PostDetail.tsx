import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { communityApi, CommunityComment, CommunityPost } from '@/api/community'
import { categoryApi, type Category } from '@/api/modules'
import { useAppStore } from '@/stores/appStore'
import styles from './PostDetail.module.css'

const reportReasonOptions = [
  { label: '广告引流', value: 'spam' as const },
  { label: '辱骂攻击', value: 'abuse' as const },
  { label: '错误信息', value: 'misinformation' as const },
  { label: '隐私泄露', value: 'privacy' as const },
  { label: '违法违规', value: 'illegal' as const },
  { label: '其他问题', value: 'other' as const },
]

type ReportReason = (typeof reportReasonOptions)[number]['value']

type DraftPost = {
  title: string
  content: string
  categoryId: string
  isAnonymous: boolean
}

type DraftReport = {
  reason: ReportReason | ''
  description: string
}

const initialDraftPost: DraftPost = {
  title: '',
  content: '',
  categoryId: '',
  isAnonymous: false,
}

const initialDraftReport: DraftReport = {
  reason: '',
  description: '',
}

const getUserIdFromToken = () => {
  const token = localStorage.getItem('token')
  if (!token) return ''

  try {
    const payload = JSON.parse(window.atob(token.split('.')[1] || ''))
    return payload?.userId ? String(payload.userId) : ''
  } catch {
    return ''
  }
}

function getAuthorName(item: CommunityPost | CommunityComment) {
  if ('isAnonymous' in item && item.isAnonymous) return '匿名用户'
  return item.author?.nickname || item.author?.username || '用户'
}

function getAuthorBadge(item: CommunityPost | CommunityComment) {
  return getAuthorName(item).slice(0, 1).toUpperCase()
}

export function PostDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAppStore((state) => state.user)
  const [post, setPost] = useState<CommunityPost | null>(null)
  const [comments, setComments] = useState<CommunityComment[]>([])
  const [categories, setCategories] = useState<Array<Pick<Category, 'id' | 'name'>>>([])
  const [loading, setLoading] = useState(true)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentContent, setCommentContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [editDraft, setEditDraft] = useState<DraftPost>(initialDraftPost)
  const [reportDraft, setReportDraft] = useState<DraftReport>(initialDraftReport)
  const [formError, setFormError] = useState('')
  const [reportError, setReportError] = useState('')
  const [toast, setToast] = useState('')
  const [reportTarget, setReportTarget] = useState<{ targetType: 'post' | 'comment'; targetId: number; label: string } | null>(null)
  const [replyTarget, setReplyTarget] = useState<{ parentId: number; replyToId: number; authorName: string } | null>(null)
  const [expandedReplies, setExpandedReplies] = useState<Record<number, {
    items: CommunityComment[]
    loading: boolean
    expanded: boolean
    page: number
    pageSize: number
    total: number
    totalPages: number
  }>>({})
  const [commentPagination, setCommentPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  })

  const currentUserId = user?.id ? String(user.id) : getUserIdFromToken()
  const canManagePost = !!post && !!currentUserId && String(post.authorId) === currentUserId

  const fetchCategories = useCallback(async () => {
    try {
      const result = await categoryApi.getAll()
      setCategories((result || []).map((item) => ({ id: item.id, name: item.name })))
    } catch {
      setCategories([])
    }
  }, [])

  const fetchPost = useCallback(async (postId: number) => {
    setLoading(true)
    try {
      const data = (await communityApi.getPostById(postId)) as CommunityPost
      setPost(data)
    } catch {
      setToast('获取帖子失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchComments = useCallback(async (
    postId: number,
    page: number,
    pageSize = commentPagination.pageSize,
  ) => {
    setCommentsLoading(true)
    try {
      const result = await communityApi.getComments(postId, {
        page,
        pageSize,
      })
      const data = result as unknown as {
        list: CommunityComment[]
        pagination?: { page: number; pageSize: number; total: number; totalPages: number }
      }
      setComments(data.list || [])
      setExpandedReplies({})
      setCommentPagination((prev) => ({
        ...prev,
        page: data.pagination?.page ?? page,
        pageSize: data.pagination?.pageSize ?? pageSize,
        total: data.pagination?.total ?? 0,
        totalPages: data.pagination?.totalPages ?? 0,
      }))
    } catch (error) {
      console.error('获取评论失败:', error)
    } finally {
      setCommentsLoading(false)
    }
  }, [commentPagination.pageSize])

  useEffect(() => {
    void fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    if (!id) {
      return
    }

    const postId = Number(id)
    void fetchPost(postId)
    void fetchComments(postId, 1)
  }, [fetchComments, fetchPost, id])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 1800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const ensureLogin = () => {
    const token = localStorage.getItem('token')
    if (!token) {
      setToast('请先登录')
      navigate('/login')
      return false
    }
    return true
  }

  const handleLike = async () => {
    if (!post || !ensureLogin()) return

    try {
      if (post.isLiked) {
        await communityApi.unlikePost(post.id)
      } else {
        await communityApi.likePost(post.id)
      }
      setPost({
        ...post,
        isLiked: !post.isLiked,
        likeCount: post.likeCount + (post.isLiked ? -1 : 1),
      })
    } catch {
      setToast('操作失败')
    }
  }

  const handleOpenEdit = () => {
    if (!post || !canManagePost) return

    setEditDraft({
      title: post.title,
      content: post.content,
      categoryId: post.categoryId || '',
      isAnonymous: post.isAnonymous,
    })
    setFormError('')
    setShowEditModal(true)
  }

  const handleCloseEdit = () => {
    setShowEditModal(false)
    setEditDraft(initialDraftPost)
    setFormError('')
  }

  const openReportModal = (target: { targetType: 'post' | 'comment'; targetId: number; label: string }) => {
    if (!ensureLogin()) return
    setReportTarget(target)
    setReportDraft(initialDraftReport)
    setReportError('')
    setShowReportModal(true)
  }

  const handleCloseReport = () => {
    setShowReportModal(false)
    setReportTarget(null)
    setReportDraft(initialDraftReport)
    setReportError('')
  }

  const handleSubmitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!post) return

    if (!editDraft.title.trim()) {
      setFormError('请输入标题')
      return
    }
    if (!editDraft.content.trim()) {
      setFormError('请输入内容')
      return
    }

    setEditSubmitting(true)
    try {
      const updatedPost = (await communityApi.updatePost(post.id, {
        title: editDraft.title.trim(),
        content: editDraft.content.trim(),
        categoryId: editDraft.categoryId || undefined,
        isAnonymous: editDraft.isAnonymous,
      })) as CommunityPost
      setPost(updatedPost)
      handleCloseEdit()
      setToast('帖子已更新')
    } catch {
      setFormError('更新失败，请稍后重试')
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleDeletePost = async () => {
    if (!post || !canManagePost) return
    if (!window.confirm('删除后不可恢复，确认继续吗？')) return

    try {
      await communityApi.deletePost(post.id)
      setToast('删除成功')
      navigate('/community')
    } catch {
      setToast('删除失败')
    }
  }

  const handleDeleteComment = async (commentId: number) => {
    if (!post || !window.confirm('删除后不可恢复，确认继续吗？')) return

    try {
      const result = await communityApi.deleteComment(commentId)
      setPost((prev) =>
        prev
          ? { ...prev, commentCount: Math.max(0, prev.commentCount - (result.deletedCount || 0)) }
          : prev,
      )
      if (id) {
        const nextPage = comments.length === 1 && commentPagination.page > 1
          ? commentPagination.page - 1
          : commentPagination.page
        fetchComments(Number(id), nextPage)
      }
      setToast('删除成功')
    } catch {
      setToast('删除失败')
    }
  }

  const canDeleteComment = (authorId: string) => !!currentUserId && String(authorId) === currentUserId
  const canReportPost = !canManagePost
  const canReportComment = (authorId: string) => !!currentUserId && String(authorId) !== currentUserId

  const loadReplies = async (commentId: number, page = 1) => {
    setExpandedReplies((prev) => ({
      ...prev,
      [commentId]: {
        items: prev[commentId]?.items || [],
        loading: true,
        expanded: true,
        page,
        pageSize: prev[commentId]?.pageSize || 20,
        total: prev[commentId]?.total || 0,
        totalPages: prev[commentId]?.totalPages || 0,
      },
    }))

    try {
      const result = await communityApi.getReplies(commentId, { page, pageSize: 20 })
      const data = result as unknown as {
        list: CommunityComment[]
        pagination?: { page: number; pageSize: number; total: number; totalPages: number }
      }
      setExpandedReplies((prev) => ({
        ...prev,
        [commentId]: {
          items: data.list || [],
          loading: false,
          expanded: true,
          page: data.pagination?.page ?? page,
          pageSize: data.pagination?.pageSize ?? 20,
          total: data.pagination?.total ?? 0,
          totalPages: data.pagination?.totalPages ?? 0,
        },
      }))
    } catch {
      setExpandedReplies((prev) => ({
        ...prev,
        [commentId]: {
          items: prev[commentId]?.items || [],
          loading: false,
          expanded: false,
          page: prev[commentId]?.page || 1,
          pageSize: prev[commentId]?.pageSize || 20,
          total: prev[commentId]?.total || 0,
          totalPages: prev[commentId]?.totalPages || 0,
        },
      }))
      setToast('加载回复失败')
    }
  }

  const collapseReplies = (commentId: number) => {
    setExpandedReplies((prev) => ({
      ...prev,
      [commentId]: {
        items: prev[commentId]?.items || [],
        loading: false,
        expanded: false,
        page: prev[commentId]?.page || 1,
        pageSize: prev[commentId]?.pageSize || 20,
        total: prev[commentId]?.total || 0,
        totalPages: prev[commentId]?.totalPages || 0,
      },
    }))
  }

  const handleSubmitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!reportTarget) return

    if (!reportDraft.reason) {
      setReportError('请选择举报原因')
      return
    }

    setReportSubmitting(true)
    try {
      await communityApi.createReport({
        targetType: reportTarget.targetType,
        targetId: reportTarget.targetId,
        reason: reportDraft.reason,
        description: reportDraft.description.trim() || undefined,
      })
      handleCloseReport()
      setToast('举报已提交，我们会尽快处理')
    } catch {
      setReportError('举报提交失败，请稍后重试')
    } finally {
      setReportSubmitting(false)
    }
  }

  const handleSubmitComment = async () => {
    if (!commentContent.trim() || !id) return
    if (!ensureLogin()) return

    setSubmitting(true)
    try {
      await communityApi.createComment(Number(id), {
        content: commentContent.trim(),
        parentId: replyTarget?.parentId,
        replyToId: replyTarget?.replyToId,
      })

      setCommentContent('')
      setReplyTarget(null)
      setPost((prev) => (prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev))
      await fetchComments(Number(id), 1)
      setToast('评论成功')
    } catch {
      setToast('评论失败')
    } finally {
      setSubmitting(false)
    }
  }

  const renderComment = (comment: CommunityComment, parentComment?: CommunityComment) => {
    const isReply = !!parentComment
    return (
      <div key={comment.id} className={isReply ? styles.replyItem : styles.commentItem}>
        <div className={styles.commentHeader}>
          <div className={styles.authorRow}>
            <div className={styles.avatar}>{getAuthorBadge(comment)}</div>
            <div>
              <strong>{getAuthorName(comment)}</strong>
              <span>{new Date(comment.createdAt).toLocaleString()}</span>
            </div>
          </div>
          <div className={styles.inlineActions}>
            {canDeleteComment(comment.authorId) ? (
              <button type="button" className={styles.textButtonDanger} onClick={() => handleDeleteComment(comment.id)}>
                删除
              </button>
            ) : null}
            {canReportComment(comment.authorId) ? (
              <button
                type="button"
                className={styles.textButtonDanger}
                onClick={() => openReportModal({
                  targetType: 'comment',
                  targetId: comment.id,
                  label: isReply ? '回复' : '评论',
                })}
              >
                举报
              </button>
            ) : null}
          </div>
        </div>
        <p className={styles.commentContent}>{comment.content}</p>
        <button
          type="button"
          className={styles.textButton}
          onClick={() => setReplyTarget({
            parentId: parentComment?.id || comment.id,
            replyToId: comment.id,
            authorName: getAuthorName(comment),
          })}
        >
          回复
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <span className={styles.loadingDot} />
        <span>正在加载帖子...</span>
      </div>
    )
  }

  if (!post) {
    return (
      <div className={styles.emptyState}>
        <h1>帖子不存在或已删除</h1>
        <button type="button" className={styles.primaryButton} onClick={() => navigate('/community')}>
          返回社区
        </button>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {toast ? <div className={styles.toast}>{toast}</div> : null}

      <button type="button" className={styles.backButton} onClick={() => navigate('/community')}>
        返回社区
      </button>

      <article className={styles.postCard}>
        <header className={styles.postHeader}>
          <div className={styles.authorRow}>
            <div className={styles.avatar}>{getAuthorBadge(post)}</div>
            <div>
              <strong>{getAuthorName(post)}</strong>
              <span>{new Date(post.createdAt).toLocaleString()}</span>
            </div>
          </div>

          <div className={styles.inlineActions}>
            {canManagePost ? (
              <>
                <button type="button" className={styles.textButton} onClick={handleOpenEdit}>
                  编辑
                </button>
                <button type="button" className={styles.textButtonDanger} onClick={handleDeletePost}>
                  删除
                </button>
              </>
            ) : null}
            {canReportPost ? (
              <button
                type="button"
                className={styles.textButtonDanger}
                onClick={() => openReportModal({ targetType: 'post', targetId: post.id, label: '帖子' })}
              >
                举报
              </button>
            ) : null}
          </div>
        </header>

        <div className={styles.tagRow}>
          {post.isPinned ? <span className={`${styles.metaTag} ${styles.metaTagPinned}`}>置顶</span> : null}
          {(post.categoryName || post.category) ? (
            <span className={styles.metaTag}>{post.categoryName || post.category}</span>
          ) : null}
          {post.isAnonymous ? <span className={styles.metaTag}>匿名</span> : null}
        </div>

        <h1>{post.title}</h1>
        <p className={styles.postContent}>{post.content}</p>

        <footer className={styles.postStats}>
          <button
            type="button"
            className={post.isLiked ? `${styles.secondaryButton} ${styles.activeButton}` : styles.secondaryButton}
            onClick={handleLike}
          >
            点赞 {post.likeCount}
          </button>
          <span>{post.commentCount} 评论</span>
          <span>{post.viewCount} 浏览</span>
        </footer>
      </article>

      <section className={styles.commentsCard}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.eyebrow}>Comments</span>
            <h2>评论 ({post.commentCount})</h2>
          </div>
        </div>

        <div className={styles.commentComposer}>
          {replyTarget ? (
            <div className={styles.replyBanner}>
              <span>正在回复：{replyTarget.authorName}</span>
              <button type="button" className={styles.textButton} onClick={() => setReplyTarget(null)}>
                取消
              </button>
            </div>
          ) : null}
          <textarea
            rows={3}
            value={commentContent}
            onChange={(event) => setCommentContent(event.target.value)}
            placeholder={replyTarget ? `回复 ${replyTarget.authorName}...` : '写下你的评论...'}
            maxLength={1000}
          />
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleSubmitComment}
            disabled={submitting || !commentContent.trim()}
          >
            {submitting ? '提交中...' : '发表评论'}
          </button>
        </div>

        {commentsLoading ? (
          <div className={styles.loadingState}>
            <span className={styles.loadingDot} />
            <span>正在加载评论...</span>
          </div>
        ) : comments.length > 0 ? (
          <>
            <div className={styles.commentList}>
              {comments.map((comment) => {
                const replyState = expandedReplies[comment.id]
                const visibleReplies = replyState?.expanded ? replyState.items : (comment.replies || [])
                const hasMoreReplies = (comment.replyCount || 0) > (comment.replies?.length || 0)

                return (
                  <div key={comment.id} className={styles.commentBlock}>
                    {renderComment(comment)}

                    {visibleReplies.length ? (
                      <div className={styles.repliesBox}>
                        {visibleReplies.map((reply) => renderComment(reply, comment))}
                      </div>
                    ) : null}

                    {(hasMoreReplies || replyState?.expanded) ? (
                      <div className={styles.replyPager}>
                        {replyState?.expanded ? (
                          <>
                            <button type="button" className={styles.textButton} onClick={() => collapseReplies(comment.id)}>
                              收起回复
                            </button>
                            {replyState.totalPages > 1 ? (
                              <>
                                <button
                                  type="button"
                                  className={styles.textButton}
                                  disabled={replyState.page <= 1 || replyState.loading}
                                  onClick={() => loadReplies(comment.id, replyState.page - 1)}
                                >
                                  上一页
                                </button>
                                <span>{replyState.page} / {replyState.totalPages}</span>
                                <button
                                  type="button"
                                  className={styles.textButton}
                                  disabled={replyState.page >= replyState.totalPages || replyState.loading}
                                  onClick={() => loadReplies(comment.id, replyState.page + 1)}
                                >
                                  下一页
                                </button>
                              </>
                            ) : null}
                          </>
                        ) : (
                          <button
                            type="button"
                            className={styles.textButton}
                            disabled={replyState?.loading}
                            onClick={() => loadReplies(comment.id)}
                          >
                            {replyState?.loading ? '加载中...' : `查看全部回复 (${comment.replyCount || 0})`}
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>

            <div className={styles.pagination}>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={commentPagination.page <= 1}
                onClick={() => id && fetchComments(Number(id), commentPagination.page - 1)}
              >
                上一页
              </button>
              <span>
                第 {commentPagination.page} / {Math.max(1, commentPagination.totalPages || 1)} 页
              </span>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={commentPagination.page >= commentPagination.totalPages}
                onClick={() => id && fetchComments(Number(id), commentPagination.page + 1)}
              >
                下一页
              </button>
            </div>
          </>
        ) : (
          <div className={styles.emptyInline}>暂无评论，来说点什么吧</div>
        )}
      </section>

      {showEditModal ? (
        <div className={styles.modalOverlay} onClick={handleCloseEdit}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.eyebrow}>Editor</span>
                <h2>编辑帖子</h2>
              </div>
              <button type="button" className={styles.textButton} onClick={handleCloseEdit}>
                关闭
              </button>
            </div>
            <form className={styles.form} onSubmit={handleSubmitEdit}>
              <label className={styles.formField}>
                <span>标题</span>
                <input
                  value={editDraft.title}
                  maxLength={100}
                  onChange={(event) => setEditDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="请输入帖子标题"
                />
              </label>
              <label className={styles.formField}>
                <span>分类</span>
                <select
                  value={editDraft.categoryId}
                  onChange={(event) => setEditDraft((current) => ({ ...current, categoryId: event.target.value }))}
                >
                  <option value="">不分类</option>
                  {categories.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.formField}>
                <span>内容</span>
                <textarea
                  rows={6}
                  value={editDraft.content}
                  maxLength={5000}
                  onChange={(event) => setEditDraft((current) => ({ ...current, content: event.target.value }))}
                  placeholder="分享您的经验..."
                />
              </label>
              <label className={styles.switchRow}>
                <input
                  type="checkbox"
                  checked={editDraft.isAnonymous}
                  onChange={(event) => setEditDraft((current) => ({ ...current, isAnonymous: event.target.checked }))}
                />
                <span>匿名发布</span>
              </label>
              {formError ? <div className={styles.formError}>{formError}</div> : null}
              <button type="submit" className={styles.primaryButton} disabled={editSubmitting}>
                {editSubmitting ? '保存中...' : '保存修改'}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {showReportModal ? (
        <div className={styles.modalOverlay} onClick={handleCloseReport}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.eyebrow}>Report</span>
                <h2>{reportTarget ? `举报${reportTarget.label}` : '举报内容'}</h2>
              </div>
              <button type="button" className={styles.textButton} onClick={handleCloseReport}>
                关闭
              </button>
            </div>
            <form className={styles.form} onSubmit={handleSubmitReport}>
              <label className={styles.formField}>
                <span>举报原因</span>
                <select
                  value={reportDraft.reason}
                  onChange={(event) => setReportDraft((current) => ({
                    ...current,
                    reason: event.target.value as ReportReason | '',
                  }))}
                >
                  <option value="">请选择原因</option>
                  {reportReasonOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.formField}>
                <span>补充说明</span>
                <textarea
                  rows={4}
                  maxLength={500}
                  value={reportDraft.description}
                  onChange={(event) => setReportDraft((current) => ({ ...current, description: event.target.value }))}
                  placeholder="可选，补充更多上下文帮助审核"
                />
              </label>
              {reportError ? <div className={styles.formError}>{reportError}</div> : null}
              <button type="submit" className={styles.primaryButton} disabled={reportSubmitting}>
                {reportSubmitting ? '提交中...' : '提交举报'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
