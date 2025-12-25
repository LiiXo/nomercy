import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { Skull, Shield, ArrowRight, Zap, Users, Trophy, ChevronDown } from 'lucide-react';
import { useBackgroundAudio } from '../AudioProvider';

const languages = [
  { code: 'fr', label: 'Français', flag: '/flags/fr.png' },
  { code: 'en', label: 'English', flag: '/flags/gb.png' },
  { code: 'it', label: 'Italiano', flag: '/flags/it.png' },
  { code: 'de', label: 'Deutsch', flag: '/flags/de.png' },
];

const ModeSelection = () => {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { selectMode } = useMode();
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const hoverCtxRef = useRef(null);
  const { requestPlay } = useBackgroundAudio();

  const currentLanguage = languages.find(lang => lang.code === language);

  const handleSelectMode = (mode) => {
    if (mode === 'cdl') return; // CDL temporairement indisponible
    selectMode(mode);
    navigate(`/${mode}`);
  };

  const playHoverSound = () => {
    try {
      if (!hoverCtxRef.current) {
        hoverCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = hoverCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth'; // sharper, more "mechanical" attack
      // Faster, higher chirp to mimic a weapon charge click
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(2400, now + 0.1);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // Fail silently if Web Audio not available.
    }
  };

  // Set page title and ensure shared background audio continues.
  useEffect(() => {
    const titles = {
      fr: 'NoMercy - Choix du mode',
      en: 'NoMercy - Mode Selection',
      it: 'NoMercy - Selezione modalità',
      de: 'NoMercy - Moduswahl',
    };
    document.title = titles[language] || titles.en;
    requestPlay();
  }, [requestPlay, language]);

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-mesh"></div>
      <div className="absolute inset-0 grid-pattern"></div>
      
      {/* Animated gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse-slow"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-400/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>

      {/* Header - Compact */}
      <header className="relative z-10 py-3 md:py-4 border-b border-cyan-500/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center">
            {/* Logo and Title */}
            <div className="flex items-center space-x-3">
              {/* Logo Icon */}
            <div className="relative">
                <div className="absolute inset-0 bg-cyan-500 blur-lg opacity-40"></div>
                <div className="relative w-10 h-10 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/40">
                  <Zap className="w-5 h-5 text-dark-950" />
            </div>
          </div>
          
              {/* Title */}
              <h1 className="text-2xl md:text-3xl font-bold">
            <span className="text-gradient">NoMercy</span>
          </h1>
            </div>
            
            {/* Subtitles */}
            <div className="mt-2 text-center space-y-0.5">
              <p className="text-xs md:text-sm text-gray-400 uppercase tracking-wider">{t('competitionCOD')}</p>
              <p className="text-[10px] md:text-xs text-gray-500 flex items-center justify-center gap-1">
                {t('forUsByUs')} <span className="text-red-500">❤️</span>
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex-grow flex items-center justify-center px-4 py-4 md:py-6 -mt-8">
        <div className="max-w-5xl w-full">
          {/* Mode Selection Title */}
          <div className="text-center mb-4 md:mb-6">
            <p className="text-base md:text-lg text-gray-400">
              {t('selectYourMode')}
            </p>
          </div>

          {/* Mode Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-w-4xl mx-auto">
            {/* CDL Mode */}
            <div
              onClick={() => handleSelectMode('cdl')}
              onMouseEnter={playHoverSound}
              className="group relative rounded-2xl p-5 md:p-6 cursor-not-allowed transition-all duration-500 overflow-hidden bg-dark-900/60 backdrop-blur-xl border border-cyan-500/10 opacity-60"
            >
              {/* Hover Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0"></div>
              
              {/* Corner Accent */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-cyan-500/10 to-transparent"></div>

              <div className="relative z-10">
                {/* Icon */}
                <div className="mb-5">
                  <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-lg shadow-cyan-500/30">
                    <Shield className="w-8 h-8 text-dark-950" />
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
                  CDL
                </h2>

                {/* Description */}
                <p className="text-gray-400 mb-4 text-sm md:text-base">
                  {t('cdlModeDesc')}
                </p>

                {/* Features */}
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center space-x-3 text-gray-300">
                    <div className="w-6 h-6 rounded-md bg-cyan-500/20 flex items-center justify-center">
                      <Shield className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                    <span className="text-sm">{t('officialRules')}</span>
                  </li>
                  <li className="flex items-center space-x-3 text-gray-300">
                    <div className="w-6 h-6 rounded-md bg-cyan-500/20 flex items-center justify-center">
                      <Trophy className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                    <span className="text-sm">{t('competitive')}</span>
                  </li>
                  <li className="flex items-center space-x-3 text-gray-300">
                    <div className="w-6 h-6 rounded-md bg-cyan-500/20 flex items-center justify-center">
                      <Users className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                    <span className="text-sm">{t('teamPlay')}</span>
                  </li>
                </ul>

                {/* Button */}
                <button className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-gray-400 font-bold flex items-center justify-center space-x-2 cursor-not-allowed">
                  <span>{language === 'fr' ? 'Bientôt disponible' : language === 'it' ? 'Prossimamente' : language === 'de' ? 'Bald verfügbar' : 'Coming soon'}</span>
                </button>
              </div>
            </div>

            {/* Hardcore Mode */}
            <div
              onClick={() => handleSelectMode('hardcore')}
              onMouseEnter={playHoverSound}
              className="group relative rounded-2xl p-5 md:p-6 cursor-pointer transition-all duration-500 overflow-hidden bg-dark-900/60 backdrop-blur-xl border border-red-500/20 hover:border-red-400/50 hover:shadow-lg hover:shadow-red-500/20"
            >
              {/* Hover Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              {/* Corner Accent */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/20 to-transparent"></div>

              <div className="relative z-10">
                {/* Icon */}
                <div className="mb-5">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500 shadow-lg shadow-red-500/30">
                    <Skull className="w-8 h-8 text-white" />
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 group-hover:text-red-400 transition-colors">
                  Hardcore
                </h2>

                {/* Description */}
                <p className="text-gray-400 mb-6 text-sm md:text-base">
                  {t('hardcoreModeDesc')}
                </p>

                {/* Features */}
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center space-x-3 text-gray-300">
                    <div className="w-6 h-6 rounded-md bg-red-500/20 flex items-center justify-center">
                      <Zap className="w-3.5 h-3.5 text-red-400" />
                    </div>
                    <span className="text-sm">{t('noHUD')}</span>
                  </li>
                  <li className="flex items-center space-x-3 text-gray-300">
                    <div className="w-6 h-6 rounded-md bg-red-500/20 flex items-center justify-center">
                      <Skull className="w-3.5 h-3.5 text-red-400" />
                    </div>
                    <span className="text-sm">{t('oneShot')}</span>
                  </li>
                  <li className="flex items-center space-x-3 text-gray-300">
                    <div className="w-6 h-6 rounded-md bg-red-500/20 flex items-center justify-center">
                      <Users className="w-3.5 h-3.5 text-red-400" />
                    </div>
                    <span className="text-sm">{t('intenseCombat')}</span>
                  </li>
                </ul>

                {/* Button */}
                <button className="w-full py-3 bg-gradient-to-r from-red-500 to-orange-600 rounded-xl text-white font-bold flex items-center justify-center space-x-2 group-hover:shadow-lg group-hover:shadow-red-500/40 transition-all">
                  <span>{t('playHardcore')}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-cyan-500/10 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Desktop Layout */}
          <div className="hidden md:flex items-center justify-between">
            {/* Logo & Copyright */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Zap className="w-4 h-4 text-dark-950" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">NoMercy</p>
                <p className="text-gray-500 text-xs">© 2025 {t('allRightsReserved')}</p>
              </div>
            </div>

            {/* Links */}
            <div className="flex items-center space-x-6 text-sm">
              <a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">
                {t('termsOfService')}
              </a>
              <a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">
                {t('privacyPolicy')}
              </a>
              <a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">
                {t('contactUs')}
              </a>
            </div>

            {/* Language & Discord */}
            <div className="flex items-center space-x-4">
              {/* Language Selector */}
              <div className="relative">
                <button
                  onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-lg border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all"
                >
                  <img src={currentLanguage.flag} alt={currentLanguage.label} className="w-5 h-5 rounded object-cover" />
                  <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${languageMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {languageMenuOpen && (
                  <div className="absolute bottom-full mb-2 left-0 bg-dark-900/95 backdrop-blur-xl rounded-lg shadow-xl border border-cyan-500/20 p-2 animate-slide-up z-50">
                    <div className="flex flex-col space-y-1">
                      {languages.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setLanguage(lang.code);
                            setLanguageMenuOpen(false);
                          }}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center hover:bg-cyan-500/10 transition-all p-1.5 ${
                            language === lang.code ? 'bg-cyan-500/20 ring-2 ring-cyan-500' : ''
                          }`}
                          title={lang.label}
                        >
                          <img src={lang.flag} alt={lang.label} className="w-full h-full rounded object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Anti-cheat Badge */}
              <div className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-cyan-500/30 bg-cyan-500/5">
                <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <path d="M9 12l2 2 4-4"/>
                </svg>
                <span className="text-xs text-gray-300">
                  {language === 'fr' ? 'Protégé par' : language === 'it' ? 'Protetto da' : language === 'de' ? 'Geschützt durch' : 'Protected by'} <span className="text-cyan-400 font-semibold">GGSecure Anti-Cheat</span>
                </span>
              </div>

              {/* Discord Button */}
              <a
                href="https://discord.gg/tmzDaGTwuV"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] rounded-lg transition-all duration-300"
              >
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                <span className="text-white font-semibold text-sm">Discord</span>
              </a>
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="flex flex-col space-y-4 md:hidden">
            {/* Top row */}
            <div className="flex items-center justify-between">
              {/* Logo & Copyright */}
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-dark-950" />
                </div>
                <div>
                  <p className="text-white font-bold text-xs">NoMercy</p>
                  <p className="text-gray-500 text-[10px]">© 2025</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                {/* Language Selector */}
                <div className="relative">
                  <button
                    onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
                    className="flex items-center space-x-1 px-2 py-1.5 rounded-lg border border-white/10 hover:border-cyan-500/30 transition-all"
                  >
                    <img src={currentLanguage.flag} alt={currentLanguage.label} className="w-4 h-4 rounded object-cover" />
                    <ChevronDown className={`w-2.5 h-2.5 text-gray-400 transition-transform ${languageMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {languageMenuOpen && (
                    <div className="absolute bottom-full mb-2 right-0 bg-dark-900/95 backdrop-blur-xl rounded-lg shadow-xl border border-cyan-500/20 p-1.5 animate-slide-up z-50">
                      <div className="flex flex-col space-y-1">
                        {languages.map((lang) => (
                          <button
                            key={lang.code}
                            onClick={() => {
                              setLanguage(lang.code);
                              setLanguageMenuOpen(false);
                            }}
                            className={`w-9 h-9 rounded-lg flex items-center justify-center hover:bg-cyan-500/10 transition-all p-1.5 ${
                              language === lang.code ? 'bg-cyan-500/20 ring-2 ring-cyan-500' : ''
                            }`}
                            title={lang.label}
                          >
                            <img src={lang.flag} alt={lang.label} className="w-full h-full rounded object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Anti-cheat Badge */}
                <div className="flex items-center space-x-1.5 px-2 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/5">
                  <svg className="w-3.5 h-3.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                  <span className="text-[10px] text-cyan-400 font-semibold">GGSecure</span>
                </div>

                {/* Discord Button */}
                <a
                  href="https://discord.gg/tmzDaGTwuV"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center px-2.5 py-1.5 bg-[#5865F2] hover:bg-[#4752C4] rounded-lg transition-all"
                >
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Links */}
            <div className="flex items-center justify-center space-x-4 text-[10px]">
              <a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">
                {t('termsOfService')}
              </a>
              <a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">
                {t('privacyPolicy')}
              </a>
              <a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">
                {t('contactUs')}
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ModeSelection;
