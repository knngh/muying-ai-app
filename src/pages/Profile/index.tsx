import { Card, Avatar, Typography, Descriptions, Button } from 'antd'
import { UserOutlined, EditOutlined, SettingOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

export function Profile() {
  return (
    <div>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Avatar size={80} icon={<UserOutlined />} />
          <Title level={4} style={{ marginTop: 16, marginBottom: 4 }}>
            准妈妈小美
          </Title>
          <Text type="secondary">孕周：28周</Text>
        </div>

        <Descriptions column={1} bordered>
          <Descriptions.Item label="预产期">2024年6月15日</Descriptions.Item>
          <Descriptions.Item label="末次月经">2023年9月8日</Descriptions.Item>
          <Descriptions.Item label="预产年龄">28岁</Descriptions.Item>
          <Descriptions.Item label="手机号">138****8888</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button icon={<EditOutlined />} block>
            编辑资料
          </Button>
          <Button icon={<SettingOutlined />} block>
            设置
          </Button>
        </div>
      </Card>
    </div>
  )
}