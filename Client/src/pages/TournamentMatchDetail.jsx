import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useSocket } from '../SocketContext';
import { API_URL } from '../config';
import { 
  ArrowLeft, Swords, Users, Clock, MapPin, MessageCircle, Send, 
  Loader2, Star, Bot, Eye, UsersRound, Trophy, X, CheckCircle
} from 'lucide-react';

const TournamentMatchDetail = () => {
  const { tournamentId, matchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { mode } = useMode();
  const { socket } = useSocket();
  
  const [match, setMatch] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const chatContainerRef = useRef(null);
  
  // Countdown state
  const [matchCountdown, setMatchCountdown] = useState(null);

  const getModeColor = (mode) => {
    if (mode === 'cdl') return 'from-green-500 to-emerald-600';
    return 'from-orange-500 to-red-600';
  };

  // Fetch match data
  useEffect(() => {
    const fetchMatch = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/tournaments/${tournamentId}/matches/${matchId}`, {
          credentials: 'include'
        });
        const data = await res.json();
        
        if (data.success) {
          setMatch(data.match);
          setTournament(data.tournament);
        } else {
          setError(data.message || 'Match not found');
        }
      } catch (err) {
        setError('Failed to load match');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMatch();
  }, [tournamentId, matchId]);

  // Fetch chat messages
  useEffect(() => {
    if (!match?._id) return;
    
    const fetchChat = async () => {
      setLoadingChat(true);
      try {
        const res = await fetch(`${API_URL}/tournaments/${tournamentId}/matches/${matchId}/chat`, {
          credentials: 'include'
        });
        const data = await res.json();
        if (data.success) {
          setChatMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Error fetching chat:', err);
      } finally {
        setLoadingChat(false);
      }
    };

    fetchChat();
  }, [match?._id, tournamentId, matchId]);

  // Socket for real-time chat
  useEffect(() => {
    if (!socket || !matchId || !tournamentId) return;

    // Join the chat room with correct event name and parameters
    socket.emit('joinTournamentMatchChat', { matchId, tournamentId });

    socket.on('tournamentMatchChatMessage', (message) => {
      if (message.matchId === matchId) {
        setChatMessages(prev => [...prev, message]);
      }
    });

    socket.on('tournamentMatchUpdated', (updatedMatch) => {
      if (updatedMatch._id === matchId) {
        setMatch(updatedMatch);
      }
    });

    return () => {
      socket.emit('leaveTournamentMatchChat', { matchId });
      socket.off('tournamentMatchChatMessage');
      socket.off('tournamentMatchUpdated');
    };
  }, [socket, matchId, tournamentId]);

  // Countdown timer
  useEffect(() => {
    if (!match?.startedAt || match?.status !== 'in_progress') {
      setMatchCountdown(null);
      return;
    }

    const MATCH_DURATION_MS = 10 * 60 * 1000; // 10 minutes
    const startTime = new Date(match.startedAt).getTime();
    const endTime = startTime + MATCH_DURATION_MS;

    const updateCountdown = () => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      
      if (remaining <= 0) {
        setMatchCountdown(null);
        return;
      }

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setMatchCountdown({ minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [match?.startedAt, match?.status]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !matchId) return;
    
    try {
      const res = await fetch(`${API_URL}/tournaments/${tournamentId}/matches/${matchId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: chatInput.trim() })
      });
      
      if (res.ok) {
        setChatInput('');
      }
    } catch (err) {
      console.error('Error sending chat:', err);
    }
  };

  const handleValidateResult = async (winner) => {
    const teamName = winner === 'participant1' ? match.p1Info?.name : match.p2Info?.name;
    if (!confirm(`Victoire ${teamName}?`)) return;
    
    try {
      const res = await fetch(`${API_URL}/tournaments/${tournamentId}/matches/${matchId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ winner })
      });
      const data = await res.json();
      if (data.success) {
        setMatch(data.match);
      } else {
        alert(data.message);
      }
    } catch (e) {
      alert('Erreur');
    }
  };

  // Check permissions
  const isStaffUser = user?.roles?.includes('admin') || user?.roles?.includes('arbitre') || user?.roles?.includes('staff');
  const checkUserInMembers = (members) => {
    if (!members || !Array.isArray(members) || !user) return false;
    return members.some(m => {
      const currentUserId = user._id || user.odUserId;
      const currentDiscordId = user.discordId;
      if (!currentUserId && !currentDiscordId) return false;
      const memberUserId = m.user?._id || m.user || m.odUserId || m.userInfo?.odUserId || m._id;
      const memberDiscordId = m.user?.discordId || m.discordId || m.userInfo?.discordId;
      if (currentUserId && memberUserId && String(memberUserId) === String(currentUserId)) return true;
      if (currentDiscordId && memberDiscordId && String(memberDiscordId) === String(currentDiscordId)) return true;
      return false;
    });
  };
  
  const isMatchParticipant = match && (checkUserInMembers(match.p1Info?.members) || checkUserInMembers(match.p2Info?.members));
  const canAccessChat = isStaffUser || isMatchParticipant;
  const isAdmin = isStaffUser;
  const isReferent = user && match && (
    (match.referent1 && String(match.referent1._id || match.referent1) === String(user._id)) ||
    (match.referent2 && String(match.referent2._id || match.referent2) === String(user._id))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error || 'Match not found'}</p>
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
      </div>
    );
  }

  const renderMember = (member, idx, isTeam1) => {
    const memberName = member.isBot ? (member.botName || `Bot ${idx + 1}`) : (member.user?.username || member.userInfo?.username || member.username || member.displayName || `Player ${idx + 1}`);
    const isBot = member.isBot;
    const avatarUrl = !isBot && (member.user?.avatarUrl || member.userInfo?.avatarUrl || member.avatarUrl || member.user?.avatar || member.userInfo?.avatar || member.avatar);
    
    const getUserId = (m) => m.user?._id || (typeof m.user === 'string' ? m.user : null) || m.odUserId || m.userInfo?.odUserId || null;
    const getDiscordId = (m) => m.user?.discordId || m.discordId || m.userInfo?.discordId || null;
    const memberId = getUserId(member);
    const memberDiscord = getDiscordId(member);
    const isCurrentUser = user && (
      (memberId && user._id && String(memberId) === String(user._id)) ||
      (memberDiscord && user.discordId && String(memberDiscord) === String(user.discordId))
    );
    
    const platform = member.user?.platform || member.userInfo?.platform || member.platform;
    const isPc = platform === 'pc' || platform === 'PC';
    const isGGSecureConnected = member.user?.ggSecureConnected || member.userInfo?.ggSecureConnected || member.ggSecureConnected || member.user?.irisConnected || member.userInfo?.irisConnected || member.irisConnected;

    return (
      <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isCurrentUser ? 'bg-gradient-to-r from-cyan-500/20 to-cyan-500/5 border border-cyan-500/40' : 'bg-dark-700/30 hover:bg-dark-700/50'}`}>
        <div className="relative">
          {isBot ? (
            <div className="w-10 h-10 rounded-full bg-dark-600 flex items-center justify-center border border-white/10">
              <Bot className="w-5 h-5 text-gray-500" />
            </div>
          ) : avatarUrl ? (
            <img src={avatarUrl} alt={memberName} className={`w-10 h-10 rounded-full object-cover border-2 ${isCurrentUser ? 'border-cyan-500' : 'border-dark-600'}`} onError={(e) => { e.target.style.display = 'none'; }} />
          ) : (
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-dark-600 to-dark-700 flex items-center justify-center border-2 ${isCurrentUser ? 'border-cyan-500' : 'border-dark-600'}`}>
              <span className="text-sm font-bold text-gray-400">{memberName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          {isCurrentUser && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-cyan-500 rounded-full border-2 border-dark-800 flex items-center justify-center">
              <Star className="w-2 h-2 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-medium truncate ${isCurrentUser ? 'text-cyan-400' : isBot ? 'text-gray-500' : 'text-white'}`}>{memberName}</p>
        </div>
        {!isBot && isPc && (
          <div className="flex-shrink-0" title={isGGSecureConnected ? 'Iris connecté' : 'Iris non connecté'}>
            <Eye className={`w-5 h-5 ${isGGSecureConnected ? 'text-emerald-400' : 'text-red-400'}`} />
          </div>
        )}
        {isCurrentUser && (
          <span className="text-xs font-bold text-cyan-400 bg-cyan-500/20 px-2 py-1 rounded-full">
            {language === 'fr' ? 'VOUS' : 'YOU'}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Header */}
      <div className={`bg-gradient-to-r ${getModeColor(mode)} py-6`}>
        <div className="max-w-6xl mx-auto px-4">
          {/* Back button and title */}
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => navigate(`/tournaments/${tournamentId}`)} className="p-2 bg-black/20 hover:bg-black/30 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <Swords className="w-6 h-6" />
                Match #{match.matchNumber || '?'}
              </h1>
              <p className="text-white/70 text-sm">{match.roundName || `Round ${match.round || '?'}`} • {tournament?.name}</p>
            </div>
          </div>

          {/* Teams Face-off */}
          <div className="flex items-center justify-center gap-6 lg:gap-12">
            {/* Team 1 */}
            <div className="flex items-center gap-4 flex-1 justify-end">
              <div className="text-right">
                <p className={`text-xl font-bold ${match.winner === 'participant1' ? 'text-emerald-300' : 'text-white'}`}>
                  {match.p1Info?.name || 'Équipe 1'}
                </p>
                {match.winner === 'participant1' && <span className="text-emerald-300 text-sm font-semibold">WINNER</span>}
              </div>
              {match.p1Info?.logoData ? (
                <div className={`w-16 h-16 lg:w-20 lg:h-20 rounded-xl flex items-center justify-center text-2xl lg:text-3xl font-bold text-white shadow-lg ${match.winner === 'participant1' ? 'ring-4 ring-emerald-400' : ''}`} style={{ background: `linear-gradient(135deg, ${match.p1Info.logoData.color1}, ${match.p1Info.logoData.color2})` }}>
                  {match.p1Info.logoData.initial}
                </div>
              ) : (
                <div className={`w-16 h-16 lg:w-20 lg:h-20 rounded-xl bg-dark-800 flex items-center justify-center ${match.winner === 'participant1' ? 'ring-4 ring-emerald-400' : ''}`}>
                  <Users className="w-8 h-8 text-gray-400" />
                </div>
              )}
            </div>

            {/* VS */}
            <div className="w-16 h-16 rounded-full bg-dark-900/80 backdrop-blur flex items-center justify-center shadow-2xl border-2 border-white/20 flex-shrink-0">
              <span className="text-white font-black text-xl">VS</span>
            </div>

            {/* Team 2 */}
            <div className="flex items-center gap-4 flex-1">
              {match.p2Info?.logoData ? (
                <div className={`w-16 h-16 lg:w-20 lg:h-20 rounded-xl flex items-center justify-center text-2xl lg:text-3xl font-bold text-white shadow-lg ${match.winner === 'participant2' ? 'ring-4 ring-emerald-400' : ''}`} style={{ background: `linear-gradient(135deg, ${match.p2Info.logoData.color1}, ${match.p2Info.logoData.color2})` }}>
                  {match.p2Info.logoData.initial}
                </div>
              ) : (
                <div className={`w-16 h-16 lg:w-20 lg:h-20 rounded-xl bg-dark-800 flex items-center justify-center ${match.winner === 'participant2' ? 'ring-4 ring-emerald-400' : ''}`}>
                  <Users className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div>
                <p className={`text-xl font-bold ${match.winner === 'participant2' ? 'text-emerald-300' : 'text-white'}`}>
                  {match.p2Info?.name || 'Équipe 2'}
                </p>
                {match.winner === 'participant2' && <span className="text-emerald-300 text-sm font-semibold">WINNER</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Map Display */}
        {match.selectedMap?.name && (
          <div className="bg-dark-900 rounded-2xl border border-white/10 overflow-hidden">
            <div className="relative h-24 sm:h-32">
              {match.selectedMap.image ? (
                <img 
                  src={match.selectedMap.image} 
                  alt={match.selectedMap.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-dark-800 to-dark-900 flex items-center justify-center">
                  <MapPin className="w-16 h-16 text-gray-600" />
                </div>
              )}
              {/* Overlay with map name */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Map</p>
                    <h3 className="text-2xl font-bold text-white">{match.selectedMap.name}</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-black/50 backdrop-blur rounded-xl border border-white/10">
                      <span className="text-white font-bold">{match.format?.toUpperCase() || 'BO1'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Match Info Bar */}
        <div className="flex items-center justify-center gap-4 flex-wrap">
          {matchCountdown && match.status === 'in_progress' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-xl">
              <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
              <span className="text-amber-400 font-mono font-bold text-lg">
                {String(matchCountdown.minutes).padStart(2, '0')}:{String(matchCountdown.seconds).padStart(2, '0')}
              </span>
            </div>
          )}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${match.status === 'in_progress' ? 'bg-red-500/20 border border-red-500/30' : match.status === 'completed' ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-dark-800 border border-white/10'}`}>
            {match.status === 'in_progress' && <div className="w-2.5 h-2.5 bg-red-400 rounded-full animate-pulse" />}
            <span className={`font-bold ${match.status === 'in_progress' ? 'text-red-400' : match.status === 'completed' ? 'text-emerald-400' : 'text-gray-400'}`}>
              {match.status === 'in_progress' ? 'LIVE' : match.status === 'completed' ? (language === 'fr' ? 'Terminé' : 'Finished') : (language === 'fr' ? 'En attente' : 'Pending')}
            </span>
          </div>
        </div>

        {/* Rosters */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Team 1 Roster */}
          <div className="bg-dark-900 rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-4 py-3 bg-dark-800 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UsersRound className="w-5 h-5 text-cyan-400" />
                <span className="font-semibold text-white">{match.p1Info?.name || 'Équipe 1'}</span>
              </div>
              <span className="text-sm text-gray-500">{match.p1Info?.members?.length || 0} joueurs</span>
            </div>
            <div className="p-4 space-y-2">
              {match.p1Info?.members?.length > 0 ? (
                match.p1Info.members.map((member, idx) => renderMember(member, idx, true))
              ) : (
                <p className="text-gray-500 text-center py-4">{language === 'fr' ? 'Aucun joueur' : 'No players'}</p>
              )}
            </div>
          </div>

          {/* Team 2 Roster */}
          <div className="bg-dark-900 rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-4 py-3 bg-dark-800 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UsersRound className="w-5 h-5 text-orange-400" />
                <span className="font-semibold text-white">{match.p2Info?.name || 'Équipe 2'}</span>
              </div>
              <span className="text-sm text-gray-500">{match.p2Info?.members?.length || 0} joueurs</span>
            </div>
            <div className="p-4 space-y-2">
              {match.p2Info?.members?.length > 0 ? (
                match.p2Info.members.map((member, idx) => renderMember(member, idx, false))
              ) : (
                <p className="text-gray-500 text-center py-4">{language === 'fr' ? 'Aucun joueur' : 'No players'}</p>
              )}
            </div>
          </div>
        </div>


        {/* Referent Validation */}
        {!isAdmin && isReferent && tournament?.type === 'solo' && match.status !== 'completed' && (
          <div className="bg-dark-900 rounded-2xl border border-purple-500/30 overflow-hidden">
            <div className="px-4 py-3 bg-dark-800 border-b border-purple-500/30 flex items-center gap-2">
              <Star className="w-5 h-5 text-purple-400" />
              <span className="text-purple-400 font-semibold">{language === 'fr' ? 'Référent - Valider le résultat' : 'Referent - Validate result'}</span>
            </div>
            <div className="p-4 flex gap-4">
              <button
                onClick={() => handleValidateResult('participant1')}
                className="flex-1 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-xl font-semibold transition-colors"
              >
                {match.p1Info?.name || 'Équipe 1'}
              </button>
              <button
                onClick={() => handleValidateResult('participant2')}
                className="flex-1 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-xl font-semibold transition-colors"
              >
                {match.p2Info?.name || 'Équipe 2'}
              </button>
            </div>
          </div>
        )}

        {/* Chat */}
        {canAccessChat && (
          <div className="bg-dark-900 rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-4 py-3 bg-dark-800 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-cyan-400" />
                <span className="font-semibold text-white">Chat</span>
              </div>
              <span className="text-sm text-gray-500">{chatMessages.length}</span>
            </div>
            <div ref={chatContainerRef} className="h-64 overflow-y-auto p-4 space-y-2">
              {loadingChat ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">{language === 'fr' ? 'Aucun message' : 'No messages'}</p>
                </div>
              ) : (
                chatMessages.map((msg, idx) => {
                  const isOwn = user && String(msg.userId) === String(user._id);
                  const isStaff = msg.isStaff || msg.isAdmin;
                  return (
                    <div key={msg._id || idx} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center">
                          <span className="text-xs font-bold text-gray-400">{(msg.username || 'U')[0]}</span>
                        </div>
                      </div>
                      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                        <span className={`text-xs mb-0.5 ${isStaff ? 'text-orange-400' : 'text-gray-500'}`}>{msg.username || 'User'}</span>
                        <div className={`px-3 py-2 rounded-xl text-sm max-w-[70%] ${isStaff ? 'bg-orange-500/20 text-orange-100' : isOwn ? 'bg-cyan-500/20 text-cyan-100' : 'bg-dark-700 text-gray-200'}`}>
                          {msg.message}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {user && (
              <div className="p-4 border-t border-white/10 flex gap-3">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Message..."
                  className="flex-1 bg-dark-800 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim()}
                  className="px-4 py-2 bg-cyan-500 disabled:bg-dark-700 rounded-xl transition-colors"
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentMatchDetail;
