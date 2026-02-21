import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '../contexts/LanguageContext'
import { API_URL, UPLOADS_BASE_URL } from '../config'
import { getXPProgress, MAX_LEVEL, getTierColor } from '../utils/xpSystem'

const PlayerProfileDialog = ({ isOpen, onClose, playerId, playerData }) => {
  const { t } = useLanguage()
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(false)

  // Fetch player data if not provided
  useEffect(() => {
    if (!isOpen) return
    
    // If playerData is provided, use it directly
    if (playerData) {
      setPlayer(playerData)
      return
    }

    // Otherwise fetch from server
    if (playerId) {
      const fetchPlayer = async () => {
        setLoading(true)
        try {
          const response = await fetch(`${API_URL}/users/by-id/${playerId}`)
          const data = await response.json()
          if (data.success) {
            setPlayer(data.user)
          }
        } catch (err) {
          console.error('Error fetching player:', err)
        } finally {
          setLoading(false)
        }
      }
      fetchPlayer()
    }
  }, [isOpen, playerId, playerData])

  // Get avatar URL
  const getAvatarUrl = () => {
    if (player?.avatar) {
      if (player.avatar.startsWith('http')) return player.avatar
      return `${UPLOADS_BASE_URL}${player.avatar}`
    }
    if (player?.discordAvatar && player?.discordId) {
      return `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png?size=256`
    }
    return null
  }

  // Calculate level from XP
  const totalXP = (player?.statsHardcore?.xp || 0) + (player?.statsCdl?.xp || 0) + (player?.stats?.xp || 0)
  const { level, currentXP: currentLevelXP, xpForNextLevel, progress: xpProgress } = getXPProgress(totalXP)

  // Calculate stats
  const wins = (player?.statsHardcore?.wins || 0) + (player?.statsCdl?.wins || 0) + (player?.stats?.wins || 0)
  const losses = (player?.statsHardcore?.losses || 0) + (player?.statsCdl?.losses || 0) + (player?.stats?.losses || 0)
  const total = wins + losses
  const winrate = total > 0 ? Math.round((wins / total) * 100) : 0

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-dark-900/95 border border-white/10 rounded-xl w-full max-w-sm pointer-events-auto shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="text-sm font-mono text-white uppercase tracking-wider">Player Profile</h2>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-4">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : player ? (
                  <div className="space-y-4">
                    {/* Avatar & Username */}
                    <div className="flex flex-col items-center text-center">
                      {/* Avatar with level ring */}
                      <div className="relative mb-3">
                        {/* Circular progress ring */}
                        <svg className="w-24 h-24 -rotate-90">
                          <circle
                            cx="48"
                            cy="48"
                            r="44"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                            className="text-dark-700"
                          />
                          <motion.circle
                            cx="48"
                            cy="48"
                            r="44"
                            stroke="url(#gradient)"
                            strokeWidth="4"
                            fill="none"
                            strokeLinecap="round"
                            initial={{ strokeDasharray: "0 276.46" }}
                            animate={{ strokeDasharray: `${(xpProgress / 100) * 276.46} 276.46` }}
                            transition={{ delay: 0.2, duration: 1 }}
                          />
                          <defs>
                            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#f97316" />
                              <stop offset="100%" stopColor="#ea580c" />
                            </linearGradient>
                          </defs>
                        </svg>
                        {/* Avatar inside ring */}
                        <div className="absolute inset-2 rounded-full overflow-hidden bg-dark-800 border-2 border-dark-700">
                          {getAvatarUrl() ? (
                            <img 
                              src={getAvatarUrl()} 
                              alt={player.username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="w-full h-full flex items-center justify-center text-accent-primary text-2xl font-bold">
                              {player.username?.charAt(0)?.toUpperCase()}
                            </span>
                          )}
                        </div>
                        {/* Level badge */}
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 bg-dark-900 border border-accent-primary/50 rounded-full shadow-lg shadow-accent-primary/20">
                          <span className="text-accent-primary text-xs font-bold">{level}</span>
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-white">{player.username}</h3>
                      {player.activisionId && (
                        <p className="text-accent-primary text-xs">{player.activisionId}</p>
                      )}
                      {player.platform && (
                        <p className="text-gray-500 text-xs">{player.platform}</p>
                      )}
                      
                      {/* XP Info - compact */}
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-500">
                        <span className="text-accent-primary font-mono">{currentLevelXP}/{xpForNextLevel} XP</span>
                        <span>•</span>
                        <span>{totalXP.toLocaleString()} XP {t('total')}</span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-dark-800/50 rounded-lg p-3 text-center border border-white/5">
                        <p className="text-lg font-bold text-green-400">{wins}</p>
                        <p className="text-[10px] text-gray-500">{t('wins')}</p>
                      </div>
                      <div className="bg-dark-800/50 rounded-lg p-3 text-center border border-white/5">
                        <p className="text-lg font-bold text-red-400">{losses}</p>
                        <p className="text-[10px] text-gray-500">{t('losses')}</p>
                      </div>
                      <div className="bg-dark-800/50 rounded-lg p-3 text-center border border-white/5">
                        <p className="text-lg font-bold text-accent-primary">{winrate}%</p>
                        <p className="text-[10px] text-gray-500">{t('winrate')}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Player not found
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default PlayerProfileDialog
