// API client for Skipper Gateway and Mobile API

// Dynamically determine API URLs based on current host
// If accessed via Tailscale, use Tailscale URLs; otherwise use localhost
const getBaseUrl = (port: number): string => {
  if (typeof window === 'undefined') return `http://localhost:${port}`
  
  const host = window.location.hostname
  const protocol = window.location.protocol
  
  // If accessing via Tailscale domain, use same domain with different port
  if (host.includes('.ts.net')) {
    return `${protocol}//${host.split(':')[0]}:${port}`
  }
  
  // Local development
  return `http://localhost:${port}`
}

const KANBAN_URL = getBaseUrl(3030)
// Tailscale port mapping: external 3031 → internal 3032
// Frontend must use the EXTERNAL port since it runs in the browser
const MOBILE_API_URL = getBaseUrl(3031)

export interface ApiError {
  status: number
  message: string
}

export interface Task {
  id: string
  title: string
  description?: string
  column: string
  category?: string
  createdAt: string
  updatedAt: string
  priority?: 'low' | 'medium' | 'high'
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  status: 'sending' | 'sent' | 'delivered' | 'error'
}

export interface SendMessageResponse {
  success: boolean
  message: ChatMessage
  timestamp: string
}

export interface ChatHistoryResponse {
  messages: ChatMessage[]
  total: number
  returned: number
  hasMore: boolean
}

export interface ChannelVideo {
  channel: string
  videos: {
    title: string
    videoId: string
    url: string
  }[]
}

export interface HotTopic {
  topic: string
  synthesis: string
  keyTakeaway: string
  executiveBriefing: string
  channelVideos: ChannelVideo[]
  heat: 'high' | 'medium' | 'low'
  videoCount: number
  date: string
}

export interface HotTopicsResponse {
  hotTopics: HotTopic[]
  count: number
  daysIncluded: string[]
  generatedAt: string
}

class SkipperApi {
  private kanbanUrl: string
  private mobileApiUrl: string

  constructor(kanbanUrl: string = KANBAN_URL, mobileApiUrl: string = MOBILE_API_URL) {
    this.kanbanUrl = kanbanUrl
    this.mobileApiUrl = mobileApiUrl
  }

  private async request<T>(baseUrl: string, endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${baseUrl}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw {
        status: response.status,
        message: await response.text(),
      } as ApiError
    }

    return response.json()
  }

  // ================
  // KANBAN API (3030)
  // ================

  async health(): Promise<{ status: string; timestamp: string }> {
    return this.request(this.kanbanUrl, '/health')
  }

  async getTasks(): Promise<Task[]> {
    return this.request(this.kanbanUrl, '/api/tasks')
  }

  async createTask(task: Partial<Task>): Promise<Task> {
    return this.request(this.kanbanUrl, '/api/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    })
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    return this.request(this.kanbanUrl, `/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  async deleteTask(id: string): Promise<void> {
    return this.request(this.kanbanUrl, `/api/tasks/${id}`, {
      method: 'DELETE',
    })
  }

  // ================
  // MOBILE API (3031)
  // ================

  async getHeartbeat(): Promise<any> {
    return this.request(this.mobileApiUrl, '/api/heartbeat')
  }

  async getStatus(): Promise<any> {
    return this.request(this.mobileApiUrl, '/api/status')
  }

  // ================
  // CHAT ENDPOINTS
  // ================

  async sendMessage(message: string): Promise<SendMessageResponse> {
    return this.request(this.mobileApiUrl, '/api/chat/send', {
      method: 'POST',
      body: JSON.stringify({ message }),
    })
  }

  async getChatHistory(limit = 50, after?: string): Promise<ChatHistoryResponse> {
    const params = new URLSearchParams({ limit: limit.toString() })
    if (after) params.append('after', after)
    return this.request(this.mobileApiUrl, `/api/chat/history?${params}`)
  }

  async clearChatHistory(): Promise<{ success: boolean; message: string }> {
    return this.request(this.mobileApiUrl, '/api/chat/history', {
      method: 'DELETE',
    })
  }

  // ================
  // WORK LOG
  // ================

  async getWorkLog(date?: string): Promise<any> {
    const endpoint = date ? `/api/work-log/${date}` : '/api/work-log'
    return this.request(this.mobileApiUrl, endpoint)
  }

  async getWorkLogs(): Promise<any> {
    return this.request(this.mobileApiUrl, '/api/work-logs')
  }

  // ================
  // HOT TOPICS
  // ================

  async getHotTopics(days = 5): Promise<HotTopicsResponse> {
    return this.request(this.mobileApiUrl, `/api/hot-topics?days=${days}`)
  }
}

export const api = new SkipperApi()
export default api
