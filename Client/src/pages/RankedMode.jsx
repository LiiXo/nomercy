import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { useSocket } from '../SocketContext';
import { 
  Trophy, Crown, Zap, Shield, Target, Loader2, TrendingUp, Swords, Lock, 
  Users, Clock, Play, Square, AlertTriangle, ShieldCheck, Crosshair, 
  Medal, Star, ChevronRight, Flame, Sparkles, Eye, Bot, Radio
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

// Rank data avec couleurs et icônes
const RANKS = [
  { name: 'Bronze', min: 0, max: 499, color: '#CD7F32', gradient: 'from-amber-700 to-amber-900', icon: Shield, tier: 'IV-I' },
  { name: 'Silver', min: 500, max: 999, color: '#C0C0C0', gradient: 'from-slate-400 to-slate-600', icon: Shield, tier: 'IV-I' },
  { name: 'Gold', min: 1000, max: 1499, color: '#FFD700', gradient: 'from-yellow-500 to-amber-600', icon: Medal, tier: 'IV-I' },
  { name: 'Platinum', min: 1500, max: 1999, color: '#00CED1', gradient: 'from-teal-400 to-cyan-600', icon: Medal, tier: 'IV-I' },
  { name: 'Diamond', min: 2000, max: 2499, color: '#B9F2FF', gradient: 'from-cyan-300 to-blue-500', icon: Star, tier: 'IV-I' },
  { name: 'Master', min: 2500, max: 2999, color: '#9B59B6', gradient: 'from-purple-500 to-pink-600', icon: Crown, tier: 'III-I' },
  { name: 'Grandmaster', min: 3000, max: 3499, color: '#E74C3C', gradient: 'from-red-500 to-orange-600', icon: Flame, tier: 'II-I' },
  { name: 'Champion', min: 3500, max: 99999, color: '#F1C40F', gradient: 'from-yellow-400 via-orange-500 to-red-600', icon: Zap, tier: 'Top 100' },
];

const RankedMode = () => {
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const { user, isAuthenticated } = useAuth();
  const { on, isConnected, joinPage, leavePage, emit } = useSocket();
  const navigate = useNavigate();
  
  // Player stats
  const [myRanking, setMyRanking] = useState(null);
  const [loadingRanking, setLoadingRanking] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  
  // Game mode & Matchmaking
  const [selectedGameMode, setSelectedGameMode] = useState('Search & Destroy');
  const [inQueue, setInQueue] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [queuePosition, setQueuePosition] = useState(null);
  const [timerActive, setTimerActive] = useState(false);
  const [timerEndTime, setTimerEndTime] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [joiningQueue, setJoiningQueue] = useState(false);
  const [leavingQueue, setLeavingQueue] = useState(false);
  const [matchmakingError, setMatchmakingError] = useState(null);
  const [ggsecureConnected, setGgsecureConnected] = useState(null);
  const [activeMatch, setActiveMatch] = useState(null);
  
  // Page viewers count
  const [pageViewers, setPageViewers] = useState(0);
  
  // Search animation state
  const [searchingDots, setSearchingDots] = useState('');
  const [pulseAnimation, setPulseAnimation] = useState(0);
  
  // Adding fake players (staff/admin)
  const [addingFakePlayers, setAddingFakePlayers] = useState(false);

  const isHardcore = selectedMode === 'hardcore';
  const accent = isHardcore ? 'red' : 'cyan';

  // Get rank from points
  const getRankFromPoints = (points) => {
    return RANKS.find(r => points >= r.min && points <= r.max) || RANKS[0];
  };

  // Fetch player ranking
  const fetchMyRanking = async () => {
    if (!isAuthenticated) {
      setLoadingRanking(false);
      return;
    }
    setLoadingRanking(true);
    try {
      const response = await fetch(`${API_URL}/rankings/me/${selectedMode}`, { credentials: 'include' });
      const data = await response.json();
      if (data.success) setMyRanking(data.ranking);
    } catch (err) {
      console.error('Error fetching ranking:', err);
    } finally {
      setLoadingRanking(false);
    }
  };

  // Fetch leaderboard
  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const response = await fetch(`${API_URL}/rankings/leaderboard/${selectedMode}?limit=10`, { credentials: 'include' });
      const data = await response.json();
      if (data.success) setLeaderboard(data.rankings);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  // Check active match
  const checkActiveMatch = async () => {
    if (!isAuthenticated) return;
    try {
      const response = await fetch(`${API_URL}/ranked-matches/active/me`, { credentials: 'include' });
      const data = await response.json();
      setActiveMatch(data.success && data.match ? data.match : null);
    } catch (err) {
      console.error('Error checking active match:', err);
    }
  };

  // Check GGSecure
  const checkGGSecure = async () => {
    if (!user || user.platform !== 'PC') {
      setGgsecureConnected(true);
      return true;
    }
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

  // Fetch queue status
  const fetchQueueStatus = async () => {
    if (!isAuthenticated) return;
    try {
      const response = await fetch(
        `${API_URL}/ranked-matches/matchmaking/status?gameMode=${encodeURIComponent(selectedGameMode)}&mode=${selectedMode}`,
        { credentials: 'include' }
      );
      const data = await response.json();
      if (data.success) {
        setInQueue(data.inQueue);
        setQueueSize(data.queueSize);
        setQueuePosition(data.position);
        setTimerActive(data.timerActive);
        setTimerEndTime(data.timerEndTime);
      }
    } catch (err) {
      console.error('Error fetching queue status:', err);
    }
  };

  // Join queue
  const joinQueue = async () => {
    setMatchmakingError(null);
    if (user?.platform === 'PC') {
      const connected = await checkGGSecure();
      if (!connected) {
        setMatchmakingError(language === 'fr' ? 'Connectez-vous à GGSecure pour jouer.' : 'Connect to GGSecure to play.');
        return;
      }
    }
    setJoiningQueue(true);
    try {
      const response = await fetch(`${API_URL}/ranked-matches/matchmaking/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ gameMode: selectedGameMode, mode: selectedMode })
      });
      const data = await response.json();
      if (data.success) {
        setInQueue(true);
        setQueueSize(data.queueSize);
        setQueuePosition(data.position);
      } else {
        setMatchmakingError(data.message);
        if (data.activeMatchId) setActiveMatch({ _id: data.activeMatchId });
      }
    } catch (err) {
      setMatchmakingError(language === 'fr' ? 'Erreur de connexion' : 'Connection error');
    } finally {
      setJoiningQueue(false);
    }
  };

  // Leave queue
  const leaveQueue = async () => {
    setLeavingQueue(true);
    try {
      const response = await fetch(`${API_URL}/ranked-matches/matchmaking/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ gameMode: selectedGameMode, mode: selectedMode })
      });
      const data = await response.json();
      if (data.success) {
        setInQueue(false);
        setQueueSize(0);
        setQueuePosition(null);
        setTimerActive(false);
        setTimerEndTime(null);
      }
    } catch (err) {
      console.error('Error leaving queue:', err);
    } finally {
      setLeavingQueue(false);
    }
  };
  
  // Add fake players (staff/admin only)
  const addFakePlayers = async (count = 5) => {
    setAddingFakePlayers(true);
    try {
      const response = await fetch(`${API_URL}/ranked-matches/matchmaking/add-fake-players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ gameMode: selectedGameMode, mode: selectedMode, count })
      });
      const data = await response.json();
      if (data.success) {
        setQueueSize(data.queueSize);
      } else {
        setMatchmakingError(data.message);
      }
    } catch (err) {
      console.error('Error adding fake players:', err);
      setMatchmakingError(language === 'fr' ? 'Erreur lors de l\'ajout' : 'Error adding fake players');
    } finally {
      setAddingFakePlayers(false);
    }
  };
  
  // Check if user is staff or admin
  const isStaffOrAdmin = user?.roles?.includes('staff') || user?.roles?.includes('admin');

  // Page viewers tracking with socket
  useEffect(() => {
    if (!isConnected) return;
    
    const pageName = `ranked-mode-${selectedMode}`;
    joinPage(pageName);
    
    const unsubViewers = on('viewerCount', (count) => {
      setPageViewers(count);
    });
    
    return () => {
      leavePage(pageName);
      unsubViewers();
    };
  }, [isConnected, selectedMode, joinPage, leavePage, on]);
  
  // Search animation effects
  useEffect(() => {
    if (!inQueue) {
      setSearchingDots('');
      setPulseAnimation(0);
      return;
    }
    
    // Dots animation
    const dotsInterval = setInterval(() => {
      setSearchingDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    
    // Pulse animation for the radar effect
    const pulseInterval = setInterval(() => {
      setPulseAnimation(prev => (prev + 1) % 4);
    }, 800);
    
    return () => {
      clearInterval(dotsInterval);
      clearInterval(pulseInterval);
    };
  }, [inQueue]);

  // Socket events
  useEffect(() => {
    if (!isAuthenticated || !isConnected) return;
    const unsubQueue = on('rankedQueueUpdate', (data) => {
      if (data.type === 'queue_status' || data.type === 'stayed_in_queue') {
        setQueueSize(data.queueSize);
        setQueuePosition(data.position);
        setTimerActive(data.timerActive);
        setTimerEndTime(data.timerEndTime);
      }
    });
    const unsubMatch = on('rankedMatchFound', (data) => {
      setInQueue(false);
      navigate(`/ranked/match/${data.matchId}`);
    });
    return () => { unsubQueue(); unsubMatch(); };
  }, [isAuthenticated, isConnected, on, navigate]);

  // Timer countdown
  useEffect(() => {
    if (!timerActive || !timerEndTime) { setTimeRemaining(null); return; }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((timerEndTime - Date.now()) / 1000));
      setTimeRemaining(remaining);
      if (remaining <= 0) setTimerActive(false);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [timerActive, timerEndTime]);

  // Initial load
  useEffect(() => {
    fetchMyRanking();
    fetchLeaderboard();
    if (isAuthenticated) {
      checkActiveMatch();
      fetchQueueStatus();
      if (user?.platform === 'PC') checkGGSecure();
    }
  }, [isAuthenticated, selectedMode, selectedGameMode]);

  const playerRank = myRanking ? getRankFromPoints(myRanking.points) : RANKS[0];
  const PlayerRankIcon = playerRank.icon;

  // Translations - 4 languages
  const translations = {
    fr: {
      title: 'Mode Classé',
      subtitle: 'Affronte les meilleurs joueurs et grimpe les échelons',
      yourRank: 'Ton rang',
      points: 'Points',
      wins: 'Victoires',
      losses: 'Défaites',
      winRate: 'Ratio',
      noRank: 'Pas encore classé',
      playFirst: 'Joue ta première partie !',
      gameMode: 'Mode de jeu',
      searchDestroy: 'Recherche & Destruction',
      teamDeathmatch: 'Mêlée générale',
      duel: 'Duel',
      available: 'Disponible',
      comingSoon: 'À venir',
      findMatch: 'Rechercher un match',
      searching: 'Recherche...',
      cancel: 'Annuler',
      playersInQueue: 'joueurs en file',
      matchIn: 'Match dans',
      waitingMore: 'En attente de joueurs...',
      minPlayers: 'Minimum 6 joueurs (3v3)',
      activeMatch: 'Match en cours',
      rejoin: 'Rejoindre',
      ggsecureRequired: 'GGSecure requis pour les joueurs PC',
      leaderboard: 'Classement',
      ranks: 'Les rangs',
      soloMode: 'Mode solo uniquement',
      format: '3v3, 4v4 ou 5v5',
      playersOnPage: 'joueurs sur cette page',
      addFakePlayers: 'Ajouter des joueurs test',
      searchingPlayers: 'Recherche de joueurs',
      loginToPlay: 'Connecte-toi pour jouer',
      loginRequired: 'Tu dois être connecté pour accéder au mode classé.',
      viewAll: 'Voir tout',
      noRankedPlayers: 'Aucun joueur classé',
      you: 'Toi',
      position: 'Position',
      ready3v3: '3v3 prêt, en attente du 4v4...',
      ready4v4: '4v4 prêt, en attente du 5v5...',
      creatingMatch: 'Création du match...',
      topPlayers: 'Meilleurs joueurs',
    },
    en: {
      title: 'Ranked Mode',
      subtitle: 'Face the best players and climb the ranks',
      yourRank: 'Your Rank',
      points: 'Points',
      wins: 'Wins',
      losses: 'Losses',
      winRate: 'Win Rate',
      noRank: 'Not ranked yet',
      playFirst: 'Play your first match!',
      gameMode: 'Game Mode',
      searchDestroy: 'Search & Destroy',
      teamDeathmatch: 'Team Deathmatch',
      duel: 'Duel',
      available: 'Available',
      comingSoon: 'Coming Soon',
      findMatch: 'Find Match',
      searching: 'Searching...',
      cancel: 'Cancel',
      playersInQueue: 'players in queue',
      matchIn: 'Match in',
      waitingMore: 'Waiting for players...',
      minPlayers: 'Minimum 6 players (3v3)',
      activeMatch: 'Active Match',
      rejoin: 'Rejoin',
      ggsecureRequired: 'GGSecure required for PC players',
      leaderboard: 'Leaderboard',
      ranks: 'Ranks',
      soloMode: 'Solo mode only',
      format: '3v3, 4v4 or 5v5',
      playersOnPage: 'players on this page',
      addFakePlayers: 'Add test players',
      searchingPlayers: 'Searching for players',
      loginToPlay: 'Login to Play',
      loginRequired: 'You must be logged in to access ranked mode.',
      viewAll: 'View All',
      noRankedPlayers: 'No ranked players',
      you: 'You',
      position: 'Position',
      ready3v3: '3v3 ready, waiting for 4v4...',
      ready4v4: '4v4 ready, waiting for 5v5...',
      creatingMatch: 'Creating match...',
      topPlayers: 'Top Players',
    },
    de: {
      title: 'Ranglisten-Modus',
      subtitle: 'Tritt gegen die besten Spieler an und steige auf',
      yourRank: 'Dein Rang',
      points: 'Punkte',
      wins: 'Siege',
      losses: 'Niederlagen',
      winRate: 'Siegquote',
      noRank: 'Noch nicht platziert',
      playFirst: 'Spiele dein erstes Match!',
      gameMode: 'Spielmodus',
      searchDestroy: 'Suchen & Zerstören',
      teamDeathmatch: 'Team-Deathmatch',
      duel: 'Duell',
      available: 'Verfügbar',
      comingSoon: 'Demnächst',
      findMatch: 'Match finden',
      searching: 'Suche...',
      cancel: 'Abbrechen',
      playersInQueue: 'Spieler in Warteschlange',
      matchIn: 'Match in',
      waitingMore: 'Warte auf Spieler...',
      minPlayers: 'Minimum 6 Spieler (3v3)',
      activeMatch: 'Aktives Match',
      rejoin: 'Beitreten',
      ggsecureRequired: 'GGSecure erforderlich für PC-Spieler',
      leaderboard: 'Bestenliste',
      ranks: 'Ränge',
      soloMode: 'Nur Solomodus',
      format: '3v3, 4v4 oder 5v5',
      playersOnPage: 'Spieler auf dieser Seite',
      addFakePlayers: 'Testspieler hinzufügen',
      searchingPlayers: 'Suche nach Spielern',
      loginToPlay: 'Zum Spielen einloggen',
      loginRequired: 'Du musst eingeloggt sein, um den Ranglisten-Modus zu nutzen.',
      viewAll: 'Alle anzeigen',
      noRankedPlayers: 'Keine platzierten Spieler',
      you: 'Du',
      position: 'Position',
      ready3v3: '3v3 bereit, warte auf 4v4...',
      ready4v4: '4v4 bereit, warte auf 5v5...',
      creatingMatch: 'Match wird erstellt...',
      topPlayers: 'Top-Spieler',
    },
    it: {
      title: 'Modalità Classificata',
      subtitle: 'Affronta i migliori giocatori e scala le classifiche',
      yourRank: 'Il tuo grado',
      points: 'Punti',
      wins: 'Vittorie',
      losses: 'Sconfitte',
      winRate: 'Percentuale',
      noRank: 'Non ancora classificato',
      playFirst: 'Gioca la tua prima partita!',
      gameMode: 'Modalità di gioco',
      searchDestroy: 'Cerca e Distruggi',
      teamDeathmatch: 'Deathmatch a squadre',
      duel: 'Duello',
      available: 'Disponibile',
      comingSoon: 'In arrivo',
      findMatch: 'Trova partita',
      searching: 'Ricerca...',
      cancel: 'Annulla',
      playersInQueue: 'giocatori in coda',
      matchIn: 'Partita tra',
      waitingMore: 'In attesa di giocatori...',
      minPlayers: 'Minimo 6 giocatori (3v3)',
      activeMatch: 'Partita in corso',
      rejoin: 'Rientra',
      ggsecureRequired: 'GGSecure richiesto per giocatori PC',
      leaderboard: 'Classifica',
      ranks: 'Gradi',
      soloMode: 'Solo modalità singola',
      format: '3v3, 4v4 o 5v5',
      playersOnPage: 'giocatori su questa pagina',
      addFakePlayers: 'Aggiungi giocatori test',
      searchingPlayers: 'Ricerca giocatori',
      loginToPlay: 'Accedi per giocare',
      loginRequired: 'Devi effettuare l\'accesso per la modalità classificata.',
      viewAll: 'Vedi tutto',
      noRankedPlayers: 'Nessun giocatore classificato',
      you: 'Tu',
      position: 'Posizione',
      ready3v3: '3v3 pronto, in attesa del 4v4...',
      ready4v4: '4v4 pronto, in attesa del 5v5...',
      creatingMatch: 'Creazione partita...',
      topPlayers: 'Migliori giocatori',
    }
  };
  
  const t = translations[language] || translations.en;

  return (
    <div className={`min-h-screen bg-gradient-to-b from-dark-950 via-dark-900 to-dark-950`}>
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className={`absolute top-0 left-1/4 w-96 h-96 bg-${accent}-500/10 rounded-full blur-3xl`}></div>
          <div className={`absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl`}></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djJIMjR2LTJoMTJ6bTAtNHYySDI0di0yaDEyem0wLTR2Mkg0djJIMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-2xl bg-gradient-to-br ${isHardcore ? 'from-red-500 to-orange-600' : 'from-cyan-400 to-blue-600'} shadow-2xl`}>
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
                {t.title}
              </h1>
            </div>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">{t.subtitle}</p>
          </div>

          {/* Main Grid */}
          <div className="grid lg:grid-cols-3 gap-8 mb-8">
            {/* Left Column - Player Card & Matchmaking */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Player Rank Card */}
              {isAuthenticated && (
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-dark-800/80 to-dark-900/80 backdrop-blur-xl border border-white/10 p-6">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full"></div>
                  
                  {loadingRanking ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className={`w-8 h-8 text-${accent}-500 animate-spin`} />
                    </div>
                  ) : myRanking ? (
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      {/* Rank Badge */}
                      <div className="relative">
                        <div className={`w-28 h-28 rounded-2xl bg-gradient-to-br ${playerRank.gradient} p-1 shadow-2xl`}>
                          <div className="w-full h-full rounded-xl bg-dark-900/50 flex items-center justify-center">
                            <PlayerRankIcon className="w-12 h-12 text-white" />
                          </div>
                        </div>
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-dark-900 border border-white/20">
                          <span className="text-xs font-bold text-white">{playerRank.tier}</span>
                        </div>
                      </div>

                      {/* Rank Info */}
                      <div className="flex-1 text-center md:text-left">
                        <p className="text-gray-500 text-sm uppercase tracking-wider">{t.yourRank}</p>
                        <h2 className="text-3xl font-black text-white mb-1" style={{ color: playerRank.color }}>{playerRank.name}</h2>
                        <p className="text-gray-400">#{myRanking.rank} • <span className={`text-${accent}-400 font-semibold`}>{myRanking.points} pts</span></p>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-3 gap-4 min-w-[240px]">
                        <div className="text-center p-3 rounded-xl bg-dark-800/50">
                          <p className="text-2xl font-bold text-green-400">{myRanking.wins}</p>
                          <p className="text-xs text-gray-500 uppercase">{t.wins}</p>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-dark-800/50">
                          <p className="text-2xl font-bold text-red-400">{myRanking.losses}</p>
                          <p className="text-xs text-gray-500 uppercase">{t.losses}</p>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-dark-800/50">
                          <p className="text-2xl font-bold text-yellow-400">
                            {myRanking.wins + myRanking.losses > 0 
                              ? Math.round((myRanking.wins / (myRanking.wins + myRanking.losses)) * 100) 
                              : 0}%
                          </p>
                          <p className="text-xs text-gray-500 uppercase">{t.winRate}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${RANKS[0].gradient} p-1`}>
                        <div className="w-full h-full rounded-xl bg-dark-900/50 flex items-center justify-center">
                          <Shield className="w-10 h-10 text-white/50" />
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">{t.noRank}</h3>
                      <p className="text-gray-500">{t.playFirst}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Game Mode Selection */}
              <div className="rounded-3xl bg-dark-800/50 backdrop-blur-xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Target className={`w-5 h-5 text-${accent}-500`} />
                  {t.gameMode}
                </h3>
                
                <div className="grid grid-cols-3 gap-3">
                  {/* Search & Destroy - Available */}
                  <button
                    onClick={() => setSelectedGameMode('Search & Destroy')}
                    className={`relative p-4 rounded-2xl border-2 transition-all ${
                      selectedGameMode === 'Search & Destroy'
                        ? `border-${accent}-500 bg-${accent}-500/10 shadow-lg shadow-${accent}-500/20`
                        : 'border-white/10 bg-dark-800/30 hover:border-white/20'
                    }`}
                  >
                    <div className={`w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center ${
                      selectedGameMode === 'Search & Destroy'
                        ? `bg-gradient-to-br ${isHardcore ? 'from-red-500 to-orange-600' : 'from-cyan-400 to-blue-600'}`
                        : 'bg-dark-700'
                    }`}>
                      <Crosshair className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-white font-semibold text-sm">{t.searchDestroy}</p>
                    <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      selectedGameMode === 'Search & Destroy'
                        ? `bg-green-500/20 text-green-400`
                        : 'bg-green-500/10 text-green-400/70'
                    }`}>
                      {t.available}
                    </span>
                  </button>

                  {/* Mêlée générale - Coming Soon */}
                  <div className="relative p-4 rounded-2xl border-2 border-white/5 bg-dark-800/20 opacity-50 cursor-not-allowed">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Lock className="w-6 h-6 text-gray-600" />
                    </div>
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-dark-700/50 flex items-center justify-center">
                      <Swords className="w-6 h-6 text-gray-600" />
                    </div>
                    <p className="text-gray-600 font-semibold text-sm">{t.teamDeathmatch}</p>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-700/30 text-gray-600">
                      {t.comingSoon}
                    </span>
                  </div>

                  {/* Duel - Coming Soon */}
                  <div className="relative p-4 rounded-2xl border-2 border-white/5 bg-dark-800/20 opacity-50 cursor-not-allowed">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Lock className="w-6 h-6 text-gray-600" />
                    </div>
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-dark-700/50 flex items-center justify-center">
                      <Target className="w-6 h-6 text-gray-600" />
                    </div>
                    <p className="text-gray-600 font-semibold text-sm">{t.duel}</p>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-700/30 text-gray-600">
                      {t.comingSoon}
                    </span>
                  </div>
                </div>
              </div>

              {/* Matchmaking Section */}
              {isAuthenticated && selectedGameMode === 'Search & Destroy' && (
                <div className="rounded-3xl bg-dark-800/50 backdrop-blur-xl border border-white/10 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Swords className={`w-5 h-5 text-${accent}-500`} />
                      {t.findMatch}
                    </h3>
                    {/* Page viewers counter */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-dark-700/50 border border-white/10">
                      <Eye className={`w-4 h-4 text-${accent}-400`} />
                      <span className="text-sm text-gray-400">
                        <span className={`font-semibold text-${accent}-400`}>{pageViewers}</span> {t.playersOnPage}
                      </span>
                    </div>
                  </div>

                  {/* Active Match Alert */}
                  {activeMatch && (
                    <div className="mb-4 p-4 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-orange-400" />
                        <span className="text-orange-300 font-medium">{t.activeMatch}</span>
                      </div>
                      <button
                        onClick={() => navigate(`/ranked/match/${activeMatch._id}`)}
                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-xl text-white font-semibold transition-colors"
                      >
                        {t.rejoin}
                      </button>
                    </div>
                  )}

                  {/* GGSecure Warning */}
                  {user?.platform === 'PC' && ggsecureConnected === false && (
                    <div className="mb-4 p-4 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center gap-3">
                      <ShieldCheck className="w-5 h-5 text-red-400" />
                      <span className="text-red-300">{t.ggsecureRequired}</span>
                    </div>
                  )}

                  {/* Error */}
                  {matchmakingError && (
                    <div className="mb-4 p-4 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      <span className="text-red-300">{matchmakingError}</span>
                    </div>
                  )}

                  {/* Queue Status or Find Button */}
                  {inQueue ? (
                    <div className="space-y-4">
                      {/* Dynamic searching animation header */}
                      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-dark-900 to-dark-800 border border-white/10 p-6">
                        {/* Radar animation background */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className={`absolute w-32 h-32 rounded-full border-2 ${isHardcore ? 'border-red-500/20' : 'border-cyan-500/20'} animate-ping`} style={{ animationDuration: '2s' }} />
                          <div className={`absolute w-48 h-48 rounded-full border ${isHardcore ? 'border-red-500/10' : 'border-cyan-500/10'} animate-ping`} style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
                          <div className={`absolute w-64 h-64 rounded-full border ${isHardcore ? 'border-red-500/5' : 'border-cyan-500/5'} animate-ping`} style={{ animationDuration: '3s', animationDelay: '1s' }} />
                        </div>
                        
                        {/* Scanning line effect */}
                        <div className="absolute inset-0 overflow-hidden">
                          <div 
                            className={`absolute w-full h-1 ${isHardcore ? 'bg-gradient-to-r from-transparent via-red-500/50 to-transparent' : 'bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent'} animate-pulse`}
                            style={{ 
                              top: '50%', 
                              transform: 'translateY(-50%)',
                              animation: 'scanLine 2s ease-in-out infinite'
                            }}
                          />
                        </div>
                        
                        <div className="relative z-10 text-center">
                          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${isHardcore ? 'bg-red-500/20 border border-red-500/30' : 'bg-cyan-500/20 border border-cyan-500/30'} mb-4`}>
                            <Radio className={`w-4 h-4 ${isHardcore ? 'text-red-400' : 'text-cyan-400'} animate-pulse`} />
                            <span className={`text-sm font-medium ${isHardcore ? 'text-red-300' : 'text-cyan-300'}`}>
                              {t.searchingPlayers}{searchingDots}
                            </span>
                          </div>
                          
                          {/* Animated player icons */}
                          <div className="flex justify-center gap-2 mb-4">
                            {[...Array(10)].map((_, i) => (
                              <div 
                                key={i}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                                  i < queueSize 
                                    ? `${isHardcore ? 'bg-red-500' : 'bg-cyan-500'} scale-100 shadow-lg ${isHardcore ? 'shadow-red-500/30' : 'shadow-cyan-500/30'}` 
                                    : 'bg-dark-700 scale-90 opacity-50'
                                }`}
                                style={{ 
                                  animationDelay: `${i * 0.1}s`,
                                  animation: i < queueSize ? 'bounce 1s ease-in-out infinite' : 'none'
                                }}
                              >
                                <Users className={`w-4 h-4 ${i < queueSize ? 'text-white' : 'text-gray-600'}`} />
                              </div>
                            ))}
                          </div>
                          
                          <p className={`text-3xl font-black ${isHardcore ? 'text-red-400' : 'text-cyan-400'}`}>
                            {queueSize}<span className="text-gray-500 text-xl">/10</span>
                          </p>
                          <p className="text-gray-500 text-sm">{t.playersInQueue}</p>
                        </div>
                      </div>
                      
                      {/* Queue Stats - more compact */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className={`text-center p-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30`}>
                          <Target className="w-5 h-5 text-purple-400 mx-auto mb-2" />
                          <p className="text-xl font-bold text-white">#{queuePosition || '?'}</p>
                          <p className="text-xs text-gray-500">Position</p>
                        </div>
                        <div className={`text-center p-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30`}>
                          <Clock className={`w-5 h-5 text-green-400 mx-auto mb-2 ${timerActive ? 'animate-pulse' : ''}`} />
                          <p className="text-xl font-bold text-white">
                            {timerActive && timeRemaining !== null
                              ? `${Math.floor(timeRemaining / 60)}:${String(timeRemaining % 60).padStart(2, '0')}`
                              : '--:--'}
                          </p>
                          <p className="text-xs text-gray-500">{timerActive ? t.matchIn : t.waitingMore}</p>
                        </div>
                      </div>

                      {/* Progress Bar with glow effect */}
                      <div className="relative">
                        <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r ${isHardcore ? 'from-red-500 to-orange-500' : 'from-cyan-400 to-blue-500'} transition-all duration-500 relative`}
                            style={{ width: `${(queueSize / 10) * 100}%` }}
                          >
                            {/* Shimmer effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                          </div>
                        </div>
                        {/* Milestone markers */}
                        <div className="absolute top-0 left-0 w-full h-3 flex items-center">
                          <div className="absolute left-[60%] w-0.5 h-full bg-white/20" title="3v3" />
                          <div className="absolute left-[80%] w-0.5 h-full bg-white/20" title="4v4" />
                        </div>
                      </div>

                      <p className="text-center text-sm text-gray-500">
                        {queueSize < 6 ? t.minPlayers : queueSize < 8 ? t.ready3v3 : queueSize < 10 ? t.ready4v4 : t.creatingMatch}
                      </p>

                      {/* Staff/Admin: Add fake players button */}
                      {isStaffOrAdmin && (
                        <button
                          onClick={() => addFakePlayers(5)}
                          disabled={addingFakePlayers}
                          className="w-full py-3 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 font-medium hover:bg-purple-500/30 transition-all flex items-center justify-center gap-2"
                        >
                          {addingFakePlayers ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              <Bot className="w-5 h-5" />
                              {t.addFakePlayers}
                            </>
                          )}
                        </button>
                      )}

                      {/* Cancel Button */}
                      <button
                        onClick={leaveQueue}
                        disabled={leavingQueue}
                        className="w-full py-4 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-400 font-semibold hover:bg-red-500/30 transition-all flex items-center justify-center gap-2"
                      >
                        {leavingQueue ? <Loader2 className="w-5 h-5 animate-spin" /> : <Square className="w-5 h-5" />}
                        {t.cancel}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Mode Info */}
                      <div className="flex items-center gap-4 p-4 rounded-2xl bg-dark-800/50 border border-white/5">
                        <div className={`p-3 rounded-xl bg-gradient-to-br ${isHardcore ? 'from-red-500 to-orange-600' : 'from-cyan-400 to-blue-600'}`}>
                          <Crosshair className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="text-white font-semibold">{t.searchDestroy}</p>
                          <p className="text-gray-500 text-sm">{t.soloMode} • {t.format}</p>
                        </div>
                      </div>

                      {/* Find Match Button */}
                      <button
                        onClick={joinQueue}
                        disabled={joiningQueue || !!activeMatch || (user?.platform === 'PC' && ggsecureConnected === false)}
                        className={`w-full py-5 rounded-2xl bg-gradient-to-r ${
                          isHardcore ? 'from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700' : 'from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700'
                        } text-white font-bold text-lg shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 group`}
                      >
                        {joiningQueue ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <>
                            <Play className="w-6 h-6 group-hover:scale-110 transition-transform" />
                            {t.findMatch}
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Login Prompt */}
              {!isAuthenticated && (
                <div className="rounded-3xl bg-dark-800/50 backdrop-blur-xl border border-white/10 p-8 text-center">
                  <Swords className={`w-16 h-16 text-${accent}-500/50 mx-auto mb-4`} />
                  <h3 className="text-xl font-bold text-white mb-2">{t.loginToPlay}</h3>
                  <p className="text-gray-500">{t.loginRequired}</p>
                </div>
              )}
            </div>

            {/* Right Column - Ranks & Leaderboard */}
            <div className="space-y-6">
              {/* Ranks Overview */}
              <div className="rounded-3xl bg-dark-800/50 backdrop-blur-xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Sparkles className={`w-5 h-5 text-${accent}-500`} />
                  {t.ranks}
                </h3>
                <div className="space-y-2">
                  {RANKS.map((rank) => {
                    const Icon = rank.icon;
                    const isCurrentRank = myRanking && myRanking.points >= rank.min && myRanking.points <= rank.max;
                    return (
                      <div 
                        key={rank.name}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                          isCurrentRank 
                            ? `bg-gradient-to-r ${rank.gradient} bg-opacity-20 border border-white/20` 
                            : 'bg-dark-800/30 hover:bg-dark-800/50'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${rank.gradient} flex items-center justify-center shadow-lg`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-white text-sm">{rank.name}</p>
                          <p className="text-xs text-gray-500">{rank.min} - {rank.max === 99999 ? '∞' : rank.max} pts</p>
                        </div>
                        {isCurrentRank && (
                          <span className="px-2 py-1 rounded-full bg-white/20 text-white text-xs font-bold">
                            {t.you}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

          {/* Horizontal Leaderboard - Bottom */}
          <div className="rounded-3xl bg-dark-800/50 backdrop-blur-xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <div className={`p-2 rounded-xl bg-gradient-to-br ${isHardcore ? 'from-red-500 to-orange-600' : 'from-cyan-400 to-blue-600'}`}>
                  <Crown className="w-5 h-5 text-white" />
                </div>
                {t.topPlayers}
              </h3>
            </div>
            
            {loadingLeaderboard ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className={`w-8 h-8 text-${accent}-500 animate-spin`} />
              </div>
            ) : leaderboard.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-3">
                {leaderboard.slice(0, 10).map((player, idx) => {
                  const rank = getRankFromPoints(player.points);
                  const RankIcon = rank.icon;
                  const isTop3 = idx < 3;
                  
                  return (
                    <button
                      key={player._id}
                      onClick={() => navigate(`/player/${player.user?._id}`)}
                      className={`relative flex flex-col items-center p-4 rounded-2xl transition-all hover:scale-105 ${
                        idx === 0 ? 'bg-gradient-to-br from-yellow-500/20 to-amber-600/10 border-2 border-yellow-500/40' :
                        idx === 1 ? 'bg-gradient-to-br from-gray-400/20 to-slate-500/10 border-2 border-gray-400/40' :
                        idx === 2 ? 'bg-gradient-to-br from-amber-700/20 to-orange-800/10 border-2 border-amber-700/40' :
                        'bg-dark-800/50 border border-white/10 hover:border-white/20'
                      }`}
                    >
                      {/* Rank Badge */}
                      <div className={`absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                        idx === 0 ? 'bg-yellow-500 text-black' :
                        idx === 1 ? 'bg-gray-400 text-black' :
                        idx === 2 ? 'bg-amber-700 text-white' :
                        'bg-dark-700 text-gray-400 border border-white/10'
                      }`}>
                        {idx + 1}
                      </div>
                      
                      {/* Avatar */}
                      <div className={`relative mb-3 ${isTop3 ? 'w-16 h-16' : 'w-12 h-12'}`}>
                        <img 
                          src={player.user?.avatar || `https://cdn.discordapp.com/avatars/${player.user?.discordId}/${player.user?.discordAvatar}.png` || '/avatar.jpg'}
                          alt=""
                          className={`w-full h-full rounded-full object-cover ${isTop3 ? 'ring-2' : ''} ${
                            idx === 0 ? 'ring-yellow-500' :
                            idx === 1 ? 'ring-gray-400' :
                            idx === 2 ? 'ring-amber-700' : ''
                          }`}
                          onError={(e) => { e.target.src = '/avatar.jpg'; }}
                        />
                        {isTop3 && (
                          <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center ${
                            idx === 0 ? 'bg-yellow-500' :
                            idx === 1 ? 'bg-gray-400' :
                            'bg-amber-700'
                          }`}>
                            <span className="text-sm">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Name */}
                      <p className={`text-white font-medium truncate w-full text-center ${isTop3 ? 'text-sm' : 'text-xs'}`}>
                        {player.user?.username || 'Unknown'}
                      </p>
                      
                      {/* Rank & Points */}
                      <div className="flex items-center gap-1 mt-1">
                        <div className={`w-4 h-4 rounded bg-gradient-to-br ${rank.gradient} flex items-center justify-center`}>
                          <RankIcon className="w-2.5 h-2.5 text-white" />
                        </div>
                        <span className={`text-xs font-bold text-${accent}-400`}>{player.points}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">{t.noRankedPlayers}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RankedMode;
