import { useState, useEffect, useRef, useCallback } from 'react'
import { PageContainer } from '../components/PageContainer'
import { api, ChatMessage } from '../lib/api'

export function ChatPage() {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Load chat history on mount
  useEffect(() => {
    loadChatHistory()
  }, [])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Poll for new messages every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      pollForNewMessages()
    }, 5000)
    return () => clearInterval(interval)
  }, [messages])

  async function loadChatHistory() {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.getChatHistory(50)
      setMessages(response.messages)
    } catch (err: any) {
      console.error('Failed to load chat history:', err)
      setError('Failed to load chat history')
    } finally {
      setIsLoading(false)
    }
  }

  async function pollForNewMessages() {
    if (messages.length === 0) return
    
    try {
      const lastId = messages[messages.length - 1]?.id
      const response = await api.getChatHistory(20, lastId)
      if (response.messages.length > 0) {
        setMessages(prev => [...prev, ...response.messages])
      }
    } catch (err) {
      // Silent fail on polling - don't disrupt UX
      console.debug('Polling failed:', err)
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    
    const trimmedMessage = message.trim()
    if (!trimmedMessage || isSending) return

    // Optimistic update - add message immediately
    const optimisticMessage: ChatMessage = {
      id: `temp_${Date.now()}`,
      role: 'user',
      content: trimmedMessage,
      timestamp: new Date().toISOString(),
      status: 'sending'
    }

    setMessages(prev => [...prev, optimisticMessage])
    setMessage('')
    setIsSending(true)
    setError(null)

    try {
      const response = await api.sendMessage(trimmedMessage)
      
      // Replace optimistic message with real one
      setMessages(prev => prev.map(m => 
        m.id === optimisticMessage.id 
          ? { ...response.message, status: 'sent' as const }
          : m
      ))

      // Focus input for next message
      inputRef.current?.focus()
    } catch (err: any) {
      console.error('Failed to send message:', err)
      
      // Mark optimistic message as failed
      setMessages(prev => prev.map(m =>
        m.id === optimisticMessage.id
          ? { ...m, status: 'error' as const }
          : m
      ))
      
      setError('Failed to send message. Tap to retry.')
    } finally {
      setIsSending(false)
    }
  }

  function formatTime(timestamp: string) {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Could be used for message timestamps in future
  // function formatRelativeTime(timestamp: string) { ... }

  return (
    <PageContainer>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Chat messages area */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4 px-1">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-pulse">
                <span className="text-4xl mb-4 block">⏳</span>
                <p className="text-slate-400 text-sm">Loading messages...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-4xl mb-4 block">⚓</span>
              <h2 className="text-xl font-semibold text-white mb-2">Welcome to Skipper</h2>
              <p className="text-slate-400 text-sm max-w-xs mx-auto">
                Your AI assistant is ready. Start a conversation below.
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl p-3 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 rounded-br-sm'
                        : 'bg-slate-800 rounded-bl-sm'
                    } ${msg.status === 'error' ? 'opacity-60 border border-red-500' : ''}`}
                  >
                    <p className="text-sm text-white whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                    <div className="flex items-center justify-between mt-1 gap-2">
                      <span className="text-xs text-slate-400">
                        {msg.role === 'assistant' ? 'Skipper • ' : ''}{formatTime(msg.timestamp)}
                      </span>
                      {msg.role === 'user' && (
                        <span className="text-xs">
                          {msg.status === 'sending' && '⏳'}
                          {msg.status === 'sent' && '✓'}
                          {msg.status === 'delivered' && '✓✓'}
                          {msg.status === 'error' && '⚠️'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg px-3 py-2 mb-2">
            <p className="text-red-200 text-xs">{error}</p>
          </div>
        )}
        
        {/* Input area */}
        <div className="sticky bottom-20 bg-slate-900 pt-2">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Message Skipper..."
              disabled={isSending}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-full px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50"
            />
            <button 
              type="submit"
              className={`rounded-full w-12 h-12 flex items-center justify-center transition-colors ${
                message.trim() && !isSending
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
              disabled={!message.trim() || isSending}
            >
              {isSending ? (
                <span className="animate-spin">◌</span>
              ) : (
                <span className="text-lg">↑</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </PageContainer>
  )
}
