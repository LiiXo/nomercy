import React from 'react';

const AvatarWithOrnament = ({ 
  src, 
  alt = '', 
  size = 'md', 
  ornament = null,
  fallbackInitial = '?',
  className = '',
  rank = null, // 1, 2, 3 for top players
  isHardcore = false
}) => {
  // Size configurations with larger ornament padding for impressive effects
  const sizes = {
    xs: { container: 'w-8 h-8', text: 'text-xs', border: 2, ornamentPadding: 4, outerPadding: 6 },
    sm: { container: 'w-10 h-10', text: 'text-sm', border: 2, ornamentPadding: 5, outerPadding: 8 },
    md: { container: 'w-12 h-12', text: 'text-base', border: 3, ornamentPadding: 6, outerPadding: 10 },
    lg: { container: 'w-16 h-16', text: 'text-xl', border: 3, ornamentPadding: 8, outerPadding: 12 },
    xl: { container: 'w-24 h-24', text: 'text-3xl', border: 4, ornamentPadding: 10, outerPadding: 14 },
    '2xl': { container: 'w-32 h-32', text: 'text-4xl', border: 4, ornamentPadding: 12, outerPadding: 16 },
    '3xl': { container: 'w-40 h-40', text: 'text-5xl', border: 4, ornamentPadding: 14, outerPadding: 18 },
  };

  const sizeConfig = sizes[size] || sizes.md;

  // Default border styles based on rank or mode
  const getDefaultBorder = () => {
    if (rank === 1) return { color: 'border-yellow-400', glow: '0 0 20px rgba(251, 191, 36, 0.6)' };
    if (rank === 2) return { color: 'border-gray-300', glow: '0 0 18px rgba(209, 213, 219, 0.5)' };
    if (rank === 3) return { color: 'border-orange-600', glow: '0 0 18px rgba(234, 88, 12, 0.5)' };
    // No colored circle for regular players
    return { 
      color: 'border-transparent', 
      glow: 'none' 
    };
  };

  const defaultBorder = getDefaultBorder();

  // Get ornament styles (animations temporarily disabled)
  const getOrnamentStyles = () => {
    if (!ornament || !ornament.ornamentData) {
      return {
        borderClass: defaultBorder.color,
        glow: defaultBorder.glow,
        animated: false,
        animationType: ''
      };
    }

    const { borderColor, glowColor } = ornament.ornamentData;
    
    return {
      borderClass: borderColor ? `bg-gradient-to-r ${borderColor}` : defaultBorder.color,
      glow: glowColor || defaultBorder.glow,
      animated: false, // Animations temporarily disabled
      animationType: ''
    };
  };

  const ornamentStyles = getOrnamentStyles();
  const hasGradientBorder = ornament?.ornamentData?.borderColor;

  // Animation classes with new advanced animations
  const getAnimationClass = () => {
    if (!ornamentStyles.animated) return '';
    switch (ornamentStyles.animationType) {
      case 'pulse': return 'animate-pulse';
      case 'spin': return 'animate-spin-slow';
      case 'glow': return 'animate-glow';
      case 'demon-fire': return 'animate-demon-fire';
      case 'angel-halo': return 'animate-angel-halo';
      case 'manga-energy': return 'animate-manga-energy';
      case 'cyber-neon': return 'animate-cyber-neon';
      case 'dragon-scale': return 'animate-dragon-scale';
      case 'void-aura': return 'animate-void-aura';
      case 'phoenix-flame': return 'animate-phoenix-flame';
      case 'ice-crystal': return 'animate-ice-crystal';
      case 'cosmic-star': return 'animate-cosmic-star';
      default: return '';
    }
  };

  const animationClass = getAnimationClass();
  const borderWidth = ornament?.ornamentData?.borderWidth || sizeConfig.ornamentPadding;
  const hasMultiLayer = ornament?.ornamentData?.multiLayer || false;
  const layer2Color = ornament?.ornamentData?.layer2Color || '';
  const layer3Color = ornament?.ornamentData?.layer3Color || '';

  return (
    <div className={`relative inline-block ${className}`} style={{ padding: hasGradientBorder && hasMultiLayer ? sizeConfig.outerPadding : 0 }}>
      {/* Multi-layer ornaments for impressive effects */}
      {hasGradientBorder && hasMultiLayer && (
        <>
          {/* Layer 3 - Outer glow (farthest) */}
          {layer3Color && (
            <div 
              className={`absolute rounded-full bg-gradient-to-r ${layer3Color} ${animationClass}`}
              style={{ 
                inset: `-${sizeConfig.outerPadding + 4}px`,
                opacity: 0.4,
                filter: 'blur(4px)',
                zIndex: 0
              }}
            />
          )}
          {/* Layer 2 - Middle ring */}
          {layer2Color && (
            <div 
              className={`absolute rounded-full bg-gradient-to-r ${layer2Color} ${animationClass}`}
              style={{ 
                inset: `-${sizeConfig.outerPadding}px`,
                opacity: 0.6,
                filter: 'blur(2px)',
                zIndex: 1
              }}
            />
          )}
        </>
      )}
      
      {/* Ornament ring (gradient border) - Main layer */}
      {hasGradientBorder && (
        <div 
          className={`absolute rounded-full ${ornamentStyles.borderClass} ${animationClass}`}
          style={{ 
            inset: hasMultiLayer ? `-${borderWidth}px` : 0,
            padding: borderWidth,
            boxShadow: ornamentStyles.glow !== 'none' ? ornamentStyles.glow : undefined,
            zIndex: hasMultiLayer ? 2 : 1
          }}
        />
      )}
      
      {/* Avatar container */}
      <div 
        className={`${sizeConfig.container} rounded-full overflow-hidden relative ${
          hasGradientBorder 
            ? 'z-10' 
            : `border-${sizeConfig.border} ${ornamentStyles.borderClass}`
        }`}
        style={{ 
          margin: hasGradientBorder ? (hasMultiLayer ? borderWidth : sizeConfig.ornamentPadding) : 0,
          boxShadow: !hasGradientBorder && ornamentStyles.glow !== 'none' ? ornamentStyles.glow : undefined,
          zIndex: hasGradientBorder ? 10 : 'auto'
        }}
      >
        {src ? (
          <img 
            src={src} 
            alt={alt}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.onerror = null;
              e.target.style.display = 'none';
              e.target.parentElement.innerHTML = `<div class="w-full h-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center ${sizeConfig.text} font-bold text-white">${fallbackInitial}</div>`;
            }}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center ${sizeConfig.text} font-bold text-white`}>
            {fallbackInitial}
          </div>
        )}
      </div>
    </div>
  );
};

export default AvatarWithOrnament;

