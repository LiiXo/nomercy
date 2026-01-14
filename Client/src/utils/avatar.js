/**
 * Generate a default avatar URL based on username
 * Uses UI Avatars API with a colorful background based on the first character
 * @param {string} name - The username to generate an avatar for
 * @returns {string} - The avatar URL
 */
export const getDefaultAvatar = (name) => {
  // Safe default for missing/invalid names
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return 'https://ui-avatars.com/api/?name=U&background=374151&color=fff&size=128&bold=true';
  }
  
  const colors = [
    'ef4444', 'f97316', 'f59e0b', 'eab308', '84cc16', '22c55e', 
    '14b8a6', '06b6d4', '0ea5e9', '3b82f6', '6366f1', '8b5cf6', 
    'a855f7', 'd946ef', 'ec4899', 'f43f5e'
  ];
  
  try {
    const safeName = name.trim();
    const colorIndex = safeName.charCodeAt(0) % colors.length;
    const initial = safeName.charAt(0).toUpperCase();
    
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=${colors[colorIndex]}&color=fff&size=128&bold=true`;
  } catch (e) {
    console.error('Error generating default avatar:', e);
    return 'https://ui-avatars.com/api/?name=U&background=374151&color=fff&size=128&bold=true';
  }
};

const API_URL = 'https://api-nomercy.ggsecure.io';

/**
 * Get the full avatar URL, handling custom uploads and Discord avatars
 * @param {string} avatar - The avatar path or URL
 * @returns {string|null} - The full avatar URL or null if invalid
 */
export const getAvatarUrl = (avatar) => {
  if (!avatar || typeof avatar !== 'string') return null;
  
  try {
    // Custom uploaded avatar - needs API URL prefix
    if (avatar.startsWith('/uploads/')) {
      return `${API_URL}${avatar}`;
    }
    // Already a full URL (Discord, etc.)
    return avatar;
  } catch (e) {
    console.error('Error processing avatar URL:', e);
    return null;
  }
};

/**
 * Get the avatar URL for a user, falling back to default if none is set
 * @param {object} user - User object with avatar property
 * @returns {string} - The avatar URL
 */
export const getUserAvatar = (user) => {
  if (!user) return getDefaultAvatar(null);
  
  // Check for avatar (can be custom upload or Discord URL)
  if (user.avatar) {
    return getAvatarUrl(user.avatar);
  }
  
  // Check for avatarUrl (virtual from backend)
  if (user.avatarUrl) {
    return getAvatarUrl(user.avatarUrl);
  }
  
  return getDefaultAvatar(user.username || user.discordUsername);
};




















