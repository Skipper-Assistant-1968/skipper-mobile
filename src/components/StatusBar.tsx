import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

interface HeartbeatStatus {
  connected: boolean
  lastPing: Date | null
  latencyMs: number | null
}

export function StatusBar() {
  const { toggleTheme, isDark } = useTheme()
  const [status, setStatus] = useState<HeartbeatStatus>({
    connected: false,
    lastPing: null,
    latencyMs: null,
  })
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    // Check connection to mobile API server
    const checkHeartbeat = async () => {
      try {
        const start = Date.now()
        const res = await fetch('http://localhost:3032/api/heartbeat', {
          signal: AbortSignal.timeout(5000),
        })
        if (res.ok) {
          setStatus({
            connected: true,
            lastPing: new Date(),
            latencyMs: Date.now() - start,
          })
        } else {
          setStatus({
            connected: false,
            lastPing: null,
            latencyMs: null,
          })
        }
      } catch {
        setStatus({
          connected: false,
          lastPing: null,
          latencyMs: null,
        })
      }
    }

    checkHeartbeat()
    const interval = setInterval(checkHeartbeat, 30000) // Every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const statusColor = status.connected ? 'bg-green-500' : 'bg-red-500'
  const statusText = status.connected ? 'Connected' : 'Disconnected'

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pt-safe">
      <motion.div 
        className={`backdrop-blur-sm border-b transition-colors ${
          isDark 
            ? 'bg-slate-800/95 border-slate-700' 
            : 'bg-white/95 border-slate-200'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between px-4 h-12">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚓</span>
            <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Skipper</span>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleTheme()
              }}
              className={`p-2 rounded-full transition-colors ${
                isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200'
              }`}
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-yellow-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>
            
            {/* Connection status */}
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${statusColor} ${status.connected ? 'shadow-[0_0_6px_rgba(34,197,94,0.5)]' : ''}`}
              />
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{statusText}</span>
            </div>
          </div>
        </div>
        
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className={`px-4 py-3 text-sm space-y-1 border-t ${
                isDark ? 'text-slate-300 border-slate-700' : 'text-slate-600 border-slate-200'
              }`}>
                <div className="flex justify-between">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Status:</span>
                  <span className={status.connected ? 'text-green-500' : 'text-red-500'}>
                    {statusText}
                  </span>
                </div>
                {status.latencyMs && (
                  <div className="flex justify-between">
                    <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Latency:</span>
                    <span>{status.latencyMs}ms</span>
                  </div>
                )}
                {status.lastPing && (
                  <div className="flex justify-between">
                    <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Last ping:</span>
                    <span>{status.lastPing.toLocaleTimeString()}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
