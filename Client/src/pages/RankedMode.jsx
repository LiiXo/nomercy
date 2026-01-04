import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { useSocket } from '../SocketContext';
import { 
  Trophy, Swords, Target, Flag, Skull, Users, Loader2, 
  X, Play, Clock, Zap, Shield, Crown, Medal, Star,
  ChevronRight, AlertCircle, Check, User, Sparkles,
  TrendingUp, Award, Gamepad2, Crosshair
} from 'lucide-react';

import { getAvatarUrl, getDefaultAvatar } from '../utils/avatar';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const RankedMode = () => {
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { on, emit, isConnected } = useSocket();

  const isHardcore = selectedMode === 'hardcore';
  const accentColor = isHardcore ? 'red' : 'cyan';
  const gradientFrom = isHardcore ? 'from-red-500' : 'from-cyan-400';
  const gradientTo = isHardcore ? 'to-orange-600' : 'to-cyan-600';
  const glowColor = isHardcore ? 'shadow-red-500/30' : 'shadow-cyan-500/30';
  const borderColor = isHardcore ? 'border-red-500/30' : 'border-cyan-500/30';

  // States
  const [selectedGameMode, setSelectedGameMode] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [queueStatus, setQueueStatus] = useState(null);
  const [matchFound, setMatchFound] = useState(null);
  const [queuesInfo, setQueuesInfo] = useState({});
  const [error, setError] = useState('');
  const [myRanking, setMyRanking] = useState(null);
  const [loadingRanking, setLoadingRanking] = useState(true);
  const [activeMatch, setActiveMatch] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [appSettings, setAppSettings] = useState(null);
  const [showMatchmakingDialog, setShowMatchmakingDialog] = useState(false);

  // Game modes configuration - Updated with correct player counts
  const gameModes = [
    {
      id: 'Duel',
      icon: Swords,
      players: '1v1',
      minPlayers: 2,
      maxPlayers: 2,
      color: 'from-yellow-500 to-orange-600',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30',
      iconBg: 'bg-yellow-500',
      description: {
        fr: 'Combat en tête-à-tête. Prouve ta valeur en 1 contre 1.',
        en: 'Head-to-head battle. Prove your worth in 1v1.',
        de: 'Kopf-an-Kopf-Kampf. Beweise dich im 1v1.',
        it: 'Battaglia uno contro uno. Dimostra il tuo valore.'
      }
    },
    {
      id: 'Free For All',
      icon: Skull,
      players: '5-10',
      minPlayers: 5,
      maxPlayers: 10,
      color: 'from-red-500 to-pink-600',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      iconBg: 'bg-red-500',
      description: {
        fr: 'Mêlée générale. Chacun pour soi, seul le meilleur survit.',
        en: 'Free-for-all chaos. Every player for themselves.',
        de: 'Freies Gefecht. Jeder kämpft für sich selbst.',
        it: 'Tutti contro tutti. Solo il migliore sopravvive.'
      }
    },
    {
      id: 'Domination',
      icon: Flag,
      players: '8-10',
      minPlayers: 8,
      maxPlayers: 10,
      color: 'from-blue-500 to-purple-600',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      iconBg: 'bg-blue-500',
      description: {
        fr: 'Capture et maintiens les objectifs pour dominer.',
        en: 'Capture and hold objectives to dominate.',
        de: 'Erobere und halte Ziele zur Dominanz.',
        it: 'Cattura e mantieni gli obiettivi per dominare.'
      }
    },
    {
      id: 'Search & Destroy',
      icon: Crosshair,
      players: '6-10',
      minPlayers: 6,
      maxPlayers: 10,
      color: 'from-green-500 to-teal-600',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      iconBg: 'bg-green-500',
      description: {
        fr: 'Plante ou désamorce la bombe. Pas de respawn, tension maximale.',
        en: 'Plant or defuse the bomb. No respawn, maximum tension.',
        de: 'Bombe legen oder entschärfen. Kein Respawn.',
        it: 'Pianta o disinnesca la bomba. Niente respawn.'
      }
    }
  ];

  // Get localized mode name
  const getModeName = (modeId) => {
    const names = {
      'Duel': { fr: 'Duel', en: 'Duel', de: 'Duell', it: 'Duello' },
      'Free For All': { fr: 'Mêlée Générale', en: 'Free For All', de: 'Freies Gefecht', it: 'Tutti Contro Tutti' },
      'Domination': { fr: 'Domination', en: 'Domination', de: 'Herrschaft', it: 'Dominazione' },
      'Search & Destroy': { fr: 'Recherche & Destruction', en: 'Search & Destroy', de: 'Suchen & Zerstören', it: 'Cerca e Distruggi' }
    };
    return names[modeId]?.[language] || modeId;
  };

  // Texts
  const texts = {
    fr: {
      title: 'Mode Classé',
      subtitle: 'Affronte les meilleurs joueurs et grimpe dans le classement',
      selectMode: 'Sélectionne un mode',
      players: 'Joueurs',
      inQueue: 'en file',
      searchMatch: 'Rechercher un match',
      searching: 'Recherche en cours...',
      cancel: 'Annuler',
      matchFound: 'Match trouvé !',
      joiningMatch: 'Connexion au match...',
      estimatedWait: 'Attente estimée',
      seconds: 'sec',
      minutes: 'min',
      yourRank: 'Ton rang actuel',
      currentSeason: 'Saison en cours',
      points: 'points',
      pts: 'PTS',
      wins: 'Victoires',
      losses: 'Défaites',
      notRanked: 'Non classé',
      playFirstMatch: 'Joue ta première partie pour être classé',
      loginRequired: 'Connecte-toi pour jouer en classé',
      activeMatch: 'Tu as un match en cours',
      rejoinMatch: 'Rejoindre le match',
      queuePosition: 'Position dans la file',
      playersSearching: 'joueurs recherchent',
      loginToPlay: 'Connexion requise',
      allRanks: 'Les Rangs',
      ranksDesc: 'Monte en grade et prouve ta valeur',
      top30: 'Classement Top 30',
      you: 'Toi',
      rank: 'Rang',
      position: 'Position',
      gameModes: 'Modes de jeu',
      selectModeFirst: 'Sélectionne un mode pour lancer la recherche',
      matchmaking: 'Matchmaking',
      findingOpponents: 'Recherche d\'adversaires...',
      playersNeeded: 'joueurs requis'
    },
    en: {
      title: 'Ranked Mode',
      subtitle: 'Face the best players and climb the ladder',
      selectMode: 'Select a mode',
      players: 'Players',
      inQueue: 'in queue',
      searchMatch: 'Search Match',
      searching: 'Searching...',
      cancel: 'Cancel',
      matchFound: 'Match Found!',
      joiningMatch: 'Joining match...',
      estimatedWait: 'Estimated wait',
      seconds: 'sec',
      minutes: 'min',
      yourRank: 'Your current rank',
      currentSeason: 'Current Season',
      points: 'points',
      pts: 'PTS',
      wins: 'Wins',
      losses: 'Losses',
      notRanked: 'Unranked',
      playFirstMatch: 'Play your first match to get ranked',
      loginRequired: 'Log in to play ranked',
      activeMatch: 'You have an active match',
      rejoinMatch: 'Rejoin match',
      queuePosition: 'Queue position',
      playersSearching: 'players searching',
      loginToPlay: 'Login required',
      allRanks: 'The Ranks',
      ranksDesc: 'Climb the ranks and prove your worth',
      top30: 'Top 30 Leaderboard',
      you: 'You',
      rank: 'Rank',
      position: 'Position',
      gameModes: 'Game Modes',
      selectModeFirst: 'Select a mode to start searching',
      matchmaking: 'Matchmaking',
      findingOpponents: 'Finding opponents...',
      playersNeeded: 'players required'
    },
    de: {
      title: 'Ranglisten-Modus',
      subtitle: 'Fordere die Besten heraus und klettere in der Rangliste',
      selectMode: 'Modus wählen',
      players: 'Spieler',
      inQueue: 'in Warteschlange',
      searchMatch: 'Match suchen',
      searching: 'Suche läuft...',
      cancel: 'Abbrechen',
      matchFound: 'Match gefunden!',
      joiningMatch: 'Verbinde mit Match...',
      estimatedWait: 'Geschätzte Wartezeit',
      seconds: 'Sek',
      minutes: 'Min',
      yourRank: 'Dein aktueller Rang',
      currentSeason: 'Aktuelle Saison',
      points: 'Punkte',
      pts: 'PKT',
      wins: 'Siege',
      losses: 'Niederlagen',
      notRanked: 'Nicht platziert',
      playFirstMatch: 'Spiele dein erstes Match',
      loginRequired: 'Melde dich an',
      activeMatch: 'Du hast ein aktives Match',
      rejoinMatch: 'Match beitreten',
      queuePosition: 'Position',
      playersSearching: 'Spieler suchen',
      loginToPlay: 'Anmeldung erforderlich',
      allRanks: 'Die Ränge',
      ranksDesc: 'Steige auf und beweise dein Können',
      top30: 'Top 30 Rangliste',
      you: 'Du',
      rank: 'Rang',
      position: 'Position',
      gameModes: 'Spielmodi',
      selectModeFirst: 'Wähle einen Modus um zu starten',
      matchmaking: 'Matchmaking',
      findingOpponents: 'Gegner werden gesucht...',
      playersNeeded: 'Spieler benötigt'
    },
    it: {
      title: 'Modalità Classificata',
      subtitle: 'Affronta i migliori giocatori e scala la classifica',
      selectMode: 'Seleziona modalità',
      players: 'Giocatori',
      inQueue: 'in coda',
      searchMatch: 'Cerca Partita',
      searching: 'Ricerca...',
      cancel: 'Annulla',
      matchFound: 'Partita Trovata!',
      joiningMatch: 'Connessione...',
      estimatedWait: 'Attesa stimata',
      seconds: 'sec',
      minutes: 'min',
      yourRank: 'Il tuo rango attuale',
      currentSeason: 'Stagione in corso',
      points: 'punti',
      pts: 'PNT',
      wins: 'Vittorie',
      losses: 'Sconfitte',
      notRanked: 'Non classificato',
      playFirstMatch: 'Gioca la prima partita',
      loginRequired: 'Accedi per giocare',
      activeMatch: 'Hai una partita attiva',
      rejoinMatch: 'Rientra',
      queuePosition: 'Posizione',
      playersSearching: 'giocatori cercano',
      loginToPlay: 'Accesso richiesto',
      allRanks: 'I Ranghi',
      ranksDesc: 'Sali di grado e dimostra il tuo valore',
      top30: 'Classifica Top 30',
      you: 'Tu',
      rank: 'Rango',
      position: 'Posizione',
      gameModes: 'Modalità di gioco',
      selectModeFirst: 'Seleziona una modalità per iniziare',
      matchmaking: 'Matchmaking',
      findingOpponents: 'Ricerca avversari...',
      playersNeeded: 'giocatori richiesti'
    }
  };

  const t = texts[language] || texts.en;

  // Ranks configuration
  const allRanks = [
    {
      name: 'Bronze',
      color: 'from-amber-700 to-amber-900',
      textColor: 'text-amber-600',
      bgColor: 'bg-amber-900/20',
      borderColor: 'border-amber-700/40',
      glowColor: 'shadow-amber-700/20',
      icon: Shield,
      minPoints: 0,
      maxPoints: 499,
      pointsRange: '0 - 499'
    },
    {
      name: 'Silver',
      color: 'from-gray-400 to-gray-600',
      textColor: 'text-gray-300',
      bgColor: 'bg-gray-500/20',
      borderColor: 'border-gray-500/40',
      glowColor: 'shadow-gray-500/20',
      icon: Shield,
      minPoints: 500,
      maxPoints: 999,
      pointsRange: '500 - 999'
    },
    {
      name: 'Gold',
      color: 'from-yellow-500 to-yellow-700',
      textColor: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-500/40',
      glowColor: 'shadow-yellow-500/30',
      icon: Medal,
      minPoints: 1000,
      maxPoints: 1499,
      pointsRange: '1000 - 1499'
    },
    {
      name: 'Platinum',
      color: 'from-teal-400 to-teal-600',
      textColor: 'text-teal-400',
      bgColor: 'bg-teal-500/20',
      borderColor: 'border-teal-500/40',
      glowColor: 'shadow-teal-500/30',
      icon: Medal,
      minPoints: 1500,
      maxPoints: 1999,
      pointsRange: '1500 - 1999'
    },
    {
      name: 'Diamond',
      color: 'from-blue-400 to-purple-500',
      textColor: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      borderColor: 'border-blue-500/40',
      glowColor: 'shadow-blue-500/30',
      icon: Star,
      minPoints: 2000,
      maxPoints: 2499,
      pointsRange: '2000 - 2499'
    },
    {
      name: 'Master',
      color: 'from-purple-500 to-pink-500',
      textColor: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      borderColor: 'border-purple-500/40',
      glowColor: 'shadow-purple-500/30',
      icon: Trophy,
      minPoints: 2500,
      maxPoints: 2999,
      pointsRange: '2500 - 2999'
    },
    {
      name: 'Grandmaster',
      color: 'from-red-500 to-orange-500',
      textColor: 'text-red-400',
      bgColor: 'bg-red-500/20',
      borderColor: 'border-red-500/40',
      glowColor: 'shadow-red-500/30',
      icon: Crown,
      minPoints: 3000,
      maxPoints: 3499,
      pointsRange: '3000 - 3499'
    },
    {
      name: 'Champion',
      color: 'from-yellow-400 via-orange-500 to-red-500',
      textColor: 'text-yellow-400',
      bgColor: 'bg-gradient-to-br from-yellow-500/20 to-red-500/20',
      borderColor: 'border-yellow-500/50',
      glowColor: 'shadow-yellow-500/40',
      icon: Zap,
      minPoints: 3500,
      maxPoints: 99999,
      pointsRange: '3500+',
      special: true
    }
  ];

  const getRankForPoints = (points) => {
    return [...allRanks].reverse().find(r => points >= r.minPoints) || allRanks[0];
  };

  // Set page title
  useEffect(() => {
    const titles = {
      fr: 'NoMercy - Mode Classé',
      en: 'NoMercy - Ranked Mode',
      it: 'NoMercy - Modalità Classificata',
      de: 'NoMercy - Ranglisten-Modus',
    };
    document.title = titles[language] || titles.en;
  }, [language]);

  // Fetch ranking, leaderboard and check for active match
  useEffect(() => {
    if (isAuthenticated) {
      fetchMyRanking();
      checkActiveMatch();
    } else {
      setLoadingRanking(false);
    }
    fetchQueuesInfo();
    fetchLeaderboard();
  }, [isAuthenticated, selectedMode]);

  // Fetch app settings
  useEffect(() => {
    const fetchAppSettings = async () => {
      try {
        const response = await fetch(`${API_URL}/app-settings/public`);
        const data = await response.json();
        if (data.success) {
          setAppSettings(data);
        }
      } catch (err) {
        console.error('Error fetching app settings:', err);
      }
    };
    fetchAppSettings();
  }, []);

  // Socket events for matchmaking
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Handle ranked match found
    const handleMatchFound = (data) => {
      console.log('Match found:', data);
      setMatchFound(data);
      setIsSearching(false);
      
      setTimeout(() => {
        setShowMatchmakingDialog(false);
        navigate(`/ranked-match/${data.matchId}`);
      }, 2000);
    };

    // Handle queue updates
    const handleQueueUpdate = (data) => {
      setQueueStatus(data);
    };

    // Subscribe to events
    const unsubMatchFound = on('rankedMatchFound', handleMatchFound);
    const unsubQueueUpdate = on('queueUpdate', handleQueueUpdate);

    return () => {
      unsubMatchFound();
      unsubQueueUpdate();
    };
  }, [isAuthenticated, user, navigate, on]);

  // Search timer
  useEffect(() => {
    let interval;
    if (isSearching) {
      interval = setInterval(() => {
        setSearchTime(prev => prev + 1);
      }, 1000);
    } else {
      setSearchTime(0);
    }
    return () => clearInterval(interval);
  }, [isSearching]);

  const fetchMyRanking = async () => {
    setLoadingRanking(true);
    try {
      const response = await fetch(`${API_URL}/rankings/me/${selectedMode}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setMyRanking(data.ranking);
      }
    } catch (err) {
      console.error('Error fetching ranking:', err);
    } finally {
      setLoadingRanking(false);
    }
  };

  const checkActiveMatch = async () => {
    try {
      const response = await fetch(`${API_URL}/ranked-matches/active/me?mode=${selectedMode}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success && data.hasActiveMatch) {
        setActiveMatch(data.match);
      }
    } catch (err) {
      console.error('Error checking active match:', err);
    }
  };

  const fetchQueuesInfo = async () => {
    try {
      const response = await fetch(`${API_URL}/ranked-matches/matchmaking/queues?mode=${selectedMode}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setQueuesInfo(data.queues);
      }
    } catch (err) {
      console.error('Error fetching queues:', err);
    }
  };

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const response = await fetch(`${API_URL}/rankings/leaderboard/${selectedMode}?limit=30`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setLeaderboard(data.rankings);
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const handleSearchMatch = async () => {
    if (!selectedGameMode || !isAuthenticated) return;

    setError('');
    setIsSearching(true);
    setShowMatchmakingDialog(true);

    try {
      const response = await fetch(`${API_URL}/ranked-matches/matchmaking/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          gameMode: selectedGameMode,
          mode: selectedMode
        })
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.message);
        setIsSearching(false);
        
        if (data.matchId) {
          setActiveMatch({ _id: data.matchId });
        }
        return;
      }

      if (data.matchFound) {
        setMatchFound(data);
        setIsSearching(false);
        setTimeout(() => {
          setShowMatchmakingDialog(false);
          navigate(`/ranked-match/${data.match._id}`);
        }, 2000);
      } else {
        setQueueStatus({
          position: data.queuePosition,
          queueSize: data.queueSize,
          estimatedWait: data.estimatedWait
        });
      }
    } catch (err) {
      console.error('Error joining queue:', err);
      setError('Erreur de connexion');
      setIsSearching(false);
    }
  };

  const handleCancelSearch = async () => {
    try {
      await fetch(`${API_URL}/ranked-matches/matchmaking/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          gameMode: selectedGameMode,
          mode: selectedMode
        })
      });
    } catch (err) {
      console.error('Error leaving queue:', err);
    }
    
    setIsSearching(false);
    setQueueStatus(null);
    setShowMatchmakingDialog(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 
      ? `${mins}:${secs.toString().padStart(2, '0')}` 
      : `${secs}s`;
  };

  const playerRank = myRanking ? getRankForPoints(myRanking.points) : null;
  const RankIcon = playerRank?.icon || Shield;

  // Matchmaking Dialog Component
  const MatchmakingDialog = () => {
    if (!showMatchmakingDialog) return null;

    const selectedModeInfo = gameModes.find(m => m.id === selectedGameMode);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={!isSearching ? () => setShowMatchmakingDialog(false) : undefined}
        />
        
        {/* Dialog */}
        <div className={`relative w-full max-w-md bg-dark-900/95 backdrop-blur-xl rounded-3xl border-2 ${borderColor} shadow-2xl overflow-hidden`}>
          {/* Header */}
          <div className={`p-6 bg-gradient-to-r ${gradientFrom} ${gradientTo}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  {selectedModeInfo && <selectedModeInfo.icon className="w-6 h-6 text-white" />}
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">{t.matchmaking}</h3>
                  <p className="text-white/80 text-sm">{getModeName(selectedGameMode)}</p>
                </div>
              </div>
              {!isSearching && (
                <button
                  onClick={() => setShowMatchmakingDialog(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            {matchFound ? (
              <div className="text-center">
                <div className={`w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center animate-pulse`}>
                  <Check className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-3xl font-black text-white mb-3">{t.matchFound}</h3>
                <p className="text-gray-400 text-lg">{t.joiningMatch}</p>
              </div>
            ) : (
              <div className="text-center">
                {/* Animated searching spinner */}
                <div className="relative w-32 h-32 mx-auto mb-8">
                  {/* Outer rotating ring */}
                  <div className={`absolute inset-0 rounded-full border-4 border-transparent bg-gradient-to-r ${gradientFrom} ${gradientTo} animate-spin`} style={{ 
                    borderRadius: '50%',
                    background: `conic-gradient(from 0deg, transparent, ${isHardcore ? '#ef4444' : '#06b6d4'}, transparent)`,
                    animation: 'spin 2s linear infinite'
                  }} />
                  
                  {/* Inner circle */}
                  <div className="absolute inset-2 rounded-full bg-dark-900 flex items-center justify-center">
                    <div className={`absolute inset-0 rounded-full border-2 ${borderColor} opacity-50`} />
                    <Swords className={`w-12 h-12 text-${accentColor}-400 animate-pulse`} />
                  </div>

                  {/* Pulsing circles */}
                  <div className={`absolute inset-0 rounded-full border-2 ${borderColor} animate-ping opacity-30`} />
                </div>

                <h3 className="text-2xl font-bold text-white mb-2">{t.findingOpponents}</h3>
                
                {/* Timer */}
                <p className={`text-4xl font-black bg-gradient-to-r ${gradientFrom} ${gradientTo} bg-clip-text text-transparent mb-6 font-mono`}>
                  {formatTime(searchTime)}
                </p>

                {/* Queue info */}
                {queueStatus && (
                  <div className="mb-6 p-4 bg-dark-800/50 rounded-xl space-y-3">
                    <div className="flex items-center justify-center gap-2 text-gray-300">
                      <Users className="w-5 h-5" />
                      <span className="font-medium">{queueStatus.queueSize} {t.playersSearching}</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                      <span>{t.queuePosition}:</span>
                      <span className={`font-bold text-${accentColor}-400`}>#{queueStatus.position}</span>
                    </div>
                    {selectedModeInfo && (
                      <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                        <span>{selectedModeInfo.minPlayers}-{selectedModeInfo.maxPlayers} {t.playersNeeded}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Cancel button */}
                <button
                  onClick={handleCancelSearch}
                  className="w-full px-8 py-4 bg-red-500/20 hover:bg-red-500/30 border-2 border-red-500/40 rounded-xl text-red-400 font-bold transition-all flex items-center justify-center gap-3 hover:scale-105"
                >
                  <X className="w-5 h-5" />
                  {t.cancel}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-dark-950 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-dark-900 via-dark-950 to-dark-900" />
        {isHardcore ? (
          <>
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 20%, rgba(239, 68, 68, 0.15) 0%, transparent 60%)' }} />
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 70% 80%, rgba(249, 115, 22, 0.1) 0%, transparent 60%)' }} />
          </>
        ) : (
          <>
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 20%, rgba(6, 182, 212, 0.15) 0%, transparent 60%)' }} />
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 70% 80%, rgba(59, 130, 246, 0.1) 0%, transparent 60%)' }} />
          </>
        )}
        <div className="absolute inset-0 grid-pattern opacity-10" />
      </div>
          
      <div className="relative z-10 py-10 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br ${gradientFrom} ${gradientTo} shadow-2xl ${glowColor} mb-5`}>
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <h1 className={`text-4xl md:text-5xl font-black bg-gradient-to-r ${gradientFrom} ${gradientTo} bg-clip-text text-transparent mb-3`}>
              {t.title}
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">{t.subtitle}</p>
          </div>

          {/* ====== ANIMATED RANKS CARDS ====== */}
          <div className="mb-12">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-white flex items-center justify-center gap-3">
                <Award className={`w-7 h-7 text-${accentColor}-400`} />
                {t.allRanks}
              </h2>
              <p className="text-gray-500 text-sm mt-1">{t.ranksDesc}</p>
            </div>

            {/* Ranks Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 max-w-6xl mx-auto px-2">
              {allRanks.map((rank, index) => {
                const RIcon = rank.icon;
                const isPlayerRank = myRanking && myRanking.points >= rank.minPoints && myRanking.points <= rank.maxPoints;
                
                return (
                  <div
                    key={rank.name}
                    className="group relative"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    {/* Glow effect behind card */}
                    <div 
                      className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${rank.color} opacity-0 group-hover:opacity-30 blur-xl transition-all duration-500 ${isPlayerRank ? 'opacity-40' : ''}`}
                    />
                    
                    {/* Card */}
                    <div
                      className={`relative p-4 rounded-2xl border-2 transition-all duration-500 transform group-hover:scale-105 group-hover:-translate-y-2 ${
                        isPlayerRank
                          ? `${rank.bgColor} ${rank.borderColor} shadow-2xl ${rank.glowColor} scale-105 -translate-y-1`
                          : 'bg-dark-900/60 border-dark-700/50 hover:border-opacity-100'
                      } group-hover:${rank.borderColor} backdrop-blur-sm`}
                    >
                      {/* Player rank indicator */}
                      {isPlayerRank && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-dark-900 text-xs font-black shadow-lg animate-bounce whitespace-nowrap">
                          ⭐ {t.you}
                        </div>
                      )}
                      
                      {/* Animated background particles */}
                      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                        <div className={`absolute w-20 h-20 -top-10 -right-10 rounded-full bg-gradient-to-br ${rank.color} opacity-0 group-hover:opacity-20 blur-2xl transition-all duration-700 group-hover:scale-150`} />
                        <div className={`absolute w-16 h-16 -bottom-8 -left-8 rounded-full bg-gradient-to-br ${rank.color} opacity-0 group-hover:opacity-15 blur-2xl transition-all duration-700 delay-100 group-hover:scale-150`} />
                      </div>
                      
                      <div className="relative text-center">
                        {/* Rank Icon with animation */}
                        <div className={`relative w-16 h-16 mx-auto mb-3 rounded-xl bg-gradient-to-br ${rank.color} flex items-center justify-center shadow-xl transition-all duration-500 group-hover:shadow-2xl ${rank.glowColor} ${isPlayerRank ? 'animate-pulse' : 'group-hover:scale-110'}`}>
                          {/* Shine effect */}
                          <div className="absolute inset-0 rounded-xl overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/30 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                          </div>
                          <RIcon className="w-8 h-8 text-white drop-shadow-lg relative z-10" />
                          
                          {/* Rotating ring for special rank */}
                          {rank.special && (
                            <div className="absolute inset-0 rounded-xl border-2 border-yellow-400/50 animate-spin" style={{ animationDuration: '8s' }} />
                          )}
                        </div>
                        
                        {/* Rank Name */}
                        <h3 className={`text-sm font-black ${rank.textColor} mb-1 transition-all duration-300 group-hover:scale-110`}>
                          {rank.name}
                        </h3>
                        
                        {/* Points Range */}
                        <p className="text-gray-500 text-xs font-mono transition-all duration-300 group-hover:text-gray-400">
                          {rank.pointsRange}
                        </p>
                        
                        {/* Progress bar for current rank */}
                        {isPlayerRank && myRanking && (
                          <div className="mt-3">
                            <div className="h-1.5 bg-dark-800 rounded-full overflow-hidden">
                              <div 
                                className={`h-full bg-gradient-to-r ${rank.color} transition-all duration-1000 ease-out`}
                                style={{ 
                                  width: `${Math.min(100, ((myRanking.points - rank.minPoints) / (rank.maxPoints - rank.minPoints + 1)) * 100)}%` 
                                }}
                              />
                            </div>
                            <p className="text-[10px] text-gray-600 mt-1 font-mono">
                              {myRanking.points} / {rank.maxPoints === 99999 ? '∞' : rank.maxPoints}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3 text-red-400 max-w-3xl mx-auto backdrop-blur-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
              <button onClick={() => setError('')} className="ml-auto p-1 hover:bg-red-500/20 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Active match banner */}
          {activeMatch && (
            <div className={`mb-8 p-5 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-2xl flex items-center justify-between max-w-3xl mx-auto shadow-2xl`}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center animate-pulse">
                  <Swords className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white font-bold text-lg">{t.activeMatch}</p>
                  <p className="text-white/80 text-sm">{activeMatch.gameMode}</p>
                </div>
              </div>
              <button
                onClick={() => navigate(`/ranked-match/${activeMatch._id}`)}
                className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-xl text-white font-bold transition-all flex items-center gap-2 hover:scale-105"
              >
                {t.rejoinMatch}
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* ====== CURRENT RANK CARD ====== */}
          {isAuthenticated && (
            <div className={`mb-10 bg-dark-900/60 backdrop-blur-xl rounded-3xl border ${borderColor} overflow-hidden max-w-3xl mx-auto shadow-2xl`}>
              <div className={`px-6 py-4 border-b ${borderColor} bg-dark-800/50`}>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <TrendingUp className={`w-5 h-5 text-${accentColor}-400`} />
                  {t.currentSeason}
                </h3>
              </div>
              
              {loadingRanking ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className={`w-8 h-8 text-${accentColor}-500 animate-spin`} />
                </div>
              ) : myRanking ? (
                <div className="p-6 md:p-8">
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    {/* Rank Badge */}
                    <div className="relative">
                      <div className={`w-28 h-28 rounded-2xl bg-gradient-to-br ${playerRank.color} flex items-center justify-center shadow-2xl ${playerRank.glowColor}`}>
                        <RankIcon className="w-14 h-14 text-white drop-shadow-lg" />
                      </div>
                      {myRanking.rank && (
                        <div className={`absolute -top-3 -right-3 px-3 py-1.5 rounded-full bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white text-sm font-black shadow-lg`}>
                          #{myRanking.rank}
                        </div>
                      )}
                    </div>
                    
                    {/* Rank Info */}
                    <div className="flex-1 text-center md:text-left">
                      <p className="text-gray-500 text-sm uppercase tracking-wider mb-1">{t.yourRank}</p>
                      <h2 className={`text-4xl font-black ${playerRank.textColor} mb-3`}>{playerRank.name}</h2>
                      <div className="flex items-center justify-center md:justify-start gap-3">
                        <div className="flex items-center gap-2 px-4 py-2 bg-dark-800/80 rounded-xl border border-dark-700">
                          <Sparkles className={`w-5 h-5 text-${accentColor}-400`} />
                          <span className="text-white font-black text-2xl">{myRanking.points}</span>
                          <span className="text-gray-500 text-sm">{t.pts}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-4">
                      <div className="text-center px-6 py-4 bg-dark-800/50 rounded-2xl border border-green-500/20">
                        <p className="text-3xl font-black text-green-400">{myRanking.wins}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">{t.wins}</p>
                      </div>
                      <div className="text-center px-6 py-4 bg-dark-800/50 rounded-2xl border border-red-500/20">
                        <p className="text-3xl font-black text-red-400">{myRanking.losses}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">{t.losses}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 flex flex-col md:flex-row items-center gap-6">
                  <div className="w-24 h-24 rounded-2xl bg-dark-800/80 flex items-center justify-center border border-dark-700">
                    <Shield className="w-12 h-12 text-gray-600" />
                  </div>
                  <div className="text-center md:text-left">
                    <p className="text-gray-500 text-sm uppercase tracking-wider mb-1">{t.yourRank}</p>
                    <h2 className="text-3xl font-black text-gray-400 mb-2">{t.notRanked}</h2>
                    <p className="text-gray-600">{t.playFirstMatch}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ====== GAME MODES ====== */}
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <Gamepad2 className={`w-6 h-6 text-${accentColor}-400`} />
              {t.gameModes}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-5xl mx-auto">
              {gameModes.map((mode) => {
                const Icon = mode.icon;
                const isSelected = selectedGameMode === mode.id;
                const queueInfo = queuesInfo[mode.id];
                
                return (
                  <button
                    key={mode.id}
                    onClick={() => !isSearching && setSelectedGameMode(mode.id)}
                    disabled={isSearching}
                    className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left group overflow-hidden ${
                      isSelected 
                        ? `${mode.bgColor} border-white/50 shadow-2xl scale-[1.02]` 
                        : `bg-dark-900/40 ${mode.borderColor} hover:bg-dark-900/60 hover:scale-[1.01]`
                    } ${isSearching ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {/* Background gradient effect */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${mode.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                    
                    {/* Selected check */}
                    {isSelected && (
                      <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg animate-bounce">
                        <Check className="w-5 h-5 text-dark-900" />
                      </div>
                    )}
                    
                    <div className="relative z-10">
                      {/* Mode header */}
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${mode.color} flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform duration-300`}>
                          <Icon className="w-8 h-8 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-black text-white mb-1">{getModeName(mode.id)}</h3>
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white border ${mode.borderColor}`}>
                              <Users className="w-3 h-3 inline mr-1" />
                              {mode.players} {t.players}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-gray-400 text-sm mb-4 leading-relaxed">{mode.description[language]}</p>
                      
                      {/* Queue stats */}
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-dark-800/50 rounded-lg">
                          <Users className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-400">{queueInfo?.playersInQueue || 0}</span>
                          <span className="text-gray-600">{t.inQueue}</span>
                        </div>
                        {queueInfo?.estimatedWait > 0 && (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-dark-800/50 rounded-lg">
                            <Clock className="w-4 h-4 text-gray-500" />
                            <span className="text-gray-400">~{Math.ceil(queueInfo.estimatedWait / 60)}</span>
                            <span className="text-gray-600">{t.minutes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ====== SEARCH BUTTON ====== */}
          <div className="max-w-md mx-auto mb-12">
            {!isAuthenticated ? (
              <div className="p-8 bg-dark-900/60 backdrop-blur-xl rounded-2xl border border-white/10 text-center">
                <User className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 mb-6 text-lg">{t.loginRequired}</p>
                <button
                  onClick={() => navigate('/login')}
                  className={`w-full px-8 py-4 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-xl text-white font-bold text-lg shadow-xl hover:scale-105 transition-transform`}
                >
                  {t.loginToPlay}
                </button>
              </div>
            ) : (
              <button
                onClick={handleSearchMatch}
                disabled={!selectedGameMode || activeMatch}
                className={`w-full py-6 rounded-2xl font-black text-xl transition-all flex items-center justify-center gap-4 shadow-2xl ${
                  selectedGameMode && !activeMatch
                    ? `bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white hover:scale-105 ${glowColor}`
                    : 'bg-dark-800/50 text-gray-600 cursor-not-allowed'
                }`}
              >
                <Play className="w-7 h-7" />
                {selectedGameMode ? t.searchMatch : t.selectModeFirst}
              </button>
            )}
          </div>

          {/* ====== TOP 30 LEADERBOARD ====== */}
          <div className={`bg-dark-900/60 backdrop-blur-xl rounded-3xl border ${borderColor} overflow-hidden max-w-6xl mx-auto shadow-2xl`}>
            <div className={`p-6 border-b ${borderColor} bg-gradient-to-r ${gradientFrom} ${gradientTo}`}>
              <h2 className="text-2xl font-black text-white flex items-center gap-3">
                <Trophy className="w-7 h-7" />
                {t.top30}
              </h2>
            </div>
            
            {loadingLeaderboard ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className={`w-10 h-10 text-${accentColor}-500 animate-spin`} />
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <Users className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-lg">{language === 'fr' ? 'Aucun joueur classé' : 'No ranked players yet'}</p>
              </div>
            ) : (
              <div className="divide-y divide-dark-700/30">
                {leaderboard.map((player, index) => {
                  const playerRankInfo = getRankForPoints(player.points);
                  const RIcon = playerRankInfo.icon;
                  const isCurrentUser = user && player.user?._id === user._id;
                  
                  return (
                    <div
                      key={player._id}
                      className={`flex items-center gap-4 md:gap-6 p-4 md:p-5 transition-all hover:bg-dark-800/40 ${
                        isCurrentUser ? `bg-${accentColor}-500/10 border-l-4 border-${accentColor}-500` : ''
                      }`}
                    >
                      {/* Position Badge */}
                      <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center font-black text-lg flex-shrink-0 ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900 shadow-xl shadow-yellow-500/30' :
                        index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-gray-800 shadow-xl shadow-gray-400/30' :
                        index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-orange-900 shadow-xl shadow-orange-500/30' :
                        'bg-dark-700/50 text-gray-400'
                      }`}>
                        {index === 0 && <Crown className="w-6 h-6" />}
                        {index === 1 && <Medal className="w-6 h-6" />}
                        {index === 2 && <Medal className="w-6 h-6" />}
                        {index > 2 && (index + 1)}
                      </div>

                      {/* Player info */}
                      <Link
                        to={`/profile/${player.user?.username}`}
                        className="flex items-center gap-3 md:gap-4 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                      >
                        <div className="relative flex-shrink-0">
                          <img
                            src={getAvatarUrl(player.user?.avatar || player.user?.avatarUrl) || getDefaultAvatar(player.user?.username)}
                            alt={player.user?.username}
                            className={`w-10 h-10 md:w-12 md:h-12 rounded-xl object-cover border-2 ${
                              index < 3 ? 'border-yellow-400/50 shadow-lg' : 'border-dark-600'
                            }`}
                          />
                          {isCurrentUser && (
                            <div className={`absolute -top-1 -right-1 w-5 h-5 bg-${accentColor}-500 rounded-full border-2 border-dark-900 flex items-center justify-center`}>
                              <Star className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className={`font-bold text-base md:text-lg truncate ${isCurrentUser ? `text-${accentColor}-400` : 'text-white'}`}>
                            {player.user?.username || player.user?.discordUsername || 'Unknown'}
                          </p>
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-lg bg-gradient-to-br ${playerRankInfo.color} flex items-center justify-center`}>
                              <RIcon className="w-3 h-3 text-white" />
                            </div>
                            <span className={`text-sm font-medium ${playerRankInfo.textColor}`}>{playerRankInfo.name}</span>
                          </div>
                        </div>
                      </Link>

                      {/* Stats */}
                      <div className="flex items-center gap-2 md:gap-6 flex-shrink-0">
                        <div className="hidden md:flex items-center gap-4">
                          <div className="text-center px-4 py-2 bg-dark-800/40 rounded-xl">
                            <p className="text-lg font-bold text-green-400">{player.wins}W</p>
                          </div>
                          <div className="text-center px-4 py-2 bg-dark-800/40 rounded-xl">
                            <p className="text-lg font-bold text-red-400">{player.losses}L</p>
                          </div>
                        </div>
                        <div className="text-center min-w-[60px] md:min-w-[80px]">
                          <p className={`text-xl md:text-2xl font-black ${playerRankInfo.textColor}`}>{player.points}</p>
                          <p className="text-xs text-gray-500 uppercase">{t.pts}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Matchmaking Dialog */}
      <MatchmakingDialog />
    </div>
  );
};

export default RankedMode;
