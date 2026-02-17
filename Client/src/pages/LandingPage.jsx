import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { Skull, Shield, Zap, Users, Trophy, ChevronDown, Target, Flame, Star, ArrowRight, Rocket, Crosshair, Swords, Award } from 'lucide-react';
import { useBackgroundAudio } from '../AudioProvider';

const languages = [
  { code: 'fr', label: 'Français', flag: '/flags/fr.png' },
  { code: 'en', label: 'English', flag: '/flags/gb.png' },
  { code: 'it', label: 'Italiano', flag: '/flags/it.png' },
  { code: 'de', label: 'Deutsch', flag: '/flags/de.png' },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const heroRef = useRef(null);
  const { requestPlay } = useBackgroundAudio();

  const currentLanguage = languages.find(lang => lang.code === language);

  // Mouse parallax effect
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        setMousePos({
          x: (e.clientX - rect.left - rect.width / 2) / 50,
          y: (e.clientY - rect.top - rect.height / 2) / 50,
        });
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const titles = {
      fr: 'NoMercy - Compétition Call of Duty',
      en: 'NoMercy - Call of Duty Competition',
      it: 'NoMercy - Competizione Call of Duty',
      de: 'NoMercy - Call of Duty Wettbewerb',
    };
    document.title = titles[language] || titles.en;
    requestPlay();
  }, [requestPlay, language]);

  const getText = (key) => {
    const texts = {
      heroTitle: { fr: 'NO MERCY', en: 'NO MERCY', it: 'NO MERCY', de: 'NO MERCY' },
      heroSubtitle: { fr: 'COMPÉTITION COD', en: 'COD COMPETITION', it: 'COMPETIZIONE COD', de: 'COD WETTBEWERB' },
      heroDesc: {
        fr: 'La plateforme de compétition Call of Duty nouvelle génération. Rankings, matchmaking en temps réel, anti-cheat intégré.',
        en: 'The next-generation Call of Duty competition platform. Rankings, real-time matchmaking, built-in anti-cheat.',
        it: 'La piattaforma di competizione Call of Duty di nuova generazione. Classifiche, matchmaking in tempo reale, anti-cheat integrato.',
        de: 'Die Call of Duty Wettbewerbsplattform der nächsten Generation. Rankings, Echtzeit-Matchmaking, integrierter Anti-Cheat.',
      },
      enterApp: { fr: 'COMMENCER', en: 'GET STARTED', it: 'INIZIA', de: 'LOSLEGEN' },
      watchTrailer: { fr: 'Rejoindre Discord', en: 'Join Discord', it: 'Unisciti a Discord', de: 'Discord beitreten' },
      features: { fr: 'FONCTIONNALITÉS', en: 'FEATURES', it: 'FUNZIONALITÀ', de: 'FUNKTIONEN' },
      rankedSystem: { fr: 'CLASSEMENT ELO', en: 'ELO RANKING', it: 'CLASSIFICA ELO', de: 'ELO-RANGLISTE' },
      rankedDesc: { fr: 'Système de points compétitif du Bronze au Champion', en: 'Competitive points system from Bronze to Champion', it: 'Sistema di punti competitivo dal Bronzo al Campione', de: 'Wettbewerbsfähiges Punktesystem von Bronze bis Champion' },
      antiCheat: { fr: 'ANTI-CHEAT', en: 'ANTI-CHEAT', it: 'ANTI-CHEAT', de: 'ANTI-CHEAT' },
      antiCheatDesc: { fr: 'Iris protège chaque match', en: 'Iris protects every match', it: 'Iris protegge ogni partita', de: 'Iris schützt jedes Match' },
      rewards: { fr: 'RÉCOMPENSES', en: 'REWARDS', it: 'RICOMPENSE', de: 'BELOHNUNGEN' },
      rewardsDesc: { fr: 'Gagnez des coins et débloquez des cosmétiques', en: 'Earn coins and unlock cosmetics', it: 'Guadagna monete e sblocca cosmetici', de: 'Verdiene Münzen und schalte Cosmetics frei' },
      squadSystem: { fr: 'ESCOUADES', en: 'SQUADS', it: 'SQUADRE', de: 'SQUADS' },
      squadDesc: { fr: 'Créez votre équipe et dominez ensemble', en: 'Create your team and dominate together', it: 'Crea la tua squadra e domina insieme', de: 'Erstelle dein Team und dominiert zusammen' },
      gameModes: { fr: 'MODES DE JEU', en: 'GAME MODES', it: 'MODALITÀ', de: 'SPIELMODI' },
      hardcoreTitle: { fr: 'HARDCORE', en: 'HARDCORE', it: 'HARDCORE', de: 'HARDCORE' },
      hardcoreDesc: { fr: 'Mode classé Solo 4v4 & 5v5 - Sans HUD, dégâts réalistes.', en: 'Solo Ranked 4v4 & 5v5 - No HUD, realistic damage.', it: 'Classifica Solo 4v4 & 5v5 - Senza HUD, danni realistici.', de: 'Solo-Rangliste 4v4 & 5v5 - Kein HUD, realistischer Schaden.' },
      cdlTitle: { fr: 'CDL', en: 'CDL', it: 'CDL', de: 'CDL' },
      cdlDesc: { fr: 'Mode classé Solo 4v4 & 5v5 - Règles officielles CDL.', en: 'Solo Ranked 4v4 & 5v5 - Official CDL rules.', it: 'Classifica Solo 4v4 & 5v5 - Regole ufficiali CDL.', de: 'Solo-Rangliste 4v4 & 5v5 - Offizielle CDL-Regeln.' },
      comingSoon: { fr: 'BIENTÔT', en: 'SOON', it: 'PRESTO', de: 'BALD' },
      stats1: { fr: 'JOUEURS ACTIFS', en: 'ACTIVE PLAYERS', it: 'GIOCATORI ATTIVI', de: 'AKTIVE SPIELER' },
      stats2: { fr: 'MATCHS JOUÉS', en: 'MATCHES PLAYED', it: 'PARTITE GIOCATE', de: 'GESPIELTE MATCHES' },
      stats3: { fr: 'ESCOUADES', en: 'SQUADS', it: 'SQUADRE', de: 'SQUADS' },
    };
    return texts[key]?.[language] || texts[key]?.en || key;
  };

  return (
    <div className="min-h-screen bg-dark-950 overflow-hidden">
      {/* === HERO SECTION === */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col">
        {/* Background layers */}
        <div className="absolute inset-0 bg-dark-base" />
        <div className="absolute inset-0 bg-grid-pattern opacity-50" />
        <div className="absolute inset-0 bg-radial-glow" />
        <div className="absolute inset-0 bg-noise pointer-events-none" />
        
        {/* Animated orbs */}
        <div 
          className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-neon-red/10 rounded-full blur-[150px] animate-pulse-slow"
          style={{ transform: `translate(${mousePos.x * 2}px, ${mousePos.y * 2}px)` }}
        />
        <div 
          className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-neon-orange/10 rounded-full blur-[120px] animate-pulse-slow"
          style={{ transform: `translate(${-mousePos.x * 1.5}px, ${-mousePos.y * 1.5}px)`, animationDelay: '1s' }}
        />

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-neon-red/40 rounded-full animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${6 + Math.random() * 4}s`,
              }}
            />
          ))}
        </div>

        {/* Header */}
        <header className="relative z-20 py-6">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex items-center justify-between">
              {/* Logo */}
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <div className="absolute inset-0 bg-neon-red blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
                  <div className="relative w-14 h-14 bg-gradient-to-br from-neon-red to-neon-orange rounded-2xl flex items-center justify-center shadow-neon-red">
                    <Zap className="w-7 h-7 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-3xl font-display text-gradient-fire tracking-wider">NOMERCY</h1>
                  <p className="text-xs text-gray-500 tracking-[0.3em]">BLACK OPS 7</p>
                </div>
              </div>

              {/* Right side */}
              <div className="flex items-center gap-4">
                {/* Language Selector */}
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
                  href="https://discord.gg/yGgdJGbtQJ"
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

        {/* Hero Content */}
        <div className="relative z-10 flex-grow flex items-center justify-center px-6 py-12">
          <div className="max-w-6xl w-full text-center">
            {/* Main Title */}
            <div className="mb-8 animate-fade-in">
              <h2 className="hero-title font-display text-gradient-fire mb-2">
                {getText('heroTitle')}
              </h2>
              <p className="hero-subtitle font-display text-white/90 tracking-[0.2em]">
                {getText('heroSubtitle')}
              </p>
            </div>

            {/* Description */}
            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 animate-fade-in delay-200">
              {getText('heroDesc')}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in delay-300">
              <button
                onClick={() => navigate('/play')}
                className="group btn-primary text-lg flex items-center gap-3"
              >
                <Crosshair className="w-5 h-5" />
                <span>{getText('enterApp')}</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <a
                href="https://discord.gg/yGgdJGbtQJ"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline flex items-center gap-3 text-white"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                </svg>
                <span>{getText('watchTrailer')}</span>
              </a>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-scroll-indicator">
          <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-neon-red rounded-full animate-bounce" />
          </div>
        </div>
      </section>

      {/* === FEATURES SECTION === */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 bg-dark-base" />
        <div className="absolute inset-0 bg-radial-glow-bottom" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-20">
            <p className="text-neon-red text-sm font-semibold tracking-[0.3em] mb-4">
              {getText('features')}
            </p>
            <h3 className="text-5xl md:text-6xl font-display text-white">
              {language === 'fr' ? 'TOUT CE QU\'IL VOUS FAUT' : 
               language === 'de' ? 'ALLES WAS DU BRAUCHST' :
               language === 'it' ? 'TUTTO CIÒ DI CUI HAI BISOGNO' : 
               'EVERYTHING YOU NEED'}
            </h3>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="group glass-card rounded-3xl p-8 card-hover neon-border-red neon-border-red-hover">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neon-red to-neon-orange flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-2xl font-display text-white mb-3">{getText('rankedSystem')}</h4>
              <p className="text-gray-400">{getText('rankedDesc')}</p>
            </div>

            {/* Feature 2 */}
            <div className="group glass-card rounded-3xl p-8 card-hover neon-border-red neon-border-red-hover">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-2xl font-display text-white mb-3">{getText('antiCheat')}</h4>
              <p className="text-gray-400">{getText('antiCheatDesc')}</p>
            </div>

            {/* Feature 3 */}
            <div className="group glass-card rounded-3xl p-8 card-hover neon-border-red neon-border-red-hover">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Award className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-2xl font-display text-white mb-3">{getText('rewards')}</h4>
              <p className="text-gray-400">{getText('rewardsDesc')}</p>
            </div>

            {/* Feature 4 */}
            <div className="group glass-card rounded-3xl p-8 card-hover neon-border-red neon-border-red-hover">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-2xl font-display text-white mb-3">{getText('squadSystem')}</h4>
              <p className="text-gray-400">{getText('squadDesc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* === GAME MODES SECTION === */}
      <section className="relative py-32">
        <div className="absolute inset-0 bg-dark-base" />
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-20">
            <p className="text-neon-red text-sm font-semibold tracking-[0.3em] mb-4">
              {getText('gameModes')}
            </p>
            <h3 className="text-5xl md:text-6xl font-display text-white">
              {language === 'fr' ? 'CHOISISSEZ VOTRE STYLE' : 
               language === 'de' ? 'WÄHLE DEINEN STIL' :
               language === 'it' ? 'SCEGLI IL TUO STILE' : 
               'CHOOSE YOUR STYLE'}
            </h3>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Hardcore Mode */}
            <div 
              onClick={() => navigate('/play')}
              className="group relative glass-card rounded-3xl p-10 cursor-pointer overflow-hidden card-hover"
              style={{ border: '2px solid rgba(255, 45, 85, 0.3)' }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-neon-red/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-neon-red/20 to-transparent rounded-bl-full" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-neon-red to-neon-orange flex items-center justify-center group-hover:scale-110 transition-transform shadow-neon-red">
                    <Skull className="w-10 h-10 text-white" />
                  </div>
                  <span className="px-4 py-2 rounded-full bg-green-500/20 text-green-400 text-sm font-semibold">
                    {language === 'fr' ? 'DISPONIBLE' : language === 'de' ? 'VERFÜGBAR' : language === 'it' ? 'DISPONIBILE' : 'AVAILABLE'}
                  </span>
                </div>

                <h4 className="text-4xl font-display text-white mb-4 group-hover:text-neon-red transition-colors">
                  {getText('hardcoreTitle')}
                </h4>
                <p className="text-gray-400 text-lg mb-8">{getText('hardcoreDesc')}</p>
              </div>
            </div>

            {/* CDL Mode */}
            <div className="group relative glass-card rounded-3xl p-10 cursor-not-allowed overflow-hidden opacity-60">
              <div className="absolute inset-0 bg-gradient-to-br from-accent-500/5 to-transparent" />
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-accent-500/10 to-transparent rounded-bl-full" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-500 to-blue-600 flex items-center justify-center shadow-neon-cyan">
                    <Shield className="w-10 h-10 text-white" />
                  </div>
                  <span className="px-4 py-2 rounded-full bg-yellow-500/20 text-yellow-400 text-sm font-semibold animate-pulse">
                    {getText('comingSoon')}
                  </span>
                </div>

                <h4 className="text-4xl font-display text-white mb-4">
                  {getText('cdlTitle')}
                </h4>
                <p className="text-gray-400 text-lg mb-8">{getText('cdlDesc')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* === FOOTER === */}
      <footer className="relative py-16 border-t border-white/5">
        <div className="absolute inset-0 bg-dark-base" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-neon-red to-neon-orange rounded-xl flex items-center justify-center shadow-neon-red">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-xl font-display text-white">NOMERCY</p>
                <p className="text-xs text-gray-500">© 2025 {t('allRightsReserved')}</p>
              </div>
            </div>

            {/* Anti-cheat Badge */}
            <a 
              href="https://nomercy.gg" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-5 py-3 rounded-xl glass hover:bg-white/5 transition-all"
            >
              <Shield className="w-5 h-5 text-emerald-400" />
              <span className="text-sm text-gray-300">
                {language === 'fr' ? 'Protégé par' : language === 'it' ? 'Protetto da' : language === 'de' ? 'Geschützt durch' : 'Protected by'}{' '}
                <span className="text-emerald-400 font-semibold">Iris</span>
              </span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
