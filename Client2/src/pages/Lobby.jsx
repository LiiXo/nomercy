import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GameModeCard from '../components/GameModeCard'
import Button from '../components/Button'
import RulesDialog from '../components/RulesDialog'
import MatchSearchDialog, { getActiveMatch, clearActiveMatch } from '../components/MatchSearchDialog'
import IrisRequiredDialog from '../components/IrisRequiredDialog'
import PartyPanel from '../components/PartyPanel'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { useGroup } from '../contexts/GroupContext'
import { useSocket } from '../contexts/SocketContext'
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

const Lobby = () => {
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  // Check Iris connection for PC players
  const checkIrisConnection = async () => {
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
  }

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
    <div className="min-h-screen pt-16 md:pt-20 pb-24 md:pb-20 px-4 md:px-8 lg:px-16">
      {/* Main Layout - Two Columns on Desktop */}
      <div className="flex gap-6 lg:gap-8">
        {/* Left Column - Game Modes */}
        <div className="flex-1">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 bg-accent-primary" />
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Game Mode Selection</span>
            </div>
            <h1 className="text-xl md:text-2xl font-mono font-bold uppercase tracking-wide text-white">
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
                className="mb-6"
              >
                <div className="relative bg-accent-primary/10 border border-accent-primary/50 p-4">
                  {/* Corner accents */}
                  <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-accent-primary" />
                  <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-accent-primary" />
                  <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-accent-primary" />
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-accent-primary" />
                  
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
                        <h3 className="text-sm font-mono font-bold text-accent-primary uppercase">
                          {t('matchInProgress')}
                        </h3>
                        <p className="text-[10px] font-mono text-gray-400">
                          {activeMatch.modeIcon} {activeMatch.mode} • {activeMatch.type === 'hardcore' ? 'Hardcore' : 'Simple'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowMatchSearch(true)}
                      className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 text-black font-mono text-xs uppercase tracking-wider font-bold transition-all"
                    >
                      [ {t('rejoin')} ]
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Category Tabs */}
          <div className="flex gap-2 mb-4">
            {/* Hardcore Tab */}
            <button
              onClick={() => { setSelectedCategory('hardcore'); setSelectedMode(null); }}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-wider transition-all ${
                selectedCategory === 'hardcore'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                  : 'bg-dark-800/50 text-gray-500 border border-white/10 hover:text-gray-300 hover:border-white/20'
              }`}
            >
              <span>☠</span>
              <span>Hardcore</span>
              <span className="text-[10px] opacity-60">({gameModes.filter(m => m.type === 'hardcore').length})</span>
            </button>
            
            {/* Simple Tab */}
            <button
              onClick={() => { setSelectedCategory('simple'); setSelectedMode(null); }}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-wider transition-all ${
                selectedCategory === 'simple'
                  ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/50'
                  : 'bg-dark-800/50 text-gray-500 border border-white/10 hover:text-gray-300 hover:border-white/20'
              }`}
            >
              <span>◆</span>
              <span>Simple</span>
              <span className="text-[10px] opacity-60">({gameModes.filter(m => m.type !== 'hardcore').length})</span>
            </button>
          </div>

          {/* Game Modes Grid - Shows selected category only */}
          <motion.div
            key={selectedCategory}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 gap-2 mb-6"
          >
            {gameModes
              .filter(m => selectedCategory === 'hardcore' ? m.type === 'hardcore' : m.type !== 'hardcore')
              .map((mode) => (
                <motion.div key={mode.id} variants={itemVariants}>
                  <GameModeCard
                    mode={mode.mode}
                    icon={mode.icon}
                    type={mode.type}
                    description={mode.description}
                    searchingCount={searchingCounts[mode.id] || 0}
                    isSelected={selectedMode === mode.id}
                    onClick={() => setSelectedMode(mode.id)}
                    onRulesClick={() => handleRulesClick(mode.id)}
                  />
                </motion.div>
              ))}
          </motion.div>

          {/* Play Button Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="flex flex-col items-center md:items-start"
          >
            <Button
              variant="primary"
              size="lg"
              disabled={!selectedMode || !isAuthenticated || !canStartMatch}
              glow={!!selectedMode && isAuthenticated && canStartMatch}
              onClick={handlePlay}
              className="min-w-[200px]"
            >
              {!canStartMatch ? t('leaderOnly') : selectedMode ? t('playNow') : t('selectMode')}
            </Button>

            {selectedMode && canStartMatch && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-gray-500 text-[10px] font-mono uppercase tracking-wider mt-3"
              >
                [ {t('pressToFind')} {gameModes.find(m => m.id === selectedMode)?.mode} ]
              </motion.p>
            )}
            
            {!canStartMatch && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-500/70 text-[10px] font-mono uppercase tracking-wider mt-3"
              >
                [ {t('onlyLeaderCanStart')} ]
              </motion.p>
            )}
            
            {/* Player count error */}
            <AnimatePresence>
              {playerCountError && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-red-500 text-[10px] font-mono uppercase tracking-wider mt-3 bg-red-500/10 px-3 py-2 border border-red-500/30"
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
          className="hidden lg:block w-72 xl:w-80"
        >
          <div className="hud-panel p-4 h-fit sticky top-24">
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-accent-primary/50" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-accent-primary/50" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-accent-primary/30" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-accent-primary/30" />
            
            <PartyPanel maxPlayers={5} />
          </div>
        </motion.div>
      </div>

      {/* Stats Bar - Desktop only - HUD Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="hidden md:block fixed bottom-10 left-4 right-4 md:left-8 md:right-8 lg:left-16 lg:right-16"
      >
        <div className="hud-panel px-6 py-3 flex items-center justify-between">
          {/* Left stats */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Online</span>
              <span className="text-sm font-mono text-white font-bold">{siteStats.onlineUsers.toLocaleString()}</span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Accounts</span>
              <span className="text-sm font-mono text-accent-primary">{siteStats.totalUsers.toLocaleString()}</span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Matches</span>
              <span className="text-sm font-mono text-accent-primary">{siteStats.totalMatches.toLocaleString()}</span>
            </div>
          </div>

          {/* Center - Game title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-px bg-gradient-to-r from-transparent to-accent-primary/30" />
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Call of Duty: Black Ops 7</span>
            <div className="w-8 h-px bg-gradient-to-l from-transparent to-accent-primary/30" />
          </div>

          {/* Right - Credits */}
          <div className="flex items-center gap-4 text-[10px] font-mono text-gray-600">
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
}

export default Lobby
