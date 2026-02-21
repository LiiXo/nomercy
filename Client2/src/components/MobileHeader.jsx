import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { UPLOADS_BASE_URL } from '../config'

const MobileHeader = () => {
  const { language, changeLanguage, availableLanguages } = useLanguage()
  const { isAuthenticated, user } = useAuth()
  const [showLangMenu, setShowLangMenu] = useState(false)

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

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 md:hidden"
    >
      <div className="hud-panel border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-2">
          {/* Logo */}
          <img 
            src="/logo.png" 
            alt="NoMercy" 
            className="h-8 w-auto"
          />

          {/* Right section */}
          <div className="flex items-center gap-3">
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="flex items-center gap-1 px-2 py-1 bg-black/30 border border-white/10 text-xs font-mono"
              >
                <img 
                  src={availableLanguages.find(l => l.code === language)?.flag}
                  alt={language}
                  className="w-4 h-3 object-cover"
                />
                <svg className={`w-3 h-3 transition-transform ${showLangMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showLangMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 mt-2 py-1 w-24 hud-panel border border-white/10"
                >
                  {availableLanguages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        changeLanguage(lang.code)
                        setShowLangMenu(false)
                      }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 text-[10px] font-mono hover:bg-white/10 transition-colors ${
                        language === lang.code ? 'text-accent-primary' : 'text-white'
                      }`}
                    >
                      <img src={lang.flag} alt={lang.label} className="w-4 h-3 object-cover" />
                      {lang.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </div>

            {/* User avatar if authenticated */}
            {isAuthenticated && (
              <Link to="/profile" className="w-7 h-7 overflow-hidden bg-accent-primary/10 border border-accent-primary/30">
                {getAvatarUrl() ? (
                  <img src={getAvatarUrl()} alt={user?.username} className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-accent-primary text-xs font-mono">
                    {user?.username?.charAt(0)?.toUpperCase() || 'P'}
                  </span>
                )}
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.header>
  )
}

export default MobileHeader
