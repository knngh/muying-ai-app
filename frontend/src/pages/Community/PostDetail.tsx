import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Avatar,
  Button,
  Card,
  Divider,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  EyeOutlined,
  LikeFilled,
  LikeOutlined,
  MessageOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { communityApi, CommunityComment, CommunityPost } from '@/api/community'
import { categoryApi, type Category } from '@/api/modules'
import { useAppStore } from '@/stores/appStore'

const { Paragraph, Text, Title } = Typography
const { TextArea } = Input

const reportReasonOptions = [
  { label: '广告引流', value: 'spam' as const },
  { label: '辱骂攻击', value: 'abuse' as const },
  { label: '错误信息', value: 'misinformation' as const },
  { label: '隐私泄露', value: 'privacy' as const },
  { label: '违法违规', value: 'illegal' as const },
  { label: '其他问题', value: 'other' as const },
]

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
  const [form] = Form.useForm()
  const [reportForm] = Form.useForm()

  const currentUserId = user?.id ? String(user.id) : getUserIdFromToken()
  const postCategoryOptions = [
    { label: '不分类', value: '' },
    ...categories.map((item) => ({ label: item.name, value: String(item.id) })),
  ]
  const canManagePost = !!post && !!currentUserId && String(post.authorId) === currentUserId

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    if (id) {
      fetchPost(Number(id))
      fetchComments(Number(id), 1)
    }
  }, [id])

  const fetchCategories = async () => {
    try {
      const result = await categoryApi.getAll()
      setCategories((result || []).map((item) => ({ id: item.id, name: item.name })))
    } catch (_error) {
      setCategories([])
    }
  }

  const fetchPost = async (postId: number) => {
    setLoading(true)
    try {
      const data = (await communityApi.getPostById(postId)) as CommunityPost
      setPost(data)
    } catch (_error) {
      message.error('获取帖子失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchComments = async (postId: number, page = commentPagination.page) => {
    setCommentsLoading(true)
    try {
      const result = await communityApi.getComments(postId, {
        page,
        pageSize: commentPagination.pageSize,
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
        pageSize: data.pagination?.pageSize ?? prev.pageSize,
        total: data.pagination?.total ?? 0,
        totalPages: data.pagination?.totalPages ?? 0,
      }))
    } catch (_error) {
      console.error('获取评论失败:', _error)
    } finally {
      setCommentsLoading(false)
    }
  }

  const ensureLogin = () => {
    const token = localStorage.getItem('token')
    if (!token) {
      message.warning('请先登录')
      navigate('/login')
      return false
    }
    return true
  }

  const handleLike = async () => {
    if (!post) return
    if (!ensureLogin()) return

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
    } catch (_error) {
      message.error('操作失败')
    }
  }

  const handleOpenEdit = () => {
    if (!post || !canManagePost) return

    form.setFieldsValue({
      title: post.title,
      content: post.content,
      categoryId: post.categoryId || '',
      isAnonymous: post.isAnonymous,
    })
    setShowEditModal(true)
  }

  const handleCloseEdit = () => {
    setShowEditModal(false)
    form.resetFields()
  }

  const openReportModal = (target: { targetType: 'post' | 'comment'; targetId: number; label: string }) => {
    if (!ensureLogin()) return
    setReportTarget(target)
    reportForm.resetFields()
    setShowReportModal(true)
  }

  const handleCloseReport = () => {
    setShowReportModal(false)
    setReportTarget(null)
    reportForm.resetFields()
  }

  const handleSubmitEdit = async (values: {
    title: string
    content: string
    categoryId?: string
    isAnonymous?: boolean
  }) => {
    if (!post) return

    setEditSubmitting(true)
    try {
      const updatedPost = (await communityApi.updatePost(post.id, {
        title: values.title.trim(),
        content: values.content.trim(),
        categoryId: values.categoryId || undefined,
        isAnonymous: Boolean(values.isAnonymous),
      })) as CommunityPost
      setPost(updatedPost)
      handleCloseEdit()
      message.success('帖子已更新')
    } catch (_error) {
      message.error('更新失败')
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleDeletePost = () => {
    if (!post || !canManagePost) return

    Modal.confirm({
      title: '删除帖子',
      content: '删除后不可恢复，确认继续吗？',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await communityApi.deletePost(post.id)
          message.success('删除成功')
          navigate('/community')
        } catch (_error) {
          message.error('删除失败')
        }
      },
    })
  }

  const handleDeleteComment = (commentId: number) => {
    if (!post) return

    Modal.confirm({
      title: '删除评论',
      content: '删除后不可恢复，确认继续吗？',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const result = await communityApi.deleteComment(commentId)
          setPost((prev) =>
            prev
              ? { ...prev, commentCount: Math.max(0, prev.commentCount - (result.deletedCount || 0)) }
              : prev
          )
          if (id) {
            const nextPage = comments.length === 1 && commentPagination.page > 1
              ? commentPagination.page - 1
              : commentPagination.page
            fetchComments(Number(id), nextPage)
          }
          message.success('删除成功')
        } catch (_error) {
          message.error('删除失败')
        }
      },
    })
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
    } catch (_error) {
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
      message.error('加载回复失败')
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

  const handleSubmitReport = async (values: {
    reason: 'spam' | 'abuse' | 'misinformation' | 'privacy' | 'illegal' | 'other'
    description?: string
  }) => {
    if (!reportTarget) return

    setReportSubmitting(true)
    try {
      await communityApi.createReport({
        targetType: reportTarget.targetType,
        targetId: reportTarget.targetId,
        reason: values.reason,
        description: values.description?.trim() || undefined,
      })
      handleCloseReport()
      message.success('举报已提交，我们会尽快处理')
    } catch (_error) {
      message.error('举报提交失败')
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
      message.success('评论成功')
    } catch (_error) {
      message.error('评论失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!post) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: 50 }}>
          <Title level={4}>帖子不存在或已删除</Title>
          <Button type="primary" onClick={() => navigate('/community')}>
            返回社区
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/community')}
        style={{ marginBottom: 16 }}
      >
        返回社区
      </Button>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Avatar icon={<UserOutlined />} src={post.author?.avatar} />
            <div style={{ marginLeft: 12 }}>
              <Text strong>
                {post.isAnonymous ? '匿名用户' : post.author?.nickname || post.author?.username}
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {new Date(post.createdAt).toLocaleString()}
              </Text>
            </div>
          </div>
          {canManagePost && (
            <Space size={4}>
              <Button type="link" size="small" onClick={handleOpenEdit}>
                编辑
              </Button>
              <Button type="link" size="small" danger onClick={handleDeletePost}>
                删除
              </Button>
            </Space>
          )}
          {canReportPost && (
            <Button
              type="link"
              size="small"
              danger
              onClick={() => openReportModal({ targetType: 'post', targetId: post.id, label: '帖子' })}
            >
              举报
            </Button>
          )}
        </div>

        <Title level={3}>
          {post.isPinned && <Tag color="red">置顶</Tag>}
          {post.title}
        </Title>

        <Paragraph style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: 15 }}>
          {post.content}
        </Paragraph>

        <Space wrap style={{ marginBottom: 16 }}>
          {(post.categoryName || post.category) && (
            <Tag>{post.categoryName || post.category}</Tag>
          )}
          {post.isAnonymous && <Tag color="gold">匿名</Tag>}
        </Space>

        <Divider />

        <Space size="large">
          <Button
            type={post.isLiked ? 'primary' : 'default'}
            icon={post.isLiked ? <LikeFilled /> : <LikeOutlined />}
            onClick={handleLike}
          >
            {post.likeCount}
          </Button>
          <span>
            <MessageOutlined /> {post.commentCount} 评论
          </span>
          <span>
            <EyeOutlined /> {post.viewCount} 浏览
          </span>
        </Space>
      </Card>

      <Card title={`评论 (${post.commentCount})`} style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 24 }}>
          {replyTarget && (
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <Text type="secondary">正在回复：{replyTarget.authorName}</Text>
              <Button type="link" size="small" onClick={() => setReplyTarget(null)}>
                取消
              </Button>
            </div>
          )}
          <TextArea
            rows={3}
            value={commentContent}
            onChange={(event) => setCommentContent(event.target.value)}
            placeholder={replyTarget ? `回复 ${replyTarget.authorName}...` : '写下你的评论...'}
            maxLength={1000}
          />
          <Button
            type="primary"
            style={{ marginTop: 8 }}
            onClick={handleSubmitComment}
            loading={submitting}
            disabled={!commentContent.trim()}
          >
            发表评论
          </Button>
        </div>

        <Spin spinning={commentsLoading}>
          {comments.length > 0 ? (
            <List
              dataSource={comments}
              renderItem={(comment) => (
                <List.Item>
                  <div style={{ width: '100%' }}>
                    {(() => {
                      const replyState = expandedReplies[comment.id]
                      const visibleReplies = replyState?.expanded ? replyState.items : (comment.replies || [])
                      const hasMoreReplies = (comment.replyCount || 0) > (comment.replies?.length || 0)

                      return (
                        <>
                    <List.Item.Meta
                      avatar={<Avatar icon={<UserOutlined />} src={comment.author?.avatar} />}
                      title={
                        <Space>
                          <Text strong>
                            {comment.author?.nickname || comment.author?.username || '用户'}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {new Date(comment.createdAt).toLocaleString()}
                          </Text>
                          {canDeleteComment(comment.authorId) && (
                            <Button
                              type="link"
                              size="small"
                              danger
                              onClick={() => handleDeleteComment(comment.id)}
                            >
                              删除
                            </Button>
                          )}
                          {canReportComment(comment.authorId) && (
                            <Button
                              type="link"
                              size="small"
                              danger
                              onClick={() => openReportModal({
                                targetType: 'comment',
                                targetId: comment.id,
                                label: '评论',
                              })}
                            >
                              举报
                            </Button>
                          )}
                        </Space>
                      }
                      description={
                        <>
                          <div>{comment.content}</div>
                          <div style={{ marginTop: 8 }}>
                            <Button
                              type="link"
                              size="small"
                              style={{ paddingLeft: 0 }}
                              onClick={() => setReplyTarget({
                                parentId: comment.id,
                                replyToId: comment.id,
                                authorName: comment.author?.nickname || comment.author?.username || '用户',
                              })}
                            >
                              回复
                            </Button>
                          </div>
                        </>
                      }
                    />

                    {!!visibleReplies.length && (
                      <div style={{ marginLeft: 52, marginTop: 8, padding: 12, background: '#f7f9fc', borderRadius: 12 }}>
                        {visibleReplies.map((reply) => (
                          <div key={reply.id} style={{ marginBottom: 12 }}>
                            <Space size={8} wrap>
                              <Text strong>{reply.author?.nickname || reply.author?.username || '用户'}</Text>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {new Date(reply.createdAt).toLocaleString()}
                              </Text>
                              {canDeleteComment(reply.authorId) && (
                                <Button
                                  type="link"
                                  size="small"
                                  danger
                                  onClick={() => handleDeleteComment(reply.id)}
                                >
                                  删除
                                </Button>
                              )}
                              {canReportComment(reply.authorId) && (
                                <Button
                                  type="link"
                                  size="small"
                                  danger
                                  onClick={() => openReportModal({
                                    targetType: 'comment',
                                    targetId: reply.id,
                                    label: '回复',
                                  })}
                                >
                                  举报
                                </Button>
                              )}
                            </Space>
                            <Paragraph style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{reply.content}</Paragraph>
                            <Button
                              type="link"
                              size="small"
                              style={{ paddingLeft: 0 }}
                              onClick={() => setReplyTarget({
                                parentId: comment.id,
                                replyToId: reply.id,
                                authorName: reply.author?.nickname || reply.author?.username || '用户',
                              })}
                            >
                              回复
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {(hasMoreReplies || replyState?.expanded) && (
                      <div style={{ marginLeft: 52, marginTop: 8 }}>
                        {replyState?.expanded ? (
                          <Space size={12} wrap>
                            <Button type="link" size="small" style={{ paddingLeft: 0 }} onClick={() => collapseReplies(comment.id)}>
                              收起回复
                            </Button>
                            {replyState.totalPages > 1 && (
                              <>
                                <Button
                                  type="link"
                                  size="small"
                                  disabled={replyState.page <= 1 || replyState.loading}
                                  onClick={() => loadReplies(comment.id, replyState.page - 1)}
                                >
                                  上一页
                                </Button>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {replyState.page} / {replyState.totalPages}
                                </Text>
                                <Button
                                  type="link"
                                  size="small"
                                  disabled={replyState.page >= replyState.totalPages || replyState.loading}
                                  onClick={() => loadReplies(comment.id, replyState.page + 1)}
                                >
                                  下一页
                                </Button>
                              </>
                            )}
                          </Space>
                        ) : (
                          <Button
                            type="link"
                            size="small"
                            style={{ paddingLeft: 0 }}
                            loading={replyState?.loading}
                            onClick={() => loadReplies(comment.id)}
                          >
                            查看全部回复 ({comment.replyCount || 0})
                          </Button>
                        )}
                      </div>
                    )}
                        </>
                      )
                    })()}
                  </div>
                </List.Item>
              )}
              pagination={{
                current: commentPagination.page,
                total: commentPagination.total,
                pageSize: commentPagination.pageSize,
                onChange: (page) => {
                  if (!id) return
                  fetchComments(Number(id), page)
                },
                showTotal: (total) => `共 ${total} 条`,
              }}
            />
          ) : (
            <Empty description="暂无评论，来说点什么吧" />
          )}
        </Spin>
      </Card>

      <Modal
        title="编辑帖子"
        open={showEditModal}
        onCancel={handleCloseEdit}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitEdit}
          initialValues={{ isAnonymous: false, categoryId: '' }}
        >
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="请输入帖子标题" maxLength={100} />
          </Form.Item>
          <Form.Item name="categoryId" label="分类">
            <Select options={postCategoryOptions} />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}>
            <Input.TextArea rows={6} placeholder="分享您的经验..." maxLength={5000} showCount />
          </Form.Item>
          <Form.Item name="isAnonymous" label="匿名发布" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={editSubmitting}>
              保存修改
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={reportTarget ? `举报${reportTarget.label}` : '举报内容'}
        open={showReportModal}
        onCancel={handleCloseReport}
        footer={null}
        destroyOnClose
      >
        <Form form={reportForm} layout="vertical" onFinish={handleSubmitReport}>
          <Form.Item name="reason" label="举报原因" rules={[{ required: true, message: '请选择举报原因' }]}>
            <Select options={reportReasonOptions} placeholder="请选择原因" />
          </Form.Item>
          <Form.Item name="description" label="补充说明">
            <Input.TextArea rows={4} maxLength={500} showCount placeholder="可选，补充更多上下文帮助审核" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={reportSubmitting}>
              提交举报
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
