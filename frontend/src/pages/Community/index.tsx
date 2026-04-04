import { useEffect, useState } from 'react'
import {
  Avatar,
  Button,
  Card,
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
  EyeOutlined,
  LikeFilled,
  LikeOutlined,
  MessageOutlined,
  PlusOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { communityApi, CommunityPost } from '@/api/community'
import { categoryApi, type Category } from '@/api/modules'
import { useAppStore } from '@/stores/appStore'

const { Paragraph, Text, Title } = Typography
const { Search } = Input

const sortOptions = [
  { label: '最新', value: 'latest' as const },
  { label: '最热', value: 'hot' as const },
  { label: '最多赞', value: 'popular' as const },
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
  const [showPostModal, setShowPostModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null)
  const [form] = Form.useForm()

  const currentUserId = user?.id ? String(user.id) : getUserIdFromToken()
  const isEditing = !!editingPost
  const categoryOptions = [
    { label: '全部', value: '' },
    ...categories.map((item) => ({ label: item.name, value: String(item.id) })),
  ]
  const postCategoryOptions = [
    { label: '不分类', value: '' },
    ...categories.map((item) => ({ label: item.name, value: String(item.id) })),
  ]

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    fetchPosts()
  }, [page, category, sort])

  const fetchCategories = async () => {
    try {
      const result = await categoryApi.getAll()
      setCategories((result || []).map((item) => ({ id: item.id, name: item.name })))
    } catch (_error) {
      setCategories([])
    }
  }

  const fetchPosts = async (options?: { page?: number; keyword?: string }) => {
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
    } catch (_error) {
      console.error('获取帖子失败:', _error)
    } finally {
      setLoading(false)
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

  const resetPostForm = () => {
    form.resetFields()
    form.setFieldsValue({ isAnonymous: false, categoryId: '' })
    setEditingPost(null)
  }

  const handleCloseModal = () => {
    setShowPostModal(false)
    resetPostForm()
  }

  const handleSearch = (value: string) => {
    setKeyword(value)
    setPage(1)
    fetchPosts({ page: 1, keyword: value })
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
            : item
        )
      )
    } catch (_error) {
      message.error('操作失败')
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
    form.setFieldsValue({
      title: post.title,
      content: post.content,
      isAnonymous: post.isAnonymous,
      categoryId: post.categoryId || '',
    })
    setShowPostModal(true)
  }

  const handleSubmitPost = async (values: {
    title: string
    content: string
    isAnonymous?: boolean
    categoryId?: string
  }) => {
    setSubmitting(true)
    try {
      if (editingPost) {
        await communityApi.updatePost(editingPost.id, {
          title: values.title.trim(),
          content: values.content.trim(),
          categoryId: values.categoryId || undefined,
          isAnonymous: Boolean(values.isAnonymous),
        })
        message.success('帖子已更新')
      } else {
        await communityApi.createPost({
          title: values.title.trim(),
          content: values.content.trim(),
          categoryId: values.categoryId || undefined,
          isAnonymous: Boolean(values.isAnonymous),
        })
        message.success('发帖成功')
      }

      handleCloseModal()
      setPage(1)
      fetchPosts({ page: 1 })
    } catch (_error) {
      message.error(editingPost ? '更新失败' : '发帖失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeletePost = (post: CommunityPost) => {
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

          const nextPage = posts.length === 1 && page > 1 ? page - 1 : page
          if (nextPage !== page) {
            setPage(nextPage)
          }
          fetchPosts({ page: nextPage })
        } catch (_error) {
          message.error('删除失败')
        }
      },
    })
  }

  const isOwnPost = (post: CommunityPost) => !!currentUserId && String(post.authorId) === currentUserId

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>
            社区交流
          </Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            发帖
          </Button>
        </div>

        <Search
          placeholder="搜索帖子..."
          allowClear
          onSearch={handleSearch}
          style={{ marginBottom: 16 }}
        />

        <Space>
          <Select
            value={category}
            onChange={(value) => {
              setCategory(value)
              setPage(1)
            }}
            options={categoryOptions}
            style={{ width: 120 }}
          />
          <Select
            value={sort}
            onChange={(value) => {
              setSort(value)
              setPage(1)
            }}
            options={sortOptions}
            style={{ width: 100 }}
          />
        </Space>
      </Card>

      <Spin spinning={loading}>
        {posts.length > 0 ? (
          <List
            dataSource={posts}
            renderItem={(post) => (
              <Card
                hoverable
                style={{ marginBottom: 12 }}
                onClick={() => navigate(`/community/${post.id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                    <Avatar size="small" icon={<UserOutlined />} src={post.author?.avatar} />
                    <div style={{ marginLeft: 8, minWidth: 0 }}>
                      <Text>
                        {post.isAnonymous ? '匿名用户' : post.author?.nickname || post.author?.username || '用户'}
                      </Text>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(post.createdAt).toLocaleString()}
                        </Text>
                      </div>
                    </div>
                  </div>
                  {isOwnPost(post) && (
                    <Space size={4}>
                      <Button
                        type="link"
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleOpenEdit(post)
                        }}
                      >
                        编辑
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        danger
                        onClick={(event) => {
                          event.stopPropagation()
                          handleDeletePost(post)
                        }}
                      >
                        删除
                      </Button>
                    </Space>
                  )}
                </div>

                <Title level={5} style={{ marginBottom: 8 }}>
                  {post.isPinned && <Tag color="red">置顶</Tag>}
                  {post.title}
                </Title>

                <Paragraph ellipsis={{ rows: 2 }} style={{ color: '#666', marginBottom: 12 }}>
                  {post.content}
                </Paragraph>

                <Space size="large" wrap>
                  <span
                    onClick={(event) => {
                      event.stopPropagation()
                      handleLike(post.id, !!post.isLiked)
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {post.isLiked ? <LikeFilled style={{ color: '#1890ff' }} /> : <LikeOutlined />}{' '}
                    {post.likeCount}
                  </span>
                  <span>
                    <MessageOutlined /> {post.commentCount}
                  </span>
                  <span>
                    <EyeOutlined /> {post.viewCount}
                  </span>
                  {(post.categoryName || post.category) && <Tag>{post.categoryName || post.category}</Tag>}
                  {post.isAnonymous && <Tag color="gold">匿名</Tag>}
                </Space>
              </Card>
            )}
            pagination={{
              current: page,
              total,
              pageSize: 10,
              onChange: setPage,
              showTotal: (value) => `共 ${value} 条`,
            }}
          />
        ) : (
          <Empty description="暂无帖子" />
        )}
      </Spin>

      <Modal
        title={isEditing ? '编辑帖子' : '发布帖子'}
        open={showPostModal}
        onCancel={handleCloseModal}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitPost}
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
            <Button type="primary" htmlType="submit" block loading={submitting}>
              {isEditing ? '保存修改' : '立即发布'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
