import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Shield, Download, Check, AlertTriangle, ArrowLeft, 
  Cpu, HardDrive, Monitor, Lock, Zap, Eye, RefreshCw
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const Anticheat = () => {
  const { user, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const navigate = useNavigate();
  
  const [downloading, setDownloading] = useState(false);
  const [downloadInfo, setDownloadInfo] = useState(null);
  const [error, setError] = useState('');

  const isHardcore = selectedMode === 'hardcore';
  const accentColor = isHardcore ? 'red' : 'cyan';
  const gradientFrom = isHardcore ? 'from-red-500' : 'from-cyan-400';
  const gradientTo = isHardcore ? 'to-orange-600' : 'to-cyan-600';

  const texts = {
    fr: {
      title: 'Iris Anticheat',
      subtitle: 'Sécurisez votre compte NoMercy',
      description: 'Iris est notre solution anticheat nouvelle génération qui lie votre compte Discord à votre machine via TPM 2.0 pour garantir l\'intégrité de tous les joueurs PC.',
      downloadBtn: 'Télécharger Iris',
      downloading: 'Préparation...',
      loginRequired: 'Connexion requise',
      loginDescription: 'Connectez-vous avec Discord pour télécharger Iris.',
      profileRequired: 'Profil requis',
      profileDescription: 'Complétez votre profil avant de télécharger Iris.',
      completeProfile: 'Compléter mon profil',
      features: {
        title: 'Fonctionnalités',
        tpm: {
          title: 'TPM 2.0',
          desc: 'Identification matérielle unique et infalsifiable'
        },
        binding: {
          title: 'Liaison sécurisée',
          desc: 'Un compte Discord = Une machine'
        },
        lightweight: {
          title: 'Ultra léger',
          desc: 'Aucun impact sur les performances de jeu'
        },
        realtime: {
          title: 'Temps réel',
          desc: 'Vérification continue pendant les matchs'
        }
      },
      requirements: {
        title: 'Configuration requise',
        os: 'Windows 10/11 (64-bit)',
        tpm: 'TPM 2.0 activé',
        discord: 'Compte Discord lié',
        admin: 'Droits administrateur'
      },
      howItWorks: {
        title: 'Comment ça marche',
        step1: {
          title: 'Téléchargez',
          desc: 'Installez Iris sur votre PC'
        },
        step2: {
          title: 'Connectez-vous',
          desc: 'Liez votre compte Discord'
        },
        step3: {
          title: 'Jouez',
          desc: 'Iris vérifie automatiquement votre identité'
        }
      },
      back: 'Retour',
      version: 'Version',
      fileName: 'Nom du fichier'
    },
    en: {
      title: 'Iris Anticheat',
      subtitle: 'Secure your NoMercy account',
      description: 'Iris is our next-generation anticheat solution that links your Discord account to your machine via TPM 2.0 to ensure the integrity of all PC players.',
      downloadBtn: 'Download Iris',
      downloading: 'Preparing...',
      loginRequired: 'Login required',
      loginDescription: 'Sign in with Discord to download Iris.',
      profileRequired: 'Profile required',
      profileDescription: 'Complete your profile before downloading Iris.',
      completeProfile: 'Complete my profile',
      features: {
        title: 'Features',
        tpm: {
          title: 'TPM 2.0',
          desc: 'Unique and tamper-proof hardware identification'
        },
        binding: {
          title: 'Secure binding',
          desc: 'One Discord account = One machine'
        },
        lightweight: {
          title: 'Ultra lightweight',
          desc: 'Zero impact on game performance'
        },
        realtime: {
          title: 'Real-time',
          desc: 'Continuous verification during matches'
        }
      },
      requirements: {
        title: 'System requirements',
        os: 'Windows 10/11 (64-bit)',
        tpm: 'TPM 2.0 enabled',
        discord: 'Linked Discord account',
        admin: 'Administrator rights'
      },
      howItWorks: {
        title: 'How it works',
        step1: {
          title: 'Download',
          desc: 'Install Iris on your PC'
        },
        step2: {
          title: 'Sign in',
          desc: 'Link your Discord account'
        },
        step3: {
          title: 'Play',
          desc: 'Iris automatically verifies your identity'
        }
      },
      back: 'Back',
      version: 'Version',
      fileName: 'File name'
    },
    de: {
      title: 'Iris Anticheat',
      subtitle: 'Sichern Sie Ihr NoMercy-Konto',
      description: 'Iris ist unsere Anticheat-Lösung der nächsten Generation, die Ihr Discord-Konto über TPM 2.0 mit Ihrer Maschine verknüpft, um die Integrität aller PC-Spieler zu gewährleisten.',
      downloadBtn: 'Iris herunterladen',
      downloading: 'Vorbereitung...',
      loginRequired: 'Anmeldung erforderlich',
      loginDescription: 'Melden Sie sich mit Discord an, um Iris herunterzuladen.',
      profileRequired: 'Profil erforderlich',
      profileDescription: 'Vervollständigen Sie Ihr Profil, bevor Sie Iris herunterladen.',
      completeProfile: 'Mein Profil vervollständigen',
      features: {
        title: 'Funktionen',
        tpm: {
          title: 'TPM 2.0',
          desc: 'Einzigartige und fälschungssichere Hardware-Identifikation'
        },
        binding: {
          title: 'Sichere Bindung',
          desc: 'Ein Discord-Konto = Eine Maschine'
        },
        lightweight: {
          title: 'Ultraleicht',
          desc: 'Keine Auswirkungen auf die Spielleistung'
        },
        realtime: {
          title: 'Echtzeit',
          desc: 'Kontinuierliche Überprüfung während der Spiele'
        }
      },
      requirements: {
        title: 'Systemanforderungen',
        os: 'Windows 10/11 (64-bit)',
        tpm: 'TPM 2.0 aktiviert',
        discord: 'Verknüpftes Discord-Konto',
        admin: 'Administratorrechte'
      },
      howItWorks: {
        title: 'Wie es funktioniert',
        step1: {
          title: 'Herunterladen',
          desc: 'Installieren Sie Iris auf Ihrem PC'
        },
        step2: {
          title: 'Anmelden',
          desc: 'Verknüpfen Sie Ihr Discord-Konto'
        },
        step3: {
          title: 'Spielen',
          desc: 'Iris überprüft automatisch Ihre Identität'
        }
      },
      back: 'Zurück',
      version: 'Version',
      fileName: 'Dateiname'
    },
    it: {
      title: 'Iris Anticheat',
      subtitle: 'Proteggi il tuo account NoMercy',
      description: 'Iris è la nostra soluzione anticheat di nuova generazione che collega il tuo account Discord alla tua macchina tramite TPM 2.0 per garantire l\'integrità di tutti i giocatori PC.',
      downloadBtn: 'Scarica Iris',
      downloading: 'Preparazione...',
      loginRequired: 'Accesso richiesto',
      loginDescription: 'Accedi con Discord per scaricare Iris.',
      profileRequired: 'Profilo richiesto',
      profileDescription: 'Completa il tuo profilo prima di scaricare Iris.',
      completeProfile: 'Completa il mio profilo',
      features: {
        title: 'Funzionalità',
        tpm: {
          title: 'TPM 2.0',
          desc: 'Identificazione hardware unica e a prova di manomissione'
        },
        binding: {
          title: 'Collegamento sicuro',
          desc: 'Un account Discord = Una macchina'
        },
        lightweight: {
          title: 'Ultra leggero',
          desc: 'Nessun impatto sulle prestazioni di gioco'
        },
        realtime: {
          title: 'Tempo reale',
          desc: 'Verifica continua durante le partite'
        }
      },
      requirements: {
        title: 'Requisiti di sistema',
        os: 'Windows 10/11 (64-bit)',
        tpm: 'TPM 2.0 abilitato',
        discord: 'Account Discord collegato',
        admin: 'Diritti di amministratore'
      },
      howItWorks: {
        title: 'Come funziona',
        step1: {
          title: 'Scarica',
          desc: 'Installa Iris sul tuo PC'
        },
        step2: {
          title: 'Accedi',
          desc: 'Collega il tuo account Discord'
        },
        step3: {
          title: 'Gioca',
          desc: 'Iris verifica automaticamente la tua identità'
        }
      },
      back: 'Indietro',
      version: 'Versione',
      fileName: 'Nome file'
    }
  };

  const t = texts[language] || texts.en;

  // Fetch download info when authenticated
  useEffect(() => {
    if (isAuthenticated && user?.isProfileComplete) {
      fetchDownloadInfo();
    }
  }, [isAuthenticated, user]);

  const fetchDownloadInfo = async () => {
    try {
      const response = await fetch(`${API_URL}/iris/download`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setDownloadInfo(data);
      }
    } catch (err) {
      console.error('Failed to fetch download info:', err);
    }
  };

  const handleDownload = async () => {
    if (!downloadInfo) return;
    
    setDownloading(true);
    setError('');
    
    try {
      // Open download in new tab/window
      window.open(`${API_URL}${downloadInfo.downloadUrl}`, '_blank');
    } catch (err) {
      setError('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const features = [
    { icon: Cpu, ...t.features.tpm },
    { icon: Lock, ...t.features.binding },
    { icon: Zap, ...t.features.lightweight },
    { icon: Eye, ...t.features.realtime }
  ];

  const requirements = [
    { icon: Monitor, text: t.requirements.os },
    { icon: Cpu, text: t.requirements.tpm },
    { icon: Shield, text: t.requirements.discord },
    { icon: Lock, text: t.requirements.admin }
  ];

  const steps = [
    { number: '01', ...t.howItWorks.step1 },
    { number: '02', ...t.howItWorks.step2 },
    { number: '03', ...t.howItWorks.step3 }
  ];

  return (
    <div className="min-h-screen bg-dark-950 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-20"></div>
      {isHardcore ? (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(239, 68, 68, 0.15) 0%, transparent 60%)' }}></div>
      ) : (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(6, 182, 212, 0.15) 0%, transparent 60%)' }}></div>
      )}

      <div className="relative z-10 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back button */}
          <Link 
            to={selectedMode ? `/${selectedMode}` : '/'}
            className={`inline-flex items-center space-x-2 text-${accentColor}-400 hover:underline mb-8`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.back}</span>
          </Link>

          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="relative inline-block mb-6">
              <div className={`absolute inset-0 blur-3xl opacity-30 bg-gradient-to-r ${gradientFrom} ${gradientTo}`}></div>
              <div className={`relative w-24 h-24 rounded-2xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center shadow-lg`}>
                <Shield className="w-12 h-12 text-white" />
              </div>
            </div>
            <h1 className={`text-4xl md:text-5xl font-display tracking-wider mb-4 bg-gradient-to-r ${gradientFrom} ${gradientTo} bg-clip-text text-transparent`}>
              {t.title}
            </h1>
            <p className="text-xl text-gray-400 mb-4">{t.subtitle}</p>
            <p className="text-gray-500 max-w-2xl mx-auto">{t.description}</p>
          </div>

          {/* Download Section */}
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-${accentColor}-500/20 p-8 mb-12`}>
            {!isAuthenticated ? (
              // Not logged in
              <div className="text-center py-8">
                <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">{t.loginRequired}</h3>
                <p className="text-gray-400 mb-6">{t.loginDescription}</p>
                <button
                  onClick={() => window.location.href = `${API_URL}/auth/discord`}
                  className="flex items-center gap-2 px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium rounded-xl mx-auto transition-all hover:scale-105"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037 13.13 13.13 0 00-.608 1.25 18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037 19.736 19.736 0 00-4.884 1.515.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128c.122-.093.244-.19.361-.289a.074.074 0 01.078-.012c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.118.098.24.195.361.288a.077.077 0 01-.006.128 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                  <span>{language === 'fr' ? 'Connexion' : 'Login'}</span>
                </button>
              </div>
            ) : !user?.isProfileComplete ? (
              // Profile not complete
              <div className="text-center py-8">
                <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">{t.profileRequired}</h3>
                <p className="text-gray-400 mb-6">{t.profileDescription}</p>
                <button
                  onClick={() => navigate('/setup-profile')}
                  className={`px-6 py-3 bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white font-bold rounded-xl hover:opacity-90 transition-all`}
                >
                  {t.completeProfile}
                </button>
              </div>
            ) : (
              // Ready to download
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">{t.downloadBtn}</h3>
                  {downloadInfo && (
                    <div className="text-sm text-gray-400 space-y-1">
                      <p>{t.version}: <span className="text-white">{downloadInfo.version}</span></p>
                      <p>{t.fileName}: <span className="text-white">{downloadInfo.fileName}</span></p>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleDownload}
                  disabled={downloading || !downloadInfo}
                  className={`flex items-center gap-3 px-8 py-4 bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white font-bold text-lg rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {downloading ? (
                    <>
                      <RefreshCw className="w-6 h-6 animate-spin" />
                      <span>{t.downloading}</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-6 h-6" />
                      <span>{t.downloadBtn}</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {error && (
              <p className="text-red-400 text-center mt-4">{error}</p>
            )}
          </div>

          {/* Features */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white text-center mb-8">{t.features.title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <div 
                  key={index}
                  className={`bg-dark-900/60 backdrop-blur-sm border border-${accentColor}-500/10 rounded-xl p-6 hover:border-${accentColor}-500/30 transition-all`}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center mb-4`}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white text-center mb-8">{t.howItWorks.title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {steps.map((step, index) => (
                <div key={index} className="text-center">
                  <div className={`text-6xl font-display bg-gradient-to-r ${gradientFrom} ${gradientTo} bg-clip-text text-transparent mb-4`}>
                    {step.number}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-gray-400">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Requirements */}
          <div className={`bg-dark-900/60 backdrop-blur-sm border border-${accentColor}-500/10 rounded-xl p-8`}>
            <h2 className="text-2xl font-bold text-white text-center mb-6">{t.requirements.title}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {requirements.map((req, index) => (
                <div key={index} className="flex items-center gap-3 text-gray-300">
                  <req.icon className={`w-5 h-5 text-${accentColor}-400 flex-shrink-0`} />
                  <span className="text-sm">{req.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Anticheat;
