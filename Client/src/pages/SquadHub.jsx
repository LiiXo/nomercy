import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { getDefaultAvatar } from '../utils/avatar';
import { 
  Users, Search, Plus, Filter, RefreshCw, Loader2, X, 
  AlertCircle, Check, Monitor, Gamepad2, ChevronDown,
  Megaphone, UserPlus, Clock, MapPin, MessageSquare,
  Shield, Crown, ExternalLink, Trash2, ChevronLeft, ChevronRight
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const SquadHub = () => {
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const { user, isAuthenticated } = useAuth();

  // State
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPosts, setTotalPosts] = useState(0);
  const POSTS_PER_PAGE = 10;
  
  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  // Filters
  const [filterType, setFilterType] = useState('all');
  const [filterMode, setFilterMode] = useState('all');
  const [filterPlatform, setFilterPlatform] = useState('All');
  
  // Create post modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    platform: 'All',
    mode: 'both',
    spotsAvailable: 1,
    playerRole: '',
    discordTag: ''
  });
  const [creating, setCreating] = useState(false);
  
  // User's squad status
  const [userSquad, setUserSquad] = useState(null);
  const [checkingSquad, setCheckingSquad] = useState(true);
  const [canManageSquad, setCanManageSquad] = useState(false);

  const isHardcore = selectedMode === 'hardcore';
  const accentColor = isHardcore ? 'red' : 'cyan';
  const gradientFrom = isHardcore ? 'from-red-500' : 'from-cyan-400';
  const gradientTo = isHardcore ? 'to-orange-600' : 'to-cyan-600';

  const texts = {
    fr: {
      title: 'Squad Hub',
      subtitle: 'Trouvez une équipe ou recrutez des joueurs',
      recruitment: 'Recrutement',
      lookingForTeam: 'Recherche Team',
      allPosts: 'Toutes les annonces',
      filters: 'Filtres',
      type: 'Type',
      mode: 'Mode',
      platform: 'Plateforme',
      all: 'Tous',
      createPost: 'Créer une annonce',
      createRecruitment: 'Recruter pour mon escouade',
      createLFT: 'Chercher une team',
      noPosts: 'Aucune annonce pour le moment',
      noPostsDesc: 'Soyez le premier à publier une annonce !',
      postTitle: 'Titre',
      postDescription: 'Description',
      spotsAvailable: 'Places disponibles',
      yourRole: 'Votre rôle / spécialité',
      discordTag: 'Discord (optionnel)',
      publish: 'Publier',
      cancel: 'Annuler',
      titlePlaceholder: 'Ex: Recherche joueurs actifs',
      descPlaceholder: 'Décrivez ce que vous recherchez...',
      rolePlaceholder: 'Ex: AR main, Support, IGL...',
      discordPlaceholder: 'Ex: username#0000',
      needSquad: 'Vous devez être dans une escouade pour recruter',
      needNoSquad: 'Vous devez quitter votre escouade pour chercher une team',
      needLeaderOfficer: 'Seuls le leader et les officiers peuvent publier des annonces',
      loginToPost: 'Connectez-vous pour publier une annonce',
      viewSquad: 'Voir l\'escouade',
      viewProfile: 'Voir le profil',
      contact: 'Contacter',
      spots: 'place(s)',
      members: 'membres',
      postedBy: 'Posté par',
      expiresIn: 'Expire dans',
      days: 'jours',
      alreadyHavePost: 'Vous avez déjà une annonce active',
      postSuccess: 'Annonce publiée avec succès !',
      hardcore: 'Hardcore',
      cdl: 'CDL',
      both: 'Les deux',
      pc: 'PC',
      playstation: 'PlayStation',
      xbox: 'Xbox',
      refresh: 'Actualiser',
      mySquad: 'Mon escouade',
      deletePost: 'Supprimer',
      deleteConfirmTitle: 'Supprimer l\'annonce',
      deleteConfirmText: 'Êtes-vous sûr de vouloir supprimer cette annonce ?',
      deleteSuccess: 'Annonce supprimée avec succès',
      previous: 'Précédent',
      next: 'Suivant',
      page: 'Page',
      of: 'sur',
      showing: 'Affichage de',
      to: 'à',
      results: 'résultats',
    },
    en: {
      title: 'Squad Hub',
      subtitle: 'Find a team or recruit players',
      recruitment: 'Recruitment',
      lookingForTeam: 'Looking for Team',
      allPosts: 'All posts',
      filters: 'Filters',
      type: 'Type',
      mode: 'Mode',
      platform: 'Platform',
      all: 'All',
      createPost: 'Create a post',
      createRecruitment: 'Recruit for my squad',
      createLFT: 'Find a team',
      noPosts: 'No posts yet',
      noPostsDesc: 'Be the first to post!',
      postTitle: 'Title',
      postDescription: 'Description',
      spotsAvailable: 'Spots available',
      yourRole: 'Your role / specialty',
      discordTag: 'Discord (optional)',
      publish: 'Publish',
      cancel: 'Cancel',
      titlePlaceholder: 'Ex: Looking for active players',
      descPlaceholder: 'Describe what you\'re looking for...',
      rolePlaceholder: 'Ex: AR main, Support, IGL...',
      discordPlaceholder: 'Ex: username#0000',
      needSquad: 'You need to be in a squad to recruit',
      needNoSquad: 'You need to leave your squad to look for a team',
      needLeaderOfficer: 'Only leader and officers can post recruitment ads',
      loginToPost: 'Login to create a post',
      viewSquad: 'View squad',
      viewProfile: 'View profile',
      contact: 'Contact',
      spots: 'spot(s)',
      members: 'members',
      postedBy: 'Posted by',
      expiresIn: 'Expires in',
      days: 'days',
      alreadyHavePost: 'You already have an active post',
      postSuccess: 'Post published successfully!',
      hardcore: 'Hardcore',
      cdl: 'CDL',
      both: 'Both',
      pc: 'PC',
      playstation: 'PlayStation',
      xbox: 'Xbox',
      refresh: 'Refresh',
      mySquad: 'My squad',
      deletePost: 'Delete',
      deleteConfirmTitle: 'Delete post',
      deleteConfirmText: 'Are you sure you want to delete this post?',
      deleteSuccess: 'Post deleted successfully',
      previous: 'Previous',
      next: 'Next',
      page: 'Page',
      of: 'of',
      showing: 'Showing',
      to: 'to',
      results: 'results',
    },
    de: {
      title: 'Squad Hub',
      subtitle: 'Finde ein Team oder rekrutiere Spieler',
      recruitment: 'Rekrutierung',
      lookingForTeam: 'Suche Team',
      allPosts: 'Alle Anzeigen',
      filters: 'Filter',
      type: 'Typ',
      mode: 'Modus',
      platform: 'Plattform',
      all: 'Alle',
      createPost: 'Anzeige erstellen',
      createRecruitment: 'Für mein Squad rekrutieren',
      createLFT: 'Team finden',
      noPosts: 'Noch keine Anzeigen',
      noPostsDesc: 'Sei der Erste, der eine Anzeige erstellt!',
      postTitle: 'Titel',
      postDescription: 'Beschreibung',
      spotsAvailable: 'Verfügbare Plätze',
      yourRole: 'Deine Rolle / Spezialität',
      discordTag: 'Discord (optional)',
      publish: 'Veröffentlichen',
      cancel: 'Abbrechen',
      titlePlaceholder: 'Z.B.: Suche aktive Spieler',
      descPlaceholder: 'Beschreibe was du suchst...',
      rolePlaceholder: 'Z.B.: AR main, Support, IGL...',
      discordPlaceholder: 'Z.B.: username#0000',
      needSquad: 'Du musst in einem Squad sein um zu rekrutieren',
      needNoSquad: 'Du musst dein Squad verlassen um ein Team zu suchen',
      needLeaderOfficer: 'Nur Leader und Offiziere können Anzeigen erstellen',
      loginToPost: 'Melde dich an um eine Anzeige zu erstellen',
      viewSquad: 'Squad ansehen',
      viewProfile: 'Profil ansehen',
      contact: 'Kontaktieren',
      spots: 'Platz/Plätze',
      members: 'Mitglieder',
      postedBy: 'Gepostet von',
      expiresIn: 'Läuft ab in',
      days: 'Tagen',
      alreadyHavePost: 'Du hast bereits eine aktive Anzeige',
      postSuccess: 'Anzeige erfolgreich veröffentlicht!',
      hardcore: 'Hardcore',
      cdl: 'CDL',
      both: 'Beide',
      pc: 'PC',
      playstation: 'PlayStation',
      xbox: 'Xbox',
      refresh: 'Aktualisieren',
      mySquad: 'Mein Squad',
      deletePost: 'Löschen',
      deleteConfirmTitle: 'Anzeige löschen',
      deleteConfirmText: 'Möchtest du diese Anzeige wirklich löschen?',
      deleteSuccess: 'Anzeige erfolgreich gelöscht',
      previous: 'Zurück',
      next: 'Weiter',
      page: 'Seite',
      of: 'von',
      showing: 'Zeige',
      to: 'bis',
      results: 'Ergebnisse',
    },
    it: {
      title: 'Squad Hub',
      subtitle: 'Trova una squadra o recluta giocatori',
      recruitment: 'Reclutamento',
      lookingForTeam: 'Cerco Team',
      allPosts: 'Tutti gli annunci',
      filters: 'Filtri',
      type: 'Tipo',
      mode: 'Modalità',
      platform: 'Piattaforma',
      all: 'Tutti',
      createPost: 'Crea annuncio',
      createRecruitment: 'Recluta per la mia squadra',
      createLFT: 'Trova una squadra',
      noPosts: 'Nessun annuncio',
      noPostsDesc: 'Sii il primo a pubblicare un annuncio!',
      postTitle: 'Titolo',
      postDescription: 'Descrizione',
      spotsAvailable: 'Posti disponibili',
      yourRole: 'Il tuo ruolo / specialità',
      discordTag: 'Discord (opzionale)',
      publish: 'Pubblica',
      cancel: 'Annulla',
      titlePlaceholder: 'Es: Cerco giocatori attivi',
      descPlaceholder: 'Descrivi cosa stai cercando...',
      rolePlaceholder: 'Es: AR main, Support, IGL...',
      discordPlaceholder: 'Es: username#0000',
      needSquad: 'Devi essere in una squadra per reclutare',
      needNoSquad: 'Devi lasciare la tua squadra per cercare un team',
      needLeaderOfficer: 'Solo il leader e gli ufficiali possono pubblicare annunci',
      loginToPost: 'Accedi per creare un annuncio',
      viewSquad: 'Vedi squadra',
      viewProfile: 'Vedi profilo',
      contact: 'Contatta',
      spots: 'posto/i',
      members: 'membri',
      postedBy: 'Pubblicato da',
      expiresIn: 'Scade tra',
      days: 'giorni',
      alreadyHavePost: 'Hai già un annuncio attivo',
      postSuccess: 'Annuncio pubblicato con successo!',
      hardcore: 'Hardcore',
      cdl: 'CDL',
      both: 'Entrambi',
      pc: 'PC',
      playstation: 'PlayStation',
      xbox: 'Xbox',
      refresh: 'Aggiorna',
      mySquad: 'La mia squadra',
      deletePost: 'Elimina',
      deleteConfirmTitle: 'Elimina annuncio',
      deleteConfirmText: 'Sei sicuro di voler eliminare questo annuncio?',
      deleteSuccess: 'Annuncio eliminato con successo',
      previous: 'Precedente',
      next: 'Successivo',
      page: 'Pagina',
      of: 'di',
      showing: 'Mostrando',
      to: 'a',
      results: 'risultati',
    },
  };

  const t = texts[language] || texts.en;

  // Check user's squad status
  useEffect(() => {
    if (isAuthenticated) {
      checkUserSquad();
    } else {
      setCheckingSquad(false);
    }
  }, [isAuthenticated]);

  // Fetch posts
  useEffect(() => {
    fetchPosts();
  }, [filterType, filterMode, filterPlatform, currentPage]);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, filterMode, filterPlatform]);

  const checkUserSquad = async () => {
    setCheckingSquad(true);
    try {
      const response = await fetch(`${API_URL}/squads/my-squad`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setUserSquad(data.squad);
        if (data.squad) {
          const isLeaderOrOfficer = data.squad.members?.some(m => 
            (m.user?._id === user?.id || m.user === user?.id) && 
            (m.role === 'leader' || m.role === 'officer')
          );
          setCanManageSquad(isLeaderOrOfficer);
        }
      }
    } catch (err) {
      console.error('Error checking squad:', err);
    } finally {
      setCheckingSquad(false);
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== 'all') params.append('type', filterType);
      if (filterMode !== 'all') params.append('mode', filterMode);
      if (filterPlatform !== 'All') params.append('platform', filterPlatform);
      params.append('page', currentPage);
      params.append('limit', POSTS_PER_PAGE);

      const response = await fetch(`${API_URL}/hub/posts?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setPosts(data.posts);
        setTotalPages(data.pagination?.pages || 1);
        setTotalPosts(data.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError('Erreur lors du chargement des annonces');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      const endpoint = createType === 'recruitment' 
        ? `${API_URL}/hub/recruitment` 
        : `${API_URL}/hub/looking-for-team`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (data.success) {
        setShowCreateModal(false);
        setFormData({
          title: '',
          description: '',
          platform: 'All',
          mode: 'both',
          spotsAvailable: 1,
          playerRole: '',
          discordTag: ''
        });
        setSuccessMessage(t.postSuccess);
        setTimeout(() => setSuccessMessage(''), 3000);
        fetchPosts();
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur lors de la création de l\'annonce');
    } finally {
      setCreating(false);
    }
  };

  const openCreateModal = (type) => {
    setCreateType(type);
    setShowCreateModal(true);
    setError('');
  };

  const handleDeletePost = async (postId) => {
    setDeleting(true);
    try {
      const response = await fetch(`${API_URL}/hub/${postId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setSuccessMessage(t.deleteSuccess);
        setTimeout(() => setSuccessMessage(''), 3000);
        setDeleteConfirm(null);
        fetchPosts();
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  const getDaysUntilExpiration = (expiresAt) => {
    const diff = new Date(expiresAt) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const getPlatformIcon = (platform) => {
    switch (platform) {
      case 'PC': return <Monitor className="w-4 h-4" />;
      case 'PlayStation': 
      case 'Xbox': return <Gamepad2 className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 relative">
      {/* Background */}
      {isHardcore ? (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(239, 68, 68, 0.08) 0%, transparent 50%)' }}></div>
      ) : (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(6, 182, 212, 0.08) 0%, transparent 50%)' }}></div>
      )}

      <div className="relative z-10 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-${accentColor}-500/10 border border-${accentColor}-500/20 mb-4`}>
              <Users className={`w-5 h-5 text-${accentColor}-400`} />
              <span className={`text-${accentColor}-400 font-medium`}>{t.title}</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">{t.title}</h1>
            <p className="text-gray-400">{t.subtitle}</p>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3">
              <Check className="w-5 h-5 text-green-400" />
              <p className="text-green-400">{successMessage}</p>
            </div>
          )}

          {/* Create Post Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {/* Recruitment Button */}
            <button
              onClick={() => openCreateModal('recruitment')}
              disabled={!isAuthenticated || checkingSquad || !userSquad || !canManageSquad}
              className={`p-6 rounded-2xl border transition-all text-left group ${
                !isAuthenticated || !userSquad || !canManageSquad
                  ? 'bg-dark-900/50 border-white/5 opacity-50 cursor-not-allowed'
                  : `bg-dark-900/80 border-${accentColor}-500/20 hover:border-${accentColor}-500/40 hover:bg-dark-800/80`
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center`}>
                  <Megaphone className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-1">{t.createRecruitment}</h3>
                  <p className="text-sm text-gray-400">
                    {!isAuthenticated ? t.loginToPost : 
                     !userSquad ? t.needSquad : 
                     !canManageSquad ? t.needLeaderOfficer : 
                     t.recruitment}
                  </p>
                </div>
                {isAuthenticated && userSquad && canManageSquad && (
                  <Plus className={`w-6 h-6 text-${accentColor}-400 opacity-0 group-hover:opacity-100 transition-opacity`} />
                )}
              </div>
            </button>

            {/* LFT Button */}
            <button
              onClick={() => openCreateModal('lft')}
              disabled={!isAuthenticated || checkingSquad || userSquad}
              className={`p-6 rounded-2xl border transition-all text-left group ${
                !isAuthenticated || userSquad
                  ? 'bg-dark-900/50 border-white/5 opacity-50 cursor-not-allowed'
                  : `bg-dark-900/80 border-${accentColor}-500/20 hover:border-${accentColor}-500/40 hover:bg-dark-800/80`
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center`}>
                  <UserPlus className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-1">{t.createLFT}</h3>
                  <p className="text-sm text-gray-400">
                    {!isAuthenticated ? t.loginToPost : 
                     userSquad ? t.needNoSquad : 
                     t.lookingForTeam}
                  </p>
                </div>
                {isAuthenticated && !userSquad && (
                  <Plus className="w-6 h-6 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </button>
          </div>

          {/* Filters */}
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-${accentColor}-500/20 p-4 mb-6`}>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-gray-400">
                <Filter className="w-4 h-4" />
                <span className="text-sm font-medium">{t.filters}</span>
              </div>
              
              {/* Type Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{t.type}:</span>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-dark-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="all">{t.all}</option>
                  <option value="recruitment">{t.recruitment}</option>
                  <option value="looking_for_team">{t.lookingForTeam}</option>
                </select>
              </div>

              {/* Mode Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{t.mode}:</span>
                <select
                  value={filterMode}
                  onChange={(e) => setFilterMode(e.target.value)}
                  className="bg-dark-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="all">{t.all}</option>
                  <option value="hardcore">{t.hardcore}</option>
                  <option value="cdl">{t.cdl}</option>
                </select>
              </div>

              {/* Platform Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{t.platform}:</span>
                <select
                  value={filterPlatform}
                  onChange={(e) => setFilterPlatform(e.target.value)}
                  className="bg-dark-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="All">{t.all}</option>
                  <option value="PC">{t.pc}</option>
                  <option value="PlayStation">{t.playstation}</option>
                  <option value="Xbox">{t.xbox}</option>
                </select>
              </div>

              <button
                onClick={fetchPosts}
                className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-${accentColor}-500/20 text-${accentColor}-400 hover:bg-${accentColor}-500/30 transition-colors text-sm`}
              >
                <RefreshCw className="w-4 h-4" />
                {t.refresh}
              </button>
            </div>
          </div>

          {/* Posts List */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className={`w-10 h-10 text-${accentColor}-400 animate-spin`} />
            </div>
          ) : posts.length === 0 ? (
            <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-${accentColor}-500/20 p-12 text-center`}>
              <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">{t.noPosts}</h3>
              <p className="text-gray-400">{t.noPostsDesc}</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {posts.map((post) => (
                <div
                  key={post._id}
                  className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-${accentColor}-500/20 overflow-hidden hover:border-${accentColor}-500/40 transition-all`}
                >
                  <div className="p-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Left: Type indicator & Avatar */}
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          post.type === 'recruitment' 
                            ? `bg-gradient-to-br ${gradientFrom} ${gradientTo}` 
                            : 'bg-gradient-to-br from-purple-500 to-pink-600'
                        }`}>
                          {post.type === 'recruitment' ? (
                            <Megaphone className="w-6 h-6 text-white" />
                          ) : (
                            <UserPlus className="w-6 h-6 text-white" />
                          )}
                        </div>
                        
                        {/* Squad or Player Avatar */}
                        {post.type === 'recruitment' && post.squad ? (
                          <div 
                            className="w-12 h-12 rounded-xl flex items-center justify-center border-2 overflow-hidden"
                            style={{ backgroundColor: post.squad.color + '30', borderColor: post.squad.color }}
                          >
                            {post.squad.logo ? (
                              <img src={post.squad.logo} alt={post.squad.name} className="w-full h-full object-cover" />
                            ) : (
                              <Users className="w-6 h-6" style={{ color: post.squad.color }} />
                            )}
                          </div>
                        ) : (
                          <img
                            src={post.author?.avatarUrl || getDefaultAvatar(post.author?.username)}
                            alt=""
                            className="w-12 h-12 rounded-xl border-2 border-white/10"
                            onError={(e) => { e.target.src = getDefaultAvatar(post.author?.username); }}
                          />
                        )}
                      </div>

                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <h3 className="text-lg font-bold text-white mb-1">{post.title}</h3>
                            {post.type === 'recruitment' && post.squad && (
                              <Link 
                                to={`/squad/${post.squad._id}`}
                                className={`text-sm text-${accentColor}-400 hover:underline flex items-center gap-1`}
                              >
                                <Shield className="w-3 h-3" />
                                {post.squad.name} [{post.squad.tag}]
                              </Link>
                            )}
                          </div>
                          
                          {/* Badges */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                              post.type === 'recruitment' 
                                ? `bg-${accentColor}-500/20 text-${accentColor}-400` 
                                : 'bg-purple-500/20 text-purple-400'
                            }`}>
                              {post.type === 'recruitment' ? t.recruitment : t.lookingForTeam}
                            </span>
                            <span className="px-2 py-1 rounded-lg text-xs font-medium bg-white/10 text-gray-300 capitalize">
                              {post.mode === 'both' ? t.both : post.mode}
                            </span>
                            {post.platform !== 'All' && (
                              <span className="px-2 py-1 rounded-lg text-xs font-medium bg-white/10 text-gray-300 flex items-center gap-1">
                                {getPlatformIcon(post.platform)}
                                {post.platform}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-gray-400 text-sm mb-4 line-clamp-2">{post.description}</p>

                        {/* Footer Info */}
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          {post.type === 'recruitment' && (
                            <span className="text-gray-500 flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {post.spotsAvailable} {t.spots}
                            </span>
                          )}
                          {post.playerRole && (
                            <span className="text-gray-500 flex items-center gap-1">
                              <Crown className="w-4 h-4" />
                              {post.playerRole}
                            </span>
                          )}
                          {post.discordTag && (
                            <span className="text-gray-500 flex items-center gap-1">
                              <MessageSquare className="w-4 h-4" />
                              {post.discordTag}
                            </span>
                          )}
                          <span className="text-gray-500 flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {getDaysUntilExpiration(post.expiresAt)} {t.days}
                          </span>
                          
                          {/* Author */}
                          <Link 
                            to={`/player/${encodeURIComponent(post.author?.username)}`}
                            className="text-gray-500 hover:text-white transition-colors flex items-center gap-1 ml-auto"
                          >
                            <img
                              src={post.author?.avatarUrl || getDefaultAvatar(post.author?.username)}
                              alt=""
                              className="w-5 h-5 rounded-full"
                              onError={(e) => { e.target.src = getDefaultAvatar(post.author?.username); }}
                            />
                            {post.author?.username}
                          </Link>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex sm:flex-col gap-2 sm:justify-start">
                        {post.type === 'recruitment' && post.squad && (
                          <Link
                            to={`/squad/${post.squad._id}`}
                            className={`px-4 py-2 rounded-xl bg-${accentColor}-500/20 text-${accentColor}-400 hover:bg-${accentColor}-500/30 transition-colors text-sm font-medium flex items-center gap-2`}
                          >
                            {t.viewSquad}
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        )}
                        {post.type === 'looking_for_team' && (
                          <Link
                            to={`/player/${encodeURIComponent(post.author?.username)}`}
                            className="px-4 py-2 rounded-xl bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors text-sm font-medium flex items-center gap-2"
                          >
                            {t.viewProfile}
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        )}
                        {/* Delete button for post owner */}
                        {isAuthenticated && user?.id === post.author?._id && (
                          <button
                            onClick={() => setDeleteConfirm(post._id)}
                            className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm font-medium flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            {t.deletePost}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className={`mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-${accentColor}-500/20`}>
                  <div className="text-sm text-gray-400">
                    {t.showing} {((currentPage - 1) * POSTS_PER_PAGE) + 1} {t.to} {Math.min(currentPage * POSTS_PER_PAGE, totalPosts)} {t.of} {totalPosts} {t.results}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className={`px-4 py-2 rounded-xl bg-dark-800 border border-white/10 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-dark-700 transition-colors flex items-center gap-2`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      {t.previous}
                    </button>
                    <span className="px-4 py-2 text-gray-400 text-sm">
                      {t.page} {currentPage} {t.of} {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className={`px-4 py-2 rounded-xl bg-dark-800 border border-white/10 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-dark-700 transition-colors flex items-center gap-2`}
                    >
                      {t.next}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Post Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`bg-dark-900 rounded-2xl border border-${accentColor}-500/20 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {createType === 'recruitment' ? (
                  <>
                    <Megaphone className={`w-6 h-6 text-${accentColor}-400`} />
                    {t.createRecruitment}
                  </>
                ) : (
                  <>
                    <UserPlus className="w-6 h-6 text-purple-400" />
                    {t.createLFT}
                  </>
                )}
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleCreatePost} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t.postTitle} *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t.titlePlaceholder}
                  required
                  minLength={5}
                  maxLength={100}
                  className={`w-full px-4 py-3 bg-dark-800/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-${accentColor}-500/50 transition-all`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t.postDescription} *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t.descPlaceholder}
                  required
                  minLength={10}
                  maxLength={500}
                  rows={4}
                  className={`w-full px-4 py-3 bg-dark-800/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-${accentColor}-500/50 transition-all resize-none`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">{t.mode}</label>
                  <select
                    value={formData.mode}
                    onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                    className={`w-full px-4 py-3 bg-dark-800/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-${accentColor}-500/50 transition-all`}
                  >
                    <option value="both">{t.both}</option>
                    <option value="hardcore">{t.hardcore}</option>
                    <option value="cdl">{t.cdl}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">{t.platform}</label>
                  <select
                    value={formData.platform}
                    onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                    className={`w-full px-4 py-3 bg-dark-800/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-${accentColor}-500/50 transition-all`}
                  >
                    <option value="All">{t.all}</option>
                    <option value="PC">{t.pc}</option>
                    <option value="PlayStation">{t.playstation}</option>
                    <option value="Xbox">{t.xbox}</option>
                  </select>
                </div>
              </div>

              {createType === 'recruitment' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">{t.spotsAvailable}</label>
                  <input
                    type="number"
                    value={formData.spotsAvailable}
                    onChange={(e) => setFormData({ ...formData, spotsAvailable: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) })}
                    min={1}
                    max={10}
                    className={`w-full px-4 py-3 bg-dark-800/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-${accentColor}-500/50 transition-all`}
                  />
                </div>
              )}

              {createType === 'lft' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">{t.yourRole}</label>
                  <input
                    type="text"
                    value={formData.playerRole}
                    onChange={(e) => setFormData({ ...formData, playerRole: e.target.value })}
                    placeholder={t.rolePlaceholder}
                    maxLength={50}
                    className={`w-full px-4 py-3 bg-dark-800/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-${accentColor}-500/50 transition-all`}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t.discordTag}</label>
                <input
                  type="text"
                  value={formData.discordTag}
                  onChange={(e) => setFormData({ ...formData, discordTag: e.target.value })}
                  placeholder={t.discordPlaceholder}
                  maxLength={50}
                  className={`w-full px-4 py-3 bg-dark-800/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-${accentColor}-500/50 transition-all`}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 px-4 bg-dark-800 hover:bg-dark-700 border border-white/10 text-white font-medium rounded-xl transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className={`flex-1 py-3 px-4 bg-gradient-to-r ${
                    createType === 'recruitment' 
                      ? `${gradientFrom} ${gradientTo}` 
                      : 'from-purple-500 to-pink-600'
                  } hover:opacity-90 disabled:opacity-50 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2`}
                >
                  {creating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      {t.publish}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`bg-dark-900 rounded-2xl border border-red-500/20 p-6 max-w-md w-full`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-white">{t.deleteConfirmTitle}</h3>
            </div>
            <p className="text-gray-400 mb-6">{t.deleteConfirmText}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 px-4 bg-dark-800 hover:bg-dark-700 border border-white/10 text-white font-medium rounded-xl transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => handleDeletePost(deleteConfirm)}
                disabled={deleting}
                className="flex-1 py-3 px-4 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-5 h-5" />
                    {t.deletePost}
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

export default SquadHub;
















