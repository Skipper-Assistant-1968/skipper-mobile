// API client for Skipper Gateway and Mobile API

// @ts-ignore - Vite env types
const KANBAN_URL = (import.meta as any).env?.VITE_KANBAN_URL || 'http://localhost:3030'
// @ts-ignore - Vite env types
const MOBILE_API_URL = (import.meta as any).env?.VITE_MOBILE_API_URL || 'http://localhost:3031'

export interface ApiError {
  status: number
  message: string
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

  async getTasks(): Promise<any[]> {
    return this.request(this.kanbanUrl, '/api/tasks')
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
}

export const api = new SkipperApi()
export default api
