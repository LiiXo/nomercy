import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Users, Trophy, Shield, Crown, MessageCircle, 
  Send, Loader2, CheckCircle, XCircle, Phone, AlertTriangle,
  Map, Check
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { useSocket } from '../SocketContext';
import { getUserAvatar } from '../utils/avatar';

const API_URL = import.meta.env.VITE_API_URL;

// Stricker Ranks
const STRICKER_RANKS = {
  recrues: { key: 'recrues', name: 'Recrues', min: 0, max: 199, image: '/stricker/recrues.png' },
  combattant: { key: 'combattant', name: 'Combattant', min: 200, max: 499, image: '/stricker/combattant.png' },
  veteran: { key: 'veteran', name: 'Vétéran', min: 500, max: 999, image: '/stricker/veteran.png' },
  elite: { key: 'elite', name: 'Élite', min: 1000, max: 1499, image: '/stricker/elite.png' },
  maitre: { key: 'maitre', name: 'Maître', min: 1500, max: 2499, image: '/stricker/maitre.png' },
  immortel: { key: 'immortel', name: 'Immortel', min: 2500, max: Infinity, image: '/stricker/immortel.png' }
};

const getStrickerRank = (points) => {
  for (const rank of Object.values(STRICKER_RANKS)) {
    if (points >= rank.min && points <= rank.max) return rank;
  }
  return STRICKER_RANKS.recrues;
};

const translations = {
  fr: {
    loading: 'Chargement...',
    matchNotFound: 'Match non trouvé',
    backToStricker: 'Retour',
    team1: 'Équipe 1',
    team2: 'Équipe 2',
    vs: 'VS',
    host: 'Hôte',
    referent: 'Référent',
    selectedMap: 'Map sélectionnée',
    status: {
      pending: 'En attente',
      ready: 'Prêt',
      in_progress: 'En cours',
      completed: 'Terminé',
      cancelled: 'Annulé',
      disputed: 'En litige'
    },
    reportResult: 'Qui a gagné ?',
    winner: 'Vainqueur',
    startMatch: 'Démarrer le match',
    chat: 'Chat du match',
    sendMessage: 'Envoyer',
    typeMessage: 'Tapez votre message...',
    victory: 'Victoire',
    defeat: 'Défaite',
    yourTeamVoted: 'Votre équipe a voté',
    waitingOtherTeam: 'En attente du vote de l\'autre équipe...',
    yourTeamWon: 'Votre équipe a gagné !',
    yourTeamLost: 'Votre équipe a perdu',
    testMatch: 'Match de test',
    callArbitrator: 'Appeler un arbitre',
    arbitratorCalled: 'Arbitre appelé',
    arbitratorCalledDesc: 'Un arbitre a été notifié et interviendra dès que possible.',
    yourTeam: 'Votre équipe',
    disputeTitle: 'Désaccord détecté',
    disputeDesc: 'Les deux équipes ont voté pour des gagnants différents. Un arbitre a été automatiquement notifié.',
    team1Voted: 'Équipe 1 a voté',
    team2Voted: 'Équipe 2 a voté',
    notVotedYet: 'Pas encore voté'
  },
  en: {
    loading: 'Loading...',
    matchNotFound: 'Match not found',
    backToStricker: 'Back',
    team1: 'Team 1',
    team2: 'Team 2',
    vs: 'VS',
    host: 'Host',
    referent: 'Referent',
    selectedMap: 'Selected map',
    status: {
      pending: 'Pending',
      ready: 'Ready',
      in_progress: 'In progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
      disputed: 'Disputed'
    },
    reportResult: 'Who won?',
    winner: 'Winner',
    startMatch: 'Start match',
    chat: 'Match chat',
    sendMessage: 'Send',
    typeMessage: 'Type your message...',
    victory: 'Victory',
    defeat: 'Defeat',
    yourTeamVoted: 'Your team voted',
    waitingOtherTeam: 'Waiting for other team to vote...',
    yourTeamWon: 'Your team won!',
    yourTeamLost: 'Your team lost',
    testMatch: 'Test match',
    callArbitrator: 'Call arbitrator',
    arbitratorCalled: 'Arbitrator called',
    arbitratorCalledDesc: 'An arbitrator has been notified and will intervene as soon as possible.',
    yourTeam: 'Your team',
    disputeTitle: 'Dispute detected',
    disputeDesc: 'Both teams voted for different winners. An arbitrator has been automatically notified.',
    team1Voted: 'Team 1 voted',
    team2Voted: 'Team 2 voted',
    notVotedYet: 'Not voted yet'
  }
};

const StrickerMatchSheet = ({ strickerMode = 'hardcore' }) => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const { socket } = useSocket();
  const chatRef = useRef(null);

  const t = translations[language] || translations.en;
  
  // Base path for this stricker mode
  const basePath = `/${strickerMode}/stricker`;

  // States
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState(null);
  const [error, setError] = useState(null);
  const [myTeam, setMyTeam] = useState(null);
  const [isReferent, setIsReferent] = useState(false);
  
  // Chat
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // Result
  const [submittingResult, setSubmittingResult] = useState(false);
  const [myVote, setMyVote] = useState(null);
  
  // Arbitrator
  const [callingArbitrator, setCallingArbitrator] = useState(false);
  const [hasCalledArbitrator, setHasCalledArbitrator] = useState(false);

  // Fetch match data
  const fetchMatch = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/stricker/match/${matchId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        setMatch(data.match);
        setMyTeam(data.myTeam);
        setIsReferent(data.isReferent);
        setMessages(data.match.chat || []);
        
        // Check if user's team already voted
        const teamVote = data.match.result?.teamVotes?.[data.myTeam];
        if (teamVote) {
          setMyVote(teamVote.winner);
        }
        
        // Check if arbitrator already called
        if (data.match.arbitratorCalls?.length > 0) {
          setHasCalledArbitrator(true);
        }
      } else {
        setError(data.message || t.matchNotFound);
      }
    } catch (err) {
      console.error('Error fetching match:', err);
      setError(t.matchNotFound);
    } finally {
      setLoading(false);
    }
  }, [matchId, user, t.matchNotFound]);

  useEffect(() => {
    if (isAuthenticated && matchId) {
      fetchMatch();
    }
  }, [isAuthenticated, matchId, fetchMatch]);

  // Polling for updates
  useEffect(() => {
    if (!match || match.status === 'completed' || match.status === 'cancelled' || match.status === 'disputed') return;
    
    const interval = setInterval(fetchMatch, 5000);
    return () => clearInterval(interval);
  }, [match, fetchMatch]);

  // Auto scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // Send chat message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || sendingMessage) return;
    
    setSendingMessage(true);
    try {
      const response = await fetch(`${API_URL}/stricker/match/${matchId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: newMessage.trim() })
      });
      const data = await response.json();
      
      if (data.success) {
        setNewMessage('');
        fetchMatch();
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  // Submit result vote
  const handleSubmitResult = async (winner) => {
    if (submittingResult || myVote) return;
    
    setSubmittingResult(true);
    try {
      const response = await fetch(`${API_URL}/stricker/match/${matchId}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ winner })
      });
      const data = await response.json();
      
      if (data.success) {
        setMyVote(winner);
        fetchMatch();
      }
    } catch (err) {
      console.error('Error submitting result:', err);
    } finally {
      setSubmittingResult(false);
    }
  };

  // Call arbitrator
  const handleCallArbitrator = async () => {
    if (callingArbitrator || hasCalledArbitrator) return;
    
    setCallingArbitrator(true);
    try {
      const response = await fetch(`${API_URL}/stricker/match/${matchId}/call-arbitrator`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        setHasCalledArbitrator(true);
        fetchMatch();
      }
    } catch (err) {
      console.error('Error calling arbitrator:', err);
    } finally {
      setCallingArbitrator(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-12 h-12 text-lime-500 animate-spin" />
          <p className="text-gray-400">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
        <div className="bg-dark-900 border border-red-500/30 rounded-xl p-8 text-center max-w-md">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">{error || t.matchNotFound}</h2>
          <button
            onClick={() => navigate(basePath)}
            className="mt-4 px-6 py-3 bg-lime-500 hover:bg-lime-600 text-white font-semibold rounded-lg transition-colors"
          >
            {t.backToStricker}
          </button>
        </div>
      </div>
    );
  }

  const team1Players = match.players?.filter(p => p.team === 1) || [];
  const team2Players = match.players?.filter(p => p.team === 2) || [];
  const isCompleted = match.status === 'completed';
  const winner = match.result?.winner;
  const myPlayer = match.players?.find(p => p.user?._id === user?._id || p.user === user?._id);
  const didWin = myPlayer && winner === myPlayer.team;
  
  const team1Name = match.team1Squad?.name || t.team1;
  const team2Name = match.team2Squad?.name || match.team2Name || t.team2;
  const team1Logo = match.team1Squad?.logo;
  const team2Logo = match.team2Squad?.logo;
  
  // Calculate total team points
  const team1TotalPoints = team1Players.reduce((sum, p) => sum + (p.points || 0), 0);
  const team2TotalPoints = team2Players.reduce((sum, p) => sum + (p.points || 0), 0);
  
  // Get team ranks based on total points
  const team1Rank = getStrickerRank(team1TotalPoints);
  const team2Rank = getStrickerRank(team2TotalPoints);

  return (
    <div className="min-h-screen bg-dark-950 pb-20">
      {/* Header with Teams */}
      <div className="relative overflow-hidden bg-gradient-to-br from-lime-600/20 via-green-600/10 to-dark-950 border-b border-lime-500/20">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
        <div className="relative max-w-7xl mx-auto px-4 py-4">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate(basePath)}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">{t.backToStricker}</span>
            </button>
            
            <div className="flex items-center gap-2">
              {match.isTestMatch && (
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded text-xs font-bold">
                  TEST
                </span>
              )}
              <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                match.status === 'completed' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                match.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                match.status === 'ready' ? 'bg-lime-500/20 text-lime-400 border border-lime-500/30' :
                match.status === 'cancelled' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
              }`}>
                {t.status[match.status] || match.status}
              </span>
            </div>
          </div>
          
          {/* Teams Display */}
          <div className="flex items-center justify-center gap-4 sm:gap-8 py-4">
            {/* Team 1 */}
            <div className={`flex-1 text-center ${myTeam === 1 ? 'relative' : ''}`}>
              {myTeam === 1 && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-lime-500/20 text-lime-400 text-xs rounded-full whitespace-nowrap border border-lime-500/30">
                  {t.yourTeam}
                </span>
              )}
              <div className="flex flex-col items-center">
                {team1Logo ? (
                  <img src={team1Logo} alt={team1Name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border-2 border-lime-500/30 mb-2" />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-lime-500/20 border-2 border-lime-500/30 flex items-center justify-center mb-2">
                    <Users className="w-8 h-8 text-lime-400" />
                  </div>
                )}
                <h3 className="text-white font-bold text-sm sm:text-lg truncate max-w-[120px] sm:max-w-[180px]">
                  {team1Name}
                </h3>
                {match.team1Squad?.tag && (
                  <span className="text-lime-400 text-xs">[{match.team1Squad.tag}]</span>
                )}
                <div className="flex items-center gap-1.5 mt-1">
                  <img src={team1Rank.image} alt={team1Rank.name} className="w-5 h-5 object-contain" onError={(e) => e.target.style.display = 'none'} />
                  <span className="text-lime-400/70 text-xs font-medium">{team1Rank.name}</span>
                </div>
                <span className="text-lime-400/50 text-xs">{team1TotalPoints} pts</span>
                {winner === 1 && (
                  <div className="flex items-center gap-1 mt-1 text-lime-400">
                    <Trophy className="w-4 h-4" />
                    <span className="text-xs font-bold">{t.winner}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* VS */}
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-dark-800 border-2 border-lime-500/30 flex items-center justify-center">
                <span className="text-lime-400 font-black text-lg sm:text-xl">{t.vs}</span>
              </div>
              <p className="text-lime-400/60 text-xs mt-2">5v5</p>
            </div>
            
            {/* Team 2 */}
            <div className={`flex-1 text-center ${myTeam === 2 ? 'relative' : ''}`}>
              {myTeam === 2 && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full whitespace-nowrap border border-blue-500/30">
                  {t.yourTeam}
                </span>
              )}
              <div className="flex flex-col items-center">
                {team2Logo ? (
                  <img src={team2Logo} alt={team2Name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border-2 border-blue-500/30 mb-2" />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-blue-500/20 border-2 border-blue-500/30 flex items-center justify-center mb-2">
                    <Users className="w-8 h-8 text-blue-400" />
                  </div>
                )}
                <h3 className="text-white font-bold text-sm sm:text-lg truncate max-w-[120px] sm:max-w-[180px]">
                  {team2Name}
                </h3>
                {match.team2Squad?.tag && (
                  <span className="text-blue-400 text-xs">[{match.team2Squad.tag}]</span>
                )}
                <div className="flex items-center gap-1.5 mt-1">
                  <img src={team2Rank.image} alt={team2Rank.name} className="w-5 h-5 object-contain" onError={(e) => e.target.style.display = 'none'} />
                  <span className="text-blue-400/70 text-xs font-medium">{team2Rank.name}</span>
                </div>
                <span className="text-blue-400/50 text-xs">{team2TotalPoints} pts</span>
                {winner === 2 && (
                  <div className="flex items-center gap-1 mt-1 text-blue-400">
                    <Trophy className="w-4 h-4" />
                    <span className="text-xs font-bold">{t.winner}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Match Complete Banner */}
        {isCompleted && (
          <div className={`mb-6 p-6 rounded-2xl ${didWin ? 'bg-gradient-to-r from-lime-500/20 to-green-500/20 border border-lime-500/30' : 'bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30'}`}>
            <div className="text-center">
              <h2 className={`text-3xl font-black mb-2 ${didWin ? 'text-lime-400' : 'text-red-400'}`}>
                {didWin ? t.victory : t.defeat}
              </h2>
              <p className="text-gray-400">
                {didWin ? t.yourTeamWon : t.yourTeamLost}
              </p>
              {myPlayer?.rewards && (
                <div className="flex items-center justify-center gap-6 mt-4">
                  <div className={`px-4 py-2 rounded-lg ${didWin ? 'bg-lime-500/20 text-lime-400' : 'bg-red-500/20 text-red-400'}`}>
                    <span className="font-bold">{didWin ? '+' : ''}{myPlayer.rewards.pointsChange}</span> pts
                  </div>
                  <div className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400">
                    <span className="font-bold">+{myPlayer.rewards.goldEarned}</span> gold
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Team 1 Roster & Actions */}
          <div className="space-y-4">
            {/* Team 1 Roster */}
            <div className={`bg-dark-900 border rounded-2xl p-5 ${winner === 1 ? 'border-lime-500/50' : 'border-lime-500/20'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-lime-400" />
                  {team1Name}
                </h3>
                {match.hostTeam === 1 && (
                  <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-bold">{t.host}</span>
                )}
              </div>
              <div className="space-y-2">
                {team1Players.map((player, idx) => {
                  const isRef = player.isReferent;
                  return (
                    <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl ${isRef ? 'bg-lime-500/10 border border-lime-500/30' : 'bg-dark-800/50'}`}>
                      {player.user ? (
                        <img 
                          src={getUserAvatar(player.user)} 
                          alt={player.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-dark-700 flex items-center justify-center">
                          <Shield className="w-5 h-5 text-gray-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium truncate ${player.isFake ? 'text-gray-500' : 'text-white'}`}>
                            {player.username}
                          </span>
                          {isRef && <Crown className="w-4 h-4 text-amber-400" />}
                          {player.isFake && <span className="text-xs text-purple-400">(Bot)</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Map */}
            {match.selectedMap?.name && (
              <div className="bg-dark-900 border border-lime-500/20 rounded-2xl p-5">
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <Map className="w-5 h-5 text-lime-400" />
                  {t.selectedMap}
                </h3>
                <div className="text-center">
                  <p className="text-2xl font-bold text-lime-400">{match.selectedMap.name}</p>
                </div>
              </div>
            )}
          </div>

          {/* Center Column - Chat */}
          <div className="lg:col-span-1">
            <div className="bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-lime-500/20 p-4 h-full flex flex-col">
              <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2 uppercase tracking-wider">
                <MessageCircle className="w-4 h-4" />
                {t.chat}
              </h2>
              
              {/* Messages */}
              <div 
                ref={chatRef}
                className="flex-1 min-h-[400px] max-h-[500px] overflow-y-auto space-y-2 mb-4 p-3 bg-dark-800/50 rounded-xl"
              >
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    {language === 'fr' ? 'Aucun message' : 'No messages'}
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isOwnMessage = msg.user?._id === user?._id || msg.user === user?._id;
                    return (
                      <div 
                        key={idx} 
                        className={`p-2.5 rounded-lg ${
                          msg.isSystem 
                            ? 'bg-lime-500/10 border border-lime-500/20 text-center' 
                            : isOwnMessage
                              ? 'bg-lime-500/20 ml-4'
                              : 'bg-dark-700 mr-4'
                        }`}
                      >
                        {msg.isSystem ? (
                          <span className="text-lime-400 text-sm">{msg.message}</span>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`font-bold text-xs ${msg.team === 1 ? 'text-lime-400' : 'text-blue-400'}`}>
                                {msg.user?.username || msg.username}
                              </span>
                              <span className="text-gray-600 text-xs">
                                {new Date(msg.createdAt).toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <span className="text-white text-sm">{msg.message}</span>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              
              {/* Chat Input */}
              {match.status !== 'completed' && match.status !== 'cancelled' && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder={t.typeMessage}
                    className="flex-1 px-4 py-2.5 bg-dark-800 border border-lime-500/30 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-lime-500"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={sendingMessage || !newMessage.trim()}
                    className="p-2.5 bg-lime-500 hover:bg-lime-600 text-white rounded-xl transition-colors disabled:opacity-50"
                  >
                    {sendingMessage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Team 2 Roster & Actions */}
          <div className="space-y-4">
            {/* Team 2 Roster */}
            <div className={`bg-dark-900 border rounded-2xl p-5 ${winner === 2 ? 'border-blue-500/50' : 'border-blue-500/20'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  {team2Name}
                </h3>
                {match.hostTeam === 2 && (
                  <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-bold">{t.host}</span>
                )}
              </div>
              <div className="space-y-2">
                {team2Players.map((player, idx) => {
                  const isRef = player.isReferent;
                  return (
                    <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl ${isRef ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-dark-800/50'}`}>
                      {player.user ? (
                        <img 
                          src={getUserAvatar(player.user)} 
                          alt={player.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-dark-700 flex items-center justify-center">
                          <Shield className="w-5 h-5 text-gray-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium truncate ${player.isFake ? 'text-gray-500' : 'text-white'}`}>
                            {player.username}
                          </span>
                          {isRef && <Crown className="w-4 h-4 text-amber-400" />}
                          {player.isFake && <span className="text-xs text-purple-400">(Bot)</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Result Voting */}
            {(match.status === 'in_progress' || match.status === 'disputed') && myTeam && (
              <div className={`bg-dark-900 border rounded-2xl p-5 ${match.status === 'disputed' ? 'border-red-500/30' : 'border-lime-500/20'}`}>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Trophy className={`w-5 h-5 ${match.status === 'disputed' ? 'text-red-400' : 'text-lime-400'}`} />
                  {t.reportResult}
                </h3>
                
                {/* Dispute notification */}
                {match.status === 'disputed' && (
                  <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <div className="flex items-center gap-2 text-red-400 mb-2">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="font-bold">{t.disputeTitle}</span>
                    </div>
                    <p className="text-gray-400 text-sm">{t.disputeDesc}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="p-2 bg-lime-500/10 rounded-lg text-center">
                        <span className="text-gray-400">{team1Name}:</span>
                        <span className="ml-2 text-lime-400 font-medium">
                          {match.result?.teamVotes?.[1]?.winner === 1 ? team1Name : team2Name}
                        </span>
                      </div>
                      <div className="p-2 bg-blue-500/10 rounded-lg text-center">
                        <span className="text-gray-400">{team2Name}:</span>
                        <span className="ml-2 text-blue-400 font-medium">
                          {match.result?.teamVotes?.[2]?.winner === 1 ? team1Name : team2Name}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Show current votes status */}
                {match.status !== 'disputed' && (match.result?.teamVotes?.[1] || match.result?.teamVotes?.[2]) && (
                  <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
                    <div className={`p-2 rounded-lg text-center ${match.result?.teamVotes?.[1] ? 'bg-lime-500/20 border border-lime-500/30' : 'bg-dark-800'}`}>
                      <span className="text-gray-400">{team1Name}:</span>
                      <span className={`ml-2 font-medium ${match.result?.teamVotes?.[1] ? 'text-lime-400' : 'text-gray-500'}`}>
                        {match.result?.teamVotes?.[1] 
                          ? (match.result.teamVotes[1].winner === 1 ? team1Name : team2Name)
                          : t.notVotedYet
                        }
                      </span>
                    </div>
                    <div className={`p-2 rounded-lg text-center ${match.result?.teamVotes?.[2] ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-dark-800'}`}>
                      <span className="text-gray-400">{team2Name}:</span>
                      <span className={`ml-2 font-medium ${match.result?.teamVotes?.[2] ? 'text-blue-400' : 'text-gray-500'}`}>
                        {match.result?.teamVotes?.[2] 
                          ? (match.result.teamVotes[2].winner === 1 ? team1Name : team2Name)
                          : t.notVotedYet
                        }
                      </span>
                    </div>
                  </div>
                )}
                
                {match.status !== 'disputed' && (
                  myVote ? (
                    <div className="text-center py-4">
                      <CheckCircle className="w-12 h-12 text-lime-400 mx-auto mb-2" />
                      <p className="text-lime-400 font-medium">
                        {t.yourTeamVoted}: {myVote === 1 ? team1Name : team2Name}
                      </p>
                      <p className="text-gray-500 text-sm mt-2">
                        {t.waitingOtherTeam}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleSubmitResult(1)}
                        disabled={submittingResult}
                        className="py-4 bg-lime-500/20 hover:bg-lime-500/30 text-lime-400 font-bold rounded-xl border border-lime-500/30 transition-all disabled:opacity-50"
                      >
                        {submittingResult ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : team1Name}
                      </button>
                      <button
                        onClick={() => handleSubmitResult(2)}
                        disabled={submittingResult}
                        className="py-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-bold rounded-xl border border-blue-500/30 transition-all disabled:opacity-50"
                      >
                        {submittingResult ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : team2Name}
                      </button>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Call Arbitrator */}
            {match.status !== 'completed' && match.status !== 'cancelled' && (
              <div className="bg-dark-900 border border-orange-500/20 rounded-2xl p-5">
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <Phone className="w-5 h-5 text-orange-400" />
                  {language === 'fr' ? 'Assistance' : 'Support'}
                </h3>
                
                {hasCalledArbitrator ? (
                  <div className="text-center py-2">
                    <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">{t.arbitratorCalled}</span>
                    </div>
                    <p className="text-gray-400 text-xs">
                      {t.arbitratorCalledDesc}
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handleCallArbitrator}
                    disabled={callingArbitrator}
                    className="w-full py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 bg-orange-500/20 border border-orange-500/40 text-orange-400 hover:bg-orange-500/30 disabled:opacity-50"
                  >
                    {callingArbitrator ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4" />
                        {t.callArbitrator}
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrickerMatchSheet;
