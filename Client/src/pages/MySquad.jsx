import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { getDefaultAvatar, getAvatarUrl } from '../utils/avatar';
import { 
  Users, Crown, Shield, UserMinus, Settings, Plus, Search, 
  Loader2, AlertCircle, Trophy, Medal, ChevronRight,
  Target, Swords, Calendar, Sparkles, Globe, Copy, Check, ArrowRight,
  Zap, Award, X, MessageSquare, Clock, ExternalLink, Crosshair
} from 'lucide-react';

import { API_URL, UPLOADS_BASE_URL } from '../config';

const MySquad = () => {
  const { user, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const navigate = useNavigate();

  const isHardcore = selectedMode === 'hardcore';
  const accentColor = isHardcore ? 'red' : 'cyan';
  const gradientFrom = isHardcore ? 'from-red-500' : 'from-cyan-400';
  const gradientTo = isHardcore ? 'to-orange-600' : 'to-cyan-600';
  const borderColor = isHardcore ? 'border-red-500/30' : 'border-cyan-500/30';
  const glowColor = isHardcore ? 'shadow-red-500/20' : 'shadow-cyan-500/20';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [squad, setSquad] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  
  // Create squad states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [squadName, setSquadName] = useState('');
  const [squadTag, setSquadTag] = useState('');
  const [squadDescription, setSquadDescription] = useState('');
  const [creatingSquad, setCreatingSquad] = useState(false);
  const [createError, setCreateError] = useState('');
  
  // Edit squad states
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTag, setEditTag] = useState('');
  const [updatingSquad, setUpdatingSquad] = useState(false);
  const [editError, setEditError] = useState('');
  
  // Copied state
  const [copied, setCopied] = useState(false);

  // Traductions
  const texts = {
    fr: {
      title: 'Mon Escouade',
      subtitle: 'Gérez votre équipe et dominez le classement',
      noSquad: 'Vous n\'avez pas encore d\'escouade',
      noSquadDesc: 'Créez votre propre escouade ou rejoignez-en une existante pour commencer à jouer en équipe.',
      createSquad: 'Créer mon escouade',
      browseSquads: 'Parcourir les escouades',
      members: 'Membres',
      points: 'Points',
      wins: 'Victoires',
      losses: 'Défaites',
      winRate: 'Win Rate',
      leader: 'Leader',
      officer: 'Officier',
      member: 'Membre',
      manage: 'Gérer',
      viewProfile: 'Voir le profil public',
      leave: 'Quitter l\'escouade',
      leaveConfirm: 'Êtes-vous sûr de vouloir quitter cette escouade ?',
      leaveWarning: 'Cette action est irréversible. Vous perdrez tous vos avantages d\'équipe.',
      leaveButton: 'Quitter',
      cancel: 'Annuler',
      leaving: 'Départ en cours...',
      leftSuccess: 'Vous avez quitté l\'escouade',
      cannotLeaveAsLeader: 'Le leader doit transférer le leadership avant de quitter',
      loading: 'Chargement...',
      error: 'Erreur de chargement',
      ladders: 'Ladders inscrites',
      noLadders: 'Aucune ladder inscrite',
      joinedAt: 'Membre depuis',
      createdAt: 'Créée le',
      createTitle: 'Créer une nouvelle escouade',
      squadNameLabel: 'Nom de l\'escouade',
      squadNamePlaceholder: 'Ex: Les Invincibles',
      tagLabel: 'Tag (2-5 caractères)',
      tagPlaceholder: 'Ex: INV',
      descLabel: 'Description (optionnel)',
      descPlaceholder: 'Décrivez votre escouade en quelques mots...',
      create: 'Créer l\'escouade',
      creating: 'Création en cours...',
      back: 'Retour',
      copyTag: 'Copier le tag',
      copied: 'Copié !',
      pendingRequests: 'Demandes en attente',
      viewAll: 'Voir tout',
      quickActions: 'Actions rapides',
      invitePlayers: 'Inviter des joueurs',
      squadSettings: 'Paramètres de l\'escouade',
      viewRankings: 'Voir le classement',
      recentActivity: 'Activité récente',
      noActivity: 'Aucune activité récente',
      position: 'Position',
      nameTooShort: 'Le nom doit faire au moins 3 caractères',
      tagInvalid: 'Le tag doit faire entre 2 et 5 caractères',
      editSquadInfo: 'Modifier les informations',
      editSquadTitle: 'Modifier le nom et le tag',
      newName: 'Nouveau nom',
      newTag: 'Nouveau tag',
      save: 'Enregistrer',
      saving: 'Enregistrement...',
      editSuccess: 'Informations mises à jour avec succès',
      cranes: 'Munitions',
    },
    en: {
      title: 'My Squad',
      subtitle: 'Manage your team and dominate the rankings',
      noSquad: 'You don\'t have a squad yet',
      noSquadDesc: 'Create your own squad or join an existing one to start playing as a team.',
      createSquad: 'Create my squad',
      browseSquads: 'Browse squads',
      members: 'Members',
      points: 'Points',
      wins: 'Wins',
      losses: 'Losses',
      winRate: 'Win Rate',
      leader: 'Leader',
      officer: 'Officer',
      member: 'Member',
      manage: 'Manage',
      viewProfile: 'View public profile',
      leave: 'Leave squad',
      leaveConfirm: 'Are you sure you want to leave this squad?',
      leaveWarning: 'This action cannot be undone. You will lose all team benefits.',
      leaveButton: 'Leave',
      cancel: 'Cancel',
      leaving: 'Leaving...',
      leftSuccess: 'You have left the squad',
      cannotLeaveAsLeader: 'Leader must transfer leadership before leaving',
      loading: 'Loading...',
      error: 'Loading error',
      ladders: 'Registered ladders',
      noLadders: 'No ladder registered',
      joinedAt: 'Member since',
      createdAt: 'Created',
      createTitle: 'Create a new squad',
      squadNameLabel: 'Squad name',
      squadNamePlaceholder: 'Ex: The Invincibles',
      tagLabel: 'Tag (2-5 characters)',
      tagPlaceholder: 'Ex: INV',
      descLabel: 'Description (optional)',
      descPlaceholder: 'Describe your squad in a few words...',
      create: 'Create squad',
      creating: 'Creating...',
      back: 'Back',
      copyTag: 'Copy tag',
      copied: 'Copied!',
      pendingRequests: 'Pending requests',
      viewAll: 'View all',
      quickActions: 'Quick actions',
      invitePlayers: 'Invite players',
      squadSettings: 'Squad settings',
      viewRankings: 'View rankings',
      recentActivity: 'Recent activity',
      noActivity: 'No recent activity',
      position: 'Position',
      nameTooShort: 'Name must be at least 3 characters',
      tagInvalid: 'Tag must be 2-5 characters',
      editSquadInfo: 'Edit information',
      editSquadTitle: 'Edit name and tag',
      newName: 'New name',
      newTag: 'New tag',
      save: 'Save',
      saving: 'Saving...',
      editSuccess: 'Information updated successfully',
      cranes: 'Ammo',
    },
    de: {
      title: 'Mein Squad',
      subtitle: 'Verwalte dein Team und dominiere die Rangliste',
      noSquad: 'Du hast noch kein Squad',
      noSquadDesc: 'Erstelle dein eigenes Squad oder tritt einem bestehenden bei, um als Team zu spielen.',
      createSquad: 'Mein Squad erstellen',
      browseSquads: 'Squads durchsuchen',
      members: 'Mitglieder',
      points: 'Punkte',
      wins: 'Siege',
      losses: 'Niederlagen',
      winRate: 'Siegquote',
      leader: 'Leader',
      officer: 'Offizier',
      member: 'Mitglied',
      manage: 'Verwalten',
      viewProfile: 'Öffentliches Profil',
      leave: 'Squad verlassen',
      leaveConfirm: 'Bist du sicher, dass du dieses Squad verlassen willst?',
      leaveWarning: 'Diese Aktion kann nicht rückgängig gemacht werden.',
      leaveButton: 'Verlassen',
      cancel: 'Abbrechen',
      leaving: 'Verlasse...',
      leftSuccess: 'Du hast das Squad verlassen',
      cannotLeaveAsLeader: 'Der Leader muss die Führung übertragen bevor er geht',
      loading: 'Laden...',
      error: 'Ladefehler',
      ladders: 'Registrierte Ladders',
      noLadders: 'Keine Ladder registriert',
      joinedAt: 'Mitglied seit',
      createdAt: 'Erstellt am',
      createTitle: 'Neues Squad erstellen',
      squadNameLabel: 'Squad-Name',
      squadNamePlaceholder: 'Z.B.: Die Unbesiegbaren',
      tagLabel: 'Tag (2-5 Zeichen)',
      tagPlaceholder: 'Z.B.: INV',
      descLabel: 'Beschreibung (optional)',
      descPlaceholder: 'Beschreibe dein Squad...',
      create: 'Squad erstellen',
      creating: 'Erstelle...',
      back: 'Zurück',
      copyTag: 'Tag kopieren',
      copied: 'Kopiert!',
      pendingRequests: 'Ausstehende Anfragen',
      viewAll: 'Alle ansehen',
      quickActions: 'Schnellaktionen',
      invitePlayers: 'Spieler einladen',
      squadSettings: 'Squad-Einstellungen',
      viewRankings: 'Rangliste ansehen',
      recentActivity: 'Letzte Aktivität',
      noActivity: 'Keine Aktivität',
      position: 'Position',
      nameTooShort: 'Name muss mindestens 3 Zeichen haben',
      tagInvalid: 'Tag muss 2-5 Zeichen haben',
      editSquadInfo: 'Informationen bearbeiten',
      editSquadTitle: 'Name und Tag bearbeiten',
      newName: 'Neuer Name',
      newTag: 'Neuer Tag',
      save: 'Speichern',
      saving: 'Speichern...',
      editSuccess: 'Informationen erfolgreich aktualisiert',
      cranes: 'Munition',
    },
    it: {
      title: 'La mia Squad',
      subtitle: 'Gestisci la tua squadra e domina la classifica',
      noSquad: 'Non hai ancora una squad',
      noSquadDesc: 'Crea la tua squad o unisciti a una esistente per giocare in squadra.',
      createSquad: 'Crea la mia squad',
      browseSquads: 'Cerca squad',
      members: 'Membri',
      points: 'Punti',
      wins: 'Vittorie',
      losses: 'Sconfitte',
      winRate: 'Win Rate',
      leader: 'Leader',
      officer: 'Ufficiale',
      member: 'Membro',
      manage: 'Gestisci',
      viewProfile: 'Profilo pubblico',
      leave: 'Lascia squad',
      leaveConfirm: 'Sei sicuro di voler lasciare questa squad?',
      leaveWarning: 'Questa azione non può essere annullata.',
      leaveButton: 'Lascia',
      cancel: 'Annulla',
      leaving: 'Uscendo...',
      leftSuccess: 'Hai lasciato la squad',
      cannotLeaveAsLeader: 'Il leader deve trasferire la leadership prima di uscire',
      loading: 'Caricamento...',
      error: 'Errore di caricamento',
      ladders: 'Ladder registrate',
      noLadders: 'Nessuna ladder registrata',
      joinedAt: 'Membro dal',
      createdAt: 'Creata il',
      createTitle: 'Crea una nuova squad',
      squadNameLabel: 'Nome squad',
      squadNamePlaceholder: 'Es: Gli Invincibili',
      tagLabel: 'Tag (2-5 caratteri)',
      tagPlaceholder: 'Es: INV',
      descLabel: 'Descrizione (opzionale)',
      descPlaceholder: 'Descrivi la tua squad...',
      create: 'Crea squad',
      creating: 'Creazione...',
      back: 'Indietro',
      copyTag: 'Copia tag',
      copied: 'Copiato!',
      pendingRequests: 'Richieste in sospeso',
      viewAll: 'Vedi tutto',
      quickActions: 'Azioni rapide',
      invitePlayers: 'Invita giocatori',
      squadSettings: 'Impostazioni squad',
      viewRankings: 'Vedi classifica',
      recentActivity: 'Attività recente',
      noActivity: 'Nessuna attività',
      position: 'Posizione',
      nameTooShort: 'Il nome deve avere almeno 3 caratteri',
      tagInvalid: 'Il tag deve avere 2-5 caratteri',
      editSquadInfo: 'Modifica informazioni',
      editSquadTitle: 'Modifica nome e tag',
      newName: 'Nuovo nome',
      newTag: 'Nuovo tag',
      save: 'Salva',
      saving: 'Salvataggio...',
      editSuccess: 'Informazioni aggiornate con successo',
      cranes: 'Munizioni',
    },
  };

  const t = texts[language] || texts.en;

  // Set page title
  useEffect(() => {
    const titles = {
      fr: 'NoMercy - Mon Escouade',
      en: 'NoMercy - My Squad',
      it: 'NoMercy - La mia Squad',
      de: 'NoMercy - Mein Squad',
    };
    document.title = titles[language] || titles.en;
  }, [language]);

  // Fetch squad data
  useEffect(() => {
    const fetchSquad = async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }
      
      // Wait for selectedMode to be defined before fetching
      if (!selectedMode) {
        return;
      }
      
      try {
        const response = await fetch(`${API_URL}/squads/my-squad?mode=${selectedMode}`, {
          credentials: 'include'
        });
        const data = await response.json();
        
        if (data.success && data.squad) {
          setSquad(data.squad);
        } else {
          setSquad(null);
        }
      } catch (err) {
        console.error('Error fetching squad:', err);
        setError(t.error);
      } finally {
        setLoading(false);
      }
    };

    fetchSquad();
  }, [isAuthenticated, selectedMode]);

  // Create squad
  const handleCreateSquad = async (e) => {
    e.preventDefault();
    setCreateError('');
    
    if (!squadName.trim() || squadName.length < 3) {
      setCreateError(t.nameTooShort);
      return;
    }
    if (!squadTag.trim() || squadTag.length < 2 || squadTag.length > 5) {
      setCreateError(t.tagInvalid);
      return;
    }
    
    setCreatingSquad(true);
    try {
      const response = await fetch(`${API_URL}/squads/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: squadName.trim(),
          tag: squadTag.trim(),
          description: squadDescription.trim(),
          mode: selectedMode,
          color: isHardcore ? '#ef4444' : '#06b6d4'
        })
      });
      const data = await response.json();
      if (data.success) {
        setSquad(data.squad);
        setShowCreateForm(false);
        setSquadName('');
        setSquadTag('');
        setSquadDescription('');
      } else {
        setCreateError(data.message || 'Error creating squad');
      }
    } catch (err) {
      console.error('Error creating squad:', err);
      setCreateError('Server error');
    } finally {
      setCreatingSquad(false);
    }
  };

  // Leave squad
  const handleLeaveSquad = async () => {
    if (!squad) return;
    
    // Check if user is leader
    const leaderId = squad.leader?._id || squad.leader;
    const isLeader = leaderId === user?._id || leaderId === user?.id;
    if (isLeader && squad.members?.length > 1) {
      setError(t.cannotLeaveAsLeader);
      setShowLeaveConfirm(false);
      return;
    }

    setLeaving(true);
    try {
      const response = await fetch(`${API_URL}/squads/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode: selectedMode })
      });
      const data = await response.json();
      
      if (data.success) {
        setSquad(null);
        setShowLeaveConfirm(false);
      } else {
        setError(data.message);
      }
    } catch (err) {
      console.error('Error leaving squad:', err);
      setError(t.error);
    } finally {
      setLeaving(false);
    }
  };

  // Get member role
  const getMemberRole = (member) => {
    const leaderId = squad.leader?._id || squad.leader;
    const memberId = member.user?._id || member.user;
    if (leaderId === memberId) {
      return 'leader';
    }
    return member.role || 'member';
  };

  // Get role icon
  const getRoleIcon = (role) => {
    switch (role) {
      case 'leader':
        return <Crown className="w-4 h-4 text-yellow-400" />;
      case 'officer':
        return <Shield className="w-4 h-4 text-blue-400" />;
      default:
        return <Users className="w-4 h-4 text-gray-400" />;
    }
  };

  // Get role color
  const getRoleColor = (role) => {
    switch (role) {
      case 'leader':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'officer':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  // Get avatar
  const getAvatar = (member) => {
    const u = member.user || member;
    return getAvatarUrl(u.avatarUrl || u.avatar) || (u.discordId ? `https://cdn.discordapp.com/avatars/${u.discordId}/${u.discordAvatar}.png` : getDefaultAvatar(u.username));
  };

  // Check if user is leader
  const isLeader = squad && (
    squad.leader?._id === user?._id || 
    squad.leader?._id === user?.id ||
    squad.leader === user?._id ||
    squad.leader === user?.id
  );

  // Check if user is leader or officer
  const isLeaderOrOfficer = isLeader || (squad && squad.members?.some(m => 
    ((m.user?._id === user?._id || m.user?._id === user?.id) || (m.user === user?._id || m.user === user?.id)) && m.role === 'officer'
  ));

  // Copy tag to clipboard
  const copyTag = () => {
    navigator.clipboard.writeText(`[${squad.tag}]`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Open edit dialog
  const handleOpenEdit = () => {
    setEditName(squad.name);
    setEditTag(squad.tag);
    setEditError('');
    setShowEditDialog(true);
  };

  // Update squad name and tag
  const handleUpdateSquad = async (e) => {
    e.preventDefault();
    setEditError('');
    
    if (!editName.trim() || editName.length < 3) {
      setEditError(t.nameTooShort);
      return;
    }
    if (!editTag.trim() || editTag.length < 2 || editTag.length > 5) {
      setEditError(t.tagInvalid);
      return;
    }
    
    setUpdatingSquad(true);
    try {
      const response = await fetch(`${API_URL}/squads/${squad._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: editName.trim(),
          tag: editTag.trim()
        })
      });
      const data = await response.json();
      if (data.success) {
        setSquad(data.squad);
        setShowEditDialog(false);
        setEditName('');
        setEditTag('');
        setError('');
        // Show success message temporarily
        setError(t.editSuccess);
        setTimeout(() => setError(''), 3000);
      } else {
        setEditError(data.message || 'Error updating squad');
      }
    } catch (err) {
      console.error('Error updating squad:', err);
      setEditError('Server error');
    } finally {
      setUpdatingSquad(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-dark-900 via-dark-950 to-dark-900" />
          {isHardcore ? (
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(239, 68, 68, 0.1) 0%, transparent 60%)' }} />
          ) : (
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(6, 182, 212, 0.1) 0%, transparent 60%)' }} />
          )}
        </div>
        
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center space-y-4">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center shadow-lg ${glowColor} animate-pulse`}>
              <Users className="w-8 h-8 text-white" />
            </div>
            <Loader2 className={`w-6 h-6 text-${accentColor}-500 animate-spin`} />
            <p className="text-gray-400 text-sm">{t.loading}</p>
          </div>
        </div>
      </div>
    );
  }

  // No squad state
  if (!squad) {
    return (
      <div className="min-h-screen bg-dark-950 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-dark-900 via-dark-950 to-dark-900" />
          {isHardcore ? (
            <>
              <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 20%, rgba(239, 68, 68, 0.08) 0%, transparent 50%)' }} />
              <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 70% 80%, rgba(249, 115, 22, 0.05) 0%, transparent 50%)' }} />
            </>
          ) : (
            <>
              <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 20%, rgba(6, 182, 212, 0.08) 0%, transparent 50%)' }} />
              <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 70% 80%, rgba(59, 130, 246, 0.05) 0%, transparent 50%)' }} />
            </>
          )}
          <div className="absolute inset-0 grid-pattern opacity-20" />
        </div>

        <div className="relative z-10 py-8 px-4">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center mb-10">
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br ${gradientFrom} ${gradientTo} shadow-xl ${glowColor} mb-6`}>
                <Users className="w-10 h-10 text-white" />
              </div>
              <h1 className={`text-4xl font-black bg-gradient-to-r ${gradientFrom} ${gradientTo} bg-clip-text text-transparent mb-3`}>
                {t.title}
              </h1>
              <p className="text-gray-400 text-lg">{t.subtitle}</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400 backdrop-blur-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
                <button onClick={() => setError('')} className="ml-auto p-1 hover:bg-red-500/20 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Create Form or Empty State */}
            {showCreateForm ? (
              <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border ${borderColor} p-6 sm:p-8 shadow-xl`}>
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center`}>
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    {t.createTitle}
                  </h2>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateSquad} className="space-y-6">
                  {/* Squad Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      {t.squadNameLabel} <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={squadName}
                      onChange={(e) => setSquadName(e.target.value)}
                      placeholder={t.squadNamePlaceholder}
                      maxLength={30}
                      className={`w-full px-4 py-3.5 bg-dark-800/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-${accentColor}-500/50 focus:ring-2 focus:ring-${accentColor}-500/20 transition-all`}
                    />
                  </div>

                  {/* Tag */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      {t.tagLabel} <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={squadTag}
                      onChange={(e) => setSquadTag(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
                      placeholder={t.tagPlaceholder}
                      maxLength={5}
                      className={`w-full px-4 py-3.5 bg-dark-800/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-${accentColor}-500/50 focus:ring-2 focus:ring-${accentColor}-500/20 transition-all font-mono tracking-wider`}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      {t.descLabel}
                    </label>
                    <textarea
                      value={squadDescription}
                      onChange={(e) => setSquadDescription(e.target.value)}
                      placeholder={t.descPlaceholder}
                      maxLength={200}
                      rows={3}
                      className={`w-full px-4 py-3.5 bg-dark-800/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-${accentColor}-500/50 focus:ring-2 focus:ring-${accentColor}-500/20 transition-all resize-none`}
                    />
                    <p className="text-xs text-gray-500 mt-1 text-right">{squadDescription.length}/200</p>
                  </div>

                  {/* Error */}
                  {createError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {createError}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="flex-1 px-6 py-3.5 bg-dark-800 hover:bg-dark-700 border border-white/10 rounded-xl text-white font-medium transition-colors"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={creatingSquad}
                      className={`flex-1 px-6 py-3.5 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-xl text-white font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg ${glowColor}`}
                    >
                      {creatingSquad ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          {t.creating}
                        </>
                      ) : (
                        <>
                          <Plus className="w-5 h-5" />
                          {t.create}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border ${borderColor} overflow-hidden shadow-xl`}>
                {/* Empty State Illustration */}
                <div className="relative p-8 sm:p-12">
                  <div className="absolute inset-0 overflow-hidden">
                    <div className={`absolute -top-20 -right-20 w-64 h-64 rounded-full bg-gradient-to-br ${gradientFrom} ${gradientTo} opacity-5 blur-3xl`} />
                    <div className={`absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-gradient-to-br ${gradientFrom} ${gradientTo} opacity-5 blur-3xl`} />
                  </div>
                  
                  <div className="relative text-center">
                    {/* Animated Icons */}
                    <div className="flex justify-center items-center gap-4 mb-8">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center opacity-40 transform -rotate-12`}>
                        <Shield className="w-6 h-6 text-white" />
                      </div>
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center shadow-lg ${glowColor}`}>
                        <Users className="w-8 h-8 text-white" />
                      </div>
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center opacity-40 transform rotate-12`}>
                        <Trophy className="w-6 h-6 text-white" />
                      </div>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-3">{t.noSquad}</h2>
                    <p className="text-gray-400 max-w-md mx-auto mb-8">{t.noSquadDesc}</p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <button
                        onClick={() => setShowCreateForm(true)}
                        className={`inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-xl text-white font-bold hover:opacity-90 transition-all shadow-lg ${glowColor} group`}
                      >
                        <Plus className="w-5 h-5" />
                        {t.createSquad}
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </button>
                      <Link
                        to="/squads"
                        className={`inline-flex items-center justify-center gap-3 px-8 py-4 bg-dark-800/80 border ${borderColor} rounded-xl text-white font-semibold hover:bg-dark-700/80 transition-all group`}
                      >
                        <Search className="w-5 h-5" />
                        {t.browseSquads}
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Squad view - Use mode-specific stats
  const modeStats = isHardcore ? squad.statsHardcore : squad.statsCdl;
  const totalWins = modeStats?.totalWins || 0;
  const totalLosses = modeStats?.totalLosses || 0;
  const totalPoints = modeStats?.totalPoints || 0;
  const winRate = totalWins + totalLosses > 0 
    ? Math.round((totalWins / (totalWins + totalLosses)) * 100) 
    : 0;

  const pendingRequests = squad.joinRequests?.length || 0;

  return (
    <div className="min-h-screen bg-dark-950 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-dark-900 via-dark-950 to-dark-900" />
        {isHardcore ? (
          <>
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 0%, rgba(239, 68, 68, 0.1) 0%, transparent 50%)' }} />
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 80% 100%, rgba(249, 115, 22, 0.05) 0%, transparent 50%)' }} />
          </>
        ) : (
          <>
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 0%, rgba(6, 182, 212, 0.1) 0%, transparent 50%)' }} />
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 80% 100%, rgba(59, 130, 246, 0.05) 0%, transparent 50%)' }} />
          </>
        )}
        <div className="absolute inset-0 grid-pattern opacity-20" />
      </div>

      <div className="relative z-10 py-6 sm:py-8 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400 backdrop-blur-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
              <button onClick={() => setError('')} className="ml-auto p-1 hover:bg-red-500/20 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Squad Hero Section with New Design */}
          <div className={`relative bg-gradient-to-br from-dark-900/95 via-dark-900/90 to-dark-900/95 backdrop-blur-xl rounded-3xl border ${borderColor} overflow-hidden shadow-2xl mb-8`}>
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden">
              <div className={`absolute -top-40 -right-40 w-80 h-80 rounded-full bg-gradient-to-br ${gradientFrom} ${gradientTo} opacity-20 blur-3xl animate-pulse`} />
              <div className={`absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-gradient-to-br ${gradientFrom} ${gradientTo} opacity-15 blur-3xl animate-pulse`} style={{ animationDelay: '1s' }} />
            </div>

            {/* Banner Section */}
            <div className="relative h-48 sm:h-56">
              {squad.banner ? (
                <>
                  <img 
                    src={squad.banner.startsWith('/uploads') ? `${UPLOADS_BASE_URL}${squad.banner}` : squad.banner}
                    alt="Squad banner"
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-dark-900/60 via-dark-900/80 to-dark-900" />
                </>
              ) : (
                <>
                  <div className="absolute inset-0 bg-gradient-to-br from-dark-800 via-dark-850 to-dark-900" />
                  <div className={`absolute inset-0 bg-gradient-to-r ${gradientFrom}/10 ${gradientTo}/5`} />
                </>
              )}
              
              {/* Quick Actions Floating */}
              {isLeaderOrOfficer && (
                <div className="absolute top-6 right-6 flex gap-3">
                  <Link
                    to="/squad-management"
                    className={`p-3 bg-dark-900/80 backdrop-blur-md hover:bg-dark-800/90 rounded-xl border ${borderColor} text-white transition-all hover:scale-105 shadow-lg ${glowColor}`}
                    title={t.manage}
                  >
                    <Settings className="w-5 h-5" />
                  </Link>
                </div>
              )}
            </div>

            {/* Main Content Section */}
            <div className="relative px-6 sm:px-8 pb-8 -mt-20">
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Left Section: Logo + Info */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 lg:flex-1">
                  {/* Logo with Glow Effect */}
                  <div className="relative group">
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradientFrom} ${gradientTo} rounded-2xl opacity-50 blur-xl group-hover:opacity-70 transition-opacity`} />
                    <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-2xl bg-dark-800/80 backdrop-blur-sm border-4 border-dark-900 flex items-center justify-center shadow-2xl overflow-hidden">
                      {squad.logo ? (
                        <img src={squad.logo} alt={squad.name} className="w-full h-full object-contain p-3" />
                      ) : (
                        <div className={`text-4xl font-black bg-gradient-to-br ${gradientFrom} ${gradientTo} bg-clip-text text-transparent`}>
                          {squad.tag?.substring(0, 2) || squad.name?.substring(0, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Squad Info */}
                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 mb-4">
                      <h1 className={`text-3xl sm:text-4xl font-black bg-gradient-to-r ${gradientFrom} ${gradientTo} bg-clip-text text-transparent`}>
                        {squad.name}
                      </h1>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={copyTag}
                          className={`flex items-center gap-2 px-4 py-2 bg-${accentColor}-500/20 hover:bg-${accentColor}-500/30 border border-${accentColor}-500/30 text-${accentColor}-400 font-bold rounded-lg transition-all hover:scale-105`}
                          title={t.copyTag}
                        >
                          [{squad.tag}]
                          {copied ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        {isLeaderOrOfficer && squad.leader?._id === user?._id && (
                          <button
                            onClick={handleOpenEdit}
                            className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-all"
                            title={t.editSquadInfo}
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {squad.description && (
                      <p className="text-gray-300 text-base leading-relaxed mb-4 max-w-2xl">{squad.description}</p>
                    )}
                    
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm">
                      <span className="flex items-center gap-2 text-gray-400">
                        <Calendar className="w-4 h-4" />
                        {t.createdAt} {new Date(squad.createdAt).toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : language === 'it' ? 'it-IT' : 'en-US', { month: 'long', year: 'numeric' })}
                      </span>
                      <Link
                        to={`/squad/${squad._id}`}
                        className={`flex items-center gap-2 text-${accentColor}-400 hover:text-${accentColor}-300 font-medium transition-colors`}
                      >
                        <Globe className="w-4 h-4" />
                        {t.viewProfile}
                      </Link>
                    </div>
                  </div>
                </div>


              </div>
            </div>
          </div>

          {/* Stricker Rank Display - Enhanced */}
          {squad.statsStricker?.rank && (() => {
            const rankName = squad.statsStricker.rank;
            const rankKey = rankName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const rankImages = {
              'recrues': '/stricker1.png',
              'operateurs': '/stricker2.png',
              'veterans': '/stricker3.png',
              'commandants': '/stricker4.png',
              'seigneurs de guerre': '/stricker5.png',
              'immortel': '/stricker6.png'
            };
            const rankImage = rankImages[rankKey] || '/stricker1.png';
            
            return (
              <div className="relative bg-gradient-to-br from-lime-900/20 via-green-900/20 to-emerald-900/20 backdrop-blur-sm rounded-2xl border border-lime-500/30 overflow-hidden mb-8 shadow-xl shadow-lime-500/10">
                {/* Animated Background */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-lime-500/10 rounded-full blur-3xl animate-pulse" />
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                </div>
                
                <div className="relative p-6 sm:p-8">
                  <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                    {/* Left: Rank Badge */}
                    <div className="flex items-center gap-6">
                      <div className="relative group">
                        <div className="absolute inset-0 bg-lime-400/30 blur-2xl rounded-full group-hover:bg-lime-400/40 transition-all" />
                        <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br from-lime-900/40 to-green-900/40 border-2 border-lime-500/40 flex items-center justify-center overflow-hidden shadow-2xl backdrop-blur-sm">
                          <img 
                            src={rankImage} 
                            alt={rankName}
                            className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-[0_0_16px_rgba(126,211,33,0.7)]"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-lime-400/70 text-xs sm:text-sm uppercase tracking-widest font-bold mb-2">
                          {language === 'fr' ? 'Rang Stricker' : 'Stricker Rank'}
                        </p>
                        <h3 className="text-lime-400 font-black text-2xl sm:text-3xl tracking-tight drop-shadow-[0_0_12px_rgba(126,211,33,0.4)]">
                          {rankName}
                        </h3>
                      </div>
                    </div>
                    
                    {/* Right: Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full lg:w-auto">
                      <div className="bg-dark-800/50 backdrop-blur-sm rounded-xl border border-lime-500/20 p-4 text-center hover:border-lime-500/40 transition-all">
                        <p className="text-2xl sm:text-3xl font-black text-lime-400">{squad.statsStricker?.points || 0}</p>
                        <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">{language === 'fr' ? 'Points' : 'Points'}</p>
                      </div>
                      <div className="bg-dark-800/50 backdrop-blur-sm rounded-xl border border-green-500/20 p-4 text-center hover:border-green-500/40 transition-all">
                        <p className="text-2xl sm:text-3xl font-black text-green-400">{squad.statsStricker?.wins || 0}</p>
                        <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">{language === 'fr' ? 'Victoires' : 'Wins'}</p>
                      </div>
                      <div className="bg-dark-800/50 backdrop-blur-sm rounded-xl border border-red-500/20 p-4 text-center hover:border-red-500/40 transition-all">
                        <p className="text-2xl sm:text-3xl font-black text-red-400">{squad.statsStricker?.losses || 0}</p>
                        <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">{language === 'fr' ? 'Défaites' : 'Losses'}</p>
                      </div>
                      <div className="bg-dark-800/50 backdrop-blur-sm rounded-xl border border-lime-500/20 p-4 text-center hover:border-lime-500/40 transition-all">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Crosshair className="w-5 h-5 text-lime-400" />
                          <p className="text-2xl sm:text-3xl font-black text-lime-400">{squad.cranes || 0}</p>
                        </div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">{t.cranes}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Main Content - Full Width */}
          <div>
            {/* Members Column - Full Width */}
            <div>
              <div className={`bg-gradient-to-br from-dark-900/95 via-dark-900/90 to-dark-900/95 backdrop-blur-xl rounded-2xl border ${borderColor} overflow-hidden shadow-xl`}>
                <div className="px-6 py-5 border-b border-white/10 bg-gradient-to-r from-dark-800/50 to-transparent">
                  <h2 className="text-xl font-black text-white flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center shadow-lg`}>
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <span>{t.members}</span>
                    <span className={`ml-auto px-3 py-1.5 text-sm font-bold bg-gradient-to-r ${gradientFrom} ${gradientTo} bg-clip-text text-transparent border border-${accentColor}-500/30 rounded-lg`}>
                      {squad.members?.length || 0}
                    </span>
                  </h2>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
                  {squad.members?.map((member, index) => {
                    const role = getMemberRole(member);
                    const isCurrentUser = (member.user?._id === user?._id || member.user?._id === user?.id);
                    return (
                      <Link
                        key={member.user?._id || member.user || index}
                        to={`/player/${member.user?._id}`}
                        className={`group relative bg-dark-800/50 hover:bg-dark-800/80 backdrop-blur-sm rounded-xl border ${
                          isCurrentUser ? `border-${accentColor}-500/50 shadow-lg shadow-${accentColor}-500/20` : 'border-white/10 hover:border-white/20'
                        } p-4 transition-all hover:scale-[1.02] hover:shadow-xl`}
                      >
                        {/* Glow effect for current user */}
                        {isCurrentUser && (
                          <div className={`absolute inset-0 bg-gradient-to-br ${gradientFrom} ${gradientTo} opacity-5 rounded-xl`} />
                        )}
                        
                        <div className="relative flex items-center gap-4">
                          <div className="relative flex-shrink-0">
                            <img
                              src={getAvatar(member)}
                              alt={member.user?.username}
                              className="w-14 h-14 rounded-xl object-cover border-2 border-white/20 group-hover:border-white/40 transition-all shadow-lg"
                              onError={(e) => { e.target.src = getDefaultAvatar(member.user?.username); }}
                            />
                            {role === 'leader' && (
                              <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center border-2 border-dark-900 shadow-lg shadow-yellow-500/50">
                                <Crown className="w-3 h-3 text-dark-900" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={`font-bold truncate text-base ${
                                isCurrentUser ? `text-${accentColor}-400` : 'text-white group-hover:text-gray-100'
                              }`}>
                                {member.user?.username}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg border ${
                                getRoleColor(role)
                              } flex items-center gap-1.5`}>
                                {getRoleIcon(role)}
                                {t[role]}
                              </span>
                            </div>
                            
                            <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-2">
                              <Clock className="w-3 h-3" />
                              {t.joinedAt} {new Date(member.joinedAt).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          
                          <ChevronRight className={`w-5 h-5 ${
                            isCurrentUser ? `text-${accentColor}-400` : 'text-gray-600 group-hover:text-gray-400'
                          } transition-colors flex-shrink-0`} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Leave Squad Button - Below Members */}
            {!isLeader && (
              <div className="mt-6">
                <button
                  onClick={() => setShowLeaveConfirm(true)}
                  className="w-full flex items-center justify-center gap-3 p-5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 rounded-2xl text-red-400 transition-all hover:scale-[1.02] font-bold shadow-lg hover:shadow-red-500/20"
                >
                  <UserMinus className="w-5 h-5" />
                  {t.leave}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Leave Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`bg-dark-900 border ${borderColor} rounded-2xl max-w-md w-full p-6 shadow-2xl`}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-7 h-7 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{t.leaveConfirm}</h3>
                <p className="text-gray-400 text-sm mt-1">{t.leaveWarning}</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white font-medium hover:bg-dark-700 transition-colors"
                disabled={leaving}
              >
                {t.cancel}
              </button>
              <button
                onClick={handleLeaveSquad}
                disabled={leaving}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 rounded-xl text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {leaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t.leaving}
                  </>
                ) : (
                  <>
                    <UserMinus className="w-5 h-5" />
                    {t.leaveButton}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Squad Dialog */}
      {showEditDialog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`bg-dark-900 border ${borderColor} rounded-2xl max-w-md w-full p-6 shadow-2xl`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">{t.editSquadTitle}</h3>
              <button
                onClick={() => {
                  setShowEditDialog(false);
                  setEditError('');
                }}
                className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                disabled={updatingSquad}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateSquad} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  {t.squadNameLabel}
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/20 transition-colors"
                  placeholder={t.squadNamePlaceholder}
                  disabled={updatingSquad}
                  required
                  minLength={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  {t.tagLabel}
                </label>
                <input
                  type="text"
                  value={editTag}
                  onChange={(e) => setEditTag(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/20 transition-colors"
                  placeholder={t.tagPlaceholder}
                  disabled={updatingSquad}
                  required
                  minLength={2}
                  maxLength={5}
                />
              </div>

              {editError && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl">
                  <p className="text-red-400 text-sm">{editError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditDialog(false);
                    setEditError('');
                  }}
                  className="flex-1 px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white font-medium hover:bg-dark-700 transition-colors"
                  disabled={updatingSquad}
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={updatingSquad}
                  className={`flex-1 px-4 py-3 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-xl text-white font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2`}
                >
                  {updatingSquad ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t.saving}
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      {t.save}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MySquad;
