import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import GameModeRulesEditor from '../components/GameModeRulesEditor';
import { getAvatarUrl } from '../utils/avatar';
import { 
  ArrowLeft, Shield, Package, Users, BarChart3, Plus, Edit2, Trash2, 
  Save, X, Loader2, Search, ChevronDown, Eye, EyeOff, Coins, TrendingUp,
  ShoppingBag, Crown, Star, Zap, Gift, Award, Image, Ban, UserCheck,
  Trophy, Medal, Target, RefreshCw, Megaphone, Bell, AlertTriangle,
  FileText, Calendar, Clock, Wrench, RotateCcw, Gamepad2, Swords, Skull, UserPlus,
  CheckCircle, Database, Settings, List, Filter, Download, Upload, Check,
  MapPin, Flag, Activity, Layers, Power, ToggleLeft, ToggleRight, AlertCircle,
  ShieldAlert, Link, ExternalLink, MessageSquare
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const AdminPanel = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isStaff, refreshUser } = useAuth();
  const { language } = useLanguage();
  
  // Check if user is admin (full access) or staff (limited access)
  const userIsAdmin = user?.roles?.includes('admin') || false;
  const userIsStaff = user?.roles?.includes('staff') || user?.roles?.includes('admin') || false;
  
  // États principaux
  const [activeTab, setActiveTab] = useState('overview');
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
  const [hubPosts, setHubPosts] = useState([]);
  const [maps, setMaps] = useState([]);
  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState(null);
  
  // Filtres et recherche
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ITEMS_PER_PAGE = 20;
  
  // Modales
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [resetStatsConfirm, setResetStatsConfirm] = useState(null);
  const [resettingStats, setResettingStats] = useState(false);
  
  // System reset states
  const [confirmText, setConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);
  
  // Config edit states
  const [editedConfig, setEditedConfig] = useState(null);
  
  // App settings states (must be declared before tabGroups)
  const [appSettings, setAppSettings] = useState(null);
  
  // Disputes states
  const [disputedMatches, setDisputedMatches] = useState([]);
  const [disputedRankedMatches, setDisputedRankedMatches] = useState([]);
  
  // Messages states
  const [allMessages, setAllMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  
  // Update editedConfig when config changes
  useEffect(() => {
    if (config) {
      setEditedConfig(config);
    }
  }, [config]);

  // Load appSettings on mount for staff access control
  useEffect(() => {
    if (userIsStaff && !appSettings) {
      fetchAppSettings();
    }
  }, [userIsStaff]);

  // Navigation tabs configuration grouped by category
  // Staff has limited access based on appSettings.staffAdminAccess
  const tabGroups = [
    {
      name: 'Général',
      tabs: [
        { id: 'overview', label: 'Vue d\'ensemble', icon: BarChart3, adminOnly: false },
      ]
    },
    {
      name: 'Gestion',
      tabs: [
        { id: 'users', label: 'Utilisateurs', icon: Users, adminOnly: false },
        { id: 'squads', label: 'Escouades', icon: Shield, adminOnly: false },
        { id: 'matches', label: 'Matchs', icon: Swords, adminOnly: false },
        { id: 'deleted-accounts', label: 'Comptes Supprimés', icon: Trash2, adminOnly: false },
        { id: 'messages', label: 'Messages', icon: MessageSquare, adminOnly: false },
        { id: 'disputes', label: 'Litiges', icon: AlertTriangle, adminOnly: false },
      ]
    },
    {
      name: 'Contenu',
      tabs: [
        { id: 'shop', label: 'Boutique', icon: ShoppingBag, adminOnly: true },
        { id: 'trophies', label: 'Trophées', icon: Trophy, adminOnly: true },
        { id: 'announcements', label: 'Annonces', icon: Megaphone, adminOnly: false },
        { id: 'hub', label: 'Hub', icon: Users, adminOnly: false },
        { id: 'maps', label: 'Cartes', icon: MapPin, adminOnly: false },
        { id: 'gamerules', label: 'Règles', icon: FileText, adminOnly: false },
      ]
    },
    {
      name: 'Système',
      adminOnly: true,
      tabs: [
        { id: 'application', label: 'Application', icon: Power, adminOnly: true },
        { id: 'config', label: 'Config', icon: Settings, adminOnly: true },
        { id: 'seasons', label: 'Saisons', icon: Calendar, adminOnly: true },
        { id: 'system', label: 'Système', icon: Database, adminOnly: true },
      ]
    }
  ];

  // Flatten all tabs for compatibility
  const allTabs = tabGroups.flatMap(group => group.tabs);
  
  // Filter tabs based on user role and staff access settings
  const getStaffAccess = (tabId) => {
    if (userIsAdmin) return true;
    // Admin-only tabs are never accessible to staff
    const tab = allTabs.find(t => t.id === tabId);
    if (tab?.adminOnly) return false;
    // Check appSettings for staff access - default to true if not set
    if (!appSettings || !appSettings.staffAdminAccess) return true;
    return appSettings.staffAdminAccess[tabId] !== false;
  };
  
  const tabs = userIsAdmin 
    ? allTabs 
    : allTabs.filter(tab => !tab.adminOnly && getStaffAccess(tab.id));

  // Ban modal states
  const [showBanModal, setShowBanModal] = useState(false);
  const [banData, setBanData] = useState({
    userId: null,
    username: '',
    reason: '',
    duration: 'permanent', // 'permanent', '1h', '1d', '7d', '30d', 'custom'
    customDays: 7
  });

  // Squad trophy modal state
  const [showSquadTrophyModal, setShowSquadTrophyModal] = useState(false);
  const [squadForTrophy, setSquadForTrophy] = useState(null);
  const [selectedTrophyToAdd, setSelectedTrophyToAdd] = useState('');
  const [trophyReason, setTrophyReason] = useState('');

  // Squad ladder points modal state
  const [showLadderPointsModal, setShowLadderPointsModal] = useState(false);
  const [squadForLadderPoints, setSquadForLadderPoints] = useState(null);
  const [ladderPointsEdit, setLadderPointsEdit] = useState({});

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
    // Allow both admin and staff to access the panel
    if (!userIsAdmin && !userIsStaff) {
      navigate('/');
    }
  }, [userIsAdmin, userIsStaff, navigate]);

  useEffect(() => {
    loadTabData();
  }, [activeTab, searchTerm, filterMode, filterStatus, page]);

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
        case 'deleted-accounts':
          await fetchDeletedAccounts();
          break;
        case 'shop':
          await fetchShopItems();
          break;
        case 'trophies':
          await fetchTrophies();
          break;
        case 'disputes':
          await fetchDisputedMatches();
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
        case 'hub':
          await fetchHubPosts();
          break;
        case 'maps':
          await fetchMaps();
          break;
        case 'gamerules':
          await fetchGameRules();
          break;
        case 'matches':
          await fetchLadderMatches();
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

  const fetchDisputedMatches = async () => {
    try {
      // Fetch squad matches in dispute
      const squadResponse = await fetch(`${API_URL}/matches/admin/all?status=disputed`, {
        credentials: 'include'
      });
      const squadData = await squadResponse.json();
      if (squadData.success) {
        setDisputedMatches(squadData.matches || []);
      }
      
      // Fetch ranked matches in dispute
      const rankedResponse = await fetch(`${API_URL}/ranked-matches/admin/all?status=disputed`, {
        credentials: 'include'
      });
      const rankedData = await rankedResponse.json();
      if (rankedData.success) {
        setDisputedRankedMatches(rankedData.matches || []);
      }
    } catch (err) {
      console.error('Error fetching disputed matches:', err);
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

  const fetchHubPosts = async () => {
    try {
      const response = await fetch(`${API_URL}/hub/admin/posts`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setHubPosts(data.posts || []);
      }
    } catch (err) {
      console.error('Error fetching hub posts:', err);
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
        case 'hubPost':
          endpoint = `/hub/admin/posts/${id}`;
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

  // ==================== HELPER FUNCTIONS ====================

  const openCreateModal = (type) => {
    setModalType(type);
    setEditingItem(null);
    setFormData(getDefaultFormData(type));
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  const openEditModal = (type, item) => {
    setModalType(type);
    setEditingItem(item);
    // Deep copy arrays for proper editing
    const formDataCopy = { ...item };
    if (item.ladders) formDataCopy.ladders = [...item.ladders];
    if (item.gameModes) formDataCopy.gameModes = [...item.gameModes];
    setFormData(formDataCopy);
    setShowModal(true);
    setError('');
    setSuccess('');
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
          ladders: [],
          gameModes: [],
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
        duration: 'permanent',
        customDays: 7
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

      switch (banData.duration) {
        case '1h':
          endDate = new Date(now.getTime() + 1 * 60 * 60 * 1000);
          break;
        case '1d':
          endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          break;
        case '7d':
          endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          break;
        case 'custom':
          endDate = new Date(now.getTime() + banData.customDays * 24 * 60 * 60 * 1000);
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
        const durationText = banData.duration === 'permanent' ? 'définitivement' : 
          banData.duration === 'custom' ? `pour ${banData.customDays} jours` :
          `pour ${banData.duration}`;
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
      { label: 'Matchs Totaux', value: stats.totalMatches || 0, icon: Swords, color: 'green' },
    ];

    // Use real registration data from API or empty array
    const registrationsData = stats.registrationsLast30Days || [];
    const hasVisitorsData = stats.visitorsLast30Days && stats.visitorsLast30Days.length > 0;
    const visitorsData = stats.visitorsLast30Days || [];

    const maxRegistrations = registrationsData.length > 0 ? Math.max(...registrationsData.map(d => d.value), 1) : 1;
    const maxVisitors = visitorsData.length > 0 ? Math.max(...visitorsData.map(d => d.value), 1) : 1;

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white">Vue d'ensemble</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <button onClick={() => openEditModal('user', user)} className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => setResetStatsConfirm(user)} className="p-1.5 text-purple-400 hover:bg-purple-500/20 rounded-lg"><RotateCcw className="w-4 h-4" /></button>
                    <button onClick={() => openBanModal(user)} className={`p-1.5 rounded-lg ${user.isBanned ? 'text-green-400 hover:bg-green-500/20' : 'text-orange-400 hover:bg-orange-500/20'}`}><Ban className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteConfirm({ type: 'user', id: user._id })} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
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
                          <button onClick={() => openEditModal('user', user)} className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors" title="Modifier"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => setResetStatsConfirm(user)} className="p-1.5 text-purple-400 hover:bg-purple-500/20 rounded-lg transition-colors" title="Reset Stats"><RotateCcw className="w-4 h-4" /></button>
                          <button onClick={() => openBanModal(user)} className={`p-1.5 rounded-lg transition-colors ${user.isBanned ? 'text-green-400 hover:bg-green-500/20' : 'text-orange-400 hover:bg-orange-500/20'}`} title={user.isBanned ? 'Débannir' : 'Bannir'}><Ban className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteConfirm({ type: 'user', id: user._id })} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
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
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Items de la Boutique</h2>
          <button
            onClick={() => openCreateModal('shopItem')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:opacity-90 transition-all"
          >
            <Plus className="w-5 h-5" />
            Nouvel Item
          </button>
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {shopItems.length === 0 ? (
            <div className="col-span-full text-center text-gray-400 py-8">
              Aucun item trouvé
            </div>
          ) : (
            shopItems.map((item) => (
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
                  <span className="text-xs text-gray-500">{item.category}</span>
                </div>

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

const renderDisputes = () => {
    const currentSubTab = activeSubTab || 'squad';
    const totalDisputes = disputedMatches.length + disputedRankedMatches.length;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <AlertTriangle className="w-7 h-7 text-orange-400" />
              Litiges en cours
            </h2>
            <p className="text-gray-400 mt-1">
              {totalDisputes} match{totalDisputes > 1 ? 's' : ''} en litige nécessitant une intervention
            </p>
          </div>
          <button
            onClick={fetchDisputedMatches}
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-4 border-b border-white/10 pb-4">
          <button
            onClick={() => setActiveSubTab('squad')}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              currentSubTab === 'squad' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            Matchs Squad ({disputedMatches.length})
          </button>
          <button
            onClick={() => setActiveSubTab('ranked')}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              currentSubTab === 'ranked' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Swords className="w-4 h-4" />
            Matchs Classés ({disputedRankedMatches.length})
          </button>
        </div>

        {currentSubTab === 'squad' ? (
          <div className="space-y-4">
            {disputedMatches.length === 0 ? (
              <div className="bg-dark-800/50 border border-white/10 rounded-xl p-8 text-center">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <p className="text-gray-400">Aucun match squad en litige</p>
              </div>
            ) : (
              disputedMatches.map((match) => (
                <div key={match._id} className="bg-dark-800/50 border border-orange-500/30 rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs font-medium rounded">
                          EN LITIGE
                        </span>
                        <code className="text-gray-500 text-xs">{match._id}</code>
                      </div>
                      <h3 className="text-white font-bold text-lg">
                        {match.challenger?.name || match.challengerInfo?.name || 'Team 1'} [{match.challenger?.tag || match.challengerInfo?.tag || '???'}] vs {match.opponent?.name || match.opponentInfo?.name || 'Team 2'} [{match.opponent?.tag || match.opponentInfo?.tag || '???'}]
                      </h3>
                      <p className="text-gray-400 text-sm">
                        Mode: {match.mode} • Ladder: {match.ladderId || match.ladder} • {formatDate(match.createdAt)}
                      </p>
                      <div className="flex gap-4 mt-1 text-xs">
                        {match.startedAt && (
                          <span className="text-blue-400">
                            🏁 Début: {new Date(match.startedAt).toLocaleDateString('fr-FR')} à {new Date(match.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {match.result?.confirmedAt && (
                          <span className="text-green-400">
                            ✅ Validé: {new Date(match.result.confirmedAt).toLocaleDateString('fr-FR')} à {new Date(match.result.confirmedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`/match/${match._id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Voir le match
                      </a>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'match', id: match._id })}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {match.dispute && (
                    <div className="bg-dark-900/50 rounded-lg p-4 mt-4">
                      <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-400" />
                        Détails du litige
                      </h4>
                      <p className="text-gray-300 text-sm">{match.dispute.reason || 'Aucune raison fournie'}</p>
                      {match.dispute.initiatedBy && (
                        <p className="text-gray-500 text-xs mt-2">
                          Initié par: {match.dispute.initiatedBy}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {disputedRankedMatches.length === 0 ? (
              <div className="bg-dark-800/50 border border-white/10 rounded-xl p-8 text-center">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <p className="text-gray-400">Aucun match classé en litige</p>
              </div>
            ) : (
              disputedRankedMatches.map((match) => (
                <div key={match._id} className="bg-dark-800/50 border border-orange-500/30 rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs font-medium rounded">
                          EN LITIGE
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          match.mode === 'hardcore' ? 'bg-orange-500/20 text-orange-400' : 'bg-cyan-500/20 text-cyan-400'
                        }`}>
                          {match.mode?.toUpperCase()}
                        </span>
                        <code className="text-gray-500 text-xs">{match._id}</code>
                      </div>
                      <h3 className="text-white font-bold text-lg">
                        {match.gameMode} • {match.players?.length || 0} joueurs
                      </h3>
                      <p className="text-gray-400 text-sm">
                        Map: {match.map?.name || match.map || 'N/A'} • {formatDate(match.createdAt)}
                      </p>
                      <div className="flex gap-4 mt-1 text-xs">
                        {match.startedAt && (
                          <span className="text-blue-400">
                            🏁 Début: {new Date(match.startedAt).toLocaleDateString('fr-FR')} à {new Date(match.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {(match.result?.confirmedAt || match.completedAt) && (
                          <span className="text-green-400">
                            ✅ Fin: {new Date(match.result?.confirmedAt || match.completedAt).toLocaleDateString('fr-FR')} à {new Date(match.result?.confirmedAt || match.completedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`/ranked-match/${match._id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Voir le match
                      </a>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'rankedMatch', id: match._id })}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {match.dispute && (
                    <div className="bg-dark-900/50 rounded-lg p-4 mt-4">
                      <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-400" />
                        Détails du litige
                      </h4>
                      <p className="text-gray-300 text-sm">{match.dispute.reason || 'Aucune raison fournie'}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
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
      hubPosting: { label: 'Publication Hub', desc: 'Poster sur le hub' },
      shopPurchases: { label: 'Achats boutique', desc: 'Effectuer des achats' },
      profileEditing: { label: 'Modification de profil', desc: 'Modifier son profil' },
      hardcoreMode: { label: 'Mode Hardcore', desc: 'Accès au mode Hardcore' },
      cdlMode: { label: 'Mode CDL', desc: 'Accès au mode CDL' },
      registration: { label: 'Inscriptions', desc: 'Nouvelles inscriptions' }
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Power className="w-7 h-7 text-purple-400" />
              Gestion de l'Application
            </h2>
            <p className="text-gray-400 mt-1">
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
          
          {/* Duo/Trio Time Restriction */}
          <div className="bg-dark-900/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-white font-medium">Restriction horaire Duo/Trio</h4>
                <p className="text-gray-500 text-xs">
                  {appSettings.ladderSettings?.duoTrioTimeRestriction?.enabled 
                    ? `Ouvert de ${appSettings.ladderSettings?.duoTrioTimeRestriction?.startHour || 0}h à ${appSettings.ladderSettings?.duoTrioTimeRestriction?.endHour || 20}h (heure française)`
                    : 'Le ladder Duo/Trio est toujours ouvert'}
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
                      setSuccess(newEnabled ? 'Restriction horaire activée' : 'Ladder Duo/Trio toujours ouvert');
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

  const renderHub = () => {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Posts du Hub</h2>
                </div>

        {/* Hub Posts Table */}
        <div className="bg-dark-800/50 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-900/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Titre</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Auteur</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Escouade</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Statut</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {hubPosts.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                      Aucun post trouvé
                    </td>
                  </tr>
                ) : (
                  hubPosts.map((post) => (
                    <tr key={post._id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          post.type === 'recruitment' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                        }`}>
                          {post.type === 'recruitment' ? 'Recrutement' : 'Recherche escouade'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-white font-medium max-w-xs truncate">{post.title}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-white">{post.author?.username || post.author?.discordUsername || 'Inconnu'}</p>
                      </td>
                      <td className="px-6 py-4">
                        {post.squad ? (
                          <p className="text-white">{post.squad.name}</p>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {post.isActive ? (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-green-500/20 text-green-400">
                            Actif
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-gray-500/20 text-gray-400">
                            Inactif
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm">
                        {formatDate(post.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setDeleteConfirm({ type: 'hubPost', id: post._id })}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
            </div>
                      </td>
                    </tr>
                  ))
          )}
              </tbody>
            </table>
        </div>
      </div>
      </div>
    );
  };

  const renderMaps = () => {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Gestion des Cartes</h2>
          <button
            onClick={() => openCreateModal('map')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:opacity-90 transition-all"
          >
            <Plus className="w-5 h-5" />
            Nouvelle Carte
              </button>
            </div>

        {/* Maps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {maps.length === 0 ? (
            <div className="col-span-full text-center text-gray-400 py-8">
              Aucune carte trouvée
                  </div>
          ) : (
            maps.map((map) => (
              <div
                key={map._id}
                className="bg-dark-800/50 border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all"
              >
                {map.image && (
                  <div className="h-32 bg-dark-900 flex items-center justify-center overflow-hidden">
                    <img src={map.image} alt={map.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4">
<h3 className="text-white font-bold mb-2">{map.name}</h3>
                  <div className="space-y-2 mb-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-gray-400 text-xs">Ladders</span>
                      <div className="flex flex-wrap gap-1">
                        {map.ladders?.length > 0 ? map.ladders.map((ladder, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs">
                            {ladder}
                          </span>
                        )) : <span className="text-gray-500 text-xs">Aucun</span>}
                </div>
                </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-gray-400 text-xs">Modes de jeu</span>
                      <div className="flex flex-wrap gap-1">
                        {map.gameModes?.length > 0 ? map.gameModes.map((mode, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-xs">
                            {mode}
                          </span>
                        )) : <span className="text-gray-500 text-xs">Aucun</span>}
                  </div>
                  </div>
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
      if (!window.confirm(`Voulez-vous vraiment réinitialiser les saisons de TOUS les ladders (Duo/Trio et Squad/Team) ?\n\n- Les 3 premières équipes recevront des points (150, 100, 75) dans le Top 10 Escouade\n- Un trophée unique de saison sera généré et attribué\n- Tous les stats de ladder seront remis à zéro\n\nCette action est irréversible!`)) {
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
            message += `Duo/Trio - ${data.duoTrio.seasonName}:\n`;
            data.duoTrio.winners.forEach(w => {
              message += `  ${w.rank}. ${w.squadName} (+${w.points} pts, ${w.trophy})\n`;
            });
          }
          
          if (data.squadTeam?.winners?.length > 0) {
            message += `\nSquad/Team - ${data.squadTeam.seasonName}:\n`;
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
      const ladderName = ladderId === 'duo-trio' ? 'Duo/Trio' : 'Squad/Team';
      
      if (!window.confirm(`Voulez-vous vraiment réinitialiser la saison du ladder ${ladderName} ?\n\n- Les 3 premières équipes recevront des points dans le Top 10 Escouade\n- Un trophée unique de saison sera généré et attribué\n- Tous les stats de ce ladder seront remis à zéro\n\nCette action est irréversible!`)) {
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

        {/* Reset Rankings */}
        <div className="bg-dark-800/50 border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Réinitialisation des Classements
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            Réinitialisez manuellement les classements (normalement fait automatiquement le 1er de chaque mois)
          </p>
          <div className="flex gap-4">
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
                </div>

        {/* Ladder Season Reset */}
        <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/30 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-purple-400" />
            Reset Saison Ladder
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            Réinitialise les deux ladders (Duo/Trio et Squad/Team). Cette action:
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
              Reset Duo/Trio
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
              Reset Squad/Team
            </button>
          </div>
        </div>

        {/* Squad Match Rewards */}
        <div className="bg-dark-800/50 border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Récompenses Matchs Squad (Ladder)
          </h3>
          
          {/* Section: Points Escouade dans le Ladder */}
          <div className="mb-6">
            <h4 className="text-md font-semibold text-purple-400 mb-3 border-b border-purple-500/30 pb-2">📊 Points Escouade (Ladder Spécifique)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-green-400 mb-2">Points Ladder (Victoire)</label>
                <input
                  type="number"
                  value={editedConfig.squadMatchRewards?.ladderPointsWin || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewards: {
                      ...editedConfig.squadMatchRewards,
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
                  value={editedConfig.squadMatchRewards?.ladderPointsLoss || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewards: {
                      ...editedConfig.squadMatchRewards,
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
                  value={editedConfig.squadMatchRewards?.generalSquadPointsWin || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewards: {
                      ...editedConfig.squadMatchRewards,
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
                  value={editedConfig.squadMatchRewards?.generalSquadPointsLoss || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewards: {
                      ...editedConfig.squadMatchRewards,
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
                  value={editedConfig.squadMatchRewards?.playerCoinsWin || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewards: {
                      ...editedConfig.squadMatchRewards,
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
                  value={editedConfig.squadMatchRewards?.playerCoinsLoss || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewards: {
                      ...editedConfig.squadMatchRewards,
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
                  value={editedConfig.squadMatchRewards?.playerXPWinMin || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewards: {
                      ...editedConfig.squadMatchRewards,
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
                  value={editedConfig.squadMatchRewards?.playerXPWinMax || 0}
                  onChange={(e) => setEditedConfig({
                    ...editedConfig,
                    squadMatchRewards: {
                      ...editedConfig.squadMatchRewards,
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

        {/* Ranked Match Rewards */}
        <div className="bg-dark-800/50 border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Récompenses Matchs Classés (Ranked)
          </h3>
          <p className="text-gray-400 text-sm mb-4">Configuration des points et coins par mode et type de jeu</p>
          <div className="space-y-6">
            {editedConfig.rankedMatchRewards && Object.keys(editedConfig.rankedMatchRewards).map((mode) => (
              <div key={mode} className="bg-dark-900/50 rounded-lg p-4">
                <h4 className="text-white font-medium mb-4 capitalize flex items-center gap-2">
                  {mode === 'hardcore' ? '🔥' : '🎯'} {mode}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.keys(editedConfig.rankedMatchRewards[mode]).map((gameMode) => (
                    <div key={gameMode} className="bg-dark-800 rounded-lg p-4 space-y-3">
                      <p className="text-white font-medium mb-2 text-sm border-b border-white/10 pb-2">{gameMode}</p>
                      
                      <div>
                        <label className="text-gray-400 text-xs block mb-1">Points Victoire</label>
                        <input
                          type="number"
                          value={editedConfig.rankedMatchRewards[mode][gameMode].pointsWin || 0}
                          onChange={(e) => {
                            const newConfig = { ...editedConfig };
                            newConfig.rankedMatchRewards[mode][gameMode].pointsWin = parseInt(e.target.value) || 0;
                            setEditedConfig(newConfig);
                          }}
                          className="w-full px-2 py-1 bg-dark-900 border border-green-500/30 rounded text-green-400 text-sm focus:border-green-500 focus:outline-none"
                        />
                      </div>
                      
                      <div>
                        <label className="text-gray-400 text-xs block mb-1">Points Défaite</label>
                        <input
                          type="number"
                          value={editedConfig.rankedMatchRewards[mode][gameMode].pointsLoss || 0}
                          onChange={(e) => {
                            const newConfig = { ...editedConfig };
                            newConfig.rankedMatchRewards[mode][gameMode].pointsLoss = parseInt(e.target.value) || 0;
                            setEditedConfig(newConfig);
                          }}
                          className="w-full px-2 py-1 bg-dark-900 border border-red-500/30 rounded text-red-400 text-sm focus:border-red-500 focus:outline-none"
                        />
                      </div>
                      
                      <div>
                        <label className="text-gray-400 text-xs block mb-1">Coins Victoire</label>
                        <input
                          type="number"
                          value={editedConfig.rankedMatchRewards[mode][gameMode].coinsWin || 0}
                          onChange={(e) => {
                            const newConfig = { ...editedConfig };
                            newConfig.rankedMatchRewards[mode][gameMode].coinsWin = parseInt(e.target.value) || 0;
                            setEditedConfig(newConfig);
                          }}
                          className="w-full px-2 py-1 bg-dark-900 border border-yellow-500/30 rounded text-yellow-400 text-sm focus:border-yellow-500 focus:outline-none"
                        />
                      </div>
                </div>
                  ))}
                  </div>
                </div>
            ))}
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
              { key: 'disputes', label: 'Litiges' },
              { key: 'announcements', label: 'Annonces' },
              { key: 'hub', label: 'Hub' },
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
  const [ladderMatches, setLadderMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesFilter, setMatchesFilter] = useState('all'); // all, pending, completed, disputed
  const [matchToEdit, setMatchToEdit] = useState(null);
  const [matchToDelete, setMatchToDelete] = useState(null);

  const fetchLadderMatches = async () => {
    setMatchesLoading(true);
    try {
      const response = await fetch(`${API_URL}/matches/admin/all?status=${matchesFilter}&limit=50`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setLadderMatches(data.matches || []);
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
    } finally {
      setMatchesLoading(false);
    }
  };

  const handleDeleteMatch = async (matchId) => {
    try {
      const response = await fetch(`${API_URL}/matches/admin/${matchId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Match supprimé avec succès');
        setMatchToDelete(null);
        fetchLadderMatches();
      } else {
        setError(data.message || 'Erreur lors de la suppression');
      }
    } catch (err) {
      setError('Erreur lors de la suppression');
    }
  };

  const handleUpdateMatchStatus = async (matchId, status) => {
    try {
      const response = await fetch(`${API_URL}/matches/admin/${matchId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Statut du match mis à jour');
        fetchLadderMatches();
      } else {
        setError(data.message || 'Erreur');
      }
    } catch (err) {
      setError('Erreur lors de la mise à jour');
    }
  };

  const renderMatches = () => {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Swords className="w-7 h-7 text-purple-400" />
              Gestion des Matchs Ladder
            </h2>
            <p className="text-gray-400 mt-1">Modifier et supprimer les matchs ladder</p>
          </div>
          <button
            onClick={fetchLadderMatches}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {['all', 'pending', 'completed', 'disputed', 'cancelled'].map((filter) => (
            <button
              key={filter}
              onClick={() => {
                setMatchesFilter(filter);
                setTimeout(fetchLadderMatches, 100);
              }}
              className={`px-4 py-2 rounded-lg transition-colors ${
                matchesFilter === filter 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
              }`}
            >
              {filter === 'all' ? 'Tous' : 
               filter === 'pending' ? 'En attente' : 
               filter === 'completed' ? 'Terminés' : 
               filter === 'disputed' ? 'Litiges' : 'Annulés'}
            </button>
          ))}
        </div>

        {/* Matches List */}
        {matchesLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : ladderMatches.length > 0 ? (
          <div className="space-y-3">
            {ladderMatches.map((match) => (
              <div key={match._id} className="bg-dark-800/50 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="text-white font-medium">{match.challenger?.name || 'Équipe inconnue'}</div>
                      <span className="text-gray-500">vs</span>
                      <div className="text-white font-medium">{match.opponent?.name || 'En attente'}</div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      match.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      match.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                      match.status === 'disputed' ? 'bg-red-500/20 text-red-400' :
                      match.status === 'cancelled' ? 'bg-gray-500/20 text-gray-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {match.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={match.status}
                      onChange={(e) => handleUpdateMatchStatus(match._id, e.target.value)}
                      className="px-3 py-2 bg-dark-900 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="pending">En attente</option>
                      <option value="accepted">Accepté</option>
                      <option value="in_progress">En cours</option>
                      <option value="completed">Terminé</option>
                      <option value="disputed">Litige</option>
                      <option value="cancelled">Annulé</option>
                    </select>
                    <button
                      onClick={() => setMatchToDelete(match)}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-gray-500 text-sm space-y-1">
                  <div>
                    Créé le {new Date(match.createdAt).toLocaleDateString('fr-FR')} à {new Date(match.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} • 
                    Ladder: {match.ladderId || 'N/A'} • 
                    Format: {match.teamSize ? `${match.teamSize}v${match.teamSize}` : 'N/A'}
                  </div>
                  <div className="flex gap-4">
                    {match.startedAt && (
                      <span className="text-blue-400">
                        🏁 Début: {new Date(match.startedAt).toLocaleDateString('fr-FR')} à {new Date(match.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {match.result?.confirmedAt && (
                      <span className="text-green-400">
                        ✅ Validé: {new Date(match.result.confirmedAt).toLocaleDateString('fr-FR')} à {new Date(match.result.confirmedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Swords className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Aucun match trouvé</p>
            <button
              onClick={fetchLadderMatches}
              className="mt-4 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
            >
              Charger les matchs
            </button>
          </div>
        )}

        {/* Delete Match Modal */}
        {matchToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <div className="bg-dark-900 rounded-xl border border-red-500/30 p-6 max-w-md w-full">
              <h3 className="text-lg font-bold text-white mb-4">Supprimer le match ?</h3>
              <p className="text-gray-400 mb-6">
                Cette action est irréversible. Le match entre {matchToDelete.challenger?.name} et {matchToDelete.opponent?.name || 'N/A'} sera définitivement supprimé.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setMatchToDelete(null)}
                  className="flex-1 py-3 bg-dark-800 text-white rounded-lg hover:bg-dark-700 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleDeleteMatch(matchToDelete._id)}
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

  const renderSeasons = () => {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Calendar className="w-7 h-7 text-purple-400" />
              Gestion des Saisons Ladder
            </h2>
            <p className="text-gray-400 mt-1">Historique des saisons et gagnants passés</p>
          </div>
          <button
            onClick={fetchLadderSeasonHistory}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
        </div>

        {seasonsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Duo/Trio History */}
            <div className="bg-dark-800/50 border border-amber-500/30 rounded-xl overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-b border-white/10">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  Duo/Trio - Historique
                </h3>
              </div>
              <div className="p-4 max-h-[500px] overflow-y-auto">
                {ladderSeasonHistory.duoTrio.length > 0 ? (
                  <div className="space-y-4">
                    {ladderSeasonHistory.duoTrio.map((season) => (
                      <div key={season._id} className="bg-dark-900/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="text-white font-medium">{season.seasonName}</h4>
                            <p className="text-gray-500 text-xs">
                              Reset: {new Date(season.resetAt).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                          <button
                            onClick={() => setSeasonToDelete(season)}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="space-y-2">
                          {season.winners?.map((winner) => (
                            <div key={winner.rank} className={`flex items-center justify-between p-2 rounded-lg ${
                              winner.rank === 1 ? 'bg-yellow-500/10' :
                              winner.rank === 2 ? 'bg-gray-500/10' :
                              'bg-orange-500/10'
                            }`}>
                              <div className="flex items-center gap-2">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                  winner.rank === 1 ? 'bg-yellow-500/30 text-yellow-400' :
                                  winner.rank === 2 ? 'bg-gray-500/30 text-gray-300' :
                                  'bg-orange-500/30 text-orange-400'
                                }`}>
                                  {winner.rank}
                                </span>
                                <span className="text-white text-sm">{winner.squadName}</span>
                                <span className="text-gray-500 text-xs">[{winner.squadTag}]</span>
                              </div>
                              <span className="text-green-400 text-sm">+{winner.rewardPoints} pts</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">Aucun historique</p>
                )}
              </div>
            </div>

            {/* Squad/Team History */}
            <div className="bg-dark-800/50 border border-emerald-500/30 rounded-xl overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border-b border-white/10">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  Squad/Team - Historique
                </h3>
              </div>
              <div className="p-4 max-h-[500px] overflow-y-auto">
                {ladderSeasonHistory.squadTeam.length > 0 ? (
                  <div className="space-y-4">
                    {ladderSeasonHistory.squadTeam.map((season) => (
                      <div key={season._id} className="bg-dark-900/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="text-white font-medium">{season.seasonName}</h4>
                            <p className="text-gray-500 text-xs">
                              Reset: {new Date(season.resetAt).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                          <button
                            onClick={() => setSeasonToDelete(season)}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="space-y-2">
                          {season.winners?.map((winner) => (
                            <div key={winner.rank} className={`flex items-center justify-between p-2 rounded-lg ${
                              winner.rank === 1 ? 'bg-yellow-500/10' :
                              winner.rank === 2 ? 'bg-gray-500/10' :
                              'bg-orange-500/10'
                            }`}>
                              <div className="flex items-center gap-2">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                  winner.rank === 1 ? 'bg-yellow-500/30 text-yellow-400' :
                                  winner.rank === 2 ? 'bg-gray-500/30 text-gray-300' :
                                  'bg-orange-500/30 text-orange-400'
                                }`}>
                                  {winner.rank}
                                </span>
                                <span className="text-white text-sm">{winner.squadName}</span>
                                <span className="text-gray-500 text-xs">[{winner.squadTag}]</span>
                              </div>
                              <span className="text-green-400 text-sm">+{winner.rewardPoints} pts</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">Aucun historique</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* No history message */}
        {!seasonsLoading && ladderSeasonHistory.duoTrio.length === 0 && ladderSeasonHistory.squadTeam.length === 0 && (
          <div className="text-center py-10">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">Aucun historique de saison disponible</p>
            <button
              onClick={fetchLadderSeasonHistory}
              className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
            >
              Charger l'historique
            </button>
          </div>
        )}

        {/* Delete Season Modal */}
        {seasonToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <div className="bg-dark-900 rounded-xl border border-red-500/30 p-6 max-w-md w-full">
              <h3 className="text-lg font-bold text-white mb-4">Supprimer l'historique de saison ?</h3>
              <p className="text-gray-400 mb-6">
                Cette action est irréversible. L'historique de la saison "{seasonToDelete.seasonName}" sera définitivement supprimé.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setSeasonToDelete(null)}
                  className="flex-1 py-3 bg-dark-800 text-white rounded-lg hover:bg-dark-700 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleDeleteSeasonHistory(seasonToDelete._id)}
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
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white">Gestion Système</h2>

        {/* Danger Zone */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
          <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Zone Dangereuse
          </h3>
          
          <div className="space-y-4">
            <div>
              <p className="text-white font-medium mb-2">Réinitialisation Complète du Système</p>
              <p className="text-gray-400 text-sm mb-4">
                Cette action supprimera TOUTES les données suivantes:
              </p>
              <ul className="text-gray-400 text-sm space-y-1 list-disc list-inside mb-4">
                <li>Tous les utilisateurs (y compris les admins)</li>
                <li>Toutes les escouades</li>
                <li>Tous les matchs (ladder et classés)</li>
                <li>Tous les classements</li>
                <li>Tous les posts du hub</li>
                <li>Toutes les annonces</li>
                <li>Tous les achats et utilisations d'items</li>
                <li>Toutes les saisons</li>
              </ul>
              <p className="text-yellow-400 text-sm font-medium mb-4">
                ⚠️ Données PRÉSERVÉES: Règles de jeu, Cartes, Items de boutique, Trophées, Configuration (points/coins)
              </p>
                    </div>

                        <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tapez "RESET ALL" pour confirmer
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="RESET ALL"
                className="w-full px-4 py-3 bg-dark-800 border border-red-500/30 rounded-xl text-white focus:outline-none focus:border-red-500"
              />
                      </div>

            <button
              onClick={handleFullReset}
              disabled={resetting || confirmText !== 'RESET ALL'}
              className="w-full py-3 px-4 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {resetting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Réinitialisation en cours...
                </>
              ) : (
                <>
                  <Skull className="w-5 h-5" />
                  RÉINITIALISER TOUT LE SYSTÈME
                </>
              )}
            </button>
          </div>
                    </div>

        {/* System Info */}
        <div className="bg-dark-800/50 border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Database className="w-5 h-5" />
            Informations Système
                      </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Version de la plateforme:</span>
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
            <div className="grid grid-cols-2 gap-4">
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
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">XP (Expérience)</label>
                <div className="relative">
                  <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
                  <input
                    type="number"
                    value={formData.stats?.xp || 0}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      stats: { 
                        ...formData.stats, 
                        xp: parseInt(e.target.value) || 0 
                      } 
                    })}
                    className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                    min={0}
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Rôles</label>
              <div className="space-y-2">
                {['user', 'staff', 'gerant_cdl', 'gerant_hardcore', 'admin'].map((role) => (
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
            
            {/* Stats Section - Admin Only */}
            {userIsAdmin && (
              <div className="border-t border-white/10 pt-4 mt-4">
                <h4 className="text-sm font-medium text-purple-400 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Statistiques Escouade
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Points Top Escouade</label>
                    <input
                      type="number"
                      value={formData.stats?.totalPoints ?? editingItem?.stats?.totalPoints ?? 0}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        stats: { 
                          ...formData.stats,
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
                      value={formData.stats?.totalWins ?? editingItem?.stats?.totalWins ?? 0}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        stats: { 
                          ...formData.stats,
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
                      value={formData.stats?.totalLosses ?? editingItem?.stats?.totalLosses ?? 0}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        stats: { 
                          ...formData.stats,
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
            <div className="grid grid-cols-2 gap-4">
                  <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Catégorie</label>
                <select
                  value={formData.category || 'other'}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                >
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
              <label className="block text-sm font-medium text-gray-300 mb-2">Image URL</label>
              <input
                type="text"
                value={formData.image || ''}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Ladders</label>
              <div className="flex flex-wrap gap-3">
                {['duo-trio', 'squad-team'].map((ladder) => (
                  <label key={ladder} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(formData.ladders || []).includes(ladder)}
                      onChange={(e) => {
                        const current = formData.ladders || [];
                        if (e.target.checked) {
                          setFormData({ ...formData, ladders: [...current, ladder] });
                        } else {
                          setFormData({ ...formData, ladders: current.filter(l => l !== ladder) });
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-white">{ladder}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Modes de jeu</label>
              <div className="flex flex-wrap gap-3">
                {['Search & Destroy', 'Domination', 'Team Deathmatch', 'Hardpoint', 'Control'].map((mode) => (
                  <label key={mode} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(formData.gameModes || []).includes(mode)}
                      onChange={(e) => {
                        const current = formData.gameModes || [];
                        if (e.target.checked) {
                          setFormData({ ...formData, gameModes: [...current, mode] });
                        } else {
                          setFormData({ ...formData, gameModes: current.filter(m => m !== mode) });
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-white text-sm">{mode}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive !== undefined ? formData.isActive : true}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-white">Active</span>
              </label>
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
        return renderOverview();
      case 'users':
        return renderUsers();
      case 'squads':
        return renderSquads();
      case 'deleted-accounts':
        return renderDeletedAccounts();
      case 'messages':
        return renderMessages();
      case 'shop':
        return renderShop();
      case 'trophies':
        return renderTrophies();
      case 'disputes':
        return renderDisputes();
      case 'announcements':
        return renderAnnouncements();
      case 'hub':
        return renderHub();
      case 'maps':
        return renderMaps();
      case 'gamerules':
        return renderGameRules();
      case 'matches':
        return renderMatches();
      case 'application':
        return renderApplication();
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

      {/* Navigation Tabs - Grouped Layout */}
      <div className="bg-dark-900/80 backdrop-blur-xl border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 sm:gap-6 overflow-x-auto py-2 sm:py-3 pb-3 sm:pb-4 scrollbar-hide" style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#6b21a8 #1f2937'
          }}>
            {tabGroups.map((group) => {
              // Skip admin-only groups for non-admin users
              if (group.adminOnly && !userIsAdmin) return null;
              
              // Filter tabs within the group
              const visibleTabs = group.tabs.filter(tab => {
                if (tab.adminOnly && !userIsAdmin) return false;
                if (!userIsAdmin && !getStaffAccess(tab.id)) return false;
                return true;
              });
              
              if (visibleTabs.length === 0) return null;
              
              return (
                <div key={group.name} className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-2 hidden sm:block">
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
                          <span className="hidden md:inline text-sm">{tab.label}</span>
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
                              </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowModal(false)}></div>
          <div className="relative bg-dark-900 border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-dark-900 border-b border-white/10 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                {editingItem ? 'Modifier' : 'Créer'} {modalType}
              </h2>
                            <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                <X className="w-6 h-6 text-gray-400" />
                            </button>
                          </div>
            
            <form onSubmit={editingItem ? handleUpdate : handleCreate} className="p-6 space-y-4">
              {/* Form content based on modalType */}
              {renderModalForm()}

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

              <div className="flex gap-3 pt-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowBanModal(false)}></div>
          <div className="relative bg-dark-900 border border-orange-500/20 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-orange-500/20 rounded-xl">
                <Ban className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Bannir {banData.username}</h3>
                <p className="text-gray-400 text-sm">Configurez les paramètres du bannissement</p>
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
                <label className="block text-sm font-medium text-gray-300 mb-2">Durée</label>
                <select
                  value={banData.duration}
                  onChange={(e) => setBanData({ ...banData, duration: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50"
                >
                  <option value="1h">1 heure</option>
                  <option value="1d">1 jour</option>
                  <option value="7d">7 jours</option>
                  <option value="30d">30 jours</option>
                  <option value="custom">Personnalisé</option>
                  <option value="permanent">Permanent</option>
                </select>
              </div>

              {banData.duration === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nombre de jours</label>
                  <input
                    type="number"
                    value={banData.customDays}
                    onChange={(e) => setBanData({ ...banData, customDays: parseInt(e.target.value) || 1 })}
                    min={1}
                    max={365}
                    className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50"
                  />
                </div>
              )}

              {banData.duration === 'permanent' && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-400 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Le bannissement permanent empêchera définitivement l'utilisateur d'accéder à l'application.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setDeleteConfirm(null)}></div>
          <div className="relative bg-dark-900 border border-red-500/20 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Confirmer la suppression</h3>
            <p className="text-gray-400 mb-6">
              Êtes-vous sûr de vouloir supprimer cet élément ? Cette action est irréversible.
            </p>
            <div className="flex gap-3">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setResetStatsConfirm(null)}></div>
          <div className="relative bg-dark-900 border border-purple-500/20 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <RotateCcw className="w-6 h-6 text-purple-400" />
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
