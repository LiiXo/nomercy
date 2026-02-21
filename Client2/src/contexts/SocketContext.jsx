import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'
import { SOCKET_URL } from '../config'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

export const SocketProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth()
  const socketRef = useRef(null)
  const [isConnected, setIsConnected] = useState(false)
  const eventListenersRef = useRef(new Map())

  // Get user ID
  const userId = user?._id || user?.id

  // Initialize socket connection once
  useEffect(() => {
    console.log('[Socket] Connecting to:', SOCKET_URL)
    
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id)
      setIsConnected(true)
    })

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
      setIsConnected(false)
    })

    socket.on('reconnect', (attemptNumber) => {
      console.log('[Socket] Reconnected after', attemptNumber, 'attempts')
    })

    return () => {
      console.log('[Socket] Cleaning up connection')
      socket.disconnect()
      socketRef.current = null
      eventListenersRef.current.clear()
    }
  }, [])

  // Join user's personal room when authenticated
  useEffect(() => {
    if (isConnected && userId && socketRef.current) {
      socketRef.current.emit('joinUserRoom', userId)
      console.log('[Socket] Joined user room:', userId)
    }

    return () => {
      if (userId && socketRef.current) {
        socketRef.current.emit('leaveUserRoom', userId)
      }
    }
  }, [isConnected, userId])

  // Subscribe to events
  const on = useCallback((event, callback) => {
    if (!socketRef.current) return () => {}

    socketRef.current.on(event, callback)
    
    // Track listener
    if (!eventListenersRef.current.has(event)) {
      eventListenersRef.current.set(event, new Set())
    }
    eventListenersRef.current.get(event).add(callback)

    // Return cleanup function
    return () => {
      if (socketRef.current) {
        socketRef.current.off(event, callback)
      }
      eventListenersRef.current.get(event)?.delete(callback)
    }
  }, [])

  // Emit events
  const emit = useCallback((event, data) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(event, data)
    }
  }, [isConnected])

  // Join a room
  const joinRoom = useCallback((room, data) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(room, data)
    }
  }, [isConnected])

  // Leave a room
  const leaveRoom = useCallback((room, data) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(room, data)
    }
  }, [isConnected])

  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      isConnected,
      on,
      emit,
      joinRoom,
      leaveRoom
    }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}
