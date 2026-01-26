import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { getDefaultAvatar, getAvatarUrl } from '../utils/avatar';
import { 
  Users, Crown, Shield, UserMinus, ArrowUpCircle, ArrowDownCircle, 
  Settings, UserPlus, Check, X, Loader2, ChevronLeft, Trash2,
  Lock, Unlock, Palette, Save, AlertTriangle, UserCheck, RefreshCw,
  Link2, Copy, Image, Upload, Clock, Trophy, ChevronRight
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const SquadManagement = () => {
  const { user, isAdmin, isStaff } = useAuth();
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const navigate = useNavigate();

  const [squad, setSquad] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('members');
  const [actionLoading, setActionLoading] = useState(null);
  const [addingFakePlayer, setAddingFakePlayer] = useState(false);
  
  // Settings form
  const [squadName, setSquadName] = useState('');
  const [squadTag, setSquadTag] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [color, setColor] = useState('#ef4444');
  const [logo, setLogo] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  
  // Invite link
  const [inviteCode, setInviteCode] = useState('');
  const [inviteExpires, setInviteExpires] = useState(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  
  // Logo upload
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  // Banner upload
  const [banner, setBanner] = useState('');
  const [uploadingBanner, setUploadingBanner] = useState(false);
  
  // Confirm modals
  const [confirmAction, setConfirmAction] = useState(null);
  const [ladderToUnregister, setLadderToUnregister] = useState(null);

  const isHardcore = selectedMode === 'hardcore';
  const accentColor = isHardcore ? 'red' : 'cyan';
  const gradientFrom = isHardcore ? 'from-red-500' : 'from-cyan-500';
  const gradientTo = isHardcore ? 'to-orange-500' : 'to-blue-500';

  // Traductions
  const texts = {
    fr: {
      squadManagement: 'Gestion de l\'escouade',
      members: 'Membres',
      requests: 'Demandes',
      settings: 'Paramètres',
      back: 'Retour au profil',
      squadName: 'Nom de l\'escouade',
      squadTag: 'Tag de l\'escouade',
      leader: 'Leader',
      officer: 'Officier',
      member: 'Membre',
      promote: 'Promouvoir officier',
      demote: 'Rétrograder membre',
      kick: 'Expulser',
      transferLeader: 'Transférer le leadership',
      accept: 'Accepter',
      reject: 'Rejeter',
      noRequests: 'Aucune demande en attente',
      description: 'Description',
      descriptionPlaceholder: 'Décrivez votre escouade...',
      visibility: 'Visibilité',
      public: 'Publique',
      publicDesc: 'N\'importe qui peut demander à rejoindre',
      private: 'Privée',
      privateDesc: 'Sur invitation uniquement',
      squadColor: 'Couleur de l\'escouade',
      saveSettings: 'Sauvegarder',
      disbandSquad: 'Dissoudre l\'escouade',
      disbandWarning: 'Cette action est irréversible. Tous les membres seront retirés.',
      confirmDisband: 'Êtes-vous sûr de vouloir dissoudre l\'escouade ?',
      confirmKick: 'Êtes-vous sûr de vouloir expulser ce membre ?',
      confirmTransfer: 'Êtes-vous sûr de vouloir transférer le leadership ?',
      joinedAt: 'Rejoint le',
      noSquad: 'Vous n\'avez pas d\'escouade',
      notLeader: 'Vous n\'êtes pas autorisé à gérer cette escouade',
      settingsSaved: 'Paramètres sauvegardés',
      memberPromoted: 'Membre promu',
      memberDemoted: 'Membre rétrogradé',
      memberKicked: 'Membre expulsé',
      leadershipTransferred: 'Leadership transféré',
      requestAccepted: 'Demande acceptée',
      requestRejected: 'Demande rejetée',
      squadDisbanded: 'Escouade dissoute',
      cancel: 'Annuler',
      confirm: 'Confirmer',
      inviteLink: 'Lien d\'invitation',
      generateInvite: 'Générer un lien',
      copyLink: 'Copier le lien',
      linkCopied: 'Lien copié !',
      inviteExpires: 'Expire dans',
      days: 'jours',
      revokeInvite: 'Révoquer le lien',
      noInviteCode: 'Aucun lien d\'invitation actif',
      squadLogo: 'Logo de l\'escouade',
      uploadLogo: 'Uploader un logo',
      logoHint: 'Image ou GIF (max 5MB)',
      removeLogo: 'Supprimer le logo',
      squadBanner: 'Bannière de l\'escouade',
      uploadBanner: 'Uploader une bannière',
      bannerHint: 'PNG, JPEG, GIF - Max 10MB',
      removeBanner: 'Supprimer la bannière',
      bannerUploaded: 'Bannière téléchargée !',
      bannerDeleted: 'Bannière supprimée !',
      ladders: 'Classements',
      registeredLadders: 'Classements inscrits',
      noLadders: 'Aucune inscription à un classement',
      registerToLadder: 'S\'inscrire aux classements',
      unregisterLadder: 'Se désinscrire',
      ladderPoints: 'Points',
      ladderWins: 'Victoires',
      ladderLosses: 'Défaites',
      viewRankings: 'Voir les classements',
      duoTrio: 'Chill',
      squadTeam: 'Compétitif',
      confirmUnregister: 'Êtes-vous sûr de vouloir vous désinscrire ?',
      unregisterWarning: 'Toutes les données liées à ce classement seront perdues (points, victoires, défaites).',
    },
    en: {
      squadManagement: 'Squad Management',
      members: 'Members',
      requests: 'Requests',
      settings: 'Settings',
      back: 'Back to profile',
      squadName: 'Squad name',
      squadTag: 'Squad tag',
      leader: 'Leader',
      officer: 'Officer',
      member: 'Member',
      promote: 'Promote to officer',
      demote: 'Demote to member',
      kick: 'Kick',
      transferLeader: 'Transfer leadership',
      accept: 'Accept',
      reject: 'Reject',
      noRequests: 'No pending requests',
      description: 'Description',
      descriptionPlaceholder: 'Describe your squad...',
      visibility: 'Visibility',
      public: 'Public',
      publicDesc: 'Anyone can request to join',
      private: 'Private',
      privateDesc: 'Invite only',
      squadColor: 'Squad color',
      saveSettings: 'Save',
      disbandSquad: 'Disband squad',
      disbandWarning: 'This action is irreversible. All members will be removed.',
      confirmDisband: 'Are you sure you want to disband the squad?',
      confirmKick: 'Are you sure you want to kick this member?',
      confirmTransfer: 'Are you sure you want to transfer leadership?',
      joinedAt: 'Joined',
      noSquad: 'You don\'t have a squad',
      notLeader: 'You are not authorized to manage this squad',
      settingsSaved: 'Settings saved',
      memberPromoted: 'Member promoted',
      memberDemoted: 'Member demoted',
      memberKicked: 'Member kicked',
      leadershipTransferred: 'Leadership transferred',
      requestAccepted: 'Request accepted',
      requestRejected: 'Request rejected',
      squadDisbanded: 'Squad disbanded',
      cancel: 'Cancel',
      confirm: 'Confirm',
      inviteLink: 'Invite link',
      generateInvite: 'Generate link',
      copyLink: 'Copy link',
      linkCopied: 'Link copied!',
      inviteExpires: 'Expires in',
      days: 'days',
      revokeInvite: 'Revoke link',
      noInviteCode: 'No active invite link',
      squadLogo: 'Squad logo',
      uploadLogo: 'Upload logo',
      logoHint: 'Image or GIF (max 5MB)',
      removeLogo: 'Remove logo',
      squadBanner: 'Squad banner',
      uploadBanner: 'Upload banner',
      bannerHint: 'PNG, JPEG, GIF - Max 10MB',
      removeBanner: 'Remove banner',
      bannerUploaded: 'Banner uploaded!',
      bannerDeleted: 'Banner deleted!',
      ladders: 'Rankings',
      registeredLadders: 'Registered ladders',
      noLadders: 'Not registered to any ladder',
      registerToLadder: 'Register to ladders',
      unregisterLadder: 'Unregister',
      ladderPoints: 'Points',
      ladderWins: 'Wins',
      ladderLosses: 'Losses',
      viewRankings: 'View rankings',
      duoTrio: 'Chill',
      squadTeam: 'Compétitif',
      confirmUnregister: 'Are you sure you want to unregister?',
      unregisterWarning: 'All data related to this ranking will be lost (points, wins, losses).',
    },
    de: {
      squadManagement: 'Squad-Verwaltung',
      members: 'Mitglieder',
      requests: 'Anfragen',
      settings: 'Einstellungen',
      back: 'Zurück zum Profil',
      squadName: 'Squad-Name',
      squadTag: 'Squad-Tag',
      leader: 'Leader',
      officer: 'Offizier',
      member: 'Mitglied',
      promote: 'Zum Offizier befördern',
      demote: 'Zum Mitglied degradieren',
      kick: 'Rauswerfen',
      transferLeader: 'Leadership übertragen',
      accept: 'Annehmen',
      reject: 'Ablehnen',
      noRequests: 'Keine ausstehenden Anfragen',
      description: 'Beschreibung',
      descriptionPlaceholder: 'Beschreibe dein Squad...',
      visibility: 'Sichtbarkeit',
      public: 'Öffentlich',
      publicDesc: 'Jeder kann einen Beitritt beantragen',
      private: 'Privat',
      privateDesc: 'Nur auf Einladung',
      squadColor: 'Squad-Farbe',
      saveSettings: 'Speichern',
      disbandSquad: 'Squad auflösen',
      disbandWarning: 'Diese Aktion ist unwiderruflich. Alle Mitglieder werden entfernt.',
      confirmDisband: 'Bist du sicher, dass du das Squad auflösen möchtest?',
      confirmKick: 'Bist du sicher, dass du dieses Mitglied rauswerfen möchtest?',
      confirmTransfer: 'Bist du sicher, dass du die Führung übertragen möchtest?',
      joinedAt: 'Beigetreten am',
      noSquad: 'Du hast kein Squad',
      notLeader: 'Du bist nicht berechtigt, dieses Squad zu verwalten',
      settingsSaved: 'Einstellungen gespeichert',
      memberPromoted: 'Mitglied befördert',
      memberDemoted: 'Mitglied degradiert',
      memberKicked: 'Mitglied rausgeworfen',
      leadershipTransferred: 'Leadership übertragen',
      requestAccepted: 'Anfrage angenommen',
      requestRejected: 'Anfrage abgelehnt',
      squadDisbanded: 'Squad aufgelöst',
      cancel: 'Abbrechen',
      confirm: 'Bestätigen',
      inviteLink: 'Einladungslink',
      generateInvite: 'Link generieren',
      copyLink: 'Link kopieren',
      linkCopied: 'Link kopiert!',
      inviteExpires: 'Läuft ab in',
      days: 'Tagen',
      revokeInvite: 'Link widerrufen',
      noInviteCode: 'Kein aktiver Einladungslink',
      squadLogo: 'Squad-Logo',
      uploadLogo: 'Logo hochladen',
      logoHint: 'Bild oder GIF (max 5MB)',
      removeLogo: 'Logo entfernen',
      ladders: 'Ranglisten',
      registeredLadders: 'Registrierte Ranglisten',
      noLadders: 'Nicht für eine Rangliste registriert',
      registerToLadder: 'Für Ranglisten registrieren',
      unregisterLadder: 'Abmelden',
      ladderPoints: 'Punkte',
      ladderWins: 'Siege',
      ladderLosses: 'Niederlagen',
      viewRankings: 'Ranglisten ansehen',
      duoTrio: 'Chill',
      squadTeam: 'Compétitif',
      confirmUnregister: 'Sind Sie sicher, dass Sie sich abmelden möchten?',
      unregisterWarning: 'Alle mit dieser Rangliste verbundenen Daten gehen verloren (Punkte, Siege, Niederlagen).',
    },
    it: {
      squadManagement: 'Gestione squadra',
      members: 'Membri',
      requests: 'Richieste',
      settings: 'Impostazioni',
      back: 'Torna al profilo',
      squadName: 'Nome squadra',
      squadTag: 'Tag squadra',
      leader: 'Leader',
      officer: 'Ufficiale',
      member: 'Membro',
      promote: 'Promuovi a ufficiale',
      demote: 'Degrada a membro',
      kick: 'Espelli',
      transferLeader: 'Trasferisci leadership',
      accept: 'Accetta',
      reject: 'Rifiuta',
      noRequests: 'Nessuna richiesta in sospeso',
      description: 'Descrizione',
      descriptionPlaceholder: 'Descrivi la tua squadra...',
      visibility: 'Visibilità',
      public: 'Pubblica',
      publicDesc: 'Chiunque può richiedere di unirsi',
      private: 'Privata',
      privateDesc: 'Solo su invito',
      squadColor: 'Colore squadra',
      saveSettings: 'Salva',
      disbandSquad: 'Sciogli squadra',
      disbandWarning: 'Questa azione è irreversibile. Tutti i membri saranno rimossi.',
      confirmDisband: 'Sei sicuro di voler sciogliere la squadra?',
      confirmKick: 'Sei sicuro di voler espellere questo membro?',
      confirmTransfer: 'Sei sicuro di voler trasferire la leadership?',
      joinedAt: 'Unito il',
      noSquad: 'Non hai una squadra',
      notLeader: 'Non sei autorizzato a gestire questa squadra',
      settingsSaved: 'Impostazioni salvate',
      memberPromoted: 'Membro promosso',
      memberDemoted: 'Membro degradato',
      memberKicked: 'Membro espulso',
      leadershipTransferred: 'Leadership trasferita',
      requestAccepted: 'Richiesta accettata',
      requestRejected: 'Richiesta rifiutata',
      squadDisbanded: 'Squadra sciolta',
      cancel: 'Annulla',
      confirm: 'Conferma',
      inviteLink: 'Link di invito',
      generateInvite: 'Genera link',
      copyLink: 'Copia link',
      linkCopied: 'Link copiato!',
      inviteExpires: 'Scade tra',
      days: 'giorni',
      revokeInvite: 'Revoca link',
      noInviteCode: 'Nessun link di invito attivo',
      squadLogo: 'Logo squadra',
      uploadLogo: 'Carica logo',
      logoHint: 'Immagine o GIF (max 5MB)',
      removeLogo: 'Rimuovi logo',
      ladders: 'Classifiche',
      registeredLadders: 'Classifiche registrate',
      noLadders: 'Non registrato in nessuna classifica',
      registerToLadder: 'Registrati alle classifiche',
      unregisterLadder: 'Annulla iscrizione',
      ladderPoints: 'Punti',
      ladderWins: 'Vittorie',
      ladderLosses: 'Sconfitte',
      viewRankings: 'Vedi classifiche',
      duoTrio: 'Chill',
      squadTeam: 'Compétitif',
      confirmUnregister: 'Sei sicuro di volerti disiscrivere?',
      unregisterWarning: 'Tutti i dati relativi a questa classifica andranno persi (punti, vittorie, sconfitte).',
    }
  };
  const t = texts[language] || texts.en;

  const predefinedColors = [
    'transparent', // Option sans couleur
    '#ef4444', '#f97316', '#f59e0b', '#eab308', 
    '#84cc16', '#22c55e', '#14b8a6', '#06b6d4',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
    '#d946ef', '#ec4899', '#f43f5e', '#64748b'
  ];

  const fetchSquad = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/squads/my-squad?mode=${selectedMode}`, {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success && data.squad) {
        setSquad(data.squad);
        setSquadName(data.squad.name || '');
        setSquadTag(data.squad.tag || '');
        setDescription(data.squad.description || '');
        setIsPublic(data.squad.isPublic);
        setColor(data.squad.color || '#ef4444');
        setLogo(data.squad.logo || '');
        setBanner(data.squad.banner || '');
        setInviteCode(data.squad.inviteCode || '');
        setInviteExpires(data.squad.inviteCodeExpiresAt || null);
      } else {
        setSquad(null);
      }
    } catch (err) {
      console.error('Error fetching squad:', err);
      setError('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  // Set page title
  useEffect(() => {
    const titles = {
      fr: 'NoMercy - Gestion de Squad',
      en: 'NoMercy - Squad Management',
      it: 'NoMercy - Gestione Squad',
      de: 'NoMercy - Squad-Verwaltung',
    };
    document.title = titles[language] || titles.en;
  }, [language]);

  useEffect(() => {
    fetchSquad();
  }, []);

  // Clear messages after 3 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const isLeader = squad?.leader?._id === user?.id || squad?.leader === user?.id;
  const isOfficer = squad?.members?.some(m => 
    (m.user?._id === user?.id || m.user === user?.id) && m.role === 'officer'
  );
  const canManage = isLeader || isOfficer;

  const getMemberAvatar = (member) => {
    const u = member.user;
    if (!u) return getDefaultAvatar('Unknown');
    
    // Check for custom avatar or avatarUrl
    const avatarUrl = getAvatarUrl(u.avatarUrl || u.avatar);
    if (avatarUrl) return avatarUrl;
    
    // Fallback to Discord avatar
    if (u.discordId && u.discordAvatar) {
      return `https://cdn.discordapp.com/avatars/${u.discordId}/${u.discordAvatar}.png`;
    }
    
    return getDefaultAvatar(u.username);
  };

  const handlePromote = async (memberId) => {
    try {
      setActionLoading(memberId);
      const response = await fetch(`${API_URL}/squads/${squad._id}/promote/${memberId}`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        setSquad(data.squad);
        setSuccess(t.memberPromoted);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur');
    } finally {
      setActionLoading(null);
    }
  };

  // DEV: Add fake player to squad
  const handleAddFakePlayer = async () => {
    try {
      setAddingFakePlayer(true);
      const response = await fetch(`${API_URL}/squads/${squad._id}/dev/add-fake-player`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        setSquad(data.squad);
        setSuccess(`Joueur fictif "${data.fakePlayer.username}" ajouté !`);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur');
    } finally {
      setAddingFakePlayer(false);
    }
  };

  const handleDemote = async (memberId) => {
    try {
      setActionLoading(memberId);
      const response = await fetch(`${API_URL}/squads/${squad._id}/demote/${memberId}`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        setSquad(data.squad);
        setSuccess(t.memberDemoted);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur');
    } finally {
      setActionLoading(null);
    }
  };

  const handleKick = async (memberId) => {
    try {
      setActionLoading(memberId);
      const response = await fetch(`${API_URL}/squads/${squad._id}/kick/${memberId}`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        fetchSquad();
        setSuccess(t.memberKicked);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur');
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const handleTransferLeadership = async (memberId) => {
    try {
      setActionLoading(memberId);
      const response = await fetch(`${API_URL}/squads/${squad._id}/transfer/${memberId}`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        setSquad(data.squad);
        setSuccess(t.leadershipTransferred);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur');
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const handleAcceptRequest = async (userId) => {
    try {
      setActionLoading(userId);
      const response = await fetch(`${API_URL}/squads/${squad._id}/accept/${userId}`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        fetchSquad();
        setSuccess(t.requestAccepted);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectRequest = async (userId) => {
    try {
      setActionLoading(userId);
      const response = await fetch(`${API_URL}/squads/${squad._id}/reject/${userId}`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        fetchSquad();
        setSuccess(t.requestRejected);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur');
    } finally {
      setActionLoading(null);
    }
  };

  // Generate invite link
  const handleGenerateInvite = async () => {
    try {
      setGeneratingInvite(true);
      const response = await fetch(`${API_URL}/squads/${squad._id}/generate-invite`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        setInviteCode(data.inviteCode);
        setInviteExpires(data.expiresAt);
        setSuccess(language === 'fr' ? 'Lien généré !' : 'Link generated!');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur');
    } finally {
      setGeneratingInvite(false);
    }
  };

  // Revoke invite link
  const handleRevokeInvite = async () => {
    try {
      setGeneratingInvite(true);
      const response = await fetch(`${API_URL}/squads/${squad._id}/revoke-invite`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        setInviteCode('');
        setInviteExpires(null);
        setSuccess(language === 'fr' ? 'Lien révoqué' : 'Link revoked');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur');
    } finally {
      setGeneratingInvite(false);
    }
  };

  // Copy invite link
  const copyInviteLink = () => {
    const link = `${window.location.origin}/join/${inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  // Get days until expiry
  const getDaysUntilExpiry = () => {
    if (!inviteExpires) return 0;
    const now = new Date();
    const expiry = new Date(inviteExpires);
    const diff = expiry - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  // Handle logo upload
  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Check file size (max 10MB for all images including GIFs)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(language === 'fr' 
        ? 'Le fichier est trop volumineux (max 10MB)' 
        : 'File is too large (max 10MB)');
      return;
    }
    
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError(language === 'fr' ? 'Type de fichier non supporté' : 'File type not supported');
      return;
    }
    
    setUploadingLogo(true);
    
    // Set a timeout to prevent infinite loading (30 seconds max)
    const uploadTimeout = setTimeout(() => {
      setUploadingLogo(false);
      setError(language === 'fr' ? 'Le téléchargement a pris trop de temps. Essayez avec un fichier plus petit.' : 'Upload took too long. Try with a smaller file.');
    }, 30000);
    
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result;
          
          // Save to server
          const response = await fetch(`${API_URL}/squads/${squad._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ logo: base64 })
          });
          const data = await response.json();
          
          clearTimeout(uploadTimeout);
          
          if (data.success) {
            setLogo(base64);
            setSquad(data.squad);
            setSuccess(language === 'fr' ? 'Logo mis à jour !' : 'Logo updated!');
          } else {
            setError(data.message || (language === 'fr' ? 'Erreur lors de la mise à jour' : 'Update error'));
          }
        } catch (err) {
          clearTimeout(uploadTimeout);
          console.error('Upload error:', err);
          setError(language === 'fr' ? 'Erreur lors de l\'envoi. Essayez avec un fichier plus petit.' : 'Upload error. Try with a smaller file.');
        } finally {
          setUploadingLogo(false);
        }
      };
      reader.onerror = () => {
        clearTimeout(uploadTimeout);
        setError(language === 'fr' ? 'Erreur lors de la lecture du fichier' : 'Error reading file');
        setUploadingLogo(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      clearTimeout(uploadTimeout);
      setError(language === 'fr' ? 'Erreur serveur' : 'Server error');
      setUploadingLogo(false);
    }
  };

  // Remove logo
  const handleRemoveLogo = async () => {
    try {
      setUploadingLogo(true);
      const response = await fetch(`${API_URL}/squads/${squad._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ logo: '' })
      });
      const data = await response.json();
      
      if (data.success) {
        setLogo('');
        setSquad(data.squad);
        setSuccess(language === 'fr' ? 'Logo supprimé' : 'Logo removed');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Handle banner upload
  const handleBannerUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(language === 'fr' 
        ? 'Le fichier est trop volumineux (max 10MB)' 
        : 'File is too large (max 10MB)');
      return;
    }
    
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setError(language === 'fr' ? 'Type de fichier non supporté' : 'File type not supported');
      return;
    }
    
    setUploadingBanner(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('banner', file);
      
      const response = await fetch(`${API_URL}/squads/${squad._id}/upload-banner`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      const data = await response.json();
      
      if (data.success) {
        setBanner(data.bannerUrl);
        setSuccess(t.bannerUploaded || 'Banner uploaded!');
        // Refresh squad data
        const squadResponse = await fetch(`${API_URL}/squads/my-squad?mode=${selectedMode}`, { credentials: 'include' });
        const squadData = await squadResponse.json();
        if (squadData.success) {
          setSquad(squadData.squad);
        }
      } else {
        setError(data.message || 'Upload error');
      }
    } catch (err) {
      console.error('Banner upload error:', err);
      setError(language === 'fr' ? 'Erreur serveur' : 'Server error');
    } finally {
      setUploadingBanner(false);
    }
  };

  // Remove banner
  const handleRemoveBanner = async () => {
    try {
      setUploadingBanner(true);
      const response = await fetch(`${API_URL}/squads/${squad._id}/delete-banner`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        setBanner('');
        setSuccess(t.bannerDeleted || 'Banner deleted!');
        // Refresh squad data
        const squadResponse = await fetch(`${API_URL}/squads/my-squad?mode=${selectedMode}`, { credentials: 'include' });
        const squadData = await squadResponse.json();
        if (squadData.success) {
          setSquad(squadData.squad);
        }
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur');
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      const response = await fetch(`${API_URL}/squads/${squad._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          name: squadName, 
          tag: squadTag, 
          description, 
          isPublic, 
          color 
        })
      });
      const data = await response.json();
      
      if (data.success) {
        setSquad(data.squad);
        setSquadName(data.squad.name);
        setSquadTag(data.squad.tag);
        setSuccess(t.settingsSaved);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDisband = async () => {
    try {
      setActionLoading('disband');
      const response = await fetch(`${API_URL}/squads/${squad._id}/disband`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        setSuccess(t.squadDisbanded);
        setTimeout(() => navigate('/my-profile'), 1500);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur');
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const handleUnregisterLadder = async (ladderId) => {
    try {
      setActionLoading(ladderId);
      const response = await fetch(`${API_URL}/squads/${squad._id}/unregister-ladder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ladderId })
      });
      const data = await response.json();
      
      if (data.success) {
        setSquad(data.squad);
        setSuccess(t.settingsSaved);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur');
    } finally {
      setActionLoading(null);
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'leader':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium">
            <Crown className="w-3 h-3" />
            {t.leader}
          </span>
        );
      case 'officer':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
            <Shield className="w-3 h-3" />
            {t.officer}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded text-xs font-medium">
            {t.member}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <Loader2 className={`w-8 h-8 text-${accentColor}-500 animate-spin`} />
      </div>
    );
  }

  if (!squad) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">{t.noSquad}</p>
          <Link 
            to="/my-profile"
            className={`inline-flex items-center gap-2 px-4 py-2 bg-${accentColor}-500 text-white rounded-lg hover:bg-${accentColor}-600 transition-colors`}
          >
            <ChevronLeft className="w-4 h-4" />
            {t.back}
          </Link>
        </div>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">{t.notLeader}</p>
          <Link 
            to="/my-profile"
            className={`inline-flex items-center gap-2 px-4 py-2 bg-${accentColor}-500 text-white rounded-lg hover:bg-${accentColor}-600 transition-colors`}
          >
            <ChevronLeft className="w-4 h-4" />
            {t.back}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-20"></div>
      {isHardcore ? (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 30% 0%, rgba(239, 68, 68, 0.08) 0%, transparent 50%)' }}></div>
      ) : (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 30% 0%, rgba(6, 182, 212, 0.08) 0%, transparent 50%)' }}></div>
      )}

      <div className="relative z-10 py-4 sm:py-8">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-4 sm:mb-8">
            <div className="flex items-center gap-2 sm:gap-4">
              <Link 
                to="/my-profile"
                className={`p-1.5 sm:p-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-gray-400 hover:text-white transition-colors`}
              >
                <ChevronLeft className="w-4 sm:w-5 h-4 sm:h-5" />
              </Link>
              <div className="flex items-center gap-2 sm:gap-3">
                <div 
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center overflow-hidden border border-white/10"
                  style={{ backgroundColor: squad.color === 'transparent' ? 'transparent' : squad.color + '30' }}
                >
                  {squad.logo ? (
                    <img src={squad.logo} alt={squad.name} className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: squad.color === 'transparent' ? '#9ca3af' : squad.color }} />
                  )}
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-white">{squad.name}</h1>
                  <p className="text-gray-500 text-xs sm:text-sm">[{squad.tag}] • {squad.members?.length || 1}</p>
                </div>
              </div>
            </div>
            <button
              onClick={fetchSquad}
              className="p-1.5 sm:p-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-gray-400 hover:text-white transition-colors"
              title="Rafraîchir"
            >
              <RefreshCw className="w-4 sm:w-5 h-4 sm:h-5" />
            </button>
          </div>

          {/* Messages */}
          {(success || error) && (
            <div className={`mb-6 p-4 rounded-xl border ${success ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
              {success || error}
            </div>
          )}

          {/* Tabs */}
          <div className={`flex flex-wrap gap-1 p-1 bg-dark-900/80 rounded-xl border border-${accentColor}-500/20 mb-4 sm:mb-6`}>
            <button
              onClick={() => setActiveTab('members')}
              className={`flex-1 min-w-[80px] flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                activeTab === 'members'
                  ? `bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white`
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users className="w-4 h-4" />
              {t.members}
            </button>
            {canManage && (
              <button
                onClick={() => setActiveTab('requests')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all relative ${
                  activeTab === 'requests'
                    ? `bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white`
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                {t.requests}
                {squad.joinRequests?.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {squad.joinRequests.length}
                  </span>
                )}
              </button>
            )}
            {canManage && (
              <button
                onClick={() => setActiveTab('ladders')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                  activeTab === 'ladders'
                    ? `bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white`
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Trophy className="w-4 h-4" />
                {t.ladders}
              </button>
            )}
            {isLeader && (
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                  activeTab === 'settings'
                    ? `bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white`
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Settings className="w-4 h-4" />
                {t.settings}
              </button>
            )}
          </div>

          {/* Content */}
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-${accentColor}-500/20 p-6`}>
            
            {/* Members Tab */}
            {activeTab === 'members' && (
              <div className="space-y-3">
                {squad.members?.map((member) => {
                  const memberId = member.user?._id || member.user;
                  const isCurrentUser = memberId === user?.id;
                  const isMemberLeader = member.role === 'leader';
                  
                  return (
                    <div 
                      key={memberId}
                      className={`flex items-center justify-between p-4 rounded-xl ${
                        isMemberLeader ? 'bg-yellow-500/5 border border-yellow-500/20' : 'bg-dark-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Link to={`/player/${member.user?._id}`}>
                          <img 
                            src={getMemberAvatar(member)}
                            alt={member.user?.username}
                            className="w-12 h-12 rounded-full"
                          />
                        </Link>
                        <div>
                          <div className="flex items-center gap-2">
                            <Link 
                              to={`/player/${member.user?._id}`}
                              className="text-white font-medium hover:underline"
                            >
                              {member.user?.username || member.user?.discordUsername || 'Unknown'}
                            </Link>
                            {getRoleBadge(member.role)}
                          </div>
                          <p className="text-gray-500 text-xs">
                            {t.joinedAt} {new Date(member.joinedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      {!isCurrentUser && !isMemberLeader && isLeader && (
                        <div className="flex items-center gap-2">
                          {member.role === 'member' ? (
                            <button
                              onClick={() => handlePromote(memberId)}
                              disabled={actionLoading === memberId}
                              className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                              title={t.promote}
                            >
                              {actionLoading === memberId ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <ArrowUpCircle className="w-4 h-4" />
                              )}
                            </button>
                          ) : member.role === 'officer' ? (
                            <button
                              onClick={() => handleDemote(memberId)}
                              disabled={actionLoading === memberId}
                              className="p-2 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors disabled:opacity-50"
                              title={t.demote}
                            >
                              {actionLoading === memberId ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <ArrowDownCircle className="w-4 h-4" />
                              )}
                            </button>
                          ) : null}
                          
                          <button
                            onClick={() => setConfirmAction({ type: 'transfer', memberId, username: member.user?.username })}
                            className="p-2 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
                            title={t.transferLeader}
                          >
                            <Crown className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => setConfirmAction({ type: 'kick', memberId, username: member.user?.username })}
                            className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                            title={t.kick}
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      
                      {/* Officer can only kick members */}
                      {!isCurrentUser && !isMemberLeader && isOfficer && !isLeader && member.role === 'member' && (
                        <button
                          onClick={() => setConfirmAction({ type: 'kick', memberId, username: member.user?.username })}
                          className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                          title={t.kick}
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Dev Button - Add Fake Player - Admin/Staff only */}
                {(isStaff && isStaff()) && (
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <p className="text-xs text-purple-500 mb-2 font-mono">🎮 Ajouter des membres fictifs (Admin/Staff)</p>
                    <button
                      onClick={handleAddFakePlayer}
                      disabled={addingFakePlayer}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-400 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {addingFakePlayer ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                      Ajouter un joueur fictif
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Requests Tab */}
            {activeTab === 'requests' && canManage && (
              <div>
                {squad.joinRequests?.length > 0 ? (
                  <div className="space-y-3">
                    {squad.joinRequests.map((request) => {
                      const requestUserId = request.user?._id || request.user;
                      return (
                        <div 
                          key={requestUserId}
                          className="flex items-center justify-between p-4 bg-dark-800/50 rounded-xl"
                        >
                          <div className="flex items-center gap-3">
                            <Link to={`/player/${request.user?._id}`}>
                              <img 
                                src={(() => {
                                  const u = request.user;
                                  if (!u) return getDefaultAvatar('Unknown');
                                  const avatarUrl = getAvatarUrl(u.avatarUrl || u.avatar);
                                  if (avatarUrl) return avatarUrl;
                                  if (u.discordId && u.discordAvatar) {
                                    return `https://cdn.discordapp.com/avatars/${u.discordId}/${u.discordAvatar}.png`;
                                  }
                                  return getDefaultAvatar(u.username);
                                })()}
                                alt=""
                                className="w-12 h-12 rounded-full"
                              />
                            </Link>
                            <div>
                              <Link 
                                to={`/player/${request.user?._id}`}
                                className="text-white font-medium hover:underline"
                              >
                                {request.user?.username || request.user?.discordUsername || 'Unknown'}
                              </Link>
                              {request.message && (
                                <p className="text-gray-400 text-sm italic">"{request.message}"</p>
                              )}
                              <p className="text-gray-500 text-xs">
                                {new Date(request.requestedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAcceptRequest(requestUserId)}
                              disabled={actionLoading === requestUserId}
                              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
                            >
                              {actionLoading === requestUserId ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="w-4 h-4" />
                                  <span className="text-sm">{t.accept}</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleRejectRequest(requestUserId)}
                              disabled={actionLoading === requestUserId}
                              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                            >
                              <X className="w-4 h-4" />
                              <span className="text-sm">{t.reject}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <UserCheck className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500">{t.noRequests}</p>
                  </div>
                )}
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && isLeader && (
              <div className="space-y-6">
                {/* Squad Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t.squadName}
                  </label>
                  <input
                    type="text"
                    value={squadName}
                    onChange={(e) => setSquadName(e.target.value)}
                    placeholder="Ex: Les Invincibles"
                    maxLength={50}
                    className={`w-full px-4 py-3 bg-dark-800/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-${accentColor}-500/50 transition-all`}
                  />
                  <p className="text-gray-500 text-xs mt-1">{squadName.length}/50</p>
                </div>

                {/* Squad Tag */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t.squadTag}
                  </label>
                  <input
                    type="text"
                    value={squadTag}
                    onChange={(e) => setSquadTag(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
                    placeholder="Ex: INV"
                    maxLength={5}
                    className={`w-full px-4 py-3 bg-dark-800/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-${accentColor}-500/50 transition-all`}
                  />
                  <p className="text-gray-500 text-xs mt-1">{squadTag.length}/5 - {language === 'fr' ? '2 minimum' : language === 'de' ? 'Mindestens 2' : language === 'it' ? 'Minimo 2' : 'Minimum 2'}</p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t.description}
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t.descriptionPlaceholder}
                    maxLength={200}
                    rows={3}
                    className={`w-full px-4 py-3 bg-dark-800/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-${accentColor}-500/50 transition-all resize-none`}
                  />
                  <p className="text-gray-500 text-xs mt-1">{description.length}/200</p>
                </div>

                {/* Visibility */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    {t.visibility}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setIsPublic(true)}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                        isPublic 
                          ? `border-${accentColor}-500 bg-${accentColor}-500/10` 
                          : 'border-white/10 bg-dark-800/50 hover:border-white/20'
                      }`}
                    >
                      <Unlock className={`w-5 h-5 ${isPublic ? `text-${accentColor}-400` : 'text-gray-400'}`} />
                      <div className="text-left">
                        <p className={`font-medium ${isPublic ? 'text-white' : 'text-gray-300'}`}>{t.public}</p>
                        <p className="text-xs text-gray-500">{t.publicDesc}</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setIsPublic(false)}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                        !isPublic 
                          ? `border-${accentColor}-500 bg-${accentColor}-500/10` 
                          : 'border-white/10 bg-dark-800/50 hover:border-white/20'
                      }`}
                    >
                      <Lock className={`w-5 h-5 ${!isPublic ? `text-${accentColor}-400` : 'text-gray-400'}`} />
                      <div className="text-left">
                        <p className={`font-medium ${!isPublic ? 'text-white' : 'text-gray-300'}`}>{t.private}</p>
                        <p className="text-xs text-gray-500">{t.privateDesc}</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Color */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    <Palette className="w-4 h-4 inline mr-2" />
                    {t.squadColor}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {predefinedColors.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={`w-10 h-10 rounded-lg border-2 transition-all ${
                          color === c ? 'border-white scale-110' : 'border-white/20 hover:scale-105'
                        } ${c === 'transparent' ? 'relative overflow-hidden' : ''}`}
                        style={{ backgroundColor: c === 'transparent' ? 'transparent' : c }}
                        title={c === 'transparent' ? 'Aucune couleur' : c}
                      >
                        {c === 'transparent' && (
                          <>
                            {/* Motif damier pour indiquer transparent */}
                            <div className="absolute inset-0 opacity-30" style={{
                              backgroundImage: 'linear-gradient(45deg, #666 25%, transparent 25%), linear-gradient(-45deg, #666 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #666 75%), linear-gradient(-45deg, transparent 75%, #666 75%)',
                              backgroundSize: '8px 8px',
                              backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px'
                            }} />
                            <X className="w-5 h-5 text-gray-400 relative z-10" />
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logo Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    <Image className="w-4 h-4 inline mr-2" />
                    {t.squadLogo}
                  </label>
                  <div className="flex items-center gap-4">
                    {/* Logo Preview */}
                    <div 
                      className="w-20 h-20 rounded-xl flex items-center justify-center border-2 border-dashed border-white/20 overflow-hidden"
                      style={{ backgroundColor: color === 'transparent' ? 'transparent' : color + '20' }}
                    >
                      {logo ? (
                        <img src={logo} alt="Squad logo" className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-8 h-8 text-gray-500" />
                      )}
                    </div>
                    
                    {/* Upload Actions */}
                    <div className="flex flex-col gap-2">
                      <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                        uploadingLogo 
                          ? 'bg-gray-700/50 text-gray-500' 
                          : `bg-${accentColor}-500/20 text-${accentColor}-400 hover:bg-${accentColor}-500/30`
                      }`}>
                        {uploadingLogo ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        <span className="text-sm font-medium">{t.uploadLogo}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          onChange={handleLogoUpload}
                          disabled={uploadingLogo}
                          className="hidden"
                        />
                      </label>
                      {logo && (
                        <button
                          onClick={handleRemoveLogo}
                          disabled={uploadingLogo}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50 text-sm font-medium"
                        >
                          <Trash2 className="w-4 h-4" />
                          {t.removeLogo}
                        </button>
                      )}
                      <p className="text-gray-500 text-xs">{t.logoHint}</p>
                    </div>
                  </div>
                </div>

                {/* Squad Banner */}
                {isLeader && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      <Image className="w-4 h-4 inline mr-2" />
                      {t.squadBanner}
                    </label>
                    
                    {/* Banner Preview */}
                    {banner && (
                      <div className="mb-3 relative rounded-xl overflow-hidden border border-white/10">
                        <img 
                          src={banner.startsWith('/uploads') ? `https://api-nomercy.ggsecure.io${banner}` : banner}
                          alt="Squad banner" 
                          className="w-full h-32 object-cover"
                        />
                        {uploadingBanner && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-white animate-spin" />
                          </div>
                        )}
                        {!uploadingBanner && (
                          <button
                            onClick={handleRemoveBanner}
                            type="button"
                            className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>
                        )}
                      </div>
                    )}
                    
                    {/* Upload Button */}
                    <label className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg cursor-pointer transition-colors ${
                      uploadingBanner 
                        ? 'bg-gray-700/50 text-gray-500 pointer-events-none' 
                        : `bg-${accentColor}-500/20 text-${accentColor}-400 hover:bg-${accentColor}-500/30`
                    }`}>
                      {uploadingBanner ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm font-medium">Upload en cours...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span className="text-sm font-medium">{t.uploadBanner}</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/jpg"
                        onChange={handleBannerUpload}
                        disabled={uploadingBanner}
                        className="hidden"
                      />
                    </label>
                    <p className="text-gray-500 text-xs mt-2">{t.bannerHint}</p>
                  </div>
                )}

                {/* Invite Link */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    <Link2 className="w-4 h-4 inline mr-2" />
                    {t.inviteLink}
                  </label>
                  
                  {inviteCode ? (
                    <div className="p-4 bg-dark-800/50 rounded-xl border border-white/10">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <code className={`px-3 py-1.5 bg-${accentColor}-500/20 text-${accentColor}-400 rounded-lg font-mono text-sm`}>
                            {inviteCode}
                          </code>
                          <button
                            onClick={copyInviteLink}
                            className={`p-2 rounded-lg transition-colors ${
                              copiedInvite 
                                ? 'bg-green-500/20 text-green-400' 
                                : `bg-${accentColor}-500/20 text-${accentColor}-400 hover:bg-${accentColor}-500/30`
                            }`}
                            title={copiedInvite ? t.linkCopied : t.copyLink}
                          >
                            {copiedInvite ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                        <button
                          onClick={handleRevokeInvite}
                          disabled={generatingInvite}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm disabled:opacity-50"
                        >
                          {generatingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                          {t.revokeInvite}
                        </button>
                      </div>
                      {inviteExpires && (
                        <div className="flex items-center gap-2 text-gray-500 text-xs">
                          <Clock className="w-3 h-3" />
                          <span>{t.inviteExpires} {getDaysUntilExpiry()} {t.days}</span>
                        </div>
                      )}
                      <p className="text-gray-500 text-xs mt-2">
                        {window.location.origin}/join/{inviteCode}
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 bg-dark-800/50 rounded-xl border border-white/10">
                      <p className="text-gray-500 text-sm mb-3">{t.noInviteCode}</p>
                      <button
                        onClick={handleGenerateInvite}
                        disabled={generatingInvite}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white font-medium hover:opacity-90 transition-all disabled:opacity-50`}
                      >
                        {generatingInvite ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Link2 className="w-4 h-4" />
                        )}
                        {t.generateInvite}
                      </button>
                    </div>
                  )}
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className={`w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white font-medium rounded-xl hover:opacity-90 transition-all disabled:opacity-50`}
                >
                  {savingSettings ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      {t.saveSettings}
                    </>
                  )}
                </button>

                {/* Danger Zone */}
                <div className="pt-6 border-t border-red-500/20">
                  <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/30">
                    <div className="flex items-start gap-3 mb-4">
                      <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-red-400 font-medium">{t.disbandSquad}</p>
                        <p className="text-red-400/70 text-sm">{t.disbandWarning}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setConfirmAction({ type: 'disband' })}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-red-500/20 text-red-400 font-medium rounded-lg hover:bg-red-500/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t.disbandSquad}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Ladders Tab */}
            {activeTab === 'ladders' && canManage && (
              <div className="space-y-6">
                {/* Link to rankings page */}
                <Link
                  to={`/${selectedMode}/rankings`}
                  className={`flex items-center justify-between p-4 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-xl text-white hover:opacity-90 transition-opacity`}
                >
                  <div className="flex items-center gap-3">
                    <Trophy className="w-6 h-6" />
                    <span className="font-medium">{t.viewRankings}</span>
                  </div>
                  <ChevronRight className="w-5 h-5" />
                </Link>

                {/* Registered ladders */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">{t.registeredLadders}</h3>
                  
                  {squad.registeredLadders?.length > 0 ? (
                    <div className="space-y-3">
                      {squad.registeredLadders.map((ladder) => (
                        <div 
                          key={ladder.ladderId}
                          className={`p-4 bg-dark-800/50 rounded-xl border border-${accentColor}-500/20`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg bg-${accentColor}-500/20 flex items-center justify-center`}>
                                <Trophy className={`w-5 h-5 text-${accentColor}-400`} />
                              </div>
                              <div>
                                <h4 className="text-white font-medium">
                                  {ladder.ladderId === 'duo-trio' ? t.duoTrio : t.squadTeam}
                                </h4>
                                <p className="text-gray-500 text-xs">
                                  {t.ladderPoints}: <span className={`text-${accentColor}-400 font-bold`}>{ladder.points || 0}</span>
                                  {' • '}
                                  {t.ladderWins}: <span className="text-green-400">{ladder.wins || 0}</span>
                                  {' • '}
                                  {t.ladderLosses}: <span className="text-red-400">{ladder.losses || 0}</span>
                                </p>
                              </div>
                            </div>
                            {isLeader && (
                              <button
                                onClick={() => setLadderToUnregister(ladder)}
                                disabled={actionLoading === ladder.ladderId}
                                className="px-3 py-1.5 bg-red-500/20 text-red-400 text-sm font-medium rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
                              >
                                {actionLoading === ladder.ladderId ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  t.unregisterLadder
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-dark-800/50 rounded-xl border border-white/10">
                      <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500">{t.noLadders}</p>
                      <Link
                        to={`/${selectedMode}/rankings`}
                        className={`inline-flex items-center gap-2 mt-4 px-4 py-2 bg-${accentColor}-500/20 text-${accentColor}-400 rounded-lg hover:bg-${accentColor}-500/30 transition-colors`}
                      >
                        <Trophy className="w-4 h-4" />
                        {t.registerToLadder}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 rounded-2xl border border-red-500/30 p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {confirmAction.type === 'disband' && t.disbandSquad}
                  {confirmAction.type === 'kick' && t.kick}
                  {confirmAction.type === 'transfer' && t.transferLeader}
                </h3>
                {confirmAction.username && (
                  <p className="text-gray-400">{confirmAction.username}</p>
                )}
              </div>
            </div>
            
            <p className="text-gray-300 mb-6">
              {confirmAction.type === 'disband' && t.confirmDisband}
              {confirmAction.type === 'kick' && t.confirmKick}
              {confirmAction.type === 'transfer' && t.confirmTransfer}
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2 px-4 bg-dark-800 text-white font-medium rounded-lg hover:bg-dark-700 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  if (confirmAction.type === 'disband') handleDisband();
                  if (confirmAction.type === 'kick') handleKick(confirmAction.memberId);
                  if (confirmAction.type === 'transfer') handleTransferLeadership(confirmAction.memberId);
                }}
                disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t.confirm
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unregister Ladder Confirmation Dialog */}
      {ladderToUnregister && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-dark-900 rounded-2xl border border-red-500/30 p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{t.unregisterLadder}</h3>
                <p className="text-gray-400 text-sm">
                  {ladderToUnregister.ladderId === 'duo-trio' ? t.duoTrio : t.squadTeam}
                </p>
              </div>
            </div>
            
            <div className="mb-6 space-y-3">
              <p className="text-gray-300">{t.confirmUnregister}</p>
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{t.unregisterWarning}</span>
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setLadderToUnregister(null)}
                className="flex-1 py-2 px-4 bg-dark-800 text-white font-medium rounded-lg hover:bg-dark-700 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  handleUnregisterLadder(ladderToUnregister.ladderId);
                  setLadderToUnregister(null);
                }}
                disabled={actionLoading === ladderToUnregister.ladderId}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {actionLoading === ladderToUnregister.ladderId ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t.confirm
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SquadManagement;

