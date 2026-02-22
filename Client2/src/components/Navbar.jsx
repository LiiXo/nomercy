import { useState, useEffect, useRef, memo, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useSound } from '../contexts/SoundContext'
import { API_URL, UPLOADS_BASE_URL } from '../config'
import LoginDialog from './LoginDialog'

const Navbar = memo(() => {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, user, logout, isAdmin } = useAuth()
  const { t, language, changeLanguage, availableLanguages } = useLanguage()
  const { playNavigate, playClick, playToggle, soundEnabled, setSoundEnabled, volume, setVolume } = useSound()
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [showLangMenu, setShowLangMenu] = useState(false)
  const [showSoundMenu, setShowSoundMenu] = useState(false)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const searchRef = useRef(null)
  const soundMenuRef = useRef(null)
  const langMenuRef = useRef(null)

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchResults(false)
      }
      if (soundMenuRef.current && !soundMenuRef.current.contains(e.target)) {
        setShowSoundMenu(false)
      }
      if (langMenuRef.current && !langMenuRef.current.contains(e.target)) {
        setShowLangMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Search players with debounce
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(searchQuery)}&limit=5`)
        const data = await response.json()
        if (data.success) {
          setSearchResults(data.users)
          setShowSearchResults(true)
        }
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Get player avatar URL
  const getPlayerAvatarUrl = (player) => {
    if (player.avatar) {
      if (player.avatar.startsWith('http')) return player.avatar
      return `${UPLOADS_BASE_URL}${player.avatar}`
    }
    if (player.discordAvatar && player.discordId) {
      return `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png?size=64`
    }
    return null
  }

  // Handle player select
  const handlePlayerSelect = (player) => {
    setSearchQuery('')
    setShowSearchResults(false)
    navigate(`/player/${player.username}`)
  }

  // Get avatar URL
  const getAvatarUrl = () => {
    if (user?.avatar) {
      if (user.avatar.startsWith('http')) return user.avatar
      return `${UPLOADS_BASE_URL}${user.avatar}`
    }
    if (user?.discordAvatar && user?.discordId) {
      return `https://cdn.discordapp.com/avatars/${user.discordId}/${user.discordAvatar}.png?size=64`
    }
    return null
  }
  
  const navItems = [
    { path: '/', label: t('lobby'), icon: '🎮' },
    { path: '/leaderboard', label: t('leaderboard'), icon: '🏆' },
    { path: '/tournaments', label: t('tournaments'), icon: '⚔️', badge: 'Soon', disabled: !isAdmin() },
    ...(isAuthenticated && isAdmin() ? [{ path: '/admin', label: t('admin'), icon: '⚙️' }] : []),
  ]

  return (
    <>
      <motion.nav 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 right-0 z-50"
      >
        <div className="px-4 md:px-8 lg:px-16 py-3">
          <div className="cod-player-card px-4 md:px-6 py-2 flex items-center justify-between">
            {/* Logo */}
            <Link to="/" onClick={() => playNavigate()} className="flex items-center gap-3 group">
              <img 
                src="/logo.png" 
                alt="NoMercy" 
                className="h-10 md:h-12 w-auto"
              />
            </Link>

            {/* Navigation Links - CoD Style */}
            <div className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path
                
                // Disabled items render as span instead of Link
                if (item.disabled) {
                  return (
                    <div
                      key={item.path}
                      className="relative px-4 py-2 cursor-not-allowed opacity-60"
                    >
                      <span className="relative z-10 flex items-center gap-2 font-military font-semibold text-xs uppercase tracking-wider text-gray-500">
                        <span className="text-sm opacity-50">{item.icon}</span>
                        {item.label}
                        {item.badge && (
                          <span className="px-1.5 py-0.5 text-[8px] bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold cod-corner-cut">
                            {item.badge}
                          </span>
                        )}
                      </span>
                    </div>
                  )
                }
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => playNavigate()}
                    className="relative px-4 py-2 group"
                  >
                    {isActive && (
                      <motion.div
                        layoutId="navbar-active"
                        className="absolute inset-0 bg-accent-primary/10 border-b-2 border-accent-primary"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <span className={`relative z-10 flex items-center gap-2 font-military font-semibold text-xs uppercase tracking-wider ${
                      isActive ? 'text-accent-primary' : 'text-gray-400 group-hover:text-white'
                    } transition-colors`}>
                      <span className="text-sm opacity-60">{item.icon}</span>
                      {item.label}
                      {item.badge && (
                        <span className="px-1.5 py-0.5 text-[8px] bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold cod-corner-cut">
                          {item.badge}
                        </span>
                      )}
                    </span>
                  </Link>
                )
              })}
            </div>

            {/* Search Bar - CoD Style */}
            <div ref={searchRef} className="relative hidden md:block">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                  placeholder={t('searchPlayer')}
                  className="w-48 lg:w-56 px-4 py-1.5 pl-9 bg-black/50 border border-white/10 text-xs font-military text-white placeholder-gray-600 focus:outline-none focus:border-accent-primary/50 transition-colors cod-corner-cut"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-accent-primary/30 border-t-accent-primary animate-spin" />
                  </div>
                )}
              </div>

              {/* Search Results Dropdown */}
              <AnimatePresence>
                {showSearchResults && searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-2 py-2 bg-gradient-to-b from-dark-600 to-dark-700 cod-corner-cut border border-accent-primary/20 shadow-xl shadow-accent-primary/10 overflow-hidden z-[100]"
                  >
                    {searchResults.map((player) => (
                      <button
                        key={player._id}
                        onClick={() => handlePlayerSelect(player)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent-primary/10 transition-colors text-left"
                      >
                        <div className="w-8 h-8 overflow-hidden bg-dark-500 flex-shrink-0 cod-corner-cut">
                          {getPlayerAvatarUrl(player) ? (
                            <img src={getPlayerAvatarUrl(player)} alt={player.username} className="w-full h-full object-cover" />
                          ) : (
                            <span className="w-full h-full flex items-center justify-center text-accent-primary text-xs font-military">
                              {player.username?.charAt(0)?.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-white font-military truncate">{player.username}</p>
                          {player.activisionId && (
                            <p className="text-xs text-gray-400 truncate">{player.activisionId}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right Section: Sound + Language + Auth */}
            <div className="flex items-center gap-4">
              {/* Sound Toggle */}
              <div ref={soundMenuRef} className="relative">
                <button
                  onClick={() => {
                    playToggle()
                    setShowSoundMenu(!showSoundMenu)
                  }}
                  className={`flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-dark-500 to-dark-600 border transition-colors text-sm font-medium cod-corner-cut ${
                    soundEnabled 
                      ? 'border-accent-primary/30 text-white' 
                      : 'border-red-500/30 text-red-400'
                  }`}
                >
                  {soundEnabled ? '🔊' : '🔇'}
                </button>

                <AnimatePresence>
                  {showSoundMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 mt-2 py-3 px-4 w-48 bg-gradient-to-b from-dark-600 to-dark-700 cod-corner-cut border border-accent-primary/20 shadow-xl shadow-accent-primary/10 z-[100]"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-white font-military uppercase tracking-wide">Sons UI</span>
                        <button
                          onClick={() => {
                            setSoundEnabled(!soundEnabled)
                            playToggle()
                          }}
                          className={`relative w-10 h-5 transition-colors cod-corner-cut ${
                            soundEnabled ? 'bg-accent-primary' : 'bg-gray-600'
                          }`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white transition-transform ${
                            soundEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 block mb-2 font-military uppercase tracking-wide">Volume: {Math.round(volume * 100)}%</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={volume}
                          onChange={(e) => {
                            setVolume(parseFloat(e.target.value))
                            playClick()
                          }}
                          className="w-full h-1 bg-dark-500 appearance-none cursor-pointer accent-accent-primary"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Language Selector */}
              <div ref={langMenuRef} className="relative">
                <button
                  onClick={() => {
                    playClick()
                    setShowLangMenu(!showLangMenu)
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-dark-500 to-dark-600 border border-accent-primary/10 hover:border-accent-primary/30 transition-colors text-sm font-military text-white cod-corner-cut"
                >
                  <img 
                    src={availableLanguages.find(l => l.code === language)?.flag} 
                    alt={language}
                    className="w-5 h-4 object-cover"
                  />
                  {availableLanguages.find(l => l.code === language)?.label}
                  <svg className={`w-4 h-4 transition-transform ${showLangMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showLangMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute right-0 mt-2 py-2 w-36 bg-gradient-to-b from-dark-600 to-dark-700 cod-corner-cut border border-accent-primary/20 shadow-xl shadow-accent-primary/10 z-[100]"
                  >
                    {availableLanguages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          playClick()
                          changeLanguage(lang.code)
                          setShowLangMenu(false)
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-military hover:bg-accent-primary/10 transition-colors ${
                          language === lang.code ? 'text-accent-primary' : 'text-white'
                        }`}
                      >
                        <img src={lang.flag} alt={lang.label} className="w-5 h-4 object-cover" />
                        {lang.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* Auth Button - CoD Style */}
              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <div className="w-8 h-8 overflow-hidden bg-gradient-to-br from-accent-primary/30 to-accent-secondary/20 border border-accent-primary/30 cod-corner-cut">
                      {getAvatarUrl() ? (
                        <img src={getAvatarUrl()} alt={user?.username} className="w-full h-full object-cover" />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center text-accent-primary text-sm font-medium">
                          {user?.username?.charAt(0)?.toUpperCase() || 'P'}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-white font-military">{user?.username || user?.discordUsername}</span>
                  </Link>
                  <button
                    onClick={logout}
                    className="text-sm text-gray-400 hover:text-accent-primary transition-colors font-military uppercase tracking-wider"
                  >
                    {t('logout')}
                  </button>
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowLoginDialog(true)}
                  className="cod-button px-5 py-2.5 text-white font-display text-lg uppercase tracking-wider"
                >
                  {t('login')}
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Login Dialog */}
      <LoginDialog isOpen={showLoginDialog} onClose={() => setShowLoginDialog(false)} />
    </>
  )
})

Navbar.displayName = 'Navbar'

export default Navbar
