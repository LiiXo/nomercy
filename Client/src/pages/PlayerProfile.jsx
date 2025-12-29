import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { ArrowLeft, Trophy, Medal, Target, TrendingUp, Gamepad2, Crown, Loader2, AlertCircle, Shield, Monitor, Copy, Check, Users, Swords, Clock } from 'lucide-react';

import { getAvatarUrl, getDefaultAvatar } from '../utils/avatar';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const PlayerProfile = () => {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { selectedMode } = useMode();

  const isHardcore = selectedMode === 'hardcore';
  const accentColor = isHardcore ? 'red' : 'cyan';
  const gradientFrom = isHardcore ? 'from-red-500' : 'from-cyan-400';
  const gradientTo = isHardcore ? 'to-orange-600' : 'to-cyan-600';

  // States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playerData, setPlayerData] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [squad, setSquad] = useState(null);
  const [copied, setCopied] = useState(false);
  const [matchHistory, setMatchHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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
      wins: 'Victoires',
      losses: 'Défaites',
      winRate: 'Win Rate',
      totalWins: 'Victoires Totales',
      totalLosses: 'Défaites Totales',
      totalWinRate: 'Ratio de Victoire',
      notRanked: 'Pas encore classé dans ce mode',
      winStreak: 'victoires consécutives',
      best: 'Record',
      matchHistory: 'Historique des matchs',
      noMatches: 'Aucun match joué',
      victory: 'Victoire',
      defeat: 'Défaite',
      vs: 'vs',
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
      wins: 'Wins',
      losses: 'Losses',
      winRate: 'Win Rate',
      totalWins: 'Total Wins',
      totalLosses: 'Total Losses',
      totalWinRate: 'Win Ratio',
      notRanked: 'Not ranked in this mode yet',
      winStreak: 'win streak',
      matchHistory: 'Match History',
      noMatches: 'No matches played',
      victory: 'Victory',
      defeat: 'Defeat',
      vs: 'vs',
      best: 'Best',
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
      wins: 'Siege',
      losses: 'Niederlagen',
      winRate: 'Siegquote',
      totalWins: 'Gesamtsiege',
      totalLosses: 'Gesamtniederlagen',
      totalWinRate: 'Siegverhältnis',
      notRanked: 'In diesem Modus noch nicht platziert',
      winStreak: 'Siegesserie',
      best: 'Rekord',
      matchHistory: 'Spielverlauf',
      noMatches: 'Keine Spiele gespielt',
      victory: 'Sieg',
      defeat: 'Niederlage',
      vs: 'vs',
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
      wins: 'Vittorie',
      losses: 'Sconfitte',
      winRate: 'Win Rate',
      totalWins: 'Vittorie Totali',
      totalLosses: 'Sconfitte Totali',
      totalWinRate: 'Rapporto Vittorie',
      notRanked: 'Non ancora classificato in questa modalità',
      winStreak: 'serie di vittorie',
      best: 'Record',
      matchHistory: 'Cronologia partite',
      noMatches: 'Nessuna partita giocata',
      victory: 'Vittoria',
      defeat: 'Sconfitta',
      vs: 'vs',
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
        
        // Fetch ranking for current mode
        try {
          const rankingResponse = await fetch(`${API_URL}/rankings/user/${userData.user.id}/${selectedMode}`);
          const rankingData = await rankingResponse.json();
          if (rankingData.success) {
            setRanking(rankingData.ranking);
          }
        } catch (err) {
          console.error('Error fetching ranking:', err);
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
        const response = await fetch(`${API_URL}/matches/player-history/${playerData.id}?limit=5`);
        const data = await response.json();
        if (data.success) {
          setMatchHistory(data.matches);
        }
      } catch (err) {
        console.error('Error fetching match history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchMatchHistory();
  }, [playerData?.id]);

  // Get player stats (global stats)
  const getPlayerStats = () => {
    const userStats = playerData?.stats || { points: 0, wins: 0, losses: 0 };
    
    // Use global user stats
    return {
      points: userStats.points || 0,
      wins: userStats.wins || 0,
      losses: userStats.losses || 0,
      rank: userStats.rank || ranking?.rank || 999
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

  // Calculate total win rate
  const getTotalWinRate = () => {
    if (!playerData?.totalStats) return '0%';
    const total = playerData.totalStats.wins + playerData.totalStats.losses;
    if (total === 0) return '0%';
    return `${Math.round((playerData.totalStats.wins / total) * 100)}%`;
  };

  // Get rank for ornament (use ranking.rank from DB)
  const playerRank = playerStats?.rank || 999;

  // Get division based on points
  const getDivision = (points) => {
    if (points >= 3500) return { name: 'Champion', color: 'from-yellow-400 to-amber-500', textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-500/50', icon: '👑' };
    if (points >= 3000) return { name: 'Grandmaster', color: 'from-red-500 to-rose-600', textColor: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/50', icon: '🔥' };
    if (points >= 2500) return { name: 'Master', color: 'from-purple-500 to-violet-600', textColor: 'text-purple-400', bgColor: 'bg-purple-500/20', borderColor: 'border-purple-500/50', icon: '💎' };
    if (points >= 2000) return { name: 'Diamond', color: 'from-cyan-400 to-blue-500', textColor: 'text-cyan-400', bgColor: 'bg-cyan-500/20', borderColor: 'border-cyan-500/50', icon: '💠' };
    if (points >= 1500) return { name: 'Platinum', color: 'from-teal-400 to-emerald-500', textColor: 'text-teal-400', bgColor: 'bg-teal-500/20', borderColor: 'border-teal-500/50', icon: '🏅' };
    if (points >= 1000) return { name: 'Gold', color: 'from-yellow-500 to-amber-600', textColor: 'text-yellow-500', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-500/50', icon: '🥇' };
    if (points >= 500) return { name: 'Silver', color: 'from-gray-300 to-gray-400', textColor: 'text-gray-300', bgColor: 'bg-gray-500/20', borderColor: 'border-gray-500/50', icon: '🥈' };
    return { name: 'Bronze', color: 'from-orange-600 to-amber-700', textColor: 'text-orange-400', bgColor: 'bg-orange-500/20', borderColor: 'border-orange-500/50', icon: '🥉' };
  };

  const division = playerStats ? getDivision(playerStats.points) : null;

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

          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-${accentColor}-500/20 overflow-hidden mb-6`}>
          {/* Banner */}
          {playerData.banner && (
            <div className="w-full h-48 relative overflow-hidden">
              <img 
                src={`https://api-nomercy.ggsecure.io${playerData.banner}`}
                alt="Profile banner"
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-dark-900/80"></div>
            </div>
          )}
          
          <div className="p-8">
          <div className="flex flex-col items-center text-center">
              {/* Avatar simple */}
              <div className="relative group mb-6">
                <div className={`relative w-40 h-40 rounded-full border-4 ${
                  isHardcore ? 'border-red-500/50' : 'border-cyan-500/50'
                } bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center text-5xl font-bold text-dark-950 overflow-hidden transition-all duration-300 group-hover:scale-105`} 
                  style={{ 
                    backgroundImage: playerData.avatar ? `url(${getAvatarUrl(playerData.avatar)})` : 'none', 
                    backgroundSize: 'cover', 
                    backgroundPosition: 'center',
                  }}>
                  {!playerData.avatar && <span>{(playerData.username || playerData.discordUsername)?.charAt(0).toUpperCase()}</span>}
                </div>
              </div>
              
              <h1 className="text-3xl font-bold text-white mb-5">{playerData.username || playerData.discordUsername || 'Utilisateur'}</h1>
              
              <div className="flex flex-wrap items-center justify-center gap-3 text-sm mb-4">
                {playerStats && playerStats.points > 0 && (
                  <span className={`px-3 py-1.5 bg-${accentColor}-500/20 border border-${accentColor}-500/30 rounded-lg text-${accentColor}-400 font-medium`}>
                    {playerStats.points} pts
                  </span>
                )}
                {squad && (
                  <Link
                    to={`/squad/${squad.id || squad._id}`}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white font-medium hover:bg-white/10 hover:border-white/20 transition-colors"
                  >
                    <div 
                      className="w-5 h-5 rounded flex items-center justify-center"
                      style={{ backgroundColor: squad.color + '40', borderColor: squad.color }}
                    >
                      <Users className="w-3 h-3" style={{ color: squad.color }} />
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
                {division && (
                  <span className={`flex items-center space-x-1.5 px-3 py-1.5 ${division.bgColor} border ${division.borderColor} rounded-lg`}>
                    <span className="text-base">{division.icon}</span>
                    <span className={`${division.textColor} font-bold`}>{division.name}</span>
                </span>
                )}
              </div>
              
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

          {/* Total Stats (all modes combined) */}
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-${accentColor}-500/20 p-6 mb-6`}>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
              <Trophy className={`w-5 h-5 ${isHardcore ? 'text-red-400' : 'text-cyan-400'}`} />
              <span>{t.totalStatistics}</span>
            </h2>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-dark-800/50 rounded-lg p-4 text-center border border-white/5 hover:border-green-500/30 transition-colors">
                <Medal className="w-5 h-5 text-green-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-400">{playerData?.totalStats?.wins || 0}</div>
                <div className="text-gray-500 text-xs">{t.totalWins}</div>
              </div>
              <div className="bg-dark-800/50 rounded-lg p-4 text-center border border-white/5 hover:border-red-500/30 transition-colors">
                <Target className="w-5 h-5 text-red-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-red-400">{playerData?.totalStats?.losses || 0}</div>
                <div className="text-gray-500 text-xs">{t.totalLosses}</div>
              </div>
              <div className={`bg-dark-800/50 rounded-lg p-4 text-center border border-white/5 hover:border-${accentColor}-500/30 transition-colors`}>
                <TrendingUp className={`w-5 h-5 ${isHardcore ? 'text-red-400' : 'text-cyan-400'} mx-auto mb-2`} />
                <div className={`text-2xl font-bold ${isHardcore ? 'text-red-400' : 'text-cyan-400'}`}>{getTotalWinRate()}</div>
                <div className="text-gray-500 text-xs">{t.totalWinRate}</div>
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

          {/* Match History */}
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-${accentColor}-500/20 p-6`}>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
              <Swords className={`w-5 h-5 ${isHardcore ? 'text-red-400' : 'text-cyan-400'}`} />
              <span>{t.matchHistory}</span>
          </h2>
            
            {loadingHistory ? (
              <div className="flex justify-center py-8">
                <Loader2 className={`w-8 h-8 animate-spin ${isHardcore ? 'text-red-400' : 'text-cyan-400'}`} />
              </div>
            ) : matchHistory.length > 0 ? (
            <div className="space-y-3">
                {matchHistory.map((match) => {
                  const isWinner = match.playerResult === 'win';
                  const playerSquadId = match.playerSquad?._id;
                  const opponent = playerSquadId === match.challenger?._id ? match.opponent : match.challenger;
                  
                  return (
                    <div 
                      key={match._id}
                      className={`flex items-center justify-between p-3 bg-dark-800/50 rounded-lg border ${
                        isWinner 
                          ? 'border-green-500/30' 
                          : 'border-red-500/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`px-2 py-0.5 rounded text-xs font-bold ${
                          isWinner 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {isWinner ? t.victory : t.defeat}
                        </div>
                        
                        <span className={`px-2 py-0.5 bg-${accentColor}-500/20 rounded text-xs text-${accentColor}-400`}>
                          {match.gameMode}
                        </span>
                        
                        <div className="flex items-center gap-1 text-gray-400 text-xs">
                          <Users className="w-3 h-3" />
                          <span>{match.teamSize}v{match.teamSize}</span>
                        </div>
                        
                        {opponent && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500 text-sm">{t.vs}</span>
                            <Link 
                              to={`/squad/${opponent._id}`}
                              className="text-white hover:text-yellow-400 transition-colors text-sm font-medium"
                            >
                              {opponent.name}
                            </Link>
                          </div>
                        )}
                  </div>

                      <div className="flex items-center gap-1 text-gray-500 text-xs">
                        <Clock className="w-3 h-3" />
                        <span>
                          {new Date(match.createdAt).toLocaleDateString(
                            language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : language === 'it' ? 'it-IT' : 'en-US',
                            { day: 'numeric', month: 'short' }
                          )}
                        </span>
                </div>
                  </div>
                  );
                })}
                </div>
            ) : (
              <div className="text-center py-8">
                <Swords className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">{t.noMatches}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerProfile;
