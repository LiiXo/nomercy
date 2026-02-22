import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '../contexts/LanguageContext'
import { useSound } from '../contexts/SoundContext'

const RulesDialog = ({ isOpen, onClose, modeId, adminConfig }) => {
  const { t, language } = useLanguage()
  const { playClick, playHover } = useSound()

  // Default rules content for each mode
  const defaultRulesContent = {
    ranked: {
      title: t('ranked'),
      rules: [
        t('rankedRule1'),
        t('rankedRule2'),
        t('rankedRule3'),
        t('rankedRule4'),
      ]
    },
    casual: {
      title: t('casual'),
      rules: [
        t('casualRule1'),
        t('casualRule2'),
        t('casualRule3'),
      ]
    },
    tournament: {
      title: t('tournament'),
      rules: [
        t('tournamentRule1'),
        t('tournamentRule2'),
        t('tournamentRule3'),
        t('tournamentRule4'),
      ]
    },
    custom: {
      title: t('custom'),
      rules: [
        t('customRule1'),
        t('customRule2'),
        t('customRule3'),
      ]
    }
  }

  // Get rules: use admin config if available, otherwise use defaults
  const getModeTitles = (mode) => {
    if (mode?.name) {
      return mode.name[language] || mode.name.en || mode.name.fr || modeId
    }
    const titles = {
      ranked: t('ranked'),
      casual: t('casual'),
      tournament: t('tournament'),
      custom: t('custom')
    }
    return titles[modeId] || modeId
  }

  const getCurrentRules = () => {
    if (adminConfig && modeId) {
      const modeConfig = adminConfig.find(c => c.id === modeId)
      if (modeConfig) {
        if (modeConfig.rules && typeof modeConfig.rules === 'object' && !Array.isArray(modeConfig.rules)) {
          const rulesText = modeConfig.rules[language] || modeConfig.rules.fr || modeConfig.rules.en || ''
          const rulesArray = rulesText.split('\n').filter(r => r.trim())
          if (rulesArray.length > 0) {
            return {
              title: getModeTitles(modeConfig),
              rules: rulesArray
            }
          }
        }
        if (Array.isArray(modeConfig.rules) && modeConfig.rules.length > 0) {
          return {
            title: getModeTitles(modeConfig),
            rules: modeConfig.rules.map(r => r[language] || r.fr || r.en || '')
          }
        }
      }
    }
    return defaultRulesContent[modeId] || { title: '', rules: [] }
  }

  const currentRules = getCurrentRules()

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
              transition={{ type: "spring", duration: 0.4 }}
              className="w-full max-w-4xl mx-4"
            >
              <div className="cod-player-card relative min-h-[50vh] max-h-[85vh] overflow-hidden">
                {/* Top accent line */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent-primary to-transparent" />
                
                {/* Scanline effect */}
                <div className="absolute inset-0 cod-scanlines opacity-30 pointer-events-none" />

                <div className="p-8 overflow-y-auto max-h-[85vh] relative">
                  {/* Close button */}
                  <button
                    onClick={handleClose}
                    onMouseEnter={playHover}
                    className="absolute top-4 right-4 text-gray-500 hover:text-accent-primary transition-colors"
                  >
                    <span className="text-xs font-military uppercase tracking-wider">[ ESC ]</span>
                  </button>

                  {/* Header */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1.5 h-1.5 bg-accent-primary" />
                      <span className="text-[10px] font-military text-gray-500 uppercase tracking-wider">Game Rules</span>
                    </div>
                    <h2 className="text-3xl font-display text-white uppercase tracking-wide">{currentRules.title}</h2>
                  </div>

                  {/* Rules list */}
                  <div className="space-y-2 mb-8">
                    {currentRules.rules.map((rule, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-start gap-3 p-3 bg-white/5 border-l-2 border-accent-primary/30 cod-corner-cut"
                      >
                        <span className="flex-shrink-0 text-[10px] font-military text-accent-primary">
                          [{String(index + 1).padStart(2, '0')}]
                        </span>
                        <p className="text-sm text-gray-300 font-military">{rule}</p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Close button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleClose}
                    onMouseEnter={playHover}
                    className="w-full py-3 bg-white/5 hover:bg-accent-primary/20 text-white font-military text-sm uppercase tracking-wider border border-white/10 hover:border-accent-primary/30 transition-all cod-corner-cut"
                  >
                    [ {t('understood')} ]
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

export default RulesDialog
