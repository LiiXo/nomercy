/**
 * XP/Level System - Exponential Progression
 * 
 * Max Level: 500
 * Progression: Soft exponential (each level requires slightly more XP)
 * 
 * Formula: XP_needed(level) = BASE + (level * MULTIPLIER)
 * 
 * Examples:
 * - Level 1 → 2:   55 XP
 * - Level 50 → 51: 300 XP
 * - Level 100 → 101: 555 XP
 * - Level 250 → 251: 1,305 XP
 * - Level 499 → 500: 2,550 XP
 * 
 * Total XP for max level: ~650,000 XP
 */

export const MAX_LEVEL = 500

// Progressive XP formula constants
const BASE_XP = 50      // Minimum XP per level
const MULTIPLIER = 5    // Additional XP per level increase

// Pre-calculated constants for quadratic formula
const A = MULTIPLIER / 2           // 2.5
const B = BASE_XP + MULTIPLIER / 2 // 52.5

/**
 * Get XP required for a specific level transition (level → level+1)
 * @param {number} level - Current level
 * @returns {number} XP needed to reach next level
 */
export const getXPNeededForLevel = (level) => {
  if (level < 1) return BASE_XP + MULTIPLIER
  if (level >= MAX_LEVEL) return 0
  return BASE_XP + (level * MULTIPLIER)
}

/**
 * Get total XP required to reach a specific level
 * Formula: BASE * (L-1) + MULTIPLIER * (L-1) * L / 2
 * @param {number} level - Target level (1-500)
 * @returns {number} Total XP required
 */
export const getXPForLevel = (level) => {
  if (level <= 1) return 0
  if (level > MAX_LEVEL) level = MAX_LEVEL
  
  const n = level - 1 // Number of level-ups needed
  return Math.floor(BASE_XP * n + MULTIPLIER * n * (n + 1) / 2)
}

/**
 * Get level from total XP using quadratic formula
 * Solving: XP = (MULTIPLIER/2) * n² + (BASE + MULTIPLIER/2) * n
 * @param {number} xp - Total XP
 * @returns {number} Current level (1-500)
 */
export const getLevelFromXP = (xp) => {
  if (xp <= 0) return 1
  
  // Quadratic formula: n = (-B + sqrt(B² + 4*A*XP)) / (2*A)
  const discriminant = B * B + 4 * A * xp
  const n = (-B + Math.sqrt(discriminant)) / (2 * A)
  const level = Math.floor(n) + 1
  
  return Math.min(level, MAX_LEVEL)
}

/**
 * Get XP progress within current level
 * @param {number} xp - Total XP
 * @returns {object} { level, currentXP, xpForNextLevel, progress }
 */
export const getXPProgress = (xp) => {
  if (xp < 0) xp = 0
  
  const level = getLevelFromXP(xp)
  
  if (level >= MAX_LEVEL) {
    return {
      level: MAX_LEVEL,
      currentXP: 0,
      xpForNextLevel: 0,
      progress: 100
    }
  }
  
  const xpForCurrentLevel = getXPForLevel(level)
  const xpNeeded = getXPNeededForLevel(level)
  const currentXP = xp - xpForCurrentLevel
  const progress = (currentXP / xpNeeded) * 100
  
  return {
    level,
    currentXP: Math.floor(currentXP),
    xpForNextLevel: xpNeeded,
    progress: Math.min(100, Math.max(0, progress))
  }
}

/**
 * Get the tier name for a level
 * @param {number} level - Level (1-500)
 * @returns {string} Tier name
 */
export const getTierName = (level) => {
  if (level <= 50) return 'Recruit'
  if (level <= 150) return 'Veteran'
  if (level <= 300) return 'Elite'
  if (level <= 450) return 'Master'
  return 'Legend'
}

/**
 * Get tier color for styling
 * @param {number} level - Level (1-500)
 * @returns {string} Tailwind color class
 */
export const getTierColor = (level) => {
  if (level <= 50) return 'text-gray-400'
  if (level <= 150) return 'text-blue-400'
  if (level <= 300) return 'text-purple-400'
  if (level <= 450) return 'text-orange-400'
  return 'text-yellow-400'
}

/**
 * Get XP required to reach max level
 * @returns {number} Total XP for max level
 */
export const getMaxXP = () => getXPForLevel(MAX_LEVEL)
