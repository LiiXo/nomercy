const axios = require('axios');

// Discord OAuth Configuration
// These should match the NoMercy server configuration
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1448692234500059166';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
// Use custom protocol for callback - opens browser then redirects back to app
const REDIRECT_URI = 'iris://callback';
const DISCORD_API_BASE = 'https://discord.com/api/v10';

// OAuth scopes
const SCOPES = ['identify', 'email'];

/**
 * Generate Discord OAuth URL for authentication
 */
function startDiscordAuth() {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' ')
  });
  
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(code) {
  try {
    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI
    });

    const response = await axios.post(
      `${DISCORD_API_BASE}/oauth2/token`,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    throw new Error('Failed to exchange code for token');
  }
}

/**
 * Get Discord user information using access token
 */
async function getDiscordUser(accessToken) {
  try {
    const response = await axios.get(`${DISCORD_API_BASE}/users/@me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const user = response.data;
    
    // Build avatar URL
    let avatarUrl = null;
    if (user.avatar) {
      const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
      avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}`;
    } else {
      // Default Discord avatar
      const defaultIndex = parseInt(user.discriminator || '0') % 5;
      avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
    }

    return {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator || '0',
      avatar: user.avatar,
      avatarUrl: avatarUrl,
      email: user.email
    };
  } catch (error) {
    console.error('Get user error:', error.response?.data || error.message);
    throw new Error('Failed to get Discord user');
  }
}

/**
 * Refresh an expired access token
 */
async function refreshToken(refreshToken) {
  try {
    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });

    const response = await axios.post(
      `${DISCORD_API_BASE}/oauth2/token`,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Token refresh error:', error.response?.data || error.message);
    throw new Error('Failed to refresh token');
  }
}

/**
 * Revoke a Discord OAuth token
 */
async function revokeToken(token) {
  try {
    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      token: token
    });

    await axios.post(
      `${DISCORD_API_BASE}/oauth2/token/revoke`,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return true;
  } catch (error) {
    console.error('Token revoke error:', error.response?.data || error.message);
    return false;
  }
}

module.exports = {
  startDiscordAuth,
  exchangeCodeForToken,
  getDiscordUser,
  refreshToken,
  revokeToken,
  DISCORD_CLIENT_ID
};
