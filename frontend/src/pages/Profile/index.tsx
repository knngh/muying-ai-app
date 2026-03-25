import { useEffect, useState } from 'react'
import {
  Card,
  Avatar,
  Typography,
  Descriptions,
  Button,
  Form,
  Input,
  Select,
  DatePicker,
  Modal,
  message,
  Spin,
  Space,
} from 'antd'
import { UserOutlined, EditOutlined, LogoutOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import { authApi } from '@/api/modules'
import type { User } from '@/api/modules'
import dayjs from 'dayjs'

const { Title, Text } = Typography

export function Profile() {
  const navigate = useNavigate()
  const { user, setUser } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    setLoading(true)
    try {
      const userData = (await authApi.me()) as User
      setUser(userData)
    } catch (_error) {
      if (import.meta.env.DEV) {
        // DEV 模式使用 mock
        if (!user) {
          setUser({
            id: '1',
            username: 'mock_user',
            nickname: '测试用户',
            createdAt: new Date().toISOString(),
          })
        }
      } else {
        message.error('获取用户信息失败')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    form.setFieldsValue({
      nickname: user?.nickname || '',
      pregnancyStatus: user?.pregnancyStatus || undefined,
      dueDate: user?.dueDate ? dayjs(user.dueDate) : undefined,
      babyBirthday: user?.babyBirthday ? dayjs(user.babyBirthday) : undefined,
      babyGender: user?.babyGender || undefined,
    })
    setEditModalOpen(true)
  }

  const handleEditSubmit = async (values: {
    nickname?: string
    pregnancyStatus?: string
    dueDate?: dayjs.Dayjs
    babyBirthday?: dayjs.Dayjs
    babyGender?: string
  }) => {
    setEditLoading(true)
    try {
      const data = {
        nickname: values.nickname,
        pregnancyStatus: values.pregnancyStatus,
        dueDate: values.dueDate?.format('YYYY-MM-DD'),
        babyBirthday: values.babyBirthday?.format('YYYY-MM-DD'),
        babyGender: values.babyGender,
      }
      const updatedUser = (await authApi.updateProfile(data)) as User
      setUser(updatedUser)
      message.success('资料更新成功')
      setEditModalOpen(false)
    } catch (_error) {
      if (import.meta.env.DEV) {
        setUser({
          ...user!,
          nickname: values.nickname || user!.nickname,
          pregnancyStatus: values.pregnancyStatus,
          dueDate: values.dueDate?.format('YYYY-MM-DD'),
          babyBirthday: values.babyBirthday?.format('YYYY-MM-DD'),
          babyGender: values.babyGender,
        })
        message.warning('API 不可用，本地更新')
        setEditModalOpen(false)
      } else {
        message.error('更新失败')
      }
    } finally {
      setEditLoading(false)
    }
  }

  const handleLogout = () => {
    Modal.confirm({
      title: '确认退出',
      content: '确定要退出登录吗？',
      onOk: async () => {
        try {
          await authApi.logout()
        } catch (_e) {
          // 忽略错误
        }
        localStorage.removeItem('token')
        setUser(null)
        navigate('/login')
      },
    })
  }

  if (loading && !user) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Avatar size={80} icon={<UserOutlined />} src={user?.avatar} />
          <Title level={4} style={{ marginTop: 16, marginBottom: 4 }}>
            {user?.nickname || user?.username || '用户'}
          </Title>
          {user?.pregnancyStatus && (
            <Text type="secondary">
              {user.pregnancyStatus === 'pregnant'
                ? '孕期中'
                : user.pregnancyStatus === 'postpartum'
                  ? '产后'
                  : user.pregnancyStatus === 'preparing'
                    ? '备孕中'
                    : user.pregnancyStatus}
            </Text>
          )}
        </div>

        <Descriptions column={1} bordered>
          <Descriptions.Item label="用户名">{user?.username}</Descriptions.Item>
          {user?.phone && (
            <Descriptions.Item label="手机号">
              {user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}
            </Descriptions.Item>
          )}
          {user?.email && <Descriptions.Item label="邮箱">{user.email}</Descriptions.Item>}
          {user?.dueDate && (
            <Descriptions.Item label="预产期">
              {dayjs(user.dueDate).format('YYYY年MM月DD日')}
            </Descriptions.Item>
          )}
          {user?.babyBirthday && (
            <Descriptions.Item label="宝宝生日">
              {dayjs(user.babyBirthday).format('YYYY年MM月DD日')}
            </Descriptions.Item>
          )}
          {user?.babyGender && (
            <Descriptions.Item label="宝宝性别">
              {user.babyGender === 'male' ? '男' : user.babyGender === 'female' ? '女' : '未知'}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="注册时间">
            {user?.createdAt ? dayjs(user.createdAt).format('YYYY-MM-DD') : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Space style={{ width: '100%' }} direction="vertical">
          <Button icon={<EditOutlined />} block onClick={handleEdit}>
            编辑资料
          </Button>
          <Button icon={<LogoutOutlined />} block danger onClick={handleLogout}>
            退出登录
          </Button>
        </Space>
      </Card>

      {/* 编辑资料弹窗 */}
      <Modal
        title="编辑资料"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleEditSubmit}>
          <Form.Item name="nickname" label="昵称">
            <Input placeholder="请输入昵称" />
          </Form.Item>
          <Form.Item name="pregnancyStatus" label="状态">
            <Select
              placeholder="请选择"
              allowClear
              options={[
                { label: '备孕中', value: 'preparing' },
                { label: '孕期中', value: 'pregnant' },
                { label: '产后', value: 'postpartum' },
              ]}
            />
          </Form.Item>
          <Form.Item name="dueDate" label="预产期">
            <DatePicker style={{ width: '100%' }} placeholder="选择预产期" />
          </Form.Item>
          <Form.Item name="babyBirthday" label="宝宝生日">
            <DatePicker style={{ width: '100%' }} placeholder="选择宝宝生日" />
          </Form.Item>
          <Form.Item name="babyGender" label="宝宝性别">
            <Select
              placeholder="请选择"
              allowClear
              options={[
                { label: '男', value: 'male' },
                { label: '女', value: 'female' },
                { label: '未知', value: 'unknown' },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={editLoading}>
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
