import { useState, useEffect, lazy, Suspense, memo } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, LazyMotion, domAnimation } from 'framer-motion'
import Navbar from './components/Navbar'
import MobileHeader from './components/MobileHeader'
import MobileNav from './components/MobileNav'
import LoginDialog from './components/LoginDialog'
import Preloader from './components/Preloader'
import FloatingParticles from './components/FloatingParticles'
import { useAuth } from './contexts/AuthContext'

// Lazy load pages for better performance
const Lobby = lazy(() => import('./pages/Lobby'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const Tournaments = lazy(() => import('./pages/Tournaments'))
const Profile = lazy(() => import('./pages/Profile'))
const PlayerProfile = lazy(() => import('./pages/PlayerProfile'))
const Admin = lazy(() => import('./pages/Admin'))

// Optimized page transition variants - GPU accelerated
const pageVariants = {
  initial: {
    opacity: 0,
    x: 40,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.25,
      ease: [0.25, 0.1, 0.25, 1],
    }
  },
  exit: {
    opacity: 0,
    x: -40,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1],
    }
  }
}

// Loading fallback
const PageLoader = memo(() => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent animate-spin" />
  </div>
))

function App() {
  const location = useLocation()
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [preloaderComplete, setPreloaderComplete] = useState(false)
  const { loading, isAuthenticated } = useAuth()

  // Show preloader until both auth is done AND preloader animation completes
  const showPreloader = loading || !preloaderComplete

  // Auto-open login dialog for non-authenticated users
  useEffect(() => {
    if (!loading && !isAuthenticated && preloaderComplete) {
      setShowLoginDialog(true)
    }
  }, [loading, isAuthenticated, preloaderComplete])

  if (showPreloader) {
    return (
      <AnimatePresence>
        <Preloader onComplete={() => setPreloaderComplete(true)} />
      </AnimatePresence>
    )
  }

  return (
    <div className="min-h-screen bg-[#050506] overflow-x-hidden">
      {/* === CALL OF DUTY STYLE CINEMATIC BACKGROUND === */}
      <div className="cod-background">
        {/* Background Image with Ken Burns effect */}
        <div 
          className="cod-background-image"
          style={{
            backgroundImage: 'url("/wp.jpg")',
          }}
        />
        
        {/* Vignette overlay */}
        <div className="cod-vignette" />
        
        {/* Top gradient for navbar readability */}
        <div className="cod-top-gradient" />
        
        {/* Bottom gradient for content readability */}
        <div className="cod-bottom-gradient" />
        
        {/* Scanlines effect */}
        <div className="cod-scanlines" />
        
        {/* Noise texture */}
        <div className="cod-noise" />
      </div>
      
      {/* Floating particles */}
      <FloatingParticles count={30} color="#ff6b35" />

      {/* === HUD CORNER BRACKETS === */}
      <div className="fixed inset-0 pointer-events-none z-[90] hidden md:block">
        {/* Top Left */}
        <svg className="absolute top-3 left-3 w-10 h-10 text-accent-primary/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M4 4 L4 12 M4 4 L12 4" />
        </svg>
        {/* Top Right */}
        <svg className="absolute top-3 right-3 w-10 h-10 text-accent-primary/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M20 4 L20 12 M20 4 L12 4" />
        </svg>
        {/* Bottom Left */}
        <svg className="absolute bottom-3 left-3 w-10 h-10 text-accent-primary/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M4 20 L4 12 M4 20 L12 20" />
        </svg>
        {/* Bottom Right */}
        <svg className="absolute bottom-3 right-3 w-10 h-10 text-accent-primary/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M20 20 L20 12 M20 20 L12 20" />
        </svg>
        
        {/* Side accent lines */}
        <div className="absolute top-1/2 left-0 w-8 h-[1px] bg-gradient-to-r from-accent-primary/15 to-transparent" />
        <div className="absolute top-1/2 right-0 w-8 h-[1px] bg-gradient-to-l from-accent-primary/15 to-transparent" />
      </div>

      {/* === NAVIGATION === */}
      
      {/* Desktop Navigation */}
      <div className="hidden md:block relative z-50">
        <Navbar />
      </div>

      {/* Mobile Header */}
      <div className="relative z-50">
        <MobileHeader />
      </div>

      {/* === PAGE CONTENT === */}
      <main className="relative z-10 pb-20 md:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ willChange: 'transform, opacity' }}
          >
            <Suspense fallback={<PageLoader />}>
              <Routes location={location}>
                <Route path="/" element={<Lobby />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/tournaments" element={<Tournaments />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/player/:username" element={<PlayerProfile />} />
              </Routes>
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* === MOBILE NAVIGATION === */}
      <div className="relative z-50">
        <MobileNav onLoginClick={() => setShowLoginDialog(true)} />
      </div>

      {/* === DIALOGS === */}
      <LoginDialog isOpen={showLoginDialog} onClose={() => setShowLoginDialog(false)} />

      {/* === BOTTOM HUD BAR (Desktop) === */}
      <div className="fixed bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/50 to-transparent pointer-events-none z-40 hidden md:flex items-end justify-between px-4 md:px-8 lg:px-16 pb-2">
        <div className="flex items-center gap-4 text-[9px] font-mono text-gray-600">
          <span>SYS <span className="text-green-500">●</span></span>
          <span>NET <span className="text-green-500">●</span></span>
          <span>SEC <span className="text-green-500">●</span></span>
        </div>
        <div className="text-[9px] font-mono text-gray-600">
          NoMercy v0.1.0 • EU-WEST
        </div>
        <div className="flex items-center gap-4 text-[9px] font-mono text-gray-600">
          <span>FPS 60</span>
          <span>PING 24ms</span>
        </div>
      </div>
    </div>
  )
}

export default App
