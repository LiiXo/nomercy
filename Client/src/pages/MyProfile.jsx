import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { 
  ArrowLeft, User, FileText, Save, Loader2, Check, X, AlertCircle,
  Trophy, Medal, Target, TrendingUp, Calendar, Coins, Shield, Crown,
  Edit3, LogOut, ShoppingBag, Package, Star, Zap, Gift, Award, Users,
  Swords, Eye, Settings
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const MyProfile = () => {
  const navigate = useNavigate();
  const { user, updateProfile, checkUsername, logout, refreshUser } = useAuth();
  const { language } = useLanguage();
  const { selectedMode } = useMode();

  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [usernameStatus, setUsernameStatus] = useState('current');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Purchases state
  const [purchases, setPurchases] = useState([]);
  const [loadingPurchases, setLoadingPurchases] = useState(true);
  
  // Ranking state from DB
  const [ranking, setRanking] = useState(null);
  const [loadingRanking, setLoadingRanking] = useState(true);
  
  // Squad state
  const [squad, setSquad] = useState(null);
  const [loadingSquad, setLoadingSquad] = useState(true);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [leavingSquad, setLeavingSquad] = useState(false);

  const isHardcore = selectedMode === 'hardcore';
  const accentColor = isHardcore ? 'red' : 'cyan';
  const gradientFrom = isHardcore ? 'from-red-500' : 'from-cyan-400';
  const gradientTo = isHardcore ? 'to-orange-600' : 'to-cyan-600';

  // Set page title
  useEffect(() => {
    const titles = {
      fr: 'NoMercy - Mon Profil',
      en: 'NoMercy - My Profile',
      it: 'NoMercy - Il mio Profilo',
      de: 'NoMercy - Mein Profil',
    };
    document.title = titles[language] || titles.en;
  }, [language]);

  // Fetch user purchases, ranking, and squad
  useEffect(() => {
    fetchPurchases();
    fetchRanking();
    fetchSquad();
  }, [selectedMode]);

  const fetchPurchases = async () => {
    try {
      const response = await fetch(`${API_URL}/shop/my-purchases`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setPurchases(data.purchases);
      }
    } catch (err) {
      console.error('Error fetching purchases:', err);
    } finally {
      setLoadingPurchases(false);
    }
  };

  const fetchRanking = async () => {
    setLoadingRanking(true);
    try {
      const response = await fetch(`${API_URL}/rankings/me/${selectedMode}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setRanking(data.ranking);
      }
    } catch (err) {
      console.error('Error fetching ranking:', err);
    } finally {
      setLoadingRanking(false);
    }
  };

  const fetchSquad = async () => {
    setLoadingSquad(true);
    try {
      const response = await fetch(`${API_URL}/squads/my-squad`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setSquad(data.squad);
      }
    } catch (err) {
      console.error('Error fetching squad:', err);
    } finally {
      setLoadingSquad(false);
    }
  };

  const handleLeaveSquad = () => {
    // Check if user is leader with other members
    const isLeader = squad?.members?.some(m => 
      (m.user?._id === user?.id || m.user === user?.id) && m.role === 'leader'
    );
    const hasOtherMembers = squad?.members?.length > 1;
    
    if (isLeader && hasOtherMembers) {
      setLeaveError(texts[language]?.cannotLeaveAsLeader || texts.en.cannotLeaveAsLeader);
    } else {
      setLeaveError('');
    }
    setShowLeaveModal(true);
  };

  const confirmLeaveSquad = async () => {
    setLeavingSquad(true);
    try {
      const response = await fetch(`${API_URL}/squads/leave`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setSquad(null);
        setShowLeaveModal(false);
      } else {
        setLeaveError(data.message);
      }
    } catch (err) {
      console.error('Error leaving squad:', err);
      setLeaveError(texts[language]?.errorOccurred || 'Une erreur est survenue');
    } finally {
      setLeavingSquad(false);
    }
  };

  // Check username when editing
  useEffect(() => {
    if (!isEditing) return;
    
    if (username === user?.username) {
      setUsernameStatus('current');
      return;
    }

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
  }, [username, user?.username, isEditing, checkUsername]);

  const handleSave = async () => {
    setError('');
    setSuccess('');

    if (username !== user?.username && usernameStatus !== 'available' && usernameStatus !== 'current') {
      setError(texts[language]?.usernameInvalid || texts.en.usernameInvalid);
      return;
    }

    setIsSubmitting(true);
    const updates = {};
    if (username !== user?.username) updates.username = username;
    if (bio !== user?.bio) updates.bio = bio;

    if (Object.keys(updates).length === 0) {
      setIsEditing(false);
      setIsSubmitting(false);
      return;
    }

    const result = await updateProfile(updates);
    if (result.success) {
      setSuccess(texts[language]?.profileUpdated || texts.en.profileUpdated);
      setIsEditing(false);
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(result.error);
    }
    setIsSubmitting(false);
  };

  const handleCancel = () => {
    setUsername(user?.username || '');
    setBio(user?.bio || '');
    setIsEditing(false);
    setError('');
    setUsernameStatus('current');
  };

  const getRoleBadge = (role) => {
    const badges = {
      admin: { label: 'Admin', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
      staff: { label: 'Staff', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
      gerant_cdl: { label: 'Gérant CDL', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
      gerant_hardcore: { label: 'Gérant Hardcore', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
      user: { label: 'Membre', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' }
    };
    return badges[role] || badges.user;
  };

  const getRarityColor = (rarity) => {
    const colors = {
      common: 'text-gray-400 bg-gray-500/20 border-gray-500/30',
      rare: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
      epic: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
      legendary: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30'
    };
    return colors[rarity] || colors.common;
  };

  const getCategoryIcon = (category) => {
    const icons = {
      avatar_frame: Crown,
      badge: Award,
      title: Star,
      boost: Zap,
      cosmetic: Gift,
      other: Package
    };
    return icons[category] || Package;
  };

  const getDivisionFromPoints = (points) => {
    if (points >= 3500) return { name: 'Champion', color: 'text-yellow-400', icon: Zap };
    if (points >= 3000) return { name: 'Grandmaster', color: 'text-red-400', icon: Crown };
    if (points >= 2500) return { name: 'Master', color: 'text-purple-400', icon: Trophy };
    if (points >= 2000) return { name: 'Diamond', color: 'text-blue-400', icon: Star };
    if (points >= 1500) return { name: 'Platinum', color: 'text-teal-400', icon: Medal };
    if (points >= 1000) return { name: 'Gold', color: 'text-yellow-400', icon: Medal };
    if (points >= 500) return { name: 'Silver', color: 'text-gray-300', icon: Shield };
    return { name: 'Bronze', color: 'text-amber-600', icon: Shield };
  };

  const getWinRate = () => {
    if (!ranking) return '0%';
    const total = ranking.wins + ranking.losses;
    if (total === 0) return '0%';
    return `${Math.round((ranking.wins / total) * 100)}%`;
  };

  const getKD = () => {
    if (!ranking) return '0.00';
    if (ranking.deaths === 0) return ranking.kills?.toFixed(2) || '0.00';
    return (ranking.kills / ranking.deaths).toFixed(2);
  };

  const texts = {
    fr: {
      back: 'Retour',
      myProfile: 'Mon Profil',
      editProfile: 'Modifier le profil',
      viewPublicProfile: 'Voir mon profil public',
      save: 'Sauvegarder',
      cancel: 'Annuler',
      logout: 'Déconnexion',
      username: 'Pseudo',
      bio: 'Bio',
      bioPlaceholder: 'Parle-nous de toi...',
      roles: 'Rôles',
      stats: 'Statistiques Classées',
      member_since: 'Membre depuis',
      points: 'Points',
      wins: 'Victoires',
      losses: 'Défaites',
      gold: 'Gold Coins',
      checking: 'Vérification...',
      available: 'Disponible',
      taken: 'Déjà pris',
      invalid: 'Trop court',
      current: 'Actuel',
      myPurchases: 'Mes Achats',
      noPurchases: 'Aucun achat pour le moment',
      purchasedOn: 'Acheté le',
      viewShop: 'Voir la boutique',
      mySquad: 'Mon Escouade',
      noSquad: 'Aucune escouade',
      rank: 'Rang',
      winRate: 'Win Rate',
      kd: 'K/D',
      division: 'Division',
      noRanking: 'Pas encore classé',
      members: 'Membres',
      manageSquad: 'Gérer l\'escouade',
      leaveSquad: 'Quitter l\'escouade',
      squadName: 'Nom de l\'escouade',
      squadTag: 'Tag',
      description: 'Description',
      optional: 'optionnel',
      characters: 'caractères',
      create: 'Créer',
      createSquad: 'Créer une escouade',
      squadNamePlaceholder: 'Ex: Les Invincibles',
      squadDescPlaceholder: 'Décrivez votre escouade...',
      noBio: 'Aucune bio',
      viewRanking: 'Voir le classement',
      playRanked: 'Jouer en classé',
      confirmLeaveSquad: 'Voulez-vous vraiment quitter cette escouade ?',
      cannotLeaveAsLeader: 'Vous ne pouvez pas quitter l\'escouade en tant que leader. Transférez d\'abord le leadership ou dissolvez l\'escouade.',
      errorOccurred: 'Une erreur est survenue',
      confirm: 'Confirmer',
      nameTooShort: 'Le nom doit faire au moins 3 caractères',
      tagInvalid: 'Le tag doit faire entre 2 et 5 caractères',
      usernameInvalid: 'Pseudo invalide ou déjà pris.',
      profileUpdated: 'Profil mis à jour !',
      items: 'articles',
      goToSquadPage: 'Gérer mon escouade'
    },
    en: {
      back: 'Back',
      myProfile: 'My Profile',
      editProfile: 'Edit Profile',
      viewPublicProfile: 'View my public profile',
      save: 'Save',
      cancel: 'Cancel',
      logout: 'Logout',
      username: 'Username',
      bio: 'Bio',
      bioPlaceholder: 'Tell us about yourself...',
      roles: 'Roles',
      stats: 'Ranked Statistics',
      member_since: 'Member since',
      points: 'Points',
      wins: 'Wins',
      losses: 'Losses',
      gold: 'Gold Coins',
      checking: 'Checking...',
      available: 'Available',
      taken: 'Already taken',
      invalid: 'Too short',
      current: 'Current',
      myPurchases: 'My Purchases',
      noPurchases: 'No purchases yet',
      purchasedOn: 'Purchased on',
      viewShop: 'View Shop',
      mySquad: 'My Squad',
      noSquad: 'No squad',
      rank: 'Rank',
      winRate: 'Win Rate',
      kd: 'K/D',
      division: 'Division',
      noRanking: 'Not ranked yet',
      members: 'Members',
      manageSquad: 'Manage squad',
      leaveSquad: 'Leave squad',
      squadName: 'Squad name',
      squadTag: 'Tag',
      description: 'Description',
      optional: 'optional',
      characters: 'characters',
      create: 'Create',
      createSquad: 'Create a squad',
      squadNamePlaceholder: 'Ex: The Invincibles',
      squadDescPlaceholder: 'Describe your squad...',
      noBio: 'No bio',
      viewRanking: 'View ranking',
      playRanked: 'Play ranked',
      confirmLeaveSquad: 'Do you really want to leave this squad?',
      cannotLeaveAsLeader: 'You cannot leave the squad as leader. Transfer leadership first or disband the squad.',
      errorOccurred: 'An error occurred',
      confirm: 'Confirm',
      nameTooShort: 'Name must be at least 3 characters',
      tagInvalid: 'Tag must be 2-5 characters',
      usernameInvalid: 'Invalid or taken username.',
      profileUpdated: 'Profile updated!',
      items: 'items',
      goToSquadPage: 'Manage my squad'
    },
    de: {
      back: 'Zurück',
      myProfile: 'Mein Profil',
      editProfile: 'Profil bearbeiten',
      viewPublicProfile: 'Öffentliches Profil anzeigen',
      save: 'Speichern',
      cancel: 'Abbrechen',
      logout: 'Abmelden',
      username: 'Benutzername',
      bio: 'Bio',
      bioPlaceholder: 'Erzähl uns von dir...',
      roles: 'Rollen',
      stats: 'Ranked-Statistiken',
      member_since: 'Mitglied seit',
      points: 'Punkte',
      wins: 'Siege',
      losses: 'Niederlagen',
      gold: 'Gold Coins',
      checking: 'Überprüfung...',
      available: 'Verfügbar',
      taken: 'Bereits vergeben',
      invalid: 'Zu kurz',
      current: 'Aktuell',
      myPurchases: 'Meine Käufe',
      noPurchases: 'Noch keine Käufe',
      purchasedOn: 'Gekauft am',
      viewShop: 'Shop anzeigen',
      mySquad: 'Mein Squad',
      noSquad: 'Kein Squad',
      rank: 'Rang',
      winRate: 'Siegquote',
      kd: 'K/D',
      division: 'Division',
      noRanking: 'Noch nicht platziert',
      members: 'Mitglieder',
      manageSquad: 'Squad verwalten',
      leaveSquad: 'Squad verlassen',
      squadName: 'Squad-Name',
      squadTag: 'Tag',
      description: 'Beschreibung',
      optional: 'optional',
      characters: 'Zeichen',
      create: 'Erstellen',
      createSquad: 'Squad erstellen',
      squadNamePlaceholder: 'Z.B.: Die Unbesiegbaren',
      squadDescPlaceholder: 'Beschreibe dein Squad...',
      noBio: 'Keine Bio',
      viewRanking: 'Rangliste anzeigen',
      playRanked: 'Ranked spielen',
      confirmLeaveSquad: 'Möchtest du dieses Squad wirklich verlassen?',
      cannotLeaveAsLeader: 'Du kannst das Squad als Leader nicht verlassen. Übertrage zuerst die Führung oder löse das Squad auf.',
      errorOccurred: 'Ein Fehler ist aufgetreten',
      confirm: 'Bestätigen',
      nameTooShort: 'Name muss mindestens 3 Zeichen haben',
      tagInvalid: 'Tag muss 2-5 Zeichen haben',
      usernameInvalid: 'Ungültiger oder bereits verwendeter Benutzername.',
      profileUpdated: 'Profil aktualisiert!',
      items: 'Artikel',
      goToSquadPage: 'Mein Squad verwalten'
    },
    it: {
      back: 'Indietro',
      myProfile: 'Il mio profilo',
      editProfile: 'Modifica profilo',
      viewPublicProfile: 'Visualizza profilo pubblico',
      save: 'Salva',
      cancel: 'Annulla',
      logout: 'Esci',
      username: 'Nome utente',
      bio: 'Bio',
      bioPlaceholder: 'Parlaci di te...',
      roles: 'Ruoli',
      stats: 'Statistiche Classificate',
      member_since: 'Membro dal',
      points: 'Punti',
      wins: 'Vittorie',
      losses: 'Sconfitte',
      gold: 'Gold Coins',
      checking: 'Verifica...',
      available: 'Disponibile',
      taken: 'Già in uso',
      invalid: 'Troppo corto',
      current: 'Attuale',
      myPurchases: 'I miei acquisti',
      noPurchases: 'Nessun acquisto ancora',
      purchasedOn: 'Acquistato il',
      viewShop: 'Vedi negozio',
      mySquad: 'La mia squadra',
      noSquad: 'Nessuna squadra',
      rank: 'Grado',
      winRate: 'Win Rate',
      kd: 'K/D',
      division: 'Divisione',
      noRanking: 'Non ancora classificato',
      members: 'Membri',
      manageSquad: 'Gestisci squadra',
      leaveSquad: 'Lascia squadra',
      squadName: 'Nome squadra',
      squadTag: 'Tag',
      description: 'Descrizione',
      optional: 'opzionale',
      characters: 'caratteri',
      create: 'Crea',
      createSquad: 'Crea una squadra',
      squadNamePlaceholder: 'Es: Gli Invincibili',
      squadDescPlaceholder: 'Descrivi la tua squadra...',
      noBio: 'Nessuna bio',
      viewRanking: 'Vedi classifica',
      playRanked: 'Gioca classificato',
      confirmLeaveSquad: 'Vuoi davvero lasciare questa squadra?',
      cannotLeaveAsLeader: 'Non puoi lasciare la squadra come leader. Trasferisci prima la leadership o sciogli la squadra.',
      errorOccurred: 'Si è verificato un errore',
      confirm: 'Conferma',
      nameTooShort: 'Il nome deve avere almeno 3 caratteri',
      tagInvalid: 'Il tag deve avere 2-5 caratteri',
      usernameInvalid: 'Nome utente non valido o già in uso.',
      profileUpdated: 'Profilo aggiornato!',
      items: 'articoli',
      goToSquadPage: 'Gestisci la mia squadra'
    }
  };

  const t = texts[language] || texts.en;

  if (!user) return null;

  const division = ranking ? getDivisionFromPoints(ranking.points) : null;
  const DivisionIcon = division?.icon || Shield;

  return (
    <div className="min-h-screen bg-dark-950 relative">
      {/* Background */}
      {isHardcore ? (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 20% 20%, rgba(239, 68, 68, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(249, 115, 22, 0.05) 0%, transparent 50%)' }}></div>
      ) : (
        <div className="absolute inset-0 bg-mesh pointer-events-none"></div>
      )}
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-30"></div>

      <div className="relative z-10 py-4 sm:py-8">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <button 
              onClick={() => navigate(-1)} 
              className={`flex items-center space-x-1 sm:space-x-2 text-gray-400 hover:text-${accentColor}-400 transition-colors group`}
            >
              <ArrowLeft className="w-4 sm:w-5 h-4 sm:h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm sm:text-base">{t.back}</span>
            </button>

            <button
              onClick={logout}
              className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 transition-colors text-sm sm:text-base"
            >
              <LogOut className="w-3 sm:w-4 h-3 sm:h-4" />
              <span className="hidden sm:inline">{t.logout}</span>
            </button>
          </div>

          {/* Success message */}
          {success && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
              <p className="text-green-400 text-center">{success}</p>
            </div>
          )}

          {/* Profile Card */}
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-${accentColor}-500/20 p-4 sm:p-8 mb-4 sm:mb-6`}>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-${accentColor}-500/50 overflow-hidden`}>
                  <img 
                    src={user.avatar || `https://cdn.discordapp.com/embed/avatars/0.png`}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                {user.roles?.includes('admin') && (
                  <div className="absolute -bottom-1 -right-1 w-6 sm:w-8 h-6 sm:h-8 bg-gradient-to-br from-red-500 to-orange-600 rounded-full flex items-center justify-center border-2 border-dark-900">
                    <Crown className="w-3 sm:w-4 h-3 sm:h-4 text-white" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1 sm:gap-3 mb-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-white">{user.username}</h1>
                  <span className="text-gray-500 text-xs sm:text-sm">
                    {t.member_since} {user.createdAt ? new Date(user.createdAt).toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : language === 'it' ? 'it-IT' : 'en-US', { 
                      month: 'short', 
                      year: 'numeric' 
                    }) : '-'}
                  </span>
                  {!isEditing && (
                    <div className="flex gap-1 mt-2 sm:mt-0">
                      <button
                        onClick={() => setIsEditing(true)}
                        className={`p-1.5 sm:p-2 hover:bg-${accentColor}-500/20 rounded-lg transition-colors`}
                        title={t.editProfile}
                      >
                        <Edit3 className={`w-4 h-4 text-${accentColor}-400`} />
                      </button>
                      <button
                        onClick={() => navigate(`/player/${user.username}`)}
                        className={`p-1.5 sm:p-2 hover:bg-${accentColor}-500/20 rounded-lg transition-colors`}
                        title={t.viewPublicProfile}
                      >
                        <Eye className={`w-4 h-4 text-${accentColor}-400`} />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-gray-400 text-sm mb-3">{user.bio || t.noBio}</p>
                
                {/* Roles */}
                <div className="flex flex-wrap gap-2">
                  {user.roles?.map((role) => {
                    const badge = getRoleBadge(role);
                    return (
                      <span key={role} className={`px-3 py-1 text-xs font-medium rounded-full border ${badge.color}`}>
                        {badge.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Gold Coins */}
              <div className="flex items-center space-x-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <Coins className="w-5 h-5 text-yellow-400" />
                <span className="text-yellow-400 font-bold">{user.goldCoins || 0}</span>
              </div>
            </div>
          </div>

          {/* Edit Form */}
          {isEditing && (
            <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-${accentColor}-500/20 p-6 mb-6`}>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
                <Edit3 className={`w-5 h-5 text-${accentColor}-400`} />
                <span>{t.editProfile}</span>
              </h2>

              <div className="space-y-4">
                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">{t.username}</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                      maxLength={20}
                      className={`w-full px-4 py-3 bg-dark-800/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-${accentColor}-500/50 focus:ring-2 focus:ring-${accentColor}-500/20 transition-all`}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                      {usernameStatus === 'checking' && <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />}
                      {usernameStatus === 'available' && <Check className="w-5 h-5 text-green-400" />}
                      {usernameStatus === 'taken' && <X className="w-5 h-5 text-red-400" />}
                      {usernameStatus === 'invalid' && <AlertCircle className="w-5 h-5 text-yellow-400" />}
                      {usernameStatus === 'current' && <span className="text-xs text-gray-500">{t.current}</span>}
                    </div>
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">{t.bio}</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={500}
                    rows={4}
                    placeholder={t.bioPlaceholder}
                    className={`w-full px-4 py-3 bg-dark-800/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-${accentColor}-500/50 focus:ring-2 focus:ring-${accentColor}-500/20 transition-all resize-none`}
                  />
                  <p className="text-xs text-gray-500 mt-1 text-right">{bio.length}/500</p>
                </div>

                {/* Error */}
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex space-x-3">
                  <button
                    onClick={handleCancel}
                    className="flex-1 py-3 px-4 bg-dark-800 hover:bg-dark-700 border border-white/10 text-white font-medium rounded-xl transition-colors"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSubmitting || (username !== user?.username && usernameStatus !== 'available' && usernameStatus !== 'current')}
                    className={`flex-1 py-3 px-4 bg-gradient-to-r ${gradientFrom} ${gradientTo} hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all flex items-center justify-center space-x-2`}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        <span>{t.save}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Squad Section */}
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-${accentColor}-500/20 p-6 mb-6`}>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
              <Users className={`w-5 h-5 text-${accentColor}-400`} />
              <span>{t.mySquad}</span>
            </h2>
            
            {loadingSquad ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className={`w-6 h-6 text-${accentColor}-400 animate-spin`} />
              </div>
            ) : squad ? (
              /* Afficher l'escouade */
              <div className="space-y-4">
                <Link 
                  to={`/squad/${squad._id}`}
                  className="flex items-center gap-4 p-4 bg-dark-800/50 rounded-xl hover:bg-dark-800/70 transition-colors"
                >
                  <div 
                    className="w-14 h-14 rounded-xl flex items-center justify-center border-2 overflow-hidden"
                    style={{ backgroundColor: squad.color + '30', borderColor: squad.color }}
                  >
                    {squad.logo ? (
                      <img src={squad.logo} alt={squad.name} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-7 h-7" style={{ color: squad.color }} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-bold text-lg hover:underline">{squad.name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-400">[{squad.tag}]</span>
                    </div>
                    <p className="text-gray-500 text-sm">{squad.members?.length || 1} {t.members}</p>
                    {squad.description && (
                      <p className="text-gray-400 text-xs mt-1">{squad.description}</p>
                    )}
                  </div>
                </Link>
                
                {/* Membres de l'escouade */}
                {squad.members && squad.members.length > 0 && (
                  <div className="p-4 bg-dark-800/30 rounded-xl">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{t.members}</p>
                    <div className="flex flex-wrap gap-2">
                      {squad.members.map((member) => (
                        <Link
                          to={`/player/${encodeURIComponent(member.user?.username || 'Unknown')}`}
                          key={member.user?._id || member._id}
                          className="flex items-center gap-2 px-3 py-1.5 bg-dark-800/50 rounded-lg hover:bg-dark-700/50 transition-colors"
                        >
                          <img 
                            src={
                              member.user?.avatarUrl 
                                ? member.user.avatarUrl 
                                : (member.user?.discordId && member.user?.discordAvatar)
                                  ? `https://cdn.discordapp.com/avatars/${member.user.discordId}/${member.user.discordAvatar}.png`
                                  : 'https://cdn.discordapp.com/embed/avatars/0.png'
                            }
                            alt=""
                            className="w-6 h-6 rounded-full"
                            onError={(e) => { e.target.src = 'https://cdn.discordapp.com/embed/avatars/0.png'; }}
                          />
                          <span className="text-sm text-white hover:underline">{member.user?.username || 'Unknown'}</span>
                          {member.role === 'leader' && (
                            <Crown className="w-3 h-3 text-yellow-400" />
                          )}
                          {member.role === 'officer' && (
                            <Shield className="w-3 h-3 text-blue-400" />
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Boutons d'action */}
                <div className="flex gap-2">
                  {/* Bouton gérer - visible pour leader et officiers */}
                  {squad.members?.some(m => 
                    (m.user?._id === user?.id || m.user === user?.id) && 
                    (m.role === 'leader' || m.role === 'officer')
                  ) && (
                    <Link
                      to="/squad-management"
                      className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm bg-${accentColor}-500/20 text-${accentColor}-400 hover:bg-${accentColor}-500/30 rounded-lg transition-colors font-medium`}
                    >
                      <Settings className="w-4 h-4" />
                      {t.manageSquad}
                    </Link>
                  )}
                  
                  {/* Bouton quitter */}
                  <button
                    onClick={handleLeaveSquad}
                    className={`${squad.members?.some(m => 
                      (m.user?._id === user?.id || m.user === user?.id) && 
                      (m.role === 'leader' || m.role === 'officer')
                    ) ? 'flex-1' : 'w-full'} py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors`}
                  >
                    {t.leaveSquad}
                  </button>
                </div>
              </div>
            ) : (
              /* Bouton pour aller à la page my-squad */
              <Link
                to="/my-squad"
                className={`w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white font-medium hover:opacity-90 transition-all shadow-lg`}
              >
                <Users className="w-5 h-5" />
                <span>{t.goToSquadPage}</span>
              </Link>
            )}
          </div>

          {/* My Purchases - Temporairement caché */}
          {false && (
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-${accentColor}-500/20 p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <ShoppingBag className={`w-5 h-5 text-${accentColor}-400`} />
                <span>{t.myPurchases}</span>
              </h2>
              <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
                {purchases.length} {t.items}
              </span>
            </div>

            {loadingPurchases ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className={`w-6 h-6 text-${accentColor}-400 animate-spin`} />
              </div>
            ) : purchases.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {purchases.map((purchase) => {
                  const CategoryIcon = getCategoryIcon(purchase.item?.category || purchase.itemSnapshot?.category);
                  const rarity = purchase.item?.rarity || purchase.itemSnapshot?.rarity || 'common';
                  
                  return (
                    <div 
                      key={purchase._id}
                      className={`flex items-center space-x-4 p-4 bg-dark-800/50 rounded-xl border border-white/5 hover:border-${accentColor}-500/30 transition-colors`}
                    >
                      {/* Item Icon */}
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getRarityColor(rarity)}`}>
                        {purchase.item?.image ? (
                          <img src={purchase.item.image} alt="" className="w-8 h-8 object-contain" />
                        ) : (
                          <CategoryIcon className="w-6 h-6" />
                        )}
                      </div>
                      
                      {/* Item Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate">
                          {purchase.item?.name || purchase.itemSnapshot?.name}
                        </h3>
                        <div className="flex items-center space-x-2 text-xs">
                          <span className={`px-2 py-0.5 rounded border ${getRarityColor(rarity)}`}>
                            {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                          </span>
                          <span className="text-gray-500">
                            {t.purchasedOn} {new Date(purchase.createdAt).toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : language === 'it' ? 'it-IT' : 'en-US')}
                          </span>
                        </div>
                      </div>

                      {/* Price Paid */}
                      <div className="flex items-center space-x-1 text-yellow-400">
                        <Coins className="w-4 h-4" />
                        <span className="font-medium">{purchase.pricePaid}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">{t.noPurchases}</p>
                <button
                  onClick={() => navigate(`/${selectedMode}/shop`)}
                  className={`px-4 py-2 bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white font-medium rounded-lg hover:opacity-90 transition-opacity`}
                >
                  {t.viewShop}
                </button>
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Leave Squad Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`bg-dark-900 border border-${accentColor}-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl`}>
            <div className="text-center mb-6">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full bg-${accentColor}-500/20 flex items-center justify-center`}>
                {leaveError ? (
                  <AlertCircle className={`w-8 h-8 text-${accentColor}-400`} />
                ) : (
                  <Users className={`w-8 h-8 text-${accentColor}-400`} />
                )}
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{t.leaveSquad}</h3>
              {leaveError ? (
                <p className="text-red-400 text-sm">{leaveError}</p>
              ) : (
                <p className="text-gray-400 text-sm">{t.confirmLeaveSquad}</p>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowLeaveModal(false);
                  setLeaveError('');
                }}
                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors font-medium"
              >
                {t.cancel}
              </button>
              {!leaveError && (
                <button
                  onClick={confirmLeaveSquad}
                  disabled={leavingSquad}
                  className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {leavingSquad ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    t.confirm
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyProfile;
