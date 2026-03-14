import { Card, Calendar as AntCalendar, Typography, List, Tag } from 'antd'
import { CalendarOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

const events = [
  { id: 1, date: '2024-03-15', title: '产检 - 唐筛', type: 'warning' },
  { id: 2, date: '2024-03-20', title: '疫苗接种', type: 'success' },
  { id: 3, date: '2024-03-25', title: '营养咨询', type: 'info' },
]

export function Calendar() {
  return (
    <div>
      <Card style={{ marginBottom: 24 }}>
        <Title level={3}>
          <CalendarOutlined /> 孕育日历
        </Title>
        <Text type="secondary">记录重要的孕育里程碑</Text>
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <AntCalendar />
      </Card>

      <Card title="近期事项">
        <List
          dataSource={events}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={item.title}
                description={item.date}
              />
              <Tag color={item.type}>{item.type === 'warning' ? '产检' : item.type === 'success' ? '疫苗' : '咨询'}</Tag>
            </List.Item>
          )}
        />
      </Card>
    </div>
  )
}