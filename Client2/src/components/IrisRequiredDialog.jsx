import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '../contexts/LanguageContext'
import { useSound } from '../contexts/SoundContext'

const IrisRequiredDialog = ({ isOpen, onClose }) => {
  const { t } = useLanguage()
  const { playClick, playHover } = useSound()

  if (!isOpen) return null

  const handleClose = () => {
    playClick()
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200]"
          />

          {/* Dialog */}
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="cod-player-card p-6 max-w-md w-full relative overflow-hidden"
            >
              {/* Top accent line */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
              
              {/* Scanline effect */}
              <div className="absolute inset-0 cod-scanlines opacity-30 pointer-events-none" />

              <div className="relative">
                {/* Icon */}
                <div className="text-center mb-4">
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500/30 to-purple-600/20 border border-purple-500/40 mb-3 cod-corner-cut"
                  >
                    <span className="text-3xl">🛡️</span>
                  </motion.div>
                  <h2 className="text-xl font-display text-white uppercase tracking-wide">{t('irisRequired')}</h2>
                  <p className="text-gray-400 text-sm mt-1 font-military">{t('irisRequiredDesc')}</p>
                </div>

                {/* Instructions */}
                <div className="space-y-3 mb-5">
                  <div className="bg-white/5 p-3 flex items-start gap-3 cod-corner-cut border-l-2 border-purple-500/50">
                    <div className="w-7 h-7 bg-accent-primary/20 flex items-center justify-center flex-shrink-0 cod-corner-cut">
                      <span className="text-accent-primary font-display text-sm">1</span>
                    </div>
                    <div>
                      <p className="text-white text-sm font-military">{t('irisStep1Title')}</p>
                      <p className="text-gray-400 text-xs font-military">{t('irisStep1Desc')}</p>
                    </div>
                  </div>

                  <div className="bg-white/5 p-3 flex items-start gap-3 cod-corner-cut border-l-2 border-purple-500/50">
                    <div className="w-7 h-7 bg-accent-primary/20 flex items-center justify-center flex-shrink-0 cod-corner-cut">
                      <span className="text-accent-primary font-display text-sm">2</span>
                    </div>
                    <div>
                      <p className="text-white text-sm font-military">{t('irisStep2Title')}</p>
                      <p className="text-gray-400 text-xs font-military">{t('irisStep2Desc')}</p>
                    </div>
                  </div>

                  <div className="bg-white/5 p-3 flex items-start gap-3 cod-corner-cut border-l-2 border-purple-500/50">
                    <div className="w-7 h-7 bg-accent-primary/20 flex items-center justify-center flex-shrink-0 cod-corner-cut">
                      <span className="text-accent-primary font-display text-sm">3</span>
                    </div>
                    <div>
                      <p className="text-white text-sm font-military">{t('irisStep3Title')}</p>
                      <p className="text-gray-400 text-xs font-military">{t('irisStep3Desc')}</p>
                    </div>
                  </div>
                </div>

                {/* Info box */}
                <div className="bg-purple-500/10 p-3 mb-5 border border-purple-500/20 cod-corner-cut">
                  <div className="flex items-start gap-2">
                    <span className="text-purple-400">ℹ️</span>
                    <p className="text-gray-400 text-xs font-military">{t('irisInfoText')}</p>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleClose}
                    onMouseEnter={playHover}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white font-military uppercase tracking-wider transition-colors border border-white/10 text-sm cod-corner-cut"
                  >
                    {t('close')}
                  </motion.button>
                  <motion.a
                    href="/anticheat"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onMouseEnter={playHover}
                    className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white font-military uppercase tracking-wider transition-colors text-sm text-center cod-corner-cut"
                  >
                    {t('downloadIris')}
                  </motion.a>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

export default IrisRequiredDialog
