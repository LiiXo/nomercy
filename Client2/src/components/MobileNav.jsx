import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'

const MobileNav = ({ onLoginClick }) => {
  const location = useLocation()
  const { t } = useLanguage()
  const { isAuthenticated, user, isAdmin } = useAuth()
  
  const baseNavItems = [
    { path: '/', label: t('lobby'), icon: (
      <span className="text-xl">🎮</span>
    )},
    { path: '/leaderboard', label: t('leaderboard'), icon: (
      <span className="text-xl">🏆</span>
    )},
    { path: '/tournaments', label: t('tournaments'), icon: (
      <span className="text-xl">⚔️</span>
    )},
  ]

  let navItems = [...baseNavItems]
  
  if (isAuthenticated) {
    navItems.push({ path: '/profile', label: t('profile'), icon: (
      <div className="w-6 h-6 rounded-full bg-accent-primary/30 flex items-center justify-center text-xs font-bold text-accent-primary">
        {user?.username?.charAt(0)?.toUpperCase() || 'P'}
      </div>
    )})
    
    if (isAdmin()) {
      navItems.push({ path: '/admin', label: t('admin'), icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )})
    }
  }

  return (
    <motion.nav 
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
    >
      <div className="hud-panel border-t border-white/5 pb-safe">
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-accent-primary/30 to-transparent" />
        
        <div className="flex items-center justify-around px-2 py-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className="relative flex flex-col items-center py-2 px-3"
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-nav-active"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] bg-accent-primary"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className={`relative z-10 ${isActive ? 'text-accent-primary' : 'text-gray-600'} transition-colors`}>
                  {item.icon}
                </span>
                <span className={`relative z-10 text-[9px] mt-1 font-mono uppercase tracking-wider ${
                  isActive ? 'text-accent-primary' : 'text-gray-600'
                } transition-colors`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
          
          {/* Login button for mobile if not authenticated */}
          {!isAuthenticated && (
            <button
              onClick={onLoginClick}
              className="relative flex flex-col items-center py-2 px-3"
            >
              <span className="text-accent-primary">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
              </span>
              <span className="text-[9px] mt-1 font-mono uppercase tracking-wider text-accent-primary">
                {t('login')}
              </span>
            </button>
          )}
        </div>
      </div>
    </motion.nav>
  )
}

export default MobileNav
