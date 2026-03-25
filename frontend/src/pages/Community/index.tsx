import { useState, useEffect } from 'react'
import {
  Card,
  List,
  Typography,
  Button,
  Space,
  Tag,
  Input,
  Select,
  Modal,
  Form,
  message,
  Spin,
  Empty,
  Avatar,
} from 'antd'
import {
  PlusOutlined,
  LikeOutlined,
  LikeFilled,
  MessageOutlined,
  EyeOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { communityApi, CommunityPost } from '@/api/community'

const { Title, Paragraph, Text } = Typography
const { Search } = Input

const categoryOptions = [
  { label: '全部', value: '' },
]

const sortOptions = [
  { label: '最新', value: 'latest' as const },
  { label: '最热', value: 'hot' as const },
  { label: '最多赞', value: 'popular' as const },
]

export function Community() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<'latest' | 'hot' | 'popular'>('latest')
  const [keyword, setKeyword] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchPosts()
  }, [page, category, sort])

  const fetchPosts = async () => {
    setLoading(true)
    try {
      const result = await communityApi.getPosts({
        page,
        pageSize: 10,
        sort,
        keyword: keyword || undefined,
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

  const handleSearch = (value: string) => {
    setKeyword(value)
    setPage(1)
    fetchPosts()
  }

  const handleLike = async (postId: number, isLiked: boolean) => {
    const token = localStorage.getItem('token')
    if (!token) {
      message.warning('请先登录')
      navigate('/login')
      return
    }
    try {
      if (isLiked) {
        await communityApi.unlikePost(postId)
      } else {
        await communityApi.likePost(postId)
      }
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, isLiked: !isLiked, likeCount: p.likeCount + (isLiked ? -1 : 1) }
            : p
        )
      )
    } catch (_error) {
      message.error('操作失败')
    }
  }

  const handleCreatePost = async (values: { title: string; content: string; category?: string }) => {
    setCreateLoading(true)
    try {
      await communityApi.createPost(values)
      message.success('发帖成功')
      setShowCreateModal(false)
      form.resetFields()
      fetchPosts()
    } catch (_error) {
      if (import.meta.env.DEV) {
        message.warning('API 不可用，开发模式模拟发帖成功')
        setShowCreateModal(false)
        form.resetFields()
      } else {
        message.error('发帖失败')
      }
    } finally {
      setCreateLoading(false)
    }
  }

  const handleCreateClick = () => {
    const token = localStorage.getItem('token')
    if (!token) {
      message.warning('请先登录')
      navigate('/login')
      return
    }
    setShowCreateModal(true)
  }

  return (
    <div>
      {/* 头部 */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>
            社区交流
          </Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateClick}>
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
            onChange={(v) => { setCategory(v); setPage(1) }}
            options={categoryOptions}
            style={{ width: 120 }}
          />
          <Select
            value={sort}
            onChange={(v) => { setSort(v); setPage(1) }}
            options={sortOptions}
            style={{ width: 100 }}
          />
        </Space>
      </Card>

      {/* 帖子列表 */}
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
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  <Avatar size="small" icon={<UserOutlined />} src={post.author?.avatar} />
                  <Text style={{ marginLeft: 8 }}>
                    {post.isAnonymous ? '匿名用户' : post.author?.nickname || post.author?.username || '用户'}
                  </Text>
                  <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 12 }}>
                    {new Date(post.createdAt).toLocaleDateString()}
                  </Text>
                </div>

                <Title level={5} style={{ marginBottom: 8 }}>
                  {post.isPinned && <Tag color="red">置顶</Tag>}
                  {post.title}
                </Title>
                <Paragraph ellipsis={{ rows: 2 }} style={{ color: '#666', marginBottom: 12 }}>
                  {post.content}
                </Paragraph>

                <Space size="large">
                  <span
                    onClick={(e) => { e.stopPropagation(); handleLike(post.id, !!post.isLiked) }}
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
                  {post.category && <Tag>{post.category}</Tag>}
                </Space>
              </Card>
            )}
            pagination={{
              current: page,
              total,
              pageSize: 10,
              onChange: setPage,
              showTotal: (t) => `共 ${t} 条`,
            }}
          />
        ) : (
          <Empty description="暂无帖子" />
        )}
      </Spin>

      {/* 发帖弹窗 */}
      <Modal
        title="发布帖子"
        open={showCreateModal}
        onCancel={() => setShowCreateModal(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreatePost}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="请输入帖子标题" maxLength={100} />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}>
            <Input.TextArea rows={6} placeholder="分享您的经验..." maxLength={5000} showCount />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={createLoading}>
              发布
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
