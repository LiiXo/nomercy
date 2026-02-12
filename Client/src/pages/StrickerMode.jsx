import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useAuth } from '../AuthContext';
import { useSocket } from '../SocketContext';
import { useData } from '../DataContext';
import { getUserAvatar } from '../utils/avatar';
import { 
  Trophy, Crown, Zap, Shield, Target, Loader2, TrendingUp, Swords, Lock, 
  Users, Clock, Play, Square, AlertTriangle, ShieldCheck, Crosshair, 
  Medal, Star, ChevronRight, Flame, Sparkles, Eye, Bot, Radio, BookOpen, Coins, X, Map, ShoppingCart, RotateCcw
} from 'lucide-react';

import { API_URL } from '../config';

// Stricker Ranks - 6 ranks with apple green theme
const STRICKER_RANKS = {
  recrues: { 
    key: 'recrues', 
    name: 'Recrues', 
    min: 0, 
    max: 249, 
    pointsWin: 30,
    pointsLoss: -15,
    color: '#7ED321', 
    gradient: 'from-lime-600 to-green-700', 
    icon: Shield, 
    image: '/stricker1.png' 
  },
  operateurs: { 
    key: 'operateurs', 
    name: 'Opérateurs', 
    min: 250, 
    max: 499, 
    pointsWin: 30,
    pointsLoss: -20,
    color: '#7ED321', 
    gradient: 'from-lime-500 to-green-600', 
    icon: Shield, 
    image: '/stricker2.png' 
  },
  veterans: { 
    key: 'veterans', 
    name: 'Vétérans', 
    min: 500, 
    max: 749, 
    pointsWin: 30,
    pointsLoss: -25,
    color: '#7ED321', 
    gradient: 'from-lime-400 to-green-500', 
    icon: Medal, 
    image: '/stricker3.png' 
  },
  commandants: { 
    key: 'commandants', 
    name: 'Commandants', 
    min: 750, 
    max: 999, 
    pointsWin: 30,
    pointsLoss: -30,
    color: '#7ED321', 
    gradient: 'from-green-400 to-emerald-500', 
    icon: Medal, 
    image: '/stricker4.png' 
  },
  seigneurs: { 
    key: 'seigneurs', 
    name: 'Seigneurs de Guerre', 
    min: 1000, 
    max: 1499, 
    pointsWin: 30,
    pointsLoss: -40,
    color: '#7ED321', 
    gradient: 'from-emerald-400 to-teal-500', 
    icon: Crown, 
    image: '/stricker5.png' 
  },
  immortel: { 
    key: 'immortel', 
    name: 'Immortel', 
    min: 1500, 
    max: null, 
    pointsWin: 30,
    pointsLoss: -50,
    color: '#7ED321', 
    gradient: 'from-teal-400 via-emerald-500 to-lime-600', 
    icon: Zap, 
    image: '/stricker6.png' 
  }
};

// Helper to get rank from points
const getStrickerRank = (points) => {
  if (points >= 1500) return STRICKER_RANKS.immortel;
  if (points >= 1000) return STRICKER_RANKS.seigneurs;
  if (points >= 750) return STRICKER_RANKS.commandants;
  if (points >= 500) return STRICKER_RANKS.veterans;
  if (points >= 250) return STRICKER_RANKS.operateurs;
  return STRICKER_RANKS.recrues;
};

// Cooldown Button Component - Shows live countdown, then challenge button when ready
const CooldownButton = ({ cooldownEndsAt, onCooldownEnd, onChallenge, isDisabled, isLoading, buttonGradient }) => {
  const [remaining, setRemaining] = useState(cooldownEndsAt - Date.now());
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    if (remaining <= 0) {
      setIsReady(true);
      if (onCooldownEnd) onCooldownEnd();
      return;
    }
    
    const interval = setInterval(() => {
      const newRemaining = cooldownEndsAt - Date.now();
      setRemaining(newRemaining);
      if (newRemaining <= 0) {
        setIsReady(true);
        if (onCooldownEnd) onCooldownEnd();
        clearInterval(interval);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [cooldownEndsAt, onCooldownEnd, remaining]);
  
  // Cooldown finished - show challenge button
  if (isReady || remaining <= 0) {
    return (
      <button
        onClick={onChallenge}
        disabled={isDisabled}
        className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${
          !isDisabled
            ? `bg-gradient-to-r ${buttonGradient} text-white`
            : 'bg-dark-700 text-gray-500 cursor-not-allowed'
        }`}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Swords className="w-4 h-4 animate-pulse" />
        )}
        On vous provoque !
      </button>
    );
  }
  
  // Still on cooldown - show countdown
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  
  const timeStr = hours > 0 
    ? `${hours}h${minutes.toString().padStart(2, '0')}m` 
    : `${minutes}m${seconds.toString().padStart(2, '0')}s`;
  
  return (
    <button
      disabled
      className="px-4 py-2 rounded-lg font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-2 cursor-not-allowed"
    >
      <Clock className="w-4 h-4 animate-pulse" />
      {timeStr}
    </button>
  );
};

// Translations
const translations = {
  fr: {
    title: 'Mode Stricker',
    subtitle: 'Recherche et Destruction 5v5',
    restricted: 'Accès réservé aux administrateurs, staff et arbitres',
    myRank: 'Mon Escouade',
    points: 'Points',
    wins: 'Victoires',
    losses: 'Défaites',
    winRate: 'Taux de victoire',
    squadLeaderboard: 'Classement des Escouades',
    noSquad: 'Aucune escouade',
    joinQueue: 'Rechercher un match',
    leaveQueue: 'Quitter la file',
    inQueue: 'En recherche...',
    playersInQueue: 'joueurs dans la file',
    matchFound: 'Match trouvé !',
    format: 'Format',
    gameMode: 'Mode de jeu',
    searchDestroy: 'Recherche et Destruction',
    loading: 'Chargement...',
    noAccess: 'Accès non autorisé',
    backToHome: 'Retour à l\'accueil',
    nextRank: 'Prochain rang',
    pointsToNext: 'points pour le prochain rang',
    position: 'Position',
    squadName: 'Escouade',
    squadPoints: 'Points escouade',
    needSquad: 'Vous devez être dans une escouade pour jouer',
    needMoreMembers: 'Votre escouade doit avoir au moins 5 membres',
    currentMembers: 'membres actuels',
    ranksTitle: 'Progression des Rangs',
    online: 'En ligne',
    squadsSearching: 'escouade(s) en recherche',
    needLeaderOrOfficer: 'Seul le leader ou un officier peut lancer la recherche',
    youAre: 'Vous êtes',
    joinTheFight: 'Rejoindre le combat !',
    crushThem: 'Aller les défoncer !',
    viewMaps: 'Voir les cartes',
    viewRules: 'Voir les règles',
    availableMaps: 'Cartes disponibles',
    strickerRules: 'Règles du Mode Stricker',
    noMaps: 'Aucune carte disponible',
    close: 'Fermer',
    noRules: 'Aucune règle disponible pour le moment',
    recentMatches: 'Derniers matchs',
    vs: 'vs',
    victory: 'Victoire',
    defeat: 'Défaite',
    squadsChallenging: 'Escouades en recherche',
    challenge: 'Défier',
    provocation: 'On vous provoque !',
    mustChallenge: 'Une escouade vous attend !',
    unknownSquad: 'Escouade mystère',
    activeMatchFound: 'Match en cours détecté',
    activeMatchDesc: 'Vous avez un match en cours. Vous devez le terminer avant d\'en lancer un autre.',
    rejoin: 'Rejoindre le match',
    cranes: 'Munitions',
    shop: 'Boutique',
    activeMatches: 'match(s) en cours',
    playersInMatch: 'joueurs en match',
    noActiveMatches: 'Aucun match en cours actuellement'
  },
  en: {
    title: 'Stricker Mode',
    subtitle: 'Search and Destroy 5v5',
    restricted: 'Access restricted to administrators, staff and referees',
    myRank: 'My Squad',
    points: 'Points',
    wins: 'Wins',
    losses: 'Losses',
    winRate: 'Win Rate',
    squadLeaderboard: 'Squad Leaderboard',
    noSquad: 'No squad',
    joinQueue: 'Search for match',
    leaveQueue: 'Leave queue',
    inQueue: 'Searching...',
    playersInQueue: 'players in queue',
    matchFound: 'Match found!',
    format: 'Format',
    gameMode: 'Game Mode',
    searchDestroy: 'Search and Destroy',
    loading: 'Loading...',
    noAccess: 'Access denied',
    backToHome: 'Back to home',
    nextRank: 'Next rank',
    pointsToNext: 'points to next rank',
    position: 'Position',
    squadName: 'Squad',
    squadPoints: 'Squad points',
    needSquad: 'You must be in a squad to play',
    needMoreMembers: 'Your squad must have at least 5 members',
    currentMembers: 'current members',
    ranksTitle: 'Rank Progression',
    online: 'Online',
    squadsSearching: 'squad(s) searching',
    needLeaderOrOfficer: 'Only the leader or an officer can start the search',
    youAre: 'You are',
    joinTheFight: 'Join the fight!',
    crushThem: 'Go crush them!',
    viewMaps: 'View Maps',
    viewRules: 'View Rules',
    availableMaps: 'Available Maps',
    strickerRules: 'Stricker Mode Rules',
    noMaps: 'No maps available',
    close: 'Close',
    noRules: 'No rules available at the moment',
    recentMatches: 'Recent matches',
    vs: 'vs',
    victory: 'Victory',
    defeat: 'Defeat',
    squadsChallenging: 'Squads looking for a match',
    challenge: 'Challenge',
    provocation: 'We challenge you!',
    mustChallenge: 'A squad is waiting for you!',
    unknownSquad: 'Mystery squad',
    activeMatchFound: 'Active match detected',
    activeMatchDesc: 'You have a match in progress. You must finish it before starting another.',
    rejoin: 'Rejoin match',
    cranes: 'Ammo',
    shop: 'Shop',
    activeMatches: 'active match(es)',
    playersInMatch: 'players in match',
    noActiveMatches: 'No active matches currently'
  },
};

const StrickerMode = () => {
  const { language } = useLanguage();
  const { user, isAuthenticated, hasAdminAccess, isAdmin } = useAuth();
  const { isConnected, on, joinStrickerMode, leaveStrickerMode } = useSocket();
  const { isStrickerModeEnabled } = useData();
  const navigate = useNavigate();
  const { mode } = useParams(); // hardcore or cdl from URL
  
  const t = translations[language] || translations.en;
  
  // State
  const [loading, setLoading] = useState(true);
  const [myRanking, setMyRanking] = useState(null);
  const [squadLeaderboard, setSquadLeaderboard] = useState([]);
  const [userSquadPosition, setUserSquadPosition] = useState(null); // Position de l'escouade du joueur si hors top 15
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [inQueue, setInQueue] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [joiningQueue, setJoiningQueue] = useState(false);
  const [leavingQueue, setLeavingQueue] = useState(false);
  const [activeMatch, setActiveMatch] = useState(null);
  const [error, setError] = useState(null);
  const [matchmakingEnabled, setMatchmakingEnabled] = useState(true);
  const [mySquad, setMySquad] = useState(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [squadsSearching, setSquadsSearching] = useState(0);
  const [searchingSquads, setSearchingSquads] = useState([]); // List of squads to challenge
  const [challengingSquad, setChallengingSquad] = useState(null); // Squad being challenged
  const [showMapsModal, setShowMapsModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [availableMaps, setAvailableMaps] = useState([]);
  const [loadingMaps, setLoadingMaps] = useState(false);
  const [rules, setRules] = useState(null);
  const [loadingRules, setLoadingRules] = useState(false);
  const [ggsecureConnected, setGgsecureConnected] = useState(null); // GGSecure connection status for PC players
  const [currentSeason, setCurrentSeason] = useState(null); // Current Stricker season info
  const [seasonCountdown, setSeasonCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 }); // Countdown to next season
  const [showTop100Modal, setShowTop100Modal] = useState(false); // Top 100 modal
  const [top100Squads, setTop100Squads] = useState([]); // Top 100 squads data
  const [loadingTop100, setLoadingTop100] = useState(false); // Loading state for top 100
  const [activeMatchesStats, setActiveMatchesStats] = useState({ totalMatches: 0, totalPlayers: 0 }); // Active matches stats
  const [recentMatches, setRecentMatches] = useState([]);
  const [resettingCooldowns, setResettingCooldowns] = useState(false);
  const [cooldownResetSuccess, setCooldownResetSuccess] = useState(null);
  
  // Check access - allow everyone if Stricker mode is enabled, otherwise only admin/staff/arbitre
  const hasAccess = isAuthenticated && (isStrickerModeEnabled || hasAdminAccess());
  
  // Fetch my ranking
  const fetchMyRanking = useCallback(async () => {
    if (!hasAccess) return;
    
    try {
      const response = await fetch(`${API_URL}/stricker/my-ranking`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setMyRanking(data.ranking);
      }
    } catch (err) {
      console.error('Error fetching stricker ranking:', err);
    } finally {
      setLoading(false);
    }
  }, [hasAccess]);
  
  // Fetch squad leaderboard
  const fetchSquadLeaderboard = useCallback(async () => {
    if (!hasAccess) return;
    
    try {
      setLoadingLeaderboard(true);
      const response = await fetch(`${API_URL}/stricker/leaderboard/squads`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setSquadLeaderboard(data.top15 || []);
        setUserSquadPosition(data.userSquad || null);
      }
    } catch (err) {
      console.error('Error fetching stricker leaderboard:', err);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, [hasAccess]);
  
  // Fetch top 100 squads
  const fetchTop100 = useCallback(async () => {
    if (!hasAccess) return;
    
    try {
      setLoadingTop100(true);
      const response = await fetch(`${API_URL}/stricker/leaderboard/squads/top100`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setTop100Squads(data.squads || []);
      }
    } catch (err) {
      console.error('Error fetching top 100:', err);
    } finally {
      setLoadingTop100(false);
    }
  }, [hasAccess]);
  
  // Open top 100 modal
  const handleOpenTop100 = () => {
    setShowTop100Modal(true);
    fetchTop100();
  };
  
  // Fetch matchmaking status
  const fetchMatchmakingStatus = useCallback(async () => {
    if (!hasAccess) return;
    
    try {
      const response = await fetch(`${API_URL}/stricker/matchmaking/status?mode=${mode || 'hardcore'}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setInQueue(data.inQueue || false);
        setQueueSize(data.queueSize || 0);
        setActiveMatch(data.match || null);
        setOnlineCount(data.onlineCount || 0);
        setSquadsSearching(data.squadsSearching || 0);
        setSearchingSquads(data.searchingSquads || []);
      }
    } catch (err) {
      console.error('Error fetching matchmaking status:', err);
    }
  }, [hasAccess, mode]);
  
  // Fetch config
  const fetchConfig = useCallback(async () => {
    if (!hasAccess) return;
    
    try {
      const response = await fetch(`${API_URL}/stricker/config`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setMatchmakingEnabled(data.config?.matchmakingEnabled !== false);
      }
    } catch (err) {
      console.error('Error fetching stricker config:', err);
    }
  }, [hasAccess]);
  
  // Fetch active matches stats (public - for display like ranked mode)
  const fetchActiveMatchesStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/stricker/active-matches/stats?mode=${mode || 'hardcore'}`);
      const data = await response.json();
      if (data.success) {
        setActiveMatchesStats({
          totalMatches: data.totalMatches || 0,
          totalPlayers: data.totalPlayers || 0
        });
      }
    } catch (err) {
      console.error('Error fetching stricker active matches stats:', err);
    }
  }, [mode]);
  
  // Fetch my squad info
  const fetchMySquad = useCallback(async () => {
    if (!hasAccess) return;
    
    try {
      const response = await fetch(`${API_URL}/squads/my-squad?mode=stricker`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success && data.squad) {
        setMySquad(data.squad);
      } else {
        setMySquad(null);
      }
    } catch (err) {
      console.error('Error fetching squad:', err);
      setMySquad(null);
    }
  }, [hasAccess]);
  
  // Fetch recent matches
  const fetchRecentMatches = useCallback(async () => {
    if (!hasAccess) return;
    
    try {
      const response = await fetch(`${API_URL}/stricker/history/recent?limit=20`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setRecentMatches(data.matches || []);
      }
    } catch (err) {
      console.error('Error fetching recent matches:', err);
    }
  }, [hasAccess]);
  
  // Fetch current Stricker season
  const fetchCurrentSeason = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/seasons/stricker/current`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setCurrentSeason(data);
      }
    } catch (err) {
      console.error('Error fetching stricker season:', err);
    }
  }, []);
  
  // Check GGSecure status for PC players
  const checkGGSecure = async () => {
    if (user?.platform !== 'PC') return true;
    
    try {
      const response = await fetch(`${API_URL}/users/anticheat-status/${user._id || user.id}`, { credentials: 'include' });
      const data = await response.json();
      const connected = data.isOnline || data.reason === 'not_pc' || data.reason === 'api_key_missing';
      setGgsecureConnected(connected);
      return connected;
    } catch {
      setGgsecureConnected(true);
      return true;
    }
  };
  
  // Join queue
  const handleJoinQueue = async () => {
    if (!hasAccess || joiningQueue) return;
    
    setJoiningQueue(true);
    setError(null);
    
    // Check GGSecure for PC players
    if (user?.platform === 'PC') {
      const connected = await checkGGSecure();
      if (!connected) {
        setError(language === 'fr' ? 'Connectez-vous à GGSecure pour jouer.' : 'Connect to GGSecure to play.');
        setJoiningQueue(false);
        return;
      }
    }
    
    try {
      const response = await fetch(`${API_URL}/stricker/matchmaking/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode: mode || 'hardcore' })
      });
      const data = await response.json();
      
      if (data.success) {
        setInQueue(true);
        setQueueSize(data.queueSize || 0);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur lors de la connexion à la file d\'attente');
    } finally {
      setJoiningQueue(false);
    }
  };
  
  // Leave queue
  const handleLeaveQueue = async () => {
    if (!hasAccess || leavingQueue) return;
      
    setLeavingQueue(true);
      
    try {
      const response = await fetch(`${API_URL}/stricker/matchmaking/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode: mode || 'hardcore' })
      });
      const data = await response.json();
        
      if (data.success) {
        setInQueue(false);
        setQueueSize(data.queueSize || 0);
        // Refresh status immediately
        fetchMatchmakingStatus();
      }
    } catch (err) {
      console.error('Error leaving queue:', err);
    } finally {
      setLeavingQueue(false);
    }
  };
    
  // Admin: Reset all cooldowns
  const handleResetCooldowns = async () => {
    if (resettingCooldowns) return;
    setResettingCooldowns(true);
    setCooldownResetSuccess(null);
    try {
      const response = await fetch(`${API_URL}/stricker/admin/reset-cooldowns`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setCooldownResetSuccess(data.message);
        // Refresh matchmaking to clear cooldown timers
        fetchMatchmakingStatus();
        setTimeout(() => setCooldownResetSuccess(null), 5000);
      } else {
        setError(data.message || 'Erreur lors du reset des cooldowns');
      }
    } catch (err) {
      setError('Erreur lors du reset des cooldowns');
    } finally {
      setResettingCooldowns(false);
    }
  };

  // Challenge a squad
  const handleChallengeSquad = async (targetSquadId) => {
    if (!hasAccess || challengingSquad) return;
      
    setChallengingSquad(targetSquadId);
    setError(null);
      
    // Check GGSecure for PC players
    if (user?.platform === 'PC') {
      const connected = await checkGGSecure();
      if (!connected) {
        setError(language === 'fr' ? 'Connectez-vous \u00e0 GGSecure pour jouer.' : 'Connect to GGSecure to play.');
        setChallengingSquad(null);
        return;
      }
    }
      
    try {
      const response = await fetch(`${API_URL}/stricker/matchmaking/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetSquadId, mode: mode || 'hardcore' })
      });
      const data = await response.json();
        
      if (data.success) {
        // Match created - redirect immediately to match page (mode-scoped)
        navigate(`/${mode || 'hardcore'}/stricker/match/${data.match._id}`);
      } else {
        setError(data.message);
        // Refresh list in case squad left
        fetchMatchmakingStatus();
      }
    } catch (err) {
      setError('Erreur lors du d\u00e9fi');
    } finally {
      setChallengingSquad(null);
    }
  };
  
  // Initial load - all fetches run in parallel, no dependency on callback refs
  useEffect(() => {
    // Fetch season info regardless of access
    fetchCurrentSeason();
    // Fetch active matches stats regardless of access (public data)
    fetchActiveMatchesStats();
    
    if (hasAccess) {
      // Run all fetches in parallel for maximum speed
      Promise.all([
        fetchMyRanking(),
        fetchSquadLeaderboard(),
        fetchMatchmakingStatus(),
        fetchConfig(),
        fetchMySquad(),
        fetchRecentMatches()
      ]);
    } else {
      setLoading(false);
    }
    
    // Refresh active matches stats periodically
    const statsInterval = setInterval(fetchActiveMatchesStats, 30000);
    return () => clearInterval(statsInterval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, mode]);
  
  // No more aggressive polling - socket events (strickerQueueUpdate, strickerMatchCreated) 
  // handle real-time updates. Only refetch on visibility change as a fallback.
  useEffect(() => {
    if (!hasAccess) return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchMatchmakingStatus();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [hasAccess, fetchMatchmakingStatus]);
  
  // Socket: Join stricker-mode room and listen for match created
  useEffect(() => {
    if (!hasAccess || !isConnected) return;
    
    // Join the stricker-mode room to receive match notifications
    joinStrickerMode();
    
    // Listen for match created (when another squad challenges us)
    const unsubMatchCreated = on('strickerMatchCreated', (data) => {
      console.log('[StrickerMode] Match created event received:', data);
      
      // Check if this match involves my squad and matches current mode
      const mySquadId = mySquad?._id;
      const matchMode = data.mode || 'hardcore';
      if (mySquadId && matchMode === (mode || 'hardcore') && 
          (data.team1Squad === mySquadId || data.team2Squad === mySquadId || 
          data.team1Squad?.toString() === mySquadId || data.team2Squad?.toString() === mySquadId)) {
        console.log('[StrickerMode] My squad is in this match, redirecting...');
        navigate(`/${mode || 'hardcore'}/stricker/match/${data.matchId}`);
      }
    });
    
    // Listen for real-time queue updates (when squads join/leave)
    const unsubQueueUpdate = on('strickerQueueUpdate', (data) => {
      console.log('[StrickerMode] Queue update received:', data);
      
      // Only process updates for the current mode
      if (data.mode !== (mode || 'hardcore')) return;
      
      setQueueSize(data.queueSize);
      setSquadsSearching(data.queueSize);
      
      if (data.action === 'join' && data.squad) {
        // Add the squad to the searching list (including own squad)
        const incomingSquadId = data.squad.squadId?.toString() || data.squad.squadId;
        const mySquadId = mySquad?._id?.toString() || mySquad?._id;
        // Mark if this is own squad
        const squadWithFlag = {
          ...data.squad,
          isOwnSquad: incomingSquadId === mySquadId
        };
        setSearchingSquads(prev => {
          // Avoid duplicates
          if (prev.some(s => (s.squadId?.toString() || s.squadId) === incomingSquadId)) return prev;
          return [...prev, squadWithFlag];
        });
      } else if (data.action === 'leave' && data.squadId) {
        // Remove the squad from the searching list
        const leavingSquadId = data.squadId?.toString() || data.squadId;
        setSearchingSquads(prev => prev.filter(s => (s.squadId?.toString() || s.squadId) !== leavingSquadId));
      }
    });
    
    return () => {
      leaveStrickerMode();
      unsubMatchCreated();
      unsubQueueUpdate();
    };
  }, [hasAccess, isConnected, mySquad, joinStrickerMode, leaveStrickerMode, on, navigate, mode]);
  
  // Calculate countdown to next season using seasonEndDate from API
  useEffect(() => {
    if (!currentSeason?.seasonEndDate) return;
    
    const updateCountdown = () => {
      const seasonEnd = new Date(currentSeason.seasonEndDate);
      const now = new Date();
      const diff = seasonEnd - now;
      
      if (diff <= 0) {
        setSeasonCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setSeasonCountdown({ days, hours, minutes, seconds });
    };
    
    // Update immediately and then every second
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, [currentSeason?.seasonEndDate]);
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-12 h-12 text-lime-500 animate-spin" />
          <p className="text-gray-400">{t.loading}</p>
        </div>
      </div>
    );
  }
  
  // Access denied
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
        <div className="bg-dark-900 border border-red-500/30 rounded-xl p-8 text-center max-w-md">
          <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">{t.noAccess}</h2>
          <p className="text-gray-400 mb-6">{t.restricted}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-lime-500 hover:bg-lime-600 text-white font-semibold rounded-lg transition-colors"
          >
            {t.backToHome}
          </button>
        </div>
      </div>
    );
  }
  
  const currentRank = myRanking ? getStrickerRank(myRanking.points) : STRICKER_RANKS.recrues;
  const winRate = myRanking && (myRanking.wins + myRanking.losses) > 0 
    ? Math.round((myRanking.wins / (myRanking.wins + myRanking.losses)) * 100) 
    : 0;
  
  // Check if user is leader or officer in the squad
  const userId = user?.id || user?._id;
  const isLeader = mySquad?.leader?._id === userId || mySquad?.leader === userId;
  const isOfficer = mySquad?.members?.some(m => {
    const memberId = m?.user?._id || m?.user;
    return memberId === userId && m?.role === 'officer';
  });
  const isLeaderOrOfficer = mySquad && user && (isLeader || isOfficer);
  
  // Can start match: has squad, 5+ members, is leader/officer
  const canStartMatch = mySquad && (mySquad.members?.length || 0) >= 5 && isLeaderOrOfficer;
  
  // Fetch maps
  const fetchMaps = async () => {
    setLoadingMaps(true);
    try {
      const response = await fetch(`${API_URL}/stricker/maps`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setAvailableMaps(data.maps || []);
      }
    } catch (err) {
      console.error('Error fetching maps:', err);
    } finally {
      setLoadingMaps(false);
    }
  };
  
  // Fetch rules - uses generic stricker-snd rules (Stricker is always S&D mode)
  const fetchRules = async () => {
    setLoadingRules(true);
    try {
      const response = await fetch(`${API_URL}/game-mode-rules/stricker/ranked/stricker-snd`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setRules(data.rules);
      }
    } catch (err) {
      console.error('Error fetching rules:', err);
    } finally {
      setLoadingRules(false);
    }
  };
  
  const handleShowMaps = () => {
    if (availableMaps.length === 0) {
      fetchMaps();
    }
    setShowMapsModal(true);
  };
  
  const handleShowRules = () => {
    fetchRules();
    setShowRulesModal(true);
  };
  
  return (
    <div className="min-h-screen bg-dark-950 pb-20">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-lime-600/20 via-green-600/10 to-dark-950 border-b border-lime-500/20">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
        <div className="relative max-w-7xl mx-auto px-4 py-6 sm:py-8">
          {/* Row 1: Title + Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-lime-500/20 rounded-lg">
                  <Swords className="w-8 h-8 text-lime-400" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-white">{t.title}</h1>
              </div>
              <p className="text-lime-400/80 text-lg">{t.subtitle}</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* My Squad Display */}
              {mySquad && (
                <div 
                  onClick={() => navigate(`/squad/${mySquad._id}`)}
                  className="px-4 py-2 bg-lime-500/10 border border-lime-500/30 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-lime-500/20 transition-colors"
                >
                  <div className="w-10 h-10 flex items-center justify-center overflow-hidden">
                    {mySquad.logo ? (
                      <img 
                        src={mySquad.logo} 
                        alt={mySquad.name} 
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Users className="w-5 h-5 text-lime-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">{mySquad.name}</p>
                    <p className="text-lime-400 text-xs">[{mySquad.tag}]</p>
                  </div>
                </div>
              )}
              
              <div className="px-4 py-2 bg-lime-500/10 border border-lime-500/30 rounded-lg">
                <span className="text-lime-400 font-bold">5v5</span>
              </div>
              <div className="px-4 py-2 bg-lime-500/10 border border-lime-500/30 rounded-lg flex items-center gap-2">
                <Target className="w-4 h-4 text-lime-400" />
                <span className="text-lime-400 font-medium">{t.searchDestroy}</span>
              </div>
              
              {/* Maps Button */}
              <button
                onClick={handleShowMaps}
                className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Map className="w-4 h-4 text-blue-400" />
                <span className="text-blue-400 font-medium">{t.viewMaps}</span>
              </button>
              
              {/* Rules Button */}
              <button
                onClick={handleShowRules}
                className="px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg flex items-center gap-2 transition-colors"
              >
                <BookOpen className="w-4 h-4 text-purple-400" />
                <span className="text-purple-400 font-medium">{t.viewRules}</span>
              </button>
            </div>
          </div>
          
          {/* Row 2: Season Banner - Full Width */}
          {currentSeason && (
            <div className="bg-gradient-to-r from-lime-500/10 via-lime-500/20 to-lime-500/10 border border-lime-500/30 rounded-2xl p-3 sm:p-5">
              <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-12">
                {/* Season Info */}
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-lime-500/20 rounded-xl">
                    <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-lime-400" />
                  </div>
                  <div className="text-center md:text-left">
                    <p className="text-[10px] sm:text-xs text-lime-400/60 uppercase tracking-widest font-semibold">
                      {language === 'fr' ? 'Saison Actuelle' : 'Current Season'}
                    </p>
                    <p className="text-xl sm:text-3xl font-black text-white">
                      {language === 'fr' ? 'Saison' : 'Season'} {currentSeason.currentSeason}
                    </p>
                  </div>
                </div>
                
                {/* Divider */}
                <div className="hidden md:block w-px h-16 bg-lime-500/30" />
                <div className="md:hidden w-32 h-px bg-lime-500/30" />
                
                {/* Countdown */}
                <div className="text-center">
                  <p className="text-[10px] sm:text-xs text-lime-400/60 uppercase tracking-widest font-semibold mb-2 sm:mb-3">
                    {language === 'fr' ? 'Prochaine saison dans' : 'Next season in'}
                  </p>
                  <div className="flex items-center justify-center gap-1.5 sm:gap-3">
                    <div className="text-center">
                      <div className="text-lg sm:text-3xl font-black text-white bg-dark-900/80 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-lime-500/20 min-w-[40px] sm:min-w-[60px]">
                        {String(seasonCountdown.days).padStart(2, '0')}
                      </div>
                      <p className="text-[9px] sm:text-xs text-gray-500 mt-1">{language === 'fr' ? 'JOURS' : 'DAYS'}</p>
                    </div>
                    <span className="text-base sm:text-2xl text-lime-500 font-bold">:</span>
                    <div className="text-center">
                      <div className="text-lg sm:text-3xl font-black text-white bg-dark-900/80 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-lime-500/20 min-w-[40px] sm:min-w-[60px]">
                        {String(seasonCountdown.hours).padStart(2, '0')}
                      </div>
                      <p className="text-[9px] sm:text-xs text-gray-500 mt-1">{language === 'fr' ? 'HEURES' : 'HOURS'}</p>
                    </div>
                    <span className="text-base sm:text-2xl text-lime-500 font-bold">:</span>
                    <div className="text-center">
                      <div className="text-lg sm:text-3xl font-black text-white bg-dark-900/80 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-lime-500/20 min-w-[40px] sm:min-w-[60px]">
                        {String(seasonCountdown.minutes).padStart(2, '0')}
                      </div>
                      <p className="text-[9px] sm:text-xs text-gray-500 mt-1">{language === 'fr' ? 'MIN' : 'MIN'}</p>
                    </div>
                    <span className="text-base sm:text-2xl text-lime-500 font-bold">:</span>
                    <div className="text-center">
                      <div className="text-lg sm:text-3xl font-black text-white bg-dark-900/80 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-lime-500/20 min-w-[40px] sm:min-w-[60px]">
                        {String(seasonCountdown.seconds).padStart(2, '0')}
                      </div>
                      <p className="text-[9px] sm:text-xs text-gray-500 mt-1">{language === 'fr' ? 'SEC' : 'SEC'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Recent Matches Ticker */}
        {recentMatches.length > 0 && (
          <div className="mb-6 bg-dark-900/80 border border-lime-500/20 rounded-xl overflow-hidden">
            <div className="flex items-center">
              <div className="px-4 py-3 bg-lime-500/10 border-r border-lime-500/20 flex-shrink-0">
                <span className="text-lime-400 font-bold text-sm whitespace-nowrap">{t.recentMatches}</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="flex animate-scroll-left">
                  {[...recentMatches, ...recentMatches, ...recentMatches, ...recentMatches].map((match, index) => {
                    const team1Won = match.winner === 1 || match.winner === 'team1';
                    return (
                      <div 
                        key={`${match._id}-${index}`}
                        className="flex items-center gap-3 px-6 py-3 border-r border-lime-500/10 flex-shrink-0"
                      >
                        {/* Team 1 */}
                        <div className="flex items-center gap-2">
                          {match.team1Squad?.logo && (
                            <img 
                              src={match.team1Squad.logo} 
                              alt={match.team1Squad.tag}
                              className="w-6 h-6 object-contain"
                            />
                          )}
                          <span className={`font-bold text-sm ${team1Won ? 'text-green-400' : 'text-gray-400'}`}>
                            [{match.team1Squad?.tag || '???'}]
                          </span>
                        </div>
                        
                        {/* Result indicator */}
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-black px-1.5 py-0.5 rounded ${team1Won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {team1Won ? 'W' : 'L'}
                          </span>
                          <span className="text-gray-600 text-xs">vs</span>
                          <span className={`text-xs font-black px-1.5 py-0.5 rounded ${!team1Won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {!team1Won ? 'W' : 'L'}
                          </span>
                        </div>
                        
                        {/* Team 2 */}
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-sm ${!team1Won ? 'text-green-400' : 'text-gray-400'}`}>
                            [{match.team2Squad?.tag || '???'}]
                          </span>
                          {match.team2Squad?.logo && (
                            <img 
                              src={match.team2Squad.logo} 
                              alt={match.team2Squad.tag}
                              className="w-6 h-6 object-contain"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* My Rank Card */}
          <div className="lg:col-span-1">
            <div className={`bg-gradient-to-br ${currentRank.gradient} p-[1px] rounded-2xl`}>
              <div className="bg-dark-900 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-lime-400" />
                  {t.myRank}
                </h2>
                
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative w-48 h-48 group">
                    <div className="absolute inset-0 rounded-full bg-lime-500/30 blur-2xl animate-pulse" />
                    <img 
                      src={currentRank.image} 
                      alt={currentRank.name}
                      className="relative w-full h-full object-contain drop-shadow-2xl animate-[pulse_3s_ease-in-out_infinite]"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-white">{currentRank.name}</p>
                    <p className="text-lime-400 font-bold text-xl">{myRanking?.points || 0} pts</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                    <p className="text-2xl font-bold text-green-400">{myRanking?.wins || 0}</p>
                    <p className="text-xs text-gray-400">{t.wins}</p>
                  </div>
                  <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                    <p className="text-2xl font-bold text-red-400">{myRanking?.losses || 0}</p>
                    <p className="text-xs text-gray-400">{t.losses}</p>
                  </div>
                  <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                    <p className="text-2xl font-bold text-lime-400">{winRate}%</p>
                    <p className="text-xs text-gray-400">{t.winRate}</p>
                  </div>
                </div>
                
                {/* Next Rank Progress */}
                {currentRank.max && (
                  <div className="mb-6">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">{t.nextRank}</span>
                      <span className="text-lime-400">{currentRank.max - (myRanking?.points || 0) + 1} {t.pointsToNext}</span>
                    </div>
                    <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-lime-500 to-green-400 rounded-full transition-all"
                        style={{ 
                          width: `${Math.min(100, (((myRanking?.points || 0) - currentRank.min) / (currentRank.max - currentRank.min)) * 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                )}
                
                {/* Squad Info */}
                {mySquad && (
                  <div className="p-4 bg-dark-800/50 rounded-xl border border-lime-500/20 mb-4">
                    <div className="flex items-center gap-3 mb-3">
                      {mySquad.logo && (
                        <img 
                          src={mySquad.logo} 
                          alt={mySquad.name}
                          className="w-12 h-12 object-contain"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-bold text-white">[{mySquad.tag}] {mySquad.name}</p>
                        {myRanking?.squad && (
                          <p className="text-lime-400 text-sm">#{myRanking.squad.position} - {myRanking.squad.points} pts</p>
                        )}
                      </div>
                    </div>
                    {/* Squad Stricker Stats */}
                    {myRanking?.squad && (
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-lime-500/20">
                        <div className="text-center p-2 bg-dark-900/50 rounded-lg">
                          <p className="text-lg font-bold text-green-400">{myRanking.squad.wins || 0}</p>
                          <p className="text-xs text-gray-400">{t.wins}</p>
                        </div>
                        <div className="text-center p-2 bg-dark-900/50 rounded-lg">
                          <p className="text-lg font-bold text-red-400">{myRanking.squad.losses || 0}</p>
                          <p className="text-xs text-gray-400">{t.losses}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Munitions & Shop - Always visible */}
                <div className="p-4 bg-gradient-to-r from-lime-500/10 to-green-500/10 rounded-xl border border-lime-500/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-lime-500/20 flex items-center justify-center">
                        <Crosshair className="w-5 h-5 text-lime-400" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">{t.cranes}</p>
                        <p className="text-2xl font-bold text-lime-400">{mySquad?.cranes || 0}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/${mySquad?.mode === 'cdl' ? 'cdl' : 'hardcore'}/shop`)}
                      className="px-4 py-2 bg-gradient-to-r from-lime-500 to-green-500 hover:from-lime-600 hover:to-green-600 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-lime-500/20"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      {t.shop}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Matchmaking & Leaderboard */}
          <div className="lg:col-span-2 space-y-6">
            {/* Matchmaking Section */}
            <div className="bg-dark-900 border border-lime-500/20 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Crosshair className="w-5 h-5 text-lime-400" />
                Matchmaking
              </h2>
              
              {/* Active Matches Stats */}
              {activeMatchesStats.totalMatches > 0 && (
                <div className="mb-4 p-4 rounded-2xl bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-lime-500/20 border border-lime-500/30">
                      <Swords className="w-3 h-3 text-lime-400" />
                      <span className="text-lime-400 text-xs font-semibold">
                        {activeMatchesStats.totalMatches} {t.activeMatches}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green-500/20 border border-green-500/30">
                      <Users className="w-3 h-3 text-green-400" />
                      <span className="text-green-400 text-xs font-semibold">
                        {activeMatchesStats.totalPlayers} {t.playersInMatch}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
              
              {/* Active Match Banner */}
              {activeMatch && (
                <div className="mb-4 p-4 bg-gradient-to-r from-orange-500/20 via-amber-500/20 to-orange-500/20 border border-orange-500/40 rounded-xl">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <Swords className="w-5 h-5 text-orange-400" />
                      </div>
                      <div>
                        <p className="text-orange-300 font-bold">{t.activeMatchFound}</p>
                        <p className="text-orange-400/70 text-sm">{t.activeMatchDesc}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/${mode || 'hardcore'}/stricker/match/${activeMatch._id}`)}
                      className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap"
                    >
                      <Play className="w-4 h-4" />
                      {t.rejoin}
                    </button>
                  </div>
                </div>
              )}
              
              {/* Squad Requirement Warning */}
              {(!mySquad || (mySquad.members?.length || 0) < 5 || (mySquad && (mySquad.members?.length || 0) >= 5 && !isLeaderOrOfficer)) && (
                <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      {!mySquad ? (
                        <p className="text-amber-400 font-medium">{t.needSquad}</p>
                      ) : (mySquad.members?.length || 0) < 5 ? (
                        <>
                          <p className="text-amber-400 font-medium">{t.needMoreMembers}</p>
                          <p className="text-amber-400/70 text-sm mt-1">
                            {mySquad.members?.length || 0}/5 {t.currentMembers}
                          </p>
                        </>
                      ) : !isLeaderOrOfficer ? (
                        <p className="text-amber-400 font-medium">{t.needLeaderOrOfficer}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <div className="flex-1 p-4 bg-dark-800/50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400">{t.format}</span>
                    <span className="text-lime-400 font-bold">5v5</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400">{t.gameMode}</span>
                    <span className="text-lime-400 font-medium">{t.searchDestroy}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <Crosshair className="w-4 h-4 text-lime-400" />
                      {t.cranes}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-lime-400 font-bold">+50</span>
                      <span className="text-gray-500">/</span>
                      <span className="text-red-400 font-bold">+25</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1">
                  {inQueue ? (
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-4">
                        <Loader2 className="w-5 h-5 text-lime-400 animate-spin" />
                        <span className="text-lime-400 font-bold">{t.inQueue}</span>
                      </div>
                      <button
                        onClick={handleLeaveQueue}
                        disabled={leavingQueue}
                        className="w-full px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold rounded-xl transition-colors border border-red-500/30 flex items-center justify-center gap-2"
                      >
                        {leavingQueue ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                        {t.leaveQueue}
                      </button>
                    </div>
                  ) : activeMatch ? (
                    /* Block buttons when there's an active match */
                    <button
                      disabled={true}
                      className="w-full px-6 py-4 font-bold rounded-xl bg-dark-800 text-gray-500 cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Lock className="w-5 h-5" />
                      {t.joinQueue}
                    </button>
                  ) : searchingSquads.some(squad => !squad.isOwnSquad && (!squad.onCooldown || squad.cooldownEndsAt <= Date.now())) ? (
                    /* Block search button only when there's at least one OTHER squad we haven't played against (not on cooldown, not own squad) */
                    <div className="text-center">
                      <p className="text-orange-400 font-medium mb-2">{t.mustChallenge}</p>
                      <button
                        disabled={true}
                        className="w-full px-6 py-4 font-bold rounded-xl bg-dark-800 text-gray-500 cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Lock className="w-5 h-5" />
                        {t.joinQueue}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleJoinQueue}
                      disabled={joiningQueue || !matchmakingEnabled || !canStartMatch}
                      className={`w-full px-6 py-4 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                        matchmakingEnabled && canStartMatch
                          ? 'bg-gradient-to-r from-lime-500 to-green-500 hover:from-lime-600 hover:to-green-600 text-white shadow-lg shadow-lime-500/30' 
                          : 'bg-dark-800 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {joiningQueue ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : !canStartMatch ? (
                        <Lock className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5" />
                      )}
                      {t.joinQueue}
                    </button>
                  )}
                </div>
              </div>
              
              {/* List of squads looking for a match - visible when there are squads OR when in queue */}
              {searchingSquads.length > 0 && !activeMatch && (
                <div className="mt-6">
                  <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-400" />
                    {t.squadsChallenging}
                  </h3>
                  <div className="space-y-2">
                    {searchingSquads.map((squad) => {
                      // Get rank from points using hardcoded STRICKER_RANKS
                      const points = squad.points || 0;
                      const squadRank = getStrickerRank(points);
                      
                      // Check if this is own squad
                      const isOwnSquad = squad.isOwnSquad;
                      
                      const getBorderColor = () => {
                        if (isOwnSquad) return 'border-lime-500/60';
                        if (points < 250) return 'border-green-500/40';
                        if (points < 500) return 'border-lime-500/40';
                        if (points < 750) return 'border-yellow-500/40';
                        if (points < 1000) return 'border-orange-500/40';
                        if (points < 1500) return 'border-red-500/40';
                        return 'border-rose-500/40';
                      };
                      const getIconColor = () => {
                        if (isOwnSquad) return 'text-lime-400';
                        if (points < 250) return 'text-green-400';
                        if (points < 500) return 'text-lime-400';
                        if (points < 750) return 'text-yellow-400';
                        if (points < 1000) return 'text-orange-400';
                        if (points < 1500) return 'text-red-400';
                        return 'text-rose-400';
                      };
                      const getButtonGradient = () => {
                        if (points < 250) return 'from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600';
                        if (points < 500) return 'from-lime-500 to-green-500 hover:from-lime-600 hover:to-green-600';
                        if (points < 750) return 'from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600';
                        if (points < 1000) return 'from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600';
                        if (points < 1500) return 'from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600';
                        return 'from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700';
                      };
                      
                      return (
                        <div 
                          key={squad.squadId}
                          className={`flex items-center justify-between p-4 ${isOwnSquad ? 'bg-lime-500/10' : 'bg-dark-800/80'} border ${getBorderColor()} rounded-xl`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-lg ${isOwnSquad ? 'bg-lime-500/20' : 'bg-dark-700'} flex items-center justify-center ${getIconColor()}`}>
                              {isOwnSquad ? (
                                <Users className="w-7 h-7" />
                              ) : (
                                <Crosshair className="w-7 h-7" />
                              )}
                            </div>
                            <div>
                              {isOwnSquad ? (
                                <>
                                  <p className="text-lime-400 font-bold">[{squad.squadTag}] {squad.squadName}</p>
                                  <p className="text-lime-400/70 text-sm flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    {language === 'fr' ? 'En recherche...' : 'Searching...'}
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="text-green-400 font-bold">+{squadRank.pointsWin} pts</p>
                                  <p className="text-red-400 text-sm">{squadRank.pointsLoss} pts</p>
                                </>
                              )}
                            </div>
                          </div>
                          {isOwnSquad ? (
                            <div className="px-4 py-2 bg-lime-500/20 rounded-lg text-lime-400 font-medium text-sm">
                              {language === 'fr' ? 'Votre escouade' : 'Your squad'}
                            </div>
                          ) : squad.onCooldown && squad.cooldownEndsAt > Date.now() ? (
                            <CooldownButton 
                              cooldownEndsAt={squad.cooldownEndsAt} 
                              onChallenge={() => handleChallengeSquad(squad.squadId)}
                              isDisabled={challengingSquad === squad.squadId || !canStartMatch || inQueue}
                              isLoading={challengingSquad === squad.squadId}
                              buttonGradient={getButtonGradient()}
                            />
                          ) : (
                            <button
                              onClick={() => handleChallengeSquad(squad.squadId)}
                              disabled={challengingSquad === squad.squadId || !canStartMatch || inQueue}
                              className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${
                                canStartMatch && !inQueue
                                  ? `bg-gradient-to-r ${getButtonGradient()} text-white`
                                  : 'bg-dark-700 text-gray-500 cursor-not-allowed'
                              }`}
                            >
                              {challengingSquad === squad.squadId ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Swords className="w-4 h-4 animate-pulse" />
                              )}
                              {t.provocation}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Admin: Reset Cooldowns - Admin Only */}
              {isAdmin && isAdmin() && (
                <div className="mt-4 p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-red-400 font-bold text-sm">RAZ Cooldowns</p>
                      <p className="text-gray-500 text-xs">Réinitialiser les délais de 2h entre chaque équipe</p>
                    </div>
                    <button
                      onClick={handleResetCooldowns}
                      disabled={resettingCooldowns}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold rounded-xl transition-colors border border-red-500/30 flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                    >
                      {resettingCooldowns ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                      RAZ Cooldowns
                    </button>
                  </div>
                  {cooldownResetSuccess && (
                    <p className="text-green-400 text-sm mt-2">{cooldownResetSuccess}</p>
                  )}
                </div>
              )}
            </div>
            
            {/* Squad Leaderboard */}
            <div className="bg-dark-900 border border-lime-500/20 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Medal className="w-5 h-5 text-lime-400" />
                  {t.squadLeaderboard}
                </h2>
                <button
                  onClick={handleOpenTop100}
                  className="px-4 py-2 bg-gradient-to-r from-lime-500 to-green-500 hover:from-lime-600 hover:to-green-600 text-white font-bold rounded-xl transition-all flex items-center gap-2 text-sm"
                >
                  <Trophy className="w-4 h-4" />
                  Top 100
                </button>
              </div>
              
              {loadingLeaderboard ? (
                <div className="space-y-2">
                  {Array(8).fill(null).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-dark-800/50 animate-pulse">
                      <div className="w-10 h-10 rounded-full bg-dark-700" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-dark-700 rounded w-32" />
                        <div className="h-3 bg-dark-700 rounded w-20" />
                      </div>
                      <div className="h-4 bg-dark-700 rounded w-16" />
                    </div>
                  ))}
                </div>
              ) : squadLeaderboard.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  Aucune escouade classée
                </div>
              ) : (
                <div className="space-y-2">
                  {squadLeaderboard.map((squad, index) => {
                    const squadRank = getStrickerRank(squad.stats?.points || 0);
                    const isPodium = index < 3;
                    const isFirst = index === 0;
                    const isSecond = index === 1;
                    const isThird = index === 2;
                    
                    return (
                      <div 
                        key={squad._id}
                        className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-300 ${
                          isPodium
                            ? `border ${
                                isFirst ? 'bg-gradient-to-r from-yellow-500/20 to-transparent border-yellow-500/40 hover:border-yellow-500/60 animate-pulse-slow' :
                                isSecond ? 'bg-gradient-to-r from-gray-400/20 to-transparent border-gray-400/40 hover:border-gray-400/60' :
                                'bg-gradient-to-r from-amber-700/20 to-transparent border-amber-700/40 hover:border-amber-700/60'
                              }` 
                            : 'bg-dark-800/50 hover:bg-dark-800 border border-transparent'
                        }`}
                      >
                        {/* Position Badge with animation for podium */}
                        <div className={`relative w-10 h-10 rounded-full flex items-center justify-center font-bold transition-transform duration-300 ${
                          isFirst ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black shadow-lg shadow-yellow-500/50 scale-110' :
                          isSecond ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-black shadow-lg shadow-gray-400/50 scale-105' :
                          isThird ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-lg shadow-amber-600/50' :
                          'bg-dark-700 text-gray-400'
                        }`}>
                          {isPodium && (
                            <div className={`absolute inset-0 rounded-full blur-md opacity-50 ${
                              isFirst ? 'bg-yellow-500 animate-ping-slow' :
                              isSecond ? 'bg-gray-400 animate-pulse' :
                              'bg-amber-600'
                            }`} />
                          )}
                          <span className="relative z-10">
                            {squad.position || index + 1}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {squad.logo && (
                            <Link to={`/squad/${squad._id}`}>
                              <img 
                                src={squad.logo} 
                                alt={squad.name}
                                className="w-10 h-10 object-contain transition-transform duration-300 hover:scale-110 cursor-pointer"
                              />
                            </Link>
                          )}
                          <div className="min-w-0 flex-1">
                            <Link 
                              to={`/squad/${squad._id}`}
                              className={`font-bold truncate block hover:underline cursor-pointer ${
                                isPodium ? 'text-transparent bg-clip-text bg-gradient-to-r from-lime-400 to-emerald-400' : 'text-white hover:text-lime-400'
                              }`}
                            >
                              [{squad.tag}] {squad.name}
                            </Link>
                            <div className="flex items-center gap-2">
                              <img 
                                src={squadRank.image} 
                                alt={squadRank.name}
                                className="w-4 h-4 object-contain"
                                onError={(e) => e.target.style.display = 'none'}
                              />
                              <span className="text-lime-400 text-sm">{squadRank.name}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className={`font-bold ${
                            isPodium ? 'text-lime-400 text-lg' : 'text-lime-400'
                          }`}>
                            {squad.stats?.points || 0} pts
                          </p>
                          <p className="text-gray-500 text-xs">
                            {squad.stats?.wins || 0}W - {squad.stats?.losses || 0}L
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Position de l'escouade du joueur si hors top 15 */}
                  {userSquadPosition && (
                    <>
                      <div className="flex items-center gap-2 py-2">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-lime-500/30 to-transparent" />
                        <span className="text-xs text-gray-500">...</span>
                        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-lime-500/30 to-transparent" />
                      </div>
                      
                      <div 
                        className="flex items-center gap-4 p-4 rounded-xl bg-dark-800 border-2 border-lime-500/40 animate-pulse-slow"
                      >
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold bg-lime-500/20 text-lime-400 border border-lime-500/50">
                          {userSquadPosition.position}
                        </div>
                        
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {userSquadPosition.logo && (
                            <Link to={`/squad/${userSquadPosition._id}`}>
                              <img 
                                src={userSquadPosition.logo} 
                                alt={userSquadPosition.name}
                                className="w-10 h-10 object-contain hover:scale-110 transition-transform cursor-pointer"
                              />
                            </Link>
                          )}
                          <div className="min-w-0 flex-1">
                            <Link 
                              to={`/squad/${userSquadPosition._id}`}
                              className="font-bold text-lime-400 truncate block hover:underline hover:text-lime-300 cursor-pointer"
                            >
                              [{userSquadPosition.tag}] {userSquadPosition.name}
                            </Link>
                            <div className="flex items-center gap-2">
                              <img 
                                src={getStrickerRank(userSquadPosition.stats?.points || 0).image} 
                                alt={getStrickerRank(userSquadPosition.stats?.points || 0).name}
                                className="w-4 h-4 object-contain"
                                onError={(e) => e.target.style.display = 'none'}
                              />
                              <span className="text-lime-400 text-sm">
                                {getStrickerRank(userSquadPosition.stats?.points || 0).name}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-lime-400 font-bold">
                            {userSquadPosition.stats?.points || 0} pts
                          </p>
                          <p className="text-gray-500 text-xs">
                            {userSquadPosition.stats?.wins || 0}W - {userSquadPosition.stats?.losses || 0}L
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Points System Table */}
        <div className="mt-10">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-lime-500/30 to-transparent" />
            <h2 className="text-xl font-black text-white flex items-center gap-3">
              <Coins className="w-6 h-6 text-lime-400" />
              {language === 'fr' ? 'Système de Points' : 'Points System'}
            </h2>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-lime-500/30 to-transparent" />
          </div>
          
          {/* Horizontal Cards Layout */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.values(STRICKER_RANKS).map((rank) => {
              const isCurrentRank = currentRank.key === rank.key;
              
              return (
                <div 
                  key={rank.key}
                  className={`relative overflow-hidden rounded-xl transition-all ${
                    isCurrentRank 
                      ? 'bg-gradient-to-br from-lime-500/20 to-green-500/10 border-2 border-lime-400 shadow-lg shadow-lime-500/20' 
                      : 'bg-dark-900/80 border border-lime-500/20 hover:border-lime-500/40'
                  }`}
                >
                  <div className="p-4 flex flex-col items-center">
                    {/* Rank Logo */}
                    <div className="relative w-16 h-16 mb-2">
                      {isCurrentRank && (
                        <div className="absolute inset-0 rounded-full bg-lime-500/30 blur-lg animate-pulse" />
                      )}
                      <img 
                        src={rank.image} 
                        alt={rank.name}
                        className="relative w-full h-full object-contain drop-shadow-lg"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    </div>
                    
                    {/* Rank Name */}
                    <p className={`font-bold text-sm text-center truncate w-full ${isCurrentRank ? 'text-lime-400' : 'text-white'}`}>
                      {rank.name}
                    </p>
                    
                    {/* Points Range */}
                    <p className="text-gray-500 text-xs mt-1">
                      {rank.min} - {rank.max || '∞'}
                    </p>
                    
                    {/* Loss Points Only */}
                    <div className="mt-3">
                      <p className="text-red-400 font-black text-xl">{rank.pointsLoss}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 p-3 bg-lime-500/10 border border-lime-500/30 rounded-lg">
            <p className="text-lime-400 text-sm text-center">
              💡 {language === 'fr' 
                ? 'Toutes les victoires rapportent +30 pts. Plus votre rang est élevé, plus vous perdez de points en cas de défaite.'
                : 'All wins give +30 pts. The higher your rank, the more points you lose on defeat.'
              }
            </p>
          </div>
        </div>
        
        {/* All Ranks Display - Redesigned */}
        <div className="mt-10">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-lime-500/30 to-transparent" />
            <h2 className="text-2xl font-black text-white flex items-center gap-3">
              <Crown className="w-7 h-7 text-lime-400" />
              {t.ranksTitle}
            </h2>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-lime-500/30 to-transparent" />
          </div>
          
          {/* Horizontal rank progression */}
          <div className="relative">
            {/* Progress line */}
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-dark-800 -translate-y-1/2 hidden lg:block" />
            <div 
              className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-lime-500 to-green-400 -translate-y-1/2 transition-all duration-500 hidden lg:block"
              style={{ 
                width: `${Math.min(100, ((myRanking?.points || 0) / 2500) * 100)}%` 
              }}
            />
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-2">
              {Object.values(STRICKER_RANKS).map((rank, index) => {
                const isCurrentRank = currentRank.key === rank.key;
                const isAchieved = (myRanking?.points || 0) >= rank.min;
                
                return (
                  <div 
                    key={rank.key}
                    className="relative group"
                  >
                    {/* Card */}
                    <div className={`relative overflow-hidden rounded-2xl transition-all duration-300 ${
                      isCurrentRank 
                        ? 'bg-gradient-to-br from-lime-500/20 via-green-500/10 to-emerald-500/20 border-2 border-lime-400 shadow-lg shadow-lime-500/20 scale-105' 
                        : isAchieved
                          ? 'bg-dark-800/80 border border-lime-500/30'
                          : 'bg-dark-900/50 border border-white/5'
                    }`}>
                      {/* Glow effect for current rank */}
                      {isCurrentRank && (
                        <div className="absolute inset-0 bg-gradient-to-br from-lime-500/10 to-transparent animate-pulse" />
                      )}
                      
                      <div className="relative p-4 lg:p-5 flex flex-col items-center">
                        {/* Rank image */}
                        <div className={`relative w-40 h-40 lg:w-48 lg:h-48 mb-3 ${
                          isCurrentRank 
                            ? 'animate-pulse' 
                            : isAchieved 
                              ? 'animate-[bounce_3s_ease-in-out_infinite]' 
                              : 'animate-[pulse_4s_ease-in-out_infinite] opacity-50'
                        }`}>
                          <div className={`absolute inset-0 rounded-full blur-xl transition-opacity ${
                            isCurrentRank ? 'bg-lime-500/40 opacity-100' : 'bg-lime-500/20 opacity-0 group-hover:opacity-50'
                          }`} />
                          <img 
                            src={rank.image}
                            alt={rank.name}
                            className={`relative w-full h-full object-contain drop-shadow-lg transition-all ${
                              !isAchieved && !isCurrentRank ? 'opacity-40 grayscale' : ''
                            }`}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <div className="hidden absolute inset-0 items-center justify-center">
                            <rank.icon className={`w-10 h-10 ${
                              isAchieved ? 'text-lime-400' : 'text-gray-600'
                            }`} />
                          </div>
                        </div>
                        
                        {/* Rank name */}
                        <p className={`font-bold text-center text-sm lg:text-base truncate ${
                          isCurrentRank 
                            ? 'text-lime-400' 
                            : isAchieved 
                              ? 'text-white' 
                              : 'text-gray-500'
                        }`}>
                          {rank.name}
                        </p>
                        
                        {/* Points range */}
                        <div className={`mt-1 text-center text-xs lg:text-sm font-medium ${
                          isCurrentRank 
                            ? 'text-lime-300' 
                            : isAchieved 
                              ? 'text-lime-400/70' 
                              : 'text-gray-600'
                        }`}>
                          {rank.min} - {rank.max || '∞'} pts
                        </div>
                        
                        {/* Current rank indicator */}
                        {isCurrentRank && (
                          <div className="mt-2 flex items-center justify-center gap-1">
                            <Sparkles className="w-3 h-3 text-lime-400" />
                            <span className="text-xs text-lime-400 font-semibold uppercase tracking-wider">
                              {language === 'fr' ? 'Actuel' : 'Current'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
      {/* Maps Modal */}
      {showMapsModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowMapsModal(false)}>
          <div className="bg-dark-900 border border-blue-500/30 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-blue-500/20">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Map className="w-7 h-7 text-blue-400" />
                  {t.availableMaps}
                </h2>
                <button
                  onClick={() => setShowMapsModal(false)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
              {loadingMaps ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                </div>
              ) : availableMaps.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  {t.noMaps}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableMaps.map((map) => (
                    <div
                      key={map._id}
                      className="bg-dark-800 border border-blue-500/20 rounded-xl overflow-hidden hover:border-blue-500/50 transition-colors"
                    >
                      {map.image && (
                        <img
                          src={map.image}
                          alt={map.name}
                          className="w-full h-40 object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="p-4">
                        <p className="text-white font-bold text-lg">{map.name}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Target className="w-4 h-4 text-blue-400" />
                          <span className="text-blue-400 text-sm">{t.searchDestroy}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Rules Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowRulesModal(false)}>
          <div className="bg-dark-900 border border-lime-500/30 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-lime-500/20">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <BookOpen className="w-7 h-7 text-lime-400" />
                  {t.strickerRules}
                </h2>
                <button
                  onClick={() => setShowRulesModal(false)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
              {loadingRules ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-lime-400 animate-spin" />
                </div>
              ) : !rules ? (
                <div className="text-center py-12 text-gray-400">
                  {t.noRules}
                </div>
              ) : (
                <div className="space-y-6">
                  {rules.title && rules.title[language] && (
                    <div className="mb-8">
                      <h3 className="text-3xl font-black text-lime-400">{rules.title[language]}</h3>
                    </div>
                  )}
                  
                  {rules.sections && rules.sections.map((section, index) => (
                    <div key={index} className="bg-dark-800/50 rounded-xl p-6 border border-lime-500/20">
                      <h4 className="text-xl font-bold text-white mb-4">{section.title[language]}</h4>
                      <div 
                        className="text-gray-300 prose prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: section.content[language] }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top 100 Modal */}
      {showTop100Modal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowTop100Modal(false)}>
          <div className="bg-dark-900 border border-lime-500/30 rounded-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-lime-500/20">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Trophy className="w-7 h-7 text-lime-400" />
                  Top 100 {t.squadLeaderboard}
                </h2>
                <button
                  onClick={() => setShowTop100Modal(false)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-100px)]">
              {loadingTop100 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-lime-400 animate-spin" />
                </div>
              ) : top100Squads.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  Aucune escouade classée
                </div>
              ) : (
                <div className="space-y-2">
                  {top100Squads.map((squad, index) => {
                    const squadRank = getStrickerRank(squad.stats?.points || 0);
                    const isPodium = index < 3;
                    const isFirst = index === 0;
                    const isSecond = index === 1;
                    const isThird = index === 2;
                    
                    return (
                      <div 
                        key={squad._id}
                        className={`flex items-center gap-4 p-3 rounded-xl transition-all ${
                          isPodium
                            ? `border ${
                                isFirst ? 'bg-gradient-to-r from-yellow-500/20 to-transparent border-yellow-500/40' :
                                isSecond ? 'bg-gradient-to-r from-gray-400/20 to-transparent border-gray-400/40' :
                                'bg-gradient-to-r from-amber-700/20 to-transparent border-amber-700/40'
                              }` 
                            : 'bg-dark-800/50 hover:bg-dark-800 border border-transparent'
                        }`}
                      >
                        {/* Position Badge */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          isFirst ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black' :
                          isSecond ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-black' :
                          isThird ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white' :
                          'bg-dark-700 text-gray-400'
                        }`}>
                          {squad.position}
                        </div>
                        
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {squad.logo && (
                            <Link to={`/squad/${squad._id}`} onClick={() => setShowTop100Modal(false)}>
                              <img 
                                src={squad.logo} 
                                alt={squad.name}
                                className="w-8 h-8 object-contain transition-transform duration-300 hover:scale-110 cursor-pointer"
                              />
                            </Link>
                          )}
                          <div className="min-w-0 flex-1">
                            <Link 
                              to={`/squad/${squad._id}`}
                              onClick={() => setShowTop100Modal(false)}
                              className={`font-bold truncate block hover:underline cursor-pointer text-sm ${
                                isPodium ? 'text-transparent bg-clip-text bg-gradient-to-r from-lime-400 to-emerald-400' : 'text-white hover:text-lime-400'
                              }`}
                            >
                              [{squad.tag}] {squad.name}
                            </Link>
                            <div className="flex items-center gap-2">
                              <img 
                                src={squadRank.image} 
                                alt={squadRank.name}
                                className="w-3 h-3 object-contain"
                                onError={(e) => e.target.style.display = 'none'}
                              />
                              <span className="text-lime-400 text-xs">{squadRank.name}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className={`font-bold text-sm ${
                            isPodium ? 'text-lime-400' : 'text-lime-400'
                          }`}>
                            {squad.stats?.points || 0} pts
                          </p>
                          <p className="text-gray-500 text-xs">
                            {squad.stats?.wins || 0}W - {squad.stats?.losses || 0}L
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StrickerMode;
