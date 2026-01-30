import { useState, useEffect } from 'react'
import { PageContainer } from '../components/PageContainer'
import { ChevronDown, ChevronUp, Calendar, Play, ExternalLink, Loader2, BookOpen, List, Clock } from 'lucide-react'

interface DigestDate {
  date: string
  totalVideos: number
  channelCount: number
}

interface VideoTimestamp {
  time: string
  label?: string
  description?: string
}

interface Video {
  videoId: string
  title: string
  url: string
  channelName: string
  publishedAt: string
  sentiment: string
  sentimentLabel: string
  topics: string[]
  timestamps: VideoTimestamp[]
  summary: string
  topBullets?: string[]
  description?: string
}

interface DigestData {
  date: string
  totalVideos: number
  channelCount: number
  videos: Video[]
  briefMode: boolean
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

export function DigestsPage() {
  const [availableDates, setAvailableDates] = useState<DigestDate[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [digestData, setDigestData] = useState<DigestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingDigest, setLoadingDigest] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [briefMode, setBriefMode] = useState(true)
  const [expandedVideos, setExpandedVideos] = useState<Set<string>>(new Set())
  const [showDatePicker, setShowDatePicker] = useState(false)

  // Fetch available dates on mount
  useEffect(() => {
    fetchAvailableDates()
  }, [])

  // Fetch digest when date or mode changes
  useEffect(() => {
    if (selectedDate) {
      fetchDigest(selectedDate, briefMode)
    }
  }, [selectedDate, briefMode])

  const fetchAvailableDates = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/api/digests/youtube`)
      if (!res.ok) throw new Error('Failed to fetch digest dates')
      const data = await res.json()
      setAvailableDates(data.digests || [])
      // Auto-select the most recent date
      if (data.digests?.length > 0) {
        setSelectedDate(data.digests[0].date)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load digests')
    } finally {
      setLoading(false)
    }
  }

  const fetchDigest = async (date: string, brief: boolean) => {
    try {
      setLoadingDigest(true)
      const res = await fetch(`${API_BASE}/api/digests/youtube/${date}?brief=${brief}`)
      if (!res.ok) throw new Error('Failed to fetch digest')
      const data = await res.json()
      setDigestData(data)
      setExpandedVideos(new Set()) // Reset expanded state
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load digest')
    } finally {
      setLoadingDigest(false)
    }
  }

  const toggleExpanded = (videoId: string) => {
    setExpandedVideos(prev => {
      const next = new Set(prev)
      if (next.has(videoId)) {
        next.delete(videoId)
      } else {
        next.add(videoId)
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

  const formatPublishedTime = (publishedAt: string) => {
    try {
      const date = new Date(publishedAt)
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })
    } catch {
      return ''
    }
  }

  // Convert timestamp string (e.g., "2:30" or "1:15:30") to seconds
  const timestampToSeconds = (time: string): number => {
    const parts = time.split(':').map(Number)
    if (parts.length === 3) {
      // HH:MM:SS
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    } else if (parts.length === 2) {
      // MM:SS
      return parts[0] * 60 + parts[1]
    }
    return 0
  }

  // Generate YouTube URL with timestamp
  const getYouTubeTimestampUrl = (videoId: string, time: string): string => {
    const seconds = timestampToSeconds(time)
    return `https://www.youtube.com/watch?v=${videoId}&t=${seconds}`
  }

  if (loading) {
    return (
      <PageContainer title="YouTube Digests">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      </PageContainer>
    )
  }

  if (error) {
    return (
      <PageContainer title="YouTube Digests">
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-center">
          <p className="text-red-400">{error}</p>
          <button 
            onClick={() => { setError(null); fetchAvailableDates(); }}
            className="mt-3 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm"
          >
            Try Again
          </button>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer title="YouTube Digests">
      {/* Header Controls */}
      <div className="flex items-center justify-between gap-2 mb-4">
        {/* Date Picker */}
        <div className="relative">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          >
            <Calendar className="w-4 h-4 text-slate-400" />
            {selectedDate ? formatDate(selectedDate) : 'Select date'}
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
          
          {showDatePicker && (
            <div className="absolute top-full left-0 mt-1 w-64 max-h-64 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
              {availableDates.map((d) => (
                <button
                  key={d.date}
                  onClick={() => { setSelectedDate(d.date); setShowDatePicker(false); }}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-slate-700 transition-colors ${
                    selectedDate === d.date ? 'bg-blue-500/20 text-blue-400' : 'text-slate-300'
                  }`}
                >
                  <span>{formatDate(d.date)}</span>
                  <span className="text-xs text-slate-500">{d.totalVideos} videos</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Brief Mode Toggle */}
        <button
          onClick={() => setBriefMode(!briefMode)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            briefMode 
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
              : 'bg-slate-800 text-slate-300 border border-slate-700'
          }`}
        >
          {briefMode ? <BookOpen className="w-4 h-4" /> : <List className="w-4 h-4" />}
          {briefMode ? 'Brief' : 'Full'}
        </button>
      </div>

      {/* Stats Bar */}
      {digestData && (
        <div className="flex items-center gap-4 mb-4 text-sm text-slate-400">
          <span className="flex items-center gap-1">
            <Play className="w-4 h-4" />
            {digestData.totalVideos} videos
          </span>
          <span>•</span>
          <span>{digestData.channelCount} channels</span>
        </div>
      )}

      {/* Loading State */}
      {loadingDigest && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      )}

      {/* Video Cards */}
      {digestData && !loadingDigest && (
        <div className="space-y-3">
          {digestData.videos.map((video) => {
            const isExpanded = expandedVideos.has(video.videoId)
            
            return (
              <div
                key={video.videoId}
                className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden"
              >
                {/* Card Header */}
                <button
                  onClick={() => toggleExpanded(video.videoId)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg" title={video.sentimentLabel}>
                          {video.sentiment}
                        </span>
                        <h3 className="text-white font-medium text-sm line-clamp-2">
                          {video.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="text-blue-400">{video.channelName}</span>
                        <span>•</span>
                        <span>{formatPublishedTime(video.publishedAt)}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-slate-400">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </div>

                  {/* Topics Pills */}
                  {video.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {video.topics.slice(0, 4).map((topic, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-slate-700/50 text-slate-300 text-xs rounded-full"
                        >
                          {topic}
                        </span>
                      ))}
                      {video.topics.length > 4 && (
                        <span className="px-2 py-0.5 text-slate-500 text-xs">
                          +{video.topics.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-700/50">
                    {/* Summary */}
                    <div className="mt-3">
                      <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        Summary
                      </h4>
                      <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                        {video.summary}
                      </p>
                    </div>

                    {/* Top Bullets */}
                    {video.topBullets && video.topBullets.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                          Key Takeaways
                        </h4>
                        <ul className="space-y-2">
                          {video.topBullets.map((bullet, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                              <span className="text-blue-400 mt-0.5">•</span>
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Timestamps */}
                    {video.timestamps.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Timestamps
                        </h4>
                        <div className="space-y-1.5">
                          {video.timestamps.slice(0, 6).map((ts, i) => (
                            <a
                              key={i}
                              href={getYouTubeTimestampUrl(video.videoId, ts.time)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-start gap-2 text-sm hover:bg-slate-700/50 rounded px-1 -mx-1 py-0.5 transition-colors"
                            >
                              <span className="text-blue-400 font-mono text-xs w-12 flex-shrink-0 hover:text-blue-300">
                                {ts.time}
                              </span>
                              <span className="text-slate-400 hover:text-slate-300">{ts.label || ts.description}</span>
                            </a>
                          ))}
                          {video.timestamps.length > 6 && (
                            <span className="text-slate-500 text-xs">
                              +{video.timestamps.length - 6} more...
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Watch Link */}
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      Watch on YouTube
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Empty State */}
      {digestData && digestData.videos.length === 0 && !loadingDigest && (
        <div className="text-center py-8 text-slate-400">
          <Play className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No videos in this digest</p>
        </div>
      )}

      {/* No Digests Available */}
      {availableDates.length === 0 && !loading && (
        <div className="text-center py-8 text-slate-400">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No YouTube digests available</p>
          <p className="text-sm mt-1">Check back after the daily digest runs</p>
        </div>
      )}
    </PageContainer>
  )
}
