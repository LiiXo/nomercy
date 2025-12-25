import React from 'react';
import { useLanguage } from '../LanguageContext';
import { Gamepad2, Users, TrendingUp, Flame, Zap } from 'lucide-react';

const Games = () => {
  const { t, language } = useLanguage();

  const games = [
    { id: 1, title: 'Battle Royale', category: 'Action', players: '2.5K', status: 'online', image: '🎮', trend: '+25%' },
    { id: 2, title: 'Space Warriors', category: 'Strategy', players: '1.8K', status: 'online', image: '🚀', trend: '+18%' },
    { id: 3, title: 'Racing Thunder', category: 'Racing', players: '3.2K', status: 'hot', image: '🏎️', trend: '+42%' },
    { id: 4, title: 'Fantasy Quest', category: 'RPG', players: '1.2K', status: 'online', image: '⚔️', trend: '+12%' },
    { id: 5, title: 'Cyber Strike', category: 'FPS', players: '4.1K', status: 'hot', image: '🎯', trend: '+55%' },
    { id: 6, title: 'Card Masters', category: 'Card', players: '890', status: 'online', image: '🃏', trend: '+8%' }
  ];

  const categories = ['All', 'Action', 'Strategy', 'RPG', 'FPS', 'Racing'];

  return (
    <div className="min-h-screen bg-dark-950 relative">
      <div className="absolute inset-0 bg-mesh pointer-events-none"></div>
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-50"></div>
      
      <div className="relative z-10 py-8 md:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <Gamepad2 className="w-5 h-5 text-dark-950" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">{t('games')}</h1>
            </div>
            <p className="text-gray-400 text-sm md:text-base">
              {language === 'fr' ? 'Decouvrez nos jeux les plus populaires' : 'Discover our most popular games'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            {categories.map((category, index) => (
              <button key={index} className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${index === 0 ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-dark-950 shadow-lg shadow-cyan-500/30' : 'bg-dark-900/80 border border-white/10 text-gray-300 hover:text-white hover:border-cyan-500/30'}`}>
                {category}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
            {games.map((game) => (
              <div key={game.id} className="group relative bg-dark-900/80 backdrop-blur-xl rounded-xl p-5 border border-white/10 hover:border-cyan-500/30 transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-cyan-500/10">
                <div className="absolute top-4 right-4">
                  {game.status === 'hot' ? (
                    <div className="flex items-center space-x-1 bg-gradient-to-r from-orange-500 to-red-500 px-2.5 py-1 rounded-full">
                      <Flame className="w-3 h-3 text-white" />
                      <span className="text-xs font-bold text-white">HOT</span>
                    </div>
                  ) : (
                    <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
                  )}
                </div>

                <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">{game.image}</div>

                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">{game.title}</h3>
                
                <div className="flex items-center space-x-2 mb-3">
                  <span className="px-2.5 py-1 bg-dark-800/50 border border-white/10 rounded-md text-xs text-gray-300">{game.category}</span>
                  <div className="flex items-center space-x-1 text-cyan-400">
                    <TrendingUp className="w-3 h-3" />
                    <span className="text-xs font-medium">{game.trend}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <div className="flex items-center space-x-2 text-gray-400">
                    <Users className="w-4 h-4" />
                    <span className="text-xs">{game.players} players</span>
                  </div>
                  <button className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-lg text-dark-950 text-xs font-semibold hover:shadow-lg hover:shadow-cyan-500/30 transition-all">
                    Play
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-dark-900/80 backdrop-blur-xl rounded-xl p-6 md:p-10 border border-cyan-500/20">
            <div className="flex items-center space-x-2 mb-5">
              <Flame className="w-5 h-5 text-orange-500" />
              <h2 className="text-2xl md:text-3xl font-bold text-white">
                {language === 'fr' ? 'Jeu de la semaine' : 'Game of the Week'}
              </h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <div>
                <div className="text-7xl mb-4">🎯</div>
                <h3 className="text-3xl font-bold text-white mb-3">Cyber Strike</h3>
                <p className="text-gray-400 text-sm mb-5">
                  {language === 'fr' ? 'Le FPS le plus intense du moment. Affrontez des joueurs du monde entier.' : 'The most intense FPS. Face players from around the world.'}
                </p>
                <button className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-lg text-dark-950 font-semibold hover:shadow-lg hover:shadow-cyan-500/30 transition-all hover:scale-105">
                  {language === 'fr' ? 'Jouer maintenant' : 'Play Now'}
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-dark-800/50 rounded-lg p-4 text-center border border-white/10">
                  <div className="text-2xl font-bold text-gradient mb-1">4.1K</div>
                  <div className="text-gray-400 text-xs">Active Players</div>
                </div>
                <div className="bg-dark-800/50 rounded-lg p-4 text-center border border-white/10">
                  <div className="text-2xl font-bold text-gradient mb-1">4.9</div>
                  <div className="text-gray-400 text-xs">Rating</div>
                </div>
                <div className="bg-dark-800/50 rounded-lg p-4 text-center border border-white/10">
                  <div className="text-2xl font-bold text-gradient mb-1">55%</div>
                  <div className="text-gray-400 text-xs">Growth</div>
                </div>
                <div className="bg-dark-800/50 rounded-lg p-4 text-center border border-white/10">
                  <div className="text-2xl font-bold text-gradient mb-1">24/7</div>
                  <div className="text-gray-400 text-xs">Online</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Games;
