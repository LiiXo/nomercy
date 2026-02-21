import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '../contexts/LanguageContext'
import { useSound } from '../contexts/SoundContext'
import { useGroup } from '../contexts/GroupContext'
import { UPLOADS_BASE_URL } from '../config'

const InvitePlayerDialog = ({ isOpen, onClose }) => {
  const { t } = useLanguage()
  const { playClick } = useSound()
  const { invitePlayer, searchPlayers, group, isFull, cancelInvite } = useGroup()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [inviting, setInviting] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Platform icon component
  const PlatformIcon = ({ platform, className = "w-3 h-3" }) => {
    if (platform === 'PC') {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
        </svg>
      )
    }
    if (platform === 'PlayStation') {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M8.985 2.596v17.548l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.181.76.814.76 1.505v5.876c2.441 1.193 4.362-.002 4.362-3.153 0-3.237-1.126-4.675-4.438-5.827-1.307-.448-3.728-1.186-5.393-1.502zm5.932 13.893c-.652-.242-1.292-.497-1.851-.785-1.06-.544-2.128-.951-2.128-.951v4.206s1.683-.61 3.362-1.11c1.679-.5 3.379-.936 4.847-1.163 1.468-.228 2.765-.257 3.911-.164 1.146.094 2.142.32 3.022.738.88.418 1.624.972 2.196 1.644v-2.924s-.657-1.077-2.364-1.758c-1.707-.68-3.73-.898-5.628-.722-1.898.177-3.742.583-5.367.989zm-14.9.426s3.665-1.285 5.869-1.82c2.204-.534 4.266-.819 6.195-.851 1.928-.032 3.732.19 5.387.66 1.655.471 3.149 1.19 4.451 2.132v-2.784s-1.343-1.014-3.395-1.678c-2.052-.664-4.326-.919-6.797-.795-2.471.125-5.117.652-7.855 1.523-2.737.871-4.855 1.891-5.855 2.457v1.156z"/>
        </svg>
      )
    }
    if (platform === 'Xbox') {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.102 21.033C6.211 22.881 8.977 24 12 24c3.026 0 5.789-1.119 7.902-2.967 1.877-1.912-4.316-8.709-7.902-11.417-3.582 2.708-9.779 9.505-7.898 11.417zm11.16-14.406c2.5 2.961 7.484 10.313 6.076 12.912C23.056 17.036 24 14.615 24 12c0-3.34-1.365-6.362-3.566-8.537 1.107 1.068-1.466 3.905-5.172 3.164zm-6.525 0c-3.706.741-6.281-2.096-5.172-3.164C1.365 5.638 0 8.66 0 12c0 2.615.944 5.036 2.662 6.539-1.408-2.599 3.576-9.951 6.075-12.912zM12 0C9.47 0 7.127.842 5.25 2.27c4.358-1.2 6.75 2.047 6.75 2.047s2.392-3.246 6.75-2.047C16.873.842 14.53 0 12 0z"/>
        </svg>
      )
    }
    return null
  }

  // Iris icon component
  const IrisIcon = ({ className = "w-3 h-3" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
    </svg>
  )

  // Debounced search
  useEffect(() => {
    if (!isOpen) return
    
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setSearching(true)
        setError(null)
        const result = await searchPlayers(searchQuery)
        setSearchResults(result.players || [])
        setSearching(false)
      } else {
        setSearchResults([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, isOpen, searchPlayers])

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setSearchResults([])
      setError(null)
      setSuccess(null)
    }
  }, [isOpen])

  const getAvatarUrl = (player) => {
    if (player?.avatar) {
      if (player.avatar.startsWith('http')) return player.avatar
      return `${UPLOADS_BASE_URL}${player.avatar}`
    }
    if (player?.discordAvatar && player?.discordId) {
      return `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png?size=64`
    }
    return null
  }

  const handleInvite = async (player) => {
    if (inviting || isFull) return
    
    playClick()
    setInviting(player._id)
    setError(null)
    setSuccess(null)
    
    const result = await invitePlayer(player.username)
    
    if (result.success) {
      setSuccess(`Invite sent to ${player.username}`)
      // Update search results to show pending invite
      setSearchResults(prev => prev.map(p => 
        p._id === player._id ? { ...p, hasPendingInvite: true } : p
      ))
    } else {
      setError(result.message)
    }
    
    setInviting(null)
  }

  const handleCancelInvite = async (player) => {
    if (inviting) return
    
    playClick()
    setInviting(player._id)
    setError(null)
    setSuccess(null)
    
    const result = await cancelInvite(player._id)
    
    if (result.success) {
      setSuccess(`Invite cancelled`)
      setSearchResults(prev => prev.map(p => 
        p._id === player._id ? { ...p, hasPendingInvite: false } : p
      ))
    } else {
      setError(result.message)
    }
    
    setInviting(null)
  }

  const pendingInvites = group?.pendingInvites || []

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
        
        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md bg-[#0a0a0c] border border-white/10"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <div>
              <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wide">
                Invite Player
              </h2>
              <p className="text-[10px] font-mono text-gray-500 mt-1">
                Search for players to invite to your party
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search Input */}
          <div className="p-4 border-b border-white/5">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by username..."
                className="w-full bg-white/5 border border-white/10 px-4 py-2 pl-10 text-sm font-mono text-white placeholder-gray-500 focus:outline-none focus:border-accent-primary/30"
                autoFocus
              />
              <svg 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* Error/Success Messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 py-2 bg-red-500/10 border-b border-red-500/20"
              >
                <p className="text-[10px] font-mono text-red-400">{error}</p>
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 py-2 bg-green-500/10 border-b border-green-500/20"
              >
                <p className="text-[10px] font-mono text-green-400">{success}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pending Invites */}
          {pendingInvites.length > 0 && (
            <div className="p-4 border-b border-white/5">
              <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider mb-2">
                Pending Invites ({pendingInvites.length})
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {pendingInvites.map((invite) => {
                  const user = invite.user
                  return (
                    <div
                      key={user._id}
                      className="flex items-center gap-3 p-2 bg-accent-primary/5 border border-accent-primary/20"
                    >
                      <div className="w-8 h-8 bg-accent-primary/20 border border-accent-primary/30 overflow-hidden">
                        {getAvatarUrl(user) ? (
                          <img src={getAvatarUrl(user)} alt={user.username} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-accent-primary font-mono text-xs">
                            {user.username?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-mono text-white truncate block">{user.username}</span>
                        <span className="text-[9px] font-mono text-accent-primary">Pending...</span>
                      </div>
                      <button
                        onClick={() => handleCancelInvite(user)}
                        disabled={inviting === user._id}
                        className="text-[9px] font-mono text-red-400 hover:text-red-300 px-2 py-1 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Search Results */}
          <div className="p-4 max-h-64 overflow-y-auto">
            {searchQuery.length < 2 ? (
              <div className="text-center py-8">
                <svg className="w-8 h-8 mx-auto text-gray-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-[10px] font-mono text-gray-500">
                  Type at least 2 characters to search
                </p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-8 h-8 mx-auto text-gray-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[10px] font-mono text-gray-500">
                  No players found
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {searchResults.map((player) => (
                  <motion.div
                    key={player._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-2 bg-white/5 border border-white/10 hover:border-accent-primary/30 transition-colors"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 bg-accent-primary/20 border border-accent-primary/30 overflow-hidden">
                      {getAvatarUrl(player) ? (
                        <img src={getAvatarUrl(player)} alt={player.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-accent-primary font-mono text-sm">
                          {player.username?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-mono text-white truncate block">{player.username}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-gray-500">
                          LVL {player.level || 1}
                        </span>
                        {/* Platform icon */}
                        {player.platform && (
                          <div className={`flex items-center ${
                            player.platform === 'PC' ? 'text-blue-400' : 
                            player.platform === 'PlayStation' ? 'text-blue-500' : 
                            player.platform === 'Xbox' ? 'text-green-500' : 'text-gray-500'
                          }`} title={player.platform}>
                            <PlatformIcon platform={player.platform} className="w-3 h-3" />
                          </div>
                        )}
                        {/* Iris status - Only for PC players */}
                        {player.platform === 'PC' && (
                          <div className={`flex items-center ${player.irisConnected ? 'text-green-400' : 'text-red-400'}`} title={player.irisConnected ? 'Iris Connected' : 'Iris Disconnected'}>
                            <IrisIcon className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    {player.isInGroup ? (
                      <span className="text-[10px] font-mono text-gray-500 px-3">
                        In Party
                      </span>
                    ) : player.hasPendingInvite ? (
                      <button
                        onClick={() => handleCancelInvite(player)}
                        disabled={inviting === player._id}
                        className="text-[10px] font-mono text-yellow-400 px-3 py-1 border border-yellow-500/30 hover:bg-yellow-500/10 transition-colors disabled:opacity-50"
                      >
                        {inviting === player._id ? (
                          <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          'Pending'
                        )}
                      </button>
                    ) : isFull ? (
                      <span className="text-[10px] font-mono text-gray-500 px-3">
                        Party Full
                      </span>
                    ) : (
                      <button
                        onClick={() => handleInvite(player)}
                        disabled={inviting === player._id}
                        className="text-[10px] font-mono text-accent-primary px-3 py-1 border border-accent-primary/30 hover:bg-accent-primary/10 transition-colors disabled:opacity-50"
                      >
                        {inviting === player._id ? (
                          <div className="w-4 h-4 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
                        ) : (
                          'Invite'
                        )}
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/5">
            <button
              onClick={onClose}
              className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-mono text-gray-400 hover:text-white uppercase tracking-wider transition-all"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default InvitePlayerDialog
