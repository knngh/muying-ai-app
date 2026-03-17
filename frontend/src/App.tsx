import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Knowledge } from './pages/Knowledge'
import { KnowledgeDetail } from './pages/KnowledgeDetail'
import { Calendar } from './pages/Calendar'
import { Profile } from './pages/Profile'
import { Chat } from './pages/Chat'
import { Login } from './pages/Login'
import { Community } from './pages/Community'
import { PostDetail } from './pages/Community/PostDetail'

// 需要登录的路由守卫
const ProtectedRoute = () => {
  const token = localStorage.getItem('token')
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

// 带 Layout 的路由
const LayoutRoute = () => {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* 带 Layout 的页面 */}
      <Route element={<LayoutRoute />}>
        {/* 公开页面 */}
        <Route index element={<Home />} />
        <Route path="knowledge" element={<Knowledge />} />
        <Route path="knowledge/:id" element={<KnowledgeDetail />} />
        <Route path="chat" element={<Chat />} />
        <Route path="community" element={<Community />} />
        <Route path="community/:id" element={<PostDetail />} />

        {/* 需要登录的页面 */}
        <Route element={<ProtectedRoute />}>
          <Route path="calendar" element={<Calendar />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Route>

      {/* 兜底路由 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
