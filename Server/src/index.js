import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Load env variables FIRST - this must happen before any other imports
dotenv.config();

// Socket.io instance
let io = null;

// Export getIO function for routes to use
export const getIO = () => io;

// Now import everything else using dynamic imports to ensure env is loaded
const startServer = async () => {
  const express = (await import('express')).default;
  const mongoose = (await import('mongoose')).default;
  const cors = (await import('cors')).default;
  const cookieParser = (await import('cookie-parser')).default;
  const passport = (await import('passport')).default;
  
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
  const { default: rankedMatchRoutes } = await import('./routes/rankedMatch.routes.js');
  await import('./config/passport.js');
  
  // Import Match model for cleanup job
  const Match = (await import('./models/Match.js')).default;

  const app = express();
  const PORT = process.env.PORT || 5000;

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
  app.use('/api/ranked-matches', rankedMatchRoutes);

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

  // Create HTTP server and Socket.io
  const httpServer = createServer(app);
  
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true
    }
  });

  // Socket.io connection handling
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Join user-specific room for notifications (matchmaking, etc.)
    socket.on('joinUserRoom', (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`Socket ${socket.id} joined user:${userId}`);
      }
    });
    
    // Leave user room
    socket.on('leaveUserRoom', (userId) => {
      if (userId) {
        socket.leave(`user:${userId}`);
        console.log(`Socket ${socket.id} left user:${userId}`);
      }
    });
    
    // Join match room
    socket.on('joinMatch', (matchId) => {
      socket.join(`match:${matchId}`);
      console.log(`Socket ${socket.id} joined match:${matchId}`);
    });
    
    // Leave match room
    socket.on('leaveMatch', (matchId) => {
      socket.leave(`match:${matchId}`);
      console.log(`Socket ${socket.id} left match:${matchId}`);
    });
    
    // Join ranked match room
    socket.on('joinRankedMatch', (matchId) => {
      socket.join(`ranked-match:${matchId}`);
      console.log(`Socket ${socket.id} joined ranked-match:${matchId}`);
    });
    
    // Leave ranked match room
    socket.on('leaveRankedMatch', (matchId) => {
      socket.leave(`ranked-match:${matchId}`);
      console.log(`Socket ${socket.id} left ranked-match:${matchId}`);
    });
    
    // Join matchmaking queue room
    socket.on('joinMatchmakingQueue', ({ gameMode, mode }) => {
      socket.join(`queue:${mode}:${gameMode}`);
      console.log(`Socket ${socket.id} joined queue:${mode}:${gameMode}`);
    });
    
    // Leave matchmaking queue room
    socket.on('leaveMatchmakingQueue', ({ gameMode, mode }) => {
      socket.leave(`queue:${mode}:${gameMode}`);
      console.log(`Socket ${socket.id} left queue:${mode}:${gameMode}`);
    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Connect to MongoDB and start server
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nomercy');
    console.log('✓ Connected to MongoDB');
    
    httpServer.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
      console.log('✓ Socket.io ready');
      
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
