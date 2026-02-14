import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Shield, Download, Check, AlertTriangle, ArrowLeft, 
  Cpu, Lock, Zap, Eye, RefreshCw, FileText, X
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';

import { API_URL } from '../config';

const Anticheat = () => {
  const { user, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const navigate = useNavigate();
  
  const [downloading, setDownloading] = useState(false);
  const [downloadInfo, setDownloadInfo] = useState(null);
  const [error, setError] = useState('');
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const isHardcore = selectedMode === 'hardcore';
  const accentColor = isHardcore ? 'red' : 'cyan';
  const gradientFrom = isHardcore ? 'from-red-500' : 'from-cyan-400';
  const gradientTo = isHardcore ? 'to-orange-600' : 'to-cyan-600';

  const texts = {
    fr: {
      title: 'Iris Anti-Cheat',
      subtitle: 'Protection avancée pour NoMercy',
      description: 'Iris est notre solution anticheat nouvelle génération qui lie votre compte Discord à votre machine via TPM 2.0 pour garantir l\'intégrité compétitive.',
      downloadBtn: 'Télécharger Iris',
      downloading: 'Préparation...',
      loginRequired: 'Connexion requise',
      profileRequired: 'Profil requis',
      pcOnly: 'Réservé aux joueurs PC',
      pcOnlyDesc: 'Iris Anti-Cheat est uniquement disponible pour les joueurs ayant sélectionné PC comme plateforme dans leur profil.',
      changePlatform: 'Modifier mon profil',
      termsLink: 'Conditions d\'utilisation d\'Iris',
      back: 'Retour',
      version: 'Version',
      features: {
        tpm: { title: 'TPM 2.0', desc: 'Identification matérielle unique et sécurisée' },
        binding: { title: 'Liaison sécurisée', desc: 'Un compte Discord = Une machine' },
        lightweight: { title: 'Ultra léger', desc: 'Aucun impact sur les performances de jeu' },
        realtime: { title: 'Temps réel', desc: 'Vérification continue toutes les 30 secondes' }
      },
      consent: {
        title: 'Conditions d\'utilisation',
        intro: 'En téléchargeant et en utilisant Iris Anti-Cheat, vous acceptez les conditions suivantes :',
        sections: [
          {
            title: 'Données collectées',
            items: [
              'Identifiant matériel unique (TPM 2.0)',
              'État de sécurité Windows (Secure Boot, Defender, VBS)',
              'Liste des processus en cours d\'exécution',
              'Périphériques USB connectés',
              'Configuration réseau (détection VPN/Proxy)',
              'Traces de logiciels de triche dans le registre',
              'État des pilotes système'
            ]
          },
          {
            title: 'Surveillance en mode scan (administrateurs)',
            items: [
              'Captures d\'écran de tous les moniteurs (toutes les 5 minutes)',
              'Détection de fenêtres de triche actives',
              'Analyse approfondie des overlays suspects'
            ]
          },
          {
            title: 'Utilisation des données',
            items: [
              'Liaison de votre compte Discord à votre machine',
              'Détection et prévention de la triche',
              'Application des sanctions (shadow ban automatique)',
              'Notification aux administrateurs en cas de détection'
            ]
          }
        ],
        checkbox: 'J\'ai lu et j\'accepte les conditions d\'utilisation d\'Iris Anti-Cheat',
        cancel: 'Annuler',
        download: 'Télécharger',
        readMore: 'Lire les conditions complètes'
      }
    },
    en: {
      title: 'Iris Anti-Cheat',
      subtitle: 'Advanced protection for NoMercy',
      description: 'Iris is our next-generation anticheat solution that links your Discord account to your machine via TPM 2.0 to ensure competitive integrity.',
      downloadBtn: 'Download Iris',
      downloading: 'Preparing...',
      loginRequired: 'Login required',
      profileRequired: 'Profile required',
      pcOnly: 'PC players only',
      pcOnlyDesc: 'Iris Anti-Cheat is only available for players who have selected PC as their platform in their profile.',
      changePlatform: 'Edit my profile',
      termsLink: 'Iris Terms of Use',
      back: 'Back',
      version: 'Version',
      features: {
        tpm: { title: 'TPM 2.0', desc: 'Unique and secure hardware identification' },
        binding: { title: 'Secure binding', desc: 'One Discord account = One machine' },
        lightweight: { title: 'Ultra lightweight', desc: 'Zero impact on gaming performance' },
        realtime: { title: 'Real-time', desc: 'Continuous verification every 30 seconds' }
      },
      consent: {
        title: 'Terms of Use',
        intro: 'By downloading and using Iris Anti-Cheat, you agree to the following terms:',
        sections: [
          {
            title: 'Data collected',
            items: [
              'Unique hardware identifier (TPM 2.0)',
              'Windows security status (Secure Boot, Defender, VBS)',
              'List of running processes',
              'Connected USB devices',
              'Network configuration (VPN/Proxy detection)',
              'Cheat software traces in registry',
              'System driver status'
            ]
          },
          {
            title: 'Scan mode monitoring (administrators)',
            items: [
              'Screenshots of all monitors (every 5 minutes)',
              'Active cheat window detection',
              'Deep analysis of suspicious overlays'
            ]
          },
          {
            title: 'Data usage',
            items: [
              'Linking your Discord account to your machine',
              'Cheat detection and prevention',
              'Sanction enforcement (automatic shadow ban)',
              'Administrator notification on detection'
            ]
          }
        ],
        checkbox: 'I have read and accept the Iris Anti-Cheat Terms of Use',
        cancel: 'Cancel',
        download: 'Download',
        readMore: 'Read full terms'
      }
    }
  };

  const t = texts[language] || texts.en;

  // Fetch download info when authenticated and user has PC platform
  useEffect(() => {
    if (isAuthenticated && user?.isProfileComplete && user?.platform === 'PC') {
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

  const handleDownloadClick = () => {
    setShowConsentModal(true);
    setTermsAccepted(false);
  };

  const handleConfirmDownload = async () => {
    if (!downloadInfo || !termsAccepted) return;
    
    setDownloading(true);
    setError('');
    setShowConsentModal(false);
    
    try {
      // downloadUrl is already an absolute production URL
      window.open(downloadInfo.downloadUrl, '_blank');
    } catch (err) {
      setError(language === 'fr' ? 'Échec du téléchargement. Veuillez réessayer.' : 'Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const irisFeatures = [
    { icon: Cpu, ...t.features.tpm },
    { icon: Lock, ...t.features.binding },
    { icon: Zap, ...t.features.lightweight },
    { icon: Eye, ...t.features.realtime }
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back button */}
          <Link 
            to={selectedMode ? `/${selectedMode}` : '/'}
            className={`inline-flex items-center space-x-2 text-${accentColor}-400 hover:underline mb-8`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.back}</span>
          </Link>

          {/* Header */}
          <div className="text-center mb-10">
            <div className="relative inline-block mb-6">
              <div className={`absolute inset-0 blur-3xl opacity-40 bg-gradient-to-r ${gradientFrom} ${gradientTo}`}></div>
              <div className={`relative w-24 h-24 rounded-2xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center shadow-2xl`}>
                <Shield className="w-12 h-12 text-white" />
              </div>
            </div>
            <h1 className={`text-4xl md:text-5xl font-display tracking-wider mb-4 bg-gradient-to-r ${gradientFrom} ${gradientTo} bg-clip-text text-transparent`}>
              {t.title}
            </h1>
            <p className="text-xl text-gray-400 mb-2">{t.subtitle}</p>
            <p className="text-gray-500 max-w-2xl mx-auto">{t.description}</p>
          </div>

          {/* Main Card */}
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-${accentColor}-500/20 p-8 mb-8`}>
            
            {/* Download Section */}
            <div className="mb-8">
              {!isAuthenticated ? (
                <div className="text-center py-6">
                  <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg mb-4">{t.loginRequired}</p>
                  <button
                    onClick={() => window.location.href = `${API_URL}/auth/discord`}
                    className="px-8 py-4 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold rounded-xl transition-all text-lg"
                  >
                    {language === 'fr' ? 'Se connecter avec Discord' : 'Login with Discord'}
                  </button>
                </div>
              ) : !user?.isProfileComplete ? (
                <div className="text-center py-6">
                  <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg mb-4">{t.profileRequired}</p>
                  <button
                    onClick={() => navigate('/setup-profile')}
                    className={`px-8 py-4 bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white font-bold rounded-xl hover:opacity-90 transition-all text-lg`}
                  >
                    {language === 'fr' ? 'Compléter le profil' : 'Complete Profile'}
                  </button>
                </div>
              ) : user?.platform !== 'PC' ? (
                <div className="text-center py-6">
                  <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                  <p className="text-white text-lg font-bold mb-2">{t.pcOnly}</p>
                  <p className="text-gray-400 mb-4 max-w-md mx-auto">{t.pcOnlyDesc}</p>
                  <button
                    onClick={() => navigate('/profile')}
                    className={`px-8 py-4 bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white font-bold rounded-xl hover:opacity-90 transition-all text-lg`}
                  >
                    {t.changePlatform}
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  {downloadInfo && (
                    <div className="text-sm text-gray-400 mb-4">
                      <span className={`text-${accentColor}-400`}>{t.version}:</span> {downloadInfo.version}
                    </div>
                  )}
                  <button
                    onClick={handleDownloadClick}
                    disabled={downloading || !downloadInfo}
                    className={`w-full max-w-md mx-auto flex items-center justify-center gap-3 px-8 py-5 bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 text-lg shadow-lg`}
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
                  {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
                </div>
              )}
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {irisFeatures.map((feature, index) => (
                <div key={index} className="flex items-start gap-4 p-4 bg-dark-800/50 rounded-xl hover:bg-dark-800/70 transition-colors">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center flex-shrink-0`}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{feature.title}</h3>
                    <p className="text-gray-400 text-sm">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Terms Link at bottom */}
          <div className="text-center">
            <Link 
              to="/iris-terms"
              className={`inline-flex items-center gap-2 text-${accentColor}-400 hover:text-${accentColor}-300 transition-colors`}
            >
              <FileText className="w-4 h-4" />
              <span className="underline">{t.termsLink}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Consent Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className={`p-6 border-b border-white/10 bg-gradient-to-r ${gradientFrom}/10 ${gradientTo}/10`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center`}>
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white">{t.consent.title}</h3>
                </div>
                <button
                  onClick={() => setShowConsentModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[50vh]">
              <p className="text-gray-300 mb-6">{t.consent.intro}</p>
              
              {t.consent.sections.map((section, sIndex) => (
                <div key={sIndex} className="mb-6">
                  <h4 className={`text-${accentColor}-400 font-semibold mb-3 flex items-center gap-2`}>
                    <Check className="w-4 h-4" />
                    {section.title}
                  </h4>
                  <ul className="space-y-2 pl-6">
                    {section.items.map((item, iIndex) => (
                      <li key={iIndex} className="text-gray-400 text-sm flex items-start gap-2">
                        <span className={`text-${accentColor}-500 mt-1`}>•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <Link 
                to="/iris-terms"
                target="_blank"
                className={`text-${accentColor}-400 hover:underline text-sm flex items-center gap-1`}
              >
                <FileText className="w-4 h-4" />
                {t.consent.readMore}
              </Link>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-white/10 bg-dark-800/50">
              {/* Checkbox */}
              <label className="flex items-start gap-3 mb-6 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className={`w-5 h-5 mt-0.5 rounded border-2 border-${accentColor}-500/50 bg-dark-800 checked:bg-gradient-to-r checked:${gradientFrom} checked:${gradientTo} focus:ring-2 focus:ring-${accentColor}-500/50 cursor-pointer`}
                />
                <span className="text-gray-300 text-sm group-hover:text-white transition-colors">
                  {t.consent.checkbox}
                </span>
              </label>

              {/* Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => setShowConsentModal(false)}
                  className="flex-1 px-6 py-3 bg-dark-700 hover:bg-dark-600 text-white font-medium rounded-xl transition-colors"
                >
                  {t.consent.cancel}
                </button>
                <button
                  onClick={handleConfirmDownload}
                  disabled={!termsAccepted}
                  className={`flex-1 px-6 py-3 bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                >
                  <Download className="w-5 h-5" />
                  {t.consent.download}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Anticheat;
