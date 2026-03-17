import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Knowledge } from './pages/Knowledge'
import { KnowledgeDetail } from './pages/KnowledgeDetail'
import { Calendar } from './pages/Calendar'
import { Profile } from './pages/Profile'
import { Chat } from './pages/Chat'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/knowledge" element={<Knowledge />} />
        <Route path="/knowledge/:id" element={<KnowledgeDetail />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </Layout>
  )
}

export default App