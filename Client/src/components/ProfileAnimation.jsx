import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ProfileAnimation = ({ animationData, className = '', style = {} }) => {
  if (!animationData || !animationData.particleEffect) {
    return null;
  }

  const animationType = animationData.particleEffect;
  const glowColor = animationData.glowEffect || 'rgba(100, 100, 100, 0.3)';

  // Generate elements based on animation type
  const renderAnimation = () => {
    switch (animationType) {
      case 'fire':
        return <FireAnimation glowColor={glowColor} />;
      case 'snow':
        return <SnowAnimation glowColor={glowColor} />;
      case 'radiation':
        return <RadiationAnimation glowColor={glowColor} />;
      case 'aether':
        return <AetherAnimation glowColor={glowColor} />;
      case 'scan':
        return <ScanAnimation glowColor={glowColor} />;
      case 'blood':
        return <BloodAnimation glowColor={glowColor} />;
      case 'electric':
        return <ElectricAnimation glowColor={glowColor} />;
      case 'smoke':
        return <SmokeAnimation glowColor={glowColor} />;
      case 'sparkle':
        return <SparkleAnimation glowColor={glowColor} />;
      case 'dust':
        return <DustAnimation glowColor={glowColor} />;
      // STRICKER MODE ANIMATIONS
      case 'coins':
        return <CoinsAnimation glowColor={glowColor} />;
      case 'clover':
        return <CloverAnimation glowColor={glowColor} />;
      case 'diamond':
        return <DiamondAnimation glowColor={glowColor} />;
      case 'sparkle-gold':
        return <SparkleGoldAnimation glowColor={glowColor} />;
      case 'rainbow':
        return <RainbowAnimation glowColor={glowColor} />;
      // RANKED MODE ANIMATIONS
      case 'crown-sparkle':
        return <CrownSparkleAnimation glowColor={glowColor} />;
      case 'rising-arrows':
        return <RisingArrowsAnimation glowColor={glowColor} />;
      case 'diamond-elite':
        return <DiamondEliteAnimation glowColor={glowColor} />;
      case 'victory-fire':
        return <VictoryFireAnimation glowColor={glowColor} />;
      case 'data-flow':
        return <DataFlowAnimation glowColor={glowColor} />;
      case 'predator-eyes':
        return <PredatorEyesAnimation glowColor={glowColor} />;
      case 'legendary-stars':
        return <LegendaryStarsAnimation glowColor={glowColor} />;
      default:
        return null;
    }
  };

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden rounded-2xl ${className}`} style={style}>
      {renderAnimation()}
    </div>
  );
};

// FIRE - Flames rising from bottom
const FireAnimation = ({ glowColor }) => {
  const flames = useMemo(() => 
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: `${5 + i * 8}%`,
      delay: i * 0.15,
      duration: 2 + Math.random() * 1.5,
      size: 30 + Math.random() * 40
    })), []
  );

  return (
    <>
      {/* Bottom glow */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-32"
        style={{
          background: 'linear-gradient(to top, rgba(255, 100, 0, 0.4), transparent)'
        }}
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      {/* Flame elements */}
      {flames.map((flame) => (
        <motion.div
          key={flame.id}
          className="absolute bottom-0"
          style={{
            left: flame.x,
            width: flame.size,
            height: flame.size * 2,
            background: 'radial-gradient(ellipse at bottom, #ff6b00 0%, #ff4500 30%, #ff0000 60%, transparent 100%)',
            borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
            filter: 'blur(4px)'
          }}
          animate={{
            y: [0, -80, -120],
            opacity: [0.8, 0.6, 0],
            scale: [1, 1.2, 0.8],
            rotateZ: [-5, 5, -5]
          }}
          transition={{
            duration: flame.duration,
            delay: flame.delay,
            repeat: Infinity,
            ease: 'easeOut'
          }}
        />
      ))}

      {/* Ember particles */}
      {Array.from({ length: 20 }, (_, i) => (
        <motion.div
          key={`ember-${i}`}
          className="absolute rounded-full"
          style={{
            left: `${10 + Math.random() * 80}%`,
            bottom: 0,
            width: 4 + Math.random() * 6,
            height: 4 + Math.random() * 6,
            background: i % 2 === 0 ? '#ffcc00' : '#ff6600'
          }}
          animate={{
            y: [0, -150 - Math.random() * 100],
            x: [0, (Math.random() - 0.5) * 50],
            opacity: [1, 0],
            scale: [1, 0.5]
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            delay: i * 0.2,
            repeat: Infinity,
            ease: 'easeOut'
          }}
        />
      ))}
    </>
  );
};

// SNOW - Snowflakes falling gently
const SnowAnimation = ({ glowColor }) => {
  const snowflakes = useMemo(() =>
    Array.from({ length: 35 }, (_, i) => ({
      id: i,
      x: `${Math.random() * 100}%`,
      size: 4 + Math.random() * 8,
      delay: Math.random() * 1.5, // Start quickly
      duration: 6 + Math.random() * 4
    })), []
  );

  return (
    <>
      {/* Cold overlay */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(200, 230, 255, 0.1) 0%, transparent 50%)'
        }}
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 4, repeat: Infinity }}
      />

      {/* Snowflakes */}
      {snowflakes.map((flake) => (
        <motion.div
          key={flake.id}
          className="absolute"
          style={{
            left: flake.x,
            top: -20,
            width: flake.size,
            height: flake.size,
            background: 'radial-gradient(circle, white 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
            borderRadius: '50%',
            boxShadow: '0 0 6px rgba(255,255,255,0.8)'
          }}
          animate={{
            y: [0, 350],
            x: [0, Math.sin(flake.id) * 30, 0],
            rotate: [0, 360],
            opacity: [0, 1, 1, 0]
          }}
          transition={{
            duration: flake.duration,
            delay: flake.delay,
            repeat: Infinity,
            ease: 'linear'
          }}
        />
      ))}
    </>
  );
};

// RADIATION - Pulsing radioactive waves from corners
const RadiationAnimation = ({ glowColor }) => {
  return (
    <>
      {/* Corner glow sources */}
      {[{x: '10%', y: '20%'}, {x: '90%', y: '20%'}, {x: '10%', y: '80%'}, {x: '90%', y: '80%'}].map((pos, i) => (
        <motion.div
          key={`glow-${i}`}
          className="absolute"
          style={{
            left: pos.x,
            top: pos.y,
            transform: 'translate(-50%, -50%)',
            width: 60,
            height: 60,
            background: 'radial-gradient(circle, rgba(0, 255, 0, 0.5) 0%, rgba(150, 255, 0, 0.2) 40%, transparent 70%)',
            borderRadius: '50%'
          }}
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.5, 0.8, 0.5]
          }}
          transition={{ duration: 2, delay: i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* Expanding radiation rings from corners */}
      {[{x: '0%', y: '0%'}, {x: '100%', y: '0%'}, {x: '0%', y: '100%'}, {x: '100%', y: '100%'}].map((pos, ci) => (
        [0, 1].map((ring) => (
          <motion.div
            key={`ring-${ci}-${ring}`}
            className="absolute rounded-full border"
            style={{
              left: pos.x,
              top: pos.y,
              transform: 'translate(-50%, -50%)',
              borderColor: 'rgba(180, 255, 0, 0.4)',
              boxShadow: '0 0 15px rgba(180, 255, 0, 0.2)'
            }}
            animate={{
              width: [30, 200],
              height: [30, 200],
              opacity: [0.6, 0]
            }}
            transition={{
              duration: 3,
              delay: ci * 0.5 + ring * 1.5,
              repeat: Infinity,
              ease: 'easeOut'
            }}
          />
        ))
      ))}

      {/* Floating radioactive particles - edges only */}
      {Array.from({ length: 15 }, (_, i) => {
        // Keep particles on edges (left 25% or right 25%)
        const isLeft = i % 2 === 0;
        const x = isLeft ? (5 + Math.random() * 20) : (75 + Math.random() * 20);
        return (
          <motion.div
            key={`particle-${i}`}
            className="absolute rounded-full"
            style={{
              left: `${x}%`,
              top: `${15 + Math.random() * 70}%`,
              width: 6 + Math.random() * 8,
              height: 6 + Math.random() * 8,
              background: 'radial-gradient(circle, #ccff00, transparent)',
              filter: 'blur(1px)'
            }}
            animate={{
              y: [0, -15, 0, 15, 0],
              x: [0, 10, 0, -10, 0],
              opacity: [0.3, 0.7, 0.3],
              scale: [1, 1.2, 1]
            }}
            transition={{
              duration: 4 + Math.random() * 2,
              delay: i * 0.2,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />
        );
      })}
    </>
  );
};

// AETHER - Mystical floating orbs with connections
const AetherAnimation = ({ glowColor }) => {
  // Orbs positioned on edges, avoiding center
  const orbs = useMemo(() =>
    Array.from({ length: 10 }, (_, i) => {
      // Alternate between left edge (0-20%) and right edge (80-100%)
      const isLeft = i % 2 === 0;
      const x = isLeft ? (5 + Math.random() * 15) : (80 + Math.random() * 15);
      return {
        id: i,
        x: x,
        y: 10 + (i * 8) % 80,
        size: 12 + Math.random() * 20,
        duration: 5 + Math.random() * 3
      };
    }), []
  );

  return (
    <>
      {/* Mystical background */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(147, 51, 234, 0.15) 0%, transparent 70%)'
        }}
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 5, repeat: Infinity }}
      />

      {/* Floating orbs */}
      {orbs.map((orb) => (
        <motion.div
          key={orb.id}
          className="absolute rounded-full"
          style={{
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            width: orb.size,
            height: orb.size,
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.9) 0%, rgba(147, 51, 234, 0.5) 50%, transparent 100%)',
            boxShadow: '0 0 30px rgba(168, 85, 247, 0.6), 0 0 60px rgba(147, 51, 234, 0.3)'
          }}
          animate={{
            y: [0, -30, 0, 30, 0],
            x: [0, 20, 0, -20, 0],
            scale: [1, 1.1, 1, 0.9, 1],
            opacity: [0.6, 0.9, 0.6]
          }}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      ))}

      {/* Energy wisps */}
      {Array.from({ length: 5 }, (_, i) => (
        <motion.div
          key={`wisp-${i}`}
          className="absolute"
          style={{
            left: `${10 + i * 20}%`,
            top: '50%',
            width: 80,
            height: 2,
            background: 'linear-gradient(90deg, transparent, rgba(192, 132, 252, 0.8), transparent)',
            filter: 'blur(2px)'
          }}
          animate={{
            opacity: [0, 0.8, 0],
            scaleX: [0.5, 1.5, 0.5],
            y: [0, -50, 0]
          }}
          transition={{
            duration: 4,
            delay: i * 0.8,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      ))}
    </>
  );
};

// SCAN - Tactical scanning effect
const ScanAnimation = ({ glowColor }) => {
  return (
    <>
      {/* Grid background */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'linear-gradient(rgba(0, 255, 100, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 100, 0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      {/* Horizontal scan line */}
      <motion.div
        className="absolute left-0 right-0 h-0.5"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, #00ff64 20%, #00ff64 80%, transparent 100%)',
          boxShadow: '0 0 20px #00ff64, 0 0 40px rgba(0, 255, 100, 0.5)'
        }}
        animate={{ top: ['0%', '100%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />

      {/* Vertical scan line */}
      <motion.div
        className="absolute top-0 bottom-0 w-0.5"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, #00ff64 20%, #00ff64 80%, transparent 100%)',
          boxShadow: '0 0 20px #00ff64'
        }}
        animate={{ left: ['0%', '100%'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear', delay: 1.5 }}
      />

      {/* Corner brackets */}
      {['top-4 left-4', 'top-4 right-4', 'bottom-4 left-4', 'bottom-4 right-4'].map((pos, i) => (
        <motion.div
          key={pos}
          className={`absolute ${pos} w-8 h-8 border-2 border-green-400`}
          style={{
            borderTop: i < 2 ? '2px solid #00ff64' : 'none',
            borderBottom: i >= 2 ? '2px solid #00ff64' : 'none',
            borderLeft: i % 2 === 0 ? '2px solid #00ff64' : 'none',
            borderRight: i % 2 === 1 ? '2px solid #00ff64' : 'none'
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}

      {/* Data points */}
      {Array.from({ length: 6 }, (_, i) => (
        <motion.div
          key={`data-${i}`}
          className="absolute"
          style={{
            left: `${15 + i * 15}%`,
            top: `${30 + (i % 3) * 20}%`,
            width: 8,
            height: 8,
            background: '#00ff64',
            borderRadius: '50%',
            boxShadow: '0 0 10px #00ff64'
          }}
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.5, 1, 0.5]
          }}
          transition={{
            duration: 2,
            delay: i * 0.3,
            repeat: Infinity
          }}
        />
      ))}
    </>
  );
};

// BLOOD - Dripping blood effect
const BloodAnimation = ({ glowColor }) => {
  const drips = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: `${10 + i * 12}%`,
      delay: i * 0.5,
      duration: 4 + Math.random() * 2
    })), []
  );

  return (
    <>
      {/* Red vignette */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(220, 38, 38, 0.3) 100%)'
        }}
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Blood drips from top */}
      {drips.map((drip) => (
        <motion.div
          key={drip.id}
          className="absolute top-0"
          style={{
            left: drip.x,
            width: 8,
            height: 40,
            background: 'linear-gradient(to bottom, #dc2626 0%, #991b1b 60%, transparent 100%)',
            borderRadius: '0 0 50% 50%',
            filter: 'blur(1px)'
          }}
          animate={{
            height: [0, 80, 120, 80],
            opacity: [0, 1, 0.8, 0]
          }}
          transition={{
            duration: drip.duration,
            delay: drip.delay,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      ))}

      {/* Floating blood mist - edges only */}
      {Array.from({ length: 10 }, (_, i) => {
        // Keep mist on edges
        const isLeft = i % 2 === 0;
        const x = isLeft ? Math.random() * 25 : 75 + Math.random() * 25;
        return (
          <motion.div
            key={`mist-${i}`}
            className="absolute rounded-full"
            style={{
              left: `${x}%`,
              top: `${Math.random() * 100}%`,
              width: 20 + Math.random() * 30,
              height: 20 + Math.random() * 30,
              background: 'radial-gradient(circle, rgba(239, 68, 68, 0.4), transparent)',
              filter: 'blur(8px)'
            }}
            animate={{
              x: [0, 15, 0, -15, 0],
              y: [0, -10, 0, 10, 0],
              opacity: [0.2, 0.5, 0.2]
            }}
            transition={{
              duration: 6 + Math.random() * 4,
              delay: i * 0.3,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />
        );
      })}
    </>
  );
};

// ELECTRIC - Lightning bolts and sparks
const ElectricAnimation = ({ glowColor }) => {
  return (
    <>
      {/* Electric glow */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.2) 0%, transparent 60%)'
        }}
        animate={{
          opacity: [0.3, 0.7, 0.3],
          scale: [1, 1.02, 1]
        }}
        transition={{ duration: 0.5, repeat: Infinity }}
      />

      {/* Lightning bolts */}
      {[0, 1, 2].map((bolt) => (
        <motion.svg
          key={bolt}
          className="absolute"
          style={{
            left: `${20 + bolt * 30}%`,
            top: 0,
            width: 60,
            height: '100%'
          }}
          viewBox="0 0 60 200"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{
            duration: 0.3,
            delay: bolt * 2 + Math.random() * 2,
            repeat: Infinity,
            repeatDelay: 3
          }}
        >
          <motion.path
            d="M30 0 L25 60 L40 65 L20 130 L35 135 L15 200"
            stroke="#60a5fa"
            strokeWidth="3"
            fill="none"
            filter="url(#glow)"
            animate={{
              d: [
                "M30 0 L25 60 L40 65 L20 130 L35 135 L15 200",
                "M30 0 L35 55 L20 70 L40 125 L25 140 L35 200"
              ]
            }}
            transition={{ duration: 0.1, repeat: 2 }}
          />
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
        </motion.svg>
      ))}

      {/* Electric sparks - edges only */}
      {Array.from({ length: 15 }, (_, i) => {
        const isLeft = i % 2 === 0;
        const x = isLeft ? Math.random() * 20 : 80 + Math.random() * 20;
        return (
          <motion.div
            key={`spark-${i}`}
            className="absolute rounded-full"
            style={{
              left: `${x}%`,
              top: `${Math.random() * 100}%`,
              width: 4,
              height: 4,
              background: '#93c5fd',
              boxShadow: '0 0 10px #3b82f6, 0 0 20px #60a5fa'
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0.5, 1.5, 0.5]
            }}
            transition={{
              duration: 0.3,
              delay: i * 0.15,
              repeat: Infinity,
              repeatDelay: 2 + Math.random() * 3
            }}
          />
        );
      })}
    </>
  );
};

// SMOKE - Flowing smoke/mist
const SmokeAnimation = ({ glowColor }) => {
  // Smoke clouds on edges
  const smokeClouds = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => {
      const isLeft = i % 2 === 0;
      const x = isLeft ? (5 + i * 5) : (70 + (i % 4) * 8);
      return {
        id: i,
        x: x,
        size: 80 + Math.random() * 80,
        delay: i * 0.8,
        duration: 8 + Math.random() * 4
      };
    }), []
  );

  return (
    <>
      {/* Base fog */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to top, rgba(100, 116, 139, 0.3) 0%, transparent 60%)'
        }}
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 6, repeat: Infinity }}
      />

      {/* Smoke clouds */}
      {smokeClouds.map((cloud) => (
        <motion.div
          key={cloud.id}
          className="absolute"
          style={{
            left: `${cloud.x}%`,
            bottom: 0,
            width: cloud.size,
            height: cloud.size,
            background: 'radial-gradient(circle, rgba(148, 163, 184, 0.4) 0%, rgba(100, 116, 139, 0.2) 40%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(20px)'
          }}
          animate={{
            y: [0, -150, -250],
            x: [0, 30, -20, 40],
            scale: [1, 1.5, 2],
            opacity: [0.6, 0.4, 0]
          }}
          transition={{
            duration: cloud.duration,
            delay: cloud.delay,
            repeat: Infinity,
            ease: 'easeOut'
          }}
        />
      ))}

      {/* Wispy tendrils - on edges */}
      {Array.from({ length: 4 }, (_, i) => (
        <motion.div
          key={`wisp-${i}`}
          className="absolute"
          style={{
            left: i % 2 === 0 ? '0%' : '70%',
            bottom: 20 + i * 15,
            width: 100,
            height: 30,
            background: `linear-gradient(${i % 2 === 0 ? '90deg' : '-90deg'}, rgba(203, 213, 225, 0.25), transparent)`,
            borderRadius: '50%',
            filter: 'blur(8px)'
          }}
          animate={{
            x: i % 2 === 0 ? [0, 40, 0] : [0, -40, 0],
            y: [0, -50, 0],
            opacity: [0.2, 0.5, 0.2],
            scaleX: [1, 1.2, 1]
          }}
          transition={{
            duration: 7,
            delay: i * 1.5,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      ))}
    </>
  );
};

// SPARKLE - Golden glitter effect
const SparkleAnimation = ({ glowColor }) => {
  // Sparkles on edges, avoiding center
  const sparkles = useMemo(() =>
    Array.from({ length: 25 }, (_, i) => {
      // Keep sparkles on edges (left 30% or right 30%)
      let x;
      if (i % 3 === 0) {
        x = Math.random() * 25; // Left edge
      } else if (i % 3 === 1) {
        x = 75 + Math.random() * 25; // Right edge
      } else {
        x = 25 + Math.random() * 50; // Top/bottom areas
      }
      const y = i % 3 === 2 ? (Math.random() > 0.5 ? Math.random() * 20 : 80 + Math.random() * 20) : Math.random() * 100;
      return {
        id: i,
        x: x,
        y: y,
        size: 4 + Math.random() * 8,
        delay: Math.random() * 2,
        duration: 2 + Math.random() * 2
      };
    }), []
  );

  return (
    <>
      {/* Golden ambient glow */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(251, 191, 36, 0.15) 0%, transparent 60%)'
        }}
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Twinkling stars */}
      {sparkles.map((sparkle) => (
        <motion.div
          key={sparkle.id}
          className="absolute"
          style={{
            left: `${sparkle.x}%`,
            top: `${sparkle.y}%`,
            width: sparkle.size,
            height: sparkle.size
          }}
        >
          {/* 4-pointed star shape */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(45deg, transparent 40%, #fcd34d 50%, transparent 60%), linear-gradient(-45deg, transparent 40%, #fcd34d 50%, transparent 60%)',
              boxShadow: '0 0 10px #fbbf24, 0 0 20px rgba(251, 191, 36, 0.5)'
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0.5, 1.2, 0.5],
              rotate: [0, 90, 180]
            }}
            transition={{
              duration: sparkle.duration,
              delay: sparkle.delay,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />
        </motion.div>
      ))}

      {/* Floating golden particles */}
      {Array.from({ length: 10 }, (_, i) => (
        <motion.div
          key={`particle-${i}`}
          className="absolute rounded-full"
          style={{
            left: `${10 + i * 9}%`,
            bottom: 0,
            width: 3,
            height: 3,
            background: '#fde68a',
            boxShadow: '0 0 6px #fbbf24'
          }}
          animate={{
            y: [0, -200],
            x: [0, (Math.random() - 0.5) * 40],
            opacity: [0, 1, 0]
          }}
          transition={{
            duration: 5,
            delay: i * 0.5,
            repeat: Infinity,
            ease: 'easeOut'
          }}
        />
      ))}
    </>
  );
};

// DUST - Warzone dust/debris
const DustAnimation = ({ glowColor }) => {
  const dustParticles = useMemo(() =>
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 120 - 10,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 2, // Start quickly
      duration: 6 + Math.random() * 5
    })), []
  );

  return (
    <>
      {/* Dusty overlay */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, rgba(120, 113, 108, 0.1) 0%, transparent 50%, rgba(68, 64, 60, 0.15) 100%)'
        }}
        animate={{ opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 5, repeat: Infinity }}
      />

      {/* Falling dust */}
      {dustParticles.map((dust) => (
        <motion.div
          key={dust.id}
          className="absolute rounded-full"
          style={{
            left: `${dust.x}%`,
            top: -10,
            width: dust.size,
            height: dust.size,
            background: dust.id % 3 === 0 ? '#94a3b8' : dust.id % 3 === 1 ? '#78716c' : '#64748b',
            opacity: 0.6
          }}
          animate={{
            y: [0, 350],
            x: [0, -50],
            opacity: [0, 0.6, 0.6, 0]
          }}
          transition={{
            duration: dust.duration,
            delay: dust.delay,
            repeat: Infinity,
            ease: 'linear'
          }}
        />
      ))}

      {/* Wind streaks */}
      {Array.from({ length: 3 }, (_, i) => (
        <motion.div
          key={`streak-${i}`}
          className="absolute"
          style={{
            right: 0,
            top: `${20 + i * 30}%`,
            width: 200,
            height: 1,
            background: 'linear-gradient(90deg, rgba(148, 163, 184, 0.5), transparent)',
            filter: 'blur(1px)'
          }}
          animate={{
            x: [200, -400],
            opacity: [0, 0.5, 0]
          }}
          transition={{
            duration: 3,
            delay: i * 2,
            repeat: Infinity,
            ease: 'linear'
          }}
        />
      ))}
    </>
  );
};

// ==================== STRICKER MODE ANIMATIONS ====================

// COINS - Falling gold coins casino effect
const CoinsAnimation = ({ glowColor }) => {
  const coins = useMemo(() =>
    Array.from({ length: 25 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: 16 + Math.random() * 12,
      delay: Math.random() * 2,
      duration: 3 + Math.random() * 2,
      rotation: Math.random() * 360
    })), []
  );

  return (
    <>
      {/* Golden glow overlay */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at bottom, rgba(251,191,36,0.4) 0%, rgba(217,119,6,0.2) 40%, transparent 70%)'
        }}
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Falling coins */}
      {coins.map((coin) => (
        <motion.div
          key={coin.id}
          className="absolute"
          style={{
            left: `${coin.x}%`,
            top: -30,
            width: coin.size,
            height: coin.size,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 50%, #b45309 100%)',
            boxShadow: '0 0 15px rgba(251, 191, 36, 0.8), inset 0 -3px 6px rgba(0,0,0,0.3)',
            border: '2px solid #fbbf24'
          }}
          animate={{
            y: [0, 400],
            rotateY: [0, 720],
            rotateX: [coin.rotation, coin.rotation + 180],
            opacity: [0, 1, 1, 0]
          }}
          transition={{
            duration: coin.duration,
            delay: coin.delay,
            repeat: Infinity,
            ease: 'easeIn'
          }}
        >
          {/* Coin symbol */}
          <div className="absolute inset-0 flex items-center justify-center text-yellow-900 font-bold text-xs">
            $
          </div>
        </motion.div>
      ))}

      {/* Sparkle burst */}
      {Array.from({ length: 15 }, (_, i) => (
        <motion.div
          key={`sparkle-${i}`}
          className="absolute"
          style={{
            left: `${10 + Math.random() * 80}%`,
            top: `${20 + Math.random() * 60}%`,
            width: 8,
            height: 8,
            background: '#fcd34d',
            borderRadius: '50%',
            boxShadow: '0 0 20px #fbbf24'
          }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0.3, 1.5, 0.3]
          }}
          transition={{
            duration: 1.5,
            delay: i * 0.2,
            repeat: Infinity
          }}
        />
      ))}
    </>
  );
};

// CLOVER - Lucky four-leaf clovers
const CloverAnimation = ({ glowColor }) => {
  const clovers = useMemo(() =>
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: 20 + Math.random() * 20,
      delay: Math.random() * 3,
      duration: 5 + Math.random() * 3
    })), []
  );

  return (
    <>
      {/* Green ambient glow */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(34,197,94,0.25) 0%, transparent 60%)'
        }}
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Floating clovers */}
      {clovers.map((clover) => (
        <motion.div
          key={clover.id}
          className="absolute"
          style={{
            left: `${clover.x}%`,
            top: -40,
            width: clover.size,
            height: clover.size,
            filter: 'drop-shadow(0 0 10px rgba(34, 197, 94, 0.8))'
          }}
          animate={{
            y: [0, 350],
            rotate: [0, 360],
            x: [0, Math.sin(clover.id) * 50],
            opacity: [0, 1, 1, 0]
          }}
          transition={{
            duration: clover.duration,
            delay: clover.delay,
            repeat: Infinity,
            ease: 'linear'
          }}
        >
          {/* Four leaf clover shape */}
          <svg viewBox="0 0 24 24" fill="#22c55e">
            <circle cx="9" cy="9" r="5" />
            <circle cx="15" cy="9" r="5" />
            <circle cx="9" cy="15" r="5" />
            <circle cx="15" cy="15" r="5" />
            <rect x="11" y="18" width="2" height="6" fill="#16a34a" />
          </svg>
        </motion.div>
      ))}

      {/* Lucky sparkles */}
      {Array.from({ length: 20 }, (_, i) => (
        <motion.div
          key={`luck-${i}`}
          className="absolute rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: 4 + Math.random() * 4,
            height: 4 + Math.random() * 4,
            background: '#4ade80',
            boxShadow: '0 0 10px #22c55e'
          }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0.5, 1.5, 0.5]
          }}
          transition={{
            duration: 2,
            delay: i * 0.15,
            repeat: Infinity
          }}
        />
      ))}
    </>
  );
};

// DIAMOND - Falling diamonds
const DiamondAnimation = ({ glowColor }) => {
  const diamonds = useMemo(() =>
    Array.from({ length: 15 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: 18 + Math.random() * 16,
      delay: Math.random() * 2.5,
      duration: 4 + Math.random() * 2
    })), []
  );

  return (
    <>
      {/* Cyan diamond glow */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(103,232,249,0.3) 0%, rgba(34,211,238,0.15) 40%, transparent 70%)'
        }}
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 2.5, repeat: Infinity }}
      />

      {/* Falling diamonds */}
      {diamonds.map((diamond) => (
        <motion.div
          key={diamond.id}
          className="absolute"
          style={{
            left: `${diamond.x}%`,
            top: -30,
            width: diamond.size,
            height: diamond.size * 1.2
          }}
          animate={{
            y: [0, 380],
            rotate: [0, 180],
            opacity: [0, 1, 1, 0]
          }}
          transition={{
            duration: diamond.duration,
            delay: diamond.delay,
            repeat: Infinity,
            ease: 'easeIn'
          }}
        >
          {/* Diamond shape */}
          <svg viewBox="0 0 24 28" className="w-full h-full">
            <polygon
              points="12,0 24,10 12,28 0,10"
              fill="url(#diamondGradient)"
              style={{ filter: 'drop-shadow(0 0 8px rgba(103, 232, 249, 0.9))' }}
            />
            <polygon
              points="12,0 18,10 12,20 6,10"
              fill="rgba(255,255,255,0.4)"
            />
            <defs>
              <linearGradient id="diamondGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#67e8f9" />
                <stop offset="50%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>
      ))}

      {/* Shimmer particles */}
      {Array.from({ length: 25 }, (_, i) => (
        <motion.div
          key={`shimmer-${i}`}
          className="absolute"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: 3,
            height: 3,
            background: '#a5f3fc',
            borderRadius: '50%',
            boxShadow: '0 0 15px #22d3ee'
          }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0.3, 2, 0.3]
          }}
          transition={{
            duration: 1.2,
            delay: i * 0.1,
            repeat: Infinity
          }}
        />
      ))}
    </>
  );
};

// SPARKLE GOLD - Intense golden sparkles for fortune wheel
const SparkleGoldAnimation = ({ glowColor }) => {
  const sparkles = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 3 + Math.random() * 8,
      delay: Math.random() * 1.5,
      duration: 1.5 + Math.random() * 1.5
    })), []
  );

  return (
    <>
      {/* Rotating golden gradient */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'conic-gradient(from 0deg, rgba(251,191,36,0.2), rgba(245,158,11,0.3), rgba(217,119,6,0.2), rgba(251,191,36,0.2))'
        }}
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />

      {/* Intense sparkles */}
      {sparkles.map((sparkle) => (
        <motion.div
          key={sparkle.id}
          className="absolute"
          style={{
            left: `${sparkle.x}%`,
            top: `${sparkle.y}%`,
            width: sparkle.size,
            height: sparkle.size
          }}
        >
          <motion.div
            className="w-full h-full"
            style={{
              background: 'linear-gradient(45deg, transparent 30%, #fcd34d 50%, transparent 70%), linear-gradient(-45deg, transparent 30%, #fcd34d 50%, transparent 70%)',
              boxShadow: '0 0 15px #fbbf24, 0 0 30px rgba(251, 191, 36, 0.6)'
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0.2, 1.5, 0.2],
              rotate: [0, 180]
            }}
            transition={{
              duration: sparkle.duration,
              delay: sparkle.delay,
              repeat: Infinity
            }}
          />
        </motion.div>
      ))}

      {/* Central glow pulse */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
      >
        <motion.div
          className="w-32 h-32 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(251,191,36,0.5) 0%, transparent 70%)'
          }}
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.3, 0.6, 0.3]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>
    </>
  );
};

// RAINBOW - Rainbow luck effect
const RainbowAnimation = ({ glowColor }) => {
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
  
  const particles = useMemo(() =>
    Array.from({ length: 35 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: colors[i % colors.length],
      size: 8 + Math.random() * 10,
      delay: Math.random() * 2,
      duration: 4 + Math.random() * 3
    })), []
  );

  return (
    <>
      {/* Rainbow gradient sweep */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(249,115,22,0.15) 16%, rgba(234,179,8,0.15) 33%, rgba(34,197,94,0.15) 50%, rgba(59,130,246,0.15) 66%, rgba(139,92,246,0.15) 83%, rgba(236,72,153,0.15) 100%)'
        }}
        animate={{
          backgroundPosition: ['0% 0%', '100% 100%']
        }}
        transition={{ duration: 5, repeat: Infinity, repeatType: 'reverse' }}
      />

      {/* Rainbow particles */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            top: -20,
            width: particle.size,
            height: particle.size,
            background: particle.color,
            boxShadow: `0 0 20px ${particle.color}`,
            filter: 'blur(1px)'
          }}
          animate={{
            y: [0, 400],
            x: [0, Math.sin(particle.id) * 60],
            opacity: [0, 0.9, 0.9, 0],
            scale: [0.8, 1.2, 0.8]
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity
          }}
        />
      ))}

      {/* Rainbow arcs */}
      {[0, 1, 2].map((arc) => (
        <motion.div
          key={`arc-${arc}`}
          className="absolute"
          style={{
            left: '50%',
            bottom: -50,
            width: 300 + arc * 40,
            height: 150 + arc * 20,
            borderRadius: '150px 150px 0 0',
            border: `3px solid ${colors[arc * 2]}`,
            borderBottom: 'none',
            transform: 'translateX(-50%)',
            opacity: 0.3
          }}
          animate={{
            opacity: [0.1, 0.4, 0.1],
            scale: [0.95, 1.05, 0.95]
          }}
          transition={{
            duration: 3,
            delay: arc * 0.5,
            repeat: Infinity
          }}
        />
      ))}
    </>
  );
};

// ==================== RANKED MODE ANIMATIONS ====================

// CROWN SPARKLE - Champion's crown effect
const CrownSparkleAnimation = ({ glowColor }) => {
  return (
    <>
      {/* Golden champion aura */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at top, rgba(251,191,36,0.5) 0%, rgba(234,179,8,0.2) 40%, transparent 70%)'
        }}
        animate={{ opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Crown silhouette glow */}
      <motion.div
        className="absolute top-4 left-1/2 transform -translate-x-1/2"
        style={{
          width: 120,
          height: 60
        }}
        animate={{
          y: [0, -5, 0],
          filter: ['drop-shadow(0 0 20px #fbbf24)', 'drop-shadow(0 0 40px #fbbf24)', 'drop-shadow(0 0 20px #fbbf24)']
        }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <svg viewBox="0 0 100 50" className="w-full h-full">
          <path
            d="M10,45 L20,20 L35,35 L50,10 L65,35 L80,20 L90,45 Z"
            fill="url(#crownGold)"
            stroke="#fcd34d"
            strokeWidth="2"
          />
          <circle cx="20" cy="18" r="4" fill="#fcd34d" />
          <circle cx="50" cy="8" r="5" fill="#fcd34d" />
          <circle cx="80" cy="18" r="4" fill="#fcd34d" />
          <defs>
            <linearGradient id="crownGold" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fcd34d" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>

      {/* Radiating sparkles from crown */}
      {Array.from({ length: 20 }, (_, i) => {
        const angle = (i / 20) * Math.PI;
        const radius = 80 + Math.random() * 60;
        return (
          <motion.div
            key={`crown-sparkle-${i}`}
            className="absolute"
            style={{
              left: `calc(50% + ${Math.cos(angle) * radius}px)`,
              top: 40 + Math.sin(angle) * 30,
              width: 6,
              height: 6,
              background: '#fcd34d',
              borderRadius: '50%',
              boxShadow: '0 0 15px #fbbf24'
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0.3, 1.5, 0.3],
              y: [0, -20, 0]
            }}
            transition={{
              duration: 2,
              delay: i * 0.1,
              repeat: Infinity
            }}
          />
        );
      })}

      {/* Falling golden particles */}
      {Array.from({ length: 15 }, (_, i) => (
        <motion.div
          key={`gold-fall-${i}`}
          className="absolute rounded-full"
          style={{
            left: `${20 + Math.random() * 60}%`,
            top: 60,
            width: 4,
            height: 4,
            background: '#fde68a'
          }}
          animate={{
            y: [0, 200],
            opacity: [1, 0],
            x: [(Math.random() - 0.5) * 40, (Math.random() - 0.5) * 80]
          }}
          transition={{
            duration: 3,
            delay: i * 0.3,
            repeat: Infinity
          }}
        />
      ))}
    </>
  );
};

// RISING ARROWS - Rank up energy
const RisingArrowsAnimation = ({ glowColor }) => {
  const arrows = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: 10 + (i % 6) * 15,
      delay: i * 0.3,
      size: 20 + Math.random() * 15
    })), []
  );

  return (
    <>
      {/* Rising green gradient */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to top, rgba(34,197,94,0.4) 0%, rgba(16,185,129,0.2) 50%, transparent 100%)'
        }}
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Rising arrows */}
      {arrows.map((arrow) => (
        <motion.div
          key={arrow.id}
          className="absolute"
          style={{
            left: `${arrow.x}%`,
            bottom: -30,
            width: arrow.size,
            height: arrow.size * 1.5
          }}
          animate={{
            y: [0, -400],
            opacity: [0, 1, 1, 0],
            scale: [0.8, 1, 0.8]
          }}
          transition={{
            duration: 3,
            delay: arrow.delay,
            repeat: Infinity,
            ease: 'easeOut'
          }}
        >
          <svg viewBox="0 0 24 36" className="w-full h-full">
            <path
              d="M12 0 L24 18 L18 18 L18 36 L6 36 L6 18 L0 18 Z"
              fill="url(#arrowGreen)"
              style={{ filter: 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.8))' }}
            />
            <defs>
              <linearGradient id="arrowGreen" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#4ade80" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>
      ))}

      {/* Energy particles */}
      {Array.from({ length: 20 }, (_, i) => (
        <motion.div
          key={`energy-${i}`}
          className="absolute rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            bottom: 0,
            width: 4,
            height: 4,
            background: '#86efac',
            boxShadow: '0 0 10px #22c55e'
          }}
          animate={{
            y: [0, -300],
            opacity: [0.8, 0]
          }}
          transition={{
            duration: 2 + Math.random() * 2,
            delay: i * 0.15,
            repeat: Infinity
          }}
        />
      ))}
    </>
  );
};

// DIAMOND ELITE - Premium diamond effect
const DiamondEliteAnimation = ({ glowColor }) => {
  return (
    <>
      {/* Cyan diamond aura */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(6,182,212,0.4) 0%, rgba(34,211,238,0.2) 50%, transparent 70%)'
        }}
        animate={{
          opacity: [0.5, 0.9, 0.5],
          scale: [1, 1.02, 1]
        }}
        transition={{ duration: 2.5, repeat: Infinity }}
      />

      {/* Central rotating diamond */}
      <motion.div
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
        style={{ width: 80, height: 100 }}
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      >
        <svg viewBox="0 0 80 100" className="w-full h-full">
          <polygon
            points="40,0 80,35 40,100 0,35"
            fill="url(#eliteDiamond)"
            style={{ filter: 'drop-shadow(0 0 20px rgba(6, 182, 212, 0.9))' }}
          />
          <polygon
            points="40,0 55,35 40,70 25,35"
            fill="rgba(255,255,255,0.3)"
          />
          <defs>
            <linearGradient id="eliteDiamond" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a5f3fc" />
              <stop offset="50%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#0891b2" />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>

      {/* Orbiting small diamonds */}
      {Array.from({ length: 6 }, (_, i) => (
        <motion.div
          key={`orbit-${i}`}
          className="absolute top-1/2 left-1/2"
          style={{
            width: 16,
            height: 20,
            marginLeft: -8,
            marginTop: -10
          }}
          animate={{
            rotate: [i * 60, i * 60 + 360]
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'linear'
          }}
        >
          <motion.div
            style={{
              position: 'absolute',
              left: 80,
              width: 16,
              height: 20
            }}
          >
            <svg viewBox="0 0 16 20" className="w-full h-full">
              <polygon
                points="8,0 16,7 8,20 0,7"
                fill="#67e8f9"
                style={{ filter: 'drop-shadow(0 0 6px #22d3ee)' }}
              />
            </svg>
          </motion.div>
        </motion.div>
      ))}

      {/* Sparkle burst */}
      {Array.from({ length: 15 }, (_, i) => (
        <motion.div
          key={`burst-${i}`}
          className="absolute rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: 4,
            height: 4,
            background: '#a5f3fc',
            boxShadow: '0 0 10px #22d3ee'
          }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0.5, 2, 0.5]
          }}
          transition={{
            duration: 2,
            delay: i * 0.2,
            repeat: Infinity
          }}
        />
      ))}
    </>
  );
};

// VICTORY FIRE - Winning streak flames
const VictoryFireAnimation = ({ glowColor }) => {
  const flames = useMemo(() =>
    Array.from({ length: 15 }, (_, i) => ({
      id: i,
      x: 5 + i * 6.5,
      delay: i * 0.1,
      duration: 1.5 + Math.random() * 1,
      size: 40 + Math.random() * 30
    })), []
  );

  return (
    <>
      {/* Intense orange glow */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at bottom, rgba(249,115,22,0.5) 0%, rgba(234,88,12,0.3) 40%, transparent 70%)'
        }}
        animate={{ opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />

      {/* Victory flames */}
      {flames.map((flame) => (
        <motion.div
          key={flame.id}
          className="absolute bottom-0"
          style={{
            left: `${flame.x}%`,
            width: flame.size,
            height: flame.size * 2.5,
            background: 'linear-gradient(to top, #f97316 0%, #fb923c 30%, #fdba74 60%, transparent 100%)',
            borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
            filter: 'blur(3px)'
          }}
          animate={{
            height: [flame.size * 1.5, flame.size * 3, flame.size * 1.5],
            opacity: [0.7, 1, 0.7],
            x: [-5, 5, -5]
          }}
          transition={{
            duration: flame.duration,
            delay: flame.delay,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      ))}

      {/* Flying embers */}
      {Array.from({ length: 25 }, (_, i) => (
        <motion.div
          key={`ember-${i}`}
          className="absolute rounded-full"
          style={{
            left: `${10 + Math.random() * 80}%`,
            bottom: 0,
            width: 5 + Math.random() * 5,
            height: 5 + Math.random() * 5,
            background: i % 2 === 0 ? '#fcd34d' : '#fb923c'
          }}
          animate={{
            y: [0, -200 - Math.random() * 150],
            x: [(Math.random() - 0.5) * 100],
            opacity: [1, 0],
            scale: [1, 0.3]
          }}
          transition={{
            duration: 2 + Math.random() * 1.5,
            delay: i * 0.12,
            repeat: Infinity,
            ease: 'easeOut'
          }}
        />
      ))}

      {/* "W" victory symbol faint in background */}
      <motion.div
        className="absolute top-1/4 left-1/2 transform -translate-x-1/2 text-8xl font-black"
        style={{
          color: 'transparent',
          WebkitTextStroke: '2px rgba(251, 191, 36, 0.3)'
        }}
        animate={{ opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        W
      </motion.div>
    </>
  );
};

// DATA FLOW - ELO master digital effect
const DataFlowAnimation = ({ glowColor }) => {
  const dataStreams = useMemo(() =>
    Array.from({ length: 10 }, (_, i) => ({
      id: i,
      x: 5 + i * 10,
      delay: i * 0.2,
      speed: 2 + Math.random() * 2
    })), []
  );

  return (
    <>
      {/* Blue digital background */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(37,99,235,0.15) 50%, rgba(29,78,216,0.2) 100%)'
        }}
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'linear-gradient(rgba(59, 130, 246, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.4) 1px, transparent 1px)',
          backgroundSize: '30px 30px'
        }}
      />

      {/* Data streams */}
      {dataStreams.map((stream) => (
        <motion.div
          key={stream.id}
          className="absolute"
          style={{
            left: `${stream.x}%`,
            top: -20,
            width: 2,
            height: 60,
            background: 'linear-gradient(to bottom, transparent, #60a5fa, #3b82f6, transparent)'
          }}
          animate={{
            y: [0, 400]
          }}
          transition={{
            duration: stream.speed,
            delay: stream.delay,
            repeat: Infinity,
            ease: 'linear'
          }}
        />
      ))}

      {/* Floating numbers */}
      {Array.from({ length: 12 }, (_, i) => (
        <motion.div
          key={`num-${i}`}
          className="absolute font-mono text-blue-400 text-sm font-bold"
          style={{
            left: `${10 + Math.random() * 80}%`,
            top: `${Math.random() * 100}%`,
            textShadow: '0 0 10px #3b82f6'
          }}
          animate={{
            opacity: [0, 0.8, 0],
            y: [0, -30]
          }}
          transition={{
            duration: 3,
            delay: i * 0.3,
            repeat: Infinity
          }}
        >
          +{Math.floor(Math.random() * 50 + 10)}
        </motion.div>
      ))}

      {/* ELO counter */}
      <motion.div
        className="absolute bottom-4 right-4 font-mono text-xl font-bold text-blue-300"
        style={{ textShadow: '0 0 15px #3b82f6' }}
        animate={{
          opacity: [0.5, 1, 0.5]
        }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        ELO
      </motion.div>
    </>
  );
};

// PREDATOR EYES - Menacing hunter effect
const PredatorEyesAnimation = ({ glowColor }) => {
  return (
    <>
      {/* Dark menacing aura */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(220,38,38,0.3) 0%, rgba(127,29,29,0.2) 50%, rgba(0,0,0,0.5) 80%)'
        }}
        animate={{ opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Glowing eyes */}
      {[{ x: '30%', delay: 0 }, { x: '70%', delay: 0.1 }].map((eye, i) => (
        <motion.div
          key={`eye-${i}`}
          className="absolute"
          style={{
            left: eye.x,
            top: '25%',
            transform: 'translateX(-50%)'
          }}
        >
          {/* Eye glow */}
          <motion.div
            className="w-12 h-6 rounded-full"
            style={{
              background: 'radial-gradient(ellipse, #ef4444 0%, #dc2626 50%, transparent 70%)',
              boxShadow: '0 0 40px #ef4444, 0 0 80px rgba(239, 68, 68, 0.5)'
            }}
            animate={{
              opacity: [0.7, 1, 0.7],
              scale: [1, 1.1, 1]
            }}
            transition={{
              duration: 1.5,
              delay: eye.delay,
              repeat: Infinity
            }}
          />
          {/* Pupil */}
          <motion.div
            className="absolute top-1/2 left-1/2 w-3 h-4 rounded-full bg-black transform -translate-x-1/2 -translate-y-1/2"
            animate={{
              x: [-2, 2, -2]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />
        </motion.div>
      ))}

      {/* Blood-like drips from edges */}
      {Array.from({ length: 8 }, (_, i) => (
        <motion.div
          key={`drip-${i}`}
          className="absolute top-0"
          style={{
            left: `${10 + i * 12}%`,
            width: 4,
            background: 'linear-gradient(to bottom, #dc2626, transparent)',
            borderRadius: '0 0 50% 50%'
          }}
          animate={{
            height: [0, 50, 80, 0]
          }}
          transition={{
            duration: 4,
            delay: i * 0.5,
            repeat: Infinity
          }}
        />
      ))}

      {/* Menacing particles */}
      {Array.from({ length: 15 }, (_, i) => (
        <motion.div
          key={`menace-${i}`}
          className="absolute rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: 4 + Math.random() * 4,
            height: 4 + Math.random() * 4,
            background: '#ef4444',
            boxShadow: '0 0 10px #dc2626'
          }}
          animate={{
            opacity: [0, 0.8, 0],
            scale: [0.5, 1.5, 0.5]
          }}
          transition={{
            duration: 2,
            delay: i * 0.15,
            repeat: Infinity
          }}
        />
      ))}
    </>
  );
};

// LEGENDARY STARS - Season legend effect
const LegendaryStarsAnimation = ({ glowColor }) => {
  const stars = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 8 + Math.random() * 16,
      delay: Math.random() * 2,
      duration: 3 + Math.random() * 2
    })), []
  );

  return (
    <>
      {/* Majestic purple aura */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(168,85,247,0.4) 0%, rgba(139,92,246,0.25) 40%, rgba(124,58,237,0.15) 70%, transparent 90%)'
        }}
        animate={{
          opacity: [0.6, 1, 0.6],
          scale: [1, 1.02, 1]
        }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Twinkling legendary stars */}
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size
          }}
        >
          <motion.svg
            viewBox="0 0 24 24"
            className="w-full h-full"
            style={{ filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.9))' }}
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.2, 0.8],
              rotate: [0, 180, 360]
            }}
            transition={{
              duration: star.duration,
              delay: star.delay,
              repeat: Infinity
            }}
          >
            <polygon
              points="12,0 14.5,9 24,9.5 16.5,15 19,24 12,18.5 5,24 7.5,15 0,9.5 9.5,9"
              fill="url(#starGradient)"
            />
            <defs>
              <linearGradient id="starGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e9d5ff" />
                <stop offset="50%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
          </motion.svg>
        </motion.div>
      ))}

      {/* Central legendary emblem */}
      <motion.div
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.5, 0.3]
        }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        <div
          className="w-24 h-24 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(168,85,247,0.4) 0%, transparent 70%)',
            boxShadow: '0 0 60px rgba(168, 85, 247, 0.5)'
          }}
        />
      </motion.div>

      {/* Floating sparkle trails */}
      {Array.from({ length: 10 }, (_, i) => (
        <motion.div
          key={`trail-${i}`}
          className="absolute rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            bottom: 0,
            width: 3,
            height: 3,
            background: '#c4b5fd',
            boxShadow: '0 0 10px #a855f7'
          }}
          animate={{
            y: [0, -350],
            x: [0, (Math.random() - 0.5) * 100],
            opacity: [0, 1, 0]
          }}
          transition={{
            duration: 5,
            delay: i * 0.4,
            repeat: Infinity
          }}
        />
      ))}
    </>
  );
};

export default ProfileAnimation;
