import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Typography, Tag, Space, Button, Spin, Divider, message } from 'antd'
import { ArrowLeftOutlined, HeartOutlined, StarOutlined, EyeOutlined } from '@ant-design/icons'
import { useKnowledgeStore } from '@/stores/knowledgeStore'

const { Title, Paragraph, Text } = Typography

export function KnowledgeDetail() {
  const { id: slug } = useParams<{ id: string }>()
  const navigate = useNavigate()
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
  }, [slug])

  // 处理点赞
  const handleLike = async () => {
    if (currentArticle) {
      await likeArticle(currentArticle.id)
      message.success('点赞成功')
    }
  }

  // 处理收藏
  const handleFavorite = async () => {
    if (currentArticle) {
      await favoriteArticle(currentArticle.id)
      message.success('收藏成功')
    }
  }

  // 返回列表
  const goBack = () => {
    navigate('/knowledge')
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error || !currentArticle) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: 50 }}>
          <Title level={4}>文章不存在或已删除</Title>
          <Button type="primary" onClick={goBack}>返回列表</Button>
        </div>
      </Card>
    )
  }

  return (
    <div>
      {/* 返回按钮 */}
      <Button 
        type="text" 
        icon={<ArrowLeftOutlined />} 
        onClick={goBack}
        style={{ marginBottom: 16 }}
      >
        返回列表
      </Button>

      {/* 文章内容 */}
      <Card>
        {/* 标题 */}
        <Title level={2}>{currentArticle.title}</Title>
        
        {/* 标签信息 */}
        <Space style={{ marginBottom: 16 }} wrap>
          {currentArticle.category && (
            <Tag color="blue">{currentArticle.category.name}</Tag>
          )}
          {currentArticle.stage && (
            <Tag color="green">{currentArticle.stage}</Tag>
          )}
          {currentArticle.tags?.map(tag => (
            <Tag key={tag.id}>{tag.name}</Tag>
          ))}
        </Space>

        {/* 元信息 */}
        <Space split={<Divider type="vertical" />} style={{ marginBottom: 24 }}>
          {currentArticle.author && (
            <Text type="secondary">作者：{currentArticle.author}</Text>
          )}
          {currentArticle.publishedAt && (
            <Text type="secondary">
              发布时间：{new Date(currentArticle.publishedAt).toLocaleDateString()}
            </Text>
          )}
          <Text type="secondary">
            <EyeOutlined /> {currentArticle.viewCount} 阅读
          </Text>
          <Text type="secondary">
            <HeartOutlined /> {currentArticle.likeCount} 点赞
          </Text>
        </Space>

        {/* 封面图 */}
        {currentArticle.coverImage && (
          <div style={{ marginBottom: 24 }}>
            <img 
              src={currentArticle.coverImage} 
              alt={currentArticle.title}
              style={{ width: '100%', maxHeight: 400, objectFit: 'cover', borderRadius: 8 }}
            />
          </div>
        )}

        {/* 摘要 */}
        <Paragraph 
          style={{ 
            fontSize: 16, 
            color: '#666', 
            background: '#f5f5f5', 
            padding: 16, 
            borderRadius: 8,
            marginBottom: 24 
          }}
        >
          {currentArticle.summary}
        </Paragraph>

        {/* 正文内容 */}
        <div
          className="article-content"
          style={{ lineHeight: 1.9, fontSize: 16 }}
          dangerouslySetInnerHTML={{ __html: currentArticle.content }}
        />

        <Divider />

        {/* 操作按钮 */}
        <Space size="large">
          <Button 
            type="primary" 
            icon={<HeartOutlined />}
            onClick={handleLike}
          >
            点赞 ({currentArticle.likeCount})
          </Button>
          <Button 
            icon={<StarOutlined />}
            onClick={handleFavorite}
          >
            收藏 ({currentArticle.collectCount})
          </Button>
          <Button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href)
              message.success('链接已复制')
            }}
          >
            分享
          </Button>
        </Space>
      </Card>
    </div>
  )
}
