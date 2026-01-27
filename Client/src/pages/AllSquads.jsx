import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { 
  ArrowLeft, Users, Search, Trophy, Loader2, 
  ChevronLeft, ChevronRight, Lock, Medal, Target, TrendingUp, Shield
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const AllSquads = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { selectedMode } = useMode();

  const [squads, setSquads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  const isHardcore = selectedMode === 'hardcore';
  const accentColor = isHardcore ? 'red' : 'cyan';
  const gradientFrom = isHardcore ? 'from-red-500' : 'from-cyan-400';
  const gradientTo = isHardcore ? 'to-orange-600' : 'to-cyan-600';

  const SQUADS_PER_PAGE = 30;

  const t = {
    fr: {
      title: 'Toutes les Escouades',
      subtitle: 'Parcourez et rejoignez une escouade',
      search: 'Rechercher une escouade...',
      noSquads: 'Aucune escouade trouvée',
      noSquadsDesc: 'Aucune escouade ne correspond à votre recherche.',
      members: 'membres',
      points: 'pts',
      wins: 'V',
      losses: 'D',
      winRate: 'Ratio',
      private: 'Privée',
      back: 'Retour',
      page: 'Page',
      of: 'sur',
      showing: 'Affichage de',
      results: 'résultats',
    },
    en: {
      title: 'All Squads',
      subtitle: 'Browse and join a squad',
      search: 'Search for a squad...',
      noSquads: 'No squads found',
      noSquadsDesc: 'No squads match your search.',
      members: 'members',
      points: 'pts',
      wins: 'W',
      losses: 'L',
      winRate: 'Ratio',
      private: 'Private',
      back: 'Back',
      page: 'Page',
      of: 'of',
      showing: 'Showing',
      results: 'results',
    },
    de: {
      title: 'Alle Squads',
      subtitle: 'Squads durchsuchen und beitreten',
      search: 'Nach einem Squad suchen...',
      noSquads: 'Keine Squads gefunden',
      noSquadsDesc: 'Keine Squads entsprechen Ihrer Suche.',
      members: 'Mitglieder',
      points: 'Pkt',
      wins: 'S',
      losses: 'N',
      winRate: 'Quote',
      private: 'Privat',
      back: 'Zurück',
      page: 'Seite',
      of: 'von',
      showing: 'Anzeige von',
      results: 'Ergebnisse',
    },
    it: {
      title: 'Tutte le Squadre',
      subtitle: 'Esplora e unisciti a una squadra',
      search: 'Cerca una squadra...',
      noSquads: 'Nessuna squadra trovata',
      noSquadsDesc: 'Nessuna squadra corrisponde alla tua ricerca.',
      members: 'membri',
      points: 'punti',
      wins: 'V',
      losses: 'S',
      winRate: 'Ratio',
      private: 'Privata',
      back: 'Indietro',
      page: 'Pagina',
      of: 'di',
      showing: 'Visualizzazione di',
      results: 'risultati',
    },
  }[language] || {
    title: 'All Squads',
    subtitle: 'Browse and join a squad',
    search: 'Search for a squad...',
    noSquads: 'No squads found',
    noSquadsDesc: 'No squads match your search.',
    members: 'members',
    points: 'pts',
    wins: 'W',
    losses: 'L',
    winRate: 'Ratio',
    private: 'Private',
    back: 'Back',
    page: 'Page',
    of: 'of',
    showing: 'Showing',
    results: 'results',
  };

  useEffect(() => {
    const titles = {
      fr: 'NoMercy - Toutes les Escouades',
      en: 'NoMercy - All Squads',
      it: 'NoMercy - Tutte le Squadre',
      de: 'NoMercy - Alle Squads',
    };
    document.title = titles[language] || titles.en;
  }, [language]);

  useEffect(() => {
    fetchSquads();
  }, [page, search, selectedMode]);

  const fetchSquads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: SQUADS_PER_PAGE.toString(),
        search: search,
        mode: selectedMode
      });
      
      const response = await fetch(`${API_URL}/squads/all?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setSquads(data.squads || []);
        setPagination(data.pagination || { total: 0, pages: 1 });
      }
    } catch (err) {
      console.error('Error fetching squads:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchSquads();
  };

  // Get mode-specific stats for a squad
  const getModeStats = (squad) => {
    // Use mode-specific stats based on current mode selection
    if (isHardcore) {
      return squad.statsHardcore || squad.stats || {};
    } else {
      return squad.statsCdl || squad.stats || {};
    }
  };

  const getWinRate = (squad) => {
    const stats = getModeStats(squad);
    const wins = stats?.totalWins || 0;
    const losses = stats?.totalLosses || 0;
    const total = wins + losses;
    if (total === 0) return '0%';
    return `${Math.round((wins / total) * 100)}%`;
  };

  return (
    <div className="min-h-screen bg-dark-950 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-20"></div>
      {isHardcore ? (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 30% 0%, rgba(239, 68, 68, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 100%, rgba(249, 115, 22, 0.05) 0%, transparent 50%)' }}></div>
      ) : (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 30% 0%, rgba(6, 182, 212, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 100%, rgba(59, 130, 246, 0.05) 0%, transparent 50%)' }}></div>
      )}

      <div className="relative z-10 py-6 sm:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            {t.back}
          </button>

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center shadow-lg`}>
                <Users className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white">{t.title}</h1>
                <p className="text-gray-400 mt-1">{t.subtitle}</p>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="mb-8">
            <div className="relative max-w-xl">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.search}
                className={`w-full px-5 py-4 pl-12 bg-dark-900/80 border border-${accentColor}-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-${accentColor}-500/50 transition-colors`}
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <button
                type="submit"
                className={`absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-lg text-white font-medium hover:opacity-90 transition-opacity`}
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Results count */}
          {!loading && (
            <p className="text-gray-500 text-sm mb-4">
              {t.showing} {squads.length} {t.results} ({pagination.total} total)
            </p>
          )}

          {/* Loading */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className={`w-8 h-8 animate-spin ${isHardcore ? 'text-red-500' : 'text-cyan-500'}`} />
            </div>
          ) : squads.length === 0 ? (
            <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-${accentColor}-500/20 p-12 text-center`}>
              <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">{t.noSquads}</h3>
              <p className="text-gray-400">{t.noSquadsDesc}</p>
            </div>
          ) : (
            <>
              {/* Squads Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {squads.map((squad) => (
                  <Link
                    key={squad._id}
                    to={`/squad/${squad._id}`}
                    className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-${accentColor}-500/20 p-5 hover:border-${accentColor}-500/40 transition-all hover:scale-[1.02] group`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Logo */}
                      <div 
                        className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/10"
                        style={{ 
                          backgroundColor: squad.color === 'transparent' ? 'transparent' : squad.color + '30'
                        }}
                      >
                        {squad.logo ? (
                          <img src={squad.logo} alt={squad.name} className="w-full h-full object-cover" />
                        ) : (
                          <Users className="w-8 h-8" style={{ color: squad.color === 'transparent' ? '#9ca3af' : squad.color }} />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-bold truncate group-hover:text-yellow-400 transition-colors">
                            {squad.name}
                          </h3>
                          <span className="text-gray-500 text-sm">[{squad.tag}]</span>
                          {!squad.isPublic && (
                            <Lock className="w-3 h-3 text-orange-400 flex-shrink-0" />
                          )}
                        </div>
                        
                        {squad.description && (
                          <p className="text-gray-500 text-xs line-clamp-1 mb-2">{squad.description}</p>
                        )}
                        
                        <div className="flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1 text-gray-400">
                            <Users className="w-3 h-3" />
                            {squad.members?.length || 0} {t.members}
                          </span>
                          <span className="flex items-center gap-1" style={{ color: squad.color === 'transparent' ? '#9ca3af' : squad.color }}>
                            <Trophy className="w-3 h-3" />
                            {getModeStats(squad)?.totalPoints || 0} {t.points}
                          </span>
                          {squad.statsStricker?.rank && (
                            <span className="flex items-center gap-1 text-lime-400">
                              <Shield className="w-3 h-3" />
                              {squad.statsStricker.rank}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                      <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1 text-green-400">
                          <Medal className="w-3 h-3" />
                          {getModeStats(squad)?.totalWins || 0}{t.wins}
                        </span>
                        <span className="flex items-center gap-1 text-red-400">
                          <Target className="w-3 h-3" />
                          {getModeStats(squad)?.totalLosses || 0}{t.losses}
                        </span>
                        <span className="flex items-center gap-1 text-yellow-400">
                          <TrendingUp className="w-3 h-3" />
                          {getWinRate(squad)}
                        </span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded ${
                        squad.mode === 'both' ? 'bg-purple-500/20 text-purple-400' :
                        squad.mode === 'hardcore' ? 'bg-red-500/20 text-red-400' : 'bg-cyan-500/20 text-cyan-400'
                      }`}>
                        {squad.mode === 'both' ? 'HC & CDL' : squad.mode === 'hardcore' ? 'HC' : 'CDL'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className={`p-2 rounded-lg bg-dark-900 border border-${accentColor}-500/20 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-dark-800 transition-colors`}
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-400" />
                  </button>
                  
                  <span className="text-gray-400 text-sm">
                    {t.page} {page} {t.of} {pagination.pages}
                  </span>
                  
                  <button
                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages}
                    className={`p-2 rounded-lg bg-dark-900 border border-${accentColor}-500/20 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-dark-800 transition-colors`}
                  >
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AllSquads;



