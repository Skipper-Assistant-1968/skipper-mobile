import { useState, useEffect, useCallback } from 'react'

export interface HeartbeatState {
  connected: boolean
  lastPing: Date | null
  latencyMs: number | null
  error: string | null
}

interface UseHeartbeatOptions {
  gatewayUrl?: string
  intervalMs?: number
  enabled?: boolean
}

const DEFAULT_GATEWAY_URL = 'http://localhost:3030'
const DEFAULT_INTERVAL_MS = 30000

export function useHeartbeat(options: UseHeartbeatOptions = {}) {
  const {
    gatewayUrl = DEFAULT_GATEWAY_URL,
    intervalMs = DEFAULT_INTERVAL_MS,
    enabled = true,
  } = options

  const [state, setState] = useState<HeartbeatState>({
    connected: false,
    lastPing: null,
    latencyMs: null,
    error: null,
  })

  const checkHeartbeat = useCallback(async () => {
    if (!enabled) return

    const start = Date.now()
    try {
      const response = await fetch(`${gatewayUrl}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      })

      if (response.ok) {
        setState({
          connected: true,
          lastPing: new Date(),
          latencyMs: Date.now() - start,
          error: null,
        })
      } else {
        setState({
          connected: false,
          lastPing: null,
          latencyMs: null,
          error: `Server returned ${response.status}`,
        })
      }
    } catch (err) {
      setState({
        connected: false,
        lastPing: null,
        latencyMs: null,
        error: err instanceof Error ? err.message : 'Connection failed',
      })
    }
  }, [gatewayUrl, enabled])

  useEffect(() => {
    if (!enabled) return

    // Initial check
    checkHeartbeat()

    // Set up interval
    const interval = setInterval(checkHeartbeat, intervalMs)
    return () => clearInterval(interval)
  }, [checkHeartbeat, intervalMs, enabled])

  return {
    ...state,
    refresh: checkHeartbeat,
  }
}
