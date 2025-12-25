import React, { useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { Shield, Eye, Cpu, Lock, CheckCircle, ArrowLeft, Zap, Server, Fingerprint, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';

const Anticheat = () => {
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const { user, login } = useAuth();

  const isHardcore = selectedMode === 'hardcore';
  const gradientFrom = isHardcore ? 'from-red-500' : 'from-cyan-500';
  const gradientTo = isHardcore ? 'to-orange-600' : 'to-blue-600';
  const borderColor = isHardcore ? 'border-red-500/20' : 'border-cyan-500/20';
  const textAccent = isHardcore ? 'text-red-400' : 'text-cyan-400';
  const bgAccent = isHardcore ? 'bg-red-500/10' : 'bg-cyan-500/10';

  const getText = (key) => {
    const texts = {
      pageTitle: {
        fr: 'Anti-Cheat',
        en: 'Anti-Cheat',
        it: 'Anti-Cheat',
        de: 'Anti-Cheat',
      },
      pageSubtitle: {
        fr: 'Système de protection NoMercy pour un jeu équitable',
        en: 'NoMercy protection system for fair play',
        it: 'Sistema di protezione NoMercy per un gioco equo',
        de: 'NoMercy-Schutzsystem für faires Spielen',
      },
      back: {
        fr: 'Retour',
        en: 'Back',
        it: 'Indietro',
        de: 'Zurück',
      },
      whyAnticheat: {
        fr: 'Pourquoi un Anti-Cheat ?',
        en: 'Why Anti-Cheat?',
        it: 'Perché un Anti-Cheat?',
        de: 'Warum Anti-Cheat?',
      },
      whyDesc: {
        fr: 'NoMercy utilise un système anti-triche avancé pour garantir une compétition équitable. Notre objectif est de créer un environnement où le talent et les compétences sont les seuls facteurs de succès.',
        en: 'NoMercy uses an advanced anti-cheat system to ensure fair competition. Our goal is to create an environment where talent and skills are the only factors for success.',
        it: 'NoMercy utilizza un sistema anti-cheat avanzato per garantire una competizione equa. Il nostro obiettivo è creare un ambiente in cui talento e abilità siano gli unici fattori di successo.',
        de: 'NoMercy verwendet ein fortschrittliches Anti-Cheat-System, um einen fairen Wettbewerb zu gewährleisten. Unser Ziel ist es, eine Umgebung zu schaffen, in der Talent und Fähigkeiten die einzigen Erfolgsfaktoren sind.',
      },
      howItWorks: {
        fr: 'Comment ça fonctionne',
        en: 'How it works',
        it: 'Come funziona',
        de: 'Wie es funktioniert',
      },
      feature1Title: {
        fr: 'Détection en temps réel',
        en: 'Real-time detection',
        it: 'Rilevamento in tempo reale',
        de: 'Echtzeit-Erkennung',
      },
      feature1Desc: {
        fr: 'Notre système surveille en permanence les processus suspects et les modifications de mémoire pendant les parties.',
        en: 'Our system constantly monitors suspicious processes and memory modifications during matches.',
        it: 'Il nostro sistema monitora costantemente processi sospetti e modifiche alla memoria durante le partite.',
        de: 'Unser System überwacht während der Spiele ständig verdächtige Prozesse und Speicheränderungen.',
      },
      feature2Title: {
        fr: 'Analyse comportementale',
        en: 'Behavioral analysis',
        it: 'Analisi comportamentale',
        de: 'Verhaltensanalyse',
      },
      feature2Desc: {
        fr: 'Intelligence artificielle analysant les patterns de jeu pour détecter les comportements anormaux.',
        en: 'Artificial intelligence analyzing gameplay patterns to detect abnormal behaviors.',
        it: 'Intelligenza artificiale che analizza i pattern di gioco per rilevare comportamenti anomali.',
        de: 'Künstliche Intelligenz analysiert Spielmuster, um abnormales Verhalten zu erkennen.',
      },
      feature3Title: {
        fr: 'Signature de fichiers',
        en: 'File signature',
        it: 'Firma dei file',
        de: 'Dateisignatur',
      },
      feature3Desc: {
        fr: 'Vérification de l\'intégrité des fichiers du jeu et détection des modifications non autorisées.',
        en: 'Verification of game file integrity and detection of unauthorized modifications.',
        it: 'Verifica dell\'integrità dei file di gioco e rilevamento di modifiche non autorizzate.',
        de: 'Überprüfung der Spieledatei-Integrität und Erkennung unbefugter Änderungen.',
      },
      feature4Title: {
        fr: 'Base de données cloud',
        en: 'Cloud database',
        it: 'Database cloud',
        de: 'Cloud-Datenbank',
      },
      feature4Desc: {
        fr: 'Mise à jour continue des signatures de cheats connus via notre infrastructure cloud.',
        en: 'Continuous update of known cheat signatures via our cloud infrastructure.',
        it: 'Aggiornamento continuo delle firme dei cheat noti tramite la nostra infrastruttura cloud.',
        de: 'Kontinuierliche Aktualisierung bekannter Cheat-Signaturen über unsere Cloud-Infrastruktur.',
      },
      requirements: {
        fr: 'Prérequis',
        en: 'Requirements',
        it: 'Requisiti',
        de: 'Anforderungen',
      },
      req1: {
        fr: 'Windows 10 ou supérieur (64-bit)',
        en: 'Windows 10 or higher (64-bit)',
        it: 'Windows 10 o superiore (64-bit)',
        de: 'Windows 10 oder höher (64-bit)',
      },
      req2: {
        fr: 'Droits administrateur pour l\'installation',
        en: 'Administrator rights for installation',
        it: 'Diritti di amministratore per l\'installazione',
        de: 'Administratorrechte für die Installation',
      },
      req3: {
        fr: 'Connexion internet stable',
        en: 'Stable internet connection',
        it: 'Connessione internet stabile',
        de: 'Stabile Internetverbindung',
      },
      req4: {
        fr: '50 MB d\'espace disque disponible',
        en: '50 MB of available disk space',
        it: '50 MB di spazio su disco disponibile',
        de: '50 MB verfügbarer Speicherplatz',
      },
      privacy: {
        fr: 'Confidentialité',
        en: 'Privacy',
        it: 'Privacy',
        de: 'Datenschutz',
      },
      privacyDesc: {
        fr: 'Notre anti-cheat est conçu avec la confidentialité en priorité. Il ne collecte que les informations strictement nécessaires à la détection de triche et ne surveille pas vos activités personnelles en dehors du jeu.',
        en: 'Our anti-cheat is designed with privacy as a priority. It only collects information strictly necessary for cheat detection and does not monitor your personal activities outside of the game.',
        it: 'Il nostro anti-cheat è progettato con la privacy come priorità. Raccoglie solo le informazioni strettamente necessarie per il rilevamento dei cheat e non monitora le tue attività personali al di fuori del gioco.',
        de: 'Unser Anti-Cheat ist mit Datenschutz als Priorität konzipiert. Es sammelt nur Informationen, die für die Cheat-Erkennung unbedingt erforderlich sind, und überwacht Ihre persönlichen Aktivitäten außerhalb des Spiels nicht.',
      },
      downloadBtn: {
        fr: 'Télécharger l\'Anti-Cheat',
        en: 'Download Anti-Cheat',
        it: 'Scarica Anti-Cheat',
        de: 'Anti-Cheat herunterladen',
      },
      comingSoon: {
        fr: 'Bientôt disponible',
        en: 'Coming soon',
        it: 'Prossimamente',
        de: 'Demnächst',
      },
      version: {
        fr: 'Version',
        en: 'Version',
        it: 'Versione',
        de: 'Version',
      },
      loginRequired: {
        fr: 'Connectez-vous pour télécharger l\'Anti-Cheat',
        en: 'Login to download the Anti-Cheat',
        it: 'Accedi per scaricare l\'Anti-Cheat',
        de: 'Melden Sie sich an, um den Anti-Cheat herunterzuladen',
      },
      loginBtn: {
        fr: 'Se connecter',
        en: 'Login',
        it: 'Accedi',
        de: 'Anmelden',
      },
      pcOnly: {
        fr: 'L\'Anti-Cheat est réservé aux joueurs PC uniquement.',
        en: 'Anti-Cheat is only available for PC players.',
        it: 'L\'Anti-Cheat è disponibile solo per i giocatori PC.',
        de: 'Anti-Cheat ist nur für PC-Spieler verfügbar.',
      },
    };
    return texts[key]?.[language] || texts[key]?.en || key;
  };

  useEffect(() => {
    document.title = `NoMercy - ${getText('pageTitle')}`;
  }, [language]);

  const features = [
    { icon: Eye, title: getText('feature1Title'), desc: getText('feature1Desc') },
    { icon: Cpu, title: getText('feature2Title'), desc: getText('feature2Desc') },
    { icon: Fingerprint, title: getText('feature3Title'), desc: getText('feature3Desc') },
    { icon: Server, title: getText('feature4Title'), desc: getText('feature4Desc') },
  ];

  const requirements = [
    getText('req1'),
    getText('req2'),
    getText('req3'),
    getText('req4'),
  ];

  return (
    <div className="min-h-screen bg-dark-950 relative">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none" style={{ 
        background: isHardcore 
          ? 'radial-gradient(ellipse at 20% 20%, rgba(239, 68, 68, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(249, 115, 22, 0.05) 0%, transparent 50%)'
          : 'radial-gradient(ellipse at 20% 20%, rgba(34, 211, 238, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(59, 130, 246, 0.05) 0%, transparent 50%)'
      }}></div>
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-30"></div>

      <div className="relative z-10 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back button */}
          <Link 
            to={selectedMode ? `/${selectedMode}` : '/'}
            className={`inline-flex items-center space-x-2 ${textAccent} hover:underline mb-6`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{getText('back')}</span>
          </Link>

          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className={`absolute inset-0 ${isHardcore ? 'bg-red-500/30' : 'bg-cyan-500/30'} blur-xl`}></div>
                <div className={`relative w-14 h-14 bg-gradient-to-br ${gradientFrom} ${gradientTo} rounded-xl flex items-center justify-center shadow-lg ${isHardcore ? 'shadow-red-500/40' : 'shadow-cyan-500/40'}`}>
                  <Shield className="w-7 h-7 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-1">{getText('pageTitle')}</h1>
                <p className="text-gray-400 text-sm">{getText('pageSubtitle')}</p>
              </div>
            </div>
          </div>

          {/* Why Anti-Cheat */}
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border ${borderColor} p-6 mb-6`}>
            <h2 className={`text-xl font-bold text-white mb-4 flex items-center space-x-2`}>
              <Zap className={`w-5 h-5 ${textAccent}`} />
              <span>{getText('whyAnticheat')}</span>
            </h2>
            <p className="text-gray-300 leading-relaxed mb-6">{getText('whyDesc')}</p>
            
            {/* Download Button */}
            <div className="flex flex-col items-center">
              {user ? (
                user.platform === 'PC' ? (
                  <>
                    <p className="text-gray-500 text-xs mb-2">Player ID: <span className="text-cyan-400 font-mono">{user.id}</span></p>
                    <iframe
                      src={`https://api.ggsecure.io/api/embed/button/693cef61be96745c4607e233/${user.id}`}
                      width="300"
                      height="80"
                      frameBorder="0"
                      title="GGSecure Anti-Cheat Download"
                    />
                  </>
                ) : (
                  <div className="text-center p-4 bg-dark-800/50 rounded-xl border border-gray-700/50">
                    <p className="text-gray-400">{getText('pcOnly')}</p>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center space-y-4">
                  <p className="text-gray-400">{getText('loginRequired')}</p>
                  <button
                    onClick={login}
                    className={`inline-flex items-center space-x-3 px-10 py-5 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-2xl text-white font-bold text-xl shadow-2xl ${isHardcore ? 'shadow-red-500/40 hover:shadow-red-500/60' : 'shadow-cyan-500/40 hover:shadow-cyan-500/60'} hover:scale-105 transition-all duration-300 border ${borderColor}`}
                  >
                    <LogIn className="w-6 h-6" />
                    <span>{getText('loginBtn')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* How it works */}
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border ${borderColor} overflow-hidden mb-6`}>
            <div className={`px-6 py-4 border-b ${borderColor} ${bgAccent}`}>
              <h2 className="font-bold text-white flex items-center space-x-2">
                <Cpu className={`w-5 h-5 ${textAccent}`} />
                <span>{getText('howItWorks')}</span>
              </h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div key={index} className="flex items-start space-x-4">
                    <div className={`w-10 h-10 rounded-lg ${bgAccent} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${textAccent}`} />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold mb-1">{feature.title}</h3>
                      <p className="text-gray-400 text-sm">{feature.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Requirements */}
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border ${borderColor} overflow-hidden mb-6`}>
            <div className={`px-6 py-4 border-b ${borderColor} ${bgAccent}`}>
              <h2 className="font-bold text-white flex items-center space-x-2">
                <CheckCircle className={`w-5 h-5 ${textAccent}`} />
                <span>{getText('requirements')}</span>
              </h2>
            </div>
            <div className="p-6">
              <ul className="space-y-3">
                {requirements.map((req, index) => (
                  <li key={index} className="flex items-center space-x-3">
                    <CheckCircle className={`w-4 h-4 ${textAccent}`} />
                    <span className="text-gray-300 text-sm">{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Privacy */}
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border ${borderColor} p-6`}>
            <h2 className={`text-xl font-bold text-white mb-4 flex items-center space-x-2`}>
              <Lock className={`w-5 h-5 ${textAccent}`} />
              <span>{getText('privacy')}</span>
            </h2>
            <p className="text-gray-300 leading-relaxed">{getText('privacyDesc')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Anticheat;

