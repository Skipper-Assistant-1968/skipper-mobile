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
    // Simulated heartbeat check - replace with real gateway connection
    const checkHeartbeat = async () => {
      try {
        // TODO: Replace with actual gateway health check
        // const start = Date.now()
        // const res = await fetch('http://localhost:3030/health')
        // if (res.ok) {
        //   setStatus({
        //     connected: true,
        //     lastPing: new Date(),
        //     latencyMs: Date.now() - start,
        //   })
        // }
        
        // Simulated connection for now
        setStatus({
          connected: true,
          lastPing: new Date(),
          latencyMs: Math.floor(Math.random() * 50) + 10,
        })
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
        className="bg-slate-800/95 backdrop-blur-sm border-b border-slate-700"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between px-4 h-12">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚓</span>
            <span className="font-semibold text-white dark:text-white light:text-slate-900">Skipper</span>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleTheme()
              }}
              className="p-2 rounded-full hover:bg-slate-700 dark:hover:bg-slate-700 light:hover:bg-slate-200 transition-colors"
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
              <motion.div
                className={`w-2 h-2 rounded-full ${statusColor}`}
                animate={{ 
                  scale: status.connected ? [1, 1.2, 1] : 1,
                  opacity: status.connected ? 1 : 0.5 
                }}
                transition={{ 
                  repeat: status.connected ? Infinity : 0, 
                  duration: 2 
                }}
              />
              <span className="text-xs text-slate-400">{statusText}</span>
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
              <div className="px-4 py-3 text-sm text-slate-300 space-y-1 border-t border-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={status.connected ? 'text-green-400' : 'text-red-400'}>
                    {statusText}
                  </span>
                </div>
                {status.latencyMs && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Latency:</span>
                    <span>{status.latencyMs}ms</span>
                  </div>
                )}
                {status.lastPing && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Last ping:</span>
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
