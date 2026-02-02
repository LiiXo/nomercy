import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { 
  ArrowLeft, User, FileText, Save, Loader2, Check, X, AlertCircle,
  Trophy, Medal, Target, TrendingUp, Calendar, Coins, Shield, Crown,
  Edit3, LogOut, ShoppingBag, Package, Star, Zap, Gift, Award, Users,
  Swords, Eye, Settings, Trash2
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
  const [activisionId, setActivisionId] = useState(user?.activisionId || '');
  const [platform, setPlatform] = useState(user?.platform || '');
  const [usernameStatus, setUsernameStatus] = useState('current');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Banner upload state
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(user?.banner || null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  
  // Avatar upload state
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Purchases state
  const [purchases, setPurchases] = useState([]);
  const [loadingPurchases, setLoadingPurchases] = useState(true);
  
  // Ranking state from DB
  const [ranking, setRanking] = useState(null);
  const [rankingHardcore, setRankingHardcore] = useState(null);
  const [rankingCdl, setRankingCdl] = useState(null);
  const [loadingRanking, setLoadingRanking] = useState(true);
  const [rankThresholds, setRankThresholds] = useState(null);

  // Account deletion state (kept for admin/future use)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [loadingDeletion, setLoadingDeletion] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Reset stats state
  const [showResetStatsModal, setShowResetStatsModal] = useState(false);
  const [loadingResetStats, setLoadingResetStats] = useState(false);
  const [resetStatsError, setResetStatsError] = useState('');
  const RESET_STATS_COST = 5000;

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

  // Update banner preview when user.banner changes
  useEffect(() => {
    if (user?.banner) {
      setBannerPreview(user.banner);
    }
  }, [user?.banner]);

  // Update avatar preview when user.avatar changes
  useEffect(() => {
    setAvatarPreview(user?.avatar || null);
  }, [user?.avatar]);

  // Fetch user purchases and ranking
  useEffect(() => {
    fetchPurchases();
    fetchRanking();
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
      // Fetch rankings for BOTH modes and thresholds in parallel (no season filter - show all time stats)
      const [hardcoreRes, cdlRes, settingsRes] = await Promise.all([
        fetch(`${API_URL}/rankings/me/hardcore`, { credentials: 'include' }),
        fetch(`${API_URL}/rankings/me/cdl`, { credentials: 'include' }),
        fetch(`${API_URL}/app-settings/public`)
      ]);
      
      const hardcoreData = await hardcoreRes.json();
      const cdlData = await cdlRes.json();
      const settingsData = await settingsRes.json();
      
      if (hardcoreData.success) {
        setRankingHardcore(hardcoreData.ranking);
      }
      if (cdlData.success) {
        setRankingCdl(cdlData.ranking);
      }
      if (settingsData.success && settingsData.rankedSettings?.rankPointsThresholds) {
        setRankThresholds(settingsData.rankedSettings.rankPointsThresholds);
      }
      
      // Use the ranking for the current mode, or fallback to the one with more points
      if (selectedMode === 'hardcore' && hardcoreData.success) {
        setRanking(hardcoreData.ranking);
      } else if (selectedMode === 'cdl' && cdlData.success) {
        setRanking(cdlData.ranking);
      } else {
        // If current mode ranking doesn't exist, use the one with more points
        const hcPoints = hardcoreData.success ? (hardcoreData.ranking.points || 0) : 0;
        const cdlPoints = cdlData.success ? (cdlData.ranking.points || 0) : 0;
        
        if (hcPoints >= cdlPoints && hardcoreData.success) {
          setRanking(hardcoreData.ranking);
        } else if (cdlData.success) {
          setRanking(cdlData.ranking);
        }
      }
    } catch (err) {
      console.error('Error fetching ranking:', err);
    } finally {
      setLoadingRanking(false);
    }
  };

  const handleDeleteAccount = async () => {
    setLoadingDeletion(true);
    setDeleteError('');
    try {
      const response = await fetch(`${API_URL}/users/delete-account`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        // Account deleted, logout user
        logout();
      } else {
        setDeleteError(data.message);
      }
    } catch (err) {
      console.error('Error deleting account:', err);
      setDeleteError(texts[language]?.errorOccurred || 'Une erreur est survenue');
    } finally {
      setLoadingDeletion(false);
    }
  };

  const handleResetStats = async () => {
    setLoadingResetStats(true);
    setResetStatsError('');
    try {
      const response = await fetch(`${API_URL}/users/reset-my-stats`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setShowResetStatsModal(false);
        setSuccess(texts[language]?.statsResetSuccess || 'Vos statistiques ont été réinitialisées !');
        // Refresh user data
        await refreshUser();
        // Refresh ranking data
        await fetchRanking();
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setResetStatsError(data.message);
      }
    } catch (err) {
      console.error('Error resetting stats:', err);
      setResetStatsError(texts[language]?.errorOccurred || 'Une erreur est survenue');
    } finally {
      setLoadingResetStats(false);
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

  const handleBannerChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError(texts[language]?.bannerTooLarge || 'Banner file must be less than 10MB');
      return;
    }

    // Check file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setError(texts[language]?.bannerInvalidType || 'Only PNG, JPEG, JPG and GIF files are allowed');
      return;
    }

    // Show preview immediately
    setBannerPreview(URL.createObjectURL(file));
    
    // Upload automatically
    setUploadingBanner(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('banner', file);

      const response = await fetch(`${API_URL}/users/upload-banner`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(texts[language]?.bannerUploaded || 'Banner uploaded successfully!');
        setBannerFile(null);
        await refreshUser();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message || 'Upload failed');
        setBannerPreview(user?.banner || null);
      }
    } catch (err) {
      console.error('Banner upload error:', err);
      setError(texts[language]?.errorOccurred || 'An error occurred');
      setBannerPreview(user?.banner || null);
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleBannerDelete = async () => {
    try {
      const response = await fetch(`${API_URL}/users/delete-banner`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();
      if (data.success) {
        setBannerPreview(null);
        setBannerFile(null);
        await refreshUser();
        setSuccess(texts[language]?.bannerDeleted || 'Banner deleted successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      console.error('Banner delete error:', err);
      setError(texts[language]?.errorOccurred || 'An error occurred');
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError(texts[language]?.avatarTooLarge || 'Avatar file must be less than 10MB');
      return;
    }

    // Check file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setError(texts[language]?.avatarInvalidType || 'Only PNG, JPEG, JPG and GIF files are allowed');
      return;
    }

    // Show preview immediately
    setAvatarPreview(URL.createObjectURL(file));
    
    // Upload automatically
    setUploadingAvatar(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch(`${API_URL}/users/upload-avatar`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(texts[language]?.avatarUploaded || 'Avatar uploaded successfully!');
        await refreshUser();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message || 'Upload failed');
        setAvatarPreview(user?.avatar || null);
      }
    } catch (err) {
      console.error('Avatar upload error:', err);
      setError(texts[language]?.errorOccurred || 'An error occurred');
      setAvatarPreview(user?.avatar || null);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarDelete = async () => {
    try {
      const response = await fetch(`${API_URL}/users/delete-avatar`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();
      if (data.success) {
        setAvatarPreview(null);
        await refreshUser();
        setSuccess(texts[language]?.avatarDeleted || 'Avatar deleted, reverted to Discord avatar!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      console.error('Avatar delete error:', err);
      setError(texts[language]?.errorOccurred || 'An error occurred');
    }
  };

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
    if (activisionId !== user?.activisionId) updates.activisionId = activisionId;
    if (platform !== user?.platform) updates.platform = platform;

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
    setActivisionId(user?.activisionId || '');
    setPlatform(user?.platform || '');
    setBannerFile(null);
    setBannerPreview(user?.banner || null);
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

  // Traductions des noms de rangs
  const RANK_NAMES = {
    bronze: { fr: 'Bronze', en: 'Bronze', de: 'Bronze', it: 'Bronzo' },
    silver: { fr: 'Argent', en: 'Silver', de: 'Silber', it: 'Argento' },
    gold: { fr: 'Or', en: 'Gold', de: 'Gold', it: 'Oro' },
    platinum: { fr: 'Platine', en: 'Platinum', de: 'Platin', it: 'Platino' },
    diamond: { fr: 'Diamant', en: 'Diamond', de: 'Diamant', it: 'Diamante' },
    master: { fr: 'Maître', en: 'Master', de: 'Meister', it: 'Maestro' },
    grandmaster: { fr: 'Grand Maître', en: 'Grandmaster', de: 'Großmeister', it: 'Gran Maestro' },
    champion: { fr: 'Champion', en: 'Champion', de: 'Champion', it: 'Campione' }
  };

  // Rank styles for each division
  const RANK_STYLES = {
    champion: { key: 'champion', color: 'text-yellow-400', icon: Zap, image: '/8.png', hexColor: '#F1C40F' },
    grandmaster: { key: 'grandmaster', color: 'text-red-400', icon: Crown, image: '/7.png', hexColor: '#E74C3C' },
    master: { key: 'master', color: 'text-purple-400', icon: Trophy, image: '/6.png', hexColor: '#9B59B6' },
    diamond: { key: 'diamond', color: 'text-blue-400', icon: Star, image: '/5.png', hexColor: '#B9F2FF' },
    platinum: { key: 'platinum', color: 'text-teal-400', icon: Medal, image: '/4.png', hexColor: '#00CED1' },
    gold: { key: 'gold', color: 'text-yellow-400', icon: Medal, image: '/3.png', hexColor: '#FFD700' },
    silver: { key: 'silver', color: 'text-gray-300', icon: Shield, image: '/2.png', hexColor: '#C0C0C0' },
    bronze: { key: 'bronze', color: 'text-amber-600', icon: Shield, image: '/1.png', hexColor: '#CD7F32' }
  };

  const getDivisionFromPoints = (points) => {
    // Use thresholds from config, or default if not loaded
    const thresholds = rankThresholds || {
      bronze: { min: 0, max: 499 },
      silver: { min: 500, max: 999 },
      gold: { min: 1000, max: 1499 },
      platinum: { min: 1500, max: 1999 },
      diamond: { min: 2000, max: 2499 },
      master: { min: 2500, max: 2999 },
      grandmaster: { min: 3000, max: 3499 },
      champion: { min: 3500, max: null }
    };
    
    // Check ranks from highest to lowest
    const rankOrder = ['champion', 'grandmaster', 'master', 'diamond', 'platinum', 'gold', 'silver', 'bronze'];
    for (const rankKey of rankOrder) {
      const threshold = thresholds[rankKey];
      if (threshold && points >= threshold.min) {
        const style = RANK_STYLES[rankKey];
        return {
          ...style,
          name: RANK_NAMES[rankKey]?.[language] || RANK_NAMES[rankKey]?.en || rankKey
        };
      }
    }
    return {
      ...RANK_STYLES.bronze,
      name: RANK_NAMES.bronze?.[language] || RANK_NAMES.bronze?.en || 'bronze'
    };
  };

  const getWinRate = () => {
    if (!ranking) return '0%';
    const total = ranking.wins + ranking.losses;
    if (total === 0) return '0%';
    return `${Math.round((ranking.wins / total) * 100)}%`;
  };

  // Calculate platform change cooldown
  const getPlatformCooldown = () => {
    if (!user?.platformChangedAt || !user?.platform) return null;
    
    const cooldownMs = 24 * 60 * 60 * 1000; // 24 hours
    const timeSinceChange = Date.now() - new Date(user.platformChangedAt).getTime();
    const remainingMs = cooldownMs - timeSinceChange;
    
    if (remainingMs <= 0) return null;
    
    const hours = Math.floor(remainingMs / (60 * 60 * 1000));
    const minutes = Math.ceil((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
    
    return { hours, minutes, remainingMs };
  };

  const platformCooldown = getPlatformCooldown();

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
      goToSquadPage: 'Gérer mon escouade',
      deleteAccount: 'Supprimer mon compte',
      deleteAccountTitle: 'Supprimer votre compte',
      deleteAccountWarning: 'Cette action est irréversible et immédiate. Toutes vos données seront définitivement supprimées.',
      deleteAccountConfirm: 'Êtes-vous vraiment sûr de vouloir supprimer définitivement votre compte ?',
      cannotDeleteWithSquad: 'Vous devez d\'abord quitter votre escouade.',
      cannotDeleteBanned: 'Impossible de supprimer un compte banni.',
      confirmDelete: 'Supprimer définitivement',
      dangerZone: 'Zone Dangereuse',
      activisionId: 'Activision ID',
      platform: 'Plateforme',
      selectPlatform: 'Sélectionnez une plateforme',
      banner: 'Bannière',
      uploadBanner: 'Télécharger bannière',
      deleteBanner: 'Supprimer bannière',
      bannerUploaded: 'Bannière téléchargée !',
      bannerDeleted: 'Bannière supprimée !',
      bannerTooLarge: 'La bannière doit faire moins de 10MB',
      bannerInvalidType: 'Seuls les fichiers PNG, JPEG, JPG et GIF sont autorisés',
      bannerInfo: 'PNG, JPEG, GIF - Max 10MB',
      avatar: 'Avatar',
      uploadAvatar: 'Changer l\'avatar',
      deleteAvatar: 'Revenir à Discord',
      avatarUploaded: 'Avatar téléchargé !',
      avatarDeleted: 'Avatar supprimé, retour à Discord !',
      avatarTooLarge: 'L\'avatar doit faire moins de 10MB',
      avatarInvalidType: 'Seuls les fichiers PNG, JPEG, JPG et GIF sont autorisés',
      avatarInfo: 'PNG, JPEG, GIF - Max 10MB',
      resetStats: 'Réinitialiser mes stats',
      resetStatsTitle: 'Réinitialiser vos statistiques',
      resetStatsDescription: 'Cette action va réinitialiser toutes vos statistiques de jeu.',
      resetStatsWillReset: 'Ce qui sera remis à zéro :',
      resetStatsVictories: 'Victoires et défaites',
      resetStatsMatches: 'Historique des matchs (Ladder et Classé)',
      resetStatsRankedPoints: 'Points et rang en mode classé',
      resetStatsKD: 'Statistiques de performance',
      resetStatsCost: 'Coût de la réinitialisation',
      resetStatsConfirm: 'Confirmer la réinitialisation',
      resetStatsNotEnoughGold: 'Gold insuffisant',
      statsResetSuccess: 'Vos statistiques ont été réinitialisées !',
      goldRequired: 'gold requis',
      resetStatsFree: 'GRATUIT',
      resetStatsFirstFree: 'Première réinitialisation gratuite !',
      resetStatsCount: 'Réinitialisations effectuées',
      platformCooldown: 'Changement de plateforme disponible dans',
      platformCooldownHours: 'h',
      platformCooldownMinutes: 'min'
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
      goToSquadPage: 'Manage my squad',
      deleteAccount: 'Delete my account',
      deleteAccountTitle: 'Delete your account',
      deleteAccountWarning: 'This action is irreversible and immediate. All your data will be permanently deleted.',
      deleteAccountConfirm: 'Are you really sure you want to permanently delete your account?',
      cannotDeleteWithSquad: 'You must leave your squad first.',
      cannotDeleteBanned: 'Cannot delete a banned account.',
      confirmDelete: 'Permanently delete',
      dangerZone: 'Danger Zone',
      activisionId: 'Activision ID',
      platform: 'Platform',
      selectPlatform: 'Select a platform',
      banner: 'Banner',
      uploadBanner: 'Upload banner',
      deleteBanner: 'Delete banner',
      bannerUploaded: 'Banner uploaded!',
      bannerDeleted: 'Banner deleted!',
      bannerTooLarge: 'Banner must be less than 10MB',
      bannerInvalidType: 'Only PNG, JPEG, JPG and GIF files are allowed',
      bannerInfo: 'PNG, JPEG, GIF - Max 10MB',
      avatar: 'Avatar',
      uploadAvatar: 'Change avatar',
      deleteAvatar: 'Revert to Discord',
      avatarUploaded: 'Avatar uploaded!',
      avatarDeleted: 'Avatar deleted, reverted to Discord!',
      avatarTooLarge: 'Avatar must be less than 10MB',
      avatarInvalidType: 'Only PNG, JPEG, JPG and GIF files are allowed',
      avatarInfo: 'PNG, JPEG, GIF - Max 10MB',
      resetStats: 'Reset my stats',
      resetStatsTitle: 'Reset your statistics',
      resetStatsDescription: 'This action will reset all your game statistics.',
      resetStatsWillReset: 'What will be reset:',
      resetStatsVictories: 'Victories and defeats',
      resetStatsMatches: 'Match history (Ladder and Ranked)',
      resetStatsRankedPoints: 'Ranked mode points and rank',
      resetStatsKD: 'Performance statistics',
      resetStatsCost: 'Reset cost',
      resetStatsConfirm: 'Confirm reset',
      resetStatsNotEnoughGold: 'Not enough gold',
      statsResetSuccess: 'Your statistics have been reset!',
      goldRequired: 'gold required',
      resetStatsFree: 'FREE',
      resetStatsFirstFree: 'First reset is free!',
      resetStatsCount: 'Resets performed',
      platformCooldown: 'Platform change available in',
      platformCooldownHours: 'h',
      platformCooldownMinutes: 'min'
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
      goToSquadPage: 'Mein Squad verwalten',
      deleteAccount: 'Mein Konto löschen',
      deleteAccountTitle: 'Konto löschen',
      deleteAccountWarning: 'Diese Aktion ist unwiderruflich und sofort. Alle Ihre Daten werden endgültig gelöscht.',
      deleteAccountConfirm: 'Sind Sie wirklich sicher, dass Sie Ihr Konto endgültig löschen möchten?',
      cannotDeleteWithSquad: 'Sie müssen zuerst Ihr Squad verlassen.',
      cannotDeleteBanned: 'Ein gesperrtes Konto kann nicht gelöscht werden.',
      confirmDelete: 'Endgültig löschen',
      dangerZone: 'Gefahrenzone',
      activisionId: 'Activision ID',
      platform: 'Plattform',
      selectPlatform: 'Plattform auswählen',
      banner: 'Banner',
      uploadBanner: 'Banner hochladen',
      deleteBanner: 'Banner löschen',
      bannerUploaded: 'Banner hochgeladen!',
      bannerDeleted: 'Banner gelöscht!',
      bannerTooLarge: 'Banner muss kleiner als 10MB sein',
      bannerInvalidType: 'Nur PNG, JPEG, JPG und GIF Dateien sind erlaubt',
      bannerInfo: 'PNG, JPEG, GIF - Max 10MB',
      avatar: 'Avatar',
      uploadAvatar: 'Avatar ändern',
      deleteAvatar: 'Zurück zu Discord',
      avatarUploaded: 'Avatar hochgeladen!',
      avatarDeleted: 'Avatar gelöscht, zurück zu Discord!',
      avatarTooLarge: 'Avatar muss kleiner als 10MB sein',
      avatarInvalidType: 'Nur PNG, JPEG, JPG und GIF Dateien sind erlaubt',
      avatarInfo: 'PNG, JPEG, GIF - Max 10MB',
      resetStats: 'Statistiken zurücksetzen',
      resetStatsTitle: 'Statistiken zurücksetzen',
      resetStatsDescription: 'Diese Aktion setzt alle Ihre Spielstatistiken zurück.',
      resetStatsWillReset: 'Was zurückgesetzt wird:',
      resetStatsVictories: 'Siege und Niederlagen',
      resetStatsMatches: 'Spielverlauf (Ladder und Ranked)',
      resetStatsRankedPoints: 'Ranked-Punkte und Rang',
      resetStatsKD: 'Leistungsstatistiken',
      resetStatsCost: 'Kosten für das Zurücksetzen',
      resetStatsConfirm: 'Zurücksetzen bestätigen',
      resetStatsNotEnoughGold: 'Nicht genug Gold',
      statsResetSuccess: 'Ihre Statistiken wurden zurückgesetzt!',
      goldRequired: 'Gold erforderlich',
      resetStatsFree: 'KOSTENLOS',
      resetStatsFirstFree: 'Erstes Zurücksetzen ist kostenlos!',
      resetStatsCount: 'Durchgeführte Zurücksetzungen',
      platformCooldown: 'Plattformwechsel verfügbar in',
      platformCooldownHours: 'h',
      platformCooldownMinutes: 'min'
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
      goToSquadPage: 'Gestisci la mia squadra',
      deleteAccount: 'Elimina il mio account',
      deleteAccountTitle: 'Elimina il tuo account',
      deleteAccountWarning: 'Questa azione è irreversibile e immediata. Tutti i tuoi dati verranno eliminati definitivamente.',
      deleteAccountConfirm: 'Sei davvero sicuro di voler eliminare definitivamente il tuo account?',
      cannotDeleteWithSquad: 'Devi prima lasciare la tua squadra.',
      cannotDeleteBanned: 'Impossibile eliminare un account bannato.',
      confirmDelete: 'Elimina definitivamente',
      dangerZone: 'Zona Pericolosa',
      activisionId: 'Activision ID',
      platform: 'Piattaforma',
      selectPlatform: 'Seleziona una piattaforma',
      banner: 'Banner',
      uploadBanner: 'Carica banner',
      deleteBanner: 'Elimina banner',
      bannerUploaded: 'Banner caricato!',
      bannerDeleted: 'Banner eliminato!',
      bannerTooLarge: 'Il banner deve essere inferiore a 10MB',
      bannerInvalidType: 'Sono consentiti solo file PNG, JPEG, JPG e GIF',
      bannerInfo: 'PNG, JPEG, GIF - Max 10MB',
      avatar: 'Avatar',
      uploadAvatar: 'Cambia avatar',
      deleteAvatar: 'Torna a Discord',
      avatarUploaded: 'Avatar caricato!',
      avatarDeleted: 'Avatar eliminato, tornato a Discord!',
      avatarTooLarge: 'L\'avatar deve essere inferiore a 10MB',
      avatarInvalidType: 'Sono consentiti solo file PNG, JPEG, JPG e GIF',
      avatarInfo: 'PNG, JPEG, GIF - Max 10MB',
      resetStats: 'Reset statistiche',
      resetStatsTitle: 'Reset delle statistiche',
      resetStatsDescription: 'Questa azione resetterà tutte le tue statistiche di gioco.',
      resetStatsWillReset: 'Cosa verrà resettato:',
      resetStatsVictories: 'Vittorie e sconfitte',
      resetStatsMatches: 'Storico partite (Ladder e Classificate)',
      resetStatsRankedPoints: 'Punti e rango classificato',
      resetStatsKD: 'Statistiche delle prestazioni',
      resetStatsCost: 'Costo del reset',
      resetStatsConfirm: 'Conferma reset',
      resetStatsNotEnoughGold: 'Gold insufficiente',
      statsResetSuccess: 'Le tue statistiche sono state resettate!',
      goldRequired: 'gold richiesti',
      resetStatsFree: 'GRATIS',
      resetStatsFirstFree: 'Primo reset gratuito!',
      resetStatsCount: 'Reset effettuati',
      platformCooldown: 'Cambio piattaforma disponibile tra',
      platformCooldownHours: 'h',
      platformCooldownMinutes: 'min'
    }
  };

  const t = texts[language] || texts.en;

  if (!user) return null;

  // Find the ranking with the highest points to display the best rank
  // Simple logic: use whichever ranking has more points
  const hcPoints = rankingHardcore?.points || 0;
  const cdlPoints = rankingCdl?.points || 0;
  const hcHasPlayed = rankingHardcore && (rankingHardcore.wins > 0 || rankingHardcore.losses > 0);
  const cdlHasPlayed = rankingCdl && (rankingCdl.wins > 0 || rankingCdl.losses > 0);
  
  // Get the best ranking: the one with more points among those where player has played
  let bestRanking = null;
  if (hcHasPlayed && cdlHasPlayed) {
    // Player has played both - use the one with more points
    bestRanking = hcPoints >= cdlPoints ? rankingHardcore : rankingCdl;
  } else if (hcHasPlayed) {
    bestRanking = rankingHardcore;
  } else if (cdlHasPlayed) {
    bestRanking = rankingCdl;
  }
  
  // Show division based on the best ranking found
  const division = bestRanking ? getDivisionFromPoints(bestRanking.points || 0) : null;
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
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-${accentColor}-500/20 overflow-hidden mb-4 sm:mb-6`}>
          {/* Banner */}
          {user.banner && (
            <div className="w-full h-32 sm:h-48 relative overflow-hidden">
              <img 
                src={`https://api-nomercy.ggsecure.io${user.banner}`}
                alt="Profile banner"
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-dark-900/80"></div>
            </div>
          )}
          
          <div className="p-4 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden">
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
                        onClick={() => navigate(`/player/${user._id || user.id}`)}
                        className={`p-1.5 sm:p-2 hover:bg-${accentColor}-500/20 rounded-lg transition-colors`}
                        title={t.viewPublicProfile}
                      >
                        <Eye className={`w-4 h-4 text-${accentColor}-400`} />
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Rank badge */}
                {division && (
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                    <img 
                      src={division.image} 
                      alt={division.name}
                      className="w-6 h-6 object-contain"
                      style={{ filter: `drop-shadow(0 0 4px ${division.hexColor || '#fff'}80)` }}
                    />
                    <span 
                      className="text-sm font-semibold"
                      style={{ color: division.hexColor || '#fff' }}
                    >
                      {division.name}
                    </span>
                    {bestRanking && bestRanking.points > 0 && (
                      <span className="text-xs text-gray-500">({bestRanking.points} pts)</span>
                    )}
                  </div>
                )}
                
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
          </div>

          {/* Edit Form */}
          {isEditing && (
            <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-${accentColor}-500/20 p-4 sm:p-6 mb-4 sm:mb-6`}>
              <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center space-x-2">
                <Edit3 className={`w-4 sm:w-5 h-4 sm:h-5 text-${accentColor}-400`} />
                <span>{t.editProfile}</span>
              </h2>

              <div className="space-y-3 sm:space-y-4">
                {/* Username */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">{t.username}</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                      maxLength={20}
                      className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-dark-800/50 border border-white/10 rounded-lg sm:rounded-xl text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none focus:border-${accentColor}-500/50 focus:ring-2 focus:ring-${accentColor}-500/20 transition-all`}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                      {usernameStatus === 'checking' && <Loader2 className="w-4 sm:w-5 h-4 sm:h-5 text-gray-400 animate-spin" />}
                      {usernameStatus === 'available' && <Check className="w-4 sm:w-5 h-4 sm:h-5 text-green-400" />}
                      {usernameStatus === 'taken' && <X className="w-4 sm:w-5 h-4 sm:h-5 text-red-400" />}
                      {usernameStatus === 'invalid' && <AlertCircle className="w-4 sm:w-5 h-4 sm:h-5 text-yellow-400" />}
                      {usernameStatus === 'current' && <span className="text-xs text-gray-500">{t.current}</span>}
                    </div>
                  </div>
                </div>

                {/* Activision ID */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">{t.activisionId}</label>
                  <input
                    type="text"
                    value={activisionId}
                    onChange={(e) => setActivisionId(e.target.value)}
                    maxLength={50}
                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-dark-800/50 border border-white/10 rounded-lg sm:rounded-xl text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none focus:border-${accentColor}-500/50 focus:ring-2 focus:ring-${accentColor}-500/20 transition-all`}
                  />
                </div>

                {/* Platform */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">{t.platform}</label>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {['PC', 'PlayStation', 'Xbox'].map((p) => {
                      const isCurrentPlatform = user?.platform === p;
                      const isDisabled = platformCooldown && !isCurrentPlatform;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => !isDisabled && setPlatform(p)}
                          disabled={isDisabled}
                          className={`py-2 sm:py-3 px-2 sm:px-4 rounded-lg sm:rounded-xl border transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
                            platform === p
                              ? `bg-${accentColor}-500/20 border-${accentColor}-500/50 text-${accentColor}-400`
                              : isDisabled
                                ? 'bg-dark-800/30 border-white/5 text-gray-600 cursor-not-allowed'
                                : 'bg-dark-800/50 border-white/10 text-gray-400 hover:border-white/20'
                          }`}
                        >
                          {p === 'PC' && (
                            <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M20 3H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h6v2H8v2h8v-2h-2v-2h6c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 12H4V5h16v10z"/>
                            </svg>
                          )}
                          {p === 'PlayStation' && (
                            <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M9.5 6.5v-4H11V7a2 2 0 1 1-4 0V4h1.5v3a.5.5 0 0 0 1 0zM16 6.5v-4h1.5V8a.5.5 0 0 0 1 0V6.5H20V8a2 2 0 1 1-4 0V2.5h1.5V6a.5.5 0 0 0 1 0v-.5h1V8a2 2 0 1 1-4 0v-1.5zM4 10.5v11a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-7a.5.5 0 0 0-.5.5zm1.5 1H11v9H5.5v-9z"/>
                            </svg>
                          )}
                          {p === 'Xbox' && (
                            <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6.43 3.72A9.97 9.97 0 0 1 12 2c2.05 0 3.95.62 5.57 1.72-.37.15-.86.42-1.47.9-1.23.96-2.56 2.56-3.95 4.76L12 9.5l-.15-.12c-1.39-2.2-2.72-3.8-3.95-4.76-.61-.48-1.1-.75-1.47-.9zM2.05 12.9c-.03-.3-.05-.6-.05-.9 0-2.43.87-4.66 2.32-6.39.3.18.7.45 1.13.79 1.54 1.2 3.18 3.25 4.72 5.95l.18.3-.18.3c-1.54 2.7-3.18 4.75-4.72 5.95-.43.34-.83.61-1.13.79A9.93 9.93 0 0 1 2.05 12.9zm8.1 2.45c1.39 2.2 2.72 3.8 3.95 4.76.61.48 1.1.75 1.47.9A9.97 9.97 0 0 1 12 22a9.97 9.97 0 0 1-5.57-1.72c.37-.15.86-.42 1.47-.9 1.23-.96 2.56-2.56 3.95-4.76l.15-.12.15.12v-.27zm3.7-6.7c1.54-2.7 3.18-4.75 4.72-5.95.43-.34.83-.61 1.13-.79A9.93 9.93 0 0 1 22 12c0 .3-.02.6-.05.9a9.93 9.93 0 0 1-2.27 5.49c-.3-.18-.7-.45-1.13-.79-1.54-1.2-3.18-3.25-4.72-5.95l-.18-.3.18-.3.02.03z"/>
                            </svg>
                          )}
                          <span className="font-medium text-xs sm:text-sm">{p === 'PlayStation' ? 'PS' : p}</span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Platform cooldown message */}
                  {platformCooldown && (
                    <p className="text-xs text-yellow-500 mt-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {t.platformCooldown} {platformCooldown.hours}{t.platformCooldownHours} {platformCooldown.minutes}{t.platformCooldownMinutes}
                    </p>
                  )}
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">{t.bio}</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder={t.bioPlaceholder}
                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-dark-800/50 border border-white/10 rounded-lg sm:rounded-xl text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none focus:border-${accentColor}-500/50 focus:ring-2 focus:ring-${accentColor}-500/20 transition-all resize-none`}
                  />
                  <p className="text-xs text-gray-500 mt-1 text-right">{bio.length}/500</p>
                </div>

                {/* Avatar Upload */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">{t.avatar}</label>
                  <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                    {/* Avatar Preview */}
                    <div className="relative flex-shrink-0">
                      <div className="w-16 sm:w-20 h-16 sm:h-20 rounded-full overflow-hidden">
                        <img 
                          src={
                            avatarPreview?.startsWith('blob:') 
                              ? avatarPreview 
                              : avatarPreview?.startsWith('/uploads/') 
                                ? `https://api-nomercy.ggsecure.io${avatarPreview}`
                                : user?.avatar || `https://cdn.discordapp.com/embed/avatars/0.png`
                          }
                          alt="Avatar preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {uploadingAvatar && (
                        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                          <Loader2 className="w-5 sm:w-6 h-5 sm:h-6 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                    
                    {/* Upload/Delete Buttons */}
                    <div className="flex flex-row sm:flex-col gap-2 flex-1 w-full sm:w-auto">
                      <label className={`flex-1 cursor-pointer ${uploadingAvatar ? 'pointer-events-none opacity-50' : ''}`}>
                        <div className={`px-3 sm:px-4 py-2 bg-dark-800/50 border border-white/10 rounded-lg sm:rounded-xl text-center text-gray-400 hover:border-${accentColor}-500/50 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm`}>
                          {uploadingAvatar ? (
                            <>
                              <Loader2 className="w-3.5 sm:w-4 h-3.5 sm:h-4 animate-spin" />
                              <span>Upload...</span>
                            </>
                          ) : (
                            <>
                              <Edit3 className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                              <span className="hidden sm:inline">{t.uploadAvatar}</span>
                              <span className="sm:hidden">Changer</span>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/gif"
                          onChange={handleAvatarChange}
                          className="hidden"
                          disabled={uploadingAvatar}
                        />
                      </label>
                      
                      {/* Show delete button only if user has custom avatar */}
                      {user?.avatar?.startsWith('/uploads/avatars/') && (
                        <button
                          type="button"
                          onClick={handleAvatarDelete}
                          className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg sm:rounded-xl text-red-400 hover:bg-red-500/20 transition-all text-xs sm:text-sm flex items-center justify-center gap-2"
                        >
                          <X className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                          <span className="hidden sm:inline">{t.deleteAvatar}</span>
                          <span className="sm:hidden">Reset</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center sm:text-left">{t.avatarInfo}</p>
                </div>

                {/* Banner Upload */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">{t.banner}</label>
                  {bannerPreview && (
                    <div className="mb-2 sm:mb-3 relative rounded-lg sm:rounded-xl overflow-hidden border border-white/10">
                      <img 
                        src={bannerPreview.startsWith('blob:') ? bannerPreview : `https://api-nomercy.ggsecure.io${bannerPreview}`}
                        alt="Banner preview" 
                        className="w-full h-24 sm:h-32 object-cover"
                      />
                      {uploadingBanner && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader2 className="w-6 sm:w-8 h-6 sm:h-8 text-white animate-spin" />
                        </div>
                      )}
                      {!uploadingBanner && (
                        <button
                          onClick={handleBannerDelete}
                          type="button"
                          className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 p-1.5 sm:p-2 bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors"
                        >
                          <X className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-white" />
                        </button>
                      )}
                    </div>
                  )}
                  <label className={`block cursor-pointer ${uploadingBanner ? 'pointer-events-none opacity-50' : ''}`}>
                    <div className={`px-3 sm:px-4 py-2.5 sm:py-3 bg-dark-800/50 border border-white/10 rounded-lg sm:rounded-xl text-center text-gray-400 hover:border-${accentColor}-500/50 transition-all flex items-center justify-center gap-2 text-sm`}>
                      {uploadingBanner ? (
                        <>
                          <Loader2 className="w-3.5 sm:w-4 h-3.5 sm:h-4 animate-spin" />
                          <span>Upload...</span>
                        </>
                      ) : (
                        t.uploadBanner
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/gif"
                      onChange={handleBannerChange}
                      className="hidden"
                      disabled={uploadingBanner}
                    />
                  </label>
                  <p className="text-xs text-gray-500 mt-1">{t.bannerInfo}</p>
                </div>

                {/* Error */}
                {error && (
                  <div className="p-2.5 sm:p-3 bg-red-500/10 border border-red-500/30 rounded-lg sm:rounded-xl">
                    <p className="text-red-400 text-xs sm:text-sm">{error}</p>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-2 sm:gap-3 pt-1">
                  <button
                    onClick={handleCancel}
                    className="flex-1 py-2.5 sm:py-3 px-3 sm:px-4 bg-dark-800 hover:bg-dark-700 border border-white/10 text-white font-medium rounded-lg sm:rounded-xl transition-colors text-sm sm:text-base"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSubmitting || (username !== user?.username && usernameStatus !== 'available' && usernameStatus !== 'current')}
                    className={`flex-1 py-2.5 sm:py-3 px-3 sm:px-4 bg-gradient-to-r ${gradientFrom} ${gradientTo} hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg sm:rounded-xl transition-all flex items-center justify-center gap-2 text-sm sm:text-base`}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 sm:w-5 h-4 sm:h-5 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-4 sm:w-5 h-4 sm:h-5" />
                        <span>{t.save}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

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

          {/* Reset Stats Section */}
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-orange-500/30 p-4 sm:p-6 mt-4 sm:mt-6`}>
            <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center space-x-2">
              <Target className={`w-4 sm:w-5 h-4 sm:h-5 text-orange-400`} />
              <span>{t.resetStats}</span>
              {(user?.statsResetCount || 0) > 0 && (
                <span className="text-xs text-gray-500 font-normal">({t.resetStatsCount}: {user?.statsResetCount || 0})</span>
              )}
            </h2>

            {/* Available state - always available */}
            <div className="space-y-3 sm:space-y-4">
              <p className="text-gray-400 text-xs sm:text-sm">{t.resetStatsDescription}</p>
              
              {/* First reset free notice */}
              {(user?.statsResetCount || 0) === 0 && (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                  <Gift className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span className="text-green-400 text-sm font-medium">{t.resetStatsFirstFree}</span>
                </div>
              )}
              
              {/* Cost display */}
              <div className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg border border-white/10">
                <span className="text-gray-300 text-sm">{t.resetStatsCost}</span>
                <div className="flex items-center gap-2">
                  {(user?.statsResetCount || 0) === 0 ? (
                    <span className="text-green-400 font-bold">{t.resetStatsFree}</span>
                  ) : (
                    <>
                      <Coins className="w-4 h-4 text-yellow-400" />
                      <span className="text-yellow-400 font-bold">{RESET_STATS_COST}</span>
                    </>
                  )}
                </div>
              </div>
              
              {/* Your gold balance (only show if not first reset) */}
              {(user?.statsResetCount || 0) > 0 && (
                <div className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg border border-white/10">
                  <span className="text-gray-300 text-sm">{t.gold}</span>
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-yellow-400" />
                    <span className={`font-bold ${(user?.goldCoins || 0) >= RESET_STATS_COST ? 'text-green-400' : 'text-red-400'}`}>
                      {user?.goldCoins || 0}
                    </span>
                  </div>
                </div>
              )}
              
              <button
                onClick={() => setShowResetStatsModal(true)}
                disabled={(user?.statsResetCount || 0) > 0 && (user?.goldCoins || 0) < RESET_STATS_COST}
                className={`w-full py-2.5 sm:py-3 px-3 sm:px-4 ${
                  (user?.statsResetCount || 0) === 0 || (user?.goldCoins || 0) >= RESET_STATS_COST
                    ? 'bg-orange-500/20 hover:bg-orange-500/30 border-orange-500/30 text-orange-400'
                    : 'bg-gray-500/20 border-gray-500/30 text-gray-500 cursor-not-allowed'
                } border font-medium rounded-lg sm:rounded-xl transition-all flex items-center justify-center gap-2 text-sm sm:text-base`}
              >
                <Target className="w-4 sm:w-5 h-4 sm:h-5" />
                {(user?.statsResetCount || 0) === 0 
                  ? t.resetStats 
                  : (user?.goldCoins || 0) >= RESET_STATS_COST 
                    ? t.resetStats 
                    : t.resetStatsNotEnoughGold}
              </button>
              
              {(user?.statsResetCount || 0) > 0 && (user?.goldCoins || 0) < RESET_STATS_COST && (
                <p className="text-xs text-orange-400 text-center">
                  {RESET_STATS_COST - (user?.goldCoins || 0)} {t.goldRequired}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Account Modal - Hidden but kept for potential future use */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-dark-900 border border-red-500/30 rounded-xl sm:rounded-2xl p-4 sm:p-6 max-w-md w-full shadow-2xl">
            <div className="text-center mb-4 sm:mb-6">
              <div className="w-12 sm:w-16 h-12 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-6 sm:w-8 h-6 sm:h-8 text-red-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2">{t.deleteAccountTitle}</h3>
              <p className="text-gray-400 text-xs sm:text-sm mb-3 sm:mb-4">{t.deleteAccountConfirm}</p>
              <p className="text-red-400 text-xs sm:text-sm">{t.deleteAccountWarning}</p>
              {deleteError && (
                <p className="text-red-400 text-xs sm:text-sm mt-3 p-2 bg-red-500/10 rounded">{deleteError}</p>
              )}
            </div>
            
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteError('');
                }}
                className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg sm:rounded-xl transition-colors font-medium text-sm sm:text-base"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={loadingDeletion}
                className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg sm:rounded-xl transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                {loadingDeletion ? (
                  <Loader2 className="w-4 sm:w-5 h-4 sm:h-5 animate-spin" />
                ) : (
                  t.confirmDelete
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Stats Modal */}
      {showResetStatsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-dark-900 border border-orange-500/30 rounded-xl sm:rounded-2xl p-4 sm:p-6 max-w-md w-full shadow-2xl">
            <div className="text-center mb-4 sm:mb-6">
              <div className="w-12 sm:w-16 h-12 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Target className="w-6 sm:w-8 h-6 sm:h-8 text-orange-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2">{t.resetStatsTitle}</h3>
              <p className="text-gray-400 text-xs sm:text-sm mb-3 sm:mb-4">{t.resetStatsDescription}</p>
              
              {/* What will be reset */}
              <div className="text-left bg-dark-800/50 rounded-lg p-3 mb-4">
                <p className="text-orange-400 text-sm font-medium mb-2">{t.resetStatsWillReset}</p>
                <ul className="space-y-1.5 text-xs sm:text-sm text-gray-300">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>
                    {t.resetStatsVictories}
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>
                    {t.resetStatsMatches}
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>
                    {t.resetStatsRankedPoints}
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>
                    {t.resetStatsKD}
                  </li>
                </ul>
              </div>
              
              {/* Cost */}
              {(user?.statsResetCount || 0) === 0 ? (
                <div className="flex items-center justify-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                  <Gift className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 font-bold">{t.resetStatsFree}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                  <span className="text-gray-300 text-sm">{t.resetStatsCost}:</span>
                  <Coins className="w-4 h-4 text-yellow-400" />
                  <span className="text-yellow-400 font-bold">{RESET_STATS_COST}</span>
                </div>
              )}
              
              {resetStatsError && (
                <p className="text-red-400 text-xs sm:text-sm mt-3 p-2 bg-red-500/10 rounded">{resetStatsError}</p>
              )}
            </div>
            
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => {
                  setShowResetStatsModal(false);
                  setResetStatsError('');
                }}
                className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg sm:rounded-xl transition-colors font-medium text-sm sm:text-base"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleResetStats}
                disabled={loadingResetStats}
                className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg sm:rounded-xl transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                {loadingResetStats ? (
                  <Loader2 className="w-4 sm:w-5 h-4 sm:h-5 animate-spin" />
                ) : (
                  t.resetStatsConfirm
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyProfile;
