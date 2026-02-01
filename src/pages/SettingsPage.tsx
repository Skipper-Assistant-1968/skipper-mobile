import { useState, useEffect } from 'react'
import { PageContainer } from '../components/PageContainer'
import { useTheme } from '../context/ThemeContext'
import { Trash2, RefreshCw, Moon, Sun, Info, AlertCircle, CheckCircle, Loader2, Sparkles } from 'lucide-react'

// Get build info from global (injected at build time via Vite define)
const getBuildInfo = () => {
  if (typeof window !== 'undefined' && window.__SKIPPER_BUILD__) {
    return window.__SKIPPER_BUILD__
  }
  return { version: '0.1.0', buildId: 'dev', timestamp: new Date().toISOString() }
}

interface CacheInfo {
  name: string
  size?: number
}

export function SettingsPage() {
  const { isDark, toggleTheme } = useTheme()
  const [clearing, setClearing] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [cacheInfo, setCacheInfo] = useState<CacheInfo[] | null>(null)
  const [justUpdated, setJustUpdated] = useState(false)
  
  const buildInfo = getBuildInfo()
  
  // Check if we just updated
  useEffect(() => {
    const updated = sessionStorage.getItem('skipper-just-updated')
    if (updated) {
      setJustUpdated(true)
      sessionStorage.removeItem('skipper-just-updated')
      // Auto-dismiss after 5 seconds
      setTimeout(() => setJustUpdated(false), 5000)
    }
  }, [])

  // Get info about current caches
  const inspectCaches = async () => {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        const cacheDetails: CacheInfo[] = []
        
        for (const name of cacheNames) {
          const cache = await caches.open(name)
          const keys = await cache.keys()
          cacheDetails.push({ name, size: keys.length })
        }
        
        setCacheInfo(cacheDetails)
        setStatus({ type: 'info', message: `Found ${cacheNames.length} cache(s)` })
      } else {
        setStatus({ type: 'error', message: 'Cache API not available' })
      }
    } catch (err) {
      console.error('Error inspecting caches:', err)
      setStatus({ type: 'error', message: 'Failed to inspect caches' })
    }
  }

  // Clear all caches, unregister service worker, and reload
  const clearCacheAndReload = async () => {
    setClearing(true)
    setStatus({ type: 'info', message: 'Clearing caches...' })

    try {
      // Step 1: Clear all caches from CacheStorage
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        console.log('🗑️ Clearing caches:', cacheNames)
        
        await Promise.all(
          cacheNames.map(async (cacheName) => {
            const deleted = await caches.delete(cacheName)
            console.log(`  Cache "${cacheName}": ${deleted ? 'deleted' : 'failed'}`)
          })
        )
        
        setStatus({ type: 'info', message: `Cleared ${cacheNames.length} cache(s)` })
      }

      // Step 2: Unregister service worker
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        console.log('🔧 Unregistering service workers:', registrations.length)
        
        for (const registration of registrations) {
          await registration.unregister()
          console.log('  Unregistered:', registration.scope)
        }
      }

      // Step 3: Clear localStorage (optional - preserves theme preference)
      // Uncomment if you want a full reset:
      // localStorage.clear()

      setStatus({ type: 'success', message: 'Cache cleared! Reloading...' })

      // Step 4: Hard reload the page
      // Small delay so user can see success message
      setTimeout(() => {
        // Force reload from server, not cache
        window.location.reload()
      }, 500)

    } catch (err) {
      console.error('❌ Error clearing cache:', err)
      setStatus({ type: 'error', message: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` })
      setClearing(false)
    }
  }

  // Force update check without full clear
  const checkForUpdates = async () => {
    setStatus({ type: 'info', message: 'Checking for updates...' })
    
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration()
        
        if (registration) {
          // Force update check
          await registration.update()
          
          // Check if there's a waiting worker (new version ready)
          if (registration.waiting) {
            setStatus({ type: 'success', message: 'New version found! Activating...' })
            // Tell the waiting SW to take over
            registration.waiting.postMessage({ type: 'SKIP_WAITING' })
            // Mark that we're updating
            sessionStorage.setItem('skipper-just-updated', 'true')
            // Reload to get new version
            setTimeout(() => window.location.reload(), 500)
          } else if (registration.installing) {
            setStatus({ type: 'info', message: 'Update installing... Please wait.' })
          } else {
            setStatus({ type: 'success', message: `You're on the latest version (${buildInfo.buildId})` })
          }
        } else {
          setStatus({ type: 'info', message: 'No service worker registered' })
        }
      } else {
        setStatus({ type: 'error', message: 'Service workers not supported' })
      }
    } catch (err) {
      console.error('Error checking for updates:', err)
      setStatus({ type: 'error', message: 'Failed to check for updates' })
    }
  }

  return (
    <PageContainer title="Settings">
      <div className="space-y-6">
        
        {/* Just Updated Banner */}
        {justUpdated && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-emerald-400 font-medium">App Updated!</div>
              <div className="text-emerald-400/70 text-sm">You're now running the latest version</div>
            </div>
          </div>
        )}

        {/* App Info Section */}
        <section className={`rounded-xl border p-4 ${
          isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-blue-400" />
            <h2 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              App Info
            </h2>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Version</span>
              <span className={`font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {buildInfo.version}
              </span>
            </div>
            <div className="flex justify-between">
              <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Build ID</span>
              <span className={`font-mono text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {buildInfo.buildId}
              </span>
            </div>
            <div className="flex justify-between">
              <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Built</span>
              <span className={`font-mono text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {new Date(buildInfo.timestamp).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>PWA Status</span>
              <span className={`font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                {window.matchMedia('(display-mode: standalone)').matches ? 'Installed' : 'Browser'}
              </span>
            </div>
          </div>
        </section>

        {/* Appearance Section */}
        <section className={`rounded-xl border p-4 ${
          isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
        }`}>
          <h2 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Appearance
          </h2>
          
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
              isDark 
                ? 'bg-slate-700 hover:bg-slate-600' 
                : 'bg-slate-100 hover:bg-slate-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {isDark ? (
                <Moon className="w-5 h-5 text-blue-400" />
              ) : (
                <Sun className="w-5 h-5 text-amber-500" />
              )}
              <span className={isDark ? 'text-white' : 'text-slate-900'}>
                {isDark ? 'Dark Mode' : 'Light Mode'}
              </span>
            </div>
            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Tap to toggle
            </span>
          </button>
        </section>

        {/* Cache & Updates Section */}
        <section className={`rounded-xl border p-4 ${
          isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
        }`}>
          <h2 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Cache & Updates
          </h2>
          
          <div className="space-y-3">
            {/* Check for Updates Button */}
            <button
              onClick={checkForUpdates}
              className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                isDark 
                  ? 'bg-slate-700 hover:bg-slate-600' 
                  : 'bg-slate-100 hover:bg-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-blue-400" />
                <span className={isDark ? 'text-white' : 'text-slate-900'}>
                  Check for Updates
                </span>
              </div>
            </button>

            {/* Inspect Caches Button */}
            <button
              onClick={inspectCaches}
              className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                isDark 
                  ? 'bg-slate-700 hover:bg-slate-600' 
                  : 'bg-slate-100 hover:bg-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Info className="w-5 h-5 text-slate-400" />
                <span className={isDark ? 'text-white' : 'text-slate-900'}>
                  Inspect Caches
                </span>
              </div>
            </button>

            {/* Cache Info Display */}
            {cacheInfo && cacheInfo.length > 0 && (
              <div className={`p-3 rounded-lg text-sm ${
                isDark ? 'bg-slate-900' : 'bg-slate-50'
              }`}>
                <div className={`font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Active Caches:
                </div>
                {cacheInfo.map((cache, i) => (
                  <div key={i} className={`flex justify-between py-1 ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    <span className="font-mono text-xs truncate flex-1 mr-2">{cache.name}</span>
                    <span className="text-xs">{cache.size} items</span>
                  </div>
                ))}
              </div>
            )}

            {/* Clear Cache Button - Prominent */}
            <button
              onClick={clearCacheAndReload}
              disabled={clearing}
              className={`w-full flex items-center justify-center gap-2 p-4 rounded-lg font-medium transition-colors ${
                clearing
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
              }`}
            >
              {clearing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Clearing...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-5 h-5" />
                  <span>Clear Cache & Reload</span>
                </>
              )}
            </button>

            <p className={`text-xs text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Clears all cached data and reloads the app fresh from the server
            </p>
          </div>
        </section>

        {/* Status Message */}
        {status && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            status.type === 'success' 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : status.type === 'error'
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          }`}>
            {status.type === 'success' && <CheckCircle className="w-4 h-4" />}
            {status.type === 'error' && <AlertCircle className="w-4 h-4" />}
            {status.type === 'info' && <Info className="w-4 h-4" />}
            <span>{status.message}</span>
          </div>
        )}

        {/* Debug Info */}
        <section className={`rounded-xl border p-4 ${
          isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200'
        }`}>
          <details>
            <summary className={`cursor-pointer text-sm ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              Debug Info
            </summary>
            <div className={`mt-3 text-xs font-mono space-y-1 ${
              isDark ? 'text-slate-500' : 'text-slate-400'
            }`}>
              <div>User Agent: {navigator.userAgent.slice(0, 50)}...</div>
              <div>Service Worker: {'serviceWorker' in navigator ? 'Supported' : 'Not supported'}</div>
              <div>Cache API: {'caches' in window ? 'Supported' : 'Not supported'}</div>
              <div>Online: {navigator.onLine ? 'Yes' : 'No'}</div>
            </div>
          </details>
        </section>

      </div>
    </PageContainer>
  )
}
