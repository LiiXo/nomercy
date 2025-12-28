import dotenv from 'dotenv';

// Load env variables FIRST - this must happen before any other imports
dotenv.config();

// Now import everything else using dynamic imports to ensure env is loaded
const startServer = async () => {
  const express = (await import('express')).default;
  const mongoose = (await import('mongoose')).default;
  const cors = (await import('cors')).default;
  const cookieParser = (await import('cookie-parser')).default;
  const passport = (await import('passport')).default;
  const { createServer } = await import('http');
  const { Server } = await import('socket.io');
  
  // Import routes and config AFTER dotenv is loaded
  const { default: authRoutes } = await import('./routes/auth.routes.js');
  const { default: userRoutes } = await import('./routes/user.routes.js');
  const { default: shopRoutes } = await import('./routes/shop.routes.js');
  const { default: rankingRoutes } = await import('./routes/ranking.routes.js');
  const { default: announcementRoutes } = await import('./routes/announcement.routes.js');
  const { default: spinRoutes } = await import('./routes/spin.routes.js');
  const { default: squadRoutes } = await import('./routes/squad.routes.js');
  const { default: trophyRoutes } = await import('./routes/trophy.routes.js');
  const { default: matchRoutes } = await import('./routes/match.routes.js');
  const { default: messageRoutes } = await import('./routes/message.routes.js');
  const { default: rankedMatchRoutes } = await import('./routes/rankedMatch.routes.js');
  const { default: configRoutes } = await import('./routes/config.routes.js');
  const { default: gameModeRulesRoutes } = await import('./routes/gameModeRules.routes.js');
  const { default: hubRoutes } = await import('./routes/hub.routes.js');
  const { default: ladderRulesRoutes } = await import('./routes/ladderRules.routes.js');
  const { default: mapRoutes } = await import('./routes/map.routes.js');
  const { default: ruleRoutes } = await import('./routes/rule.routes.js');
  const { default: seasonRoutes } = await import('./routes/season.routes.js');
  const { default: appSettingsRoutes } = await import('./routes/appSettings.routes.js');
  const { default: systemRoutes } = await import('./routes/system.routes.js');
  await import('./config/passport.js');
  
  // Import Match model for cleanup job
  const Match = (await import('./models/Match.js')).default;

  const app = express();
  const httpServer = createServer(app);
  const PORT = process.env.PORT || 5000;

  // Socket.io configuration
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Track page viewers
  const pageViewers = new Map();
  // Track which pages each socket has joined (socket.rooms is empty on disconnect)
  const socketPages = new Map();

  // Socket.io event handlers
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socketPages.set(socket.id, new Set());

    socket.on('joinPage', ({ page }) => {
      socket.join(page);
      socketPages.get(socket.id)?.add(page);
      const count = (pageViewers.get(page) || 0) + 1;
      pageViewers.set(page, count);
      io.to(page).emit('viewerCount', count);
    });

    socket.on('leavePage', ({ page }) => {
      socket.leave(page);
      socketPages.get(socket.id)?.delete(page);
      const count = Math.max(0, (pageViewers.get(page) || 1) - 1);
      pageViewers.set(page, count);
      io.to(page).emit('viewerCount', count);
    });

    socket.on('joinRankedMatch', (matchId) => {
      socket.join(`ranked-match-${matchId}`);
    });

    socket.on('leaveRankedMatch', (matchId) => {
      socket.leave(`ranked-match-${matchId}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      // Decrement viewer count for all pages this socket was in
      const pages = socketPages.get(socket.id);
      if (pages) {
        pages.forEach((page) => {
          const count = Math.max(0, (pageViewers.get(page) || 1) - 1);
          pageViewers.set(page, count);
          io.to(page).emit('viewerCount', count);
        });
        socketPages.delete(socket.id);
      }
    });
  });

  // Make io accessible to routes
  app.set('io', io);

  // Log config for debugging
  console.log('=== Server Configuration ===');
  console.log('PORT:', PORT);
  console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✓ Set' : '✗ Missing');
  console.log('DISCORD_CLIENT_ID:', process.env.DISCORD_CLIENT_ID ? '✓ Set' : '✗ Missing');
  console.log('DISCORD_CLIENT_SECRET:', process.env.DISCORD_CLIENT_SECRET ? '✓ Set' : '✗ Missing');
  console.log('DISCORD_CALLBACK_URL:', process.env.DISCORD_CALLBACK_URL || '✗ Missing');
  console.log('CLIENT_URL:', process.env.CLIENT_URL || 'http://localhost:5173');
  console.log('============================');

  // Middleware
  app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
  }));
  app.use(express.json({ limit: '10mb' })); // Increased limit for image uploads (base64)
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.use(cookieParser());
  app.use(passport.initialize());

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/shop', shopRoutes);
  app.use('/api/rankings', rankingRoutes);
  app.use('/api/announcements', announcementRoutes);
  app.use('/api/spin', spinRoutes);
  app.use('/api/squads', squadRoutes);
  app.use('/api/trophies', trophyRoutes);
  app.use('/api/matches', matchRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/ranked-matches', rankedMatchRoutes);
  app.use('/api/config', configRoutes);
  app.use('/api/game-mode-rules', gameModeRulesRoutes);
  app.use('/api/hub', hubRoutes);
  app.use('/api/ladder-rules', ladderRulesRoutes);
  app.use('/api/maps', mapRoutes);
  app.use('/api/rules', ruleRoutes);
  app.use('/api/seasons', seasonRoutes);
  app.use('/api/app-settings', appSettingsRoutes);
  app.use('/api/system', systemRoutes);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'NoMercy API is running' });
  });

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Something went wrong!',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  });

  // Connect to MongoDB and start server
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nomercy');
    console.log('✓ Connected to MongoDB');
    
    httpServer.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
      console.log('✓ Socket.io enabled');
      
      // Job de nettoyage des matchs expirés - toutes les 5 minutes
      const cleanupExpiredMatches = async () => {
        try {
          const result = await Match.updateMany(
            { 
              status: 'pending', 
              scheduledAt: { $lt: new Date() } 
            },
            { status: 'expired' }
          );
          if (result.modifiedCount > 0) {
            console.log(`✓ ${result.modifiedCount} matchs expirés nettoyés`);
          }
        } catch (err) {
          console.error('Erreur nettoyage matchs:', err);
        }
      };
      
      // Exécuter immédiatement puis toutes les 5 minutes
      cleanupExpiredMatches();
      setInterval(cleanupExpiredMatches, 5 * 60 * 1000);
    });
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

startServer();
