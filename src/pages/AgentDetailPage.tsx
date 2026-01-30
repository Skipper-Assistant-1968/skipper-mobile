import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { PageContainer } from '../components/PageContainer'

interface TranscriptEntry {
  id: string
  timestamp: string
  role: 'user' | 'assistant'
  model?: string
  thinking: string[]
  text: string[]
  toolCalls: Array<{
    id: string
    name: string
    arguments: Record<string, unknown>
  }>
  toolResults: Array<{
    toolUseId: string
    content: string
  }>
}

interface TranscriptResponse {
  sessionKey: string
  sessionId: string
  sessionInfo: {
    id: string
    timestamp: string
    cwd: string
  } | null
  entries: TranscriptEntry[]
  totalEntries: number
  returned: number
  hasMore: boolean
}

const roleColors = {
  user: 'bg-blue-600/20 border-blue-600/30',
  assistant: 'bg-slate-700/50 border-slate-600/30'
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true
  })
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

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export function AgentDetailPage() {
  const { sessionKey } = useParams<{ sessionKey: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const agentName = searchParams.get('name') || 'Agent'
  const agentTask = searchParams.get('task') || ''
  const agentStatus = searchParams.get('status') || 'active'
  
  const [data, setData] = useState<TranscriptResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set())
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())
  
  const containerRef = useRef<HTMLDivElement>(null)
  const isLive = agentStatus === 'active'

  useEffect(() => {
    const fetchTranscript = async () => {
      if (!sessionKey) return
      
      try {
        const host = window.location.hostname
        const protocol = window.location.protocol
        const apiBase = host.includes('.ts.net') 
          ? `${protocol}//${host.split(':')[0]}:3031`
          : 'http://localhost:3031'
        
        const res = await fetch(`${apiBase}/api/agents/${encodeURIComponent(sessionKey)}/transcript`)
        if (!res.ok) {
          if (res.status === 404) {
            setError('Session transcript not found')
          } else {
            throw new Error('Failed to fetch transcript')
          }
          return
        }
        const json = await res.json()
        setData(json)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchTranscript()
    
    // Auto-refresh for live agents
    if (isLive) {
      const interval = setInterval(fetchTranscript, 5000)
      return () => clearInterval(interval)
    }
  }, [sessionKey, isLive])

  // Auto-scroll to bottom when new entries arrive (for live agents)
  useEffect(() => {
    if (isLive && containerRef.current && data?.entries.length) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [data?.entries.length, isLive])

  const toggleThinking = (id: string) => {
    setExpandedThinking(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleTool = (id: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  if (loading) {
    return (
      <PageContainer title="Agent Details">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400 animate-pulse">Loading transcript...</div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer title="">
      {/* Header */}
      <div className="bg-slate-800/50 rounded-xl p-4 mb-4 border border-slate-700">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/agents')}
            className="p-2 -ml-2 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-white truncate">{agentName}</h1>
              {isLive && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  Live
                </span>
              )}
            </div>
            {agentTask && (
              <p className="text-sm text-slate-400 truncate mt-0.5">{agentTask}</p>
            )}
          </div>
        </div>
        {data?.sessionInfo && (
          <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-700">
            Started {timeAgo(data.sessionInfo.timestamp)} · {data.totalEntries} messages
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-xl p-4 mb-4">
          <div className="text-red-400 font-medium">⚠️ {error}</div>
          {!sessionKey && (
            <div className="text-red-300 text-sm mt-1">
              No session ID available for this agent
            </div>
          )}
        </div>
      )}

      {/* Transcript */}
      {data && data.entries.length > 0 && (
        <div 
          ref={containerRef}
          className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pb-4"
        >
          {data.entries.map((entry) => (
            <TranscriptEntryCard 
              key={entry.id} 
              entry={entry}
              expandedThinking={expandedThinking}
              expandedTools={expandedTools}
              onToggleThinking={toggleThinking}
              onToggleTool={toggleTool}
            />
          ))}
        </div>
      )}

      {data && data.entries.length === 0 && (
        <div className="bg-slate-800 rounded-xl p-8 text-center border border-slate-700">
          <div className="text-4xl mb-3">📝</div>
          <div className="text-slate-300 font-medium">No transcript entries yet</div>
          <div className="text-slate-500 text-sm mt-1">
            Waiting for agent activity...
          </div>
        </div>
      )}
    </PageContainer>
  )
}

interface TranscriptEntryCardProps {
  entry: TranscriptEntry
  expandedThinking: Set<string>
  expandedTools: Set<string>
  onToggleThinking: (id: string) => void
  onToggleTool: (id: string) => void
}

function TranscriptEntryCard({ 
  entry, 
  expandedThinking, 
  expandedTools,
  onToggleThinking,
  onToggleTool 
}: TranscriptEntryCardProps) {
  const isThinkingExpanded = expandedThinking.has(entry.id)
  const hasThinking = entry.thinking.length > 0
  const hasText = entry.text.length > 0
  const hasToolCalls = entry.toolCalls.length > 0
  
  return (
    <div className={`rounded-xl p-3 border ${roleColors[entry.role]}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${entry.role === 'user' ? 'text-blue-400' : 'text-slate-300'}`}>
            {entry.role === 'user' ? '👤 User' : '🤖 Assistant'}
          </span>
          {entry.model && (
            <span className="text-xs text-slate-500">
              {entry.model.split('/').pop()?.replace('claude-', '')}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-500">{formatTime(entry.timestamp)}</span>
      </div>

      {/* Thinking (collapsible) */}
      {hasThinking && (
        <div className="mb-2">
          <button
            onClick={() => onToggleThinking(entry.id)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <svg 
              className={`w-3 h-3 transition-transform ${isThinkingExpanded ? 'rotate-90' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            💭 Thinking ({entry.thinking.length})
          </button>
          {isThinkingExpanded && (
            <div className="mt-2 pl-4 border-l-2 border-slate-600">
              {entry.thinking.map((thought, i) => (
                <p key={i} className="text-xs text-slate-400 italic whitespace-pre-wrap mb-2">
                  {thought}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tool Calls */}
      {hasToolCalls && (
        <div className="mb-2 space-y-1">
          {entry.toolCalls.map((tool) => {
            const toolKey = `${entry.id}-${tool.id}`
            const isExpanded = expandedTools.has(toolKey)
            return (
              <div key={tool.id} className="bg-slate-900/50 rounded-lg p-2">
                <button
                  onClick={() => onToggleTool(toolKey)}
                  className="flex items-center gap-2 text-xs w-full text-left"
                >
                  <svg 
                    className={`w-3 h-3 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-amber-400 font-mono">🔧 {tool.name}</span>
                  {!isExpanded && tool.arguments && (
                    <span className="text-slate-500 truncate flex-1">
                      {truncateText(JSON.stringify(tool.arguments), 50)}
                    </span>
                  )}
                </button>
                {isExpanded && tool.arguments && (
                  <pre className="mt-2 text-xs text-slate-400 overflow-x-auto bg-slate-950/50 rounded p-2">
                    {JSON.stringify(tool.arguments, null, 2)}
                  </pre>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Text Response */}
      {hasText && (
        <div className="text-sm text-slate-200 whitespace-pre-wrap">
          {entry.text.map((text, i) => (
            <p key={i} className={i > 0 ? 'mt-2' : ''}>{text}</p>
          ))}
        </div>
      )}
    </div>
  )
}
