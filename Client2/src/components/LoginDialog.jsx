import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { useSound } from '../contexts/SoundContext'

const LoginDialog = ({ isOpen, onClose }) => {
  const { t } = useLanguage()
  const { login } = useAuth()
  const { playClick, playHover } = useSound()

  const handleDiscordLogin = () => {
    playClick()
    login()
  }

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
              className="w-full max-w-sm"
            >
              <div className="cod-player-card relative overflow-hidden">
                {/* Top accent line */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent-primary to-transparent" />
                
                {/* Scanline effect */}
                <div className="absolute inset-0 cod-scanlines opacity-30 pointer-events-none" />

                <div className="p-8 relative">
                  {/* Close button */}
                  <button
                    onClick={handleClose}
                    onMouseEnter={playHover}
                    className="absolute top-4 right-4 text-gray-500 hover:text-accent-primary transition-colors"
                  >
                    <span className="text-xs font-military uppercase tracking-wider">[ X ]</span>
                  </button>

                  {/* Logo */}
                  <div className="flex justify-center mb-6">
                    <img src="/logo.png" alt="NoMercy" className="h-16 w-auto" />
                  </div>

                  {/* Title */}
                  <div className="text-center mb-6">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="w-8 h-px bg-gradient-to-r from-transparent to-accent-primary/50" />
                      <span className="text-[10px] font-military text-gray-500 uppercase tracking-wider">Authentication</span>
                      <div className="w-8 h-px bg-gradient-to-l from-transparent to-accent-primary/50" />
                    </div>
                    <h2 className="text-xl font-display text-white uppercase tracking-wide">
                      {t('loginTitle')}
                    </h2>
                    <p className="text-xs text-gray-500 mt-2 font-military">
                      {t('loginSubtitle')}
                    </p>
                  </div>

                  {/* Discord Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleDiscordLogin}
                    onMouseEnter={playHover}
                    className="w-full flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-military text-sm uppercase tracking-wider py-3 px-6 cod-corner-cut transition-all relative overflow-hidden"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                    {t('continueWithDiscord')}
                  </motion.button>

                  {/* Terms notice */}
                  <p className="text-[10px] text-gray-600 text-center mt-6 font-military">
                    {t('termsNotice')}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

export default LoginDialog
