import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useAuth } from '../AuthContext';
import { useMode } from '../ModeContext';
import { API_URL } from '../config';
import { 
  Trophy, Calendar, Users, Clock, Medal, Crown, Zap, ArrowLeft,
  MapPin, Radio, Play, CheckCircle, XCircle, Loader2,
  Swords, Target, User, UsersRound, ExternalLink, Coins, ChevronRight,
  Shield, Star, Gift, Edit3, Save, X, Trash2, Bot
} from 'lucide-react';

const TournamentDetail = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { user, squad, hasAdminAccess } = useAuth();
  const { selectedMode } = useMode();
  
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState(null);
  
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
    }
  }, [tournamentId]);

  useEffect(() => {
    if (tournament) {
      setEditForm({
        name: tournament.name || '',
        description: tournament.description || '',
        type: tournament.type || 'team',
        format: tournament.format || 'bo3',
        mode: tournament.mode || 'hardcore',
        teamSize: tournament.teamSize || 4,
        groupSize: tournament.groupSize || 4,
        maxParticipants: tournament.maxParticipants || 12,
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
      const response = await fetch(`${API_URL}/tournaments/admin/${tournamentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm)
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
            {/* Tournament Icon */}
            <div className="w-24 h-24 md:w-32 md:h-32 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 shadow-2xl">
              <Trophy className="w-12 h-12 md:w-16 md:h-16 text-white" />
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
                  <label className="block text-sm font-medium text-gray-400 mb-2">Max Participants</label>
                  <input
                    type="number"
                    min="2"
                    max="256"
                    value={editForm.maxParticipants}
                    onChange={(e) => setEditForm({ ...editForm, maxParticipants: parseInt(e.target.value) || 2 })}
                    className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:border-cyan-500 focus:outline-none"
                    placeholder="Ex: 12, 24, 32..."
                  />
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Left Column - Main Info */}
            <div className="lg:col-span-2 space-y-6">
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
                      <span className={getModeAccent(mode)}>{Math.round((participantCount / tournament.maxParticipants) * 100)}%</span>
                    </div>
                    <div className="h-2 sm:h-3 bg-dark-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${getModeColor(mode)} transition-all duration-500`}
                        style={{ width: `${(participantCount / tournament.maxParticipants) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Participants grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3">
                    {tournament.participants?.filter(p => !p.isBot).map((participant, idx) => {
                      // Get avatar URL based on tournament type
                      let avatarUrl = null;
                      let displayName = '';
                      
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
                        if (siteAvatar && siteAvatar.startsWith('http')) {
                          avatarUrl = siteAvatar;
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
                        <div key={idx} className="flex items-center gap-3 p-2 sm:p-3 bg-dark-800 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                          {avatarUrl ? (
                            <img 
                              src={avatarUrl} 
                              alt={displayName}
                              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-white/10"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br ${getModeColor(mode)} flex items-center justify-center`}
                            style={{ display: avatarUrl ? 'none' : 'flex' }}
                          >
                            {tournament.type === 'team' ? (
                              <UsersRound className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                            ) : (
                              <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium truncate text-sm sm:text-base">
                              {displayName}
                            </div>
                            <div className="text-gray-500 text-xs">
                              #{idx + 1}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {participantCount === 0 && (
                    <div className="text-center py-8 sm:py-12 text-gray-500">
                      <Users className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm sm:text-base">{language === 'fr' ? 'Aucun participant inscrit pour le moment' : 'No participants registered yet'}</p>
                      <p className="text-xs sm:text-sm mt-1">{language === 'fr' ? 'Soyez le premier à vous inscrire !' : 'Be the first to register!'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-6 lg:sticky lg:top-4 lg:self-start">
              {/* Registration Card */}
              <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border ${getModeBorder(mode)} overflow-hidden`}>
                <div className={`px-4 sm:px-6 py-4 bg-gradient-to-r ${getModeColor(mode)}`}>
                  <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-3">
                    <Play className="w-5 h-5 sm:w-6 sm:h-6" />
                    {language === 'fr' ? 'Inscription' : 'Registration'}
                  </h2>
                </div>
                <div className="p-4 sm:p-6">
                  {tournament.status === 'registration' ? (
                    <>
                      {registered ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 p-3 sm:p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                            <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
                            <div>
                              <div className="text-green-400 font-semibold text-sm sm:text-base">{language === 'fr' ? 'Vous êtes inscrit !' : "You're registered!"}</div>
                              <div className="text-green-400/60 text-xs sm:text-sm">{language === 'fr' ? 'Bonne chance !' : 'Good luck!'}</div>
                            </div>
                          </div>
                          <button
                            onClick={handleUnregister}
                            disabled={registering}
                            className="w-full py-2.5 sm:py-3 bg-red-500/20 border border-red-500/50 text-red-400 rounded-xl font-semibold hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                          >
                            {registering ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />}
                            {language === 'fr' ? 'Se désinscrire' : 'Unregister'}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {tournament.type === 'team' && !squad && (
                            <div className="p-3 sm:p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                              <div className="text-yellow-400 text-xs sm:text-sm">
                                {language === 'fr' ? 'Vous devez avoir une escouade pour vous inscrire à ce tournoi' : 'You need a squad to register for this tournament'}
                              </div>
                            </div>
                          )}
                          <button
                            onClick={handleRegister}
                            disabled={registering || (tournament.type === 'team' && !squad)}
                            className={`w-full py-3 sm:py-4 bg-gradient-to-r ${getModeColor(mode)} text-dark-950 rounded-xl font-bold text-base sm:text-lg hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50`}
                          >
                            {registering ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />}
                            {language === 'fr' ? "S'inscrire" : 'Register Now'}
                          </button>
                        </div>
                      )}
                    </>
                  ) : tournament.status === 'in_progress' ? (
                    <div className="p-3 sm:p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mx-auto mb-2" />
                      <div className="text-red-400 font-semibold text-sm sm:text-base">{language === 'fr' ? 'Tournoi en cours' : 'Tournament in progress'}</div>
                    </div>
                  ) : (
                    <div className="p-3 sm:p-4 bg-gray-500/10 border border-gray-500/30 rounded-xl text-center">
                      <div className="text-gray-400 text-sm sm:text-base">{language === 'fr' ? 'Inscriptions fermées' : 'Registration closed'}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tournament Info Card */}
              <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border ${getModeBorder(mode)} overflow-hidden`}>
                <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between py-2 sm:py-3 border-b border-white/5">
                    <div className="flex items-center gap-2 sm:gap-3 text-gray-400">
                      <Swords className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="text-sm sm:text-base">Format</span>
                    </div>
                    <span className="text-white font-semibold text-sm sm:text-base">{tournament.format?.toUpperCase() || 'BO1'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 sm:py-3 border-b border-white/5">
                    <div className="flex items-center gap-2 sm:gap-3 text-gray-400">
                      <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="text-sm sm:text-base">{language === 'fr' ? 'Taille équipe' : 'Team Size'}</span>
                    </div>
                    <span className="text-white font-semibold text-sm sm:text-base">{tournament.teamSize}v{tournament.teamSize}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 sm:py-3 border-b border-white/5">
                    <div className="flex items-center gap-2 sm:gap-3 text-gray-400">
                      <Target className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="text-sm sm:text-base">Type</span>
                    </div>
                    <span className="text-white font-semibold text-sm sm:text-base">{tournament.type === 'team' ? (language === 'fr' ? 'Équipe' : 'Team') : 'Solo'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 sm:py-3">
                    <div className="flex items-center gap-2 sm:gap-3 text-gray-400">
                      <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="text-sm sm:text-base">Maps</span>
                    </div>
                    <span className="text-white font-semibold text-sm sm:text-base">{tournament.mapSelection === 'random' ? (language === 'fr' ? 'Aléatoire' : 'Random') : (language === 'fr' ? 'Libre' : 'Free')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Full Width Bracket Section */}
        {tournament.bracket && tournament.bracket.length > 0 && (
          <div className={`mt-8 bg-dark-900/80 backdrop-blur-xl rounded-2xl border ${getModeBorder(mode)} overflow-hidden`}>
            <div className={`px-4 sm:px-6 py-4 bg-gradient-to-r ${getModeColor(mode)}`}>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-3">
                <Target className="w-5 h-5 sm:w-6 sm:h-6" />
                {language === 'fr' ? 'Bracket du tournoi' : 'Tournament Bracket'}
              </h2>
            </div>
            <div className="p-4 sm:p-6 overflow-x-auto bg-dark-950">
              {/* Round Headers Row */}
              <div className="flex mb-4 min-w-max">
                {tournament.bracket.map((round, roundIndex) => (
                  <div key={roundIndex} className="min-w-[200px] sm:min-w-[240px] px-1 sm:px-2">
                    <div className="bg-dark-800 border border-white/10 rounded-lg px-2 sm:px-4 py-2 text-center">
                      <span className="text-white font-semibold text-xs sm:text-sm uppercase tracking-wide">
                        {round.roundName || `Round ${round.round}`} - ({tournament.format?.toUpperCase() || 'BO1'})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Bracket Content */}
              <div className="flex min-w-max relative">
                {tournament.bracket.map((round, roundIndex) => {
                  const isLastRound = roundIndex === tournament.bracket.length - 1;
                  const matchSpacing = Math.pow(2, roundIndex) * 60;
                  
                  return (
                    <div key={roundIndex} className="flex">
                      <div className="min-w-[200px] sm:min-w-[240px] px-1 sm:px-2 relative">
                        <div 
                          className="flex flex-col justify-around"
                          style={{ 
                            gap: `${matchSpacing}px`,
                            paddingTop: roundIndex > 0 ? `${matchSpacing / 2}px` : '0'
                          }}
                        >
                          {round.matches?.map((match, matchIndex) => {
                            const getParticipantInfo = (pIndex) => {
                              if (pIndex === null || pIndex === undefined) return null;
                              const participant = tournament.type === 'solo' 
                                ? tournament.formedTeams?.[pIndex] 
                                : tournament.participants?.[pIndex];
                              if (!participant) return null;
                              
                              if (tournament.type === 'team') {
                                return {
                                  name: participant.squadInfo?.name || participant.squad?.name || 'TBD',
                                  isBot: participant.isBot
                                };
                              }
                              return {
                                name: participant.name || participant.members?.[0]?.userInfo?.username || participant.members?.[0]?.username || 'TBD',
                                isBot: participant.members?.every(m => m.isBot)
                              };
                            };
                            
                            const p1 = getParticipantInfo(match.participant1?.index);
                            const p2 = getParticipantInfo(match.participant2?.index);
                            const p1Won = match.winner === match.participant1?.index && match.winner !== null;
                            const p2Won = match.winner === match.participant2?.index && match.winner !== null;
                            
                            return (
                              <div key={matchIndex} className="relative">
                                <div className="absolute -left-1 -top-1 z-10">
                                  <span className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 text-[8px] sm:text-[10px] font-bold text-orange-400 bg-dark-900 border border-orange-500/50 rounded">
                                    {match.matchNumber || matchIndex + 1}
                                  </span>
                                </div>
                                
                                <div className="bg-dark-800 border border-white/10 rounded-lg overflow-hidden">
                                  <div className={`flex items-center px-2 sm:px-3 py-1.5 sm:py-2 border-b border-white/5 ${p1Won ? 'bg-green-500/10' : ''}`}>
                                    <span className={`flex-1 text-xs sm:text-sm truncate ${p1Won ? 'text-green-400 font-semibold' : p1 ? 'text-white' : 'text-gray-500'}`}>
                                      {p1?.name || (language === 'fr' ? 'À déterminer' : 'TBD')}
                                    </span>
                                    {p1Won && <span className="ml-1 sm:ml-2 text-green-400 text-[10px] sm:text-xs">✓</span>}
                                  </div>
                                  
                                  <div className={`flex items-center px-2 sm:px-3 py-1.5 sm:py-2 ${p2Won ? 'bg-green-500/10' : ''}`}>
                                    <span className={`flex-1 text-xs sm:text-sm truncate ${p2Won ? 'text-green-400 font-semibold' : p2 ? 'text-white' : 'text-gray-500'}`}>
                                      {p2?.name || (language === 'fr' ? 'À déterminer' : 'TBD')}
                                    </span>
                                    {p2Won && <span className="ml-1 sm:ml-2 text-green-400 text-[10px] sm:text-xs">✓</span>}
                                  </div>
                                </div>
                                
                                {!isLastRound && (
                                  <div className="absolute right-0 top-1/2 w-4 sm:w-6 h-0.5 bg-white/20 translate-x-full" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentDetail;
