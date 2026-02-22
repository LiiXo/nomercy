import { memo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useSound } from '../contexts/SoundContext'

const Button = memo(({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'md',
  disabled = false,
  glow = false,
  className = '',
  ...props 
}) => {
  const { playClick } = useSound()
  
  const baseStyles = 'font-military font-bold uppercase tracking-wider transition-all duration-150 relative overflow-hidden cod-corner-cut'
  
  const variants = {
    primary: 'bg-gradient-to-b from-accent-primary to-fire-600 text-white border border-accent-primary/50 hover:border-accent-primary',
    secondary: 'bg-white/5 text-white border border-white/20 hover:border-accent-primary/50 hover:bg-white/10',
    ghost: 'bg-transparent text-gray-400 hover:text-white border border-white/10 hover:border-white/30',
  }
  
  const sizes = {
    sm: 'px-4 py-2 text-[10px]',
    md: 'px-6 py-2.5 text-xs',
    lg: 'px-8 py-3 text-sm',
  }

  const handleClick = useCallback((e) => {
    if (!disabled) {
      playClick()
      onClick?.(e)
    }
  }, [disabled, onClick, playClick])

  // Show pulsing glow on primary buttons when glow prop is true and not disabled
  const showGlow = variant === 'primary' && glow && !disabled

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={handleClick}
      disabled={disabled}
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${sizes[size]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      {...props}
    >
      {/* Pulsing glow effect */}
      {showGlow && (
        <motion.span
          className="absolute inset-0 bg-accent-primary/30 blur-xl"
          animate={{
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
      
      {/* Animated border glow */}
      {showGlow && (
        <motion.span
          className="absolute inset-0 border-2 border-accent-primary"
          animate={{
            opacity: [0.5, 1, 0.5],
            boxShadow: [
              '0 0 10px rgba(255, 107, 53, 0.3), inset 0 0 10px rgba(255, 107, 53, 0.1)',
              '0 0 20px rgba(255, 107, 53, 0.5), inset 0 0 20px rgba(255, 107, 53, 0.2)',
              '0 0 10px rgba(255, 107, 53, 0.3), inset 0 0 10px rgba(255, 107, 53, 0.1)',
            ],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
      
      {/* Top accent line for primary */}
      {variant === 'primary' && (
        <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      )}
      <span className="relative z-10">{children}</span>
    </motion.button>
  )
})

Button.displayName = 'Button'

export default Button
