import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import User from '../models/User.js';

const scopes = ['identify', 'email'];

// Get config from environment (dotenv should be loaded in index.js before this file)
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_CALLBACK_URL = process.env.DISCORD_CALLBACK_URL || 'http://localhost:5000/api/auth/discord/callback';

console.log('Passport Discord Config:', {
  clientID: DISCORD_CLIENT_ID ? '✓ Set' : '✗ Missing',
  clientSecret: DISCORD_CLIENT_SECRET ? '✓ Set' : '✗ Missing', 
  callbackURL: DISCORD_CALLBACK_URL
});

if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
  console.error('⚠️  WARNING: Discord OAuth credentials not set! Please configure DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET in .env');
}

passport.use(new DiscordStrategy({
  clientID: DISCORD_CLIENT_ID,
  clientSecret: DISCORD_CLIENT_SECRET,
  callbackURL: DISCORD_CALLBACK_URL,
  scope: scopes
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists
    let user = await User.findOne({ discordId: profile.id });

    if (user) {
      // Update Discord info on each login
      user.discordUsername = profile.username;
      user.discordAvatar = profile.avatar;
      user.discordEmail = profile.email;
      await user.save();
      return done(null, user);
    }

    // Create new user
    user = new User({
      discordId: profile.id,
      discordUsername: profile.username,
      discordAvatar: profile.avatar,
      discordEmail: profile.email,
      isProfileComplete: false
    });

    await user.save();
    return done(null, user);

  } catch (error) {
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});
