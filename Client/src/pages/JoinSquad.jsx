import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { Users, Loader2, Check, X, AlertCircle, LogIn } from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const JoinSquad = () => {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { language } = useLanguage();
  const { selectedMode } = useMode();

  const isHardcore = selectedMode === 'hardcore';
  const accentColor = isHardcore ? 'red' : 'cyan';
  const gradientFrom = isHardcore ? 'from-red-500' : 'from-cyan-500';
  const gradientTo = isHardcore ? 'to-orange-500' : 'to-blue-500';

  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [squadInfo, setSquadInfo] = useState(null);

  // Traductions
  const texts = {
    fr: {
      title: 'Rejoindre une escouade',
      joining: 'Rejoindre',
      join: 'Rejoindre l\'escouade',
      cancel: 'Annuler',
      success: 'Vous avez rejoint l\'escouade !',
      goToProfile: 'Voir mon profil',
      invalidCode: 'Code d\'invitation invalide ou expiré',
      alreadyInSquad: 'Vous êtes déjà dans une escouade',
      squadFull: 'Cette escouade est pleine',
      loginRequired: 'Connectez-vous pour rejoindre',
      loginButton: 'Se connecter avec Discord',
      members: 'membres',
    },
    en: {
      title: 'Join a squad',
      joining: 'Joining',
      join: 'Join squad',
      cancel: 'Cancel',
      success: 'You joined the squad!',
      goToProfile: 'View my profile',
      invalidCode: 'Invalid or expired invite code',
      alreadyInSquad: 'You are already in a squad',
      squadFull: 'This squad is full',
      loginRequired: 'Login to join',
      loginButton: 'Login with Discord',
      members: 'members',
    },
    de: {
      title: 'Einem Squad beitreten',
      joining: 'Beitreten',
      join: 'Squad beitreten',
      cancel: 'Abbrechen',
      success: 'Du bist dem Squad beigetreten!',
      goToProfile: 'Mein Profil anzeigen',
      invalidCode: 'Ungültiger oder abgelaufener Einladungscode',
      alreadyInSquad: 'Du bist bereits in einem Squad',
      squadFull: 'Dieses Squad ist voll',
      loginRequired: 'Anmelden um beizutreten',
      loginButton: 'Mit Discord anmelden',
      members: 'Mitglieder',
    },
    it: {
      title: 'Unisciti a una squadra',
      joining: 'Unendo',
      join: 'Unisciti alla squadra',
      cancel: 'Annulla',
      success: 'Ti sei unito alla squadra!',
      goToProfile: 'Vedi il mio profilo',
      invalidCode: 'Codice di invito non valido o scaduto',
      alreadyInSquad: 'Sei già in una squadra',
      squadFull: 'Questa squadra è piena',
      loginRequired: 'Accedi per unirti',
      loginButton: 'Accedi con Discord',
      members: 'membri',
    },
  };
  const t = texts[language] || texts.en;

  // Check if user already has a squad
  useEffect(() => {
    if (isAuthenticated && user?.squad) {
      setError(t.alreadyInSquad);
    }
  }, [isAuthenticated, user]);

  // Handle join
  const handleJoin = async () => {
    if (!isAuthenticated) return;
    
    setJoining(true);
    setError('');
    
    try {
      const response = await fetch(`${API_URL}/squads/join/${inviteCode}`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        setSuccess(true);
        setSquadInfo(data.squad);
      } else {
        setError(data.message || t.invalidCode);
      }
    } catch (err) {
      setError(t.invalidCode);
    } finally {
      setJoining(false);
    }
  };

  // Handle Discord login
  const handleDiscordLogin = () => {
    window.location.href = `${API_URL}/auth/discord`;
  };

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center relative">
      {/* Background */}
      {isHardcore ? (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(239, 68, 68, 0.1) 0%, transparent 50%)' }}></div>
      ) : (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(6, 182, 212, 0.1) 0%, transparent 50%)' }}></div>
      )}
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-20"></div>

      <div className="relative z-10 max-w-md w-full mx-4">
        <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-${accentColor}-500/20 p-8`}>
          
          {success ? (
            // Success state
            <div className="text-center">
              <div className={`w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6`}>
                <Check className="w-10 h-10 text-green-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">{t.success}</h1>
              {squadInfo && (
                <p className="text-gray-400 mb-6">
                  {squadInfo.name} [{squadInfo.tag}]
                </p>
              )}
              <Link
                to="/my-profile"
                className={`inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white font-bold rounded-xl hover:opacity-90 transition-all`}
              >
                {t.goToProfile}
              </Link>
            </div>
          ) : (
            // Join form
            <>
              <div className="text-center mb-8">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center mx-auto mb-4`}>
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">{t.title}</h1>
                <p className="text-gray-400">
                  {language === 'fr' ? 'Code d\'invitation :' : 'Invite code:'}{' '}
                  <code className={`px-2 py-1 bg-${accentColor}-500/20 text-${accentColor}-400 rounded font-mono`}>
                    {inviteCode}
                  </code>
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {!isAuthenticated ? (
                // Not logged in
                <div className="text-center">
                  <p className="text-gray-400 mb-4">{t.loginRequired}</p>
                  <button
                    onClick={handleDiscordLogin}
                    className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-[#5865F2] text-white font-bold rounded-xl hover:bg-[#4752c4] transition-colors"
                  >
                    <LogIn className="w-5 h-5" />
                    {t.loginButton}
                  </button>
                </div>
              ) : user?.squad ? (
                // Already in a squad
                <div className="text-center">
                  <Link
                    to="/my-profile"
                    className={`inline-flex items-center gap-2 px-6 py-3 bg-gray-700 text-white font-medium rounded-xl hover:bg-gray-600 transition-colors`}
                  >
                    {t.goToProfile}
                  </Link>
                </div>
              ) : (
                // Can join
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate(-1)}
                    className="flex-1 py-3 px-4 bg-dark-800 hover:bg-dark-700 border border-white/10 text-white font-medium rounded-xl transition-colors"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={handleJoin}
                    disabled={joining}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r ${gradientFrom} ${gradientTo} hover:opacity-90 disabled:opacity-50 text-white font-bold rounded-xl transition-all`}
                  >
                    {joining ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t.joining}...
                      </>
                    ) : (
                      <>
                        <Users className="w-5 h-5" />
                        {t.join}
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoinSquad;

