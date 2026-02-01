import { useState, useEffect } from 'react'
import { PageContainer } from '../components/PageContainer'
import { ChevronDown, ChevronUp, BookOpen, Play, ExternalLink, Loader2, Lightbulb, Tag } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

interface LearnVideo {
  title: string
  url: string
}

interface LearnItem {
  id: string
  title: string
  topic: string
  date: string
  category: string
  summary: string
  takeaways: string[]
  videos: LearnVideo[]
  filename: string
}

interface LearnResponse {
  content: LearnItem[]
  count: number
  totalAvailable: number
  generatedAt: string
}

// Dynamically determine API URL based on current host
const getApiBase = (): string => {
  if (typeof window === 'undefined') return 'http://localhost:3031'
  const host = window.location.hostname
  const protocol = window.location.protocol
  if (host.includes('.ts.net')) {
    return `${protocol}//${host.split(':')[0]}:3031`
  }
  return 'http://localhost:3031'
}
const API_BASE = getApiBase()

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  'AI Tools': { 
    bg: 'bg-blue-500/20', 
    text: 'text-blue-400', 
    border: 'border-blue-500/30' 
  },
  'Gaming & AI': { 
    bg: 'bg-purple-500/20', 
    text: 'text-purple-400', 
    border: 'border-purple-500/30' 
  },
  'Voice Tech': { 
    bg: 'bg-green-500/20', 
    text: 'text-green-400', 
    border: 'border-green-500/30' 
  },
  'Data & Infrastructure': { 
    bg: 'bg-orange-500/20', 
    text: 'text-orange-400', 
    border: 'border-orange-500/30' 
  },
  'Research': { 
    bg: 'bg-slate-500/20', 
    text: 'text-slate-400', 
    border: 'border-slate-500/30' 
  },
}

export function LearnPage() {
  const { isDark } = useTheme()
  const [data, setData] = useState<LearnResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  useEffect(() => {
    fetchLearnContent()
  }, [])

  const fetchLearnContent = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`${API_BASE}/api/learn?days=14`)
      if (!res.ok) throw new Error('Failed to fetch learning content')
      const responseData = await res.json()
      setData(responseData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load learning content')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const getCategoryStyle = (category: string) => {
    return categoryColors[category] || categoryColors['Research']
  }

  // Get unique categories for filter
  const categories = data?.content 
    ? [...new Set(data.content.map(item => item.category))]
    : []

  // Filter content by selected category
  const filteredContent = data?.content?.filter(
    item => !selectedCategory || item.category === selectedCategory
  ) || []

  if (loading) {
    return (
      <PageContainer title="Learn">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      </PageContainer>
    )
  }

  if (error) {
    return (
      <PageContainer title="Learn">
        <div className={`${isDark ? 'bg-red-900/20 border-red-500/30' : 'bg-red-50 border-red-300'} border rounded-xl p-4 text-center`}>
          <p className={isDark ? 'text-red-400' : 'text-red-600'}>{error}</p>
          <button 
            onClick={fetchLearnContent}
            className={`mt-3 px-4 py-2 ${isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'} rounded-lg text-sm`}
          >
            Try Again
          </button>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer title="Learn">
      {/* Header Info */}
      <div className={`flex items-center gap-3 mb-4 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        <span className="flex items-center gap-1">
          <BookOpen className="w-4 h-4 text-blue-500" />
          {data?.count || 0} findings
        </span>
        <span>•</span>
        <span>Last 14 days</span>
      </div>

      {/* Category Filter Pills */}
      {categories.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === null
                ? 'bg-blue-500 text-white'
                : isDark 
                  ? 'bg-slate-800 text-slate-400 hover:text-white'
                  : 'bg-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            All
          </button>
          {categories.map(cat => {
            const style = getCategoryStyle(cat)
            const isSelected = selectedCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isSelected
                    ? `${style.bg} ${style.text} border ${style.border}`
                    : isDark 
                      ? 'bg-slate-800 text-slate-400 hover:text-white'
                      : 'bg-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            )
          })}
        </div>
      )}

      {/* Content Cards */}
      {filteredContent.length > 0 && (
        <div className="space-y-3">
          {filteredContent.map((item) => {
            const isExpanded = expandedItems.has(item.id)
            const categoryStyle = getCategoryStyle(item.category)
            
            return (
              <div
                key={item.id}
                className={`rounded-xl border overflow-hidden transition-colors ${
                  isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                }`}
              >
                {/* Card Header */}
                <button
                  onClick={() => toggleExpanded(item.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Category Badge & Date */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryStyle.bg} ${categoryStyle.text}`}>
                          <Tag className="w-3 h-3 inline mr-1" />
                          {item.category}
                        </span>
                        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {formatDate(item.date)}
                        </span>
                      </div>
                      
                      <h3 className={`font-semibold text-base mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {item.title}
                      </h3>
                      
                      {/* Summary */}
                      <p className={`text-sm line-clamp-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {item.summary}
                      </p>
                      
                      {/* Stats */}
                      <div className={`flex items-center gap-3 mt-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {item.takeaways.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Lightbulb className="w-3 h-3" />
                            {item.takeaways.length} takeaways
                          </span>
                        )}
                        {item.videos.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Play className="w-3 h-3" />
                            {item.videos.length} videos
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className={`px-4 pb-4 border-t ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
                    {/* Key Takeaways */}
                    {item.takeaways.length > 0 && (
                      <div className="mt-3">
                        <h4 className={`text-xs font-medium uppercase tracking-wide mb-2 flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          <Lightbulb className="w-3 h-3" />
                          Key Takeaways
                        </h4>
                        <ul className="space-y-2">
                          {item.takeaways.map((takeaway, idx) => (
                            <li 
                              key={idx}
                              className={`text-sm leading-relaxed flex items-start gap-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                            >
                              <span className="text-blue-500 mt-1">•</span>
                              <span>{takeaway}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Related Videos */}
                    {item.videos.length > 0 && (
                      <div className="mt-4">
                        <h4 className={`text-xs font-medium uppercase tracking-wide mb-2 flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          <Play className="w-3 h-3" />
                          Related Videos
                        </h4>
                        <div className="space-y-2">
                          {item.videos.map((video, idx) => (
                            <a
                              key={idx}
                              href={video.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-2 p-2 rounded-lg text-sm transition-colors ${
                                isDark 
                                  ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white' 
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              <Play className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
                              <span className="flex-1 line-clamp-1">{video.title}</span>
                              <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Topic tag */}
                    <div className={`mt-4 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      Topic: {item.topic}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Empty State */}
      {filteredContent.length === 0 && (
        <div className={`text-center py-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No learning content found</p>
          <p className="text-sm mt-1">Check back after research runs complete</p>
        </div>
      )}
    </PageContainer>
  )
}
