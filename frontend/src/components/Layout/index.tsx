import { ReactNode } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
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

  // 介绍页与知识库公开访问，记录与问答沿用登录守卫。
  const menuItems = [
    { key: '/', label: '首页' },
    { key: '/knowledge', label: '知识库' },
    { key: '/chat', label: 'AI问答' },
    { key: '/calendar', label: '孕育日历' },
    { key: '/tools', label: '工具' },
    { key: '/profile', label: '我的' },
  ]
  const activeMenuKey = getActiveMenuKey(location.pathname, menuItems)

  const handleMenuClick = (key: string) => {
    navigate(key)
  }

  return (
    <div className={styles.layout}>
      <a className={styles.skipLink} href="#main-content">跳到正文</a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.brandBlock} aria-label="贝护妈妈首页">
            <div className={styles.brandBadge}>MY</div>
            <div>
              <div className={styles.logo}>贝护妈妈</div>
              <p className={styles.tagline}>陪伴每一步孕育日常</p>
            </div>
          </Link>
          <nav className={styles.nav} aria-label="主导航">
            {menuItems.map((item) => {
              const active = item.key === activeMenuKey
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => handleMenuClick(item.key)}
                  className={active ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
                >
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </header>
      <main id="main-content" className={styles.content} tabIndex={-1}>
        <div className={styles.container}>{children}</div>
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p>贝护妈妈 ©{new Date().getFullYear()}</p>
          <p>本平台内容仅供参考，不构成医疗建议。如有不适请立即就医。</p>
        </div>
      </footer>
    </div>
  )
}
