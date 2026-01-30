import { useState, useEffect, useCallback } from 'react'
import { PageContainer } from '../components/PageContainer'

interface ActivityItem {
  id: string
  type: 'chat' | 'task' | 'agent' | 'system'
  title: string
  description: string
  timestamp: string
  source: string
  meta?: Record<string, unknown>
}

interface GroupedActivity {
  today: ActivityItem[]
  yesterday: ActivityItem[]
  earlier: ActivityItem[]
}

interface ActivityResponse {
  activities: ActivityItem[]
  grouped: GroupedActivity
  total: number
}

const typeIcons: Record<string, string> = {
  chat: '💬',
  task: '✅',
  agent: '🤖',
  system: '⚙️',
}

const typeColors: Record<string, string> = {
  chat: 'border-l-blue-500',
  task: 'border-l-green-500',
  agent: 'border-l-purple-500',
  system: 'border-l-slate-500',
}

// Type labels available if needed for UI
// const typeLabels: Record<string, string> = {
//   chat: 'Chat',
//   task: 'Task',
//   agent: 'Agent',
//   system: 'System',
// }

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function ActivityCard({ item }: { item: ActivityItem }) {
  // Extract completed items safely
  const completedItems: string[] = 
    item.meta?.completed && Array.isArray(item.meta.completed) 
      ? (item.meta.completed as string[]) 
      : []
  
  return (
    <div
      className={`bg-slate-800 rounded-lg p-3 border-l-4 ${typeColors[item.type] || 'border-l-slate-500'}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg">{typeIcons[item.type] || '📋'}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-white text-sm font-medium">{item.title}</h3>
          <p className="text-slate-400 text-xs mt-0.5 line-clamp-2">
            {item.description}
          </p>
          {completedItems.length > 0 && (
            <div className="mt-2 space-y-1">
              {completedItems.slice(0, 3).map((task, i) => (
                <div key={i} className="text-xs text-slate-500 flex items-center gap-1">
                  <span className="text-green-500">✓</span>
                  <span className="truncate">{task}</span>
                </div>
              ))}
              {completedItems.length > 3 && (
                <div className="text-xs text-slate-600">
                  +{completedItems.length - 3} more
                </div>
              )}
            </div>
          )}
        </div>
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {formatTime(item.timestamp)}
        </span>
      </div>
    </div>
  )
}

function DateSection({ title, items }: { title: string; items: ActivityItem[] }) {
  if (items.length === 0) return null
  
  return (
    <div className="mb-4">
      <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2 px-1">
        {title}
      </h2>
      <div className="space-y-2">
        {items.map((item) => (
          <ActivityCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}

export function ActivityPage() {
  const [grouped, setGrouped] = useState<GroupedActivity | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string | null>(null)

  const fetchActivity = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (filter) params.set('types', filter)
      
      // Dynamically determine API URL based on current host
      const host = window.location.hostname
      const protocol = window.location.protocol
      const apiBase = host.includes('.ts.net') 
        ? `${protocol}//${host.split(':')[0]}:3031`
        : 'http://localhost:3031'
      const res = await fetch(`${apiBase}/api/activity?${params}`)
      if (!res.ok) throw new Error('Failed to fetch activity')
      
      const data: ActivityResponse = await res.json()
      setGrouped(data.grouped)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filter])

  useEffect(() => {
    fetchActivity()
  }, [fetchActivity])

  // Pull to refresh handler
  const handleRefresh = () => {
    fetchActivity(true)
  }

  const filterOptions = [
    { value: null, label: 'All' },
    { value: 'task', label: '✅ Tasks' },
    { value: 'chat', label: '💬 Chat' },
    { value: 'agent', label: '🤖 Agents' },
    { value: 'system', label: '⚙️ System' },
  ]

  const isEmpty = grouped && 
    grouped.today.length === 0 && 
    grouped.yesterday.length === 0 && 
    grouped.earlier.length === 0

  return (
    <PageContainer title="Activity">
      {/* Filter pills */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-4 px-4">
        {filterOptions.map((opt) => (
          <button
            key={opt.value || 'all'}
            onClick={() => setFilter(opt.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filter === opt.value
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Refresh button */}
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="w-full mb-4 py-2 text-sm text-slate-400 hover:text-slate-200 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
        {refreshing ? 'Refreshing...' : 'Pull to refresh'}
      </button>

      {/* Loading state */}
      {loading && !grouped && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin text-2xl mb-2">⏳</div>
          <p className="text-slate-400 text-sm">Loading activity...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => fetchActivity()}
            className="mt-2 text-xs text-red-300 hover:text-red-200"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && isEmpty && (
        <div className="flex flex-col items-center justify-center py-12">
          <span className="text-4xl mb-3">📭</span>
          <p className="text-slate-400 text-sm">No activity yet</p>
          <p className="text-slate-500 text-xs mt-1">
            Activity will appear as you use Skipper
          </p>
        </div>
      )}

      {/* Activity feed */}
      {grouped && !isEmpty && (
        <div>
          <DateSection title="Today" items={grouped.today} />
          <DateSection title="Yesterday" items={grouped.yesterday} />
          <DateSection title="Earlier" items={grouped.earlier} />
        </div>
      )}
    </PageContainer>
  )
}
