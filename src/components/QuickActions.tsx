import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Mail, Cloud, Activity, RefreshCw, Calendar, 
  Plane, Bot, ChevronUp, ChevronDown, Loader2 
} from 'lucide-react'
import api from '../lib/api'

interface QuickAction {
  id: string
  icon: React.ReactNode
  label: string
  message: string
  color: string
}

const quickActions: QuickAction[] = [
  {
    id: 'email',
    icon: <Mail className="w-4 h-4" />,
    label: 'Check email',
    message: 'Check my email inbox - any urgent or important messages?',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  },
  {
    id: 'weather',
    icon: <Cloud className="w-4 h-4" />,
    label: 'Weather',
    message: 'What\'s the weather like today and tomorrow?',
    color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
  },
  {
    id: 'status',
    icon: <Activity className="w-4 h-4" />,
    label: 'Status update',
    message: 'Give me a status update - what\'s happening with my tasks and agents?',
    color: 'bg-green-500/20 text-green-400 border-green-500/30'
  },
  {
    id: 'calendar',
    icon: <Calendar className="w-4 h-4" />,
    label: 'Today\'s schedule',
    message: 'What\'s on my calendar for today and tomorrow?',
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
  },
  {
    id: 'travel',
    icon: <Plane className="w-4 h-4" />,
    label: 'Travel info',
    message: 'Any updates on my travel plans? Flight status, weather at destination, etc.',
    color: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
  },
  {
    id: 'agents',
    icon: <Bot className="w-4 h-4" />,
    label: 'Agent status',
    message: 'What are my agents working on right now? Any completed or pending tasks?',
    color: 'bg-pink-500/20 text-pink-400 border-pink-500/30'
  },
  {
    id: 'refresh',
    icon: <RefreshCw className="w-4 h-4" />,
    label: 'Refresh digests',
    message: 'Refresh my YouTube digests - anything new and interesting today?',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
  },
]

interface QuickActionsProps {
  onActionSent?: () => void
}

export function QuickActions({ onActionSent }: QuickActionsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [sendingAction, setSendingAction] = useState<string | null>(null)
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>([])

  const handleAction = async (action: QuickAction) => {
    setSendingAction(action.id)
    
    try {
      await api.sendMessage(action.message)
      
      // Track recently used (last 3)
      setRecentlyUsed(prev => {
        const filtered = prev.filter(id => id !== action.id)
        return [action.id, ...filtered].slice(0, 3)
      })
      
      onActionSent?.()
    } catch (err) {
      console.error('Failed to send quick action:', err)
    } finally {
      setSendingAction(null)
    }
  }

  // Show top 4 actions when collapsed, all when expanded
  const displayedActions = isExpanded 
    ? quickActions 
    : quickActions.slice(0, 4)

  return (
    <div className="bg-slate-800/50 dark:bg-slate-800/50 light:bg-slate-100 rounded-xl border border-slate-700 dark:border-slate-700 light:border-slate-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors"
      >
        <span className="text-sm font-medium text-slate-300 dark:text-slate-300 light:text-slate-700">
          ⚡ Quick Actions
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Actions Grid */}
      <AnimatePresence>
        <motion.div
          initial={false}
          animate={{ height: 'auto' }}
          className="px-3 pb-3"
        >
          <div className="grid grid-cols-2 gap-2">
            {displayedActions.map((action, index) => (
              <motion.button
                key={action.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleAction(action)}
                disabled={sendingAction !== null}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all active:scale-95 disabled:opacity-50 ${action.color}`}
              >
                {sendingAction === action.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  action.icon
                )}
                <span className="truncate">{action.label}</span>
              </motion.button>
            ))}
          </div>

          {/* Show more/less */}
          {quickActions.length > 4 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full mt-2 text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
            >
              {isExpanded ? 'Show less' : `+${quickActions.length - 4} more actions`}
            </button>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Recently used indicator */}
      {recentlyUsed.length > 0 && !isExpanded && (
        <div className="px-4 pb-2 text-xs text-slate-500">
          Recently: {recentlyUsed.map(id => 
            quickActions.find(a => a.id === id)?.label
          ).join(', ')}
        </div>
      )}
    </div>
  )
}
