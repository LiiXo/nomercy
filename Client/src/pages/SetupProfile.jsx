import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { getDefaultAvatar } from '../utils/avatar';
import { User, FileText, Check, X, Loader2, AlertCircle, Sparkles, Monitor, Gamepad2, ChevronDown } from 'lucide-react';

const SetupProfile = () => {
  const navigate = useNavigate();
  const { user, setupProfile, checkUsername, isProfileComplete } = useAuth();
  const { language } = useLanguage();

  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [platform, setPlatform] = useState('');
  const [activisionId, setActivisionId] = useState('');
  const [usernameStatus, setUsernameStatus] = useState(null); // null, 'checking', 'available', 'taken', 'invalid'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const platforms = [
    { value: 'PC', label: 'PC', icon: '🖥️' },
    { value: 'PlayStation', label: 'PlayStation', icon: '🎮' },
    { value: 'Xbox', label: 'Xbox', icon: '🎮' },
  ];

  // Set page title
  useEffect(() => {
    const titles = {
      fr: 'NoMercy - Configuration du profil',
      en: 'NoMercy - Profile Setup',
      it: 'NoMercy - Configurazione profilo',
      de: 'NoMercy - Profil einrichten',
    };
    document.title = titles[language] || titles.en;
  }, [language]);

  // Redirect if profile is already complete
  useEffect(() => {
    if (isProfileComplete) {
      navigate('/');
    }
  }, [isProfileComplete, navigate]);

  // Debounced username check
  useEffect(() => {
    if (!username || username.length < 3) {
      setUsernameStatus(username.length > 0 ? 'invalid' : null);
      return;
    }

    if (username.length > 20) {
      setUsernameStatus('invalid');
      return;
    }

    setUsernameStatus('checking');
    const timer = setTimeout(async () => {
      const result = await checkUsername(username);
      setUsernameStatus(result.available ? 'available' : 'taken');
    }, 500);

    return () => clearTimeout(timer);
  }, [username, checkUsername]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (usernameStatus !== 'available') {
      setError(language === 'fr' ? 'Veuillez choisir un pseudo valide et disponible.' : 'Please choose a valid and available username.');
      return;
    }

    if (!platform) {
      setError(language === 'fr' ? 'Veuillez sélectionner une plateforme.' : 'Please select a platform.');
      return;
    }

    if (!activisionId || activisionId.trim().length < 3) {
      setError(language === 'fr' ? 'Veuillez entrer votre Activision ID.' : 'Please enter your Activision ID.');
      return;
    }

    setIsSubmitting(true);
    const result = await setupProfile(username, bio, platform, activisionId);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.error);
    }
    setIsSubmitting(false);
  };

  const texts = {
    fr: {
      title: 'Bienvenue sur NoMercy !',
      subtitle: 'Configure ton profil pour commencer',
      usernameLabel: 'Pseudo public',
      usernamePlaceholder: 'Ton pseudo unique',
      usernameHint: 'Entre 3 et 20 caractères',
      platformLabel: 'Plateforme',
      platformPlaceholder: 'Sélectionne ta plateforme',
      activisionLabel: 'Activision ID',
      activisionPlaceholder: 'Ex: Joueur#1234567',
      activisionHint: 'Ton ID Activision pour les invitations',
      bioLabel: 'Bio',
      bioPlaceholder: 'Parle-nous de toi... (optionnel)',
      bioHint: '500 caractères max',
      submit: 'Valider mon profil',
      checking: 'Vérification...',
      available: 'Disponible !',
      taken: 'Déjà pris',
      invalid: 'Trop court',
      discordAccount: 'Compte Discord',
      required: 'Obligatoire'
    },
    en: {
      title: 'Welcome to NoMercy!',
      subtitle: 'Set up your profile to get started',
      usernameLabel: 'Public Username',
      usernamePlaceholder: 'Your unique username',
      usernameHint: 'Between 3 and 20 characters',
      platformLabel: 'Platform',
      platformPlaceholder: 'Select your platform',
      activisionLabel: 'Activision ID',
      activisionPlaceholder: 'Ex: Player#1234567',
      activisionHint: 'Your Activision ID for invitations',
      bioLabel: 'Bio',
      bioPlaceholder: 'Tell us about yourself... (optional)',
      bioHint: '500 characters max',
      submit: 'Complete Profile',
      checking: 'Checking...',
      available: 'Available!',
      taken: 'Already taken',
      invalid: 'Too short',
      discordAccount: 'Discord Account',
      required: 'Required'
    }
  };

  const t = texts[language] || texts.en;

  return (
    <div className="min-h-screen bg-dark-950 relative flex items-center justify-center px-4">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 20%, rgba(239, 68, 68, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(249, 115, 22, 0.05) 0%, transparent 50%)' }}></div>
        <div className="absolute inset-0 grid-pattern opacity-20"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 mb-4 shadow-lg shadow-red-500/30">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{t.title}</h1>
          <p className="text-gray-400">{t.subtitle}</p>
        </div>

        {/* Card */}
        <div className="bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-red-500/20 p-8 shadow-xl">
          {/* Discord account info */}
          {user && (
            <div className="mb-6 p-4 bg-[#5865F2]/10 border border-[#5865F2]/30 rounded-xl">
              <div className="flex items-center space-x-3">
                <img 
                  src={user.avatar || getDefaultAvatar(user.discordUsername || username)}
                  alt="Avatar"
                  className="w-12 h-12 rounded-full border-2 border-[#5865F2]/50"
                />
                <div>
                  <p className="text-xs text-[#5865F2] font-medium mb-0.5">{t.discordAccount}</p>
                  <p className="text-white font-semibold">{user.discordUsername}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username */}
            <div>
              <label className="flex items-center justify-between text-sm font-medium text-gray-300 mb-2">
                <span className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-red-400" />
                  <span>{t.usernameLabel}</span>
                </span>
                <span className="text-xs text-red-400">*{t.required}</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                  placeholder={t.usernamePlaceholder}
                  maxLength={20}
                  className="w-full px-4 py-3 bg-dark-800/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameStatus === 'checking' && (
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  )}
                  {usernameStatus === 'available' && (
                    <Check className="w-5 h-5 text-green-400" />
                  )}
                  {usernameStatus === 'taken' && (
                    <X className="w-5 h-5 text-red-400" />
                  )}
                  {usernameStatus === 'invalid' && (
                    <AlertCircle className="w-5 h-5 text-yellow-400" />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-gray-500">{t.usernameHint}</p>
                {usernameStatus === 'available' && (
                  <p className="text-xs text-green-400">{t.available}</p>
                )}
                {usernameStatus === 'taken' && (
                  <p className="text-xs text-red-400">{t.taken}</p>
                )}
                {usernameStatus === 'invalid' && (
                  <p className="text-xs text-yellow-400">{t.invalid}</p>
                )}
              </div>
            </div>

            {/* Platform */}
            <div>
              <label className="flex items-center justify-between text-sm font-medium text-gray-300 mb-2">
                <span className="flex items-center space-x-2">
                  <Monitor className="w-4 h-4 text-red-400" />
                  <span>{t.platformLabel}</span>
                </span>
                <span className="text-xs text-red-400">*{t.required}</span>
              </label>
              <div className="relative">
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-800/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all appearance-none cursor-pointer"
                >
                  <option value="" className="bg-dark-800 text-gray-400">{t.platformPlaceholder}</option>
                  {platforms.map((p) => (
                    <option key={p.value} value={p.value} className="bg-dark-800 text-white">
                      {p.icon} {p.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Activision ID */}
            <div>
              <label className="flex items-center justify-between text-sm font-medium text-gray-300 mb-2">
                <span className="flex items-center space-x-2">
                  <Gamepad2 className="w-4 h-4 text-red-400" />
                  <span>{t.activisionLabel}</span>
                </span>
                <span className="text-xs text-red-400">*{t.required}</span>
              </label>
              <input
                type="text"
                value={activisionId}
                onChange={(e) => setActivisionId(e.target.value)}
                placeholder={t.activisionPlaceholder}
                maxLength={50}
                className="w-full px-4 py-3 bg-dark-800/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all"
              />
              <p className="text-xs text-gray-500 mt-1.5">{t.activisionHint}</p>
            </div>

            {/* Bio */}
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
                <FileText className="w-4 h-4 text-red-400" />
                <span>{t.bioLabel}</span>
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t.bioPlaceholder}
                maxLength={500}
                rows={3}
                className="w-full px-4 py-3 bg-dark-800/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all resize-none"
              />
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-gray-500">{t.bioHint}</p>
                <p className="text-xs text-gray-500">{bio.length}/500</p>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting || usernameStatus !== 'available' || !platform || !activisionId.trim()}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg shadow-red-500/25 hover:shadow-red-500/40 disabled:shadow-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t.checking}</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>{t.submit}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SetupProfile;

