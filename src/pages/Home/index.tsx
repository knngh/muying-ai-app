import { Card, Typography, Row, Col, Button } from 'antd'
import { RocketOutlined, HeartOutlined, SafetyOutlined } from '@ant-design/icons'

const { Title, Paragraph } = Typography

export function Home() {
  const features = [
    {
      icon: <RocketOutlined style={{ fontSize: 32, color: '#1890ff' }} />,
      title: 'AI智能问答',
      description: '专业的母婴知识问答，为您提供个性化建议',
    },
    {
      icon: <HeartOutlined style={{ fontSize: 32, color: '#eb2f96' }} />,
      title: '孕育日历',
      description: '追踪孕期里程碑，记录宝宝成长的每一刻',
    },
    {
      icon: <SafetyOutlined style={{ fontSize: 32, color: '#52c41a' }} />,
      title: '科学指导',
      description: '基于权威医学知识，为您和宝宝保驾护航',
    },
  ]

  return (
    <div>
      <Card style={{ marginBottom: 24, textAlign: 'center' }}>
        <Title level={2}>欢迎使用母婴AI助手</Title>
        <Paragraph style={{ fontSize: 16, color: '#666' }}>
          您的专属母婴健康顾问，陪伴您度过孕育的每一阶段
        </Paragraph>
        <Button type="primary" size="large">
          开始咨询
        </Button>
      </Card>

      <Row gutter={[16, 16]}>
        {features.map((feature, index) => (
          <Col xs={24} sm={12} md={8} key={index}>
            <Card hoverable style={{ textAlign: 'center', height: '100%' }}>
              <div style={{ marginBottom: 16 }}>{feature.icon}</div>
              <Title level={4}>{feature.title}</Title>
              <Paragraph style={{ color: '#666' }}>{feature.description}</Paragraph>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}