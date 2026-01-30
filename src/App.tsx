import { Routes, Route } from 'react-router-dom'
import { Navigation, StatusBar } from './components'
import { ChatPage, TasksPage, DigestsPage, AgentsPage, ActivityPage } from './pages'

function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <StatusBar />
      
      <main>
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/digests" element={<DigestsPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/activity" element={<ActivityPage />} />
        </Routes>
      </main>
      
      <Navigation />
    </div>
  )
}

export default App
