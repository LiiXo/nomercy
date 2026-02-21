import { motion } from 'framer-motion'
import { useLanguage } from '../contexts/LanguageContext'
import { useSound } from '../contexts/SoundContext'

const GameModeCard = ({ 
  mode, 
  icon, 
  description, 
  type = 'simple',
  searchingCount = 0,
  isSelected, 
  onClick,
  onRulesClick
}) => {
  const { t } = useLanguage()
  const { playSelect, playClick } = useSound()
  const isHardcore = type === 'hardcore'

  const handleRulesClick = (e) => {
    e.stopPropagation()
    playClick()
    if (onRulesClick) onRulesClick()
  }

  const handleClick = () => {
    playSelect()
    onClick?.()
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className={`
        relative cursor-pointer overflow-hidden group transition-all duration-300
        ${isHardcore 
          ? isSelected
            ? 'bg-gradient-to-br from-red-950/80 via-red-900/40 to-[#0a0a0c]'
            : 'bg-gradient-to-br from-red-950/50 via-red-900/20 to-[#0a0a0c] hover:from-red-950/60'
          : isSelected
            ? 'bg-gradient-to-br from-orange-950/60 via-accent-primary/15 to-[#0a0a0c]'
            : 'bg-gradient-to-br from-orange-950/30 via-accent-primary/5 to-[#0a0a0c] hover:from-orange-950/40'
        }
      `}
    >
      {/* Permanent left side color bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${
        isHardcore 
          ? isSelected ? 'bg-red-500' : 'bg-red-500/50'
          : isSelected ? 'bg-accent-primary' : 'bg-accent-primary/50'
      } transition-colors`} />

      {/* Top border line */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${
        isHardcore
          ? isSelected ? 'bg-red-500' : 'bg-red-500/30'
          : isSelected ? 'bg-accent-primary' : 'bg-accent-primary/30'
      } transition-colors`} />

      {/* Corner accents */}
      <div className={`absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 ${
        isHardcore ? 'border-red-500/60' : 'border-accent-primary/60'
      } transition-colors`} />
      <div className={`absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 ${
        isHardcore ? 'border-red-500/60' : 'border-accent-primary/60'
      } transition-colors`} />
      <div className={`absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 ${
        isHardcore ? 'border-red-500/30' : 'border-accent-primary/30'
      } transition-colors`} />
      <div className={`absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 ${
        isHardcore ? 'border-red-500/30' : 'border-accent-primary/30'
      } transition-colors`} />

      {/* Type badge - Always visible */}
      <div className={`absolute top-2 right-2 px-1.5 py-0.5 text-[7px] font-mono font-bold uppercase tracking-wider ${
        isHardcore 
          ? 'bg-red-500/30 text-red-400 border border-red-500/50'
          : 'bg-accent-primary/20 text-accent-primary border border-accent-primary/40'
      }`}>
        {isHardcore ? '☠ HC' : '◆'}
      </div>

      {/* Decorative pattern for Hardcore */}
      {isHardcore && (
        <div className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(220, 38, 38, 0.1) 10px, rgba(220, 38, 38, 0.1) 20px)',
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10 p-2.5 md:p-3 pl-3">
        {/* Header */}
        <div className="flex items-start gap-2 mb-2 mt-2">
          {/* Icon box */}
          <div className={`
            w-8 h-8 md:w-9 md:h-9 flex items-center justify-center transition-all duration-300
            ${isHardcore
              ? isSelected
                ? 'bg-red-500/30 text-red-400 border-2 border-red-500/60 shadow-lg shadow-red-500/20'
                : 'bg-red-500/15 text-red-400/80 border border-red-500/40'
              : isSelected
                ? 'bg-accent-primary/30 text-accent-primary border-2 border-accent-primary/60 shadow-lg shadow-accent-primary/20'
                : 'bg-accent-primary/15 text-accent-primary/80 border border-accent-primary/40'
            }
          `}>
            <span className="text-base md:text-lg">{icon}</span>
          </div>

          {/* Mode name & status */}
          <div className="flex-1 min-w-0">
            <h3 className={`text-xs md:text-sm font-mono font-bold uppercase tracking-wide transition-colors duration-300 ${
              isHardcore 
                ? isSelected ? 'text-red-400' : 'text-red-400/80 group-hover:text-red-300'
                : isSelected ? 'text-accent-primary' : 'text-accent-light/80 group-hover:text-accent-primary'
            }`}>{mode}</h3>
            <div className="flex items-center gap-1.5 mt-1">
              {searchingCount > 0 ? (
                <>
                  <div className={`w-2 h-2 rounded-full ${
                    isHardcore ? 'bg-red-500' : 'bg-green-500'
                  } animate-pulse`} />
                  <span className={`text-[10px] font-mono font-bold uppercase ${
                    isHardcore ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {searchingCount} {t('searching')}
                  </span>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 bg-gray-600" />
                  <span className="text-[8px] font-mono uppercase text-gray-600">
                    0 {t('searching')}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Description - Desktop only */}
        <p className={`hidden md:block text-[10px] mb-2 line-clamp-1 font-light ${
          isHardcore ? 'text-red-300/40' : 'text-gray-500'
        }`}>{description}</p>

        {/* Bottom row with rules button */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleRulesClick}
            className={`text-[8px] font-mono uppercase tracking-wider transition-all duration-200 ${
              isHardcore
                ? 'text-red-500/60 hover:text-red-400'
                : 'text-accent-primary/60 hover:text-accent-primary'
            }`}
          >
            [ {t('rules')} ]
          </button>

          {/* Selection indicator */}
          <div className={`text-[8px] font-mono uppercase tracking-wider ${
            isSelected 
              ? isHardcore ? 'text-red-400' : 'text-accent-primary'
              : isHardcore ? 'text-red-500/50' : 'text-gray-600'
          }`}>
            {isSelected ? '●' : '○'}
          </div>
        </div>
      </div>

      {/* Glow effect */}
      <div className={`absolute inset-0 pointer-events-none transition-opacity ${
        isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
      } ${
        isHardcore 
          ? 'bg-gradient-to-t from-red-500/10 via-transparent to-transparent' 
          : 'bg-gradient-to-t from-accent-primary/10 via-transparent to-transparent'
      }`} />

      {/* Selected border glow */}
      {isSelected && (
        <div className={`absolute inset-0 pointer-events-none ${
          isHardcore 
            ? 'shadow-[inset_0_0_30px_rgba(239,68,68,0.15)]' 
            : 'shadow-[inset_0_0_30px_rgba(255,107,53,0.15)]'
        }`} />
      )}
    </motion.div>
  )
}

export default GameModeCard
