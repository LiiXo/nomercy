import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const LOADING_STEPS = [
  { id: 1, text: 'INIT_CORE_SYSTEMS', duration: 300 },
  { id: 2, text: 'LOAD_NETWORK_MODULES', duration: 350 },
  { id: 3, text: 'CONNECT_GAME_SERVERS', duration: 450 },
  { id: 4, text: 'AUTH_USER_SESSION', duration: 350 },
  { id: 5, text: 'SYNC_PLAYER_DATA', duration: 300 },
  { id: 6, text: 'INIT_ANTICHEAT_IRIS', duration: 400 },
  { id: 7, text: 'LOAD_UI_ASSETS', duration: 250 },
  { id: 8, text: 'READY', duration: 200 },
]

const Preloader = ({ onComplete }) => {
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [showContent, setShowContent] = useState(false)
  const audioRef = useRef(null)

  // Preloader sound - try to play, will work if user interacted with site before
  useEffect(() => {
    const audio = new Audio('/sound3.mp3')
    audio.volume = 0.15
    audio.loop = true
    audioRef.current = audio
    
    // Try to play - may fail due to browser autoplay policy
    audio.play().catch(() => {})
    
    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [])

  // Fade out sound when preloader completes
  useEffect(() => {
    if (isComplete && audioRef.current) {
      const audio = audioRef.current
      const fadeInterval = setInterval(() => {
        if (audio.volume > 0.01) {
          audio.volume = Math.max(0, audio.volume - 0.015)
        } else {
          audio.pause()
          audio.volume = 0
          clearInterval(fadeInterval)
        }
      }, 50)
      
      return () => clearInterval(fadeInterval)
    }
  }, [isComplete])

  useEffect(() => {
    // Initial delay before showing content
    const showTimer = setTimeout(() => setShowContent(true), 200)
    
    let stepIndex = 0
    let currentProgress = 0
    
    const runStep = () => {
      if (stepIndex >= LOADING_STEPS.length) {
        setIsComplete(true)
        setTimeout(() => {
          onComplete?.()
        }, 800)
        return
      }

      const step = LOADING_STEPS[stepIndex]
      setCurrentStep(stepIndex)
      
      const targetProgress = ((stepIndex + 1) / LOADING_STEPS.length) * 100
      const progressIncrement = (targetProgress - currentProgress) / (step.duration / 16)
      
      const progressInterval = setInterval(() => {
        currentProgress += progressIncrement
        if (currentProgress >= targetProgress) {
          currentProgress = targetProgress
          clearInterval(progressInterval)
          stepIndex++
          setTimeout(runStep, 80)
        }
        setProgress(currentProgress)
      }, 16)
    }

    const startDelay = setTimeout(runStep, 500)
    
    return () => {
      clearTimeout(startDelay)
      clearTimeout(showTimer)
    }
  }, [onComplete])

  return (
    <motion.div 
      className="fixed inset-0 z-50 bg-[#050506] overflow-hidden"
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Animated background gradient */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0c] via-[#050506] to-[#0a0a0c]" />
        <motion.div 
          className="absolute inset-0 bg-gradient-to-tr from-accent-primary/10 via-transparent to-transparent"
          animate={{ opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        <motion.div 
          className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-accent-primary/5 rounded-full blur-[150px]"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
      </div>

      {/* Scanlines */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
        }}
      />

      {/* Noise texture */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* TOP LEFT - System Info HUD */}
      <motion.div 
        className="absolute top-6 left-6 md:top-10 md:left-10"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: showContent ? 1 : 0, x: showContent ? 0 : -20 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-2 h-2 bg-accent-primary rounded-full animate-pulse" />
          <span className="text-[10px] text-accent-primary font-mono tracking-wider">SYSTEM ACTIVE</span>
        </div>
        <div className="space-y-1 text-[10px] font-mono text-gray-600">
          <div>BUILD <span className="text-gray-400">v0.1.0-alpha</span></div>
          <div>REGION <span className="text-gray-400">EU-WEST-1</span></div>
        </div>
      </motion.div>

      {/* TOP RIGHT - Connection Status */}
      <motion.div 
        className="absolute top-6 right-6 md:top-10 md:right-10 text-right"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: showContent ? 1 : 0, x: showContent ? 0 : 20 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="flex items-center justify-end gap-3 mb-3">
          <span className="text-[10px] text-green-500 font-mono tracking-wider">SECURE CONNECTION</span>
          <div className="w-2 h-2 bg-green-500 rounded-full" />
        </div>
        <div className="space-y-1 text-[10px] font-mono text-gray-600">
          <div><span className="text-gray-400">PING</span> 24ms</div>
          <div><span className="text-gray-400">PROTOCOL</span> WSS</div>
        </div>
      </motion.div>

      {/* CENTER - Main Logo & Title */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          {/* Logo with glow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: showContent ? 1 : 0, scale: showContent ? 1 : 0.8 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative mb-6"
          >
            {/* Glow behind logo */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-40 h-40 bg-accent-primary/20 rounded-full blur-[60px]" />
            </div>
            <img 
              src="/logo.png" 
              alt="NoMercy" 
              className="relative h-28 md:h-36 mx-auto"
            />
          </motion.div>

          {/* Subtitle with line accents */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 10 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex items-center justify-center gap-4"
          >
            <div className="w-12 h-[1px] bg-gradient-to-r from-transparent to-accent-primary/50" />
            <span className="text-[11px] text-gray-500 tracking-[0.4em] uppercase font-light">
              Competitive Platform
            </span>
            <div className="w-12 h-[1px] bg-gradient-to-l from-transparent to-accent-primary/50" />
          </motion.div>
        </div>
      </div>

      {/* BOTTOM - Loading Section (Full Width) */}
      <motion.div 
        className="absolute bottom-0 left-0 right-0 p-6 md:p-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 20 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        {/* Current operation display */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.div 
              className="w-1.5 h-1.5 bg-accent-primary"
              animate={{ opacity: isComplete ? 1 : [1, 0.3, 1] }}
              transition={{ duration: 0.5, repeat: isComplete ? 0 : Infinity }}
            />
            <span className="text-xs font-mono text-gray-400 tracking-wider">
              {isComplete ? '[ SYSTEM READY ]' : `[ ${LOADING_STEPS[currentStep]?.text || 'INITIALIZING'} ]`}
            </span>
          </div>
          <span className="text-xs font-mono text-accent-primary font-bold tracking-wider">
            {Math.round(progress)}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="relative h-1 bg-white/5 overflow-hidden">
          {/* Animated stripes in background */}
          <motion.div 
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(255,107,53,0.3) 4px, rgba(255,107,53,0.3) 8px)',
            }}
            animate={{ x: [0, 8] }}
            transition={{ duration: 0.3, repeat: Infinity, ease: "linear" }}
          />
          
          {/* Progress fill */}
          <motion.div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent-primary to-fire-500"
            style={{ width: `${progress}%` }}
          />
          
          {/* Glow on progress edge */}
          <motion.div 
            className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-accent-primary/50 to-transparent blur-sm"
            style={{ left: `calc(${progress}% - 40px)` }}
          />
        </div>

        {/* Bottom stats row */}
        <div className="flex items-center justify-between mt-4 text-[9px] font-mono text-gray-600">
          <div className="flex items-center gap-6">
            <span>MEM <span className="text-gray-500">128MB</span></span>
            <span>CPU <span className="text-gray-500">2.4%</span></span>
          </div>
          <div className="flex items-center gap-2">
            {LOADING_STEPS.map((step, i) => (
              <motion.div
                key={step.id}
                className={`w-1 h-1 rounded-full ${
                  i < currentStep ? 'bg-accent-primary' : 
                  i === currentStep ? 'bg-accent-primary animate-pulse' : 'bg-gray-700'
                }`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.8 + i * 0.05 }}
              />
            ))}
          </div>
          <div className="flex items-center gap-6">
            <span>NET <span className="text-green-500">●</span></span>
            <span>SEC <span className="text-green-500">●</span></span>
          </div>
        </div>
      </motion.div>

      {/* Corner Brackets */}
      <svg className="absolute top-4 left-4 w-8 h-8 text-accent-primary/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M4 4 L4 10 M4 4 L10 4" />
      </svg>
      <svg className="absolute top-4 right-4 w-8 h-8 text-accent-primary/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M20 4 L20 10 M20 4 L14 4" />
      </svg>
      <svg className="absolute bottom-20 left-4 w-8 h-8 text-accent-primary/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M4 20 L4 14 M4 20 L10 20" />
      </svg>
      <svg className="absolute bottom-20 right-4 w-8 h-8 text-accent-primary/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M20 20 L20 14 M20 20 L14 20" />
      </svg>

      {/* Decorative lines */}
      <motion.div 
        className="absolute top-1/2 left-0 w-16 md:w-32 h-[1px] bg-gradient-to-r from-accent-primary/20 to-transparent"
        initial={{ scaleX: 0, originX: 0 }}
        animate={{ scaleX: showContent ? 1 : 0 }}
        transition={{ duration: 0.8, delay: 0.7 }}
      />
      <motion.div 
        className="absolute top-1/2 right-0 w-16 md:w-32 h-[1px] bg-gradient-to-l from-accent-primary/20 to-transparent"
        initial={{ scaleX: 0, originX: 1 }}
        animate={{ scaleX: showContent ? 1 : 0 }}
        transition={{ duration: 0.8, delay: 0.7 }}
      />
    </motion.div>
  )
}

export default Preloader
