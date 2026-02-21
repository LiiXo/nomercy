import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '../contexts/LanguageContext'

const IrisRequiredDialog = ({ isOpen, onClose }) => {
  const { t } = useLanguage()

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />

          {/* Dialog */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25 }}
              className="glass-orange rounded-2xl p-6 max-w-md w-full border border-accent-primary/30 shadow-2xl shadow-accent-primary/20"
            >
              {/* Icon */}
              <div className="text-center mb-4">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500/30 to-purple-600/20 border border-purple-500/40 mb-3"
                >
                  <span className="text-3xl">🛡️</span>
                </motion.div>
                <h2 className="text-xl font-bold text-white">{t('irisRequired')}</h2>
                <p className="text-gray-400 text-sm mt-1">{t('irisRequiredDesc')}</p>
              </div>

              {/* Instructions */}
              <div className="space-y-3 mb-5">
                <div className="glass-dark rounded-xl p-3 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-accent-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-accent-primary font-bold text-sm">1</span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{t('irisStep1Title')}</p>
                    <p className="text-gray-400 text-xs">{t('irisStep1Desc')}</p>
                  </div>
                </div>

                <div className="glass-dark rounded-xl p-3 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-accent-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-accent-primary font-bold text-sm">2</span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{t('irisStep2Title')}</p>
                    <p className="text-gray-400 text-xs">{t('irisStep2Desc')}</p>
                  </div>
                </div>

                <div className="glass-dark rounded-xl p-3 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-accent-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-accent-primary font-bold text-sm">3</span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{t('irisStep3Title')}</p>
                    <p className="text-gray-400 text-xs">{t('irisStep3Desc')}</p>
                  </div>
                </div>
              </div>

              {/* Info box */}
              <div className="glass-dark rounded-xl p-3 mb-5 border border-purple-500/20">
                <div className="flex items-start gap-2">
                  <span className="text-purple-400">ℹ️</span>
                  <p className="text-gray-400 text-xs">{t('irisInfoText')}</p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className="flex-1 py-2.5 bg-dark-600 hover:bg-dark-500 text-white font-semibold rounded-xl transition-colors border border-white/10 text-sm"
                >
                  {t('close')}
                </motion.button>
                <motion.a
                  href="/anticheat"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white font-semibold rounded-xl transition-colors text-sm text-center"
                >
                  {t('downloadIris')}
                </motion.a>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

export default IrisRequiredDialog
