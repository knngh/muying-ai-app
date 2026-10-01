import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { storage } from './utils/storage'

// 网页版页面开放状态（2026-09-28 决策）：
// - 开放：登录/注册、权威知识库、AI 问答、孕育日历、我的、工具箱（生长曲线/疫苗/打卡/起名）
// - 暂不开放：社区（Community）
const Knowledge = lazy(() => import('./pages/Knowledge').then((module) => ({ default: module.Knowledge })))
const KnowledgeDetail = lazy(() => import('./pages/KnowledgeDetail').then((module) => ({ default: module.KnowledgeDetail })))
const Chat = lazy(() => import('./pages/Chat').then((module) => ({ default: module.Chat })))
const Tools = lazy(() => import('./pages/Tools').then((module) => ({ default: module.Tools })))
const Growth = lazy(() => import('./pages/Tools/Growth').then((module) => ({ default: module.Growth })))
const Vaccines = lazy(() => import('./pages/Tools/Vaccines').then((module) => ({ default: module.Vaccines })))
const Checkin = lazy(() => import('./pages/Tools/Checkin').then((module) => ({ default: module.Checkin })))
const Names = lazy(() => import('./pages/Tools/Names').then((module) => ({ default: module.Names })))
const Calendar = lazy(() => import('./pages/Calendar').then((module) => ({ default: module.Calendar })))
const Profile = lazy(() => import('./pages/Profile').then((module) => ({ default: module.Profile })))
const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })))

// 带 Layout 的路由
const LayoutRoute = () => {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

// 首页入口：知识库免费开放作为网站主页（2026-09-28 产品逻辑：内容优先，AI 问答/工具等登录后可用）
const RootRedirect = () => {
  return <Navigate to="/knowledge" replace />
}

// 需要登录的路由守卫
const ProtectedRoute = () => {
  const token = storage.getItem('token')
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div style={{ padding: 48, textAlign: 'center', color: '#666' }}>加载中...</div>}>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* 公开页面 */}
          <Route element={<LayoutRoute />}>
            <Route index element={<RootRedirect />} />
            <Route path="knowledge" element={<Knowledge />} />
            <Route path="knowledge/:id" element={<KnowledgeDetail />} />
          </Route>

          {/* 需要登录的页面 */}
          <Route element={<ProtectedRoute />}>
            <Route element={<LayoutRoute />}>
              <Route path="chat" element={<Chat />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="tools" element={<Tools />} />
              <Route path="tools/growth" element={<Growth />} />
              <Route path="tools/vaccines" element={<Vaccines />} />
              <Route path="tools/checkin" element={<Checkin />} />
              <Route path="tools/names" element={<Names />} />
              <Route path="profile" element={<Profile />} />
            </Route>
          </Route>

          {/* 兜底路由 */}
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
