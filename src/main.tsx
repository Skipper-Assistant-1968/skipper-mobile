import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

// Build info injected at build time
declare const __BUILD_TIMESTAMP__: string
declare const __BUILD_ID__: string
declare const __APP_VERSION__: string

// Expose build info globally for debugging and Settings page
window.__SKIPPER_BUILD__ = {
  version: __APP_VERSION__,
  buildId: __BUILD_ID__,
  timestamp: __BUILD_TIMESTAMP__,
}

console.log(`🚀 Skipper Mobile v${__APP_VERSION__} (build: ${__BUILD_ID__})`)

// Register service worker with update handling
const updateSW = registerSW({
  onNeedRefresh() {
    // New content available - force update immediately
    console.log('🔄 New version available! Reloading...')
    // Store flag so we can show "Just Updated" message after reload
    sessionStorage.setItem('skipper-just-updated', 'true')
    updateSW(true)
  },
  onOfflineReady() {
    console.log('📱 App ready for offline use')
  },
  onRegisteredSW(swUrl, registration) {
    console.log('✅ Service worker registered:', swUrl)
    
    // Check for updates on visibility change (when user opens the app)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && registration) {
        console.log('👀 App became visible, checking for updates...')
        registration.update().catch(console.error)
      }
    })
    
    // Also check when app comes back online
    window.addEventListener('online', () => {
      console.log('🌐 Back online, checking for updates...')
      registration?.update().catch(console.error)
    })
  },
  // Check for updates immediately on load
  immediate: true,
})

// Also check for updates every 5 minutes while active
setInterval(() => {
  console.log('⏰ Periodic update check...')
  updateSW()
}, 5 * 60 * 1000)

// Extend Window interface
declare global {
  interface Window {
    __SKIPPER_BUILD__: {
      version: string
      buildId: string
      timestamp: string
    }
  }
}

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
