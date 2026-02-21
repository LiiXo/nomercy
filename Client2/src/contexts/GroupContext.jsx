import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { API_URL } from '../config'
import { useAuth } from './AuthContext'
import { useSocket } from './SocketContext'

const GroupContext = createContext(null)

export const GroupProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth()
  const { on, emit, isConnected } = useSocket()
  const [group, setGroup] = useState(null)
  const [pendingInvites, setPendingInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const userId = user?._id || user?.id

  // Fetch current group
  const fetchGroup = useCallback(async () => {
    if (!isAuthenticated) {
      setGroup(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/groups/my`, {
        credentials: 'include'
      })
      const data = await response.json()
      
      if (data.success) {
        setGroup(data.group)
      } else {
        setError(data.message)
      }
    } catch (err) {
      console.error('Failed to fetch group:', err)
      setError('Failed to fetch group')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  // Silent refresh - no loading state, for background updates (Iris status)
  const silentRefresh = useCallback(async () => {
    if (!isAuthenticated || !group) return

    try {
      const response = await fetch(`${API_URL}/groups/my`, {
        credentials: 'include'
      })
      const data = await response.json()
      
      if (data.success && data.group) {
        setGroup(data.group)
      }
    } catch (err) {
      // Silent fail - don't show error for background refresh
      console.debug('Silent refresh failed:', err)
    }
  }, [isAuthenticated, group])

  // Fetch pending invites
  const fetchPendingInvites = useCallback(async () => {
    if (!isAuthenticated) {
      setPendingInvites([])
      return
    }

    try {
      const response = await fetch(`${API_URL}/groups/pending-invites`, {
        credentials: 'include'
      })
      const data = await response.json()
      
      if (data.success) {
        setPendingInvites(data.invites)
      }
    } catch (err) {
      console.error('Failed to fetch pending invites:', err)
    }
  }, [isAuthenticated])

  // Initialize group on auth change
  useEffect(() => {
    if (isAuthenticated) {
      fetchGroup()
      fetchPendingInvites()
    } else {
      setGroup(null)
      setPendingInvites([])
      setLoading(false)
    }
  }, [isAuthenticated, fetchGroup, fetchPendingInvites])

  // Join group room when group changes
  useEffect(() => {
    if (group?._id && isConnected) {
      emit('joinGroup', group._id)
      
      return () => {
        emit('leaveGroup', group._id)
      }
    }
  }, [group?._id, isConnected, emit])

  // Socket event listeners
  useEffect(() => {
    if (!isConnected) return

    // Group updated (members changed, etc.)
    const unsubGroupUpdated = on('groupUpdated', (updatedGroup) => {
      console.log('[Group] Updated:', updatedGroup)
      setGroup(updatedGroup)
    })

    // Received a new invite
    const unsubInvite = on('groupInvite', (invite) => {
      console.log('[Group] New invite:', invite)
      setPendingInvites(prev => [...prev, invite])
    })

    // Invite was cancelled
    const unsubInviteCancelled = on('inviteCancelled', ({ groupId }) => {
      console.log('[Group] Invite cancelled:', groupId)
      setPendingInvites(prev => prev.filter(i => i.groupId !== groupId))
    })

    // Kicked from group
    const unsubKicked = on('kickedFromGroup', ({ groupId, kickedBy }) => {
      console.log('[Group] Kicked from group by:', kickedBy)
      // Will receive a groupUpdated with new solo group
    })

    // Member joined
    const unsubMemberJoined = on('memberJoined', ({ userId: joinedUserId, username, group: updatedGroup }) => {
      console.log('[Group] Member joined:', username)
      setGroup(updatedGroup)
    })

    // Member left
    const unsubMemberLeft = on('memberLeft', ({ userId: leftUserId, username, newLeader }) => {
      console.log('[Group] Member left:', username)
      // Group will be updated via groupUpdated event
    })

    // Leader changed
    const unsubLeaderChanged = on('leaderChanged', ({ oldLeader, newLeader, group: updatedGroup }) => {
      console.log('[Group] Leader changed:', newLeader)
      setGroup(updatedGroup)
    })

    // Invite declined
    const unsubInviteDeclined = on('inviteDeclined', ({ userId: declinedUserId, username }) => {
      console.log('[Group] Invite declined by:', username)
      // Refresh group to update pending invites
      fetchGroup()
    })

    return () => {
      unsubGroupUpdated()
      unsubInvite()
      unsubInviteCancelled()
      unsubKicked()
      unsubMemberJoined()
      unsubMemberLeft()
      unsubLeaderChanged()
      unsubInviteDeclined()
    }
  }, [isConnected, on, fetchGroup])

  // Invite a player
  const invitePlayer = useCallback(async (username) => {
    try {
      const response = await fetch(`${API_URL}/groups/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username })
      })
      const data = await response.json()
      
      if (data.success) {
        setGroup(data.group)
      }
      
      return data
    } catch (err) {
      console.error('Failed to invite player:', err)
      return { success: false, message: 'Failed to invite player' }
    }
  }, [])

  // Accept an invite
  const acceptInvite = useCallback(async (groupId) => {
    try {
      const response = await fetch(`${API_URL}/groups/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ groupId })
      })
      const data = await response.json()
      
      if (data.success) {
        setGroup(data.group)
        setPendingInvites(prev => prev.filter(i => i.groupId !== groupId))
      }
      
      return data
    } catch (err) {
      console.error('Failed to accept invite:', err)
      return { success: false, message: 'Failed to accept invite' }
    }
  }, [])

  // Decline an invite
  const declineInvite = useCallback(async (groupId) => {
    try {
      const response = await fetch(`${API_URL}/groups/decline-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ groupId })
      })
      const data = await response.json()
      
      if (data.success) {
        setPendingInvites(prev => prev.filter(i => i.groupId !== groupId))
      }
      
      return data
    } catch (err) {
      console.error('Failed to decline invite:', err)
      return { success: false, message: 'Failed to decline invite' }
    }
  }, [])

  // Kick a player
  const kickPlayer = useCallback(async (targetUserId) => {
    try {
      const response = await fetch(`${API_URL}/groups/kick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: targetUserId })
      })
      const data = await response.json()
      
      if (data.success) {
        setGroup(data.group)
      }
      
      return data
    } catch (err) {
      console.error('Failed to kick player:', err)
      return { success: false, message: 'Failed to kick player' }
    }
  }, [])

  // Leave group
  const leaveGroup = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/groups/leave`, {
        method: 'POST',
        credentials: 'include'
      })
      const data = await response.json()
      
      if (data.success) {
        setGroup(data.group)
      }
      
      return data
    } catch (err) {
      console.error('Failed to leave group:', err)
      return { success: false, message: 'Failed to leave group' }
    }
  }, [])

  // Toggle ready status
  const toggleReady = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/groups/toggle-ready`, {
        method: 'POST',
        credentials: 'include'
      })
      const data = await response.json()
      
      if (data.success) {
        setGroup(data.group)
      }
      
      return data
    } catch (err) {
      console.error('Failed to toggle ready:', err)
      return { success: false, message: 'Failed to toggle ready' }
    }
  }, [])

  // Transfer leadership
  const transferLeader = useCallback(async (newLeaderId) => {
    try {
      const response = await fetch(`${API_URL}/groups/transfer-leader`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: newLeaderId })
      })
      const data = await response.json()
      
      if (data.success) {
        setGroup(data.group)
      }
      
      return data
    } catch (err) {
      console.error('Failed to transfer leader:', err)
      return { success: false, message: 'Failed to transfer leader' }
    }
  }, [])

  // Search players
  const searchPlayers = useCallback(async (query) => {
    try {
      const response = await fetch(`${API_URL}/groups/search-players?query=${encodeURIComponent(query)}`, {
        credentials: 'include'
      })
      const data = await response.json()
      
      return data
    } catch (err) {
      console.error('Failed to search players:', err)
      return { success: false, message: 'Failed to search players', players: [] }
    }
  }, [])

  // Cancel invite
  const cancelInvite = useCallback(async (targetUserId) => {
    try {
      const response = await fetch(`${API_URL}/groups/cancel-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: targetUserId })
      })
      const data = await response.json()
      
      if (data.success) {
        setGroup(data.group)
      }
      
      return data
    } catch (err) {
      console.error('Failed to cancel invite:', err)
      return { success: false, message: 'Failed to cancel invite' }
    }
  }, [])

  // Check if current user is leader
  const isLeader = group?.leader?._id === userId || group?.leader === userId

  // Get member count
  const memberCount = group?.members?.length || 0

  // Check if group is full
  const isFull = memberCount >= (group?.maxSize || 5)

  return (
    <GroupContext.Provider value={{
      group,
      pendingInvites,
      loading,
      error,
      isLeader,
      memberCount,
      isFull,
      maxSize: group?.maxSize || 5,
      invitePlayer,
      acceptInvite,
      declineInvite,
      kickPlayer,
      leaveGroup,
      toggleReady,
      transferLeader,
      searchPlayers,
      cancelInvite,
      refreshGroup: fetchGroup,
      silentRefresh
    }}>
      {children}
    </GroupContext.Provider>
  )
}

export const useGroup = () => {
  const context = useContext(GroupContext)
  if (!context) {
    throw new Error('useGroup must be used within a GroupProvider')
  }
  return context
}
