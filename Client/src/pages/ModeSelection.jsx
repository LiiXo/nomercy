import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { useData } from '../DataContext';
import { Skull, Shield, ArrowRight, Zap, Users, Trophy, ChevronDown, Flame, Target, Crosshair, Lock } from 'lucide-react';
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
  const { isStaff } = useAuth();
  const { isHardcoreModeEnabled, isCdlModeEnabled, appSettingsLoading } = useData();
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [hoveredMode, setHoveredMode] = useState(null);
  const { requestPlay } = useBackgroundAudio();

  const currentLanguage = languages.find(lang => lang.code === language);
  // CDL accessible si le mode est activé OU si staff (staff garde toujours l'accès)
  const canAccessCDL = isCdlModeEnabled || isStaff();
  // Hardcore accessible uniquement si le mode est activé
  const canAccessHardcore = isHardcoreModeEnabled;

  const handleSelectMode = (mode) => {
    if (mode === 'cdl' && !canAccessCDL) return;
    if (mode === 'hardcore' && !canAccessHardcore) return;
    selectMode(mode);
    navigate(`/${mode}`);
  };

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

  const getText = (key) => {
    const texts = {
      chooseMode: { fr: 'CHOISISSEZ VOTRE MODE', en: 'CHOOSE YOUR MODE', it: 'SCEGLI LA TUA MODALITÀ', de: 'WÄHLE DEINEN MODUS' },
      chooseDesc: { fr: 'Sélectionnez un mode de jeu pour commencer la compétition', en: 'Select a game mode to start competing', it: 'Seleziona una modalità di gioco per iniziare a competere', de: 'Wähle einen Spielmodus um zu starten' },
      hardcore: { fr: 'HARDCORE', en: 'HARDCORE', it: 'HARDCORE', de: 'HARDCORE' },
      hardcoreDesc: { fr: 'Mode classé Solo 4v4 & 5v5 - Sans HUD, dégâts réalistes.', en: 'Solo Ranked 4v4 & 5v5 - No HUD, realistic damage.', it: 'Classifica Solo 4v4 & 5v5 - Senza HUD, danni realistici.', de: 'Solo-Rangliste 4v4 & 5v5 - Kein HUD, realistischer Schaden.' },
      cdl: { fr: 'CDL', en: 'CDL', it: 'CDL', de: 'CDL' },
      cdlDesc: { fr: 'Mode classé Solo 4v4 & 5v5 - Règles officielles CDL.', en: 'Solo Ranked 4v4 & 5v5 - Official CDL rules.', it: 'Classifica Solo 4v4 & 5v5 - Regole ufficiali CDL.', de: 'Solo-Rangliste 4v4 & 5v5 - Offizielle CDL-Regeln.' },
      play: { fr: 'JOUER', en: 'PLAY', it: 'GIOCA', de: 'SPIELEN' },
      comingSoon: { fr: 'BIENTÔT', en: 'SOON', it: 'PRESTO', de: 'BALD' },
      noHud: { fr: 'Sans HUD', en: 'No HUD', it: 'Senza HUD', de: 'Kein HUD' },
      oneShot: { fr: 'One Shot', en: 'One Shot', it: 'One Shot', de: 'One Shot' },
      intense: { fr: 'Combat intense', en: 'Intense combat', it: 'Combattimento intenso', de: 'Intensiver Kampf' },
      official: { fr: 'Règles officielles', en: 'Official rules', it: 'Regole ufficiali', de: 'Offizielle Regeln' },
      competitive: { fr: 'Compétitif', en: 'Competitive', it: 'Competitivo', de: 'Wettbewerbsfähig' },
      teamPlay: { fr: 'Jeu d\'équipe', en: 'Team play', it: 'Gioco di squadra', de: 'Teamspiel' },
    };
    return texts[key]?.[language] || texts[key]?.en || key;
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-dark-base" />
      <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      <div className="absolute inset-0 bg-radial-glow" />
      <div className="absolute inset-0 bg-noise pointer-events-none" />
      
      {/* Animated orbs based on hover */}
      <div className={`absolute top-1/4 left-1/3 w-[600px] h-[600px] rounded-full blur-[150px] transition-all duration-1000 ${
        hoveredMode === 'hardcore' ? 'bg-neon-red/20' : hoveredMode === 'cdl' ? 'bg-accent-500/15' : 'bg-neon-red/10'
      }`} />
      <div className={`absolute bottom-1/4 right-1/3 w-[500px] h-[500px] rounded-full blur-[120px] transition-all duration-1000 ${
        hoveredMode === 'hardcore' ? 'bg-neon-orange/15' : hoveredMode === 'cdl' ? 'bg-blue-500/10' : 'bg-neon-orange/5'
      }`} />

      {/* Header */}
      <header className="relative z-10 py-6 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-neon-red blur-xl opacity-50" />
                <div className="relative w-12 h-12 bg-gradient-to-br from-neon-red to-neon-orange rounded-2xl flex items-center justify-center shadow-neon-red">
                  <Zap className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-display text-gradient-fire tracking-wider">NOMERCY</h1>
                <p className="text-xs text-gray-500 tracking-[0.2em]">BLACK OPS 7</p>
              </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-4">
              {/* Language */}
              <div className="relative">
                <button
                  onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass hover:bg-white/10 transition-all"
                >
                  <img src={currentLanguage.flag} alt="" className="w-5 h-5 rounded object-cover" />
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${languageMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {languageMenuOpen && (
                  <div className="absolute top-full mt-2 right-0 glass rounded-xl p-2 animate-scale-in z-50">
                    <div className="flex flex-col gap-1">
                      {languages.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => { setLanguage(lang.code); setLanguageMenuOpen(false); }}
                          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all hover:bg-white/10 ${
                            language === lang.code ? 'bg-neon-red/20 ring-2 ring-neon-red' : ''
                          }`}
                        >
                          <img src={lang.flag} alt={lang.label} className="w-6 h-6 rounded object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Discord */}
              <a
                href="https://discord.gg/tmzDaGTwuV"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-[#5865F2] hover:bg-[#4752C4] rounded-xl text-white font-medium transition-all hover:scale-105"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                </svg>
                <span>Discord</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex-grow flex items-center justify-center px-6 py-12">
        <div className="max-w-6xl w-full">
          {/* Title */}
          <div className="text-center mb-12">
            <h2 className="text-5xl md:text-6xl font-display text-white mb-4">
              {getText('chooseMode')}
            </h2>
            <p className="text-lg text-gray-400">
              {getText('chooseDesc')}
            </p>
          </div>

          {/* Mode Cards */}
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Hardcore Mode */}
            <div
              onClick={() => canAccessHardcore && handleSelectMode('hardcore')}
              onMouseEnter={() => setHoveredMode('hardcore')}
              onMouseLeave={() => setHoveredMode(null)}
              className={`group relative glass-card rounded-3xl p-8 overflow-hidden ${
                canAccessHardcore
                  ? 'cursor-pointer card-hover'
                  : 'cursor-not-allowed opacity-60'
              }`}
              style={{ border: `2px solid rgba(255, 45, 85, ${canAccessHardcore ? '0.3' : '0.2'})` }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br from-neon-red/10 to-transparent ${canAccessHardcore ? 'opacity-0 group-hover:opacity-100' : ''} transition-all duration-500`} />
              <div className={`absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-neon-red/30 to-transparent rounded-bl-full ${canAccessHardcore ? 'opacity-0 group-hover:opacity-100' : 'opacity-0'} transition-all duration-500`} />
              
              <div className="relative z-10">
                {/* Icon */}
                <div className="flex items-center justify-between mb-8">
                  <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br from-neon-red to-neon-orange flex items-center justify-center ${canAccessHardcore ? 'group-hover:scale-110 group-hover:rotate-3' : ''} transition-all duration-500 shadow-neon-red`}>
                    <Skull className="w-10 h-10 text-white" />
                  </div>
                  {canAccessHardcore ? (
                    <div className="px-4 py-2 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-bold">
                      {language === 'fr' ? 'DISPONIBLE' : language === 'de' ? 'VERFÜGBAR' : language === 'it' ? 'DISPONIBILE' : 'AVAILABLE'}
                    </div>
                  ) : (
                    <div className="px-4 py-2 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-bold flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      {language === 'fr' ? 'FERMÉ' : language === 'de' ? 'GESCHLOSSEN' : language === 'it' ? 'CHIUSO' : 'CLOSED'}
                    </div>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-4xl font-display text-white mb-4 group-hover:text-neon-red transition-colors">
                  {getText('hardcore')}
                </h3>

                {/* Description */}
                <p className="text-gray-400 text-lg mb-8">
                  {getText('hardcoreDesc')}
                </p>

                {/* Features */}
                <div className="flex flex-wrap gap-3 mb-8">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                    <Crosshair className="w-4 h-4 text-neon-red" />
                    <span className="text-sm text-gray-300">{getText('noHud')}</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                    <Target className="w-4 h-4 text-neon-red" />
                    <span className="text-sm text-gray-300">{getText('oneShot')}</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                    <Flame className="w-4 h-4 text-neon-red" />
                    <span className="text-sm text-gray-300">{getText('intense')}</span>
                  </div>
                </div>

                {/* Button */}
                {canAccessHardcore ? (
                  <button className="w-full py-4 bg-gradient-to-r from-neon-red to-neon-orange rounded-xl text-white font-bold text-lg flex items-center justify-center gap-3 group-hover:shadow-neon-red-lg transition-all duration-500 hover:scale-[1.02]">
                    <span>{getText('play')}</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                ) : (
                  <div className="w-full py-4 bg-white/5 border border-white/10 rounded-xl text-gray-500 font-bold text-lg text-center">
                    {language === 'fr' ? 'MODE FERMÉ' : language === 'de' ? 'MODUS GESCHLOSSEN' : language === 'it' ? 'MODALITÀ CHIUSA' : 'MODE CLOSED'}
                  </div>
                )}
              </div>
            </div>

            {/* CDL Mode */}
            <div
              onClick={() => canAccessCDL && handleSelectMode('cdl')}
              onMouseEnter={() => setHoveredMode('cdl')}
              onMouseLeave={() => setHoveredMode(null)}
              className={`group relative glass-card rounded-3xl p-8 overflow-hidden ${
                canAccessCDL 
                  ? 'cursor-pointer card-hover' 
                  : 'cursor-not-allowed opacity-60'
              }`}
              style={{ border: `2px solid rgba(0, 212, 255, ${canAccessCDL ? '0.3' : '0.2'})` }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br from-accent-500/10 to-transparent ${canAccessCDL ? 'opacity-0 group-hover:opacity-100' : ''} transition-all duration-500`} />
              <div className={`absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-accent-500/30 to-transparent rounded-bl-full ${canAccessCDL ? 'opacity-0 group-hover:opacity-100' : 'opacity-0'} transition-all duration-500`} />
              
              <div className="relative z-10">
                {/* Icon */}
                <div className="flex items-center justify-between mb-8">
                  <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-500 to-blue-600 flex items-center justify-center shadow-neon-cyan ${canAccessCDL ? 'group-hover:scale-110 group-hover:rotate-3' : ''} transition-all duration-500`}>
                    <Shield className="w-10 h-10 text-white" />
                  </div>
                  {canAccessCDL ? (
                    isCdlModeEnabled ? (
                      <div className="px-4 py-2 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-bold">
                        {language === 'fr' ? 'DISPONIBLE' : language === 'de' ? 'VERFÜGBAR' : language === 'it' ? 'DISPONIBILE' : 'AVAILABLE'}
                      </div>
                    ) : (
                      <div className="px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-400 text-sm font-bold">
                        STAFF ACCESS
                      </div>
                    )
                  ) : (
                    <div className="px-4 py-2 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-sm font-bold animate-pulse">
                      {getText('comingSoon')}
                    </div>
                  )}
                </div>

                {/* Title */}
                <h3 className={`text-4xl font-display text-white mb-4 ${canAccessCDL ? 'group-hover:text-accent-400' : ''} transition-colors`}>
                  {getText('cdl')}
                </h3>

                {/* Description */}
                <p className="text-gray-400 text-lg mb-8">
                  {getText('cdlDesc')}
                </p>

                {/* Features */}
                <div className="flex flex-wrap gap-3 mb-8">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                    <Shield className="w-4 h-4 text-accent-400" />
                    <span className="text-sm text-gray-300">{getText('official')}</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                    <Trophy className="w-4 h-4 text-accent-400" />
                    <span className="text-sm text-gray-300">{getText('competitive')}</span>
                  </div>
                </div>

                {/* Button */}
                {canAccessCDL ? (
                  <button className="w-full py-4 bg-gradient-to-r from-accent-500 to-blue-600 rounded-xl text-white font-bold text-lg flex items-center justify-center gap-3 group-hover:shadow-neon-cyan-lg transition-all duration-500 hover:scale-[1.02]">
                    <span>{getText('play')}</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                ) : (
                  <div className="w-full py-4 bg-white/5 border border-white/10 rounded-xl text-gray-500 font-bold text-lg text-center">
                    {getText('comingSoon')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 py-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-neon-red to-neon-orange rounded-xl flex items-center justify-center shadow-neon-red">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-display text-lg">NOMERCY</p>
                <p className="text-xs text-gray-500">© 2025 {t('allRightsReserved')}</p>
              </div>
            </div>

            {/* Links */}
            <div className="flex items-center gap-6 text-sm">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">{t('termsOfService')}</a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">{t('privacyPolicy')}</a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">{t('contactUs')}</a>
            </div>

            {/* GGSecure */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl glass">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-gray-300">
                {language === 'fr' ? 'Protégé par' : 'Protected by'} <span className="text-emerald-400 font-semibold">GGSecure</span>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ModeSelection;
