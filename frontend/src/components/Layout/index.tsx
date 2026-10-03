import { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import styles from './Layout.module.css'
import { useCalendarNotifications } from '@/hooks/useCalendarNotifications'

interface LayoutProps {
  children: ReactNode
}

function isMenuItemActive(pathname: string, itemPath: string) {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
}

function getActiveMenuKey(pathname: string, items: Array<{ key: string }>) {
  return items
    .filter((item) => isMenuItemActive(pathname, item.key))
    .sort((left, right) => right.key.length - left.key.length)[0]?.key
}

export function Layout({ children }: LayoutProps) {
  useCalendarNotifications()
  const navigate = useNavigate()
  const location = useLocation()

  // 网页版导航（2026-09-28）：知识库 / AI问答 / 孕育日历 / 工具 / 我的；未登录访问受限页自动跳登录
  const menuItems = [
    { key: '/knowledge', label: '知识库', hint: 'Knowledge' },
    { key: '/chat', label: 'AI问答', hint: 'Chat' },
    { key: '/calendar', label: '孕育日历', hint: 'Calendar' },
    { key: '/tools', label: '工具', hint: 'Tools' },
    { key: '/profile', label: '我的', hint: 'Profile' },
  ]
  const activeMenuKey = getActiveMenuKey(location.pathname, menuItems)

  const handleMenuClick = (key: string) => {
    navigate(key)
  }

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brandBlock}>
            <div className={styles.brandBadge}>MY</div>
            <div>
              <div className={styles.logo}>母婴AI助手</div>
              <p className={styles.tagline}>孕育知识、记录与支持，集中在一个入口里。</p>
            </div>
          </div>
          <nav className={styles.nav} aria-label="主导航">
            {menuItems.map((item) => {
              const active = item.key === activeMenuKey
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleMenuClick(item.key)}
                  className={active ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
                >
                  <span className={styles.navHint}>{item.hint}</span>
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </header>
      <main className={styles.content}>
        <div className={styles.container}>{children}</div>
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p>母婴AI助手 ©{new Date().getFullYear()}</p>
          <p>本平台内容仅供参考，不构成医疗建议。如有不适请立即就医。</p>
        </div>
      </footer>
    </div>
  )
}
