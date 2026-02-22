import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import RulesDialog from '../components/RulesDialog'
import MatchSearchDialog, { getActiveMatch, clearActiveMatch } from '../components/MatchSearchDialog'
import IrisRequiredDialog from '../components/IrisRequiredDialog'
import PartyPanel from '../components/PartyPanel'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { useGroup } from '../contexts/GroupContext'
import { useSocket } from '../contexts/SocketContext'
import { useSound } from '../contexts/SoundContext'
import { API_URL } from '../config'

// Generate unique visitor ID
const getVisitorId = () => {
  let id = localStorage.getItem('nomercy-visitor-id')
  if (!id) {
    id = Math.random().toString(36).substring(2) + Date.now().toString(36)
    localStorage.setItem('nomercy-visitor-id', id)
  }
  return id
}

// Memoized animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, x: -15 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }
  }
}

const Lobby = memo(() => {
  const [selectedMode, setSelectedMode] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('hardcore') // 'hardcore' or 'simple'
  const [rulesMode, setRulesMode] = useState(null)
  const [showMatchSearch, setShowMatchSearch] = useState(false)
  const [showIrisRequired, setShowIrisRequired] = useState(false)
  const [serverGameModes, setServerGameModes] = useState(null)
  const [siteStats, setSiteStats] = useState({ onlineUsers: 0, totalUsers: 0, totalMatches: 0 })
  const [searchingCounts, setSearchingCounts] = useState({ ranked: 0, casual: 0, tournament: 0, custom: 0 })
  const [playerCountError, setPlayerCountError] = useState(null)
  const [activeMatch, setActiveMatch] = useState(null) // Stored active match
  const { t, language } = useLanguage()
  const { user, isAuthenticated } = useAuth()
  const { group, isLeader, memberCount } = useGroup()
  const { on } = useSocket()
  const { playHover, playClick, playSelect } = useSound()
  
  // State to track if search was initiated by group leader (for non-leaders)
  const [leaderSearchData, setLeaderSearchData] = useState(null)

  // Check for active match on mount
  useEffect(() => {
    const saved = getActiveMatch()
    if (saved) {
      setActiveMatch(saved)
    }
  }, [])

  // Listen for group leader starting a search (for non-leader members)
  useEffect(() => {
    if (!on || isLeader) return // Only non-leaders need this
    
    const cleanup = on('casualQueueJoined', (data) => {
      console.log('[Lobby] Leader started search, showing dialog:', data)
      // Set the search data to show the dialog
      setLeaderSearchData(data)
      setShowMatchSearch(true)
    })
    
    return cleanup
  }, [on, isLeader])

  // Check if user can start a match (must be leader if in a group)
  const canStartMatch = !group || isLeader

  // Get selected mode config
  const getSelectedModeConfig = () => {
    if (!selectedMode || !serverGameModes) return null
    return serverGameModes.find(m => m.id === selectedMode)
  }

  // Check if player count meets mode requirements
  const checkPlayerCount = () => {
    const modeConfig = getSelectedModeConfig()
    if (!modeConfig) return { valid: true }
    
    const currentCount = memberCount || 1
    const min = modeConfig.minPlayers || 1
    const max = modeConfig.maxPlayers || 5
    
    if (currentCount < min) {
      return { valid: false, message: t('notEnoughPlayers').replace('{min}', min) }
    }
    if (currentCount > max) {
      return { valid: false, message: t('tooManyPlayers').replace('{max}', max) }
    }
    return { valid: true }
  }

  // Load game modes config from server
  useEffect(() => {
    const fetchGameModes = async () => {
      try {
        const response = await fetch(`${API_URL}/app-settings/public`)
        const data = await response.json()
        if (data.success && data.lobbyGameModes) {
          setServerGameModes(data.lobbyGameModes)
        }
      } catch (e) {
        console.error('Error loading game modes:', e)
      }
    }
    fetchGameModes()
  }, [])

  // Fetch site stats and send heartbeat
  useEffect(() => {
    const visitorId = getVisitorId()

    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_URL}/system/stats`)
        const data = await response.json()
        if (data.success) {
          setSiteStats(data.stats)
        }
      } catch (err) {
        console.error('Error fetching stats:', err)
      }
    }

    const sendHeartbeat = async () => {
      try {
        const response = await fetch(`${API_URL}/system/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            visitorId,
            searching: showMatchSearch,
            mode: showMatchSearch ? selectedMode : null
          })
        })
        const data = await response.json()
        if (data.success) {
          setSiteStats(prev => ({ ...prev, onlineUsers: data.online }))
          if (data.searching) {
            setSearchingCounts(data.searching)
          }
        }
      } catch (err) {
        console.error('Error sending heartbeat:', err)
      }
    }

    // Initial fetch
    fetchStats()
    sendHeartbeat()

    // Set up intervals
    const statsInterval = setInterval(fetchStats, 30000) // Every 30s
    const heartbeatInterval = setInterval(sendHeartbeat, 15000) // Every 15s

    return () => {
      clearInterval(statsInterval)
      clearInterval(heartbeatInterval)
    }
  }, [showMatchSearch, selectedMode])

  // Get mode name in current language
  const getModeName = (mode) => {
    if (mode.name) {
      return mode.name[language] || mode.name.en || mode.name.fr || mode.id
    }
    return mode.id
  }

  // Get translated description for mode (optional)
  const getModeDesc = (modeId) => {
    const descriptions = {
      ranked: t('rankedDesc'),
      casual: t('casualDesc'),
      tournament: t('tournamentDesc'),
      custom: t('customDesc')
    }
    return descriptions[modeId] || ''
  }

  // Use server config - sort: Hardcore first, then Simple
  const gameModes = (serverGameModes || [])
    .filter(mode => mode.enabled !== false)
    .map(mode => ({
      id: mode.id,
      mode: getModeName(mode),
      icon: mode.icon || '●',
      type: mode.type || 'simple',
      description: getModeDesc(mode.id)
    }))
    .sort((a, b) => {
      // Hardcore (type === 'hardcore') comes first
      if (a.type === 'hardcore' && b.type !== 'hardcore') return -1
      if (a.type !== 'hardcore' && b.type === 'hardcore') return 1
      return 0
    })

  // Check Iris connection for PC players
  const checkIrisConnection = useCallback(async () => {
    if (!user || user.platform !== 'PC') {
      return true // Not PC, no Iris required
    }

    try {
      const response = await fetch(`${API_URL}/users/anticheat-status/${user._id || user.id}`, {
        credentials: 'include'
      })
      const data = await response.json()
      // Connected if online, not PC, or API key missing (development)
      return data.isOnline || data.reason === 'not_pc' || data.reason === 'api_key_missing'
    } catch {
      return true // On error, allow through
    }
  }, [user])

  const handlePlay = async () => {
    if (selectedMode && isAuthenticated && canStartMatch) {
      // Check player count requirements
      const playerCheck = checkPlayerCount()
      if (!playerCheck.valid) {
        setPlayerCountError(playerCheck.message)
        setTimeout(() => setPlayerCountError(null), 3000)
        return
      }
      
      // Check Iris for PC players
      const irisConnected = await checkIrisConnection()
      if (!irisConnected) {
        setShowIrisRequired(true)
        return
      }
      setShowMatchSearch(true)
    }
  }

  const handleRulesClick = (modeId) => {
    setRulesMode(modeId)
  }

  return (
    <div className="min-h-screen pt-20 md:pt-24 pb-32 md:pb-24 px-4 md:px-8 lg:px-16">
      {/* Main Layout - CoD Style */}
      <div className="flex justify-between gap-6 lg:gap-8">
        
        {/* Left Column - Vertical Menu (CoD Style) */}
        <div className="flex flex-col w-full lg:w-[420px] lg:flex-shrink-0">
          {/* Header - Military Style */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-[2px] bg-accent-primary" />
              <span className="text-[10px] font-military font-semibold text-accent-primary/80 uppercase tracking-[0.2em]">Game Modes</span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl lg:text-5xl text-white cod-accent-line pb-2">
              {t('chooseYourBattle')}
            </h1>
          </motion.div>

          {/* Active Match Banner */}
          <AnimatePresence>
            {activeMatch && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="mb-4"
              >
                <div className="cod-player-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="text-2xl"
                      >
                        ⚔️
                      </motion.div>
                      <div>
                        <h3 className="font-military font-bold text-accent-primary uppercase tracking-wider">
                          {t('matchInProgress')}
                        </h3>
                        <p className="text-[10px] font-military text-gray-400">
                          {activeMatch.modeIcon} {activeMatch.mode} • {activeMatch.type === 'hardcore' ? 'Hardcore' : 'Simple'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => { playClick(); setShowMatchSearch(true); }}
                      onMouseEnter={playHover}
                      className="cod-button px-4 py-2 text-white font-military text-sm uppercase tracking-wider"
                    >
                      {t('rejoin')}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Category Tabs - CoD Style */}
          <div className="flex gap-1 mb-4">
            <button
              onClick={() => { playClick(); setSelectedCategory('hardcore'); setSelectedMode(null); }}
              onMouseEnter={playHover}
              className={`flex items-center gap-2 px-5 py-2.5 font-military font-semibold text-sm uppercase tracking-wider transition-all cod-corner-cut ${
                selectedCategory === 'hardcore'
                  ? 'bg-red-500/20 text-red-400 border-l-2 border-red-500'
                  : 'bg-dark-800/50 text-gray-500 hover:text-gray-300 hover:bg-dark-700/50'
              }`}
            >
              <span>☠</span>
              <span>Hardcore</span>
            </button>
            
            <button
              onClick={() => { playClick(); setSelectedCategory('simple'); setSelectedMode(null); }}
              onMouseEnter={playHover}
              className={`flex items-center gap-2 px-5 py-2.5 font-military font-semibold text-sm uppercase tracking-wider transition-all cod-corner-cut ${
                selectedCategory === 'simple'
                  ? 'bg-accent-primary/20 text-accent-primary border-l-2 border-accent-primary'
                  : 'bg-dark-800/50 text-gray-500 hover:text-gray-300 hover:bg-dark-700/50'
              }`}
            >
              <span>◆</span>
              <span>Simple</span>
            </button>
          </div>

          {/* Game Modes - Vertical List (CoD Style) */}
          <motion.div
            key={selectedCategory}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-1 mb-6"
          >
            {gameModes
              .filter(m => selectedCategory === 'hardcore' ? m.type === 'hardcore' : m.type !== 'hardcore')
              .map((mode) => {
                const isSelected = selectedMode === mode.id
                const isHardcore = mode.type === 'hardcore'
                return (
                  <motion.div 
                    key={mode.id} 
                    variants={itemVariants}
                    onClick={() => { playSelect(); setSelectedMode(mode.id); }}
                    onMouseEnter={playHover}
                    className={`
                      cod-menu-item relative cursor-pointer
                      ${isSelected ? 'active' : ''}
                      ${isHardcore ? 'hover:border-l-red-500' : ''}
                      ${isSelected && isHardcore ? '!border-l-red-500 !text-red-400' : ''}
                    `}
                  >
                    <span className="text-xl w-8 text-center">{mode.icon}</span>
                    <div className="flex-1">
                      <span className="block">{mode.mode}</span>
                      {searchingCounts[mode.id] > 0 && (
                        <span className={`text-[10px] font-military ${isHardcore ? 'text-red-400' : 'text-green-400'}`}>
                          {searchingCounts[mode.id]} {t('searching')}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); playClick(); setRulesMode(mode.id); }}
                      onMouseEnter={(e) => { e.stopPropagation(); playHover(); }}
                      className="text-[10px] font-military text-gray-500 hover:text-accent-primary uppercase"
                    >
                      [{t('rules')}]
                    </button>
                    {isSelected && (
                      <motion.div
                        layoutId="selectedMode"
                        className={`absolute right-2 w-2 h-2 ${isHardcore ? 'bg-red-500' : 'bg-accent-primary'}`}
                      />
                    )}
                  </motion.div>
                )
              })}
          </motion.div>

          {/* Play Button Section - CoD Style */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-6 space-y-3"
          >
            <button
              disabled={!selectedMode || !isAuthenticated || !canStartMatch}
              onClick={() => { playClick(); handlePlay(); }}
              onMouseEnter={playHover}
              className={`
                w-full py-4 font-display text-2xl uppercase tracking-wider transition-all
                ${selectedMode && isAuthenticated && canStartMatch
                  ? 'cod-button text-white shadow-lg shadow-accent-primary/30'
                  : 'bg-dark-600 text-gray-500 cursor-not-allowed cod-corner-cut'
                }
              `}
            >
              {!canStartMatch ? t('leaderOnly') : selectedMode ? t('playNow') : t('selectMode')}
            </button>

            {selectedMode && canStartMatch && (
              <p className="text-center text-gray-500 text-[10px] font-military uppercase tracking-wider">
                {t('pressToFind')} {gameModes.find(m => m.id === selectedMode)?.mode}
              </p>
            )}
            
            {!canStartMatch && (
              <p className="text-center text-red-500/70 text-[10px] font-military uppercase tracking-wider">
                {t('onlyLeaderCanStart')}
              </p>
            )}
            
            {/* Player count error */}
            <AnimatePresence>
              {playerCountError && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-red-500 text-[10px] font-military uppercase tracking-wider bg-red-500/10 px-3 py-2 cod-corner-cut text-center"
                >
                  {playerCountError}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Right Column - Party Panel (Desktop Only) */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="hidden lg:block w-80 xl:w-96 flex-shrink-0"
        >
          <div className="cod-player-card p-4">
            <PartyPanel maxPlayers={5} />
          </div>
        </motion.div>
      </div>

      {/* Stats Bar - Desktop only - Military HUD Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="hidden md:block fixed bottom-8 left-8 right-8 lg:left-16 lg:right-16"
      >
        <div className="cod-player-card px-6 py-3 flex items-center justify-between">
          {/* Left stats */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 animate-pulse" />
              <span className="cod-stat">Online</span>
              <span className="cod-stat-value">{siteStats.onlineUsers.toLocaleString()}</span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="cod-stat">Accounts</span>
              <span className="cod-stat-value">{siteStats.totalUsers.toLocaleString()}</span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="cod-stat">Matches</span>
              <span className="cod-stat-value">{siteStats.totalMatches.toLocaleString()}</span>
            </div>
          </div>

          {/* Center - Game title */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-[1px] bg-gradient-to-r from-transparent to-accent-primary/50" />
            <span className="font-military font-semibold text-sm text-gray-400 uppercase tracking-[0.2em]">Call of Duty: Black Ops 7</span>
            <div className="w-12 h-[1px] bg-gradient-to-l from-transparent to-accent-primary/50" />
          </div>

          {/* Right - Credits */}
          <div className="flex items-center gap-4 text-[10px] font-military text-gray-600">
            <span>DEV <span className="text-accent-light">Lixo</span></span>
            <span className="text-red-500">♥</span>
          </div>
        </div>
      </motion.div>

      {/* Rules Dialog */}
      <RulesDialog 
        isOpen={rulesMode !== null} 
        onClose={() => setRulesMode(null)} 
        modeId={rulesMode}
        adminConfig={serverGameModes}
      />

      {/* Match Search Dialog */}
      <MatchSearchDialog
        isOpen={showMatchSearch}
        onClose={() => {
          setShowMatchSearch(false)
          setLeaderSearchData(null)
        }}
        modeId={activeMatch ? activeMatch.matchData?.modeId : (leaderSearchData?.modeId || selectedMode)}
        mode={activeMatch ? activeMatch.mode : (leaderSearchData?.modeName || gameModes.find(m => m.id === selectedMode)?.mode)}
        modeIcon={activeMatch ? activeMatch.modeIcon : gameModes.find(m => m.id === (leaderSearchData?.modeId || selectedMode))?.icon}
        type={activeMatch ? activeMatch.type : (leaderSearchData?.type || gameModes.find(m => m.id === selectedMode)?.type || 'simple')}
        teamSize={leaderSearchData?.teamSize || serverGameModes?.find(m => m.id === selectedMode)?.maxPlayers || 1}
        initialMatchData={activeMatch}
        alreadyInQueue={!!leaderSearchData}
      />

      {/* Iris Required Dialog */}
      <IrisRequiredDialog
        isOpen={showIrisRequired}
        onClose={() => setShowIrisRequired(false)}
      />
    </div>
  )
})

Lobby.displayName = 'Lobby'

export default Lobby
