import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { 
  ArrowLeft, Clock, Trophy, Loader2, Star, 
  Swords, Calendar, Timer, ChevronDown, ChevronUp
} from 'lucide-react';

import { API_URL, UPLOADS_BASE_URL } from '../config';

const RecentRankedMatches = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedMatches, setExpandedMatches] = useState({});

  const isHardcore = selectedMode === 'hardcore';
  const accent = isHardcore ? 'red' : 'cyan';

  const translations = {
    fr: {
      title: 'Derniers matchs classés',
      subtitle: 'Les 30 matchs les plus récents',
      back: 'Retour',
      noMatches: 'Aucun match récent',
      noMatchesDesc: 'Les matchs classés terminés apparaîtront ici.',
      team1: 'Équipe 1',
      team2: 'Équipe 2',
      winner: 'Vainqueur',
      host: 'Hôte',
      referent: 'Réf.',
      players: 'joueurs',
      min: 'min',
      vs: 'VS',
      hardcore: 'Hardcore',
      cdl: 'CDL',
      loading: 'Chargement...',
      error: 'Erreur lors du chargement',
      retry: 'Réessayer',
      noPlayers: 'Aucun joueur',
    },
    en: {
      title: 'Recent Ranked Matches',
      subtitle: 'Last 30 matches',
      back: 'Back',
      noMatches: 'No recent matches',
      noMatchesDesc: 'Completed ranked matches will appear here.',
      team1: 'Team 1',
      team2: 'Team 2',
      winner: 'Winner',
      host: 'Host',
      referent: 'Ref.',
      players: 'players',
      min: 'min',
      vs: 'VS',
      hardcore: 'Hardcore',
      cdl: 'CDL',
      loading: 'Loading...',
      error: 'Error loading matches',
      retry: 'Retry',
      noPlayers: 'No players',
    },
    de: {
      title: 'Letzte Ranglistenspiele',
      subtitle: 'Die letzten 30 Spiele',
      back: 'Zurück',
      noMatches: 'Keine kürzlichen Spiele',
      noMatchesDesc: 'Abgeschlossene Ranglistenspiele werden hier angezeigt.',
      team1: 'Team 1',
      team2: 'Team 2',
      winner: 'Gewinner',
      host: 'Host',
      referent: 'Ref.',
      players: 'Spieler',
      min: 'min',
      vs: 'VS',
      hardcore: 'Hardcore',
      cdl: 'CDL',
      loading: 'Laden...',
      error: 'Fehler beim Laden',
      retry: 'Erneut versuchen',
      noPlayers: 'Keine Spieler',
    },
    it: {
      title: 'Partite classificate recenti',
      subtitle: 'Le ultime 30 partite',
      back: 'Indietro',
      noMatches: 'Nessuna partita recente',
      noMatchesDesc: 'Le partite classificate completate appariranno qui.',
      team1: 'Squadra 1',
      team2: 'Squadra 2',
      winner: 'Vincitore',
      host: 'Host',
      referent: 'Ref.',
      players: 'giocatori',
      min: 'min',
      vs: 'VS',
      hardcore: 'Hardcore',
      cdl: 'CDL',
      loading: 'Caricamento...',
      error: 'Errore durante il caricamento',
      retry: 'Riprova',
      noPlayers: 'Nessun giocatore',
    }
  };

  const t = translations[language] || translations.en;

  const fetchMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/ranked-matches/history/recent?mode=${selectedMode}&limit=30`);
      const data = await response.json();
      console.log('API Response:', data);
      if (data.success) {
        setMatches(data.matches || []);
      } else {
        setError(data.message || t.error);
      }
    } catch (err) {
      console.error('Error fetching recent matches:', err);
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [selectedMode]);

  const toggleExpand = (matchId) => {
    setExpandedMatches(prev => ({
      ...prev,
      [matchId]: !prev[matchId]
    }));
  };

  const formatDateTime = (date) => {
    if (!date) return { date: '-', time: '-' };
    const d = new Date(date);
    const locale = language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : language === 'it' ? 'it-IT' : 'en-US';
    return {
      date: d.toLocaleDateString(locale, { day: '2-digit', month: 'short' }),
      time: d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getDuration = (start, end) => {
    if (!start || !end) return null;
    return Math.round((new Date(end) - new Date(start)) / 60000);
  };

  const getAvatarUrl = (player, index) => {
    // Priorité: avatar personnalisé > avatar Discord
    if (player?.avatarUrl) {
      if (player.avatarUrl.startsWith('http')) return player.avatarUrl;
      return `${UPLOADS_BASE_URL}${player.avatarUrl}`;
    }
    if (player?.discordId && player?.discordAvatar) {
      return `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png`;
    }
    return `https://cdn.discordapp.com/embed/avatars/${index % 5}.png`;
  };

  return (
    <div className="min-h-screen bg-dark-950 relative">
      {isHardcore ? (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 20% 20%, rgba(239, 68, 68, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(249, 115, 22, 0.05) 0%, transparent 50%)' }}></div>
      ) : (
        <div className="absolute inset-0 bg-mesh pointer-events-none"></div>
      )}
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-30"></div>

      <div className="relative z-10 py-4 sm:py-8">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <button 
              onClick={() => navigate(-1)} 
              className={`flex items-center space-x-2 text-gray-400 hover:text-${accent}-400 transition-colors group`}
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span>{t.back}</span>
            </button>
            
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              isHardcore 
                ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
            }`}>
              {isHardcore ? t.hardcore : t.cdl}
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Clock className={`w-8 h-8 text-${accent}-400`} />
              <h1 className="text-3xl sm:text-4xl font-bold text-white">{t.title}</h1>
            </div>
            <p className="text-gray-400">{t.subtitle}</p>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className={`w-12 h-12 text-${accent}-400 animate-spin mb-4`} />
              <p className="text-gray-400">{t.loading}</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="text-red-400 text-center mb-4">{error}</div>
              <button onClick={fetchMatches} className={`px-6 py-2 bg-${accent}-500/20 border border-${accent}-500/30 text-${accent}-400 rounded-lg`}>
                {t.retry}
              </button>
            </div>
          ) : matches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Swords className="w-16 h-16 text-gray-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">{t.noMatches}</h3>
              <p className="text-gray-500">{t.noMatchesDesc}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {matches.map((match, index) => {
                const isExpanded = expandedMatches[match._id];
                const duration = getDuration(match.startedAt, match.completedAt);
                const team1Won = match.result?.winner === 1;
                const team2Won = match.result?.winner === 2;
                
                // Récupérer les joueurs depuis team1.players et team2.players
                const team1Players = match.team1?.players || [];
                const team2Players = match.team2?.players || [];
                
                // Date/heure - utiliser startedAt ou completedAt ou createdAt
                const dateTime = formatDateTime(match.startedAt || match.completedAt || match.createdAt);

                return (
                  <div
                    key={match._id || index}
                    className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border transition-all cursor-pointer ${
                      isExpanded ? `border-${accent}-500/50` : 'border-white/10 hover:border-white/20'
                    }`}
                    onClick={() => toggleExpand(match._id)}
                  >
                    {/* Header */}
                    <div className="p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        {/* Left */}
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
                            isHardcore ? 'bg-gradient-to-br from-red-500 to-orange-600' : 'bg-gradient-to-br from-cyan-400 to-blue-600'
                          }`}>
                            #{index + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-lg font-bold text-${accent}-400`}>
                                {match.format || `${match.teamSize || 5}v${match.teamSize || 5}`}
                              </span>
                              <span className="text-gray-500">•</span>
                              <span className="text-gray-400 text-sm">{match.gameMode || 'Search & Destroy'}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {dateTime.date}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {dateTime.time}
                              </span>
                              {duration && (
                                <span className="flex items-center gap-1">
                                  <Timer className="w-3 h-3" />
                                  {duration} {t.min}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Center - Teams */}
                        <div className="flex items-center gap-4">
                          <div className={`text-center ${team1Won ? 'text-green-400' : 'text-gray-400'}`}>
                            <div className="text-sm font-medium">{t.team1}</div>
                            <div className="text-2xl font-bold">{team1Players.length}</div>
                            <div className="text-xs text-gray-500">{t.players}</div>
                          </div>
                          
                          <div className={`px-4 py-2 rounded-lg font-bold text-lg ${
                            isHardcore ? 'bg-red-500/20 text-red-400' : 'bg-cyan-500/20 text-cyan-400'
                          }`}>
                            {t.vs}
                          </div>
                          
                          <div className={`text-center ${team2Won ? 'text-green-400' : 'text-gray-400'}`}>
                            <div className="text-sm font-medium">{t.team2}</div>
                            <div className="text-2xl font-bold">{team2Players.length}</div>
                            <div className="text-xs text-gray-500">{t.players}</div>
                          </div>
                        </div>

                        {/* Right */}
                        <div className="flex items-center gap-2">
                          {(team1Won || team2Won) && (
                            <div className="flex items-center gap-1 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
                              <Trophy className="w-4 h-4 text-green-400" />
                              <span className="text-green-400 text-sm font-medium">
                                {team1Won ? t.team1 : t.team2}
                              </span>
                            </div>
                          )}
                          <div className={`p-2 rounded-lg`}>
                            {isExpanded ? (
                              <ChevronUp className={`w-5 h-5 text-${accent}-400`} />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded - Rosters */}
                    {isExpanded && (
                      <div className="px-4 sm:px-6 pb-6 border-t border-white/10 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Team 1 */}
                          <div className={`p-4 rounded-xl ${
                            team1Won ? 'bg-green-500/10 border-2 border-green-500/30' : 'bg-cyan-500/5 border border-cyan-500/20'
                          }`}>
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-cyan-400"></div>
                                <h3 className="text-lg font-bold text-cyan-400">{t.team1}</h3>
                                {match.team1?.isHost && (
                                  <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">{t.host}</span>
                                )}
                              </div>
                              {team1Won && (
                                <div className="flex items-center gap-1 text-green-400">
                                  <Trophy className="w-4 h-4" />
                                  <span className="text-sm font-medium">{t.winner}</span>
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              {team1Players.length > 0 ? team1Players.map((player, pIndex) => (
                                <div key={pIndex} className="flex items-center gap-3 p-2 rounded-lg bg-dark-800/50">
                                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 border-2 border-cyan-500/30">
                                    <img
                                      src={getAvatarUrl(player, pIndex)}
                                      alt=""
                                      className="w-full h-full object-cover"
                                      onError={(e) => { e.target.src = `https://cdn.discordapp.com/embed/avatars/${pIndex % 5}.png`; }}
                                    />
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-white font-medium">{player.username || 'Joueur'}</span>
                                    {player.isReferent && (
                                      <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded flex items-center gap-1">
                                        <Star className="w-3 h-3" />
                                        {t.referent}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )) : (
                                <div className="text-gray-500 text-sm text-center py-4">{t.noPlayers}</div>
                              )}
                            </div>
                          </div>

                          {/* Team 2 */}
                          <div className={`p-4 rounded-xl ${
                            team2Won ? 'bg-green-500/10 border-2 border-green-500/30' : 'bg-orange-500/5 border border-orange-500/20'
                          }`}>
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-orange-400"></div>
                                <h3 className="text-lg font-bold text-orange-400">{t.team2}</h3>
                                {match.team2?.isHost && (
                                  <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">{t.host}</span>
                                )}
                              </div>
                              {team2Won && (
                                <div className="flex items-center gap-1 text-green-400">
                                  <Trophy className="w-4 h-4" />
                                  <span className="text-sm font-medium">{t.winner}</span>
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              {team2Players.length > 0 ? team2Players.map((player, pIndex) => (
                                <div key={pIndex} className="flex items-center gap-3 p-2 rounded-lg bg-dark-800/50">
                                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 border-2 border-orange-500/30">
                                    <img
                                      src={getAvatarUrl(player, pIndex)}
                                      alt=""
                                      className="w-full h-full object-cover"
                                      onError={(e) => { e.target.src = `https://cdn.discordapp.com/embed/avatars/${pIndex % 5}.png`; }}
                                    />
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-white font-medium">{player.username || 'Joueur'}</span>
                                    {player.isReferent && (
                                      <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded flex items-center gap-1">
                                        <Star className="w-3 h-3" />
                                        {t.referent}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )) : (
                                <div className="text-gray-500 text-sm text-center py-4">{t.noPlayers}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecentRankedMatches;
