import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '../contexts/LanguageContext'
import { useSound } from '../contexts/SoundContext'
import { useSocket } from '../contexts/SocketContext'
import { useAuth } from '../contexts/AuthContext'
import MatchFoundDialog from './MatchFoundDialog'

const MatchSearchDialog = ({ isOpen, onClose, modeId, mode, modeIcon, type, teamSize }) => {
  const { t } = useLanguage()
  const { playClick } = useSound()
  const { emit, on, isConnected } = useSocket()
  const { user } = useAuth()
  
  const [searchTime, setSearchTime] = useState(0)
  const [playersInQueue, setPlayersInQueue] = useState(1) // At least 1 (yourself)
  const [status, setStatus] = useState('connecting') // connecting, searching, found, joining
  const [error, setError] = useState(null)
  const [matchData, setMatchData] = useState(null)
  const [showMatchFound, setShowMatchFound] = useState(false)
  
  // Store cleanup functions
  const cleanupRef = useRef([])

  // Total players needed for match (2 teams)
  const playersNeeded = (teamSize || 1) * 2

  // Leave queue when dialog closes
  const handleClose = useCallback(() => {
    if (status === 'searching') {
      emit('leaveCasualQueue')
    }
    onClose()
  }, [status, emit, onClose])

  // Join queue when dialog opens and socket is connected
  useEffect(() => {
    if (!isOpen || !user?.discordId || !modeId) return

    setSearchTime(0)
    setPlayersInQueue(1) // Start with 1 (yourself)
    setStatus('connecting')
    setError(null)
    setMatchData(null)

    // Wait for socket to be connected, then join
    if (isConnected) {
      const joinTimeout = setTimeout(() => {
        console.log('[MM] Joining queue:', { odId: user.discordId, modeId, type })
        emit('joinCasualQueue', { odId: user.discordId, modeId, type })
      }, 300)
      
      return () => clearTimeout(joinTimeout)
    }
  }, [isOpen, user?.discordId, modeId, type, emit, isConnected])

  // Retry joining if socket connects after dialog opens
  useEffect(() => {
    if (!isOpen || !user?.discordId || !modeId || status !== 'connecting') return
    
    if (isConnected) {
      console.log('[MM] Socket connected, joining queue:', { odId: user.discordId, modeId, type })
      emit('joinCasualQueue', { odId: user.discordId, modeId, type })
    }
  }, [isConnected, isOpen, user?.discordId, modeId, type, status, emit])

  // Search timer
  useEffect(() => {
    if (!isOpen || status !== 'searching') return

    const timer = setInterval(() => {
      setSearchTime(prev => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [isOpen, status])

  // Socket event listeners
  useEffect(() => {
    if (!isOpen) return

    // Queue joined successfully
    const handleQueueJoined = (data) => {
      console.log('[MM] Queue joined:', data)
      setStatus('searching')
      setPlayersInQueue(data.playersInQueue || 1)
    }

    // Queue status update
    const handleQueueStatus = (data) => {
      console.log('[MM] Queue status:', data)
      setPlayersInQueue(Math.max(data.playersInQueue || 0, 1)) // At least 1 (yourself)
    }

    // Match found
    const handleMatchFound = (data) => {
      console.log('[MM] Match found:', data)
      setStatus('found')
      setMatchData(data)
      setShowMatchFound(true)
    }

    // Queue error
    const handleQueueError = (data) => {
      console.error('[MM] Queue error:', data)
      setError(data.message || t('errorJoiningQueue'))
      setStatus('error')
    }

    // Queue left (by leader or disconnection)
    const handleQueueLeft = (data) => {
      console.log('[MM] Queue left:', data)
      if (data.reason === 'leader_cancelled') {
        setError(t('leaderCancelledSearch'))
      }
      handleClose()
    }

    // Subscribe to events and store cleanup functions
    const cleanups = [
      on('casualQueueJoined', handleQueueJoined),
      on('casualQueueStatus', handleQueueStatus),
      on('casualMatchFound', handleMatchFound),
      on('casualQueueError', handleQueueError),
      on('casualQueueLeft', handleQueueLeft)
    ]
    cleanupRef.current = cleanups

    return () => {
      // Clean up all listeners
      cleanups.forEach(cleanup => cleanup && cleanup())
      cleanupRef.current = []
    }
  }, [isOpen, on, t, handleClose])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleCancel = () => {
    playClick()
    handleClose()
  }

  if (!isOpen && !showMatchFound) return null

  return (
    <>
    <AnimatePresence>
      {isOpen && !showMatchFound && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50"
          />

          {/* Dialog */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25 }}
              className="hud-panel max-w-md w-full relative overflow-hidden"
            >
              {/* Top accent */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent-primary to-transparent" />
              
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-accent-primary" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-accent-primary" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-accent-primary/50" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-accent-primary/50" />

              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center bg-accent-primary/10 border border-accent-primary/30">
                      <span className="text-xl">{modeIcon}</span>
                    </div>
                    <div>
                      <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wide">{mode}</h2>
                      <span className="text-[10px] font-mono text-gray-500 uppercase">
                        {type === 'hardcore' ? 'Hardcore' : 'Simple'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-mono font-bold text-accent-primary">{formatTime(searchTime)}</div>
                    <span className="text-[10px] font-mono text-gray-500 uppercase">{t('elapsed')}</span>
                  </div>
                </div>

                {/* Search visualization */}
                <div className="relative mb-6">
                  <div className="flex items-center justify-center">
                    <div className="relative w-32 h-32">
                      {/* Scanning rings */}
                      {(status === 'searching' || status === 'connecting') && (
                        <>
                          <motion.div
                            animate={{ scale: [1, 2], opacity: [0.3, 0] }}
                            transition={{ repeat: Infinity, duration: 2, ease: 'easeOut' }}
                            className="absolute inset-0 border border-accent-primary"
                          />
                          <motion.div
                            animate={{ scale: [1, 2], opacity: [0.3, 0] }}
                            transition={{ repeat: Infinity, duration: 2, ease: 'easeOut', delay: 0.7 }}
                            className="absolute inset-0 border border-accent-primary"
                          />
                        </>
                      )}
                      
                      {/* Center display */}
                      <div className={`absolute inset-4 bg-black/50 border ${
                        status === 'found' ? 'border-green-500' : 
                        status === 'joining' ? 'border-blue-500' : 
                        status === 'error' ? 'border-red-500' :
                        'border-accent-primary/50'
                      } flex flex-col items-center justify-center`}>
                        {(status === 'searching' || status === 'connecting') && (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                              className="w-8 h-8 border-2 border-accent-primary/20 border-t-accent-primary"
                            />
                            <span className="text-[10px] font-mono text-accent-primary mt-2 uppercase">
                              {status === 'connecting' ? t('connecting') : t('scanning')}
                            </span>
                          </>
                        )}
                        {status === 'found' && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center">
                            <span className="text-3xl text-green-500">✓</span>
                            <span className="block text-[10px] font-mono text-green-400 mt-1 uppercase">{t('matchFound')}</span>
                          </motion.div>
                        )}
                        {status === 'joining' && (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                              className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500"
                            />
                            <span className="text-[10px] font-mono text-blue-400 mt-2 uppercase">{t('joining')}</span>
                          </>
                        )}
                        {status === 'error' && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center">
                            <span className="text-3xl text-red-500">✕</span>
                            <span className="block text-[10px] font-mono text-red-400 mt-1 uppercase">{t('error')}</span>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status text */}
                <div className="text-center mb-6">
                  <motion.p
                    key={status}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`text-xs font-mono uppercase tracking-wider ${
                      status === 'found' ? 'text-green-400' : 
                      status === 'joining' ? 'text-blue-400' : 
                      status === 'error' ? 'text-red-400' :
                      'text-gray-400'
                    }`}
                  >
                    {status === 'connecting' && t('connectingToServer')}
                    {status === 'searching' && t('searchingMatch')}
                    {status === 'found' && t('matchFound')}
                    {status === 'joining' && t('joiningMatch')}
                    {status === 'error' && (error || t('errorOccurred'))}
                  </motion.p>
                </div>

                {/* Player slots */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-gray-500 uppercase">{t('playersInQueue')}</span>
                    <span className="text-xs font-mono">
                      <span className={playersInQueue >= playersNeeded ? 'text-green-400' : 'text-accent-primary'}>
                        {playersInQueue}
                      </span>
                      <span className="text-gray-600">/{playersNeeded}</span>
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {[...Array(playersNeeded)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className={`flex-1 h-2 ${
                          i < playersInQueue ? 'bg-accent-primary' : 'bg-white/10'
                        } transition-colors`}
                      />
                    ))}
                  </div>
                </div>

                {/* Match teams preview (when match found) */}
                {matchData && status !== 'error' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-3 bg-white/5 border border-white/10"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] font-mono text-blue-400 uppercase mb-2 block">{t('team')} 1</span>
                        {matchData.team1.map(p => (
                          <div key={p.odId} className="text-xs text-gray-300">{p.username}</div>
                        ))}
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-red-400 uppercase mb-2 block">{t('team')} 2</span>
                        {matchData.team2.map(p => (
                          <div key={p.odId} className="text-xs text-gray-300">{p.username}</div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Cancel/Close button */}
                {status !== 'joining' ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCancel}
                    className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white font-mono text-xs uppercase tracking-wider border border-white/10 hover:border-accent-primary/30 transition-all"
                  >
                    [ {status === 'error' ? t('close') : t('cancelSearch')} ]
                  </motion.button>
                ) : (
                  <p className="text-center text-[10px] font-mono text-gray-500 uppercase">
                    {t('doNotClose')}
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>

    {/* Big Match Found Dialog */}
    <MatchFoundDialog
      isOpen={showMatchFound}
      matchData={matchData}
      mode={mode}
      modeIcon={modeIcon}
      type={type}
      onCountdownEnd={() => {
        console.log('[MM] Countdown ended, match starting...')
        // Mark match as in progress
        setMatchData(prev => prev ? { ...prev, inProgress: true } : prev)
      }}
      onClose={() => {
        // Just hide the dialog, don't end the match
        setShowMatchFound(false)
      }}
    />

    {/* Floating button to reopen match dialog when minimized */}
    <AnimatePresence>
      {matchData?.inProgress && !showMatchFound && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowMatchFound(true)}
          className="fixed bottom-24 right-6 z-50 w-16 h-16 bg-accent-primary hover:bg-accent-primary/90 rounded-full flex items-center justify-center shadow-lg shadow-accent-primary/30 border-2 border-accent-primary/50"
        >
          <motion.span 
            className="text-2xl"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            ⚔️
          </motion.span>
        </motion.button>
      )}
    </AnimatePresence>
  </>
  )
}

export default MatchSearchDialog
