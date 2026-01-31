import { useState, useEffect } from 'react'
import { PageContainer } from '../components/PageContainer'
import { ChevronDown, ChevronUp, Flame, Play, ExternalLink, Loader2, Users } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

interface ChannelVideo {
  channel: string
  videos: {
    title: string
    videoId: string
    url: string
  }[]
}

interface HotTopic {
  topic: string
  synthesis: string
  keyTakeaway: string
  executiveBriefing: string
  channelVideos: ChannelVideo[]
  heat: 'high' | 'medium' | 'low'
  videoCount: number
  date: string
}

interface HotTopicsResponse {
  hotTopics: HotTopic[]
  count: number
  daysIncluded: string[]
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

export function HotTopicsPage() {
  const { isDark } = useTheme()
  const [data, setData] = useState<HotTopicsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchHotTopics()
  }, [])

  const fetchHotTopics = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`${API_BASE}/api/hot-topics`)
      if (!res.ok) throw new Error('Failed to fetch hot topics')
      const responseData = await res.json()
      setData(responseData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hot topics')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (topicKey: string) => {
    setExpandedTopics(prev => {
      const next = new Set(prev)
      if (next.has(topicKey)) {
        next.delete(topicKey)
      } else {
        next.add(topicKey)
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

  const getHeatConfig = (heat: string) => {
    switch (heat) {
      case 'high':
        return {
          bg: isDark ? 'bg-red-500/20' : 'bg-red-100',
          border: isDark ? 'border-red-500/30' : 'border-red-300',
          text: isDark ? 'text-red-400' : 'text-red-600',
          badge: isDark ? 'bg-red-500/30 text-red-300' : 'bg-red-500 text-white',
          icon: '🔥🔥🔥'
        }
      case 'medium':
        return {
          bg: isDark ? 'bg-yellow-500/20' : 'bg-yellow-100',
          border: isDark ? 'border-yellow-500/30' : 'border-yellow-300',
          text: isDark ? 'text-yellow-400' : 'text-yellow-600',
          badge: isDark ? 'bg-yellow-500/30 text-yellow-300' : 'bg-yellow-500 text-white',
          icon: '🔥🔥'
        }
      default:
        return {
          bg: isDark ? 'bg-slate-700/50' : 'bg-slate-100',
          border: isDark ? 'border-slate-600' : 'border-slate-300',
          text: isDark ? 'text-slate-400' : 'text-slate-600',
          badge: isDark ? 'bg-slate-600 text-slate-300' : 'bg-slate-400 text-white',
          icon: '🔥'
        }
    }
  }

  if (loading) {
    return (
      <PageContainer title="Hot Topics">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      </PageContainer>
    )
  }

  if (error) {
    return (
      <PageContainer title="Hot Topics">
        <div className={`${isDark ? 'bg-red-900/20 border-red-500/30' : 'bg-red-50 border-red-300'} border rounded-xl p-4 text-center`}>
          <p className={isDark ? 'text-red-400' : 'text-red-600'}>{error}</p>
          <button 
            onClick={fetchHotTopics}
            className={`mt-3 px-4 py-2 ${isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'} rounded-lg text-sm`}
          >
            Try Again
          </button>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer title="Hot Topics">
      {/* Header Info */}
      <div className={`flex items-center gap-3 mb-4 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        <span className="flex items-center gap-1">
          <Flame className="w-4 h-4 text-orange-500" />
          {data?.count || 0} topics
        </span>
        <span>•</span>
        <span>Last {data?.daysIncluded?.length || 0} days</span>
      </div>

      {/* Topic Cards */}
      {data && data.hotTopics.length > 0 && (
        <div className="space-y-3">
          {data.hotTopics.map((topic, index) => {
            const topicKey = `${topic.date}-${index}`
            const isExpanded = expandedTopics.has(topicKey)
            const heatConfig = getHeatConfig(topic.heat)
            
            return (
              <div
                key={topicKey}
                className={`rounded-xl border overflow-hidden transition-colors ${
                  isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                }`}
              >
                {/* Card Header */}
                <button
                  onClick={() => toggleExpanded(topicKey)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Heat Badge & Title */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${heatConfig.badge}`}>
                          {heatConfig.icon} {topic.heat}
                        </span>
                        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {formatDate(topic.date)}
                        </span>
                      </div>
                      
                      <h3 className={`font-semibold text-base mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {topic.topic}
                      </h3>
                      
                      {/* Key Takeaway */}
                      <p className={`text-sm line-clamp-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {topic.keyTakeaway}
                      </p>
                      
                      {/* Stats */}
                      <div className={`flex items-center gap-3 mt-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        <span className="flex items-center gap-1">
                          <Play className="w-3 h-3" />
                          {topic.videoCount} videos
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {topic.channelVideos.length} channels
                        </span>
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
                    {/* Synthesis */}
                    <div className="mt-3">
                      <h4 className={`text-xs font-medium uppercase tracking-wide mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Synthesis
                      </h4>
                      <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {topic.synthesis}
                      </p>
                    </div>

                    {/* Executive Briefing */}
                    {topic.executiveBriefing && (
                      <div className="mt-4">
                        <h4 className={`text-xs font-medium uppercase tracking-wide mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          Executive Briefing
                        </h4>
                        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          {topic.executiveBriefing}
                        </p>
                      </div>
                    )}

                    {/* Channel Videos */}
                    {topic.channelVideos.length > 0 && (
                      <div className="mt-4">
                        <h4 className={`text-xs font-medium uppercase tracking-wide mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          Coverage by Channel
                        </h4>
                        <div className="space-y-3">
                          {topic.channelVideos.map((channelData, cidx) => (
                            <div key={cidx} className={`rounded-lg p-3 ${isDark ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
                              <div className={`text-sm font-medium mb-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                {channelData.channel}
                              </div>
                              <div className="space-y-2">
                                {channelData.videos.map((video, vidx) => (
                                  <a
                                    key={vidx}
                                    href={video.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-2 text-sm transition-colors ${
                                      isDark 
                                        ? 'text-slate-300 hover:text-white' 
                                        : 'text-slate-700 hover:text-slate-900'
                                    }`}
                                  >
                                    <Play className={`w-3 h-3 flex-shrink-0 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
                                    <span className="line-clamp-1">{video.title}</span>
                                    <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Empty State */}
      {data && data.hotTopics.length === 0 && (
        <div className={`text-center py-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <Flame className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No hot topics found</p>
          <p className="text-sm mt-1">Hot topics appear when multiple channels cover the same subject</p>
        </div>
      )}
    </PageContainer>
  )
}
