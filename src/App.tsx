import { Routes, Route } from 'react-router-dom'
import { Navigation, StatusBar } from './components'
import { ChatPage, TasksPage, DigestsPage, HotTopicsPage, AgentsPage, AgentDetailPage, ActivityPage, SettingsPage } from './pages'
import { ThemeProvider, useTheme } from './context/ThemeContext'

function AppContent() {
  const { isDark } = useTheme()
  
  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      isDark 
        ? 'bg-slate-900 text-white' 
        : 'bg-slate-50 text-slate-900'
    }`}>
      <StatusBar />
      
      <main>
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/digests" element={<DigestsPage />} />
          <Route path="/hot-topics" element={<HotTopicsPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/agents/:sessionKey" element={<AgentDetailPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      
      <Navigation />
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

export default App
