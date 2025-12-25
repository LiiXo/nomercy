import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { 
  ArrowLeft, Shield, Package, Users, BarChart3, Plus, Edit2, Trash2, 
  Save, X, Loader2, Search, ChevronDown, Eye, EyeOff, Coins, TrendingUp,
  ShoppingBag, Crown, Star, Zap, Gift, Award, Image, Ban, UserCheck,
  Trophy, Medal, Target, RefreshCw, Megaphone, Bell, AlertTriangle,
  FileText, Calendar, Clock, Wrench, RotateCcw, Gamepad2, Swords, Skull, UserPlus,
  CheckCircle
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const CATEGORIES = [
  { value: 'avatar_frame', label: 'Cadre Avatar', icon: Crown },
  { value: 'badge', label: 'Badge', icon: Award },
  { value: 'title', label: 'Titre', icon: Star },
  { value: 'boost', label: 'Boost', icon: Zap },
  { value: 'cosmetic', label: 'Cosmétique', icon: Gift },
  { value: 'other', label: 'Autre', icon: Package }
];

const RARITIES = [
  { value: 'common', label: 'Commun', color: 'gray' },
  { value: 'rare', label: 'Rare', color: 'blue' },
  { value: 'epic', label: 'Épique', color: 'purple' },
  { value: 'legendary', label: 'Légendaire', color: 'yellow' }
];

const MODES = [
  { value: 'all', label: 'Tous les modes' },
  { value: 'hardcore', label: 'Hardcore uniquement' },
  { value: 'cdl', label: 'CDL uniquement' }
];

const ROLES = [
  { value: 'user', label: 'Membre', color: 'gray' },
  { value: 'staff', label: 'Staff', color: 'purple' },
  { value: 'gerant_cdl', label: 'Gérant CDL', color: 'cyan' },
  { value: 'gerant_hardcore', label: 'Gérant Hardcore', color: 'orange' },
  { value: 'admin', label: 'Admin', color: 'red' }
];

const DIVISIONS = [
  { value: 'bronze', label: 'Bronze', color: 'orange' },
  { value: 'silver', label: 'Argent', color: 'gray' },
  { value: 'gold', label: 'Or', color: 'yellow' },
  { value: 'platinum', label: 'Platine', color: 'cyan' },
  { value: 'diamond', label: 'Diamant', color: 'blue' },
  { value: 'master', label: 'Master', color: 'purple' },
  { value: 'elite', label: 'Élite', color: 'red' }
];

const ANNOUNCEMENT_TYPES = [
  { value: 'patch_note', label: 'Patch Note', icon: FileText, color: 'purple' },
  { value: 'announcement', label: 'Annonce', icon: Megaphone, color: 'blue' },
  { value: 'maintenance', label: 'Maintenance', icon: Wrench, color: 'orange' },
  { value: 'event', label: 'Événement', icon: Calendar, color: 'green' },
  { value: 'rules', label: 'Règlement', icon: FileText, color: 'gray' },
  { value: 'important', label: 'Important', icon: AlertTriangle, color: 'red' }
];

const PRIORITIES = [
  { value: 'low', label: 'Basse', color: 'gray' },
  { value: 'normal', label: 'Normale', color: 'blue' },
  { value: 'high', label: 'Haute', color: 'orange' },
  { value: 'critical', label: 'Critique', color: 'red' }
];

const AdminPanel = () => {
  const navigate = useNavigate();
  const { user, isStaff, isAdmin, refreshUser } = useAuth();
  const { language } = useLanguage();
  
  const [activeTab, setActiveTab] = useState('shop');
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [rankings, setRankings] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [ladders, setLadders] = useState([]);
  const [trophies, setTrophies] = useState([]);
  const [allSquads, setAllSquads] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [stats, setStats] = useState(null);
  const [rankingStats, setRankingStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Search & filters
  const [searchTerm, setSearchTerm] = useState('');
  const [rankingMode, setRankingMode] = useState('hardcore');
  const [shopCategory, setShopCategory] = useState('all');
  const [shopPage, setShopPage] = useState(1);
  const SHOP_ITEMS_PER_PAGE = 12;
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'shop', 'user', 'ranking', 'addPoints', 'announcement', 'userStats', 'assignTrophy', 'banDetails'
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [userGameStats, setUserGameStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  
  // Trophy assignment
  const [assignTrophySearch, setAssignTrophySearch] = useState('');
  const [selectedSquadForTrophy, setSelectedSquadForTrophy] = useState(null);
  const [assigningTrophy, setAssigningTrophy] = useState(false);
  
  // Ban details
  const [banDetails, setBanDetails] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Set page title
  useEffect(() => {
    const titles = {
      fr: 'NoMercy - Administration',
      en: 'NoMercy - Admin Panel',
      it: 'NoMercy - Pannello Admin',
      de: 'NoMercy - Admin-Panel',
    };
    document.title = titles[language] || titles.en;
  }, [language]);

  // Check admin access
  useEffect(() => {
    if (!isStaff()) {
      navigate('/');
    }
  }, [isStaff, navigate]);

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === 'shop') {
      fetchItems();
      fetchShopStats();
    } else if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'rankings') {
      fetchRankings();
      fetchRankingStats();
    } else if (activeTab === 'announcements') {
      fetchAnnouncements();
    } else if (activeTab === 'purchases') {
      fetchShopStats();
    } else if (activeTab === 'ladders') {
      fetchLadders();
    } else if (activeTab === 'trophies') {
      fetchTrophies();
      fetchAllSquads();
    } else if (activeTab === 'disputes') {
      fetchDisputes();
    }
  }, [activeTab, searchTerm, rankingMode]);

  // ==================== API CALLS ====================

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/shop/admin/items`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setItems(data.items);
      }
    } catch (err) {
      console.error('Error fetching items:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchShopStats = async () => {
    try {
      const response = await fetch(`${API_URL}/shop/admin/stats`, {
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

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/users/admin/all?search=${searchTerm}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRankings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/rankings/admin/all?mode=${rankingMode}&search=${searchTerm}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setRankings(data.rankings);
      }
    } catch (err) {
      console.error('Error fetching rankings:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRankingStats = async () => {
    try {
      const response = await fetch(`${API_URL}/rankings/admin/stats`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setRankingStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching ranking stats:', err);
    }
  };

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/announcements/admin/all`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setAnnouncements(data.announcements);
      }
    } catch (err) {
      console.error('Error fetching announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLadders = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/ladders/admin/all`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setLadders(data.ladders);
      }
    } catch (err) {
      console.error('Error fetching ladders:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrophies = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/trophies/admin/all`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setTrophies(data.trophies);
      }
    } catch (err) {
      console.error('Error fetching trophies:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/matches/disputes/pending`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setDisputes(data.disputes);
      }
    } catch (err) {
      console.error('Error fetching disputes:', err);
    } finally {
      setLoading(false);
    }
  };

  // Résoudre un litige en donnant la victoire à une équipe
  const handleResolveDispute = async (matchId, winnerId) => {
    if (!confirm('Êtes-vous sûr de vouloir attribuer la victoire à cette équipe ?')) return;
    
    try {
      const response = await fetch(`${API_URL}/matches/${matchId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ winnerId, resolution: 'Résolu par un administrateur' })
      });
      const data = await response.json();
      if (data.success) {
        fetchDisputes();
      } else {
        alert(data.message || 'Erreur lors de la résolution du litige');
      }
    } catch (err) {
      console.error('Error resolving dispute:', err);
      alert('Erreur lors de la résolution du litige');
    }
  };

  // Annuler un litige et remettre le match en état normal
  const handleCancelDispute = async (matchId) => {
    if (!confirm('Êtes-vous sûr de vouloir annuler ce litige et remettre le match en cours ?')) return;
    
    try {
      const response = await fetch(`${API_URL}/matches/${matchId}/cancel-dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        fetchDisputes();
      } else {
        alert(data.message || 'Erreur lors de l\'annulation du litige');
      }
    } catch (err) {
      console.error('Error canceling dispute:', err);
      alert('Erreur lors de l\'annulation du litige');
    }
  };

  // ==================== TROPHY HANDLERS ====================

  const TROPHY_ICONS = [
    { value: 'Trophy', label: 'Trophée' },
    { value: 'Award', label: 'Prix' },
    { value: 'Medal', label: 'Médaille' },
    { value: 'Star', label: 'Étoile' },
    { value: 'Crown', label: 'Couronne' },
    { value: 'Shield', label: 'Bouclier' },
    { value: 'Zap', label: 'Éclair' },
    { value: 'Target', label: 'Cible' },
    { value: 'Flame', label: 'Flamme' },
    { value: 'Gem', label: 'Gemme' },
    { value: 'Heart', label: 'Cœur' },
    { value: 'Sword', label: 'Épée' }
  ];

  const TROPHY_COLORS = [
    { value: 'amber', label: 'Ambre', hex: '#f59e0b' },
    { value: 'yellow', label: 'Jaune', hex: '#eab308' },
    { value: 'orange', label: 'Orange', hex: '#f97316' },
    { value: 'red', label: 'Rouge', hex: '#ef4444' },
    { value: 'pink', label: 'Rose', hex: '#ec4899' },
    { value: 'purple', label: 'Violet', hex: '#a855f7' },
    { value: 'blue', label: 'Bleu', hex: '#3b82f6' },
    { value: 'cyan', label: 'Cyan', hex: '#06b6d4' },
    { value: 'green', label: 'Vert', hex: '#22c55e' },
    { value: 'emerald', label: 'Émeraude', hex: '#10b981' },
    { value: 'gray', label: 'Gris', hex: '#6b7280' }
  ];

  const TROPHY_RARITIES = [
    { value: 1, name: 'common', label: 'Commun', color: 'gray' },
    { value: 2, name: 'uncommon', label: 'Peu commun', color: 'green' },
    { value: 3, name: 'rare', label: 'Rare', color: 'blue' },
    { value: 4, name: 'epic', label: 'Épique', color: 'purple' },
    { value: 5, name: 'legendary', label: 'Légendaire', color: 'yellow' }
  ];

  const openTrophyModal = (trophy = null) => {
    setModalType('trophy');
    setEditingItem(trophy);
    setFormData(trophy ? {
      name: trophy.name,
      description: trophy.description,
      translations: trophy.translations || {
        fr: { name: '', description: '' },
        en: { name: '', description: '' },
        de: { name: '', description: '' },
        it: { name: '', description: '' }
      },
      icon: trophy.icon || 'Trophy',
      color: trophy.color || 'amber',
      rarity: trophy.rarity || 1,
      rarityName: trophy.rarityName || 'common',
      isDefault: trophy.isDefault || false,
      isActive: trophy.isActive !== undefined ? trophy.isActive : true
    } : {
      name: '',
      description: '',
      translations: {
        fr: { name: '', description: '' },
        en: { name: '', description: '' },
        de: { name: '', description: '' },
        it: { name: '', description: '' }
      },
      icon: 'Trophy',
      color: 'amber',
      rarity: 1,
      rarityName: 'common',
      isDefault: false,
      isActive: true
    });
    setShowModal(true);
  };

  const saveTrophy = async () => {
    setSaving(true);
    setError('');
    
    try {
      const url = editingItem 
        ? `${API_URL}/trophies/${editingItem._id}`
        : `${API_URL}/trophies`;
      
      const response = await fetch(url, {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setShowModal(false);
        fetchTrophies();
        setSuccess(editingItem ? 'Trophée modifié !' : 'Trophée créé !');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur');
    } finally {
      setSaving(false);
    }
  };

  const deleteTrophy = async (trophyId) => {
    try {
      const response = await fetch(`${API_URL}/trophies/${trophyId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        fetchTrophies();
        setSuccess('Trophée supprimé !');
        setDeleteConfirm(null);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur');
    }
  };

  const seedDefaultTrophies = async () => {
    try {
      const response = await fetch(`${API_URL}/trophies/seed-defaults`, {
        method: 'POST',
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        fetchTrophies();
        setSuccess(data.message);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur');
    }
  };

  const fetchAllSquads = async () => {
    try {
      const response = await fetch(`${API_URL}/squads/admin/all`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setAllSquads(data.squads);
      }
    } catch (err) {
      console.error('Error fetching squads:', err);
    }
  };

  const openAssignTrophyModal = (trophy) => {
    setModalType('assignTrophy');
    setEditingItem(trophy);
    setSelectedSquadForTrophy(null);
    setAssignTrophySearch('');
    setShowModal(true);
  };

  const assignTrophyToSquad = async () => {
    if (!selectedSquadForTrophy || !editingItem) return;
    
    setAssigningTrophy(true);
    try {
      const response = await fetch(`${API_URL}/squads/${selectedSquadForTrophy._id}/assign-trophy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          trophyId: editingItem._id,
          reason: `Trophée "${editingItem.name}" attribué par un administrateur`
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setShowModal(false);
        fetchAllSquads();
        setSuccess('Trophée attribué !');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur');
    } finally {
      setAssigningTrophy(false);
    }
  };

  const removeTrophyFromSquad = async (squadId, trophyId) => {
    try {
      const response = await fetch(`${API_URL}/squads/${squadId}/remove-trophy/${trophyId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        fetchAllSquads();
        setSuccess('Trophée retiré !');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur');
    }
  };

  // ==================== SHOP HANDLERS ====================

  const openShopModal = (item = null) => {
    setModalType('shop');
    setEditingItem(item);
    setFormData(item ? {
      name: item.name,
      description: item.description,
      category: item.category,
      price: item.price,
      originalPrice: item.originalPrice || '',
      image: item.image || '',
      icon: item.icon || 'Package',
      color: item.color || 'cyan',
      rarity: item.rarity,
      isActive: item.isActive,
      stock: item.stock,
      mode: item.mode,
      sortOrder: item.sortOrder || 0
    } : {
      name: '',
      description: '',
      category: 'cosmetic',
      price: 100,
      originalPrice: '',
      image: '',
      icon: 'Package',
      color: 'cyan',
      rarity: 'common',
      isActive: true,
      stock: -1,
      mode: 'all',
      sortOrder: 0
    });
    setShowModal(true);
    setError('');
  };

  const handleShopSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const url = editingItem 
        ? `${API_URL}/shop/admin/items/${editingItem._id}`
        : `${API_URL}/shop/admin/items`;
      
      const response = await fetch(url, {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          originalPrice: formData.originalPrice || undefined,
          stock: parseInt(formData.stock)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error saving item');
      }

      setSuccess(editingItem ? 'Article modifié !' : 'Article créé !');
      setShowModal(false);
      fetchItems();
      fetchShopStats();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      await fetch(`${API_URL}/shop/admin/items/${itemId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      setSuccess('Article supprimé !');
      setDeleteConfirm(null);
      fetchItems();
      fetchShopStats();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleItemActive = async (item) => {
    try {
      await fetch(`${API_URL}/shop/admin/items/${item._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !item.isActive })
      });
      fetchItems();
    } catch (err) {
      console.error('Error toggling item:', err);
    }
  };

  // ==================== USER HANDLERS ====================

  const openUserModal = (userItem) => {
    setModalType('user');
    setEditingItem(userItem);
    setFormData({
      roles: userItem.roles || ['user'],
      goldCoins: userItem.goldCoins || 0
    });
    setShowModal(true);
    setError('');
  };

  const openGoldModal = (userItem) => {
    setModalType('gold');
    setEditingItem(userItem);
    setFormData({
      goldAmount: 0,
      goldReason: ''
    });
    setShowModal(true);
    setError('');
  };

  const openBanModal = (userItem) => {
    setModalType('ban');
    setEditingItem(userItem);
    const now = new Date();
    setFormData({
      banReason: '',
      banStartDate: now.toISOString().slice(0, 16),
      banEndDate: ''
    });
    setShowModal(true);
    setError('');
  };

  const openBanDetailsModal = async (userId) => {
    try {
      const response = await fetch(`${API_URL}/users/admin/${userId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        setBanDetails(data.user);
        setModalType('banDetails');
        setShowModal(true);
      }
    } catch (err) {
      console.error('Error fetching ban details:', err);
    }
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      // Update roles
      await fetch(`${API_URL}/users/admin/${editingItem._id}/roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ roles: formData.roles })
      });

      setSuccess('Utilisateur modifié !');
      setShowModal(false);
      fetchUsers();
      
      // Refresh current user if we modified our own roles
      if (editingItem._id === user?.id) {
        refreshUser();
      }
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGoldSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/users/admin/${editingItem._id}/gold`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          amount: parseInt(formData.goldAmount),
          reason: formData.goldReason 
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      setSuccess(`${formData.goldAmount > 0 ? '+' : ''}${formData.goldAmount} gold pour ${editingItem.username || editingItem.discordUsername} !`);
      setShowModal(false);
      fetchUsers();
      
      // Refresh current user if we modified our own gold
      if (editingItem._id === user?.id) {
        refreshUser();
      }
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBanSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const payload = { 
        ban: true, 
        reason: formData.banReason,
        startDate: formData.banStartDate || new Date().toISOString(),
        endDate: formData.banEndDate || null
      };
      
      await fetch(`${API_URL}/users/admin/${editingItem._id}/ban`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      
      const durationText = formData.banEndDate 
        ? `jusqu'au ${new Date(formData.banEndDate).toLocaleDateString('fr-FR', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}` 
        : 'de façon permanente';
      setSuccess(`${editingItem.username || editingItem.discordUsername} a été banni ${durationText} !`);
      setShowModal(false);
      fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUnbanUser = async (userId) => {
    try {
      await fetch(`${API_URL}/users/admin/${userId}/ban`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ban: false })
      });
      setSuccess('Utilisateur débanni !');
      fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleBanUser = async (userId, ban, reason = '') => {
    try {
      await fetch(`${API_URL}/users/admin/${userId}/ban`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ban, reason })
      });
      setSuccess(ban ? 'Utilisateur banni !' : 'Utilisateur débanni !');
      fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  // ==================== USER STATS HANDLER ====================

  const openUserStatsModal = async (userItem) => {
    setModalType('userStats');
    setEditingItem(userItem);
    setUserGameStats(null);
    setLoadingStats(true);
    setShowModal(true);

    try {
      // Fetch both hardcore and cdl rankings for this user
      const [hardcoreRes, cdlRes] = await Promise.all([
        fetch(`${API_URL}/rankings/user/${userItem._id}/hardcore`, { credentials: 'include' }),
        fetch(`${API_URL}/rankings/user/${userItem._id}/cdl`, { credentials: 'include' })
      ]);

      const hardcoreData = await hardcoreRes.json();
      const cdlData = await cdlRes.json();

      setUserGameStats({
        hardcore: hardcoreData.success ? hardcoreData.ranking : null,
        cdl: cdlData.success ? cdlData.ranking : null,
        userStats: userItem.stats || {}
      });
    } catch (err) {
      console.error('Error fetching user stats:', err);
      setUserGameStats({ hardcore: null, cdl: null, userStats: userItem.stats || {} });
    } finally {
      setLoadingStats(false);
    }
  };

  // ==================== ANNOUNCEMENT HANDLERS ====================

  const openAnnouncementModal = (announcement = null) => {
    setModalType('announcement');
    setEditingItem(announcement);
    setFormData(announcement ? {
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      version: announcement.version || '',
      priority: announcement.priority,
      targetMode: announcement.targetMode,
      requiresAcknowledgment: announcement.requiresAcknowledgment,
      isActive: announcement.isActive
    } : {
      title: '',
      content: '',
      type: 'announcement',
      version: '',
      priority: 'normal',
      targetMode: 'all',
      requiresAcknowledgment: true,
      isActive: true
    });
    setShowModal(true);
    setError('');
  };

  const handleAnnouncementSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const url = editingItem 
        ? `${API_URL}/announcements/admin/${editingItem._id}`
        : `${API_URL}/announcements/admin`;
      
      const response = await fetch(url, {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error saving announcement');
      }

      setSuccess(editingItem ? 'Annonce modifiée !' : 'Annonce créée !');
      setShowModal(false);
      fetchAnnouncements();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    try {
      await fetch(`${API_URL}/announcements/admin/${announcementId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      setSuccess('Annonce supprimée !');
      setDeleteConfirm(null);
      fetchAnnouncements();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleAnnouncementActive = async (announcement) => {
    try {
      await fetch(`${API_URL}/announcements/admin/${announcement._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !announcement.isActive })
      });
      fetchAnnouncements();
    } catch (err) {
      console.error('Error toggling announcement:', err);
    }
  };

  const resetAnnouncementReads = async (announcementId) => {
    try {
      await fetch(`${API_URL}/announcements/admin/${announcementId}/reset-reads`, {
        method: 'POST',
        credentials: 'include'
      });
      setSuccess('Lectures réinitialisées !');
      fetchAnnouncements();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  // ==================== RANKING HANDLERS ====================

  const openRankingModal = (ranking = null) => {
    setModalType('ranking');
    setEditingItem(ranking);
    setFormData(ranking ? {
      points: ranking.points,
      wins: ranking.wins,
      losses: ranking.losses,
      kills: ranking.kills || 0,
      deaths: ranking.deaths || 0,
      division: ranking.division,
      team: ranking.team || ''
    } : {
      userId: '',
      mode: rankingMode,
      points: 0,
      wins: 0,
      losses: 0,
      kills: 0,
      deaths: 0,
      division: 'bronze',
      team: ''
    });
    setShowModal(true);
    setError('');
  };

  const openAddPointsModal = (ranking) => {
    setModalType('addPoints');
    setEditingItem(ranking);
    setFormData({
      points: 0,
      reason: ''
    });
    setShowModal(true);
    setError('');
  };

  const handleRankingSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const userId = editingItem?.user?._id || editingItem?.userInfo?._id || formData.userId;
      
      await fetch(`${API_URL}/rankings/admin/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mode: editingItem?.mode || formData.mode,
          ...formData
        })
      });

      setSuccess('Classement mis à jour !');
      setShowModal(false);
      fetchRankings();
      fetchRankingStats();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPoints = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const userId = editingItem?.user?._id || editingItem?.userInfo?._id;
      
      await fetch(`${API_URL}/rankings/admin/${userId}/add-points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mode: editingItem.mode,
          points: parseInt(formData.points),
          reason: formData.reason
        })
      });

      setSuccess(`${formData.points > 0 ? '+' : ''}${formData.points} points !`);
      setShowModal(false);
      fetchRankings();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ==================== HELPERS ====================

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
    const cat = CATEGORIES.find(c => c.value === category);
    return cat?.icon || Package;
  };

  const getDivisionColor = (division) => {
    const div = DIVISIONS.find(d => d.value === division);
    return div?.color || 'gray';
  };

  if (loading && activeTab === 'shop' && items.length === 0) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 relative">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 20% 20%, rgba(139, 92, 246, 0.08) 0%, transparent 50%)' }}></div>
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-20"></div>

      <div className="relative z-10 py-4 sm:py-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 sm:mb-8">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <button 
                onClick={() => navigate(-1)} 
                className="flex items-center space-x-2 text-gray-400 hover:text-purple-400 transition-colors"
              >
                <ArrowLeft className="w-4 sm:w-5 h-4 sm:h-5" />
              </button>
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg sm:rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-2xl font-bold text-white">Admin</h1>
                  <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Gestion de la plateforme</p>
                </div>
              </div>
            </div>
          </div>

          {/* Success/Error Messages */}
          {success && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
              <p className="text-green-400 text-center">{success}</p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex flex-wrap gap-1 sm:gap-2 mb-4 sm:mb-6 border-b border-white/10 pb-3 sm:pb-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab('shop')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'shop' 
                  ? 'bg-purple-500 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Boutique</span>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'users' 
                  ? 'bg-purple-500 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Utilisateurs</span>
            </button>
            <button
              onClick={() => setActiveTab('announcements')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'announcements' 
                  ? 'bg-purple-500 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Megaphone className="w-4 h-4" />
              <span>Annonces</span>
            </button>
            <button
              onClick={() => setActiveTab('purchases')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'purchases' 
                  ? 'bg-purple-500 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Achats</span>
            </button>
            {isAdmin() && (
              <button
                onClick={() => setActiveTab('trophies')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === 'trophies' 
                    ? 'bg-purple-500 text-white' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Trophy className="w-4 h-4" />
                <span>Trophées</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab('disputes')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'disputes' 
                  ? 'bg-orange-500 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Litiges</span>
              {disputes.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                  {disputes.length}
                </span>
              )}
            </button>
          </div>

          {/* ==================== SHOP TAB ==================== */}
          {activeTab === 'shop' && (
            <div>
              {/* Header avec filtres */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                <h2 className="text-lg font-semibold text-white">Articles ({items.length})</h2>
                <div className="flex items-center gap-3">
                  {/* Filtre par catégorie */}
                  <select
                    value={shopCategory}
                    onChange={(e) => { setShopCategory(e.target.value); setShopPage(1); }}
                    className="px-4 py-2 bg-dark-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="all">Toutes les catégories</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                  {isAdmin() && (
                    <button
                      onClick={() => openShopModal()}
                      className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Nouvel Article</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Catégories rapides */}
              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  onClick={() => { setShopCategory('all'); setShopPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    shopCategory === 'all' 
                      ? 'bg-purple-500 text-white' 
                      : 'bg-dark-800 text-gray-400 hover:text-white hover:bg-dark-700'
                  }`}
                >
                  Tous ({items.length})
                </button>
                {CATEGORIES.map(cat => {
                  const count = items.filter(i => i.category === cat.value).length;
                  if (count === 0) return null;
                  const CatIcon = cat.icon;
                  return (
                    <button
                      key={cat.value}
                      onClick={() => { setShopCategory(cat.value); setShopPage(1); }}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        shopCategory === cat.value 
                          ? 'bg-purple-500 text-white' 
                          : 'bg-dark-800 text-gray-400 hover:text-white hover:bg-dark-700'
                      }`}
                    >
                      <CatIcon className="w-3.5 h-3.5" />
                      <span>{cat.label}</span>
                      <span className="text-xs opacity-70">({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Items filtrés et paginés */}
              {(() => {
                const filteredItems = shopCategory === 'all' 
                  ? items 
                  : items.filter(i => i.category === shopCategory);
                const totalPages = Math.ceil(filteredItems.length / SHOP_ITEMS_PER_PAGE);
                const paginatedItems = filteredItems.slice(
                  (shopPage - 1) * SHOP_ITEMS_PER_PAGE,
                  shopPage * SHOP_ITEMS_PER_PAGE
                );

                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedItems.map((item) => {
                      const CategoryIcon = getCategoryIcon(item.category);
                      return (
                        <div 
                          key={item._id}
                          className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border ${
                            item.isActive ? 'border-purple-500/20' : 'border-red-500/20 opacity-60'
                          } p-4 relative`}
                        >
                          <div className="absolute top-3 right-3">
                            <button
                              onClick={() => toggleItemActive(item)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                item.isActive 
                                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                                  : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                              }`}
                            >
                              {item.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                          </div>

                          <div className="flex items-start space-x-3 mb-3">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getRarityColor(item.rarity)}`}>
                              <CategoryIcon className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-white font-semibold truncate">{item.name}</h3>
                              <p className="text-gray-500 text-xs truncate">{item.description}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 mb-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getRarityColor(item.rarity)}`}>
                              {RARITIES.find(r => r.value === item.rarity)?.label}
                            </span>
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-white/5 text-gray-400 border border-white/10">
                              {CATEGORIES.find(c => c.value === item.category)?.label}
                            </span>
                            {item.mode !== 'all' && (
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                item.mode === 'hardcore' ? 'bg-red-500/20 text-red-400' : 'bg-cyan-500/20 text-cyan-400'
                              }`}>
                                {item.mode}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                              <Coins className="w-4 h-4 text-yellow-400" />
                              <span className="text-yellow-400 font-bold">{item.price}</span>
                              {item.originalPrice > item.price && (
                                <span className="text-gray-500 text-xs line-through">{item.originalPrice}</span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">{item.totalSold || 0} vendus</span>
                          </div>

                          {isAdmin() && (
                            <div className="flex space-x-2 mt-4 pt-4 border-t border-white/10">
                              <button
                                onClick={() => openShopModal(item)}
                                className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                                <span className="text-sm">Modifier</span>
                              </button>
                              <button
                                onClick={() => setDeleteConfirm({ type: 'shop', id: item._id })}
                                className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center space-x-2 mt-6">
                        <button
                          onClick={() => setShopPage(Math.max(1, shopPage - 1))}
                          disabled={shopPage === 1}
                          className="px-3 py-2 bg-dark-800 text-gray-400 rounded-lg hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronDown className="w-4 h-4 rotate-90" />
                        </button>
                        
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => setShopPage(page)}
                            className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                              shopPage === page
                                ? 'bg-purple-500 text-white'
                                : 'bg-dark-800 text-gray-400 hover:bg-dark-700 hover:text-white'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                        
                        <button
                          onClick={() => setShopPage(Math.min(totalPages, shopPage + 1))}
                          disabled={shopPage === totalPages}
                          className="px-3 py-2 bg-dark-800 text-gray-400 rounded-lg hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronDown className="w-4 h-4 -rotate-90" />
                        </button>
                      </div>
                    )}

                    {/* Message si aucun article */}
                    {filteredItems.length === 0 && (
                      <div className="text-center py-12">
                        <Package className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-500">
                          {shopCategory === 'all' 
                            ? 'Aucun article dans la boutique' 
                            : `Aucun article dans la catégorie "${CATEGORIES.find(c => c.value === shopCategory)?.label}"`}
                        </p>
                        {isAdmin() && shopCategory === 'all' && (
                          <button
                            onClick={() => openShopModal()}
                            className="mt-4 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                          >
                            Créer le premier article
                          </button>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* ==================== USERS TAB ==================== */}
          {activeTab === 'users' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Utilisateurs ({users.length})</h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher..."
                    className="pl-10 pr-4 py-2 bg-dark-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 w-64"
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                </div>
              ) : (
                <div className="bg-dark-900/80 backdrop-blur-xl rounded-xl border border-purple-500/20 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Utilisateur</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Rôles</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Gold</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                        <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {users.map((u) => (
                        <tr key={u._id} className="hover:bg-white/5">
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-3">
                              <img 
                                src={u.discordAvatar ? `https://cdn.discordapp.com/avatars/${u.discordId}/${u.discordAvatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'}
                                alt=""
                                className="w-8 h-8 rounded-full"
                              />
                              <div>
                                <p className="text-white font-medium">{u.username || u.discordUsername}</p>
                                <p className="text-gray-500 text-xs">{u.discordUsername}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {u.roles?.map(role => (
                                <span key={role} className={`px-2 py-0.5 rounded text-xs font-medium bg-${ROLES.find(r => r.value === role)?.color || 'gray'}-500/20 text-${ROLES.find(r => r.value === role)?.color || 'gray'}-400`}>
                                  {ROLES.find(r => r.value === role)?.label || role}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-1 text-yellow-400">
                              <Coins className="w-4 h-4" />
                              <span>{u.goldCoins || 0}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {u.isBanned ? (
                              <div className="flex flex-col gap-1">
                                <span className="px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400">Banni</span>
                                {u.banExpiresAt && (
                                  <span className="text-xs text-gray-500">
                                    Expire: {new Date(u.banExpiresAt).toLocaleDateString('fr-FR', { 
                                      day: '2-digit', 
                                      month: '2-digit', 
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                )}
                              </div>
                            ) : u.isProfileComplete ? (
                              <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400">Actif</span>
                            ) : (
                              <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400">Incomplet</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              {u.isProfileComplete && (
                                <button
                                  onClick={() => navigate(`/player/${u.username}`)}
                                  className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
                                  title="Voir le profil public"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}
                              {isAdmin() && (
                                <>
                                  <button
                                    onClick={() => openGoldModal(u)}
                                    className="p-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors"
                                    title="Gérer les gold"
                                  >
                                    <Coins className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => openUserModal(u)}
                                    className="p-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
                                    title="Modifier les rôles"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  {!u.roles?.includes('admin') && (
                                    u.isBanned ? (
                                      <>
                                        <button
                                          onClick={() => openBanDetailsModal(u._id)}
                                          className="p-2 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 transition-colors"
                                          title="Voir détails du ban"
                                        >
                                          <AlertTriangle className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => handleUnbanUser(u._id)}
                                          className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                                          title="Débannir"
                                        >
                                          <UserCheck className="w-4 h-4" />
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        onClick={() => openBanModal(u)}
                                        className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                                        title="Bannir"
                                      >
                                        <Ban className="w-4 h-4" />
                                      </button>
                                    )
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ==================== ANNOUNCEMENTS TAB ==================== */}
          {activeTab === 'announcements' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Annonces ({announcements.length})</h2>
                {isAdmin() && (
                  <button
                    onClick={() => openAnnouncementModal()}
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nouvelle Annonce</span>
                  </button>
                )}
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {announcements.map((announcement) => {
                    const TypeIcon = ANNOUNCEMENT_TYPES.find(t => t.value === announcement.type)?.icon || Bell;
                    const typeColor = ANNOUNCEMENT_TYPES.find(t => t.value === announcement.type)?.color || 'gray';
                    const priorityColor = PRIORITIES.find(p => p.value === announcement.priority)?.color || 'blue';
                    
                    return (
                      <div 
                        key={announcement._id}
                        className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border ${
                          announcement.isActive ? 'border-purple-500/20' : 'border-red-500/20 opacity-60'
                        } p-5`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start space-x-4 flex-1">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-${typeColor}-500/20`}>
                              <TypeIcon className={`w-6 h-6 text-${typeColor}-400`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h3 className="text-white font-semibold">{announcement.title}</h3>
                                {announcement.version && (
                                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400">
                                    v{announcement.version}
                                  </span>
                                )}
                                <span className={`px-2 py-0.5 rounded text-xs font-medium bg-${typeColor}-500/20 text-${typeColor}-400`}>
                                  {ANNOUNCEMENT_TYPES.find(t => t.value === announcement.type)?.label}
                                </span>
                                {announcement.priority !== 'normal' && (
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium bg-${priorityColor}-500/20 text-${priorityColor}-400`}>
                                    {PRIORITIES.find(p => p.value === announcement.priority)?.label}
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-400 text-sm line-clamp-2">{announcement.content}</p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                <span>Créée le {new Date(announcement.createdAt).toLocaleDateString('fr-FR')}</span>
                                <span className="flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  {announcement.readCount} lectures
                                </span>
                                {announcement.requiresAcknowledgment && (
                                  <span className="text-yellow-400">Accusé requis</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => toggleAnnouncementActive(announcement)}
                              className={`p-2 rounded-lg transition-colors ${
                                announcement.isActive 
                                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                                  : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                              }`}
                              title={announcement.isActive ? 'Désactiver' : 'Activer'}
                            >
                              {announcement.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                            {isAdmin() && (
                              <>
                                <button
                                  onClick={() => resetAnnouncementReads(announcement._id)}
                                  className="p-2 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 transition-colors"
                                  title="Réinitialiser les lectures"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => openAnnouncementModal(announcement)}
                                  className="p-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
                                  title="Modifier"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm({ type: 'announcement', id: announcement._id })}
                                  className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {announcements.length === 0 && (
                    <div className="text-center py-12">
                      <Megaphone className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-500">Aucune annonce</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ==================== PURCHASES TAB ==================== */}
          {activeTab === 'purchases' && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-6">Historique des achats</h2>
              
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                </div>
              ) : stats?.recentPurchases?.length > 0 ? (
                <div className="bg-dark-900/80 backdrop-blur-xl rounded-xl border border-purple-500/20 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Joueur</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Produit</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Prix</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {stats.recentPurchases.map((purchase) => (
                        <tr key={purchase._id} className="hover:bg-white/5">
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-3">
                              <img 
                                src={purchase.user?.discordAvatar ? `https://cdn.discordapp.com/avatars/${purchase.user?.discordId}/${purchase.user?.discordAvatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'}
                                alt=""
                                className="w-8 h-8 rounded-full"
                              />
                              <span className="text-white font-medium">{purchase.user?.username || 'Unknown'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-white">{purchase.item?.name || purchase.itemSnapshot?.name || 'N/A'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-1 text-yellow-400">
                              <Coins className="w-4 h-4" />
                              <span>{purchase.pricePaid}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-gray-400">
                              {new Date(purchase.createdAt).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 bg-dark-900/80 backdrop-blur-xl rounded-xl border border-purple-500/20">
                  <ShoppingBag className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500">Aucun achat pour le moment</p>
                </div>
              )}
            </div>
          )}

          {/* ==================== TROPHIES TAB ==================== */}
          {activeTab === 'trophies' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Trophées ({trophies.length})</h2>
                <div className="flex gap-3">
                  <button
                    onClick={seedDefaultTrophies}
                    className="flex items-center space-x-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Créer trophées par défaut</span>
                  </button>
                  <button
                    onClick={() => openTrophyModal()}
                    className="flex items-center space-x-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nouveau trophée</span>
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                </div>
              ) : trophies.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {trophies.map((trophy) => {
                    const rarityInfo = TROPHY_RARITIES.find(r => r.value === trophy.rarity) || TROPHY_RARITIES[0];
                    const colorInfo = TROPHY_COLORS.find(c => c.value === trophy.color) || TROPHY_COLORS[0];
                    const IconComponent = {
                      Trophy, Award, Medal, Star, Crown, Shield, Zap, Target
                    }[trophy.icon] || Trophy;
                    
                    return (
                      <div 
                        key={trophy._id}
                        className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-${trophy.color}-500/30 p-6 hover:border-${trophy.color}-500/50 transition-all`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div 
                            className="w-14 h-14 rounded-xl flex items-center justify-center"
                            style={{ 
                              backgroundColor: colorInfo.hex + '30',
                              border: `2px solid ${colorInfo.hex}50`
                            }}
                          >
                            <IconComponent className="w-7 h-7" style={{ color: colorInfo.hex }} />
                          </div>
                          <div className="flex items-center gap-2">
                            {trophy.isDefault && (
                              <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium">
                                Défaut
                              </span>
                            )}
                            {!trophy.isActive && (
                              <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-medium">
                                Inactif
                              </span>
                            )}
                            <span className={`px-2 py-1 bg-${rarityInfo.color}-500/20 text-${rarityInfo.color}-400 rounded text-xs font-medium`}>
                              {rarityInfo.label}
                            </span>
                          </div>
                        </div>
                        
                        <h3 className="text-white font-bold text-lg mb-1">{trophy.name}</h3>
                        <p className="text-gray-400 text-sm mb-4">{trophy.description}</p>
                        
                        <div className="flex items-center gap-2 pt-4 border-t border-white/10">
                          <button
                            onClick={() => openAssignTrophyModal(trophy)}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors text-sm"
                          >
                            <UserPlus className="w-4 h-4" />
                            Attribuer
                          </button>
                          <button
                            onClick={() => openTrophyModal(trophy)}
                            className="flex items-center justify-center p-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ type: 'trophy', id: trophy._id, name: trophy.name })}
                            className="flex items-center justify-center p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 bg-dark-900/80 backdrop-blur-xl rounded-xl border border-purple-500/20">
                  <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">Aucun trophée créé</p>
                  <button
                    onClick={seedDefaultTrophies}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Créer le trophée "La Bravoure"
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ==================== DISPUTES TAB ==================== */}
          {activeTab === 'disputes' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Litiges en cours ({disputes.length})</h2>
                <button
                  onClick={fetchDisputes}
                  className="flex items-center space-x-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 text-gray-300 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Actualiser</span>
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                </div>
              ) : disputes.length > 0 ? (
                <div className="space-y-4">
                  {disputes.map((match) => (
                    <div 
                      key={match._id}
                      className="bg-dark-900/80 backdrop-blur-xl rounded-xl border border-orange-500/30 p-6"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Match Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-3">
                            <div className="flex items-center gap-2">
                              {match.challenger?.logo ? (
                                <img src={match.challenger.logo} alt="" className="w-8 h-8 rounded-lg object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-dark-700 flex items-center justify-center">
                                  <Shield className="w-4 h-4 text-gray-500" />
                                </div>
                              )}
                              <span className="text-white font-medium">{match.challenger?.name}</span>
                            </div>
                            <span className="text-orange-400 font-bold">VS</span>
                            <div className="flex items-center gap-2">
                              {match.opponent?.logo ? (
                                <img src={match.opponent.logo} alt="" className="w-8 h-8 rounded-lg object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-dark-700 flex items-center justify-center">
                                  <Shield className="w-4 h-4 text-gray-500" />
                                </div>
                              )}
                              <span className="text-white font-medium">{match.opponent?.name}</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-2 text-xs mb-3">
                            <span className="px-2 py-1 bg-dark-700 rounded text-gray-400">{match.gameMode}</span>
                            <span className="px-2 py-1 bg-dark-700 rounded text-gray-400">{match.teamSize}v{match.teamSize}</span>
                            <span className="px-2 py-1 bg-dark-700 rounded text-gray-400">{match.ladderId}</span>
                          </div>

                          {match.dispute?.reason && (
                            <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                              <p className="text-orange-400 text-xs font-medium mb-1">Raison du litige:</p>
                              <p className="text-gray-300 text-sm">{match.dispute.reason}</p>
                              {match.dispute.reportedAt && (
                                <p className="text-gray-500 text-xs mt-2">
                                  Signalé le {new Date(match.dispute.reportedAt).toLocaleString()}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 lg:min-w-[200px]">
                          <button
                            onClick={() => handleResolveDispute(match._id, match.challenger?._id)}
                            className="w-full py-2 px-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-colors"
                          >
                            🏆 {match.challenger?.name} gagne
                          </button>
                          <button
                            onClick={() => handleResolveDispute(match._id, match.opponent?._id)}
                            className="w-full py-2 px-4 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm font-medium transition-colors"
                          >
                            🏆 {match.opponent?.name} gagne
                          </button>
                          <button
                            onClick={() => handleCancelDispute(match._id)}
                            className="w-full py-2 px-4 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-medium transition-colors"
                          >
                            ✓ Annuler le litige
                          </button>
                          <a
                            href={`/match/${match._id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2 px-4 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded-lg text-sm font-medium transition-colors text-center"
                          >
                            Voir la feuille de match
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-dark-900/80 backdrop-blur-xl rounded-xl border border-orange-500/20">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-gray-400">Aucun litige en cours</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ==================== MODALS ==================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 overflow-y-auto">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowModal(false)}></div>
          
          <div className="relative w-full max-w-2xl bg-dark-900 border border-purple-500/20 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-dark-900 border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {modalType === 'shop' && (editingItem ? 'Modifier l\'article' : 'Nouvel article')}
                {modalType === 'user' && 'Modifier l\'utilisateur'}
                {modalType === 'gold' && 'Gérer les gold coins'}
                {modalType === 'ban' && 'Bannir l\'utilisateur'}
                {modalType === 'banDetails' && 'Détails du bannissement'}
                {modalType === 'userStats' && 'Stats de jeu'}
                {modalType === 'ranking' && 'Modifier le classement'}
                {modalType === 'addPoints' && 'Ajouter/Retirer des points'}
                {modalType === 'ladder' && (editingItem ? 'Modifier le ladder' : 'Nouveau ladder')}
                {modalType === 'trophy' && (editingItem ? 'Modifier le trophée' : 'Nouveau trophée')}
                {modalType === 'assignTrophy' && 'Attribuer le trophée'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Shop Form */}
            {modalType === 'shop' && (
              <form onSubmit={handleShopSubmit} className="p-6 space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Nom *</label>
                    <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Catégorie *</label>
                    <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50">
                      {CATEGORIES.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} required rows={3} className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 resize-none" />
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Prix (Gold) *</label>
                    <input type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: parseInt(e.target.value) || 0})} required min="0" className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Ancien prix</label>
                    <input type="number" value={formData.originalPrice} onChange={(e) => setFormData({...formData, originalPrice: e.target.value ? parseInt(e.target.value) : ''})} min="0" className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Stock (-1 = illimité)</label>
                    <input type="number" value={formData.stock} onChange={(e) => setFormData({...formData, stock: parseInt(e.target.value)})} className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" />
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Rareté</label>
                    <select value={formData.rarity} onChange={(e) => setFormData({...formData, rarity: e.target.value})} className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50">
                      {RARITIES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Mode</label>
                    <select value={formData.mode} onChange={(e) => setFormData({...formData, mode: e.target.value})} className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50">
                      {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Ordre</label>
                    <input type="number" value={formData.sortOrder} onChange={(e) => setFormData({...formData, sortOrder: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">URL de l'image</label>
                  <input type="url" value={formData.image} onChange={(e) => setFormData({...formData, image: e.target.value})} className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" placeholder="https://..." />
                </div>
                <div className="flex items-center space-x-3">
                  <button type="button" onClick={() => setFormData({...formData, isActive: !formData.isActive})} className={`w-12 h-6 rounded-full transition-colors relative ${formData.isActive ? 'bg-green-500' : 'bg-gray-600'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.isActive ? 'translate-x-7' : 'translate-x-1'}`}></div>
                  </button>
                  <span className="text-gray-300">Article actif</span>
                </div>
                {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl"><p className="text-red-400 text-sm">{error}</p></div>}
                <div className="flex space-x-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors">Annuler</button>
                  <button type="submit" disabled={saving} className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center space-x-2">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /><span>{editingItem ? 'Modifier' : 'Créer'}</span></>}
                  </button>
                </div>
              </form>
            )}

            {/* User Form */}
            {modalType === 'user' && (
              <form onSubmit={handleUserSubmit} className="p-6 space-y-6">
                <div className="flex items-center space-x-4 p-4 bg-dark-800/50 rounded-xl">
                  <img src={editingItem?.discordAvatar ? `https://cdn.discordapp.com/avatars/${editingItem.discordId}/${editingItem.discordAvatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'} alt="" className="w-12 h-12 rounded-full" />
                  <div>
                    <p className="text-white font-medium">{editingItem?.username || editingItem?.discordUsername}</p>
                    <p className="text-gray-500 text-sm">{editingItem?.discordUsername}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">Rôles</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map(role => (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => {
                          const newRoles = formData.roles.includes(role.value)
                            ? formData.roles.filter(r => r !== role.value)
                            : [...formData.roles, role.value];
                          if (newRoles.length === 0) newRoles.push('user');
                          setFormData({...formData, roles: newRoles});
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                          formData.roles.includes(role.value)
                            ? `bg-${role.color}-500/20 text-${role.color}-400 border-${role.color}-500/50`
                            : 'bg-dark-800 text-gray-400 border-white/10 hover:border-white/30'
                        }`}
                      >
                        {role.label}
                      </button>
                    ))}
                  </div>
                </div>
                {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl"><p className="text-red-400 text-sm">{error}</p></div>}
                <div className="flex space-x-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors">Annuler</button>
                  <button type="submit" disabled={saving} className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center space-x-2">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /><span>Sauvegarder</span></>}
                  </button>
                </div>
              </form>
            )}

            {/* Gold Form */}
            {modalType === 'gold' && (
              <form onSubmit={handleGoldSubmit} className="p-6 space-y-6">
                <div className="flex items-center space-x-4 p-4 bg-dark-800/50 rounded-xl">
                  <img src={editingItem?.discordAvatar ? `https://cdn.discordapp.com/avatars/${editingItem.discordId}/${editingItem.discordAvatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'} alt="" className="w-12 h-12 rounded-full" />
                  <div className="flex-1">
                    <p className="text-white font-medium">{editingItem?.username || editingItem?.discordUsername}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Coins className="w-4 h-4 text-yellow-400" />
                      <span className="text-yellow-400 font-bold">{editingItem?.goldCoins || 0}</span>
                      <span className="text-gray-500 text-sm">actuellement</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Montant à ajouter/retirer</label>
                  <div className="flex space-x-2">
                    <button type="button" onClick={() => setFormData({...formData, goldAmount: -100})} className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30">-100</button>
                    <button type="button" onClick={() => setFormData({...formData, goldAmount: -50})} className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30">-50</button>
                    <input
                      type="number"
                      value={formData.goldAmount}
                      onChange={(e) => setFormData({...formData, goldAmount: parseInt(e.target.value) || 0})}
                      className="flex-1 px-4 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-center focus:outline-none focus:border-yellow-500/50"
                      placeholder="0"
                    />
                    <button type="button" onClick={() => setFormData({...formData, goldAmount: 50})} className="px-3 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30">+50</button>
                    <button type="button" onClick={() => setFormData({...formData, goldAmount: 100})} className="px-3 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30">+100</button>
                  </div>
                  <div className="flex space-x-2 mt-2">
                    <button type="button" onClick={() => setFormData({...formData, goldAmount: 500})} className="flex-1 px-3 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30">+500</button>
                    <button type="button" onClick={() => setFormData({...formData, goldAmount: 1000})} className="flex-1 px-3 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30">+1000</button>
                    <button type="button" onClick={() => setFormData({...formData, goldAmount: 5000})} className="flex-1 px-3 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30">+5000</button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Raison (optionnel)</label>
                  <input
                    type="text"
                    value={formData.goldReason}
                    onChange={(e) => setFormData({...formData, goldReason: e.target.value})}
                    className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500/50"
                    placeholder="Cadeau, compensation, événement..."
                  />
                </div>

                {formData.goldAmount !== 0 && (
                  <div className={`p-4 rounded-xl ${formData.goldAmount > 0 ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                    <p className={`text-center font-medium ${formData.goldAmount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      Nouveau solde: {Math.max(0, (editingItem?.goldCoins || 0) + formData.goldAmount)} gold
                    </p>
                  </div>
                )}

                {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl"><p className="text-red-400 text-sm">{error}</p></div>}

                <div className="flex space-x-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors">Annuler</button>
                  <button type="submit" disabled={saving || formData.goldAmount === 0} className="flex-1 py-3 px-4 bg-gradient-to-r from-yellow-500 to-amber-500 text-yellow-900 font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center space-x-2">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Coins className="w-5 h-5" /><span>Appliquer</span></>}
                  </button>
                </div>
              </form>
            )}

            {/* Ban Form */}
            {modalType === 'ban' && (
              <form onSubmit={handleBanSubmit} className="p-6 space-y-6">
                <div className="flex items-center space-x-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <img src={editingItem?.discordAvatar ? `https://cdn.discordapp.com/avatars/${editingItem.discordId}/${editingItem.discordAvatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'} alt="" className="w-12 h-12 rounded-full" />
                  <div>
                    <p className="text-white font-medium">{editingItem?.username || editingItem?.discordUsername}</p>
                    <p className="text-red-400 text-sm">Sera banni de la plateforme</p>
                  </div>
                </div>

                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                    <div>
                      <p className="text-red-400 font-medium">Attention</p>
                      <p className="text-gray-400 text-sm">L'utilisateur ne pourra plus accéder à la plateforme. Cette action peut être annulée.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Raison du bannissement *</label>
                  <textarea
                    value={formData.banReason}
                    onChange={(e) => setFormData({...formData, banReason: e.target.value})}
                    required
                    rows={3}
                    className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-red-500/50 resize-none"
                    placeholder="Décrivez la raison du bannissement..."
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Date de début du ban</label>
                    <input
                      type="datetime-local"
                      value={formData.banStartDate || ''}
                      onChange={(e) => setFormData({...formData, banStartDate: e.target.value})}
                      className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-red-500/50"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Par défaut : maintenant
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Date de fin du ban</label>
                    <input
                      type="datetime-local"
                      value={formData.banEndDate || ''}
                      onChange={(e) => setFormData({...formData, banEndDate: e.target.value})}
                      className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-red-500/50"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Laissez vide pour permanent
                    </p>
                  </div>
                </div>
                
                {/* Quick shortcuts */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-gray-500">Raccourcis :</span>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                      setFormData({
                        ...formData,
                        banStartDate: now.toISOString().slice(0, 16),
                        banEndDate: end.toISOString().slice(0, 16)
                      });
                    }}
                    className="px-2 py-1 bg-dark-800 text-gray-300 text-xs rounded hover:bg-dark-700 transition-colors"
                  >
                    24h
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                      setFormData({
                        ...formData,
                        banStartDate: now.toISOString().slice(0, 16),
                        banEndDate: end.toISOString().slice(0, 16)
                      });
                    }}
                    className="px-2 py-1 bg-dark-800 text-gray-300 text-xs rounded hover:bg-dark-700 transition-colors"
                  >
                    7 jours
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                      setFormData({
                        ...formData,
                        banStartDate: now.toISOString().slice(0, 16),
                        banEndDate: end.toISOString().slice(0, 16)
                      });
                    }}
                    className="px-2 py-1 bg-dark-800 text-gray-300 text-xs rounded hover:bg-dark-700 transition-colors"
                  >
                    30 jours
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      setFormData({
                        ...formData,
                        banStartDate: now.toISOString().slice(0, 16),
                        banEndDate: ''
                      });
                    }}
                    className="px-2 py-1 bg-dark-800 text-gray-300 text-xs rounded hover:bg-dark-700 transition-colors"
                  >
                    Permanent
                  </button>
                </div>

                {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl"><p className="text-red-400 text-sm">{error}</p></div>}

                <div className="flex space-x-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors">Annuler</button>
                  <button type="submit" disabled={saving || !formData.banReason} className="flex-1 py-3 px-4 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 disabled:opacity-50 transition-all flex items-center justify-center space-x-2">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Ban className="w-5 h-5" /><span>Bannir l'utilisateur</span></>}
                  </button>
                </div>
              </form>
            )}

            {/* Ban Details Modal */}
            {modalType === 'banDetails' && banDetails && (
              <div className="p-6 space-y-6">
                {/* User info */}
                <div className="flex items-center space-x-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <img 
                    src={banDetails.discordAvatar ? `https://cdn.discordapp.com/avatars/${banDetails.discordId}/${banDetails.discordAvatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'} 
                    alt="" 
                    className="w-12 h-12 rounded-full"
                  />
                  <div>
                    <p className="text-white font-medium">{banDetails.username || banDetails.discordUsername}</p>
                    <p className="text-red-400 text-sm">Utilisateur banni</p>
                  </div>
                </div>

                {/* Ban info grid */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Raison */}
                  <div className="md:col-span-2 p-4 bg-dark-800/50 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <p className="text-sm font-medium text-gray-400">Raison du bannissement</p>
                    </div>
                    <p className="text-white">{banDetails.banReason || 'Non spécifiée'}</p>
                  </div>

                  {/* Banni par */}
                  <div className="p-4 bg-dark-800/50 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-purple-400" />
                      <p className="text-sm font-medium text-gray-400">Banni par</p>
                    </div>
                    <p className="text-white">{banDetails.bannedBy?.username || 'Système'}</p>
                  </div>

                  {/* Date de début */}
                  <div className="p-4 bg-dark-800/50 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-blue-400" />
                      <p className="text-sm font-medium text-gray-400">Date de début</p>
                    </div>
                    <p className="text-white">
                      {banDetails.bannedAt ? new Date(banDetails.bannedAt).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'Inconnue'}
                    </p>
                  </div>

                  {/* Date de fin */}
                  <div className="md:col-span-2 p-4 bg-dark-800/50 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-orange-400" />
                      <p className="text-sm font-medium text-gray-400">Date de fin</p>
                    </div>
                    {banDetails.banExpiresAt ? (
                      <div>
                        <p className="text-white mb-1">
                          {new Date(banDetails.banExpiresAt).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(banDetails.banExpiresAt) > new Date() 
                            ? `Expire dans ${Math.ceil((new Date(banDetails.banExpiresAt) - new Date()) / (1000 * 60 * 60 * 24))} jour(s)`
                            : 'Expiré (déban automatique en attente)'}
                        </p>
                      </div>
                    ) : (
                      <p className="text-red-400 font-medium">Bannissement permanent</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowModal(false)} 
                    className="flex-1 py-3 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors"
                  >
                    Fermer
                  </button>
                  <button 
                    onClick={() => {
                      handleUnbanUser(banDetails._id);
                      setShowModal(false);
                    }}
                    className="flex-1 py-3 px-4 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <UserCheck className="w-5 h-5" />
                    <span>Débannir maintenant</span>
                  </button>
                </div>
              </div>
            )}

            {/* User Game Stats Modal */}
            {modalType === 'userStats' && (
              <div className="p-6 space-y-6">
                {/* User info header */}
                <div className="flex items-center space-x-4 p-4 bg-dark-800/50 rounded-xl">
                  <img 
                    src={editingItem?.discordAvatar ? `https://cdn.discordapp.com/avatars/${editingItem.discordId}/${editingItem.discordAvatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'} 
                    alt="" 
                    className="w-14 h-14 rounded-full border-2 border-cyan-500/50" 
                  />
                  <div>
                    <p className="text-white font-bold text-lg">{editingItem?.username || editingItem?.discordUsername}</p>
                    <p className="text-gray-500 text-sm">@{editingItem?.discordUsername}</p>
                  </div>
                </div>

                {loadingStats ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Stats Hardcore */}
                    <div className="p-4 bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-xl">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                          <Skull className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-white font-bold">Mode Hardcore</h3>
                          <p className="text-gray-500 text-xs">Saison 1</p>
                        </div>
                      </div>

                      {userGameStats?.hardcore ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                            <p className="text-2xl font-bold text-red-400">#{userGameStats.hardcore.rank || '-'}</p>
                            <p className="text-xs text-gray-500 uppercase">Rang</p>
                          </div>
                          <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                            <p className="text-2xl font-bold text-white">{userGameStats.hardcore.points || 0}</p>
                            <p className="text-xs text-gray-500 uppercase">Points</p>
                          </div>
                          <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                            <p className="text-2xl font-bold text-green-400">{userGameStats.hardcore.wins || 0}</p>
                            <p className="text-xs text-gray-500 uppercase">Victoires</p>
                          </div>
                          <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                            <p className="text-2xl font-bold text-red-400">{userGameStats.hardcore.losses || 0}</p>
                            <p className="text-xs text-gray-500 uppercase">Défaites</p>
                          </div>
                          <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                            <p className="text-2xl font-bold text-yellow-400">
                              {userGameStats.hardcore.wins + userGameStats.hardcore.losses > 0 
                                ? Math.round((userGameStats.hardcore.wins / (userGameStats.hardcore.wins + userGameStats.hardcore.losses)) * 100) + '%'
                                : '0%'}
                            </p>
                            <p className="text-xs text-gray-500 uppercase">Win Rate</p>
                          </div>
                          <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                            <p className="text-2xl font-bold text-cyan-400">{userGameStats.hardcore.kills || 0}</p>
                            <p className="text-xs text-gray-500 uppercase">Kills</p>
                          </div>
                          <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                            <p className="text-2xl font-bold text-gray-400">{userGameStats.hardcore.deaths || 0}</p>
                            <p className="text-xs text-gray-500 uppercase">Deaths</p>
                          </div>
                          <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                            <p className="text-2xl font-bold text-purple-400">
                              {userGameStats.hardcore.deaths > 0 
                                ? (userGameStats.hardcore.kills / userGameStats.hardcore.deaths).toFixed(2)
                                : userGameStats.hardcore.kills?.toFixed(2) || '0.00'}
                            </p>
                            <p className="text-xs text-gray-500 uppercase">K/D</p>
                          </div>
                          <div className="col-span-2 text-center p-3 bg-dark-800/50 rounded-lg">
                            <p className="text-2xl font-bold text-orange-400 capitalize">{userGameStats.hardcore.division || 'Bronze'}</p>
                            <p className="text-xs text-gray-500 uppercase">Division</p>
                          </div>
                          <div className="col-span-2 text-center p-3 bg-dark-800/50 rounded-lg">
                            <p className="text-2xl font-bold text-amber-400">🔥 {userGameStats.hardcore.currentStreak || 0}</p>
                            <p className="text-xs text-gray-500 uppercase">Série actuelle (max: {userGameStats.hardcore.bestStreak || 0})</p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Swords className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                          <p className="text-gray-500">Aucune donnée de classement</p>
                        </div>
                      )}
                    </div>

                    {/* Stats CDL */}
                    <div className="p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                          <Trophy className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-white font-bold">Mode CDL</h3>
                          <p className="text-gray-500 text-xs">Saison 1</p>
                        </div>
                      </div>

                      {userGameStats?.cdl ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                            <p className="text-2xl font-bold text-cyan-400">#{userGameStats.cdl.rank || '-'}</p>
                            <p className="text-xs text-gray-500 uppercase">Rang</p>
                          </div>
                          <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                            <p className="text-2xl font-bold text-white">{userGameStats.cdl.points || 0}</p>
                            <p className="text-xs text-gray-500 uppercase">Points</p>
                          </div>
                          <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                            <p className="text-2xl font-bold text-green-400">{userGameStats.cdl.wins || 0}</p>
                            <p className="text-xs text-gray-500 uppercase">Victoires</p>
                          </div>
                          <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                            <p className="text-2xl font-bold text-red-400">{userGameStats.cdl.losses || 0}</p>
                            <p className="text-xs text-gray-500 uppercase">Défaites</p>
                          </div>
                          <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                            <p className="text-2xl font-bold text-yellow-400">
                              {userGameStats.cdl.wins + userGameStats.cdl.losses > 0 
                                ? Math.round((userGameStats.cdl.wins / (userGameStats.cdl.wins + userGameStats.cdl.losses)) * 100) + '%'
                                : '0%'}
                            </p>
                            <p className="text-xs text-gray-500 uppercase">Win Rate</p>
                          </div>
                          <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                            <p className="text-2xl font-bold text-cyan-400">{userGameStats.cdl.kills || 0}</p>
                            <p className="text-xs text-gray-500 uppercase">Kills</p>
                          </div>
                          <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                            <p className="text-2xl font-bold text-gray-400">{userGameStats.cdl.deaths || 0}</p>
                            <p className="text-xs text-gray-500 uppercase">Deaths</p>
                          </div>
                          <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                            <p className="text-2xl font-bold text-purple-400">
                              {userGameStats.cdl.deaths > 0 
                                ? (userGameStats.cdl.kills / userGameStats.cdl.deaths).toFixed(2)
                                : userGameStats.cdl.kills?.toFixed(2) || '0.00'}
                            </p>
                            <p className="text-xs text-gray-500 uppercase">K/D</p>
                          </div>
                          <div className="col-span-2 text-center p-3 bg-dark-800/50 rounded-lg">
                            <p className="text-2xl font-bold text-blue-400 capitalize">{userGameStats.cdl.division || 'Bronze'}</p>
                            <p className="text-xs text-gray-500 uppercase">Division</p>
                          </div>
                          <div className="col-span-2 text-center p-3 bg-dark-800/50 rounded-lg">
                            <p className="text-2xl font-bold text-amber-400">🔥 {userGameStats.cdl.currentStreak || 0}</p>
                            <p className="text-xs text-gray-500 uppercase">Série actuelle (max: {userGameStats.cdl.bestStreak || 0})</p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Swords className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                          <p className="text-gray-500">Aucune donnée de classement</p>
                        </div>
                      )}
                    </div>

                    {/* Infos supplémentaires */}
                    <div className="p-4 bg-dark-800/50 rounded-xl">
                      <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-purple-400" />
                        Informations du compte
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Gold Coins</span>
                          <span className="text-yellow-400 font-bold">{editingItem?.goldCoins || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Profil complet</span>
                          <span className={editingItem?.isProfileComplete ? 'text-green-400' : 'text-red-400'}>
                            {editingItem?.isProfileComplete ? 'Oui' : 'Non'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Membre depuis</span>
                          <span className="text-white">
                            {editingItem?.createdAt ? new Date(editingItem.createdAt).toLocaleDateString('fr-FR') : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Statut</span>
                          <span className={editingItem?.isBanned ? 'text-red-400' : 'text-green-400'}>
                            {editingItem?.isBanned ? 'Banni' : 'Actif'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <button 
                    onClick={() => setShowModal(false)} 
                    className="py-3 px-6 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            )}

            {/* Ranking Form */}
            {modalType === 'ranking' && (
              <form onSubmit={handleRankingSubmit} className="p-6 space-y-6">
                <div className="flex items-center space-x-4 p-4 bg-dark-800/50 rounded-xl">
                  <img src={editingItem?.user?.discordAvatar || editingItem?.userInfo?.discordAvatar ? `https://cdn.discordapp.com/avatars/${editingItem?.user?.discordId || editingItem?.userInfo?.discordId}/${editingItem?.user?.discordAvatar || editingItem?.userInfo?.discordAvatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'} alt="" className="w-12 h-12 rounded-full" />
                  <div>
                    <p className="text-white font-medium">{editingItem?.user?.username || editingItem?.userInfo?.username}</p>
                    <p className="text-gray-500 text-sm capitalize">{editingItem?.mode}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Points</label>
                    <input type="number" value={formData.points} onChange={(e) => setFormData({...formData, points: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Division</label>
                    <select value={formData.division} onChange={(e) => setFormData({...formData, division: e.target.value})} className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50">
                      {DIVISIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Victoires</label>
                    <input type="number" value={formData.wins} onChange={(e) => setFormData({...formData, wins: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Défaites</label>
                    <input type="number" value={formData.losses} onChange={(e) => setFormData({...formData, losses: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Kills</label>
                    <input type="number" value={formData.kills} onChange={(e) => setFormData({...formData, kills: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Deaths</label>
                    <input type="number" value={formData.deaths} onChange={(e) => setFormData({...formData, deaths: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Équipe</label>
                  <input type="text" value={formData.team} onChange={(e) => setFormData({...formData, team: e.target.value})} className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" placeholder="Nom de l'équipe" />
                </div>
                {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl"><p className="text-red-400 text-sm">{error}</p></div>}
                <div className="flex space-x-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors">Annuler</button>
                  <button type="submit" disabled={saving} className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center space-x-2">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /><span>Sauvegarder</span></>}
                  </button>
                </div>
              </form>
            )}

            {/* Announcement Form */}
            {modalType === 'announcement' && (
              <form onSubmit={handleAnnouncementSubmit} className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Titre *</label>
                  <input type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" placeholder="Titre de l'annonce" />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                    <select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50">
                      {ANNOUNCEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Version (optionnel)</label>
                    <input type="text" value={formData.version} onChange={(e) => setFormData({...formData, version: e.target.value})} className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" placeholder="Ex: 1.2.0" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Contenu *</label>
                  <textarea value={formData.content} onChange={(e) => setFormData({...formData, content: e.target.value})} required rows={8} className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 resize-none font-mono text-sm" placeholder="Contenu de l'annonce...&#10;&#10;Utilise:&#10;## pour les titres&#10;### pour les sous-titres&#10;- pour les listes" />
                  <p className="text-xs text-gray-500 mt-1">Supporte le formatage basique: ## Titre, ### Sous-titre, - liste</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Priorité</label>
                    <select value={formData.priority} onChange={(e) => setFormData({...formData, priority: e.target.value})} className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50">
                      {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Mode cible</label>
                    <select value={formData.targetMode} onChange={(e) => setFormData({...formData, targetMode: e.target.value})} className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50">
                      <option value="all">Tous les modes</option>
                      <option value="hardcore">Hardcore uniquement</option>
                      <option value="cdl">CDL uniquement</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-3">
                    <button type="button" onClick={() => setFormData({...formData, requiresAcknowledgment: !formData.requiresAcknowledgment})} className={`w-12 h-6 rounded-full transition-colors relative ${formData.requiresAcknowledgment ? 'bg-yellow-500' : 'bg-gray-600'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.requiresAcknowledgment ? 'translate-x-7' : 'translate-x-1'}`}></div>
                    </button>
                    <span className="text-gray-300 text-sm">Accusé de lecture requis</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button type="button" onClick={() => setFormData({...formData, isActive: !formData.isActive})} className={`w-12 h-6 rounded-full transition-colors relative ${formData.isActive ? 'bg-green-500' : 'bg-gray-600'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.isActive ? 'translate-x-7' : 'translate-x-1'}`}></div>
                    </button>
                    <span className="text-gray-300 text-sm">Active</span>
                  </div>
                </div>

                {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl"><p className="text-red-400 text-sm">{error}</p></div>}

                <div className="flex space-x-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors">Annuler</button>
                  <button type="submit" disabled={saving} className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center space-x-2">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /><span>{editingItem ? 'Modifier' : 'Publier'}</span></>}
                  </button>
                </div>
              </form>
            )}

            {/* Ladder Form */}
            {modalType === 'ladder' && (
              <form onSubmit={async (e) => {
                e.preventDefault();
                setSaving(true);
                try {
                  const url = editingItem 
                    ? `${API_URL}/ladders/admin/${editingItem._id}`
                    : `${API_URL}/ladders/admin`;
                  
                  const response = await fetch(url, {
                    method: editingItem ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(formData)
                  });

                  const data = await response.json();
                  if (!response.ok) throw new Error(data.message);

                  setSuccess(editingItem ? 'Ladder modifié !' : 'Ladder créé !');
                  setShowModal(false);
                  fetchLadders();
                  setTimeout(() => setSuccess(''), 3000);
                } catch (err) {
                  setError(err.message);
                } finally {
                  setSaving(false);
                }
              }} className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nom *</label>
                  <input 
                    type="text" 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})} 
                    required 
                    className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" 
                    placeholder="Classement Duo" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                  <textarea 
                    value={formData.description} 
                    onChange={(e) => setFormData({...formData, description: e.target.value})} 
                    rows={2} 
                    className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 resize-none" 
                    placeholder="Affronte les meilleurs duos..." 
                  />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Taille équipe *</label>
                    <select 
                      value={formData.teamSize} 
                      onChange={(e) => setFormData({...formData, teamSize: e.target.value})} 
                      className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                    >
                      <option value="2v2">2v2</option>
                      <option value="3v3">3v3</option>
                      <option value="4v4">4v4</option>
                      <option value="5v5">5v5</option>
                      <option value="3v3-5v5">3v3-5v5</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Mode cible</label>
                    <select 
                      value={formData.mode} 
                      onChange={(e) => setFormData({...formData, mode: e.target.value})} 
                      className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                    >
                      <option value="all">Tous</option>
                      <option value="hardcore">Hardcore</option>
                      <option value="cdl">CDL</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Ordre</label>
                    <input 
                      type="number" 
                      value={formData.sortOrder} 
                      onChange={(e) => setFormData({...formData, sortOrder: parseInt(e.target.value) || 0})} 
                      className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" 
                    />
                  </div>
                </div>

                {/* Game Modes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-300">Modes de jeu</label>
                    <button 
                      type="button"
                      onClick={() => setFormData({
                        ...formData, 
                        gameModes: [...(formData.gameModes || []), { name: '', icon: 'Target', isActive: true }]
                      })}
                      className="text-xs text-purple-400 hover:text-purple-300"
                    >
                      + Ajouter un mode
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(formData.gameModes || []).map((mode, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-3 bg-dark-800/50 rounded-lg">
                        <input 
                          type="text" 
                          value={mode.name} 
                          onChange={(e) => {
                            const newModes = [...formData.gameModes];
                            newModes[idx].name = e.target.value;
                            setFormData({...formData, gameModes: newModes});
                          }}
                          placeholder="Search & Destroy"
                          className="flex-1 px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50" 
                        />
                        <select 
                          value={mode.icon} 
                          onChange={(e) => {
                            const newModes = [...formData.gameModes];
                            newModes[idx].icon = e.target.value;
                            setFormData({...formData, gameModes: newModes});
                          }}
                          className="px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50"
                        >
                          <option value="Target">Target</option>
                          <option value="Flag">Flag</option>
                          <option value="Skull">Skull</option>
                          <option value="Check">Check</option>
                        </select>
                        <button 
                          type="button"
                          onClick={() => {
                            const newModes = [...formData.gameModes];
                            newModes[idx].isActive = !newModes[idx].isActive;
                            setFormData({...formData, gameModes: newModes});
                          }}
                          className={`p-2 rounded-lg ${mode.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                        >
                          {mode.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            const newModes = formData.gameModes.filter((_, i) => i !== idx);
                            setFormData({...formData, gameModes: newModes});
                          }}
                          className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {(!formData.gameModes || formData.gameModes.length === 0) && (
                      <p className="text-gray-500 text-sm text-center py-4">Aucun mode de jeu configuré</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button 
                    type="button" 
                    onClick={() => setFormData({...formData, isActive: !formData.isActive})} 
                    className={`w-12 h-6 rounded-full transition-colors relative ${formData.isActive ? 'bg-green-500' : 'bg-gray-600'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.isActive ? 'translate-x-7' : 'translate-x-1'}`}></div>
                  </button>
                  <span className="text-gray-300 text-sm">Ladder actif</span>
                </div>

                {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl"><p className="text-red-400 text-sm">{error}</p></div>}

                <div className="flex space-x-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors">Annuler</button>
                  <button type="submit" disabled={saving} className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center space-x-2">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /><span>{editingItem ? 'Modifier' : 'Créer'}</span></>}
                  </button>
                </div>
              </form>
            )}

            {/* Trophy Form */}
            {modalType === 'trophy' && (
              <form onSubmit={(e) => { e.preventDefault(); saveTrophy(); }} className="p-6 space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Nom (identifiant) *</label>
                    <input 
                      type="text" 
                      value={formData.name} 
                      onChange={(e) => setFormData({...formData, name: e.target.value})} 
                      required 
                      className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" 
                      placeholder="La Bravoure"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
                    <input 
                      type="text" 
                      value={formData.description} 
                      onChange={(e) => setFormData({...formData, description: e.target.value})} 
                      required 
                      className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" 
                      placeholder="Création de l'escouade"
                    />
                  </div>
                </div>

                {/* Translations */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-300">Traductions</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {['fr', 'en', 'de', 'it'].map((lang) => (
                      <div key={lang} className="p-4 bg-dark-800/50 rounded-xl space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-gray-400 uppercase">{lang}</span>
                        </div>
                        <input
                          type="text"
                          placeholder="Nom"
                          value={formData.translations?.[lang]?.name || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            translations: {
                              ...formData.translations,
                              [lang]: { ...formData.translations?.[lang], name: e.target.value }
                            }
                          })}
                          className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50"
                        />
                        <input
                          type="text"
                          placeholder="Description"
                          value={formData.translations?.[lang]?.description || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            translations: {
                              ...formData.translations,
                              [lang]: { ...formData.translations?.[lang], description: e.target.value }
                            }
                          })}
                          className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Icon & Color */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Icône</label>
                    <select
                      value={formData.icon}
                      onChange={(e) => setFormData({...formData, icon: e.target.value})}
                      className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                    >
                      {TROPHY_ICONS.map(icon => (
                        <option key={icon.value} value={icon.value}>{icon.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Couleur</label>
                    <select
                      value={formData.color}
                      onChange={(e) => setFormData({...formData, color: e.target.value})}
                      className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                    >
                      {TROPHY_COLORS.map(color => (
                        <option key={color.value} value={color.value}>{color.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Rareté</label>
                    <select
                      value={formData.rarity}
                      onChange={(e) => {
                        const rarity = parseInt(e.target.value);
                        const rarityInfo = TROPHY_RARITIES.find(r => r.value === rarity);
                        setFormData({...formData, rarity, rarityName: rarityInfo?.name || 'common'});
                      }}
                      className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                    >
                      {TROPHY_RARITIES.map(rarity => (
                        <option key={rarity.value} value={rarity.value}>{rarity.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Options */}
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center space-x-3">
                    <button 
                      type="button" 
                      onClick={() => setFormData({...formData, isDefault: !formData.isDefault})} 
                      className={`w-12 h-6 rounded-full transition-colors relative ${formData.isDefault ? 'bg-green-500' : 'bg-gray-600'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.isDefault ? 'translate-x-7' : 'translate-x-1'}`}></div>
                    </button>
                    <span className="text-gray-300 text-sm">Trophée par défaut (toutes les escouades)</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button 
                      type="button" 
                      onClick={() => setFormData({...formData, isActive: !formData.isActive})} 
                      className={`w-12 h-6 rounded-full transition-colors relative ${formData.isActive ? 'bg-green-500' : 'bg-gray-600'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.isActive ? 'translate-x-7' : 'translate-x-1'}`}></div>
                    </button>
                    <span className="text-gray-300 text-sm">Trophée actif</span>
                  </div>
                </div>

                {/* Preview */}
                <div className="p-4 bg-dark-800/50 rounded-xl">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Aperçu</p>
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-14 h-14 rounded-xl flex items-center justify-center"
                      style={{ 
                        backgroundColor: (TROPHY_COLORS.find(c => c.value === formData.color)?.hex || '#f59e0b') + '30',
                        border: `2px solid ${(TROPHY_COLORS.find(c => c.value === formData.color)?.hex || '#f59e0b')}50`
                      }}
                    >
                      {(() => {
                        const IconComp = { Trophy, Award, Medal, Star, Crown, Shield, Zap, Target }[formData.icon] || Trophy;
                        return <IconComp className="w-7 h-7" style={{ color: TROPHY_COLORS.find(c => c.value === formData.color)?.hex || '#f59e0b' }} />;
                      })()}
                    </div>
                    <div>
                      <p className="text-white font-bold">{formData.translations?.fr?.name || formData.name || 'Nom du trophée'}</p>
                      <p className="text-gray-400 text-sm">{formData.translations?.fr?.description || formData.description || 'Description'}</p>
                    </div>
                  </div>
                </div>

                {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl"><p className="text-red-400 text-sm">{error}</p></div>}

                <div className="flex space-x-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors">Annuler</button>
                  <button type="submit" disabled={saving} className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center space-x-2">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /><span>{editingItem ? 'Modifier' : 'Créer'}</span></>}
                  </button>
                </div>
              </form>
            )}

            {/* Add Points Form */}
            {modalType === 'addPoints' && (
              <form onSubmit={handleAddPoints} className="p-6 space-y-6">
                <div className="flex items-center space-x-4 p-4 bg-dark-800/50 rounded-xl">
                  <img src={editingItem?.user?.discordAvatar || editingItem?.userInfo?.discordAvatar ? `https://cdn.discordapp.com/avatars/${editingItem?.user?.discordId || editingItem?.userInfo?.discordId}/${editingItem?.user?.discordAvatar || editingItem?.userInfo?.discordAvatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'} alt="" className="w-12 h-12 rounded-full" />
                  <div>
                    <p className="text-white font-medium">{editingItem?.user?.username || editingItem?.userInfo?.username}</p>
                    <p className="text-gray-500 text-sm">Actuellement: <span className="text-purple-400 font-bold">{editingItem?.points} points</span></p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Points à ajouter/retirer</label>
                  <input type="number" value={formData.points} onChange={(e) => setFormData({...formData, points: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" placeholder="Ex: 50 ou -25" />
                  <p className="text-xs text-gray-500 mt-1">Utilisez un nombre négatif pour retirer des points</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Raison (optionnel)</label>
                  <input type="text" value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50" placeholder="Victoire en tournoi, bonus, pénalité..." />
                </div>
                {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl"><p className="text-red-400 text-sm">{error}</p></div>}
                <div className="flex space-x-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors">Annuler</button>
                  <button type="submit" disabled={saving || formData.points === 0} className="flex-1 py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center space-x-2">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /><span>Appliquer</span></>}
                  </button>
                </div>
              </form>
            )}

            {/* Assign Trophy Form */}
            {modalType === 'assignTrophy' && editingItem && (
              <div className="p-6 space-y-6">
                {/* Trophy Preview */}
                <div className="flex items-center gap-4 p-4 bg-dark-800/50 rounded-xl">
                  <div 
                    className="w-14 h-14 rounded-xl flex items-center justify-center"
                    style={{ 
                      backgroundColor: (TROPHY_COLORS.find(c => c.value === editingItem.color)?.hex || '#f59e0b') + '30',
                      border: `2px solid ${(TROPHY_COLORS.find(c => c.value === editingItem.color)?.hex || '#f59e0b')}50`
                    }}
                  >
                    {(() => {
                      const IconComp = { Trophy, Award, Medal, Star, Crown, Shield, Zap, Target }[editingItem.icon] || Trophy;
                      return <IconComp className="w-7 h-7" style={{ color: TROPHY_COLORS.find(c => c.value === editingItem.color)?.hex || '#f59e0b' }} />;
                    })()}
                  </div>
                  <div>
                    <p className="text-white font-bold">{editingItem.name}</p>
                    <p className="text-gray-400 text-sm">{editingItem.description}</p>
                  </div>
                </div>

                {/* Search Squad */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Rechercher une escouade</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      value={assignTrophySearch}
                      onChange={(e) => setAssignTrophySearch(e.target.value)}
                      placeholder="Nom ou tag de l'escouade..."
                      className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                </div>

                {/* Squad List */}
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {allSquads
                    .filter(squad => 
                      squad.name.toLowerCase().includes(assignTrophySearch.toLowerCase()) ||
                      squad.tag.toLowerCase().includes(assignTrophySearch.toLowerCase())
                    )
                    .slice(0, 10)
                    .map(squad => {
                      const hasTrophy = squad.trophies?.some(t => t.trophy?._id === editingItem._id || t.trophy === editingItem._id);
                      
                      return (
                        <div
                          key={squad._id}
                          onClick={() => !hasTrophy && setSelectedSquadForTrophy(squad)}
                          className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedSquadForTrophy?._id === squad._id 
                              ? 'bg-purple-500/30 border border-purple-500/50' 
                              : hasTrophy
                              ? 'bg-gray-800/30 opacity-50 cursor-not-allowed'
                              : 'bg-dark-800/50 hover:bg-dark-800 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-10 h-10 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: squad.color + '30' }}
                            >
                              {squad.logo ? (
                                <img src={squad.logo} alt="" className="w-6 h-6 object-contain" />
                              ) : (
                                <Users className="w-5 h-5" style={{ color: squad.color }} />
                              )}
                            </div>
                            <div>
                              <p className="text-white font-medium">{squad.name}</p>
                              <p className="text-gray-500 text-xs">[{squad.tag}] • {squad.members?.length || 0} membres</p>
                            </div>
                          </div>
                          {hasTrophy ? (
                            <span className="text-xs text-green-400 px-2 py-1 bg-green-500/20 rounded">Possède déjà</span>
                          ) : selectedSquadForTrophy?._id === squad._id ? (
                            <span className="text-xs text-purple-400 px-2 py-1 bg-purple-500/20 rounded">Sélectionné</span>
                          ) : null}
                        </div>
                      );
                    })
                  }
                </div>

                {/* Squads with this trophy */}
                {allSquads.filter(s => s.trophies?.some(t => t.trophy?._id === editingItem._id || t.trophy === editingItem._id)).length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Escouades ayant ce trophée</label>
                    <div className="space-y-2">
                      {allSquads
                        .filter(s => s.trophies?.some(t => t.trophy?._id === editingItem._id || t.trophy === editingItem._id))
                        .map(squad => (
                          <div key={squad._id} className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: squad.color + '30' }}
                              >
                                <Users className="w-4 h-4" style={{ color: squad.color }} />
                              </div>
                              <span className="text-white text-sm">{squad.name} [{squad.tag}]</span>
                            </div>
                            <button
                              onClick={() => removeTrophyFromSquad(squad._id, editingItem._id)}
                              className="text-xs text-red-400 hover:text-red-300 px-2 py-1 bg-red-500/20 rounded hover:bg-red-500/30 transition-colors"
                            >
                              Retirer
                            </button>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                )}

                {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl"><p className="text-red-400 text-sm">{error}</p></div>}

                <div className="flex space-x-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowModal(false)} 
                    className="flex-1 py-3 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={assignTrophyToSquad}
                    disabled={!selectedSquadForTrophy || assigningTrophy} 
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
                  >
                    {assigningTrophy ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Trophy className="w-5 h-5" />
                        <span>Attribuer</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setDeleteConfirm(null)}></div>
          <div className="relative bg-dark-900 border border-red-500/20 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Confirmer la suppression</h3>
            <p className="text-gray-400 mb-6">Es-tu sûr de vouloir supprimer cet élément ? Cette action est irréversible.</p>
            <div className="flex space-x-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors">Annuler</button>
              <button onClick={() => {
                if (deleteConfirm.type === 'shop') handleDeleteItem(deleteConfirm.id);
                if (deleteConfirm.type === 'announcement') handleDeleteAnnouncement(deleteConfirm.id);
                if (deleteConfirm.type === 'trophy') deleteTrophy(deleteConfirm.id);
              }} className="flex-1 py-3 px-4 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition-colors">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
