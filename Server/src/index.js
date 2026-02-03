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
  const { default: helperConfirmationRoutes } = await import('./routes/helperConfirmation.routes.js');
  const { default: strickerMatchRoutes } = await import('./routes/strickerMatch.routes.js');
  const { default: teamRoutes } = await import('./routes/team.routes.js');
  const { default: irisRoutes } = await import('./routes/iris.routes.js');
  await import('./config/passport.js');
  
  // Import Match model for cleanup job
  const Match = (await import('./models/Match.js')).default;
  
  // Import monthly reset service for ladder season reset
  const { scheduleMonthlyLadderReset } = await import('./services/monthlyReset.service.js');
  
  // Import ranked season reset service for automatic season reset
  const { scheduleAutomaticSeasonReset } = await import('./services/rankedSeasonReset.service.js');
  
  // Import auto-unban service for automatic player unbanning when ban expires
  const { scheduleAutoUnban } = await import('./services/autoUnban.service.js');
  
  // Import ranked matchmaking service
  const { initMatchmaking, handleMapVote, handleRosterPick, getGlobalQueueCount } = await import('./services/rankedMatchmaking.service.js');
  
  // Import GGSecure monitoring service
  const { initGGSecureMonitoring, startGGSecureMonitoring, checkPlayerGGSecureOnJoin } = await import('./services/ggsecureMonitoring.service.js');

  // Import Discord bot service
  const { initDiscordBot, setShuttingDown } = await import('./services/discordBot.service.js');

  const app = express();
  const httpServer = createServer(app);
  const PORT = process.env.PORT || 5000;
  
  // Import path for static files
  const path = (await import('path')).default;
  const { fileURLToPath } = await import('url');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Liste des origines autorisées
  const allowedOrigins = [
    process.env.CLIENT_URL || 'http://localhost:5173',
    'https://app.ggsecure.io',
    'https://nomercy.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ].filter(Boolean);

  // Socket.io configuration
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Track page viewers
  const pageViewers = new Map();
  // Track which pages each socket has joined (socket.rooms is empty on disconnect)
  const socketPages = new Map();
  
  // Track users by mode (hardcore vs cdl)
  const modeUsers = new Map(); // mode -> Set of socketIds
  modeUsers.set('hardcore', new Set());
  modeUsers.set('cdl', new Set());
  // Track which mode each socket is in
  const socketMode = new Map(); // socketId -> mode

  // Helper function to broadcast total online users count
  const broadcastTotalOnlineUsers = () => {
    const totalOnline = io.engine.clientsCount;
    io.emit('totalOnlineUsers', totalOnline);
  };
  
  // Helper function to broadcast mode-specific online users count
  const broadcastModeOnlineUsers = (mode) => {
    const count = modeUsers.get(mode)?.size || 0;
    io.to(`mode-${mode}`).emit('modeOnlineUsers', { mode, count });
  };

  // Track user socket connections for direct messaging
  const userSockets = new Map(); // userId -> Set of socketIds

  // Socket.io event handlers
  io.on('connection', (socket) => {
    socketPages.set(socket.id, new Set());
    
    // Emit total online users count to all clients
    broadcastTotalOnlineUsers();

    // Join user's personal room for direct notifications (helper confirmations, etc.)
    socket.on('joinUserRoom', (userId) => {
      if (userId) {
        socket.join(`user-${userId}`);
        socket.userId = userId;
        
        // Track user's socket connections
        if (!userSockets.has(userId)) {
          userSockets.set(userId, new Set());
        }
        userSockets.get(userId).add(socket.id);
        
      }
    });

    socket.on('leaveUserRoom', (userId) => {
      if (userId) {
        socket.leave(`user-${userId}`);
        
        // Remove from user sockets tracking
        if (userSockets.has(userId)) {
          userSockets.get(userId).delete(socket.id);
          if (userSockets.get(userId).size === 0) {
            userSockets.delete(userId);
          }
        }
        
      }
    });

    socket.on('joinPage', ({ page }) => {
      socket.join(page);
      socketPages.get(socket.id)?.add(page);
      const count = (pageViewers.get(page) || 0) + 1;
      pageViewers.set(page, count);
      io.to(page).emit('viewerCount', count);
      
      // If joining ranked-mode page, emit current queue count to this socket
      if (page.startsWith('ranked-mode-')) {
        const mode = page.replace('ranked-mode-', '');
        if (mode === 'hardcore' || mode === 'cdl') {
          const queueCount = getGlobalQueueCount(mode);
          socket.emit('rankedGlobalQueueCount', { count: queueCount, mode });
        }
      }
    });

    socket.on('leavePage', ({ page }) => {
      socket.leave(page);
      socketPages.get(socket.id)?.delete(page);
      const count = Math.max(0, (pageViewers.get(page) || 1) - 1);
      pageViewers.set(page, count);
      io.to(page).emit('viewerCount', count);
    });

    // Join a mode room (hardcore or cdl) to track online users per mode
    socket.on('joinMode', (mode) => {
      if (mode === 'hardcore' || mode === 'cdl') {
        // Leave previous mode if any
        const previousMode = socketMode.get(socket.id);
        if (previousMode && previousMode !== mode) {
          socket.leave(`mode-${previousMode}`);
          modeUsers.get(previousMode)?.delete(socket.id);
          broadcastModeOnlineUsers(previousMode);
        }
        
        // Join new mode
        socket.join(`mode-${mode}`);
        modeUsers.get(mode)?.add(socket.id);
        socketMode.set(socket.id, mode);
        broadcastModeOnlineUsers(mode);
        
        // Send current count to the joining socket
        const count = modeUsers.get(mode)?.size || 0;
        socket.emit('modeOnlineUsers', { mode, count });
      }
    });

    socket.on('leaveMode', (mode) => {
      if (mode === 'hardcore' || mode === 'cdl') {
        socket.leave(`mode-${mode}`);
        modeUsers.get(mode)?.delete(socket.id);
        socketMode.delete(socket.id);
        broadcastModeOnlineUsers(mode);
      }
    });

    socket.on('joinRankedMatch', (matchId) => {
      const roomName = `ranked-match-${matchId}`;
      socket.join(roomName);
      
      // Vérifier le statut GGSecure du joueur qui rejoint
      // Cela permet de détecter si un joueur a désactivé GGSecure pendant la recherche
      if (socket.userId) {
        checkPlayerGGSecureOnJoin(matchId, socket.userId).catch(err => {
          console.error('[Socket] Error checking GGSecure on join:', err);
        });
      }
    });

    socket.on('leaveRankedMatch', (matchId) => {
      const roomName = `ranked-match-${matchId}`;
      socket.leave(roomName);
    });

    socket.on('joinStrickerMatch', (matchId) => {
      const roomName = `stricker-match-${matchId}`;
      socket.join(roomName);
      
      // Vérifier le statut GGSecure du joueur qui rejoint
      // Cela permet de détecter si un joueur a désactivé GGSecure pendant la recherche
      if (socket.userId) {
        checkPlayerGGSecureOnJoin(matchId, socket.userId, 'stricker').catch(err => {
          console.error('[Socket] Error checking GGSecure on join for Stricker match:', err);
        });
      }
    });

    socket.on('leaveStrickerMatch', (matchId) => {
      const roomName = `stricker-match-${matchId}`;
      socket.leave(roomName);
    });

    // Join/Leave Stricker mode room (for match created notifications)
    socket.on('joinStrickerMode', () => {
      socket.join('stricker-mode');
    });

    socket.on('leaveStrickerMode', () => {
      socket.leave('stricker-mode');
    });

    // Map vote for ranked matches
    socket.on('mapVote', async ({ matchId, mapIndex }) => {
      if (socket.userId && matchId !== undefined && mapIndex !== undefined) {
        const result = await handleMapVote(socket.userId, matchId, mapIndex);
        if (!result.success) {
          socket.emit('mapVoteError', { message: result.message });
        }
      }
    });

    // Roster pick for ranked test matches
    socket.on('rosterPick', async ({ matchId, playerId }) => {
      if (socket.userId && matchId && playerId) {
        const result = await handleRosterPick(socket.userId, matchId, playerId);
        if (!result.success) {
          socket.emit('rosterPickError', { message: result.message });
        }
      }
    });

    // Ladder match rooms
    socket.on('joinMatch', (matchId) => {
      socket.join(`match-${matchId}`);
    });

    socket.on('leaveMatch', (matchId) => {
      socket.leave(`match-${matchId}`);
    });

    socket.on('disconnect', () => {
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
      
      // Clean up mode tracking
      const mode = socketMode.get(socket.id);
      if (mode) {
        modeUsers.get(mode)?.delete(socket.id);
        socketMode.delete(socket.id);
        broadcastModeOnlineUsers(mode);
      }
      
      // Clean up user socket tracking
      if (socket.userId && userSockets.has(socket.userId)) {
        userSockets.get(socket.userId).delete(socket.id);
        if (userSockets.get(socket.userId).size === 0) {
          userSockets.delete(socket.userId);
        }
      }
      
      // Emit updated total online users count
      broadcastTotalOnlineUsers();
    });
  });

  // Make io accessible to routes
  app.set('io', io);
  
  // Initialize ranked matchmaking service with Socket.io
  initMatchmaking(io);
  
  // Initialize GGSecure monitoring service with Socket.io
  initGGSecureMonitoring(io);

  // Log config for debugging

  // Middleware
  app.use(cors({
    origin: function(origin, callback) {
      // Autoriser les requêtes sans origine (comme les apps mobiles ou curl)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Autoriser quand même pour éviter les erreurs
      }
    },
    credentials: true
  }));
  app.use(express.json({ limit: '10mb' })); // Increased limit for image uploads (base64)
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.use(cookieParser());
  app.use(passport.initialize());

  // Serve static files from uploads directory
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
  
  // Serve static files from public directory (sounds, etc.)
  app.use('/public', express.static(path.join(__dirname, '../public')));

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
  app.use('/api/helper-confirmation', helperConfirmationRoutes);
  app.use('/api/stricker', strickerMatchRoutes);
  app.use('/api/team', teamRoutes);
  app.use('/api/iris', irisRoutes);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'NoMercy API is running' });
  });

  // Error handling middleware (with CORS headers)
  app.use((err, req, res, next) => {
    console.error(err.stack);
    
    // Ensure CORS headers are set even for errors
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Something went wrong!',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  });

  // Connect to MongoDB and start server
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nomercy');
    
    httpServer.listen(PORT, () => {
      
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
          }
        } catch (err) {
          console.error('Erreur nettoyage matchs:', err);
        }
      };
      
      // Exécuter immédiatement puis toutes les 5 minutes
      cleanupExpiredMatches();
      setInterval(cleanupExpiredMatches, 5 * 60 * 1000);
      
      // Schedule monthly ladder season reset (runs at 00:05 on the 1st of each month)
      scheduleMonthlyLadderReset();
      
      // DISABLED: Automatic ranked season reset - now manual via admin panel
      // scheduleAutomaticSeasonReset();
      
      // Start GGSecure monitoring for active matches
      startGGSecureMonitoring();
      
      // Initialize Discord Arbitrage bot
      initDiscordBot().catch(err => console.error('Discord bot init error:', err));
      
      // Schedule automatic unban checks (runs every minute)
      scheduleAutoUnban();
      
      // Graceful shutdown handler - preserve Discord voice channels on restart
      const gracefulShutdown = async (signal) => {
        
        // Mark as shutting down to prevent voice channel deletion
        setShuttingDown(true);
        
        // Wait a moment to ensure any in-flight requests complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Close HTTP server
        httpServer.close(() => {
        });
        
        // Close MongoDB connection
        try {
          await mongoose.connection.close();
        } catch (err) {
          console.error('[Server] Error closing MongoDB:', err);
        }
        
        process.exit(0);
      };
      
      // Handle shutdown signals
      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));
      
      // Handle uncaught exceptions gracefully
      process.on('uncaughtException', (err) => {
        console.error('[Server] Uncaught exception:', err);
        setShuttingDown(true); // Protect channels even on crash
      });
    });
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

startServer();
