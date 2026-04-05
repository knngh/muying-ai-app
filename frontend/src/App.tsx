import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { storage } from './utils/storage'

const Home = lazy(() => import('./pages/Home').then((module) => ({ default: module.Home })))
const Knowledge = lazy(() => import('./pages/Knowledge').then((module) => ({ default: module.Knowledge })))
const KnowledgeDetail = lazy(() => import('./pages/KnowledgeDetail').then((module) => ({ default: module.KnowledgeDetail })))
const Calendar = lazy(() => import('./pages/Calendar').then((module) => ({ default: module.Calendar })))
const Profile = lazy(() => import('./pages/Profile').then((module) => ({ default: module.Profile })))
const Chat = lazy(() => import('./pages/Chat').then((module) => ({ default: module.Chat })))
const Community = lazy(() => import('./pages/Community').then((module) => ({ default: module.Community })))
const PostDetail = lazy(() => import('./pages/Community/PostDetail').then((module) => ({ default: module.PostDetail })))
const CommunityReports = lazy(() => import('./pages/Community/Reports').then((module) => ({ default: module.CommunityReports })))
const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })))

// 需要登录的路由守卫
const ProtectedRoute = () => {
  const token = storage.getItem('token')
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
    <ErrorBoundary>
      <Suspense fallback={<div style={{ padding: 48, textAlign: 'center', color: '#666' }}>加载中...</div>}>
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
              <Route path="community/reports" element={<CommunityReports />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="profile" element={<Profile />} />
            </Route>
          </Route>

          {/* 兜底路由 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
