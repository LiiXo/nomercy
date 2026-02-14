import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import GameModeRulesEditor from '../components/GameModeRulesEditor';
import { getAvatarUrl } from '../utils/avatar';
import AdminOverview from '../components/admin/AdminOverview';
import AdminUsers from '../components/admin/AdminUsers';
import AdminSquads from '../components/admin/AdminSquads';
import AdminApplication from '../components/admin/AdminApplication';
import AdminTeam from '../components/admin/AdminTeam';
import { 
  ArrowLeft, Shield, Package, Users, BarChart3, Plus, Edit2, Trash2, 
  Save, X, Loader2, Search, ChevronDown, Eye, EyeOff, Coins, TrendingUp, TrendingDown,
  ShoppingBag, Crown, Star, Zap, Gift, Award, Image, Ban, UserCheck,
  Trophy, Medal, Target, RefreshCw, Megaphone, Bell, AlertTriangle,
  FileText, Calendar, Clock, Wrench, RotateCcw, Gamepad2, Swords, Skull, UserPlus,
  CheckCircle, Database, Settings, List, Filter, Download, Upload, Check,
  MapPin, Flag, Activity, Layers, Power, ToggleLeft, ToggleRight, AlertCircle,
  ShieldAlert, Link, ExternalLink, MessageSquare, Lock, Menu, History, Heart, Cpu,
  Monitor, Cloud, Syringe
} from 'lucide-react';

import { API_URL } from '../config';

const AdminPanel = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isStaff, refreshUser } = useAuth();
  const { language } = useLanguage();
  
  // Check if user is admin (full access), staff (limited access), or arbitre (very limited access)
  const userIsAdmin = user?.roles?.includes('admin') || false;
  const userIsStaff = user?.roles?.includes('staff') || user?.roles?.includes('admin') || false;
  const userIsArbitre = user?.roles?.includes('arbitre') || false;
  const hasAdminAccess = userIsAdmin || userIsStaff || userIsArbitre;
  
  // États principaux
  // Arbitre starts on 'users' tab since they don't have access to overview
  const [activeTab, setActiveTab] = useState(() => {
    // Check if user is only arbitre (not admin or staff)
    if (user?.roles?.includes('arbitre') && !user?.roles?.includes('admin') && !user?.roles?.includes('staff')) {
      return 'users';
    }
    return 'overview';
  });
  const [activeSubTab, setActiveSubTab] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Données
  const [users, setUsers] = useState([]);
  const [squads, setSquads] = useState([]);
  const [deletedAccounts, setDeletedAccounts] = useState([]);
  const [shopItems, setShopItems] = useState([]);
  const [trophies, setTrophies] = useState([]);
  const [matches, setMatches] = useState([]);
  const [rankedMatches, setRankedMatches] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [rankings, setRankings] = useState([]);
  const [maps, setMaps] = useState([]);
  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState(null);
  
  // Iris players state
  const [irisPlayers, setIrisPlayers] = useState([]);
  const [loadingIrisPlayers, setLoadingIrisPlayers] = useState(false);
  const [irisSearchTerm, setIrisSearchTerm] = useState('');
  const [scanningPlayerId, setScanningPlayerId] = useState(null);
  const [irisDetailsPlayer, setIrisDetailsPlayer] = useState(null);
  const [resettingIrisPlayer, setResettingIrisPlayer] = useState(null); // For reset confirmation
  const [confirmIrisReset, setConfirmIrisReset] = useState(false);
  
  // Iris updates state (admin only)
  const [irisSubTab, setIrisSubTab] = useState('players'); // 'players' or 'updates'
  const [irisUpdates, setIrisUpdates] = useState([]);
  const [loadingIrisUpdates, setLoadingIrisUpdates] = useState(false);
  const [showIrisUpdateModal, setShowIrisUpdateModal] = useState(false);
  const [editingIrisUpdate, setEditingIrisUpdate] = useState(null);
  const [irisUpdateFormData, setIrisUpdateFormData] = useState({
    version: '',
    downloadUrl: '',
    changelog: '',
    mandatory: false,
    isCurrent: false,
    signature: ''
  });
  const [savingIrisUpdate, setSavingIrisUpdate] = useState(false);
  
  // Filtres et recherche
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ITEMS_PER_PAGE = 20;
  
  // Matches tab sub-tab state
  const [matchesSubTab, setMatchesSubTab] = useState('ranked'); // 'ranked' or 'stricker'
  const [matchesFilter, setMatchesFilter] = useState('all'); // all, pending, completed, disputed
  
  // Maps tab filter
  const [mapModeFilter, setMapModeFilter] = useState('all'); // 'all', 'hardcore', 'cdl', 'stricker'
  
  // Mobile menu state
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // Modales
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [resetStatsConfirm, setResetStatsConfirm] = useState(null);
  const [resettingStats, setResettingStats] = useState(false);
  
  // User match history management states
  const [userMatches, setUserMatches] = useState({ ladder: [], ranked: [] });
  const [loadingUserMatches, setLoadingUserMatches] = useState(false);
  const [showUserMatchHistory, setShowUserMatchHistory] = useState(false);
  const [deletingMatchId, setDeletingMatchId] = useState(null);
  
  // User purchase history and give item states (admin only)
  const [showUserPurchases, setShowUserPurchases] = useState(false);
  const [userPurchases, setUserPurchases] = useState([]);
  const [loadingUserPurchases, setLoadingUserPurchases] = useState(false);
  const [selectedUserForPurchases, setSelectedUserForPurchases] = useState(null);
  const [showGiveItemModal, setShowGiveItemModal] = useState(false);
  const [selectedUserForGiveItem, setSelectedUserForGiveItem] = useState(null);
  const [availableShopItems, setAvailableShopItems] = useState([]);
  const [selectedItemToGive, setSelectedItemToGive] = useState(null);
  const [givingItem, setGivingItem] = useState(false);
  
  // User trophy management states (admin only)
  const [showUserTrophies, setShowUserTrophies] = useState(false);
  const [selectedUserForTrophies, setSelectedUserForTrophies] = useState(null);
  const [userTrophiesList, setUserTrophiesList] = useState([]);
  const [loadingUserTrophies, setLoadingUserTrophies] = useState(false);
  const [showAddTrophyModal, setShowAddTrophyModal] = useState(false);
  const [userTrophyToAdd, setUserTrophyToAdd] = useState(null);
  const [selectedSeasonForTrophy, setSelectedSeasonForTrophy] = useState(1);
  const [addingTrophy, setAddingTrophy] = useState(false);
  const [removingTrophyId, setRemovingTrophyId] = useState(null);
  
  // System reset states
  const [confirmText, setConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);
  
  // Config edit states
  const [editedConfig, setEditedConfig] = useState(null);
  
  // App settings states (must be declared before tabGroups)
  const [appSettings, setAppSettings] = useState(null);
  
  
  // Messages states
  const [allMessages, setAllMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  
  // Events states (Double XP, Double Gold)
  const [events, setEvents] = useState({
    doubleXP: { enabled: false, startsAt: null, expiresAt: null, active: false },
    doubleGold: { enabled: false, startsAt: null, expiresAt: null, active: false }
  });
  const [loadingEvents, setLoadingEvents] = useState(false);
  
  // Scheduled event form state
  const [showScheduleEventModal, setShowScheduleEventModal] = useState(false);
  const [scheduleEventData, setScheduleEventData] = useState({
    startsAt: '',
    expiresAt: ''
  });
  
  // Update editedConfig when config changes
  // Ensure all expected game modes are present for ranked rewards
  useEffect(() => {
    if (config) {
      // Deep clone the config
      const updatedConfig = JSON.parse(JSON.stringify(config));
      
      // Default rewards structure for missing game modes
      const defaultReward = { pointsWin: 30, pointsLoss: -15, coinsWin: 70, coinsLoss: 20, xpWinMin: 700, xpWinMax: 800 };
      
      // Expected game modes per mode
      const expectedGameModes = {
        hardcore: ['Duel', 'Team Deathmatch', 'Search & Destroy'],
        cdl: ['Hardpoint', 'Search & Destroy']
      };
      
      // Ensure rankedMatchRewards structure exists
      if (!updatedConfig.rankedMatchRewards) {
        updatedConfig.rankedMatchRewards = { hardcore: {}, cdl: {} };
      }
      
      // Initialize missing modes and game modes
      for (const [mode, gameModes] of Object.entries(expectedGameModes)) {
        if (!updatedConfig.rankedMatchRewards[mode]) {
          updatedConfig.rankedMatchRewards[mode] = {};
        }
        for (const gameMode of gameModes) {
          if (!updatedConfig.rankedMatchRewards[mode][gameMode]) {
            updatedConfig.rankedMatchRewards[mode][gameMode] = { ...defaultReward };
          }
        }
      }
      
      setEditedConfig(updatedConfig);
    }
  }, [config]);

  // Load appSettings on mount for staff access control
  useEffect(() => {
    if (userIsStaff && !appSettings) {
      fetchAppSettings();
    }
  }, [userIsStaff]);
  
  // Fetch events status
  const fetchEvents = async () => {
    try {
      const response = await fetch(`${API_URL}/app-settings/admin/events`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success && data.events) {
        setEvents(data.events);
      }
    } catch (err) {
      console.error('Error fetching events:', err);
    }
  };
  
  // Load events on mount for admin
  useEffect(() => {
    if (userIsAdmin) {
      fetchEvents();
    }
  }, [userIsAdmin]);
  
  // Toggle Double XP event (instant toggle)
  const handleToggleDoubleXP = async () => {
    setLoadingEvents(true);
    try {
      const response = await fetch(`${API_URL}/app-settings/admin/events/double-xp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: !events.doubleXP?.enabled })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(data.message);
        fetchEvents();
      } else {
        setError(data.message || 'Erreur');
      }
    } catch (err) {
      setError('Erreur lors de la mise à jour');
    } finally {
      setLoadingEvents(false);
    }
  };
  
  // Schedule Double XP event with start/end dates
  const handleScheduleDoubleXP = async () => {
    if (!scheduleEventData.startsAt || !scheduleEventData.expiresAt) {
      setError('Veuillez remplir les dates de début et de fin');
      return;
    }
    setLoadingEvents(true);
    try {
      const response = await fetch(`${API_URL}/app-settings/admin/events/double-xp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          enabled: true,
          startsAt: scheduleEventData.startsAt,
          expiresAt: scheduleEventData.expiresAt
        })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(data.message);
        setShowScheduleEventModal(false);
        setScheduleEventData({ startsAt: '', expiresAt: '' });
        fetchEvents();
      } else {
        setError(data.message || 'Erreur');
      }
    } catch (err) {
      setError('Erreur lors de la programmation');
    } finally {
      setLoadingEvents(false);
    }
  };
  
  // RAZ TOTAL CLASSÉ - Reset all ranked stats for both modes
  const handleResetAllRanked = async () => {
    if (!window.confirm('\u26a0\ufe0f RAZ TOTAL CLASS\u00c9 \u26a0\ufe0f\n\nCette action va remettre \u00e0 z\u00e9ro:\n- Tous les points\n- Toutes les victoires\n- Toutes les d\u00e9faites\n\nPour TOUS les joueurs en mode Hardcore ET CDL.\n\nCette action est IRR\u00c9VERSIBLE!\n\nContinuer?')) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/app-settings/admin/reset-all-ranked`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(data.message);
      } else {
        setError(data.message || 'Erreur');
      }
    } catch (err) {
      setError('Erreur lors de la remise \u00e0 z\u00e9ro');
    } finally {
      setSaving(false);
    }
  };
  
  // Toggle Double Gold event
  const handleToggleDoubleGold = async () => {
    setLoadingEvents(true);
    try {
      const response = await fetch(`${API_URL}/app-settings/admin/events/double-gold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: !events.doubleGold?.enabled, durationHours: 24 })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(data.message);
        fetchEvents();
      } else {
        setError(data.message || 'Erreur');
      }
    } catch (err) {
      setError('Erreur lors de la mise à jour');
    } finally {
      setLoadingEvents(false);
    }
  };
  
  // Format remaining time for events
  const formatEventTimeRemaining = (expiresAt) => {
    if (!expiresAt) return null;
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry - now;
    if (diff <= 0) return 'Expiré';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m restantes`;
  };

  // Navigation tabs configuration grouped by category
  // Staff has limited access based on appSettings.staffAdminAccess
  // Arbitre has very limited access (users, squads view-only, matches, deleted-accounts)
  const tabGroups = [
    {
      name: 'Général',
      tabs: [
        { id: 'overview', label: 'Vue d\'ensemble', icon: BarChart3, adminOnly: false, arbitreAccess: false },
      ]
    },
    {
      name: 'Gestion',
      tabs: [
        { id: 'users', label: 'Utilisateurs', icon: Users, adminOnly: false, arbitreAccess: true },
        { id: 'squads', label: 'Escouades', icon: Shield, adminOnly: false, arbitreAccess: true },
        { id: 'matches', label: 'Matchs', icon: Swords, adminOnly: false, arbitreAccess: true },
        { id: 'iris', label: 'Iris', icon: Cpu, adminOnly: false, arbitreAccess: false },
        { id: 'deleted-accounts', label: 'Comptes Supprimés', icon: Trash2, adminOnly: false, arbitreAccess: true },
        { id: 'messages', label: 'Messages', icon: MessageSquare, adminOnly: false, arbitreAccess: false },
      ]
    },
    {
      name: 'Contenu',
      tabs: [
        { id: 'shop', label: 'Boutique', icon: ShoppingBag, adminOnly: true, arbitreAccess: false },
        { id: 'trophies', label: 'Trophées', icon: Trophy, adminOnly: true, arbitreAccess: false },
        { id: 'announcements', label: 'Annonces', icon: Megaphone, adminOnly: false, arbitreAccess: false },
        { id: 'maps', label: 'Cartes', icon: MapPin, adminOnly: false, arbitreAccess: false },
        { id: 'gamerules', label: 'Règles', icon: FileText, adminOnly: false, arbitreAccess: false },
      ]
    },
    {
      name: 'Système',
      adminOnly: true,
      tabs: [
        { id: 'application', label: 'Application', icon: Power, adminOnly: true, arbitreAccess: false },
        { id: 'team', label: 'Équipe', icon: Heart, adminOnly: true, arbitreAccess: false },
        { id: 'config', label: 'Config', icon: Settings, adminOnly: true, arbitreAccess: false },
        { id: 'seasons', label: 'Saisons', icon: Calendar, adminOnly: true, arbitreAccess: false },
        { id: 'system', label: 'Système', icon: Database, adminOnly: true, arbitreAccess: false },
      ]
    }
  ];

  // Flatten all tabs for compatibility
  const allTabs = tabGroups.flatMap(group => group.tabs);
  
  // Filter tabs based on user role and staff access settings
  const getStaffAccess = (tabId) => {
    if (userIsAdmin) return true;
    // Admin-only tabs are never accessible to staff or arbitre
    const tab = allTabs.find(t => t.id === tabId);
    if (tab?.adminOnly) return false;
    // Arbitre has specific limited access
    if (userIsArbitre && !userIsStaff) {
      return tab?.arbitreAccess === true;
    }
    // Check appSettings for staff access - default to true if not set
    if (!appSettings || !appSettings.staffAdminAccess) return true;
    return appSettings.staffAdminAccess[tabId] !== false;
  };
  
  const tabs = userIsAdmin 
    ? allTabs 
    : userIsArbitre && !userIsStaff
      ? allTabs.filter(tab => tab.arbitreAccess === true)
      : allTabs.filter(tab => !tab.adminOnly && getStaffAccess(tab.id));

  // Ban modal states
  const [showBanModal, setShowBanModal] = useState(false);
  const [banData, setBanData] = useState({
    userId: null,
    username: '',
    reason: '',
    durationType: 'permanent', // 'hours', 'days', 'months', 'permanent'
    durationValue: 1
  });

  // Squad trophy modal state
  const [showSquadTrophyModal, setShowSquadTrophyModal] = useState(false);
  const [squadForTrophy, setSquadForTrophy] = useState(null);
  const [selectedTrophyToAdd, setSelectedTrophyToAdd] = useState('');
  const [trophyReason, setTrophyReason] = useState('');

  // Warn modal state
  const [showWarnModal, setShowWarnModal] = useState(false);
  const [warnData, setWarnData] = useState({
    userId: null,
    username: '',
    reason: '',
    isAbandonWarn: false,
    recentMatches: [],
    selectedMatchId: null,
    loadingMatches: false
  });

  // Ranked ban modal state
  const [showRankedBanModal, setShowRankedBanModal] = useState(false);
  const [rankedBanData, setRankedBanData] = useState({
    userId: null,
    username: '',
    isRankedBanned: false,
    reason: '',
    duration: '7d', // '1d', '7d', '30d', 'permanent', 'custom'
    customDays: 7
  });

  // Squad ladder points modal state
  const [showLadderPointsModal, setShowLadderPointsModal] = useState(false);
  const [squadForLadderPoints, setSquadForLadderPoints] = useState(null);
  const [ladderPointsEdit, setLadderPointsEdit] = useState({});

  // Squad Stricker stats modal state
  const [showStrickerStatsModal, setShowStrickerStatsModal] = useState(false);
  const [squadForStrickerStats, setSquadForStrickerStats] = useState(null);
  const [strickerStatsFormat, setStrickerStatsFormat] = useState('5v5'); // '3v3' or '5v5'
  const [strickerStatsEdit, setStrickerStatsEdit] = useState({
    points: 0,
    wins: 0,
    losses: 0,
    cranes: 0
  });

  const openSquadTrophyModal = (squad) => {
    setSquadForTrophy(squad);
    setSelectedTrophyToAdd('');
    setTrophyReason('');
    setShowSquadTrophyModal(true);
    // Fetch trophies if not already loaded
    if (trophies.length === 0) {
      fetchTrophies();
    }
  };

  const openLadderPointsModal = (squad) => {
    setSquadForLadderPoints(squad);
    // Initialize ladder points edit state with current values
    const points = {};
    if (squad.registeredLadders) {
      squad.registeredLadders.forEach(ladder => {
        points[ladder.ladderId] = ladder.points || 0;
      });
    }
    setLadderPointsEdit(points);
    setShowLadderPointsModal(true);
  };

  const openStrickerStatsModal = (squad) => {
    setSquadForStrickerStats(squad);
    setStrickerStatsFormat('5v5'); // Default to 5v5
    // Initialize Stricker stats edit state with 5v5 values (legacy statsStricker)
    setStrickerStatsEdit({
      points: squad.statsStricker?.points || 0,
      wins: squad.statsStricker?.wins || 0,
      losses: squad.statsStricker?.losses || 0,
      cranes: squad.cranes || 0
    });
    setShowStrickerStatsModal(true);
  };
  
  // Update stats edit when format changes
  const handleStrickerFormatChange = (format) => {
    if (!squadForStrickerStats) return;
    setStrickerStatsFormat(format);
    // Load the corresponding format stats (5v5 uses legacy statsStricker)
    const statsField = format === '3v3' ? 'statsStricker3v3' : 'statsStricker';
    const stats = squadForStrickerStats[statsField] || {};
    setStrickerStatsEdit({
      points: stats.points || 0,
      wins: stats.wins || 0,
      losses: stats.losses || 0,
      cranes: squadForStrickerStats.cranes || 0 // Cranes are shared
    });
  };

  const handleUpdateLadderPoints = async () => {
    if (!squadForLadderPoints) return;
    
    try {
      const response = await fetch(`${API_URL}/squads/admin/${squadForLadderPoints._id}/ladder-points`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ladderPoints: ladderPointsEdit })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Points ladder mis à jour avec succès');
        setShowLadderPointsModal(false);
        fetchSquads();
      } else {
        setError(data.message || 'Erreur lors de la mise à jour');
      }
    } catch (err) {
      setError('Erreur lors de la mise à jour des points');
    }
  };

  const handleUpdateStrickerStats = async () => {
    if (!squadForStrickerStats) return;
    
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/squads/admin/${squadForStrickerStats._id}/stricker-stats`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          statsStricker: {
            points: parseInt(strickerStatsEdit.points) || 0,
            wins: parseInt(strickerStatsEdit.wins) || 0,
            losses: parseInt(strickerStatsEdit.losses) || 0
          },
          cranes: parseInt(strickerStatsEdit.cranes) || 0,
          format: strickerStatsFormat
        })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(`Stats Stricker ${strickerStatsFormat} mises à jour avec succès`);
        setShowStrickerStatsModal(false);
        fetchSquads();
      } else {
        setError(data.message || 'Erreur lors de la mise à jour');
      }
    } catch (err) {
      setError('Erreur lors de la mise à jour des stats');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignTrophy = async () => {
    if (!squadForTrophy || !selectedTrophyToAdd) return;
    
    try {
      const response = await fetch(`${API_URL}/squads/${squadForTrophy._id}/assign-trophy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          trophyId: selectedTrophyToAdd, 
          reason: trophyReason || 'Attribué par admin' 
        })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Trophée attribué avec succès');
        setSelectedTrophyToAdd('');
        setTrophyReason('');
        fetchSquads();
        // Update local state
        setSquadForTrophy(data.squad);
      } else {
        setError(data.message || 'Erreur lors de l\'attribution');
      }
    } catch (err) {
      setError('Erreur lors de l\'attribution');
    }
  };

  const handleRemoveTrophy = async (trophyId) => {
    if (!squadForTrophy) return;
    
    try {
      const response = await fetch(`${API_URL}/squads/${squadForTrophy._id}/remove-trophy/${trophyId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Trophée retiré avec succès');
        fetchSquads();
        // Update local state
        setSquadForTrophy(data.squad);
      } else {
        setError(data.message || 'Erreur lors du retrait');
      }
    } catch (err) {
      setError('Erreur lors du retrait');
    }
  };

  useEffect(() => {
    const titles = {
      fr: 'NoMercy - Panel Admin',
      en: 'NoMercy - Admin Panel',
      it: 'NoMercy - Pannello Admin',
      de: 'NoMercy - Admin-Panel',
    };
    document.title = titles[language] || titles.en;
  }, [language]);

  useEffect(() => {
    // Allow admin, staff, and arbitre to access the panel
    if (!userIsAdmin && !userIsStaff && !userIsArbitre) {
      navigate('/');
    }
  }, [userIsAdmin, userIsStaff, userIsArbitre, navigate]);

  useEffect(() => {
    loadTabData();
  }, [activeTab, searchTerm, filterMode, filterStatus, page, matchesSubTab, matchesFilter]);

  // Load appSettings on mount for staff access control
  useEffect(() => {
    fetchAppSettings();
  }, []);

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const loadTabData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'overview':
          await fetchOverviewStats();
          break;
        case 'users':
          await fetchUsers();
          break;
        case 'squads':
          await fetchSquads();
          break;
        case 'iris':
          await fetchIrisPlayers();
          if (userIsAdmin) {
            await fetchIrisUpdates();
          }
          break;
        case 'deleted-accounts':
          await fetchDeletedAccounts();
          break;
        case 'shop':
          await fetchShopItems();
          break;
        case 'trophies':
          await fetchTrophies();
          break;
        case 'messages':
          await fetchAllMessages();
          break;
        case 'application':
          await fetchAppSettings();
          break;
        case 'announcements':
          await fetchAnnouncements();
          break;
        case 'maps':
          await fetchMaps();
          break;
        case 'gamerules':
          await fetchGameRules();
          break;
        case 'matches':
          // Charger les matchs selon le sous-onglet actif
          if (matchesSubTab === 'stricker') {
            await fetchStrickerMatches();
          } else {
            await fetchAdminRankedMatches();
          }
          break;
        case 'seasons':
          await fetchLadderSeasonHistory();
          break;
        case 'config':
          await fetchConfig();
          break;
        case 'system':
          // No fetch needed for system tab
          break;
      }
    } catch (err) {
      console.error('Error loading tab data:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // ==================== FETCH FUNCTIONS ====================

  const fetchOverviewStats = async () => {
    try {
      const response = await fetch(`${API_URL}/users/admin/stats`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchDeletedAccounts = async () => {
    try {
      const params = new URLSearchParams({
        search: searchTerm,
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString()
      });
      
      const response = await fetch(`${API_URL}/users/admin/deleted-accounts?${params}`, {
        credentials: 'include'
      });
      
      const data = await response.json();
      if (data.success) {
        setDeletedAccounts(data.deletedAccounts);
        setTotalPages(data.pagination.pages);
      } else {
        setError('Erreur lors du chargement des comptes supprimés');
      }
    } catch (err) {
      console.error('Fetch deleted accounts error:', err);
      setError('Erreur lors du chargement des comptes supprimés');
    }
  };

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams({
        search: searchTerm,
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString()
      });
      
      const response = await fetch(`${API_URL}/users/admin/all?${params}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
        // Use pagination data from API response
        setTotalPages(data.pagination?.pages || Math.ceil((data.pagination?.total || data.total || data.users.length) / ITEMS_PER_PAGE));
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchSquads = async () => {
    try {
      const params = new URLSearchParams({
        search: searchTerm,
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString()
      });
      
      const response = await fetch(`${API_URL}/squads/admin/all?${params}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setSquads(data.squads);
        // Use pagination data from API response
        setTotalPages(data.pagination?.pages || Math.ceil((data.pagination?.total || data.total || data.squads.length) / ITEMS_PER_PAGE));
      }
    } catch (err) {
      console.error('Error fetching squads:', err);
    }
  };

  const fetchIrisPlayers = async (search = '') => {
    setLoadingIrisPlayers(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      
      const response = await fetch(`${API_URL}/iris/connected-players?${params}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setIrisPlayers(data.players || []);
      }
    } catch (err) {
      console.error('Error fetching Iris players:', err);
    } finally {
      setLoadingIrisPlayers(false);
    }
  };

  // Handle Iris Scan (admin only) - Toggle scan mode
  const handleIrisScan = async (playerId) => {
    setScanningPlayerId(playerId);
    try {
      const response = await fetch(`${API_URL}/iris/scan/${playerId}`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(data.message);
        // Update player's scan mode in local state
        setIrisPlayers(prev => prev.map(p => 
          p._id === playerId 
            ? { ...p, scanMode: data.scanModeEnabled, hasScanChannel: data.scanModeEnabled }
            : p
        ));
      } else {
        setError(data.message || 'Erreur lors du scan');
      }
    } catch (err) {
      setError('Erreur lors du scan Iris');
    } finally {
      setScanningPlayerId(null);
    }
  };

  // Fetch Iris updates (admin only)
  const fetchIrisUpdates = async () => {
    setLoadingIrisUpdates(true);
    try {
      const response = await fetch(`${API_URL}/iris/updates`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setIrisUpdates(data.updates || []);
      }
    } catch (err) {
      console.error('Error fetching Iris updates:', err);
    } finally {
      setLoadingIrisUpdates(false);
    }
  };

  // Create or update Iris update
  const handleSaveIrisUpdate = async () => {
    setSavingIrisUpdate(true);
    try {
      const url = editingIrisUpdate 
        ? `${API_URL}/iris/updates/${editingIrisUpdate._id}`
        : `${API_URL}/iris/updates`;
      
      const response = await fetch(url, {
        method: editingIrisUpdate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(irisUpdateFormData)
      });
      
      const data = await response.json();
      if (data.success) {
        setSuccess(data.message || 'Mise à jour sauvegardée');
        setShowIrisUpdateModal(false);
        setEditingIrisUpdate(null);
        fetchIrisUpdates();
      } else {
        setError(data.message || 'Erreur lors de la sauvegarde');
      }
    } catch (err) {
      setError('Erreur lors de la sauvegarde');
    } finally {
      setSavingIrisUpdate(false);
    }
  };

  // Set update as current version
  const handleSetCurrentIrisUpdate = async (updateId) => {
    try {
      const response = await fetch(`${API_URL}/iris/updates/${updateId}/set-current`, {
        method: 'POST',
        credentials: 'include'
      });
      
      const data = await response.json();
      if (data.success) {
        setSuccess(data.message || 'Version définie comme actuelle');
        fetchIrisUpdates();
      } else {
        setError(data.message || 'Erreur');
      }
    } catch (err) {
      setError('Erreur lors de la mise à jour');
    }
  };

  // Delete Iris update
  const handleDeleteIrisUpdate = async (updateId) => {
    try {
      const response = await fetch(`${API_URL}/iris/updates/${updateId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      const data = await response.json();
      if (data.success) {
        setSuccess(data.message || 'Mise à jour supprimée');
        fetchIrisUpdates();
      } else {
        setError(data.message || 'Erreur');
      }
    } catch (err) {
      setError('Erreur lors de la suppression');
    }
  };

  // Open edit modal for Iris update
  const openIrisUpdateModal = (update = null) => {
    if (update) {
      setEditingIrisUpdate(update);
      setIrisUpdateFormData({
        version: update.version,
        downloadUrl: update.downloadUrl,
        changelog: update.changelog || '',
        mandatory: update.mandatory || false,
        isCurrent: update.isCurrent || false,
        signature: update.signature || ''
      });
    } else {
      setEditingIrisUpdate(null);
      setIrisUpdateFormData({
        version: '',
        downloadUrl: '',
        changelog: '',
        mandatory: false,
        isCurrent: false,
        signature: ''
      });
    }
    setShowIrisUpdateModal(true);
  };

  const fetchShopItems = async () => {
    try {
      const response = await fetch(`${API_URL}/shop/admin/items`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setShopItems(data.items || []);
      }
    } catch (err) {
      console.error('Error fetching shop items:', err);
    }
  };

  const fetchTrophies = async () => {
    try {
      const response = await fetch(`${API_URL}/trophies/admin/all`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setTrophies(data.trophies || []);
      }
    } catch (err) {
      console.error('Error fetching trophies:', err);
    }
  };

  const fetchMatches = async () => {
    try {
      const params = new URLSearchParams({
        status: filterStatus !== 'all' ? filterStatus : '',
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString()
      });
      
      const response = await fetch(`${API_URL}/matches/admin/all?${params}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setMatches(data.matches || []);
        setTotalPages(Math.ceil((data.total || 0) / ITEMS_PER_PAGE));
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
    }
  };

  const fetchRankedMatches = async () => {
    try {
      const params = new URLSearchParams({
        status: filterStatus !== 'all' ? filterStatus : '',
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString()
      });
      
      const response = await fetch(`${API_URL}/ranked-matches/admin/all?${params}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setRankedMatches(data.matches || []);
      }
    } catch (err) {
      console.error('Error fetching ranked matches:', err);
    }
  };

  const fetchAllMessages = async () => {
    try {
      const response = await fetch(`${API_URL}/messages/admin/all`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  const fetchAppSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/app-settings/admin`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setAppSettings(data.settings);
      }
    } catch (err) {
      console.error('Error fetching app settings:', err);
    }
  };

  const fetchRankings = async () => {
    try {
      const params = new URLSearchParams({
        mode: filterMode !== 'all' ? filterMode : 'hardcore',
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString()
      });
      
      const response = await fetch(`${API_URL}/rankings/admin/all?${params}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setRankings(data.rankings || []);
        setTotalPages(Math.ceil((data.total || 0) / ITEMS_PER_PAGE));
      }
    } catch (err) {
      console.error('Error fetching rankings:', err);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const response = await fetch(`${API_URL}/announcements/admin/all`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setAnnouncements(data.announcements || []);
      }
    } catch (err) {
      console.error('Error fetching announcements:', err);
    }
  };

  const fetchSeasons = async () => {
    try {
      const response = await fetch(`${API_URL}/seasons/admin/all`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setSeasons(data.seasons || []);
      }
    } catch (err) {
      console.error('Error fetching seasons:', err);
    }
  };

  const fetchMaps = async () => {
    try {
      const response = await fetch(`${API_URL}/maps/admin/all`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setMaps(data.maps || []);
      }
    } catch (err) {
      console.error('Error fetching maps:', err);
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await fetch(`${API_URL}/config/admin`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setConfig(data.config);
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  };

  const fetchGameRules = async () => {
    try {
      const response = await fetch(`${API_URL}/game-mode-rules`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        // Store game rules if needed
      }
    } catch (err) {
      console.error('Error fetching game rules:', err);
    }
  };

  // ==================== CRUD OPERATIONS ====================

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      let endpoint = '';
      let method = 'POST';
      let body = { ...formData };

      switch (modalType) {
        case 'user':
          endpoint = '/users/admin/create';
          break;
        case 'squad':
          endpoint = '/squads/admin/create';
          break;
        case 'shopItem':
          endpoint = '/shop/admin/items';
          break;
        case 'trophy':
          endpoint = '/trophies/admin/create';
          break;
        case 'announcement':
          endpoint = '/announcements/admin';
          break;
        case 'season':
          endpoint = '/seasons/admin/create';
          break;
        case 'map':
          endpoint = '/maps/admin/create';
          break;
        default:
          throw new Error('Type de création inconnu');
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Élément créé avec succès!');
      setShowModal(false);
        setFormData({});
        loadTabData();
      } else {
        setError(data.message || 'Erreur lors de la création');
      }
    } catch (err) {
      console.error('Error creating item:', err);
      setError(err.message || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      let endpoint = '';
      let body = { ...formData };

      switch (modalType) {
        case 'user':
          endpoint = `/users/admin/${editingItem._id}`;
          break;
        case 'squad':
          endpoint = `/squads/admin/${editingItem._id}`;
          break;
        case 'shopItem':
          endpoint = `/shop/admin/items/${editingItem._id}`;
          break;
        case 'trophy':
          endpoint = `/trophies/admin/${editingItem._id}`;
          break;
        case 'announcement':
          endpoint = `/announcements/admin/${editingItem._id}`;
          break;
        case 'season':
          endpoint = `/seasons/admin/${editingItem._id}`;
          break;
        case 'map':
          endpoint = `/maps/admin/${editingItem._id}`;
          break;
        default:
          throw new Error('Type de mise à jour inconnu');
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Élément mis à jour avec succès!');
      setShowModal(false);
        setEditingItem(null);
        setFormData({});
        loadTabData();
      } else {
        setError(data.message || 'Erreur lors de la mise à jour');
      }
    } catch (err) {
      console.error('Error updating item:', err);
      setError(err.message || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  // Fetch user's match history for admin management
  const fetchUserMatches = async (userId) => {
    setLoadingUserMatches(true);
    try {
      const response = await fetch(`${API_URL}/users/admin/${userId}/matches`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setUserMatches(data.matches);
      } else {
        setError(data.message || 'Erreur lors du chargement des matchs');
      }
    } catch (err) {
      console.error('Error fetching user matches:', err);
      setError('Erreur lors du chargement des matchs');
    } finally {
      setLoadingUserMatches(false);
    }
  };

  // Delete a specific match from user's history
  const handleDeleteUserMatch = async (matchId, matchType) => {
    if (!window.confirm('Supprimer ce match ? Les stats des joueurs seront remboursées.')) {
      return;
    }
    
    setDeletingMatchId(matchId);
    try {
      const endpoint = matchType === 'ranked' 
        ? `/ranked-matches/admin/${matchId}`
        : `/matches/admin/${matchId}`;
      
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(data.message || 'Match supprimé avec succès');
        // Refresh user matches
        if (editingItem?._id) {
          fetchUserMatches(editingItem._id);
        }
        // Also refresh the main data
        loadTabData();
      } else {
        setError(data.message || 'Erreur lors de la suppression');
      }
    } catch (err) {
      console.error('Error deleting match:', err);
      setError('Erreur lors de la suppression du match');
    } finally {
      setDeletingMatchId(null);
    }
  };

  const handleDelete = async (type, id) => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      let endpoint = '';

      switch (type) {
        case 'user':
          endpoint = `/users/admin/${id}`;
          break;
        case 'squad':
          endpoint = `/squads/admin/${id}`;
          break;
        case 'shopItem':
          endpoint = `/shop/admin/items/${id}`;
          break;
        case 'trophy':
          endpoint = `/trophies/admin/${id}`;
          break;
        case 'announcement':
          endpoint = `/announcements/admin/${id}`;
          break;
        case 'season':
          endpoint = `/seasons/admin/${id}`;
          break;
        case 'match':
          endpoint = `/matches/admin/${id}`;
          break;
        case 'rankedMatch':
          endpoint = `/ranked-matches/admin/${id}`;
          break;
        case 'map':
          endpoint = `/maps/admin/${id}`;
          break;
        default:
          throw new Error('Type de suppression inconnu');
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Élément supprimé avec succès!');
        setDeleteConfirm(null);
        loadTabData();
      } else {
        setError(data.message || 'Erreur lors de la suppression');
      }
    } catch (err) {
      console.error('Error deleting item:', err);
      setError(err.message || 'Erreur lors de la suppression');
    } finally {
      setSaving(false);
    }
  };

  const handleKickMember = async (squadId, memberId) => {
    if (!window.confirm('Voulez-vous vraiment kick ce membre de l\'escouade ?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/squads/admin/${squadId}/kick/${memberId}`, {
        method: 'POST',
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Membre expulsé avec succès');
        loadTabData();
      } else {
        setError(data.message || 'Erreur lors de l\'expulsion');
      }
    } catch (err) {
      console.error('Kick member error:', err);
      setError('Erreur lors de l\'expulsion');
    }
  };

  const handleResetSquadStricker = async (squad, format = null) => {
    // If no format provided, ask user to choose
    const selectedFormat = format || window.prompt(
      `Quel format voulez-vous réinitialiser pour [${squad.tag}] ${squad.name} ?\n\nEntrez "3v3" ou "5v5":`,
      '5v5'
    );
    
    if (!selectedFormat || !['3v3', '5v5'].includes(selectedFormat)) {
      if (selectedFormat !== null) {
        setError('Format invalide. Utilisez "3v3" ou "5v5".');
      }
      return;
    }
    
    if (!window.confirm(`Voulez-vous vraiment réinitialiser les stats Stricker ${selectedFormat} de l'escouade [${squad.tag}] ${squad.name} ?\n\nCela va remettre à 0:\n- Points Stricker ${selectedFormat}\n- Victoires ${selectedFormat}\n- Défaites ${selectedFormat}\n- Munitions`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/squads/admin/${squad._id}/reset-stricker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ format: selectedFormat })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Stats Stricker ${selectedFormat} de [${squad.tag}] ${squad.name} réinitialisées avec succès`);
        fetchSquads();
      } else {
        setError(data.message || 'Erreur lors de la réinitialisation');
      }
    } catch (err) {
      console.error('Reset squad stricker error:', err);
      setError('Erreur lors de la réinitialisation');
    }
  };

  // ==================== HELPER FUNCTIONS ====================

  const openCreateModal = (type) => {
    setModalType(type);
    setEditingItem(null);
    setFormData(getDefaultFormData(type));
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  const openEditModal = async (type, item) => {
    setModalType(type);
    setEditingItem(item);
    setError('');
    setSuccess('');
    
    // Deep copy arrays and nested objects for proper editing
    let formDataCopy = { ...item };
    if (item.ladders) formDataCopy.ladders = [...item.ladders];
    if (item.gameModes) formDataCopy.gameModes = [...item.gameModes];
    if (item.rankedFormats) formDataCopy.rankedFormats = [...item.rankedFormats];
    
    // Deep copy translations for shop items
    if (type === 'shopItem') {
      formDataCopy.nameTranslations = {
        fr: item.nameTranslations?.fr || '',
        en: item.nameTranslations?.en || '',
        de: item.nameTranslations?.de || '',
        it: item.nameTranslations?.it || ''
      };
      formDataCopy.descriptionTranslations = {
        fr: item.descriptionTranslations?.fr || '',
        en: item.descriptionTranslations?.en || '',
        de: item.descriptionTranslations?.de || '',
        it: item.descriptionTranslations?.it || ''
      };
    }
    
    // Deep copy map config structures
    if (item.hardcoreConfig) {
      formDataCopy.hardcoreConfig = {
        ladder: { 
          enabled: item.hardcoreConfig?.ladder?.enabled || false, 
          gameModes: [...(item.hardcoreConfig?.ladder?.gameModes || [])] 
        },
        ranked: { 
          enabled: item.hardcoreConfig?.ranked?.enabled || false, 
          gameModes: [...(item.hardcoreConfig?.ranked?.gameModes || [])],
          formats: [...(item.hardcoreConfig?.ranked?.formats || [])]
        }
      };
    }
    if (item.cdlConfig) {
      formDataCopy.cdlConfig = {
        ladder: { 
          enabled: item.cdlConfig?.ladder?.enabled || false, 
          gameModes: [...(item.cdlConfig?.ladder?.gameModes || [])] 
        },
        ranked: { 
          enabled: item.cdlConfig?.ranked?.enabled || false, 
          gameModes: [...(item.cdlConfig?.ranked?.gameModes || [])],
          formats: [...(item.cdlConfig?.ranked?.formats || [])]
        }
      };
    }
    if (item.strickerConfig) {
      formDataCopy.strickerConfig = {
        ladder: { 
          enabled: item.strickerConfig?.ladder?.enabled || false, 
          gameModes: [...(item.strickerConfig?.ladder?.gameModes || [])] 
        },
        ranked: { 
          enabled: item.strickerConfig?.ranked?.enabled || false, 
          gameModes: [...(item.strickerConfig?.ranked?.gameModes || [])],
          formats: [...(item.strickerConfig?.ranked?.formats || [])]
        }
      };
    }
    
    // For users, fetch complete data including ranked points
    if (type === 'user' && item._id) {
      try {
        const response = await fetch(`${API_URL}/users/admin/${item._id}`, {
          credentials: 'include'
        });
        const data = await response.json();
        if (data.success && data.user) {
          formDataCopy = { ...formDataCopy, ...data.user };
        }
      } catch (err) {
        console.error('Error fetching user details:', err);
      }
    }
    
    setFormData(formDataCopy);
    setShowModal(true);
  };

  const getDefaultFormData = (type) => {
    switch (type) {
      case 'user':
        return {
          username: '',
          discordId: '',
          discordUsername: '',
          roles: ['user'],
          goldCoins: 500
        };
      case 'squad':
        return {
          name: '',
          tag: '',
          description: '',
          mode: 'both',
          color: '#ef4444',
          maxMembers: 10
        };
      case 'shopItem':
        return {
          name: '',
          description: '',
          nameTranslations: { fr: '', en: '', de: '', it: '' },
          descriptionTranslations: { fr: '', en: '', de: '', it: '' },
          category: 'other',
          price: 0,
          rarity: 'common',
          mode: 'all',
          isActive: true,
          stock: -1
        };
      case 'trophy':
        return {
          name: '',
          description: '',
          icon: 'Trophy',
          color: 'amber',
          rarity: 1,
          rarityName: 'common',
          isActive: true
        };
      case 'announcement':
        return {
      title: '',
      content: '',
      type: 'announcement',
      priority: 'normal',
      targetMode: 'all',
      requiresAcknowledgment: true,
      isActive: true
        };
      case 'season':
        return {
          number: 1,
          name: '',
          mode: 'hardcore',
          status: 'upcoming',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        };
      case 'map':
        return {
          name: '',
          image: '',
          mode: 'both',
          hardcoreConfig: {
            ladder: { enabled: false, gameModes: [] },
            ranked: { enabled: false, gameModes: [], formats: [] }
          },
          cdlConfig: {
            ladder: { enabled: false, gameModes: [] },
            ranked: { enabled: false, gameModes: [], formats: [] }
          },
          strickerConfig: {
            ladder: { enabled: false, gameModes: [] },
            ranked: { enabled: false, gameModes: ['Search & Destroy'], formats: ['5v5'] }
          },
          isActive: true
        };
      default:
        return {};
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', {
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
    });
  };

  const openBanModal = (user) => {
    if (user.isBanned) {
      // Direct unban
      handleUnban(user);
    } else {
      // Open ban modal
      setBanData({
        userId: user._id,
        username: user.username,
        reason: '',
        durationType: 'hours',
        durationValue: 1
      });
      setShowBanModal(true);
    }
  };

  const handleUnban = async (user) => {
    if (!window.confirm(`Voulez-vous vraiment débannir ${user.username} ?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/users/admin/${user._id}/ban`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ban: false,
          reason: '',
          startDate: null,
          endDate: null
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`${user.username} a été débanni`);
      fetchUsers();
      } else {
        setError(data.message || 'Erreur lors du débannissement');
      }
    } catch (err) {
      console.error('Unban error:', err);
      setError('Erreur lors du débannissement');
    }
  };

  const handleBan = async () => {
    if (!banData.reason.trim()) {
      setError('Veuillez entrer une raison pour le ban');
      return;
    }

    try {
      let endDate = null;
      const now = new Date();
      const value = banData.durationValue || 1;

      switch (banData.durationType) {
        case 'hours':
          endDate = new Date(now.getTime() + value * 60 * 60 * 1000);
          break;
        case 'days':
          endDate = new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
          break;
        case 'months':
          endDate = new Date(now.getTime() + value * 30 * 24 * 60 * 60 * 1000);
          break;
        default: // permanent
          endDate = null;
      }

      const response = await fetch(`${API_URL}/users/admin/${banData.userId}/ban`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ban: true,
          reason: banData.reason,
          startDate: now.toISOString(),
          endDate: endDate ? endDate.toISOString() : null
        })
      });

      const data = await response.json();

      if (data.success) {
        let durationText = 'définitivement';
        if (banData.durationType !== 'permanent') {
          const unitText = banData.durationType === 'hours' ? (value > 1 ? 'heures' : 'heure') :
            banData.durationType === 'days' ? (value > 1 ? 'jours' : 'jour') :
            (value > 1 ? 'mois' : 'mois');
          durationText = `pour ${value} ${unitText}`;
        }
        setSuccess(`${banData.username} a été banni ${durationText}`);
        setShowBanModal(false);
        fetchUsers();
      } else {
        setError(data.message || 'Erreur lors du bannissement');
      }
    } catch (err) {
      console.error('Ban error:', err);
      setError('Erreur lors du bannissement');
    }
  };

  // Toggle referent ban (prevents user from being selected as referent in ranked matches)
  const handleToggleReferentBan = async (user) => {
    const newBanState = !user.isReferentBanned;
    const actionText = newBanState ? 'empêcher d\'être référent' : 'autoriser à être référent';
    
    if (!window.confirm(`Voulez-vous vraiment ${actionText} pour ${user.username} ?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/users/admin/${user._id}/referent-ban`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ban: newBanState })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(newBanState 
          ? `${user.username} ne peut plus être référent dans les matchs classés` 
          : `${user.username} peut maintenant être référent dans les matchs classés`);
        fetchUsers();
      } else {
        setError(data.message || 'Erreur lors de la modification');
      }
    } catch (err) {
      console.error('Toggle referent ban error:', err);
      setError('Erreur lors de la modification du statut référent');
    }
  };

  // Fetch user purchase history (admin only)
  const fetchUserPurchases = async (userId) => {
    setLoadingUserPurchases(true);
    try {
      const response = await fetch(`${API_URL}/shop/admin/user-purchases/${userId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setUserPurchases(data.purchases);
      } else {
        setError(data.message || 'Erreur lors de la récupération des achats');
      }
    } catch (err) {
      console.error('Error fetching user purchases:', err);
      setError('Erreur lors de la récupération des achats');
    } finally {
      setLoadingUserPurchases(false);
    }
  };

  // Open user purchase history modal
  const openUserPurchasesModal = (user) => {
    setSelectedUserForPurchases(user);
    setUserPurchases([]);
    setShowUserPurchases(true);
    fetchUserPurchases(user._id);
  };

  // Fetch available shop items for giving
  const fetchAvailableShopItems = async () => {
    try {
      const response = await fetch(`${API_URL}/shop/admin/all-items`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setAvailableShopItems(data.items);
      }
    } catch (err) {
      console.error('Error fetching shop items:', err);
    }
  };

  // Open give item modal
  const openGiveItemModal = (user) => {
    setSelectedUserForGiveItem(user);
    setSelectedItemToGive(null);
    setShowGiveItemModal(true);
    if (availableShopItems.length === 0) {
      fetchAvailableShopItems();
    }
  };

  // Give item to user
  const handleGiveItem = async () => {
    if (!selectedItemToGive || !selectedUserForGiveItem) {
      setError('Veuillez sélectionner un objet');
      return;
    }

    setGivingItem(true);
    try {
      const response = await fetch(`${API_URL}/shop/admin/give-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: selectedUserForGiveItem._id,
          itemId: selectedItemToGive._id
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`${selectedItemToGive.name} a été donné à ${selectedUserForGiveItem.username}`);
        setShowGiveItemModal(false);
        setSelectedItemToGive(null);
      } else {
        setError(data.message || 'Erreur lors du don de l\'objet');
      }
    } catch (err) {
      console.error('Give item error:', err);
      setError('Erreur lors du don de l\'objet');
    } finally {
      setGivingItem(false);
    }
  };

  // Delete/Refund a purchase (admin only)
  const handleDeletePurchase = async (purchaseId, refund = true) => {
    if (!window.confirm(refund ? 'Supprimer cet achat et rembourser le gold ?' : 'Supprimer cet achat sans remboursement ?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/shop/admin/purchases/${purchaseId}?refund=${refund}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        // Refresh purchases
        if (selectedUserForPurchases) {
          fetchUserPurchases(selectedUserForPurchases._id);
        }
      } else {
        setError(data.message || 'Erreur lors de la suppression');
      }
    } catch (err) {
      console.error('Delete purchase error:', err);
      setError('Erreur lors de la suppression de l\'achat');
    }
  };

  // ==================== USER TROPHY MANAGEMENT ====================
  
  // Open user trophy management modal
  const openUserTrophiesModal = async (user) => {
    setSelectedUserForTrophies(user);
    setUserTrophiesList(user.trophies || []);
    setShowUserTrophies(true);
    // Fetch trophies list if not already loaded
    if (trophies.length === 0) {
      await fetchTrophies();
    }
  };

  // Add trophy to user
  const handleAddTrophyToUser = async () => {
    if (!userTrophyToAdd || !selectedUserForTrophies) {
      setError('Veuillez sélectionner un trophée');
      return;
    }

    setAddingTrophy(true);
    try {
      const response = await fetch(`${API_URL}/users/admin/${selectedUserForTrophies._id}/trophies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          trophyId: userTrophyToAdd._id,
          season: selectedSeasonForTrophy
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Trophée "${userTrophyToAdd.name}" ajouté à ${selectedUserForTrophies.username}`);
        setUserTrophiesList(data.trophies || []);
        setShowAddTrophyModal(false);
        setUserTrophyToAdd(null);
        // Update user in list
        setUsers(prev => prev.map(u => u._id === selectedUserForTrophies._id ? { ...u, trophies: data.trophies } : u));
      } else {
        setError(data.message || 'Erreur lors de l\'ajout du trophée');
      }
    } catch (err) {
      console.error('Add trophy error:', err);
      setError('Erreur lors de l\'ajout du trophée');
    } finally {
      setAddingTrophy(false);
    }
  };

  // Remove trophy from user
  const handleRemoveTrophyFromUser = async (trophyEntryId) => {
    if (!window.confirm('Retirer ce trophée de l\'utilisateur ?')) {
      return;
    }

    setRemovingTrophyId(trophyEntryId);
    try {
      const response = await fetch(`${API_URL}/users/admin/${selectedUserForTrophies._id}/trophies/${trophyEntryId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Trophée retiré');
        setUserTrophiesList(data.trophies || []);
        // Update user in list
        setUsers(prev => prev.map(u => u._id === selectedUserForTrophies._id ? { ...u, trophies: data.trophies } : u));
      } else {
        setError(data.message || 'Erreur lors de la suppression du trophée');
      }
    } catch (err) {
      console.error('Remove trophy error:', err);
      setError('Erreur lors de la suppression du trophée');
    } finally {
      setRemovingTrophyId(null);
    }
  };

  // Fetch user's recent ranked matches for abandonment warning
  const fetchUserRecentMatches = async (userId) => {
    setWarnData(prev => ({ ...prev, loadingMatches: true }));
    try {
      const response = await fetch(`${API_URL}/ranked-matches/player-history/${userId}?limit=5`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setWarnData(prev => ({ ...prev, recentMatches: data.matches || [], loadingMatches: false }));
      } else {
        setWarnData(prev => ({ ...prev, recentMatches: [], loadingMatches: false }));
      }
    } catch (err) {
      console.error('Fetch recent matches error:', err);
      setWarnData(prev => ({ ...prev, recentMatches: [], loadingMatches: false }));
    }
  };

  // Open warn modal
  const openWarnModal = (user) => {
    setWarnData({
      userId: user._id,
      username: user.username,
      reason: '',
      isAbandonWarn: false,
      recentMatches: [],
      selectedMatchId: null,
      loadingMatches: false
    });
    setShowWarnModal(true);
  };

  // Handle warn user
  const handleWarn = async () => {
    if (!warnData.reason.trim()) {
      setError('Veuillez entrer une raison pour l\'avertissement');
      return;
    }

    // Validation for abandonment warning
    if (warnData.isAbandonWarn && !warnData.selectedMatchId) {
      setError('Veuillez sélectionner le match abandonné');
      return;
    }

    try {
      const body = {
        reason: warnData.reason,
        isAbandonWarn: warnData.isAbandonWarn,
        abandonedMatchId: warnData.isAbandonWarn ? warnData.selectedMatchId : null
      };

      const response = await fetch(`${API_URL}/users/admin/${warnData.userId}/warn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (data.success) {
        let successMsg = `${warnData.username} a reçu un avertissement (Total: ${data.warnCount})`;
        if (warnData.isAbandonWarn) {
          successMsg += ` - Pénalité abandon: -60 pts`;
          if (data.abandonmentProcessed) {
            successMsg += `, Défaite annulée pour ${data.teammatesRefunded || 0} coéquipier(s)`;
          }
        }
        setSuccess(successMsg);
        setShowWarnModal(false);
        fetchUsers();
      } else {
        setError(data.message || 'Erreur lors de l\'avertissement');
      }
    } catch (err) {
      console.error('Warn error:', err);
      setError('Erreur lors de l\'avertissement');
    }
  };

  // Open ranked ban modal
  const openRankedBanModal = (user) => {
    setRankedBanData({
      userId: user._id,
      username: user.username,
      isRankedBanned: user.isRankedBanned || false,
      reason: user.rankedBanReason || '',
      duration: '7d',
      customDays: 7
    });
    setShowRankedBanModal(true);
  };

  // Handle ranked ban/unban
  const handleRankedBan = async () => {
    // If user is already banned, this is an unban action
    if (rankedBanData.isRankedBanned) {
      try {
        const response = await fetch(`${API_URL}/users/admin/${rankedBanData.userId}/ranked-ban`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ban: false })
        });

        const data = await response.json();

        if (data.success) {
          setSuccess(`${rankedBanData.username} a été débanni du mode classé`);
          setShowRankedBanModal(false);
          fetchUsers();
        } else {
          setError(data.message || 'Erreur lors du débannissement ranked');
        }
      } catch (err) {
        console.error('Ranked unban error:', err);
        setError('Erreur lors du débannissement ranked');
      }
      return;
    }

    // Ban action
    if (!rankedBanData.reason.trim()) {
      setError('Veuillez entrer une raison pour le ban ranked');
      return;
    }

    try {
      let expiresAt = null;
      const now = new Date();

      switch (rankedBanData.duration) {
        case '15m':
          expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
          break;
        case '30m':
          expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
          break;
        case '1h':
          expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
          break;
        case '1d':
          expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          break;
        case '7d':
          expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          break;
        case 'custom':
          expiresAt = new Date(now.getTime() + rankedBanData.customDays * 24 * 60 * 60 * 1000);
          break;
        default: // permanent
          expiresAt = null;
      }

      const response = await fetch(`${API_URL}/users/admin/${rankedBanData.userId}/ranked-ban`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ban: true,
          reason: rankedBanData.reason,
          expiresAt: expiresAt ? expiresAt.toISOString() : null
        })
      });

      const data = await response.json();

      if (data.success) {
        const durationText = rankedBanData.duration === 'permanent' ? 'définitivement' :
          rankedBanData.duration === 'custom' ? `pour ${rankedBanData.customDays} jours` :
          rankedBanData.duration === '15m' ? 'pour 15 minutes' :
          rankedBanData.duration === '30m' ? 'pour 30 minutes' :
          rankedBanData.duration === '1h' ? 'pour 1 heure' :
          `pour ${rankedBanData.duration.replace('d', ' jour(s)')}`;
        setSuccess(`${rankedBanData.username} a été banni du mode classé ${durationText}`);
        setShowRankedBanModal(false);
        fetchUsers();
      } else {
        setError(data.message || 'Erreur lors du ban ranked');
      }
    } catch (err) {
      console.error('Ranked ban error:', err);
      setError('Erreur lors du ban ranked');
    }
  };

  // Reset user stats and match history
  const handleResetUserStats = async (userId) => {
    setResettingStats(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/users/admin/${userId}/reset-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Stats réinitialisées ! ${data.matchesDeleted || 0} match(s) supprimé(s).`);
        setResetStatsConfirm(null);
        fetchUsers();
      } else {
        setError(data.message || 'Erreur lors de la réinitialisation');
      }
    } catch (err) {
      console.error('Reset stats error:', err);
      setError('Erreur lors de la réinitialisation');
    } finally {
      setResettingStats(false);
    }
  };

  const toggleFeature = async (featureKey, enabled) => {
    try {
      const response = await fetch(`${API_URL}/app-settings/admin/feature/${featureKey}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Fonctionnalité ${enabled ? 'activée' : 'désactivée'}`);
        fetchAppSettings();
      } else {
        setError(data.message || 'Erreur');
      }
    } catch (err) {
      console.error('Toggle feature error:', err);
      setError('Erreur lors de la modification');
    }
  };

  const updateFeatureMessage = async (featureKey, message) => {
    try {
      const response = await fetch(`${API_URL}/app-settings/admin/feature/${featureKey}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ disabledMessage: message })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Message mis à jour');
        fetchAppSettings();
      } else {
        setError(data.message || 'Erreur');
      }
    } catch (err) {
      console.error('Update message error:', err);
      setError('Erreur lors de la modification');
    }
  };

  const getRoleColor = (role) => {
    const colors = {
      admin: 'red',
      staff: 'purple',
      arbitre: 'yellow',
      gerant_cdl: 'cyan',
      gerant_hardcore: 'orange',
      user: 'gray'
    };
    return colors[role] || 'gray';
  };

  const getRarityColor = (rarity) => {
    const colors = {
      common: 'gray',
      rare: 'blue',
      epic: 'purple',
      legendary: 'yellow'
    };
    return colors[rarity] || 'gray';
  };

  // ==================== RENDER FUNCTIONS ====================

  const renderOverview = () => {
    if (!stats) return <div className="text-gray-400">Chargement des statistiques...</div>;

    const statCards = [
      { label: 'Utilisateurs', value: stats.totalUsers || 0, icon: Users, color: 'blue' },
      { label: 'Escouades', value: stats.totalSquads || 0, icon: Shield, color: 'purple' },
      { label: 'Matchs Totaux (Completed)', value: stats.totalMatches || 0, icon: Swords, color: 'green' },
    ];

    // Use real registration data from API or empty array
    const registrationsData = stats.registrationsLast30Days || [];
    const hasVisitorsData = stats.visitorsLast30Days && stats.visitorsLast30Days.length > 0;
    const visitorsData = stats.visitorsLast30Days || [];

    const maxRegistrations = registrationsData.length > 0 ? Math.max(...registrationsData.map(d => d.value), 1) : 1;
    const maxVisitors = visitorsData.length > 0 ? Math.max(...visitorsData.map(d => d.value), 1) : 1;

    return (
      <div className="space-y-4 sm:space-y-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Vue d'ensemble</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="bg-dark-800/50 border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-white">{stat.value}</p>
                  </div>
                  <div className={`w-14 h-14 rounded-xl bg-${stat.color}-500/20 flex items-center justify-center`}>
                    <Icon className={`w-7 h-7 text-${stat.color}-400`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Matchs par Ladder */}
        {stats.matchesByLadder && (
          <div className="bg-dark-800/50 border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Swords className="w-5 h-5 text-green-400" />
              Matchs Completed par Ladder
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-dark-900/50 rounded-lg p-4 border border-white/5">
                <p className="text-gray-400 text-sm mb-1">Chill</p>
                <p className="text-2xl font-bold text-green-400">{stats.matchesByLadder.duoTrio || 0}</p>
              </div>
              <div className="bg-dark-900/50 rounded-lg p-4 border border-white/5">
                <p className="text-gray-400 text-sm mb-1">Compétitif</p>
                <p className="text-2xl font-bold text-purple-400">{stats.matchesByLadder.squadTeam || 0}</p>
              </div>
              <div className="bg-dark-900/50 rounded-lg p-4 border border-white/5">
                <p className="text-gray-400 text-sm mb-1">Ranked</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.matchesByLadder.ranked || 0}</p>
              </div>
              <div className="bg-dark-900/50 rounded-lg p-4 border border-pink-500/20">
                <p className="text-gray-400 text-sm mb-1">Stricker</p>
                <p className="text-2xl font-bold text-pink-400">{stats.matchesByLadder.stricker || 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* Visitors Chart - Last 30 Days */}
        <div className="bg-dark-800/50 border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-cyan-400" />
            Visiteurs - 30 derniers jours
          </h3>
          {!hasVisitorsData ? (
            <div className="h-48 flex items-center justify-center">
              <div className="text-center">
                <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Suivi des visiteurs non configuré</p>
              </div>
            </div>
          ) : (
            <>
              <div className="h-48 flex items-end gap-1">
                {visitorsData.map((day, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center group">
                    <div className="relative w-full">
                      <div
                        className="w-full bg-cyan-500/30 hover:bg-cyan-500/50 rounded-t transition-all cursor-pointer"
                        style={{ height: `${(day.value / maxVisitors) * 160}px`, minHeight: '4px' }}
                      />
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-dark-900 px-2 py-1 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        {day.value} visiteurs
                      </div>
                    </div>
                    {index % 5 === 0 && (
                      <span className="text-[9px] text-gray-500 mt-1 rotate-45 origin-left">{day.date}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-gray-400">Total: <span className="text-cyan-400 font-bold">{visitorsData.reduce((a, b) => a + b.value, 0)}</span> visiteurs</span>
                <span className="text-gray-400">Moyenne: <span className="text-cyan-400 font-bold">{Math.round(visitorsData.reduce((a, b) => a + b.value, 0) / 30)}</span>/jour</span>
              </div>
            </>
          )}
        </div>

        {/* Registrations Chart - Last 30 Days */}
        <div className="bg-dark-800/50 border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-green-400" />
            Inscriptions - 30 derniers jours
          </h3>
          {registrationsData.length === 0 ? (
            <div className="h-48 flex items-center justify-center">
              <div className="text-center">
                <UserPlus className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Aucune donnée d'inscription disponible</p>
              </div>
            </div>
          ) : (
            <>
              <div className="h-48 flex items-end gap-1">
                {registrationsData.map((day, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center group">
                    <div className="relative w-full">
                      <div
                        className="w-full bg-green-500/30 hover:bg-green-500/50 rounded-t transition-all cursor-pointer"
                        style={{ height: `${(day.value / maxRegistrations) * 160}px`, minHeight: '4px' }}
                      />
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-dark-900 px-2 py-1 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        {day.value} inscription{day.value > 1 ? 's' : ''}
                      </div>
                    </div>
                    {index % 5 === 0 && (
                      <span className="text-[9px] text-gray-500 mt-1 rotate-45 origin-left">{day.date}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-gray-400">Total: <span className="text-green-400 font-bold">{registrationsData.reduce((a, b) => a + b.value, 0)}</span> inscriptions</span>
                <span className="text-gray-400">Moyenne: <span className="text-green-400 font-bold">{(registrationsData.reduce((a, b) => a + b.value, 0) / 30).toFixed(1)}</span>/jour</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderUsers = () => {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h2 className="text-xl sm:text-2xl font-bold text-white">Gestion des Utilisateurs</h2>
          <div className="text-gray-400 text-xs sm:text-sm">
            {users.length} utilisateur(s) • Page {page}/{totalPages || 1}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher un utilisateur..."
            className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 bg-dark-800 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500/50"
          />
        </div>

        {/* Users - Mobile Cards */}
        <div className="md:hidden space-y-3">
          {users.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Aucun utilisateur trouvé</div>
          ) : (
            users.map((user) => (
              <div key={user._id} className="bg-dark-800/50 border border-white/10 rounded-xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <img
                    src={getAvatarUrl(user.avatarUrl || user.avatar) || '/avatar.jpg'}
                    alt=""
                    className="w-12 h-12 rounded-full flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{user.username || user.discordUsername || 'Sans identifiant'}</p>
                    <p className="text-gray-500 text-xs truncate">{user.discordUsername}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {user.roles?.map((role) => (
                        <span key={role} className={`px-1.5 py-0.5 text-[10px] font-medium rounded bg-${getRoleColor(role)}-500/20 text-${getRoleColor(role)}-400`}>
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {user.isBanned ? (
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-red-500/20 text-red-400">Banni</span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-green-500/20 text-green-400">Actif</span>
                    )}
                    <div className="flex items-center gap-1 text-yellow-400 text-sm">
                      <Coins className="w-3 h-3" />
                      <span className="font-medium">{user.goldCoins || 0}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  {user.squad && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <Shield className="w-3 h-3 text-purple-400" />
                      <span className="text-white truncate max-w-[120px]">{user.squad.name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 ml-auto">
                    {/* Admin only: Purchase history, trophies and give item */}
                    {userIsAdmin && <button onClick={() => openUserPurchasesModal(user)} className="p-1.5 text-amber-400 hover:bg-amber-500/20 rounded-lg" title="Historique achats"><History className="w-4 h-4" /></button>}
                    {userIsAdmin && <button onClick={() => openUserTrophiesModal(user)} className="p-1.5 text-yellow-400 hover:bg-yellow-500/20 rounded-lg" title="Gérer trophées"><Trophy className="w-4 h-4" /></button>}
                    {userIsAdmin && <button onClick={() => openGiveItemModal(user)} className="p-1.5 text-green-400 hover:bg-green-500/20 rounded-lg" title="Donner objet"><Gift className="w-4 h-4" /></button>}
                    {/* Arbitre only sees block referent and ban buttons */}
                    {!userIsArbitre && <button onClick={() => openEditModal('user', user)} className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded-lg"><Edit2 className="w-4 h-4" /></button>}
                    {!userIsArbitre && <button onClick={() => setResetStatsConfirm(user)} className="p-1.5 text-purple-400 hover:bg-purple-500/20 rounded-lg"><RotateCcw className="w-4 h-4" /></button>}
                    <button onClick={() => handleToggleReferentBan(user)} className={`p-1.5 rounded-lg ${user.isReferentBanned ? 'text-yellow-400 hover:bg-yellow-500/20' : 'text-gray-400 hover:bg-gray-500/20'}`} title={user.isReferentBanned ? 'Autoriser référent' : 'Bloquer référent'}><ShieldAlert className="w-4 h-4" /></button>
                    <button onClick={() => openBanModal(user)} className={`p-1.5 rounded-lg ${user.isBanned ? 'text-green-400 hover:bg-green-500/20' : 'text-orange-400 hover:bg-orange-500/20'}`}><Ban className="w-4 h-4" /></button>
                    {!userIsArbitre && <button onClick={() => setDeleteConfirm({ type: 'user', id: user._id })} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Users Table - Desktop */}
        <div className="hidden md:block bg-dark-800/50 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-900/50">
                <tr>
                  <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Utilisateur</th>
                  <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Discord</th>
                  <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Escouade</th>
                  <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Rôles</th>
                  <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Coins</th>
                  <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Statut</th>
                  <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase hidden xl:table-cell">Date</th>
                  <th className="px-4 lg:px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center text-gray-400">
                      Aucun utilisateur trouvé
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user._id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 lg:px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={getAvatarUrl(user.avatarUrl || user.avatar) || '/avatar.jpg'}
                            alt=""
                            className="w-10 h-10 rounded-full"
                          />
                          <div className="min-w-0">
                            <p className="text-white font-medium truncate">{user.username || user.discordUsername || 'Sans identifiant'}</p>
                            <p className="text-gray-500 text-xs truncate max-w-[150px]">{user._id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <p className="text-white text-sm truncate max-w-[120px]">{user.discordUsername}</p>
                        <p className="text-gray-500 text-xs truncate">{user.discordId}</p>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        {user.squad ? (
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-purple-400 flex-shrink-0" />
                            <span className="text-white text-sm truncate max-w-[100px]">{user.squad.name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {user.roles?.map((role) => (
                            <span
                              key={role}
                              className={`px-2 py-0.5 text-xs font-medium rounded bg-${getRoleColor(role)}-500/20 text-${getRoleColor(role)}-400`}
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <div className="flex items-center gap-1 text-yellow-400">
                          <Coins className="w-4 h-4" />
                          <span className="font-medium">{user.goldCoins || 0}</span>
                        </div>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        {user.isBanned ? (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-red-500/20 text-red-400">
                            Banni
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-green-500/20 text-green-400">
                            Actif
                          </span>
                        )}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-gray-400 text-sm hidden xl:table-cell">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {/* Admin only: Purchase history, trophies and give item */}
                          {userIsAdmin && <button onClick={() => openUserPurchasesModal(user)} className="p-1.5 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-colors" title="Historique achats"><History className="w-4 h-4" /></button>}
                          {userIsAdmin && <button onClick={() => openUserTrophiesModal(user)} className="p-1.5 text-yellow-400 hover:bg-yellow-500/20 rounded-lg transition-colors" title="Gérer trophées"><Trophy className="w-4 h-4" /></button>}
                          {userIsAdmin && <button onClick={() => openGiveItemModal(user)} className="p-1.5 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors" title="Donner objet"><Gift className="w-4 h-4" /></button>}
                          {/* Arbitre only sees block referent and ban buttons */}
                          {!userIsArbitre && <button onClick={() => openEditModal('user', user)} className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors" title="Modifier"><Edit2 className="w-4 h-4" /></button>}
                          {!userIsArbitre && <button onClick={() => setResetStatsConfirm(user)} className="p-1.5 text-purple-400 hover:bg-purple-500/20 rounded-lg transition-colors" title="Reset Stats"><RotateCcw className="w-4 h-4" /></button>}
                          <button onClick={() => handleToggleReferentBan(user)} className={`p-1.5 rounded-lg transition-colors ${user.isReferentBanned ? 'text-yellow-400 hover:bg-yellow-500/20' : 'text-gray-400 hover:bg-gray-500/20'}`} title={user.isReferentBanned ? 'Autoriser référent' : 'Bloquer référent'}><ShieldAlert className="w-4 h-4" /></button>
                          <button onClick={() => openBanModal(user)} className={`p-1.5 rounded-lg transition-colors ${user.isBanned ? 'text-green-400 hover:bg-green-500/20' : 'text-orange-400 hover:bg-orange-500/20'}`} title={user.isBanned ? 'Débannir' : 'Bannir'}><Ban className="w-4 h-4" /></button>
                          {!userIsArbitre && <button onClick={() => setDeleteConfirm({ type: 'user', id: user._id })} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors" title="Supprimer"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-dark-800 text-white rounded-lg hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Précédent
            </button>
            <span className="text-gray-400">
              Page {page} sur {totalPages}
            </span>
                    <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-dark-800 text-white rounded-lg hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
              Suivant
                    </button>
          </div>
                  )}
                </div>
    );
  };

  const renderIrisPlayers = () => {
    const getStatusColor = (isConnected) => {
      return isConnected 
        ? 'bg-green-500/20 text-green-400 border-green-500/30' 
        : 'bg-red-500/20 text-red-400 border-red-500/30';
    };

    const getSecurityBadge = (enabled) => {
      return enabled 
        ? <CheckCircle className="w-4 h-4 text-green-400" />
        : <X className="w-4 h-4 text-red-400" />;
    };

    const formatLastSeen = (lastSeen) => {
      if (!lastSeen) return 'Jamais';
      const date = new Date(lastSeen);
      const now = new Date();
      const diff = Math.floor((now - date) / 1000 / 60); // minutes
      if (diff < 1) return 'À l\'instant';
      if (diff < 60) return `Il y a ${diff} min`;
      if (diff < 1440) return `Il y a ${Math.floor(diff / 60)}h`;
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const formatFileSize = (bytes) => {
      if (!bytes) return 'N/A';
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    // Render Players sub-tab
    const renderPlayersTab = () => (
      <>
        {/* Search bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={irisSearchTerm}
              onChange={(e) => setIrisSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchIrisPlayers(irisSearchTerm)}
              placeholder="Rechercher par nom, Discord ou Activision ID..."
              className="w-full pl-10 pr-4 py-2.5 bg-dark-800 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500/50"
            />
          </div>
          <button
            onClick={() => fetchIrisPlayers(irisSearchTerm)}
            className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            Rechercher
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 text-sm text-gray-400 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Connecté (ping &lt; 3 min)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Déconnecté (ping &gt; 3 min)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span>Iris non installé</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-orange-400" />
            <span>Falsification détectée</span>
          </div>
        </div>

        {/* Players Table */}
        <div className="bg-dark-800/50 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-900/50">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase">Statut</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase">Intégrité</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase">Joueur</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase">Jeu</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase">TPM</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase">Secure Boot</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase">VT-x</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase">VT-d</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase">HVCI</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase">VBS</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase">Defender</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase">Dernière MAJ</th>
                  {userIsAdmin && <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loadingIrisPlayers ? (
                  <tr>
                    <td colSpan={userIsAdmin ? "13" : "12"} className="px-6 py-12 text-center">
                      <Loader2 className="w-6 h-6 text-purple-500 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : irisPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={userIsAdmin ? "13" : "12"} className="px-6 py-12 text-center text-gray-400">
                      {irisSearchTerm ? 'Aucun joueur trouvé pour cette recherche.' : 'Aucun joueur PC trouvé.'}
                    </td>
                  </tr>
                ) : (
                  irisPlayers.map((player) => (
                    <tr key={player._id} className={`hover:bg-white/5 transition-colors ${player.security?.tamperDetected ? 'bg-orange-500/10' : ''}`}>
                      <td className="px-4 py-4">
                        {player.hasIrisData ? (
                          <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(player.isConnected)}`}>
                            {player.isConnected ? 'Connecté' : 'Déconnecté'}
                          </span>
                        ) : (
                          <span className="px-3 py-1 text-xs font-medium rounded-full border bg-gray-500/20 text-gray-400 border-gray-500/30">
                            Sans Iris
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {player.security?.tamperDetected ? (
                          <div className="flex items-center gap-2" title={player.security?.verificationIssues?.join(', ') || 'Falsification détectée'}>
                            <ShieldAlert className="w-5 h-5 text-orange-400" />
                            <span className="text-xs text-orange-400">ALERTE</span>
                          </div>
                        ) : player.security?.verified ? (
                          <div className="flex items-center gap-2" title="Données vérifiées">
                            <Shield className="w-5 h-5 text-green-400" />
                            <span className="text-xs text-green-400">OK</span>
                          </div>
                        ) : player.hasIrisData ? (
                          <div className="flex items-center gap-2" title="Non vérifié (ancien client)">
                            <Shield className="w-5 h-5 text-gray-500" />
                            <span className="text-xs text-gray-500">N/A</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2" title="Aucune donnée Iris">
                            <Shield className="w-5 h-5 text-gray-600" />
                            <span className="text-xs text-gray-600">-</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <img src={getAvatarUrl(player.avatarUrl || player.avatar) || '/avatar.jpg'} alt="Avatar" className="w-8 h-8 rounded-full" />
                          <div>
                            <div className="text-white font-medium">{player.username || player.discordUsername || 'N/A'}</div>
                            <div className="text-xs text-gray-500">
                              {player.hasIrisData ? `HWID: ${player.hardwareId?.substring(0, 12) || 'N/A'}...` : `Platform: ${player.platform || 'N/A'}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {player.hasIrisData ? (
                          player.gameDetection?.mismatchCount >= 2 ? (
                            <div className="flex items-center gap-2" title={`Mismatch: jeu non détecté en match (${player.gameDetection.mismatchCount}x)`}>
                              <AlertTriangle className="w-4 h-4 text-orange-400" />
                              <span className="text-xs text-orange-400">ALERTE</span>
                            </div>
                          ) : player.gameDetection?.gameRunning ? (
                            <div className="flex items-center gap-2" title={`${player.gameDetection.gameName || 'CoD'} ${player.gameDetection.gameWindowActive ? '(actif)' : ''}`}>
                              <CheckCircle className="w-4 h-4 text-green-400" />
                              <span className="text-xs text-green-400">En jeu</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2" title="Jeu non détecté">
                              <X className="w-4 h-4 text-gray-500" />
                              <span className="text-xs text-gray-500">-</span>
                            </div>
                          )
                        ) : <span className="text-gray-600">-</span>}
                      </td>
                      <td className="px-4 py-4">
                        {player.hasIrisData ? (
                          <div className="flex items-center gap-2">
                            {getSecurityBadge(player.security?.tpm?.enabled)}
                            {player.security?.tpm?.version && <span className="text-xs text-gray-500">{player.security.tpm.version}</span>}
                          </div>
                        ) : <span className="text-gray-600">-</span>}
                      </td>
                      <td className="px-4 py-4">{player.hasIrisData ? getSecurityBadge(player.security?.secureBoot) : <span className="text-gray-600">-</span>}</td>
                      <td className="px-4 py-4">{player.hasIrisData ? getSecurityBadge(player.security?.virtualization) : <span className="text-gray-600">-</span>}</td>
                      <td className="px-4 py-4">{player.hasIrisData ? getSecurityBadge(player.security?.iommu) : <span className="text-gray-600">-</span>}</td>
                      <td className="px-4 py-4">{player.hasIrisData ? getSecurityBadge(player.security?.hvci) : <span className="text-gray-600">-</span>}</td>
                      <td className="px-4 py-4">{player.hasIrisData ? getSecurityBadge(player.security?.vbs) : <span className="text-gray-600">-</span>}</td>
                      <td className="px-4 py-4">
                        {player.hasIrisData ? (
                          <div className="flex items-center gap-2">
                            {getSecurityBadge(player.security?.defender)}
                            {player.security?.defenderRealtime && <span className="text-xs text-green-400">RT</span>}
                          </div>
                        ) : <span className="text-gray-600">-</span>}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-400">{player.lastSeen ? formatLastSeen(player.lastSeen) : '-'}</div>
                      </td>
                      {userIsAdmin && (
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setIrisDetailsPlayer(player)}
                              className="px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400"
                              title="Voir les détails"
                            >
                              <FileText className="w-4 h-4" />
                              Détails
                            </button>
                            <button
                              onClick={() => handleIrisScan(player._id)}
                              disabled={scanningPlayerId === player._id}
                              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 ${
                                player.scanMode 
                                  ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30' 
                                  : 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-400'
                              }`}
                              title={player.scanMode ? 'Désactiver la surveillance' : 'Activer la surveillance'}
                            >
                              {scanningPlayerId === player._id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : player.scanMode ? (
                                <Eye className="w-4 h-4" />
                              ) : (
                                <Search className="w-4 h-4" />
                              )}
                              {player.scanMode ? 'Surveillance' : 'Scan'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Activity className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <h4 className="text-blue-400 font-medium">Système de Heartbeat</h4>
              <p className="text-gray-400 text-sm mt-1">
                Seuls les joueurs avec la plateforme PC sont affichés. Chaque joueur envoie un ping toutes les 2 minutes et son statut de sécurité toutes les 5 minutes. 
                Un joueur est considéré comme déconnecté s'il n'a pas envoyé de ping depuis plus de 3 minutes.
              </p>
            </div>
          </div>
        </div>

        {/* Iris Details Modal */}
        {irisDetailsPlayer && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => { setIrisDetailsPlayer(null); setConfirmIrisReset(false); }}>
            <div className="bg-dark-800 border border-white/10 rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-dark-800 border-b border-white/10 p-5 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <img src={getAvatarUrl(irisDetailsPlayer.avatarUrl || irisDetailsPlayer.avatar) || '/avatar.jpg'} alt="" className="w-10 h-10 rounded-full" />
                  <div>
                    <h3 className="text-lg font-bold text-white">{irisDetailsPlayer.username || irisDetailsPlayer.discordUsername}</h3>
                    <p className="text-sm text-gray-400">{irisDetailsPlayer.discordUsername} &middot; {irisDetailsPlayer.platform}</p>
                  </div>
                  <span className={`ml-3 px-3 py-1 text-xs font-medium rounded-full border ${irisDetailsPlayer.isConnected ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                    {irisDetailsPlayer.isConnected ? 'Connecté' : 'Déconnecté'}
                  </span>
                  {irisDetailsPlayer.isBanned && (
                    <span className="px-3 py-1 text-xs font-medium rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Banni</span>
                  )}
                </div>
                <button onClick={() => { setIrisDetailsPlayer(null); setConfirmIrisReset(false); }} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* General Info */}
                <div className="bg-dark-900/50 border border-white/10 rounded-xl p-4">
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2"><Cpu className="w-4 h-4 text-purple-400" /> Informations générales</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
                    <div><span className="text-gray-500">HWID:</span> <span className="text-white font-mono text-xs">{irisDetailsPlayer.hardwareId || 'N/A'}</span></div>
                    <div><span className="text-gray-500">Activision:</span> <span className="text-white">{irisDetailsPlayer.activisionId || 'N/A'}</span></div>
                    <div><span className="text-gray-500">Client:</span> <span className="text-white">v{irisDetailsPlayer.clientVersion || '?'} {irisDetailsPlayer.clientVerified ? '(vérifié)' : ''}</span></div>
                    <div><span className="text-gray-500">Dernière MAJ:</span> <span className="text-white">{irisDetailsPlayer.lastSeen ? formatLastSeen(irisDetailsPlayer.lastSeen) : 'Jamais'}</span></div>
                    <div><span className="text-gray-500">Scan mode:</span> <span className={irisDetailsPlayer.scanMode ? 'text-green-400' : 'text-gray-400'}>{irisDetailsPlayer.scanMode ? 'Actif' : 'Inactif'}</span></div>
                    <div><span className="text-gray-500">Inscrit:</span> <span className="text-white">{irisDetailsPlayer.registeredAt ? new Date(irisDetailsPlayer.registeredAt).toLocaleDateString('fr-FR') : irisDetailsPlayer.createdAt ? new Date(irisDetailsPlayer.createdAt).toLocaleDateString('fr-FR') : 'N/A'}</span></div>
                  </div>
                </div>

                {/* Game Detection (Anti-Bypass) */}
                <div className={`bg-dark-900/50 border rounded-xl p-4 ${irisDetailsPlayer.gameDetection?.mismatchCount >= 2 ? 'border-orange-500/30' : 'border-white/10'}`}>
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Gamepad2 className={`w-4 h-4 ${irisDetailsPlayer.gameDetection?.gameRunning ? 'text-green-400' : irisDetailsPlayer.gameDetection?.mismatchCount >= 2 ? 'text-orange-400' : 'text-gray-400'}`} />
                    Détection du jeu (Anti-Contournement)
                    {irisDetailsPlayer.gameDetection?.mismatchCount >= 2 && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 ml-2">
                        ALERTE
                      </span>
                    )}
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${irisDetailsPlayer.gameDetection?.gameRunning ? 'bg-green-500/10 border border-green-500/20 text-green-300' : 'bg-gray-500/10 border border-gray-500/20 text-gray-400'}`}>
                      {irisDetailsPlayer.gameDetection?.gameRunning ? <CheckCircle className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      Jeu: {irisDetailsPlayer.gameDetection?.gameRunning ? 'En cours' : 'Non détecté'}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800 border border-white/5 text-gray-300">
                      <Gamepad2 className="w-4 h-4 text-cyan-400" />
                      {irisDetailsPlayer.gameDetection?.gameName || 'N/A'}
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${irisDetailsPlayer.gameDetection?.gameWindowActive ? 'bg-green-500/10 border border-green-500/20 text-green-300' : 'bg-gray-500/10 border border-gray-500/20 text-gray-400'}`}>
                      <Monitor className="w-4 h-4" />
                      Fenêtre: {irisDetailsPlayer.gameDetection?.gameWindowActive ? 'Active' : 'Inactive'}
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${irisDetailsPlayer.gameDetection?.mismatchCount >= 2 ? 'bg-orange-500/10 border border-orange-500/20 text-orange-300' : irisDetailsPlayer.gameDetection?.mismatchCount > 0 ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-300' : 'bg-gray-500/10 border border-gray-500/20 text-gray-400'}`}>
                      <AlertTriangle className="w-4 h-4" />
                      Mismatch: {irisDetailsPlayer.gameDetection?.mismatchCount || 0}x
                    </div>
                  </div>
                  
                  {/* Match Activity Tracking */}
                  {irisDetailsPlayer.gameDetection?.matchActivityTracking?.matchId && (
                    <div className={`mt-3 p-3 rounded-lg border ${
                      irisDetailsPlayer.gameDetection.matchActivityTracking.activityPercentage < 30 
                        ? 'bg-orange-500/10 border-orange-500/20' 
                        : irisDetailsPlayer.gameDetection.matchActivityTracking.activityPercentage < 60 
                          ? 'bg-yellow-500/10 border-yellow-500/20' 
                          : 'bg-green-500/10 border-green-500/20'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white flex items-center gap-2">
                          <Activity className="w-4 h-4 text-cyan-400" />
                          Activité fenêtre (match en cours)
                        </span>
                        <span className={`text-lg font-bold ${
                          irisDetailsPlayer.gameDetection.matchActivityTracking.activityPercentage < 30 
                            ? 'text-orange-400' 
                            : irisDetailsPlayer.gameDetection.matchActivityTracking.activityPercentage < 60 
                              ? 'text-yellow-400' 
                              : 'text-green-400'
                        }`}>
                          {irisDetailsPlayer.gameDetection.matchActivityTracking.activityPercentage}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-dark-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            irisDetailsPlayer.gameDetection.matchActivityTracking.activityPercentage < 30 
                              ? 'bg-orange-500' 
                              : irisDetailsPlayer.gameDetection.matchActivityTracking.activityPercentage < 60 
                                ? 'bg-yellow-500' 
                                : 'bg-green-500'
                          }`}
                          style={{ width: `${irisDetailsPlayer.gameDetection.matchActivityTracking.activityPercentage}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                        <span>
                          {irisDetailsPlayer.gameDetection.matchActivityTracking.activeSamples}/
                          {irisDetailsPlayer.gameDetection.matchActivityTracking.totalSamples} échantillons actifs
                        </span>
                        <span className="uppercase">
                          {irisDetailsPlayer.gameDetection.matchActivityTracking.matchType || 'Match'}
                        </span>
                      </div>
                      {irisDetailsPlayer.gameDetection.matchActivityTracking.lowActivityAlertSent && (
                        <div className="mt-2 flex items-center gap-1 text-orange-400 text-xs">
                          <AlertTriangle className="w-3 h-3" />
                          Alerte activité faible envoyée
                        </div>
                      )}
                    </div>
                  )}
                  {irisDetailsPlayer.gameDetection?.mismatchCount >= 2 && (
                    <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                      <p className="text-orange-300 text-sm flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Alerte de contournement:</strong> Ce joueur a été détecté en match mais le jeu n'était pas en cours sur sa machine Iris.
                          Cela peut indiquer qu'Iris tourne sur un PC différent de celui où le jeu est lancé.
                          {irisDetailsPlayer.gameDetection?.lastMismatchAt && (
                            <span className="block mt-1 text-xs text-orange-400/70">
                              Dernière détection: {new Date(irisDetailsPlayer.gameDetection.lastMismatchAt).toLocaleString('fr-FR')}
                            </span>
                          )}
                        </span>
                      </p>
                    </div>
                  )}
                  {irisDetailsPlayer.gameDetection?.lastDetected && (
                    <p className="text-xs text-gray-500 mt-2">
                      Dernière mise à jour: {new Date(irisDetailsPlayer.gameDetection.lastDetected).toLocaleString('fr-FR')}
                    </p>
                  )}
                </div>

                {/* Session History */}
                <div className="bg-dark-900/50 border border-white/10 rounded-xl p-4">
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    Historique des sessions ({irisDetailsPlayer.sessionHistory?.length || 0})
                  </h4>
                  {irisDetailsPlayer.sessionHistory && irisDetailsPlayer.sessionHistory.length > 0 ? (
                    <div className="max-h-80 overflow-y-auto space-y-2">
                      {[...irisDetailsPlayer.sessionHistory].reverse().map((session, i) => {
                        const connectedAt = new Date(session.connectedAt);
                        const disconnectedAt = session.disconnectedAt ? new Date(session.disconnectedAt) : null;
                        const isOngoing = !disconnectedAt;
                        
                        // Format duration
                        const formatDuration = (seconds) => {
                          if (!seconds) return '-';
                          if (seconds < 60) return `${seconds}s`;
                          if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
                          const hours = Math.floor(seconds / 3600);
                          const mins = Math.floor((seconds % 3600) / 60);
                          return `${hours}h${mins > 0 ? `${mins}min` : ''}`;
                        };
                        
                        return (
                          <div 
                            key={session._id || i} 
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                              isOngoing ? 'bg-green-500/10 border border-green-500/20' : 'bg-dark-800/50'
                            }`}
                          >
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOngoing ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-white font-medium">
                                  {connectedAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                </span>
                                <span className="text-gray-400">
                                  {connectedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="text-gray-500">→</span>
                                {isOngoing ? (
                                  <span className="text-green-400 font-medium">En cours</span>
                                ) : (
                                  <span className="text-gray-400">
                                    {disconnectedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                              {session.clientVersion && (
                                <span className="text-xs text-gray-600">v{session.clientVersion}</span>
                              )}
                            </div>
                            
                            <div className={`text-xs px-2 py-1 rounded ${isOngoing ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-gray-400'}`}>
                              {isOngoing ? 'Connecté' : formatDuration(session.duration)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">Aucune session enregistrée</p>
                  )}
                </div>

                {/* Detection History */}
                <div className={`bg-dark-900/50 border rounded-xl p-4 ${irisDetailsPlayer.detectionHistory?.length > 0 ? 'border-orange-500/30' : 'border-white/10'}`}>
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <History className={`w-4 h-4 ${irisDetailsPlayer.detectionHistory?.length > 0 ? 'text-orange-400' : 'text-gray-400'}`} />
                    Historique des détections ({irisDetailsPlayer.detectionHistory?.length || 0})
                  </h4>
                  {irisDetailsPlayer.detectionHistory && irisDetailsPlayer.detectionHistory.length > 0 ? (
                    <div className="max-h-80 overflow-y-auto space-y-2">
                      {[...irisDetailsPlayer.detectionHistory].reverse().map((detection, i) => {
                        const detectedAt = new Date(detection.detectedAt);
                        const riskColors = {
                          critical: 'bg-red-500/10 border-red-500/30 text-red-400',
                          high: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
                          medium: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
                          low: 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                        };
                        const riskColor = riskColors[detection.riskLevel] || riskColors.medium;
                        
                        return (
                          <div 
                            key={detection._id || i} 
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm border ${riskColor}`}
                          >
                            <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${detection.riskLevel === 'critical' ? 'text-red-400' : detection.riskLevel === 'high' ? 'text-orange-400' : detection.riskLevel === 'medium' ? 'text-yellow-400' : 'text-blue-400'}`} />
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-white">{detection.name}</span>
                                <span className={`px-1.5 py-0.5 text-xs rounded ${detection.type === 'cheat' ? 'bg-red-500/20 text-red-400' : detection.type === 'macro' ? 'bg-yellow-500/20 text-yellow-400' : detection.type === 'cheat_window' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                  {detection.type === 'cheat' ? 'Triche' : detection.type === 'macro' ? 'Macro' : detection.type === 'cheat_window' ? 'Panel' : detection.type}
                                </span>
                                {detection.riskScore > 0 && (
                                  <span className="text-xs text-gray-500">Score: {detection.riskScore}</span>
                                )}
                              </div>
                              {detection.details && (
                                <p className="text-xs text-gray-500 mt-0.5 truncate" title={detection.details}>{detection.details}</p>
                              )}
                            </div>
                            
                            <div className="text-xs text-gray-500 text-right flex-shrink-0">
                              <div>{detectedAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                              <div>{detectedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">Aucune détection enregistrée.</p>
                  )}
                </div>

                {/* Trust Score Section */}
                {irisDetailsPlayer.security && (() => {
                  const securityModules = [
                    { key: 'tpm', label: 'TPM 2.0', enabled: irisDetailsPlayer.security.tpm?.enabled, tip: 'Activer TPM 2.0 dans le BIOS (Security > Trusted Platform Module)' },
                    { key: 'secureBoot', label: 'Secure Boot', enabled: irisDetailsPlayer.security.secureBoot, tip: 'Activer Secure Boot dans le BIOS (Boot > Secure Boot > Enabled)' },
                    { key: 'virtualization', label: 'VT-x/AMD-V', enabled: irisDetailsPlayer.security.virtualization, tip: 'Activer la virtualisation dans le BIOS (CPU Configuration > Intel VT-x ou AMD-V)' },
                    { key: 'iommu', label: 'VT-d/IOMMU', enabled: irisDetailsPlayer.security.iommu, tip: 'Activer VT-d/IOMMU dans le BIOS (CPU Configuration > Intel VT-d ou AMD IOMMU)' },
                    { key: 'kernelDmaProtection', label: 'DMA Protection', enabled: irisDetailsPlayer.security.kernelDmaProtection, tip: 'Protection Kernel DMA - Bloque les attaques DMA. Requiert IOMMU + Windows 10 1803+ + matériel compatible Thunderbolt 3', critical: true },
                    { key: 'hvci', label: 'HVCI', enabled: irisDetailsPlayer.security.hvci, tip: 'Activer dans Windows: Paramètres > Confidentialité et sécurité > Sécurité Windows > Sécurité de l\'appareil > Isolation du noyau > Intégrité de la mémoire' },
                    { key: 'vbs', label: 'VBS', enabled: irisDetailsPlayer.security.vbs, tip: 'Activer Virtualization Based Security: Paramètres > Confidentialité et sécurité > Sécurité Windows > Sécurité de l\'appareil' },
                    { key: 'defender', label: 'Defender', enabled: irisDetailsPlayer.security.defender, tip: 'Activer Windows Defender: Paramètres > Confidentialité et sécurité > Sécurité Windows > Protection contre les virus et menaces' },
                    { key: 'defenderRealtime', label: 'Protection temps réel', enabled: irisDetailsPlayer.security.defenderRealtime, tip: 'Activer la protection en temps réel dans Windows Defender: Paramètres des virus et menaces > Paramètres de protection > Protection en temps réel' },
                  ];
                  // Special warning: IOMMU on but DMA Protection off = vulnerable to DMA cheats
                  const dmaVulnerable = irisDetailsPlayer.security.iommu && !irisDetailsPlayer.security.kernelDmaProtection;
                  const enabledCount = securityModules.filter(m => m.enabled).length;
                  const trustScore = Math.round((enabledCount / securityModules.length) * 100);
                  const disabledModules = securityModules.filter(m => !m.enabled);
                  
                  return (
                    <div className={`bg-dark-900/50 border rounded-xl p-4 ${trustScore >= 75 ? 'border-green-500/30' : trustScore >= 50 ? 'border-yellow-500/30' : 'border-red-500/30'}`}>
                      <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                        <Shield className={`w-4 h-4 ${trustScore >= 75 ? 'text-green-400' : trustScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`} />
                        Score de Confiance
                      </h4>
                      
                      {/* Score Display */}
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`text-4xl font-bold ${trustScore >= 75 ? 'text-green-400' : trustScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {trustScore}%
                        </div>
                        <div className="flex-1">
                          <div className="w-full h-3 bg-dark-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${trustScore >= 75 ? 'bg-green-500' : trustScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${trustScore}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{enabledCount}/{securityModules.length} modules actifs</p>
                        </div>
                      </div>
                      
                      {/* Recommendations */}
                      {disabledModules.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-400 uppercase font-medium flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Pour améliorer le score ({disabledModules.length} recommandation{disabledModules.length > 1 ? 's' : ''}):
                          </p>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {disabledModules.map((mod, i) => (
                              <div key={i} className="bg-dark-800/50 border border-white/5 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <X className="w-4 h-4 text-red-400" />
                                  <span className="text-red-300 font-medium">{mod.label}</span>
                                  <span className="text-xs text-gray-500">désactivé</span>
                                </div>
                                <p className="text-xs text-gray-400 pl-6">{mod.tip}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {trustScore === 100 && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <span className="text-green-300 text-sm">Score parfait ! Toutes les protections sont activées.</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* System Info */}
                {irisDetailsPlayer.systemInfo && (
                  <div className="bg-dark-900/50 border border-white/10 rounded-xl p-4">
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2"><Settings className="w-4 h-4 text-blue-400" /> Configuration PC</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
                      <div><span className="text-gray-500">CPU:</span> <span className="text-white">{irisDetailsPlayer.systemInfo.cpu?.brand || 'N/A'}</span></div>
                      <div><span className="text-gray-500">Coeurs:</span> <span className="text-white">{irisDetailsPlayer.systemInfo.cpu?.physicalCores || '?'}C / {irisDetailsPlayer.systemInfo.cpu?.cores || '?'}T</span></div>
                      <div><span className="text-gray-500">GPU:</span> <span className="text-white">{irisDetailsPlayer.systemInfo.gpu?.model || 'N/A'}</span></div>
                      <div><span className="text-gray-500">VRAM:</span> <span className="text-white">{irisDetailsPlayer.systemInfo.gpu?.vram ? `${irisDetailsPlayer.systemInfo.gpu.vram} MB` : 'N/A'}</span></div>
                      <div><span className="text-gray-500">RAM:</span> <span className="text-white">{irisDetailsPlayer.systemInfo.memory?.total ? `${(irisDetailsPlayer.systemInfo.memory.total / (1024 * 1024 * 1024)).toFixed(0)} GB` : 'N/A'}</span></div>
                      <div><span className="text-gray-500">OS:</span> <span className="text-white">{irisDetailsPlayer.systemInfo.os?.distro || 'N/A'}</span></div>
                      <div><span className="text-gray-500">Carte mère:</span> <span className="text-white">{irisDetailsPlayer.systemInfo.baseboard?.manufacturer} {irisDetailsPlayer.systemInfo.baseboard?.model || 'N/A'}</span></div>
                      <div><span className="text-gray-500">Système:</span> <span className="text-white">{irisDetailsPlayer.systemInfo.system?.manufacturer} {irisDetailsPlayer.systemInfo.system?.model || 'N/A'}</span></div>
                    </div>
                  </div>
                )}

                {/* Security Modules */}
                {irisDetailsPlayer.security && (
                  <div className="bg-dark-900/50 border border-white/10 rounded-xl p-4">
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-green-400" /> Modules de sécurité</h4>
                    
                    {/* DMA Vulnerability Warning */}
                    {irisDetailsPlayer.security.iommu && !irisDetailsPlayer.security.kernelDmaProtection && (
                      <div className="mb-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-orange-400 font-semibold">⚠️ VULNÉRABLE AUX DMA CHEATS!</p>
                            <p className="text-sm text-orange-300/80 mt-1">
                              IOMMU est activé mais <strong>Kernel DMA Protection</strong> est désactivé. 
                              Les attaques DMA peuvent contourner IOMMU sans cette protection Windows.
                            </p>
                            <p className="text-xs text-gray-400 mt-2">
                              Requis: Windows 10 1803+, matériel compatible Thunderbolt 3, IOMMU activé dans BIOS
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'TPM 2.0', value: irisDetailsPlayer.security.tpm?.enabled, extra: irisDetailsPlayer.security.tpm?.version },
                        { label: 'Secure Boot', value: irisDetailsPlayer.security.secureBoot },
                        { label: 'VT-x/AMD-V', value: irisDetailsPlayer.security.virtualization },
                        { label: 'VT-d/IOMMU', value: irisDetailsPlayer.security.iommu },
                        { label: 'DMA Protection', value: irisDetailsPlayer.security.kernelDmaProtection, critical: true },
                        { label: 'HVCI', value: irisDetailsPlayer.security.hvci },
                        { label: 'VBS', value: irisDetailsPlayer.security.vbs },
                        { label: 'Defender', value: irisDetailsPlayer.security.defender },
                        { label: 'Temps réel', value: irisDetailsPlayer.security.defenderRealtime },
                      ].map(mod => (
                        <div key={mod.label} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                          mod.value ? 'bg-green-500/10 border border-green-500/20' : 
                          mod.critical ? 'bg-orange-500/10 border border-orange-500/30' :
                          'bg-red-500/10 border border-red-500/20'
                        }`}>
                          {mod.value ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" /> : 
                           mod.critical ? <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" /> :
                           <X className="w-4 h-4 text-red-400 flex-shrink-0" />}
                          <span className={`text-sm ${mod.value ? 'text-green-300' : mod.critical ? 'text-orange-300' : 'text-red-300'}`}>{mod.label}</span>
                          {mod.extra && <span className="text-xs text-gray-500 ml-auto">{mod.extra}</span>}
                        </div>
                      ))}
                    </div>
                    {/* Integrity */}
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${irisDetailsPlayer.security.verified ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
                        <Shield className="w-3.5 h-3.5" />
                        Intégrité: {irisDetailsPlayer.security.verified ? 'Vérifiée' : 'Non vérifiée'}
                      </div>
                      {irisDetailsPlayer.security.tamperDetected && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-400">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Falsification détectée
                        </div>
                      )}
                      {irisDetailsPlayer.security.verificationIssues?.length > 0 && (
                        <div className="text-xs text-orange-400">
                          Problèmes: {irisDetailsPlayer.security.verificationIssues.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Cheat Detection */}
                {irisDetailsPlayer.security?.cheatDetection && (
                  <div className={`bg-dark-900/50 border rounded-xl p-4 ${irisDetailsPlayer.security.cheatDetection.found ? 'border-red-500/30' : 'border-white/10'}`}>
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <AlertTriangle className={`w-4 h-4 ${irisDetailsPlayer.security.cheatDetection.found ? 'text-red-400' : 'text-gray-400'}`} />
                      Détection de triche
                      {irisDetailsPlayer.security.cheatDetection.found && (
                        <span className={`ml-2 px-2 py-0.5 text-xs rounded font-medium ${
                          irisDetailsPlayer.security.cheatDetection.riskLevel === 'critical' ? 'bg-red-500/20 text-red-400' :
                          irisDetailsPlayer.security.cheatDetection.riskLevel === 'high' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {irisDetailsPlayer.security.cheatDetection.riskLevel?.toUpperCase()} - Score: {irisDetailsPlayer.security.cheatDetection.riskScore}
                        </span>
                      )}
                    </h4>
                    {!irisDetailsPlayer.security.cheatDetection.found ? (
                      <p className="text-gray-400 text-sm">Aucune triche détectée.</p>
                    ) : (
                      <div className="space-y-3">
                        {irisDetailsPlayer.security.cheatDetection.devices?.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase mb-1">Périphériques suspects</p>
                            <div className="space-y-1">
                              {irisDetailsPlayer.security.cheatDetection.devices.map((d, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm bg-red-500/5 px-3 py-1.5 rounded-lg">
                                  <span className="text-red-400 font-medium">{d.type}</span>
                                  <span className="text-gray-400">-</span>
                                  <span className="text-white">{d.name}</span>
                                  {d.vid && <span className="text-gray-500 text-xs ml-auto">VID:{d.vid} PID:{d.pid}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {irisDetailsPlayer.security.cheatDetection.processes?.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase mb-1">Logiciels suspects</p>
                            <div className="space-y-1">
                              {irisDetailsPlayer.security.cheatDetection.processes.map((p, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm bg-red-500/5 px-3 py-1.5 rounded-lg">
                                  <span className="text-red-400 font-medium">{p.name}</span>
                                  {p.matchedCheat && <span className="text-xs text-gray-500">({p.matchedCheat})</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {irisDetailsPlayer.security.cheatDetection.suspiciousUsb?.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase mb-1">USB suspects</p>
                            <div className="space-y-1">
                              {irisDetailsPlayer.security.cheatDetection.suspiciousUsb.map((u, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm bg-orange-500/5 px-3 py-1.5 rounded-lg">
                                  <span className="text-orange-400">{u.name}</span>
                                  <span className="text-gray-500 text-xs">{u.reason}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {irisDetailsPlayer.security.cheatDetection.gamesRunning?.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase mb-1">Jeux en cours</p>
                            <div className="flex flex-wrap gap-2">
                              {irisDetailsPlayer.security.cheatDetection.gamesRunning.map((g, i) => (
                                <span key={i} className="px-2 py-1 text-xs bg-blue-500/10 text-blue-400 rounded">{g.display}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {irisDetailsPlayer.security.cheatDetection.warnings?.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase mb-1">Avertissements</p>
                            <ul className="text-sm text-yellow-400 space-y-1">
                              {irisDetailsPlayer.security.cheatDetection.warnings.map((w, i) => (
                                <li key={i} className="flex items-start gap-2"><AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{w}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Network Monitor */}
                {irisDetailsPlayer.security?.networkMonitor && (
                  <div className={`bg-dark-900/50 border rounded-xl p-4 ${(irisDetailsPlayer.security.networkMonitor.vpnDetected || irisDetailsPlayer.security.networkMonitor.proxyDetected) ? 'border-blue-500/30' : 'border-white/10'}`}>
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Activity className={`w-4 h-4 ${(irisDetailsPlayer.security.networkMonitor.vpnDetected || irisDetailsPlayer.security.networkMonitor.proxyDetected) ? 'text-blue-400' : 'text-gray-400'}`} />
                      Réseau
                      {irisDetailsPlayer.security.networkMonitor.riskScore > 0 && (
                        <span className="text-xs text-gray-500 ml-auto">Score: {irisDetailsPlayer.security.networkMonitor.riskScore}</span>
                      )}
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${irisDetailsPlayer.security.networkMonitor.vpnDetected ? 'bg-blue-500/10 border border-blue-500/20 text-blue-300' : 'bg-green-500/10 border border-green-500/20 text-green-300'}`}>
                        {irisDetailsPlayer.security.networkMonitor.vpnDetected ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        VPN: {irisDetailsPlayer.security.networkMonitor.vpnDetected ? 'Détecté' : 'Non détecté'}
                      </div>
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${irisDetailsPlayer.security.networkMonitor.proxyDetected ? 'bg-blue-500/10 border border-blue-500/20 text-blue-300' : 'bg-green-500/10 border border-green-500/20 text-green-300'}`}>
                        {irisDetailsPlayer.security.networkMonitor.proxyDetected ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        Proxy: {irisDetailsPlayer.security.networkMonitor.proxyDetected ? 'Détecté' : 'Non détecté'}
                      </div>
                    </div>
                    {irisDetailsPlayer.security.networkMonitor.vpnAdapters?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 uppercase mb-1">Adaptateurs VPN</p>
                        <div className="space-y-1">
                          {irisDetailsPlayer.security.networkMonitor.vpnAdapters.map((a, i) => (
                            <div key={i} className="text-sm text-blue-300 bg-blue-500/5 px-3 py-1 rounded">{a}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    {irisDetailsPlayer.security.networkMonitor.vpnProcesses?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 uppercase mb-1">Processus VPN</p>
                        <div className="space-y-1">
                          {irisDetailsPlayer.security.networkMonitor.vpnProcesses.map((p, i) => (
                            <div key={i} className="text-sm text-blue-300 bg-blue-500/5 px-3 py-1 rounded">{p}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Registry Scan */}
                {irisDetailsPlayer.security?.registryScan && (
                  <div className={`bg-dark-900/50 border rounded-xl p-4 ${irisDetailsPlayer.security.registryScan.tracesFound ? 'border-red-500/30' : 'border-white/10'}`}>
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Database className={`w-4 h-4 ${irisDetailsPlayer.security.registryScan.tracesFound ? 'text-red-400' : 'text-gray-400'}`} />
                      Registre Windows
                      {irisDetailsPlayer.security.registryScan.riskScore > 0 && (
                        <span className="text-xs text-gray-500 ml-auto">Score: {irisDetailsPlayer.security.registryScan.riskScore}</span>
                      )}
                    </h4>
                    {!irisDetailsPlayer.security.registryScan.tracesFound ? (
                      <p className="text-gray-400 text-sm">Aucune trace de triche trouvée dans le registre.</p>
                    ) : (
                      <div className="space-y-1">
                        {irisDetailsPlayer.security.registryScan.traces?.map((t, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm bg-red-500/5 px-3 py-1.5 rounded-lg">
                            <span className="text-red-400 font-medium">{t.cheatName}</span>
                            <span className="text-xs text-gray-500">({t.traceType})</span>
                            <span className="text-gray-500 text-xs ml-auto truncate max-w-[200px]" title={t.path}>{t.path}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Driver Integrity */}
                {irisDetailsPlayer.security?.driverIntegrity && (
                  <div className={`bg-dark-900/50 border rounded-xl p-4 ${irisDetailsPlayer.security.driverIntegrity.suspiciousFound ? 'border-red-500/30' : 'border-white/10'}`}>
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Lock className={`w-4 h-4 ${irisDetailsPlayer.security.driverIntegrity.suspiciousFound ? 'text-red-400' : 'text-gray-400'}`} />
                      Drivers Kernel
                      {irisDetailsPlayer.security.driverIntegrity.riskScore > 0 && (
                        <span className="text-xs text-gray-500 ml-auto">Score: {irisDetailsPlayer.security.driverIntegrity.riskScore}</span>
                      )}
                    </h4>
                    {!irisDetailsPlayer.security.driverIntegrity.suspiciousFound ? (
                      <p className="text-gray-400 text-sm">Aucun driver suspect détecté.</p>
                    ) : (
                      <div className="space-y-1">
                        {irisDetailsPlayer.security.driverIntegrity.suspiciousDrivers?.map((d, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm bg-red-500/5 px-3 py-1.5 rounded-lg">
                            <span className="text-red-400 font-medium">{d.displayName || d.name}</span>
                            <span className="text-xs text-gray-500">{d.reason}</span>
                            {d.path && <span className="text-gray-600 text-xs ml-auto truncate max-w-[180px]" title={d.path}>{d.path}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Macro Detection */}
                {irisDetailsPlayer.security?.macroDetection && (
                  <div className={`bg-dark-900/50 border rounded-xl p-4 ${irisDetailsPlayer.security.macroDetection.macrosDetected ? 'border-yellow-500/30' : 'border-white/10'}`}>
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Gamepad2 className={`w-4 h-4 ${irisDetailsPlayer.security.macroDetection.macrosDetected ? 'text-yellow-400' : 'text-gray-400'}`} />
                      Détection de macros
                      {irisDetailsPlayer.security.macroDetection.riskScore > 0 && (
                        <span className="text-xs text-gray-500 ml-auto">Score: {irisDetailsPlayer.security.macroDetection.riskScore}</span>
                      )}
                    </h4>
                    {!irisDetailsPlayer.security.macroDetection.macrosDetected ? (
                      <p className="text-gray-400 text-sm">Aucun logiciel de macro détecté.</p>
                    ) : (
                      <div className="space-y-1">
                        {irisDetailsPlayer.security.macroDetection.detectedSoftware?.map((m, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm bg-yellow-500/5 px-3 py-1.5 rounded-lg">
                            <span className="text-yellow-400 font-medium">{m.name}</span>
                            <span className={`px-1.5 py-0.5 text-xs rounded ${m.macroType === 'ahk' || m.macroType === 'generic' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>{m.macroType}</span>
                            <span className="text-xs text-gray-500">via {m.source}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Overlay Detection */}
                {irisDetailsPlayer.security?.overlayDetection && (
                  <div className={`bg-dark-900/50 border rounded-xl p-4 ${irisDetailsPlayer.security.overlayDetection.overlaysFound ? 'border-pink-500/30' : 'border-white/10'}`}>
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Layers className={`w-4 h-4 ${irisDetailsPlayer.security.overlayDetection.overlaysFound ? 'text-pink-400' : 'text-gray-400'}`} />
                      Détection d'overlays
                      {irisDetailsPlayer.security.overlayDetection.riskScore > 0 && (
                        <span className="text-xs text-gray-500 ml-auto">Score: {irisDetailsPlayer.security.overlayDetection.riskScore}</span>
                      )}
                    </h4>
                    {!irisDetailsPlayer.security.overlayDetection.overlaysFound ? (
                      <p className="text-gray-400 text-sm">Aucun overlay suspect détecté.</p>
                    ) : (
                      <div className="space-y-1">
                        {irisDetailsPlayer.security.overlayDetection.suspiciousOverlays?.map((o, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm bg-pink-500/5 px-3 py-1.5 rounded-lg">
                            <span className="text-pink-400 font-medium">{o.processName || o.windowTitle || 'Inconnu'}</span>
                            <span className={`px-1.5 py-0.5 text-xs rounded ${o.reason === 'cheat_process' || o.reason === 'suspicious_class' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>{o.reason}</span>
                            {o.className && <span className="text-xs text-gray-500">Class: {o.className}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* DLL Injection Detection */}
                {irisDetailsPlayer.security?.dllInjection && (
                  <div className={`bg-dark-900/50 border rounded-xl p-4 ${irisDetailsPlayer.security.dllInjection.injectionDetected ? 'border-red-500/30' : 'border-white/10'}`}>
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Syringe className={`w-4 h-4 ${irisDetailsPlayer.security.dllInjection.injectionDetected ? 'text-red-400' : 'text-gray-400'}`} />
                      Détection d'injection DLL
                      {irisDetailsPlayer.security.dllInjection.riskScore > 0 && (
                        <span className="text-xs text-gray-500 ml-auto">Score: {irisDetailsPlayer.security.dllInjection.riskScore}</span>
                      )}
                    </h4>
                    {!irisDetailsPlayer.security.dllInjection.injectionDetected ? (
                      <p className="text-gray-400 text-sm">Aucune injection DLL suspecte détectée.</p>
                    ) : (
                      <div className="space-y-1">
                        {irisDetailsPlayer.security.dllInjection.suspiciousDlls?.map((d, i) => (
                          <div key={i} className="flex flex-col gap-1 text-sm bg-red-500/5 px-3 py-2 rounded-lg">
                            <div className="flex items-center gap-2">
                              <span className="text-red-400 font-medium">{d.name}</span>
                              <span className="text-xs text-gray-500">{d.reason}</span>
                            </div>
                            {d.path && <span className="text-gray-600 text-xs truncate" title={d.path}>{d.path}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* VM Detection */}
                {irisDetailsPlayer.security?.vmDetection && (
                  <div className={`bg-dark-900/50 border rounded-xl p-4 ${irisDetailsPlayer.security.vmDetection.vmDetected ? 'border-indigo-500/30' : 'border-white/10'}`}>
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Monitor className={`w-4 h-4 ${irisDetailsPlayer.security.vmDetection.vmDetected ? 'text-indigo-400' : 'text-gray-400'}`} />
                      Détection Machine Virtuelle
                      {irisDetailsPlayer.security.vmDetection.vmDetected && irisDetailsPlayer.security.vmDetection.vmType && (
                        <span className="px-2 py-0.5 text-xs bg-indigo-500/20 text-indigo-400 rounded">{irisDetailsPlayer.security.vmDetection.vmType}</span>
                      )}
                      {irisDetailsPlayer.security.vmDetection.riskScore > 0 && (
                        <span className="text-xs text-gray-500 ml-auto">Score: {irisDetailsPlayer.security.vmDetection.riskScore}</span>
                      )}
                    </h4>
                    {!irisDetailsPlayer.security.vmDetection.vmDetected ? (
                      <p className="text-gray-400 text-sm">Aucune machine virtuelle détectée - PC physique.</p>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                          <AlertTriangle className="w-4 h-4 text-indigo-400" />
                          <span className="text-indigo-300">Machine virtuelle détectée: <strong>{irisDetailsPlayer.security.vmDetection.vmType || 'Inconnue'}</strong></span>
                        </div>
                        {irisDetailsPlayer.security.vmDetection.vmIndicators?.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-gray-500 uppercase">Indicateurs de détection</p>
                            {irisDetailsPlayer.security.vmDetection.vmIndicators.map((indicator, i) => (
                              <div key={i} className="text-sm text-indigo-300 bg-indigo-500/5 px-3 py-1 rounded">{indicator}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Cloud PC Detection */}
                {irisDetailsPlayer.security?.cloudPcDetection && (
                  <div className={`bg-dark-900/50 border rounded-xl p-4 ${irisDetailsPlayer.security.cloudPcDetection.cloudPcDetected ? (irisDetailsPlayer.security.cloudPcDetection.isGamingCloud ? 'border-emerald-500/30' : 'border-amber-500/30') : 'border-white/10'}`}>
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Cloud className={`w-4 h-4 ${irisDetailsPlayer.security.cloudPcDetection.cloudPcDetected ? (irisDetailsPlayer.security.cloudPcDetection.isGamingCloud ? 'text-emerald-400' : 'text-amber-400') : 'text-gray-400'}`} />
                      Détection Cloud PC
                      {irisDetailsPlayer.security.cloudPcDetection.cloudPcDetected && irisDetailsPlayer.security.cloudPcDetection.cloudProvider && (
                        <span className={`px-2 py-0.5 text-xs rounded ${irisDetailsPlayer.security.cloudPcDetection.isGamingCloud ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {irisDetailsPlayer.security.cloudPcDetection.cloudProvider}
                        </span>
                      )}
                      {irisDetailsPlayer.security.cloudPcDetection.isGamingCloud && (
                        <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded">Cloud Gaming</span>
                      )}
                      {irisDetailsPlayer.security.cloudPcDetection.riskScore > 0 && (
                        <span className="text-xs text-gray-500 ml-auto">Score: {irisDetailsPlayer.security.cloudPcDetection.riskScore}</span>
                      )}
                    </h4>
                    {!irisDetailsPlayer.security.cloudPcDetection.cloudPcDetected ? (
                      <p className="text-gray-400 text-sm">Aucun Cloud PC détecté - PC local.</p>
                    ) : (
                      <div className="space-y-2">
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${irisDetailsPlayer.security.cloudPcDetection.isGamingCloud ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                          {irisDetailsPlayer.security.cloudPcDetection.isGamingCloud ? (
                            <Gamepad2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                          )}
                          <span className={irisDetailsPlayer.security.cloudPcDetection.isGamingCloud ? 'text-emerald-300' : 'text-amber-300'}>
                            {irisDetailsPlayer.security.cloudPcDetection.isGamingCloud 
                              ? `Cloud Gaming détecté: ${irisDetailsPlayer.security.cloudPcDetection.cloudProvider || 'Inconnu'}`
                              : `Cloud PC détecté: ${irisDetailsPlayer.security.cloudPcDetection.cloudProvider || 'Inconnu'}`
                            }
                          </span>
                        </div>
                        {irisDetailsPlayer.security.cloudPcDetection.cloudIndicators?.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-gray-500 uppercase">Indicateurs de détection</p>
                            {irisDetailsPlayer.security.cloudPcDetection.cloudIndicators.map((indicator, i) => (
                              <div key={i} className={`text-sm px-3 py-1 rounded ${irisDetailsPlayer.security.cloudPcDetection.isGamingCloud ? 'text-emerald-300 bg-emerald-500/5' : 'text-amber-300 bg-amber-500/5'}`}>{indicator}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* USB Devices & Running Processes - Side by Side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* USB Devices */}
                  {irisDetailsPlayer.security?.usbDevices?.length > 0 && (
                    <div className="bg-dark-900/50 border border-white/10 rounded-xl p-4">
                      <h4 className="text-white font-semibold mb-3 flex items-center gap-2"><Link className="w-4 h-4 text-gray-400" /> Périphériques USB ({irisDetailsPlayer.security.usbDevices.length})</h4>
                      <div className="max-h-60 overflow-y-auto space-y-1">
                        {irisDetailsPlayer.security.usbDevices.map((u, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm px-3 py-1.5 rounded bg-dark-800/50">
                            <span className="text-white">{u.name || 'Périphérique inconnu'}</span>
                            {u.manufacturer && <span className="text-gray-500 text-xs">({u.manufacturer})</span>}
                            {u.device_id && <span className="text-gray-600 text-xs ml-auto truncate max-w-[200px]" title={u.device_id}>{u.device_id}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Running Processes */}
                  {irisDetailsPlayer.security?.processes?.length > 0 && (
                    <div className="bg-dark-900/50 border border-white/10 rounded-xl p-4">
                      <h4 className="text-white font-semibold mb-3 flex items-center gap-2"><List className="w-4 h-4 text-gray-400" /> Processus ({irisDetailsPlayer.security.processes.length})</h4>
                      <div className="max-h-60 overflow-y-auto space-y-1">
                        {irisDetailsPlayer.security.processes.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm px-3 py-1.5 rounded bg-dark-800/50">
                            <span className="text-white font-mono text-xs">{p.name}</span>
                            {p.pid && <span className="text-gray-600 text-xs">PID:{p.pid}</span>}
                            {p.path && <span className="text-gray-600 text-xs ml-auto truncate max-w-[250px]" title={p.path}>{p.path}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Admin Actions */}
                {userIsAdmin && (
                  <div className="bg-dark-900/50 border border-red-500/20 rounded-xl p-4">
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-red-400" />
                      Actions administrateur
                    </h4>
                    
                    {!confirmIrisReset ? (
                      <button
                        onClick={() => setConfirmIrisReset(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                        RAZ Iris (comme s'il n'avait jamais téléchargé)
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                          <div className="text-red-300 text-sm flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div>
                              <strong>Attention:</strong> Cette action va supprimer TOUTES les données Iris de ce joueur:
                              <ul className="list-disc list-inside mt-1 text-red-400/80 text-xs">
                                <li>Hardware ID et infos système</li>
                                <li>Historique des sessions</li>
                                <li>Historique des détections</li>
                                <li>Statut de sécurité</li>
                                <li>Canal de surveillance Discord</li>
                              </ul>
                              <span className="mt-1 block">Le joueur devra se reconnecter à Iris.</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={async () => {
                              try {
                                setResettingIrisPlayer(irisDetailsPlayer._id);
                                const response = await fetch(`${API_URL}/iris/reset/${irisDetailsPlayer._id}`, {
                                  method: 'POST',
                                  headers: {
                                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                                  }
                                });
                                const data = await response.json();
                                if (data.success) {
                                  setSuccess(`Iris reset pour ${irisDetailsPlayer.username || irisDetailsPlayer.discordUsername}`);
                                  setIrisDetailsPlayer(null);
                                  setConfirmIrisReset(false);
                                  // Refresh the list
                                  fetchIrisPlayers();
                                } else {
                                  setError(data.message || 'Erreur lors du reset');
                                }
                              } catch (err) {
                                setError('Erreur serveur');
                              } finally {
                                setResettingIrisPlayer(null);
                              }
                            }}
                            disabled={resettingIrisPlayer}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                          >
                            {resettingIrisPlayer ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            Confirmer le RAZ
                          </button>
                          <button
                            onClick={() => setConfirmIrisReset(false)}
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );

    // Render Updates sub-tab (admin only)
    const renderUpdatesTab = () => (
      <>
        {/* Add Update Button */}
        <div className="flex justify-end">
          <button
            onClick={() => openIrisUpdateModal()}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Nouvelle version
          </button>
        </div>

        {/* Updates Table */}
        <div className="bg-dark-800/50 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-900/50">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase">Version</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase">Statut</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase">Taille</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase">Téléchargements</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loadingIrisUpdates ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <Loader2 className="w-6 h-6 text-purple-500 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : irisUpdates.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-400">
                      Aucune version publiée. Cliquez sur "Nouvelle version" pour ajouter une mise à jour.
                    </td>
                  </tr>
                ) : (
                  irisUpdates.map((update) => (
                    <tr key={update._id} className={`hover:bg-white/5 transition-colors ${update.isCurrent ? 'bg-green-500/5' : ''}`}>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-mono font-medium">v{update.version}</span>
                          {update.mandatory && (
                            <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">Obligatoire</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {update.isCurrent ? (
                          <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded-full border border-green-500/30">Version actuelle</span>
                        ) : update.isActive ? (
                          <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">Active</span>
                        ) : (
                          <span className="px-2 py-1 text-xs bg-gray-500/20 text-gray-400 rounded-full border border-gray-500/30">Inactive</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-gray-400">{formatFileSize(update.fileSize)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Download className="w-4 h-4" />
                          {update.downloadCount || 0}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-gray-400">
                        {new Date(update.releasedAt || update.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {!update.isCurrent && (
                            <button
                              onClick={() => handleSetCurrentIrisUpdate(update._id)}
                              className="p-2 hover:bg-green-500/20 text-green-400 rounded-lg transition-colors"
                              title="Définir comme version actuelle"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openIrisUpdateModal(update)}
                            className="p-2 hover:bg-purple-500/20 text-purple-400 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {!update.isCurrent && (
                            <button
                              onClick={() => handleDeleteIrisUpdate(update._id)}
                              className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Download className="w-5 h-5 text-purple-400 mt-0.5" />
            <div>
              <h4 className="text-purple-400 font-medium">Système de mise à jour</h4>
              <p className="text-gray-400 text-sm mt-1">
                Les clients Iris vérifient les mises à jour au démarrage. 
                Marquez une version comme "obligatoire" pour forcer tous les utilisateurs à mettre à jour.
              </p>
            </div>
          </div>
        </div>
      </>
    );

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Cpu className="w-7 h-7 text-purple-400" />
            Iris Anticheat
          </h2>
          <div className="flex items-center gap-4">
            {irisSubTab === 'players' && (
              <>
                <button
                  onClick={fetchIrisPlayers}
                  disabled={loadingIrisPlayers}
                  className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingIrisPlayers ? 'animate-spin' : ''}`} />
                  Actualiser
                </button>
                <div className="text-gray-400 text-sm">
                  {irisPlayers.filter(p => p.isConnected).length} connecté(s) / {irisPlayers.length} total
                </div>
              </>
            )}
            {irisSubTab === 'updates' && (
              <button
                onClick={fetchIrisUpdates}
                disabled={loadingIrisUpdates}
                className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loadingIrisUpdates ? 'animate-spin' : ''}`} />
                Actualiser
              </button>
            )}
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-2 bg-dark-800/50 p-1 rounded-xl w-fit">
          <button
            onClick={() => setIrisSubTab('players')}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              irisSubTab === 'players'
                ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            Joueurs
            {irisPlayers.filter(p => p.isConnected).length > 0 && (
              <span className={`px-2 py-0.5 text-xs rounded-full ${irisSubTab === 'players' ? 'bg-white/20 text-white' : 'bg-green-500/20 text-green-400'}`}>
                {irisPlayers.filter(p => p.isConnected).length} en ligne
              </span>
            )}
          </button>
          {userIsAdmin && (
            <button
              onClick={() => setIrisSubTab('updates')}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                irisSubTab === 'updates'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Download className="w-4 h-4" />
              Mises à jour
            </button>
          )}
        </div>

        {/* Content based on sub-tab */}
        {irisSubTab === 'players' && renderPlayersTab()}
        {irisSubTab === 'updates' && userIsAdmin && renderUpdatesTab()}

        {/* Update Modal */}
        {showIrisUpdateModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-dark-800 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white">
                    {editingIrisUpdate ? 'Modifier la version' : 'Nouvelle version'}
                  </h3>
                  <button
                    onClick={() => setShowIrisUpdateModal(false)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Version */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Version (ex: 1.0.0) *</label>
                    <input
                      type="text"
                      value={irisUpdateFormData.version}
                      onChange={(e) => {
                        const version = e.target.value;
                        // Auto-generate download URL when version changes
                        const autoUrl = version ? `https://api-nomercy.ggsecure.io/iris-downloads/Iris_${version}_x64-setup.exe` : '';
                        setIrisUpdateFormData({ 
                          ...irisUpdateFormData, 
                          version,
                          downloadUrl: autoUrl
                        });
                      }}
                      disabled={!!editingIrisUpdate}
                      className="w-full px-4 py-2 bg-dark-900 border border-white/10 rounded-lg text-white disabled:opacity-50"
                      placeholder="1.0.0"
                    />
                    <p className="text-xs text-gray-500 mt-1">L'URL de téléchargement sera générée automatiquement</p>
                  </div>

                  {/* Download URL (auto-generated, readonly) */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">URL de téléchargement (auto)</label>
                    <input
                      type="text"
                      value={irisUpdateFormData.downloadUrl}
                      readOnly
                      className="w-full px-4 py-2 bg-dark-900/50 border border-white/5 rounded-lg text-gray-400 font-mono text-sm cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">Placez le fichier <code className="text-purple-400">Iris_{irisUpdateFormData.version || 'X.X.X'}_x64-setup.exe</code> dans <code className="text-purple-400">Server/iris-downloads/</code></p>
                  </div>

                  {/* Changelog */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Notes de version</label>
                    <textarea
                      value={irisUpdateFormData.changelog}
                      onChange={(e) => setIrisUpdateFormData({ ...irisUpdateFormData, changelog: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-900 border border-white/10 rounded-lg text-white resize-none"
                      rows={4}
                      placeholder="- Amélioration...\n- Correction..."
                    />
                  </div>

                  {/* Signature (Tauri) */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Signature Tauri (optionnel)</label>
                    <textarea
                      value={irisUpdateFormData.signature || ''}
                      onChange={(e) => setIrisUpdateFormData({ ...irisUpdateFormData, signature: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-900 border border-white/10 rounded-lg text-white font-mono text-xs resize-none"
                      rows={2}
                      placeholder="dW50cnVzdGVkIGNvbW1lbnQ6..."
                    />
                    <p className="text-xs text-gray-500 mt-1">Générée avec: tauri signer sign -k private.key bundle.zip</p>
                  </div>

                  {/* Options */}
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={irisUpdateFormData.mandatory}
                        onChange={(e) => setIrisUpdateFormData({ ...irisUpdateFormData, mandatory: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-600 text-purple-500 focus:ring-purple-500"
                      />
                      <span className="text-white">Mise à jour obligatoire</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={irisUpdateFormData.isCurrent}
                        onChange={(e) => setIrisUpdateFormData({ ...irisUpdateFormData, isCurrent: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-600 text-purple-500 focus:ring-purple-500"
                      />
                      <span className="text-white">Version actuelle</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowIrisUpdateModal(false)}
                    className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSaveIrisUpdate}
                    disabled={savingIrisUpdate || !irisUpdateFormData.version}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingIrisUpdate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {editingIrisUpdate ? 'Enregistrer' : 'Créer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDeletedAccounts = () => {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Comptes Supprimés</h2>
          <div className="text-gray-400 text-sm">
            {deletedAccounts.length} compte(s) supprimé(s) • Page {page}/{totalPages || 1}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher un compte supprimé..."
            className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
          />
        </div>

        {/* Deleted Accounts Table */}
        <div className="bg-dark-800/50 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-900/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Utilisateur</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Discord</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Stats</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Coins</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Supprimé par</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {deletedAccounts.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-400">
                      Aucun compte supprimé trouvé
                    </td>
                  </tr>
                ) : (
                  deletedAccounts.map((account) => (
                    <tr key={account._id} className="hover:bg-white/5 transition-colors">
                      {/* Username */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div>
                            <div className="text-white font-medium">{account.username || account.discordUsername || 'N/A'}</div>
                            <div className="text-xs text-gray-500">ID: {account.deletedUserId}</div>
                          </div>
                        </div>
                      </td>

                      {/* Discord */}
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="text-white">{account.discordUsername}</div>
                          <div className="text-xs text-gray-500">{account.discordId}</div>
                        </div>
                      </td>

                      {/* Stats */}
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-300">
                          <div>{account.stats?.wins || 0}W / {account.stats?.losses || 0}L</div>
                          <div className="text-xs text-gray-500">{account.stats?.points || 0} pts</div>
                        </div>
                      </td>

                      {/* Coins */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-1">
                          <Coins className="w-4 h-4 text-yellow-400" />
                          <span className="text-yellow-400 font-medium">{account.goldCoins || 0}</span>
                        </div>
                      </td>

                      {/* Deleted By */}
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          account.deletedBy === 'admin' 
                            ? 'bg-red-500/20 text-red-400' 
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {account.deletedBy === 'admin' ? 'Admin' : 'Utilisateur'}
                        </span>
                        {account.deletionReason && (
                          <div className="text-xs text-gray-500 mt-1">{account.deletionReason}</div>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-400">
                          {new Date(account.deletedAt).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-dark-800/50 border border-white/10 rounded-xl px-6 py-4">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-purple-400 rounded-lg transition-colors"
            >
              Précédent
            </button>
            <span className="text-gray-400">
              Page {page} sur {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-purple-400 rounded-lg transition-colors"
            >
              Suivant
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderMessages = () => {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Gestion des Messages</h2>
          <div className="text-gray-400 text-sm">
            {conversations.length} conversation(s)
          </div>
        </div>

        {/* Conversations List */}
        <div className="bg-dark-800/50 border border-white/10 rounded-xl overflow-hidden">
          {conversations.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">
              Aucune conversation trouvée
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {conversations.map((conv) => (
                <div key={conv._id} className="p-6 hover:bg-white/5 transition-colors">
                  {/* Conversation Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="w-5 h-5 text-purple-400" />
                      <div>
                        <h3 className="text-white font-medium">
                          Participants: {conv.participants?.map(p => p.username).join(', ')}
                        </h3>
                        <p className="text-gray-500 text-sm">
                          {conv.messages?.length || 0} message(s)
                        </p>
                      </div>
                    </div>
                    <div className="text-gray-500 text-sm">
                      {new Date(conv.lastMessageAt || conv.createdAt).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>

                  {/* Messages */}
                  {conv.messages && conv.messages.length > 0 && (
                    <div className="space-y-2 max-h-96 overflow-y-auto bg-dark-900/50 rounded-lg p-4">
                      {conv.messages.map((msg) => (
                        <div key={msg._id} className="flex items-start gap-3 p-2 rounded hover:bg-white/5">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-purple-400 font-medium text-sm">
                                {msg.sender?.username || msg.sender?.discordUsername || 'Utilisateur supprimé'}
                              </span>
                              <span className="text-gray-500 text-xs">
                                {new Date(msg.createdAt).toLocaleDateString('fr-FR', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <p className="text-gray-300 text-sm">{msg.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSquads = () => {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h2 className="text-xl sm:text-2xl font-bold text-white">Gestion des Escouades</h2>
          <div className="text-gray-400 text-xs sm:text-sm">
            {squads.length} escouade(s) • Page {page}/{totalPages || 1}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher une escouade..."
            className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 bg-dark-800 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500/50"
          />
        </div>

        {/* Squads Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {squads.length === 0 ? (
            <div className="col-span-full text-center text-gray-400 py-8">
              Aucune escouade trouvée
            </div>
          ) : (
            squads.map((squad) => (
              <div
                key={squad._id}
                className="bg-dark-800/50 border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center border border-white/10"
                      style={{ backgroundColor: squad.color === 'transparent' ? 'transparent' : squad.color + '30' }}
                    >
                      {squad.logo ? (
                        <img src={squad.logo} alt="" className="w-8 h-8 object-contain" />
                      ) : (
                        <Shield className="w-6 h-6" style={{ color: squad.color === 'transparent' ? '#9ca3af' : squad.color }} />
                      )}
                          </div>
                    <div>
                      <h3 className="text-white font-bold">{squad.name}</h3>
                      <p className="text-gray-400 text-sm">[{squad.tag}]</p>
                            </div>
                            </div>
                          </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Membres</span>
                    <span className="text-white font-medium">{squad.members?.length || 0}/{squad.maxMembers}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Mode</span>
                    <span className="text-white font-medium">{squad.mode}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Level</span>
                    <span className="text-white font-medium">{squad.level || 1}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Points Top Escouade</span>
                    <span className="text-amber-400 font-bold">{squad.stats?.totalPoints || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">W/L</span>
                    <span className="text-white font-medium">{squad.stats?.totalWins || 0}W - {squad.stats?.totalLosses || 0}L</span>
                  </div>
                </div>

                {/* Ladder Points */}
                {squad.registeredLadders && squad.registeredLadders.length > 0 && (
                  <div className="mb-4 p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg">
                    <p className="text-xs text-purple-400 mb-2 font-medium flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Points Ladder
                    </p>
                    <div className="space-y-1.5">
                      {squad.registeredLadders.map((ladder, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-gray-300 text-xs">{ladder.ladderName || ladder.ladderId}</span>
                          <span className="text-purple-400 font-bold">{ladder.points} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Members list */}
                {squad.members && squad.members.length > 0 && (
                  <div className="mb-4 p-3 bg-dark-900/50 rounded-lg">
                    <p className="text-xs text-gray-400 mb-2">Membres :</p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {squad.members.map((member, idx) => {
                        const userId = member.user?._id || member.user;
                        const username = member.user?.username || member.user?.discordUsername || 'Inconnu';
                        const avatarUrl = getAvatarUrl(member.user?.avatarUrl || member.user?.avatar) || '/avatar.jpg';
                        const isLeader = userId?.toString() === squad.leader?._id?.toString() || userId?.toString() === squad.leader?.toString();
                        
                        return (
                          <div key={userId || idx} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <img 
                                src={avatarUrl} 
                                alt="" 
                                className="w-6 h-6 rounded-full object-cover border border-white/10"
                              />
                              <span className="text-white text-xs truncate max-w-[100px]">{username}</span>
                              {isLeader && (
                                <Crown className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                              )}
                              {member.role === 'officer' && !isLeader && (
                                <Star className="w-3 h-3 text-purple-400 flex-shrink-0" />
                              )}
                            </div>
                            {!isLeader && (
                              <button
                                onClick={() => handleKickMember(squad._id, userId)}
                                className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                                title="Kick"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Trophies */}
                {squad.trophies && squad.trophies.length > 0 && (
                  <div className="mb-4 flex items-center gap-2 flex-wrap">
                    {squad.trophies.slice(0, 3).map((t, i) => (
                      <div key={i} className="w-6 h-6 bg-yellow-500/20 rounded-full flex items-center justify-center">
                        <Trophy className="w-3 h-3 text-yellow-400" />
                      </div>
                    ))}
                    {squad.trophies.length > 3 && (
                      <span className="text-xs text-gray-400">+{squad.trophies.length - 3}</span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal('squad', squad)}
                    className="flex-1 py-2 px-3 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-sm font-medium"
                  >
                    Modifier
                  </button>
                  {userIsAdmin && squad.registeredLadders && squad.registeredLadders.length > 0 && (
                    <button
                      onClick={() => openLadderPointsModal(squad)}
                      className="py-2 px-3 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
                      title="Modifier les points Ladder"
                    >
                      <TrendingUp className="w-4 h-4" />
                    </button>
                  )}
                  {userIsAdmin && (
                    <button
                      onClick={() => openSquadTrophyModal(squad)}
                      className="py-2 px-3 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors"
                      title="Gérer les trophées"
                    >
                      <Trophy className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteConfirm({ type: 'squad', id: squad._id })}
                    className="py-2 px-3 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
                          )}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
                        <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-dark-800 text-white rounded-lg hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Précédent
                        </button>
            <span className="text-gray-400">
              Page {page} sur {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-dark-800 text-white rounded-lg hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Suivant
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderShop = () => {
    // Category list for filtering
    const shopCategories = [
      { id: 'all', label: 'Tout' },
      { id: 'profile_animation', label: 'Animations' },
      { id: 'ornament', label: 'Ornements' },
      { id: 'avatar_frame', label: 'Cadres' },
      { id: 'title', label: 'Titres' },
      { id: 'badge', label: 'Badges' },
      { id: 'boost', label: 'Boosts' },
      { id: 'emote', label: 'Emotes' },
      { id: 'cosmetic', label: 'Cosmétiques' },
      { id: 'other', label: 'Autres' },
    ];
    
    // Use searchTerm state for category filter (repurposing it for shop tab)
    const shopCategoryFilter = filterMode; // 'all' or specific category
    
    // Filter items by category
    const filteredShopItems = shopCategoryFilter === 'all'
      ? shopItems
      : shopItems.filter(item => item.category === shopCategoryFilter);
    
    // Sort by category then by price (most expensive first)
    const sortedShopItems = [...filteredShopItems].sort((a, b) => {
      // First group by category
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      // Then sort by price descending
      return b.price - a.price;
    });
    
    // Pagination
    const SHOP_ITEMS_PER_PAGE = 12;
    const shopTotalPages = Math.ceil(sortedShopItems.length / SHOP_ITEMS_PER_PAGE);
    const paginatedShopItems = sortedShopItems.slice(
      (page - 1) * SHOP_ITEMS_PER_PAGE,
      page * SHOP_ITEMS_PER_PAGE
    );
    
    // Get count per category
    const getCategoryCount = (categoryId) => {
      if (categoryId === 'all') return shopItems.length;
      return shopItems.filter(item => item.category === categoryId).length;
    };
    
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-2xl font-bold text-white">Items de la Boutique</h2>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">{sortedShopItems.length} items</span>
            <button
              onClick={() => openCreateModal('shopItem')}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:opacity-90 transition-all"
            >
              <Plus className="w-5 h-5" />
              Nouvel Item
            </button>
          </div>
        </div>
        
        {/* Category Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          {shopCategories.map((cat) => {
            const count = getCategoryCount(cat.id);
            const isActive = shopCategoryFilter === cat.id;
            
            if (cat.id !== 'all' && count === 0) return null;
            
            return (
              <button
                key={cat.id}
                onClick={() => { setFilterMode(cat.id); setPage(1); }}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all text-sm ${
                  isActive 
                    ? 'bg-purple-500 text-white'
                    : 'bg-dark-800 text-gray-400 hover:text-white hover:bg-dark-700'
                }`}
              >
                {cat.label}
                <span className="ml-1.5 text-xs opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedShopItems.length === 0 ? (
            <div className="col-span-full text-center text-gray-400 py-8">
              Aucun item trouvé
            </div>
          ) : (
            paginatedShopItems.map((item) => (
              <div
                key={item._id}
                className={`bg-dark-800/50 border rounded-xl p-4 hover:border-white/20 transition-all ${
                  item.isActive ? 'border-white/10' : 'border-gray-700/50 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded bg-${getRarityColor(item.rarity)}-500/20 text-${getRarityColor(item.rarity)}-400`}>
                    {item.rarity}
                  </span>
                  {!item.isActive && (
                    <span className="px-2 py-1 text-xs font-medium rounded bg-gray-500/20 text-gray-400">
                      Inactif
                    </span>
                  )}
                </div>

                <h3 className="text-white font-bold mb-2">{item.name}</h3>
                <p className="text-gray-400 text-sm mb-3 line-clamp-2">{item.description}</p>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1 text-yellow-400">
                    <Coins className="w-4 h-4" />
                    <span className="font-bold">{item.price}</span>
                  </div>
                  <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">{item.category}</span>
                </div>
                
                {/* Match count for usable items */}
                {item.isUsable && item.matchCount > 0 && (
                  <div className="flex items-center gap-1 text-purple-400 text-xs mb-3">
                    <Target className="w-3 h-3" />
                    <span>{item.matchCount} match{item.matchCount > 1 ? 's' : ''}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal('shopItem', item)}
                    className="flex-1 py-2 px-3 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-sm font-medium"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ type: 'shopItem', id: item._id })}
                    className="py-2 px-3 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Pagination */}
        {shopTotalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-dark-800 text-white rounded-lg hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Précédent
            </button>
            <span className="text-gray-400">
              Page {page} sur {shopTotalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(shopTotalPages, p + 1))}
              disabled={page === shopTotalPages}
              className="px-4 py-2 bg-dark-800 text-white rounded-lg hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Suivant
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderTrophies = () => {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Gestion des Trophées</h2>
          <button
            onClick={() => openCreateModal('trophy')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-bold rounded-lg hover:opacity-90 transition-all"
          >
            <Plus className="w-5 h-5" />
            Nouveau Trophée
          </button>
        </div>

        {/* Info */}
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">
            Les trophées peuvent être attribués aux escouades depuis la gestion des escouades. Créez ici les trophées disponibles.
          </p>
        </div>

        {/* Trophies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trophies.length === 0 ? (
            <div className="col-span-full text-center text-gray-400 py-8">
              Aucun trophée trouvé
            </div>
          ) : (
            trophies.map((trophy) => {
              const IconComp = { Trophy, Award, Medal, Star, Crown, Shield, Zap, Target }[trophy.icon] || Trophy;
              const colorMap = {
                amber: '#f59e0b',
                yellow: '#eab308',
                orange: '#f97316',
                red: '#ef4444',
                pink: '#ec4899',
                purple: '#a855f7',
                blue: '#3b82f6',
                cyan: '#06b6d4',
                green: '#22c55e',
                emerald: '#10b981',
                gray: '#6b7280'
              };
              const iconColor = colorMap[trophy.color] || '#f59e0b';
                
              return (
                <div 
                  key={trophy._id}
                  className="bg-dark-800/50 border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${iconColor}30` }}
                    >
                      <IconComp className="w-7 h-7" style={{ color: iconColor }} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-bold mb-1">{trophy.name}</h3>
                      <p className="text-gray-400 text-sm">{trophy.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        trophy.rarityName === 'legendary' ? 'bg-yellow-500/20 text-yellow-400' :
                        trophy.rarityName === 'epic' ? 'bg-purple-500/20 text-purple-400' :
                        trophy.rarityName === 'rare' ? 'bg-blue-500/20 text-blue-400' :
                        trophy.rarityName === 'uncommon' ? 'bg-green-500/20 text-green-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {trophy.rarityName || 'common'}
                      </span>
                      <span className="text-xs text-gray-500">Niv. {trophy.rarity}/5</span>
                    </div>
                    {trophy.isDefault && (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-cyan-500/20 text-cyan-400">
                        Par défaut
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    {trophy.isActive ? (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-green-500/20 text-green-400">
                        Actif
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-gray-500/20 text-gray-400">
                        Inactif
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {new Date(trophy.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal('trophy', trophy)}
                      className="flex-1 py-2 px-3 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-sm font-medium"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ type: 'trophy', id: trophy._id })}
                      className="py-2 px-3 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderApplication = () => {
    if (!appSettings) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        </div>
      );
    }

    const featureLabels = {
      rankedMatchmaking: { label: 'Matchmaking Classé', desc: 'Recherche de parties classées' },
      rankedPosting: { label: 'Création de matchs classés', desc: 'Poster des matchs classés' },
      ladderMatchmaking: { label: 'Matchmaking Ladder', desc: 'Recherche de parties ladder' },
      ladderPosting: { label: 'Création de matchs Ladder', desc: 'Poster des matchs ladder' },
      squadCreation: { label: 'Création d\'escouades', desc: 'Créer de nouvelles escouades' },
      squadInvites: { label: 'Invitations escouade', desc: 'Envoyer des invitations' },
      shopPurchases: { label: 'Achats boutique', desc: 'Effectuer des achats' },
      profileEditing: { label: 'Modification de profil', desc: 'Modifier son profil' },
      hardcoreMode: { label: 'Mode Hardcore', desc: 'Accès au mode Hardcore' },
      cdlMode: { label: 'Mode CDL', desc: 'Accès au mode CDL' },
      registration: { label: 'Inscriptions', desc: 'Nouvelles inscriptions' }
    };

    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
              <Power className="w-5 sm:w-7 h-5 sm:h-7 text-purple-400" />
              Gestion de l'Application
            </h2>
            <p className="text-gray-400 mt-1 text-sm sm:text-base">
              Activez ou désactivez les fonctionnalités de l'application
            </p>
          </div>
        </div>

        {/* Maintenance Mode */}
        <div className="bg-dark-800/50 border border-red-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-bold">Mode Maintenance</h3>
                <p className="text-gray-400 text-sm">Désactiver temporairement toute l'application</p>
              </div>
            </div>
            <button
              onClick={async () => {
                try {
                  const response = await fetch(`${API_URL}/app-settings/admin/maintenance`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ enabled: !appSettings.maintenance?.enabled })
                  });
                  const data = await response.json();
                  if (data.success) {
                    setSuccess(`Mode maintenance ${!appSettings.maintenance?.enabled ? 'activé' : 'désactivé'}`);
                    fetchAppSettings();
                  }
                } catch (err) {
                  setError('Erreur');
                }
              }}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                appSettings.maintenance?.enabled ? 'bg-red-500' : 'bg-dark-700'
              }`}
            >
              <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                appSettings.maintenance?.enabled ? 'translate-x-6' : ''
              }`} />
            </button>
          </div>
          {appSettings.maintenance?.enabled && (
            <div className="mt-4 p-4 bg-red-500/10 rounded-lg">
              <p className="text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                L'application est actuellement en maintenance
              </p>
            </div>
          )}
        </div>

        {/* Feature Toggles */}
        <div className="bg-dark-800/50 border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Fonctionnalités
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(featureLabels).map(([key, { label, desc }]) => {
              const feature = appSettings.features?.[key];
              const isEnabled = feature?.enabled !== false;
              
              return (
                <div key={key} className="bg-dark-900/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="text-white font-medium">{label}</h4>
                      <p className="text-gray-500 text-xs">{desc}</p>
                    </div>
                    <button
                      onClick={() => toggleFeature(key, !isEnabled)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        isEnabled ? 'bg-green-500' : 'bg-dark-700'
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        isEnabled ? 'translate-x-6' : ''
                      }`} />
                    </button>
                  </div>
                  {!isEnabled && (
                    <input
                      type="text"
                      placeholder="Message quand désactivé..."
                      defaultValue={feature?.disabledMessage || ''}
                      onBlur={(e) => {
                        if (e.target.value !== feature?.disabledMessage) {
                          updateFeatureMessage(key, e.target.value);
                        }
                      }}
                      className="w-full mt-2 px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Ladder Settings */}
        <div className="bg-dark-800/50 border border-amber-500/30 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            Paramètres Ladder
          </h3>
          
          {/* Chill Time Restriction */}
          <div className="bg-dark-900/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-white font-medium">Restriction horaire Chill</h4>
                <p className="text-gray-500 text-xs">
                  {appSettings.ladderSettings?.duoTrioTimeRestriction?.enabled 
                    ? `Ouvert de ${appSettings.ladderSettings?.duoTrioTimeRestriction?.startHour || 0}h à ${appSettings.ladderSettings?.duoTrioTimeRestriction?.endHour || 20}h (heure française)`
                    : 'Le ladder Chill est toujours ouvert'}
                </p>
              </div>
              <button
                onClick={async () => {
                  const newEnabled = !appSettings.ladderSettings?.duoTrioTimeRestriction?.enabled;
                  try {
                    const response = await fetch(`${API_URL}/app-settings/admin/ladder-settings`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ 
                        duoTrioTimeRestriction: { enabled: newEnabled }
                      })
                    });
                    const data = await response.json();
                    if (data.success) {
                      setSuccess(newEnabled ? 'Restriction horaire activée' : 'Ladder Chill toujours ouvert');
                      fetchAppSettings();
                    } else {
                      setError(data.message || 'Erreur');
                    }
                  } catch (err) {
                    setError('Erreur lors de la modification');
                  }
                }}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  appSettings.ladderSettings?.duoTrioTimeRestriction?.enabled ? 'bg-amber-500' : 'bg-dark-700'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  appSettings.ladderSettings?.duoTrioTimeRestriction?.enabled ? 'translate-x-6' : ''
                }`} />
              </button>
            </div>
            
            {appSettings.ladderSettings?.duoTrioTimeRestriction?.enabled && (
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <label className="text-gray-400 text-sm">De</label>
                  <select
                    value={appSettings.ladderSettings?.duoTrioTimeRestriction?.startHour || 0}
                    onChange={async (e) => {
                      try {
                        const response = await fetch(`${API_URL}/app-settings/admin/ladder-settings`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ 
                            duoTrioTimeRestriction: { startHour: parseInt(e.target.value) }
                          })
                        });
                        const data = await response.json();
                        if (data.success) {
                          fetchAppSettings();
                        }
                      } catch (err) {
                        setError('Erreur');
                      }
                    }}
                    className="px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{i}h</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-gray-400 text-sm">à</label>
                  <select
                    value={appSettings.ladderSettings?.duoTrioTimeRestriction?.endHour || 20}
                    onChange={async (e) => {
                      try {
                        const response = await fetch(`${API_URL}/app-settings/admin/ladder-settings`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ 
                            duoTrioTimeRestriction: { endHour: parseInt(e.target.value) }
                          })
                        });
                        const data = await response.json();
                        if (data.success) {
                          fetchAppSettings();
                        }
                      } catch (err) {
                        setError('Erreur');
                      }
                    }}
                    className="px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{i}h</option>
                    ))}
                  </select>
                </div>
                <span className="text-gray-500 text-sm">(heure française)</span>
              </div>
            )}
          </div>
        </div>

        {/* Global Alerts */}
        <div className="bg-dark-800/50 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Alertes Globales
            </h3>
            <button
              onClick={() => {
                const message = prompt('Message de l\'alerte:');
                if (message) {
                  fetch(`${API_URL}/app-settings/admin/alert`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ type: 'info', message })
                  }).then(r => r.json()).then(data => {
                    if (data.success) {
                      setSuccess('Alerte ajoutée');
                      fetchAppSettings();
                    }
                  });
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Ajouter
            </button>
          </div>
          
          {appSettings.globalAlerts?.length > 0 ? (
            <div className="space-y-3">
              {appSettings.globalAlerts.map((alert) => (
                <div key={alert.id} className={`p-4 rounded-lg flex items-center justify-between ${
                  alert.type === 'error' ? 'bg-red-500/20 border border-red-500/30' :
                  alert.type === 'warning' ? 'bg-orange-500/20 border border-orange-500/30' :
                  alert.type === 'success' ? 'bg-green-500/20 border border-green-500/30' :
                  'bg-blue-500/20 border border-blue-500/30'
                }`}>
                  <div className="flex items-center gap-3">
                    <AlertCircle className={`w-5 h-5 ${
                      alert.type === 'error' ? 'text-red-400' :
                      alert.type === 'warning' ? 'text-orange-400' :
                      alert.type === 'success' ? 'text-green-400' :
                      'text-blue-400'
                    }`} />
                    <span className="text-white">{alert.message}</span>
                  </div>
                  <button
                    onClick={async () => {
                      const response = await fetch(`${API_URL}/app-settings/admin/alert/${alert.id}`, {
                        method: 'DELETE',
                        credentials: 'include'
                      });
                      const data = await response.json();
                      if (data.success) {
                        fetchAppSettings();
                      }
                    }}
                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">Aucune alerte active</p>
          )}
        </div>

        {/* Fixed Banner */}
        <div className="bg-dark-800/50 border border-purple-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Megaphone className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-white font-bold">Bannière Fixe</h3>
                <p className="text-gray-400 text-sm">Affiche une bannière en haut de toutes les pages</p>
              </div>
            </div>
            <button
              onClick={async () => {
                try {
                  const response = await fetch(`${API_URL}/app-settings/admin`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ 
                      banner: { 
                        ...appSettings.banner,
                        enabled: !appSettings.banner?.enabled 
                      }
                    })
                  });
                  const data = await response.json();
                  if (data.success) {
                    setSuccess(`Bannière ${!appSettings.banner?.enabled ? 'activée' : 'désactivée'}`);
                    fetchAppSettings();
                  }
                } catch (err) {
                  setError('Erreur');
                }
              }}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                appSettings.banner?.enabled ? 'bg-purple-500' : 'bg-dark-700'
              }`}
            >
              <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                appSettings.banner?.enabled ? 'translate-x-6' : ''
              }`} />
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Message de la bannière</label>
              <input
                type="text"
                value={appSettings.banner?.message || ''}
                onChange={(e) => setAppSettings({
                  ...appSettings,
                  banner: { ...appSettings.banner, message: e.target.value }
                })}
                placeholder="Ex: 🎉 Nouvelle saison disponible !"
                className="w-full px-4 py-3 bg-dark-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Couleur de fond</label>
                <select
                  value={appSettings.banner?.bgColor || 'purple'}
                  onChange={(e) => setAppSettings({
                    ...appSettings,
                    banner: { ...appSettings.banner, bgColor: e.target.value }
                  })}
                  className="w-full px-4 py-3 bg-dark-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                >
                  <option value="purple">Violet</option>
                  <option value="blue">Bleu</option>
                  <option value="green">Vert</option>
                  <option value="orange">Orange</option>
                  <option value="red">Rouge</option>
                  <option value="cyan">Cyan</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Lien (optionnel)</label>
                <input
                  type="text"
                  value={appSettings.banner?.link || ''}
                  onChange={(e) => setAppSettings({
                    ...appSettings,
                    banner: { ...appSettings.banner, link: e.target.value }
                  })}
                  placeholder="/hardcore ou https://..."
                  className="w-full px-4 py-3 bg-dark-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                />
              </div>
            </div>
            <button
              onClick={async () => {
                try {
                  const response = await fetch(`${API_URL}/app-settings/admin`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ banner: appSettings.banner })
                  });
                  const data = await response.json();
                  if (data.success) {
                    setSuccess('Bannière mise à jour');
                    fetchAppSettings();
                  }
                } catch (err) {
                  setError('Erreur');
                }
              }}
              className="w-full py-3 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              Sauvegarder la bannière
            </button>
          </div>
          
          {appSettings.banner?.enabled && appSettings.banner?.message && (
            <div className="mt-4">
              <p className="text-gray-400 text-sm mb-2">Aperçu:</p>
              <div className={`w-full py-2 px-4 rounded-lg text-center text-white font-medium ${
                appSettings.banner?.bgColor === 'blue' ? 'bg-blue-500' :
                appSettings.banner?.bgColor === 'green' ? 'bg-green-500' :
                appSettings.banner?.bgColor === 'orange' ? 'bg-orange-500' :
                appSettings.banner?.bgColor === 'red' ? 'bg-red-500' :
                appSettings.banner?.bgColor === 'cyan' ? 'bg-cyan-500' :
                'bg-purple-500'
              }`}>
                {appSettings.banner.message}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderRankings = () => {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Classements</h2>
          <select
            value={filterMode}
            onChange={(e) => {
              setFilterMode(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 bg-dark-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50"
          >
            <option value="hardcore">Hardcore</option>
            <option value="cdl">CDL</option>
          </select>
                </div>

        {/* Rankings Table */}
        <div className="bg-dark-800/50 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
                  <table className="w-full">
              <thead className="bg-dark-900/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Rang</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Joueur</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Points</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Division</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">V/D</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">K/D</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Série</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                {rankings.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                      Aucun classement trouvé
                    </td>
                  </tr>
                ) : (
                  rankings.map((ranking, index) => (
                    <tr key={ranking._id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-white font-bold">#{(page - 1) * ITEMS_PER_PAGE + index + 1}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={getAvatarUrl(ranking.user?.avatarUrl || ranking.user?.avatar) || '/avatar.jpg'}
                                alt=""
                            className="w-10 h-10 rounded-full"
                              />
                          <div>
                            <p className="text-white font-medium">{ranking.user?.username || ranking.user?.discordUsername || 'Inconnu'}</p>
                          </div>
                            </div>
                          </td>
                      <td className="px-6 py-4">
                        <span className="text-white font-bold">{ranking.points || 0}</span>
                          </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded bg-${
                          ranking.division === 'elite' ? 'red' :
                          ranking.division === 'master' ? 'purple' :
                          ranking.division === 'diamond' ? 'blue' :
                          ranking.division === 'platinum' ? 'cyan' :
                          ranking.division === 'gold' ? 'yellow' :
                          ranking.division === 'silver' ? 'gray' : 'orange'
                        }-500/20 text-${
                          ranking.division === 'elite' ? 'red' :
                          ranking.division === 'master' ? 'purple' :
                          ranking.division === 'diamond' ? 'blue' :
                          ranking.division === 'platinum' ? 'cyan' :
                          ranking.division === 'gold' ? 'yellow' :
                          ranking.division === 'silver' ? 'gray' : 'orange'
                        }-400`}>
                          {ranking.division}
                        </span>
                          </td>
                      <td className="px-6 py-4">
                        <span className="text-white">{ranking.wins || 0} / {ranking.losses || 0}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-white">{ranking.kd || '0.00'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`${ranking.currentStreak > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {ranking.currentStreak > 0 ? '+' : ''}{ranking.currentStreak || 0}
                            </span>
                          </td>
                        </tr>
                  ))
                )}
                    </tbody>
                  </table>
                </div>
                </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
                  <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-dark-800 text-white rounded-lg hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
              Précédent
                  </button>
            <span className="text-gray-400">
              Page {page} sur {totalPages}
            </span>
                  <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-dark-800 text-white rounded-lg hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
              Suivant
                  </button>
                </div>
        )}
              </div>
    );
  };

  const renderAnnouncements = () => {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Gestion des Annonces</h2>
          <button
            onClick={() => openCreateModal('announcement')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:opacity-90 transition-all"
          >
            <Plus className="w-5 h-5" />
            Nouvelle Annonce
          </button>
                </div>

        {/* Announcements Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {announcements.length === 0 ? (
            <div className="col-span-full text-center text-gray-400 py-8">
              Aucune annonce trouvée
            </div>
          ) : (
            announcements.map((announcement) => (
              <div
                key={announcement._id}
                className="bg-dark-800/50 border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-purple-400" />
                    <span className={`px-2 py-1 text-xs font-medium rounded bg-${
                      announcement.priority === 'critical' ? 'red' :
                      announcement.priority === 'high' ? 'orange' :
                      announcement.priority === 'normal' ? 'blue' : 'gray'
                    }-500/20 text-${
                      announcement.priority === 'critical' ? 'red' :
                      announcement.priority === 'high' ? 'orange' :
                      announcement.priority === 'normal' ? 'blue' : 'gray'
                    }-400`}>
                      {announcement.priority}
                              </span>
                    {announcement.isActive ? (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-green-500/20 text-green-400">
                        Actif
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-gray-500/20 text-gray-400">
                                Inactif
                              </span>
                            )}
                          </div>
                        </div>
                        
                <h3 className="text-white font-bold mb-2">{announcement.title}</h3>
                <p className="text-gray-400 text-sm mb-3 line-clamp-3">{announcement.content}</p>

                <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                  <span>{announcement.type}</span>
                  <span>{formatDate(announcement.createdAt)}</span>
                </div>

                <div className="flex items-center gap-2">
                          <button
                    onClick={() => openEditModal('announcement', announcement)}
                    className="flex-1 py-2 px-3 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-sm font-medium"
                          >
                    Modifier
                          </button>
                          <button
                    onClick={() => setDeleteConfirm({ type: 'announcement', id: announcement._id })}
                    className="py-2 px-3 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
            ))
              )}
            </div>
      </div>
    );
  };

  const renderMaps = () => {
    // Filter maps by mode
    const filteredMaps = maps.filter(map => {
      if (mapModeFilter === 'all') return true;
      if (mapModeFilter === 'stricker') {
        return map.strickerConfig?.ranked?.enabled || map.strickerConfig?.ladder?.enabled;
      }
      return map.mode === mapModeFilter || map.mode === 'both';
    });
    
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-white">Gestion des Cartes</h2>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (!window.confirm('Activer toutes les maps dans tous les modes et formats ? Cela écrasera les configurations existantes.')) {
                  return;
                }
                try {
                  const response = await fetch(`${API_URL}/maps/admin/enable-all`, {
                    method: 'POST',
                    credentials: 'include'
                  });
                  const data = await response.json();
                  if (data.success) {
                    setSuccess(data.message);
                    fetchMaps();
                  } else {
                    setError(data.message || 'Erreur');
                  }
                } catch (err) {
                  console.error('Enable all maps error:', err);
                  setError('Erreur lors de l\'activation');
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:opacity-90 transition-all"
            >
              <CheckCircle className="w-5 h-5" />
              Tout Activer
            </button>
            <button
              onClick={() => openCreateModal('map')}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:opacity-90 transition-all"
            >
              <Plus className="w-5 h-5" />
              Nouvelle Carte
            </button>
          </div>
        </div>
        
        {/* Mode Filter Tabs */}
        <div className="flex gap-2 p-1 bg-dark-800/50 rounded-xl w-fit">
          <button
            onClick={() => setMapModeFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mapModeFilter === 'all' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Toutes ({maps.length})
          </button>
          <button
            onClick={() => setMapModeFilter('hardcore')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mapModeFilter === 'hardcore' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Hardcore ({maps.filter(m => m.mode === 'hardcore' || m.mode === 'both').length})
          </button>
          <button
            onClick={() => setMapModeFilter('cdl')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mapModeFilter === 'cdl' ? 'bg-cyan-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            CDL ({maps.filter(m => m.mode === 'cdl' || m.mode === 'both').length})
          </button>
          <button
            onClick={() => setMapModeFilter('stricker')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mapModeFilter === 'stricker' ? 'bg-lime-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Stricker ({maps.filter(m => m.strickerConfig?.ranked?.enabled || m.strickerConfig?.ladder?.enabled).length})
          </button>
        </div>

        {/* Maps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMaps.length === 0 ? (
            <div className="col-span-full text-center text-gray-400 py-8">
              Aucune carte trouvée
                  </div>
          ) : (
            filteredMaps.map((map) => (
              <div
                key={map._id}
                className="bg-dark-800/50 border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all"
              >
                {map.image && (
                  <div className="h-32 bg-dark-900 flex items-center justify-center overflow-hidden relative">
                    <img src={map.image} alt={map.name} className="w-full h-full object-cover" />
                    {/* Mode badge overlay */}
                    <div className="absolute top-2 right-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        map.mode === 'hardcore' ? 'bg-orange-500 text-white' :
                        map.mode === 'cdl' ? 'bg-cyan-500 text-white' :
                        'bg-purple-500 text-white'
                      }`}>
                        {map.mode === 'both' ? 'HC/CDL' : map.mode?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-bold">{map.name}</h3>
                    {!map.image && (
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        map.mode === 'hardcore' ? 'bg-orange-500 text-white' :
                        map.mode === 'cdl' ? 'bg-cyan-500 text-white' :
                        'bg-purple-500 text-white'
                      }`}>
                        {map.mode === 'both' ? 'HC/CDL' : map.mode?.toUpperCase() || 'BOTH'}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 mb-3">
                    {/* Hardcore Config */}
                    {(map.hardcoreConfig?.ladder?.enabled || map.hardcoreConfig?.ranked?.enabled) && (
                      <div className="flex flex-col gap-1">
                        <span className="text-orange-400 text-xs font-medium">Hardcore</span>
                        <div className="flex flex-wrap gap-1">
                          {map.hardcoreConfig?.ladder?.enabled && map.hardcoreConfig?.ladder?.gameModes?.length > 0 && (
                            <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs">
                              Ladder: {map.hardcoreConfig.ladder.gameModes.length} mode(s)
                            </span>
                          )}
                          {map.hardcoreConfig?.ranked?.enabled && map.hardcoreConfig?.ranked?.gameModes?.length > 0 && (
                            <span className="px-2 py-0.5 bg-orange-500/30 text-orange-300 rounded text-xs">
                              Ranked: {map.hardcoreConfig.ranked.gameModes.length} mode(s) • {(map.hardcoreConfig.ranked.formats || []).join('/')}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {/* CDL Config */}
                    {(map.cdlConfig?.ladder?.enabled || map.cdlConfig?.ranked?.enabled) && (
                      <div className="flex flex-col gap-1">
                        <span className="text-cyan-400 text-xs font-medium">CDL</span>
                        <div className="flex flex-wrap gap-1">
                          {map.cdlConfig?.ladder?.enabled && map.cdlConfig?.ladder?.gameModes?.length > 0 && (
                            <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-xs">
                              Ladder: {map.cdlConfig.ladder.gameModes.length} mode(s)
                            </span>
                          )}
                          {map.cdlConfig?.ranked?.enabled && map.cdlConfig?.ranked?.gameModes?.length > 0 && (
                            <span className="px-2 py-0.5 bg-cyan-500/30 text-cyan-300 rounded text-xs">
                              Ranked: {map.cdlConfig.ranked.gameModes.length} mode(s) • {(map.cdlConfig.ranked.formats || []).join('/')}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Stricker Config */}
                    {(map.strickerConfig?.ladder?.enabled || map.strickerConfig?.ranked?.enabled) && (
                      <div className="flex flex-col gap-1">
                        <span className="text-lime-400 text-xs font-medium">STRICKER</span>
                        <div className="flex flex-wrap gap-1">
                          {map.strickerConfig?.ladder?.enabled && map.strickerConfig?.ladder?.gameModes?.length > 0 && (
                            <span className="px-2 py-0.5 bg-lime-500/20 text-lime-400 rounded text-xs">
                              Ladder: {map.strickerConfig.ladder.gameModes.length} mode(s)
                            </span>
                          )}
                          {map.strickerConfig?.ranked?.enabled && map.strickerConfig?.ranked?.gameModes?.length > 0 && (
                            <span className="px-2 py-0.5 bg-lime-500/30 text-lime-300 rounded text-xs">
                              Ranked: {map.strickerConfig.ranked.gameModes.length} mode(s) • {(map.strickerConfig.ranked.formats || []).join('/')}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Legacy display for maps not yet migrated */}
                    {!map.hardcoreConfig?.ladder?.enabled && !map.hardcoreConfig?.ranked?.enabled && 
                     !map.cdlConfig?.ladder?.enabled && !map.cdlConfig?.ranked?.enabled && (
                      <>
                        {map.ladders?.length > 0 && (
                          <div className="flex flex-col gap-1">
                            <span className="text-gray-400 text-xs">Ladders (ancien format)</span>
                            <div className="flex flex-wrap gap-1">
                              {map.ladders.map((ladder, idx) => {
                                const ladderLabels = {
                                  'duo-trio': 'Duo/Trio',
                                  'squad-team': 'Squad/Team',
                                  'ranked': 'Classé'
                                };
                                return (
                                  <span key={idx} className="px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded text-xs">
                                    {ladderLabels[ladder] || ladder}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {map.gameModes?.length > 0 && (
                          <div className="flex flex-col gap-1">
                            <span className="text-gray-400 text-xs">Modes de jeu (ancien format)</span>
                            <div className="flex flex-wrap gap-1">
                              {map.gameModes.map((mode, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded text-xs">
                                  {mode}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                      <button
                      onClick={() => openEditModal('map', map)}
                      className="flex-1 py-2 px-3 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-sm font-medium"
                    >
                      Modifier
                      </button>
                    <button
                      onClick={() => setDeleteConfirm({ type: 'map', id: map._id })}
                      className="py-2 px-3 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                </div>
            ))
          )}
                    </div>
                  </div>
    );
  };

  const renderConfig = () => {
    if (!config || !editedConfig) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                  </div>
      );
    }

    const handleSaveConfig = async () => {
      try {
        setSaving(true);
        const response = await fetch(`${API_URL}/config/admin`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(editedConfig)
        });

        const data = await response.json();

        if (data.success) {
          setSuccess('Configuration sauvegardée avec succès');
          setConfig(data.config);
          setEditedConfig(data.config);
        } else {
          setError(data.message || 'Erreur lors de la sauvegarde');
        }
      } catch (err) {
        console.error('Save config error:', err);
        setError('Erreur lors de la sauvegarde');
      } finally {
        setSaving(false);
      }
    };

    const handleResetRankings = async (mode) => {
      if (!window.confirm(`Voulez-vous vraiment réinitialiser tous les classements ${mode} ? Cette action est irréversible!`)) {
        return;
      }

      try {
        setSaving(true);
        const response = await fetch(`${API_URL}/rankings/admin/reset/${mode}`, {
          method: 'POST',
          credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
          setSuccess(`Classements ${mode} réinitialisés avec succès`);
        } else {
          setError(data.message || 'Erreur lors de la réinitialisation');
        }
      } catch (err) {
        console.error('Reset rankings error:', err);
        setError('Erreur lors de la réinitialisation');
      } finally {
        setSaving(false);
      }
    };

    const handleLadderSeasonReset = async () => {
      if (!window.confirm(`Voulez-vous vraiment réinitialiser les saisons de TOUS les ladders (Chill et Compétitif) ?

- Les 3 premières équipes recevront des points (150, 100, 75) dans le Top 10 Escouade
- Un trophée unique de saison sera généré et attribué
- Tous les stats de ladder seront remis à zéro

Cette action est irréversible!`)) {
        return;
      }

      try {
        setSaving(true);
        const response = await fetch(`${API_URL}/seasons/admin/ladder/reset-all`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
          let message = `Saisons de ladder réinitialisées avec succès!\n\n`;
          
          if (data.duoTrio?.winners?.length > 0) {
            message += `Chill - ${data.duoTrio.seasonName}:\n`;
            data.duoTrio.winners.forEach(w => {
              message += `  ${w.rank}. ${w.squadName} (+${w.points} pts, ${w.trophy})\n`;
            });
          }
          
          if (data.squadTeam?.winners?.length > 0) {
            message += `\nCompétitif - ${data.squadTeam.seasonName}:\n`;
            data.squadTeam.winners.forEach(w => {
              message += `  ${w.rank}. ${w.squadName} (+${w.points} pts, ${w.trophy})\n`;
            });
          }
          
          setSuccess(message);
        } else {
          setError(data.message || 'Erreur lors de la réinitialisation des saisons ladder');
        }
      } catch (err) {
        console.error('Ladder season reset error:', err);
        setError('Erreur lors de la réinitialisation des saisons ladder');
      } finally {
        setSaving(false);
      }
    };

    const handleSingleLadderSeasonReset = async (ladderId) => {
      const ladderName = ladderId === 'duo-trio' ? 'Chill' : 'Compétitif';
      
      if (!window.confirm(`Voulez-vous vraiment réinitialiser la saison du ladder ${ladderName} ?

- Les 3 premières équipes recevront des points dans le Top 10 Escouade
- Un trophée unique de saison sera généré et attribué
- Tous les stats de ce ladder seront remis à zéro

Cette action est irréversible!`)) {
        return;
      }

      try {
        setSaving(true);
        const response = await fetch(`${API_URL}/seasons/admin/ladder/${ladderId}/reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
          let message = `Saison ${ladderName} réinitialisée!\n\n`;
          
          if (data.result?.winners?.length > 0) {
            message += `Gagnants - ${data.result.seasonName}:\n`;
            data.result.winners.forEach(w => {
              message += `  ${w.rank}. ${w.squadName} (+${w.points} pts, ${w.trophy})\n`;
            });
            message += `\n${data.result.totalSquadsReset} équipes ont été réinitialisées.`;
          } else {
            message += `Aucune équipe dans le top 3 pour cette saison.`;
          }
          
          setSuccess(message);
        } else {
          setError(data.message || `Erreur lors de la réinitialisation du ladder ${ladderName}`);
        }
      } catch (err) {
        console.error('Single ladder season reset error:', err);
        setError(`Erreur lors de la réinitialisation du ladder ${ladderName}`);
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white">Configuration Globale</h2>

        {/* Événements Temporaires */}
        <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Événements Temporaires (Mode Classé)
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            Programmez ou activez des événements spéciaux pour booster les récompenses en mode classé.
          </p>
          
          {/* Double XP Event - Full width with scheduling */}
          <div className={`p-4 rounded-xl border transition-all mb-4 ${
            events.doubleXP?.active
              ? 'bg-purple-500/20 border-purple-500/50 shadow-lg shadow-purple-500/20'
              : events.doubleXP?.enabled
                ? 'bg-purple-500/10 border-purple-500/30'
                : 'bg-dark-800/50 border-white/10'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  events.doubleXP?.active ? 'bg-purple-500/30' : 'bg-dark-700'
                }`}>
                  <TrendingUp className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-white font-bold flex items-center gap-2">
                    Double Points
                    {events.doubleXP?.active && (
                      <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">ACTIF</span>
                    )}
                    {events.doubleXP?.enabled && !events.doubleXP?.active && (
                      <span className="px-2 py-0.5 bg-yellow-500 text-black text-xs rounded-full">PROGRAMMÉ</span>
                    )}
                  </h4>
                  <p className="text-gray-400 text-xs">Points doublés en victoire en mode classé</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowScheduleEventModal(true)}
                  disabled={loadingEvents}
                  className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-sm rounded-lg transition-colors flex items-center gap-1"
                >
                  <Calendar className="w-4 h-4" />
                  Programmer
                </button>
                <button
                  onClick={handleToggleDoubleXP}
                  disabled={loadingEvents}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    events.doubleXP?.enabled ? 'bg-purple-500' : 'bg-dark-700'
                  }`}
                >
                  <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                    events.doubleXP?.enabled ? 'translate-x-7' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
            {events.doubleXP?.enabled && (
              <div className="flex flex-wrap gap-4 text-sm">
                {events.doubleXP?.startsAt && (
                  <div className="flex items-center gap-2 text-purple-400">
                    <Calendar className="w-4 h-4" />
                    <span>Début: {new Date(events.doubleXP.startsAt).toLocaleString('fr-FR')}</span>
                  </div>
                )}
                {events.doubleXP?.expiresAt && (
                  <div className="flex items-center gap-2 text-purple-400">
                    <Clock className="w-4 h-4" />
                    <span>Fin: {new Date(events.doubleXP.expiresAt).toLocaleString('fr-FR')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Double Gold Event */}
          <div className={`p-4 rounded-xl border transition-all ${
            events.doubleGold?.active
              ? 'bg-yellow-500/20 border-yellow-500/50 shadow-lg shadow-yellow-500/20'
              : 'bg-dark-800/50 border-white/10'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  events.doubleGold?.active ? 'bg-yellow-500/30' : 'bg-dark-700'
                }`}>
                  <Coins className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <h4 className="text-white font-bold">Double Gold</h4>
                  <p className="text-gray-400 text-xs">Gold doublé (victoire + défaite)</p>
                </div>
              </div>
              <button
                onClick={handleToggleDoubleGold}
                disabled={loadingEvents}
                className={`relative w-14 h-7 rounded-full transition-colors ${
                  events.doubleGold?.active ? 'bg-yellow-500' : 'bg-dark-700'
                }`}
              >
                <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  events.doubleGold?.active ? 'translate-x-7' : 'translate-x-1'
                }`} />
              </button>
            </div>
            {events.doubleGold?.active && events.doubleGold?.expiresAt && (
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <Clock className="w-4 h-4" />
                <span>{formatEventTimeRemaining(events.doubleGold.expiresAt)}</span>
              </div>
            )}
          </div>
          
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-yellow-400 text-sm">
              💡 <strong>Double Points</strong> : Double les points classés gagnés en victoire.<br />
              💰 <strong>Double Gold</strong> : Double le gold gagné (victoire ET consolation défaite).
            </p>
          </div>
        </div>
        
        {/* Schedule Event Modal */}
        {showScheduleEventModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-dark-900 border border-purple-500/30 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-400" />
                Programmer Double Points
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Date et heure de début</label>
                  <input
                    type="datetime-local"
                    value={scheduleEventData.startsAt}
                    onChange={(e) => setScheduleEventData(prev => ({ ...prev, startsAt: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Date et heure de fin</label>
                  <input
                    type="datetime-local"
                    value={scheduleEventData.expiresAt}
                    onChange={(e) => setScheduleEventData(prev => ({ ...prev, expiresAt: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowScheduleEventModal(false);
                    setScheduleEventData({ startsAt: '', expiresAt: '' });
                  }}
                  className="flex-1 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleScheduleDoubleXP}
                  disabled={loadingEvents || !scheduleEventData.startsAt || !scheduleEventData.expiresAt}
                  className="flex-1 py-3 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  {loadingEvents ? 'Programmation...' : 'Programmer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Rankings */}
        <div className="bg-dark-800/50 border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Réinitialisation des Classements
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            Réinitialisez manuellement les classements (normalement fait automatiquement le 1er de chaque mois)
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => handleResetRankings('hardcore')}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-5 h-5" />
              Reset Hardcore
            </button>
            <button
              onClick={() => handleResetRankings('cdl')}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-5 h-5" />
              Reset CDL
            </button>
          </div>
          
          {/* RAZ TOTAL CLASSÉ */}
          <div className="mt-6 pt-6 border-t border-red-500/20">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
              <p className="text-red-400 text-sm flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <strong>⚠️ RAZ TOTAL CLASSÉ</strong> - Remet à zéro TOUS les points, victoires et défaites pour Hardcore ET CDL. Action irréversible!
              </p>
            </div>
            <button
              onClick={handleResetAllRanked}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> En cours...</>
              ) : (
                <><RotateCcw className="w-5 h-5" /> RAZ TOTAL CLASSÉ</>
              )}
            </button>
          </div>
                </div>

        {/* Ladder Season Reset */}
        <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/30 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-purple-400" />
            Reset Saison Ladder
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            Réinitialise les deux ladders (Chill et Compétitif). Cette action:
          </p>
          <ul className="text-gray-400 text-sm mb-4 list-disc list-inside space-y-1">
            <li>Attribue les points aux 3 premières équipes (150, 100, 75 pts dans le Top 10 Escouade)</li>
            <li>Génère et attribue un trophée unique de saison aux 3 premières équipes</li>
            <li>Remet à zéro les stats des deux ladders (points, victoires, défaites)</li>
            <li>Enregistre l'historique pour affichage sur la page des classements</li>
          </ul>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleLadderSeasonReset}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
              Reset Toutes les Saisons Ladder
            </button>
            <button
              onClick={() => handleSingleLadderSeasonReset('duo-trio')}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Users className="w-5 h-5" />
              )}
              Reset Chill
            </button>
            <button
              onClick={() => handleSingleLadderSeasonReset('squad-team')}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Shield className="w-5 h-5" />
              )}
              Reset Compétitif
            </button>
          </div>
        </div>

        {/* Squad Match Rewards - Chill */}
        <div className="bg-dark-800/50 border border-blue-500/20 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" />
            🎮 Récompenses Ladder Chill
          </h3>
          
          {/* Section: Points Escouade dans le Ladder */}
          <div className="mb-6">
            <h4 className="text-md font-semibold text-purple-400 mb-3 border-b border-purple-500/30 pb-2">📊 Points Escouade (Ladder Spécifique)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-green-400 mb-2">Points Ladder (Victoire)</label>
                <input
                  type="number"
                  value={editedConfig.squadMatchRewardsChill?.ladderPointsWin || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewardsChill: {
                      ...editedConfig.squadMatchRewardsChill,
                      ladderPointsWin: parseInt(e.target.value) || 0
                    }
                  })}
                  className="w-full px-4 py-2 bg-dark-900 border border-green-500/30 rounded-lg text-green-400 focus:border-green-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-red-400 mb-2">Points Ladder (Défaite)</label>
                <input
                  type="number"
                  value={editedConfig.squadMatchRewardsChill?.ladderPointsLoss || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewardsChill: {
                      ...editedConfig.squadMatchRewardsChill,
                      ladderPointsLoss: parseInt(e.target.value) || 0
                    }
                  })}
                  className="w-full px-4 py-2 bg-dark-900 border border-red-500/30 rounded-lg text-red-400 focus:border-red-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section: Top Escouade Général */}
          <div className="mb-6">
            <h4 className="text-md font-semibold text-cyan-400 mb-3 border-b border-cyan-500/30 pb-2">🏆 Points Top Escouade Général</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-green-400 mb-2">Points Général (Victoire)</label>
                <input
                  type="number"
                  value={editedConfig.squadMatchRewardsChill?.generalSquadPointsWin || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewardsChill: {
                      ...editedConfig.squadMatchRewardsChill,
                      generalSquadPointsWin: parseInt(e.target.value) || 0
                    }
                  })}
                  className="w-full px-4 py-2 bg-dark-900 border border-green-500/30 rounded-lg text-green-400 focus:border-green-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-red-400 mb-2">Points Général (Défaite)</label>
                <input
                  type="number"
                  value={editedConfig.squadMatchRewardsChill?.generalSquadPointsLoss || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewardsChill: {
                      ...editedConfig.squadMatchRewardsChill,
                      generalSquadPointsLoss: parseInt(e.target.value) || 0
                    }
                  })}
                  className="w-full px-4 py-2 bg-dark-900 border border-red-500/30 rounded-lg text-red-400 focus:border-red-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section: Gold */}
          <div className="mb-6">
            <h4 className="text-md font-semibold text-yellow-400 mb-3 border-b border-yellow-500/30 pb-2">💰 Gold (Coins)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-green-400 mb-2">Gold (Victoire)</label>
                <input
                  type="number"
                  value={editedConfig.squadMatchRewardsChill?.playerCoinsWin || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewardsChill: {
                      ...editedConfig.squadMatchRewardsChill,
                      playerCoinsWin: parseInt(e.target.value) || 0
                    }
                  })}
                  className="w-full px-4 py-2 bg-dark-900 border border-yellow-500/30 rounded-lg text-yellow-400 focus:border-yellow-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-orange-400 mb-2">Gold Consolation (Défaite)</label>
                <input
                  type="number"
                  value={editedConfig.squadMatchRewardsChill?.playerCoinsLoss || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewardsChill: {
                      ...editedConfig.squadMatchRewardsChill,
                      playerCoinsLoss: parseInt(e.target.value) || 0
                    }
                  })}
                  className="w-full px-4 py-2 bg-dark-900 border border-orange-500/30 rounded-lg text-orange-400 focus:border-orange-500 focus:outline-none"
                />
                <p className="text-gray-500 text-xs mt-1">Gold donné même en cas de défaite</p>
              </div>
            </div>
          </div>

          {/* Section: XP Joueur */}
          <div>
            <h4 className="text-md font-semibold text-cyan-400 mb-3 border-b border-cyan-500/30 pb-2">⚡ XP Joueur (Victoire uniquement)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-cyan-400 mb-2">XP Minimum</label>
                <input
                  type="number"
                  value={editedConfig.squadMatchRewardsChill?.playerXPWinMin || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewardsChill: {
                      ...editedConfig.squadMatchRewardsChill,
                      playerXPWinMin: parseInt(e.target.value) || 0
                    }
                  })}
                  className="w-full px-4 py-2 bg-dark-900 border border-cyan-500/30 rounded-lg text-cyan-400 focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-cyan-400 mb-2">XP Maximum</label>
                <input
                  type="number"
                  value={editedConfig.squadMatchRewardsChill?.playerXPWinMax || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewardsChill: {
                      ...editedConfig.squadMatchRewardsChill,
                      playerXPWinMax: parseInt(e.target.value) || 0
                    }
                  })}
                  className="w-full px-4 py-2 bg-dark-900 border border-cyan-500/30 rounded-lg text-cyan-400 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
            <p className="text-gray-500 text-xs mt-2">L'XP est attribuée aléatoirement entre le min et max lors d'une victoire. Aucune XP en cas de défaite.</p>
          </div>
        </div>

        {/* Squad Match Rewards - Competitive */}
        <div className="bg-dark-800/50 border border-orange-500/20 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-orange-400" />
            🔥 Récompenses Ladder Compétitif
          </h3>
          
          {/* Section: Points Escouade dans le Ladder */}
          <div className="mb-6">
            <h4 className="text-md font-semibold text-purple-400 mb-3 border-b border-purple-500/30 pb-2">📊 Points Escouade (Ladder Spécifique)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-green-400 mb-2">Points Ladder (Victoire)</label>
                <input
                  type="number"
                  value={editedConfig.squadMatchRewardsCompetitive?.ladderPointsWin || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewardsCompetitive: {
                      ...editedConfig.squadMatchRewardsCompetitive,
                      ladderPointsWin: parseInt(e.target.value) || 0
                    }
                  })}
                  className="w-full px-4 py-2 bg-dark-900 border border-green-500/30 rounded-lg text-green-400 focus:border-green-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-red-400 mb-2">Points Ladder (Défaite)</label>
                <input
                  type="number"
                  value={editedConfig.squadMatchRewardsCompetitive?.ladderPointsLoss || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewardsCompetitive: {
                      ...editedConfig.squadMatchRewardsCompetitive,
                      ladderPointsLoss: parseInt(e.target.value) || 0
                    }
                  })}
                  className="w-full px-4 py-2 bg-dark-900 border border-red-500/30 rounded-lg text-red-400 focus:border-red-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section: Top Escouade Général */}
          <div className="mb-6">
            <h4 className="text-md font-semibold text-cyan-400 mb-3 border-b border-cyan-500/30 pb-2">🏆 Points Top Escouade Général</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-green-400 mb-2">Points Général (Victoire)</label>
                <input
                  type="number"
                  value={editedConfig.squadMatchRewardsCompetitive?.generalSquadPointsWin || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewardsCompetitive: {
                      ...editedConfig.squadMatchRewardsCompetitive,
                      generalSquadPointsWin: parseInt(e.target.value) || 0
                    }
                  })}
                  className="w-full px-4 py-2 bg-dark-900 border border-green-500/30 rounded-lg text-green-400 focus:border-green-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-red-400 mb-2">Points Général (Défaite)</label>
                <input
                  type="number"
                  value={editedConfig.squadMatchRewardsCompetitive?.generalSquadPointsLoss || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewardsCompetitive: {
                      ...editedConfig.squadMatchRewardsCompetitive,
                      generalSquadPointsLoss: parseInt(e.target.value) || 0
                    }
                  })}
                  className="w-full px-4 py-2 bg-dark-900 border border-red-500/30 rounded-lg text-red-400 focus:border-red-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section: Gold */}
          <div className="mb-6">
            <h4 className="text-md font-semibold text-yellow-400 mb-3 border-b border-yellow-500/30 pb-2">💰 Gold (Coins)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-green-400 mb-2">Gold (Victoire)</label>
                <input
                  type="number"
                  value={editedConfig.squadMatchRewardsCompetitive?.playerCoinsWin || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewardsCompetitive: {
                      ...editedConfig.squadMatchRewardsCompetitive,
                      playerCoinsWin: parseInt(e.target.value) || 0
                    }
                  })}
                  className="w-full px-4 py-2 bg-dark-900 border border-yellow-500/30 rounded-lg text-yellow-400 focus:border-yellow-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-orange-400 mb-2">Gold Consolation (Défaite)</label>
                <input
                  type="number"
                  value={editedConfig.squadMatchRewardsCompetitive?.playerCoinsLoss || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewardsCompetitive: {
                      ...editedConfig.squadMatchRewardsCompetitive,
                      playerCoinsLoss: parseInt(e.target.value) || 0
                    }
                  })}
                  className="w-full px-4 py-2 bg-dark-900 border border-orange-500/30 rounded-lg text-orange-400 focus:border-orange-500 focus:outline-none"
                />
                <p className="text-gray-500 text-xs mt-1">Gold donné même en cas de défaite</p>
              </div>
            </div>
          </div>

          {/* Section: XP Joueur */}
          <div>
            <h4 className="text-md font-semibold text-cyan-400 mb-3 border-b border-cyan-500/30 pb-2">⚡ XP Joueur (Victoire uniquement)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-cyan-400 mb-2">XP Minimum</label>
                <input
                  type="number"
                  value={editedConfig.squadMatchRewardsCompetitive?.playerXPWinMin || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewardsCompetitive: {
                      ...editedConfig.squadMatchRewardsCompetitive,
                      playerXPWinMin: parseInt(e.target.value) || 0
                    }
                  })}
                  className="w-full px-4 py-2 bg-dark-900 border border-cyan-500/30 rounded-lg text-cyan-400 focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-cyan-400 mb-2">XP Maximum</label>
                <input
                  type="number"
                  value={editedConfig.squadMatchRewardsCompetitive?.playerXPWinMax || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewardsCompetitive: {
                      ...editedConfig.squadMatchRewardsCompetitive,
                      playerXPWinMax: parseInt(e.target.value) || 0
                    }
                  })}
                  className="w-full px-4 py-2 bg-dark-900 border border-cyan-500/30 rounded-lg text-cyan-400 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
            <p className="text-gray-500 text-xs mt-2">L'XP est attribuée aléatoirement entre le min et max lors d'une victoire. Aucune XP en cas de défaite.</p>
          </div>
        </div>

        {/* Mode Stricker Toggle */}
        <div className="bg-gradient-to-br from-lime-500/10 to-green-500/10 border border-lime-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-lime-500/20 rounded-lg">
                <Target className="w-6 h-6 text-lime-400" />
              </div>
              <div>
                <h3 className="text-white font-bold">Mode Stricker</h3>
                <p className="text-gray-400 text-sm">Activer le mode Stricker pour tous les joueurs</p>
              </div>
            </div>
            <button
              onClick={async () => {
                try {
                  const response = await fetch(`${API_URL}/app-settings/admin/feature/strickerMode`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ enabled: !appSettings?.features?.strickerMode?.enabled })
                  });
                  const data = await response.json();
                  if (data.success) {
                    setSuccess(`Mode Stricker ${!appSettings?.features?.strickerMode?.enabled ? 'activé' : 'désactivé'}`);
                    fetchAppSettings();
                  }
                } catch (err) {
                  setError('Erreur');
                }
              }}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                appSettings?.features?.strickerMode?.enabled ? 'bg-lime-500' : 'bg-dark-700'
              }`}
            >
              <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                appSettings?.features?.strickerMode?.enabled ? 'translate-x-6' : ''
              }`} />
            </button>
          </div>
          <div className={`p-4 rounded-lg ${
            appSettings?.features?.strickerMode?.enabled 
              ? 'bg-lime-500/10 border border-lime-500/30' 
              : 'bg-dark-800/50 border border-white/10'
          }`}>
            <p className={`text-sm flex items-center gap-2 ${
              appSettings?.features?.strickerMode?.enabled ? 'text-lime-400' : 'text-gray-500'
            }`}>
              {appSettings?.features?.strickerMode?.enabled ? (
                <>
                  <Check className="w-4 h-4" />
                  Le mode Stricker est visible dans le menu, sur l'accueil et dans le footer pour tous les joueurs
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Le mode Stricker est masqué (réservé aux admin/staff/arbitre)
                </>
              )}
            </p>
          </div>
        </div>

        {/* BO1/BO3 Format Toggle */}
        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-purple-400" />
            📅 Saison Actuelle (Mode Classé)
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            Définir la saison en cours pour l'affichage des trophées de fin de saison.
          </p>
          
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <label className="text-white/80 text-xs block mb-2">Numéro de saison</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    const current = appSettings?.rankedSettings?.currentSeason || 1;
                    if (current <= 1) return;
                    try {
                      const response = await fetch(`${API_URL}/app-settings/admin`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                          rankedSettings: {
                            ...appSettings?.rankedSettings,
                            currentSeason: current - 1
                          }
                        })
                      });
                      const data = await response.json();
                      if (data.success) {
                        setSuccess('Saison mise à jour');
                        fetchAppSettings();
                      }
                    } catch (err) {
                      setError('Erreur lors de la mise à jour');
                    }
                  }}
                  className="p-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-white border border-white/10 transition-colors"
                  disabled={(appSettings?.rankedSettings?.currentSeason || 1) <= 1}
                >
                  -
                </button>
                <div className="flex-1 text-center">
                  <span className="text-3xl font-black text-purple-400">
                    {appSettings?.rankedSettings?.currentSeason || 1}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    const current = appSettings?.rankedSettings?.currentSeason || 1;
                    try {
                      const response = await fetch(`${API_URL}/app-settings/admin`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                          rankedSettings: {
                            ...appSettings?.rankedSettings,
                            currentSeason: current + 1
                          }
                        })
                      });
                      const data = await response.json();
                      if (data.success) {
                        setSuccess('Saison mise à jour');
                        fetchAppSettings();
                      }
                    } catch (err) {
                      setError('Erreur lors de la mise à jour');
                    }
                  }}
                  className="p-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-white border border-white/10 transition-colors"
                >
                  +
                </button>
              </div>
            </div>
            
            <div className="flex-1 bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
              <p className="text-purple-400 text-sm">
                <strong>Saison actuelle:</strong> Saison {appSettings?.rankedSettings?.currentSeason || 1}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                Les trophées affichés seront: "Champion Saison {appSettings?.rankedSettings?.currentSeason || 1}", etc.
              </p>
            </div>
          </div>
        </div>

        {/* BO1/BO3 Format Toggle */}
        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Swords className="w-5 h-5 text-purple-400" />
            🗺️ Format de Match (Mode Classé)
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            Définir le nombre de maps générées pour la feuille de match en mode classé.
          </p>
          
          <div className="flex gap-4">
            <button
              onClick={async () => {
                try {
                  const response = await fetch(`${API_URL}/app-settings/admin`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      rankedSettings: {
                        ...appSettings?.rankedSettings,
                        bestOf: 1
                      }
                    })
                  });
                  const data = await response.json();
                  if (data.success) {
                    setSuccess('Format mis à jour: BO1 (1 map)');
                    fetchAppSettings();
                  }
                } catch (err) {
                  setError('Erreur lors de la mise à jour');
                }
              }}
              className={`flex-1 py-4 px-6 rounded-xl font-bold text-lg transition-all ${
                appSettings?.rankedSettings?.bestOf === 1 
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' 
                  : 'bg-dark-800 text-gray-400 hover:bg-dark-700 border border-white/10'
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <span className="text-2xl">🗺️</span>
                <span>BO1</span>
                <span className="text-xs font-normal opacity-70">1 map</span>
              </div>
            </button>
            
            <button
              onClick={async () => {
                try {
                  const response = await fetch(`${API_URL}/app-settings/admin`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      rankedSettings: {
                        ...appSettings?.rankedSettings,
                        bestOf: 3
                      }
                    })
                  });
                  const data = await response.json();
                  if (data.success) {
                    setSuccess('Format mis à jour: BO3 (3 maps)');
                    fetchAppSettings();
                  }
                } catch (err) {
                  setError('Erreur lors de la mise à jour');
                }
              }}
              className={`flex-1 py-4 px-6 rounded-xl font-bold text-lg transition-all ${
                appSettings?.rankedSettings?.bestOf !== 1 
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' 
                  : 'bg-dark-800 text-gray-400 hover:bg-dark-700 border border-white/10'
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <span className="text-2xl">🗺️🗺️🗺️</span>
                <span>BO3</span>
                <span className="text-xs font-normal opacity-70">3 maps</span>
              </div>
            </button>
          </div>
          
          <div className="mt-4 bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
            <p className="text-purple-400 text-sm">
              <strong>Format actuel:</strong> {appSettings?.rankedSettings?.bestOf === 1 ? 'BO1 (1 map par match)' : 'BO3 (3 maps par match)'}
            </p>
          </div>
        </div>

        {/* Rank Points Thresholds */}
        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-purple-400" />
            🏆 Seuils de Points par Rang (Mode Classé)
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            Définir les points minimum et maximum pour chaque rang. Le rang Champion n'a pas de maximum.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { key: 'bronze', label: '🥉 Bronze', color: 'from-amber-700 to-amber-900' },
              { key: 'silver', label: '🥈 Argent', color: 'from-slate-400 to-slate-600' },
              { key: 'gold', label: '🥇 Or', color: 'from-yellow-500 to-amber-600' },
              { key: 'platinum', label: '💎 Platine', color: 'from-teal-400 to-cyan-600' },
              { key: 'diamond', label: '💠 Diamant', color: 'from-cyan-300 to-blue-500' },
              { key: 'master', label: '👑 Maître', color: 'from-purple-500 to-pink-600' },
              { key: 'grandmaster', label: '🔥 Grand Maître', color: 'from-red-500 to-orange-600' },
              { key: 'champion', label: '🏆 Champion', color: 'from-yellow-400 via-orange-500 to-red-600' },
            ].map(({ key, label, color }) => {
              const thresholds = appSettings?.rankedSettings?.rankPointsThresholds || {};
              const rankData = thresholds[key] || { min: 0, max: key === 'champion' ? null : 499 };
              
              return (
                <div key={key} className={`bg-gradient-to-br ${color} rounded-xl p-4`}>
                  <h4 className="text-white font-bold mb-3">{label}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-white/80 text-xs block mb-1">Min</label>
                      <input
                        type="number"
                        value={rankData.min || 0}
                        onChange={async (e) => {
                          const newVal = parseInt(e.target.value) || 0;
                          try {
                            const response = await fetch(`${API_URL}/app-settings/admin`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({
                                rankedSettings: {
                                  ...appSettings?.rankedSettings,
                                  rankPointsThresholds: {
                                    ...thresholds,
                                    [key]: { ...rankData, min: newVal }
                                  }
                                }
                              })
                            });
                            const data = await response.json();
                            if (data.success) {
                              fetchAppSettings();
                            }
                          } catch (err) {
                            setError('Erreur');
                          }
                        }}
                        className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white text-sm font-bold focus:border-white/40 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-white/80 text-xs block mb-1">Max</label>
                      {key === 'champion' ? (
                        <div className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white/60 text-sm text-center">
                          ∞
                        </div>
                      ) : (
                        <input
                          type="number"
                          value={rankData.max || 0}
                          onChange={async (e) => {
                            const newVal = parseInt(e.target.value) || 0;
                            try {
                              const response = await fetch(`${API_URL}/app-settings/admin`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({
                                  rankedSettings: {
                                    ...appSettings?.rankedSettings,
                                    rankPointsThresholds: {
                                      ...thresholds,
                                      [key]: { ...rankData, max: newVal }
                                    }
                                  }
                                })
                              });
                              const data = await response.json();
                              if (data.success) {
                                fetchAppSettings();
                              }
                            } catch (err) {
                              setError('Erreur');
                            }
                          }}
                          className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white text-sm font-bold focus:border-white/40 focus:outline-none"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
            <p className="text-purple-400 text-sm">
              💡 Les joueurs montent ou descendent de rang automatiquement en fonction de leurs points.
            </p>
          </div>
        </div>

        {/* Ranked Match Rewards */}
        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-purple-400" />
            ⚔️ Récompenses Mode Classé (Ranked)
          </h3>
          <p className="text-gray-400 text-sm mb-6">
            Configuration complète des récompenses pour le mode classé. Les joueurs gagnants reçoivent des points, gold et XP. 
            Les perdants perdent des points mais reçoivent du gold de consolation.
          </p>
          
          <div className="space-y-6">
            {editedConfig.rankedMatchRewards && Object.keys(editedConfig.rankedMatchRewards).map((mode) => (
              <div key={mode} className={`rounded-xl p-5 ${mode === 'hardcore' ? 'bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/30' : 'bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30'}`}>
                <h4 className="text-white font-bold mb-5 text-lg capitalize flex items-center gap-2">
                  {mode === 'hardcore' ? '🔥 Hardcore' : '🎯 CDL'}
                </h4>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {Object.keys(editedConfig.rankedMatchRewards[mode]).filter(gm => {
                    // Hardcore: Duel, Team Deathmatch, Search & Destroy
                    // CDL: Hardpoint (Points Stratégiques), Search & Destroy
                    if (mode === 'hardcore') {
                      return ['Duel', 'Team Deathmatch', 'Search & Destroy'].includes(gm);
                    } else {
                      return ['Hardpoint', 'Search & Destroy'].includes(gm);
                    }
                  }).map((gameMode) => (
                    <div key={gameMode} className="bg-dark-800/80 backdrop-blur-sm rounded-xl p-5 border border-white/10 hover:border-white/20 transition-all">
                      <p className="text-white font-semibold mb-4 text-base border-b border-white/20 pb-3 flex items-center gap-2">
                        <span className="text-lg">🎮</span>
                        {gameMode}
                      </p>
                      
                      {/* Points Ladder Classé */}
                      <div className="mb-4 pb-4 border-b border-white/10">
                        <p className="text-purple-400 text-xs font-semibold mb-3 uppercase tracking-wider">📊 Points Ladder Classé</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-green-400 text-xs block mb-1.5 font-medium">✅ Victoire</label>
                            <input
                              type="number"
                              value={editedConfig.rankedMatchRewards[mode][gameMode].pointsWin || 0}
                              onChange={(e) => {
                                const newConfig = { ...editedConfig };
                                newConfig.rankedMatchRewards[mode][gameMode].pointsWin = parseInt(e.target.value) || 0;
                                setEditedConfig(newConfig);
                              }}
                              className="w-full px-3 py-2 bg-dark-900 border border-green-500/40 rounded-lg text-green-400 text-sm font-semibold focus:border-green-500 focus:outline-none"
                            />
                          </div>
                          
                          <div>
                            <label className="text-red-400 text-xs block mb-1.5 font-medium">❌ Défaite</label>
                            <input
                              type="number"
                              value={editedConfig.rankedMatchRewards[mode][gameMode].pointsLoss || 0}
                              onChange={(e) => {
                                const newConfig = { ...editedConfig };
                                newConfig.rankedMatchRewards[mode][gameMode].pointsLoss = parseInt(e.target.value) || 0;
                                setEditedConfig(newConfig);
                              }}
                              className="w-full px-3 py-2 bg-dark-900 border border-red-500/40 rounded-lg text-red-400 text-sm font-semibold focus:border-red-500 focus:outline-none"
                            />
                          </div>
                        </div>
                        <p className="text-gray-500 text-xs mt-2 italic">Points pour le classement du mode classé (rangs Bronze, Silver, Gold...)</p>
                      </div>
                      
                      {/* Gold */}
                      <div className="mb-4 pb-4 border-b border-white/10">
                        <p className="text-yellow-400 text-xs font-semibold mb-3 uppercase tracking-wider">💰 Gold (Coins)</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-green-400 text-xs block mb-1.5 font-medium">✅ Victoire</label>
                            <input
                              type="number"
                              value={editedConfig.rankedMatchRewards[mode][gameMode].coinsWin || 0}
                              onChange={(e) => {
                                const newConfig = { ...editedConfig };
                                newConfig.rankedMatchRewards[mode][gameMode].coinsWin = parseInt(e.target.value) || 0;
                                setEditedConfig(newConfig);
                              }}
                              className="w-full px-3 py-2 bg-dark-900 border border-yellow-500/40 rounded-lg text-yellow-400 text-sm font-semibold focus:border-yellow-500 focus:outline-none"
                            />
                          </div>
                          
                          <div>
                            <label className="text-orange-400 text-xs block mb-1.5 font-medium">🎁 Consolation</label>
                            <input
                              type="number"
                              value={editedConfig.rankedMatchRewards[mode][gameMode].coinsLoss || 0}
                              onChange={(e) => {
                                const newConfig = { ...editedConfig };
                                if (!editedConfig.rankedMatchRewards[mode][gameMode].coinsLoss && editedConfig.rankedMatchRewards[mode][gameMode].coinsLoss !== 0) {
                                  newConfig.rankedMatchRewards[mode][gameMode].coinsLoss = 0;
                                }
                                newConfig.rankedMatchRewards[mode][gameMode].coinsLoss = parseInt(e.target.value) || 0;
                                setEditedConfig(newConfig);
                              }}
                              className="w-full px-3 py-2 bg-dark-900 border border-orange-500/40 rounded-lg text-orange-400 text-sm font-semibold focus:border-orange-500 focus:outline-none"
                            />
                          </div>
                        </div>
                        <p className="text-gray-500 text-xs mt-2 italic">Gold gagné par les vainqueurs et consolation pour les perdants</p>
                      </div>
                      
                      {/* XP Top Player */}
                      <div>
                        <p className="text-cyan-400 text-xs font-semibold mb-3 uppercase tracking-wider">⚡ XP Top Player (Victoire uniquement)</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-cyan-400 text-xs block mb-1.5 font-medium">Min</label>
                            <input
                              type="number"
                              value={editedConfig.rankedMatchRewards[mode][gameMode].xpWinMin || 0}
                              onChange={(e) => {
                                const newConfig = { ...editedConfig };
                                if (!editedConfig.rankedMatchRewards[mode][gameMode].xpWinMin && editedConfig.rankedMatchRewards[mode][gameMode].xpWinMin !== 0) {
                                  newConfig.rankedMatchRewards[mode][gameMode].xpWinMin = 0;
                                }
                                newConfig.rankedMatchRewards[mode][gameMode].xpWinMin = parseInt(e.target.value) || 0;
                                setEditedConfig(newConfig);
                              }}
                              className="w-full px-3 py-2 bg-dark-900 border border-cyan-500/40 rounded-lg text-cyan-400 text-sm font-semibold focus:border-cyan-500 focus:outline-none"
                            />
                          </div>
                          
                          <div>
                            <label className="text-cyan-400 text-xs block mb-1.5 font-medium">Max</label>
                            <input
                              type="number"
                              value={editedConfig.rankedMatchRewards[mode][gameMode].xpWinMax || 0}
                              onChange={(e) => {
                                const newConfig = { ...editedConfig };
                                if (!editedConfig.rankedMatchRewards[mode][gameMode].xpWinMax && editedConfig.rankedMatchRewards[mode][gameMode].xpWinMax !== 0) {
                                  newConfig.rankedMatchRewards[mode][gameMode].xpWinMax = 0;
                                }
                                newConfig.rankedMatchRewards[mode][gameMode].xpWinMax = parseInt(e.target.value) || 0;
                                setEditedConfig(newConfig);
                              }}
                              className="w-full px-3 py-2 bg-dark-900 border border-cyan-500/40 rounded-lg text-cyan-400 text-sm font-semibold focus:border-cyan-500 focus:outline-none"
                            />
                          </div>
                        </div>
                        <p className="text-gray-500 text-xs mt-2 italic">XP aléatoire entre min et max pour le classement Top Player (affiché sur l'accueil)</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
            <p className="text-purple-400 font-medium text-sm mb-2">💡 Information</p>
            <ul className="text-gray-400 text-sm space-y-1 list-disc list-inside">
              <li><strong className="text-white">Points Ladder Classé</strong> : Utilisés pour le classement avec rangs (Bronze, Silver, Gold, etc.)</li>
              <li><strong className="text-white">XP Top Player</strong> : Utilisés pour le classement général des joueurs affiché sur la page d'accueil</li>
              <li><strong className="text-white">Gold</strong> : Monnaie du jeu donnée aux gagnants et perdants (consolation)</li>
              <li><strong className="text-white">Perdants</strong> : Reçoivent uniquement le gold de consolation (pas d'XP)</li>
            </ul>
          </div>
        </div>
        
        {/* Stricker Mode Rewards */}
        <div className="bg-gradient-to-br from-lime-500/10 to-green-500/10 border border-lime-500/30 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Swords className="w-5 h-5 text-lime-400" />
            🔫 Récompenses Mode Stricker (5v5 Search & Destroy)
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            Configuration des récompenses pour le mode Stricker. Accès réservé aux administrateurs, staff et arbitres.
          </p>
                  
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Points */}
            <div>
              <p className="text-lime-400 text-xs font-semibold mb-3 uppercase tracking-wider">🎯 Points Ladder</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-green-400 text-xs block mb-1.5 font-medium">Victoire</label>
                  <input
                    type="number"
                    value={editedConfig?.strickerMatchRewards?.['Search & Destroy']?.pointsWin || 35}
                    onChange={(e) => {
                      const newConfig = { ...editedConfig };
                      if (!newConfig.strickerMatchRewards) newConfig.strickerMatchRewards = {};
                      if (!newConfig.strickerMatchRewards['Search & Destroy']) {
                        newConfig.strickerMatchRewards['Search & Destroy'] = { pointsWin: 35, pointsLoss: -18, coinsWin: 80, coinsLoss: 25, xpWinMin: 700, xpWinMax: 800 };
                      }
                      newConfig.strickerMatchRewards['Search & Destroy'].pointsWin = parseInt(e.target.value) || 0;
                      setEditedConfig(newConfig);
                    }}
                    className="w-full px-3 py-2 bg-dark-900 border border-green-500/40 rounded-lg text-green-400 text-sm font-semibold focus:border-green-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-red-400 text-xs block mb-1.5 font-medium">Défaite</label>
                  <input
                    type="number"
                    value={editedConfig?.strickerMatchRewards?.['Search & Destroy']?.pointsLoss || -18}
                    onChange={(e) => {
                      const newConfig = { ...editedConfig };
                      if (!newConfig.strickerMatchRewards) newConfig.strickerMatchRewards = {};
                      if (!newConfig.strickerMatchRewards['Search & Destroy']) {
                        newConfig.strickerMatchRewards['Search & Destroy'] = { pointsWin: 35, pointsLoss: -18, coinsWin: 80, coinsLoss: 25, xpWinMin: 700, xpWinMax: 800 };
                      }
                      newConfig.strickerMatchRewards['Search & Destroy'].pointsLoss = parseInt(e.target.value) || 0;
                      setEditedConfig(newConfig);
                    }}
                    className="w-full px-3 py-2 bg-dark-900 border border-red-500/40 rounded-lg text-red-400 text-sm font-semibold focus:border-red-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
                    
            {/* Coins */}
            <div>
              <p className="text-lime-400 text-xs font-semibold mb-3 uppercase tracking-wider">💰 Gold</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-green-400 text-xs block mb-1.5 font-medium">Victoire</label>
                  <input
                    type="number"
                    value={editedConfig?.strickerMatchRewards?.['Search & Destroy']?.coinsWin || 80}
                    onChange={(e) => {
                      const newConfig = { ...editedConfig };
                      if (!newConfig.strickerMatchRewards) newConfig.strickerMatchRewards = {};
                      if (!newConfig.strickerMatchRewards['Search & Destroy']) {
                        newConfig.strickerMatchRewards['Search & Destroy'] = { pointsWin: 35, pointsLoss: -18, coinsWin: 80, coinsLoss: 25, xpWinMin: 700, xpWinMax: 800 };
                      }
                      newConfig.strickerMatchRewards['Search & Destroy'].coinsWin = parseInt(e.target.value) || 0;
                      setEditedConfig(newConfig);
                    }}
                    className="w-full px-3 py-2 bg-dark-900 border border-green-500/40 rounded-lg text-green-400 text-sm font-semibold focus:border-green-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-orange-400 text-xs block mb-1.5 font-medium">Consolation</label>
                  <input
                    type="number"
                    value={editedConfig?.strickerMatchRewards?.['Search & Destroy']?.coinsLoss || 25}
                    onChange={(e) => {
                      const newConfig = { ...editedConfig };
                      if (!newConfig.strickerMatchRewards) newConfig.strickerMatchRewards = {};
                      if (!newConfig.strickerMatchRewards['Search & Destroy']) {
                        newConfig.strickerMatchRewards['Search & Destroy'] = { pointsWin: 35, pointsLoss: -18, coinsWin: 80, coinsLoss: 25, xpWinMin: 700, xpWinMax: 800 };
                      }
                      newConfig.strickerMatchRewards['Search & Destroy'].coinsLoss = parseInt(e.target.value) || 0;
                      setEditedConfig(newConfig);
                    }}
                    className="w-full px-3 py-2 bg-dark-900 border border-orange-500/40 rounded-lg text-orange-400 text-sm font-semibold focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
                    
            {/* XP */}
            <div>
              <p className="text-lime-400 text-xs font-semibold mb-3 uppercase tracking-wider">⚡ XP (Victoire)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-cyan-400 text-xs block mb-1.5 font-medium">Min</label>
                  <input
                    type="number"
                    value={editedConfig?.strickerMatchRewards?.['Search & Destroy']?.xpWinMin || 700}
                    onChange={(e) => {
                      const newConfig = { ...editedConfig };
                      if (!newConfig.strickerMatchRewards) newConfig.strickerMatchRewards = {};
                      if (!newConfig.strickerMatchRewards['Search & Destroy']) {
                        newConfig.strickerMatchRewards['Search & Destroy'] = { pointsWin: 35, pointsLoss: -18, coinsWin: 80, coinsLoss: 25, xpWinMin: 700, xpWinMax: 800 };
                      }
                      newConfig.strickerMatchRewards['Search & Destroy'].xpWinMin = parseInt(e.target.value) || 0;
                      setEditedConfig(newConfig);
                    }}
                    className="w-full px-3 py-2 bg-dark-900 border border-cyan-500/40 rounded-lg text-cyan-400 text-sm font-semibold focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-cyan-400 text-xs block mb-1.5 font-medium">Max</label>
                  <input
                    type="number"
                    value={editedConfig?.strickerMatchRewards?.['Search & Destroy']?.xpWinMax || 800}
                    onChange={(e) => {
                      const newConfig = { ...editedConfig };
                      if (!newConfig.strickerMatchRewards) newConfig.strickerMatchRewards = {};
                      if (!newConfig.strickerMatchRewards['Search & Destroy']) {
                        newConfig.strickerMatchRewards['Search & Destroy'] = { pointsWin: 35, pointsLoss: -18, coinsWin: 80, coinsLoss: 25, xpWinMin: 700, xpWinMax: 800 };
                      }
                      newConfig.strickerMatchRewards['Search & Destroy'].xpWinMax = parseInt(e.target.value) || 0;
                      setEditedConfig(newConfig);
                    }}
                    className="w-full px-3 py-2 bg-dark-900 border border-cyan-500/40 rounded-lg text-cyan-400 text-sm font-semibold focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
                    
            {/* Matchmaking Toggle */}
            <div>
              <p className="text-lime-400 text-xs font-semibold mb-3 uppercase tracking-wider">⚙️ Matchmaking</p>
              <div className="flex items-center justify-between p-3 bg-dark-900/50 rounded-lg border border-lime-500/20">
                <span className="text-white text-sm">Activer le matchmaking Stricker</span>
                <button
                  onClick={() => {
                    const newConfig = { ...editedConfig };
                    newConfig.strickerMatchmakingEnabled = !(editedConfig?.strickerMatchmakingEnabled ?? true);
                    setEditedConfig(newConfig);
                  }}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    (editedConfig?.strickerMatchmakingEnabled ?? true) ? 'bg-lime-500' : 'bg-dark-700'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    (editedConfig?.strickerMatchmakingEnabled ?? true) ? 'translate-x-7' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          </div>
                  
          <div className="mt-4 bg-lime-500/10 border border-lime-500/30 rounded-lg p-3">
            <p className="text-lime-400 text-sm">
              💡 Le mode Stricker est réservé aux administrateurs, staff et arbitres. 6 rangs : Recrues, Opérateurs, Vétérans, Commandants, Seigneurs de Guerre, Immortel.
            </p>
          </div>
        </div>
        
        {/* Points Lost Per Rank */}
        <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-400" />
            Points Perdus par Rang (Défaite)
          </h3>
          <p className="text-gray-400 text-sm mb-6">
            Les joueurs perdent des points différents selon leur rang actuel. Plus le rang est élevé, plus ils perdent de points en cas de défaite.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { key: 'bronze', label: 'Bronze', color: 'text-amber-600' },
              { key: 'silver', label: 'Silver', color: 'text-gray-300' },
              { key: 'gold', label: 'Gold', color: 'text-yellow-400' },
              { key: 'platinum', label: 'Platinum', color: 'text-cyan-300' },
              { key: 'diamond', label: 'Diamond', color: 'text-blue-400' },
              { key: 'master', label: 'Master', color: 'text-purple-400' },
              { key: 'grandmaster', label: 'Grandmaster', color: 'text-red-400' },
              { key: 'champion', label: 'Champion', color: 'text-amber-400' }
            ].map(({ key, label, color }) => (
              <div key={key} className="bg-dark-800/80 rounded-lg p-4 border border-white/10">
                <label className={`text-sm font-semibold block mb-2 ${color}`}>{label}</label>
                <input
                  type="number"
                  value={editedConfig.rankedPointsLossPerRank?.[key] ?? -10}
                  onChange={(e) => {
                    const newConfig = { ...editedConfig };
                    if (!newConfig.rankedPointsLossPerRank) {
                      newConfig.rankedPointsLossPerRank = {
                        bronze: -10, silver: -12, gold: -15, platinum: -18,
                        diamond: -20, master: -22, grandmaster: -25, champion: -30
                      };
                    }
                    // Keep default negative value if input is empty or invalid
                    const defaultValues = { bronze: -10, silver: -12, gold: -15, platinum: -18, diamond: -20, master: -22, grandmaster: -25, champion: -30 };
                    const parsed = parseInt(e.target.value);
                    // Use parsed value if it's a valid negative number, otherwise keep the default
                    newConfig.rankedPointsLossPerRank[key] = !isNaN(parsed) && parsed < 0 ? parsed : defaultValues[key];
                    setEditedConfig(newConfig);
                  }}
                  className="w-full px-3 py-2 bg-dark-900 border border-red-500/40 rounded-lg text-red-400 text-sm font-semibold focus:border-red-500 focus:outline-none text-center"
                />
              </div>
            ))}
          </div>
          
          <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-400 text-sm">
              💡 Entrez des valeurs négatives (ex: -10, -15, -20). Ces points sont soustraits du total du joueur en cas de défaite.
            </p>
          </div>
        </div>

        {/* Staff Admin Access Control */}
        <div className="bg-dark-800/50 border border-purple-500/30 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            Accès Staff au Panel Admin
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            Contrôlez les onglets accessibles aux comptes avec le rôle "staff"
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { key: 'overview', label: 'Vue d\'ensemble' },
              { key: 'users', label: 'Utilisateurs' },
              { key: 'squads', label: 'Escouades' },
              { key: 'announcements', label: 'Annonces' },
              { key: 'maps', label: 'Cartes' },
              { key: 'gamerules', label: 'Règles de Jeu' }
            ].map(({ key, label }) => {
              const isEnabled = appSettings?.staffAdminAccess?.[key] !== false;
              return (
                <div key={key} className="flex items-center justify-between bg-dark-900/50 rounded-lg p-3">
                  <span className="text-white text-sm">{label}</span>
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch(`${API_URL}/app-settings/admin`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({
                            staffAdminAccess: {
                              ...appSettings?.staffAdminAccess,
                              [key]: !isEnabled
                            }
                          })
                        });
                        const data = await response.json();
                        if (data.success) {
                          setSuccess(`Accès ${label} ${!isEnabled ? 'activé' : 'désactivé'} pour le staff`);
                          fetchAppSettings();
                        }
                      } catch (err) {
                        setError('Erreur');
                      }
                    }}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      isEnabled ? 'bg-purple-500' : 'bg-dark-700'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      isEnabled ? 'translate-x-5' : ''
                    }`} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Info */}
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-purple-400 mt-0.5" />
                      <div className="flex-1">
              <p className="text-purple-400 font-medium mb-1">Sauvegarde de configuration</p>
              <p className="text-gray-400 text-sm">
                N'oubliez pas de sauvegarder vos modifications après les avoir effectuées.
                        </p>
                      </div>
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50 font-medium"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sauvegarde...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Sauvegarder
                  </>
                )}
              </button>
                  </div>
                </div>

        {/* Reset All Squads Stats */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-red-400" />
            RAZ Stats Escouades
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            Réinitialise les stats de TOUTES les escouades : victoires, défaites et supprime l'historique des matchs escouade.
          </p>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <strong>Attention:</strong> Cette action est irréversible!
            </p>
          </div>
          <button
            onClick={async () => {
              if (!window.confirm('Voulez-vous vraiment réinitialiser TOUTES les stats escouades et supprimer l\'historique des matchs? Cette action est irréversible!')) return;
              try {
                setSaving(true);
                const response = await fetch(`${API_URL}/squads/admin/reset-all-squads-stats`, {
                  method: 'POST',
                  credentials: 'include'
                });
                const data = await response.json();
                if (data.success) {
                  setSuccess(`Stats réinitialisées: ${data.squadsUpdated} escouades, ${data.matchesDeleted} matchs supprimés`);
                } else {
                  setError(data.message || 'Erreur lors de la réinitialisation');
                }
              } catch (err) {
                setError('Erreur lors de la réinitialisation');
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-all disabled:opacity-50"
          >
            {saving ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> En cours...</>
            ) : (
              <><RotateCcw className="w-5 h-5" /> RAZ Toutes les Stats Escouades</>
            )}
          </button>
        </div>
      </div>
    );
  };

  const renderGameRules = () => {
    // Integrated Game Mode Rules Editor
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Règles de Jeu</h2>
        </div>
        
        {/* Integrated Game Mode Rules Editor */}
        <GameModeRulesEditor />
      </div>
    );
  };

  // ==================== MATCHES TAB ====================
  const [adminRankedMatches, setAdminRankedMatches] = useState([]);
  const [strickerMatches, setStrickerMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [rankedMatchToDelete, setRankedMatchToDelete] = useState(null);
  const [strickerMatchToDelete, setStrickerMatchToDelete] = useState(null);

  const fetchStrickerMatches = async () => {
    setMatchesLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (matchesFilter !== 'all') params.append('status', matchesFilter);
      
      const response = await fetch(`${API_URL}/stricker/admin/matches?${params}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setStrickerMatches(data.matches || []);
      }
    } catch (err) {
      console.error('Error fetching stricker matches:', err);
    } finally {
      setMatchesLoading(false);
    }
  };

  const handleDeleteStrickerMatch = async (matchId) => {
    try {
      const response = await fetch(`${API_URL}/stricker/admin/matches/${matchId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(data.message || 'Match Stricker supprimé avec succès');
        setStrickerMatchToDelete(null);
        fetchStrickerMatches();
      } else {
        setError(data.message || 'Erreur lors de la suppression');
      }
    } catch (err) {
      setError('Erreur lors de la suppression');
    }
  };

  const handleUpdateStrickerMatchStatus = async (matchId, status) => {
    try {
      const response = await fetch(`${API_URL}/stricker/admin/matches/${matchId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Statut du match Stricker mis à jour');
        fetchStrickerMatches();
      } else {
        setError(data.message || 'Erreur');
      }
    } catch (err) {
      setError('Erreur lors de la mise à jour');
    }
  };

  // Ranked matches admin functions
  const fetchAdminRankedMatches = async () => {
    setMatchesLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (matchesFilter !== 'all') params.append('status', matchesFilter);
      
      const response = await fetch(`${API_URL}/ranked-matches/admin/all?${params}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setAdminRankedMatches(data.matches || []);
      }
    } catch (err) {
      console.error('Error fetching ranked matches:', err);
    } finally {
      setMatchesLoading(false);
    }
  };

  const handleDeleteRankedMatch = async (matchId) => {
    try {
      const response = await fetch(`${API_URL}/ranked-matches/admin/${matchId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(data.message || 'Match classé supprimé avec succès');
        setRankedMatchToDelete(null);
        fetchAdminRankedMatches();
      } else {
        setError(data.message || 'Erreur lors de la suppression');
      }
    } catch (err) {
      setError('Erreur lors de la suppression');
    }
  };

  const handleUpdateRankedMatchStatus = async (matchId, status) => {
    try {
      const response = await fetch(`${API_URL}/ranked-matches/admin/${matchId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Statut du match classé mis à jour');
        fetchAdminRankedMatches();
      } else {
        setError(data.message || 'Erreur');
      }
    } catch (err) {
      setError('Erreur lors de la mise à jour');
    }
  };

  const handleUpdateRankedMatchSeason = async (matchId, season) => {
    try {
      const response = await fetch(`${API_URL}/ranked-matches/admin/${matchId}/season`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ season: parseInt(season) })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(`Saison du match mise à jour vers ${season}`);
        fetchAdminRankedMatches();
      } else {
        setError(data.message || 'Erreur');
      }
    } catch (err) {
      setError('Erreur lors de la mise à jour de la saison');
    }
  };

  const renderMatches = () => {
    // Helper to get player names for ranked matches
    const getRankedMatchTeamNames = (match) => {
      const team1Players = match.players?.filter(p => p.team === 1) || [];
      const team2Players = match.players?.filter(p => p.team === 2) || [];
      const team1Name = team1Players.map(p => p.user?.username || p.username || '?').join(', ') || 'Équipe 1';
      const team2Name = team2Players.map(p => p.user?.username || p.username || '?').join(', ') || 'Équipe 2';
      return { team1Name, team2Name };
    };

    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
              <Swords className="w-5 sm:w-7 h-5 sm:h-7 text-purple-400" />
              Gestion des Matchs
            </h2>
            <p className="text-gray-400 mt-1 text-xs sm:text-sm">Gérer les matchs classés et Stricker</p>
          </div>
          <button
            onClick={matchesSubTab === 'ranked' ? fetchAdminRankedMatches : fetchStrickerMatches}
            className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        </div>

        {/* Sub Tabs - Ranked vs Stricker */}
        <div className="flex gap-1 sm:gap-2 p-1 bg-dark-800/50 rounded-lg w-full sm:w-fit overflow-x-auto">
          <button
            onClick={() => {
              setMatchesSubTab('ranked');
              setMatchesFilter('all');
            }}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm whitespace-nowrap ${
              matchesSubTab === 'ranked' 
                ? 'bg-cyan-500 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Target className="w-4 h-4" />
            <span className="hidden xs:inline">Matchs</span> Classés
          </button>
          <button
            onClick={() => {
              setMatchesSubTab('stricker');
              setMatchesFilter('all');
            }}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm whitespace-nowrap ${
              matchesSubTab === 'stricker' 
                ? 'bg-lime-500 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Skull className="w-4 h-4" />
            <span className="hidden xs:inline">Matchs</span> Stricker
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 sm:gap-2 flex-wrap">
          {['all', 'pending', 'in_progress', 'completed', 'disputed', 'cancelled'].map((filter) => (
            <button
              key={filter}
              onClick={() => setMatchesFilter(filter)}
              className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm ${
                matchesFilter === filter 
                  ? matchesSubTab === 'ladder' ? 'bg-purple-500 text-white' : 'bg-cyan-500 text-white'
                  : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
              }`}
            >
              {filter === 'all' ? 'Tous' : 
               filter === 'pending' ? 'Attente' : 
               filter === 'in_progress' ? 'En cours' : 
               filter === 'completed' ? 'Terminés' : 
               filter === 'disputed' ? 'Litiges' : 'Annulés'}
            </button>
          ))}
        </div>

        {/* Stricker Matches List */}
        {matchesSubTab === 'stricker' && (
          <>
            {matchesLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-lime-500 animate-spin" />
              </div>
            ) : strickerMatches.length > 0 ? (
              <div className="space-y-3">
                {strickerMatches.map((match) => {
                  const team1Name = match.team1Squad?.name || 'Équipe 1';
                  const team2Name = match.team2Squad?.name || 'Équipe 2';
                  return (
                    <div key={match._id} className="bg-dark-800/50 border border-lime-500/20 rounded-xl p-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-4 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-lime-500/20 text-lime-400">
                            STRICKER
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="text-white font-medium text-sm">{team1Name}</div>
                            <span className="text-gray-500">vs</span>
                            <div className="text-white font-medium text-sm">{team2Name}</div>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            match.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            match.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            match.status === 'ready' ? 'bg-blue-500/20 text-blue-400' :
                            match.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                            match.status === 'disputed' ? 'bg-red-500/20 text-red-400' :
                            match.status === 'cancelled' ? 'bg-gray-500/20 text-gray-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {match.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={`/${match.mode || 'hardcore'}/stricker/match/${match._id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 bg-lime-500/20 text-lime-400 rounded-lg hover:bg-lime-500/30 transition-colors text-sm"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Voir
                          </a>
                          <select
                            value={match.status}
                            onChange={(e) => handleUpdateStrickerMatchStatus(match._id, e.target.value)}
                            className="px-3 py-2 bg-dark-900 border border-white/10 rounded-lg text-white text-sm"
                          >
                            <option value="pending">En attente</option>
                            <option value="ready">Prêt</option>
                            <option value="in_progress">En cours</option>
                            <option value="completed">Terminé</option>
                            <option value="disputed">Litige</option>
                            <option value="cancelled">Annulé</option>
                          </select>
                          <button
                            onClick={() => setStrickerMatchToDelete(match)}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 text-gray-500 text-sm space-y-1">
                        <div>
                          Créé le {new Date(match.createdAt).toLocaleDateString('fr-FR')} à {new Date(match.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} • 
                          Mode: Search & Destroy • 
                          Format: 5v5
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs">
                          {match.startedAt && (
                            <span className="text-green-400">
                              🕐 Début: {new Date(match.startedAt).toLocaleDateString('fr-FR')} {new Date(match.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {match.completedAt && (
                            <span className="text-blue-400">
                              🏁 Fin: {new Date(match.completedAt).toLocaleDateString('fr-FR')} {new Date(match.completedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {match.startedAt && match.completedAt && (
                            <span className="text-purple-400">
                              ⏱️ Durée: {Math.round((new Date(match.completedAt) - new Date(match.startedAt)) / 60000)} min
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20">
                <Skull className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Aucun match Stricker trouvé</p>
                <button
                  onClick={fetchStrickerMatches}
                  className="mt-4 px-4 py-2 bg-lime-500/20 text-lime-400 rounded-lg hover:bg-lime-500/30 transition-colors"
                >
                  Charger les matchs
                </button>
              </div>
            )}
          </>
        )}

        {/* Ranked Matches List */}
        {matchesSubTab === 'ranked' && (
          <>
            {matchesLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
              </div>
            ) : adminRankedMatches.length > 0 ? (
              <div className="space-y-3">
                {adminRankedMatches.map((match) => {
                  const { team1Name, team2Name } = getRankedMatchTeamNames(match);
                  return (
                    <div key={match._id} className="bg-dark-800/50 border border-cyan-500/20 rounded-xl p-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-4 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/20 text-cyan-400">
                            CLASSÉ
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            match.mode === 'cdl' 
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                              : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          }`}>
                            {match.mode === 'cdl' ? 'CDL' : 'HARDCORE'}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="text-white font-medium text-sm">{team1Name}</div>
                            <span className="text-gray-500">vs</span>
                            <div className="text-white font-medium text-sm">{team2Name}</div>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            match.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            match.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            match.status === 'ready' ? 'bg-blue-500/20 text-blue-400' :
                            match.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                            match.status === 'disputed' ? 'bg-red-500/20 text-red-400' :
                            match.status === 'cancelled' ? 'bg-gray-500/20 text-gray-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {match.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={`/ranked/match/${match._id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors text-sm"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Voir
                          </a>
                          <select
                            value={match.status}
                            onChange={(e) => handleUpdateRankedMatchStatus(match._id, e.target.value)}
                            className="px-3 py-2 bg-dark-900 border border-white/10 rounded-lg text-white text-sm"
                          >
                            <option value="pending">En attente</option>
                            <option value="ready">Prêt</option>
                            <option value="in_progress">En cours</option>
                            <option value="completed">Terminé</option>
                            <option value="disputed">Litige</option>
                            <option value="cancelled">Annulé</option>
                          </select>

                          <button
                            onClick={() => setRankedMatchToDelete(match)}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 text-gray-500 text-sm space-y-1">
                        <div>
                          Créé le {new Date(match.createdAt).toLocaleDateString('fr-FR')} à {new Date(match.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} • 
                          Mode: {match.gameMode || 'N/A'} • 
                          Format: {match.teamSize ? `${match.teamSize}v${match.teamSize}` : 'N/A'}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs">
                          {match.startedAt && (
                            <span className="text-green-400">
                              🕐 Début: {new Date(match.startedAt).toLocaleDateString('fr-FR')} {new Date(match.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {match.completedAt && (
                            <span className="text-blue-400">
                              🏁 Fin: {new Date(match.completedAt).toLocaleDateString('fr-FR')} {new Date(match.completedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {match.startedAt && match.completedAt && (
                            <span className="text-purple-400">
                              ⏱️ Durée: {Math.round((new Date(match.completedAt) - new Date(match.startedAt)) / 60000)} min
                            </span>
                          )}
                        </div>
                        {match.team1Referent && (
                          <div className="text-cyan-400">
                            👑 Référents: {match.team1Referent?.username || '?'} (Éq.1) - {match.team2Referent?.username || '?'} (Éq.2)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20">
                <Target className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Aucun match classé trouvé</p>
                <button
                  onClick={fetchAdminRankedMatches}
                  className="mt-4 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
                >
                  Charger les matchs
                </button>
              </div>
            )}
          </>
        )}

        {/* Delete Stricker Match Modal */}
        {strickerMatchToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <div className="bg-dark-900 rounded-xl border border-red-500/30 p-6 max-w-md w-full">
              <h3 className="text-lg font-bold text-white mb-4">Supprimer le match Stricker ?</h3>
              <p className="text-gray-400 mb-4">
                Cette action est irréversible. Le match sera définitivement supprimé.
              </p>
              {strickerMatchToDelete.status === 'completed' && (
                <div className="p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg mb-4">
                  <p className="text-yellow-400 text-sm">
                    ⚠️ Ce match est terminé. La suppression va <strong>rembourser</strong> les récompenses :
                  </p>
                  <ul className="text-yellow-400/80 text-xs mt-2 space-y-1">
                    <li>• Points Stricker (retirés aux gagnants, restitutés aux perdants)</li>
                    <li>• Gold gagné (retiré à tous)</li>
                    <li>• XP gagnée (retirée aux gagnants)</li>
                    <li>• Victoires/Défaites (retirées des stats)</li>
                    <li>• Munitions gagnées (retirées aux escouades)</li>
                  </ul>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setStrickerMatchToDelete(null)}
                  className="flex-1 py-3 bg-dark-800 text-white rounded-lg hover:bg-dark-700 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleDeleteStrickerMatch(strickerMatchToDelete._id)}
                  className="flex-1 py-3 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-colors"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Ranked Match Modal */}
        {rankedMatchToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <div className="bg-dark-900 rounded-xl border border-red-500/30 p-6 max-w-md w-full">
              <h3 className="text-lg font-bold text-white mb-4">Supprimer le match classé ?</h3>
              <p className="text-gray-400 mb-4">
                Cette action est irréversible. Le match sera définitivement supprimé.
              </p>
              {rankedMatchToDelete.status === 'completed' && (
                <div className="p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg mb-4">
                  <p className="text-yellow-400 text-sm">
                    ⚠️ Ce match est terminé. La suppression va <strong>rembourser</strong> les récompenses :
                  </p>
                  <ul className="text-yellow-400/80 text-xs mt-2 space-y-1">
                    <li>• Points classés (retirés aux gagnants, restitués aux perdants)</li>
                    <li>• Gold gagné (retiré à tous)</li>
                    <li>• XP gagnée (retirée aux gagnants)</li>
                    <li>• Victoires/Défaites (retirées des stats)</li>
                  </ul>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setRankedMatchToDelete(null)}
                  className="flex-1 py-3 bg-dark-800 text-white rounded-lg hover:bg-dark-700 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleDeleteRankedMatch(rankedMatchToDelete._id)}
                  className="flex-1 py-3 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-colors"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==================== SEASONS TAB ====================
  const [ladderSeasonHistory, setLadderSeasonHistory] = useState({ duoTrio: [], squadTeam: [] });
  const [seasonsLoading, setSeasonsLoading] = useState(false);
  const [seasonToDelete, setSeasonToDelete] = useState(null);
  const [rankedSeasonInfo, setRankedSeasonInfo] = useState(null);
  const [rankedSeasonMode, setRankedSeasonMode] = useState('hardcore'); // 'hardcore' or 'cdl'
  const [rankedResetLoading, setRankedResetLoading] = useState(false);
  const [showRankedResetConfirm, setShowRankedResetConfirm] = useState(false);
  const [testTrophyLoading, setTestTrophyLoading] = useState(null);
  const [editingSeasonNumber, setEditingSeasonNumber] = useState(null);
  const [savingSeasonNumber, setSavingSeasonNumber] = useState(false);
  const [exportingRankings, setExportingRankings] = useState(false);
  const [rankedMatchmakingEnabled, setRankedMatchmakingEnabled] = useState(true);
  const [togglingMatchmaking, setTogglingMatchmaking] = useState(false);
  
  // Stricker Season States
  const [strickerSeasonInfo, setStrickerSeasonInfo] = useState(null);
  const [strickerResetLoading, setStrickerResetLoading] = useState(false);
  const [showStrickerResetConfirm, setShowStrickerResetConfirm] = useState(false);
  const [editingStrickerSeason, setEditingStrickerSeason] = useState(null);
  const [editingStrickerStartDate, setEditingStrickerStartDate] = useState(null);
  const [savingStrickerSeason, setSavingStrickerSeason] = useState(false);

  const fetchLadderSeasonHistory = async () => {
    setSeasonsLoading(true);
    try {
      const [duoTrioRes, squadTeamRes] = await Promise.all([
        fetch(`${API_URL}/seasons/ladder/history/duo-trio?limit=24`, { credentials: 'include' }),
        fetch(`${API_URL}/seasons/ladder/history/squad-team?limit=24`, { credentials: 'include' })
      ]);
      const duoTrioData = await duoTrioRes.json();
      const squadTeamData = await squadTeamRes.json();
      
      setLadderSeasonHistory({
        duoTrio: duoTrioData.success ? duoTrioData.history : [],
        squadTeam: squadTeamData.success ? squadTeamData.history : []
      });
    } catch (err) {
      console.error('Error fetching season history:', err);
    } finally {
      setSeasonsLoading(false);
    }
  };

  const fetchRankedSeasonInfo = async (mode = rankedSeasonMode) => {
    try {
      const [seasonRes, settingsRes] = await Promise.all([
        fetch(`${API_URL}/seasons/admin/ranked/info?mode=${mode}`, { credentials: 'include' }),
        fetch(`${API_URL}/app-settings/admin`, { credentials: 'include' })
      ]);
      const seasonData = await seasonRes.json();
      const settingsData = await settingsRes.json();
      if (seasonData.success) {
        setRankedSeasonInfo(seasonData);
      }
      if (settingsData.success && settingsData.settings?.features?.rankedMatchmaking) {
        setRankedMatchmakingEnabled(settingsData.settings.features.rankedMatchmaking.enabled !== false);
      }
    } catch (err) {
      console.error('Error fetching ranked season info:', err);
    }
  };

  const handleRankedSeasonReset = async () => {
    setRankedResetLoading(true);
    try {
      const response = await fetch(`${API_URL}/seasons/admin/ranked/reset`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(`Saison ${data.result.seasonNumber} terminée ! ${data.result.trophiesDistributed} trophées distribués, ${data.result.goldDistributed.toLocaleString()} gold distribué`);
        setShowRankedResetConfirm(false);
        fetchRankedSeasonInfo();
      } else {
        setError(data.message || 'Erreur lors du reset');
      }
    } catch (err) {
      setError('Erreur lors du reset de la saison');
    } finally {
      setRankedResetLoading(false);
    }
  };

  // Export rankings to text file
  const handleExportRankings = async () => {
    setExportingRankings(true);
    try {
      // Fetch all rankings (top 100)
      const response = await fetch(`${API_URL}/rankings/leaderboard/all?limit=100&page=1`, { credentials: 'include' });
      const data = await response.json();
      
      if (data.success && data.rankings) {
        const date = new Date().toLocaleDateString('fr-FR');
        const currentSeason = rankedSeasonInfo?.currentSeason || 1;
        
        // Build text content
        let content = `=== CLASSEMENT MODE CLASSÉ - ${date} ===\n\n`;
        content += `Top 100 joueurs - Saison ${currentSeason}\n\n`;
        content += `${'#'.padEnd(5)}${'Joueur'.padEnd(25)}${'Points'.padEnd(10)}${'V'.padEnd(8)}${'D'.padEnd(8)}${'Division'.padEnd(15)}\n`;
        content += '-'.repeat(71) + '\n';
        
        const divisionNames = {
          bronze: 'Bronze',
          silver: 'Argent',
          gold: 'Or',
          platinum: 'Platine',
          diamond: 'Diamant',
          master: 'Maître',
          grandmaster: 'Grand Maître',
          champion: 'Champion'
        };
        
        data.rankings.forEach((player, index) => {
          const position = (index + 1).toString().padEnd(5);
          const username = (player.user?.username || 'Inconnu').substring(0, 24).padEnd(25);
          const points = player.points.toString().padEnd(10);
          const wins = player.wins.toString().padEnd(8);
          const losses = player.losses.toString().padEnd(8);
          const division = (divisionNames[player.division] || player.division || 'Bronze').padEnd(15);
          
          content += `${position}${username}${points}${wins}${losses}${division}\n`;
        });
        
        content += '\n' + '-'.repeat(71) + '\n';
        content += `Total: ${data.rankings.length} joueurs classés\n`;
        content += `Exporté le: ${new Date().toLocaleString('fr-FR')}\n`;
        
        // Create and download file
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `classement_mode_classe_saison_${currentSeason}_${date.replace(/\//g, '-')}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        setSuccess('Classement exporté avec succès');
      } else {
        setError('Erreur lors de la récupération des classements');
      }
    } catch (err) {
      console.error('Error exporting rankings:', err);
      setError('Erreur lors de l\'export des classements');
    } finally {
      setExportingRankings(false);
    }
  };

  // Toggle ranked matchmaking (admin only)
  const handleToggleRankedMatchmaking = async () => {
    setTogglingMatchmaking(true);
    try {
      const newState = !rankedMatchmakingEnabled;
      const response = await fetch(`${API_URL}/app-settings/admin/feature/rankedMatchmaking`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          enabled: newState,
          disabledMessage: 'La recherche de match en mode classé est temporairement désactivée.'
        })
      });
      const data = await response.json();
      if (data.success) {
        setRankedMatchmakingEnabled(newState);
        setSuccess(newState ? 'Recherche de match activée' : 'Recherche de match désactivée');
      } else {
        setError(data.message || 'Erreur lors du changement');
      }
    } catch (err) {
      setError('Erreur lors du changement de statut');
    } finally {
      setTogglingMatchmaking(false);
    }
  };

  const handleDeleteSeasonHistory = async (seasonId) => {
    try {
      const response = await fetch(`${API_URL}/seasons/admin/ladder/history/${seasonId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Historique de saison supprimé');
        setSeasonToDelete(null);
        fetchLadderSeasonHistory();
      } else {
        setError(data.message || 'Erreur lors de la suppression');
      }
    } catch (err) {
      setError('Erreur lors de la suppression');
    }
  };

  // Test trophy distribution to a specific user
  const handleTestTrophyDistribution = async (user) => {
    if (!user?._id) return;
    
    setTestTrophyLoading(user._id);
    try {
      const response = await fetch(`${API_URL}/seasons/admin/ranked/test-trophy/${user._id}`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(`Trophée test distribué à ${user.username || user.discordUsername} !`);
      } else {
        setError(data.message || 'Erreur lors de la distribution du trophée test');
      }
    } catch (err) {
      setError('Erreur lors de la distribution du trophée test');
    } finally {
      setTestTrophyLoading(null);
    }
  };

  // Update season number in AppSettings
  const handleUpdateSeasonNumber = async (newSeasonNumber) => {
    if (!newSeasonNumber || newSeasonNumber < 1) {
      setError('Le numéro de saison doit être supérieur à 0');
      return;
    }
    
    setSavingSeasonNumber(true);
    try {
      const response = await fetch(`${API_URL}/seasons/admin/ranked/season-number`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ seasonNumber: newSeasonNumber })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(`Numéro de saison mis à jour: Saison ${newSeasonNumber}`);
        setEditingSeasonNumber(null);
        fetchRankedSeasonInfo();
      } else {
        setError(data.message || 'Erreur lors de la mise à jour');
      }
    } catch (err) {
      setError('Erreur lors de la mise à jour du numéro de saison');
    } finally {
      setSavingSeasonNumber(false);
    }
  };

  // Stricker Season Functions
  const fetchStrickerSeasonInfo = async () => {
    try {
      const response = await fetch(`${API_URL}/seasons/admin/stricker/info`, { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setStrickerSeasonInfo(data);
      }
    } catch (err) {
      console.error('Error fetching stricker season info:', err);
    }
  };

  const handleStrickerSeasonReset = async () => {
    setStrickerResetLoading(true);
    try {
      const response = await fetch(`${API_URL}/seasons/admin/stricker/reset`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(`Saison ${data.result.seasonNumber} Stricker terminée ! ${data.result.trophiesDistributed} trophées distribués, ${data.result.goldDistributed.toLocaleString()} gold distribué`);
        setShowStrickerResetConfirm(false);
        fetchStrickerSeasonInfo();
      } else {
        setError(data.message || 'Erreur lors du reset');
      }
    } catch (err) {
      setError('Erreur lors du reset de la saison Stricker');
    } finally {
      setStrickerResetLoading(false);
    }
  };

  const handleUpdateStrickerSeason = async (newSeasonNumber, newStartDate = null) => {
    if (!newSeasonNumber || newSeasonNumber < 1) {
      setError('Le numéro de saison doit être supérieur à 0');
      return;
    }
    
    setSavingStrickerSeason(true);
    try {
      const body = { seasonNumber: newSeasonNumber };
      if (newStartDate) {
        body.seasonStartDate = newStartDate;
      }
      
      const response = await fetch(`${API_URL}/seasons/admin/stricker/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(`Saison Stricker mise à jour: Saison ${newSeasonNumber}`);
        setEditingStrickerSeason(null);
        setEditingStrickerStartDate(null);
        fetchStrickerSeasonInfo();
      } else {
        setError(data.message || 'Erreur lors de la mise à jour');
      }
    } catch (err) {
      setError('Erreur lors de la mise à jour de la saison Stricker');
    } finally {
      setSavingStrickerSeason(false);
    }
  };

  const renderSeasons = () => {
    // Fetch ranked info on first load
    if (!rankedSeasonInfo && !seasonsLoading) {
      fetchRankedSeasonInfo();
    }

    const divisionColors = {
      platinum: { bg: 'bg-teal-500/20', text: 'text-teal-400', border: 'border-teal-500/30' },
      diamond: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' },
      master: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
      grandmaster: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
      champion: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' }
    };

    const divisionNames = {
      platinum: 'Platine',
      diamond: 'Diamant',
      master: 'Maître',
      grandmaster: 'Grand Maître',
      champion: 'Champion'
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Calendar className="w-7 h-7 text-purple-400" />
              Gestion des Saisons Mode Classé
            </h2>
            <p className="text-gray-400 mt-1">RAZ de saison et distribution des récompenses</p>
          </div>
          <button
            onClick={fetchRankedSeasonInfo}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
        </div>

        {/* Season Number Configuration */}
        <div className="bg-dark-800/50 border border-cyan-500/30 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-cyan-400" />
            Numéro de Saison Actuelle
          </h3>
          <div className="flex items-center gap-4">
            {editingSeasonNumber !== null ? (
              <>
                <input
                  type="number"
                  value={editingSeasonNumber}
                  onChange={(e) => setEditingSeasonNumber(parseInt(e.target.value) || 1)}
                  min="1"
                  className="w-24 px-3 py-2 bg-dark-900 border border-cyan-500/30 rounded-lg text-white text-center text-xl font-bold focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={() => handleUpdateSeasonNumber(editingSeasonNumber)}
                  disabled={savingSeasonNumber}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {savingSeasonNumber ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Sauvegarder
                </button>
                <button
                  onClick={() => setEditingSeasonNumber(null)}
                  disabled={savingSeasonNumber}
                  className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded-lg transition-colors"
                >
                  Annuler
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-bold text-cyan-400">
                    {rankedSeasonInfo?.currentSeason || 1}
                  </span>
                  <span className="text-gray-400">Saison en cours</span>
                </div>
                <button
                  onClick={() => setEditingSeasonNumber(rankedSeasonInfo?.currentSeason || 1)}
                  className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Modifier
                </button>
              </>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-3">
            Ce numéro sera utilisé pour nommer les trophées lors de la RAZ (ex: "Diamant - Saison {rankedSeasonInfo?.currentSeason || 1}")
          </p>
        </div>

        {/* Toggle Ranked Matchmaking - Admin Only */}
        {userIsAdmin && (
          <div className="bg-dark-800/50 border border-yellow-500/30 rounded-xl overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-b border-white/10">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Power className="w-5 h-5 text-yellow-400" />
                Recherche de Match - Mode Classé
              </h3>
              <p className="text-gray-400 text-sm mt-1">
                Activer ou désactiver la recherche de match pour tous les joueurs
              </p>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${rankedMatchmakingEnabled ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                  <span className={`text-lg font-semibold ${rankedMatchmakingEnabled ? 'text-green-400' : 'text-red-400'}`}>
                    {rankedMatchmakingEnabled ? 'Recherche activée' : 'Recherche désactivée'}
                  </span>
                </div>
                <button
                  onClick={handleToggleRankedMatchmaking}
                  disabled={togglingMatchmaking}
                  className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${rankedMatchmakingEnabled 
                    ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400' 
                    : 'bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {togglingMatchmaking ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : rankedMatchmakingEnabled ? (
                    <><ToggleRight className="w-5 h-5" /> Désactiver</>
                  ) : (
                    <><ToggleLeft className="w-5 h-5" /> Activer</>
                  )}
                </button>
              </div>
              <p className="text-gray-500 text-sm mt-4">
                Lorsque désactivée, les joueurs ne pourront plus lancer de recherche de match en mode classé.
                Les matchs déjà en cours ne seront pas affectés.
              </p>
            </div>
          </div>
        )}

        {/* Export Rankings Button */}
        <div className="bg-dark-800/50 border border-blue-500/30 rounded-xl overflow-hidden">
          <div className="p-6 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-b border-white/10">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-400" />
              Export des Classements
            </h3>
            <p className="text-gray-400 text-sm mt-1">
              Télécharger le classement actuel en format texte
            </p>
          </div>
          <div className="p-6">
            <p className="text-gray-400 text-sm mb-4">
              Exporter le Top 100 des joueurs avec leurs points, victoires, défaites et division.
            </p>
            <button
              onClick={handleExportRankings}
              disabled={exportingRankings}
              className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportingRankings ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Export en cours...</>
              ) : (
                <><Download className="w-5 h-5" /> Exporter les Classements</>
              )}
            </button>
          </div>
        </div>

        {/* RAZ Season Button */}
        <div className="bg-dark-800/50 border border-purple-500/30 rounded-xl overflow-hidden">
          <div className="p-6 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-purple-400" />
                  RAZ Saison Mode Classé
                </h3>
                <p className="text-gray-400 text-sm mt-1">
                  Cette action va terminer la saison actuelle et distribuer les récompenses
                </p>
              </div>
              {/* Mode Selector */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setRankedSeasonMode('hardcore');
                    fetchRankedSeasonInfo('hardcore');
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    rankedSeasonMode === 'hardcore'
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                      : 'bg-dark-700 text-gray-400 hover:bg-dark-600 hover:text-white'
                  }`}
                >
                  Hardcore
                </button>
                <button
                  onClick={() => {
                    setRankedSeasonMode('cdl');
                    fetchRankedSeasonInfo('cdl');
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    rankedSeasonMode === 'cdl'
                      ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                      : 'bg-dark-700 text-gray-400 hover:bg-dark-600 hover:text-white'
                  }`}
                >
                  CDL
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {/* What will happen */}
            <div className="mb-6 space-y-4">
              <div className="p-4 bg-dark-900/50 rounded-lg border border-white/10">
                <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  Distribution des trophées
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                    rankedSeasonMode === 'hardcore' 
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                      : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  }`}>
                    {rankedSeasonMode === 'hardcore' ? 'Hardcore' : 'CDL'}
                  </span>
                </h4>
                <p className="text-gray-400 text-sm mb-3">
                  Un trophée unique sera créé et distribué aux joueurs du rang Platine à Champion :
                </p>
                <div className="flex flex-wrap gap-2">
                  {['platinum', 'diamond', 'master', 'grandmaster', 'champion'].map(div => (
                    <span 
                      key={div} 
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${divisionColors[div]?.bg} ${divisionColors[div]?.text} ${divisionColors[div]?.border} border`}
                    >
                      {divisionNames[div]}
                      {rankedSeasonInfo?.divisionCounts?.[div] > 0 && (
                        <span className="ml-1">({rankedSeasonInfo.divisionCounts[div]})</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-dark-900/50 rounded-lg border border-white/10">
                <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-yellow-400" />
                  Distribution des Golds - Top 5
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                    rankedSeasonMode === 'hardcore' 
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                      : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  }`}>
                    {rankedSeasonMode === 'hardcore' ? 'Hardcore' : 'CDL'}
                  </span>
                </h4>
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(pos => {
                    const goldAmount = pos === 1 ? 100000 : pos === 2 ? 80000 : pos === 3 ? 60000 : pos === 4 ? 40000 : 20000;
                    const topPlayer = rankedSeasonInfo?.top5?.find(p => p.position === pos);
                    return (
                      <div key={pos} className={`flex items-center justify-between p-2 rounded-lg ${
                        pos === 1 ? 'bg-yellow-500/10' : pos === 2 ? 'bg-gray-500/10' : pos === 3 ? 'bg-orange-500/10' : 'bg-dark-800/50'
                      }`}>
                        <div className="flex items-center gap-3">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                            pos === 1 ? 'bg-yellow-500/30 text-yellow-400' :
                            pos === 2 ? 'bg-gray-500/30 text-gray-300' :
                            pos === 3 ? 'bg-orange-500/30 text-orange-400' :
                            'bg-dark-700 text-gray-400'
                          }`}>
                            {pos}
                          </span>
                          <span className="text-white">
                            {topPlayer?.username || `Top ${pos}`}
                          </span>
                          {topPlayer && (
                            <span className="text-gray-500 text-xs">({topPlayer.points} pts)</span>
                          )}
                        </div>
                        <span className="flex items-center gap-1 text-yellow-400 font-semibold">
                          <Coins className="w-4 h-4" />
                          {goldAmount.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 bg-dark-900/50 rounded-lg border border-white/10">
                <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-red-400" />
                  Remise à zéro
                </h4>
                <ul className="text-gray-400 text-sm space-y-1">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                    Points classés de tous les joueurs remis à 0
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                    Victoires/Défaites remises à 0
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                    Tous les rangs redescendent à Bronze
                  </li>
                </ul>
              </div>

              {/* Stats */}
              {rankedSeasonInfo && (
                <div className="p-4 bg-dark-900/50 rounded-lg border border-white/10">
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-cyan-400" />
                    Statistiques actuelles
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                      rankedSeasonMode === 'hardcore' 
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                        : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    }`}>
                      {rankedSeasonMode === 'hardcore' ? 'Hardcore' : 'CDL'}
                    </span>
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-dark-800 rounded-lg">
                      <div className="text-2xl font-bold text-white">{rankedSeasonInfo.totalPlayers}</div>
                      <div className="text-gray-500 text-xs">Joueurs total</div>
                    </div>
                    <div className="text-center p-3 bg-dark-800 rounded-lg">
                      <div className="text-2xl font-bold text-cyan-400">{rankedSeasonInfo.activePlayers}</div>
                      <div className="text-gray-500 text-xs">Joueurs actifs</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Reset Button */}
            <button
              onClick={() => setShowRankedResetConfirm(true)}
              className="w-full py-4 px-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-purple-500/30"
            >
              <RotateCcw className="w-5 h-5" />
              RAZ Saison Mode Classé
            </button>
          </div>
        </div>

        {/* ==================== STRICKER SEASON SECTION ==================== */}
        <div className="border-t border-white/10 pt-8 mt-8">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3 mb-6">
            <Shield className="w-7 h-7 text-lime-400" />
            Gestion de Saison Mode Stricker
          </h2>
          
          {/* Stricker Season Number Configuration */}
          <div className="bg-dark-800/50 border border-lime-500/30 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-lime-400" />
              Configuration de la Saison Stricker
            </h3>
            
            {editingStrickerSeason !== null ? (
              <div className="space-y-4">
                {/* Season Number */}
                <div>
                  <label className="text-gray-400 text-sm mb-2 block">Numéro de saison</label>
                  <input
                    type="number"
                    value={editingStrickerSeason}
                    onChange={(e) => setEditingStrickerSeason(parseInt(e.target.value) || 1)}
                    min="1"
                    className="w-32 px-3 py-2 bg-dark-900 border border-lime-500/30 rounded-lg text-white text-center text-xl font-bold focus:outline-none focus:border-lime-500"
                  />
                </div>
                
                {/* Start Date */}
                <div>
                  <label className="text-gray-400 text-sm mb-2 block">Date de début de la saison (10h du matin)</label>
                  <input
                    type="date"
                    value={editingStrickerStartDate || ''}
                    onChange={(e) => setEditingStrickerStartDate(e.target.value)}
                    className="px-4 py-2 bg-dark-900 border border-lime-500/30 rounded-lg text-white focus:outline-none focus:border-lime-500"
                  />
                  <p className="text-gray-500 text-xs mt-1">
                    La prochaine saison commencera 2 mois après cette date
                  </p>
                </div>
                
                {/* Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => handleUpdateStrickerSeason(editingStrickerSeason, editingStrickerStartDate ? new Date(editingStrickerStartDate + 'T10:00:00').toISOString() : null)}
                    disabled={savingStrickerSeason}
                    className="px-4 py-2 bg-lime-500 hover:bg-lime-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingStrickerSeason ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Sauvegarder
                  </button>
                  <button
                    onClick={() => {
                      setEditingStrickerSeason(null);
                      setEditingStrickerStartDate(null);
                    }}
                    disabled={savingStrickerSeason}
                    className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded-lg transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl font-bold text-lime-400">
                      {strickerSeasonInfo?.currentSeason || 1}
                    </span>
                    <span className="text-gray-400">Saison en cours</span>
                  </div>
                  <button
                    onClick={() => {
                      if (!strickerSeasonInfo) fetchStrickerSeasonInfo();
                      setEditingStrickerSeason(strickerSeasonInfo?.currentSeason || 1);
                      // Format date for input (YYYY-MM-DD)
                      if (strickerSeasonInfo?.seasonStartDate) {
                        const d = new Date(strickerSeasonInfo.seasonStartDate);
                        setEditingStrickerStartDate(d.toISOString().split('T')[0]);
                      }
                    }}
                    className="px-4 py-2 bg-lime-500/20 hover:bg-lime-500/30 text-lime-400 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Modifier
                  </button>
                  <button
                    onClick={fetchStrickerSeasonInfo}
                    className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Actualiser
                  </button>
                </div>
                <div className="text-gray-400 text-sm space-y-1">
                  <p>
                    <span className="text-gray-500">Début:</span>{' '}
                    <span className="text-white font-medium">
                      {strickerSeasonInfo?.seasonStartDate 
                        ? new Date(strickerSeasonInfo.seasonStartDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : 'Non défini'}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-500">Fin estimée:</span>{' '}
                    <span className="text-lime-400 font-medium">
                      {strickerSeasonInfo?.seasonEndDate 
                        ? new Date(strickerSeasonInfo.seasonEndDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : 'N/A'}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-500">Durée:</span> {strickerSeasonInfo?.seasonDurationMonths || 2} mois
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Stricker RAZ Section */}
          <div className="bg-dark-800/50 border border-lime-500/30 rounded-xl overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-lime-500/20 to-green-500/20 border-b border-white/10">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-lime-400" />
                RAZ Saison Stricker
              </h3>
              <p className="text-gray-400 text-sm mt-1">
                Terminer la saison et distribuer les récompenses aux top escouades
              </p>
            </div>
            
            <div className="p-6">
              {/* What will happen */}
              <div className="mb-6 space-y-4">
                <div className="p-4 bg-dark-900/50 rounded-lg border border-white/10">
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    Distribution des trophées - Top 3 Escouades
                  </h4>
                  <p className="text-gray-400 text-sm mb-3">
                    Un trophée unique sera créé et distribué aux 3 meilleures escouades :
                  </p>
                  <div className="space-y-2">
                    {[
                      { pos: 1, gold: 50000, color: 'yellow' },
                      { pos: 2, gold: 30000, color: 'gray' },
                      { pos: 3, gold: 15000, color: 'orange' }
                    ].map(({ pos, gold, color }) => {
                      const topSquad = strickerSeasonInfo?.topSquads?.find(s => s.position === pos);
                      return (
                        <div key={pos} className={`flex items-center justify-between p-2 rounded-lg bg-${color}-500/10`}>
                          <div className="flex items-center gap-3">
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold bg-${color}-500/30 text-${color}-400`}>
                              {pos}
                            </span>
                            <span className="text-white">
                              {topSquad ? `[${topSquad.tag}] ${topSquad.name}` : `Top ${pos}`}
                            </span>
                            {topSquad && (
                              <span className="text-gray-500 text-xs">({topSquad.points} pts)</span>
                            )}
                          </div>
                          <span className="flex items-center gap-1 text-yellow-400 font-semibold">
                            <Coins className="w-4 h-4" />
                            {gold.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 bg-dark-900/50 rounded-lg border border-white/10">
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-red-400" />
                    Remise à zéro
                  </h4>
                  <ul className="text-gray-400 text-sm space-y-1">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                      Points Stricker de toutes les escouades remis à 0
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                      Victoires/Défaites Stricker remises à 0
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                      Tous les rangs Stricker redescendent à Recrues
                    </li>
                  </ul>
                </div>

                {/* Stats */}
                {strickerSeasonInfo && (
                  <div className="p-4 bg-dark-900/50 rounded-lg border border-white/10">
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-lime-400" />
                      Statistiques actuelles
                    </h4>
                    <div className="text-center p-3 bg-dark-800 rounded-lg">
                      <div className="text-2xl font-bold text-lime-400">{strickerSeasonInfo.totalSquads || 0}</div>
                      <div className="text-gray-500 text-xs">Escouades actives</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Reset Button */}
              <button
                onClick={() => setShowStrickerResetConfirm(true)}
                className="w-full py-4 px-6 bg-gradient-to-r from-lime-500 to-green-500 hover:from-lime-600 hover:to-green-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-lime-500/30"
              >
                <RotateCcw className="w-5 h-5" />
                RAZ Saison Stricker
              </button>
            </div>
          </div>
        </div>

        {/* Ranked Confirmation Modal */}
        {showRankedResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <div className="bg-dark-900 rounded-xl border border-purple-500/30 p-6 max-w-md w-full">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Confirmer la RAZ de saison</h3>
                <p className="text-gray-400 text-sm">
                  Cette action est irréversible. Les trophées seront distribués aux joueurs éligibles, les golds seront donnés au top 5, et tous les classements seront remis à zéro.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRankedResetConfirm(false)}
                  disabled={rankedResetLoading}
                  className="flex-1 py-3 bg-dark-800 text-white rounded-lg hover:bg-dark-700 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleRankedSeasonReset}
                  disabled={rankedResetLoading}
                  className="flex-1 py-3 bg-purple-500 text-white font-bold rounded-lg hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
                >
                  {rankedResetLoading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> En cours...</>
                  ) : (
                    <><RotateCcw className="w-5 h-5" /> Confirmer RAZ</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stricker Reset Confirmation Modal */}
        {showStrickerResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <div className="bg-dark-900 rounded-xl border border-lime-500/30 p-6 max-w-md w-full">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-lime-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-lime-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Confirmer la RAZ Stricker</h3>
                <p className="text-gray-400 text-sm">
                  Cette action est irréversible. Les trophées de saison seront créés et distribués au Top 3 des escouades, le gold sera donné à leurs membres, et tous les stats Stricker seront remis à zéro.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowStrickerResetConfirm(false)}
                  disabled={strickerResetLoading}
                  className="flex-1 py-3 bg-dark-800 text-white rounded-lg hover:bg-dark-700 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleStrickerSeasonReset}
                  disabled={strickerResetLoading}
                  className="flex-1 py-3 bg-lime-500 text-white font-bold rounded-lg hover:bg-lime-600 transition-colors flex items-center justify-center gap-2"
                >
                  {strickerResetLoading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> En cours...</>
                  ) : (
                    <><RotateCcw className="w-5 h-5" /> Confirmer RAZ</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSystem = () => {
    const handleFullReset = async () => {
      if (confirmText !== 'RESET ALL') {
        setError('Vous devez taper "RESET ALL" pour confirmer');
        return;
      }

      if (!window.confirm('ATTENTION: Cette action supprimera TOUTES les données (utilisateurs, escouades, matchs, classements, etc.) sauf les règles de jeu, les cartes et la configuration. Êtes-vous absolument sûr ?')) {
        return;
      }

      try {
        setResetting(true);
        const response = await fetch(`${API_URL}/system/admin/reset-all`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ confirmation: 'RESET ALL' })
        });

        const data = await response.json();

        if (data.success) {
          setSuccess('Système réinitialisé avec succès');
          setConfirmText('');
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          setError(data.message || 'Erreur lors de la réinitialisation');
        }
      } catch (err) {
        console.error('System reset error:', err);
        setError('Erreur lors de la réinitialisation');
      } finally {
        setResetting(false);
      }
    };

    return (
      <div className="space-y-4 sm:space-y-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Gestion Système</h2>

        {/* Danger Zone */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 sm:w-5 h-4 sm:h-5" />
            Zone Dangereuse
          </h3>
          
          <div className="space-y-4">
            <div>
              <p className="text-white font-medium mb-2 text-sm sm:text-base">Réinitialisation Complète du Système</p>
              <p className="text-gray-400 text-xs sm:text-sm mb-4">
                Cette action supprimera TOUTES les données suivantes:
              </p>
              <ul className="text-gray-400 text-xs sm:text-sm space-y-1 list-disc list-inside mb-4">
                <li>Tous les utilisateurs (y compris les admins)</li>
                <li>Toutes les escouades</li>
                <li>Tous les matchs (ladder et classés)</li>
                <li>Tous les classements</li>
                <li>Toutes les annonces</li>
                <li>Tous les achats et utilisations d'items</li>
                <li>Toutes les saisons</li>
              </ul>
              <p className="text-yellow-400 text-xs sm:text-sm font-medium mb-4">
                ⚠️ Données PRÉSERVÉES: Règles de jeu, Cartes, Items de boutique, Trophées, Configuration (points/coins)
              </p>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                Tapez "RESET ALL" pour confirmer
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="RESET ALL"
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-dark-800 border border-red-500/30 rounded-xl text-white text-sm focus:outline-none focus:border-red-500"
              />
            </div>

            <button
              onClick={handleFullReset}
              disabled={resetting || confirmText !== 'RESET ALL'}
              className="w-full py-2.5 sm:py-3 px-4 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              {resetting ? (
                <>
                  <Loader2 className="w-4 sm:w-5 h-4 sm:h-5 animate-spin" />
                  <span className="hidden sm:inline">Réinitialisation en cours...</span>
                  <span className="sm:hidden">Reset...</span>
                </>
              ) : (
                <>
                  <Skull className="w-4 sm:w-5 h-4 sm:h-5" />
                  <span className="hidden sm:inline">RÉINITIALISER TOUT LE SYSTÈME</span>
                  <span className="sm:hidden">RÉINITIALISER</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* System Info */}
        <div className="bg-dark-800/50 border border-white/10 rounded-xl p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Database className="w-4 sm:w-5 h-4 sm:h-5" />
            Informations Système
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
            <div>
              <span className="text-gray-400">Version:</span>
              <span className="text-white ml-2 font-medium">2.0.0</span>
            </div>
            <div>
              <span className="text-gray-400">Environnement:</span>
              <span className="text-white ml-2 font-medium">Production</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderModalForm = () => {
    switch (modalType) {
      case 'user':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Username *</label>
              <input
                type="text"
                value={formData.username || ''}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Gold Coins</label>
              <div className="relative">
                <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-yellow-400" />
                <input
                  type="number"
                  value={formData.goldCoins || 500}
                  onChange={(e) => setFormData({ ...formData, goldCoins: parseInt(e.target.value) })}
                  className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  min={0}
                />
              </div>
            </div>
            
            {/* Platform selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Plateforme</label>
              <select
                value={formData.platform || ''}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value || null })}
                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
              >
                <option value="">Non définie</option>
                <option value="PC">PC</option>
                <option value="PlayStation">PlayStation</option>
                <option value="Xbox">Xbox</option>
              </select>
            </div>
            
            {/* Ladder Stats (Match Ladder - Escouade vs Escouade) */}
            <div className="border-t border-white/10 pt-4 mt-4">
              <h4 className="text-sm font-medium text-orange-400 mb-3 flex items-center gap-2">
                <Swords className="w-4 h-4" />
                Stats Ladder (Matchs Escouade) + XP Top Players
              </h4>
              <p className="text-gray-500 text-xs mb-3">
                XP pour le classement Top Players + victoires/défaites du mode Ladder
              </p>
              
              {/* Ladder Hardcore */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-orange-400 mb-2">🔥 Mode Hardcore</label>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-medium text-purple-400 mb-1">⭐ XP Top Player</label>
                    <input
                      type="number"
                      value={formData.ladderStats?.hardcore?.xp ?? formData.statsHardcore?.xp ?? 0}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        ladderStats: { 
                          ...formData.ladderStats, 
                          hardcore: {
                            ...formData.ladderStats?.hardcore,
                            xp: parseInt(e.target.value) || 0
                          }
                        } 
                      })}
                      className="w-full px-3 py-2 bg-dark-900 border border-purple-500/30 rounded-lg text-purple-400 text-sm font-semibold focus:border-purple-500 focus:outline-none"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Points</label>
                    <input
                      type="number"
                      value={formData.ladderStats?.hardcore?.points ?? formData.statsHardcore?.points ?? 0}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        ladderStats: { 
                          ...formData.ladderStats, 
                          hardcore: {
                            ...formData.ladderStats?.hardcore,
                            points: parseInt(e.target.value) || 0
                          }
                        } 
                      })}
                      className="w-full px-3 py-2 bg-dark-900 border border-orange-500/30 rounded-lg text-orange-400 text-sm font-semibold focus:border-orange-500 focus:outline-none"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-green-500 mb-1">✅ Victoires</label>
                    <input
                      type="number"
                      value={formData.ladderStats?.hardcore?.wins ?? formData.statsHardcore?.wins ?? 0}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        ladderStats: { 
                          ...formData.ladderStats, 
                          hardcore: {
                            ...formData.ladderStats?.hardcore,
                            wins: parseInt(e.target.value) || 0
                          }
                        } 
                      })}
                      className="w-full px-3 py-2 bg-dark-900 border border-green-500/30 rounded-lg text-green-400 text-sm font-semibold focus:border-green-500 focus:outline-none"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-red-500 mb-1">❌ Défaites</label>
                    <input
                      type="number"
                      value={formData.ladderStats?.hardcore?.losses ?? formData.statsHardcore?.losses ?? 0}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        ladderStats: { 
                          ...formData.ladderStats, 
                          hardcore: {
                            ...formData.ladderStats?.hardcore,
                            losses: parseInt(e.target.value) || 0
                          }
                        } 
                      })}
                      className="w-full px-3 py-2 bg-dark-900 border border-red-500/30 rounded-lg text-red-400 text-sm font-semibold focus:border-red-500 focus:outline-none"
                      min={0}
                    />
                  </div>
                </div>
              </div>
              
              {/* Ladder CDL */}
              <div>
                <label className="block text-xs font-medium text-cyan-400 mb-2">🎮 Mode CDL</label>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-medium text-purple-400 mb-1">⭐ XP Top Player</label>
                    <input
                      type="number"
                      value={formData.ladderStats?.cdl?.xp ?? formData.statsCdl?.xp ?? 0}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        ladderStats: { 
                          ...formData.ladderStats, 
                          cdl: {
                            ...formData.ladderStats?.cdl,
                            xp: parseInt(e.target.value) || 0
                          }
                        } 
                      })}
                      className="w-full px-3 py-2 bg-dark-900 border border-purple-500/30 rounded-lg text-purple-400 text-sm font-semibold focus:border-purple-500 focus:outline-none"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Points</label>
                    <input
                      type="number"
                      value={formData.ladderStats?.cdl?.points ?? formData.statsCdl?.points ?? 0}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        ladderStats: { 
                          ...formData.ladderStats, 
                          cdl: {
                            ...formData.ladderStats?.cdl,
                            points: parseInt(e.target.value) || 0
                          }
                        } 
                      })}
                      className="w-full px-3 py-2 bg-dark-900 border border-cyan-500/30 rounded-lg text-cyan-400 text-sm font-semibold focus:border-cyan-500 focus:outline-none"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-green-500 mb-1">✅ Victoires</label>
                    <input
                      type="number"
                      value={formData.ladderStats?.cdl?.wins ?? formData.statsCdl?.wins ?? 0}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        ladderStats: { 
                          ...formData.ladderStats, 
                          cdl: {
                            ...formData.ladderStats?.cdl,
                            wins: parseInt(e.target.value) || 0
                          }
                        } 
                      })}
                      className="w-full px-3 py-2 bg-dark-900 border border-green-500/30 rounded-lg text-green-400 text-sm font-semibold focus:border-green-500 focus:outline-none"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-red-500 mb-1">❌ Défaites</label>
                    <input
                      type="number"
                      value={formData.ladderStats?.cdl?.losses ?? formData.statsCdl?.losses ?? 0}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        ladderStats: { 
                          ...formData.ladderStats, 
                          cdl: {
                            ...formData.ladderStats?.cdl,
                            losses: parseInt(e.target.value) || 0
                          }
                        } 
                      })}
                      className="w-full px-3 py-2 bg-dark-900 border border-red-500/30 rounded-lg text-red-400 text-sm font-semibold focus:border-red-500 focus:outline-none"
                      min={0}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Ranked Ladder Points */}
            <div className="border-t border-white/10 pt-4 mt-4">
              <h4 className="text-sm font-medium text-purple-400 mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                Stats Mode Classé (Ranked)
              </h4>
              <p className="text-gray-500 text-xs mb-3">
                Points et stats du mode classé (détermine le rang Bronze, Silver, Gold, etc.)
              </p>
              {/* Points */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Points Ranked Hardcore</label>
                  <input
                    type="number"
                    value={formData.rankedPoints?.hardcore || 0}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      rankedPoints: { 
                        ...formData.rankedPoints, 
                        hardcore: parseInt(e.target.value) || 0 
                      } 
                    })}
                    className="w-full px-3 py-2 bg-dark-900 border border-orange-500/40 rounded-lg text-orange-400 text-sm font-semibold focus:border-orange-500 focus:outline-none"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Points Ranked CDL</label>
                  <input
                    type="number"
                    value={formData.rankedPoints?.cdl || 0}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      rankedPoints: { 
                        ...formData.rankedPoints, 
                        cdl: parseInt(e.target.value) || 0 
                      } 
                    })}
                    className="w-full px-3 py-2 bg-dark-900 border border-cyan-500/40 rounded-lg text-cyan-400 text-sm font-semibold focus:border-cyan-500 focus:outline-none"
                    min={0}
                  />
                </div>
              </div>

              {/* Wins/Losses Hardcore */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-green-400 mb-1">✅ Victoires Ranked HC</label>
                  <input
                    type="number"
                    value={formData.rankedStats?.hardcore?.wins || 0}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      rankedStats: { 
                        ...formData.rankedStats, 
                        hardcore: {
                          ...formData.rankedStats?.hardcore,
                          wins: parseInt(e.target.value) || 0
                        }
                      } 
                    })}
                    className="w-full px-3 py-2 bg-dark-900 border border-green-500/40 rounded-lg text-green-400 text-sm font-semibold focus:border-green-500 focus:outline-none"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-red-400 mb-1">❌ Défaites Ranked HC</label>
                  <input
                    type="number"
                    value={formData.rankedStats?.hardcore?.losses || 0}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      rankedStats: { 
                        ...formData.rankedStats, 
                        hardcore: {
                          ...formData.rankedStats?.hardcore,
                          losses: parseInt(e.target.value) || 0
                        }
                      } 
                    })}
                    className="w-full px-3 py-2 bg-dark-900 border border-red-500/40 rounded-lg text-red-400 text-sm font-semibold focus:border-red-500 focus:outline-none"
                    min={0}
                  />
                </div>
              </div>

              {/* Wins/Losses CDL */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-green-400 mb-1">✅ Victoires Ranked CDL</label>
                  <input
                    type="number"
                    value={formData.rankedStats?.cdl?.wins || 0}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      rankedStats: { 
                        ...formData.rankedStats, 
                        cdl: {
                          ...formData.rankedStats?.cdl,
                          wins: parseInt(e.target.value) || 0
                        }
                      } 
                    })}
                    className="w-full px-3 py-2 bg-dark-900 border border-green-500/40 rounded-lg text-green-400 text-sm font-semibold focus:border-green-500 focus:outline-none"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-red-400 mb-1">❌ Défaites Ranked CDL</label>
                  <input
                    type="number"
                    value={formData.rankedStats?.cdl?.losses || 0}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      rankedStats: { 
                        ...formData.rankedStats, 
                        cdl: {
                          ...formData.rankedStats?.cdl,
                          losses: parseInt(e.target.value) || 0
                        }
                      } 
                    })}
                    className="w-full px-3 py-2 bg-dark-900 border border-red-500/40 rounded-lg text-red-400 text-sm font-semibold focus:border-red-500 focus:outline-none"
                    min={0}
                  />
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Rôles</label>
              <div className="space-y-2">
                {['user', 'staff', 'arbitre', 'gerant_cdl', 'gerant_hardcore', 'admin'].map((role) => (
                  <label key={role} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.roles?.includes(role) || false}
                      onChange={(e) => {
                        const currentRoles = formData.roles || ['user'];
                        if (e.target.checked) {
                          setFormData({ ...formData, roles: [...currentRoles, role] });
                        } else {
                          setFormData({ ...formData, roles: currentRoles.filter(r => r !== role) });
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-white capitalize">{role}</span>
                  </label>
                ))}
              </div>
            </div>
            
            {/* Match History Management Section */}
            {editingItem && (
              <div className="border-t border-white/10 pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-blue-400 flex items-center gap-2">
                    <Swords className="w-4 h-4" />
                    Historique des Matchs
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      if (!showUserMatchHistory) {
                        fetchUserMatches(editingItem._id);
                      }
                      setShowUserMatchHistory(!showUserMatchHistory);
                    }}
                    className="px-3 py-1.5 text-xs bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors flex items-center gap-1"
                  >
                    {showUserMatchHistory ? (
                      <>
                        <EyeOff className="w-3 h-3" />
                        Masquer
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" />
                        Voir/Gérer
                      </>
                    )}
                  </button>
                </div>
                
                {showUserMatchHistory && (
                  <div className="bg-dark-900/50 rounded-lg border border-white/5 p-3">
                    {loadingUserMatches ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                      </div>
                    ) : (
                      <>
                        {/* Ladder Matches */}
                        <div className="mb-4">
                          <h5 className="text-xs font-medium text-orange-400 mb-2 flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            Matchs Ladder ({userMatches.ladder.length})
                          </h5>
                          {userMatches.ladder.length === 0 ? (
                            <p className="text-gray-500 text-xs">Aucun match ladder</p>
                          ) : (
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {userMatches.ladder.map((match) => (
                                <div 
                                  key={match._id} 
                                  className={`flex items-center justify-between gap-2 p-2 rounded-lg text-xs ${
                                    match.status === 'completed'
                                      ? match.isWinner
                                        ? 'bg-green-500/10 border border-green-500/20'
                                        : 'bg-red-500/10 border border-red-500/20'
                                      : 'bg-gray-500/10 border border-gray-500/20'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      match.status === 'completed'
                                        ? match.isWinner ? 'bg-green-500/30 text-green-300' : 'bg-red-500/30 text-red-300'
                                        : 'bg-gray-500/30 text-gray-300'
                                    }`}>
                                      {match.status === 'completed' ? (match.isWinner ? 'V' : 'D') : match.status.charAt(0).toUpperCase()}
                                    </span>
                                    <span className="text-gray-300 truncate">
                                      {match.playerSquad} vs {match.opponent || '?'}
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                      match.mode === 'cdl' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-orange-500/20 text-orange-400'
                                    }`}>
                                      {match.mode?.toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-500 text-[10px]">
                                      {new Date(match.createdAt).toLocaleDateString('fr-FR')}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteUserMatch(match._id, 'ladder')}
                                      disabled={deletingMatchId === match._id}
                                      className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
                                      title="Supprimer ce match"
                                    >
                                      {deletingMatchId === match._id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Trash2 className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {/* Ranked Matches */}
                        <div>
                          <h5 className="text-xs font-medium text-purple-400 mb-2 flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            Matchs Ranked ({userMatches.ranked.length})
                          </h5>
                          {userMatches.ranked.length === 0 ? (
                            <p className="text-gray-500 text-xs">Aucun match ranked</p>
                          ) : (
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {userMatches.ranked.map((match) => (
                                <div 
                                  key={match._id}
                                  className={`flex items-center justify-between gap-2 p-2 rounded-lg text-xs ${
                                    match.status === 'completed'
                                      ? match.isWinner
                                        ? 'bg-green-500/10 border border-green-500/20'
                                        : 'bg-red-500/10 border border-red-500/20'
                                      : 'bg-gray-500/10 border border-gray-500/20'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      match.status === 'completed'
                                        ? match.isWinner ? 'bg-green-500/30 text-green-300' : 'bg-red-500/30 text-red-300'
                                        : 'bg-gray-500/30 text-gray-300'
                                    }`}>
                                      {match.status === 'completed' ? (match.isWinner ? 'V' : 'D') : match.status.charAt(0).toUpperCase()}
                                    </span>
                                    <span className="text-gray-300">
                                      {match.teamSize}v{match.teamSize} {match.gameMode}
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                      match.mode === 'cdl' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-orange-500/20 text-orange-400'
                                    }`}>
                                      {match.mode?.toUpperCase()}
                                    </span>
                                    <span className="text-gray-500">Team {match.team}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-500 text-[10px]">
                                      {new Date(match.createdAt).toLocaleDateString('fr-FR')}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteUserMatch(match._id, 'ranked')}
                                      disabled={deletingMatchId === match._id}
                                      className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
                                      title="Supprimer ce match"
                                    >
                                      {deletingMatchId === match._id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Trash2 className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <p className="text-gray-500 text-[10px] mt-3 italic">
                          ⚠️ La suppression d'un match complété rembourse automatiquement les stats des joueurs
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        );

      case 'squad':
        return (
          <>
                  <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Nom *</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                required
              />
                  </div>
                  <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Tag *</label>
              <input
                type="text"
                value={formData.tag || ''}
                onChange={(e) => setFormData({ ...formData, tag: e.target.value.replace(/[^A-Za-z0-9]/g, '') })}
                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                maxLength={5}
                required
              />
                  </div>
                  <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                rows={3}
              />
                  </div>
                  <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Mode</label>
              <select
                value={formData.mode || 'both'}
                onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
              >
                <option value="hardcore">Hardcore</option>
                <option value="cdl">CDL</option>
                <option value="both">Les deux</option>
              </select>
                  </div>
                  <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Couleur</label>
              <input
                type="color"
                value={formData.color || '#ef4444'}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-full h-12 px-4 py-2 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
              />
                  </div>
                  <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Membres max</label>
              <input
                type="number"
                value={formData.maxMembers || 10}
                onChange={(e) => setFormData({ ...formData, maxMembers: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                min={2}
                max={20}
              />
                  </div>
            
            {/* Stats Top Escouade - Admin Only */}
            {userIsAdmin && (
              <div className="border-t border-white/10 pt-4 mt-4">
                <h4 className="text-sm font-medium text-purple-400 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Top Escouade (Classement Général)
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Points Top Escouade</label>
                    <input
                      type="number"
                      value={formData.statsHardcore?.totalPoints ?? editingItem?.statsHardcore?.totalPoints ?? 0}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        statsHardcore: { 
                          ...formData.statsHardcore,
                          totalPoints: parseInt(e.target.value) || 0 
                        } 
                      })}
                      className="w-full px-3 py-2 bg-dark-800 border border-amber-500/30 rounded-lg text-amber-400 focus:outline-none focus:border-amber-500/50 font-bold"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Victoires</label>
                    <input
                      type="number"
                      value={formData.statsHardcore?.totalWins ?? editingItem?.statsHardcore?.totalWins ?? 0}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        statsHardcore: { 
                          ...formData.statsHardcore,
                          totalWins: parseInt(e.target.value) || 0 
                        } 
                      })}
                      className="w-full px-3 py-2 bg-dark-800 border border-green-500/30 rounded-lg text-green-400 focus:outline-none focus:border-green-500/50"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Défaites</label>
                    <input
                      type="number"
                      value={formData.statsHardcore?.totalLosses ?? editingItem?.statsHardcore?.totalLosses ?? 0}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        statsHardcore: { 
                          ...formData.statsHardcore,
                          totalLosses: parseInt(e.target.value) || 0 
                        } 
                      })}
                      className="w-full px-3 py-2 bg-dark-800 border border-red-500/30 rounded-lg text-red-400 focus:outline-none focus:border-red-500/50"
                      min={0}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        );

      case 'shopItem':
        return (
          <>
                <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Nom *</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                required
              />
                </div>
                <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                rows={3}
                required
              />
                </div>

            {/* Translations */}
            <div className="border border-white/10 rounded-xl p-4 space-y-4">
              <p className="text-white font-medium text-sm">Traductions</p>
              <p className="text-gray-400 text-xs -mt-2">Le nom/description principal sera utilisé si aucune traduction n'est définie</p>
              
              {/* Names */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Nom FR</label>
                  <input
                    type="text"
                    value={formData.nameTranslations?.fr || ''}
                    onChange={(e) => setFormData({ ...formData, nameTranslations: { ...formData.nameTranslations, fr: e.target.value }})}
                    className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50"
                    placeholder="Nom en français"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Nom EN</label>
                  <input
                    type="text"
                    value={formData.nameTranslations?.en || ''}
                    onChange={(e) => setFormData({ ...formData, nameTranslations: { ...formData.nameTranslations, en: e.target.value }})}
                    className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50"
                    placeholder="Name in English"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Nom DE</label>
                  <input
                    type="text"
                    value={formData.nameTranslations?.de || ''}
                    onChange={(e) => setFormData({ ...formData, nameTranslations: { ...formData.nameTranslations, de: e.target.value }})}
                    className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50"
                    placeholder="Name auf Deutsch"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Nom IT</label>
                  <input
                    type="text"
                    value={formData.nameTranslations?.it || ''}
                    onChange={(e) => setFormData({ ...formData, nameTranslations: { ...formData.nameTranslations, it: e.target.value }})}
                    className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50"
                    placeholder="Nome in italiano"
                  />
                </div>
              </div>
              
              {/* Descriptions */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Description FR</label>
                  <textarea
                    value={formData.descriptionTranslations?.fr || ''}
                    onChange={(e) => setFormData({ ...formData, descriptionTranslations: { ...formData.descriptionTranslations, fr: e.target.value }})}
                    className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50"
                    rows={2}
                    placeholder="Description en français"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Description EN</label>
                  <textarea
                    value={formData.descriptionTranslations?.en || ''}
                    onChange={(e) => setFormData({ ...formData, descriptionTranslations: { ...formData.descriptionTranslations, en: e.target.value }})}
                    className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50"
                    rows={2}
                    placeholder="Description in English"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Description DE</label>
                  <textarea
                    value={formData.descriptionTranslations?.de || ''}
                    onChange={(e) => setFormData({ ...formData, descriptionTranslations: { ...formData.descriptionTranslations, de: e.target.value }})}
                    className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50"
                    rows={2}
                    placeholder="Beschreibung auf Deutsch"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Description IT</label>
                  <textarea
                    value={formData.descriptionTranslations?.it || ''}
                    onChange={(e) => setFormData({ ...formData, descriptionTranslations: { ...formData.descriptionTranslations, it: e.target.value }})}
                    className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50"
                    rows={2}
                    placeholder="Descrizione in italiano"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                  <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Catégorie</label>
                <select
                  value={formData.category || 'other'}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                >
                  <option value="usable_item">Objet utilisable</option>
                  <option value="profile_animation">Animation profil</option>
                  <option value="avatar_frame">Cadre Avatar</option>
                  <option value="ornament">Ornement</option>
                  <option value="badge">Badge</option>
                  <option value="title">Titre</option>
                  <option value="boost">Boost</option>
                  <option value="cosmetic">Cosmétique</option>
                  <option value="emote">Emote</option>
                  <option value="other">Autre</option>
                    </select>
                  </div>
                  <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Rareté</label>
                <select
                  value={formData.rarity || 'common'}
                  onChange={(e) => setFormData({ ...formData, rarity: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                >
                  <option value="common">Commun</option>
                  <option value="rare">Rare</option>
                  <option value="epic">Épique</option>
                  <option value="legendary">Légendaire</option>
                </select>
                  </div>
                </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Prix</label>
                <input
                  type="number"
                  value={formData.price || 0}
                  onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  min={0}
                  required
                />
                </div>
                  <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Stock (-1 = illimité)</label>
                <input
                  type="number"
                  value={formData.stock !== undefined ? formData.stock : -1}
                  onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                />
              </div>
                  </div>
                  <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Mode</label>
              <select
                value={formData.mode || 'all'}
                onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
              >
                      <option value="all">Tous les modes</option>
                      <option value="hardcore">Hardcore uniquement</option>
                      <option value="cdl">CDL uniquement</option>
                    </select>
                  </div>
            
            {/* Usable Item Configuration */}
            <div className="border-t border-white/10 pt-4 mt-4">
              <label className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  checked={formData.isUsable || false}
                  onChange={(e) => setFormData({ ...formData, isUsable: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-white font-medium">Objet utilisable (consommable)</span>
              </label>
              
              {formData.isUsable && (
                <div className="space-y-4 bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Type d'effet</label>
                      <select
                        value={formData.effectType || 'other'}
                        onChange={(e) => setFormData({ ...formData, effectType: e.target.value })}
                        className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                      >
                        <option value="double_pts">Double Points</option>
                        <option value="double_gold">Double Gold</option>
                        <option value="double_xp">Double XP</option>
                        <option value="cancel_match">Annuler Match</option>
                        <option value="emote">Emote</option>
                        <option value="other">Autre</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Nombre de matchs</label>
                      <input
                        type="number"
                        value={formData.matchCount !== undefined ? formData.matchCount : 3}
                        onChange={(e) => setFormData({ ...formData, matchCount: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                        min={0}
                        placeholder="0 = usage unique"
                      />
                      <p className="text-gray-500 text-xs mt-1">0 = usage unique, vide = illimité</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.usableInMatch || false}
                        onChange={(e) => setFormData({ ...formData, usableInMatch: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-white text-sm">Utilisable en match</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.allowMultiplePurchases || false}
                        onChange={(e) => setFormData({ ...formData, allowMultiplePurchases: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-white text-sm">Achats multiples autorisés</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive !== undefined ? formData.isActive : true}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-white">Actif</span>
              </label>
                </div>
          </>
        );

      case 'trophy':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Nom *</label>
              <input 
                type="text" 
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" 
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
              <textarea 
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                rows={2} 
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Icône</label>
                <select 
                  value={formData.icon || 'Trophy'}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                >
                  <option value="Trophy">🏆 Trophy</option>
                  <option value="Award">🎖️ Award</option>
                  <option value="Medal">🥇 Medal</option>
                  <option value="Star">⭐ Star</option>
                  <option value="Crown">👑 Crown</option>
                  <option value="Shield">🛡️ Shield</option>
                  <option value="Zap">⚡ Zap</option>
                  <option value="Target">🎯 Target</option>
                  <option value="Flame">🔥 Flame</option>
                  <option value="Gem">💎 Gem</option>
                  <option value="Heart">❤️ Heart</option>
                  <option value="Sword">⚔️ Sword</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Couleur</label>
                <select 
                  value={formData.color || 'amber'}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                >
                  <option value="amber">🟠 Amber</option>
                  <option value="yellow">🟡 Yellow</option>
                  <option value="orange">🟧 Orange</option>
                  <option value="red">🔴 Red</option>
                  <option value="pink">💗 Pink</option>
                  <option value="purple">🟣 Purple</option>
                  <option value="blue">🔵 Blue</option>
                  <option value="cyan">🩵 Cyan</option>
                  <option value="green">🟢 Green</option>
                  <option value="emerald">💚 Emerald</option>
                  <option value="gray">⚪ Gray</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Niveau de rareté (1-5)</label>
                <input 
                  type="number" 
                  value={formData.rarity || 1}
                  onChange={(e) => setFormData({ ...formData, rarity: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" 
                  min={1}
                  max={5}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nom de rareté</label>
                <select
                  value={formData.rarityName || 'common'}
                  onChange={(e) => setFormData({ ...formData, rarityName: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                >
                  <option value="common">Commun</option>
                  <option value="uncommon">Peu commun</option>
                  <option value="rare">Rare</option>
                  <option value="epic">Épique</option>
                  <option value="legendary">Légendaire</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isDefault || false}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-white">Trophée par défaut (donné automatiquement à la création d'escouade)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive !== undefined ? formData.isActive : true}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-white">Actif</span>
              </label>
            </div>
          </>
        );

      case 'announcement':
        return (
          <>
                <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Titre *</label>
                        <input 
                          type="text" 
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Contenu *</label>
              <textarea
                value={formData.content || ''}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                rows={5}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                        <select 
                  value={formData.type || 'announcement'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                >
                  <option value="patch_note">Patch Note</option>
                  <option value="announcement">Annonce</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="event">Événement</option>
                  <option value="rules">Règlement</option>
                  <option value="important">Important</option>
                        </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Priorité</label>
                <select
                  value={formData.priority || 'normal'}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                >
                  <option value="low">Basse</option>
                  <option value="normal">Normale</option>
                  <option value="high">Haute</option>
                  <option value="critical">Critique</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Mode cible</label>
              <select
                value={formData.targetMode || 'all'}
                onChange={(e) => setFormData({ ...formData, targetMode: e.target.value })}
                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
              >
                <option value="all">Tous</option>
                <option value="hardcore">Hardcore</option>
                <option value="cdl">CDL</option>
              </select>
                      </div>
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.requiresAcknowledgment !== undefined ? formData.requiresAcknowledgment : true}
                  onChange={(e) => setFormData({ ...formData, requiresAcknowledgment: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-white">Requiert une confirmation</span>
              </label>
                  </div>
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive !== undefined ? formData.isActive : true}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-white">Actif</span>
              </label>
                </div>
          </>
        );

      case 'season':
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Numéro *</label>
                <input
                  type="number"
                  value={formData.number || 1}
                  onChange={(e) => setFormData({ ...formData, number: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  min={1}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Mode</label>
                <select
                  value={formData.mode || 'hardcore'}
                  onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                >
                  <option value="hardcore">Hardcore</option>
                  <option value="cdl">CDL</option>
                </select>
                </div>
                </div>
                  <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Nom *</label>
                    <input 
                      type="text" 
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" 
                required
                    />
                  </div>
            <div className="grid grid-cols-2 gap-4">
                  <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Date de début *</label>
                    <input 
                  type="date"
                  value={formData.startDate || ''}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                      required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Date de fin *</label>
                <input
                  type="date"
                  value={formData.endDate || ''}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" 
                  required
                    />
                  </div>
                </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Statut</label>
              <select
                value={formData.status || 'upcoming'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
              >
                <option value="upcoming">À venir</option>
                <option value="active">Active</option>
                <option value="ended">Terminée</option>
              </select>
                        </div>
          </>
        );

      case 'map':
        // Helper function to toggle game mode in config
        const toggleMapGameMode = (configKey, matchType, gameMode) => {
          const defaultLadder = { enabled: false, gameModes: [] };
          const defaultRanked = { enabled: false, gameModes: [], formats: [] };
          
          const config = formData[configKey] || {
            ladder: { ...defaultLadder },
            ranked: { ...defaultRanked }
          };
          
          const matchConfig = matchType === 'ranked' 
            ? { ...defaultRanked, ...config[matchType] }
            : { ...defaultLadder, ...config[matchType] };
          
          const currentModes = matchConfig.gameModes || [];
          
          const newModes = currentModes.includes(gameMode)
            ? currentModes.filter(m => m !== gameMode)
            : [...currentModes, gameMode];
          
          const newMatchConfig = {
            ...matchConfig,
            enabled: newModes.length > 0,
            gameModes: newModes
          };
          
          setFormData({
            ...formData,
            [configKey]: {
              ladder: matchType === 'ladder' ? newMatchConfig : (config.ladder || defaultLadder),
              ranked: matchType === 'ranked' ? newMatchConfig : (config.ranked || defaultRanked)
            }
          });
        };

        // Helper to check if a game mode is selected
        const isGameModeSelected = (configKey, matchType, gameMode) => {
          return (formData[configKey]?.[matchType]?.gameModes || []).includes(gameMode);
        };

        // Helper to toggle entire section enabled
        const toggleSectionEnabled = (configKey, matchType) => {
          const defaultLadder = { enabled: false, gameModes: [] };
          const defaultRanked = { enabled: false, gameModes: [], formats: [] };
          
          const config = formData[configKey] || {
            ladder: { ...defaultLadder },
            ranked: { ...defaultRanked }
          };
          
          const matchConfig = matchType === 'ranked' 
            ? { ...defaultRanked, ...config[matchType] }
            : { ...defaultLadder, ...config[matchType] };
          
          const newMatchConfig = {
            ...matchConfig,
            enabled: !matchConfig.enabled
          };
          
          setFormData({
            ...formData,
            [configKey]: {
              ladder: matchType === 'ladder' ? newMatchConfig : (config.ladder || defaultLadder),
              ranked: matchType === 'ranked' ? newMatchConfig : (config.ranked || defaultRanked)
            }
          });
        };

        // Game modes available for each context
        const hardcoreLadderModes = ['Search & Destroy'];
        const hardcoreRankedModes = ['Search & Destroy', 'Team Deathmatch', 'Duel'];
        const cdlLadderModes = ['Hardpoint', 'Search & Destroy', 'Variant'];
        const cdlRankedModes = ['Hardpoint', 'Search & Destroy'];
        
        // Available formats for ranked
        // CDL: uniquement 4v4, Hardcore: 4v4 et 5v5
        const cdlRankedFormats = ['4v4'];
        const hardcoreRankedFormats = ['4v4', '5v5'];

        // Labels for game modes
        const gameModeLabels = {
          'Search & Destroy': 'Recherche & Destruction',
          'Team Deathmatch': 'Mêlée Générale',
          'Duel': 'Duel (1v1)',
          'Hardpoint': 'Points Stratégiques',
          'Variant': 'Variant (HP/S&D/Control)'
        };

        // Helper function to toggle ranked format
        const toggleRankedFormat = (configKey, format) => {
          const defaultLadder = { enabled: false, gameModes: [] };
          const defaultRanked = { enabled: false, gameModes: [], formats: [] };
          
          const config = formData[configKey] || {
            ladder: { ...defaultLadder },
            ranked: { ...defaultRanked }
          };
          
          const rankedConfig = { ...defaultRanked, ...config.ranked };
          const currentFormats = rankedConfig.formats || [];
          
          const newFormats = currentFormats.includes(format)
            ? currentFormats.filter(f => f !== format)
            : [...currentFormats, format];
          
          setFormData({
            ...formData,
            [configKey]: {
              ladder: config.ladder || defaultLadder,
              ranked: {
                ...rankedConfig,
                formats: newFormats
              }
            }
          });
        };

        // Helper to check if a format is selected
        const isFormatSelected = (configKey, format) => {
          return (formData[configKey]?.ranked?.formats || []).includes(format);
        };

        return (
          <>
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nom de la carte *</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  placeholder="Ex: Raid, Terminal..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Image URL</label>
                <input
                  type="text"
                  value={formData.image || ''}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  placeholder="https://..."
                />
              </div>
            </div>

            {/* HARDCORE Section */}
            <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <h4 className="text-lg font-bold text-orange-400">HARDCORE</h4>
              </div>

              {/* Hardcore Ladder */}
              <div className="p-3 bg-dark-800/50 rounded-lg border border-orange-500/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">Ladder (Duo/Trio, Squad/Team)</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hardcoreConfig?.ladder?.enabled || false}
                      onChange={() => toggleSectionEnabled('hardcoreConfig', 'ladder')}
                      className="w-4 h-4 accent-orange-500"
                    />
                    <span className="text-xs text-gray-400">Activer</span>
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {hardcoreLadderModes.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => toggleMapGameMode('hardcoreConfig', 'ladder', mode)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        isGameModeSelected('hardcoreConfig', 'ladder', mode)
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-dark-900 text-gray-400 border-white/10 hover:border-orange-500/50'
                      }`}
                    >
                      {gameModeLabels[mode] || mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hardcore Ranked */}
              <div className="p-3 bg-dark-800/50 rounded-lg border border-orange-500/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">Match Ranked</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hardcoreConfig?.ranked?.enabled || false}
                      onChange={() => toggleSectionEnabled('hardcoreConfig', 'ranked')}
                      className="w-4 h-4 accent-orange-500"
                    />
                    <span className="text-xs text-gray-400">Activer</span>
                  </label>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-gray-500 mb-2 block">Modes de jeu</span>
                    <div className="flex flex-wrap gap-2">
                      {hardcoreRankedModes.map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => toggleMapGameMode('hardcoreConfig', 'ranked', mode)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                            isGameModeSelected('hardcoreConfig', 'ranked', mode)
                              ? 'bg-orange-500 text-white border-orange-500'
                              : 'bg-dark-900 text-gray-400 border-white/10 hover:border-orange-500/50'
                          }`}
                        >
                          {gameModeLabels[mode] || mode}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 mb-2 block">Formats disponibles</span>
                    <div className="flex flex-wrap gap-2">
                      {hardcoreRankedFormats.map((format) => (
                        <button
                          key={format}
                          type="button"
                          onClick={() => toggleRankedFormat('hardcoreConfig', format)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                            isFormatSelected('hardcoreConfig', format)
                              ? 'bg-orange-600 text-white border-orange-600'
                              : 'bg-dark-900 text-gray-400 border-white/10 hover:border-orange-500/50'
                          }`}
                        >
                          {format}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CDL Section */}
            <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
                <h4 className="text-lg font-bold text-cyan-400">CDL</h4>
              </div>

              {/* CDL Ladder */}
              <div className="p-3 bg-dark-800/50 rounded-lg border border-cyan-500/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">Ladder (Duo/Trio, Squad/Team)</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.cdlConfig?.ladder?.enabled || false}
                      onChange={() => toggleSectionEnabled('cdlConfig', 'ladder')}
                      className="w-4 h-4 accent-cyan-500"
                    />
                    <span className="text-xs text-gray-400">Activer</span>
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {cdlLadderModes.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => toggleMapGameMode('cdlConfig', 'ladder', mode)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        isGameModeSelected('cdlConfig', 'ladder', mode)
                          ? 'bg-cyan-500 text-white border-cyan-500'
                          : 'bg-dark-900 text-gray-400 border-white/10 hover:border-cyan-500/50'
                      }`}
                    >
                      {gameModeLabels[mode] || mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* CDL Ranked */}
              <div className="p-3 bg-dark-800/50 rounded-lg border border-cyan-500/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">Match Ranked</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.cdlConfig?.ranked?.enabled || false}
                      onChange={() => toggleSectionEnabled('cdlConfig', 'ranked')}
                      className="w-4 h-4 accent-cyan-500"
                    />
                    <span className="text-xs text-gray-400">Activer</span>
                  </label>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-gray-500 mb-2 block">Modes de jeu</span>
                    <div className="flex flex-wrap gap-2">
                      {cdlRankedModes.map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => toggleMapGameMode('cdlConfig', 'ranked', mode)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                            isGameModeSelected('cdlConfig', 'ranked', mode)
                              ? 'bg-cyan-500 text-white border-cyan-500'
                              : 'bg-dark-900 text-gray-400 border-white/10 hover:border-cyan-500/50'
                          }`}
                        >
                          {gameModeLabels[mode] || mode}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 mb-2 block">Formats disponibles (CDL: 4v4 uniquement)</span>
                    <div className="flex flex-wrap gap-2">
                      {cdlRankedFormats.map((format) => (
                        <button
                          key={format}
                          type="button"
                          onClick={() => toggleRankedFormat('cdlConfig', format)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                            isFormatSelected('cdlConfig', format)
                              ? 'bg-cyan-600 text-white border-cyan-600'
                              : 'bg-dark-900 text-gray-400 border-white/10 hover:border-cyan-500/50'
                          }`}
                        >
                          {format}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* STRICKER Section */}
            <div className="p-4 bg-lime-500/5 border border-lime-500/20 rounded-xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-lime-500"></div>
                <h4 className="text-lg font-bold text-lime-400">STRICKER</h4>
                <span className="text-xs text-lime-400/60">(5v5 S&D uniquement)</span>
              </div>

              {/* Stricker Ranked */}
              <div className="p-3 bg-dark-800/50 rounded-lg border border-lime-500/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">Match Ranked Stricker</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.strickerConfig?.ranked?.enabled || false}
                      onChange={() => toggleSectionEnabled('strickerConfig', 'ranked')}
                      className="w-4 h-4 accent-lime-500"
                    />
                    <span className="text-xs text-gray-400">Activer</span>
                  </label>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-gray-500 mb-2 block">Mode de jeu (S&D uniquement)</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => toggleMapGameMode('strickerConfig', 'ranked', 'Search & Destroy')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                          isGameModeSelected('strickerConfig', 'ranked', 'Search & Destroy')
                            ? 'bg-lime-500 text-white border-lime-500'
                            : 'bg-dark-900 text-gray-400 border-white/10 hover:border-lime-500/50'
                        }`}
                      >
                        Recherche & Destruction
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 mb-2 block">Format</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => toggleRankedFormat('strickerConfig', '3v3')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                          isFormatSelected('strickerConfig', '3v3')
                            ? 'bg-lime-600 text-white border-lime-600'
                            : 'bg-dark-900 text-gray-400 border-white/10 hover:border-lime-500/50'
                        }`}
                      >
                        3v3
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleRankedFormat('strickerConfig', '5v5')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                          isFormatSelected('strickerConfig', '5v5')
                            ? 'bg-lime-600 text-white border-lime-600'
                            : 'bg-dark-900 text-gray-400 border-white/10 hover:border-lime-500/50'
                        }`}
                      >
                        5v5
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Status */}
            <div className="flex items-center justify-between p-3 bg-dark-800/50 rounded-xl border border-white/10">
              <span className="text-white font-medium">Carte active</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive !== undefined ? formData.isActive : true}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
              </label>
            </div>

            {/* Info Note */}
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
              <p className="text-xs text-purple-300">
                <strong>Note:</strong> Sélectionnez les modes de jeu pour lesquels cette carte sera disponible. 
                Les cartes seront automatiquement filtrées lors de la création des matchs en fonction de votre configuration.
              </p>
            </div>
          </>
        );

      default:
        return (
          <p className="text-gray-400 text-center py-8">
            Type de formulaire non reconnu: {modalType}
          </p>
        );
    }
  };

  const renderContent = () => {
    if (loading && (users.length === 0 && squads.length === 0 && shopItems.length === 0)) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return <AdminOverview stats={stats} />;
      case 'users':
        return (
          <AdminUsers
            users={users}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            page={page}
            setPage={setPage}
            totalPages={totalPages}
            openEditModal={openEditModal}
            openBanModal={openBanModal}
            openWarnModal={openWarnModal}
            openRankedBanModal={openRankedBanModal}
            setResetStatsConfirm={setResetStatsConfirm}
            setDeleteConfirm={setDeleteConfirm}
            handleToggleReferentBan={handleToggleReferentBan}
            formatDate={formatDate}
            getRoleColor={getRoleColor}
            userIsArbitre={userIsArbitre && !userIsStaff}
            userIsAdmin={userIsAdmin}
            openUserPurchasesModal={openUserPurchasesModal}
            openGiveItemModal={openGiveItemModal}
            openUserTrophiesModal={openUserTrophiesModal}
            currentUser={user}
          />
        );
      case 'squads':
        return (
          <AdminSquads
            squads={squads}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            page={page}
            setPage={setPage}
            totalPages={totalPages}
            userIsAdmin={userIsAdmin}
            userIsArbitre={userIsArbitre}
            openEditModal={openEditModal}
            openStrickerStatsModal={openStrickerStatsModal}
            openSquadTrophyModal={openSquadTrophyModal}
            setDeleteConfirm={setDeleteConfirm}
            handleKickMember={handleKickMember}
            handleResetSquadStricker={handleResetSquadStricker}
          />
        );
      case 'iris':
        return renderIrisPlayers();
      case 'deleted-accounts':
        return renderDeletedAccounts();
      case 'messages':
        return renderMessages();
      case 'shop':
        return renderShop();
      case 'trophies':
        return renderTrophies();
      case 'announcements':
        return renderAnnouncements();
      case 'maps':
        return renderMaps();
      case 'gamerules':
        return renderGameRules();
      case 'matches':
        return renderMatches();
      case 'application':
        return (
          <AdminApplication
            appSettings={appSettings}
            setAppSettings={setAppSettings}
            fetchAppSettings={fetchAppSettings}
            setSuccess={setSuccess}
            setError={setError}
          />
        );
      case 'team':
        return <AdminTeam />;
      case 'config':
        return renderConfig();
      case 'seasons':
        return renderSeasons();
      case 'system':
        return renderSystem();
      default:
        return <div className="text-center text-gray-400 py-20">Section non trouvée</div>;
    }
  };

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button 
                onClick={() => navigate('/')}
                className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-5 sm:w-6 h-5 sm:h-6 text-white" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3">
                  <Shield className="w-5 sm:w-7 lg:w-8 h-5 sm:h-7 lg:h-8 text-purple-400 flex-shrink-0" />
                  <span className="truncate">Panel Admin</span>
                </h1>
                <p className="text-gray-400 mt-0.5 sm:mt-1 text-xs sm:text-sm hidden sm:block">Gérez toutes les données de la plateforme</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <div className="text-right hidden sm:block">
                <p className="text-white font-medium text-sm sm:text-base">{user?.username}</p>
                <p className="text-xs sm:text-sm text-purple-400">Administrateur</p>
              </div>
              <img
                src={getAvatarUrl(user?.avatarUrl || user?.avatar) || '/avatar.jpg'}
                alt="Avatar"
                className="w-9 sm:w-12 h-9 sm:h-12 rounded-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {(success || error) && (
        <div className="fixed top-4 right-4 z-50 max-w-md">
          {success && (
            <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 mb-2">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <p className="text-green-400 font-medium">{success}</p>
                </div>
            </div>
          )}
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <p className="text-red-400 font-medium">{error}</p>
                  </div>
                </div>
          )}
                </div>
      )}

      {/* Navigation Tabs - Mobile Dropdown + Desktop Tabs */}
      <div className="bg-dark-900/80 backdrop-blur-xl border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {/* Mobile Navigation */}
          <div className="lg:hidden py-3">
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="w-full flex items-center justify-between px-4 py-3 bg-dark-800/80 border border-white/10 rounded-xl text-white"
            >
              <div className="flex items-center gap-3">
                {(() => {
                  const currentTab = allTabs.find(t => t.id === activeTab);
                  const Icon = currentTab?.icon || BarChart3;
                  return (
                    <>
                      <Icon className="w-5 h-5 text-purple-400" />
                      <span className="font-medium">{currentTab?.label || 'Menu'}</span>
                    </>
                  );
                })()}
              </div>
              <Menu className={`w-5 h-5 text-gray-400 transition-transform ${showMobileMenu ? 'rotate-90' : ''}`} />
            </button>
            
            {/* Mobile Dropdown Menu */}
            {showMobileMenu && (
              <div className="absolute left-3 right-3 mt-2 bg-dark-800 border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50">
                <div className="max-h-[70vh] overflow-y-auto">
                  {tabGroups.map((group) => {
                    if (group.adminOnly && !userIsAdmin) return null;
                    
                    const visibleTabs = group.tabs.filter(tab => {
                      if (tab.adminOnly && !userIsAdmin) return false;
                      if (!userIsAdmin && !getStaffAccess(tab.id)) return false;
                      return true;
                    });
                    
                    if (visibleTabs.length === 0) return null;
                    
                    return (
                      <div key={group.name} className="border-b border-white/5 last:border-b-0">
                        <div className="px-4 py-2 bg-dark-900/50">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            {group.name}
                          </span>
                        </div>
                        <div className="py-1">
                          {visibleTabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                              <button
                                key={tab.id}
                                onClick={() => {
                                  setActiveTab(tab.id);
                                  setActiveSubTab('');
                                  setSearchTerm('');
                                  setPage(1);
                                  setShowMobileMenu(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
                                  isActive
                                    ? 'bg-gradient-to-r from-purple-500/20 to-pink-600/20 text-white border-l-2 border-purple-500'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                              >
                                <Icon className={`w-5 h-5 ${isActive ? 'text-purple-400' : ''}`} />
                                <span className="font-medium">{tab.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-4 overflow-x-auto py-3 pb-4 scrollbar-hide" style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#6b21a8 #1f2937'
          }}>
            {tabGroups.map((group) => {
              if (group.adminOnly && !userIsAdmin) return null;
              
              const visibleTabs = group.tabs.filter(tab => {
                if (tab.adminOnly && !userIsAdmin) return false;
                if (!userIsAdmin && !getStaffAccess(tab.id)) return false;
                return true;
              });
              
              if (visibleTabs.length === 0) return null;
              
              return (
                <div key={group.name} className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-1">
                    {group.name}
                  </span>
                  <div className="flex items-center gap-1 bg-dark-800/50 rounded-xl p-1 border border-white/5">
                    {visibleTabs.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => {
                            setActiveTab(tab.id);
                            setActiveSubTab('');
                            setSearchTerm('');
                            setPage(1);
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                            isActive
                              ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                              : 'text-gray-400 hover:text-white hover:bg-white/10'
                          }`}
                          title={tab.label}
                        >
                          <Icon className={`w-4 h-4 ${isActive ? '' : 'opacity-70'}`} />
                          <span className="text-sm">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden" 
          onClick={() => setShowMobileMenu(false)}
        />
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {renderContent()}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowModal(false)}></div>
          <div className="relative bg-dark-900 border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl max-w-2xl w-full max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-dark-900 border-b border-white/10 p-4 sm:p-6 flex items-center justify-between">
              <h2 className="text-lg sm:text-2xl font-bold text-white">
                {editingItem ? 'Modifier' : 'Créer'} {modalType}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 sm:w-6 h-5 sm:h-6 text-gray-400" />
              </button>
            </div>
            
            <form onSubmit={editingItem ? handleUpdate : handleCreate} className="p-4 sm:p-6 space-y-4">
              {/* Form content based on modalType */}
              {renderModalForm()}

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="flex-1 py-3 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      {editingItem ? 'Mettre à jour' : 'Créer'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ban Modal */}
      {showBanModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowBanModal(false)}></div>
          <div className="relative bg-dark-900 border-t sm:border border-orange-500/20 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 max-w-md w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <div className="p-2 sm:p-3 bg-orange-500/20 rounded-xl">
                <Ban className="w-5 sm:w-6 h-5 sm:h-6 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-bold text-white truncate">Bannir {banData.username}</h3>
                <p className="text-gray-400 text-xs sm:text-sm">Configurez les paramètres du bannissement</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Raison du ban *</label>
                <textarea
                  value={banData.reason}
                  onChange={(e) => setBanData({ ...banData, reason: e.target.value })}
                  placeholder="Ex: Comportement toxique, triche, etc."
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50 resize-none"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Durée du ban</label>
                <div className="flex gap-3">
                  {/* Duration value input */}
                  {banData.durationType !== 'permanent' && (
                    <input
                      type="number"
                      value={banData.durationValue}
                      onChange={(e) => setBanData({ ...banData, durationValue: Math.max(1, parseInt(e.target.value) || 1) })}
                      min={1}
                      max={banData.durationType === 'hours' ? 24 : banData.durationType === 'days' ? 365 : 12}
                      className="w-24 px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50 text-center"
                    />
                  )}
                  
                  {/* Duration type selector */}
                  <select
                    value={banData.durationType}
                    onChange={(e) => setBanData({ ...banData, durationType: e.target.value, durationValue: 1 })}
                    className={`${banData.durationType === 'permanent' ? 'flex-1' : 'flex-1'} px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50`}
                  >
                    <option value="hours">Heure(s)</option>
                    <option value="days">Jour(s)</option>
                    <option value="months">Mois</option>
                    <option value="permanent">Permanent</option>
                  </select>
                </div>
              </div>

              {/* Quick duration buttons */}
              {banData.durationType !== 'permanent' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Raccourcis</label>
                  <div className="flex flex-wrap gap-2">
                    {banData.durationType === 'hours' && (
                      <>
                        {[1, 2, 3, 4, 6, 12, 24].map(h => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setBanData({ ...banData, durationValue: h })}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              banData.durationValue === h
                                ? 'bg-orange-500 text-white'
                                : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
                            }`}
                          >
                            {h}h
                          </button>
                        ))}
                      </>
                    )}
                    {banData.durationType === 'days' && (
                      <>
                        {[1, 2, 3, 7, 14, 30].map(d => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setBanData({ ...banData, durationValue: d })}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              banData.durationValue === d
                                ? 'bg-orange-500 text-white'
                                : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
                            }`}
                          >
                            {d}j
                          </button>
                        ))}
                      </>
                    )}
                    {banData.durationType === 'months' && (
                      <>
                        {[1, 2, 3, 6, 12].map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setBanData({ ...banData, durationValue: m })}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              banData.durationValue === m
                                ? 'bg-orange-500 text-white'
                                : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
                            }`}
                          >
                            {m} mois
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}

              {banData.durationType === 'permanent' && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-400 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Le bannissement permanent empêchera définitivement l'utilisateur d'accéder à l'application.
                  </p>
                </div>
              )}

              {/* Ban duration summary */}
              {banData.durationType !== 'permanent' && (
                <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                  <p className="text-orange-400 text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    L'utilisateur sera banni pour {banData.durationValue} {banData.durationType === 'hours' ? (banData.durationValue > 1 ? 'heures' : 'heure') : banData.durationType === 'days' ? (banData.durationValue > 1 ? 'jours' : 'jour') : 'mois'}.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 mt-4 sm:mt-6">
              <button
                onClick={() => setShowBanModal(false)}
                className="flex-1 py-3 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleBan}
                disabled={!banData.reason.trim()}
                className="flex-1 py-3 px-4 bg-orange-500 text-white font-medium rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Ban className="w-5 h-5" />
                Bannir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warn Modal */}
      {showWarnModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowWarnModal(false)}></div>
          <div className="relative bg-dark-900 border-t sm:border border-orange-500/20 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <div className="p-2 sm:p-3 bg-orange-500/20 rounded-xl">
                <AlertTriangle className="w-5 sm:w-6 h-5 sm:h-6 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-bold text-white truncate">Avertir {warnData.username}</h3>
                <p className="text-gray-400 text-xs sm:text-sm">Ajouter un avertissement au joueur</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Raison de l'avertissement *</label>
                <textarea
                  value={warnData.reason}
                  onChange={(e) => setWarnData({ ...warnData, reason: e.target.value })}
                  placeholder="Ex: Comportement inapproprié, propos offensants, abandon de match, etc."
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50 resize-none"
                  rows={3}
                  required
                />
              </div>

              {/* Abandon Warning Checkbox */}
              <div className="flex items-center gap-3 p-4 bg-dark-800/50 border border-white/10 rounded-xl">
                <input
                  type="checkbox"
                  id="abandonWarn"
                  checked={warnData.isAbandonWarn}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setWarnData({ ...warnData, isAbandonWarn: isChecked, selectedMatchId: null });
                    if (isChecked && warnData.recentMatches.length === 0) {
                      fetchUserRecentMatches(warnData.userId);
                    }
                  }}
                  className="w-5 h-5 rounded border-white/20 bg-dark-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                />
                <label htmlFor="abandonWarn" className="flex-1 cursor-pointer">
                  <span className="text-white font-medium">Warn pour abandon</span>
                  <p className="text-gray-400 text-xs mt-0.5">Annule la défaite pour les coéquipiers si le match était perdu</p>
                </label>
              </div>

              {/* Match Selection (shown when abandon checkbox is checked) */}
              {warnData.isAbandonWarn && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">
                    Sélectionner le match abandonné *
                  </label>
                  
                  {warnData.loadingMatches ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                      <span className="ml-2 text-gray-400">Chargement des matchs...</span>
                    </div>
                  ) : warnData.recentMatches.length === 0 ? (
                    <div className="p-4 bg-dark-800 rounded-xl text-center">
                      <p className="text-gray-400">Aucun match classé récent trouvé</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {warnData.recentMatches.map((match) => {
                        const isSelected = warnData.selectedMatchId === match._id;
                        const isLoss = !match.isWinner;
                        const matchDate = new Date(match.completedAt || match.createdAt);
                        
                        return (
                          <div
                            key={match._id}
                            onClick={() => setWarnData({ ...warnData, selectedMatchId: match._id })}
                            className={`p-3 rounded-xl cursor-pointer transition-all border-2 ${
                              isSelected 
                                ? 'border-purple-500 bg-purple-500/20' 
                                : 'border-transparent bg-dark-800 hover:bg-dark-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${isLoss ? 'bg-red-500' : 'bg-green-500'}`} />
                                <div>
                                  <p className="text-white font-medium text-sm">
                                    {match.gameMode} ({match.teamSize}v{match.teamSize})
                                  </p>
                                  <p className="text-gray-400 text-xs">
                                    {match.mode === 'cdl' ? 'CDL' : 'Hardcore'} • {matchDate.toLocaleDateString('fr-FR')} {matchDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 text-xs font-medium rounded ${
                                  isLoss 
                                    ? 'bg-red-500/20 text-red-400' 
                                    : 'bg-green-500/20 text-green-400'
                                }`}>
                                  {isLoss ? 'Défaite' : 'Victoire'}
                                </span>
                                {isSelected && (
                                  <CheckCircle className="w-5 h-5 text-purple-400" />
                                )}
                              </div>
                            </div>
                            {/* Show teams */}
                            <div className="mt-2 pt-2 border-t border-white/10 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-500">Equipe 1:</span>
                                <p className="text-gray-300 truncate">
                                  {match.team1?.map(p => p.username).join(', ') || 'N/A'}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500">Equipe 2:</span>
                                <p className="text-gray-300 truncate">
                                  {match.team2?.map(p => p.username).join(', ') || 'N/A'}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {warnData.selectedMatchId && (
                    <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                      <p className="text-purple-400 text-sm">
                        <strong>Pénalité abandon :</strong> Le joueur perdra <span className="text-red-400 font-bold">-60 pts</span> au classement.
                        {' '}Si ce match était une défaite, les points perdus seront restaurés pour les coéquipiers.
                        La victoire de l'équipe adverse sera conservée.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                <p className="text-orange-400 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  L'avertissement sera enregistré dans l'historique du joueur et logé sur Discord.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 mt-4 sm:mt-6">
              <button
                onClick={() => setShowWarnModal(false)}
                className="flex-1 py-3 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleWarn}
                disabled={!warnData.reason.trim() || (warnData.isAbandonWarn && !warnData.selectedMatchId)}
                className="flex-1 py-3 px-4 bg-orange-500 text-white font-medium rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-5 h-5" />
                Avertir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ranked Ban Modal */}
      {showRankedBanModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowRankedBanModal(false)}></div>
          <div className="relative bg-dark-900 border-t sm:border border-purple-500/20 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 max-w-md w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <div className="p-2 sm:p-3 bg-purple-500/20 rounded-xl">
                <Gamepad2 className="w-5 sm:w-6 h-5 sm:h-6 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-bold text-white truncate">
                  {rankedBanData.isRankedBanned ? 'Débannir' : 'Bannir'} {rankedBanData.username} du Ranked
                </h3>
                <p className="text-gray-400 text-xs sm:text-sm">
                  {rankedBanData.isRankedBanned ? 'Retirer le ban du mode classé' : 'Empêcher l\'accès au mode classé'}
                </p>
              </div>
            </div>

            {rankedBanData.isRankedBanned ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <p className="text-green-400 text-sm">
                    Ce joueur est actuellement banni du mode classé.
                    {rankedBanData.reason && (
                      <span className="block mt-1 text-gray-400">Raison: {rankedBanData.reason}</span>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Raison du ban ranked *</label>
                  <textarea
                    value={rankedBanData.reason}
                    onChange={(e) => setRankedBanData({ ...rankedBanData, reason: e.target.value })}
                    placeholder="Ex: Abandon de match, toxicité en ranked, etc."
                    className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 resize-none"
                    rows={3}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Durée</label>
                  <select
                    value={rankedBanData.duration}
                    onChange={(e) => setRankedBanData({ ...rankedBanData, duration: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="15m">15 minutes</option>
                    <option value="30m">30 minutes</option>
                    <option value="1h">1 heure</option>
                    <option value="1d">1 jour</option>
                    <option value="7d">7 jours</option>
                    <option value="30d">30 jours</option>
                    <option value="custom">Personnalisé</option>
                    <option value="permanent">Permanent</option>
                  </select>
                </div>

                {rankedBanData.duration === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Nombre de jours</label>
                    <input
                      type="number"
                      value={rankedBanData.customDays}
                      onChange={(e) => setRankedBanData({ ...rankedBanData, customDays: parseInt(e.target.value) || 1 })}
                      min={1}
                      max={365}
                      className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                )}

                {rankedBanData.duration === 'permanent' && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <p className="text-red-400 text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Le bannissement permanent empêchera définitivement l'utilisateur de jouer en ranked.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-3 mt-4 sm:mt-6">
              <button
                onClick={() => setShowRankedBanModal(false)}
                className="flex-1 py-3 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleRankedBan}
                disabled={!rankedBanData.isRankedBanned && !rankedBanData.reason.trim()}
                className={`flex-1 py-3 px-4 font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                  rankedBanData.isRankedBanned 
                    ? 'bg-green-500 text-white hover:bg-green-600' 
                    : 'bg-purple-500 text-white hover:bg-purple-600'
                }`}
              >
                <Gamepad2 className="w-5 h-5" />
                {rankedBanData.isRankedBanned ? 'Débannir du Ranked' : 'Bannir du Ranked'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Purchase History Modal (Admin only) */}
      {showUserPurchases && selectedUserForPurchases && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowUserPurchases(false)}></div>
          <div className="relative bg-dark-900 border-t sm:border border-amber-500/20 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <div className="p-2 sm:p-3 bg-amber-500/20 rounded-xl">
                <History className="w-5 sm:w-6 h-5 sm:h-6 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-bold text-white truncate">
                  Historique d'achats
                </h3>
                <p className="text-gray-400 text-xs sm:text-sm">
                  {selectedUserForPurchases.username}
                </p>
              </div>
              <button onClick={() => setShowUserPurchases(false)} className="p-2 hover:bg-white/10 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {loadingUserPurchases ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              </div>
            ) : userPurchases.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingBag className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Aucun achat pour cet utilisateur</p>
              </div>
            ) : (
              <div className="space-y-3">
                {userPurchases.map((purchase) => {
                  // Determine usage status for usable items
                  const isUsableItem = purchase.item?.isUsable;
                  const usage = purchase.usage;
                  let usageStatus = null;
                  
                  if (isUsableItem && usage) {
                    if (usage.wasConsumed) {
                      usageStatus = { text: 'Consommé', color: 'text-gray-400' };
                    } else if (usage.isActive) {
                      usageStatus = { 
                        text: `En cours (${usage.remainingMatches || 0} match${(usage.remainingMatches || 0) > 1 ? 's' : ''})`, 
                        color: 'text-green-400' 
                      };
                    } else if (usage.remainingMatches > 0) {
                      usageStatus = { 
                        text: `Non activé (${usage.remainingMatches} match${usage.remainingMatches > 1 ? 's' : ''})`, 
                        color: 'text-cyan-400' 
                      };
                    }
                  }
                  
                  return (
                    <div key={purchase._id} className="flex items-center gap-4 p-4 bg-dark-800/50 rounded-xl border border-white/5">
                      <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <ShoppingBag className="w-6 h-6 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">
                          {purchase.item?.nameTranslations?.fr || purchase.item?.name || purchase.itemSnapshot?.name || 'Objet inconnu'}
                        </p>
                        <p className="text-gray-500 text-sm">
                          {purchase.item?.category || purchase.itemSnapshot?.category} • {new Date(purchase.createdAt).toLocaleDateString('fr-FR')}
                          {purchase.isGift && <span className="ml-2 text-green-400">• Cadeau</span>}
                          {usageStatus && <span className={`ml-2 ${usageStatus.color}`}>• {usageStatus.text}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-yellow-400">
                          <Coins className="w-4 h-4" />
                          <span className="font-bold">{purchase.pricePaid}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeletePurchase(purchase._id, true)}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Supprimer et rembourser"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Give Item Modal (Admin only) */}
      {showGiveItemModal && selectedUserForGiveItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowGiveItemModal(false)}></div>
          <div className="relative bg-dark-900 border-t sm:border border-green-500/20 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 max-w-md w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <div className="p-2 sm:p-3 bg-green-500/20 rounded-xl">
                <Gift className="w-5 sm:w-6 h-5 sm:h-6 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-bold text-white truncate">
                  Donner un objet
                </h3>
                <p className="text-gray-400 text-xs sm:text-sm">
                  À {selectedUserForGiveItem.username}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Sélectionner un objet</label>
                <select
                  value={selectedItemToGive?._id || ''}
                  onChange={(e) => {
                    const item = availableShopItems.find(i => i._id === e.target.value);
                    setSelectedItemToGive(item || null);
                  }}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-green-500/50"
                >
                  <option value="">Choisir un objet...</option>
                  {availableShopItems.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.nameTranslations?.fr || item.name} ({item.category}) - {item.price} coins
                    </option>
                  ))}
                </select>
              </div>

              {selectedItemToGive && (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Gift className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{selectedItemToGive.nameTranslations?.fr || selectedItemToGive.name}</p>
                      <p className="text-green-400 text-sm">{selectedItemToGive.category} • {selectedItemToGive.rarity}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <p className="text-amber-400 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  L'objet sera donné gratuitement (sans déduction de coins)
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 mt-4 sm:mt-6">
              <button
                onClick={() => setShowGiveItemModal(false)}
                className="flex-1 py-3 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleGiveItem}
                disabled={!selectedItemToGive || givingItem}
                className="flex-1 py-3 px-4 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {givingItem ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Gift className="w-5 h-5" />
                    Donner l'objet
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Trophy Management Modal (Admin only) */}
      {showUserTrophies && selectedUserForTrophies && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowUserTrophies(false)}></div>
          <div className="relative bg-dark-900 border-t sm:border border-yellow-500/20 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <div className="p-2 sm:p-3 bg-yellow-500/20 rounded-xl">
                <Trophy className="w-5 sm:w-6 h-5 sm:h-6 text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-bold text-white truncate">
                  Gestion des Trophées
                </h3>
                <p className="text-gray-400 text-xs sm:text-sm">
                  {selectedUserForTrophies.username}
                </p>
              </div>
              <button onClick={() => setShowUserTrophies(false)} className="p-2 hover:bg-white/10 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Current Trophies */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-white font-medium">Trophées actuels ({userTrophiesList.length})</h4>
                <button
                  onClick={() => {
                    setShowAddTrophyModal(true);
                    setSelectedTrophyToAdd(null);
                    setSelectedSeasonForTrophy(1);
                  }}
                  className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm font-medium hover:bg-yellow-500/30 transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter
                </button>
              </div>
              
              {userTrophiesList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {userTrophiesList.map((trophyEntry, index) => {
                    const trophy = trophyEntry.trophy;
                    // Handle case where trophy is not populated
                    const trophyName = typeof trophy === 'object' 
                      ? (trophy?.translations?.fr?.name || trophy?.name || 'Trophée')
                      : 'Trophée';
                    
                    return (
                      <div 
                        key={trophyEntry._id || index} 
                        className="flex items-center justify-between p-3 bg-dark-800/50 rounded-xl border border-white/5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                            <Trophy className="w-5 h-5 text-yellow-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm">{trophyName}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveTrophyFromUser(trophyEntry._id)}
                          disabled={removingTrophyId === trophyEntry._id}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {removingTrophyId === trophyEntry._id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">Aucun trophée</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowUserTrophies(false)}
              className="w-full py-3 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Add Trophy to User Modal */}
      {showAddTrophyModal && selectedUserForTrophies && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowAddTrophyModal(false)}></div>
          <div className="relative bg-dark-900 border border-yellow-500/20 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              Ajouter un trophée
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Trophée</label>
                <select
                  value={userTrophyToAdd?._id || ''}
                  onChange={(e) => {
                    const trophy = trophies.find(t => t._id === e.target.value);
                    setUserTrophyToAdd(trophy || null);
                  }}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500/50"
                >
                  <option value="">Sélectionner un trophée...</option>
                  {trophies.map((trophy) => (
                    <option key={trophy._id} value={trophy._id}>
                      {trophy.translations?.fr?.name || trophy.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Saison</label>
                <input
                  type="number"
                  value={selectedSeasonForTrophy}
                  onChange={(e) => setSelectedSeasonForTrophy(parseInt(e.target.value) || 1)}
                  min="1"
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500/50"
                />
              </div>

              {userTrophyToAdd && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                      <Trophy className="w-6 h-6 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{userTrophyToAdd.translations?.fr?.name || userTrophyToAdd.name}</p>
                      <p className="text-yellow-400 text-sm">Saison {selectedSeasonForTrophy}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddTrophyModal(false)}
                className="flex-1 py-3 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleAddTrophyToUser}
                disabled={!userTrophyToAdd || addingTrophy}
                className="flex-1 py-3 px-4 bg-yellow-500 text-black font-medium rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {addingTrophy ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Trophy className="w-5 h-5" />
                    Ajouter
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Squad Trophy Modal */}
      {showSquadTrophyModal && squadForTrophy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowSquadTrophyModal(false)}></div>
          <div className="relative bg-dark-900 border border-yellow-500/20 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-yellow-500/20 rounded-xl">
                <Trophy className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Gestion des Trophées</h3>
                <p className="text-gray-400 text-sm">{squadForTrophy.name} [{squadForTrophy.tag}]</p>
              </div>
            </div>

            {/* Current Trophies */}
            <div className="mb-6">
              <h4 className="text-white font-medium mb-3">Trophées actuels</h4>
              {squadForTrophy.trophies && squadForTrophy.trophies.length > 0 ? (
                <div className="space-y-2">
                  {squadForTrophy.trophies.map((t, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                          <Trophy className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">
                            {t.trophy?.name || t.trophy?.translations?.fr?.name || 'Trophée'}
                          </p>
                          <p className="text-gray-500 text-xs">{t.reason || 'Aucune raison'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveTrophy(t.trophy?._id || t.trophy)}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm py-4 text-center">Aucun trophée attribué</p>
              )}
            </div>

            {/* Add Trophy */}
            <div className="border-t border-white/10 pt-6">
              <h4 className="text-white font-medium mb-3">Ajouter un trophée</h4>
              <div className="space-y-3">
                <select
                  value={selectedTrophyToAdd}
                  onChange={(e) => setSelectedTrophyToAdd(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500/50"
                >
                  <option value="">Sélectionner un trophée...</option>
                  {trophies.filter(trophy => 
                    !squadForTrophy.trophies?.some(t => 
                      (t.trophy?._id || t.trophy) === trophy._id
                    )
                  ).map((trophy) => (
                    <option key={trophy._id} value={trophy._id}>
                      {trophy.name || trophy.translations?.fr?.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={trophyReason}
                  onChange={(e) => setTrophyReason(e.target.value)}
                  placeholder="Raison (optionnel)"
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500/50"
                />
                <button
                  onClick={handleAssignTrophy}
                  disabled={!selectedTrophyToAdd}
                  className="w-full py-3 bg-yellow-500 text-black font-bold rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Trophy className="w-5 h-5" />
                  Attribuer le trophée
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowSquadTrophyModal(false)}
              className="w-full mt-6 py-3 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Squad Ladder Points Modal */}
      {showLadderPointsModal && squadForLadderPoints && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowLadderPointsModal(false)}></div>
          <div className="relative bg-dark-900 border border-purple-500/20 rounded-2xl p-6 max-w-lg w-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <TrendingUp className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Points Ladder</h3>
                <p className="text-gray-400 text-sm">{squadForLadderPoints.name} [{squadForLadderPoints.tag}]</p>
              </div>
            </div>

            {/* Ladder Points List */}
            <div className="space-y-4">
              {squadForLadderPoints.registeredLadders && squadForLadderPoints.registeredLadders.length > 0 ? (
                squadForLadderPoints.registeredLadders.map((ladder, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg border border-white/10">
                    <div>
                      <p className="text-white font-medium">{ladder.ladderName || ladder.ladderId}</p>
                      <p className="text-gray-500 text-xs">ID: {ladder.ladderId}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                        <span>{ladder.wins || 0} V</span>
                        <span>{ladder.losses || 0} D</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={ladderPointsEdit[ladder.ladderId] ?? ladder.points ?? 0}
                        onChange={(e) => setLadderPointsEdit({
                          ...ladderPointsEdit,
                          [ladder.ladderId]: parseInt(e.target.value) || 0
                        })}
                        className="w-24 px-3 py-2 bg-dark-700 border border-purple-500/30 rounded-lg text-white text-center font-bold focus:outline-none focus:border-purple-500"
                        min={0}
                      />
                      <span className="text-purple-400 text-sm">pts</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm py-4 text-center">Aucun ladder enregistré</p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowLadderPointsModal(false)}
                className="flex-1 py-3 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleUpdateLadderPoints}
                disabled={saving}
                className="flex-1 py-3 px-4 bg-purple-500 text-white font-medium rounded-xl hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    <Save className="w-5 h-5" />
                    Sauvegarder
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Squad Stricker Stats Modal */}
      {showStrickerStatsModal && squadForStrickerStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowStrickerStatsModal(false)}></div>
          <div className="relative bg-dark-900 border border-lime-500/20 rounded-2xl p-6 max-w-lg w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-lime-500/20 rounded-xl">
                <Target className="w-6 h-6 text-lime-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Stats Stricker</h3>
                <p className="text-gray-400 text-sm">{squadForStrickerStats.name} [{squadForStrickerStats.tag}]</p>
              </div>
            </div>

            {/* Format Selector */}
            <div className="flex items-center gap-2 mb-6 p-3 bg-dark-800/50 rounded-lg border border-lime-500/20">
              <span className="text-gray-400 text-sm">Format:</span>
              <div className="flex gap-2 flex-1">
                <button
                  onClick={() => handleStrickerFormatChange('3v3')}
                  className={`flex-1 py-2 px-4 rounded-lg font-bold transition-all ${
                    strickerStatsFormat === '3v3'
                      ? 'bg-gradient-to-r from-lime-500 to-green-500 text-white shadow-lg'
                      : 'bg-dark-700 text-gray-400 hover:text-white hover:bg-dark-600'
                  }`}
                >
                  3v3
                </button>
                <button
                  onClick={() => handleStrickerFormatChange('5v5')}
                  className={`flex-1 py-2 px-4 rounded-lg font-bold transition-all ${
                    strickerStatsFormat === '5v5'
                      ? 'bg-gradient-to-r from-lime-500 to-green-500 text-white shadow-lg'
                      : 'bg-dark-700 text-gray-400 hover:text-white hover:bg-dark-600'
                  }`}
                >
                  5v5
                </button>
              </div>
            </div>

            {/* Stricker Stats Fields */}
            <div className="space-y-4">
              {/* Points */}
              <div className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg border border-lime-500/20">
                <div>
                  <p className="text-white font-medium">Points Stricker ({strickerStatsFormat})</p>
                  <p className="text-gray-500 text-xs">Points de classement</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={strickerStatsEdit.points}
                    onChange={(e) => setStrickerStatsEdit({
                      ...strickerStatsEdit,
                      points: parseInt(e.target.value) || 0
                    })}
                    className="w-24 px-3 py-2 bg-dark-700 border border-lime-500/30 rounded-lg text-white text-center font-bold focus:outline-none focus:border-lime-500"
                    min={0}
                  />
                  <span className="text-lime-400 text-sm">pts</span>
                </div>
              </div>

              {/* Wins */}
              <div className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg border border-green-500/20">
                <div>
                  <p className="text-white font-medium">Victoires</p>
                  <p className="text-gray-500 text-xs">Matchs gagnés</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={strickerStatsEdit.wins}
                    onChange={(e) => setStrickerStatsEdit({
                      ...strickerStatsEdit,
                      wins: parseInt(e.target.value) || 0
                    })}
                    className="w-24 px-3 py-2 bg-dark-700 border border-green-500/30 rounded-lg text-white text-center font-bold focus:outline-none focus:border-green-500"
                    min={0}
                  />
                  <span className="text-green-400 text-sm">W</span>
                </div>
              </div>

              {/* Losses */}
              <div className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg border border-red-500/20">
                <div>
                  <p className="text-white font-medium">Défaites</p>
                  <p className="text-gray-500 text-xs">Matchs perdus</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={strickerStatsEdit.losses}
                    onChange={(e) => setStrickerStatsEdit({
                      ...strickerStatsEdit,
                      losses: parseInt(e.target.value) || 0
                    })}
                    className="w-24 px-3 py-2 bg-dark-700 border border-red-500/30 rounded-lg text-white text-center font-bold focus:outline-none focus:border-red-500"
                    min={0}
                  />
                  <span className="text-red-400 text-sm">L</span>
                </div>
              </div>

              {/* Munitions (Cranes) */}
              <div className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg border border-amber-500/20">
                <div>
                  <p className="text-white font-medium flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-400" />
                    Munitions
                  </p>
                  <p className="text-gray-500 text-xs">Monnaie d'escouade</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={strickerStatsEdit.cranes}
                    onChange={(e) => setStrickerStatsEdit({
                      ...strickerStatsEdit,
                      cranes: parseInt(e.target.value) || 0
                    })}
                    className="w-24 px-3 py-2 bg-dark-700 border border-amber-500/30 rounded-lg text-white text-center font-bold focus:outline-none focus:border-amber-500"
                    min={0}
                  />
                  <Coins className="w-5 h-5 text-amber-400" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowStrickerStatsModal(false)}
                className="flex-1 py-3 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleUpdateStrickerStats}
                disabled={saving}
                className="flex-1 py-3 px-4 bg-lime-500 text-black font-medium rounded-xl hover:bg-lime-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    <Save className="w-5 h-5" />
                    Sauvegarder ({strickerStatsFormat})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setDeleteConfirm(null)}></div>
          <div className="relative bg-dark-900 border-t sm:border border-red-500/20 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 max-w-md w-full">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">Confirmer la suppression</h3>
            <p className="text-gray-400 mb-4 sm:mb-6 text-sm sm:text-base">
              Êtes-vous sûr de vouloir supprimer cet élément ? Cette action est irréversible.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.type, deleteConfirm.id)}
                disabled={saving}
                className="flex-1 py-3 px-4 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Stats Confirmation Modal */}
      {resetStatsConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setResetStatsConfirm(null)}></div>
          <div className="relative bg-dark-900 border-t sm:border border-purple-500/20 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 max-w-md w-full max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
              <RotateCcw className="w-5 sm:w-6 h-5 sm:h-6 text-purple-400" />
              Reset Stats & Historique
            </h3>
            <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <p className="text-purple-300 text-sm font-medium mb-1">Utilisateur ciblé :</p>
              <p className="text-white font-semibold">{resetStatsConfirm.username || resetStatsConfirm.discordUsername}</p>
              <p className="text-gray-500 text-xs">{resetStatsConfirm._id}</p>
            </div>
            <p className="text-gray-400 mb-2 text-sm">
              Cette action va :
            </p>
            <ul className="text-gray-400 text-sm mb-4 space-y-1 list-disc list-inside">
              <li>Remettre les victoires à <span className="text-white font-medium">0</span></li>
              <li>Remettre les défaites à <span className="text-white font-medium">0</span></li>
              <li>Remettre les points à <span className="text-white font-medium">0</span></li>
              <li>Supprimer <span className="text-red-400 font-medium">tout l'historique des matchs</span> du joueur</li>
            </ul>
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-6">
              <p className="text-red-400 text-sm font-medium">⚠️ Cette action est irréversible !</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setResetStatsConfirm(null)}
                className="flex-1 py-3 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleResetUserStats(resetStatsConfirm._id)}
                disabled={resettingStats}
                className="flex-1 py-3 px-4 bg-purple-500 text-white font-medium rounded-xl hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {resettingStats ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    <RotateCcw className="w-5 h-5" />
                    Reset
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
