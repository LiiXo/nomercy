import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useAuth } from '../AuthContext';
import { useMode } from '../ModeContext';
import { useSocket } from '../SocketContext';
import { API_URL } from '../config';
import { 
  Trophy, Calendar, Users, Clock, Medal, Crown, Zap, ArrowLeft,
  MapPin, Radio, Play, CheckCircle, XCircle, Loader2,
  Swords, Target, User, UsersRound, ExternalLink, Coins, ChevronRight, ChevronDown,
  Shield, Star, Gift, Edit3, Save, X, Trash2, Bot, Sparkles, Eye, MessageCircle, Send
} from 'lucide-react';

const TournamentDetail = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { user, squad, hasAdminAccess } = useAuth();
  const { selectedMode } = useMode();
  const { joinTournament, leaveTournament, on, emit } = useSocket();
  
  const [tournament, setTournament] = useState(null);
  const [tournamentMatches, setTournamentMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState(null);
  const [showBracketIndicator, setShowBracketIndicator] = useState(false);
  const [showAllParticipants, setShowAllParticipants] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [tournamentMaps, setTournamentMaps] = useState([]);
  const bracketRef = useRef(null);
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fillingBots, setFillingBots] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    type: 'team',
    format: 'bo3',
    mode: 'hardcore',
    teamSize: 4,
    groupSize: 4,
    maxParticipants: 12,
    mapSelection: 'random',
    scheduledAt: '',
    streaming: { enabled: false, twitchUrl: '', streamerName: '', streamerAvatar: '' },
    prizes: {
      gold: { enabled: false, first: 0, second: 0, third: 0 },
      cashprize: { enabled: false, total: 0, currency: 'EUR', first: 0, second: 0, third: 0 }
    }
  });

  const canEdit = hasAdminAccess && hasAdminAccess() && tournament && ['registration', 'pending', 'draft'].includes(tournament.status);

  useEffect(() => {
    if (tournamentId) {
      fetchTournament();
      fetchTournamentMaps();
    }
  }, [tournamentId]);

  // Join tournament room for real-time updates and viewer count
  useEffect(() => {
    if (tournamentId) {
      joinTournament(tournamentId);
      
      // Listen for viewer count updates
      const unsubscribe = on('tournamentViewers', ({ tournamentId: tId, count }) => {
        if (tId === tournamentId) {
          setViewerCount(count);
        }
      });
      
      return () => {
        leaveTournament(tournamentId);
        unsubscribe();
      };
    }
  }, [tournamentId, joinTournament, leaveTournament, on]);

  // Show bracket indicator when bracket exists
  useEffect(() => {
    if (tournament?.bracket && tournament.bracket.length > 0) {
      setShowBracketIndicator(true);
      // Auto-hide after 8 seconds
      const timer = setTimeout(() => setShowBracketIndicator(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [tournament?.bracket]);

  const scrollToBracket = () => {
    bracketRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setShowBracketIndicator(false);
  };

  useEffect(() => {
    if (tournament) {
      // Pour les tournois solo, convertir le nombre de joueurs en nombre d'équipes
      let maxParticipantsForForm = tournament.maxParticipants || 12;
      if (tournament.type === 'solo' && tournament.teamSize) {
        maxParticipantsForForm = Math.round(tournament.maxParticipants / tournament.teamSize);
      }
      
      setEditForm({
        name: tournament.name || '',
        description: tournament.description || '',
        type: tournament.type || 'team',
        format: tournament.format || 'bo3',
        mode: tournament.mode || 'hardcore',
        teamSize: tournament.teamSize || 4,
        groupSize: tournament.groupSize || 4,
        maxParticipants: maxParticipantsForForm,
        mapSelection: tournament.mapSelection || 'random',
        scheduledAt: tournament.scheduledAt ? new Date(tournament.scheduledAt).toISOString().slice(0, 16) : '',
        streaming: {
          enabled: tournament.streaming?.enabled || false,
          twitchUrl: tournament.streaming?.twitchUrl || '',
          streamerName: tournament.streaming?.streamerName || '',
          streamerAvatar: tournament.streaming?.streamerAvatar || ''
        },
        prizes: {
          gold: {
            enabled: tournament.prizes?.gold?.enabled || false,
            first: tournament.prizes?.gold?.first || 0,
            second: tournament.prizes?.gold?.second || 0,
            third: tournament.prizes?.gold?.third || 0
          },
          cashprize: {
            enabled: tournament.prizes?.cashprize?.enabled || false,
            total: tournament.prizes?.cashprize?.total || 0,
            currency: tournament.prizes?.cashprize?.currency || 'EUR',
            first: tournament.prizes?.cashprize?.first || 0,
            second: tournament.prizes?.cashprize?.second || 0,
            third: tournament.prizes?.cashprize?.third || 0
          }
        }
      });
    }
  }, [tournament]);

  const handleSaveEdit = async () => {
    try {
      setSaving(true);
      
      // Préparer les données - convertir le nombre d'équipes en joueurs pour les tournois solo
      const dataToSend = { ...editForm };
      if (dataToSend.type === 'solo') {
        dataToSend.maxParticipants = dataToSend.maxParticipants * dataToSend.teamSize;
      }
      
      const response = await fetch(`${API_URL}/tournaments/admin/${tournamentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(dataToSend)
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }
      setIsEditing(false);
      await fetchTournament();
    } catch (error) {
      alert(error.message || 'Failed to update tournament');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTournament = async () => {
    if (!confirm(language === 'fr' ? 'Êtes-vous sûr de vouloir supprimer ce tournoi ?' : 'Are you sure you want to delete this tournament?')) {
      return;
    }
    try {
      const response = await fetch(`${API_URL}/tournaments/admin/${tournamentId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }
      navigate(-1);
    } catch (error) {
      alert(error.message || 'Failed to delete tournament');
    }
  };

  const handleFillWithBots = async () => {
    if (!confirm(language === 'fr' ? 'Remplir les places restantes avec des bots ?' : 'Fill remaining slots with bots?')) {
      return;
    }
    try {
      setFillingBots(true);
      const response = await fetch(`${API_URL}/tournaments/admin/${tournamentId}/fill-bots`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }
      await fetchTournament();
      alert(data.message || (language === 'fr' ? 'Bots ajoutés !' : 'Bots added!'));
    } catch (error) {
      alert(error.message || 'Failed to fill with bots');
    } finally {
      setFillingBots(false);
    }
  };

  const fetchTournament = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/tournaments/${tournamentId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success && data.tournament) {
        setTournament(data.tournament);
        
        // Also fetch tournament matches if tournament is in progress or completed
        if (['in_progress', 'completed'].includes(data.tournament.status)) {
          await fetchTournamentMatches();
        }
      } else {
        setError(language === 'fr' ? 'Tournoi non trouvé' : 'Tournament not found');
      }
    } catch (err) {
      console.error('Error fetching tournament:', err);
      setError(language === 'fr' ? 'Erreur lors du chargement' : 'Error loading tournament');
    } finally {
      setLoading(false);
    }
  };

  const fetchTournamentMatches = async () => {
    try {
      const response = await fetch(`${API_URL}/tournaments/${tournamentId}/matches`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        console.log('[TournamentDetail] Fetched matches:', data.matches?.length || 0);
        setTournamentMatches(data.matches || []);
      }
    } catch (err) {
      console.error('Error fetching tournament matches:', err);
    }
  };

  const fetchTournamentMaps = async () => {
    try {
      const response = await fetch(`${API_URL}/maps/tournament?mode=${tournament?.mode || 'hardcore'}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setTournamentMaps(data.maps || []);
      }
    } catch (err) {
      console.error('Error fetching tournament maps:', err);
    }
  };

  // Fetch maps when tournament mode is known
  useEffect(() => {
    if (tournament?.mode) {
      fetchTournamentMaps();
    }
  }, [tournament?.mode]);

  // Generate consistent random maps for all rounds (no duplicates across rounds)
  const getAllRoundMaps = () => {
    if (!tournamentMaps || tournamentMaps.length === 0) return {};
    if (!tournament || !tournament.bracket) return {};
    
    const mapCount = tournament.format === 'bo1' ? 1 : 3;
    const totalRounds = tournament.bracket.length;
    const totalMapsNeeded = mapCount * totalRounds;
    
    // Use seed based on tournament ID for consistency
    const seedString = `${tournamentId}-maps`;
    let seed = 0;
    for (let i = 0; i < seedString.length; i++) {
      seed = ((seed << 5) - seed) + seedString.charCodeAt(i);
      seed = seed & seed;
    }
    seed = Math.abs(seed);
    
    // Seeded random function
    const seededRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    
    // Shuffle all maps with seed
    const shuffled = [...tournamentMaps].sort(() => seededRandom() - 0.5);
    
    // If we don't have enough maps, we'll need to reuse some
    // But try to avoid duplicates as much as possible
    let availableMaps = [...shuffled];
    if (availableMaps.length < totalMapsNeeded) {
      // Duplicate the pool if needed
      while (availableMaps.length < totalMapsNeeded) {
        availableMaps = [...availableMaps, ...shuffled];
      }
    }
    
    // Assign maps to each round
    const roundMapsMap = {};
    let mapIndex = 0;
    
    for (let round = 1; round <= totalRounds; round++) {
      roundMapsMap[round] = availableMaps.slice(mapIndex, mapIndex + mapCount);
      mapIndex += mapCount;
    }
    
    return roundMapsMap;
  };
  
  // Memoize the round maps calculation
  const roundMapsData = React.useMemo(() => getAllRoundMaps(), [tournamentMaps, tournament?.bracket?.length, tournament?.format, tournamentId]);
  
  // Get maps for a specific round
  const getRoundMaps = (roundNumber) => {
    return roundMapsData[roundNumber] || [];
  };

  // Find the TournamentMatch document for a bracket match
  const findMatchDocument = (round, matchNumber) => {
    const match = tournamentMatches.find(
      m => Number(m.round) === Number(round) && Number(m.matchNumber) === Number(matchNumber)
    );
    return match;
  };

  const handleRegister = async () => {
    if (!user) {
      alert(language === 'fr' ? 'Vous devez être connecté pour vous inscrire' : 'You must be logged in to register');
      return;
    }
    
    try {
      setRegistering(true);
      const response = await fetch(`${API_URL}/tournaments/${tournamentId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ squadId: squad?._id })
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }
      await fetchTournament();
    } catch (error) {
      alert(error.message || 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  const handleUnregister = async () => {
    try {
      setRegistering(true);
      const response = await fetch(`${API_URL}/tournaments/${tournamentId}/unregister`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ squadId: squad?._id })
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }
      await fetchTournament();
    } catch (error) {
      alert(error.message || 'Unregistration failed');
    } finally {
      setRegistering(false);
    }
  };

  const isUserRegistered = () => {
    if (!user || !tournament) return false;
    const userId = user._id || user.id;
    const squadId = squad?._id || squad?.id;
    
    if (tournament.type === 'team') {
      if (!squadId) return false;
      return tournament.participants?.some(p => {
        const pSquadId = p.squad?._id || p.squad?.id || p.squad;
        return pSquadId && String(pSquadId) === String(squadId);
      });
    } else {
      return tournament.participants?.some(p => {
        const pUserId = p.user?._id || p.user?.id || p.user;
        return pUserId && String(pUserId) === String(userId);
      });
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'registration':
        return { color: 'bg-green-500/20 border-green-500/50 text-green-400', label: language === 'fr' ? 'INSCRIPTIONS OUVERTES' : 'REGISTRATION OPEN', icon: '🎮' };
      case 'in_progress':
        return { color: 'bg-red-500/20 border-red-500/50 text-red-400', label: 'LIVE', icon: '🔴', pulse: true };
      case 'completed':
        return { color: 'bg-gray-500/20 border-gray-500/50 text-gray-400', label: language === 'fr' ? 'TERMINÉ' : 'COMPLETED', icon: '✅' };
      case 'cancelled':
        return { color: 'bg-orange-500/20 border-orange-500/50 text-orange-400', label: language === 'fr' ? 'ANNULÉ' : 'CANCELLED', icon: '❌' };
      default:
        return { color: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400', label: status.toUpperCase(), icon: '📅' };
    }
  };

  const getModeColor = (mode) => {
    return mode === 'hardcore' 
      ? 'from-red-500 to-orange-500' 
      : 'from-cyan-500 to-blue-500';
  };

  const getModeAccent = (mode) => {
    return mode === 'hardcore' ? 'text-red-400' : 'text-cyan-400';
  };

  const getModeBorder = (mode) => {
    return mode === 'hardcore' ? 'border-red-500/30' : 'border-cyan-500/30';
  };

  // Extract Twitch username from URL
  const getTwitchUsername = (url) => {
    if (!url) return null;
    try {
      // Handle various Twitch URL formats
      // https://twitch.tv/username
      // https://www.twitch.tv/username
      // twitch.tv/username
      const cleanUrl = url.trim();
      const match = cleanUrl.match(/(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([a-zA-Z0-9_]+)/i);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  // Get Twitch avatar URL (using a proxy service that doesn't require auth)
  const getTwitchAvatarUrl = (username) => {
    if (!username) return null;
    // Use a placeholder with Twitch branding
    return `https://static-cdn.jtvnw.net/user-default-pictures-uv/cdd517fe-def4-11e9-948e-784f43822e80-profile_image-70x70.png`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
          <p className="text-gray-400">{language === 'fr' ? 'Chargement du tournoi...' : 'Loading tournament...'}</p>
        </div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">{error || (language === 'fr' ? 'Tournoi non trouvé' : 'Tournament not found')}</h2>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-6 py-3 bg-cyan-500 text-dark-950 rounded-lg font-semibold hover:bg-cyan-400 transition-colors"
          >
            {language === 'fr' ? 'Retour' : 'Go Back'}
          </button>
        </div>
      </div>
    );
  }

  const statusBadge = getStatusBadge(tournament.status);
  const registered = isUserRegistered();
  const participantCount = tournament.participants?.filter(p => !p.isBot).length || 0;
  const botCount = tournament.participants?.filter(p => p.isBot).length || 0;
  const mode = tournament.mode || 'hardcore';

  return (
    <div className="min-h-screen bg-dark-950 relative">
      {/* Background effects */}
      <div className="absolute inset-0 bg-mesh pointer-events-none"></div>
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-30"></div>
      
      {/* Hero Header */}
      <div className={`relative bg-gradient-to-br ${getModeColor(mode)} overflow-hidden`}>
        {/* Custom Banner Background */}
        {tournament.banner && (
          <>
            <div className="absolute inset-0">
              <img src={tournament.banner} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/80" />
          </>
        )}
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-transparent to-transparent" />
        
        {/* Decorative elements */}
        <div className="absolute top-10 right-10 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-48 h-48 bg-black/20 rounded-full blur-2xl" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-8 transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">{language === 'fr' ? 'Retour' : 'Back'}</span>
          </button>

          <div className="flex flex-col md:flex-row md:items-start gap-6">
            {/* Tournament Icon/Logo */}
            <div className="w-24 h-24 md:w-32 md:h-32 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 shadow-2xl overflow-hidden">
              {tournament.logo ? (
                <img src={tournament.logo} alt="" className="w-full h-full object-contain p-2" />
              ) : (
                <Trophy className="w-12 h-12 md:w-16 md:h-16 text-white" />
              )}
            </div>
            
            <div className="flex-1">
              {/* Status Badge */}
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${statusBadge.color} backdrop-blur-sm mb-4`}>
                {statusBadge.pulse && <div className="w-2 h-2 bg-current rounded-full animate-pulse" />}
                <span className="text-sm font-bold">{statusBadge.icon} {statusBadge.label}</span>
              </div>
              
              {/* Title */}
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">{tournament.name}</h1>
              
              {/* Description */}
              {tournament.description && (
                <p className="text-white/80 text-lg max-w-2xl mb-6">{tournament.description}</p>
              )}
              
              {/* Quick Info */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg">
                  <Calendar className="w-5 h-5 text-white/80" />
                  <span className="text-white font-medium">{formatDate(tournament.scheduledAt)}</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg">
                  <Clock className="w-5 h-5 text-white/80" />
                  <span className="text-white font-medium">{formatTime(tournament.scheduledAt)}</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg">
                  <span className="text-white font-bold uppercase">{mode}</span>
                </div>
                {/* Viewer Count */}
                {viewerCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-500/20 backdrop-blur-sm rounded-lg border border-green-500/30">
                    <Eye className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 font-semibold text-sm">{viewerCount}</span>
                  </div>
                )}
              </div>

              {/* Admin Actions */}
              {canEdit && (
                <div className="flex flex-wrap gap-3 mt-6">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-white font-semibold transition-colors"
                  >
                    <Edit3 className="w-5 h-5" />
                    {language === 'fr' ? 'Modifier' : 'Edit'}
                  </button>
                  <button
                    onClick={handleFillWithBots}
                    disabled={fillingBots}
                    className="flex items-center gap-2 px-5 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 backdrop-blur-sm rounded-lg text-purple-300 font-semibold transition-colors disabled:opacity-50"
                  >
                    {fillingBots ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bot className="w-5 h-5" />}
                    {language === 'fr' ? 'Remplir avec Bots' : 'Fill with Bots'}
                  </button>
                  <button
                    onClick={handleDeleteTournament}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 backdrop-blur-sm rounded-lg text-red-300 font-semibold transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                    {language === 'fr' ? 'Supprimer' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Streamer Banner - Top */}
      {tournament.streaming?.enabled && tournament.streaming?.twitchUrl && (
        <div className="relative z-10 bg-gradient-to-r from-purple-900 via-purple-800 to-purple-900 border-b border-purple-500/30">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djJIMjR2LTJoMTJ6bTAtNHYySDI0di0yaDEyem0wLTR2Mkg0djJIMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30 pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Twitch Logo */}
                <div className="relative">
                  <div className="absolute inset-0 bg-purple-500 rounded-full blur-xl opacity-50 animate-pulse" />
                  <div className="relative w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center border-2 border-purple-400 shadow-lg shadow-purple-500/50">
                    <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
                    </svg>
                  </div>
                </div>
                
                {/* Streamer Info */}
                <div className="flex items-center gap-4">
                  {(tournament.streaming.streamerAvatar || getTwitchUsername(tournament.streaming.twitchUrl)) && (
                    <img 
                      src={tournament.streaming.streamerAvatar || getTwitchAvatarUrl(getTwitchUsername(tournament.streaming.twitchUrl))}
                      alt="Streamer"
                      className="w-12 h-12 rounded-full border-2 border-white/30 object-cover hidden sm:block"
                    />
                  )}
                  <div>
                    <div className="text-purple-300 text-xs uppercase tracking-wider font-semibold">
                      {language === 'fr' ? 'Tournoi diffusé en direct par' : 'Tournament streamed live by'}
                    </div>
                    <div className="text-white font-bold text-xl">
                      {tournament.streaming.streamerName || getTwitchUsername(tournament.streaming.twitchUrl) || 'Twitch'}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Live Badge & Watch Button */}
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/40 rounded-full">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-400 text-sm font-bold">LIVE</span>
                </div>
                <a
                  href={tournament.streaming.twitchUrl.startsWith('http') ? tournament.streaming.twitchUrl : `https://${tournament.streaming.twitchUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 rounded-xl text-white font-bold transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 cursor-pointer"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
                  </svg>
                  {language === 'fr' ? 'Regarder' : 'Watch'}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-dark-900 rounded-2xl border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-y-auto my-8">
            {/* Modal Header */}
            <div className={`px-6 py-4 bg-gradient-to-r ${getModeColor(mode)} sticky top-0 z-10`}>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                  <Edit3 className="w-6 h-6" />
                  {language === 'fr' ? 'Modifier le Tournoi' : 'Edit Tournament'}
                </h2>
                <button
                  onClick={() => setIsEditing(false)}
                  className="p-2 bg-black/20 hover:bg-black/30 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">{language === 'fr' ? 'Nom du tournoi' : 'Tournament Name'}</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">{language === 'fr' ? 'Date et heure' : 'Date & Time'}</label>
                  <input
                    type="datetime-local"
                    value={editForm.scheduledAt}
                    onChange={(e) => setEditForm({ ...editForm, scheduledAt: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:border-cyan-500 focus:outline-none resize-none"
                />
              </div>

              {/* Format Options */}
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Type</label>
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="team">{language === 'fr' ? 'Équipe' : 'Team'}</option>
                    <option value="solo">Solo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Format</label>
                  <select
                    value={editForm.format}
                    onChange={(e) => setEditForm({ ...editForm, format: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="bo1">BO1</option>
                    <option value="bo3">BO3</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    {language === 'fr' ? "Nombre d'équipes" : 'Number of teams'}
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="256"
                    step="2"
                    value={editForm.maxParticipants}
                    onChange={(e) => {
                      let val = parseInt(e.target.value) || 2;
                      // Pour les tournois solo, forcer un nombre pair
                      if (editForm.type === 'solo' && val % 2 !== 0) {
                        val = val + 1;
                      }
                      setEditForm({ ...editForm, maxParticipants: val });
                    }}
                    className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:border-cyan-500 focus:outline-none"
                    placeholder="Ex: 8, 12, 16, 32..."
                  />
                  {editForm.type === 'solo' && (
                    <p className="text-xs text-gray-500 mt-1">
                      = {editForm.maxParticipants * editForm.teamSize} {language === 'fr' ? 'joueurs' : 'players'}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">{language === 'fr' ? 'Taille équipe' : 'Team Size'}</label>
                  <select
                    value={editForm.teamSize}
                    onChange={(e) => {
                      const newSize = parseInt(e.target.value);
                      setEditForm({ 
                        ...editForm, 
                        teamSize: newSize,
                        groupSize: Math.min(Math.max(newSize, 3), 5)
                      });
                    }}
                    className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="2">2v2</option>
                    <option value="3">3v3</option>
                    <option value="4">4v4</option>
                    <option value="5">5v5</option>
                    <option value="6">6v6</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">{language === 'fr' ? 'Taille groupes' : 'Group Size'}</label>
                  <select
                    value={editForm.groupSize || 4}
                    onChange={(e) => setEditForm({ ...editForm, groupSize: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="3">{language === 'fr' ? '3 par groupe' : '3 per group'}</option>
                    <option value="4">{language === 'fr' ? '4 par groupe' : '4 per group'}</option>
                    <option value="5">{language === 'fr' ? '5 par groupe' : '5 per group'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">{language === 'fr' ? 'Sélection Maps' : 'Map Selection'}</label>
                  <select
                    value={editForm.mapSelection}
                    onChange={(e) => setEditForm({ ...editForm, mapSelection: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="random">{language === 'fr' ? 'Aléatoire' : 'Random'}</option>
                    <option value="free">{language === 'fr' ? 'Libre' : 'Free Choice'}</option>
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Mode</label>
                  <select
                    value={editForm.mode}
                    onChange={(e) => setEditForm({ ...editForm, mode: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="hardcore">Hardcore</option>
                    <option value="cdl">CDL</option>
                  </select>
                </div>
              </div>

              {/* Streaming */}
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                <label className="flex items-center gap-3 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={editForm.streaming.enabled}
                    onChange={(e) => setEditForm({ ...editForm, streaming: { ...editForm.streaming, enabled: e.target.checked } })}
                    className="w-5 h-5 rounded bg-dark-800 border-white/20 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-white font-medium flex items-center gap-2">
                    <Radio className="w-5 h-5 text-purple-400" />
                    {language === 'fr' ? 'Streaming activé' : 'Streaming enabled'}
                  </span>
                </label>
                {editForm.streaming.enabled && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-purple-400 mb-1">{language === 'fr' ? 'Lien Twitch' : 'Twitch URL'}</label>
                      <input
                        type="url"
                        value={editForm.streaming.twitchUrl}
                        onChange={(e) => setEditForm({ ...editForm, streaming: { ...editForm.streaming, twitchUrl: e.target.value } })}
                        placeholder="https://twitch.tv/username"
                        className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-purple-400 mb-1">{language === 'fr' ? 'Nom du streamer' : 'Streamer Name'}</label>
                        <input
                          type="text"
                          value={editForm.streaming.streamerName}
                          onChange={(e) => setEditForm({ ...editForm, streaming: { ...editForm.streaming, streamerName: e.target.value } })}
                          placeholder="ex: Ninja, Pokimane..."
                          className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-purple-400 mb-1">{language === 'fr' ? 'Avatar du streamer (URL)' : 'Streamer Avatar (URL)'}</label>
                        <input
                          type="url"
                          value={editForm.streaming.streamerAvatar}
                          onChange={(e) => setEditForm({ ...editForm, streaming: { ...editForm.streaming, streamerAvatar: e.target.value } })}
                          placeholder="https://..."
                          className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Gold Prizes */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                <label className="flex items-center gap-3 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={editForm.prizes.gold.enabled}
                    onChange={(e) => setEditForm({ ...editForm, prizes: { ...editForm.prizes, gold: { ...editForm.prizes.gold, enabled: e.target.checked } } })}
                    className="w-5 h-5 rounded bg-dark-800 border-white/20 text-yellow-500 focus:ring-yellow-500"
                  />
                  <span className="text-white font-medium flex items-center gap-2">
                    <Coins className="w-5 h-5 text-yellow-500" />
                    {language === 'fr' ? 'Récompenses en Gold' : 'Gold Prizes'}
                  </span>
                </label>
                {editForm.prizes.gold.enabled && (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-yellow-400 mb-1">🥇 1st</label>
                      <input
                        type="number"
                        value={editForm.prizes.gold.first}
                        onChange={(e) => setEditForm({ ...editForm, prizes: { ...editForm.prizes, gold: { ...editForm.prizes.gold, first: parseInt(e.target.value) || 0 } } })}
                        className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">🥈 2nd</label>
                      <input
                        type="number"
                        value={editForm.prizes.gold.second}
                        onChange={(e) => setEditForm({ ...editForm, prizes: { ...editForm.prizes, gold: { ...editForm.prizes.gold, second: parseInt(e.target.value) || 0 } } })}
                        className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-amber-500 mb-1">🥉 3rd</label>
                      <input
                        type="number"
                        value={editForm.prizes.gold.third}
                        onChange={(e) => setEditForm({ ...editForm, prizes: { ...editForm.prizes, gold: { ...editForm.prizes.gold, third: parseInt(e.target.value) || 0 } } })}
                        className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Cashprize */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                <label className="flex items-center gap-3 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={editForm.prizes.cashprize.enabled}
                    onChange={(e) => setEditForm({ ...editForm, prizes: { ...editForm.prizes, cashprize: { ...editForm.prizes.cashprize, enabled: e.target.checked } } })}
                    className="w-5 h-5 rounded bg-dark-800 border-white/20 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-white font-medium">💵 Cashprize</span>
                </label>
                {editForm.prizes.cashprize.enabled && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-green-400 mb-1">{language === 'fr' ? 'Total' : 'Total'}</label>
                        <input
                          type="number"
                          value={editForm.prizes.cashprize.total}
                          onChange={(e) => setEditForm({ ...editForm, prizes: { ...editForm.prizes, cashprize: { ...editForm.prizes.cashprize, total: parseInt(e.target.value) || 0 } } })}
                          className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-green-400 mb-1">{language === 'fr' ? 'Devise' : 'Currency'}</label>
                        <select
                          value={editForm.prizes.cashprize.currency}
                          onChange={(e) => setEditForm({ ...editForm, prizes: { ...editForm.prizes, cashprize: { ...editForm.prizes.cashprize, currency: e.target.value } } })}
                          className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm"
                        >
                          <option value="EUR">EUR €</option>
                          <option value="USD">USD $</option>
                          <option value="GBP">GBP £</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-yellow-400 mb-1">🥇 1st</label>
                        <input
                          type="number"
                          value={editForm.prizes.cashprize.first}
                          onChange={(e) => setEditForm({ ...editForm, prizes: { ...editForm.prizes, cashprize: { ...editForm.prizes.cashprize, first: parseInt(e.target.value) || 0 } } })}
                          className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">🥈 2nd</label>
                        <input
                          type="number"
                          value={editForm.prizes.cashprize.second}
                          onChange={(e) => setEditForm({ ...editForm, prizes: { ...editForm.prizes, cashprize: { ...editForm.prizes.cashprize, second: parseInt(e.target.value) || 0 } } })}
                          className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-amber-500 mb-1">🥉 3rd</label>
                        <input
                          type="number"
                          value={editForm.prizes.cashprize.third}
                          onChange={(e) => setEditForm({ ...editForm, prizes: { ...editForm.prizes, cashprize: { ...editForm.prizes.cashprize, third: parseInt(e.target.value) || 0 } } })}
                          className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-white/10 bg-dark-800 flex justify-end gap-3 sticky bottom-0">
              <button
                onClick={() => setIsEditing(false)}
                className="px-6 py-3 bg-dark-700 text-white rounded-xl font-semibold hover:bg-dark-600 transition-colors"
              >
                {language === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className={`px-6 py-3 bg-gradient-to-r ${getModeColor(mode)} text-dark-950 rounded-xl font-semibold hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50`}
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {language === 'fr' ? 'Sauvegarder' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Top Section: Info Grid */}
        <div className="max-w-7xl mx-auto mb-8">
          <div className="grid grid-cols-1 gap-6 lg:gap-8 lg:pr-[340px] xl:pr-[420px]">
            {/* Left Column - Main Info */}
            <div className="space-y-6">
              {/* Mobile Sidebar - Visible only on small screens */}
              <div className="lg:hidden space-y-4">
                {/* Registration Card - Mobile */}
                <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border ${getModeBorder(mode)} overflow-hidden`}>
                  <div className={`px-4 py-3 bg-gradient-to-r ${getModeColor(mode)}`}>
                    <h2 className="text-lg font-bold text-white flex items-center gap-3">
                      <Play className="w-5 h-5" />
                      {language === 'fr' ? 'Inscription' : 'Registration'}
                    </h2>
                  </div>
                  <div className="p-4">
                    {tournament.status === 'registration' ? (
                      <>
                        {registered ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                              <CheckCircle className="w-5 h-5 text-green-400" />
                              <div>
                                <div className="text-green-400 font-semibold text-sm">{language === 'fr' ? 'Vous êtes inscrit !' : "You're registered!"}</div>
                              </div>
                            </div>
                            <button
                              onClick={handleUnregister}
                              disabled={registering}
                              className="w-full py-2.5 bg-red-500/20 border border-red-500/50 text-red-400 rounded-xl font-semibold hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2 text-sm"
                            >
                              {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                              {language === 'fr' ? 'Se désinscrire' : 'Unregister'}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={handleRegister}
                            disabled={registering || (tournament.type === 'team' && !squad)}
                            className={`w-full py-3 bg-gradient-to-r ${getModeColor(mode)} text-dark-950 rounded-xl font-bold text-base hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50`}
                          >
                            {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                            {language === 'fr' ? "S'inscrire" : 'Register Now'}
                          </button>
                        )}
                      </>
                    ) : tournament.status === 'in_progress' ? (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mx-auto mb-2" />
                        <div className="text-red-400 font-semibold text-sm">{language === 'fr' ? 'Tournoi en cours' : 'Tournament in progress'}</div>
                      </div>
                    ) : (
                      <div className="p-3 bg-gray-500/10 border border-gray-500/30 rounded-xl text-center">
                        <div className="text-gray-400 text-sm">{language === 'fr' ? 'Inscriptions fermées' : 'Registration closed'}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tournament Info Card - Mobile (Compact horizontal) */}
                <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border ${getModeBorder(mode)} p-4`}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="text-center p-2 bg-dark-800 rounded-lg">
                      <p className="text-[10px] text-gray-500 uppercase">Format</p>
                      <p className="text-white font-bold text-sm">{tournament.format?.toUpperCase() || 'BO1'}</p>
                    </div>
                    <div className="text-center p-2 bg-dark-800 rounded-lg">
                      <p className="text-[10px] text-gray-500 uppercase">{language === 'fr' ? 'Équipe' : 'Team'}</p>
                      <p className="text-white font-bold text-sm">{tournament.teamSize}v{tournament.teamSize}</p>
                    </div>
                    <div className="text-center p-2 bg-dark-800 rounded-lg">
                      <p className="text-[10px] text-gray-500 uppercase">Type</p>
                      <p className="text-white font-bold text-sm">{tournament.type === 'team' ? (language === 'fr' ? 'Équipe' : 'Team') : 'Solo'}</p>
                    </div>
                    <div className="text-center p-2 bg-dark-800 rounded-lg">
                      <p className="text-[10px] text-gray-500 uppercase">Maps</p>
                      <p className="text-white font-bold text-sm">{tournament.mapSelection === 'random' ? (language === 'fr' ? 'Aléat.' : 'Rand.') : (language === 'fr' ? 'Libre' : 'Free')}</p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Prizes Section */}
              {(tournament.prizes?.gold?.enabled || tournament.prizes?.cashprize?.enabled) && (
                <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border ${getModeBorder(mode)} overflow-hidden`}>
                  <div className={`px-4 sm:px-6 py-4 bg-gradient-to-r ${getModeColor(mode)}`}>
                    <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-3">
                      <Gift className="w-5 h-5 sm:w-6 sm:h-6" />
                      {language === 'fr' ? 'Récompenses' : 'Prizes'}
                    </h2>
                  </div>
                  <div className="p-4 sm:p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                      {/* 1st Place */}
                      <div className="bg-gradient-to-br from-yellow-500/20 to-amber-600/10 rounded-xl p-4 sm:p-5 border border-yellow-500/30 relative overflow-hidden">
                        <div className="absolute top-2 right-2 text-3xl sm:text-4xl opacity-20">🥇</div>
                        <div className="text-yellow-400 text-xs sm:text-sm font-semibold mb-2">{language === 'fr' ? '1ère Place' : '1st Place'}</div>
                        <div className="space-y-2">
                          {tournament.prizes?.cashprize?.enabled && tournament.prizes.cashprize.first > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-xl sm:text-2xl">💵</span>
                              <span className="text-green-400 font-bold text-lg sm:text-xl">{tournament.prizes.cashprize.first} {tournament.prizes.cashprize.currency}</span>
                            </div>
                          )}
                          {tournament.prizes?.gold?.enabled && tournament.prizes.gold.first > 0 && (
                            <div className="flex items-center gap-2">
                              <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />
                              <span className="text-yellow-400 font-bold text-lg sm:text-xl">{tournament.prizes.gold.first.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* 2nd Place */}
                      <div className="bg-gradient-to-br from-gray-400/20 to-gray-500/10 rounded-xl p-4 sm:p-5 border border-gray-400/30 relative overflow-hidden">
                        <div className="absolute top-2 right-2 text-3xl sm:text-4xl opacity-20">🥈</div>
                        <div className="text-gray-300 text-xs sm:text-sm font-semibold mb-2">{language === 'fr' ? '2ème Place' : '2nd Place'}</div>
                        <div className="space-y-2">
                          {tournament.prizes?.cashprize?.enabled && tournament.prizes.cashprize.second > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-xl sm:text-2xl">💵</span>
                              <span className="text-green-400 font-bold text-lg sm:text-xl">{tournament.prizes.cashprize.second} {tournament.prizes.cashprize.currency}</span>
                            </div>
                          )}
                          {tournament.prizes?.gold?.enabled && tournament.prizes.gold.second > 0 && (
                            <div className="flex items-center gap-2">
                              <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />
                              <span className="text-yellow-400 font-bold text-lg sm:text-xl">{tournament.prizes.gold.second.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* 3rd Place */}
                      <div className="bg-gradient-to-br from-amber-600/20 to-orange-700/10 rounded-xl p-4 sm:p-5 border border-amber-600/30 relative overflow-hidden">
                        <div className="absolute top-2 right-2 text-3xl sm:text-4xl opacity-20">🥉</div>
                        <div className="text-amber-500 text-xs sm:text-sm font-semibold mb-2">{language === 'fr' ? '3ème Place' : '3rd Place'}</div>
                        <div className="space-y-2">
                          {tournament.prizes?.cashprize?.enabled && tournament.prizes.cashprize.third > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-xl sm:text-2xl">💵</span>
                              <span className="text-green-400 font-bold text-lg sm:text-xl">{tournament.prizes.cashprize.third} {tournament.prizes.cashprize.currency}</span>
                            </div>
                          )}
                          {tournament.prizes?.gold?.enabled && tournament.prizes.gold.third > 0 && (
                            <div className="flex items-center gap-2">
                              <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />
                              <span className="text-yellow-400 font-bold text-lg sm:text-xl">{tournament.prizes.gold.third.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Total Cashprize */}
                    {tournament.prizes?.cashprize?.enabled && tournament.prizes.cashprize.total > 0 && (
                      <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
                        <span className="text-green-400 text-base sm:text-lg">{language === 'fr' ? 'Cashprize Total:' : 'Total Prize Pool:'}</span>
                        <span className="text-green-400 font-bold text-2xl sm:text-3xl">{tournament.prizes.cashprize.total} {tournament.prizes.cashprize.currency}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Participants List */}
              <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border ${getModeBorder(mode)} overflow-hidden`}>
                <div className={`px-4 sm:px-6 py-4 bg-gradient-to-r ${getModeColor(mode)}`}>
                  <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-3">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                    {language === 'fr' ? 'Participants' : 'Participants'} ({participantCount}/{tournament.maxParticipants})
                  </h2>
                </div>
                <div className="p-4 sm:p-6">
                  {/* Progress bar */}
                  <div className="mb-4 sm:mb-6">
                    <div className="flex justify-between text-xs sm:text-sm mb-2">
                      <span className="text-gray-400">{language === 'fr' ? 'Places occupées' : 'Slots filled'}</span>
                      <span className={getModeAccent(mode)}>
                        {tournament.participants?.length || 0}/{tournament.maxParticipants}
                        {botCount > 0 && <span className="text-gray-500 ml-1">({botCount} bots)</span>}
                      </span>
                    </div>
                    <div className="h-2 sm:h-3 bg-dark-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${getModeColor(mode)} transition-all duration-500`}
                        style={{ width: `${((tournament.participants?.length || 0) / tournament.maxParticipants) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Participants grid - Show limited participants with expand option */}
                  {(() => {
                    const INITIAL_DISPLAY_COUNT = 9; // Show 9 initially (3x3 grid)
                    const allParticipants = tournament.participants || [];
                    const displayedParticipants = showAllParticipants 
                      ? allParticipants 
                      : allParticipants.slice(0, INITIAL_DISPLAY_COUNT);
                    const hasMore = allParticipants.length > INITIAL_DISPLAY_COUNT;
                    
                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3">
                          {displayedParticipants.map((participant, idx) => {
                            // Get avatar URL based on tournament type
                            let avatarUrl = null;
                            let displayName = '';
                            const isBot = participant.isBot;
                            
                            if (tournament.type === 'team') {
                              avatarUrl = participant.squad?.logo || participant.squadInfo?.logo;
                              displayName = participant.squad?.name || participant.squadInfo?.name || 'Unknown Squad';
                            } else {
                              // Solo tournament - get user avatar
                              const userData = participant.user || participant.userInfo || participant;
                              const discordId = userData?.discordId;
                              const discordAvatar = userData?.discordAvatar || userData?.avatar;
                              const siteAvatar = userData?.avatarUrl; // Site uploaded avatar
                              
                              // Priority: site avatar > Discord avatar
                              if (siteAvatar) {
                                // Check if it's an absolute URL or relative path
                                avatarUrl = siteAvatar.startsWith('http') ? siteAvatar : siteAvatar;
                              } else if (discordAvatar && discordId) {
                                // Build Discord CDN URL
                                if (discordAvatar.startsWith('http')) {
                                  avatarUrl = discordAvatar;
                                } else {
                                  avatarUrl = `https://cdn.discordapp.com/avatars/${discordId}/${discordAvatar}.png`;
                                }
                              }
                              displayName = userData?.username || 'Unknown Player';
                            }
                            
                            return (
                              <div key={idx} className={`flex items-center gap-3 p-2 sm:p-3 bg-dark-800 rounded-xl border transition-colors ${
                                isBot ? 'border-purple-500/20 hover:border-purple-500/30' : 'border-white/5 hover:border-white/10'
                              }`}>
                                {avatarUrl ? (
                                  <img 
                                    src={avatarUrl} 
                                    alt={displayName}
                                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 ${
                                      isBot ? 'border-purple-500/30' : 'border-white/10'
                                    }`}
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.style.display = 'none';
                                      e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div 
                                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${
                                    isBot ? 'bg-gradient-to-br from-purple-600 to-violet-600' : `bg-gradient-to-br ${getModeColor(mode)}`
                                  }`}
                                  style={{ display: avatarUrl ? 'none' : 'flex' }}
                                >
                                  {isBot ? (
                                    <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                  ) : tournament.type === 'team' ? (
                                    <UsersRound className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                  ) : (
                                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-white font-medium truncate text-sm sm:text-base">
                                      {displayName}
                                    </span>
                                    {isBot && (
                                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-purple-500/20 text-purple-400 rounded">
                                        BOT
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-gray-500 text-xs">
                                    #{idx + 1}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Show more/less button */}
                        {hasMore && (
                          <button
                            onClick={() => setShowAllParticipants(!showAllParticipants)}
                            className={`w-full mt-4 py-3 rounded-xl border transition-all flex items-center justify-center gap-2 ${
                              showAllParticipants 
                                ? 'bg-dark-800 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                                : `bg-gradient-to-r ${getModeColor(mode)} text-dark-950 font-semibold hover:shadow-lg`
                            }`}
                          >
                            {showAllParticipants ? (
                              <>
                                <ChevronDown className="w-4 h-4 rotate-180" />
                                {language === 'fr' ? 'Voir moins' : 'Show less'}
                              </>
                            ) : (
                              <>
                                <Users className="w-4 h-4" />
                                {language === 'fr' 
                                  ? `Voir tous les participants (+${allParticipants.length - INITIAL_DISPLAY_COUNT})` 
                                  : `Show all participants (+${allParticipants.length - INITIAL_DISPLAY_COUNT})`
                                }
                              </>
                            )}
                          </button>
                        )}
                      </>
                    );
                  })()}
                  
                  {(!tournament.participants || tournament.participants.length === 0) && (
                    <div className="text-center py-8 sm:py-12 text-gray-500">
                      <Users className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm sm:text-base">{language === 'fr' ? 'Aucun participant inscrit pour le moment' : 'No participants registered yet'}</p>
                      <p className="text-xs sm:text-sm mt-1">{language === 'fr' ? 'Soyez le premier à vous inscrire !' : 'Be the first to register!'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Animated Scroll Indicator for Bracket */}
        {showBracketIndicator && tournament.bracket && tournament.bracket.length > 0 && (
          <button
            onClick={scrollToBracket}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 group cursor-pointer animate-fade-in"
          >
            <div className={`px-6 py-3 rounded-2xl bg-gradient-to-r ${getModeColor(mode)} shadow-2xl backdrop-blur-xl border border-white/20 flex items-center gap-3 group-hover:scale-105 transition-all duration-300`}>
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
              <span className="text-white font-bold text-sm">
                {language === 'fr' ? 'Voir le bracket' : 'View Bracket'}
              </span>
              <ChevronDown className="w-5 h-5 text-white animate-bounce" />
            </div>
            <div className="flex flex-col items-center">
              <div className={`w-1 h-8 bg-gradient-to-b ${getModeColor(mode)} rounded-full animate-pulse`} />
              <ChevronDown className={`w-8 h-8 text-white animate-bounce`} style={{ animationDelay: '0.2s' }} />
            </div>
          </button>
        )}

        {/* Full Width Bracket Section - Compact Design */}
        {tournament.bracket && tournament.bracket.length > 0 && (
          <div ref={bracketRef} className="mt-8 w-full">
            {/* Bracket Header */}
            <div className={`relative overflow-hidden rounded-t-2xl bg-gradient-to-r ${getModeColor(mode)}`}>
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
              <div className="relative px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/20 shadow-xl">
                    <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                      {language === 'fr' ? 'Bracket du Tournoi' : 'Tournament Bracket'}
                    </h2>
                    <p className="text-white/70 text-xs sm:text-sm font-medium">
                      {tournament.bracket.length} {language === 'fr' ? 'rounds' : 'rounds'} • {tournament.format?.toUpperCase() || 'BO1'}
                    </p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <div className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20">
                    <span className="text-white font-semibold text-xs">
                      {tournament.type === 'solo' 
                        ? (tournament.formedTeams?.length || 0)
                        : (tournament.participants?.filter(p => !p.isBot).length || 0)
                      } {language === 'fr' ? 'équipes' : 'teams'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Bracket Content Container - Full Width */}
            <div className="relative bg-gradient-to-b from-dark-900 via-dark-950 to-dark-950 rounded-b-2xl border-x border-b border-white/5 overflow-hidden">
              {/* Background decorative elements */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className={`absolute -top-32 -right-32 w-64 h-64 bg-gradient-to-br ${getModeColor(mode)} rounded-full blur-[100px] opacity-10`} />
                <div className={`absolute -bottom-32 -left-32 w-64 h-64 bg-gradient-to-tr ${getModeColor(mode)} rounded-full blur-[100px] opacity-10`} />
              </div>
              
              <div className="relative p-4 sm:p-8">
                {/* Round Headers - Flex Layout matching bracket */}
                <div className="flex w-full mb-6">
                  {tournament.bracket.map((round, roundIndex) => {
                    const isLastRound = roundIndex === tournament.bracket.length - 1;
                    const isSemiFinal = roundIndex === tournament.bracket.length - 2;
                    return (
                      <React.Fragment key={roundIndex}>
                        <div className="flex-1 min-w-0 px-1">
                          <div className={`relative overflow-hidden rounded-xl border text-center py-3 ${
                            isLastRound 
                              ? 'bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-orange-500/20 border-amber-500/30' 
                              : isSemiFinal
                                ? 'bg-gradient-to-br from-purple-500/20 via-violet-500/10 to-indigo-500/20 border-purple-500/30'
                                : 'bg-dark-800/80 border-white/10'
                          }`}>
                            <div className="flex items-center justify-center gap-2">
                              {isLastRound && <Crown className="w-4 h-4 text-amber-400" />}
                              {isSemiFinal && <Medal className="w-4 h-4 text-purple-400" />}
                              <span className={`font-bold text-sm uppercase tracking-wider ${
                                isLastRound ? 'text-amber-300' : isSemiFinal ? 'text-purple-300' : 'text-white'
                              }`}>
                                {round.roundName || (isLastRound ? (language === 'fr' ? 'Finale' : 'Final') : `Round ${round.round}`)}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {round.matches?.length || 0} {language === 'fr' ? 'matchs' : 'matches'}
                            </div>
                            
                            {/* Round Maps Display */}
                            {(() => {
                              const roundMaps = getRoundMaps(round.round);
                              if (!roundMaps || roundMaps.length === 0) return null;
                              
                              return (
                                <div className={`mt-3 flex items-center gap-2 flex-wrap ${roundMaps.length === 1 ? 'justify-center' : 'justify-center'}`}>
                                  {roundMaps.map((map, mapIdx) => (
                                    <div 
                                      key={mapIdx} 
                                      className="flex items-center gap-1.5 bg-dark-900/80 rounded-lg px-2.5 py-1.5 border border-white/10"
                                      title={map.name}
                                    >
                                      {map.image ? (
                                        <img 
                                          src={map.image} 
                                          alt={map.name} 
                                          className="w-7 h-7 rounded object-cover"
                                        />
                                      ) : (
                                        <MapPin className="w-5 h-5 text-gray-500" />
                                      )}
                                      <span className="text-xs text-gray-300 font-medium">
                                        {roundMaps.length === 3 ? `M${mapIdx + 1}:` : ''} {map.name}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        {/* Spacer to match connector column */}
                        {!isLastRound && <div className="w-10 flex-shrink-0" />}
                      </React.Fragment>
                    );
                  })}
                </div>
                
                {/* Bracket Content - Full Width Flex Layout */}
                <div className="flex w-full" style={{ minHeight: 'fit-content' }}>
                  {tournament.bracket.map((round, roundIndex) => {
                    const isLastRound = roundIndex === tournament.bracket.length - 1;
                    const isSemiFinal = roundIndex === tournament.bracket.length - 2;
                    
                    // Match card height (2 rows * py-2.5 padding * 2 + h-6 content = ~88px)
                    const matchHeight = 88;
                    const baseGap = 12;
                    const matchSpacing = roundIndex === 0 
                      ? baseGap 
                      : Math.pow(2, roundIndex) * (matchHeight + baseGap) - matchHeight;
                    const paddingTop = roundIndex === 0 
                      ? 0 
                      : (Math.pow(2, roundIndex) - 1) * (matchHeight + baseGap) / 2;
                    
                    return (
                      <div key={roundIndex} className="flex flex-1 min-w-0">
                        {/* Round Column */}
                        <div className="flex-1 min-w-0 px-1">
                          <div 
                            className="flex flex-col"
                            style={{ 
                              gap: `${matchSpacing}px`,
                              paddingTop: `${paddingTop}px`
                            }}
                          >
                            {round.matches?.map((match, matchIndex) => {
                              // Generate team logo color from name (consistent hash)
                              const getTeamLogoData = (name) => {
                                if (!name || name === 'TBD') return null;
                                
                                // Color palette for team logos
                                const colors = [
                                  ['#ef4444', '#dc2626'], // Red
                                  ['#f97316', '#ea580c'], // Orange
                                  ['#eab308', '#ca8a04'], // Yellow
                                  ['#22c55e', '#16a34a'], // Green
                                  ['#14b8a6', '#0d9488'], // Teal
                                  ['#06b6d4', '#0891b2'], // Cyan
                                  ['#3b82f6', '#2563eb'], // Blue
                                  ['#8b5cf6', '#7c3aed'], // Violet
                                  ['#d946ef', '#c026d3'], // Fuchsia
                                  ['#ec4899', '#db2777'], // Pink
                                  ['#f43f5e', '#e11d48'], // Rose
                                  ['#6366f1', '#4f46e5'], // Indigo
                                ];
                                
                                // Simple hash from name
                                let hash = 0;
                                for (let i = 0; i < name.length; i++) {
                                  hash = ((hash << 5) - hash) + name.charCodeAt(i);
                                  hash = hash & hash;
                                }
                                const colorIndex = Math.abs(hash) % colors.length;
                                const [color1, color2] = colors[colorIndex];
                                
                                // Get first letter of the team name
                                const initial = name.charAt(0).toUpperCase();
                                
                                return { color1, color2, initial };
                              };
                              
                              const getParticipantInfo = (pIndex) => {
                                if (pIndex === null || pIndex === undefined) return null;
                                const participant = tournament.type === 'solo' 
                                  ? tournament.formedTeams?.[pIndex] 
                                  : tournament.participants?.[pIndex];
                                if (!participant) return null;
                                
                                if (tournament.type === 'team') {
                                  const name = participant.squadInfo?.name || participant.squad?.name || 'TBD';
                                  return {
                                    name,
                                    isBot: participant.isBot,
                                    logo: participant.squadInfo?.logo || participant.squad?.logo,
                                    logoData: null,
                                    members: participant.squadInfo?.members || participant.roster || []
                                  };
                                }
                                const name = participant.name || participant.members?.[0]?.userInfo?.username || participant.members?.[0]?.username || 'TBD';
                                return {
                                  name,
                                  isBot: participant.members?.every(m => m.isBot),
                                  logo: null,
                                  logoData: getTeamLogoData(name),
                                  members: participant.members || []
                                };
                              };
                              
                              // Check if current user is in this match
                              const isUserInMatch = () => {
                                if (!user) return false;
                                
                                const checkMembers = (members) => {
                                  if (!members || !Array.isArray(members)) return false;
                                  return members.some(m => {
                                    // Get user IDs from current user
                                    const currentUserId = user._id || user.odUserId;
                                    const currentDiscordId = user.discordId;
                                    
                                    if (!currentUserId && !currentDiscordId) return false;
                                    
                                    // Check various member ID formats
                                    // For solo tournaments: member.user._id or member.user (ObjectId string)
                                    // For team tournaments: member.odUserId or member._id
                                    const memberUserId = 
                                      m.user?._id || // populated user object
                                      m.user || // ObjectId string
                                      m.odUserId || 
                                      m.userInfo?.odUserId || 
                                      m._id;
                                    
                                    const memberDiscordId = 
                                      m.user?.discordId || 
                                      m.discordId || 
                                      m.userInfo?.discordId;
                                    
                                    // Check by user ID
                                    if (currentUserId && memberUserId && String(memberUserId) === String(currentUserId)) {
                                      return true;
                                    }
                                    
                                    // Check by Discord ID
                                    if (currentDiscordId && memberDiscordId && String(memberDiscordId) === String(currentDiscordId)) {
                                      return true;
                                    }
                                    
                                    return false;
                                  });
                                };
                                
                                // Get participant data directly
                                const getMembers = (pIndex) => {
                                  if (pIndex === null || pIndex === undefined) return [];
                                  const participant = tournament.type === 'solo' 
                                    ? tournament.formedTeams?.[pIndex] 
                                    : tournament.participants?.[pIndex];
                                  if (!participant) return [];
                                  
                                  if (tournament.type === 'team') {
                                    // For team tournaments, get squad members
                                    return participant.squadInfo?.members || participant.squad?.members || participant.roster || [];
                                  }
                                  // For solo tournaments, get formed team members
                                  return participant.members || [];
                                };
                                
                                const p1Members = getMembers(match.participant1?.index);
                                const p2Members = getMembers(match.participant2?.index);
                                
                                return checkMembers(p1Members) || checkMembers(p2Members);
                              };
                              const userInMatch = isUserInMatch();
                              
                              const p1 = getParticipantInfo(match.participant1?.index);
                              const p2 = getParticipantInfo(match.participant2?.index);
                              const p1Won = match.winner !== null && match.winner !== undefined && match.winner === match.participant1?.index;
                              const p2Won = match.winner !== null && match.winner !== undefined && match.winner === match.participant2?.index;
                              const matchComplete = match.status === 'completed' || (match.winner !== null && match.winner !== undefined && typeof match.winner === 'number');
                              
                              // Find the actual TournamentMatch document
                              const matchDoc = findMatchDocument(round.round, match.matchNumber);
                              const hasMatchDoc = !!matchDoc;
                              const canClickMatch = (p1 && p2); // Everyone can click to view rosters
                              const isAdmin = hasAdminAccess && hasAdminAccess();
                              
                              const handleMatchClick = () => {
                                if (canClickMatch && matchDoc?._id) {
                                  // Navigate to match detail page
                                  navigate(`/tournaments/${tournamentId}/match/${matchDoc._id}`);
                                }
                              };
                              
                              return (
                                <div key={matchIndex} className="relative group w-full">
                                  {/* Match Number Badge */}
                                  <div className="absolute -left-1.5 -top-1.5 z-20">
                                    <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md flex items-center justify-center font-bold text-[10px] shadow-md ${
                                      isLastRound 
                                        ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white' 
                                        : isSemiFinal
                                          ? 'bg-gradient-to-br from-purple-500 to-violet-500 text-white'
                                          : 'bg-dark-700 border border-white/20 text-gray-300'
                                    }`}>
                                      {match.matchNumber || matchIndex + 1}
                                    </div>
                                  </div>
                                  
                                  {/* Match Card - Compact & Clickable */}
                                  <div 
                                    onClick={handleMatchClick}
                                    className={`relative overflow-hidden rounded-lg transition-all duration-300 ${
                                      userInMatch
                                        ? 'bg-gradient-to-br from-cyan-900/40 via-dark-800 to-cyan-900/20 border-2 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.2)] ring-2 ring-cyan-500/30'
                                        : isLastRound 
                                          ? 'bg-gradient-to-br from-dark-800 via-dark-800 to-amber-900/20 border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)]' 
                                          : isSemiFinal
                                            ? 'bg-gradient-to-br from-dark-800 via-dark-800 to-purple-900/20 border border-purple-500/30'
                                            : 'bg-dark-800/90 border border-white/10 hover:border-white/20'
                                    } group-hover:scale-[1.02] ${canClickMatch ? 'cursor-pointer' : ''}`}
                                  >
                                    {/* User match indicator */}
                                    {userInMatch && (
                                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500" />
                                    )}
                                    
                                    {/* Click indicator */}
                                    {canClickMatch && (
                                      <div className="absolute top-1 right-1 z-20">
                                        <Eye className={`w-3 h-3 ${userInMatch ? 'text-cyan-400' : 'text-gray-500'} group-hover:text-cyan-400 transition-colors`} />
                                      </div>
                                    )}
                                    
                                    {/* Participant 1 */}
                                    <div className={`relative flex items-center gap-2 px-3 py-2.5 border-b ${
                                      p1Won 
                                        ? 'bg-gradient-to-r from-emerald-500/20 via-green-500/10 to-transparent border-emerald-500/30' 
                                        : 'border-white/5'
                                    } transition-colors`}>
                                      {/* Team Logo */}
                                      {p1 ? (
                                        p1.logoData ? (
                                          <div 
                                            className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-sm"
                                            style={{ background: `linear-gradient(135deg, ${p1.logoData.color1}, ${p1.logoData.color2})` }}
                                          >
                                            {p1.logoData.initial}
                                          </div>
                                        ) : p1.logo ? (
                                          <img src={p1.logo} alt="" className="w-6 h-6 rounded object-contain flex-shrink-0" />
                                        ) : (
                                          <div className="w-6 h-6 rounded bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0">
                                            {p1.name?.charAt(0)?.toUpperCase() || '?'}
                                          </div>
                                        )
                                      ) : (
                                        <div className="w-6 h-6 rounded bg-gray-800 flex-shrink-0" />
                                      )}
                                      <span className={`flex-1 text-sm font-medium truncate ${
                                        p1Won ? 'text-emerald-400' : p1 ? 'text-white' : 'text-gray-500 italic'
                                      }`}>
                                        {p1?.name || (language === 'fr' ? 'À déterminer' : 'TBD')}
                                      </span>
                                      {p1?.isBot && <Bot className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
                                      {p1Won && <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                                    </div>
                                    
                                    {/* VS divider */}
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black ${
                                        matchComplete 
                                          ? 'bg-dark-700 text-gray-400 border border-white/10' 
                                          : 'bg-gradient-to-br ' + getModeColor(mode) + ' text-white shadow-md'
                                      }`}>
                                        VS
                                      </div>
                                    </div>
                                    
                                    {/* Participant 2 */}
                                    <div className={`relative flex items-center gap-2 px-3 py-2.5 ${
                                      p2Won 
                                        ? 'bg-gradient-to-r from-emerald-500/20 via-green-500/10 to-transparent' 
                                        : ''
                                    } transition-colors`}>
                                      {/* Team Logo */}
                                      {p2 ? (
                                        p2.logoData ? (
                                          <div 
                                            className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-sm"
                                            style={{ background: `linear-gradient(135deg, ${p2.logoData.color1}, ${p2.logoData.color2})` }}
                                          >
                                            {p2.logoData.initial}
                                          </div>
                                        ) : p2.logo ? (
                                          <img src={p2.logo} alt="" className="w-6 h-6 rounded object-contain flex-shrink-0" />
                                        ) : (
                                          <div className="w-6 h-6 rounded bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0">
                                            {p2.name?.charAt(0)?.toUpperCase() || '?'}
                                          </div>
                                        )
                                      ) : (
                                        <div className="w-6 h-6 rounded bg-gray-800 flex-shrink-0" />
                                      )}
                                      <span className={`flex-1 text-sm font-medium truncate ${
                                        p2Won ? 'text-emerald-400' : p2 ? 'text-white' : 'text-gray-500 italic'
                                      }`}>
                                        {p2?.name || (language === 'fr' ? 'À déterminer' : 'TBD')}
                                      </span>
                                      {p2?.isBot && <Bot className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
                                      {p2Won && <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                                    </div>
                                  </div>
                                  
                                  {/* Connector lines handled separately */}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        
                        {/* Connector Column - Between rounds */}
                        {!isLastRound && (
                          <div className="w-10 flex-shrink-0 relative">
                            {round.matches?.map((match, matchIndex) => {
                              // Only draw connectors for even-indexed matches (pairs)
                              if (matchIndex % 2 !== 0) return null;
                              
                              // Calculate positions for current round matches (absolute from top)
                              const match1Y = paddingTop + matchIndex * (matchHeight + matchSpacing) + matchHeight / 2;
                              const match2Y = paddingTop + (matchIndex + 1) * (matchHeight + matchSpacing) + matchHeight / 2;
                              
                              // Calculate position for next round match (where the connector should go)
                              const nextRoundIndex = roundIndex + 1;
                              const nextMatchSpacing = Math.pow(2, nextRoundIndex) * (matchHeight + baseGap) - matchHeight;
                              const nextPaddingTop = (Math.pow(2, nextRoundIndex) - 1) * (matchHeight + baseGap) / 2;
                              const nextMatchIndex = matchIndex / 2;
                              const targetY = nextPaddingTop + nextMatchIndex * (matchHeight + nextMatchSpacing) + matchHeight / 2;
                              
                              return (
                                <svg 
                                  key={matchIndex}
                                  className="absolute left-0 w-full overflow-visible"
                                  style={{ top: 0, height: '100%' }}
                                >
                                  {/* Line from match 1 */}
                                  <line 
                                    x1="0" 
                                    y1={match1Y} 
                                    x2="50%" 
                                    y2={match1Y} 
                                    stroke="rgba(255,255,255,0.3)" 
                                    strokeWidth="2"
                                  />
                                  {/* Line from match 2 */}
                                  <line 
                                    x1="0" 
                                    y1={match2Y} 
                                    x2="50%" 
                                    y2={match2Y} 
                                    stroke="rgba(255,255,255,0.3)" 
                                    strokeWidth="2"
                                  />
                                  {/* Vertical connector */}
                                  <line 
                                    x1="50%" 
                                    y1={match1Y} 
                                    x2="50%" 
                                    y2={match2Y} 
                                    stroke="rgba(255,255,255,0.3)" 
                                    strokeWidth="2"
                                  />
                                  {/* Line to next round match (centered between the two matches) */}
                                  <line 
                                    x1="50%" 
                                    y1={targetY} 
                                    x2="100%" 
                                    y2={targetY} 
                                    stroke="rgba(255,255,255,0.3)" 
                                    strokeWidth="2"
                                  />
                                </svg>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentDetail;
