import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { getDefaultAvatar, getAvatarUrl } from '../utils/avatar';
import { Trophy, Users, Shield, Medal, Target, ChevronLeft, ChevronRight, Crown, Clock, MapPin, Shuffle, Play, Filter, X, Coins, Loader2, Zap } from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const CDLDashboard = () => {
  const { language, t } = useLanguage();
  const { selectedMode } = useMode();
  const scrollRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  // Modes disponibles en CDL avec traductions
  const gameModeTranslations = {
    'cdlHP': t('cdlHP'),
    'cdlSND': t('cdlSND'),
    'cdlControl': t('cdlControl'),
  };
  
  const availableModes = ['cdlHP', 'cdlSND', 'cdlControl'];
  
  // Charger les filtres depuis localStorage (tous sélectionnés par défaut)
  const [activeModes, setActiveModes] = useState(() => {
    const saved = localStorage.getItem('cdlMatchFilters');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return availableModes;
      }
    }
    return availableModes;
  });
  
  // Sauvegarder dans localStorage quand les filtres changent
  useEffect(() => {
    localStorage.setItem('cdlMatchFilters', JSON.stringify(activeModes));
  }, [activeModes]);
  
  const toggleMode = (mode) => {
    setActiveModes(prev => {
      if (prev.includes(mode)) {
        if (prev.length === 1) return prev;
        return prev.filter(m => m !== mode);
      } else {
        return [...prev, mode];
      }
    });
  };
  
  const selectAllModes = () => setActiveModes(availableModes);

  // Matchs publics publiés par les joueurs (triés par mode)
  // opponentRank: position de l'équipe adverse dans le classement
  // ranked: true pour les matchs classés
  const allPublicMatches = [
    { id: 1, mode: 'cdlControl', teamSize: 4, time: '15:15', randomMap: true, opponentRank: 3, ranked: true },
    { id: 2, mode: 'cdlControl', teamSize: 4, time: '17:00', randomMap: false, opponentRank: 18, ranked: false },
    { id: 3, mode: 'cdlHP', teamSize: 4, time: '14:30', randomMap: true, opponentRank: 1, ranked: true },
    { id: 4, mode: 'cdlHP', teamSize: 4, time: '15:45', randomMap: false, opponentRank: 7, ranked: false },
    { id: 5, mode: 'cdlSND', teamSize: 4, time: '15:00', randomMap: false, opponentRank: 4, ranked: true },
    { id: 6, mode: 'cdlSND', teamSize: 4, time: '16:00', randomMap: true, opponentRank: 22, ranked: false },
  ];
  
  // Calculer les points gagnés selon le classement adverse
  const calculatePoints = (opponentRank) => {
    if (opponentRank <= 3) return 50;
    if (opponentRank <= 10) return 30;
    if (opponentRank <= 50) return 20;
    return 10;
  };
  
  // Calculer le butin (75 pièces pour ranked, 50 pour normal x taille de l'équipe)
  const calculateLoot = (teamSize, isRanked) => {
    const baseCoins = isRanked ? 75 : 50;
    return baseCoins * teamSize;
  };
  
  // Filtrer et trier les matchs
  const publicMatches = allPublicMatches
    .filter(match => activeModes.includes(match.mode))
    .sort((a, b) => a.mode.localeCompare(b.mode));

  // Matchs récents (résultats)
  const recentMatches = [
    { id: 1, winner: 'OpTic Texas', loser: 'FaZe Clan', mode: 'cdlHP', time: '14:30' },
    { id: 2, winner: 'Atlanta FaZe', loser: 'LA Thieves', mode: 'cdlSND', time: '14:45' },
    { id: 3, winner: 'NY Subliners', loser: 'Toronto Ultra', mode: 'cdlControl', time: '14:58' },
    { id: 4, winner: 'London Royal Ravens', loser: 'Seattle Surge', mode: 'cdlHP', time: '15:10' },
    { id: 5, winner: 'Boston Breach', loser: 'Florida Mutineers', mode: 'cdlSND', time: '15:22' },
  ];

  const ongoingTournaments = [
    { id: 1, name: 'CDL Pro Series', mode: 'Hardpoint', players: '32/32', prize: '$2,500', status: 'live', startsIn: 'EN COURS', map: 'Bocage' },
    { id: 2, name: 'CDL Weekend Cup', mode: 'Search & Destroy', players: '24/32', prize: '$1,500', status: 'filling', startsIn: '1h 45min', map: 'Tuscan' },
    { id: 3, name: 'CDL Open Qualifier', mode: 'Control', players: '16/32', prize: '$3,000', status: 'filling', startsIn: '5h 20min', map: 'Berlin' },
    { id: 4, name: 'CDL Elite Championship', mode: 'Hardpoint', players: '28/32', prize: '$4,000', status: 'filling', startsIn: '3h 15min', map: 'Gavutu' },
    { id: 5, name: 'CDL Masters', mode: 'Search & Destroy', players: '32/32', prize: '$5,000', status: 'full', startsIn: '6h 30min', map: 'Tuscan' },
    { id: 6, name: 'CDL Night League', mode: 'Control', players: '20/32', prize: '$2,000', status: 'filling', startsIn: '2h 00min', map: 'Berlin' },
  ];

  const sortedTournaments = [...ongoingTournaments].sort((a, b) => {
    const statusOrder = { live: 0, filling: 1, full: 2 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  // State pour les classements depuis la DB
  const [topPlayers, setTopPlayers] = useState([]);
  const [topSquads, setTopSquads] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [loadingSquads, setLoadingSquads] = useState(true);

  // Fetch top 10 players from DB
  useEffect(() => {
    const fetchTopPlayers = async () => {
      setLoadingPlayers(true);
      try {
        const response = await fetch(`${API_URL}/rankings/leaderboard/cdl?limit=10`);
        const data = await response.json();
        if (data.success) {
          setTopPlayers(data.rankings.map((r, idx) => ({
            rank: idx + 1,
            id: r.user?._id,
            player: r.user?.username || (language === 'fr' ? 'Compte supprimé' : 'Deleted account'),
            avatar: getAvatarUrl(r.user?.avatarUrl || r.user?.avatar) || null,
            points: r.points
          })));
        }
      } catch (err) {
        console.error('Error fetching top players:', err);
      } finally {
        setLoadingPlayers(false);
      }
    };
    fetchTopPlayers();
  }, []);

  // Fetch top 10 squads from DB
  useEffect(() => {
    const fetchTopSquads = async () => {
      setLoadingSquads(true);
      try {
        const response = await fetch(`${API_URL}/squads/leaderboard/cdl?limit=10`);
        const data = await response.json();
        console.log('CDL Top Squads Response:', data);
        if (data.success) {
          const squadsData = data.squads.map((s, idx) => ({
            rank: idx + 1,
            id: s._id,
            team: s.name,
            tag: s.tag,
            color: s.color,
            logo: s.logo,
            points: s.stats?.totalPoints || 0,
            totalMatches: s.totalMatches || (s.stats?.totalWins || 0) + (s.stats?.totalLosses || 0),
            totalWins: s.totalWins || s.stats?.totalWins || 0,
            totalLosses: s.totalLosses || s.stats?.totalLosses || 0
          }));
          console.log('CDL Top Squads Processed:', squadsData);
          setTopSquads(squadsData);
        }
      } catch (err) {
        console.error('Error fetching top squads:', err);
      } finally {
        setLoadingSquads(false);
      }
    };
    fetchTopSquads();
  }, []);

  const scroll = (direction) => {
    const container = scrollRef.current;
    if (container) {
      const scrollAmount = 320;
      container.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    const container = scrollRef.current;
    if (container) {
      setShowLeftArrow(container.scrollLeft > 0);
      setShowRightArrow(container.scrollLeft < container.scrollWidth - container.clientWidth - 10);
    }
  };

  useEffect(() => {
    handleScroll();
    window.addEventListener('resize', handleScroll);
    return () => window.removeEventListener('resize', handleScroll);
  }, []);

  const getStatusBadge = (status) => {
    switch(status) {
      case 'live': return { text: '● LIVE', bg: 'bg-red-500/20', border: 'border-red-500/50', textColor: 'text-red-400' };
      case 'filling': return { text: '○ OPEN', bg: 'bg-cyan-500/20', border: 'border-cyan-500/50', textColor: 'text-cyan-400' };
      case 'full': return { text: '✓ FULL', bg: 'bg-gray-500/20', border: 'border-gray-500/50', textColor: 'text-gray-400' };
      default: return { text: '○ OPEN', bg: 'bg-cyan-500/20', border: 'border-cyan-500/50', textColor: 'text-cyan-400' };
    }
  };

  const gameModes = [
    { name: 'Hardpoint', players: '3.2K', icon: '🎯', popular: true },
    { name: 'Search & Destroy', players: '2.8K', icon: '💣', popular: true },
    { name: 'Control', players: '2.1K', icon: '🏴', popular: true },
  ];

  return (
    <div className="min-h-screen bg-dark-950 relative">
      {/* Background Effects - Blue/Cyan Theme */}
      <div className="absolute inset-0 bg-mesh pointer-events-none"></div>
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-30"></div>
      
      <div className="relative z-10 py-4 sm:py-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Header */}
          <div className="mb-6 sm:mb-10">
          <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-500/30 blur-xl"></div>
                <div className="relative w-10 h-10 sm:w-14 sm:h-14 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/40">
                  <Shield className="w-5 h-5 sm:w-7 sm:h-7 text-dark-950" />
                </div>
            </div>
            <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1">CDL</h1>
                <p className="text-gray-400 text-xs sm:text-sm">{t('cdlDashboardDesc')}</p>
            </div>
          </div>
        </div>

          {/* Public Matches - NEW SECTION */}
          <section className="mb-10">
            {/* Recent Matches Ticker */}
            <div className="mb-4 bg-dark-900/80 backdrop-blur-xl rounded-lg border border-cyan-500/20 overflow-hidden">
              <div className="flex items-center bg-cyan-500/10 px-3 py-2 border-b border-cyan-500/20">
                <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider whitespace-nowrap">
                  {language === 'fr' ? 'Résultats récents' : 'Recent Results'}
                </span>
              </div>
              <div className="relative overflow-hidden py-2">
                <div className="animate-scroll-left flex whitespace-nowrap">
                  {[...recentMatches, ...recentMatches].map((match, index) => (
                    <span key={`${match.id}-${index}`} className="inline-flex items-center px-6 text-sm">
                      <Link
                        to={`/squad/${encodeURIComponent(match.winner)}`}
                        className="text-white font-semibold hover:text-cyan-300 transition-colors"
                      >
                        {match.winner}
                      </Link>
                      <span className="text-gray-500 mx-2">{language === 'fr' ? 'a vaincu' : 'defeated'}</span>
                      <Link
                        to={`/squad/${encodeURIComponent(match.loser)}`}
                        className="text-gray-300 hover:text-cyan-200 transition-colors"
                      >
                        {match.loser}
                      </Link>
                      <span className="text-gray-600 mx-2">•</span>
                      <span className="text-cyan-400 text-xs">{gameModeTranslations[match.mode]}</span>
                      <span className="text-gray-600 mx-2">•</span>
                      <span className="text-gray-500 text-xs">{match.time}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                  <Play className="w-4 h-4 text-cyan-400 animate-pulse" />
                </div>
                <h2 className="text-xl font-bold text-white">
                  {t('availableMatches')}
            </h2>
                <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
                  {publicMatches.length}
                </span>
          </div>

              {/* Filter Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition-all ${
                  showFilters || activeModes.length < availableModes.length
                    ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400'
                    : 'border-white/10 text-gray-400 hover:border-cyan-500/30 hover:text-white'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:inline">
                  {t('filters')}
                </span>
                {activeModes.length < availableModes.length && (
                  <span className="w-5 h-5 bg-cyan-500 rounded-full text-dark-950 text-xs flex items-center justify-center font-bold">
                    {activeModes.length}
                  </span>
                )}
              </button>
            </div>
            
            {/* Filter Panel */}
            {showFilters && (
              <div className="mb-4 p-4 bg-dark-900/80 backdrop-blur-xl rounded-xl border border-cyan-500/20 animate-slide-down">
                    <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-400 font-medium">
                    {t('filterByMode')}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={selectAllModes}
                      className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      {t('all')}
                    </button>
                    <span className="text-gray-600">|</span>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableModes.map((mode) => (
                    <button
                      key={mode}
                      onClick={() => toggleMode(mode)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        activeModes.includes(mode)
                          ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                          : 'bg-dark-800/50 border border-white/10 text-gray-500 hover:border-white/20'
                      }`}
                    >
                      {gameModeTranslations[mode]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-3">
              {publicMatches.map((match) => {
                const points = calculatePoints(match.opponentRank);
                const loot = calculateLoot(match.teamSize, match.ranked);
                return (
                  <div key={match.id} className={`bg-dark-900/80 backdrop-blur-xl rounded-xl p-4 transition-all duration-300 flex items-center justify-between ${
                    match.ranked 
                      ? 'border-2 border-yellow-500/40 hover:border-yellow-500/60 shadow-lg shadow-yellow-500/10' 
                      : 'border border-cyan-500/20 hover:border-cyan-500/40'
                  }`}>
                    <div className="flex items-center space-x-4 sm:space-x-6 flex-1">
                      {/* Mode */}
                      <div className="min-w-[130px]">
                        <span className="px-3 py-1.5 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 text-xs font-semibold">
                          {gameModeTranslations[match.mode]}
                        </span>
                      </div>
                      
                      {/* Time */}
                      <div className="flex items-center space-x-2 min-w-[70px]">
                        <Clock className="w-4 h-4 text-cyan-400" />
                        <span className="text-white text-sm font-medium">{match.time}</span>
                      </div>
                      
                      {/* Team Size */}
                      <div className="flex items-center space-x-2 min-w-[70px]">
                        <Users className="w-4 h-4 text-cyan-400" />
                        <span className="text-white text-sm font-medium">{match.teamSize}v{match.teamSize}</span>
                      </div>
                      
                      {/* Map */}
                      <div className="w-[140px] mr-2.5">
                        {match.randomMap ? (
                          <span className="inline-flex items-center justify-center w-full px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-yellow-500 text-xs font-semibold space-x-1.5">
                            <Shuffle className="w-3.5 h-3.5" />
                            <span>{t('mapsRandom')}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-full px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-xs font-semibold space-x-1.5">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{t('mapsFree')}</span>
                          </span>
                        )}
                      </div>

                      {/* Points */}
                      <div className="flex items-center space-x-1.5 min-w-[80px]">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        <span className="text-yellow-500 text-sm font-bold">+{points} {t('pts')}</span>
                      </div>
                      
                      {/* Pièces */}
                      <div className="flex items-center space-x-1.5 min-w-[90px]">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center">
                          <Coins className="w-3 h-3 text-yellow-900" />
                        </div>
                        <span className="text-amber-400 text-sm font-bold">{loot}</span>
                        <span className="text-gray-500 text-xs">{language === 'fr' ? 'pièces' : 'coins'}</span>
                      </div>
                      
                      {/* Ranked Badge - Right Side */}
                      {match.ranked && (
                        <div className="flex items-center ml-4">
                          <span className="px-2.5 py-1 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-lg text-dark-950 text-xs font-bold uppercase tracking-wider shadow-lg shadow-yellow-500/30 flex items-center space-x-1">
                            <Trophy className="w-3 h-3" />
                            <span>{t('ranked')}</span>
                          </span>
                        </div>
                      )}
                  </div>
                    
                    {/* Go Button */}
                    <button className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-lg text-dark-950 font-bold text-sm hover:shadow-lg hover:shadow-cyan-500/30 transition-all hover:scale-105">
                      GO
                    </button>
                  </div>
                );
              })}
                  </div>
          </section>

          {/* Tournaments - Coming Soon */}
          <section className="mb-10">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                <Trophy className="w-4 h-4 text-cyan-400" />
                  </div>
              <h2 className="text-xl font-bold text-white">
                {t('tournaments')}
              </h2>
                </div>

            {/* Coming Soon Banner */}
            <div className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-cyan-500/10 border-2 border-cyan-500/30 rounded-2xl p-8 md:p-12 text-center relative overflow-hidden">
              {/* Animated background */}
              <div className="absolute inset-0 opacity-30">
                <div className="absolute top-0 left-0 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-0 right-0 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
              </div>
              
              <div className="relative z-10">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 border-2 border-cyan-500/50 flex items-center justify-center animate-bounce">
                  <Trophy className="w-10 h-10 text-cyan-400" />
                </div>
                
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
                  {language === 'fr' ? 'Bientôt disponible' : language === 'de' ? 'Bald verfügbar' : language === 'it' ? 'Prossimamente' : 'Coming Soon'}
                </h3>
                
                <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto">
                  {language === 'fr' 
                    ? 'Les tournois arrivent bientôt ! Préparez-vous à affronter les meilleurs joueurs et à remporter des récompenses exclusives.'
                    : language === 'de'
                      ? 'Turniere kommen bald! Bereiten Sie sich darauf vor, die besten Spieler herauszufordern und exklusive Belohnungen zu gewinnen.'
                      : language === 'it'
                        ? 'I tornei arrivano presto! Preparati a sfidare i migliori giocatori e vincere premi esclusivi.'
                        : 'Tournaments are coming soon! Get ready to challenge the best players and win exclusive rewards.'}
                </p>
              </div>
            </div>
        </section>

          {/* Rankings */}
          <section className="mb-10">
          <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <Crown className="w-4 h-4 text-yellow-500" />
              </div>
              <h2 className="text-xl font-bold text-white">
                {language === 'fr' ? 'Classements' : 'Rankings'}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Top 10 Players */}
              <div className="bg-dark-900/80 backdrop-blur-xl rounded-xl border border-cyan-500/20 overflow-hidden">
                <div className="px-5 py-4 border-b border-cyan-500/10 bg-gradient-to-r from-cyan-500/10 to-transparent">
                  <h3 className="font-bold text-white flex items-center space-x-2">
                    <Users className="w-5 h-5 text-cyan-400" />
                    <span>{language === 'fr' ? 'Top 10 Joueurs' : 'Top 10 Players'}</span>
                </h3>
              </div>
              {loadingPlayers ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                </div>
              ) : topPlayers.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm">
                  {language === 'fr' ? 'Aucun joueur classé' : 'No ranked players'}
                </div>
              ) : (
              <div className="divide-y divide-white/5">
                  {topPlayers.map((player) => {
                  const isTop3 = player.rank <= 3;
                  return (
                      <div key={player.rank} className={`px-5 py-3 hover:bg-white/5 transition-all ${isTop3 ? 'bg-gradient-to-r from-yellow-500/5 to-transparent' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2 w-12">
                              {player.rank === 1 && <Medal className="w-4 h-4 text-yellow-500" />}
                              {player.rank === 2 && <Medal className="w-4 h-4 text-gray-400" />}
                              {player.rank === 3 && <Medal className="w-4 h-4 text-amber-600" />}
                              <span className={`font-bold text-sm ${isTop3 ? 'text-white' : 'text-gray-400'}`}>#{player.rank}</span>
                          </div>
                          {player.avatar && (
                            <img 
                              src={getAvatarUrl(player.avatar) || player.avatar} 
                              alt="" 
                              className="w-6 h-6 rounded-full"
                              onError={(e) => e.target.style.display = 'none'}
                            />
                          )}
                            <Link to={`/player/${encodeURIComponent(player.player)}`} className={`font-semibold text-sm hover:text-cyan-400 transition-colors ${player.rank === 1 ? 'text-yellow-500' : player.rank === 2 ? 'text-gray-300' : player.rank === 3 ? 'text-amber-600' : 'text-white'}`}>
                            {player.player}
                          </Link>
                        </div>
                          <span className="text-cyan-400 font-bold text-sm">{player.points.toLocaleString()} XP</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>

            {/* Top 10 Squads */}
              <div className="bg-dark-900/80 backdrop-blur-xl rounded-xl border border-cyan-500/20 overflow-hidden">
                <div className="px-5 py-4 border-b border-cyan-500/10 bg-gradient-to-r from-cyan-500/10 to-transparent">
                  <h3 className="font-bold text-white flex items-center space-x-2">
                    <Shield className="w-5 h-5 text-cyan-400" />
                    <span>{language === 'fr' ? 'Top 10 Escouades' : 'Top 10 Squads'}</span>
                </h3>
              </div>
              {loadingSquads ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                </div>
              ) : topSquads.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm">
                  {language === 'fr' ? 'Aucune escouade classée' : 'No ranked squads'}
                </div>
              ) : (
              <div className="divide-y divide-white/5">
                  {topSquads.map((squad) => {
                  const isTop3 = squad.rank <= 3;
                  return (
                      <div key={squad.rank} className={`px-5 py-3 hover:bg-white/5 transition-all ${isTop3 ? 'bg-gradient-to-r from-yellow-500/5 to-transparent' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2 w-12">
                              {squad.rank === 1 && <Medal className="w-4 h-4 text-yellow-500" />}
                              {squad.rank === 2 && <Medal className="w-4 h-4 text-gray-400" />}
                              {squad.rank === 3 && <Medal className="w-4 h-4 text-amber-600" />}
                              <span className={`font-bold text-sm ${isTop3 ? 'text-white' : 'text-gray-400'}`}>#{squad.rank}</span>
                          </div>
                          {squad.logo ? (
                            <img src={squad.logo} alt="" className="w-6 h-6 rounded object-contain" />
                          ) : (
                            <div 
                              className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: squad.color + '30', color: squad.color }}
                            >
                              {squad.tag?.charAt(0) || 'S'}
                            </div>
                          )}
                            <Link to={`/squad/${squad.id}`} className={`font-semibold text-sm hover:text-cyan-400 transition-colors ${squad.rank === 1 ? 'text-yellow-500' : squad.rank === 2 ? 'text-gray-300' : squad.rank === 3 ? 'text-amber-600' : 'text-white'}`}>
                            {squad.team}
                            {squad.tag && <span className="text-gray-500 ml-1 text-xs">[{squad.tag}]</span>}
                          </Link>
                        </div>
                          <div className="flex items-center gap-3">
                            <div className="hidden sm:flex items-center gap-2 text-xs">
                              <span className="text-gray-500">{squad.totalMatches}M</span>
                              <span className="text-green-400">{squad.totalWins}W</span>
                              <span className="text-red-400">{squad.totalLosses}L</span>
                            </div>
                            <span className="text-cyan-400 font-bold text-sm">{squad.points} pts</span>
                          </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          </div>
        </section>

        {/* CDL Game Modes */}
          <section>
          <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-cyan-400" />
              </div>
              <h2 className="text-xl font-bold text-white">
                {language === 'fr' ? 'Modes CDL' : 'CDL Modes'}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {gameModes.map((mode, index) => (
                <div key={index} className="bg-dark-900/80 backdrop-blur-xl rounded-xl p-8 border border-cyan-500/30 transition-all duration-300 cursor-pointer text-center hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/20">
                  <div className="mb-3">
                    <span className="px-3 py-1 bg-cyan-500 rounded-full text-dark-950 text-xs font-bold uppercase tracking-wider">Official CDL</span>
                </div>
                <div className="text-5xl mb-4">{mode.icon}</div>
                  <h3 className="text-white font-bold text-lg mb-3">{mode.name}</h3>
                <div className="flex items-center justify-center space-x-2 text-gray-400 text-sm">
                  <Users className="w-4 h-4" />
                    <span>{mode.players} players</span>
                </div>
              </div>
            ))}
          </div>
        </section>
        </div>
      </div>
    </div>
  );
};

export default CDLDashboard;
