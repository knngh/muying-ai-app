import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Typography,
  Button,
  Space,
  Tag,
  Input,
  List,
  Avatar,
  Spin,
  message,
  Divider,
} from 'antd'
import {
  ArrowLeftOutlined,
  LikeOutlined,
  LikeFilled,
  MessageOutlined,
  EyeOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { communityApi, CommunityPost, CommunityComment } from '@/api/community'

const { Title, Paragraph, Text } = Typography
const { TextArea } = Input

export function PostDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [post, setPost] = useState<CommunityPost | null>(null)
  const [comments, setComments] = useState<CommunityComment[]>([])
  const [loading, setLoading] = useState(true)
  const [commentContent, setCommentContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (id) {
      fetchPost(Number(id))
      fetchComments(Number(id))
    }
  }, [id])

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

  const fetchComments = async (postId: number) => {
    try {
      const result = await communityApi.getComments(postId)
      const data = result as unknown as { list: CommunityComment[] }
      setComments(data.list || [])
    } catch (_error) {
      console.error('获取评论失败:', _error)
    }
  }

  const handleLike = async () => {
    if (!post) return
    const token = localStorage.getItem('token')
    if (!token) {
      message.warning('请先登录')
      navigate('/login')
      return
    }
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

  const handleSubmitComment = async () => {
    if (!commentContent.trim() || !id) return
    const token = localStorage.getItem('token')
    if (!token) {
      message.warning('请先登录')
      navigate('/login')
      return
    }
    setSubmitting(true)
    try {
      const newComment = (await communityApi.createComment(Number(id), {
        content: commentContent.trim(),
      })) as CommunityComment
      setComments([newComment, ...comments])
      setCommentContent('')
      if (post) {
        setPost({ ...post, commentCount: post.commentCount + 1 })
      }
      message.success('评论成功')
    } catch (_error) {
      if (import.meta.env.DEV) {
        message.warning('API 不可用，开发模式模拟评论')
        setCommentContent('')
      } else {
        message.error('评论失败')
      }
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

      {/* 帖子内容 */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
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

        <Title level={3}>
          {post.isPinned && <Tag color="red">置顶</Tag>}
          {post.title}
        </Title>

        <Paragraph style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: 15 }}>
          {post.content}
        </Paragraph>

        {post.category && <Tag style={{ marginBottom: 16 }}>{post.category}</Tag>}

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

      {/* 评论区 */}
      <Card title={`评论 (${post.commentCount})`} style={{ marginTop: 16 }}>
        {/* 发评论 */}
        <div style={{ marginBottom: 24 }}>
          <TextArea
            rows={3}
            value={commentContent}
            onChange={(e) => setCommentContent(e.target.value)}
            placeholder="写下你的评论..."
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

        {/* 评论列表 */}
        <List
          dataSource={comments}
          locale={{ emptyText: '暂无评论，来说点什么吧' }}
          renderItem={(comment) => (
            <List.Item>
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
                  </Space>
                }
                description={comment.content}
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  )
}
