/**
 * useMcpConnection - Hook to check MCP server connection status
 * Extracted from HomePage.tsx for reusability
 */

import { useState, useEffect } from 'react'

export function useMcpConnection() {
  const [mcpConnected, setMcpConnected] = useState<boolean>(false)
  const [mcpChecking, setMcpChecking] = useState<boolean>(true)

  const checkMcpConnection = async () => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000)
      const response = await fetch('/api/mcp/health', {
        signal: controller.signal,
        method: 'GET'
      })
      clearTimeout(timeoutId)
      setMcpConnected(response.ok)
      setMcpChecking(false)
    } catch (error: any) {
      setMcpConnected(false)
      setMcpChecking(false)
    }
  }

  useEffect(() => {
    checkMcpConnection()
    const interval = setInterval(checkMcpConnection, 15000) // Check every 15s instead of 5s
    return () => clearInterval(interval)
  }, [])

  return {
    mcpConnected,
    mcpChecking
  }
}
