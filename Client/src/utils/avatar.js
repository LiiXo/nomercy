/**
 * Generate a default avatar URL based on username
 * Uses UI Avatars API with a colorful background based on the first character
 * @param {string} name - The username to generate an avatar for
 * @returns {string} - The avatar URL
 */
export const getDefaultAvatar = (name) => {
  if (!name) {
    return 'https://ui-avatars.com/api/?name=U&background=374151&color=fff&size=128&bold=true';
  }
  
  const colors = [
    'ef4444', 'f97316', 'f59e0b', 'eab308', '84cc16', '22c55e', 
    '14b8a6', '06b6d4', '0ea5e9', '3b82f6', '6366f1', '8b5cf6', 
    'a855f7', 'd946ef', 'ec4899', 'f43f5e'
  ];
  
  const colorIndex = name.charCodeAt(0) % colors.length;
  const initial = name.charAt(0).toUpperCase();
  
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=${colors[colorIndex]}&color=fff&size=128&bold=true`;
};

/**
 * Get the avatar URL for a user, falling back to default if none is set
 * @param {object} user - User object with avatar property
 * @returns {string} - The avatar URL
 */
export const getUserAvatar = (user) => {
  if (!user) return getDefaultAvatar(null);
  if (user.avatar) return user.avatar;
  return getDefaultAvatar(user.username || user.discordUsername);
};



















