import { Card, Input, List, Tag, Typography } from 'antd'
import { SearchOutlined, BookOutlined } from '@ant-design/icons'

const { Title, Paragraph } = Typography

const knowledgeData = [
  {
    id: 1,
    title: '孕期营养指南',
    category: '营养健康',
    stage: '孕期',
    summary: '了解孕期各阶段所需的营养元素，科学搭配饮食...',
  },
  {
    id: 2,
    title: '新生儿护理要点',
    category: '育儿知识',
    stage: '0-1岁',
    summary: '新生儿护理的基础知识，帮助新手父母快速上手...',
  },
  {
    id: 3,
    title: '产检时间表',
    category: '常见问题',
    stage: '孕期',
    summary: '完整的孕期产检时间安排，不错过任何重要检查...',
  },
]

const categoryColors: Record<string, string> = {
  营养健康: 'green',
  育儿知识: 'blue',
  常见问题: 'orange',
}

export function Knowledge() {
  return (
    <div>
      <Card style={{ marginBottom: 24 }}>
        <Title level={3}>
          <BookOutlined /> 知识库
        </Title>
        <Paragraph>浏览专业的母婴知识，获取科学育儿指导</Paragraph>
        <Input
          placeholder="搜索知识..."
          prefix={<SearchOutlined />}
          size="large"
        />
      </Card>

      <List
        itemLayout="vertical"
        dataSource={knowledgeData}
        renderItem={(item) => (
          <List.Item>
            <Card hoverable>
              <Title level={4}>{item.title}</Title>
              <div style={{ marginBottom: 8 }}>
                <Tag color={categoryColors[item.category]}>{item.category}</Tag>
                <Tag>{item.stage}</Tag>
              </div>
              <Paragraph style={{ marginBottom: 0, color: '#666' }}>
                {item.summary}
              </Paragraph>
            </Card>
          </List.Item>
        )}
      />
    </div>
  )
}