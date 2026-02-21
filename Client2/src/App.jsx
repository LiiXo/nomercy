import { useState, useEffect, useRef } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Navbar from './components/Navbar'
import MobileHeader from './components/MobileHeader'
import MobileNav from './components/MobileNav'
import LoginDialog from './components/LoginDialog'
import Preloader from './components/Preloader'
import FloatingParticles from './components/FloatingParticles'
import Lobby from './pages/Lobby'
import Tournaments from './pages/Tournaments'
import Profile from './pages/Profile'
import PlayerProfile from './pages/PlayerProfile'
import Admin from './pages/Admin'
import { useAuth } from './contexts/AuthContext'

// Page transition variants - Video game style horizontal slide
const pageVariants = {
  initial: {
    opacity: 0,
    x: 60,
    scale: 0.98,
  },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94], // Custom easing for smooth game feel
    }
  },
  exit: {
    opacity: 0,
    x: -60,
    scale: 0.98,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94],
    }
  }
}

const PageWrapper = ({ children }) => {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="will-change-transform"
    >
      {children}
    </motion.div>
  )
}

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
      {/* === GAME UI BACKGROUND LAYERS === */}
      
      {/* Base gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#0a0a0c] via-[#050506] to-[#0a0a0c] pointer-events-none" />
      
      {/* Floating particles */}
      <FloatingParticles count={40} color="#ff6b35" />
      
      {/* Ambient glow */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[400px] bg-accent-primary/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[400px] h-[300px] bg-accent-primary/3 rounded-full blur-[120px] pointer-events-none" />
      
      {/* Scanlines overlay */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.03] z-[100]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
        }}
      />
      
      {/* Noise texture */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.012] z-[100]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

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
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={
              <PageWrapper>
                <Lobby />
              </PageWrapper>
            } />
            <Route path="/tournaments" element={
              <PageWrapper>
                <Tournaments />
              </PageWrapper>
            } />
            <Route path="/profile" element={
              <PageWrapper>
                <Profile />
              </PageWrapper>
            } />
            <Route path="/admin" element={
              <PageWrapper>
                <Admin />
              </PageWrapper>
            } />
            <Route path="/player/:username" element={
              <PageWrapper>
                <PlayerProfile />
              </PageWrapper>
            } />
          </Routes>
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
