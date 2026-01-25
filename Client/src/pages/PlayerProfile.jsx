import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { ArrowLeft, Trophy, Medal, Target, TrendingUp, Gamepad2, Crown, Loader2, AlertCircle, Shield, Monitor, Copy, Check, Users, Swords, Clock, Zap, Coins, Play, X, Sparkles, Star, Flame, Link2 } from 'lucide-react';
import ProfileAnimation from '../components/ProfileAnimation';

import { getAvatarUrl, getDefaultAvatar, getUserAvatar } from '../utils/avatar';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const PlayerProfile = () => {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const { user } = useAuth();

  const isHardcore = selectedMode === 'hardcore';
  const accentColor = isHardcore ? 'red' : 'cyan';
  const gradientFrom = isHardcore ? 'from-red-500' : 'from-cyan-400';
  const gradientTo = isHardcore ? 'to-orange-600' : 'to-cyan-600';
  
  // Check if viewing own profile
  const isOwnProfile = user && (user._id === playerId || user.id === playerId);

  // States
  const [loading, setLoading] = useState(true);
  const [copiedMatchId, setCopiedMatchId] = useState(null);
  const [error, setError] = useState(null);
  const [playerData, setPlayerData] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [rankingHardcore, setRankingHardcore] = useState(null);
  const [rankingCdl, setRankingCdl] = useState(null);
  const [squad, setSquad] = useState(null);
  const [rankThresholds, setRankThresholds] = useState(null);
  const [copied, setCopied] = useState(false);
  const [matchHistory, setMatchHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [showMatchDetails, setShowMatchDetails] = useState(false);
  const [rankedMatchHistory, setRankedMatchHistory] = useState([]);
  const [loadingRankedHistory, setLoadingRankedHistory] = useState(false);
  const [selectedRankedMatch, setSelectedRankedMatch] = useState(null);
  const [showRankedMatchDetails, setShowRankedMatchDetails] = useState(false);
  const [rankedPage, setRankedPage] = useState(1);
  const [rankedTotalPages, setRankedTotalPages] = useState(1);
  const [ladderPage, setLadderPage] = useState(1);
  const [ladderTotalPages, setLadderTotalPages] = useState(1);
  const MATCHES_PER_PAGE = 10;
  
  // Rank animation state
  const [rankAnimationPhase, setRankAnimationPhase] = useState(0);
  
  // Rank animation effect
  useEffect(() => {
    const interval = setInterval(() => {
      setRankAnimationPhase(prev => (prev + 1) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);
  
  // Lock body scroll when dialog is open
  useEffect(() => {
    if (showMatchDetails || showRankedMatchDetails) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showMatchDetails, showRankedMatchDetails]);

  // Traductions
  const texts = {
    fr: {
      back: 'Retour',
      goBack: 'Retour',
      playerNotFound: 'Joueur introuvable',
      loadingError: 'Erreur de chargement',
      copy: 'Copier',
      memberSince: 'Membre depuis le',
      statistics: 'Statistiques',
      totalStatistics: 'Statistiques Totales',
      points: 'Points',
      xp: 'Expérience',
      wins: 'Victoires',
      losses: 'Défaites',
      winRate: 'Win Rate',
      totalWins: 'Victoires Totales',
      totalLosses: 'Défaites Totales',
      totalWinRate: 'Ratio de Victoire',
      totalMatches: 'Matchs Joués',
      notRanked: 'Pas encore classé dans ce mode',
      winStreak: 'victoires consécutives',
      best: 'Record',
      matchHistory: 'Historique des matchs',
      noMatches: 'Aucun match joué',
      victory: 'Victoire',
      defeat: 'Défaite',
      vs: 'vs',
      viewDetails: 'Voir détails',
      matchDetails: 'Détails du match',
      winner: 'Équipe gagnante',
      loser: 'Équipe perdante',
      roster: 'Roster',
      deletedTeam: 'Équipe supprimée',
      deletedPlayer: 'Joueur supprimé',
      gameModes: {
        'Search & Destroy': 'Recherche & Destruction',
        'Domination': 'Domination',
        'Team Deathmatch': 'Mêlée générale',
      },
    },
    en: {
      back: 'Back',
      goBack: 'Go Back',
      playerNotFound: 'Player not found',
      loadingError: 'Loading error',
      copy: 'Copy',
      memberSince: 'Member since',
      statistics: 'Statistics',
      totalStatistics: 'Total Statistics',
      points: 'Points',
      xp: 'Experience',
      wins: 'Wins',
      losses: 'Losses',
      winRate: 'Win Rate',
      totalWins: 'Total Wins',
      totalLosses: 'Total Losses',
      totalWinRate: 'Win Ratio',
      totalMatches: 'Matches Played',
      notRanked: 'Not ranked in this mode yet',
      winStreak: 'win streak',
      matchHistory: 'Match History',
      noMatches: 'No matches played',
      victory: 'Victory',
      defeat: 'Defeat',
      vs: 'vs',
      best: 'Best',
      viewDetails: 'View details',
      matchDetails: 'Match Details',
      winner: 'Winning Team',
      loser: 'Losing Team',
      roster: 'Roster',
      deletedTeam: 'Deleted team',
      deletedPlayer: 'Deleted player',
      gameModes: {
        'Search & Destroy': 'Search & Destroy',
        'Domination': 'Domination',
        'Team Deathmatch': 'Team Deathmatch',
      },
    },
    de: {
      back: 'Zurück',
      goBack: 'Zurück',
      playerNotFound: 'Spieler nicht gefunden',
      loadingError: 'Ladefehler',
      copy: 'Kopieren',
      memberSince: 'Mitglied seit',
      statistics: 'Statistiken',
      totalStatistics: 'Gesamtstatistiken',
      points: 'Punkte',
      xp: 'Erfahrung',
      wins: 'Siege',
      losses: 'Niederlagen',
      winRate: 'Siegquote',
      totalWins: 'Gesamtsiege',
      totalLosses: 'Gesamtniederlagen',
      totalWinRate: 'Siegverhältnis',
      totalMatches: 'Gespielte Matches',
      notRanked: 'In diesem Modus noch nicht platziert',
      winStreak: 'Siegesserie',
      best: 'Rekord',
      matchHistory: 'Spielverlauf',
      noMatches: 'Keine Spiele gespielt',
      victory: 'Sieg',
      defeat: 'Niederlage',
      vs: 'vs',
      viewDetails: 'Details ansehen',
      matchDetails: 'Spieldetails',
      winner: 'Gewinnendes Team',
      loser: 'Verlierendes Team',
      roster: 'Aufstellung',
      deletedTeam: 'Gelöschtes Team',
      deletedPlayer: 'Gelöschter Spieler',
      gameModes: {
        'Search & Destroy': 'Suchen & Zerstören',
        'Domination': 'Herrschaft',
        'Team Deathmatch': 'Team-Deathmatch',
      },
    },
    it: {
      back: 'Indietro',
      goBack: 'Torna indietro',
      playerNotFound: 'Giocatore non trovato',
      loadingError: 'Errore di caricamento',
      copy: 'Copia',
      memberSince: 'Membro dal',
      statistics: 'Statistiche',
      totalStatistics: 'Statistiche Totali',
      points: 'Punti',
      xp: 'Esperienza',
      wins: 'Vittorie',
      losses: 'Sconfitte',
      winRate: 'Win Rate',
      totalWins: 'Vittorie Totali',
      totalLosses: 'Sconfitte Totali',
      totalWinRate: 'Rapporto Vittorie',
      totalMatches: 'Partite Giocate',
      notRanked: 'Non ancora classificato in questa modalità',
      winStreak: 'serie di vittorie',
      best: 'Record',
      matchHistory: 'Cronologia partite',
      noMatches: 'Nessuna partita giocata',
      victory: 'Vittoria',
      defeat: 'Sconfitta',
      vs: 'vs',
      viewDetails: 'Vedi dettagli',
      matchDetails: 'Dettagli partita',
      winner: 'Squadra vincitrice',
      loser: 'Squadra perdente',
      roster: 'Formazione',
      deletedTeam: 'Squadra eliminata',
      deletedPlayer: 'Giocatore eliminato',
      gameModes: {
        'Search & Destroy': 'Cerca e Distruggi',
        'Domination': 'Dominazione',
        'Team Deathmatch': 'Deathmatch a squadre',
      },
    },
  };
  const t = texts[language] || texts.en;

  // Copy Activision ID to clipboard
  const copyActivisionId = () => {
    if (playerData?.activisionId) {
      navigator.clipboard.writeText(playerData.activisionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Set page title
  useEffect(() => {
    const prefixes = {
      fr: 'Profil de',
      en: 'Profile of',
      it: 'Profilo di',
      de: 'Profil von',
    };
    const prefix = prefixes[language] || prefixes.en;
    document.title = `NoMercy - ${prefix} ${playerData?.username || playerData?.discordUsername || playerId}`;
  }, [playerId, playerData?.username, playerData?.discordUsername, language]);

  // Fetch player data
  useEffect(() => {
    const fetchPlayerData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch user profile by ID
        const userResponse = await fetch(`${API_URL}/users/by-id/${playerId}`);
        const userData = await userResponse.json();
        
        if (!userData.success) {
          setError(t.playerNotFound);
          setLoading(false);
          return;
        }
        
        setPlayerData(userData.user);
        
        // Fetch rankings for BOTH modes to show the highest rank
        try {
          const [hardcoreRes, cdlRes] = await Promise.all([
            fetch(`${API_URL}/rankings/user/${userData.user.id}/hardcore`),
            fetch(`${API_URL}/rankings/user/${userData.user.id}/cdl`)
          ]);
          
          const hardcoreData = await hardcoreRes.json();
          const cdlData = await cdlRes.json();
          
          if (hardcoreData.success) {
            setRankingHardcore(hardcoreData.ranking);
          }
          if (cdlData.success) {
            setRankingCdl(cdlData.ranking);
          }
          
          // Use the ranking for the current mode, or fallback to the one with more points
          if (selectedMode === 'hardcore' && hardcoreData.success) {
            setRanking(hardcoreData.ranking);
          } else if (selectedMode === 'cdl' && cdlData.success) {
            setRanking(cdlData.ranking);
          } else {
            // If current mode ranking doesn't exist, use the one with more points
            const hcPoints = hardcoreData.success ? (hardcoreData.ranking.points || 0) : 0;
            const cdlPoints = cdlData.success ? (cdlData.ranking.points || 0) : 0;
            
            if (hcPoints >= cdlPoints && hardcoreData.success) {
              setRanking(hardcoreData.ranking);
            } else if (cdlData.success) {
              setRanking(cdlData.ranking);
            }
          }
        } catch (err) {
          console.error('Error fetching rankings:', err);
        }
        
        // Fetch squad if user has one
        try {
          const squadResponse = await fetch(`${API_URL}/users/by-id/${playerId}/squad`);
          const squadData = await squadResponse.json();
          if (squadData.success && squadData.squad) {
            setSquad(squadData.squad);
          }
        } catch (err) {
          console.error('Error fetching squad:', err);
        }
        
        // Fetch rank thresholds from admin config
        try {
          const settingsResponse = await fetch(`${API_URL}/app-settings/public`);
          const settingsData = await settingsResponse.json();
          if (settingsData.success && settingsData.rankedSettings?.rankPointsThresholds) {
            setRankThresholds(settingsData.rankedSettings.rankPointsThresholds);
          }
        } catch (err) {
          console.error('Error fetching rank thresholds:', err);
        }
        
      } catch (err) {
        console.error('Error fetching player data:', err);
        setError(t.loadingError);
      } finally {
        setLoading(false);
      }
    };
    
    if (playerId) {
      fetchPlayerData();
    }
  }, [playerId, selectedMode, language]);

  // Fetch match history when player data is loaded
  useEffect(() => {
    const fetchMatchHistory = async () => {
      if (!playerData?.id) return;
      setLoadingHistory(true);
      try {
        const response = await fetch(`${API_URL}/matches/player-history/${playerData.id}?limit=500`);
        const data = await response.json();
        if (data.success) {
          setMatchHistory(data.matches);
          setLadderTotalPages(Math.ceil(data.matches.length / MATCHES_PER_PAGE));
          setLadderPage(1);
        }
      } catch (err) {
        console.error('Error fetching match history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchMatchHistory();
  }, [playerData?.id]);

  // Get paginated ladder matches
  const getPaginatedLadderMatches = () => {
    const startIndex = (ladderPage - 1) * MATCHES_PER_PAGE;
    const endIndex = startIndex + MATCHES_PER_PAGE;
    return matchHistory.slice(startIndex, endIndex);
  };

  // Fetch ranked match history when player data is loaded
  useEffect(() => {
    const fetchRankedMatchHistory = async () => {
      if (!playerData?.id) return;
      setLoadingRankedHistory(true);
      try {
        const response = await fetch(`${API_URL}/ranked-matches/player-history/${playerData.id}?limit=500`);
        const data = await response.json();
        if (data.success) {
          setRankedMatchHistory(data.matches);
          setRankedTotalPages(Math.ceil(data.matches.length / MATCHES_PER_PAGE));
          setRankedPage(1); // Reset to page 1 when data changes
        }
      } catch (err) {
        console.error('Error fetching ranked match history:', err);
      } finally {
        setLoadingRankedHistory(false);
      }
    };
    fetchRankedMatchHistory();
  }, [playerData?.id]);

  // Get paginated ranked matches
  const getPaginatedRankedMatches = () => {
    const startIndex = (rankedPage - 1) * MATCHES_PER_PAGE;
    const endIndex = startIndex + MATCHES_PER_PAGE;
    return rankedMatchHistory.slice(startIndex, endIndex);
  };

  // Get player stats (mode-specific stats)
  const getPlayerStats = () => {
    // Use mode-specific stats (statsHardcore or statsCdl), fallback to legacy stats
    const modeStats = selectedMode === 'cdl' 
      ? (playerData?.statsCdl || playerData?.stats || {})
      : (playerData?.statsHardcore || playerData?.stats || {});
    
    return {
      points: modeStats.points || 0,
      xp: modeStats.xp || 0,
      wins: modeStats.wins || 0,
      losses: modeStats.losses || 0,
      rank: modeStats.rank || ranking?.rank || 999
    };
  };

  const playerStats = playerData ? getPlayerStats() : null;

  // Calculate win rate
  const getWinRate = () => {
    if (!playerStats) return '0%';
    const total = playerStats.wins + playerStats.losses;
    if (total === 0) return '0%';
    return `${Math.round((playerStats.wins / total) * 100)}%`;
  };

  // Calculate combined stats from ladder + ranked match histories
  const getCombinedStats = () => {
    let wins = 0;
    let losses = 0;
    
    // Count from ladder match history
    matchHistory.forEach(match => {
      const playerSquadId = match.playerSquad?._id || match.playerSquad;
      const winnerId = typeof match.result?.winner === 'object' 
        ? match.result?.winner?._id 
        : match.result?.winner;
      const isWinner = playerSquadId?.toString?.() === winnerId?.toString?.();
      if (isWinner) wins++;
      else losses++;
    });
    
    // Count from ranked match history
    rankedMatchHistory.forEach(match => {
      if (match.isWinner) wins++;
      else losses++;
    });
    
    return { wins, losses, total: wins + losses };
  };
  
  const combinedStats = getCombinedStats();

  // Calculate total win rate from combined stats
  const getTotalWinRate = () => {
    if (combinedStats.total === 0) return '0%';
    return `${Math.round((combinedStats.wins / combinedStats.total) * 100)}%`;
  };

  // Get rank for ornament (use ranking.rank from DB)
  const playerRank = playerStats?.rank || 999;

  // Traductions des noms de rangs
  const RANK_NAMES = {
    bronze: { fr: 'Bronze', en: 'Bronze', de: 'Bronze', it: 'Bronzo' },
    silver: { fr: 'Argent', en: 'Silver', de: 'Silber', it: 'Argento' },
    gold: { fr: 'Or', en: 'Gold', de: 'Gold', it: 'Oro' },
    platinum: { fr: 'Platine', en: 'Platinum', de: 'Platin', it: 'Platino' },
    diamond: { fr: 'Diamant', en: 'Diamond', de: 'Diamant', it: 'Diamante' },
    master: { fr: 'Maître', en: 'Master', de: 'Meister', it: 'Maestro' },
    grandmaster: { fr: 'Grand Maître', en: 'Grandmaster', de: 'Großmeister', it: 'Gran Maestro' },
    champion: { fr: 'Champion', en: 'Champion', de: 'Champion', it: 'Campione' }
  };

  // Rank styles for each division
  const RANK_STYLES = {
    champion: { key: 'champion', color: 'from-yellow-400 to-amber-500', textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-500/50', icon: '👑', hexColor: '#F1C40F', Icon: Crown, isTop: true, image: '/8.png' },
    grandmaster: { key: 'grandmaster', color: 'from-red-500 to-rose-600', textColor: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/50', icon: '🔥', hexColor: '#E74C3C', Icon: Flame, isTop: true, image: '/7.png' },
    master: { key: 'master', color: 'from-purple-500 to-violet-600', textColor: 'text-purple-400', bgColor: 'bg-purple-500/20', borderColor: 'border-purple-500/50', icon: '💎', hexColor: '#9B59B6', Icon: Crown, isTop: false, image: '/6.png' },
    diamond: { key: 'diamond', color: 'from-cyan-400 to-blue-500', textColor: 'text-cyan-400', bgColor: 'bg-cyan-500/20', borderColor: 'border-cyan-500/50', icon: '💠', hexColor: '#B9F2FF', Icon: Star, isTop: false, image: '/5.png' },
    platinum: { key: 'platinum', color: 'from-teal-400 to-emerald-500', textColor: 'text-teal-400', bgColor: 'bg-teal-500/20', borderColor: 'border-teal-500/50', icon: '🏅', hexColor: '#00CED1', Icon: Medal, isTop: false, image: '/4.png' },
    gold: { key: 'gold', color: 'from-yellow-500 to-amber-600', textColor: 'text-yellow-500', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-500/50', icon: '🥇', hexColor: '#FFD700', Icon: Medal, isTop: false, image: '/3.png' },
    silver: { key: 'silver', color: 'from-gray-300 to-gray-400', textColor: 'text-gray-300', bgColor: 'bg-gray-500/20', borderColor: 'border-gray-500/50', icon: '🥈', hexColor: '#C0C0C0', Icon: Shield, isTop: false, image: '/2.png' },
    bronze: { key: 'bronze', color: 'from-orange-600 to-amber-700', textColor: 'text-orange-400', bgColor: 'bg-orange-500/20', borderColor: 'border-orange-500/50', icon: '🥉', hexColor: '#CD7F32', Icon: Shield, isTop: false, image: '/1.png' }
  };

  // Get division based on points using thresholds from admin config
  const getDivision = (points) => {
    // Use thresholds from config, or default if not loaded
    const thresholds = rankThresholds || {
      bronze: { min: 0, max: 499 },
      silver: { min: 500, max: 999 },
      gold: { min: 1000, max: 1499 },
      platinum: { min: 1500, max: 1999 },
      diamond: { min: 2000, max: 2499 },
      master: { min: 2500, max: 2999 },
      grandmaster: { min: 3000, max: 3499 },
      champion: { min: 3500, max: null }
    };
    
    // Check ranks from highest to lowest
    const rankOrder = ['champion', 'grandmaster', 'master', 'diamond', 'platinum', 'gold', 'silver', 'bronze'];
    for (const rankKey of rankOrder) {
      const threshold = thresholds[rankKey];
      if (threshold && points >= threshold.min) {
        const style = RANK_STYLES[rankKey];
        return {
          ...style,
          name: RANK_NAMES[rankKey]?.[language] || RANK_NAMES[rankKey]?.en || rankKey
        };
      }
    }
    return {
      ...RANK_STYLES.bronze,
      name: RANK_NAMES.bronze?.[language] || RANK_NAMES.bronze?.en || 'bronze'
    };
  };

  // Find the ranking with the highest points to display the best rank
  // Simple logic: use whichever ranking has more points
  const hcPoints = rankingHardcore?.points || 0;
  const cdlPoints = rankingCdl?.points || 0;
  const hcHasPlayed = rankingHardcore && (rankingHardcore.wins > 0 || rankingHardcore.losses > 0);
  const cdlHasPlayed = rankingCdl && (rankingCdl.wins > 0 || rankingCdl.losses > 0);
  
  // Get the best ranking: the one with more points among those where player has played
  let bestRanking = null;
  if (hcHasPlayed && cdlHasPlayed) {
    // Player has played both - use the one with more points
    bestRanking = hcPoints >= cdlPoints ? rankingHardcore : rankingCdl;
  } else if (hcHasPlayed) {
    bestRanking = rankingHardcore;
  } else if (cdlHasPlayed) {
    bestRanking = rankingCdl;
  }
  
  // Show division based on the best ranking found
  const division = bestRanking ? getDivision(bestRanking.points || 0) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <Loader2 className={`w-12 h-12 text-${accentColor}-400 animate-spin`} />
      </div>
    );
  }

  if (error || !playerData) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">{error || 'Player not found'}</h1>
        <button 
          onClick={() => navigate(-1)}
          className={`mt-4 px-6 py-2 bg-${accentColor}-500 text-white rounded-lg hover:opacity-90 transition-opacity`}
        >
          {t.goBack}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 relative">
      {isHardcore ? (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 20% 20%, rgba(239, 68, 68, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(249, 115, 22, 0.05) 0%, transparent 50%)' }}></div>
      ) : (
        <div className="absolute inset-0 bg-mesh pointer-events-none"></div>
      )}
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-30"></div>
      
      <div className="relative z-10 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <button onClick={() => navigate(-1)} className={`mb-6 flex items-center space-x-2 text-gray-400 hover:text-${accentColor}-400 transition-colors group`}>
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>{t.back}</span>
        </button>

          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-${accentColor}-500/20 overflow-hidden mb-6 relative`}>
          {/* Profile Animation Effects with real particles */}
          {playerData.equippedProfileAnimation && (
            <ProfileAnimation 
              animationData={playerData.equippedProfileAnimation.profileAnimationData}
              className="z-0"
            />
          )}
          {/* Banner avec avatar qui chevauche */}
          <div className="relative">
            {playerData.banner ? (
              <div className="w-full h-40 sm:h-48 relative overflow-hidden">
                <img 
                  src={`https://api-nomercy.ggsecure.io${playerData.banner}`}
                  alt="Profile banner"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-dark-900"></div>
              </div>
            ) : (
              <div className="w-full h-20 sm:h-24"></div>
            )}
            
            {/* Avatar positionné pour chevaucher la bannière */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-14 sm:-bottom-16 z-20">
              <div className="relative">
                {/* Avatar */}
                <div className="relative group">
                  <div className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center text-4xl sm:text-5xl font-bold text-dark-950 overflow-hidden transition-all duration-300 group-hover:scale-105 shadow-2xl`} 
                    style={{ 
                      backgroundImage: playerData.avatar ? `url(${getAvatarUrl(playerData.avatar)})` : 'none', 
                      backgroundSize: 'cover', 
                      backgroundPosition: 'center',
                    }}>
                    {!playerData.avatar && <span>{(playerData.username || playerData.discordUsername)?.charAt(0).toUpperCase()}</span>}
                  </div>
                </div>
                
                {/* Badge de rang positionné en bas à droite de l'avatar */}
                {division && (
                  <div className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 z-30">
                    <div className="relative">
                      {/* Glow effect */}
                      <div 
                        className="absolute inset-0 rounded-full blur-lg opacity-50"
                        style={{ 
                          background: division.hexColor,
                          transform: 'scale(1.3)'
                        }}
                      />
                      <img 
                        src={division.image} 
                        alt={division.name}
                        className="w-12 h-12 sm:w-14 sm:h-14 object-contain relative z-10"
                        style={{ 
                          filter: `drop-shadow(0 0 8px ${division.hexColor}80)`
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="pt-16 sm:pt-20 pb-6 px-6 sm:px-8">
          <div className="flex flex-col items-center text-center">
              
              {/* Username */}
              <h1 
                className={`text-2xl sm:text-3xl font-bold mb-1 ${division ? '' : 'text-white'}`}
                style={division ? { 
                  color: division.hexColor,
                  textShadow: `0 0 20px ${division.hexColor}60`
                } : {}}
              >
                {division && division.isTop && (
                  <Sparkles 
                    className="inline w-5 h-5 sm:w-6 sm:h-6 mr-1.5 animate-pulse" 
                    style={{ color: division.hexColor }}
                  />
                )}
                {playerData.username || playerData.discordUsername || 'Utilisateur'}
                {division && division.isTop && (
                  <Sparkles 
                    className="inline w-5 h-5 sm:w-6 sm:h-6 ml-1.5 animate-pulse" 
                    style={{ color: division.hexColor }}
                  />
                )}
              </h1>
              
              {/* Division name + points en ligne */}
              {division && (
                <div className="flex items-center gap-2 mb-3">
                  <span 
                    className="text-base sm:text-lg font-bold"
                    style={{ color: division.hexColor }}
                  >
                    {division.name}
                  </span>
                  {bestRanking && bestRanking.points > 0 && (
                    <span 
                      className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                      style={{ 
                        background: `${division.hexColor}20`,
                        color: division.hexColor
                      }}
                    >
                      {bestRanking.points} pts
                    </span>
                  )}
                </div>
              )}
              
              <div className="flex flex-wrap items-center justify-center gap-2 text-sm mb-3">
                {playerStats && playerStats.xp > 0 && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 font-medium">
                    <Zap className="w-4 h-4" />
                    {playerStats.xp.toLocaleString()} XP
                  </span>
                )}
                {playerData?.gold !== undefined && playerData.gold > 0 && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-yellow-400 font-medium">
                    <Coins className="w-4 h-4" />
                    {playerData.gold.toLocaleString()} Gold
                  </span>
                )}
                {squad && (
                  <Link
                    to={`/squad/${squad.id || squad._id}`}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white font-medium hover:bg-white/10 hover:border-white/20 transition-colors"
                  >
                    <div 
                      className="w-5 h-5 rounded flex items-center justify-center"
                      style={{ backgroundColor: squad.color === 'transparent' ? 'rgba(255,255,255,0.1)' : squad.color + '40', borderColor: squad.color === 'transparent' ? 'rgba(255,255,255,0.2)' : squad.color }}
                    >
                      <Users className="w-3 h-3" style={{ color: squad.color === 'transparent' ? '#9ca3af' : squad.color }} />
                  </div>
                    <span>{squad.name}</span>
                    <span className="text-gray-500 text-xs">[{squad.tag}]</span>
                  </Link>
                )}
                {playerData.platform && (
                  <span className="flex items-center space-x-1.5 px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-lg">
                    <Monitor className="w-4 h-4 text-purple-400" />
                    <span className="text-purple-400 font-medium">{playerData.platform}</span>
                  </span>
                )}
              </div>
              
              {/* Equipped Title - Above Activision ID */}
              {playerData.equippedTitle && (
                <div className="mb-4">
                  <span 
                    className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-lg font-bold border-2 shadow-xl
                      ${
                        playerData.equippedTitle.rarity === 'legendary' 
                          ? 'bg-gradient-to-r from-yellow-500/30 via-amber-400/30 to-yellow-500/30 border-yellow-400/60 text-yellow-300' 
                          : playerData.equippedTitle.rarity === 'epic' 
                            ? 'bg-gradient-to-r from-purple-500/30 via-pink-400/30 to-purple-500/30 border-purple-400/60 text-purple-300' 
                            : playerData.equippedTitle.rarity === 'rare' 
                              ? 'bg-gradient-to-r from-blue-500/30 via-cyan-400/30 to-blue-500/30 border-blue-400/60 text-blue-300' 
                              : 'bg-gradient-to-r from-gray-500/30 via-slate-400/30 to-gray-500/30 border-gray-400/60 text-gray-300'
                      }
                    `}
                    style={{
                      animation: playerData.equippedTitle.rarity === 'legendary' 
                        ? 'glowPulseLegendary 2s ease-in-out infinite' 
                        : playerData.equippedTitle.rarity === 'epic' 
                          ? 'glowPulseEpic 2s ease-in-out infinite' 
                          : playerData.equippedTitle.rarity === 'rare'
                            ? 'glowPulseRare 2s ease-in-out infinite'
                            : 'glowPulseCommon 2s ease-in-out infinite',
                      textShadow: playerData.equippedTitle.rarity === 'legendary' 
                        ? '0 0 20px rgba(251, 191, 36, 0.8), 0 0 40px rgba(251, 191, 36, 0.4)' 
                        : playerData.equippedTitle.rarity === 'epic' 
                          ? '0 0 20px rgba(168, 85, 247, 0.8), 0 0 40px rgba(168, 85, 247, 0.4)' 
                          : playerData.equippedTitle.rarity === 'rare'
                            ? '0 0 15px rgba(59, 130, 246, 0.6), 0 0 30px rgba(59, 130, 246, 0.3)'
                            : '0 0 10px rgba(156, 163, 175, 0.4)'
                    }}
                  >
                    <Star className="w-5 h-5" />
                    {playerData.equippedTitle.nameTranslations?.[language] || playerData.equippedTitle.name}
                  </span>
                </div>
              )}

              {/* Activision ID */}
              {playerData.activisionId && (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className="flex items-center space-x-2 px-4 py-2 bg-dark-800/50 border border-white/10 rounded-lg">
                    <img src="/activision.svg" alt="Activision" className="w-5 h-5" />
                    <span className="text-gray-300 font-mono">{playerData.activisionId}</span>
                    <button
                      onClick={copyActivisionId}
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                      title={t.copy}
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400 hover:text-white" />
                      )}
                    </button>
                  </div>
                </div>
              )}
              
              {playerData.bio && (
              <p className="text-gray-400 text-sm max-w-xl mb-4 leading-relaxed">{playerData.bio}</p>
              )}
              
              {/* Membre depuis */}
              {playerData.createdAt && (
                <p className="text-gray-500 text-xs">
                  {t.memberSince}{' '}
                  {new Date(playerData.createdAt).toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : language === 'it' ? 'it-IT' : 'en-US', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              )}
          </div>
          </div>
        </div>

          {/* Total Stats (ladder + ranked combined) */}
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-${accentColor}-500/20 p-4 sm:p-6 mb-4 sm:mb-6`}>
            <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center space-x-2">
              <Trophy className={`w-4 sm:w-5 h-4 sm:h-5 ${isHardcore ? 'text-red-400' : 'text-cyan-400'}`} />
              <span>{t.totalStatistics}</span>
            </h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <div className="bg-dark-800/50 rounded-lg p-3 sm:p-4 text-center border border-white/5 hover:border-purple-500/30 transition-colors">
                <Swords className="w-4 sm:w-5 h-4 sm:h-5 text-purple-400 mx-auto mb-1 sm:mb-2" />
                <div className="text-xl sm:text-2xl font-bold text-purple-400">{combinedStats.total}</div>
                <div className="text-gray-500 text-[10px] sm:text-xs">{t.totalMatches}</div>
              </div>
              <div className="bg-dark-800/50 rounded-lg p-3 sm:p-4 text-center border border-white/5 hover:border-green-500/30 transition-colors">
                <Medal className="w-4 sm:w-5 h-4 sm:h-5 text-green-400 mx-auto mb-1 sm:mb-2" />
                <div className="text-xl sm:text-2xl font-bold text-green-400">{combinedStats.wins}</div>
                <div className="text-gray-500 text-[10px] sm:text-xs">{t.totalWins}</div>
              </div>
              <div className="bg-dark-800/50 rounded-lg p-3 sm:p-4 text-center border border-white/5 hover:border-red-500/30 transition-colors">
                <Target className="w-4 sm:w-5 h-4 sm:h-5 text-red-400 mx-auto mb-1 sm:mb-2" />
                <div className="text-xl sm:text-2xl font-bold text-red-400">{combinedStats.losses}</div>
                <div className="text-gray-500 text-[10px] sm:text-xs">{t.totalLosses}</div>
              </div>
              <div className={`bg-dark-800/50 rounded-lg p-3 sm:p-4 text-center border border-white/5 hover:border-${accentColor}-500/30 transition-colors`}>
                <TrendingUp className={`w-4 sm:w-5 h-4 sm:h-5 ${isHardcore ? 'text-red-400' : 'text-cyan-400'} mx-auto mb-1 sm:mb-2`} />
                <div className={`text-xl sm:text-2xl font-bold ${isHardcore ? 'text-red-400' : 'text-cyan-400'}`}>{getTotalWinRate()}</div>
                <div className="text-gray-500 text-[10px] sm:text-xs">{t.totalWinRate}</div>
              </div>
            </div>
          </div>

          {/* Streak si disponible */}
          {ranking && ranking.currentStreak > 0 && (
            <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-orange-500/30 p-6 mb-6`}>
              <div className="flex items-center justify-center gap-4">
                <span className="text-4xl">🔥</span>
                <div>
                  <p className="text-orange-400 font-bold text-2xl">{ranking.currentStreak} {t.winStreak}!</p>
                  {ranking.bestStreak > 0 && (
                    <p className="text-gray-500 text-sm">
                      {t.best}: {ranking.bestStreak}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Ranked Match History */}
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-purple-500/20 p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Trophy className="w-5 h-5 text-purple-400" />
                <span>{language === 'fr' ? 'Historique Mode Classé' : 'Ranked History'}</span>
                {rankedMatchHistory.length > 0 && (
                  <span className="text-sm font-normal text-gray-500">({rankedMatchHistory.length})</span>
                )}
              </h2>
            </div>
            
            {loadingRankedHistory ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              </div>
            ) : rankedMatchHistory.length > 0 ? (
              <>
                <div className="space-y-3 overflow-y-auto max-h-[50vh] sm:max-h-none">
                  {getPaginatedRankedMatches().map((match) => (
                    <div 
                      key={match._id}
                      className={`p-3 sm:p-4 bg-dark-800/50 rounded-lg border ${
                        match.isWinner 
                          ? 'border-green-500/30' 
                          : 'border-red-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        {/* Left: Result + Mode + Format */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Result badge */}
                          <div className={`px-2.5 py-1 rounded text-xs font-bold ${
                            match.isWinner 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {match.isWinner ? (language === 'fr' ? 'Victoire' : 'Victory') : (language === 'fr' ? 'Défaite' : 'Defeat')}
                          </div>
                          
                          {/* Game mode */}
                          <span className="px-2 py-1 bg-purple-500/20 rounded text-xs font-medium text-purple-400">
                            {match.gameMode === 'Search & Destroy' ? 'S&D' : 
                             match.gameMode === 'Team Deathmatch' ? 'TDM' : 
                             match.gameMode}
                          </span>
                          
                          {/* Format */}
                          <div className="flex items-center gap-1 px-2 py-1 bg-dark-700 rounded text-xs text-gray-400">
                            <Users className="w-3 h-3" />
                            <span>{match.teamSize}v{match.teamSize}</span>
                          </div>
                        </div>
                        
                        {/* Right: Date + Buttons */}
                        <div className="flex items-center gap-2 sm:gap-3">
                          {/* Date + Heure */}
                          <div className="hidden sm:flex items-center gap-1.5 text-gray-500 text-xs">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              {new Date(match.completedAt || match.createdAt).toLocaleDateString(
                                language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : language === 'it' ? 'it-IT' : 'en-US',
                                { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
                              )}
                            </span>
                          </div>
                          
                          {/* Copy Match Link Button - Only for own profile */}
                          {isOwnProfile && (
                            <button
                              onClick={() => {
                                const matchUrl = `${window.location.origin}/ranked-match/${match._id}`;
                                navigator.clipboard.writeText(matchUrl);
                                setCopiedMatchId(match._id);
                                setTimeout(() => setCopiedMatchId(null), 2000);
                              }}
                              className={`px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                                copiedMatchId === match._id
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                              }`}
                              title={language === 'fr' ? 'Copier le lien pour arbitre' : 'Copy link for referee'}
                            >
                              {copiedMatchId === match._id ? (
                                <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              ) : (
                                <Link2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              )}
                              <span className="hidden sm:inline">{copiedMatchId === match._id ? (language === 'fr' ? 'Copié!' : 'Copied!') : (language === 'fr' ? 'Copier' : 'Copy')}</span>
                            </button>
                          )}
                          
                          {/* View Details Button */}
                          <button
                            onClick={() => {
                              setSelectedRankedMatch(match);
                              setShowRankedMatchDetails(true);
                            }}
                            className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors flex items-center gap-1.5"
                          >
                            <Play className="w-3 h-3" />
                            <span>{language === 'fr' ? 'Voir détails' : 'View details'}</span>
                          </button>
                        </div>
                      </div>
                      
                      {/* Mobile: Date + Heure on second row */}
                      <div className="sm:hidden flex items-center gap-1.5 text-gray-500 text-xs mt-2">
                        <Clock className="w-3 h-3" />
                        <span>
                          {new Date(match.completedAt || match.createdAt).toLocaleDateString(
                            language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : language === 'it' ? 'it-IT' : 'en-US',
                            { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Pagination */}
                {rankedTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-white/10">
                    <button
                      onClick={() => setRankedPage(p => Math.max(1, p - 1))}
                      disabled={rankedPage === 1}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        rankedPage === 1 
                          ? 'bg-dark-700 text-gray-600 cursor-not-allowed' 
                          : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                      }`}
                    >
                      {language === 'fr' ? '← Précédent' : '← Previous'}
                    </button>
                    
                    <span className="text-gray-400 text-sm px-3">
                      {rankedPage} / {rankedTotalPages}
                    </span>
                    
                    <button
                      onClick={() => setRankedPage(p => Math.min(rankedTotalPages, p + 1))}
                      disabled={rankedPage === rankedTotalPages}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        rankedPage === rankedTotalPages 
                          ? 'bg-dark-700 text-gray-600 cursor-not-allowed' 
                          : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                      }`}
                    >
                      {language === 'fr' ? 'Suivant →' : 'Next →'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">{language === 'fr' ? 'Aucun match classé joué' : 'No ranked matches played'}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Match Details Dialog */}
      {showMatchDetails && selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto overscroll-contain" onClick={(e) => { if (e.target === e.currentTarget) { setShowMatchDetails(false); setSelectedMatch(null); } }}>
          <div className="relative w-full max-w-4xl bg-dark-900 border border-white/10 rounded-xl sm:rounded-2xl shadow-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col my-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className={`p-4 sm:p-6 border-b border-white/10 bg-gradient-to-r ${gradientFrom} ${gradientTo}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
                  <Swords className="w-5 sm:w-6 h-5 sm:h-6" />
                  {t.matchDetails}
                </h2>
                <button 
                  onClick={() => {
                    setShowMatchDetails(false);
                    setSelectedMatch(null);
                  }}
                  className="p-1.5 sm:p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              
              {/* Match Info */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3 sm:mt-4">
                <span className={`px-2 sm:px-3 py-1 sm:py-1.5 bg-white/20 rounded-lg text-xs sm:text-sm font-medium text-white`}>
                  {t.gameModes?.[selectedMatch.gameMode] || selectedMatch.gameMode}
                </span>
                <div className="flex items-center gap-1.5 sm:gap-2 text-white/80 text-xs sm:text-sm">
                  <Users className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  <span>{selectedMatch.teamSize}v{selectedMatch.teamSize}</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 text-white/80 text-xs sm:text-sm">
                  <Clock className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  <span>
                    {new Date(selectedMatch.createdAt).toLocaleDateString(
                      language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : language === 'it' ? 'it-IT' : 'en-US',
                      { day: 'numeric', month: 'short', year: 'numeric' }
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
                {(() => {
                  const winnerId = typeof selectedMatch.result?.winner === 'object' 
                    ? selectedMatch.result?.winner?._id 
                    : selectedMatch.result?.winner;
                  const challengerIsWinner = winnerId === selectedMatch.challenger?._id;
                  const challengerName = selectedMatch.challenger?.name || selectedMatch.challengerInfo?.name || t.deletedTeam;
                  const opponentName = selectedMatch.opponent?.name || selectedMatch.opponentInfo?.name || t.deletedTeam;
                  
                  return (
                    <>
                      {/* Challenger Team */}
                      <div className={`p-5 rounded-xl border-2 ${
                        challengerIsWinner 
                          ? 'bg-green-500/10 border-green-500/50' 
                          : 'bg-red-500/10 border-red-500/50'
                      }`}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            {challengerName}
                          </h3>
                          {challengerIsWinner ? (
                            <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold flex items-center gap-1">
                              <Trophy className="w-3.5 h-3.5" />
                              {t.winner}
                            </div>
                          ) : (
                            <div className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-bold">
                              {t.loser}
                            </div>
                          )}
                        </div>
                        
                        {/* Roster */}
                        <div>
                          <p className="text-xs uppercase tracking-wider text-gray-500 mb-3 font-bold">{t.roster}</p>
                          <div className="space-y-2">
                            {selectedMatch.challengerRoster?.map((p, idx) => {
                              // Utiliser le username sauvegardé si le compte est supprimé
                              const displayName = p.user?.username || p.username || t.deletedPlayer;
                              const isDeleted = !p.user;
                              
                              // Handle avatar with Discord fallback
                              let playerAvatar = getAvatarUrl(p.user?.avatarUrl || p.user?.avatar);
                              if (!playerAvatar && p.user?.discordId && p.user?.discordAvatar) {
                                playerAvatar = `https://cdn.discordapp.com/avatars/${p.user.discordId}/${p.user.discordAvatar}.png`;
                              }
                              if (!playerAvatar) {
                                playerAvatar = getDefaultAvatar(displayName);
                              }
                              
                              return (
                                <div key={idx} className={`flex items-center gap-3 p-2.5 rounded-lg ${p.isHelper ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-dark-800/50'}`}>
                                  <img 
                                    src={playerAvatar}
                                    alt=""
                                    className="w-8 h-8 rounded-full"
                                  />
                                  <div className="flex-1 min-w-0">
                                    {isDeleted ? (
                                      <span className="text-gray-400 font-medium text-sm truncate block italic">
                                        {displayName}
                                      </span>
                                    ) : (
                                      <Link 
                                        to={`/player/${p.user?._id}`}
                                        className="text-white hover:text-yellow-400 transition-colors font-medium text-sm truncate block"
                                      >
                                        {displayName}
                                      </Link>
                                    )}
                                    {p.isHelper && (
                                      <span className="text-yellow-400 text-xs">Helper</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Opponent Team */}
                      <div className={`p-5 rounded-xl border-2 ${
                        !challengerIsWinner 
                          ? 'bg-green-500/10 border-green-500/50' 
                          : 'bg-red-500/10 border-red-500/50'
                      }`}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            {opponentName}
                          </h3>
                          {!challengerIsWinner ? (
                            <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold flex items-center gap-1">
                              <Trophy className="w-3.5 h-3.5" />
                              {t.winner}
                            </div>
                          ) : (
                            <div className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-bold">
                              {t.loser}
                            </div>
                          )}
                        </div>
                        
                        {/* Roster */}
                        <div>
                          <p className="text-xs uppercase tracking-wider text-gray-500 mb-3 font-bold">{t.roster}</p>
                          <div className="space-y-2">
                            {selectedMatch.opponentRoster?.map((p, idx) => {
                              // Utiliser le username sauvegardé si le compte est supprimé
                              const displayName = p.user?.username || p.username || t.deletedPlayer;
                              const isDeleted = !p.user;
                              
                              // Handle avatar with Discord fallback
                              let playerAvatar = getAvatarUrl(p.user?.avatarUrl || p.user?.avatar);
                              if (!playerAvatar && p.user?.discordId && p.user?.discordAvatar) {
                                playerAvatar = `https://cdn.discordapp.com/avatars/${p.user.discordId}/${p.user.discordAvatar}.png`;
                              }
                              if (!playerAvatar) {
                                playerAvatar = getDefaultAvatar(displayName);
                              }
                              
                              return (
                                <div key={idx} className={`flex items-center gap-3 p-2.5 rounded-lg ${p.isHelper ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-dark-800/50'}`}>
                                  <img 
                                    src={playerAvatar}
                                    alt=""
                                    className="w-8 h-8 rounded-full"
                                  />
                                  <div className="flex-1 min-w-0">
                                    {isDeleted ? (
                                      <span className="text-gray-400 font-medium text-sm truncate block italic">
                                        {displayName}
                                      </span>
                                    ) : (
                                      <Link 
                                        to={`/player/${p.user?._id}`}
                                        className="text-white hover:text-yellow-400 transition-colors font-medium text-sm truncate block"
                                      >
                                        {displayName}
                                      </Link>
                                    )}
                                    {p.isHelper && (
                                      <span className="text-yellow-400 text-xs">Helper</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ranked Match Details Modal */}
      {showRankedMatchDetails && selectedRankedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto overscroll-contain" onClick={(e) => { if (e.target === e.currentTarget) { setShowRankedMatchDetails(false); setSelectedRankedMatch(null); } }}>
          <div className="bg-dark-900 rounded-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[85vh] overflow-hidden shadow-2xl border border-purple-500/30 my-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex-shrink-0 p-4 sm:p-6 border-b border-white/10 bg-gradient-to-r from-purple-500 to-pink-600">
              <div className="flex items-center justify-between">
                <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
                  <Trophy className="w-5 sm:w-6 h-5 sm:h-6" />
                  {language === 'fr' ? 'Détails du match classé' : 'Ranked Match Details'}
                </h2>
                <button 
                  onClick={() => {
                    setShowRankedMatchDetails(false);
                    setSelectedRankedMatch(null);
                  }}
                  className="p-1.5 sm:p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              
              {/* Match Info */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3 sm:mt-4">
                <span className={`px-2.5 py-1 rounded-lg text-xs sm:text-sm font-bold ${
                  selectedRankedMatch.isWinner 
                    ? 'bg-green-500/30 text-green-300' 
                    : 'bg-red-500/30 text-red-300'
                }`}>
                  {selectedRankedMatch.isWinner ? (language === 'fr' ? 'Victoire' : 'Victory') : (language === 'fr' ? 'Défaite' : 'Defeat')}
                </span>
                <span className="px-2.5 py-1 bg-white/20 rounded-lg text-xs sm:text-sm font-medium text-white">
                  {selectedRankedMatch.gameMode}
                </span>
                <div className="flex items-center gap-1.5 sm:gap-2 text-white/80 text-xs sm:text-sm">
                  <Users className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  <span>{selectedRankedMatch.teamSize}v{selectedRankedMatch.teamSize}</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 text-white/80 text-xs sm:text-sm">
                  <Clock className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  <span>
                    {new Date(selectedRankedMatch.completedAt || selectedRankedMatch.createdAt).toLocaleDateString(
                      language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : language === 'it' ? 'it-IT' : 'en-US',
                      { day: 'numeric', month: 'short', year: 'numeric' }
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Content - Teams */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* Team 1 */}
                <div className={`p-4 rounded-xl border-2 ${
                  Number(selectedRankedMatch.result?.winner) === 1
                    ? 'bg-green-500/10 border-green-500/50' 
                    : 'bg-red-500/10 border-red-500/50'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      {language === 'fr' ? 'Équipe 1' : 'Team 1'}
                    </h3>
                    {Number(selectedRankedMatch.result?.winner) === 1 ? (
                      <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5" />
                        {language === 'fr' ? 'Victoire' : 'Winner'}
                      </div>
                    ) : (
                      <div className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-bold">
                        {language === 'fr' ? 'Défaite' : 'Defeat'}
                      </div>
                    )}
                  </div>
                  
                  {/* Roster */}
                  <div className="space-y-2">
                    {selectedRankedMatch.team1?.map((player, idx) => {
                      // Safe username with fallback
                      const safeUsername = player?.username || 'Joueur';
                      
                      // Build avatar URL: custom upload > discord > default
                      let playerAvatar = null;
                      try {
                        playerAvatar = player?.avatarUrl ? getAvatarUrl(player.avatarUrl) : null;
                        if (!playerAvatar && player?.discordId && player?.discordAvatar) {
                          playerAvatar = `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png`;
                        }
                        if (!playerAvatar) {
                          playerAvatar = getDefaultAvatar(safeUsername);
                        }
                      } catch (e) {
                        playerAvatar = '/avatar.jpg';
                      }
                      
                      return (
                        <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg bg-dark-800/50">
                          <img 
                            src={playerAvatar}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover"
                            onError={(e) => { e.target.src = '/avatar.jpg'; }}
                          />
                          <div className="flex-1 min-w-0">
                            {player?.userId ? (
                              <Link 
                                to={`/player/${player.userId}`}
                                className="text-white hover:text-purple-400 transition-colors font-medium text-sm truncate block"
                              >
                                {safeUsername}
                              </Link>
                            ) : (
                              <span className="text-white font-medium text-sm truncate block">
                                {safeUsername}
                              </span>
                            )}
                          </div>
                          {selectedRankedMatch.playerTeam === 1 && player?.userId === playerId && (
                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                              {language === 'fr' ? 'Ce joueur' : 'This player'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Team 2 */}
                <div className={`p-4 rounded-xl border-2 ${
                  Number(selectedRankedMatch.result?.winner) === 2
                    ? 'bg-green-500/10 border-green-500/50' 
                    : 'bg-red-500/10 border-red-500/50'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                      {language === 'fr' ? 'Équipe 2' : 'Team 2'}
                    </h3>
                    {Number(selectedRankedMatch.result?.winner) === 2 ? (
                      <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5" />
                        {language === 'fr' ? 'Victoire' : 'Winner'}
                      </div>
                    ) : (
                      <div className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-bold">
                        {language === 'fr' ? 'Défaite' : 'Defeat'}
                      </div>
                    )}
                  </div>
                  
                  {/* Roster */}
                  <div className="space-y-2">
                    {selectedRankedMatch.team2?.map((player, idx) => {
                      // Safe username with fallback
                      const safeUsername = player?.username || 'Joueur';
                      
                      // Build avatar URL: custom upload > discord > default
                      let playerAvatar = null;
                      try {
                        playerAvatar = player?.avatarUrl ? getAvatarUrl(player.avatarUrl) : null;
                        if (!playerAvatar && player?.discordId && player?.discordAvatar) {
                          playerAvatar = `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png`;
                        }
                        if (!playerAvatar) {
                          playerAvatar = getDefaultAvatar(safeUsername);
                        }
                      } catch (e) {
                        playerAvatar = '/avatar.jpg';
                      }
                      
                      return (
                        <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg bg-dark-800/50">
                          <img 
                            src={playerAvatar}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover"
                            onError={(e) => { e.target.src = '/avatar.jpg'; }}
                          />
                          <div className="flex-1 min-w-0">
                            {player?.userId ? (
                              <Link 
                                to={`/player/${player.userId}`}
                                className="text-white hover:text-purple-400 transition-colors font-medium text-sm truncate block"
                              >
                                {safeUsername}
                              </Link>
                            ) : (
                              <span className="text-white font-medium text-sm truncate block">
                                {safeUsername}
                              </span>
                            )}
                          </div>
                          {selectedRankedMatch.playerTeam === 2 && player?.userId === playerId && (
                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                              {language === 'fr' ? 'Ce joueur' : 'This player'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Rewards Summary */}
              {selectedRankedMatch.rewards && (
                <div className="mt-6 p-4 rounded-xl bg-dark-800/50 border border-white/10">
                  <h4 className="text-sm font-bold text-gray-400 mb-3">
                    {language === 'fr' ? 'Récompenses' : 'Rewards'}
                  </h4>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className={`w-4 h-4 ${selectedRankedMatch.rewards.pointsChange >= 0 ? 'text-green-400' : 'text-red-400'}`} />
                      <span className={`text-sm font-semibold ${selectedRankedMatch.rewards.pointsChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {selectedRankedMatch.rewards.pointsChange >= 0 ? '+' : ''}{selectedRankedMatch.rewards.pointsChange} pts
                      </span>
                    </div>
                    {selectedRankedMatch.rewards.goldEarned > 0 && (
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm font-semibold text-yellow-400">
                          +{selectedRankedMatch.rewards.goldEarned} gold
                        </span>
                      </div>
                    )}
                    {selectedRankedMatch.rewards.xpEarned > 0 && (
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm font-semibold text-cyan-400">
                          +{selectedRankedMatch.rewards.xpEarned} XP
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerProfile;
