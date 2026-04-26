import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { communityApi, CommunityPost } from '@/api/community'
import { categoryApi, type Category } from '@/api/modules'
import { useAppStore } from '@/stores/appStore'
import styles from './Community.module.css'

const sortOptions = [
  { label: '最新', value: 'latest' as const },
  { label: '最热', value: 'hot' as const },
  { label: '最多赞', value: 'popular' as const },
]

type DraftPost = {
  title: string
  content: string
  categoryId: string
  isAnonymous: boolean
}

const initialDraft: DraftPost = {
  title: '',
  content: '',
  categoryId: '',
  isAnonymous: false,
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

function getAuthorName(post: CommunityPost) {
  if (post.isAnonymous) return '匿名用户'
  return post.author?.nickname || post.author?.username || '用户'
}

function getAuthorBadge(post: CommunityPost) {
  const name = getAuthorName(post)
  return name.slice(0, 1).toUpperCase()
}

export function Community() {
  const navigate = useNavigate()
  const user = useAppStore((state) => state.user)
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<Array<Pick<Category, 'id' | 'name'>>>([])
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<'latest' | 'hot' | 'popular'>('latest')
  const [keyword, setKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showPostModal, setShowPostModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null)
  const [draftPost, setDraftPost] = useState<DraftPost>(initialDraft)
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState('')

  const currentUserId = user?.id ? String(user.id) : getUserIdFromToken()
  const isEditing = !!editingPost
  const totalPages = Math.max(1, Math.ceil(total / 10))

  const fetchCategories = useCallback(async () => {
    try {
      const result = await categoryApi.getAll()
      setCategories((result || []).map((item) => ({ id: item.id, name: item.name })))
    } catch {
      setCategories([])
    }
  }, [])

  const fetchPosts = useCallback(async (options?: { page?: number; keyword?: string }) => {
    setLoading(true)
    try {
      const result = await communityApi.getPosts({
        page: options?.page ?? page,
        pageSize: 10,
        sort,
        category: category || undefined,
        keyword: (options?.keyword ?? keyword) || undefined,
      })
      const data = result as unknown as { list: CommunityPost[]; pagination: { total: number } }
      setPosts(data.list || [])
      setTotal(data.pagination?.total || 0)
    } catch (error) {
      console.error('获取帖子失败:', error)
    } finally {
      setLoading(false)
    }
  }, [category, keyword, page, sort])

  useEffect(() => {
    void fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    void fetchPosts()
  }, [fetchPosts])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 1800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const categoryOptions = useMemo(() => [
    { label: '全部', value: '' },
    ...categories.map((item) => ({ label: item.name, value: String(item.id) })),
  ], [categories])

  const ensureLogin = () => {
    const token = localStorage.getItem('token')
    if (!token) {
      setToast('请先登录')
      navigate('/login')
      return false
    }
    return true
  }

  const resetPostForm = () => {
    setDraftPost(initialDraft)
    setEditingPost(null)
    setFormError('')
  }

  const handleCloseModal = () => {
    setShowPostModal(false)
    resetPostForm()
  }

  const handleSearchSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setKeyword(searchInput.trim())
    setPage(1)
    fetchPosts({ page: 1, keyword: searchInput.trim() })
  }

  const handleLike = async (postId: number, isLiked: boolean) => {
    if (!ensureLogin()) return

    try {
      if (isLiked) {
        await communityApi.unlikePost(postId)
      } else {
        await communityApi.likePost(postId)
      }

      setPosts((prev) =>
        prev.map((item) =>
          item.id === postId
            ? { ...item, isLiked: !isLiked, likeCount: item.likeCount + (isLiked ? -1 : 1) }
            : item,
        ),
      )
    } catch {
      setToast('操作失败')
    }
  }

  const handleOpenCreate = () => {
    if (!ensureLogin()) return
    resetPostForm()
    setShowPostModal(true)
  }

  const handleOpenEdit = (post: CommunityPost) => {
    if (!ensureLogin()) return
    setEditingPost(post)
    setDraftPost({
      title: post.title,
      content: post.content,
      isAnonymous: post.isAnonymous,
      categoryId: post.categoryId || '',
    })
    setFormError('')
    setShowPostModal(true)
  }

  const handleSubmitPost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!draftPost.title.trim()) {
      setFormError('请输入标题')
      return
    }
    if (!draftPost.content.trim()) {
      setFormError('请输入内容')
      return
    }

    setSubmitting(true)
    try {
      if (editingPost) {
        await communityApi.updatePost(editingPost.id, {
          title: draftPost.title.trim(),
          content: draftPost.content.trim(),
          categoryId: draftPost.categoryId || undefined,
          isAnonymous: draftPost.isAnonymous,
        })
        setToast('帖子已更新')
      } else {
        await communityApi.createPost({
          title: draftPost.title.trim(),
          content: draftPost.content.trim(),
          categoryId: draftPost.categoryId || undefined,
          isAnonymous: draftPost.isAnonymous,
        })
        setToast('发帖成功')
      }

      handleCloseModal()
      setPage(1)
      fetchPosts({ page: 1 })
    } catch {
      setFormError(editingPost ? '更新失败，请稍后重试' : '发帖失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeletePost = async (post: CommunityPost) => {
    if (!window.confirm('删除后不可恢复，确认继续吗？')) {
      return
    }

    try {
      await communityApi.deletePost(post.id)
      setToast('删除成功')

      const nextPage = posts.length === 1 && page > 1 ? page - 1 : page
      if (nextPage !== page) {
        setPage(nextPage)
      }
      fetchPosts({ page: nextPage })
    } catch {
      setToast('删除失败')
    }
  }

  const isOwnPost = (post: CommunityPost) => !!currentUserId && String(post.authorId) === currentUserId

  return (
    <div className={styles.page}>
      {toast ? <div className={styles.toast}>{toast}</div> : null}

      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Community Exchange</span>
          <h1>社区交流</h1>
          <p>分享经验、提出问题，也可以围绕阶段化知识继续交流。</p>
        </div>
        <button type="button" className={styles.primaryButton} onClick={handleOpenCreate}>
          发帖
        </button>
      </section>

      <section className={styles.toolbar}>
        <form className={styles.searchForm} onSubmit={handleSearchSubmit}>
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="搜索帖子..."
            className={styles.searchInput}
          />
          <button type="submit" className={styles.primaryButton}>
            搜索
          </button>
        </form>

        <div className={styles.filterRow}>
          <label className={styles.filterField}>
            <span>分类</span>
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value)
                setPage(1)
              }}
            >
              {categoryOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.filterField}>
            <span>排序</span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as 'latest' | 'hot' | 'popular')
                setPage(1)
              }}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className={styles.listSection}>
        <div className={styles.listHeader}>
          <div>
            <span className={styles.eyebrow}>Posts</span>
            <h2>帖子列表</h2>
          </div>
          <span className={styles.resultMeta}>共 {total} 条</span>
        </div>

        {loading ? (
          <div className={styles.loadingState}>
            <span className={styles.loadingDot} />
            <span>正在加载帖子...</span>
          </div>
        ) : posts.length > 0 ? (
          <>
            <div className={styles.postList}>
              {posts.map((post) => (
                <article
                  key={post.id}
                  className={styles.postCard}
                  onClick={() => navigate(`/community/${post.id}`)}
                >
                  <div className={styles.postTop}>
                    <div className={styles.authorRow}>
                      <div className={styles.avatar}>{getAuthorBadge(post)}</div>
                      <div>
                        <strong>{getAuthorName(post)}</strong>
                        <span>{new Date(post.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {isOwnPost(post) ? (
                      <div className={styles.ownerActions}>
                        <button
                          type="button"
                          className={styles.textButton}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleOpenEdit(post)
                          }}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className={styles.textButtonDanger}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleDeletePost(post)
                          }}
                        >
                          删除
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className={styles.tagRow}>
                    {post.isPinned ? <span className={`${styles.metaTag} ${styles.metaTagPinned}`}>置顶</span> : null}
                    {(post.categoryName || post.category) ? (
                      <span className={styles.metaTag}>{post.categoryName || post.category}</span>
                    ) : null}
                    {post.isAnonymous ? <span className={styles.metaTag}>匿名</span> : null}
                  </div>

                  <h3>{post.title}</h3>
                  <p className={styles.postSummary}>{post.content}</p>

                  <div className={styles.postFooter}>
                    <div className={styles.postStats}>
                      <button
                        type="button"
                        className={post.isLiked ? `${styles.statButton} ${styles.statButtonActive}` : styles.statButton}
                        onClick={(event) => {
                          event.stopPropagation()
                          handleLike(post.id, !!post.isLiked)
                        }}
                      >
                        点赞 {post.likeCount}
                      </button>
                      <span>评论 {post.commentCount}</span>
                      <span>阅读 {post.viewCount}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>

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
          </>
        ) : (
          <div className={styles.emptyState}>暂无帖子</div>
        )}
      </section>

      {showPostModal ? (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.eyebrow}>Editor</span>
                <h2>{isEditing ? '编辑帖子' : '发布帖子'}</h2>
              </div>
              <button type="button" className={styles.textButton} onClick={handleCloseModal}>
                关闭
              </button>
            </div>

            <form className={styles.postForm} onSubmit={handleSubmitPost}>
              <label className={styles.formField}>
                <span>标题</span>
                <input
                  value={draftPost.title}
                  maxLength={100}
                  onChange={(event) => setDraftPost((current) => ({ ...current, title: event.target.value }))}
                  placeholder="请输入帖子标题"
                />
              </label>

              <label className={styles.formField}>
                <span>分类</span>
                <select
                  value={draftPost.categoryId}
                  onChange={(event) => setDraftPost((current) => ({ ...current, categoryId: event.target.value }))}
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
                  value={draftPost.content}
                  maxLength={5000}
                  rows={8}
                  onChange={(event) => setDraftPost((current) => ({ ...current, content: event.target.value }))}
                  placeholder="分享您的经验..."
                />
              </label>

              <label className={styles.switchRow}>
                <input
                  type="checkbox"
                  checked={draftPost.isAnonymous}
                  onChange={(event) => setDraftPost((current) => ({ ...current, isAnonymous: event.target.checked }))}
                />
                <span>匿名发布</span>
              </label>

              {formError ? <div className={styles.formError}>{formError}</div> : null}

              <button type="submit" className={styles.primaryButton} disabled={submitting}>
                {submitting ? '提交中...' : isEditing ? '保存修改' : '立即发布'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
