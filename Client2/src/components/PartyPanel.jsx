import { useState, useEffect, memo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useSound } from '../contexts/SoundContext'
import { useGroup } from '../contexts/GroupContext'
import { UPLOADS_BASE_URL } from '../config'
import { getLevelFromXP } from '../utils/xpSystem'
import InvitePlayerDialog from './InvitePlayerDialog'
import PlayerProfileDialog from './PlayerProfileDialog'

const PartyPanel = memo(({ maxPlayers = 5 }) => {
  const { user, isAuthenticated } = useAuth()
  const { t } = useLanguage()
  const { playClick } = useSound()
  const { 
    group, 
    pendingInvites, 
    loading, 
    isLeader, 
    memberCount,
    isFull,
    kickPlayer, 
    leaveGroup,
    transferLeader,
    acceptInvite,
    declineInvite,
    silentRefresh
  } = useGroup()
  
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showMemberMenu, setShowMemberMenu] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState(null)

  const userId = user?._id || user?.id

  // Silent refresh for Iris status updates (invisible to users)
  useEffect(() => {
    if (!isAuthenticated || !group) return
    
    const interval = setInterval(() => {
      silentRefresh()
    }, 5000)
    
    return () => clearInterval(interval)
  }, [isAuthenticated, group, silentRefresh])

  // Get avatar URL
  const getAvatarUrl = (member) => {
    const userData = member?.user || member
    if (userData?.avatar) {
      if (userData.avatar.startsWith('http')) return userData.avatar
      return `${UPLOADS_BASE_URL}${userData.avatar}`
    }
    if (userData?.discordAvatar && userData?.discordId) {
      return `https://cdn.discordapp.com/avatars/${userData.discordId}/${userData.discordAvatar}.png?size=64`
    }
    return null
  }

  // Get member platform
  const getMemberPlatform = (member) => {
    return member?.user?.platform || member?.platform || null
  }

  // Check if member has Iris connected (seen in last 2 minutes)
  const isMemberIrisConnected = (member) => {
    const irisLastSeen = member?.user?.irisLastSeen || member?.irisLastSeen
    if (!irisLastSeen) return false
    const lastSeenTime = new Date(irisLastSeen).getTime()
    const now = Date.now()
    return (now - lastSeenTime) < 2 * 60 * 1000 // 2 minutes
  }

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
  const IrisIcon = ({ connected, className = "w-3 h-3" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
    </svg>
  )

  const handleInvite = () => {
    playClick()
    setShowInviteDialog(true)
  }

  const handleKick = async (memberId) => {
    if (actionLoading) return
    playClick()
    setActionLoading(true)
    await kickPlayer(memberId)
    setShowMemberMenu(null)
    setActionLoading(false)
  }

  const handleLeave = async () => {
    if (actionLoading) return
    playClick()
    setActionLoading(true)
    await leaveGroup()
    setActionLoading(false)
  }

  const handleTransferLeader = async (memberId) => {
    if (actionLoading) return
    playClick()
    setActionLoading(true)
    await transferLeader(memberId)
    setShowMemberMenu(null)
    setActionLoading(false)
  }

  const handleAcceptInvite = async (groupId) => {
    if (actionLoading) return
    playClick()
    setActionLoading(true)
    await acceptInvite(groupId)
    setActionLoading(false)
  }

  const handleDeclineInvite = async (groupId) => {
    if (actionLoading) return
    playClick()
    setActionLoading(true)
    await declineInvite(groupId)
    setActionLoading(false)
  }

  const partyMembers = group?.members || []
  const emptySlots = maxPlayers - partyMembers.length

  const getMemberUserId = (member) => {
    return member?.user?._id || member?.user || member?._id
  }

  const getMemberUsername = (member) => {
    return member?.user?.username || member?.username || 'Unknown'
  }

  const getMemberLevel = (member) => {
    const userData = member?.user || member
    // Calculate level from XP using unified XP system
    const totalXP = (userData?.statsHardcore?.xp || 0) + (userData?.statsCdl?.xp || 0) + (userData?.stats?.xp || 0)
    return getLevelFromXP(totalXP)
  }

  const isCurrentUser = (member) => {
    const memberId = getMemberUserId(member)
    return memberId?.toString() === userId?.toString()
  }

  const isMemberLeader = (member) => {
    const memberId = getMemberUserId(member)
    const leaderId = group?.leader?._id || group?.leader
    return memberId?.toString() === leaderId?.toString()
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 bg-accent-primary" />
          <span className="text-[10px] font-military text-gray-500 uppercase tracking-wider">{t('squad')}</span>
        </div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-military font-bold text-white uppercase tracking-wide">
            {t('party')}
          </h3>
          <span className="text-[10px] font-military text-gray-500">
            {memberCount}/{maxPlayers}
          </span>
        </div>
      </div>

      {/* Pending Invites */}
      <AnimatePresence>
        {pendingInvites.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 space-y-2"
          >
            <div className="text-[9px] font-military text-accent-primary uppercase tracking-wider mb-1">
              {t('pendingInvites')}
            </div>
            {pendingInvites.map((invite) => (
              <motion.div
                key={invite.groupId}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-2 p-2 bg-accent-primary/10 border border-accent-primary/30"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-military text-white truncate block">
                    {invite.invitedBy}{t('groupOf')}
                  </span>
                  <span className="text-[9px] font-military text-gray-500">
                    {invite.members?.length || 1} {t('members')}
                  </span>
                </div>
                <button
                  onClick={() => handleAcceptInvite(invite.groupId)}
                  disabled={actionLoading}
                  className="px-2 py-1 text-[9px] font-military text-green-400 hover:text-green-300 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                >
                  {t('accept')}
                </button>
                <button
                  onClick={() => handleDeclineInvite(invite.groupId)}
                  disabled={actionLoading}
                  className="px-2 py-1 text-[9px] font-military text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  {t('decline')}
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Party Members List */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {/* Current members */}
        {partyMembers.map((member, index) => {
          const memberId = getMemberUserId(member)
          const memberIsLeader = isMemberLeader(member)
          const memberIsCurrentUser = isCurrentUser(member)
          const platform = getMemberPlatform(member)
          const irisConnected = isMemberIrisConnected(member)
          
          return (
            <motion.div
              key={memberId || index}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative group"
            >
              <div 
                className="flex items-center gap-3 p-2 bg-white/5 border border-white/10 hover:border-accent-primary/30 transition-colors cursor-pointer"
                onClick={() => {
                  // Open profile dialog
                  const userData = member?.user || member
                  setSelectedProfile({
                    id: userData?._id || userData?.id,
                    username: getMemberUsername(member),
                    avatar: userData?.avatar,
                    discordId: userData?.discordId,
                    discordAvatar: userData?.discordAvatar,
                    platform: getMemberPlatform(member),
                    statsHardcore: userData?.statsHardcore,
                    statsCdl: userData?.statsCdl,
                    stats: userData?.stats,
                    activisionId: userData?.activisionId
                  })
                }}
              >
                {/* Leader indicator */}
                {memberIsLeader && (
                  <div className="absolute -left-px top-0 bottom-0 w-[2px] bg-accent-primary" />
                )}
                
                {/* Avatar */}
                <div className="relative">
                  <div className="w-10 h-10 bg-accent-primary/20 border border-accent-primary/30 overflow-hidden">
                    {getAvatarUrl(member) ? (
                      <img src={getAvatarUrl(member)} alt={getMemberUsername(member)} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-accent-primary font-military text-sm">
                        {getMemberUsername(member)?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                  {/* Online indicator */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-[#0a0a0c] bg-green-500" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-military text-white truncate">
                      {getMemberUsername(member)}
                    </span>
                    {memberIsLeader && (
                      <span className="text-[8px] font-military text-accent-primary uppercase">{t('leader')}</span>
                    )}
                    {memberIsCurrentUser && (
                      <span className="text-[8px] font-military text-gray-500 uppercase">({t('you')})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-military text-gray-500">
                      {t('lvl')} {getMemberLevel(member)}
                    </span>
                    {/* Platform icon */}
                    {platform && (
                      <div className={`flex items-center gap-1 ${
                        platform === 'PC' ? 'text-blue-400' : 
                        platform === 'PlayStation' ? 'text-blue-500' : 
                        platform === 'Xbox' ? 'text-green-500' : 'text-gray-500'
                      }`} title={platform}>
                        <PlatformIcon platform={platform} className="w-3 h-3" />
                      </div>
                    )}
                    {/* Iris status - Only for PC players */}
                    {platform === 'PC' && (
                      <div className={`flex items-center gap-1 ${irisConnected ? 'text-green-400' : 'text-red-400'}`} title={irisConnected ? t('irisConnected') : t('irisDisconnected')}>
                        <IrisIcon className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Menu icon for leader */}
                {!memberIsCurrentUser && isLeader && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowMemberMenu(showMemberMenu === memberId ? null : memberId)
                    }}
                    className="text-gray-500 hover:text-white transition-colors p-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Member context menu */}
              <AnimatePresence>
                {showMemberMenu === memberId && isLeader && !memberIsCurrentUser && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute top-full left-0 right-0 mt-1 z-10 bg-[#0a0a0c] border border-white/10 divide-y divide-white/5"
                  >
                    <button
                      onClick={() => handleTransferLeader(memberId)}
                      disabled={actionLoading}
                      className="w-full px-3 py-2 text-left text-[10px] font-military text-gray-400 hover:text-accent-primary hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      {t('makeLeader')}
                    </button>
                    <button
                      onClick={() => handleKick(memberId)}
                      disabled={actionLoading}
                      className="w-full px-3 py-2 text-left text-[10px] font-military text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      {t('kickFromParty')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}

        {/* Empty slots */}
        {[...Array(Math.max(0, emptySlots))].map((_, index) => (
          <motion.button
            key={`empty-${index}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: (partyMembers.length + index) * 0.05 }}
            onClick={isLeader ? handleInvite : undefined}
            disabled={!isAuthenticated || isFull || !isLeader}
            className={`w-full flex items-center gap-3 p-2 border border-dashed border-white/10 transition-all group ${
              isLeader ? 'hover:border-accent-primary/30 hover:bg-white/5 cursor-pointer' : 'cursor-default'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {/* Empty avatar slot */}
            <div className={`w-10 h-10 border border-dashed border-white/20 flex items-center justify-center transition-colors ${
              isLeader ? 'group-hover:border-accent-primary/30' : ''
            }`}>
              <svg className={`w-5 h-5 text-gray-600 transition-colors ${isLeader ? 'group-hover:text-accent-primary' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>

            {/* Invite text */}
            <div className="flex-1 text-left">
              <span className={`text-[10px] font-military text-gray-500 uppercase tracking-wider transition-colors ${
                isLeader ? 'group-hover:text-accent-primary' : ''
              }`}>
                {isLeader ? `[ ${t('invitePlayer')} ]` : `[ ${t('emptySlot')} ]`}
              </span>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Bottom actions */}
      <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
        {/* Invite button - Only for leader */}
        {isLeader && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleInvite}
            disabled={!isAuthenticated || isFull}
            className="w-full py-2 bg-white/5 hover:bg-accent-primary/20 border border-white/10 hover:border-accent-primary/30 text-[10px] font-military text-gray-400 hover:text-accent-primary uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            [ {t('inviteFriends')} ]
          </motion.button>
        )}

        {/* Leave button (only if in a group with others, and NOT leader) */}
        {isAuthenticated && memberCount > 1 && !isLeader && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLeave}
            disabled={actionLoading}
            className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-[10px] font-military text-red-400 hover:text-red-300 uppercase tracking-wider transition-all disabled:opacity-50"
          >
            [ {t('leaveParty')} ]
          </motion.button>
        )}

        {/* Leader hint - must transfer leadership to leave */}
        {isAuthenticated && memberCount > 1 && isLeader && (
          <div className="text-[9px] font-military text-gray-600 text-center py-1">
            {t('transferToLeave')}
          </div>
        )}

        {/* Privacy setting */}
        <div className="flex items-center justify-between text-[9px] font-military text-gray-600">
          <span>{t('partyPrivacy')}</span>
          <span className="text-accent-primary capitalize">{group?.privacy || t('inviteOnly')}</span>
        </div>
      </div>

      {/* Invite Dialog */}
      <InvitePlayerDialog 
        isOpen={showInviteDialog} 
        onClose={() => setShowInviteDialog(false)} 
      />

      {/* Player Profile Dialog */}
      <PlayerProfileDialog
        isOpen={selectedProfile !== null}
        onClose={() => setSelectedProfile(null)}
        playerId={selectedProfile?.id}
        playerData={selectedProfile}
      />
    </div>
  )
})

PartyPanel.displayName = 'PartyPanel'

export default PartyPanel
