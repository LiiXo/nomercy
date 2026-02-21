import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useParams, Link } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { API_URL, UPLOADS_BASE_URL } from '../config'
import { getXPProgress, MAX_LEVEL, getTierColor } from '../utils/xpSystem'

const PlayerProfile = () => {
  const { username } = useParams()
  const { t } = useLanguage()
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchPlayer = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`${API_URL}/users/profile/${encodeURIComponent(username)}`)
        const data = await response.json()
        
        if (data.success) {
          setPlayer(data.user)
        } else {
          setError(data.message || 'Player not found')
        }
      } catch (err) {
        console.error('Error fetching player:', err)
        setError('Failed to load player profile')
      } finally {
        setLoading(false)
      }
    }

    if (username) {
      fetchPlayer()
    }
  }, [username])

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

  if (loading) {
    return (
      <div className="min-h-screen pt-24 md:pt-36 pb-24 md:pb-12 px-4 md:px-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (error || !player) {
    return (
      <div className="min-h-screen pt-24 md:pt-36 pb-24 md:pb-12 px-4 md:px-6 flex items-center justify-center">
        <div className="text-center glass rounded-2xl p-8 max-w-sm">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">😕</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{t('playerNotFound')}</h2>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <Link 
            to="/"
            className="inline-block px-6 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white font-semibold rounded-xl transition-colors"
          >
            {t('backToLobby')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 md:pt-36 pb-24 md:pb-12 px-4 md:px-6">
      <div className="max-w-2xl mx-auto">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass rounded-2xl p-6 md:p-8"
        >
          {/* Avatar & Basic Info */}
          <div className="flex flex-col items-center text-center mb-6">
            {/* Avatar */}
            <div className="relative mb-4">
              <div className="w-28 h-28 md:w-36 md:h-36 rounded-full border-4 border-accent-primary/30 overflow-hidden bg-dark-800 shadow-lg shadow-accent-primary/20">
                {getAvatarUrl() ? (
                  <img 
                    src={getAvatarUrl()} 
                    alt={player.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-accent-primary text-4xl font-bold">
                    {player.username?.charAt(0)?.toUpperCase()}
                  </span>
                )}
              </div>
              {/* Level badge */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-accent-primary to-fire-600 rounded-full">
                <span className="text-white text-sm font-bold">Nv. {level}</span>
              </div>
            </div>

            {/* Username & Info */}
            <h1 className="text-2xl md:text-3xl font-bold text-white mt-2">
              {player.username}
            </h1>
            {player.activisionId && (
              <p className="text-accent-primary text-sm md:text-base mt-1">
                {player.activisionId}
              </p>
            )}
            {player.platform && (
              <p className="text-gray-400 text-sm mt-1">
                {player.platform}
              </p>
            )}
          </div>

          {/* Level Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">{t('level')} {level}</span>
              <span className="text-accent-primary">{currentLevelXP} / {xpForNextLevel} XP</span>
            </div>
            <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress}%` }}
                transition={{ delay: 0.3, duration: 1 }}
                className="h-full bg-gradient-to-r from-accent-primary to-fire-600 rounded-full"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1 text-center">
              {totalXP.toLocaleString()} XP {t('total')}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="glass-dark rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-400">
                {(player.statsHardcore?.wins || 0) + (player.statsCdl?.wins || 0) + (player.stats?.wins || 0)}
              </p>
              <p className="text-xs text-gray-400">{t('wins')}</p>
            </div>
            <div className="glass-dark rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-400">
                {(player.statsHardcore?.losses || 0) + (player.statsCdl?.losses || 0) + (player.stats?.losses || 0)}
              </p>
              <p className="text-xs text-gray-400">{t('losses')}</p>
            </div>
            <div className="glass-dark rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-accent-primary">
                {(() => {
                  const wins = (player.statsHardcore?.wins || 0) + (player.statsCdl?.wins || 0) + (player.stats?.wins || 0)
                  const losses = (player.statsHardcore?.losses || 0) + (player.statsCdl?.losses || 0) + (player.stats?.losses || 0)
                  const total = wins + losses
                  return total > 0 ? Math.round((wins / total) * 100) : 0
                })()}%
              </p>
              <p className="text-xs text-gray-400">{t('winrate')}</p>
            </div>
          </div>

          {/* Back button */}
          <div className="mt-6 text-center">
            <Link 
              to="/"
              className="text-sm text-gray-400 hover:text-accent-primary transition-colors"
            >
              ← {t('backToLobby')}
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default PlayerProfile
