import { useEffect, useState } from 'react'
import { Card, Typography, Row, Col, Button, Spin, List, Tag, Space } from 'antd'
import { RocketOutlined, HeartOutlined, SafetyOutlined, BookOutlined, RightOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { articleApi } from '@/api/modules'
import type { Article } from '@/api/modules'

const { Title, Paragraph, Text } = Typography

export function Home() {
  const navigate = useNavigate()
  const [recommendedArticles, setRecommendedArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // 获取推荐文章
    fetchRecommended()
  }, [])

  const fetchRecommended = async () => {
    setLoading(true)
    try {
      const articles = await articleApi.getRecommended(5) as Article[]
      setRecommendedArticles(articles)
    } catch (error) {
      console.error('获取推荐文章失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const features = [
    {
      icon: <RocketOutlined style={{ fontSize: 32, color: '#1890ff' }} />,
      title: 'AI智能问答',
      description: '专业的母婴知识问答，为您提供个性化建议',
      action: () => navigate('/chat'),
    },
    {
      icon: <HeartOutlined style={{ fontSize: 32, color: '#eb2f96' }} />,
      title: '孕育日历',
      description: '追踪孕期里程碑，记录宝宝成长的每一刻',
      action: () => navigate('/calendar'),
    },
    {
      icon: <SafetyOutlined style={{ fontSize: 32, color: '#52c41a' }} />,
      title: '科学指导',
      description: '基于权威医学知识，为您和宝宝保驾护航',
      action: () => navigate('/knowledge'),
    },
  ]

  const categoryColors: Record<string, string> = {
    '孕期知识': 'pink',
    '育儿知识': 'blue',
    '营养健康': 'green',
    '疫苗接种': 'orange',
    '常见问题': 'purple',
  }

  return (
    <div>
      {/* Hero 区域 */}
      <Card 
        style={{ 
          marginBottom: 24, 
          textAlign: 'center',
          background: 'linear-gradient(135deg, #e6f7ff 0%, #f0f5ff 100%)',
          border: 'none',
        }}
      >
        <Title level={2} style={{ marginBottom: 8 }}>欢迎使用母婴AI助手</Title>
        <Paragraph style={{ fontSize: 16, color: '#666', marginBottom: 24 }}>
          您的专属母婴健康顾问，陪伴您度过孕育的每一阶段
        </Paragraph>
        <Button type="primary" size="large" icon={<RocketOutlined />} onClick={() => navigate('/chat')}>
          开始咨询
        </Button>
      </Card>

      {/* 功能卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {features.map((feature, index) => (
          <Col xs={24} sm={12} md={8} key={index}>
            <Card 
              hoverable 
              style={{ textAlign: 'center', height: '100%' }}
              onClick={feature.action}
            >
              <div style={{ marginBottom: 16 }}>{feature.icon}</div>
              <Title level={4}>{feature.title}</Title>
              <Paragraph style={{ color: '#666' }}>{feature.description}</Paragraph>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 推荐文章 */}
      <Card 
        title={
          <Space>
            <BookOutlined style={{ color: '#1890ff' }} />
            <span>推荐阅读</span>
          </Space>
        }
        extra={
          <Button type="link" onClick={() => navigate('/knowledge')}>
            查看更多 <RightOutlined />
          </Button>
        }
      >
        <Spin spinning={loading}>
          {recommendedArticles.length > 0 ? (
            <List
              itemLayout="horizontal"
              dataSource={recommendedArticles}
              renderItem={(article) => (
                <List.Item
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/knowledge/${article.id}`)}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text>{article.title}</Text>
                        {article.category && (
                          <Tag color={categoryColors[article.category.name] || 'default'} style={{ marginLeft: 8 }}>
                            {article.category.name}
                          </Tag>
                        )}
                      </Space>
                    }
                    description={article.summary}
                  />
                </List.Item>
              )}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <Text type="secondary">暂无推荐内容</Text>
            </div>
          )}
        </Spin>
      </Card>

      {/* 快速入口 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={12} sm={6}>
          <Card 
            hoverable 
            style={{ textAlign: 'center' }}
            onClick={() => navigate('/knowledge?stage=first-trimester')}
          >
            <Title level={5}>孕早期</Title>
            <Text type="secondary">1-12周</Text>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card 
            hoverable 
            style={{ textAlign: 'center' }}
            onClick={() => navigate('/knowledge?stage=second-trimester')}
          >
            <Title level={5}>孕中期</Title>
            <Text type="secondary">13-27周</Text>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card 
            hoverable 
            style={{ textAlign: 'center' }}
            onClick={() => navigate('/knowledge?stage=third-trimester')}
          >
            <Title level={5}>孕晚期</Title>
            <Text type="secondary">28-40周</Text>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card 
            hoverable 
            style={{ textAlign: 'center' }}
            onClick={() => navigate('/calendar')}
          >
            <Title level={5}>产检日历</Title>
            <Text type="secondary">查看日程</Text>
          </Card>
        </Col>
      </Row>
    </div>
  )
}