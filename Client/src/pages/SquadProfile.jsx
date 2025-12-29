import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { getDefaultAvatar, getAvatarUrl } from '../utils/avatar';
import { 
  ArrowLeft, Trophy, Medal, Shield, Users, Calendar, Crown, Loader2, 
  AlertCircle, TrendingUp, Target, UserPlus, Lock, Check, X, Send, Award,
  Swords, Clock, Play, Star
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

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
      matchHistory: 'Historique des matchs',
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
      matchHistory: 'Match History',
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
      matchHistory: 'Spielverlauf',
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
      matchHistory: 'Cronologia partite',
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

  // Fetch match history
  useEffect(() => {
    const fetchMatchHistory = async () => {
      if (!squadId) return;
      setLoadingHistory(true);
      try {
        const response = await fetch(`${API_URL}/matches/history/${squadId}?limit=10`);
        const data = await response.json();
        if (data.success) {
          setMatchHistory(data.matches);
        }
      } catch (err) {
        console.error('Error fetching match history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchMatchHistory();
  }, [squadId]);

  // Calculate win rate
  const getWinRate = () => {
    if (!squad?.stats) return '0%';
    const total = (squad.stats.totalWins || 0) + (squad.stats.totalLosses || 0);
    if (total === 0) return '0%';
    return `${Math.round((squad.stats.totalWins / total) * 100)}%`;
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
                  src={squad.banner.startsWith('/uploads') ? `https://api-nomercy.ggsecure.io${squad.banner}` : squad.banner}
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
                  <div className="absolute inset-0 blur-2xl rounded-full" style={{ backgroundColor: squad.color + '40' }}></div>
                  <div 
                    className="relative w-24 h-24 rounded-full flex items-center justify-center shadow-lg border-4 overflow-hidden"
                    style={{ 
                      backgroundColor: squad.color + '30', 
                      borderColor: squad.color,
                      boxShadow: `0 0 30px ${squad.color}50`
                    }}
                  >
                    {squad.logo ? (
                      <img src={squad.logo} alt={squad.name} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-12 h-12" style={{ color: squad.color }} />
                    )}
                  </div>
                </div>
                <div className="text-center md:text-left">
                  <div className="flex items-center gap-3 justify-center md:justify-start flex-wrap">
                    <h1 className="text-3xl font-bold text-white">{squad.name}</h1>
                    <span className="text-gray-500 text-xl">[{squad.tag}]</span>
                    
                    {/* Level Badge */}
                    {squad.level !== undefined && (
                      <div className={`relative group cursor-default ${
                        squad.level >= 90 ? 'animate-pulse' : ''
                      }`}>
                        <div className={`px-3 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1.5 ${
                          squad.level >= 100 ? 'bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500 text-dark-950 shadow-lg shadow-yellow-500/50' :
                          squad.level >= 75 ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30' :
                          squad.level >= 50 ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30' :
                          squad.level >= 25 ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30' :
                          'bg-gradient-to-r from-gray-600 to-gray-700 text-white'
                        }`}>
                          <Star className={`w-4 h-4 ${squad.level >= 100 ? 'text-dark-950' : 'text-white'}`} />
                          <span>Lv.{squad.level}</span>
                        </div>
                        
                        {/* Tooltip with XP progress */}
                        {squad.levelProgress && squad.level < 100 && (
                          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                            <div className="bg-dark-900 border border-white/20 rounded-lg p-3 shadow-xl min-w-[160px]">
                              <p className="text-white text-xs font-medium text-center mb-2">
                                {squad.levelProgress.current} / {squad.levelProgress.required} XP
                              </p>
                              <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                                  style={{ width: `${squad.levelProgress.percentage}%` }}
                                />
                              </div>
                              <p className="text-gray-400 text-[10px] text-center mt-1">
                                {squad.levelProgress.percentage}% → Lv.{squad.level + 1}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {squad.description && (
                    <p className="text-gray-400 mt-2 max-w-md">{squad.description}</p>
                  )}
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-3 text-sm">
                    <span className={`px-3 py-1.5 rounded-lg font-medium`} style={{ backgroundColor: squad.color + '20', color: squad.color, border: `1px solid ${squad.color}50` }}>
                      {squad.stats?.totalPoints || 0} pts
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
              
              // Combine and sort by rarity (highest first)
              const allTrophies = [...squadEarnedTrophies, ...defaultTrophiesToShow]
                .sort((a, b) => (b.rarity || 1) - (a.rarity || 1));
              
              if (allTrophies.length === 0) return null;
              
              const colorMap = {
                amber: { bg: 'from-amber-500/20 to-orange-600/20', border: 'border-amber-500/30', text: 'text-amber-500', shadow: 'hover:shadow-amber-500/30' },
                yellow: { bg: 'from-yellow-500/20 to-amber-600/20', border: 'border-yellow-500/30', text: 'text-yellow-500', shadow: 'hover:shadow-yellow-500/30' },
                orange: { bg: 'from-orange-500/20 to-red-600/20', border: 'border-orange-500/30', text: 'text-orange-500', shadow: 'hover:shadow-orange-500/30' },
                red: { bg: 'from-red-500/20 to-rose-600/20', border: 'border-red-500/30', text: 'text-red-500', shadow: 'hover:shadow-red-500/30' },
                pink: { bg: 'from-pink-500/20 to-rose-600/20', border: 'border-pink-500/30', text: 'text-pink-500', shadow: 'hover:shadow-pink-500/30' },
                purple: { bg: 'from-purple-500/20 to-pink-600/20', border: 'border-purple-500/30', text: 'text-purple-500', shadow: 'hover:shadow-purple-500/30' },
                blue: { bg: 'from-blue-500/20 to-indigo-600/20', border: 'border-blue-500/30', text: 'text-blue-500', shadow: 'hover:shadow-blue-500/30' },
                cyan: { bg: 'from-cyan-500/20 to-blue-600/20', border: 'border-cyan-500/30', text: 'text-cyan-500', shadow: 'hover:shadow-cyan-500/30' },
                green: { bg: 'from-green-500/20 to-emerald-600/20', border: 'border-green-500/30', text: 'text-green-500', shadow: 'hover:shadow-green-500/30' },
                emerald: { bg: 'from-emerald-500/20 to-teal-600/20', border: 'border-emerald-500/30', text: 'text-emerald-500', shadow: 'hover:shadow-emerald-500/30' },
                gray: { bg: 'from-gray-500/20 to-slate-600/20', border: 'border-gray-500/30', text: 'text-gray-500', shadow: 'hover:shadow-gray-500/30' }
              };
              
              return (
                <div className="mt-6 pt-6 border-t border-white/10">
                  <div className="flex items-center justify-center gap-4 flex-wrap">
                    {allTrophies.map((trophy) => {
                      const colors = colorMap[trophy.color] || colorMap.amber;
                      const IconComponent = { Trophy, Award, Medal, Crown, Shield, Target }[trophy.icon] || Trophy;
                      const trophyName = trophy.translations?.[language]?.name || trophy.name;
                      const trophyDesc = trophy.translations?.[language]?.description || trophy.description;
                      const isEarned = squadTrophyIds.includes(trophy._id);
                      
                      return (
                        <div key={trophy._id} className="group relative">
                          <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${colors.bg} ${colors.border} border flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-lg ${colors.shadow} ${isEarned ? 'ring-2 ring-offset-2 ring-offset-dark-900' : ''}`} style={isEarned ? { ringColor: trophy.color === 'amber' ? '#f59e0b' : undefined } : {}}>
                            <IconComponent className={`w-7 h-7 ${colors.text}`} />
                          </div>
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-dark-800 border border-white/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                            <p className="text-white font-semibold text-sm">{trophyName}</p>
                            <p className="text-gray-400 text-xs">{trophyDesc}</p>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-dark-800"></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

          {/* Stats */}
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-${accentColor}-500/20 p-6 text-center`}>
              <Trophy className={`w-6 h-6 text-${accentColor}-400 mx-auto mb-2`} />
              <div className="text-3xl font-bold" style={{ color: squad.color }}>{squad.stats?.totalPoints || 0}</div>
              <div className="text-gray-400 text-sm">{t.points}</div>
            </div>
            <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-${accentColor}-500/20 p-6 text-center`}>
              <Medal className="w-6 h-6 text-green-400 mx-auto mb-2" />
              <div className="text-3xl font-bold text-green-400">{squad.stats?.totalWins || 0}</div>
              <div className="text-gray-400 text-sm">{t.wins}</div>
            </div>
            <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-${accentColor}-500/20 p-6 text-center`}>
              <Target className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <div className="text-3xl font-bold text-red-400">{squad.stats?.totalLosses || 0}</div>
              <div className="text-gray-400 text-sm">{t.losses}</div>
            </div>
            <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-${accentColor}-500/20 p-6 text-center`}>
              <TrendingUp className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
              <div className="text-3xl font-bold text-yellow-400">{getWinRate()}</div>
              <div className="text-gray-400 text-sm">{t.winRate}</div>
            </div>
          </div>

          {/* Members */}
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-${accentColor}-500/20 p-6`}>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
              <Users className="w-5 h-5" style={{ color: squad.color }} />
              <span>{t.members} ({squad.members?.length || 0})</span>
            </h2>
            
            {squad.members && squad.members.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-4">
                {squad.members.map((member, index) => (
                  <Link 
                    key={member.user?._id || index} 
                    to={`/player/${encodeURIComponent(member.user?.username || 'Unknown')}`}
                    className={`flex items-center justify-between p-4 bg-dark-800/50 rounded-lg border border-white/5 hover:border-${accentColor}-500/30 transition-colors`}
                  >
                    <div className="flex items-center gap-3">
                      <img 
                        src={getMemberAvatar(member)}
                        alt={member.user?.username}
                        className={`w-12 h-12 rounded-full border-2 ${
                          member.role === 'leader' ? 'border-yellow-500' : 
                          member.role === 'officer' ? 'border-blue-500' : 
                          'border-white/20'
                        }`}
                        onError={(e) => { e.target.src = getDefaultAvatar(member.user?.username); }}
                      />
                    <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold">{member.user?.username || 'Unknown'}</span>
                          {getRoleBadge(member.role)}
                    </div>
                        <p className="text-gray-500 text-xs">
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
          
          {/* Match History */}
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-${accentColor}-500/20 p-6 mt-6`}>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
              <Swords className="w-5 h-5" style={{ color: squad.color }} />
              <span>{t.matchHistory}</span>
            </h2>
            
            {loadingHistory ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: squad.color }} />
              </div>
            ) : matchHistory.length > 0 ? (
              <div className="space-y-3">
                {matchHistory.map((match) => {
                  // Determine if current squad is the challenger or opponent
                  // Handle both populated objects and ObjectId strings
                  const challengerId = match.challenger?._id || match.challenger;
                  const isChallenger = challengerId === squadId || 
                    (challengerId?.toString?.() === squadId);
                  
                  const opponent = isChallenger 
                    ? (match.opponent || match.opponentInfo) 
                    : (match.challenger || match.challengerInfo);
                  const opponentInfo = isChallenger ? match.opponentInfo : match.challengerInfo;
                  // winner can be an object (populated) or string (ObjectId)
                  const winnerId = typeof match.result?.winner === 'object' 
                    ? match.result?.winner?._id 
                    : match.result?.winner;
                  const isWinner = winnerId === squadId;
                  const isCompleted = match.status === 'completed';
                  
                  // Get opponent name - use populated data or fallback to cached info
                  const opponentName = opponent?.name || opponentInfo?.name || t.deletedTeam;
                  const opponentId = opponent?._id;
                  
                  return (
                    <div 
                      key={match._id}
                      className={`p-3 sm:p-4 bg-dark-800/50 rounded-lg border ${
                        isCompleted 
                          ? isWinner 
                            ? 'border-green-500/30' 
                            : 'border-red-500/30'
                          : 'border-white/10'
                      }`}
                    >
                      {/* Mobile: Stack layout / Desktop: Row layout */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        {/* Top row on mobile: Result + Game mode + Format */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Result badge */}
                          {isCompleted && (
                            <div className={`px-2 py-1 rounded text-xs font-bold ${
                              isWinner 
                                ? 'bg-green-500/20 text-green-400' 
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {isWinner ? t.victory : t.defeat}
                            </div>
                          )}
                          
                          {/* Game mode */}
                          <span className={`px-2 py-1 bg-${accentColor}-500/20 rounded text-xs font-medium text-${accentColor}-400`}>
                            {t.gameModes?.[match.gameMode] || match.gameMode}
                          </span>
                          
                          {/* Format */}
                          <div className="flex items-center gap-1 text-gray-400 text-xs sm:text-sm">
                            <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span>{match.teamSize}v{match.teamSize}</span>
                          </div>
                        </div>
                        
                        {/* Opponent - separate row on mobile */}
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-sm">{t.vs}</span>
                          {opponentId ? (
                            <Link 
                              to={`/squad/${opponentId}`}
                              className="text-white hover:text-yellow-400 transition-colors font-medium text-sm truncate max-w-[150px] sm:max-w-none"
                            >
                              {opponentName}
                            </Link>
                          ) : (
                            <span className="text-gray-400 italic text-sm truncate max-w-[150px] sm:max-w-none">{opponentName}</span>
                          )}
                        </div>
                        
                        {/* Bottom row: Date + Button */}
                        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
                          {/* Date */}
                          <div className="flex items-center gap-1.5 text-gray-500 text-xs sm:text-sm">
                            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span>
                              {new Date(match.createdAt).toLocaleDateString(
                                language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : language === 'it' ? 'it-IT' : 'en-US',
                                { day: 'numeric', month: 'short' }
                              )}
                            </span>
                          </div>

                          {/* View Details Button */}
                          {isCompleted && (
                            <button
                              onClick={() => {
                                setSelectedMatch(match);
                                setShowMatchDetails(true);
                              }}
                              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium bg-${accentColor}-500/20 text-${accentColor}-400 hover:bg-${accentColor}-500/30 transition-colors flex items-center gap-1.5`}
                            >
                              <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              <span className="hidden sm:inline">{t.viewDetails}</span>
                              <span className="sm:hidden">{language === 'fr' ? 'Voir' : 'View'}</span>
                            </button>
                          )}
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
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: squad.color + '30' }}
                    >
                      <UserPlus className="w-6 h-6" style={{ color: squad.color }} />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl bg-dark-900 border border-white/10 rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className={`p-6 border-b border-white/10 bg-gradient-to-r ${gradientFrom} ${gradientTo}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Swords className="w-6 h-6" />
                  {t.matchDetails}
                </h2>
                <button 
                  onClick={() => {
                    setShowMatchDetails(false);
                    setSelectedMatch(null);
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              
              {/* Match Info */}
              <div className="flex items-center gap-4 mt-4">
                <span className={`px-3 py-1.5 bg-white/20 rounded-lg text-sm font-medium text-white`}>
                  {t.gameModes?.[selectedMatch.gameMode] || selectedMatch.gameMode}
                </span>
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <Users className="w-4 h-4" />
                  <span>{selectedMatch.teamSize}v{selectedMatch.teamSize}</span>
                </div>
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>
                    {new Date(selectedMatch.createdAt).toLocaleDateString(
                      language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : language === 'it' ? 'it-IT' : 'en-US',
                      { day: 'numeric', month: 'long', year: 'numeric' }
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid md:grid-cols-2 gap-6">
                {(() => {
                  const winnerId = typeof selectedMatch.result?.winner === 'object' 
                    ? selectedMatch.result?.winner?._id 
                    : selectedMatch.result?.winner;
                  const challengerIsWinner = winnerId === selectedMatch.challenger?._id;
                  const challengerName = selectedMatch.challenger?.name || selectedMatch.challengerInfo?.name || t.deletedTeam;
                  const opponentName = selectedMatch.opponent?.name || selectedMatch.opponentInfo?.name || t.deletedTeam;
                  
                  return (
                    <>
                      {/* Challenger Team */}
                      <div className={`p-5 rounded-xl border-2 ${
                        challengerIsWinner 
                          ? 'bg-green-500/10 border-green-500/50' 
                          : 'bg-red-500/10 border-red-500/50'
                      }`}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            {challengerName}
                          </h3>
                          {challengerIsWinner ? (
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
                            {selectedMatch.challengerRoster?.map((p, idx) => (
                              <div key={idx} className={`flex items-center gap-3 p-2.5 rounded-lg ${p.isHelper ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-dark-800/50'}`}>
                                <img 
                                  src={getAvatarUrl(p.user?.avatarUrl || p.user?.avatar) || getDefaultAvatar(p.user?.username)}
                                  alt=""
                                  className="w-8 h-8 rounded-full"
                                />
                                <div className="flex-1 min-w-0">
                                  <Link 
                                    to={`/player/${p.user?.username}`}
                                    className="text-white hover:text-yellow-400 transition-colors font-medium text-sm truncate block"
                                  >
                                    {p.user?.username}
                                  </Link>
                                  {p.isHelper && (
                                    <span className="text-yellow-400 text-xs">Helper</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Opponent Team */}
                      <div className={`p-5 rounded-xl border-2 ${
                        !challengerIsWinner 
                          ? 'bg-green-500/10 border-green-500/50' 
                          : 'bg-red-500/10 border-red-500/50'
                      }`}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            {opponentName}
                          </h3>
                          {!challengerIsWinner ? (
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
                            {selectedMatch.opponentRoster?.map((p, idx) => (
                              <div key={idx} className={`flex items-center gap-3 p-2.5 rounded-lg ${p.isHelper ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-dark-800/50'}`}>
                                <img 
                                  src={getAvatarUrl(p.user?.avatarUrl || p.user?.avatar) || getDefaultAvatar(p.user?.username)}
                                  alt=""
                                  className="w-8 h-8 rounded-full"
                                />
                                <div className="flex-1 min-w-0">
                                  <Link 
                                    to={`/player/${p.user?.username}`}
                                    className="text-white hover:text-yellow-400 transition-colors font-medium text-sm truncate block"
                                  >
                                    {p.user?.username}
                                  </Link>
                                  {p.isHelper && (
                                    <span className="text-yellow-400 text-xs">Helper</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SquadProfile;
