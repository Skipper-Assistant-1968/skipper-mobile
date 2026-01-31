import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

// Register service worker with update handling
const updateSW = registerSW({
  onNeedRefresh() {
    // New content available - force update immediately
    console.log('🔄 New version available, updating...')
    updateSW(true)
  },
  onOfflineReady() {
    console.log('📱 App ready for offline use')
  },
  // Check for updates frequently
  immediate: true,
})

// Also check for updates every 5 minutes
setInterval(() => {
  updateSW()
}, 5 * 60 * 1000)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
