import { ReactNode } from 'react'
import { Layout as AntLayout, Menu } from 'antd'
import {
  HomeOutlined,
  BookOutlined,
  CalendarOutlined,
  UserOutlined,
  MessageOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import styles from './Layout.module.css'

const { Header, Content, Footer } = AntLayout

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = [
    { key: '/', icon: <HomeOutlined />, label: '首页' },
    { key: '/chat', icon: <MessageOutlined />, label: 'AI问答' },
    { key: '/knowledge', icon: <BookOutlined />, label: '知识库' },
    { key: '/community', icon: <TeamOutlined />, label: '社区' },
    { key: '/calendar', icon: <CalendarOutlined />, label: '日历' },
    { key: '/profile', icon: <UserOutlined />, label: '我的' },
  ]

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
  }

  return (
    <AntLayout className={styles.layout}>
      <Header className={styles.header}>
        <div className={styles.logo}>母婴AI助手</div>
        <Menu
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          className={styles.menu}
          style={{ flex: 1, minWidth: 0 }}
        />
      </Header>
      <Content className={styles.content}>
        <div className={styles.container}>{children}</div>
      </Content>
      <Footer className={styles.footer}>
        母婴AI助手 ©{new Date().getFullYear()} Created with ❤️
        <br />
        <span style={{ fontSize: 12, color: '#999' }}>
          ⚠️ 本平台内容仅供参考，不构成医疗建议。如有不适请立即就医。
        </span>
      </Footer>
    </AntLayout>
  )
}