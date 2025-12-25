import React from 'react';
import { useLanguage } from '../LanguageContext';
import { Trophy, Calendar, Users, Coins, Clock, Medal, Crown, Zap, ArrowRight } from 'lucide-react';

const Tournaments = () => {
  const { t, language } = useLanguage();

  const tournaments = [
    { id: 1, title: 'Championship Finals', game: 'Cyber Strike', prize: '$10,000', players: '128/128', status: 'live', date: 'Dec 6, 2025', time: '20:00', emoji: '🏆', tier: 'elite' },
    { id: 2, title: 'Weekly Challenge', game: 'Battle Royale', prize: '$2,500', players: '64/128', status: 'open', date: 'Dec 8, 2025', time: '18:00', emoji: '⚔️', tier: 'pro' },
    { id: 3, title: 'Speed Racing Cup', game: 'Racing Thunder', prize: '$5,000', players: '32/64', status: 'open', date: 'Dec 10, 2025', time: '19:00', emoji: '🏎️', tier: 'pro' },
    { id: 4, title: 'Rookie Tournament', game: 'Space Warriors', prize: '$1,000', players: '45/128', status: 'open', date: 'Dec 12, 2025', time: '17:00', emoji: '🚀', tier: 'amateur' }
  ];

  const upcomingEvents = [
    { title: 'Super Cup 2026', date: 'January 2026', prize: '$50,000' },
    { title: 'Masters League', date: 'February 2026', prize: '$25,000' }
  ];

  const getTierColor = (tier) => {
    switch(tier) {
      case 'elite': return 'from-yellow-500 to-orange-500';
      case 'pro': return 'from-cyan-500 to-cyan-400';
      case 'amateur': return 'from-blue-500 to-cyan-500';
      default: return 'from-gray-500 to-gray-700';
    }
  };

  const getTierBadge = (tier) => {
    switch(tier) {
      case 'elite': return { icon: Crown, label: 'Elite' };
      case 'pro': return { icon: Medal, label: 'Pro' };
      case 'amateur': return { icon: Zap, label: 'Amateur' };
      default: return { icon: Trophy, label: 'Open' };
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 relative">
      {/* Coming Soon Overlay */}
      <div className="absolute inset-0 z-50 bg-dark-950/95 backdrop-blur-md flex items-center justify-center">
        <div className="text-center max-w-lg mx-auto px-6">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-2 border-cyan-500/50 flex items-center justify-center animate-pulse">
            <Trophy className="w-12 h-12 text-cyan-400" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {language === 'fr' ? 'Bientôt disponible' : language === 'de' ? 'Bald verfügbar' : language === 'it' ? 'Prossimamente' : 'Coming Soon'}
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            {language === 'fr' 
              ? 'Les tournois arrivent bientôt ! Préparez-vous à affronter les meilleurs joueurs.'
              : language === 'de'
                ? 'Turniere kommen bald! Bereiten Sie sich darauf vor, die besten Spieler herauszufordern.'
                : language === 'it'
                  ? 'I tornei arrivano presto! Preparati a sfidare i migliori giocatori.'
                  : 'Tournaments are coming soon! Get ready to challenge the best players.'}
          </p>
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/50 rounded-full">
            <Zap className="w-5 h-5 text-cyan-400 animate-pulse" />
            <span className="text-cyan-400 font-semibold">
              {language === 'fr' ? 'En développement' : language === 'de' ? 'In Entwicklung' : language === 'it' ? 'In sviluppo' : 'In Development'}
            </span>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 bg-mesh pointer-events-none"></div>
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-50"></div>
      
      <div className="relative z-10 py-8 md:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <Trophy className="w-5 h-5 text-dark-950" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">{t('tournaments')}</h1>
            </div>
            <p className="text-gray-400 text-sm md:text-base">
              {language === 'fr' ? 'Participez aux tournois et gagnez des prix' : 'Participate in tournaments and win prizes'}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
            <div className="bg-dark-900/80 backdrop-blur-xl rounded-lg p-4 border border-white/10 hover:border-cyan-500/30 transition-all">
              <Trophy className="w-6 h-6 text-yellow-500 mb-2" />
              <div className="text-xl md:text-2xl font-bold text-white mb-1">24</div>
              <div className="text-gray-400 text-xs">Active Tournaments</div>
            </div>
            <div className="bg-dark-900/80 backdrop-blur-xl rounded-lg p-4 border border-white/10 hover:border-cyan-500/30 transition-all">
              <Users className="w-6 h-6 text-cyan-500 mb-2" />
              <div className="text-xl md:text-2xl font-bold text-white mb-1">8.5K</div>
              <div className="text-gray-400 text-xs">Participants</div>
            </div>
            <div className="bg-dark-900/80 backdrop-blur-xl rounded-lg p-4 border border-white/10 hover:border-cyan-500/30 transition-all">
              <Coins className="w-6 h-6 text-yellow-400 mb-2" />
              <div className="text-xl md:text-2xl font-bold text-white mb-1">$125K</div>
              <div className="text-gray-400 text-xs">Total Prizes</div>
            </div>
            <div className="bg-dark-900/80 backdrop-blur-xl rounded-lg p-4 border border-white/10 hover:border-cyan-500/30 transition-all">
              <Medal className="w-6 h-6 text-green-500 mb-2" />
              <div className="text-xl md:text-2xl font-bold text-white mb-1">156</div>
              <div className="text-gray-400 text-xs">Winners</div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-5">Active Tournaments</h2>
            <div className="grid md:grid-cols-2 gap-4 md:gap-6">
              {tournaments.map((tournament) => {
                const tierBadge = getTierBadge(tournament.tier);
                const TierIcon = tierBadge.icon;
                
                return (
                  <div key={tournament.id} className="group relative bg-dark-900/80 backdrop-blur-xl rounded-xl p-5 border border-white/10 hover:border-cyan-500/30 transition-all duration-300">
                    <div className="absolute top-4 right-4">
                      {tournament.status === 'live' ? (
                        <div className="flex items-center space-x-1.5 bg-gradient-to-r from-red-500 to-orange-500 px-2.5 py-1 rounded-full animate-pulse">
                          <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                          <span className="text-xs font-bold text-white">LIVE</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1.5 bg-cyan-500/20 border border-cyan-500/50 px-2.5 py-1 rounded-full">
                          <span className="text-xs font-bold text-cyan-400">OPEN</span>
                        </div>
                      )}
                    </div>

                    <div className={`inline-flex items-center space-x-1.5 bg-gradient-to-r ${getTierColor(tournament.tier)} px-2.5 py-1 rounded-full mb-3`}>
                      <TierIcon className="w-3 h-3 text-dark-950" />
                      <span className="text-xs font-bold text-dark-950">{tierBadge.label}</span>
                    </div>

                    <div className="text-4xl mb-3">{tournament.emoji}</div>
                    
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">{tournament.title}</h3>
                    <p className="text-gray-400 text-sm mb-4">{tournament.game}</p>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="flex items-center space-x-2">
                        <Coins className="w-3 h-3 text-yellow-500" />
                        <span className="text-white font-semibold text-sm">{tournament.prize}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Users className="w-3 h-3 text-cyan-500" />
                        <span className="text-white font-semibold text-sm">{tournament.players}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-300 text-xs">{tournament.date}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-300 text-xs">{tournament.time}</span>
                      </div>
                    </div>

                    <button className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-lg text-dark-950 text-sm font-semibold hover:shadow-lg hover:shadow-cyan-500/30 transition-all flex items-center justify-center space-x-2">
                      <span>Join Tournament</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-dark-900/80 backdrop-blur-xl rounded-xl p-6 md:p-10 border border-cyan-500/20">
            <div className="flex items-center space-x-2 mb-6">
              <Calendar className="w-5 h-5 text-cyan-400" />
              <h2 className="text-2xl md:text-3xl font-bold text-white">Upcoming Events</h2>
            </div>

            <div className="space-y-3">
              {upcomingEvents.map((event, index) => (
                <div key={index} className="flex items-center justify-between p-5 bg-dark-800/50 rounded-lg border border-white/5 hover:border-cyan-500/30 transition-all group">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-cyan-400 rounded-lg flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-dark-950" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">{event.title}</h3>
                      <p className="text-gray-400 text-sm">{event.date}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xl md:text-2xl font-bold text-gradient mb-1">{event.prize}</div>
                    <button className="text-cyan-400 text-xs font-medium hover:text-cyan-300 transition-colors flex items-center space-x-1">
                      <span>Learn More</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 text-center">
              <button className="px-6 py-3 bg-white text-dark-950 rounded-lg font-semibold text-sm hover:bg-gray-100 transition-all hover:scale-105 inline-flex items-center space-x-2">
                <span>View All Tournaments</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tournaments;
