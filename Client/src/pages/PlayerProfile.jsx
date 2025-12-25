import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { ArrowLeft, Trophy, Medal, Target, TrendingUp, Gamepad2, Crown, Loader2, AlertCircle, Shield, Monitor, Copy, Check, Users, Swords, Clock } from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const PlayerProfile = () => {
  const { playerName } = useParams();
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
      points: 'Points',
      wins: 'Victoires',
      losses: 'Défaites',
      winRate: 'Win Rate',
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
      points: 'Points',
      wins: 'Wins',
      losses: 'Losses',
      winRate: 'Win Rate',
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
      points: 'Punkte',
      wins: 'Siege',
      losses: 'Niederlagen',
      winRate: 'Siegquote',
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
      points: 'Punti',
      wins: 'Vittorie',
      losses: 'Sconfitte',
      winRate: 'Win Rate',
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
    document.title = `NoMercy - ${prefix} ${playerName}`;
  }, [playerName, language]);

  // Fetch player data
  useEffect(() => {
    const fetchPlayerData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch user profile
        const userResponse = await fetch(`${API_URL}/users/profile/${encodeURIComponent(playerName)}`);
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
          const squadResponse = await fetch(`${API_URL}/users/profile/${encodeURIComponent(playerName)}/squad`);
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
    
    if (playerName) {
      fetchPlayerData();
    }
  }, [playerName, selectedMode, language]);

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

          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-${accentColor}-500/20 p-8 mb-6`}>
          <div className="flex flex-col items-center text-center">
              {/* Avatar avec ornement selon le rang */}
              <div className="relative group" style={{ marginTop: '30px', marginBottom: '60px' }}>
                {/* Ornement spécifique selon le rang */}
                {playerRank === 1 && (
                  <>
                    {/* ORNEMENT OR - PREMIER DU CLASSEMENT */}
                    <div className="absolute inset-0 bg-yellow-500/40 blur-3xl rounded-full animate-pulse-slow"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 blur-2xl rounded-full opacity-30 animate-spin-slow" style={{ animationDuration: '25s' }}></div>
                    
                    <div className="absolute inset-0 w-60 h-60 -left-10 -top-10 animate-spin-slow" style={{ animationDuration: '20s' }}>
                      {[...Array(12)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-1 h-24 bg-gradient-to-t from-yellow-500/60 via-amber-400/30 to-transparent"
                style={{
                            left: '50%',
                            top: '50%',
                            transformOrigin: 'center',
                            transform: `rotate(${i * 30}deg) translateY(-60px)`,
                          }}
                        />
                      ))}
                    </div>
                    
                    <div className="absolute inset-0 w-52 h-52 -left-6 -top-6 animate-spin-slow" style={{ animationDuration: '15s' }}>
                      <div className="absolute inset-0 rounded-full border-2 border-yellow-400/50"></div>
                      <div className="absolute inset-3 rounded-full border border-amber-500/40 animate-pulse-slow"></div>
                      <div className="absolute inset-6 rounded-full border-2 border-dashed border-yellow-300/30"></div>
                    </div>
                    
                    <div className="absolute inset-0 w-52 h-52 -left-6 -top-6 animate-spin-slow" style={{ animationDuration: '12s' }}>
                      {[...Array(8)].map((_, i) => {
                        const angle = (i * 45 * Math.PI) / 180;
                        const radius = 104;
                        const x = radius + radius * Math.cos(angle);
                        const y = radius + radius * Math.sin(angle);
                        return (
                          <div key={i} className="absolute" style={{ left: `${x}px`, top: `${y}px` }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="animate-particle-float" style={{ animationDelay: `${i * 0.15}s` }}>
                              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" filter="drop-shadow(0 0 6px rgba(251, 191, 36, 0.8))" />
                            </svg>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="absolute -inset-5 pointer-events-none">
                      <div className="absolute -top-3 -left-3 w-12 h-12 border-t-4 border-l-4 border-yellow-400 rounded-tl-xl animate-corner-glow">
                        <div className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-yellow-400 rounded-full animate-pulse-glow" style={{ boxShadow: '0 0 20px rgba(251, 191, 36, 0.8)' }}></div>
                      </div>
                      <div className="absolute -top-3 -right-3 w-12 h-12 border-t-4 border-r-4 border-yellow-400 rounded-tr-xl animate-corner-glow" style={{ animationDelay: '0.5s' }}>
                        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-yellow-400 rounded-full animate-pulse-glow" style={{ animationDelay: '0.5s', boxShadow: '0 0 20px rgba(251, 191, 36, 0.8)' }}></div>
                      </div>
                      <div className="absolute -bottom-3 -left-3 w-12 h-12 border-b-4 border-l-4 border-yellow-400 rounded-bl-xl animate-corner-glow" style={{ animationDelay: '1s' }}>
                        <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 bg-yellow-400 rounded-full animate-pulse-glow" style={{ animationDelay: '1s', boxShadow: '0 0 20px rgba(251, 191, 36, 0.8)' }}></div>
                      </div>
                      <div className="absolute -bottom-3 -right-3 w-12 h-12 border-b-4 border-r-4 border-yellow-400 rounded-br-xl animate-corner-glow" style={{ animationDelay: '1.5s' }}>
                        <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-yellow-400 rounded-full animate-pulse-glow" style={{ animationDelay: '1.5s', boxShadow: '0 0 20px rgba(251, 191, 36, 0.8)' }}></div>
                      </div>
                    </div>
                    
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 animate-float">
                      <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" filter="drop-shadow(0 0 10px rgba(251, 191, 36, 0.9))" />
                      </svg>
                    </div>
                  </>
                )}
                
                {playerRank === 2 && (
                  <>
                    {/* ORNEMENT ARGENT - DEUXIÈME DU CLASSEMENT */}
                    <div className="absolute inset-0 bg-gray-400/30 blur-3xl rounded-full animate-pulse-slow"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-300 via-gray-400 to-gray-300 blur-2xl rounded-full opacity-25 animate-spin-slow" style={{ animationDuration: '25s' }}></div>
                    
                    <div className="absolute inset-0 w-52 h-52 -left-6 -top-6 animate-spin-slow" style={{ animationDuration: '18s' }}>
                      <div className="absolute inset-0 rounded-full border-2 border-gray-400/50"></div>
                      <div className="absolute inset-3 rounded-full border border-gray-300/40 animate-pulse-slow"></div>
                      <div className="absolute inset-6 rounded-full border border-dashed border-gray-400/30"></div>
                    </div>
                    
                    <div className="absolute inset-0 w-52 h-52 -left-6 -top-6 animate-spin-slow" style={{ animationDuration: '15s' }}>
                      {[...Array(8)].map((_, i) => {
                        const angle = (i * 45 * Math.PI) / 180;
                        const radius = 104;
                        const x = radius + radius * Math.cos(angle);
                        const y = radius + radius * Math.sin(angle);
                        return (
                          <div
                            key={i}
                            className="absolute w-3.5 h-3.5 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full shadow-lg animate-particle-float"
                            style={{
                              left: `${x}px`,
                              top: `${y}px`,
                              boxShadow: '0 0 15px rgba(209, 213, 219, 0.8)',
                              animationDelay: `${i * 0.2}s`,
                            }}
                          />
                        );
                      })}
                    </div>
                    
                    <div className="absolute -inset-4 pointer-events-none">
                      <div className="absolute -top-2 -left-2 w-11 h-11 border-t-4 border-l-4 border-gray-300 rounded-tl-lg animate-corner-glow">
                        <div className="absolute -top-1 -left-1 w-4 h-4 bg-gray-300 rounded-full animate-pulse-glow" style={{ boxShadow: '0 0 15px rgba(209, 213, 219, 0.7)' }}></div>
                      </div>
                      <div className="absolute -top-2 -right-2 w-11 h-11 border-t-4 border-r-4 border-gray-300 rounded-tr-lg animate-corner-glow" style={{ animationDelay: '0.5s' }}>
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-gray-300 rounded-full animate-pulse-glow" style={{ animationDelay: '0.5s', boxShadow: '0 0 15px rgba(209, 213, 219, 0.7)' }}></div>
                      </div>
                      <div className="absolute -bottom-2 -left-2 w-11 h-11 border-b-4 border-l-4 border-gray-300 rounded-bl-lg animate-corner-glow" style={{ animationDelay: '1s' }}>
                        <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-gray-300 rounded-full animate-pulse-glow" style={{ animationDelay: '1s', boxShadow: '0 0 15px rgba(209, 213, 219, 0.7)' }}></div>
                      </div>
                      <div className="absolute -bottom-2 -right-2 w-11 h-11 border-b-4 border-r-4 border-gray-300 rounded-br-lg animate-corner-glow" style={{ animationDelay: '1.5s' }}>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gray-300 rounded-full animate-pulse-glow" style={{ animationDelay: '1.5s', boxShadow: '0 0 15px rgba(209, 213, 219, 0.7)' }}></div>
              </div>
            </div>
            
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-gray-300 to-gray-400 rounded-full shadow-lg animate-float">
                      <span className="text-dark-950 text-base font-bold">#2</span>
                    </div>
                  </>
                )}
                
                {playerRank === 3 && (
                  <>
                    {/* ORNEMENT BRONZE - TROISIÈME DU CLASSEMENT */}
                    <div className="absolute inset-0 bg-orange-700/30 blur-3xl rounded-full animate-pulse-slow"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-600 via-amber-700 to-orange-600 blur-2xl rounded-full opacity-25 animate-spin-slow" style={{ animationDuration: '25s' }}></div>
                    
                    <div className="absolute inset-0 w-52 h-52 -left-6 -top-6 animate-spin-slow" style={{ animationDuration: '18s' }}>
                      <div className="absolute inset-0 rounded-full border-2 border-orange-600/50"></div>
                      <div className="absolute inset-3 rounded-full border border-amber-700/40 animate-pulse-slow"></div>
                      <div className="absolute inset-6 rounded-full border border-dashed border-orange-500/30"></div>
                    </div>
                    
                    <div className="absolute inset-0 w-52 h-52 -left-6 -top-6 animate-spin-slow" style={{ animationDuration: '15s' }}>
                      {[...Array(8)].map((_, i) => {
                        const angle = (i * 45 * Math.PI) / 180;
                        const radius = 104;
                        const x = radius + radius * Math.cos(angle);
                        const y = radius + radius * Math.sin(angle);
                        return (
                          <div
                            key={i}
                            className="absolute w-3 h-3 bg-gradient-to-br from-orange-500 to-amber-700 rounded-full shadow-lg animate-particle-float"
                            style={{
                              left: `${x}px`,
                              top: `${y}px`,
                              boxShadow: '0 0 12px rgba(234, 88, 12, 0.7)',
                              animationDelay: `${i * 0.2}s`,
                            }}
                          />
                        );
                      })}
                    </div>
                    
                    <div className="absolute -inset-4 pointer-events-none">
                      <div className="absolute -top-2 -left-2 w-10 h-10 border-t-4 border-l-4 border-orange-600 rounded-tl-lg animate-corner-glow">
                        <div className="absolute -top-1 -left-1 w-3.5 h-3.5 bg-orange-600 rounded-full animate-pulse-glow" style={{ boxShadow: '0 0 12px rgba(234, 88, 12, 0.7)' }}></div>
                      </div>
                      <div className="absolute -top-2 -right-2 w-10 h-10 border-t-4 border-r-4 border-orange-600 rounded-tr-lg animate-corner-glow" style={{ animationDelay: '0.5s' }}>
                        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-orange-600 rounded-full animate-pulse-glow" style={{ animationDelay: '0.5s', boxShadow: '0 0 12px rgba(234, 88, 12, 0.7)' }}></div>
                      </div>
                      <div className="absolute -bottom-2 -left-2 w-10 h-10 border-b-4 border-l-4 border-orange-600 rounded-bl-lg animate-corner-glow" style={{ animationDelay: '1s' }}>
                        <div className="absolute -bottom-1 -left-1 w-3.5 h-3.5 bg-orange-600 rounded-full animate-pulse-glow" style={{ animationDelay: '1s', boxShadow: '0 0 12px rgba(234, 88, 12, 0.7)' }}></div>
                      </div>
                      <div className="absolute -bottom-2 -right-2 w-10 h-10 border-b-4 border-r-4 border-orange-600 rounded-br-lg animate-corner-glow" style={{ animationDelay: '1.5s' }}>
                        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-orange-600 rounded-full animate-pulse-glow" style={{ animationDelay: '1.5s', boxShadow: '0 0 12px rgba(234, 88, 12, 0.7)' }}></div>
                      </div>
                    </div>
                    
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-orange-600 to-amber-700 rounded-full shadow-lg animate-float">
                      <span className="text-white text-base font-bold">#3</span>
                    </div>
                  </>
                )}
                
                {playerRank > 3 && (
                  <>
                    {/* ORNEMENT STANDARD - Autres positions */}
                    <div className={`absolute inset-0 bg-${accentColor}-500/30 blur-3xl rounded-full animate-pulse-slow`}></div>
                    <div className={`absolute inset-0 bg-gradient-to-r ${gradientFrom} ${gradientTo} blur-2xl rounded-full opacity-20 animate-spin-slow`} style={{ animationDuration: '25s' }}></div>
                
                <div className="absolute inset-0 w-52 h-52 -left-6 -top-6 animate-spin-slow" style={{ animationDuration: '20s' }}>
                  <div className={`absolute inset-0 rounded-full border-2 border-dashed border-${accentColor}-500/30`}></div>
                  <div className={`absolute inset-4 rounded-full border border-${accentColor}-500/40 animate-pulse-slow`}></div>
                </div>
                
                <div className="absolute inset-0 w-52 h-52 -left-6 -top-6 animate-spin-slow" style={{ animationDuration: '15s' }}>
                  {[...Array(8)].map((_, i) => {
                    const angle = (i * 45 * Math.PI) / 180;
                    const radius = 104;
                    const x = radius + radius * Math.cos(angle);
                    const y = radius + radius * Math.sin(angle);
                    return (
                      <div
                        key={i}
                        className={`absolute w-3 h-3 bg-gradient-to-br ${gradientFrom} ${gradientTo} rounded-full shadow-lg animate-particle-float`}
                        style={{
                          left: `${x}px`,
                          top: `${y}px`,
                          boxShadow: isHardcore 
                            ? '0 0 15px rgba(239, 68, 68, 0.9), 0 0 25px rgba(249, 115, 22, 0.5)'
                            : '0 0 15px rgba(6, 182, 212, 0.9), 0 0 25px rgba(34, 211, 238, 0.5)',
                          animationDelay: `${i * 0.2}s`,
                        }}
                      />
                    );
                  })}
                </div>
                
                <div className="absolute -inset-4 pointer-events-none">
                  <div className={`absolute -top-2 -left-2 w-10 h-10 border-t-4 border-l-4 border-${accentColor}-400 rounded-tl-lg animate-corner-glow`}>
                    <div className={`absolute -top-1 -left-1 w-3.5 h-3.5 bg-${accentColor}-400 rounded-full animate-pulse-glow`}></div>
                  </div>
                  <div className={`absolute -top-2 -right-2 w-10 h-10 border-t-4 border-r-4 border-${accentColor}-400 rounded-tr-lg animate-corner-glow`} style={{ animationDelay: '0.5s' }}>
                    <div className={`absolute -top-1 -right-1 w-3.5 h-3.5 bg-${accentColor}-400 rounded-full animate-pulse-glow`} style={{ animationDelay: '0.5s' }}></div>
                  </div>
                  <div className={`absolute -bottom-2 -left-2 w-10 h-10 border-b-4 border-l-4 border-${accentColor}-400 rounded-bl-lg animate-corner-glow`} style={{ animationDelay: '1s' }}>
                    <div className={`absolute -bottom-1 -left-1 w-3.5 h-3.5 bg-${accentColor}-400 rounded-full animate-pulse-glow`} style={{ animationDelay: '1s' }}></div>
                  </div>
                  <div className={`absolute -bottom-2 -right-2 w-10 h-10 border-b-4 border-r-4 border-${accentColor}-400 rounded-br-lg animate-corner-glow`} style={{ animationDelay: '1.5s' }}>
                    <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-${accentColor}-400 rounded-full animate-pulse-glow`} style={{ animationDelay: '1.5s' }}></div>
                  </div>
                </div>
                  </>
                )}
                
                {/* Avatar principal */}
                <div className="relative">
                  <div className={`relative w-40 h-40 rounded-full border-4 ${
                    playerRank === 1 ? 'border-yellow-400/90' :
                    playerRank === 2 ? 'border-gray-300/90' :
                    playerRank === 3 ? 'border-orange-600/90' :
                    isHardcore ? 'border-red-500/70' : 'border-cyan-500/70'
                  } bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center text-5xl font-bold text-dark-950 overflow-hidden transition-all duration-300 group-hover:scale-105`} 
                    style={{ 
                      backgroundImage: playerData.avatar ? `url(${playerData.avatar})` : 'none', 
                      backgroundSize: 'cover', 
                      backgroundPosition: 'center',
                      boxShadow: playerRank === 1 
                        ? '0 0 50px rgba(251, 191, 36, 0.7), inset 0 0 30px rgba(245, 158, 11, 0.3)'
                        : playerRank === 2
                        ? '0 0 45px rgba(209, 213, 219, 0.6), inset 0 0 25px rgba(156, 163, 175, 0.3)'
                        : playerRank === 3
                        ? '0 0 45px rgba(234, 88, 12, 0.6), inset 0 0 25px rgba(180, 83, 9, 0.3)'
                        : isHardcore 
                        ? '0 0 40px rgba(239, 68, 68, 0.5), inset 0 0 25px rgba(249, 115, 22, 0.2)'
                        : '0 0 40px rgba(6, 182, 212, 0.5), inset 0 0 25px rgba(34, 211, 238, 0.2)',
                    }}>
                    {!playerData.avatar && <span>{playerData.username?.charAt(0).toUpperCase()}</span>}
              </div>
              
                  {/* Badge de rang */}
                  {ranking && (
                    <>
                      {playerRank === 1 && (
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 rounded-full flex items-center space-x-1.5 shadow-lg animate-bounce-subtle" style={{ boxShadow: '0 0 25px rgba(251, 191, 36, 0.8), 0 4px 20px rgba(0, 0, 0, 0.4)' }}>
                      <Crown className="w-4 h-4 text-dark-950" />
                      <span className="text-dark-950 text-sm font-black">#1</span>
                      <Crown className="w-4 h-4 text-dark-950" />
                    </div>
                  )}
                      {playerRank === 2 && (
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 bg-gradient-to-r from-gray-300 to-gray-400 rounded-full flex items-center space-x-1 shadow-lg animate-bounce-subtle" style={{ boxShadow: '0 0 20px rgba(209, 213, 219, 0.7), 0 4px 15px rgba(0, 0, 0, 0.3)' }}>
                      <Crown className="w-3.5 h-3.5 text-dark-950" />
                      <span className="text-dark-950 text-sm font-bold">#2</span>
                    </div>
                  )}
                      {playerRank === 3 && (
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 bg-gradient-to-r from-orange-600 to-amber-700 rounded-full flex items-center space-x-1 shadow-lg animate-bounce-subtle" style={{ boxShadow: '0 0 18px rgba(234, 88, 12, 0.7), 0 4px 15px rgba(0, 0, 0, 0.3)' }}>
                      <Crown className="w-3.5 h-3.5 text-white" />
                      <span className="text-white text-sm font-bold">#3</span>
                    </div>
                  )}
                      {playerRank > 3 && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full flex items-center space-x-1 shadow-lg animate-bounce-subtle" style={{ boxShadow: '0 0 20px rgba(234, 179, 8, 0.6), 0 4px 15px rgba(0, 0, 0, 0.3)' }}>
                      <Crown className="w-3 h-3 text-dark-950" />
                          <span className="text-dark-950 text-xs font-bold">#{playerRank}</span>
                    </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              <h1 className="text-3xl font-bold text-white mb-5">{playerData.username}</h1>
              
              <div className="flex flex-wrap items-center justify-center gap-3 text-sm mb-4">
                {playerStats && playerStats.points > 0 && (
                  <span className={`px-3 py-1.5 bg-${accentColor}-500/20 border border-${accentColor}-500/30 rounded-lg text-${accentColor}-400 font-medium`}>
                    {playerStats.points} pts
                  </span>
                )}
                {squad && (
                  <Link
                    to={`/squad/${squad._id}`}
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

          {/* Stats */}
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-${accentColor}-500/20 p-6 mb-6`}>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
                <TrendingUp className={`w-5 h-5 ${isHardcore ? 'text-red-400' : 'text-cyan-400'}`} />
              <span>{t.statistics} ({isHardcore ? 'Hardcore' : 'CDL'})</span>
              </h2>
            
            {playerStats && (playerStats.wins > 0 || playerStats.losses > 0 || playerStats.points > 0) ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className={`bg-dark-800/50 rounded-lg p-4 text-center border border-white/5 hover:border-${accentColor}-500/30 transition-colors`}>
                  <Trophy className={`w-5 h-5 text-${accentColor}-400 mx-auto mb-2`} />
                  <div className={`text-2xl font-bold text-${accentColor}-400`}>{playerStats.points}</div>
                  <div className="text-gray-500 text-xs">{t.points}</div>
                </div>
                <div className={`bg-dark-800/50 rounded-lg p-4 text-center border border-white/5 hover:border-green-500/30 transition-colors`}>
                  <Medal className="w-5 h-5 text-green-400 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-green-400">{playerStats.wins}</div>
                  <div className="text-gray-500 text-xs">{t.wins}</div>
                </div>
                <div className={`bg-dark-800/50 rounded-lg p-4 text-center border border-white/5 hover:border-red-500/30 transition-colors`}>
                  <Target className="w-5 h-5 text-red-400 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-red-400">{playerStats.losses}</div>
                  <div className="text-gray-500 text-xs">{t.losses}</div>
                </div>
                <div className={`bg-dark-800/50 rounded-lg p-4 text-center border border-white/5 hover:border-yellow-500/30 transition-colors`}>
                  <TrendingUp className="w-5 h-5 text-yellow-400 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-yellow-400">{getWinRate()}</div>
                  <div className="text-gray-500 text-xs">{t.winRate}</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Shield className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">
                  {t.notRanked}
                </p>
              </div>
            )}
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
