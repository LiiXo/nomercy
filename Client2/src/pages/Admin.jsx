import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useSocket } from '../contexts/SocketContext'
import { API_URL, UPLOADS_BASE_URL } from '../config'

const Admin = () => {
  const { user, isAuthenticated, loading, isAdmin } = useAuth()
  const { t, language } = useLanguage()
  const { emit } = useSocket()
  
  // Tabs
  const [activeTab, setActiveTab] = useState('gameModes')
  
  const [gameModes, setGameModes] = useState([])
  const [selectedMode, setSelectedMode] = useState(null)
  const [showAddMode, setShowAddMode] = useState(false)
  const [newMode, setNewMode] = useState({ 
    name: { fr: '', en: '', de: '', it: '' }, 
    icon: '●',
    type: 'simple',
    rules: { fr: '', en: '', de: '', it: '' }
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  
  // Queue management
  const [queueStats, setQueueStats] = useState({ totalPlayers: 0, queues: {} })
  const [clearingQueues, setClearingQueues] = useState(false)
  
  // Site stats
  const [siteStats, setSiteStats] = useState({ onlineUsers: 0, totalUsers: 0, totalMatches: 0, totalSquads: 0, avgMatchesPerDay: 0 })
  
  // Player management
  const [playerSearch, setPlayerSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [playerStats, setPlayerStats] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [savingStats, setSavingStats] = useState(false)

  // Default game modes
  const defaultModes = [
    { id: 'ranked', name: { fr: 'Classé', en: 'Ranked', de: 'Ranked', it: 'Classificata' }, icon: '⚔', type: 'hardcore', enabled: true, rules: { fr: '', en: '', de: '', it: '' } },
    { id: 'casual', name: { fr: 'Casual', en: 'Casual', de: 'Casual', it: 'Casual' }, icon: '◉', type: 'simple', enabled: true, rules: { fr: '', en: '', de: '', it: '' } },
    { id: 'tournament', name: { fr: 'Tournoi', en: 'Tournament', de: 'Turnier', it: 'Torneo' }, icon: '◈', type: 'hardcore', enabled: true, rules: { fr: '', en: '', de: '', it: '' } },
    { id: 'custom', name: { fr: 'Personnalisé', en: 'Custom', de: 'Benutzerdefiniert', it: 'Personalizzata' }, icon: '✦', type: 'simple', enabled: true, rules: { fr: '', en: '', de: '', it: '' } }
  ]

  // Load game modes config from server (or init with defaults)
  useEffect(() => {
    const fetchGameModes = async () => {
      try {
        const response = await fetch(`${API_URL}/app-settings/public`)
        const data = await response.json()
        if (data.success && data.lobbyGameModes && data.lobbyGameModes.length > 0) {
          setGameModes(data.lobbyGameModes)
        } else {
          // No modes in database - save defaults
          const saveResponse = await fetch(`${API_URL}/app-settings/admin`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ lobbyGameModes: defaultModes })
          })
          const saveData = await saveResponse.json()
          if (saveData.success) {
            setGameModes(defaultModes)
          }
        }
      } catch (e) {
        console.error('Error loading game modes:', e)
      }
    }
    fetchGameModes()
  }, [])

  // Save game modes to server
  const saveGameModes = async (modes) => {
    setSaving(true)
    try {
      const response = await fetch(`${API_URL}/app-settings/admin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ lobbyGameModes: modes })
      })
      const data = await response.json()
      if (data.success) {
        setGameModes(modes)
        setSuccess(t('saved'))
        setTimeout(() => setSuccess(''), 2000)
      } else {
        console.error('Error saving game modes:', data.message)
      }
    } catch (e) {
      console.error('Error saving game modes:', e)
    } finally {
      setSaving(false)
    }
  }

  // Fetch site stats
  useEffect(() => {
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
    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  // Redirect if not admin
  if (!loading && (!isAuthenticated || !isAdmin())) {
    return <Navigate to="/" replace />
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 md:pt-36 pb-24 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-accent-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Toggle mode enabled/disabled
  const toggleMode = (modeId) => {
    const updated = gameModes.map(m => 
      m.id === modeId ? { ...m, enabled: !m.enabled } : m
    )
    saveGameModes(updated)
  }

  // Add new game mode
  const addGameMode = () => {
    if (!newMode.name.fr.trim() && !newMode.name.en.trim()) return
    
    const modeId = `custom-${Date.now()}`
    const updated = [...gameModes, {
      id: modeId,
      name: newMode.name,
      icon: newMode.icon || '●',
      type: newMode.type || 'simple',
      enabled: true,
      rules: { fr: '', en: '', de: '', it: '' }
    }]
    saveGameModes(updated)
    setNewMode({ name: { fr: '', en: '', de: '', it: '' }, icon: '●', type: 'simple', rules: { fr: '', en: '', de: '', it: '' } })
    setShowAddMode(false)
  }

  // Delete game mode
  const deleteGameMode = (modeId) => {
    const updated = gameModes.filter(m => m.id !== modeId)
    saveGameModes(updated)
    if (selectedMode === modeId) setSelectedMode(null)
  }

  // Duplicate a Simple mode as Hardcore
  const duplicateAsHardcore = (mode) => {
    const newModeId = `${mode.id}-hardcore-${Date.now()}`
    const duplicatedMode = {
      ...mode,
      id: newModeId,
      type: 'hardcore',
      name: {
        fr: `${mode.name?.fr || mode.id} HC`,
        en: `${mode.name?.en || mode.id} HC`,
        de: `${mode.name?.de || mode.id} HC`,
        it: `${mode.name?.it || mode.id} HC`
      },
      rules: { ...mode.rules }
    }
    const updated = [...gameModes, duplicatedMode]
    saveGameModes(updated)
  }

  // Update mode rules
  const updateModeRules = (modeId, lang, value) => {
    const updated = gameModes.map(m => {
      if (m.id === modeId) {
        return {
          ...m,
          rules: { ...m.rules, [lang]: value }
        }
      }
      return m
    })
    saveGameModes(updated)
  }

  // Update mode type
  const updateModeType = (modeId, type) => {
    const updated = gameModes.map(m => {
      if (m.id === modeId) {
        return { ...m, type }
      }
      return m
    })
    saveGameModes(updated)
  }

  // Update mode name
  const updateModeName = (modeId, lang, value) => {
    const updated = gameModes.map(m => {
      if (m.id === modeId) {
        return {
          ...m,
          name: { ...m.name, [lang]: value }
        }
      }
      return m
    })
    saveGameModes(updated)
  }

  // Update mode icon
  const updateModeIcon = (modeId, icon) => {
    const updated = gameModes.map(m => {
      if (m.id === modeId) {
        return { ...m, icon }
      }
      return m
    })
    saveGameModes(updated)
  }

  // Get mode label
  const getModeLabel = (mode) => {
    if (mode.name) {
      return mode.name[language] || mode.name.en || mode.name.fr || mode.id
    }
    // Fallback for old format
    const labels = {
      ranked: { fr: 'Classé', en: 'Ranked', de: 'Ranked', it: 'Classificata' },
      casual: { fr: 'Casual', en: 'Casual', de: 'Casual', it: 'Casual' },
      tournament: { fr: 'Tournoi', en: 'Tournament', de: 'Turnier', it: 'Torneo' },
      custom: { fr: 'Personnalisé', en: 'Custom', de: 'Benutzerdefiniert', it: 'Personalizzata' }
    }
    return labels[mode.id]?.[language] || mode.id
  }

  // Search players
  useEffect(() => {
    if (playerSearch.length < 2) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(playerSearch)}&limit=10`, {
          credentials: 'include'
        })
        const data = await response.json()
        if (data.success) {
          setSearchResults(data.users)
        }
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [playerSearch])

  // Select player and load full data
  const selectPlayer = async (player) => {
    setSelectedPlayer(player)
    setSearchResults([])
    setPlayerSearch('')
    
    // Initialize stats form (simplified)
    setPlayerStats({
      xp: player.stats?.xp || 0,
      wins: player.stats?.wins || 0,
      losses: player.stats?.losses || 0,
      isVip: player.roles?.includes('vip') || false
    })
  }

  // Save player stats
  const savePlayerStats = async () => {
    if (!selectedPlayer || !playerStats) return
    
    setSavingStats(true)
    try {
      const response = await fetch(`${API_URL}/users/admin/${selectedPlayer._id}/stats`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(playerStats)
      })
      
      const data = await response.json()
      if (data.success) {
        setSuccess(t('statsUpdated'))
        setTimeout(() => setSuccess(''), 2000)
      }
    } catch (err) {
      console.error('Error saving stats:', err)
    } finally {
      setSavingStats(false)
    }
  }

  // Get player avatar URL
  const getPlayerAvatarUrl = (player) => {
    if (player?.avatar) {
      if (player.avatar.startsWith('http')) return player.avatar
      return `${UPLOADS_BASE_URL}${player.avatar}`
    }
    if (player?.discordAvatar && player?.discordId) {
      return `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png?size=64`
    }
    return null
  }

  // Format last seen time
  const formatLastSeen = (date) => {
    if (!date) return 'Jamais'
    const now = new Date()
    const lastSeen = new Date(date)
    const diffMs = now - lastSeen
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'À l\'instant'
    if (diffMins < 60) return `${diffMins} min`
    if (diffHours < 24) return `${diffHours}h`
    return `${diffDays}j`
  }

  return (
    <div className="min-h-screen pt-16 md:pt-20 pb-24 md:pb-20 px-4 md:px-8 lg:px-16">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 bg-red-500" />
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">System Control</span>
        </div>
        <h1 className="text-xl md:text-2xl font-mono font-bold uppercase tracking-wide text-white">
          {t('adminPanel')}
        </h1>
      </motion.div>

      {/* Site Stats */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative bg-dark-800/30 border border-white/10 p-4 mb-6"
      >
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-accent-primary/30" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-accent-primary/30" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-accent-primary/30" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-accent-primary/30" />
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">{t('playersOnline')}</p>
            <p className="text-xl font-mono font-bold text-green-400">
              {siteStats.onlineUsers?.toLocaleString() || 0}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">{t('totalAccounts')}</p>
            <p className="text-xl font-mono font-bold text-white">
              {siteStats.totalUsers?.toLocaleString() || 0}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">{t('totalMatches')}</p>
            <p className="text-xl font-mono font-bold text-white">
              {siteStats.totalMatches?.toLocaleString() || 0}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">{t('avgMatchesPerDay')}</p>
            <p className="text-xl font-mono font-bold text-accent-primary">
              {siteStats.avgMatchesPerDay?.toLocaleString() || 0}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setActiveTab('gameModes')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-wider transition-all ${
            activeTab === 'gameModes'
              ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/50'
              : 'bg-dark-800/50 text-gray-500 border border-white/10 hover:text-gray-300 hover:border-white/20'
          }`}
        >
          <span>⚙</span>
          <span>{t('gameModes')}</span>
        </button>
        <button
          onClick={() => setActiveTab('players')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-wider transition-all ${
            activeTab === 'players'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
              : 'bg-dark-800/50 text-gray-500 border border-white/10 hover:text-gray-300 hover:border-white/20'
          }`}
        >
          <span>👤</span>
          <span>{t('playerManagement')}</span>
        </button>
        <button
          onClick={() => setActiveTab('queues')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-wider transition-all ${
            activeTab === 'queues'
              ? 'bg-red-500/20 text-red-400 border border-red-500/50'
              : 'bg-dark-800/50 text-gray-500 border border-white/10 hover:text-gray-300 hover:border-white/20'
          }`}
        >
          <span>📋</span>
          <span>{t('queues')}</span>
        </button>
      </div>

      {/* Success message */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-3 bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-mono uppercase tracking-wider"
          >
            [ {success} ]
          </motion.div>
        )}
      </AnimatePresence>

        {/* Game Modes Tab */}
        {activeTab === 'gameModes' && (
          <>
            {/* Add Mode Button */}
            <div className="mb-6">
              <button
                onClick={() => setShowAddMode(!showAddMode)}
                className="flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-wider bg-accent-primary/20 hover:bg-accent-primary/30 text-accent-primary border border-accent-primary/50 transition-all"
              >
                <span>+</span>
                <span>{t('addGameMode')}</span>
              </button>
            </div>

            {/* Add Mode Form */}
            <AnimatePresence>
              {showAddMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 overflow-hidden"
                >
                  <div className="relative bg-dark-800/30 border border-accent-primary/30 p-5">
                    {/* Corner accents */}
                    <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-accent-primary/50" />
                    <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-accent-primary/50" />
                    <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-accent-primary/50" />
                    <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-accent-primary/50" />

                    <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider mb-4">{t('newGameMode')}</h3>
                    
                    {/* Icon */}
                    <div className="mb-4">
                      <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-2">{t('icon')}</label>
                      <input
                        type="text"
                        value={newMode.icon}
                        onChange={(e) => setNewMode({ ...newMode, icon: e.target.value })}
                        placeholder="⚔ ◉ ◈ ✦ ●"
                        className="w-20 px-3 py-2 text-center text-xl bg-dark-900/50 border border-white/10 text-white font-mono focus:outline-none focus:border-accent-primary/50"
                        maxLength={2}
                      />
                    </div>

                    {/* Type */}
                    <div className="mb-4">
                      <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-2">{t('modeType')}</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setNewMode({ ...newMode, type: 'simple' })}
                          className={`flex-1 px-4 py-2 text-xs font-mono uppercase tracking-wider transition-all ${
                            newMode.type === 'simple'
                              ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/50'
                              : 'bg-dark-800/50 text-gray-500 border border-white/10 hover:text-gray-300'
                          }`}
                        >
                          ◆ Simple
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewMode({ ...newMode, type: 'hardcore' })}
                          className={`flex-1 px-4 py-2 text-xs font-mono uppercase tracking-wider transition-all ${
                            newMode.type === 'hardcore'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                              : 'bg-dark-800/50 text-gray-500 border border-white/10 hover:text-gray-300'
                          }`}
                        >
                          ☠ Hardcore
                        </button>
                      </div>
                    </div>

                    {/* Names */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-1">Nom (FR)</label>
                        <input
                          type="text"
                          value={newMode.name.fr}
                          onChange={(e) => setNewMode({ ...newMode, name: { ...newMode.name, fr: e.target.value } })}
                          placeholder="Ex: Classé"
                          className="w-full px-3 py-2 text-xs font-mono bg-dark-900/50 border border-white/10 text-white focus:outline-none focus:border-accent-primary/50"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-1">Name (EN)</label>
                        <input
                          type="text"
                          value={newMode.name.en}
                          onChange={(e) => setNewMode({ ...newMode, name: { ...newMode.name, en: e.target.value } })}
                          placeholder="Ex: Ranked"
                          className="w-full px-3 py-2 text-xs font-mono bg-dark-900/50 border border-white/10 text-white focus:outline-none focus:border-accent-primary/50"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-1">Name (DE)</label>
                        <input
                          type="text"
                          value={newMode.name.de}
                          onChange={(e) => setNewMode({ ...newMode, name: { ...newMode.name, de: e.target.value } })}
                          placeholder="Ex: Ranked"
                          className="w-full px-3 py-2 text-xs font-mono bg-dark-900/50 border border-white/10 text-white focus:outline-none focus:border-accent-primary/50"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-1">Nome (IT)</label>
                        <input
                          type="text"
                          value={newMode.name.it}
                          onChange={(e) => setNewMode({ ...newMode, name: { ...newMode.name, it: e.target.value } })}
                          placeholder="Ex: Classificata"
                          className="w-full px-3 py-2 text-xs font-mono bg-dark-900/50 border border-white/10 text-white focus:outline-none focus:border-accent-primary/50"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={addGameMode}
                        disabled={!newMode.name.fr.trim() && !newMode.name.en.trim()}
                        className="flex-1 py-2 text-xs font-mono uppercase tracking-wider bg-accent-primary/20 hover:bg-accent-primary/30 disabled:opacity-50 text-accent-primary border border-accent-primary/50 transition-all"
                      >
                        [ {t('addMode')} ]
                      </button>
                      <button
                        onClick={() => setShowAddMode(false)}
                        className="px-4 py-2 text-xs font-mono uppercase tracking-wider bg-dark-800/50 hover:bg-dark-700/50 text-gray-400 border border-white/10 transition-all"
                      >
                        [ {t('cancel')} ]
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Game Modes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {gameModes.map((mode, index) => (
            <motion.div
              key={mode.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`glass rounded-xl p-5 border ${
                mode.enabled ? 'border-accent-primary/30' : 'border-red-500/30 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{mode.icon || '●'}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {getModeLabel(mode)}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      mode.type === 'hardcore' 
                        ? 'bg-red-500/20 text-red-400' 
                        : 'bg-accent-primary/20 text-accent-primary'
                    }`}>
                      {mode.type === 'hardcore' ? 'Hardcore' : 'Simple'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Edit rules button */}
                  <button
                    onClick={() => setSelectedMode(selectedMode === mode.id ? null : mode.id)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      selectedMode === mode.id 
                        ? 'bg-accent-primary text-white' 
                        : 'bg-accent-primary/20 hover:bg-accent-primary/30 text-accent-primary'
                    }`}
                  >
                    {t('editRules')}
                  </button>
                  {/* Duplicate as Hardcore button - only for Simple modes */}
                  {mode.type !== 'hardcore' && (
                    <button
                      onClick={() => duplicateAsHardcore(mode)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                      title="Dupliquer en Hardcore"
                    >
                      ☠ HC
                    </button>
                  )}
                  {/* Toggle switch */}
                  <button
                    onClick={() => toggleMode(mode.id)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      mode.enabled ? 'bg-accent-primary' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        mode.enabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  {/* Delete button */}
                  <button
                    onClick={() => deleteGameMode(mode.id)}
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                    title={t('deleteMode')}
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Type selector */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => updateModeType(mode.id, 'simple')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    mode.type !== 'hardcore'
                      ? 'bg-accent-primary text-white'
                      : 'bg-dark-700 text-gray-400 hover:text-white border border-white/10'
                  }`}
                >
                  Simple
                </button>
                <button
                  onClick={() => updateModeType(mode.id, 'hardcore')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    mode.type === 'hardcore'
                      ? 'bg-red-600 text-white'
                      : 'bg-dark-700 text-gray-400 hover:text-white border border-white/10'
                  }`}
                >
                  Hardcore
                </button>
              </div>

              <p className="text-sm text-gray-400">
                {mode.enabled ? t('modeEnabled') : t('modeDisabled')}
              </p>

              {/* Rules editor (expanded) */}
              <AnimatePresence>
                {selectedMode === mode.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-4 pt-4 border-t border-white/10 overflow-hidden"
                  >
                    {/* Icon Editor */}
                    <div className="mb-4">
                      <label className="text-xs text-gray-400 block mb-2">{t('icon')}</label>
                      <input
                        type="text"
                        value={mode.icon || '●'}
                        onChange={(e) => updateModeIcon(mode.id, e.target.value)}
                        placeholder="⚔ ◉ ◈ ✦ ●"
                        className="w-16 px-2 py-1.5 text-center text-lg bg-dark-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent-primary/50"
                        maxLength={2}
                      />
                    </div>

                    {/* Name editors */}
                    <p className="text-xs text-gray-400 mb-3">{t('editModeName') || 'Edit mode name'}</p>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Nom (FR)</label>
                        <input
                          type="text"
                          value={mode.name?.fr || ''}
                          onChange={(e) => updateModeName(mode.id, 'fr', e.target.value)}
                          placeholder="Ex: Classé"
                          className="w-full px-3 py-2 text-sm bg-dark-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent-primary/50"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Name (EN)</label>
                        <input
                          type="text"
                          value={mode.name?.en || ''}
                          onChange={(e) => updateModeName(mode.id, 'en', e.target.value)}
                          placeholder="Ex: Ranked"
                          className="w-full px-3 py-2 text-sm bg-dark-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent-primary/50"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Name (DE)</label>
                        <input
                          type="text"
                          value={mode.name?.de || ''}
                          onChange={(e) => updateModeName(mode.id, 'de', e.target.value)}
                          placeholder="Ex: Ranked"
                          className="w-full px-3 py-2 text-sm bg-dark-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent-primary/50"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Nome (IT)</label>
                        <input
                          type="text"
                          value={mode.name?.it || ''}
                          onChange={(e) => updateModeName(mode.id, 'it', e.target.value)}
                          placeholder="Ex: Classificata"
                          className="w-full px-3 py-2 text-sm bg-dark-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent-primary/50"
                        />
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 mb-3">{t('rulesDescription')}</p>
                    
                    {/* Rules textareas */}
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Règles (FR)</label>
                        <textarea
                          value={mode.rules?.fr || ''}
                          onChange={(e) => updateModeRules(mode.id, 'fr', e.target.value)}
                          placeholder="Une règle par ligne..."
                          rows={4}
                          className="w-full px-3 py-2 text-xs bg-dark-800 border border-white/10 rounded-lg text-white focus:border-accent-primary/50 focus:outline-none resize-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Rules (EN)</label>
                        <textarea
                          value={mode.rules?.en || ''}
                          onChange={(e) => updateModeRules(mode.id, 'en', e.target.value)}
                          placeholder="One rule per line..."
                          rows={4}
                          className="w-full px-3 py-2 text-xs bg-dark-800 border border-white/10 rounded-lg text-white focus:border-accent-primary/50 focus:outline-none resize-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Regeln (DE)</label>
                        <textarea
                          value={mode.rules?.de || ''}
                          onChange={(e) => updateModeRules(mode.id, 'de', e.target.value)}
                          placeholder="Eine Regel pro Zeile..."
                          rows={4}
                          className="w-full px-3 py-2 text-xs bg-dark-800 border border-white/10 rounded-lg text-white focus:border-accent-primary/50 focus:outline-none resize-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Regole (IT)</label>
                        <textarea
                          value={mode.rules?.it || ''}
                          onChange={(e) => updateModeRules(mode.id, 'it', e.target.value)}
                          placeholder="Una regola per riga..."
                          rows={4}
                          className="w-full px-3 py-2 text-xs bg-dark-800 border border-white/10 rounded-lg text-white focus:border-accent-primary/50 focus:outline-none resize-none"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="glass rounded-xl p-4 border border-white/10"
        >
          <p className="text-xs text-gray-400">
            💡 {t('adminTip')}
          </p>
        </motion.div>
          </>
        )}

        {/* Players Tab */}
        {activeTab === 'players' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Search */}
            <div className="glass rounded-xl p-5">
              <h3 className="text-lg font-semibold text-white mb-4">{t('searchPlayer')}</h3>
              <div className="relative">
                <input
                  type="text"
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  placeholder={t('searchPlayerPlaceholder')}
                  className="w-full px-4 py-3 pl-10 bg-dark-700 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-primary/50"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-3 space-y-2">
                  {searchResults.map((player) => (
                    <button
                      key={player._id}
                      onClick={() => selectPlayer(player)}
                      className="w-full flex items-center gap-3 p-3 bg-dark-700/50 hover:bg-dark-600/50 rounded-xl transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-dark-500 flex-shrink-0">
                        {getPlayerAvatarUrl(player) ? (
                          <img src={getPlayerAvatarUrl(player)} alt={player.username} className="w-full h-full object-cover" />
                        ) : (
                          <span className="w-full h-full flex items-center justify-center text-accent-primary font-medium">
                            {player.username?.charAt(0)?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium">{player.username}</p>
                        <p className="text-xs text-gray-400">{player.activisionId || player.discordUsername}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Player Stats */}
            {selectedPlayer && playerStats && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-xl p-5"
              >
                {/* Player Header */}
                <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white/10">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-dark-500">
                    {getPlayerAvatarUrl(selectedPlayer) ? (
                      <img src={getPlayerAvatarUrl(selectedPlayer)} alt={selectedPlayer.username} className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-accent-primary text-xl font-bold">
                        {selectedPlayer.username?.charAt(0)?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedPlayer.username}</h3>
                    <p className="text-sm text-gray-400">{selectedPlayer.activisionId || selectedPlayer.discordUsername}</p>
                  </div>
                  <button
                    onClick={() => { setSelectedPlayer(null); setPlayerStats(null) }}
                    className="ml-auto text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                {/* Stats Form */}
                <div className="space-y-4">
                  {/* XP */}
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">XP</label>
                    <input
                      type="number"
                      value={playerStats.xp}
                      onChange={(e) => setPlayerStats({
                        ...playerStats,
                        xp: parseInt(e.target.value) || 0
                      })}
                      className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent-primary/50"
                    />
                  </div>

                  {/* Wins & Losses */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">{t('victories')}</label>
                      <input
                        type="number"
                        value={playerStats.wins}
                        onChange={(e) => setPlayerStats({
                          ...playerStats,
                          wins: parseInt(e.target.value) || 0
                        })}
                        className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent-primary/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">{t('defeats')}</label>
                      <input
                        type="number"
                        value={playerStats.losses}
                        onChange={(e) => setPlayerStats({
                          ...playerStats,
                          losses: parseInt(e.target.value) || 0
                        })}
                        className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent-primary/50"
                      />
                    </div>
                  </div>

                  {/* VIP Toggle */}
                  <div className="flex items-center justify-between p-3 bg-dark-700/50 rounded-lg border border-white/10">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">👑</span>
                      <div>
                        <p className="text-white font-medium text-sm">VIP</p>
                        <p className="text-xs text-gray-400">{t('vipAccess')}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setPlayerStats({ ...playerStats, isVip: !playerStats.isVip })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        playerStats.isVip ? 'bg-yellow-500' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          playerStats.isVip ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Save Button */}
                <button
                  onClick={savePlayerStats}
                  disabled={savingStats}
                  className="w-full mt-6 py-3 bg-accent-primary hover:bg-accent-primary/80 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
                >
                  {savingStats ? t('saving') : t('saveStats')}
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Queues Tab */}
        {activeTab === 'queues' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Queue Stats */}
            <div className="relative bg-dark-800/30 border border-white/10 p-5">
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-red-500/30" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-red-500/30" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-red-500/30" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-red-500/30" />

              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                    {t('matchmakingQueues')}
                  </h3>
                  <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mt-1">
                    {t('playersCurrentlyInQueue')}: <span className="text-accent-primary">{queueStats.totalPlayers}</span>
                  </p>
                </div>
                <button
                  onClick={() => {
                    emit('adminGetQueueStats', (response) => {
                      if (response.success) {
                        setQueueStats({ totalPlayers: response.totalPlayers, queues: response.queues });
                      }
                    });
                  }}
                  className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider bg-dark-700/50 hover:bg-dark-600/50 text-gray-400 border border-white/10 transition-all"
                >
                  [ {t('refresh')} ]
                </button>
              </div>

              {/* Queue details */}
              {Object.keys(queueStats.queues).length > 0 && (
                <div className="space-y-2 mb-4">
                  {Object.entries(queueStats.queues).map(([queueKey, count]) => (
                    <div key={queueKey} className="flex justify-between text-xs font-mono">
                      <span className="text-gray-500">{queueKey}</span>
                      <span className="text-white">{count} {t('players')}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Clear all queues button */}
              <button
                onClick={() => {
                  if (confirm(t('confirmClearQueues'))) {
                    setClearingQueues(true);
                    emit('adminClearAllQueues', (response) => {
                      setClearingQueues(false);
                      if (response.success) {
                        setSuccess(`${t('queuesCleared')} (${response.clearedCount} ${t('players')})`);
                        setQueueStats({ totalPlayers: 0, queues: {} });
                        setTimeout(() => setSuccess(''), 3000);
                      }
                    });
                  }
                }}
                disabled={clearingQueues}
                className="w-full py-3 text-xs font-mono uppercase tracking-wider bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 text-red-400 border border-red-500/50 transition-all"
              >
                {clearingQueues ? '[ ... ]' : `[ ${t('clearAllQueues')} ]`}
              </button>
            </div>

            {/* Info */}
            <div className="relative bg-dark-800/20 border border-white/10 p-4">
              <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-accent-primary/20" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-accent-primary/20" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-accent-primary/20" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-accent-primary/20" />
              
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                💡 {t('queueInfoTip')}
              </p>
            </div>
          </motion.div>
        )}
    </div>
  )
}

export default Admin
