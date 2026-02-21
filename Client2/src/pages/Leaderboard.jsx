import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { API_URL, UPLOADS_BASE_URL } from '../config'
import { getLevelFromXP, getTierColor } from '../utils/xpSystem'

const Leaderboard = () => {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [players, setPlayers] = useState([])
  const [myRank, setMyRank] = useState(null)
  const [loading, setLoading] = useState(true)
  const [nextUpdate, setNextUpdate] = useState(0)

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const url = user?.discordId 
          ? `${API_URL}/users/leaderboard?odId=${user.discordId}`
          : `${API_URL}/users/leaderboard`
        const response = await fetch(url)
        const data = await response.json()
        if (data.success) {
          setPlayers(data.players)
          setMyRank(data.myRank)
          setNextUpdate(data.nextUpdate || 600)
        }
      } catch (err) {
        console.error('Error fetching leaderboard:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
  }, [user?.discordId])

  // Get avatar URL
  const getAvatarUrl = (player) => {
    if (player.avatar) {
      if (player.avatar.startsWith('http')) return player.avatar
      return `${UPLOADS_BASE_URL}${player.avatar}`
    }
    if (player.discordAvatar && player.discordId) {
      return `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png?size=64`
    }
    return null
  }

  // Calculate total wins/losses
  const getTotalStats = (player) => {
    const wins = (player.stats?.wins || 0) + (player.statsHardcore?.wins || 0) + (player.statsCdl?.wins || 0)
    const losses = (player.stats?.losses || 0) + (player.statsHardcore?.losses || 0) + (player.statsCdl?.losses || 0)
    return { wins, losses }
  }

  // Get rank medal
  const getRankMedal = (rank) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-mono text-gray-500 uppercase">{t('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 md:px-8 lg:px-16 py-8 pt-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-wider text-white mb-2">
          {t('leaderboard')}
        </h1>
        <p className="text-sm font-mono text-gray-500 uppercase">
          Top 15 • {t('byXP')}
        </p>
        <p className="text-xs font-mono text-gray-600 mt-1">
          {t('updatesIn')} {Math.floor(nextUpdate / 60)}:{(nextUpdate % 60).toString().padStart(2, '0')}
        </p>
      </motion.div>

      {/* My Rank (if not in top 100) */}
      {myRank && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-4"
        >
          <div className="hud-panel overflow-hidden border-accent-primary/30">
            <div className="px-4 py-2 bg-accent-primary/10 border-b border-accent-primary/20">
              <span className="text-[10px] font-mono text-accent-primary uppercase">{t('yourRank')}</span>
            </div>
            <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center bg-accent-primary/5">
              {/* Rank */}
              <div className="col-span-1 text-center">
                <span className="text-sm font-mono font-bold text-accent-primary">
                  #{myRank.rank}
                </span>
              </div>

              {/* Player Info */}
              <div className="col-span-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-black/50 border border-accent-primary/30 flex-shrink-0">
                    {getAvatarUrl(myRank) ? (
                      <img 
                        src={getAvatarUrl(myRank)} 
                        alt={myRank.username} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-accent-primary text-sm font-medium">
                        {myRank.username?.charAt(0)?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {myRank.username}
                    </p>
                  </div>
                </div>
              </div>

              {/* Level */}
              <div className="col-span-2 text-center">
                <span className={`text-lg font-bold ${getTierColor(getLevelFromXP(myRank.totalXP))}`}>
                  {getLevelFromXP(myRank.totalXP)}
                </span>
              </div>

              {/* XP */}
              <div className="col-span-2 text-right">
                <span className="text-sm font-mono text-accent-primary">
                  {myRank.totalXP.toLocaleString()}
                </span>
              </div>

              {/* W/L */}
              <div className="col-span-2 text-right">
                <span className="text-xs font-mono">
                  <span className="text-green-400">{getTotalStats(myRank).wins}</span>
                  <span className="text-gray-600">/</span>
                  <span className="text-red-400">{getTotalStats(myRank).losses}</span>
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Leaderboard Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="hud-panel overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-black/30 border-b border-white/10 text-[10px] font-mono text-gray-500 uppercase">
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-5">{t('player')}</div>
            <div className="col-span-2 text-center">{t('level')}</div>
            <div className="col-span-2 text-right">XP</div>
            <div className="col-span-2 text-right">W/L</div>
          </div>

          {/* Player Rows */}
          <div className="divide-y divide-white/5">
            {players.map((player, index) => {
              const rank = index + 1
              const level = getLevelFromXP(player.totalXP)
              const tierColor = getTierColor(level)
              const { wins, losses } = getTotalStats(player)
              const medal = getRankMedal(rank)

              return (
                <motion.div
                  key={player._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className={`grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-white/5 transition-colors ${
                    rank <= 3 ? 'bg-accent-primary/5' : ''
                  }`}
                >
                  {/* Rank */}
                  <div className="col-span-1 text-center">
                    {medal ? (
                      <span className="text-lg">{medal}</span>
                    ) : (
                      <span className={`text-sm font-mono font-bold ${
                        rank <= 10 ? 'text-accent-primary' : 'text-gray-500'
                      }`}>
                        {rank}
                      </span>
                    )}
                  </div>

                  {/* Player Info */}
                  <div className="col-span-5">
                    <Link 
                      to={`/player/${player.username}`}
                      className="flex items-center gap-3 group"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-black/50 border border-white/10 flex-shrink-0">
                        {getAvatarUrl(player) ? (
                          <img 
                            src={getAvatarUrl(player)} 
                            alt={player.username} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="w-full h-full flex items-center justify-center text-accent-primary text-sm font-medium">
                            {player.username?.charAt(0)?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white group-hover:text-accent-primary transition-colors truncate">
                          {player.username}
                        </p>
                      </div>
                    </Link>
                  </div>

                  {/* Level */}
                  <div className="col-span-2 text-center">
                    <span className={`text-lg font-bold ${tierColor}`}>
                      {level}
                    </span>
                  </div>

                  {/* XP */}
                  <div className="col-span-2 text-right">
                    <span className="text-sm font-mono text-accent-primary">
                      {player.totalXP.toLocaleString()}
                    </span>
                  </div>

                  {/* W/L */}
                  <div className="col-span-2 text-right">
                    <span className="text-xs font-mono">
                      <span className="text-green-400">{wins}</span>
                      <span className="text-gray-600">/</span>
                      <span className="text-red-400">{losses}</span>
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {players.length === 0 && (
            <div className="px-4 py-12 text-center">
              <p className="text-gray-500 font-mono text-sm">{t('noPlayersYet')}</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default Leaderboard
