import { useState } from 'react'
import { Card, Form, Input, Button, Typography, message, Divider } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import { authApi } from '@/api/modules'

const { Title, Text, Link } = Typography

type AuthMode = 'login' | 'register'

export function Login() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const setUser = useAppStore((s) => s.setUser)

  const handleSubmit = async (values: {
    username: string
    password: string
    phone?: string
    email?: string
  }) => {
    setLoading(true)
    try {
      const result =
        mode === 'login'
          ? await authApi.login({ username: values.username, password: values.password })
          : await authApi.register({
              username: values.username,
              password: values.password,
              phone: values.phone,
              email: values.email,
            })

      localStorage.setItem('token', result.token)
      setUser(result.user)
      message.success(mode === 'login' ? '登录成功' : '注册成功')
      navigate('/')
    } catch (_error) {
      if (import.meta.env.DEV) {
        // 开发模式降级 mock
        const mockUser = {
          id: '1',
          username: values.username,
          nickname: values.username,
          createdAt: new Date().toISOString(),
        }
        localStorage.setItem('token', 'mock_token_' + Date.now())
        setUser(mockUser)
        message.warning('API 不可用，使用开发模式登录')
        navigate('/')
      } else {
        message.error(mode === 'login' ? '登录失败，请检查用户名和密码' : '注册失败，请重试')
      }
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    form.resetFields()
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #e6f7ff 0%, #f0f5ff 100%)',
        padding: 24,
      }}
    >
      <Card style={{ width: 400, maxWidth: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3}>母婴AI助手</Title>
          <Text type="secondary">{mode === 'login' ? '欢迎回来' : '创建您的账户'}</Text>
        </div>

        <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off">
          <Form.Item
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 2, message: '用户名至少2个字符' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名 / 手机号 / 邮箱" size="large" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: mode === 'register' ? 8 : 1, message: '密码至少8位' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
          </Form.Item>

          {mode === 'register' && (
            <>
              <Form.Item name="phone">
                <Input placeholder="手机号（选填）" size="large" maxLength={11} />
              </Form.Item>
              <Form.Item name="email" rules={[{ type: 'email', message: '请输入正确的邮箱' }]}>
                <Input placeholder="邮箱（选填）" size="large" />
              </Form.Item>
            </>
          )}

          <Form.Item>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>
              {mode === 'login' ? '登录' : '注册'}
            </Button>
          </Form.Item>
        </Form>

        <Divider />

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary">
            {mode === 'login' ? '还没有账号？' : '已有账号？'}
            <Link onClick={toggleMode}>{mode === 'login' ? '立即注册' : '立即登录'}</Link>
          </Text>
        </div>
      </Card>
    </div>
  )
}
