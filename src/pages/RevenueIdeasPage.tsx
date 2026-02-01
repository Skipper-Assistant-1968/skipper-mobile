import { useState, useEffect } from 'react'
import { PageContainer } from '../components/PageContainer'
import { useTheme } from '../context/ThemeContext'

interface RevenueIdea {
  id: string
  title: string
  shortDescription: string
  fullDescription: string
  confidence: 'high' | 'medium' | 'low'
  status: 'new' | 'considering' | 'on-hold' | 'ruled-out' | 'in-progress' | 'launched'
  monthlyPotential: string
  effort: number
  revenueModel: string
  startupCosts: string
  firstStep: string
  notes: string
  dateAdded: string
  dateUpdated: string
  source: string
}

interface IdeasResponse {
  ideas: RevenueIdea[]
  lastUpdated: string
}

const statusConfig: Record<string, { emoji: string; label: string; color: string; bgColor: string }> = {
  'new': { emoji: '💡', label: 'New', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  'considering': { emoji: '🔥', label: 'Considering', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  'on-hold': { emoji: '⏸️', label: 'On Hold', color: 'text-slate-400', bgColor: 'bg-slate-500/20' },
  'ruled-out': { emoji: '❌', label: 'Ruled Out', color: 'text-red-400', bgColor: 'bg-red-500/20' },
  'in-progress': { emoji: '✅', label: 'In Progress', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  'launched': { emoji: '🏆', label: 'Launched', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
}

const confidenceConfig: Record<string, { label: string; color: string; stars: string }> = {
  'high': { label: 'High', color: 'text-green-400', stars: '⭐⭐⭐' },
  'medium': { label: 'Medium', color: 'text-yellow-400', stars: '⭐⭐' },
  'low': { label: 'Low', color: 'text-red-400', stars: '⭐' },
}

const statusOptions = [
  { value: 'new', label: '💡 New' },
  { value: 'considering', label: '🔥 Considering' },
  { value: 'in-progress', label: '✅ In Progress' },
  { value: 'on-hold', label: '⏸️ On Hold' },
  { value: 'ruled-out', label: '❌ Ruled Out' },
  { value: 'launched', label: '🏆 Launched' },
]

export function RevenueIdeasPage() {
  const [data, setData] = useState<IdeasResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const { isDark } = useTheme()

  const fetchIdeas = async () => {
    try {
      const host = window.location.hostname
      const protocol = window.location.protocol
      const apiBase = host.includes('.ts.net') 
        ? `${protocol}//${host.split(':')[0]}:3031`
        : 'http://localhost:3031'
      const res = await fetch(`${apiBase}/api/revenue-ideas`)
      if (!res.ok) throw new Error('Failed to fetch ideas')
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIdeas()
  }, [])

  const updateIdeaStatus = async (ideaId: string, newStatus: string) => {
    setUpdating(ideaId)
    try {
      const host = window.location.hostname
      const protocol = window.location.protocol
      const apiBase = host.includes('.ts.net') 
        ? `${protocol}//${host.split(':')[0]}:3031`
        : 'http://localhost:3031'
      
      const res = await fetch(`${apiBase}/api/revenue-ideas/${ideaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      
      if (!res.ok) throw new Error('Failed to update idea')
      
      // Refresh data
      await fetchIdeas()
    } catch (err) {
      console.error('Error updating idea:', err)
    } finally {
      setUpdating(null)
    }
  }

  const filteredIdeas = data?.ideas.filter(idea => 
    !filterStatus || idea.status === filterStatus
  ) || []

  // Sort ideas: considering > in-progress > new > on-hold > launched > ruled-out
  const statusOrder = ['considering', 'in-progress', 'new', 'on-hold', 'launched', 'ruled-out']
  const sortedIdeas = [...filteredIdeas].sort((a, b) => {
    const aIdx = statusOrder.indexOf(a.status)
    const bIdx = statusOrder.indexOf(b.status)
    return aIdx - bIdx
  })

  if (loading) {
    return (
      <PageContainer title="Revenue Ideas">
        <div className="flex items-center justify-center h-64">
          <div className={`animate-pulse ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Loading ideas...
          </div>
        </div>
      </PageContainer>
    )
  }

  if (error) {
    return (
      <PageContainer title="Revenue Ideas">
        <div className={`rounded-xl p-4 ${
          isDark ? 'bg-red-900/20 border border-red-700' : 'bg-red-50 border border-red-200'
        }`}>
          <div className={`font-medium ${isDark ? 'text-red-400' : 'text-red-600'}`}>
            ⚠️ Error loading ideas
          </div>
          <div className={`text-sm mt-1 ${isDark ? 'text-red-300' : 'text-red-500'}`}>
            {error}
          </div>
        </div>
      </PageContainer>
    )
  }

  const statusCounts = data?.ideas.reduce((acc, idea) => {
    acc[idea.status] = (acc[idea.status] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  return (
    <PageContainer title="Revenue Ideas">
      {/* Stats summary */}
      <div className={`rounded-xl p-4 mb-4 border ${
        isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {data?.ideas.length || 0}
            </span>
            <span className={`ml-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              ideas tracked
            </span>
          </div>
          <div className={`text-right text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {data?.lastUpdated && `Updated ${new Date(data.lastUpdated).toLocaleDateString()}`}
          </div>
        </div>
        
        {/* Status counts */}
        <div className="flex flex-wrap gap-2 mt-3">
          {Object.entries(statusCounts).map(([status, count]) => {
            const config = statusConfig[status]
            return (
              <span 
                key={status}
                className={`text-xs px-2 py-1 rounded-full ${config?.bgColor} ${config?.color}`}
              >
                {config?.emoji} {count}
              </span>
            )
          })}
        </div>
      </div>

      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFilterStatus(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filterStatus === null
              ? 'bg-blue-500 text-white'
              : isDark 
                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
          }`}
        >
          All
        </button>
        {statusOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilterStatus(filterStatus === opt.value ? null : opt.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filterStatus === opt.value
                ? 'bg-blue-500 text-white'
                : isDark 
                  ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Ideas list */}
      {sortedIdeas.length === 0 ? (
        <div className={`rounded-xl p-8 text-center border ${
          isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
        }`}>
          <div className="text-4xl mb-3">🤔</div>
          <div className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            No ideas match this filter
          </div>
          <div className={`text-sm mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Try selecting a different category
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedIdeas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              isExpanded={expandedId === idea.id}
              isUpdating={updating === idea.id}
              onToggle={() => setExpandedId(expandedId === idea.id ? null : idea.id)}
              onStatusChange={(status) => updateIdeaStatus(idea.id, status)}
              isDark={isDark}
            />
          ))}
        </div>
      )}
    </PageContainer>
  )
}

interface IdeaCardProps {
  idea: RevenueIdea
  isExpanded: boolean
  isUpdating: boolean
  onToggle: () => void
  onStatusChange: (status: string) => void
  isDark: boolean
}

function IdeaCard({ idea, isExpanded, isUpdating, onToggle, onStatusChange, isDark }: IdeaCardProps) {
  const status = statusConfig[idea.status] || statusConfig.new
  const confidence = confidenceConfig[idea.confidence] || confidenceConfig.medium

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
    } ${isExpanded ? 'ring-2 ring-blue-500' : ''}`}>
      {/* Header - always visible */}
      <div 
        className="p-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3">
          {/* Status emoji */}
          <div className="text-2xl flex-shrink-0">{status.emoji}</div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {idea.title}
              </h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${status.bgColor} ${status.color}`}>
                {status.label}
              </span>
            </div>
            
            <p className={`text-sm mt-1 line-clamp-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {idea.shortDescription}
            </p>
            
            {/* Quick stats */}
            <div className={`flex items-center gap-4 mt-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span className={confidence.color}>{confidence.stars}</span>
              <span>💰 {idea.monthlyPotential}</span>
              <span>⚡ {idea.effort}/10 effort</span>
            </div>
          </div>
          
          {/* Expand indicator */}
          <svg 
            className={`w-5 h-5 flex-shrink-0 transition-transform ${
              isDark ? 'text-slate-500' : 'text-slate-400'
            } ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      
      {/* Expanded content */}
      {isExpanded && (
        <div className={`px-4 pb-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="pt-4 space-y-4">
            {/* Full description */}
            <div>
              <h4 className={`text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Description
              </h4>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {idea.fullDescription}
              </p>
            </div>
            
            {/* Revenue model */}
            <div>
              <h4 className={`text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                💰 Revenue Model
              </h4>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {idea.revenueModel}
              </p>
            </div>
            
            {/* Startup costs */}
            <div>
              <h4 className={`text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                💸 Startup Costs
              </h4>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {idea.startupCosts}
              </p>
            </div>
            
            {/* First step */}
            <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
              <h4 className={`text-sm font-medium mb-1 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                🚀 First Step
              </h4>
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {idea.firstStep}
              </p>
            </div>
            
            {/* Notes if any */}
            {idea.notes && (
              <div>
                <h4 className={`text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  📝 Notes
                </h4>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {idea.notes}
                </p>
              </div>
            )}
            
            {/* Meta info */}
            <div className={`flex items-center gap-4 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <span>Added: {idea.dateAdded}</span>
              <span>Updated: {idea.dateUpdated}</span>
            </div>
            
            {/* Status change dropdown */}
            <div className="pt-2">
              <label className={`text-sm font-medium block mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Change Status
              </label>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={(e) => {
                      e.stopPropagation()
                      onStatusChange(opt.value)
                    }}
                    disabled={isUpdating || idea.status === opt.value}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      idea.status === opt.value
                        ? 'bg-blue-500 text-white'
                        : isDark 
                          ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
