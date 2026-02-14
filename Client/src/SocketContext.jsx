import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { SOCKET_URL } from './config';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [totalOnlineUsers, setTotalOnlineUsers] = useState(0);
  const [modeOnlineUsers, setModeOnlineUsers] = useState({ hardcore: 0, cdl: 0 });
  const joinedRoomsRef = useRef(new Set());
  const currentModeRef = useRef(null);
  const eventListenersRef = useRef(new Map());

  // Get user ID (handle both 'id' and '_id' formats from API)
  const userId = user?.id || user?._id;

  // Initialize socket connection once
  useEffect(() => {
    console.log('[Socket] Connecting to:', SOCKET_URL);
    // Create socket connection
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      setIsConnected(true);
      
      // Re-join all rooms after reconnection
      joinedRoomsRef.current.forEach(room => {
        if (room.startsWith('user-')) {
          socket.emit('joinUserRoom', room.replace('user-', ''));
        } else if (room.startsWith('page-')) {
          socket.emit('joinPage', { page: room.replace('page-', '') });
        } else if (room.startsWith('match-')) {
          socket.emit('joinMatch', room.replace('match-', ''));
        } else if (room.startsWith('ranked-match-')) {
          socket.emit('joinRankedMatch', room.replace('ranked-match-', ''));
        } else if (room.startsWith('stricker-match-')) {
          socket.emit('joinStrickerMatch', room.replace('stricker-match-', ''));
        } else if (room.startsWith('tournament-')) {
          socket.emit('joinTournament', room.replace('tournament-', ''));
        }
      });
      
      // Re-join mode room after reconnection
      if (currentModeRef.current) {
        socket.emit('joinMode', currentModeRef.current);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
    });

    socket.on('totalOnlineUsers', (count) => {
      setTotalOnlineUsers(count);
    });

    socket.on('modeOnlineUsers', ({ mode, count }) => {
      setModeOnlineUsers(prev => ({ ...prev, [mode]: count }));
    });

    return () => {
      console.log('[Socket] Cleaning up connection');
      socket.disconnect();
      socketRef.current = null;
      joinedRoomsRef.current.clear();
      eventListenersRef.current.clear();
    };
  }, []); // Only run once on mount

  // Join user's personal room when authenticated
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !isConnected || !userId) return;

    const userRoom = `user-${userId}`;
    if (!joinedRoomsRef.current.has(userRoom)) {
      console.log('[Socket] Joining user room:', userId);
      socket.emit('joinUserRoom', userId);
      joinedRoomsRef.current.add(userRoom);
    }

    return () => {
      if (socket && joinedRoomsRef.current.has(userRoom)) {
        console.log('[Socket] Leaving user room:', userId);
        socket.emit('leaveUserRoom', userId);
        joinedRoomsRef.current.delete(userRoom);
      }
    };
  }, [isConnected, userId]);

  // Join a page room
  const joinPage = useCallback((page) => {
    const socket = socketRef.current;
    if (!socket || !isConnected) return;

    const pageRoom = `page-${page}`;
    if (!joinedRoomsRef.current.has(pageRoom)) {
      console.log('[Socket] Joining page:', page);
      socket.emit('joinPage', { page });
      joinedRoomsRef.current.add(pageRoom);
    }
  }, [isConnected]);

  // Leave a page room
  const leavePage = useCallback((page) => {
    const socket = socketRef.current;
    if (!socket) return;

    const pageRoom = `page-${page}`;
    if (joinedRoomsRef.current.has(pageRoom)) {
      console.log('[Socket] Leaving page:', page);
      socket.emit('leavePage', { page });
      joinedRoomsRef.current.delete(pageRoom);
    }
  }, []);

  // Join a match room
  const joinMatch = useCallback((matchId) => {
    const socket = socketRef.current;
    if (!socket || !isConnected) return;

    const matchRoom = `match-${matchId}`;
    if (!joinedRoomsRef.current.has(matchRoom)) {
      console.log('[Socket] Joining match:', matchId);
      socket.emit('joinMatch', matchId);
      joinedRoomsRef.current.add(matchRoom);
    }
  }, [isConnected]);

  // Leave a match room
  const leaveMatch = useCallback((matchId) => {
    const socket = socketRef.current;
    if (!socket) return;

    const matchRoom = `match-${matchId}`;
    if (joinedRoomsRef.current.has(matchRoom)) {
      console.log('[Socket] Leaving match:', matchId);
      socket.emit('leaveMatch', matchId);
      joinedRoomsRef.current.delete(matchRoom);
    }
  }, []);

  // Join a ranked match room
  const joinRankedMatch = useCallback((matchId) => {
    const socket = socketRef.current;
    if (!socket || !isConnected) return;

    const matchRoom = `ranked-match-${matchId}`;
    if (!joinedRoomsRef.current.has(matchRoom)) {
      console.log('[Socket] Joining ranked match:', matchId);
      socket.emit('joinRankedMatch', matchId);
      joinedRoomsRef.current.add(matchRoom);
    }
  }, [isConnected]);

  // Leave a ranked match room
  const leaveRankedMatch = useCallback((matchId) => {
    const socket = socketRef.current;
    if (!socket) return;

    const matchRoom = `ranked-match-${matchId}`;
    if (joinedRoomsRef.current.has(matchRoom)) {
      console.log('[Socket] Leaving ranked match:', matchId);
      socket.emit('leaveRankedMatch', matchId);
      joinedRoomsRef.current.delete(matchRoom);
    }
  }, []);

  // Join a Stricker match room
  const joinStrickerMatch = useCallback((matchId) => {
    const socket = socketRef.current;
    if (!socket || !isConnected) return;

    const matchRoom = `stricker-match-${matchId}`;
    if (!joinedRoomsRef.current.has(matchRoom)) {
      console.log('[Socket] Joining Stricker match:', matchId);
      socket.emit('joinStrickerMatch', matchId);
      joinedRoomsRef.current.add(matchRoom);
    }
  }, [isConnected]);

  // Leave a Stricker match room
  const leaveStrickerMatch = useCallback((matchId) => {
    const socket = socketRef.current;
    if (!socket) return;

    const matchRoom = `stricker-match-${matchId}`;
    if (joinedRoomsRef.current.has(matchRoom)) {
      console.log('[Socket] Leaving Stricker match:', matchId);
      socket.emit('leaveStrickerMatch', matchId);
      joinedRoomsRef.current.delete(matchRoom);
    }
  }, []);

  // Join Stricker mode room (for match created notifications)
  const joinStrickerMode = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !isConnected) return;

    if (!joinedRoomsRef.current.has('stricker-mode')) {
      console.log('[Socket] Joining Stricker mode room');
      socket.emit('joinStrickerMode');
      joinedRoomsRef.current.add('stricker-mode');
    }
  }, [isConnected]);

  // Leave Stricker mode room
  const leaveStrickerMode = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;

    if (joinedRoomsRef.current.has('stricker-mode')) {
      console.log('[Socket] Leaving Stricker mode room');
      socket.emit('leaveStrickerMode');
      joinedRoomsRef.current.delete('stricker-mode');
    }
  }, []);

  // Join a tournament room (for real-time tournament updates)
  const joinTournament = useCallback((tournamentId) => {
    const socket = socketRef.current;
    if (!socket || !isConnected) return;

    const tournamentRoom = `tournament-${tournamentId}`;
    if (!joinedRoomsRef.current.has(tournamentRoom)) {
      console.log('[Socket] Joining tournament:', tournamentId);
      socket.emit('joinTournament', tournamentId);
      joinedRoomsRef.current.add(tournamentRoom);
    }
  }, [isConnected]);

  // Leave a tournament room
  const leaveTournament = useCallback((tournamentId) => {
    const socket = socketRef.current;
    if (!socket) return;

    const tournamentRoom = `tournament-${tournamentId}`;
    if (joinedRoomsRef.current.has(tournamentRoom)) {
      console.log('[Socket] Leaving tournament:', tournamentId);
      socket.emit('leaveTournament', tournamentId);
      joinedRoomsRef.current.delete(tournamentRoom);
    }
  }, []);

  // Join a mode room (for tracking mode-specific online users)
  const joinMode = useCallback((mode) => {
    const socket = socketRef.current;
    if (!socket || !isConnected) return;
    
    if (mode === 'hardcore' || mode === 'cdl') {
      console.log('[Socket] Joining mode:', mode);
      socket.emit('joinMode', mode);
      currentModeRef.current = mode;
    }
  }, [isConnected]);

  // Leave a mode room
  const leaveMode = useCallback((mode) => {
    const socket = socketRef.current;
    if (!socket) return;
    
    if (mode === 'hardcore' || mode === 'cdl') {
      console.log('[Socket] Leaving mode:', mode);
      socket.emit('leaveMode', mode);
      if (currentModeRef.current === mode) {
        currentModeRef.current = null;
      }
    }
  }, []);

  // Subscribe to an event (with automatic cleanup tracking)
  const on = useCallback((event, callback) => {
    const socket = socketRef.current;
    if (!socket) return () => {};

    socket.on(event, callback);
    
    // Track listener for potential cleanup
    if (!eventListenersRef.current.has(event)) {
      eventListenersRef.current.set(event, new Set());
    }
    eventListenersRef.current.get(event).add(callback);

    // Return unsubscribe function
    return () => {
      socket.off(event, callback);
      eventListenersRef.current.get(event)?.delete(callback);
    };
  }, []);

  // Unsubscribe from an event
  const off = useCallback((event, callback) => {
    const socket = socketRef.current;
    if (!socket) return;

    if (callback) {
      socket.off(event, callback);
      eventListenersRef.current.get(event)?.delete(callback);
    } else {
      socket.off(event);
      eventListenersRef.current.delete(event);
    }
  }, []);

  // Emit an event
  const emit = useCallback((event, data) => {
    const socket = socketRef.current;
    if (!socket || !isConnected) {
      console.warn('[Socket] Cannot emit, socket not connected');
      return;
    }
    socket.emit(event, data);
  }, [isConnected]);

  const value = {
    socket: socketRef.current,
    isConnected,
    totalOnlineUsers,
    modeOnlineUsers,
    joinPage,
    leavePage,
    joinMatch,
    leaveMatch,
    joinRankedMatch,
    leaveRankedMatch,
    joinStrickerMatch,
    leaveStrickerMatch,
    joinStrickerMode,
    leaveStrickerMode,
    joinTournament,
    leaveTournament,
    joinMode,
    leaveMode,
    on,
    off,
    emit,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;

