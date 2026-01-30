import { useState, useEffect, useRef, useCallback } from 'react'
import { ChatMessage } from '../lib/api'

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface WsMessage {
  type: string
  payload?: any
  timestamp?: string
  message?: string
}

interface UseWebSocketOptions {
  onMessage?: (message: ChatMessage) => void
  onResponse?: (message: ChatMessage) => void
  onTyping?: (payload: { userId?: string }) => void
  onStatusUpdate?: (status: any) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

// Determine WebSocket URL based on current host
function getWsUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:3033'
  
  const host = window.location.hostname
  
  // If accessing via Tailscale domain, use wss with same domain
  if (host.includes('.ts.net')) {
    return `wss://${host.split(':')[0]}:3033`
  }
  
  // Local development
  return 'ws://localhost:3033'
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { onMessage, onResponse, onTyping, onStatusUpdate, onConnect, onDisconnect } = options
  
  const [status, setStatus] = useState<WebSocketStatus>('disconnected')
  const [lastError, setLastError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 10
  const baseReconnectDelay = 1000 // 1 second base delay
  
  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return // Already connected
    }
    
    const url = getWsUrl()
    console.log(`🔌 Connecting to WebSocket: ${url}`)
    setStatus('connecting')
    setLastError(null)
    
    try {
      const ws = new WebSocket(url)
      wsRef.current = ws
      
      ws.onopen = () => {
        console.log('✅ WebSocket connected')
        setStatus('connected')
        setLastError(null)
        reconnectAttemptsRef.current = 0
        onConnect?.()
      }
      
      ws.onmessage = (event) => {
        try {
          const data: WsMessage = JSON.parse(event.data)
          handleMessage(data)
        } catch (err) {
          console.error('WebSocket message parse error:', err)
        }
      }
      
      ws.onclose = (event) => {
        console.log(`🔌 WebSocket closed: ${event.code} ${event.reason}`)
        setStatus('disconnected')
        wsRef.current = null
        onDisconnect?.()
        
        // Attempt to reconnect with exponential backoff
        scheduleReconnect()
      }
      
      ws.onerror = (event) => {
        console.error('WebSocket error:', event)
        setStatus('error')
        setLastError('WebSocket connection error')
      }
    } catch (err: any) {
      console.error('Failed to create WebSocket:', err)
      setStatus('error')
      setLastError(err.message || 'Failed to connect')
      scheduleReconnect()
    }
  }, [onConnect, onDisconnect])
  
  // Handle incoming messages
  const handleMessage = useCallback((data: WsMessage) => {
    const { type, payload } = data
    
    switch (type) {
      case 'connected':
        console.log('WebSocket handshake complete')
        break
        
      case 'chat:message':
        // Message from another client/device
        if (payload && onMessage) {
          onMessage(payload as ChatMessage)
        }
        break
        
      case 'chat:message:ack':
        // Acknowledgment of our sent message
        if (payload && onMessage) {
          onMessage(payload as ChatMessage)
        }
        break
        
      case 'chat:response':
        // Response from Skipper
        if (payload && onResponse) {
          onResponse(payload as ChatMessage)
        }
        break
        
      case 'chat:typing':
        onTyping?.(payload || {})
        break
        
      case 'status:update':
        onStatusUpdate?.(payload)
        break
        
      case 'pong':
        // Heartbeat response
        break
        
      case 'error':
        console.error('WebSocket error:', data.message)
        setLastError(data.message || 'Unknown error')
        break
        
      default:
        console.log('Unknown WebSocket message type:', type)
    }
  }, [onMessage, onResponse, onTyping, onStatusUpdate])
  
  // Schedule reconnection with exponential backoff
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.log('Max reconnect attempts reached')
      setLastError('Unable to connect after multiple attempts')
      return
    }
    
    const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current)
    const jitter = Math.random() * 1000 // Add some randomness
    const totalDelay = Math.min(delay + jitter, 30000) // Cap at 30 seconds
    
    console.log(`Scheduling reconnect in ${Math.round(totalDelay / 1000)}s (attempt ${reconnectAttemptsRef.current + 1})`)
    
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current++
      connect()
    }, totalDelay)
  }, [connect])
  
  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    
    setStatus('disconnected')
  }, [])
  
  // Send a chat message via WebSocket
  const sendMessage = useCallback((content: string): boolean => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send message')
      return false
    }
    
    wsRef.current.send(JSON.stringify({
      type: 'chat:message',
      payload: { content }
    }))
    
    return true
  }, [])
  
  // Send typing indicator
  const sendTyping = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return
    }
    
    wsRef.current.send(JSON.stringify({
      type: 'chat:typing',
      payload: { timestamp: new Date().toISOString() }
    }))
  }, [])
  
  // Send ping (heartbeat)
  const sendPing = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return
    }
    
    wsRef.current.send(JSON.stringify({ type: 'ping' }))
  }, [])
  
  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect()
    
    // Set up ping interval to keep connection alive
    const pingInterval = setInterval(() => {
      sendPing()
    }, 30000) // Ping every 30 seconds
    
    return () => {
      clearInterval(pingInterval)
      disconnect()
    }
  }, [connect, disconnect, sendPing])
  
  return {
    status,
    isConnected: status === 'connected',
    lastError,
    sendMessage,
    sendTyping,
    connect,
    disconnect
  }
}

export default useWebSocket
