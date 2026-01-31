import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { PageContainer } from '../components/PageContainer'
import { QuickActions } from '../components/QuickActions'
import { api, ChatMessage } from '../lib/api'
import { useTheme } from '../context/ThemeContext'

// Types are declared in src/types/speech.d.ts
import { useWebSocket } from '../hooks/useWebSocket'

export function ChatPage() {
  const { isDark } = useTheme()
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  
  // Setup speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map((result: SpeechRecognitionResult) => result[0].transcript)
          .join('')
        setMessage(transcript)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognition.onerror = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      setError('Voice input not supported in this browser')
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      setIsListening(true)
      recognitionRef.current.start()
    }
  }
  const pendingMessageRef = useRef<string | null>(null)

  // Handle incoming messages via WebSocket
  const handleWsMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => {
      // Check if this is an acknowledgment of a message we sent
      const pendingId = pendingMessageRef.current
      if (pendingId && msg.role === 'user') {
        // Replace optimistic message with real one
        const updated = prev.map(m => 
          m.id === pendingId ? { ...msg, status: 'sent' as const } : m
        )
        pendingMessageRef.current = null
        return updated
      }
      
      // Check for duplicate
      if (prev.some(m => m.id === msg.id)) {
        return prev
      }
      
      return [...prev, msg]
    })
  }, [])

  // Handle Skipper's response via WebSocket
  const handleWsResponse = useCallback((msg: ChatMessage) => {
    setMessages(prev => {
      // Check for duplicate
      if (prev.some(m => m.id === msg.id)) {
        return prev
      }
      return [...prev, msg]
    })
  }, [])

  // WebSocket connection
  const { 
    isConnected, 
    status: wsStatus, 
    sendMessage: wsSendMessage,
    lastError: wsError 
  } = useWebSocket({
    onMessage: handleWsMessage,
    onResponse: handleWsResponse,
    onConnect: () => {
      console.log('WebSocket connected - real-time chat enabled')
      setError(null)
    },
    onDisconnect: () => {
      console.log('WebSocket disconnected - falling back to polling')
    }
  })

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

  // Poll for new messages only when WebSocket is disconnected
  useEffect(() => {
    if (isConnected) {
      // WebSocket is active, no need to poll
      return
    }

    const interval = setInterval(() => {
      pollForNewMessages()
    }, 5000)
    return () => clearInterval(interval)
  }, [messages, isConnected])

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
    const optimisticId = `temp_${Date.now()}`
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      role: 'user',
      content: trimmedMessage,
      timestamp: new Date().toISOString(),
      status: 'sending'
    }

    setMessages(prev => [...prev, optimisticMessage])
    setMessage('')
    setIsSending(true)
    setError(null)
    pendingMessageRef.current = optimisticId

    // Try WebSocket first, fall back to REST API
    if (isConnected && wsSendMessage(trimmedMessage)) {
      // Message sent via WebSocket - wait for acknowledgment
      console.log('📤 Message sent via WebSocket')
      
      // Set a timeout to fall back to REST if no ack received
      setTimeout(() => {
        if (pendingMessageRef.current === optimisticId) {
          console.log('No WebSocket ack, falling back to REST')
          sendViaRest(trimmedMessage, optimisticId)
        }
      }, 3000)
      
      setIsSending(false)
      inputRef.current?.focus()
    } else {
      // WebSocket not available, use REST API
      console.log('📤 Sending via REST API (WebSocket unavailable)')
      await sendViaRest(trimmedMessage, optimisticId)
    }
  }

  async function sendViaRest(content: string, optimisticId: string) {
    try {
      const response = await api.sendMessage(content)
      
      // Replace optimistic message with real one
      setMessages(prev => prev.map(m => 
        m.id === optimisticId 
          ? { ...response.message, status: 'sent' as const }
          : m
      ))
      pendingMessageRef.current = null
      inputRef.current?.focus()
    } catch (err: any) {
      console.error('Failed to send message:', err)
      
      // Mark optimistic message as failed
      setMessages(prev => prev.map(m =>
        m.id === optimisticId
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

  // Connection status indicator
  function getConnectionStatus() {
    if (isConnected) {
      return { icon: '🟢', text: 'Live' }
    }
    if (wsStatus === 'connecting') {
      return { icon: '🟡', text: 'Connecting...' }
    }
    return { icon: '🔴', text: 'Polling' }
  }

  const connStatus = getConnectionStatus()

  return (
    <PageContainer>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Connection status indicator */}
        <div className="flex justify-end items-center px-2 py-1 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span>{connStatus.icon}</span>
            <span>{connStatus.text}</span>
          </span>
        </div>

        {/* Quick Actions Panel - show when no messages */}
        {messages.length === 0 && !isLoading && (
          <div className="mb-3">
            <QuickActions onActionSent={() => setTimeout(pollForNewMessages, 1000)} />
          </div>
        )}

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
              <h2 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Welcome to Skipper</h2>
              <p className={`text-sm max-w-xs mx-auto ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
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
                        : isDark ? 'bg-slate-800 rounded-bl-sm' : 'bg-slate-200 rounded-bl-sm'
                    } ${msg.status === 'error' ? 'opacity-60 border border-red-500' : ''}`}
                  >
                    <p className={`text-sm whitespace-pre-wrap break-words ${
                      msg.role === 'user' ? 'text-white' : isDark ? 'text-white' : 'text-slate-900'
                    }`}>
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
        {(error || wsError) && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg px-3 py-2 mb-2">
            <p className="text-red-200 text-xs">{error || wsError}</p>
          </div>
        )}
        
        {/* Input area */}
        <div className={`sticky bottom-20 pt-2 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
          <form onSubmit={handleSendMessage} className="flex gap-2">
            {/* Voice input button */}
            <button
              type="button"
              onClick={toggleVoiceInput}
              className={`rounded-full w-12 h-12 flex items-center justify-center transition-colors flex-shrink-0 ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : isDark 
                    ? 'bg-slate-700 hover:bg-slate-600 text-slate-400'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-600'
              }`}
            >
              {isListening ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
            
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={isListening ? "Listening..." : "Message Skipper..."}
              disabled={isSending}
              className={`flex-1 border rounded-full px-4 py-3 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50 ${
                isDark 
                  ? 'bg-slate-800 text-white placeholder-slate-500 border-slate-700'
                  : 'bg-white text-slate-900 placeholder-slate-400 border-slate-300'
              } ${isListening ? 'border-red-500' : ''}`}
            />
            <button 
              type="submit"
              className={`rounded-full w-12 h-12 flex items-center justify-center transition-colors flex-shrink-0 ${
                message.trim() && !isSending
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : isDark 
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
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
          
          {/* Voice input hint */}
          {isListening && (
            <p className="text-center text-xs text-red-400 mt-2 animate-pulse">
              🎤 Listening... tap mic to stop
            </p>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
