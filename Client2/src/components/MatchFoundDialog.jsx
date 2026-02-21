import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '../contexts/LanguageContext'

const MatchFoundDialog = ({ isOpen, matchData, mode, modeIcon, type, onCountdownEnd, onClose }) => {
  const { t } = useLanguage()
  const [countdown, setCountdown] = useState(10)
  const [showTeams, setShowTeams] = useState(false)
  const [phase, setPhase] = useState('countdown') // 'countdown' or 'inProgress'

  useEffect(() => {
    if (!isOpen) {
      setCountdown(10)
      setShowTeams(false)
      setPhase('countdown')
      return
    }

    // If reopening with existing match, go directly to inProgress
    if (matchData?.inProgress) {
      setPhase('inProgress')
      setShowTeams(true)
      return
    }

    // Show teams after a short delay
    const showTimer = setTimeout(() => setShowTeams(true), 500)

    // Calculate countdown from server timestamp for sync
    const updateCountdown = () => {
      if (matchData?.countdownEndTime) {
        const remaining = Math.max(0, Math.ceil((matchData.countdownEndTime - Date.now()) / 1000))
        setCountdown(remaining)
        
        if (remaining <= 0) {
          setPhase('inProgress')
          onCountdownEnd?.()
          return true // Stop the interval
        }
      }
      return false
    }

    // Initial update
    if (updateCountdown()) {
      return () => clearTimeout(showTimer)
    }

    // Update every 100ms for smoother sync
    const interval = setInterval(() => {
      if (updateCountdown()) {
        clearInterval(interval)
      }
    }, 100)

    return () => {
      clearTimeout(showTimer)
      clearInterval(interval)
    }
  }, [isOpen, matchData?.inProgress, matchData?.countdownEndTime, onCountdownEnd])

  if (!isOpen || !matchData) return null

  const { team1 = [], team2 = [] } = matchData

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden"
        >
          {/* Animated background */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/5 via-black to-red-500/5" />
            <motion.div
              animate={{ 
                backgroundPosition: ['0% 0%', '100% 100%'],
              }}
              transition={{ duration: 20, repeat: Infinity, repeatType: 'reverse' }}
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: 'radial-gradient(circle at center, rgba(255,107,0,0.1) 0%, transparent 50%)',
                backgroundSize: '100% 100%'
              }}
            />
          </div>

          {/* Corner accents */}
          <div className="absolute top-4 left-4 w-20 h-20 border-t-2 border-l-2 border-accent-primary" />
          <div className="absolute top-4 right-4 w-20 h-20 border-t-2 border-r-2 border-accent-primary" />
          <div className="absolute bottom-4 left-4 w-20 h-20 border-b-2 border-l-2 border-accent-primary/50" />
          <div className="absolute bottom-4 right-4 w-20 h-20 border-b-2 border-r-2 border-accent-primary/50" />

          {/* Main content */}
          <div className="relative z-10 w-full max-w-6xl px-8">
            {/* Title */}
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="text-center mb-12"
            >
              <motion.h1 
                className="text-5xl md:text-7xl font-black text-white tracking-wider"
                animate={{ 
                  textShadow: [
                    '0 0 20px rgba(255,107,0,0.5)',
                    '0 0 40px rgba(255,107,0,0.8)',
                    '0 0 20px rgba(255,107,0,0.5)'
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {phase === 'countdown' ? t('matchFound').toUpperCase() : t('matchInProgress').toUpperCase()}
              </motion.h1>
              <div className="flex items-center justify-center gap-3 mt-4">
                <span className="text-2xl">{modeIcon}</span>
                <span className="text-xl font-mono text-gray-400 uppercase tracking-wider">{mode}</span>
                <span className="text-sm font-mono text-accent-primary/70 uppercase px-2 py-0.5 border border-accent-primary/30">
                  {type === 'hardcore' ? 'Hardcore' : 'Simple'}
                </span>
              </div>
            </motion.div>

            {/* Teams Display */}
            <div className="grid grid-cols-3 gap-8 items-center">
              {/* Team 1 */}
              <motion.div
                initial={{ x: -100, opacity: 0 }}
                animate={showTeams ? { x: 0, opacity: 1 } : {}}
                transition={{ delay: 0.3, type: 'spring' }}
                className="space-y-4"
              >
                <div className="text-center mb-6">
                  <span className="text-lg font-mono font-bold text-blue-400 uppercase tracking-wider">
                    {t('team')} 1
                  </span>
                  <div className="h-1 w-24 mx-auto mt-2 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
                </div>
                
                {team1.map((player, index) => (
                  <motion.div
                    key={player.odId || index}
                    initial={{ x: -50, opacity: 0 }}
                    animate={showTeams ? { x: 0, opacity: 1 } : {}}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    className="bg-blue-500/10 border border-blue-500/30 p-4 flex items-center gap-4"
                  >
                    <div className="w-12 h-12 bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
                      <span className="text-xl font-bold text-blue-400">{player.username?.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-mono font-bold text-white text-lg">{player.username}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* Center - VS or Soon */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={showTeams ? { scale: 1, rotate: 0 } : {}}
                transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
                className="flex flex-col items-center justify-center"
              >
                {phase === 'countdown' ? (
                  <>
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="relative"
                    >
                      <span className="text-7xl md:text-9xl font-black text-white" style={{
                        textShadow: '0 0 30px rgba(255,107,0,0.5), 0 0 60px rgba(255,107,0,0.3)'
                      }}>
                        VS
                      </span>
                    </motion.div>
                    
                    {/* Countdown */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1 }}
                      className="mt-8 text-center"
                    >
                      <p className="text-sm font-mono text-gray-500 uppercase mb-2">{t('startingIn')}</p>
                      <motion.span
                        key={countdown}
                        initial={{ scale: 1.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-5xl font-mono font-bold text-accent-primary"
                      >
                        {countdown}
                      </motion.span>
                    </motion.div>
                  </>
                ) : (
                  /* In Progress - Soon placeholder */
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center"
                  >
                    <div className="relative">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                        className="w-32 h-32 border-4 border-accent-primary/20 border-t-accent-primary rounded-full"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl">⚔️</span>
                      </div>
                    </div>
                    
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="mt-8 text-center"
                    >
                      <span className="text-4xl font-black text-accent-primary uppercase tracking-widest">
                        Soon
                      </span>
                      <p className="text-sm font-mono text-gray-500 mt-4 uppercase">
                        {t('matchFunctionalityComingSoon')}
                      </p>
                    </motion.div>
                  </motion.div>
                )}
              </motion.div>

              {/* Team 2 */}
              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={showTeams ? { x: 0, opacity: 1 } : {}}
                transition={{ delay: 0.3, type: 'spring' }}
                className="space-y-4"
              >
                <div className="text-center mb-6">
                  <span className="text-lg font-mono font-bold text-red-400 uppercase tracking-wider">
                    {t('team')} 2
                  </span>
                  <div className="h-1 w-24 mx-auto mt-2 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
                </div>
                
                {team2.map((player, index) => (
                  <motion.div
                    key={player.odId || index}
                    initial={{ x: 50, opacity: 0 }}
                    animate={showTeams ? { x: 0, opacity: 1 } : {}}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    className="bg-red-500/10 border border-red-500/30 p-4 flex items-center gap-4"
                  >
                    <div className="w-12 h-12 bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                      <span className="text-xl font-bold text-red-400">{player.username?.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-mono font-bold text-white text-lg">{player.username}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Bottom info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="mt-12 text-center"
            >
              {phase === 'countdown' && (
                <p className="text-sm font-mono text-gray-600 uppercase tracking-wider">
                  {t('doNotClose')}
                </p>
              )}
            </motion.div>
          </div>

          {/* Scan lines effect */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.02]"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)'
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default MatchFoundDialog
