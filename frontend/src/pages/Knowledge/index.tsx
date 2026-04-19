import { useEffect } from 'react'
import { Card, Input, List, Tag, Typography, Spin, Empty, Row, Col, Select, Space, Button } from 'antd'
import { BookOutlined, HeartOutlined, StarOutlined, EyeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useKnowledgeStore } from '@/stores/knowledgeStore'
import type { Article } from '@/api/modules'

const { Title, Paragraph, Text } = Typography
const { Search } = Input

const stageOptions = [
  { label: '全部阶段', value: '' },
  { label: '备孕期', value: 'preparation' },
  { label: '孕早期 (1-12周)', value: 'first-trimester' },
  { label: '孕中期 (13-27周)', value: 'second-trimester' },
  { label: '孕晚期 (28-40周)', value: 'third-trimester' },
  { label: '0-6月', value: '0-6-months' },
  { label: '6-12月', value: '6-12-months' },
  { label: '1-3岁', value: '1-3-years' },
]

const categoryColors: Record<string, string> = {
  '孕期知识': 'pink',
  '育儿知识': 'blue',
  '营养健康': 'green',
  '疫苗接种': 'orange',
  '常见问题': 'purple',
}

export function Knowledge() {
  const navigate = useNavigate()
  const {
    articles,
    categories,
    tags,
    total,
    page,
    loading,
    selectedCategory,
    selectedStage,
    fetchArticles,
    fetchCategories,
    fetchTags,
    setCategory,
    setStage,
    search,
    likeArticle,
    favoriteArticle,
  } = useKnowledgeStore()

  useEffect(() => {
    fetchArticles({ reset: true })
    fetchCategories()
    fetchTags()
  }, [])

  // 处理搜索
  const handleSearch = (value: string) => {
    if (value.trim()) {
      search(value.trim())
    } else {
      fetchArticles({ reset: true })
    }
  }

  // 处理分类选择
  const handleCategoryChange = (categorySlug: string | null) => {
    setCategory(categorySlug)
  }

  // 处理阶段选择
  const handleStageChange = (stage: string) => {
    setStage(stage || null)
  }

  // 加载更多
  const loadMore = () => {
    if (!loading && articles.length < total) {
      fetchArticles({ page: page + 1 })
    }
  }

  // 跳转到详情
  const goToDetail = (slug: string) => {
    navigate(`/knowledge/${slug}`)
  }

  // 渲染文章卡片
  const renderArticle = (article: Article) => (
    <List.Item>
      <Card 
        hoverable 
        onClick={() => goToDetail(article.slug)}
        styles={{ body: { padding: 16 } }}
      >
        <Row gutter={16}>
          {article.coverImage && (
            <Col xs={24} sm={6}>
              <img 
                src={article.coverImage} 
                alt={article.title}
                style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8 }}
              />
            </Col>
          )}
          <Col xs={24} sm={article.coverImage ? 18 : 24}>
            <Title level={4} ellipsis={{ rows: 1 }}>{article.title}</Title>
            <Space style={{ marginBottom: 8 }} wrap>
              {article.category && (
                <Tag color={categoryColors[article.category.name] || 'default'}>
                  {article.category.name}
                </Tag>
              )}
              {article.stage && <Tag>{article.stage}</Tag>}
              {article.tags?.slice(0, 3).map(tag => (
                <Tag key={tag.id} color="blue">{tag.name}</Tag>
              ))}
            </Space>
            <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 8, color: '#666' }}>
              {article.summary}
            </Paragraph>
            <Space split={<Text type="secondary">·</Text>}>
              <Text type="secondary">
                <EyeOutlined /> {article.viewCount}
              </Text>
              <Text type="secondary">
                <HeartOutlined onClick={(e) => {
                  e.stopPropagation()
                  likeArticle(article.id)
                }} style={{ cursor: 'pointer' }} /> {article.likeCount}
              </Text>
              <Text type="secondary">
                <StarOutlined onClick={(e) => {
                  e.stopPropagation()
                  favoriteArticle(article.id)
                }} style={{ cursor: 'pointer' }} /> {article.collectCount}
              </Text>
            </Space>
          </Col>
        </Row>
      </Card>
    </List.Item>
  )

  return (
    <div>
      {/* 头部搜索区域 */}
      <Card style={{ marginBottom: 24 }}>
        <Title level={3}>
          <BookOutlined /> 知识库
        </Title>
        <Paragraph>浏览专业的母婴知识，获取科学育儿指导</Paragraph>
        
        {/* 搜索框 */}
        <Search
          placeholder="搜索知识..."
          allowClear
          enterButton="搜索"
          size="large"
          onSearch={handleSearch}
          style={{ marginBottom: 16 }}
        />
        
        {/* 筛选区域 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Select
              placeholder="选择分类"
              allowClear
              style={{ width: '100%' }}
              value={selectedCategory}
              onChange={handleCategoryChange}
              options={[
                { value: null, label: '全部分类' },
                ...categories.map(c => ({ value: c.slug, label: c.name }))
              ]}
            />
          </Col>
          <Col xs={24} sm={12}>
            <Select
              placeholder="选择阶段"
              allowClear
              style={{ width: '100%' }}
              value={selectedStage}
              onChange={handleStageChange}
              options={stageOptions}
            />
          </Col>
        </Row>
      </Card>

      {/* 热门标签 */}
      {tags.length > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <Text strong>热门标签：</Text>
          <Space wrap style={{ marginTop: 8 }}>
            {tags.slice(0, 10).map(tag => (
              <Tag 
                key={tag.id} 
                style={{ cursor: 'pointer' }}
                color="blue"
              >
                {tag.name}
              </Tag>
            ))}
          </Space>
        </Card>
      )}

      {/* 文章列表 */}
      <Spin spinning={loading}>
        {articles.length > 0 ? (
          <>
            <List
              itemLayout="vertical"
              dataSource={articles}
              renderItem={renderArticle}
            />
            {articles.length < total && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Button onClick={loadMore} loading={loading}>
                  加载更多 ({articles.length}/{total})
                </Button>
              </div>
            )}
          </>
        ) : (
          <Empty description="暂无相关内容" />
        )}
      </Spin>
    </div>
  )
}