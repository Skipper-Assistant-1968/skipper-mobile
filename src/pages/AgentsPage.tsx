import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '../components/PageContainer'

interface Agent {
  id: string
  label: string
  name: string
  task: string
  model: string
  status: 'active' | 'completed' | 'failed'
  startedAt?: string
  completedAt?: string
  progress?: number | null
  result?: string | null
  sessionId?: string | null
}

interface AgentsResponse {
  active: Agent[]
  completed: Agent[]
  totalActive: number
  totalCompleted: number
  lastUpdate: string | null
}

const statusConfig = {
  active: { color: 'bg-green-500', text: 'Working', pulse: true, textColor: 'text-green-400' },
  completed: { color: 'bg-blue-500', text: 'Done', pulse: false, textColor: 'text-blue-400' },
  failed: { color: 'bg-red-500', text: 'Failed', pulse: false, textColor: 'text-red-400' },
}

const modelEmoji: Record<string, string> = {
  opus: '🧠',
  sonnet: '📝',
  haiku: '⚡',
  unknown: '🤖'
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function AgentsPage() {
  const [data, setData] = useState<AgentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        // Dynamically determine API URL based on current host
        const host = window.location.hostname
        const protocol = window.location.protocol
        const apiBase = host.includes('.ts.net') 
          ? `${protocol}//${host.split(':')[0]}:3031`
          : 'http://localhost:3031'
        const res = await fetch(`${apiBase}/api/agents`)
        if (!res.ok) throw new Error('Failed to fetch agents')
        const json = await res.json()
        setData(json)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchAgents()
    // Poll every 5 seconds for updates
    const interval = setInterval(fetchAgents, 5000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <PageContainer title="Agents">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400 animate-pulse">Loading agents...</div>
        </div>
      </PageContainer>
    )
  }

  if (error) {
    return (
      <PageContainer title="Agents">
        <div className="bg-red-900/20 border border-red-700 rounded-xl p-4">
          <div className="text-red-400 font-medium">⚠️ Error loading agents</div>
          <div className="text-red-300 text-sm mt-1">{error}</div>
        </div>
      </PageContainer>
    )
  }

  const hasNoAgents = !data || (data.active.length === 0 && data.completed.length === 0)

  return (
    <PageContainer title="Agents">
      {/* Summary header */}
      <div className="bg-slate-800/50 rounded-xl p-4 mb-4 border border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold text-white">{data?.totalActive || 0}</span>
            <span className="text-slate-400 ml-2">active</span>
          </div>
          <div className="text-right text-sm text-slate-500">
            {data?.lastUpdate && `Updated ${timeAgo(data.lastUpdate)}`}
          </div>
        </div>
      </div>

      {hasNoAgents ? (
        <div className="bg-slate-800 rounded-xl p-8 text-center border border-slate-700">
          <div className="text-4xl mb-3">😴</div>
          <div className="text-slate-300 font-medium">No active agents</div>
          <div className="text-slate-500 text-sm mt-1">
            Skipper will spawn agents when there's work to do
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active Agents */}
          {data && data.active.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-2 px-1">
                🔄 Working ({data.active.length})
              </h3>
              <div className="space-y-2">
                {data.active.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} onNavigate={navigate} />
                ))}
              </div>
            </div>
          )}

          {/* Completed Agents */}
          {data && data.completed.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-2 px-1 mt-6">
                ✅ Recently Completed ({data.completed.length})
              </h3>
              <div className="space-y-2">
                {data.completed.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} onNavigate={navigate} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  )
}

function AgentCard({ agent, onNavigate }: { agent: Agent; onNavigate: (path: string) => void }) {
  const config = statusConfig[agent.status]
  const emoji = modelEmoji[agent.model] || modelEmoji.unknown
  
  const handleClick = () => {
    if (agent.sessionId) {
      // Build URL with query params for context
      const params = new URLSearchParams({
        name: agent.name,
        task: agent.task,
        status: agent.status
      })
      onNavigate(`/agents/${agent.sessionId}?${params.toString()}`)
    }
  }
  
  const isClickable = !!agent.sessionId

  return (
    <div 
      className={`bg-slate-800 rounded-xl p-4 border border-slate-700 transition-colors ${
        isClickable ? 'cursor-pointer hover:bg-slate-750 hover:border-slate-600 active:bg-slate-700' : ''
      }`}
      onClick={isClickable ? handleClick : undefined}
    >
      <div className="flex items-start gap-3">
        {/* Icon with status indicator */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-xl">
            {emoji}
          </div>
          <div 
            className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-slate-800 ${config.color} ${config.pulse ? 'animate-pulse' : ''}`} 
          />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-medium truncate">{agent.name}</h3>
            <span className={`text-xs px-1.5 py-0.5 rounded ${config.color}/20 ${config.textColor}`}>
              {config.text}
            </span>
            {isClickable && (
              <svg className="w-4 h-4 text-slate-500 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
          
          {/* Task description */}
          <p className="text-sm text-slate-300 mt-1 line-clamp-2">
            {agent.task}
          </p>

          {/* Progress bar for active agents */}
          {agent.status === 'active' && (
            <div className="mt-2">
              {agent.progress != null ? (
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${agent.progress}%` }}
                  />
                </div>
              ) : (
                // Indeterminate progress bar
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full w-1/3 bg-green-500 rounded-full animate-indeterminate" />
                </div>
              )}
            </div>
          )}
          
          {/* Meta info */}
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
            <span className="capitalize">{agent.model}</span>
            <span>•</span>
            <span>
              {agent.status === 'active' && agent.startedAt && `Started ${timeAgo(agent.startedAt)}`}
              {agent.status === 'completed' && agent.completedAt && `Finished ${timeAgo(agent.completedAt)}`}
              {agent.status === 'failed' && 'Failed'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
