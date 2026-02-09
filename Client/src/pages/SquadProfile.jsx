import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { getDefaultAvatar, getAvatarUrl } from '../utils/avatar';
import { 
  ArrowLeft, Trophy, Medal, Shield, Users, Calendar, Crown, Loader2, 
  AlertCircle, TrendingUp, Target, UserPlus, Lock, Check, X, Send, Award,
  Swords, Clock, Play, Star, ChevronLeft, ChevronRight, Crosshair
} from 'lucide-react';

import { API_URL, UPLOADS_BASE_URL } from '../config';

const SquadProfile = () => {
  const { squadId } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const { user, isAuthenticated } = useAuth();

  const isHardcore = selectedMode === 'hardcore';
  const accentColor = isHardcore ? 'red' : 'cyan';
  const gradientFrom = isHardcore ? 'from-red-500' : 'from-cyan-400';
  const gradientTo = isHardcore ? 'to-orange-600' : 'to-cyan-600';

  // States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [squad, setSquad] = useState(null);
  const [defaultTrophies, setDefaultTrophies] = useState([]);
  
  // Join request states
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinMessage, setJoinMessage] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [hasRequested, setHasRequested] = useState(false);
  
  // Match history state
  const [matchHistory, setMatchHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [showMatchDetails, setShowMatchDetails] = useState(false);
  const [matchHistoryPage, setMatchHistoryPage] = useState(1);
  const [matchHistoryTotalPages, setMatchHistoryTotalPages] = useState(1);
  const [matchHistoryTotal, setMatchHistoryTotal] = useState(0);
  const MATCHES_PER_PAGE = 20;
  
  // Lock body scroll when dialog is open
  useEffect(() => {
    if (showMatchDetails) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showMatchDetails]);

  // Traductions
  const texts = {
    fr: {
      back: 'Retour',
      members: 'Membres',
      wins: 'Victoires',
      losses: 'Défaites',
      winRate: 'Taux de victoire',
      totalMembers: 'Membres',
      points: 'Points',
      leader: 'Leader',
      officer: 'Officier',
      member: 'Membre',
      joinedAt: 'Rejoint le',
      createdAt: 'Créée le',
      notFound: 'Escouade introuvable',
      loadingError: 'Erreur de chargement',
      noMembers: 'Aucun membre',
      stats: 'Statistiques',
      joinSquad: 'Postuler',
      alreadyInSquad: 'Vous êtes déjà dans une escouade',
      squadFull: 'Escouade complète',
      privateSquad: 'Escouade privée',
      sendRequest: 'Envoyer la demande',
      cancel: 'Annuler',
      joinRequestSent: 'Demande envoyée !',
      joinRequestMessage: 'Message (optionnel)',
      joinRequestPlaceholder: 'Présentez-vous brièvement...',
      alreadyRequested: 'Demande déjà envoyée',
      loginToJoin: 'Connectez-vous pour postuler',
      trophies: 'Trophées',
      trophyBravery: 'La Bravoure',
      trophyBraveryDesc: 'Création de l\'escouade',
      matchHistory: 'Historique mode stricker',
      noMatches: 'Aucun match joué',
      victory: 'Victoire',
      defeat: 'Défaite',
      vs: 'vs',
      viewDetails: 'Voir détails',
      matchDetails: 'Détails du match',
      winner: 'Équipe gagnante',
      loser: 'Équipe perdante',
      roster: 'Roster',
      gameModes: {
        'Search & Destroy': 'Recherche & Destruction',
        'Domination': 'Domination',
        'Team Deathmatch': 'Mêlée générale',
      },
      deletedTeam: 'Équipe supprimée',
      deletedPlayer: 'Joueur supprimé',
      page: 'Page',
      of: 'sur',
      previous: 'Précédent',
      next: 'Suivant',
      totalMatches: 'matchs au total',
      cranes: 'Munitions',
    },
    en: {
      back: 'Back',
      members: 'Members',
      wins: 'Wins',
      losses: 'Losses',
      winRate: 'Win Rate',
      totalMembers: 'Members',
      points: 'Points',
      leader: 'Leader',
      officer: 'Officer',
      member: 'Member',
      joinedAt: 'Joined',
      createdAt: 'Created',
      notFound: 'Squad not found',
      loadingError: 'Loading error',
      noMembers: 'No members',
      stats: 'Statistics',
      joinSquad: 'Apply to join',
      alreadyInSquad: 'You are already in a squad',
      squadFull: 'Squad is full',
      privateSquad: 'Private squad',
      sendRequest: 'Send request',
      cancel: 'Cancel',
      joinRequestSent: 'Request sent!',
      joinRequestMessage: 'Message (optional)',
      joinRequestPlaceholder: 'Briefly introduce yourself...',
      alreadyRequested: 'Request already sent',
      loginToJoin: 'Login to apply',
      trophies: 'Trophies',
      trophyBravery: 'Bravery',
      trophyBraveryDesc: 'Squad creation',
      matchHistory: 'Stricker Mode History',
      noMatches: 'No matches played',
      victory: 'Victory',
      defeat: 'Defeat',
      vs: 'vs',
      viewDetails: 'View details',
      matchDetails: 'Match Details',
      winner: 'Winning Team',
      loser: 'Losing Team',
      roster: 'Roster',
      gameModes: {
        'Search & Destroy': 'Search & Destroy',
        'Domination': 'Domination',
        'Team Deathmatch': 'Team Deathmatch',
      },
      deletedTeam: 'Deleted team',
      deletedPlayer: 'Deleted player',
      page: 'Page',
      of: 'of',
      previous: 'Previous',
      next: 'Next',
      totalMatches: 'total matches',
      cranes: 'Ammo',
    },
    de: {
      back: 'Zurück',
      members: 'Mitglieder',
      wins: 'Siege',
      losses: 'Niederlagen',
      winRate: 'Siegquote',
      totalMembers: 'Mitglieder',
      points: 'Punkte',
      leader: 'Leader',
      officer: 'Offizier',
      member: 'Mitglied',
      joinedAt: 'Beigetreten am',
      createdAt: 'Erstellt am',
      notFound: 'Squad nicht gefunden',
      loadingError: 'Ladefehler',
      noMembers: 'Keine Mitglieder',
      stats: 'Statistiken',
      joinSquad: 'Beitreten beantragen',
      alreadyInSquad: 'Du bist bereits in einem Squad',
      squadFull: 'Squad ist voll',
      privateSquad: 'Privates Squad',
      sendRequest: 'Anfrage senden',
      cancel: 'Abbrechen',
      joinRequestSent: 'Anfrage gesendet!',
      joinRequestMessage: 'Nachricht (optional)',
      joinRequestPlaceholder: 'Stelle dich kurz vor...',
      alreadyRequested: 'Anfrage bereits gesendet',
      loginToJoin: 'Anmelden um beizutreten',
      trophies: 'Trophäen',
      trophyBravery: 'Tapferkeit',
      trophyBraveryDesc: 'Squad-Erstellung',
      matchHistory: 'Stricker-Modus Verlauf',
      noMatches: 'Keine Spiele gespielt',
      victory: 'Sieg',
      defeat: 'Niederlage',
      vs: 'vs',
      viewDetails: 'Details ansehen',
      matchDetails: 'Spieldetails',
      winner: 'Gewinnendes Team',
      loser: 'Verlierendes Team',
      roster: 'Aufstellung',
      gameModes: {
        'Search & Destroy': 'Suchen & Zerstören',
        'Domination': 'Herrschaft',
        'Team Deathmatch': 'Team-Deathmatch',
      },
      deletedTeam: 'Gelöschtes Team',
      deletedPlayer: 'Gelöschter Spieler',
      page: 'Seite',
      of: 'von',
      previous: 'Zurück',
      next: 'Weiter',
      totalMatches: 'Spiele insgesamt',
      cranes: 'Munition',
    },
    it: {
      back: 'Indietro',
      members: 'Membri',
      wins: 'Vittorie',
      losses: 'Sconfitte',
      winRate: 'Percentuale vittorie',
      totalMembers: 'Membri',
      points: 'Punti',
      leader: 'Leader',
      officer: 'Ufficiale',
      member: 'Membro',
      joinedAt: 'Unito il',
      createdAt: 'Creata il',
      notFound: 'Squadra non trovata',
      loadingError: 'Errore di caricamento',
      noMembers: 'Nessun membro',
      stats: 'Statistiche',
      joinSquad: 'Richiedi di unirti',
      alreadyInSquad: 'Sei già in una squadra',
      squadFull: 'Squadra piena',
      privateSquad: 'Squadra privata',
      sendRequest: 'Invia richiesta',
      cancel: 'Annulla',
      joinRequestSent: 'Richiesta inviata!',
      joinRequestMessage: 'Messaggio (opzionale)',
      joinRequestPlaceholder: 'Presentati brevemente...',
      alreadyRequested: 'Richiesta già inviata',
      loginToJoin: 'Accedi per candidarti',
      trophies: 'Trofei',
      trophyBravery: 'Il Coraggio',
      trophyBraveryDesc: 'Creazione della squadra',
      matchHistory: 'Storico modalità stricker',
      noMatches: 'Nessuna partita giocata',
      victory: 'Vittoria',
      defeat: 'Sconfitta',
      vs: 'vs',
      viewDetails: 'Vedi dettagli',
      matchDetails: 'Dettagli partita',
      winner: 'Squadra vincitrice',
      loser: 'Squadra perdente',
      roster: 'Formazione',
      gameModes: {
        'Search & Destroy': 'Cerca e Distruggi',
        'Domination': 'Dominazione',
        'Team Deathmatch': 'Deathmatch a squadre',
      },
      deletedTeam: 'Squadra eliminata',
      deletedPlayer: 'Giocatore eliminato',
      page: 'Pagina',
      of: 'di',
      previous: 'Precedente',
      next: 'Successivo',
      totalMatches: 'partite totali',
      cranes: 'Munizioni',
    },
  };
  const t = texts[language] || texts.en;

  // Set page title
  useEffect(() => {
    const titles = {
      fr: 'NoMercy - Squad',
      en: 'NoMercy - Squad',
      it: 'NoMercy - Squad',
      de: 'NoMercy - Squad',
    };
    document.title = titles[language] || titles.en;
  }, [language]);

  // Fetch squad data
  useEffect(() => {
    const fetchSquadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`${API_URL}/squads/${squadId}`);
        const data = await response.json();
        
        if (!data.success) {
          setError(t.notFound);
          setLoading(false);
          return;
        }
        
        setSquad(data.squad);
        
        // Check if user has already requested to join
        if (isAuthenticated && user && data.squad.joinRequests) {
          const alreadyRequested = data.squad.joinRequests.some(
            req => (req.user?._id || req.user) === user.id
          );
          setHasRequested(alreadyRequested);
        }
      } catch (err) {
        console.error('Error fetching squad data:', err);
        setError(t.loadingError);
      } finally {
        setLoading(false);
      }
    };
    
    if (squadId) {
      fetchSquadData();
    }
  }, [squadId, language, isAuthenticated, user]);

  // Fetch default trophies
  useEffect(() => {
    const fetchTrophies = async () => {
      try {
        const response = await fetch(`${API_URL}/trophies/default`);
        const data = await response.json();
        if (data.success) {
          setDefaultTrophies(data.trophies);
        }
      } catch (err) {
        console.error('Error fetching trophies:', err);
      }
    };
    fetchTrophies();
  }, []);

  // Fetch stricker match history
  useEffect(() => {
    const fetchMatchHistory = async () => {
      if (!squadId) return;
      setLoadingHistory(true);
      try {
        const response = await fetch(`${API_URL}/stricker/history/squad/${squadId}?limit=${MATCHES_PER_PAGE}&page=${matchHistoryPage}`);
        const data = await response.json();
        if (data.success) {
          setMatchHistory(data.matches);
          setMatchHistoryTotalPages(data.pagination?.pages || 1);
          setMatchHistoryTotal(data.pagination?.total || data.matches.length);
        }
      } catch (err) {
        console.error('Error fetching stricker match history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchMatchHistory();
  }, [squadId, matchHistoryPage]);

  // Calculate win rate
  // Get mode-specific stats
  const getModeStats = () => {
    if (!squad) return {};
    if (isHardcore) {
      return squad.statsHardcore || squad.stats || {};
    } else {
      return squad.statsCdl || squad.stats || {};
    }
  };

  const getWinRate = () => {
    const stats = getModeStats();
    if (!stats) return '0%';
    const total = (stats.totalWins || 0) + (stats.totalLosses || 0);
    if (total === 0) return '0%';
    return `${Math.round((stats.totalWins / total) * 100)}%`;
  };

  // Get member avatar
  const getMemberAvatar = (member) => {
    if (member.user?.avatar) return getAvatarUrl(member.user.avatar);
    if (member.user?.avatarUrl) return getAvatarUrl(member.user.avatarUrl);
    return getDefaultAvatar(member.user?.username);
  };

  // Get role badge
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

  // Check if user can join
  const canJoin = () => {
    if (!isAuthenticated) return { can: false, reason: t.loginToJoin };
    if (!squad) return { can: false, reason: '' };
    
    // Check if user is already in this squad
    const isMember = squad.members?.some(m => (m.user?._id || m.user) === user?.id);
    if (isMember) return { can: false, reason: t.alreadyInSquad };
    
    // Check if user already has a squad
    if (user?.squad) return { can: false, reason: t.alreadyInSquad };
    
    // Check if squad is full
    if (squad.members?.length >= squad.maxMembers) return { can: false, reason: t.squadFull };
    
    // Check if squad is private
    if (!squad.isPublic) return { can: false, reason: t.privateSquad };
    
    // Check if already requested
    if (hasRequested) return { can: false, reason: t.alreadyRequested };
    
    return { can: true, reason: '' };
  };

  // Handle join request
  const handleJoinRequest = async () => {
    if (!squad || !isAuthenticated) return;
    
    setJoinLoading(true);
    setJoinError('');
    
    try {
      const response = await fetch(`${API_URL}/squads/${squad._id}/join-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: joinMessage.trim() })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setJoinSuccess(true);
        setHasRequested(true);
        setTimeout(() => {
          setShowJoinModal(false);
          setJoinSuccess(false);
        }, 2000);
      } else {
        setJoinError(data.message);
      }
    } catch (err) {
      setJoinError('Erreur serveur');
    } finally {
      setJoinLoading(false);
    }
  };

  const joinStatus = canJoin();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <Loader2 className={`w-12 h-12 text-${accentColor}-400 animate-spin`} />
      </div>
    );
  }

  if (error || !squad) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">{error || t.notFound}</h1>
        <button 
          onClick={() => navigate(-1)}
          className={`mt-4 px-6 py-2 bg-${accentColor}-500 text-white rounded-lg hover:opacity-90 transition-opacity`}
        >
          {t.back}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 relative">
      {isHardcore ? (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 20% 20%, rgba(239, 68, 68, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(249, 115, 22, 0.05) 0%, transparent 50%)' }}></div>
      ) : (
        <div className="absolute inset-0 bg-mesh pointer-events-none"></div>
      )}
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-30"></div>
      
      <div className="relative z-10 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Deleted Squad Alert */}
          {squad?.isDeleted && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6 text-center">
              <div className="flex items-center justify-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-red-400 font-medium">
                  {language === 'fr' 
                    ? 'Cette escouade a été supprimée. Les statistiques sont conservées à des fins historiques.'
                    : language === 'de'
                      ? 'Dieses Squad wurde gelöscht. Statistiken werden zu historischen Zwecken aufbewahrt.'
                      : language === 'it'
                        ? 'Questa squadra è stata eliminata. Le statistiche sono conservate per scopi storici.'
                        : 'This squad has been deleted. Statistics are kept for historical purposes.'}
                </p>
              </div>
            </div>
          )}
          
          <button onClick={() => navigate(-1)} className={`mb-6 flex items-center space-x-2 text-gray-400 hover:text-${accentColor}-400 transition-colors group`}>
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>{t.back}</span>
          </button>

          {/* Header */}
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-${accentColor}-500/20 overflow-hidden mb-6`}>
            {/* Banner */}
            {squad.banner && (
              <div className="w-full h-32 sm:h-40 relative overflow-hidden">
                <img 
                  src={squad.banner.startsWith('/uploads') ? `${UPLOADS_BASE_URL}${squad.banner}` : squad.banner}
                  alt="Squad banner"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-dark-900/80"></div>
              </div>
            )}
            
            <div className={`p-8 ${squad.banner ? '-mt-12 relative' : ''}`}>
            <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
              <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6">
                <div className="relative">
                  <div className="absolute inset-0 blur-2xl rounded-full" style={{ backgroundColor: squad.color === 'transparent' ? 'transparent' : squad.color + '40' }}></div>
                  <div 
                    className="relative w-24 h-24 rounded-full flex items-center justify-center shadow-lg overflow-hidden border border-white/10"
                    style={{ 
                      backgroundColor: squad.color === 'transparent' ? 'transparent' : squad.color + '30', 
                      boxShadow: squad.color === 'transparent' ? 'none' : `0 0 30px ${squad.color}50`
                    }}
                  >
                    {squad.logo ? (
                      <img src={squad.logo} alt={squad.name} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-12 h-12" style={{ color: squad.color === 'transparent' ? '#9ca3af' : squad.color }} />
                    )}
                  </div>
                </div>
                <div className="text-center md:text-left">
                  <div className="flex items-center gap-3 justify-center md:justify-start flex-wrap">
                    <h1 className="text-3xl font-bold text-white">{squad.name}</h1>
                    <span className="text-gray-500 text-xl">[{squad.tag}]</span>
                  </div>
                  {squad.description && (
                    <p className="text-gray-400 mt-2 max-w-md">{squad.description}</p>
                  )}
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-3 text-sm">
                    <span className={`px-3 py-1.5 rounded-lg font-bold text-white`} style={{ backgroundColor: squad.color === 'transparent' ? 'rgba(255,255,255,0.1)' : squad.color + '40', border: squad.color === 'transparent' ? '1px solid rgba(255,255,255,0.2)' : `1px solid ${squad.color}60` }}>
                      {getModeStats()?.totalPoints || 0} pts
                    </span>
                    <span className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white">
                      <Users className="w-4 h-4" />
                      <span>{squad.members?.length || 0}/{squad.maxMembers || 10}</span>
                    </span>
                    <span className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-400 text-xs">
                      {squad.mode === 'both' ? 'Hardcore & CDL' : squad.mode === 'hardcore' ? 'Hardcore' : 'CDL'}
                    </span>
                    {!squad.isPublic && (
                      <span className="flex items-center gap-1 px-3 py-1.5 bg-orange-500/20 border border-orange-500/30 rounded-lg text-orange-400 text-xs">
                        <Lock className="w-3 h-3" />
                        {language === 'fr' ? 'Privée' : 'Private'}
                    </span>
                    )}
                  </div>
                  {squad.createdAt && (
                    <p className="text-gray-500 text-xs mt-3 flex items-center justify-center md:justify-start gap-1">
                      <Calendar className="w-3 h-3" />
                      {t.createdAt} {new Date(squad.createdAt).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Join Button */}
              <div className="flex flex-col items-center gap-2">
                {joinStatus.can ? (
                  <button
                    onClick={() => setShowJoinModal(true)}
                    className={`flex items-center gap-2 px-6 py-3 bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white font-bold rounded-xl hover:opacity-90 transition-all shadow-lg`}
                  >
                    <UserPlus className="w-5 h-5" />
                    {t.joinSquad}
                  </button>
                ) : joinStatus.reason ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-xl text-gray-500 text-sm">
                    {hasRequested ? <Check className="w-4 h-4 text-green-400" /> : <Lock className="w-4 h-4" />}
                    {joinStatus.reason}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          </div>

          {/* Trophies Section */}
          {(() => {
            // Combine default trophies and squad-specific trophies
            const squadTrophyIds = squad.trophies?.map(t => t.trophy?._id || t.trophy) || [];
            const squadEarnedTrophies = squad.trophies?.map(t => t.trophy).filter(Boolean) || [];
            
            // Get default trophies that squad doesn't already have
            const defaultTrophiesToShow = defaultTrophies.filter(dt => !squadTrophyIds.includes(dt._id));
            
            // Combine and sort: earned first, then by rarity (highest first)
            const allTrophies = [...squadEarnedTrophies, ...defaultTrophiesToShow]
              .sort((a, b) => {
                const aEarned = squadTrophyIds.includes(a._id) ? 1 : 0;
                const bEarned = squadTrophyIds.includes(b._id) ? 1 : 0;
                if (bEarned !== aEarned) return bEarned - aEarned;
                return (b.rarity || 1) - (a.rarity || 1);
              });
            
            if (allTrophies.length === 0) return null;
            
            const colorMap = {
              amber: { bg: 'from-amber-500/20 to-orange-600/20', border: 'border-amber-500/40', text: 'text-amber-500', glow: 'shadow-amber-500/40' },
              yellow: { bg: 'from-yellow-500/20 to-amber-600/20', border: 'border-yellow-500/40', text: 'text-yellow-500', glow: 'shadow-yellow-500/40' },
              orange: { bg: 'from-orange-500/20 to-red-600/20', border: 'border-orange-500/40', text: 'text-orange-500', glow: 'shadow-orange-500/40' },
              red: { bg: 'from-red-500/20 to-rose-600/20', border: 'border-red-500/40', text: 'text-red-500', glow: 'shadow-red-500/40' },
              pink: { bg: 'from-pink-500/20 to-rose-600/20', border: 'border-pink-500/40', text: 'text-pink-500', glow: 'shadow-pink-500/40' },
              purple: { bg: 'from-purple-500/20 to-pink-600/20', border: 'border-purple-500/40', text: 'text-purple-500', glow: 'shadow-purple-500/40' },
              blue: { bg: 'from-blue-500/20 to-indigo-600/20', border: 'border-blue-500/40', text: 'text-blue-500', glow: 'shadow-blue-500/40' },
              cyan: { bg: 'from-cyan-500/20 to-blue-600/20', border: 'border-cyan-500/40', text: 'text-cyan-500', glow: 'shadow-cyan-500/40' },
              green: { bg: 'from-green-500/20 to-emerald-600/20', border: 'border-green-500/40', text: 'text-green-500', glow: 'shadow-green-500/40' },
              emerald: { bg: 'from-emerald-500/20 to-teal-600/20', border: 'border-emerald-500/40', text: 'text-emerald-500', glow: 'shadow-emerald-500/40' },
              gray: { bg: 'from-gray-500/20 to-slate-600/20', border: 'border-gray-500/40', text: 'text-gray-500', glow: 'shadow-gray-500/40' }
            };
            
            return (
              <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-${accentColor}-500/20 p-4 sm:p-6 mb-4 sm:mb-6`}>
                <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-5 flex items-center space-x-2">
                  <Trophy className="w-4 sm:w-5 h-4 sm:h-5" style={{ color: squad.color }} />
                  <span>{t.trophies}</span>
                </h2>
                
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-4">
                  {allTrophies.map((trophy) => {
                    const colors = colorMap[trophy.color] || colorMap.amber;
                    const IconComponent = { Trophy, Award, Medal, Crown, Shield, Target }[trophy.icon] || Trophy;
                    const trophyName = trophy.translations?.[language]?.name || trophy.name;
                    const trophyDesc = trophy.translations?.[language]?.description || trophy.description;
                    const isEarned = squadTrophyIds.includes(trophy._id);
                    
                    return (
                      <div key={trophy._id} className="group relative flex flex-col items-center">
                        {/* Trophy icon */}
                        <div 
                          className={`relative w-12 sm:w-16 h-12 sm:h-16 rounded-lg sm:rounded-xl bg-gradient-to-br ${colors.bg} ${colors.border} border-2 flex items-center justify-center cursor-pointer transition-all duration-300 ${
                            isEarned 
                              ? `shadow-lg ${colors.glow} hover:scale-110` 
                              : 'opacity-40 grayscale hover:opacity-60 hover:grayscale-[50%]'
                          }`}
                        >
                          <IconComponent className={`w-6 sm:w-8 h-6 sm:h-8 ${colors.text}`} />
                          {isEarned && (
                            <div className="absolute -top-0.5 sm:-top-1 -right-0.5 sm:-right-1 w-4 sm:w-5 h-4 sm:h-5 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                              <Check className="w-2.5 sm:w-3 h-2.5 sm:h-3 text-white" />
                            </div>
                          )}
                        </div>
                        
                        {/* Trophy name below icon */}
                        <p className={`mt-1 sm:mt-2 text-[10px] sm:text-xs font-medium text-center line-clamp-2 ${isEarned ? 'text-white' : 'text-gray-500'}`}>
                          {trophyName}
                        </p>
                        
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-3 bg-dark-800 border border-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 min-w-[180px] shadow-xl">
                          <div className="flex items-center gap-2 mb-1">
                            <IconComponent className={`w-4 h-4 ${colors.text}`} />
                            <p className="text-white font-bold text-sm">{trophyName}</p>
                          </div>
                          <p className="text-gray-400 text-xs">{trophyDesc}</p>
                          {isEarned ? (
                            <div className="mt-2 flex items-center gap-1 text-green-400 text-xs font-medium">
                              <Check className="w-3 h-3" />
                              {language === 'fr' ? 'Obtenu' : language === 'de' ? 'Erhalten' : language === 'it' ? 'Ottenuto' : 'Earned'}
                            </div>
                          ) : (
                            <div className="mt-2 text-gray-500 text-xs">
                              {language === 'fr' ? 'Non obtenu' : language === 'de' ? 'Nicht erhalten' : language === 'it' ? 'Non ottenuto' : 'Not earned'}
                            </div>
                          )}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-dark-800"></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}



          {/* Stricker Rank Display */}
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
              <div className="bg-gradient-to-r from-lime-500/10 via-green-500/10 to-emerald-500/10 backdrop-blur-xl rounded-2xl border border-lime-500/30 overflow-hidden mb-4 sm:mb-6">
                <div className="relative p-6">
                  {/* Background glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-lime-500/5 to-emerald-500/5"></div>
                  
                  {/* Content */}
                  <div className="relative flex items-center justify-between gap-6">
                    {/* Left: Rank Icon */}
                    <div className="flex items-center gap-4">
                      <div className="relative group">
                        <div className="absolute inset-0 bg-lime-400/20 blur-2xl rounded-full group-hover:bg-lime-400/30 transition-all"></div>
                        <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-xl bg-gradient-to-br from-lime-900/50 to-green-900/50 border-2 border-lime-500/30 flex items-center justify-center overflow-hidden shadow-lg">
                          <img 
                            src={rankImage} 
                            alt={rankName}
                            className="w-20 h-20 sm:w-28 sm:h-28 object-contain drop-shadow-[0_0_12px_rgba(126,211,33,0.6)]"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.parentElement.innerHTML = '<svg className="w-8 h-8 text-lime-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/></svg>';
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Rank info */}
                      <div>
                        <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">
                          {language === 'fr' ? 'Rang Stricker' : language === 'de' ? 'Stricker-Rang' : language === 'it' ? 'Grado Stricker' : 'Stricker Rank'}
                        </p>
                        <h3 className="text-lime-400 font-black text-xl sm:text-2xl tracking-tight drop-shadow-[0_0_10px_rgba(126,211,33,0.3)]">
                          {rankName}
                        </h3>
                      </div>
                    </div>
                    
                    {/* Right: Stricker Stats */}
                    <div className="flex items-center gap-3 sm:gap-6">
                      <div className="text-center">
                        <p className="text-lg sm:text-xl font-bold text-lime-400">{squad.statsStricker?.points || 0}</p>
                        <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">{language === 'fr' ? 'Points' : 'Points'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg sm:text-xl font-bold text-green-400">{squad.statsStricker?.wins || 0}</p>
                        <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">{language === 'fr' ? 'Victoires' : 'Wins'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg sm:text-xl font-bold text-red-400">{squad.statsStricker?.losses || 0}</p>
                        <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">{language === 'fr' ? 'Défaites' : 'Losses'}</p>
                      </div>
                      <div className="text-center pl-3 sm:pl-6 border-l border-lime-500/20">
                        <p className="text-lg sm:text-xl font-bold text-yellow-400">{(() => { const w = squad.statsStricker?.wins || 0; const l = squad.statsStricker?.losses || 0; const total = w + l; return total === 0 ? '0%' : `${Math.round((w / total) * 100)}%`; })()}</p>
                        <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">{t.winRate}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Members */}
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-${accentColor}-500/20 p-4 sm:p-6`}>
            <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center space-x-2">
              <Users className="w-4 sm:w-5 h-4 sm:h-5" style={{ color: squad.color }} />
              <span>{t.members} ({squad.members?.length || 0})</span>
            </h2>
            
            {squad.members && squad.members.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                {squad.members.map((member, index) => (
                  <Link 
                    key={member.user?._id || index} 
                    to={`/player/${member.user?._id}`}
                    className={`flex items-center justify-between p-3 sm:p-4 bg-dark-800/50 rounded-lg border border-white/5 hover:border-${accentColor}-500/30 transition-colors`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <img 
                        src={getMemberAvatar(member)}
                        alt={member.user?.username}
                        className="w-10 sm:w-12 h-10 sm:h-12 rounded-full flex-shrink-0"
                        onError={(e) => { e.target.src = getDefaultAvatar(member.user?.username); }}
                      />
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="text-white font-semibold text-sm sm:text-base truncate">{member.user?.username || member.user?.discordUsername || 'Unknown'}</span>
                          {getRoleBadge(member.role)}
                    </div>
                        <p className="text-gray-500 text-[10px] sm:text-xs">
                          {t.joinedAt} {new Date(member.joinedAt).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}
                        </p>
                    </div>
                  </div>
                </Link>
              ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">{t.noMembers}</p>
              </div>
            )}
          </div>
          
          {/* Stricker Match History */}
          <div className="bg-dark-900/80 backdrop-blur-xl rounded-xl border border-lime-500/20 p-4 sm:p-6 mt-4 sm:mt-6">
            <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center space-x-2">
              <Swords className="w-4 sm:w-5 h-4 sm:h-5 text-lime-400" />
              <span>{t.matchHistory}</span>
            </h2>
            
            {loadingHistory ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-lime-400" />
              </div>
            ) : matchHistory.length > 0 ? (
              <div className="space-y-3">
                {matchHistory.map((match) => {
                  const isWinner = match.isWinner;
                  const opponentSquad = match.opponentSquad;
                  const opponentName = opponentSquad?.name || t.deletedTeam;
                  const opponentId = opponentSquad?._id;
                  
                  // Build score display
                  const myScore = match.squadTeam === 1 ? (match.team1Score || 0) : (match.team2Score || 0);
                  const opponentScore = match.squadTeam === 1 ? (match.team2Score || 0) : (match.team1Score || 0);
                  
                  return (
                    <div 
                      key={match._id}
                      className={`p-3 sm:p-4 bg-dark-800/50 rounded-lg border ${
                        isWinner 
                          ? 'border-green-500/30' 
                          : 'border-red-500/30'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        {/* Top row: Result + Score */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Result badge */}
                          <div className={`px-2 py-1 rounded text-xs font-bold ${
                            isWinner 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {isWinner ? t.victory : t.defeat}
                          </div>
                          
                          {/* Stricker badge */}
                          <span className="px-2 py-1 bg-lime-500/20 rounded text-xs font-medium text-lime-400">
                            STRICKER
                          </span>
                          
                          {/* Format */}
                          <div className="flex items-center gap-1 text-gray-400 text-xs sm:text-sm">
                            <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span>5v5</span>
                          </div>
                        </div>
                        
                        {/* Opponent */}
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-sm">{t.vs}</span>
                          {opponentSquad?.logo && (
                            <img 
                              src={opponentSquad.logo} 
                              alt={opponentSquad.tag}
                              className="w-5 h-5 object-contain rounded"
                              onError={(e) => e.target.style.display = 'none'}
                            />
                          )}
                          {opponentId ? (
                            <Link 
                              to={`/squad/${opponentId}`}
                              className="text-white hover:text-lime-400 transition-colors font-medium text-sm truncate max-w-[150px] sm:max-w-none"
                            >
                              [{opponentSquad?.tag || '?'}] {opponentName}
                            </Link>
                          ) : (
                            <span className="text-gray-400 italic text-sm truncate max-w-[150px] sm:max-w-none">{opponentName}</span>
                          )}
                        </div>
                        
                        {/* Bottom row: Date + Buttons */}
                        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
                          <div className="flex items-center gap-1.5 text-gray-500 text-xs sm:text-sm">
                            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span>
                              {new Date(match.completedAt || match.createdAt).toLocaleDateString(
                                language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : language === 'it' ? 'it-IT' : 'en-US',
                                { day: 'numeric', month: 'short' }
                              )}
                            </span>
                          </div>

                          {/* View Details Button */}
                          <button
                            onClick={() => {
                              setSelectedMatch(match);
                              setShowMatchDetails(true);
                            }}
                            className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium bg-lime-500/20 text-lime-400 hover:bg-lime-500/30 transition-colors flex items-center gap-1.5"
                          >
                            <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span className="hidden sm:inline">{t.viewDetails}</span>
                            <span className="sm:hidden">{language === 'fr' ? 'Voir' : 'View'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Swords className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">{t.noMatches}</p>
              </div>
            )}
            
            {/* Pagination */}
            {matchHistoryTotal > 0 && matchHistoryTotalPages > 1 && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
                <div className="text-sm text-gray-500">
                  {matchHistoryTotal} {t.totalMatches}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMatchHistoryPage(prev => Math.max(1, prev - 1))}
                    disabled={matchHistoryPage === 1 || loadingHistory}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      matchHistoryPage === 1 
                        ? 'bg-dark-800/50 text-gray-500' 
                        : `bg-${accentColor}-500/20 text-${accentColor}-400 hover:bg-${accentColor}-500/30`
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">{t.previous}</span>
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {/* Show page numbers */}
                    {(() => {
                      const pages = [];
                      const start = Math.max(1, matchHistoryPage - 2);
                      const end = Math.min(matchHistoryTotalPages, matchHistoryPage + 2);
                      
                      if (start > 1) {
                        pages.push(
                          <button
                            key={1}
                            onClick={() => setMatchHistoryPage(1)}
                            className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                              matchHistoryPage === 1 
                                ? `bg-${accentColor}-500 text-white` 
                                : 'bg-dark-800/50 text-gray-400 hover:bg-dark-700/50'
                            }`}
                          >
                            1
                          </button>
                        );
                        if (start > 2) {
                          pages.push(<span key="dots1" className="text-gray-500 px-1">...</span>);
                        }
                      }
                      
                      for (let i = start; i <= end; i++) {
                        pages.push(
                          <button
                            key={i}
                            onClick={() => setMatchHistoryPage(i)}
                            className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                              matchHistoryPage === i 
                                ? `bg-${accentColor}-500 text-white` 
                                : 'bg-dark-800/50 text-gray-400 hover:bg-dark-700/50'
                            }`}
                          >
                            {i}
                          </button>
                        );
                      }
                      
                      if (end < matchHistoryTotalPages) {
                        if (end < matchHistoryTotalPages - 1) {
                          pages.push(<span key="dots2" className="text-gray-500 px-1">...</span>);
                        }
                        pages.push(
                          <button
                            key={matchHistoryTotalPages}
                            onClick={() => setMatchHistoryPage(matchHistoryTotalPages)}
                            className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                              matchHistoryPage === matchHistoryTotalPages 
                                ? `bg-${accentColor}-500 text-white` 
                                : 'bg-dark-800/50 text-gray-400 hover:bg-dark-700/50'
                            }`}
                          >
                            {matchHistoryTotalPages}
                          </button>
                        );
                      }
                      
                      return pages;
                    })()}
                  </div>
                  
                  <button
                    onClick={() => setMatchHistoryPage(prev => Math.min(matchHistoryTotalPages, prev + 1))}
                    disabled={matchHistoryPage === matchHistoryTotalPages || loadingHistory}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      matchHistoryPage === matchHistoryTotalPages 
                        ? 'bg-dark-800/50 text-gray-500' 
                        : `bg-${accentColor}-500/20 text-${accentColor}-400 hover:bg-${accentColor}-500/30`
                    }`}
                  >
                    <span className="hidden sm:inline">{t.next}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Join Request Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`bg-dark-900 rounded-2xl border border-${accentColor}-500/30 p-6 max-w-md w-full`}>
            {joinSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{t.joinRequestSent}</h3>
                <p className="text-gray-400 text-sm">
                  {language === 'fr' ? 'Le leader sera notifié de votre demande.' : 'The leader will be notified of your request.'}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center border border-white/10"
                      style={{ backgroundColor: squad.color === 'transparent' ? 'transparent' : squad.color + '30' }}
                    >
                      <UserPlus className="w-6 h-6" style={{ color: squad.color === 'transparent' ? '#9ca3af' : squad.color }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{t.joinSquad}</h3>
                      <p className="text-gray-500 text-sm">{squad.name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowJoinModal(false)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                  </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t.joinRequestMessage}
                  </label>
                  <textarea
                    value={joinMessage}
                    onChange={(e) => setJoinMessage(e.target.value)}
                    placeholder={t.joinRequestPlaceholder}
                    maxLength={200}
                    rows={3}
                    className={`w-full px-4 py-3 bg-dark-800/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-${accentColor}-500/50 transition-all resize-none`}
                  />
                  <p className="text-gray-500 text-xs mt-1">{joinMessage.length}/200</p>
                </div>

                {joinError && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <p className="text-red-400 text-sm">{joinError}</p>
            </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowJoinModal(false)}
                    className="flex-1 py-3 px-4 bg-dark-800 hover:bg-dark-700 border border-white/10 text-white font-medium rounded-xl transition-colors"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={handleJoinRequest}
                    disabled={joinLoading}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r ${gradientFrom} ${gradientTo} hover:opacity-90 disabled:opacity-50 text-white font-medium rounded-xl transition-all`}
                  >
                    {joinLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        {t.sendRequest}
                      </>
                    )}
                  </button>
          </div>
              </>
            )}
        </div>
      </div>
      )}

      {/* Match Details Dialog */}
      {showMatchDetails && selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto overscroll-contain" onClick={(e) => { if (e.target === e.currentTarget) { setShowMatchDetails(false); setSelectedMatch(null); } }}>
          <div className="relative w-full max-w-4xl bg-dark-900 border border-lime-500/20 rounded-xl sm:rounded-2xl shadow-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col my-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-lime-500/20 bg-gradient-to-r from-lime-600/20 via-green-600/10 to-dark-900">
              <div className="flex items-center justify-between">
                <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
                  <Swords className="w-5 sm:w-6 h-5 sm:h-6 text-lime-400" />
                  {t.matchDetails}
                  <span className="px-2 py-1 bg-lime-500/20 rounded text-xs font-medium text-lime-400">STRICKER</span>
                </h2>
                <button 
                  onClick={() => {
                    setShowMatchDetails(false);
                    setSelectedMatch(null);
                  }}
                  className="p-1.5 sm:p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              
              {/* Match Info */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3 sm:mt-4">
                <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-white/20 rounded-lg text-xs sm:text-sm font-medium text-white">
                  Search & Destroy
                </span>
                <div className="flex items-center gap-1.5 sm:gap-2 text-white/80 text-xs sm:text-sm">
                  <Users className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  <span>5v5</span>
                </div>
                {/* Score */}
                <div className="flex items-center gap-2 text-white font-bold">
                  <span className={selectedMatch.winner === 1 ? 'text-green-400' : 'text-red-400'}>
                    {selectedMatch.team1Score || 0}
                  </span>
                  <span className="text-gray-500">-</span>
                  <span className={selectedMatch.winner === 2 ? 'text-green-400' : 'text-red-400'}>
                    {selectedMatch.team2Score || 0}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 text-white/80 text-xs sm:text-sm">
                  <Clock className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  <span>
                    {new Date(selectedMatch.completedAt || selectedMatch.createdAt).toLocaleDateString(
                      language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : language === 'it' ? 'it-IT' : 'en-US',
                      { day: 'numeric', month: 'short', year: 'numeric' }
                    )}
                  </span>
                </div>
                {/* Selected Map */}
                {selectedMatch.selectedMap?.name && (
                  <span className="px-2 py-1 bg-lime-500/10 border border-lime-500/20 rounded text-xs text-lime-400">
                    {selectedMatch.selectedMap.name}
                  </span>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
                {/* Team 1 */}
                <div className={`p-3 sm:p-5 rounded-xl border-2 ${
                  selectedMatch.winner === 1
                    ? 'bg-green-500/10 border-green-500/50' 
                    : 'bg-red-500/10 border-red-500/50'
                }`}>
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="flex items-center gap-2">
                      {selectedMatch.team1Squad?.logo && (
                        <img src={selectedMatch.team1Squad.logo} alt="" className="w-8 h-8 object-contain" />
                      )}
                      <h3 className="text-base sm:text-lg font-bold text-white truncate">
                        [{selectedMatch.team1Squad?.tag || 'T1'}] {selectedMatch.team1Squad?.name || 'Team 1'}
                      </h3>
                    </div>
                    {selectedMatch.winner === 1 ? (
                      <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5" />
                        {t.winner}
                      </div>
                    ) : (
                      <div className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-bold">
                        {t.loser}
                      </div>
                    )}
                  </div>
                  
                  {/* Roster */}
                  <div>
                    <p className="text-xs uppercase tracking-wider text-gray-500 mb-3 font-bold">{t.roster}</p>
                    <div className="space-y-2">
                      {selectedMatch.players?.filter(p => p.team === 1).map((p, idx) => {
                        const displayName = p.user?.username || p.username || t.deletedPlayer;
                        const isDeleted = !p.user;
                        let playerAvatar = getAvatarUrl(p.user?.avatarUrl || p.user?.avatar);
                        if (!playerAvatar && p.user?.discordId && p.user?.discordAvatar) {
                          playerAvatar = `https://cdn.discordapp.com/avatars/${p.user.discordId}/${p.user.discordAvatar}.png`;
                        }
                        if (!playerAvatar) playerAvatar = getDefaultAvatar(displayName);
                        
                        return (
                          <div key={idx} className={`flex items-center gap-3 p-2.5 rounded-lg ${p.isReferent ? 'bg-lime-500/10 border border-lime-500/20' : 'bg-dark-800/50'}`}>
                            <img src={playerAvatar} alt="" className="w-8 h-8 rounded-full" />
                            <div className="flex-1 min-w-0">
                              {isDeleted ? (
                                <span className="text-gray-400 font-medium text-sm truncate block italic">{displayName}</span>
                              ) : (
                                <Link to={`/player/${p.user?._id}`} className="text-white hover:text-lime-400 transition-colors font-medium text-sm truncate block">
                                  {displayName}
                                </Link>
                              )}
                              {p.isReferent && (
                                <span className="text-lime-400 text-xs">{language === 'fr' ? 'Référent' : 'Referent'}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Team 2 */}
                <div className={`p-3 sm:p-5 rounded-xl border-2 ${
                  selectedMatch.winner === 2
                    ? 'bg-green-500/10 border-green-500/50' 
                    : 'bg-red-500/10 border-red-500/50'
                }`}>
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="flex items-center gap-2">
                      {selectedMatch.team2Squad?.logo && (
                        <img src={selectedMatch.team2Squad.logo} alt="" className="w-8 h-8 object-contain" />
                      )}
                      <h3 className="text-base sm:text-lg font-bold text-white truncate">
                        [{selectedMatch.team2Squad?.tag || 'T2'}] {selectedMatch.team2Squad?.name || 'Team 2'}
                      </h3>
                    </div>
                    {selectedMatch.winner === 2 ? (
                      <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5" />
                        {t.winner}
                      </div>
                    ) : (
                      <div className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-bold">
                        {t.loser}
                      </div>
                    )}
                  </div>
                  
                  {/* Roster */}
                  <div>
                    <p className="text-xs uppercase tracking-wider text-gray-500 mb-3 font-bold">{t.roster}</p>
                    <div className="space-y-2">
                      {selectedMatch.players?.filter(p => p.team === 2).map((p, idx) => {
                        const displayName = p.user?.username || p.username || t.deletedPlayer;
                        const isDeleted = !p.user;
                        let playerAvatar = getAvatarUrl(p.user?.avatarUrl || p.user?.avatar);
                        if (!playerAvatar && p.user?.discordId && p.user?.discordAvatar) {
                          playerAvatar = `https://cdn.discordapp.com/avatars/${p.user.discordId}/${p.user.discordAvatar}.png`;
                        }
                        if (!playerAvatar) playerAvatar = getDefaultAvatar(displayName);
                        
                        return (
                          <div key={idx} className={`flex items-center gap-3 p-2.5 rounded-lg ${p.isReferent ? 'bg-lime-500/10 border border-lime-500/20' : 'bg-dark-800/50'}`}>
                            <img src={playerAvatar} alt="" className="w-8 h-8 rounded-full" />
                            <div className="flex-1 min-w-0">
                              {isDeleted ? (
                                <span className="text-gray-400 font-medium text-sm truncate block italic">{displayName}</span>
                              ) : (
                                <Link to={`/player/${p.user?._id}`} className="text-white hover:text-lime-400 transition-colors font-medium text-sm truncate block">
                                  {displayName}
                                </Link>
                              )}
                              {p.isReferent && (
                                <span className="text-lime-400 text-xs">{language === 'fr' ? 'Référent' : 'Referent'}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SquadProfile;
