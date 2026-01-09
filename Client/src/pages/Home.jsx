import React from 'react';
import { useLanguage } from '../LanguageContext';
import { Sparkles, Zap, Users, Trophy, ArrowRight, Star } from 'lucide-react';

const Home = () => {
  const { t, language } = useLanguage();

  const features = [
    {
      icon: Zap,
      title: t('hardcoreMode'),
      description: t('hardcoreDesc'),
      color: 'from-red-500 to-orange-500'
    },
    {
      icon: Trophy,
      title: t('cdlMode'),
      description: t('cdlDesc'),
      color: 'from-primary-500 to-primary-600'
    },
    {
      icon: Users,
      title: t('tournaments'),
      description: t('tournamentsDesc'),
      color: 'from-accent-500 to-accent-600'
    }
  ];

  const stats = [
    { value: '15K+', label: t('activePlayers') },
    { value: '200+', label: t('ongoingTournaments') },
    { value: '2', label: t('gameModes') },
    { value: '24/7', label: t('support') },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-dark-950 via-dark-900 to-dark-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden w-full">
        {/* Animated Background */}
        <div className="absolute inset-0 w-full overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse-slow"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="relative w-full px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="max-w-7xl mx-auto">
            <div className="text-center space-y-6 animate-slide-up">
              {/* Badge */}
              <div className="inline-flex items-center space-x-2 glass-effect px-4 py-2 rounded-full text-xs">
                <Sparkles className="w-3 h-3 text-primary-500" />
                <span className="text-gray-300">
                  {t('heroBadge')}
                </span>
              </div>

              {/* Main Heading with Animations */}
              <div className="relative py-12 w-full">
                {/* Particle Effect Layer - Full Width */}
                <div className="absolute left-0 right-0 top-0 bottom-0 w-screen -ml-[50vw] left-1/2 overflow-hidden pointer-events-none">
                  {[...Array(50)].map((_, i) => {
                    const size = Math.random() * 6 + 2;
                    const animationClass = `animate-particle-${(i % 4) + 1}`;
                    const startX = Math.random() * 100;
                    const startY = Math.random() * 100;
                    return (
                      <div
                        key={`particle-${i}`}
                        className={`absolute ${animationClass}`}
                        style={{
                          left: `${startX}%`,
                          top: `${startY}%`,
                          width: `${size}px`,
                          height: `${size}px`,
                          animationDelay: `${Math.random() * 5}s`,
                        }}
                      >
                        <div
                          className="w-full h-full rounded-full bg-gradient-to-br from-primary-400 to-accent-400 blur-sm"
                          style={{
                            opacity: Math.random() * 0.6 + 0.2,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Animated Background Content - Full Width */}
                <div className="absolute left-0 right-0 top-0 bottom-0 w-screen -ml-[50vw] left-1/2 flex items-center justify-center overflow-hidden opacity-10">
                  <div className="grid grid-cols-12 gap-6 scale-150">
                    {[...Array(144)].map((_, i) => (
                      <div
                        key={i}
                        className="w-12 h-12 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg animate-float"
                        style={{
                          animationDelay: `${i * 0.1}s`,
                          opacity: Math.random() * 0.5 + 0.3
                        }}
                      />
                    ))}
                  </div>
                </div>
                
                {/* Animated Icons - Full Width */}
                <div className="absolute left-0 right-0 top-0 bottom-0 w-screen -ml-[50vw] left-1/2 overflow-hidden pointer-events-none">
                  <div className="absolute top-10 left-[10%] text-6xl animate-float opacity-20" style={{ animationDelay: '0s' }}>
                    🎮
                  </div>
                  <div className="absolute top-32 right-[15%] text-5xl animate-float opacity-20" style={{ animationDelay: '0.5s' }}>
                    🏆
                  </div>
                  <div className="absolute bottom-20 left-[20%] text-7xl animate-float opacity-20" style={{ animationDelay: '1s' }}>
                    ⚔️
                  </div>
                  <div className="absolute top-48 right-[10%] text-6xl animate-float opacity-20" style={{ animationDelay: '1.5s' }}>
                    🎯
                  </div>
                  <div className="absolute bottom-32 right-[25%] text-5xl animate-float opacity-20" style={{ animationDelay: '2s' }}>
                    👾
                  </div>
                  <div className="absolute top-24 left-[35%] text-6xl animate-float opacity-20" style={{ animationDelay: '2.5s' }}>
                    🚀
                  </div>
                  <div className="absolute bottom-10 right-[30%] text-5xl animate-float opacity-20" style={{ animationDelay: '3s' }}>
                    🔥
                  </div>
                  <div className="absolute top-40 left-[25%] text-6xl animate-float opacity-20" style={{ animationDelay: '3.5s' }}>
                    ⭐
                  </div>
                  <div className="absolute bottom-40 left-[50%] text-5xl animate-float opacity-20" style={{ animationDelay: '4s' }}>
                    💎
                  </div>
                  <div className="absolute top-16 right-[35%] text-6xl animate-float opacity-20" style={{ animationDelay: '4.5s' }}>
                    ⚡
                  </div>
                </div>

                <h1 className="relative text-4xl md:text-6xl font-bold tracking-tight z-10">
                  <span className="text-white">
                    {t('heroTitle1')}
                  </span>
                  <br />
                  <span className="text-gradient">
                    {t('heroTitle2')}
                  </span>
                </h1>
              </div>

              {/* Subtitle */}
              <p className="max-w-2xl mx-auto text-base md:text-lg text-gray-400">
                {t('heroSubtitle')}
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                <button className="group relative px-6 py-3 bg-gradient-to-r from-primary-500 to-accent-500 rounded-lg font-semibold text-sm text-white shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40 transition-all duration-300 hover:scale-105 flex items-center space-x-2">
                  <span>
                    {t('startPlaying')}
                  </span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                
                <button className="px-6 py-3 glass-effect rounded-lg font-semibold text-sm text-white hover:bg-white/10 transition-all duration-300 border border-white/20 hover:border-white/40">
                  {t('viewTournaments')}
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-12 max-w-4xl mx-auto">
                {stats.map((stat, index) => (
                  <div 
                    key={index}
                    className="glass-effect rounded-xl p-4 hover:bg-white/10 transition-all duration-300 group"
                  >
                    <div className="text-2xl md:text-3xl font-bold text-gradient mb-1 group-hover:scale-110 transition-transform">
                      {stat.value}
                    </div>
                    <div className="text-gray-400 text-xs">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              {t('whyNoMercy')}
            </h2>
            <p className="text-gray-400 text-sm md:text-base">
              {t('experienceSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const isTournaments = feature.title === t('tournaments');
              return (
                <div
                  key={index}
                  className="relative group"
                >
                  <div className="glass-effect rounded-xl p-6 hover:bg-white/10 transition-all duration-300 h-full relative">
                    {/* Coming Soon Banner for Tournaments */}
                    {isTournaments && (
                      <div className="absolute top-4 right-4 z-10">
                        <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 rounded-full">
                          <Star className="w-3 h-3 text-yellow-400 animate-pulse" />
                          <span className="text-xs font-semibold text-yellow-400">
                            {language === 'fr' ? 'Bientôt disponible' : language === 'de' ? 'Bald verfügbar' : language === 'it' ? 'Prossimamente' : 'Coming soon'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Icon with gradient background */}
                    <div className="relative mb-4">
                      <div className={`absolute inset-0 bg-gradient-to-r ${feature.color} blur-xl opacity-20 group-hover:opacity-40 transition-opacity`}></div>
                      <div className={`relative w-12 h-12 bg-gradient-to-r ${feature.color} rounded-lg flex items-center justify-center`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      {feature.description}
                    </p>

                    {/* Hover Arrow */}
                    <div className="mt-4 flex items-center text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs font-medium">
                        {t('learnMore')}
                      </span>
                      <ArrowRight className="w-3 h-3 ml-2 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative glass-effect rounded-2xl p-8 md:p-12 text-center overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-accent-500/10 blur-3xl"></div>
            
            <div className="relative space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-primary-500 to-accent-500 rounded-full mb-3">
                <Star className="w-6 h-6 text-white" />
              </div>
              
              <h2 className="text-3xl md:text-4xl font-bold text-white">
                {t('readyToDominate')}
              </h2>
              
              <p className="text-gray-300 text-sm md:text-base max-w-2xl mx-auto">
                {t('ctaSubtitle')}
              </p>
              
              <button className="inline-flex items-center space-x-2 px-6 py-3 bg-white text-dark-950 rounded-lg font-semibold text-sm hover:bg-gray-100 transition-all duration-300 hover:scale-105 shadow-xl">
                <span>
                  {t('signUpNow')}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
