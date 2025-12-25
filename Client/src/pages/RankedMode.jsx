import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { io } from 'socket.io-client';
import { 
  Trophy, Swords, Target, Flag, Skull, Users, Loader2, 
  X, Play, Clock, Zap, Shield, Crown, Medal, Star,
  ChevronRight, ChevronLeft, AlertCircle, Check, User
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';
const SOCKET_URL = 'https://api-nomercy.ggsecure.io';

const RankedMode = () => {
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef(null);

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
  const [activeRankIndex, setActiveRankIndex] = useState(0);
  const sliderRef = useRef(null);

  // Game modes configuration
  const gameModes = [
    {
      id: 'Duel',
      icon: Swords,
      players: '1v1',
      color: 'from-yellow-500 to-orange-600',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30',
      description: {
        fr: 'Affrontement en tête-à-tête. Prouve ta valeur en solo.',
        en: 'Head-to-head battle. Prove your worth solo.',
        de: 'Kopf-an-Kopf-Kampf. Beweise deinen Wert solo.',
        it: 'Battaglia testa a testa. Dimostra il tuo valore da solo.'
      }
    },
    {
      id: 'Team Deathmatch',
      icon: Skull,
      players: '4v4',
      color: 'from-red-500 to-pink-600',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      description: {
        fr: 'Mêlée générale en équipe. Élimine l\'équipe adverse.',
        en: 'Team deathmatch. Eliminate the enemy team.',
        de: 'Team-Deathmatch. Eliminiere das gegnerische Team.',
        it: 'Deathmatch a squadre. Elimina la squadra avversaria.'
      }
    },
    {
      id: 'Domination',
      icon: Flag,
      players: '4v4',
      color: 'from-blue-500 to-purple-600',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      description: {
        fr: 'Capture et défends les objectifs stratégiques.',
        en: 'Capture and defend strategic objectives.',
        de: 'Erobere und verteidige strategische Ziele.',
        it: 'Cattura e difendi gli obiettivi strategici.'
      }
    },
    {
      id: 'Search & Destroy',
      icon: Target,
      players: '4v4',
      color: 'from-green-500 to-teal-600',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      description: {
        fr: 'Plante la bombe ou défends les sites. Sans respawn.',
        en: 'Plant the bomb or defend the sites. No respawn.',
        de: 'Bombe legen oder Standorte verteidigen. Kein Respawn.',
        it: 'Pianta la bomba o difendi i siti. Senza respawn.'
      }
    }
  ];

  // Get localized mode name
  const getModeName = (modeId) => {
    const names = {
      'Duel': { fr: 'Duel', en: 'Duel', de: 'Duell', it: 'Duello' },
      'Team Deathmatch': { fr: 'Mêlée Générale', en: 'Team Deathmatch', de: 'Team-Deathmatch', it: 'Deathmatch a Squadre' },
      'Domination': { fr: 'Domination', en: 'Domination', de: 'Herrschaft', it: 'Dominazione' },
      'Search & Destroy': { fr: 'Recherche & Destruction', en: 'Search & Destroy', de: 'Suchen & Zerstören', it: 'Cerca e Distruggi' }
    };
    return names[modeId]?.[language] || modeId;
  };

  // Texts
  const texts = {
    fr: {
      title: 'Mode Classé',
      subtitle: 'Choisis ton mode de jeu et affronte des adversaires de ton niveau',
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
      yourRank: 'Ton rang',
      points: 'points',
      wins: 'Victoires',
      losses: 'Défaites',
      notRanked: 'Non classé',
      loginRequired: 'Connecte-toi pour jouer en classé',
      activeMatch: 'Tu as un match en cours',
      rejoinMatch: 'Rejoindre le match',
      queuePosition: 'Position dans la file',
      playersSearching: 'joueurs recherchent',
      loginToPlay: 'Connexion requise',
      allRanks: 'Tous les rangs',
      top30: 'Classement Top 30',
      tiers: 'Paliers',
      you: 'Toi'
    },
    en: {
      title: 'Ranked Mode',
      subtitle: 'Choose your game mode and face opponents at your skill level',
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
      yourRank: 'Your rank',
      points: 'points',
      wins: 'Wins',
      losses: 'Losses',
      notRanked: 'Unranked',
      loginRequired: 'Log in to play ranked',
      activeMatch: 'You have an active match',
      rejoinMatch: 'Rejoin match',
      queuePosition: 'Queue position',
      playersSearching: 'players searching',
      loginToPlay: 'Login required',
      allRanks: 'All ranks',
      top30: 'Top 30 Leaderboard',
      tiers: 'Tiers',
      you: 'You'
    },
    de: {
      title: 'Ranglisten-Modus',
      subtitle: 'Wähle deinen Spielmodus und tritt gegen Gegner auf deinem Niveau an',
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
      yourRank: 'Dein Rang',
      points: 'Punkte',
      wins: 'Siege',
      losses: 'Niederlagen',
      notRanked: 'Nicht platziert',
      loginRequired: 'Melde dich an, um Ranked zu spielen',
      activeMatch: 'Du hast ein aktives Match',
      rejoinMatch: 'Match beitreten',
      queuePosition: 'Warteschlangen-Position',
      playersSearching: 'Spieler suchen',
      loginToPlay: 'Anmeldung erforderlich',
      allRanks: 'Alle Ränge',
      top30: 'Top 30 Rangliste',
      tiers: 'Stufen',
      you: 'Du'
    },
    it: {
      title: 'Modalità Classificata',
      subtitle: 'Scegli la tua modalità di gioco e affronta avversari al tuo livello',
      selectMode: 'Seleziona modalità',
      players: 'Giocatori',
      inQueue: 'in coda',
      searchMatch: 'Cerca Partita',
      searching: 'Ricerca in corso...',
      cancel: 'Annulla',
      matchFound: 'Partita Trovata!',
      joiningMatch: 'Connessione alla partita...',
      estimatedWait: 'Attesa stimata',
      seconds: 'sec',
      minutes: 'min',
      yourRank: 'Il tuo rango',
      points: 'punti',
      wins: 'Vittorie',
      losses: 'Sconfitte',
      notRanked: 'Non classificato',
      loginRequired: 'Accedi per giocare in classificata',
      activeMatch: 'Hai una partita attiva',
      rejoinMatch: 'Rientra nella partita',
      queuePosition: 'Posizione in coda',
      playersSearching: 'giocatori cercano',
      loginToPlay: 'Accesso richiesto',
      allRanks: 'Tutti i ranghi',
      top30: 'Classifica Top 30',
      tiers: 'Livelli',
      you: 'Tu'
    }
  };

  const t = texts[language] || texts.en;

  // Ranks configuration - Full details
  const allRanks = [
    {
      name: 'Bronze',
      color: 'from-amber-700 to-amber-900',
      textColor: 'text-amber-600',
      bgColor: 'bg-amber-900/30',
      borderColor: 'border-amber-700/50',
      glowColor: 'shadow-amber-700/30',
      icon: Shield,
      tiers: ['IV', 'III', 'II', 'I'],
      pointsRange: '0 - 499',
      minPoints: 0,
      maxPoints: 499,
      description: { fr: 'Début du parcours', en: 'Start of journey', de: 'Beginn der Reise', it: 'Inizio del percorso' }
    },
    {
      name: 'Silver',
      color: 'from-gray-400 to-gray-600',
      textColor: 'text-gray-300',
      bgColor: 'bg-gray-500/30',
      borderColor: 'border-gray-500/50',
      glowColor: 'shadow-gray-500/30',
      icon: Shield,
      tiers: ['IV', 'III', 'II', 'I'],
      pointsRange: '500 - 999',
      minPoints: 500,
      maxPoints: 999,
      description: { fr: 'Joueur en progression', en: 'Progressing player', de: 'Aufsteigend', it: 'In progressione' }
    },
    {
      name: 'Gold',
      color: 'from-yellow-500 to-yellow-700',
      textColor: 'text-yellow-400',
      bgColor: 'bg-yellow-500/30',
      borderColor: 'border-yellow-500/50',
      glowColor: 'shadow-yellow-500/40',
      icon: Medal,
      tiers: ['IV', 'III', 'II', 'I'],
      pointsRange: '1000 - 1499',
      minPoints: 1000,
      maxPoints: 1499,
      description: { fr: 'Joueur confirmé', en: 'Confirmed player', de: 'Bestätigt', it: 'Confermato' }
    },
    {
      name: 'Platinum',
      color: 'from-teal-400 to-teal-600',
      textColor: 'text-teal-400',
      bgColor: 'bg-teal-500/30',
      borderColor: 'border-teal-500/50',
      glowColor: 'shadow-teal-500/40',
      icon: Medal,
      tiers: ['IV', 'III', 'II', 'I'],
      pointsRange: '1500 - 1999',
      minPoints: 1500,
      maxPoints: 1999,
      description: { fr: 'Joueur expérimenté', en: 'Experienced', de: 'Erfahren', it: 'Esperto' }
    },
    {
      name: 'Diamond',
      color: 'from-blue-400 to-purple-500',
      textColor: 'text-blue-400',
      bgColor: 'bg-blue-500/30',
      borderColor: 'border-blue-500/50',
      glowColor: 'shadow-blue-500/40',
      icon: Star,
      tiers: ['IV', 'III', 'II', 'I'],
      pointsRange: '2000 - 2499',
      minPoints: 2000,
      maxPoints: 2499,
      description: { fr: 'Joueur d\'élite', en: 'Elite player', de: 'Elite', it: 'Élite' }
    },
    {
      name: 'Master',
      color: 'from-purple-500 to-pink-500',
      textColor: 'text-purple-400',
      bgColor: 'bg-purple-500/30',
      borderColor: 'border-purple-500/50',
      glowColor: 'shadow-purple-500/40',
      icon: Trophy,
      tiers: ['III', 'II', 'I'],
      pointsRange: '2500 - 2999',
      minPoints: 2500,
      maxPoints: 2999,
      description: { fr: 'Maître du jeu', en: 'Game master', de: 'Meister', it: 'Maestro' }
    },
    {
      name: 'Grandmaster',
      color: 'from-red-500 to-orange-500',
      textColor: 'text-red-400',
      bgColor: 'bg-red-500/30',
      borderColor: 'border-red-500/50',
      glowColor: 'shadow-red-500/40',
      icon: Crown,
      tiers: ['II', 'I'],
      pointsRange: '3000 - 3499',
      minPoints: 3000,
      maxPoints: 3499,
      description: { fr: 'Légende vivante', en: 'Living legend', de: 'Legende', it: 'Leggenda' }
    },
    {
      name: 'Champion',
      color: 'from-yellow-400 via-orange-500 to-red-500',
      textColor: 'text-yellow-400',
      bgColor: 'bg-gradient-to-br from-yellow-500/30 to-red-500/30',
      borderColor: 'border-yellow-500/60',
      glowColor: 'shadow-yellow-500/50',
      icon: Zap,
      tiers: ['Top 100'],
      pointsRange: '3500+',
      minPoints: 3500,
      maxPoints: 99999,
      description: { fr: 'L\'élite absolue', en: 'Absolute elite', de: 'Absolute Elite', it: 'Élite assoluta' },
      special: true
    }
  ];

  // Simple ranks for other uses
  const ranks = allRanks.map(r => ({
    name: r.name,
    color: r.textColor,
    icon: r.icon,
    minPoints: r.minPoints
  }));

  const getRankForPoints = (points) => {
    return [...allRanks].reverse().find(r => points >= r.minPoints) || allRanks[0];
  };

  // Slider navigation
  const scrollSlider = (direction) => {
    const newIndex = direction === 'left' 
      ? Math.max(0, activeRankIndex - 1)
      : Math.min(allRanks.length - 1, activeRankIndex + 1);
    setActiveRankIndex(newIndex);
    if (sliderRef.current) {
      sliderRef.current.scrollTo({ left: newIndex * 280, behavior: 'smooth' });
    }
  };

  const scrollToRankIndex = (index) => {
    setActiveRankIndex(index);
    if (sliderRef.current) {
      sliderRef.current.scrollTo({ left: index * 280, behavior: 'smooth' });
    }
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

  // Scroll to player's rank when ranking is loaded
  useEffect(() => {
    if (myRanking) {
      const playerRankIdx = allRanks.findIndex(r => 
        myRanking.points >= r.minPoints && myRanking.points <= r.maxPoints
      );
      if (playerRankIdx >= 0) {
        setActiveRankIndex(playerRankIdx);
        setTimeout(() => scrollToRankIndex(playerRankIdx), 100);
      }
    }
  }, [myRanking]);

  // Socket connection
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    socketRef.current = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      console.log('Socket connected');
      // Join user room for matchmaking notifications
      socketRef.current.emit('joinUserRoom', user._id || user.id);
    });

    socketRef.current.on('rankedMatchFound', (data) => {
      console.log('Match found:', data);
      setMatchFound(data);
      setIsSearching(false);
      
      // Navigate to match after short delay
      setTimeout(() => {
        navigate(`/ranked-match/${data.matchId}`);
      }, 2000);
    });

    socketRef.current.on('queueUpdate', (data) => {
      setQueueStatus(data);
    });

    return () => {
      if (socketRef.current) {
        if (user) {
          socketRef.current.emit('leaveUserRoom', user._id || user.id);
        }
        socketRef.current.disconnect();
      }
    };
  }, [isAuthenticated, user, navigate]);

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
      const response = await fetch(`${API_URL}/ranked-matches/matchmaking/queues?mode=${selectedMode}`);
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
        
        // If there's an active match, redirect to it
        if (data.matchId) {
          setActiveMatch({ _id: data.matchId });
        }
        return;
      }

      if (data.matchFound) {
        setMatchFound(data);
        setIsSearching(false);
        setTimeout(() => {
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

  return (
    <div className="min-h-screen bg-dark-950 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-dark-900 via-dark-950 to-dark-900" />
      {isHardcore ? (
          <>
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 20%, rgba(239, 68, 68, 0.1) 0%, transparent 50%)' }} />
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 70% 80%, rgba(249, 115, 22, 0.05) 0%, transparent 50%)' }} />
          </>
      ) : (
          <>
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 20%, rgba(6, 182, 212, 0.1) 0%, transparent 50%)' }} />
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 70% 80%, rgba(59, 130, 246, 0.05) 0%, transparent 50%)' }} />
          </>
      )}
        <div className="absolute inset-0 grid-pattern opacity-20" />
      </div>
          
      <div className="relative z-10 py-8 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br ${gradientFrom} ${gradientTo} shadow-xl ${glowColor} mb-6`}>
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <h1 className={`text-4xl font-black bg-gradient-to-r ${gradientFrom} ${gradientTo} bg-clip-text text-transparent mb-3`}>
              {t.title}
            </h1>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">{t.subtitle}</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400 max-w-2xl mx-auto">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
              <button onClick={() => setError('')} className="ml-auto p-1 hover:bg-red-500/20 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Active match banner */}
          {activeMatch && (
            <div className={`mb-6 p-4 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-xl flex items-center justify-between max-w-2xl mx-auto`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <Swords className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-bold">{t.activeMatch}</p>
                  <p className="text-white/70 text-sm">{activeMatch.gameMode}</p>
                </div>
              </div>
              <button
                onClick={() => navigate(`/ranked-match/${activeMatch._id}`)}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white font-semibold transition-colors flex items-center gap-2"
              >
                {t.rejoinMatch}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Player rank card */}
          {isAuthenticated && (
            <div className={`mb-8 p-5 bg-dark-900/80 backdrop-blur-sm rounded-2xl border ${borderColor} max-w-2xl mx-auto`}>
              {loadingRanking ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className={`w-6 h-6 text-${accentColor}-500 animate-spin`} />
                </div>
              ) : myRanking ? (
                  <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center shadow-lg ${glowColor}`}>
                    <RankIcon className="w-8 h-8 text-white" />
                    </div>
                  <div className="flex-1">
                    <p className="text-gray-500 text-sm">{t.yourRank}</p>
                    <p className={`text-2xl font-bold ${playerRank?.color || 'text-white'}`}>{playerRank?.name || 'Bronze'}</p>
                    <p className="text-gray-400 text-sm">{myRanking.points} {t.points}</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-center px-4 py-2 bg-dark-800/50 rounded-xl">
                      <p className="text-xl font-bold text-green-400">{myRanking.wins}</p>
                      <p className="text-xs text-gray-500">{t.wins}</p>
                    </div>
                    <div className="text-center px-4 py-2 bg-dark-800/50 rounded-xl">
                      <p className="text-xl font-bold text-red-400">{myRanking.losses}</p>
                      <p className="text-xs text-gray-500">{t.losses}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-gray-700/50 flex items-center justify-center">
                    <Shield className="w-8 h-8 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">{t.yourRank}</p>
                    <p className="text-xl font-bold text-gray-400">{t.notRanked}</p>
                    <p className="text-gray-500 text-sm">{language === 'fr' ? 'Joue ta première partie !' : 'Play your first match!'}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Game modes grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 max-w-3xl mx-auto">
            {gameModes.map((mode) => {
              const Icon = mode.icon;
              const isSelected = selectedGameMode === mode.id;
              const queueInfo = queuesInfo[mode.id];
              
                return (
                <button
                  key={mode.id}
                  onClick={() => !isSearching && setSelectedGameMode(mode.id)}
                  disabled={isSearching}
                  className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left group ${
                    isSelected 
                      ? `border-white/50 ${mode.bgColor} shadow-xl scale-[1.02]` 
                      : `${mode.borderColor} bg-dark-900/60 hover:bg-dark-900/80 hover:border-white/30`
                  } ${isSearching ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white flex items-center justify-center">
                      <Check className="w-4 h-4 text-dark-900" />
                        </div>
                      )}
                      
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${mode.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                      <Icon className="w-7 h-7 text-white" />
                        </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-white">{getModeName(mode.id)}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${mode.bgColor} ${mode.borderColor} border`}>
                          {mode.players}
                        </span>
                              </div>
                      <p className="text-gray-400 text-sm mb-3">{mode.description[language]}</p>
                      
                      {/* Queue info */}
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 text-gray-500">
                          <Users className="w-3.5 h-3.5" />
                          <span>{queueInfo?.playersInQueue || 0} {t.inQueue}</span>
                            </div>
                        {queueInfo?.estimatedWait > 0 && (
                          <div className="flex items-center gap-1 text-gray-500">
                            <Clock className="w-3.5 h-3.5" />
                            <span>~{Math.ceil(queueInfo.estimatedWait / 60)} {t.minutes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
                );
              })}
            </div>

          {/* Search button / Searching state */}
          <div className="max-w-md mx-auto">
            {!isAuthenticated ? (
              <div className="p-6 bg-dark-900/80 rounded-2xl border border-white/10 text-center">
                <User className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-4">{t.loginRequired}</p>
                  <button
                  onClick={() => navigate('/login')}
                  className={`px-6 py-3 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-xl text-white font-bold`}
                >
                  {t.loginToPlay}
                </button>
            </div>
            ) : matchFound ? (
              <div className={`p-8 bg-gradient-to-br ${gradientFrom} ${gradientTo} rounded-2xl text-center shadow-2xl ${glowColor} animate-pulse`}>
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center">
                  <Check className="w-10 h-10 text-white" />
          </div>
                <h3 className="text-2xl font-black text-white mb-2">{t.matchFound}</h3>
                <p className="text-white/80">{t.joiningMatch}</p>
              </div>
            ) : isSearching ? (
              <div className={`p-8 bg-dark-900/80 backdrop-blur-sm rounded-2xl border ${borderColor} text-center`}>
                {/* Animated searching indicator */}
                <div className="relative w-24 h-24 mx-auto mb-6">
                  <div className={`absolute inset-0 rounded-full border-4 ${borderColor} opacity-30`} />
                  <div className={`absolute inset-0 rounded-full border-4 border-t-${accentColor}-500 animate-spin`} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Swords className={`w-10 h-10 text-${accentColor}-500`} />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-white mb-2">{t.searching}</h3>
                <p className={`text-${accentColor}-400 font-mono text-2xl mb-4`}>{formatTime(searchTime)}</p>
                
                {queueStatus && (
                  <div className="mb-6 space-y-2">
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <Users className="w-4 h-4" />
                      <span>{queueStatus.queueSize} {t.playersSearching}</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                      <span>{t.queuePosition}: #{queueStatus.position}</span>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleCancelSearch}
                  className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-red-400 font-semibold transition-colors flex items-center justify-center gap-2 mx-auto"
                >
                  <X className="w-5 h-5" />
                  {t.cancel}
                </button>
              </div>
            ) : (
              <button
                onClick={handleSearchMatch}
                disabled={!selectedGameMode || activeMatch}
                className={`w-full py-5 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${
                  selectedGameMode && !activeMatch
                    ? `bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white hover:opacity-90 shadow-xl ${glowColor}`
                    : 'bg-dark-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Play className="w-6 h-6" />
                {selectedGameMode ? t.searchMatch : t.selectMode}
              </button>
            )}
          </div>

          {/* How it works */}
          <div className={`mt-12 p-6 bg-dark-900/60 rounded-2xl border ${borderColor} max-w-2xl mx-auto`}>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Zap className={`w-5 h-5 text-${accentColor}-400`} />
              {language === 'fr' ? 'Comment ça marche ?' : 'How does it work?'}
            </h3>
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg bg-${accentColor}-500/20 flex items-center justify-center flex-shrink-0`}>
                  <span className={`text-${accentColor}-400 font-bold text-sm`}>1</span>
                </div>
                <div>
                  <p className="text-white font-medium">{language === 'fr' ? 'Choisis ton mode' : 'Choose your mode'}</p>
                  <p className="text-gray-500 text-sm">{language === 'fr' ? 'Duel, Mêlée, Domination ou Recherche & Destruction' : 'Duel, TDM, Domination or Search & Destroy'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg bg-${accentColor}-500/20 flex items-center justify-center flex-shrink-0`}>
                  <span className={`text-${accentColor}-400 font-bold text-sm`}>2</span>
                </div>
                <div>
                  <p className="text-white font-medium">{language === 'fr' ? 'File d\'attente automatique' : 'Automatic queue'}</p>
                  <p className="text-gray-500 text-sm">{language === 'fr' ? 'Le système trouve des joueurs de ton niveau' : 'The system finds players at your skill level'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg bg-${accentColor}-500/20 flex items-center justify-center flex-shrink-0`}>
                  <span className={`text-${accentColor}-400 font-bold text-sm`}>3</span>
                </div>
                <div>
                  <p className="text-white font-medium">{language === 'fr' ? 'Gagne des points' : 'Earn points'}</p>
                  <p className="text-gray-500 text-sm">{language === 'fr' ? 'Monte dans le classement et atteins le sommet !' : 'Climb the ranks and reach the top!'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* All Ranks Slider */}
          <div className="mt-12">
            <div className="flex items-center justify-between mb-6 max-w-5xl mx-auto">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Crown className={`w-5 h-5 text-${accentColor}-400`} />
                {t.allRanks}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => scrollSlider('left')}
                  disabled={activeRankIndex === 0}
                  className={`p-2 rounded-lg transition-colors ${
                    activeRankIndex === 0
                      ? 'bg-dark-800/50 text-gray-600 cursor-not-allowed'
                      : `bg-dark-800 text-gray-400 hover:text-${accentColor}-400 hover:bg-dark-700`
                  }`}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => scrollSlider('right')}
                  disabled={activeRankIndex === allRanks.length - 1}
                  className={`p-2 rounded-lg transition-colors ${
                    activeRankIndex === allRanks.length - 1
                      ? 'bg-dark-800/50 text-gray-600 cursor-not-allowed'
                      : `bg-dark-800 text-gray-400 hover:text-${accentColor}-400 hover:bg-dark-700`
                  }`}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Rank dots indicator */}
            <div className="flex justify-center gap-2 mb-4">
              {allRanks.map((rank, idx) => (
                <button
                  key={rank.name}
                  onClick={() => scrollToRankIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === activeRankIndex
                      ? `bg-gradient-to-r ${rank.color} scale-125`
                      : 'bg-dark-700 hover:bg-dark-600'
                  }`}
                />
              ))}
            </div>

            {/* Slider */}
            <div 
              ref={sliderRef}
              className="flex gap-4 overflow-x-auto pb-4 scroll-smooth hide-scrollbar snap-x snap-mandatory max-w-5xl mx-auto"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {allRanks.map((rank, idx) => {
                const RankIcon = rank.icon;
                const isPlayerRank = myRanking && myRanking.points >= rank.minPoints && myRanking.points <= rank.maxPoints;
                
                return (
                  <div
                    key={rank.name}
                    className={`flex-shrink-0 w-[260px] snap-center p-5 rounded-2xl border transition-all duration-300 ${
                      idx === activeRankIndex
                        ? `${rank.bgColor} ${rank.borderColor} shadow-lg ${rank.glowColor}`
                        : 'bg-dark-900/60 border-dark-700/50 opacity-70 hover:opacity-90'
                    } ${isPlayerRank ? 'ring-2 ring-offset-2 ring-offset-dark-900 ring-white/30' : ''}`}
                  >
                    {/* Rank header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${rank.color} flex items-center justify-center shadow-lg ${rank.glowColor}`}>
                        <RankIcon className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className={`text-xl font-bold ${rank.textColor}`}>{rank.name}</h3>
                          {isPlayerRank && (
                            <span className={`text-xs px-2 py-0.5 rounded-full bg-${accentColor}-500/20 text-${accentColor}-400`}>
                              {t.you}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-500 text-sm">{rank.pointsRange} pts</p>
                      </div>
                    </div>
                    
                    {/* Description */}
                    <p className="text-gray-400 text-sm mb-4">
                      {rank.description[language] || rank.description.en}
                    </p>
                    
                    {/* Tiers */}
                    <div>
                      <p className="text-xs text-gray-500 mb-2">{t.tiers}</p>
                      <div className="flex gap-1 flex-wrap">
                        {rank.tiers.map((tier) => (
                          <span 
                            key={tier} 
                            className={`px-2 py-1 rounded text-xs font-medium ${rank.bgColor} ${rank.textColor} border ${rank.borderColor}`}
                          >
                            {rank.special ? tier : `${rank.name.charAt(0)} ${tier}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top 30 Leaderboard */}
          <div className={`mt-12 bg-dark-900/80 backdrop-blur-sm rounded-2xl border ${borderColor} overflow-hidden max-w-4xl mx-auto`}>
            <div className={`p-5 border-b ${borderColor} bg-gradient-to-r ${gradientFrom} ${gradientTo}`}>
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <Trophy className="w-6 h-6" />
                {t.top30}
              </h2>
            </div>
            
            {loadingLeaderboard ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className={`w-8 h-8 text-${accentColor}-500 animate-spin`} />
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <Users className="w-12 h-12 mb-3 opacity-50" />
                <p>{language === 'fr' ? 'Aucun joueur classé pour le moment' : 'No ranked players yet'}</p>
              </div>
            ) : (
              <div className="divide-y divide-dark-700/50">
                {leaderboard.map((player, index) => {
                  const playerRankInfo = getRankForPoints(player.points);
                  const RankIcon = playerRankInfo.icon;
                  const isCurrentUser = user && player.user?._id === user._id;
                  
                  return (
                    <div
                      key={player._id}
                      className={`flex items-center gap-4 p-4 transition-colors hover:bg-dark-800/50 ${
                        isCurrentUser ? `bg-${accentColor}-500/10 border-l-4 border-${accentColor}-500` : ''
                      }`}
                    >
                      {/* Position */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900 shadow-lg shadow-yellow-500/30' :
                        index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-gray-800 shadow-lg shadow-gray-400/30' :
                        index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-orange-900 shadow-lg shadow-orange-500/30' :
                        'bg-dark-700 text-gray-400'
                      }`}>
                        {index === 0 && <Crown className="w-5 h-5" />}
                        {index === 1 && <Medal className="w-5 h-5" />}
                        {index === 2 && <Medal className="w-5 h-5" />}
                        {index > 2 && (index + 1)}
                      </div>

                      {/* Avatar & Username */}
                      <Link
                        to={`/profile/${player.user?.username}`}
                        className="flex items-center gap-3 flex-1 hover:opacity-80 transition-opacity"
                      >
                        <div className="relative">
                          <img
                            src={player.user?.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${player.user?.username}`}
                            alt={player.user?.username}
                            className="w-10 h-10 rounded-full object-cover border-2 border-dark-600"
                          />
                          {isCurrentUser && (
                            <div className={`absolute -top-1 -right-1 w-4 h-4 bg-${accentColor}-500 rounded-full border-2 border-dark-900 flex items-center justify-center`}>
                              <Star className="w-2 h-2 text-white" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className={`font-semibold ${isCurrentUser ? `text-${accentColor}-400` : 'text-white'}`}>
                            {player.user?.username || 'Unknown'}
                            {isCurrentUser && <span className="ml-2 text-xs text-gray-500">({t.you})</span>}
                          </p>
                          <div className="flex items-center gap-1 text-xs">
                            <div className={`w-4 h-4 rounded bg-gradient-to-br ${playerRankInfo.color} flex items-center justify-center`}>
                              <RankIcon className="w-2.5 h-2.5 text-white" />
                            </div>
                            <span className={playerRankInfo.textColor}>{playerRankInfo.name}</span>
                          </div>
                        </div>
                      </Link>

                      {/* Stats */}
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-green-400 font-bold">{player.wins}</p>
                          <p className="text-xs text-gray-500">{t.wins}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-red-400 font-bold">{player.losses}</p>
                          <p className="text-xs text-gray-500">{t.losses}</p>
                        </div>
                        <div className="text-center min-w-[60px]">
                          <p className={`text-lg font-bold ${playerRankInfo.textColor}`}>{player.points}</p>
                          <p className="text-xs text-gray-500">{t.points}</p>
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

      {/* Custom CSS for hiding scrollbar */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default RankedMode;
