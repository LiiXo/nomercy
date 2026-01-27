import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useAuth } from '../AuthContext';
import { useSocket } from '../SocketContext';
import { getUserAvatar } from '../utils/avatar';
import { 
  Trophy, Crown, Zap, Shield, Target, Loader2, TrendingUp, Swords, Lock, 
  Users, Clock, Play, Square, AlertTriangle, ShieldCheck, Crosshair, 
  Medal, Star, ChevronRight, Flame, Sparkles, Eye, Bot, Radio, BookOpen, Coins, X, Map
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

// Stricker Ranks - 6 ranks with apple green theme
const STRICKER_RANKS = {
  recrues: { 
    key: 'recrues', 
    name: 'Recrues', 
    min: 0, 
    max: 499, 
    color: '#7ED321', 
    gradient: 'from-lime-600 to-green-700', 
    icon: Shield, 
    image: '/stricker1.png' 
  },
  operateurs: { 
    key: 'operateurs', 
    name: 'Opérateurs', 
    min: 500, 
    max: 999, 
    color: '#7ED321', 
    gradient: 'from-lime-500 to-green-600', 
    icon: Shield, 
    image: '/stricker2.png' 
  },
  veterans: { 
    key: 'veterans', 
    name: 'Vétérans', 
    min: 1000, 
    max: 1499, 
    color: '#7ED321', 
    gradient: 'from-lime-400 to-green-500', 
    icon: Medal, 
    image: '/stricker3.png' 
  },
  commandants: { 
    key: 'commandants', 
    name: 'Commandants', 
    min: 1500, 
    max: 1999, 
    color: '#7ED321', 
    gradient: 'from-green-400 to-emerald-500', 
    icon: Medal, 
    image: '/stricker4.png' 
  },
  seigneurs: { 
    key: 'seigneurs', 
    name: 'Seigneurs de Guerre', 
    min: 2000, 
    max: 2499, 
    color: '#7ED321', 
    gradient: 'from-emerald-400 to-teal-500', 
    icon: Crown, 
    image: '/stricker5.png' 
  },
  immortel: { 
    key: 'immortel', 
    name: 'Immortel', 
    min: 2500, 
    max: null, 
    color: '#7ED321', 
    gradient: 'from-teal-400 via-emerald-500 to-lime-600', 
    icon: Zap, 
    image: '/stricker6.png' 
  }
};

// Helper to get rank from points
const getStrickerRank = (points) => {
  if (points >= 2500) return STRICKER_RANKS.immortel;
  if (points >= 2000) return STRICKER_RANKS.seigneurs;
  if (points >= 1500) return STRICKER_RANKS.commandants;
  if (points >= 1000) return STRICKER_RANKS.veterans;
  if (points >= 500) return STRICKER_RANKS.operateurs;
  return STRICKER_RANKS.recrues;
};

// Translations
const translations = {
  fr: {
    title: 'Mode Stricker',
    subtitle: 'Recherche et Destruction 5v5',
    restricted: 'Accès réservé aux administrateurs, staff et arbitres',
    myRank: 'Mon Rang',
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
    youAre: 'Vous êtes'
  },
  en: {
    title: 'Stricker Mode',
    subtitle: 'Search and Destroy 5v5',
    restricted: 'Access restricted to administrators, staff and referees',
    myRank: 'My Rank',
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
    viewMaps: 'Voir les cartes',
    viewRules: 'Voir les règles',
    availableMaps: 'Cartes disponibles',
    strickerRules: 'Règles du Mode Stricker',
    noMaps: 'Aucune carte disponible',
    close: 'Fermer',
    noRules: 'Aucune règle disponible pour le moment'
  },
  en: {
    title: 'Stricker Mode',
    subtitle: 'Search and Destroy 5v5',
    restricted: 'Access restricted to administrators, staff and referees',
    myRank: 'My Rank',
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
    viewMaps: 'View Maps',
    viewRules: 'View Rules',
    availableMaps: 'Available Maps',
    strickerRules: 'Stricker Mode Rules',
    noMaps: 'No maps available',
    close: 'Close',
    noRules: 'No rules available at the moment'
  }
};

const StrickerMode = () => {
  const { language } = useLanguage();
  const { user, isAuthenticated, hasAdminAccess } = useAuth();
  const { isConnected } = useSocket();
  const navigate = useNavigate();
  
  const t = translations[language] || translations.en;
  
  // State
  const [loading, setLoading] = useState(true);
  const [myRanking, setMyRanking] = useState(null);
  const [squadLeaderboard, setSquadLeaderboard] = useState([]);
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
  const [showMapsModal, setShowMapsModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [availableMaps, setAvailableMaps] = useState([]);
  const [loadingMaps, setLoadingMaps] = useState(false);
  const [rules, setRules] = useState(null);
  const [loadingRules, setLoadingRules] = useState(false);
  
  // Check access
  const hasAccess = isAuthenticated && hasAdminAccess();
  
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
      const response = await fetch(`${API_URL}/stricker/leaderboard/squads?limit=10`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setSquadLeaderboard(data.leaderboard || []);
      }
    } catch (err) {
      console.error('Error fetching stricker leaderboard:', err);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, [hasAccess]);
  
  // Fetch matchmaking status
  const fetchMatchmakingStatus = useCallback(async () => {
    if (!hasAccess) return;
    
    try {
      const response = await fetch(`${API_URL}/stricker/matchmaking/status`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setInQueue(data.inQueue || false);
        setQueueSize(data.queueSize || 0);
        setActiveMatch(data.match || null);
        setOnlineCount(data.onlineCount || 0);
        setSquadsSearching(data.squadsSearching || 0);
      }
    } catch (err) {
      console.error('Error fetching matchmaking status:', err);
    }
  }, [hasAccess]);
  
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
  
  // Fetch my squad info
  const fetchMySquad = useCallback(async () => {
    if (!hasAccess) return;
    
    try {
      const response = await fetch(`${API_URL}/squads/my-squad?mode=hardcore`, {
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
  
  // Join queue
  const handleJoinQueue = async () => {
    if (!hasAccess || joiningQueue) return;
    
    setJoiningQueue(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/stricker/matchmaking/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
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
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        setInQueue(false);
        setQueueSize(data.queueSize || 0);
      }
    } catch (err) {
      console.error('Error leaving queue:', err);
    } finally {
      setLeavingQueue(false);
    }
  };
  
  // Initial load
  useEffect(() => {
    if (hasAccess) {
      fetchMyRanking();
      fetchSquadLeaderboard();
      fetchMatchmakingStatus();
      fetchConfig();
      fetchMySquad();
    } else {
      setLoading(false);
    }
  }, [hasAccess, fetchMyRanking, fetchSquadLeaderboard, fetchMatchmakingStatus, fetchConfig, fetchMySquad]);
  
  // Polling for matchmaking status
  useEffect(() => {
    if (!hasAccess || !inQueue) return;
    
    const interval = setInterval(() => {
      fetchMatchmakingStatus();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [hasAccess, inQueue, fetchMatchmakingStatus]);
  
  // Redirect to match if active
  useEffect(() => {
    if (activeMatch) {
      navigate(`/stricker/match/${activeMatch._id}`);
    }
  }, [activeMatch, navigate]);
  
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
  const odId = user?._id?.toString() || user?._id;
  const leaderId = mySquad?.leader?._id?.toString() || mySquad?.leader?.toString() || mySquad?.leader;
  const isLeader = odId && leaderId && odId === leaderId;
  const isOfficer = odId && mySquad?.members?.some(m => {
    const memberId = m?.user?._id?.toString() || m?.user?.toString() || m?.user;
    return memberId === odId && m?.role === 'officer';
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
  
  // Fetch rules
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
    if (!rules) {
      fetchRules();
    }
    setShowRulesModal(true);
  };
  
  return (
    <div className="min-h-screen bg-dark-950 pb-20">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-lime-600/20 via-green-600/10 to-dark-950 border-b border-lime-500/20">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
        <div className="relative max-w-7xl mx-auto px-4 py-8 sm:py-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-lime-500/20 rounded-lg">
                  <Swords className="w-8 h-8 text-lime-400" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-white">{t.title}</h1>
              </div>
              <p className="text-lime-400/80 text-lg">{t.subtitle}</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Online count */}
              <div className="px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-400 font-bold">{onlineCount}</span>
                <span className="text-green-400/70 text-sm">{t.online}</span>
              </div>
              
              {/* Squads searching */}
              {squadsSearching > 0 && (
                <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                  <span className="text-amber-400 font-bold">{squadsSearching}</span>
                  <span className="text-amber-400/70 text-sm">{t.squadsSearching}</span>
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
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 py-8">
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
                {myRanking?.squad && (
                  <div className="p-4 bg-dark-800/50 rounded-xl border border-lime-500/20">
                    <div className="flex items-center gap-3">
                      {myRanking.squad.logo && (
                        <img 
                          src={myRanking.squad.logo} 
                          alt={myRanking.squad.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-bold text-white">[{myRanking.squad.tag}] {myRanking.squad.name}</p>
                        <p className="text-lime-400 text-sm">#{myRanking.squad.position} - {myRanking.squad.points} pts</p>
                      </div>
                    </div>
                  </div>
                )}
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
              
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
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
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">{t.gameMode}</span>
                    <span className="text-lime-400 font-medium">{t.searchDestroy}</span>
                  </div>
                </div>
                
                <div className="flex-1">
                  {inQueue ? (
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Loader2 className="w-5 h-5 text-lime-400 animate-spin" />
                        <span className="text-lime-400 font-bold">{t.inQueue}</span>
                      </div>
                      <p className="text-gray-400 text-sm mb-4">{queueSize} {t.playersInQueue}</p>
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
            </div>
            
            {/* Squad Leaderboard */}
            <div className="bg-dark-900 border border-lime-500/20 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Medal className="w-5 h-5 text-lime-400" />
                {t.squadLeaderboard}
              </h2>
              
              {loadingLeaderboard ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-lime-400 animate-spin" />
                </div>
              ) : squadLeaderboard.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  Aucune escouade classée
                </div>
              ) : (
                <div className="space-y-2">
                  {squadLeaderboard.map((squad, index) => {
                    const squadRank = getStrickerRank(squad.stats?.points || 0);
                    return (
                      <div 
                        key={squad._id}
                        className={`flex items-center gap-4 p-4 rounded-xl transition-colors ${
                          index < 3 
                            ? 'bg-gradient-to-r from-lime-500/10 to-transparent border border-lime-500/20' 
                            : 'bg-dark-800/50 hover:bg-dark-800'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                          index === 0 ? 'bg-yellow-500 text-black' :
                          index === 1 ? 'bg-gray-400 text-black' :
                          index === 2 ? 'bg-amber-700 text-white' :
                          'bg-dark-700 text-gray-400'
                        }`}>
                          {squad.position || index + 1}
                        </div>
                        
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {squad.logo && (
                            <img 
                              src={squad.logo} 
                              alt={squad.name}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate">
                              [{squad.tag}] {squad.name}
                            </p>
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
                          <p className="text-lime-400 font-bold">{squad.stats?.points || 0} pts</p>
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
                      
                      <div className="relative p-4 lg:p-5">
                        {/* Rank image */}
                        <div className={`relative w-32 h-32 lg:w-40 lg:h-40 mx-auto mb-3 ${
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
          <div className="bg-dark-900 border border-purple-500/30 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-purple-500/20">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <BookOpen className="w-7 h-7 text-purple-400" />
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
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
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
                    <div key={index} className="bg-dark-800/50 rounded-xl p-6 border border-purple-500/20">
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
    </div>
  );
};

export default StrickerMode;
