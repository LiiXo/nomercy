import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ProfileAnimation = ({ animationData, className = '' }) => {
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
      default:
        return null;
    }
  };

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden rounded-2xl ${className}`}>
      {renderAnimation()}
      {/* Center safe zone - gradient mask to keep player info visible */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(0,0,0,0.5) 0%, transparent 70%)'
        }}
      />
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

export default ProfileAnimation;
