import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Shield, Download, Check, AlertTriangle, ArrowLeft, 
  Cpu, HardDrive, Monitor, Lock, Zap, Eye, RefreshCw
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';

import { API_URL } from '../config';

const Anticheat = () => {
  const { user, isAuthenticated, isStaff } = useAuth();
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const navigate = useNavigate();
  
  const [downloading, setDownloading] = useState(false);
  const [downloadInfo, setDownloadInfo] = useState(null);
  const [error, setError] = useState('');

  const isAdmin = isStaff();
  const isHardcore = selectedMode === 'hardcore';
  const accentColor = isHardcore ? 'red' : 'cyan';
  const gradientFrom = isHardcore ? 'from-red-500' : 'from-cyan-400';
  const gradientTo = isHardcore ? 'to-orange-600' : 'to-cyan-600';

  const texts = {
    fr: {
      title: 'Anti-Cheat',
      subtitle: 'Sécurisez votre compte NoMercy',
      
      ggsecure: {
        title: 'GGSecure Anti-Cheat',
        subtitle: 'Protection standard',
        description: 'GGSecure est notre système de vérification standard qui assure l\'intégrité de tous les joueurs.',
        status: 'PROTÉGÉ PAR',
        badge: 'Standard',
        features: {
          title: 'Fonctionnalités',
          lightweight: { title: 'Ultra léger', desc: 'Aucun logiciel à installer' },
          automatic: { title: 'Automatique', desc: 'Actif pour tous les joueurs' },
          realtime: { title: 'Temps réel', desc: 'Vérification continue' },
          discord: { title: 'Lié à Discord', desc: 'Un compte = Une identité' }
        }
      },
      
      iris: {
        title: 'Iris Anti-Cheat',
        subtitle: 'Protection avancée (Administrateurs)',
        description: 'Iris est notre solution anticheat nouvelle génération qui lie votre compte Discord à votre machine via TPM 2.0.',
        adminOnly: 'Réservé aux administrateurs',
        downloadBtn: 'Télécharger Iris',
        downloading: 'Préparation...',
        loginRequired: 'Connexion requise',
        profileRequired: 'Profil requis',
        features: {
          title: 'Fonctionnalités',
          tpm: { title: 'TPM 2.0', desc: 'Identification matérielle unique' },
          binding: { title: 'Liaison sécurisée', desc: 'Un compte = Une machine' },
          lightweight: { title: 'Ultra léger', desc: 'Aucun impact sur les performances' },
          realtime: { title: 'Temps réel', desc: 'Vérification continue' }
        }
      },
      
      back: 'Retour',
      version: 'Version',
      fileName: 'Nom du fichier'
    },
    en: {
      title: 'Anti-Cheat',
      subtitle: 'Secure your NoMercy account',
      
      ggsecure: {
        title: 'GGSecure Anti-Cheat',
        subtitle: 'Standard protection',
        description: 'GGSecure is our standard verification system that ensures the integrity of all players.',
        status: 'PROTECTED BY',
        badge: 'Standard',
        features: {
          title: 'Features',
          lightweight: { title: 'Ultra lightweight', desc: 'No software to install' },
          automatic: { title: 'Automatic', desc: 'Active for all players' },
          realtime: { title: 'Real-time', desc: 'Continuous verification' },
          discord: { title: 'Discord linked', desc: 'One account = One identity' }
        }
      },
      
      iris: {
        title: 'Iris Anti-Cheat',
        subtitle: 'Advanced protection (Administrators)',
        description: 'Iris is our next-generation anticheat solution that links your Discord account to your machine via TPM 2.0.',
        adminOnly: 'Reserved for administrators',
        downloadBtn: 'Download Iris',
        downloading: 'Preparing...',
        loginRequired: 'Login required',
        profileRequired: 'Profile required',
        features: {
          title: 'Features',
          tpm: { title: 'TPM 2.0', desc: 'Unique hardware identification' },
          binding: { title: 'Secure binding', desc: 'One account = One machine' },
          lightweight: { title: 'Ultra lightweight', desc: 'Zero performance impact' },
          realtime: { title: 'Real-time', desc: 'Continuous verification' }
        }
      },
      
      back: 'Back',
      version: 'Version',
      fileName: 'File name'
    }
  };

  const t = texts[language] || texts.en;

  // Fetch download info when authenticated and admin
  useEffect(() => {
    if (isAuthenticated && user?.isProfileComplete && isAdmin) {
      fetchDownloadInfo();
    }
  }, [isAuthenticated, user, isAdmin]);

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

  const ggsecureFeatures = [
    { icon: Zap, ...t.ggsecure.features.lightweight },
    { icon: Check, ...t.ggsecure.features.automatic },
    { icon: Eye, ...t.ggsecure.features.realtime },
    { icon: Shield, ...t.ggsecure.features.discord }
  ];

  const irisFeatures = [
    { icon: Cpu, ...t.iris.features.tpm },
    { icon: Lock, ...t.iris.features.binding },
    { icon: Zap, ...t.iris.features.lightweight },
    { icon: Eye, ...t.iris.features.realtime }
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back button */}
          <Link 
            to={selectedMode ? `/${selectedMode}` : '/'}
            className={`inline-flex items-center space-x-2 text-${accentColor}-400 hover:underline mb-8`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.back}</span>
          </Link>

          {/* Header */}
          <div className="text-center mb-12">
            <h1 className={`text-4xl md:text-5xl font-display tracking-wider mb-4 bg-gradient-to-r ${gradientFrom} ${gradientTo} bg-clip-text text-transparent`}>
              {t.title}
            </h1>
            <p className="text-xl text-gray-400">{t.subtitle}</p>
          </div>

          {/* Two columns: GGSecure + Iris (admin only) */}
          <div className={`grid grid-cols-1 ${isAdmin ? 'lg:grid-cols-2' : ''} gap-8`}>
            
            {/* GGSecure (everyone) */}
            <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-green-500/20 p-8`}>
              <div className="text-center mb-6">
                <div className="relative inline-block mb-4">
                  <div className="absolute inset-0 blur-3xl opacity-30 bg-gradient-to-r from-green-500 to-emerald-600"></div>
                  <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                    <Shield className="w-10 h-10 text-white" />
                  </div>
                </div>
                <div className="inline-block px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-green-400 text-xs font-semibold mb-3">
                  {t.ggsecure.badge}
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">{t.ggsecure.title}</h2>
                <p className="text-gray-400 text-sm mb-4">{t.ggsecure.description}</p>
                <div className="flex items-center justify-center gap-2 text-green-400">
                  <Check className="w-5 h-5" />
                  <span className="font-semibold">{t.ggsecure.status}</span>
                </div>
              </div>

              {/* GGSecure Download iframe */}
              <div className="mb-6 flex justify-center">
                {isAuthenticated && user?.id ? (
                  <iframe 
                    src={`https://api.ggsecure.io/api/embed/button/693cef61be96745c4607e233/${user.id}`}
                    width="300" 
                    height="80" 
                    frameBorder="0"
                    title="GGSecure Download"
                    className="rounded-xl"
                  />
                ) : (
                  <div className="text-center py-4">
                    <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm mb-4">
                      {language === 'fr' ? 'Connectez-vous pour télécharger GGSecure' : 'Sign in to download GGSecure'}
                    </p>
                    <button
                      onClick={() => window.location.href = `${API_URL}/auth/discord`}
                      className="px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium rounded-xl transition-all"
                    >
                      {language === 'fr' ? 'Connexion' : 'Login'}
                    </button>
                  </div>
                )}
              </div>

              {/* GGSecure Features */}
              <div className="space-y-3">
                {ggsecureFeatures.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-dark-800/50 rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                      <feature.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">{feature.title}</h3>
                      <p className="text-gray-400 text-xs">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Iris (admin only) - Only show if admin */}
            {isAdmin && (
              <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-${accentColor}-500/20 p-8`}>
                <div className="text-center mb-6">
                  <div className="relative inline-block mb-4">
                    <div className={`absolute inset-0 blur-3xl opacity-30 bg-gradient-to-r ${gradientFrom} ${gradientTo}`}></div>
                    <div className={`relative w-20 h-20 rounded-2xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center shadow-lg`}>
                      <Shield className="w-10 h-10 text-white" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">{t.iris.title}</h2>
                  <p className="text-gray-400 text-sm mb-4">{t.iris.description}</p>
                </div>

                {/* Download button for admin */}
                <div className="mb-6">
                  {!isAuthenticated ? (
                    <div className="text-center py-4">
                      <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                      <p className="text-gray-400 text-sm mb-4">{t.iris.loginRequired}</p>
                      <button
                        onClick={() => window.location.href = `${API_URL}/auth/discord`}
                        className="px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium rounded-xl transition-all"
                      >
                        {language === 'fr' ? 'Connexion' : 'Login'}
                      </button>
                    </div>
                  ) : !user?.isProfileComplete ? (
                    <div className="text-center py-4">
                      <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                      <p className="text-gray-400 text-sm mb-4">{t.iris.profileRequired}</p>
                      <button
                        onClick={() => navigate('/setup-profile')}
                        className={`px-6 py-3 bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white font-bold rounded-xl hover:opacity-90 transition-all`}
                      >
                        {language === 'fr' ? 'Compléter le profil' : 'Complete Profile'}
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      {downloadInfo && (
                        <div className="text-xs text-gray-400 mb-3">
                          <p>{t.version}: <span className="text-white">{downloadInfo.version}</span></p>
                        </div>
                      )}
                      <button
                        onClick={handleDownload}
                        disabled={downloading || !downloadInfo}
                        className={`w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50`}
                      >
                        {downloading ? (
                          <>
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            <span>{t.iris.downloading}</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-5 h-5" />
                            <span>{t.iris.downloadBtn}</span>
                          </>
                        )}
                      </button>
                      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
                    </div>
                  )}
                </div>

                {/* Iris Features */}
              <div className="space-y-3">
                {irisFeatures.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-dark-800/50 rounded-xl">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center flex-shrink-0`}>
                      <feature.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">{feature.title}</h3>
                      <p className="text-gray-400 text-xs">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default Anticheat;
