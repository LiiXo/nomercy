import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { Skull, Shield, Zap, Users, Trophy, ChevronDown, Target, Crosshair, Flame, Star, Clock, ArrowRight, Rocket } from 'lucide-react';
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
  const hoverCtxRef = useRef(null);
  const { requestPlay } = useBackgroundAudio();

  const currentLanguage = languages.find(lang => lang.code === language);

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

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(2400, now + 0.1);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // Fail silently
    }
  };

  // Set page title and kick background audio on mount.
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
      heroTitle: {
        fr: 'La compétition Call of Duty',
        en: 'Call of Duty Competition',
        it: 'Competizione Call of Duty',
        de: 'Call of Duty Wettbewerb',
      },
      heroSubtitle: {
        fr: 'sans compromis',
        en: 'without compromise',
        it: 'senza compromessi',
        de: 'ohne Kompromisse',
      },
      heroDesc: {
        fr: 'Rejoignez la nouvelle plateforme de compétition Hardcore et CDL sur Black Ops 7.\nClassements, tournois automatisés, récompenses et anti-cheat intégré.',
        en: 'Join the new Hardcore and CDL competition platform on Black Ops 7.\nRankings, automated tournaments, rewards and built-in anti-cheat.',
        it: 'Unisciti alla nuova piattaforma di competizione Hardcore e CDL su Black Ops 7.\nClassifiche, tornei automatizzati, premi e anti-cheat integrato.',
        de: 'Tritt der neuen Hardcore- und CDL-Wettbewerbsplattform auf Black Ops 7 bei.\nRanglisten, automatisierte Turniere, Belohnungen und integrierter Anti-Cheat.',
      },
      enterApp: {
        fr: 'Entrer dans l\'app',
        en: 'Enter the app',
        it: 'Entra nell\'app',
        de: 'App betreten',
      },
      comingSoon: {
        fr: 'Bientôt disponible',
        en: 'Coming Soon',
        it: 'Prossimamente',
        de: 'Bald verfügbar',
      },
      features: {
        fr: 'Fonctionnalités',
        en: 'Features',
        it: 'Funzionalità',
        de: 'Funktionen',
      },
      rankedSystem: {
        fr: 'Système de classement',
        en: 'Ranking System',
        it: 'Sistema di classificazione',
        de: 'Ranglisten-System',
      },
      rankedDesc: {
        fr: 'Grimpez les échelons du Bronze au Champion avec notre système ELO compétitif.',
        en: 'Climb the ranks from Bronze to Champion with our competitive ELO system.',
        it: 'Scala le classifiche dal Bronzo al Campione con il nostro sistema ELO competitivo.',
        de: 'Klettere von Bronze bis Champion mit unserem kompetitiven ELO-System.',
      },
      antiCheat: {
        fr: 'Anti-Cheat Intégré',
        en: 'Built-in Anti-Cheat',
        it: 'Anti-Cheat Integrato',
        de: 'Integrierter Anti-Cheat',
      },
      antiCheatDesc: {
        fr: 'GGSecure protège chaque match pour une compétition équitable.',
        en: 'GGSecure protects every match for fair competition.',
        it: 'GGSecure protegge ogni partita per una competizione equa.',
        de: 'GGSecure schützt jedes Match für fairen Wettbewerb.',
      },
      rewards: {
        fr: 'Récompenses',
        en: 'Rewards',
        it: 'Ricompense',
        de: 'Belohnungen',
      },
      rewardsDesc: {
        fr: 'Gagnez des coins, débloquez des cosmétiques et montrez votre skill.',
        en: 'Earn coins, unlock cosmetics and show your skill.',
        it: 'Guadagna monete, sblocca cosmetici e mostra la tua abilità.',
        de: 'Verdiene Münzen, schalte Cosmetics frei und zeige dein Können.',
      },
      automatedTournaments: {
        fr: 'Tournois automatisés',
        en: 'Automated tournaments',
        it: 'Tornei automatizzati',
        de: 'Automatisierte Turniere',
      },
      automatedTournamentsDesc: {
        fr: 'Créneaux programmés, brackets, résultats et récompenses gérés automatiquement.',
        en: 'Scheduled slots, brackets, results and rewards fully automated.',
        it: 'Slot programmati, bracket, risultati e ricompense totalmente automatizzati.',
        de: 'Geplante Slots, Brackets, Ergebnisse und Belohnungen voll automatisiert.',
      },
      squadSystem: {
        fr: 'Système d\'équipes',
        en: 'Squad System',
        it: 'Sistema di Squadre',
        de: 'Team-System',
      },
      squadDesc: {
        fr: 'Créez ou rejoignez une équipe et dominez ensemble.',
        en: 'Create or join a squad and dominate together.',
        it: 'Crea o unisciti a una squadra e domina insieme.',
        de: 'Erstelle oder tritt einem Team bei und dominiert zusammen.',
      },
      noHUD: {
        fr: 'Pas de HUD',
        en: 'No HUD',
        it: 'Nessun HUD',
        de: 'Kein HUD',
      },
      oneShot: {
        fr: 'One Shot Kill',
        en: 'One Shot Kill',
        it: 'One Shot Kill',
        de: 'One Shot Kill',
      },
      intenseCombat: {
        fr: 'Combat intense',
        en: 'Intense combat',
        it: 'Combattimento intenso',
        de: 'Intensiver Kampf',
      },
      officialRules: {
        fr: 'Règles officielles',
        en: 'Official rules',
        it: 'Regole ufficiali',
        de: 'Offizielle Regeln',
      },
      competitive: {
        fr: 'Compétitif',
        en: 'Competitive',
        it: 'Competitivo',
        de: 'Wettbewerbsorientiert',
      },
      teamPlay: {
        fr: 'Jeu d\'équipe',
        en: 'Team play',
        it: 'Gioco di squadra',
        de: 'Teamplay',
      },
      andMuchMore: {
        fr: 'Et bien plus encore',
        en: 'And much more',
        it: 'E molto altro',
        de: 'Und vieles mehr',
      },
      andMuchMoreDesc: {
        fr: 'De nouvelles fonctionnalités arrivent régulièrement. Restez connectés !',
        en: 'New features coming regularly. Stay tuned!',
        it: 'Nuove funzionalità in arrivo regolarmente. Restate sintonizzati!',
        de: 'Neue Funktionen kommen regelmäßig. Bleibt dran!',
      },
      gameModes: {
        fr: 'Modes de jeu',
        en: 'Game Modes',
        it: 'Modalità di gioco',
        de: 'Spielmodi',
      },
      hardcoreTitle: {
        fr: 'Mode Hardcore',
        en: 'Hardcore Mode',
        it: 'Modalità Hardcore',
        de: 'Hardcore-Modus',
      },
      hardcoreDesc: {
        fr: 'Sans HUD, dégâts réalistes. Pour les vrais.',
        en: 'No HUD, realistic damage. For the real ones.',
        it: 'Senza HUD, danni realistici. Per i veri.',
        de: 'Kein HUD, realistischer Schaden. Für die Echten.',
      },
      cdlTitle: {
        fr: 'Mode CDL',
        en: 'CDL Mode',
        it: 'Modalità CDL',
        de: 'CDL-Modus',
      },
      cdlDesc: {
        fr: 'Règles officielles de la Call of Duty League.',
        en: 'Official Call of Duty League rules.',
        it: 'Regole ufficiali della Call of Duty League.',
        de: 'Offizielle Call of Duty League Regeln.',
      },
      available: {
        fr: 'Disponible',
        en: 'Available',
        it: 'Disponibile',
        de: 'Verfügbar',
      },
      comingSoonBtn: {
        fr: 'À bientôt',
        en: 'Coming Soon',
        it: 'A presto',
        de: 'Bis bald',
      },
      joinDiscord: {
        fr: 'Rejoins notre Discord',
        en: 'Join our Discord',
        it: 'Unisciti al nostro Discord',
        de: 'Tritt unserem Discord bei',
      },
    };
    return texts[key]?.[language] || texts[key]?.en || key;
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-mesh"></div>
      <div className="absolute inset-0 grid-pattern"></div>
      
      {/* Animated gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-red-500/10 rounded-full blur-[120px] animate-pulse-slow"></div>
      <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/2 right-1/3 w-[300px] h-[300px] bg-orange-500/5 rounded-full blur-[80px] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-500/30 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${5 + Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="relative z-20 py-4 md:py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="relative z-50">
                <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-50"></div>
                <div className="relative w-12 h-12 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/40">
                  <Zap className="w-6 h-6 text-dark-950" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gradient">NoMercy</h1>
                <p className="text-[10px] md:text-xs text-gray-500">Black Ops 7</p>
              </div>
            </div>

            {/* Language Selector */}
            <div className="relative z-50">
              <button
                onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all"
              >
                <img src={currentLanguage.flag} alt={currentLanguage.label} className="w-5 h-5 rounded object-cover pointer-events-none" />
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${languageMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {languageMenuOpen && (
                <div className="absolute top-full mt-2 right-0 bg-dark-900/95 backdrop-blur-xl rounded-lg shadow-xl border border-cyan-500/20 p-2 animate-slide-up z-50">
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
                        <img src={lang.flag} alt={lang.label} className="w-full h-full rounded object-cover pointer-events-none" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 flex-grow flex items-center justify-center px-4 py-8 md:py-16">
        <div className="max-w-6xl w-full text-center">
          {/* Main Title */}
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-2 leading-tight">
            {getText('heroTitle')}
          </h2>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-black mb-6 leading-tight">
            <span className="text-gradient bg-gradient-to-r from-red-500 via-orange-500 to-red-500 bg-clip-text text-transparent">
              {getText('heroSubtitle')}
            </span>
          </h2>

          {/* Description */}
          <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-10 whitespace-pre-line">
            {getText('heroDesc')}
          </p>

          {/* CTA Button */}
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => navigate('/play')}
              className="group inline-flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 rounded-xl text-white font-bold text-lg shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition-all duration-300 hover:scale-105"
            >
              <span>{getText('enterApp')}</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            
            {/* Discord Link */}
            <a
              href="https://discord.gg/yGgdJGbtQJ"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center space-x-2 px-6 py-3 bg-[#5865F2]/20 border border-[#5865F2]/50 rounded-xl text-[#5865F2] font-medium hover:bg-[#5865F2]/30 hover:border-[#5865F2] transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span>{getText('joinDiscord')}</span>
            </a>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 mt-16">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-black text-white">2</div>
              <div className="text-sm text-gray-500">{getText('gameModes')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-black text-cyan-400">∞</div>
              <div className="text-sm text-gray-500">Matchs</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-black text-red-400">0</div>
              <div className="text-sm text-gray-500">Cheaters</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 px-4 py-16 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-2xl md:text-3xl font-bold text-white text-center mb-12">
            {getText('features')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {/* Feature 1 */}
            <div className="group p-6 rounded-2xl bg-dark-900/60 backdrop-blur-xl border border-white/5 hover:border-cyan-500/30 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Trophy className="w-6 h-6 text-dark-950" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">{getText('rankedSystem')}</h4>
              <p className="text-sm text-gray-400">{getText('rankedDesc')}</p>
            </div>

            {/* Feature 2 */}
            <div className="group p-6 rounded-2xl bg-dark-900/60 backdrop-blur-xl border border-white/5 hover:border-cyan-500/30 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6 text-dark-950" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">{getText('antiCheat')}</h4>
              <p className="text-sm text-gray-400">{getText('antiCheatDesc')}</p>
            </div>

            {/* Feature 3 */}
            <div className="group p-6 rounded-2xl bg-dark-900/60 backdrop-blur-xl border border-white/5 hover:border-cyan-500/30 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Star className="w-6 h-6 text-dark-950" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">{getText('rewards')}</h4>
              <p className="text-sm text-gray-400">{getText('rewardsDesc')}</p>
            </div>

            {/* Feature 4 */}
            <div className="group p-6 rounded-2xl bg-dark-900/60 backdrop-blur-xl border border-white/5 hover:border-cyan-500/30 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 text-dark-950" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">{getText('squadSystem')}</h4>
              <p className="text-sm text-gray-400">{getText('squadDesc')}</p>
            </div>

            {/* Feature 5 */}
            <div className="group p-6 rounded-2xl bg-dark-900/60 backdrop-blur-xl border border-white/5 hover:border-cyan-500/30 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6 text-dark-950" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">{getText('automatedTournaments')}</h4>
              <p className="text-sm text-gray-400">{getText('automatedTournamentsDesc')}</p>
            </div>
          </div>

          {/* And much more - centered below */}
          <div className="flex justify-center mt-8">
            <div className="group flex items-center space-x-3 px-6 py-3 rounded-full bg-dark-900/60 backdrop-blur-xl border border-white/10 hover:border-pink-500/30 transition-all duration-300">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Rocket className="w-5 h-5 text-dark-950" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">{getText('andMuchMore')}</h4>
                <p className="text-xs text-gray-400">{getText('andMuchMoreDesc')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Game Modes Section */}
      <section className="relative z-10 px-4 py-16 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <h3 className="text-2xl md:text-3xl font-bold text-white text-center mb-12">
            {getText('gameModes')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Hardcore Mode */}
            <div
              onMouseEnter={playHoverSound}
              className="group relative p-6 rounded-2xl bg-dark-900/60 backdrop-blur-xl border border-red-500/20 hover:border-red-400/50 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-500 cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/20 to-transparent rounded-tr-2xl"></div>

              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500 shadow-lg shadow-red-500/30">
                <Skull className="w-7 h-7 text-white" />
              </div>

              <h4 className="text-2xl font-bold text-white mb-2 group-hover:text-red-400 transition-colors">
                {getText('hardcoreTitle')}
              </h4>
              <p className="text-gray-400 mb-4">{getText('hardcoreDesc')}</p>

              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-red-400" />
                  <span>{getText('noHUD')}</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Skull className="w-4 h-4 text-red-400" />
                  <span>{getText('oneShot')}</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-red-400" />
                  <span>{getText('intenseCombat')}</span>
                </li>
              </ul>
            </div>

            {/* CDL Mode */}
            <div
              onMouseEnter={playHoverSound}
              className="group relative p-6 rounded-2xl bg-dark-900/60 backdrop-blur-xl border border-cyan-500/20 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/20 transition-all duration-500 cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-cyan-500/10 to-transparent rounded-tr-2xl"></div>

              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/30 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                <Shield className="w-7 h-7 text-dark-950" />
              </div>

              <h4 className="text-2xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                {getText('cdlTitle')}
              </h4>
              <p className="text-gray-400 mb-4">{getText('cdlDesc')}</p>

              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span>{getText('officialRules')}</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Trophy className="w-4 h-4 text-cyan-400" />
                  <span>{getText('competitive')}</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span>{getText('teamPlay')}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-cyan-500/10 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
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

            {/* Anti-cheat Badge */}
            <a href="https://ggsecure.io" target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 transition-all">
              <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="M9 12l2 2 4-4"/>
              </svg>
              <span className="text-xs text-gray-300">
                {language === 'fr' ? 'Protégé par' : language === 'it' ? 'Protetto da' : language === 'de' ? 'Geschützt durch' : 'Protected by'} <span className="text-cyan-400 font-semibold">GGSecure Anti-Cheat</span></span></a>
          </div>
        </div>
      </footer>

      {/* CSS for floating animation */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          25% { transform: translateY(-20px) translateX(10px); opacity: 0.6; }
          50% { transform: translateY(-10px) translateX(-5px); opacity: 0.4; }
          75% { transform: translateY(-30px) translateX(5px); opacity: 0.5; }
        }
        .animate-float {
          animation: float 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default LandingPage;

