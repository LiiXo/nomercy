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
  TrendingUp, Award, Gamepad2, Crosshair, Flame, Hexagon
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

  // Game modes configuration
  const gameModes = [
    {
      id: 'Duel',
      icon: Swords,
      players: '1v1',
      minPlayers: 2,
      maxPlayers: 2,
      color: 'from-amber-500 to-orange-600',
      accentHex: '#f59e0b',
      enabled: true,
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
      color: 'from-rose-500 to-pink-600',
      accentHex: '#f43f5e',
      enabled: true,
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
      color: 'from-violet-500 to-purple-600',
      accentHex: '#8b5cf6',
      enabled: false,
      comingSoon: true,
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
      color: 'from-emerald-500 to-teal-600',
      accentHex: '#10b981',
      enabled: false,
      comingSoon: true,
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
      searchMatch: 'Lancer la recherche',
      searching: 'Recherche en cours...',
      cancel: 'Annuler',
      matchFound: 'Match trouvé !',
      joiningMatch: 'Connexion au match...',
      estimatedWait: 'Attente estimée',
      seconds: 'sec',
      minutes: 'min',
      yourRank: 'Ton rang',
      points: 'points',
      pts: 'PTS',
      wins: 'Victoires',
      losses: 'Défaites',
      notRanked: 'Non classé',
      playFirstMatch: 'Joue ta première partie pour être classé',
      loginRequired: 'Connecte-toi pour jouer en classé',
      activeMatch: 'Tu as un match en cours',
      rejoinMatch: 'Rejoindre',
      queuePosition: 'Position dans la file',
      playersSearching: 'joueurs recherchent',
      loginToPlay: 'Se connecter',
      allRanks: 'Progression des rangs',
      ranksDesc: 'Gagne des points pour monter en division',
      top30: 'Classement Global',
      you: 'Toi',
      rank: 'Rang',
      position: 'Position',
      gameModes: 'Choisis ton mode de jeu',
      selectModeFirst: 'Sélectionne un mode',
      matchmaking: 'Matchmaking',
      findingOpponents: 'Recherche d\'adversaires...',
      playersNeeded: 'joueurs requis',
      winRate: 'Ratio',
      globalRank: 'Classement',
      nextRank: 'Prochain rang',
      pointsNeeded: 'pts restants',
      comingSoon: 'À venir'
    },
    en: {
      title: 'Ranked Mode',
      subtitle: 'Face the best players and climb the ladder',
      selectMode: 'Select a mode',
      players: 'Players',
      inQueue: 'in queue',
      searchMatch: 'Start Search',
      searching: 'Searching...',
      cancel: 'Cancel',
      matchFound: 'Match Found!',
      joiningMatch: 'Joining match...',
      estimatedWait: 'Estimated wait',
      seconds: 'sec',
      minutes: 'min',
      yourRank: 'Your rank',
      points: 'points',
      pts: 'PTS',
      wins: 'Wins',
      losses: 'Losses',
      notRanked: 'Unranked',
      playFirstMatch: 'Play your first match to get ranked',
      loginRequired: 'Log in to play ranked',
      activeMatch: 'You have an active match',
      rejoinMatch: 'Rejoin',
      queuePosition: 'Queue position',
      playersSearching: 'players searching',
      loginToPlay: 'Log in',
      allRanks: 'Rank Progression',
      ranksDesc: 'Earn points to climb divisions',
      top30: 'Global Leaderboard',
      you: 'You',
      rank: 'Rank',
      position: 'Position',
      gameModes: 'Choose your game mode',
      selectModeFirst: 'Select a mode',
      matchmaking: 'Matchmaking',
      findingOpponents: 'Finding opponents...',
      playersNeeded: 'players required',
      winRate: 'Win Rate',
      globalRank: 'Ranking',
      nextRank: 'Next rank',
      pointsNeeded: 'pts needed',
      comingSoon: 'Coming Soon'
    },
    de: {
      title: 'Ranglisten-Modus',
      subtitle: 'Fordere die Besten heraus und klettere in der Rangliste',
      selectMode: 'Modus wählen',
      players: 'Spieler',
      inQueue: 'in Warteschlange',
      searchMatch: 'Suche starten',
      searching: 'Suche läuft...',
      cancel: 'Abbrechen',
      matchFound: 'Match gefunden!',
      joiningMatch: 'Verbinde mit Match...',
      estimatedWait: 'Geschätzte Wartezeit',
      seconds: 'Sek',
      minutes: 'Min',
      yourRank: 'Dein Rang',
      points: 'Punkte',
      pts: 'PKT',
      wins: 'Siege',
      losses: 'Niederlagen',
      notRanked: 'Nicht platziert',
      playFirstMatch: 'Spiele dein erstes Match',
      loginRequired: 'Melde dich an',
      activeMatch: 'Du hast ein aktives Match',
      rejoinMatch: 'Beitreten',
      queuePosition: 'Position',
      playersSearching: 'Spieler suchen',
      loginToPlay: 'Anmelden',
      allRanks: 'Rang-Fortschritt',
      ranksDesc: 'Sammle Punkte um aufzusteigen',
      top30: 'Globale Rangliste',
      you: 'Du',
      rank: 'Rang',
      position: 'Position',
      gameModes: 'Wähle deinen Spielmodus',
      selectModeFirst: 'Modus wählen',
      matchmaking: 'Matchmaking',
      findingOpponents: 'Gegner werden gesucht...',
      playersNeeded: 'Spieler benötigt',
      winRate: 'Siegquote',
      globalRank: 'Platzierung',
      nextRank: 'Nächster Rang',
      pointsNeeded: 'Pkt. benötigt',
      comingSoon: 'Demnächst'
    },
    it: {
      title: 'Modalità Classificata',
      subtitle: 'Affronta i migliori giocatori e scala la classifica',
      selectMode: 'Seleziona modalità',
      players: 'Giocatori',
      inQueue: 'in coda',
      searchMatch: 'Avvia ricerca',
      searching: 'Ricerca...',
      cancel: 'Annulla',
      matchFound: 'Partita Trovata!',
      joiningMatch: 'Connessione...',
      estimatedWait: 'Attesa stimata',
      seconds: 'sec',
      minutes: 'min',
      yourRank: 'Il tuo rango',
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
      loginToPlay: 'Accedi',
      allRanks: 'Progressione Ranghi',
      ranksDesc: 'Guadagna punti per salire di divisione',
      top30: 'Classifica Globale',
      you: 'Tu',
      rank: 'Rango',
      position: 'Posizione',
      gameModes: 'Scegli la modalità di gioco',
      selectModeFirst: 'Seleziona modalità',
      matchmaking: 'Matchmaking',
      findingOpponents: 'Ricerca avversari...',
      playersNeeded: 'giocatori richiesti',
      winRate: 'Ratio',
      globalRank: 'Classifica',
      nextRank: 'Prossimo rango',
      pointsNeeded: 'pnt necessari',
      comingSoon: 'Prossimamente'
    }
  };

  const t = texts[language] || texts.en;

  // Ranks configuration
  const allRanks = [
    { name: 'Bronze', color: 'from-amber-700 to-amber-900', textColor: 'text-amber-500', hex: '#b45309', icon: Shield, minPoints: 0, maxPoints: 499 },
    { name: 'Silver', color: 'from-slate-400 to-slate-600', textColor: 'text-slate-300', hex: '#94a3b8', icon: Shield, minPoints: 500, maxPoints: 999 },
    { name: 'Gold', color: 'from-yellow-400 to-yellow-600', textColor: 'text-yellow-400', hex: '#facc15', icon: Medal, minPoints: 1000, maxPoints: 1499 },
    { name: 'Platinum', color: 'from-cyan-400 to-teal-500', textColor: 'text-cyan-400', hex: '#22d3ee', icon: Medal, minPoints: 1500, maxPoints: 1999 },
    { name: 'Diamond', color: 'from-blue-400 to-indigo-500', textColor: 'text-blue-400', hex: '#60a5fa', icon: Star, minPoints: 2000, maxPoints: 2499 },
    { name: 'Master', color: 'from-purple-500 to-fuchsia-500', textColor: 'text-purple-400', hex: '#a855f7', icon: Trophy, minPoints: 2500, maxPoints: 2999 },
    { name: 'Grandmaster', color: 'from-red-500 to-orange-500', textColor: 'text-red-400', hex: '#ef4444', icon: Crown, minPoints: 3000, maxPoints: 3499 },
    { name: 'Champion', color: 'from-yellow-400 via-orange-500 to-red-500', textColor: 'text-yellow-300', hex: '#fbbf24', icon: Zap, minPoints: 3500, maxPoints: 99999, special: true }
  ];

  const getRankForPoints = (points) => {
    return [...allRanks].reverse().find(r => points >= r.minPoints) || allRanks[0];
  };

  const getRankIndex = (points) => {
    return allRanks.findIndex(r => points >= r.minPoints && points <= r.maxPoints);
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

    const handleMatchFound = (data) => {
      setMatchFound(data);
      setIsSearching(false);
      setTimeout(() => {
        setShowMatchmakingDialog(false);
        navigate(`/ranked-match/${data.matchId}`);
      }, 2000);
    };

    const handleQueueUpdate = (data) => {
      setQueueStatus(data);
    };

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
      const response = await fetch(`${API_URL}/rankings/me/${selectedMode}`, { credentials: 'include' });
      const data = await response.json();
      if (data.success) setMyRanking(data.ranking);
    } catch (err) {
      console.error('Error fetching ranking:', err);
    } finally {
      setLoadingRanking(false);
    }
  };

  const checkActiveMatch = async () => {
    try {
      const response = await fetch(`${API_URL}/ranked-matches/active/me?mode=${selectedMode}`, { credentials: 'include' });
      const data = await response.json();
      if (data.success && data.hasActiveMatch) setActiveMatch(data.match);
    } catch (err) {
      console.error('Error checking active match:', err);
    }
  };

  const fetchQueuesInfo = async () => {
    try {
      const response = await fetch(`${API_URL}/ranked-matches/matchmaking/queues?mode=${selectedMode}`, { credentials: 'include' });
      const data = await response.json();
      if (data.success) setQueuesInfo(data.queues);
    } catch (err) {
      console.error('Error fetching queues:', err);
    }
  };

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const response = await fetch(`${API_URL}/rankings/leaderboard/${selectedMode}?limit=30`, { credentials: 'include' });
      const data = await response.json();
      if (data.success) setLeaderboard(data.rankings);
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
        body: JSON.stringify({ gameMode: selectedGameMode, mode: selectedMode })
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.message);
        setIsSearching(false);
        if (data.matchId) setActiveMatch({ _id: data.matchId });
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
        body: JSON.stringify({ gameMode: selectedGameMode, mode: selectedMode })
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
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  const playerRank = myRanking ? getRankForPoints(myRanking.points) : null;
  const playerRankIndex = myRanking ? getRankIndex(myRanking.points) : 0;
  const nextRank = playerRankIndex < allRanks.length - 1 ? allRanks[playerRankIndex + 1] : null;
  const RankIcon = playerRank?.icon || Shield;
  const winRate = myRanking && (myRanking.wins + myRanking.losses > 0) 
    ? Math.round((myRanking.wins / (myRanking.wins + myRanking.losses)) * 100) 
    : 0;

  // Matchmaking Dialog
  const MatchmakingDialog = () => {
    if (!showMatchmakingDialog) return null;
    const selectedModeInfo = gameModes.find(m => m.id === selectedGameMode);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={!isSearching ? () => setShowMatchmakingDialog(false) : undefined} />
        
        <div className="relative w-full max-w-lg">
          {/* Glow effect */}
          <div className={`absolute -inset-1 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-3xl blur-xl opacity-50 animate-pulse`} />
          
          <div className="relative bg-dark-900/95 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden">
            <div className={`p-8 bg-gradient-to-br ${gradientFrom} ${gradientTo}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                    {selectedModeInfo && <selectedModeInfo.icon className="w-8 h-8 text-white" />}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">{t.matchmaking}</h3>
                    <p className="text-white/80">{getModeName(selectedGameMode)}</p>
                  </div>
                </div>
                {!isSearching && (
                  <button onClick={() => setShowMatchmakingDialog(false)} className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
                    <X className="w-6 h-6 text-white" />
                  </button>
                )}
              </div>
            </div>

            <div className="p-10">
              {matchFound ? (
                <div className="text-center">
                  <div className={`w-28 h-28 mx-auto mb-8 rounded-full bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center shadow-2xl`}>
                    <Check className="w-14 h-14 text-white" />
                  </div>
                  <h3 className="text-4xl font-black text-white mb-4">{t.matchFound}</h3>
                  <p className="text-gray-400 text-xl">{t.joiningMatch}</p>
                </div>
              ) : (
                <div className="text-center">
                  {/* Animated spinner */}
                  <div className="relative w-40 h-40 mx-auto mb-10">
                    <div className="absolute inset-0 rounded-full" style={{ 
                      background: `conic-gradient(from 0deg, transparent 0%, ${isHardcore ? '#ef4444' : '#06b6d4'} 50%, transparent 100%)`,
                      animation: 'spin 1.5s linear infinite'
                    }} />
                    <div className="absolute inset-3 rounded-full bg-dark-900 flex items-center justify-center">
                      <Swords className={`w-16 h-16 text-${accentColor}-400`} />
                    </div>
                    <div className="absolute inset-0 rounded-full border-4 border-white/5" />
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-4">{t.findingOpponents}</h3>
                  
                  <p className={`text-5xl font-black bg-gradient-to-r ${gradientFrom} ${gradientTo} bg-clip-text text-transparent mb-8 font-mono tracking-wider`}>
                    {formatTime(searchTime)}
                  </p>

                  {queueStatus && (
                    <div className="mb-8 p-5 bg-white/5 rounded-2xl border border-white/10">
                      <div className="flex items-center justify-center gap-3 text-gray-300 mb-2">
                        <Users className="w-5 h-5" />
                        <span className="font-semibold">{queueStatus.queueSize} {t.playersSearching}</span>
                      </div>
                      <p className="text-gray-500 text-sm">{selectedModeInfo?.minPlayers}-{selectedModeInfo?.maxPlayers} {t.playersNeeded}</p>
                    </div>
                  )}

                  <button
                    onClick={handleCancelSearch}
                    className="w-full py-5 bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/50 rounded-2xl text-white font-bold transition-all flex items-center justify-center gap-3"
                  >
                    <X className="w-5 h-5" />
                    {t.cancel}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:64px_64px]" />
        <div className={`absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full blur-[150px] ${isHardcore ? 'bg-red-500/10' : 'bg-cyan-500/10'}`} />
        <div className={`absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full blur-[150px] ${isHardcore ? 'bg-orange-500/8' : 'bg-blue-500/8'}`} />
      </div>

      <div className="relative z-10">
        {/* Hero Section */}
        <div className="relative pt-12 pb-8 px-4">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
                <Flame className={`w-4 h-4 text-${accentColor}-400`} />
                <span className="text-sm font-medium text-gray-400">Mode Compétitif</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-black text-white mb-4 tracking-tight">
                {t.title.split(' ')[0]}{' '}
                <span className={`bg-gradient-to-r ${gradientFrom} ${gradientTo} bg-clip-text text-transparent`}>
                  {t.title.split(' ').slice(1).join(' ')}
                </span>
              </h1>
              <p className="text-gray-500 text-lg md:text-xl max-w-2xl mx-auto">{t.subtitle}</p>
            </div>

            {/* Active Match Banner */}
            {activeMatch && (
              <div className={`mb-8 mx-auto max-w-2xl p-1 rounded-2xl bg-gradient-to-r ${gradientFrom} ${gradientTo}`}>
                <div className="bg-dark-900/95 rounded-xl p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center`}>
                      <Swords className="w-6 h-6 text-white animate-pulse" />
                    </div>
                    <div>
                      <p className="text-white font-bold">{t.activeMatch}</p>
                      <p className="text-gray-500 text-sm">{activeMatch.gameMode}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/ranked-match/${activeMatch._id}`)}
                    className={`px-6 py-3 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-xl text-white font-bold hover:scale-105 transition-transform`}
                  >
                    {t.rejoinMatch}
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-8 mx-auto max-w-2xl p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3 text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1">{error}</span>
                <button onClick={() => setError('')} className="p-1 hover:bg-red-500/20 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-3 gap-6 mb-12">
              {/* Player Rank Card */}
              <div className="lg:col-span-1">
                <div className="h-full bg-white/[0.02] backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden">
                  {isAuthenticated ? (
                    loadingRanking ? (
                      <div className="flex items-center justify-center h-80">
                        <Loader2 className={`w-10 h-10 text-${accentColor}-500 animate-spin`} />
                      </div>
                    ) : myRanking ? (
                      <div className="p-6">
                        {/* Rank Badge */}
                        <div className="relative mb-6">
                          <div className={`absolute inset-0 bg-gradient-to-br ${playerRank.color} blur-3xl opacity-30`} />
                          <div className="relative flex items-center gap-5">
                            <div className={`relative w-24 h-24 rounded-2xl bg-gradient-to-br ${playerRank.color} flex items-center justify-center shadow-2xl`}>
                              <RankIcon className="w-12 h-12 text-white" />
                              {playerRank.special && (
                                <div className="absolute inset-0 rounded-2xl border-2 border-yellow-400/50 animate-pulse" />
                              )}
                            </div>
                            <div>
                              <p className="text-gray-500 text-sm uppercase tracking-wider">{t.yourRank}</p>
                              <h2 className={`text-3xl font-black ${playerRank.textColor}`}>{playerRank.name}</h2>
                              {myRanking.rank && (
                                <p className="text-gray-500">#{myRanking.rank} {t.globalRank}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Points */}
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 mb-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-gray-500 text-sm">{t.points}</span>
                            <span className={`text-2xl font-black ${playerRank.textColor}`}>{myRanking.points}</span>
                          </div>
                          {nextRank && (
                            <>
                              <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-2">
                                <div 
                                  className={`h-full bg-gradient-to-r ${playerRank.color} transition-all duration-1000`}
                                  style={{ width: `${((myRanking.points - playerRank.minPoints) / (playerRank.maxPoints - playerRank.minPoints + 1)) * 100}%` }}
                                />
                              </div>
                              <p className="text-xs text-gray-600">
                                {nextRank.minPoints - myRanking.points} {t.pointsNeeded} → <span className={nextRank.textColor}>{nextRank.name}</span>
                              </p>
                            </>
                          )}
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20 text-center">
                            <p className="text-2xl font-black text-green-400">{myRanking.wins}</p>
                            <p className="text-xs text-gray-500">{t.wins}</p>
                          </div>
                          <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20 text-center">
                            <p className="text-2xl font-black text-red-400">{myRanking.losses}</p>
                            <p className="text-xs text-gray-500">{t.losses}</p>
                          </div>
                          <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
                            <p className="text-2xl font-black text-white">{winRate}%</p>
                            <p className="text-xs text-gray-500">{t.winRate}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                          <Shield className="w-10 h-10 text-gray-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-400 mb-2">{t.notRanked}</h3>
                        <p className="text-gray-600 text-sm">{t.playFirstMatch}</p>
                      </div>
                    )
                  ) : (
                    <div className="p-8 text-center">
                      <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <User className="w-10 h-10 text-gray-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-400 mb-2">{t.loginRequired}</h3>
                      <button
                        onClick={() => navigate('/login')}
                        className={`mt-4 px-6 py-3 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-xl text-white font-bold hover:scale-105 transition-transform`}
                      >
                        {t.loginToPlay}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Game Modes */}
              <div className="lg:col-span-2">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                  <Gamepad2 className={`w-5 h-5 text-${accentColor}-400`} />
                  {t.gameModes}
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {gameModes.map((mode) => {
                    const Icon = mode.icon;
                    const isSelected = selectedGameMode === mode.id;
                    const queueInfo = queuesInfo[mode.id];
                    const isDisabled = !mode.enabled || isSearching;
                    
                    return (
                      <button
                        key={mode.id}
                        onClick={() => mode.enabled && !isSearching && setSelectedGameMode(mode.id)}
                        disabled={isDisabled}
                        className={`group relative p-5 rounded-2xl border transition-all duration-300 text-left overflow-hidden ${
                          mode.comingSoon
                            ? 'bg-white/[0.01] border-white/5 cursor-not-allowed'
                            : isSelected 
                              ? 'bg-white/[0.08] border-white/30 scale-[1.02]' 
                              : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10'
                        } ${isSearching && mode.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {/* Coming Soon Overlay */}
                        {mode.comingSoon && (
                          <div className="absolute inset-0 bg-dark-900/60 backdrop-blur-[2px] z-20 flex items-center justify-center">
                            <div className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm">
                              <span className="text-sm font-bold text-white/80">{t.comingSoon}</span>
                            </div>
                          </div>
                        )}
                        
                        {/* Glow on selected */}
                        {isSelected && !mode.comingSoon && (
                          <div className={`absolute inset-0 bg-gradient-to-br ${mode.color} opacity-10`} />
                        )}
                        
                        <div className={`relative z-10 ${mode.comingSoon ? 'opacity-40' : ''}`}>
                          <div className="flex items-start gap-4 mb-3">
                            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${mode.color} flex items-center justify-center shadow-lg transition-transform ${!mode.comingSoon ? 'group-hover:scale-110' : ''}`}>
                              <Icon className="w-7 h-7 text-white" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-white mb-1">{getModeName(mode.id)}</h3>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-white/10 text-gray-300">
                                  {mode.players}
                                </span>
                                {mode.enabled && queueInfo?.playersInQueue > 0 && (
                                  <span className="flex items-center gap-1 text-xs text-gray-500">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    {queueInfo.playersInQueue} {t.inQueue}
                                  </span>
                                )}
                              </div>
                            </div>
                            {isSelected && !mode.comingSoon && (
                              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${mode.color} flex items-center justify-center`}>
                                <Check className="w-5 h-5 text-white" />
                              </div>
                            )}
                          </div>
                          <p className="text-gray-500 text-sm leading-relaxed">{mode.description[language]}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Search Button */}
                <div className="mt-6">
                  {isAuthenticated ? (
                    <button
                      onClick={handleSearchMatch}
                      disabled={!selectedGameMode || activeMatch}
                      className={`w-full py-5 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${
                        selectedGameMode && !activeMatch
                          ? `bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white hover:scale-[1.02] shadow-xl ${glowColor}`
                          : 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/5'
                      }`}
                    >
                      <Play className="w-6 h-6" />
                      {selectedGameMode ? t.searchMatch : t.selectModeFirst}
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate('/login')}
                      className={`w-full py-5 rounded-2xl font-bold text-lg bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white hover:scale-[1.02] transition-transform shadow-xl`}
                    >
                      {t.loginToPlay}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Ranks Progression - New Design */}
            <div className="mb-12">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                  <Award className={`w-5 h-5 text-${accentColor}-400`} />
                  {t.allRanks}
                </h2>
                <p className="text-gray-500 text-sm hidden sm:block">{t.ranksDesc}</p>
              </div>
              
              <div className="relative bg-white/[0.02] backdrop-blur rounded-3xl border border-white/5 p-6 md:p-8 overflow-hidden">
                {/* Background glow for current rank */}
                {myRanking && (
                  <div 
                    className={`absolute top-0 h-full w-32 blur-3xl opacity-20 pointer-events-none`}
                    style={{ 
                      left: `${(playerRankIndex / (allRanks.length - 1)) * 100}%`,
                      transform: 'translateX(-50%)',
                      background: playerRank?.hex || '#fff'
                    }}
                  />
                )}
                
                {/* Progress Track */}
                <div className="relative mb-8">
                  {/* Background track */}
                  <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                    {/* Filled progress */}
                    <div 
                      className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                      style={{ 
                        width: myRanking 
                          ? `${Math.min(100, ((myRanking.points) / 3500) * 100)}%`
                          : '0%',
                        background: `linear-gradient(90deg, #b45309 0%, #94a3b8 14%, #facc15 28%, #22d3ee 42%, #60a5fa 57%, #a855f7 71%, #ef4444 85%, #fbbf24 100%)`
                      }}
                    >
                      {/* Shine effect */}
                      <div 
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        style={{ 
                          width: '200%',
                          animation: 'shimmer 3s linear infinite',
                          backgroundSize: '50% 100%'
                        }} 
                      />
                      <style>{`
                        @keyframes shimmer {
                          0% { transform: translateX(-100%); }
                          100% { transform: translateX(100%); }
                        }
                      `}</style>
                    </div>
                  </div>
                  
                  {/* Rank markers on track */}
                  <div className="absolute top-0 left-0 right-0 h-3 flex items-center">
                    {allRanks.map((rank, index) => {
                      const position = index === 0 ? 0 : (rank.minPoints / 3500) * 100;
                      const isCurrentRank = myRanking && myRanking.points >= rank.minPoints && myRanking.points <= rank.maxPoints;
                      
                      return (
                        <div
                          key={rank.name}
                          className="absolute top-1/2 -translate-y-1/2"
                          style={{ left: `${Math.min(position, 100)}%` }}
                        >
                          <div className={`w-3 h-3 rounded-full border-2 transition-all ${
                            isCurrentRank 
                              ? 'border-white bg-white scale-150 shadow-lg' 
                              : myRanking && myRanking.points >= rank.minPoints
                                ? 'border-white/50 bg-white/50'
                                : 'border-white/20 bg-transparent'
                          }`} />
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Rank Cards */}
                <div className="grid grid-cols-4 md:grid-cols-8 gap-2 md:gap-3">
                  {allRanks.map((rank, index) => {
                    const RIcon = rank.icon;
                    const isCurrentRank = myRanking && myRanking.points >= rank.minPoints && myRanking.points <= rank.maxPoints;
                    const isPastRank = myRanking && myRanking.points > rank.maxPoints;
                    const isFutureRank = !isPastRank && !isCurrentRank;
                    
                    return (
                      <div
                        key={rank.name}
                        className={`group relative ${isCurrentRank ? 'z-10' : ''}`}
                      >
                        {/* Current rank indicator */}
                        {isCurrentRank && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                            <div className="relative">
                              <div className="px-2 py-1 rounded-lg bg-gradient-to-r from-yellow-400 to-orange-500 text-[10px] font-black text-dark-900 whitespace-nowrap shadow-lg">
                                {t.you}
                              </div>
                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-orange-500 rotate-45" />
                            </div>
                          </div>
                        )}
                        
                        <div className={`relative p-2 md:p-3 rounded-xl transition-all duration-300 cursor-default ${
                          isCurrentRank
                            ? 'bg-white/10 ring-2 ring-white/30 scale-105'
                            : isPastRank
                              ? 'bg-white/5'
                              : 'opacity-40 grayscale hover:opacity-60 hover:grayscale-0'
                        }`}>
                          {/* Icon */}
                          <div className={`relative w-10 h-10 md:w-12 md:h-12 mx-auto mb-2 rounded-xl bg-gradient-to-br ${rank.color} flex items-center justify-center shadow-lg ${
                            isCurrentRank ? 'shadow-xl' : ''
                          } ${rank.special ? 'animate-pulse' : ''}`}>
                            <RIcon className="w-5 h-5 md:w-6 md:h-6 text-white drop-shadow" />
                            
                            {/* Checkmark for past ranks */}
                            {isPastRank && (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center border-2 border-dark-900">
                                <Check className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                          </div>
                          
                          {/* Name */}
                          <p className={`text-[10px] md:text-xs font-bold text-center ${rank.textColor} truncate`}>
                            {rank.name}
                          </p>
                          
                          {/* Points - hidden on mobile */}
                          <p className="hidden md:block text-[9px] text-gray-600 text-center font-mono mt-0.5">
                            {rank.maxPoints === 99999 ? `${rank.minPoints}+` : rank.minPoints}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Legend */}
                {myRanking && nextRank && (
                  <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-center gap-6 text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span>Rangs débloqués</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full ring-2 ring-white bg-white" />
                      <span>Rang actuel</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-white/20" />
                      <span>À débloquer</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Leaderboard */}
            <div className="bg-white/[0.02] backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden">
              <div className={`p-6 border-b border-white/10 bg-gradient-to-r ${gradientFrom} ${gradientTo}`}>
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
                <div className="divide-y divide-white/5">
                  {leaderboard.map((player, index) => {
                    const playerRankInfo = getRankForPoints(player.points);
                    const RIcon = playerRankInfo.icon;
                    const isCurrentUser = user && player.user?._id === user._id;
                    
                    return (
                      <Link
                        key={player._id}
                        to={`/profile/${player.user?.username}`}
                        className={`flex items-center gap-3 md:gap-5 p-4 md:p-5 transition-all hover:bg-white/5 ${
                          isCurrentUser ? `bg-${accentColor}-500/10` : ''
                        }`}
                      >
                        {/* Position */}
                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center font-black text-sm md:text-base flex-shrink-0 ${
                          index === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-600 text-yellow-900' :
                          index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-slate-800' :
                          index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-orange-900' :
                          'bg-white/5 text-gray-500'
                        }`}>
                          {index < 3 ? <Crown className="w-5 h-5 md:w-6 md:h-6" /> : index + 1}
                        </div>

                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          <img
                            src={getAvatarUrl(player.user?.avatar || player.user?.avatarUrl) || getDefaultAvatar(player.user?.username)}
                            alt=""
                            className={`w-10 h-10 md:w-12 md:h-12 rounded-xl object-cover border-2 ${
                              index < 3 ? 'border-yellow-500/50' : 'border-white/10'
                            }`}
                          />
                          {isCurrentUser && (
                            <div className={`absolute -top-1 -right-1 w-4 h-4 bg-${accentColor}-500 rounded-full border-2 border-dark-900`} />
                          )}
                        </div>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <p className={`font-bold truncate ${isCurrentUser ? `text-${accentColor}-400` : 'text-white'}`}>
                            {player.user?.username || 'Unknown'}
                          </p>
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded bg-gradient-to-br ${playerRankInfo.color} flex items-center justify-center`}>
                              <RIcon className="w-2.5 h-2.5 text-white" />
                            </div>
                            <span className={`text-xs ${playerRankInfo.textColor}`}>{playerRankInfo.name}</span>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="hidden md:flex items-center gap-3">
                          <span className="text-green-400 text-sm font-medium">{player.wins}W</span>
                          <span className="text-red-400 text-sm font-medium">{player.losses}L</span>
                        </div>

                        {/* Points */}
                        <div className="text-right">
                          <p className={`text-lg md:text-xl font-black ${playerRankInfo.textColor}`}>{player.points}</p>
                          <p className="text-[10px] md:text-xs text-gray-600 uppercase">{t.pts}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <MatchmakingDialog />
    </div>
  );
};

export default RankedMode;
