'use client'

import { useEffect } from 'react'
import { useSocketConnection } from '@/contexts/SocketContext'
import { registerSocketNotifications } from '@/lib/socket-notifications'

export function SocketEventToasts() {
  const { socket } = useSocketConnection()

  useEffect(() => {
    if (!socket) return
    return registerSocketNotifications(socket)
  }, [socket])

  return null
}
