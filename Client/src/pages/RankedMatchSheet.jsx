import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { getDefaultAvatar, getAvatarUrl } from '../utils/avatar';
import { io } from 'socket.io-client';
import { 
  ArrowLeft, Trophy, Users, Clock, Coins, Send, Loader2, 
  TrendingUp, TrendingDown, Minus, Shield, Swords, MessageCircle,
  CheckCircle, XCircle, AlertTriangle, Crown, Copy, Check,
  Target, Zap, Star, Award
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';
const SOCKET_URL = 'https://api-nomercy.ggsecure.io';

const RankedMatchSheet = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const { user, isAuthenticated } = useAuth();
  const chatRef = useRef(null);
  const socketRef = useRef(null);

  const isHardcore = selectedMode === 'hardcore';
  const accentColor = isHardcore ? 'red' : 'cyan';
  const gradientFrom = isHardcore ? 'from-red-500' : 'from-cyan-400';
  const gradientTo = isHardcore ? 'to-orange-600' : 'to-cyan-600';

  // States
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState(null);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [submittingResult, setSubmittingResult] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [gameCode, setGameCode] = useState('');
  const [submittingCode, setSubmittingCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [battleReport, setBattleReport] = useState(null);

  // Translations
  const texts = {
    fr: {
      back: 'Retour',
      matchSheet: 'Match Classé',
      matchInfo: 'Informations du match',
      gameMode: 'Mode de jeu',
      status: 'Statut',
      rewards: 'Récompenses',
      coins: 'Pièces',
      points: 'Points',
      xp: 'XP',
      chat: 'Chat du match',
      typePlaceholder: 'Écrivez un message...',
      send: 'Envoyer',
      pending: 'En attente',
      inProgress: 'En cours',
      completed: 'Terminé',
      cancelled: 'Annulé',
      disputed: 'En litige',
      notFound: 'Match non trouvé',
      loadingError: 'Erreur de chargement',
      players: 'Joueurs',
      team1: 'Équipe 1',
      team2: 'Équipe 2',
      reportResult: 'Signaler le résultat',
      iWon: 'J\'ai gagné',
      theyWon: 'Ils ont gagné',
      team1Won: 'Équipe 1 a gagné',
      team2Won: 'Équipe 2 a gagné',
      confirmResult: 'Confirmer le résultat',
      waitingConfirmation: 'En attente de confirmation',
      matchEnded: 'Match terminé',
      winner: 'Gagnant',
      reportDispute: 'Signaler un litige',
      disputeReason: 'Raison du litige',
      disputeReasonPlaceholder: 'Décrivez le problème...',
      disputeWarning: 'Un litige bloquera le match jusqu\'à résolution.',
      submitDispute: 'Soumettre',
      matchDisputed: 'Match en litige',
      gameCode: 'Code de partie',
      enterCode: 'Entrez le code',
      submitCode: 'Valider',
      copyCode: 'Copier',
      codeCopied: 'Copié !',
      youAreHost: 'Vous êtes l\'hôte',
      waitingHost: 'En attente du code',
      map: 'Carte',
      rank: 'Rang',
      battleReport: 'Rapport de combat',
      victory: 'Victoire !',
      defeat: 'Défaite',
      xpGained: 'XP gagnée',
      coinsGained: 'Pièces gagnées',
      pointsChange: 'Points',
    },
    en: {
      back: 'Back',
      matchSheet: 'Ranked Match',
      matchInfo: 'Match Information',
      gameMode: 'Game Mode',
      status: 'Status',
      rewards: 'Rewards',
      coins: 'Coins',
      points: 'Points',
      xp: 'XP',
      chat: 'Match Chat',
      typePlaceholder: 'Type a message...',
      send: 'Send',
      pending: 'Pending',
      inProgress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
      disputed: 'Disputed',
      notFound: 'Match not found',
      loadingError: 'Loading error',
      players: 'Players',
      team1: 'Team 1',
      team2: 'Team 2',
      reportResult: 'Report Result',
      iWon: 'I won',
      theyWon: 'They won',
      team1Won: 'Team 1 won',
      team2Won: 'Team 2 won',
      confirmResult: 'Confirm result',
      waitingConfirmation: 'Waiting for confirmation',
      matchEnded: 'Match ended',
      winner: 'Winner',
      reportDispute: 'Report dispute',
      disputeReason: 'Dispute reason',
      disputeReasonPlaceholder: 'Describe the issue...',
      disputeWarning: 'A dispute will block the match until resolved.',
      submitDispute: 'Submit',
      matchDisputed: 'Match disputed',
      gameCode: 'Game Code',
      enterCode: 'Enter code',
      submitCode: 'Submit',
      copyCode: 'Copy',
      codeCopied: 'Copied!',
      youAreHost: 'You are hosting',
      waitingHost: 'Waiting for code',
      map: 'Map',
      rank: 'Rank',
      battleReport: 'Battle Report',
      victory: 'Victory!',
      defeat: 'Defeat',
      xpGained: 'XP gained',
      coinsGained: 'Coins earned',
      pointsChange: 'Points',
    },
    de: {
      back: 'Zurück',
      matchSheet: 'Ranked Match',
      matchInfo: 'Match-Informationen',
      gameMode: 'Spielmodus',
      status: 'Status',
      rewards: 'Belohnungen',
      coins: 'Münzen',
      points: 'Punkte',
      xp: 'XP',
      chat: 'Match-Chat',
      typePlaceholder: 'Nachricht schreiben...',
      send: 'Senden',
      pending: 'Ausstehend',
      inProgress: 'Läuft',
      completed: 'Abgeschlossen',
      cancelled: 'Abgebrochen',
      disputed: 'Umstritten',
      notFound: 'Match nicht gefunden',
      loadingError: 'Ladefehler',
      players: 'Spieler',
      team1: 'Team 1',
      team2: 'Team 2',
      reportResult: 'Ergebnis melden',
      iWon: 'Ich habe gewonnen',
      theyWon: 'Sie haben gewonnen',
      team1Won: 'Team 1 hat gewonnen',
      team2Won: 'Team 2 hat gewonnen',
      confirmResult: 'Ergebnis bestätigen',
      waitingConfirmation: 'Warte auf Bestätigung',
      matchEnded: 'Match beendet',
      winner: 'Gewinner',
      reportDispute: 'Streit melden',
      disputeReason: 'Streitgrund',
      disputeReasonPlaceholder: 'Beschreibe das Problem...',
      disputeWarning: 'Ein Streit blockiert das Match bis zur Lösung.',
      submitDispute: 'Einreichen',
      matchDisputed: 'Match umstritten',
      gameCode: 'Spielcode',
      enterCode: 'Code eingeben',
      submitCode: 'Bestätigen',
      copyCode: 'Kopieren',
      codeCopied: 'Kopiert!',
      youAreHost: 'Du bist Host',
      waitingHost: 'Warte auf Code',
      map: 'Karte',
      rank: 'Rang',
      battleReport: 'Kampfbericht',
      victory: 'Sieg!',
      defeat: 'Niederlage',
      xpGained: 'XP erhalten',
      coinsGained: 'Münzen erhalten',
      pointsChange: 'Punkte',
    },
    it: {
      back: 'Indietro',
      matchSheet: 'Match Classificato',
      matchInfo: 'Informazioni match',
      gameMode: 'Modalità',
      status: 'Stato',
      rewards: 'Ricompense',
      coins: 'Monete',
      points: 'Punti',
      xp: 'XP',
      chat: 'Chat match',
      typePlaceholder: 'Scrivi un messaggio...',
      send: 'Invia',
      pending: 'In attesa',
      inProgress: 'In corso',
      completed: 'Completato',
      cancelled: 'Annullato',
      disputed: 'Contestato',
      notFound: 'Match non trovato',
      loadingError: 'Errore di caricamento',
      players: 'Giocatori',
      team1: 'Squadra 1',
      team2: 'Squadra 2',
      reportResult: 'Segnala risultato',
      iWon: 'Ho vinto',
      theyWon: 'Hanno vinto',
      team1Won: 'Squadra 1 ha vinto',
      team2Won: 'Squadra 2 ha vinto',
      confirmResult: 'Conferma risultato',
      waitingConfirmation: 'In attesa di conferma',
      matchEnded: 'Match terminato',
      winner: 'Vincitore',
      reportDispute: 'Segnala disputa',
      disputeReason: 'Motivo disputa',
      disputeReasonPlaceholder: 'Descrivi il problema...',
      disputeWarning: 'Una disputa bloccherà il match fino alla risoluzione.',
      submitDispute: 'Invia',
      matchDisputed: 'Match contestato',
      gameCode: 'Codice partita',
      enterCode: 'Inserisci codice',
      submitCode: 'Conferma',
      copyCode: 'Copia',
      codeCopied: 'Copiato!',
      youAreHost: 'Sei l\'host',
      waitingHost: 'In attesa del codice',
      map: 'Mappa',
      rank: 'Rango',
      battleReport: 'Rapporto battaglia',
      victory: 'Vittoria!',
      defeat: 'Sconfitta',
      xpGained: 'XP guadagnata',
      coinsGained: 'Monete guadagnate',
      pointsChange: 'Punti',
    },
  };

  const t = texts[language] || texts.en;

  // Get avatar
  const getAvatar = (player) => {
    if (!player) return getDefaultAvatar('?');
    const u = player.user || player;
    return getAvatarUrl(u.avatarUrl || u.avatar) || (u.discordId ? `https://cdn.discordapp.com/avatars/${u.discordId}/${u.discordAvatar}.png` : getDefaultAvatar(u.username || '?'));
  };

  // Fetch match data
  const fetchMatch = async () => {
    try {
      const response = await fetch(`${API_URL}/ranked-matches/${matchId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success && data.match) {
        setMatch(data.match);
        setMessages(data.match.chat || []);
        if (data.match.gameCode) {
          setGameCode(data.match.gameCode);
        }
      } else {
        setError(data.message || t.notFound);
      }
    } catch (err) {
      console.error('Error fetching match:', err);
      setError(t.loadingError);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (matchId && isAuthenticated) {
      fetchMatch();
    }
  }, [matchId, isAuthenticated]);

  // Socket connection
  useEffect(() => {
    if (!matchId || !isAuthenticated) return;

    socketRef.current = io(SOCKET_URL, {
      withCredentials: true
    });

    socketRef.current.on('connect', () => {
      socketRef.current.emit('joinRankedMatch', matchId);
    });

    socketRef.current.on('newRankedMessage', (message) => {
      setMessages(prev => [...prev, message]);
    });

    socketRef.current.on('rankedMatchUpdate', (updatedMatch) => {
      setMatch(updatedMatch);
    });

    socketRef.current.on('rankedBattleReport', (report) => {
      setBattleReport(report);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leaveRankedMatch', matchId);
        socketRef.current.disconnect();
      }
    };
  }, [matchId, isAuthenticated]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || sendingMessage) return;

    setSendingMessage(true);
    try {
      const response = await fetch(`${API_URL}/ranked-matches/${matchId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: newMessage.trim() })
      });
      
      if (response.ok) {
        setNewMessage('');
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  // Submit game code
  const handleSubmitCode = async () => {
    if (!gameCode.trim() || submittingCode) return;

    setSubmittingCode(true);
    try {
      const response = await fetch(`${API_URL}/ranked-matches/${matchId}/game-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ gameCode: gameCode.trim() })
      });
      
      const data = await response.json();
      if (data.success) {
        setMatch(data.match);
      }
    } catch (err) {
      console.error('Error submitting code:', err);
    } finally {
      setSubmittingCode(false);
    }
  };

  // Copy code
  const handleCopyCode = () => {
    navigator.clipboard.writeText(match?.gameCode || gameCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  // Submit result
  const handleSubmitResult = async (winner) => {
    if (submittingResult) return;

    setSubmittingResult(true);
    try {
      const response = await fetch(`${API_URL}/ranked-matches/${matchId}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ winner })
      });
      
      const data = await response.json();
      if (data.success) {
        setMatch(data.match);
        setShowResultModal(false);
        if (data.battleReport) {
          setBattleReport(data.battleReport);
        }
      }
    } catch (err) {
      console.error('Error submitting result:', err);
    } finally {
      setSubmittingResult(false);
    }
  };

  // Submit dispute
  const handleSubmitDispute = async () => {
    if (!disputeReason.trim() || submittingDispute) return;

    setSubmittingDispute(true);
    try {
      const response = await fetch(`${API_URL}/ranked-matches/${matchId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: disputeReason.trim() })
      });
      
      const data = await response.json();
      if (data.success) {
        setMatch(data.match);
        setShowDisputeModal(false);
        setDisputeReason('');
      }
    } catch (err) {
      console.error('Error submitting dispute:', err);
    } finally {
      setSubmittingDispute(false);
    }
  };

  // Get status text and color
  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending': return { text: t.pending, color: 'yellow' };
      case 'in_progress': return { text: t.inProgress, color: 'blue' };
      case 'completed': return { text: t.completed, color: 'green' };
      case 'cancelled': return { text: t.cancelled, color: 'gray' };
      case 'disputed': return { text: t.disputed, color: 'orange' };
      default: return { text: status, color: 'gray' };
    }
  };

  // Check if user is host
  const isHost = match?.host?._id === user?._id || match?.host === user?._id;

  // Check if user is in the match
  const isInMatch = match?.players?.some(p => 
    (p.user?._id || p.user) === user?._id
  );

  // Get user's team
  const getUserTeam = () => {
    const player = match?.players?.find(p => (p.user?._id || p.user) === user?._id);
    return player?.team;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className={`w-8 h-8 text-${accentColor}-500 animate-spin`} />
          <p className="text-gray-400">{language === 'fr' ? 'Chargement...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-dark-950 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            {t.back}
          </button>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex items-center gap-4">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!match) return null;

  const statusInfo = getStatusInfo(match.status);

  return (
    <div className="min-h-screen bg-dark-950 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className={`flex items-center gap-2 text-gray-400 hover:text-${accentColor}-400 transition-colors`}
          >
            <ArrowLeft className="w-5 h-5" />
            {t.back}
          </button>
          
          <div className={`px-3 py-1 rounded-full bg-${statusInfo.color}-500/20 text-${statusInfo.color}-400 text-sm font-medium`}>
            {statusInfo.text}
          </div>
        </div>

        {/* Title */}
        <div className="flex items-center gap-4 mb-8">
          <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center`}>
            <Swords className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className={`text-3xl font-bold bg-gradient-to-r ${gradientFrom} ${gradientTo} bg-clip-text text-transparent`}>
              {t.matchSheet}
            </h1>
            <p className="text-gray-400">{match.gameMode} • {match.map?.name || 'TBD'}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Players */}
            <div className="bg-dark-900/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Users className={`w-5 h-5 text-${accentColor}-500`} />
                {t.players}
              </h2>
              
              {match.gameMode === 'Duel' ? (
                // Duel: 1v1
                <div className="grid grid-cols-3 gap-4 items-center">
                  {match.players.map((player, idx) => (
                    <React.Fragment key={player.user?._id || idx}>
                      {idx === 1 && (
                        <div className="flex items-center justify-center">
                          <span className={`text-2xl font-bold text-${accentColor}-500`}>VS</span>
                        </div>
                      )}
                      <Link
                        to={`/player/${player.user?._id}`}
                        className="flex flex-col items-center gap-2 p-4 bg-dark-800/50 rounded-xl hover:bg-dark-800 transition-colors"
                      >
                        <img
                          src={getAvatar(player)}
                          alt={player.user?.username}
                          className="w-16 h-16 rounded-full object-cover"
                          onError={(e) => { e.target.src = getDefaultAvatar(player.user?.username); }}
                        />
                        <span className="text-white font-medium">{player.user?.username}</span>
                        <span className={`text-xs text-${accentColor}-400`}>{player.rank}</span>
                      </Link>
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                // Team modes: 2 teams
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Team 1 */}
                  <div>
                    <h3 className="text-sm font-medium text-blue-400 mb-3">{t.team1}</h3>
                    <div className="space-y-2">
                      {match.players.filter(p => p.team === 1).map((player) => (
                        <Link
                          key={player.user?._id}
                          to={`/player/${player.user?._id}`}
                          className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors"
                        >
                          <img
                            src={getAvatar(player)}
                            alt={player.user?.username}
                            className="w-10 h-10 rounded-full object-cover"
                            onError={(e) => { e.target.src = getDefaultAvatar(player.user?.username); }}
                          />
                          <div>
                            <p className="text-white font-medium">{player.user?.username}</p>
                            <p className="text-xs text-gray-400">{player.rank}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                  
                  {/* Team 2 */}
                  <div>
                    <h3 className="text-sm font-medium text-red-400 mb-3">{t.team2}</h3>
                    <div className="space-y-2">
                      {match.players.filter(p => p.team === 2).map((player) => (
                        <Link
                          key={player.user?._id}
                          to={`/player/${player.user?._id}`}
                          className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors"
                        >
                          <img
                            src={getAvatar(player)}
                            alt={player.user?.username}
                            className="w-10 h-10 rounded-full object-cover"
                            onError={(e) => { e.target.src = getDefaultAvatar(player.user?.username); }}
                          />
                          <div>
                            <p className="text-white font-medium">{player.user?.username}</p>
                            <p className="text-xs text-gray-400">{player.rank}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Game Code */}
            {match.status === 'in_progress' && (
              <div className="bg-dark-900/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Target className={`w-5 h-5 text-${accentColor}-500`} />
                  {t.gameCode}
                </h2>
                
                {match.gameCode ? (
                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-dark-800 rounded-lg px-4 py-3 font-mono text-xl text-white">
                      {match.gameCode}
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className={`px-4 py-3 bg-${accentColor}-500 hover:bg-${accentColor}-600 rounded-lg text-white flex items-center gap-2 transition-colors`}
                    >
                      {codeCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      {codeCopied ? t.codeCopied : t.copyCode}
                    </button>
                  </div>
                ) : isHost ? (
                  <div className="flex gap-4">
                    <input
                      type="text"
                      value={gameCode}
                      onChange={(e) => setGameCode(e.target.value)}
                      placeholder={t.enterCode}
                      className="flex-1 bg-dark-800 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500"
                    />
                    <button
                      onClick={handleSubmitCode}
                      disabled={submittingCode || !gameCode.trim()}
                      className={`px-6 py-3 bg-${accentColor}-500 hover:bg-${accentColor}-600 rounded-lg text-white font-semibold disabled:opacity-50 transition-colors`}
                    >
                      {submittingCode ? <Loader2 className="w-5 h-5 animate-spin" /> : t.submitCode}
                    </button>
                  </div>
                ) : (
                  <p className="text-gray-400">{t.waitingHost}</p>
                )}
              </div>
            )}

            {/* Chat */}
            <div className="bg-dark-900/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <MessageCircle className={`w-5 h-5 text-${accentColor}-500`} />
                {t.chat}
              </h2>
              
              <div 
                ref={chatRef}
                className="h-64 overflow-y-auto space-y-3 mb-4 scrollbar-thin scrollbar-thumb-white/10"
              >
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-3 ${msg.isSystem ? 'justify-center' : ''}`}>
                    {msg.isSystem ? (
                      <p className="text-gray-500 text-sm italic">{msg.message}</p>
                    ) : (
                      <>
                        <img
                          src={getAvatar(msg)}
                          alt={msg.user?.username}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          onError={(e) => { e.target.src = getDefaultAvatar(msg.user?.username); }}
                        />
                        <div>
                          <p className="text-sm">
                            <span className={`font-medium text-${accentColor}-400`}>{msg.user?.username}</span>
                            <span className="text-gray-500 text-xs ml-2">
                              {new Date(msg.createdAt).toLocaleTimeString()}
                            </span>
                          </p>
                          <p className="text-gray-300">{msg.message}</p>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              
              {match.status !== 'completed' && match.status !== 'cancelled' && isInMatch && (
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder={t.typePlaceholder}
                    className="flex-1 bg-dark-800 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={sendingMessage || !newMessage.trim()}
                    className={`px-4 py-2 bg-${accentColor}-500 hover:bg-${accentColor}-600 rounded-lg text-white disabled:opacity-50 transition-colors`}
                  >
                    {sendingMessage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Match Info */}
            <div className="bg-dark-900/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">{t.matchInfo}</h2>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">{t.gameMode}</span>
                  <span className="text-white">{match.gameMode}</span>
                </div>
                {match.map?.name && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t.map}</span>
                    <span className="text-white">{match.map.name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">{t.rank}</span>
                  <span className={`text-${accentColor}-400 capitalize`}>{match.rankBracket}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            {match.status === 'in_progress' && isInMatch && (
              <div className="bg-dark-900/50 backdrop-blur-sm rounded-xl border border-white/10 p-6 space-y-3">
                <button
                  onClick={() => setShowResultModal(true)}
                  className={`w-full py-3 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-lg text-white font-semibold hover:opacity-90 transition-opacity`}
                >
                  {t.reportResult}
                </button>
                
                <button
                  onClick={() => setShowDisputeModal(true)}
                  className="w-full py-3 bg-orange-500/20 border border-orange-500/30 rounded-lg text-orange-400 font-medium hover:bg-orange-500/30 transition-colors"
                >
                  {t.reportDispute}
                </button>
              </div>
            )}

            {/* Winner display */}
            {match.status === 'completed' && match.result && (
              <div className="bg-dark-900/50 backdrop-blur-sm rounded-xl border border-green-500/30 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Trophy className="w-6 h-6 text-yellow-500" />
                  <h2 className="text-lg font-semibold text-white">{t.winner}</h2>
                </div>
                <p className="text-green-400 font-medium">
                  {match.result.winner === 'team1' ? t.team1 : 
                   match.result.winner === 'team2' ? t.team2 : 
                   match.result.winnerUser?.username || 'Winner'}
                </p>
              </div>
            )}

            {/* Disputed */}
            {match.status === 'disputed' && (
              <div className="bg-dark-900/50 backdrop-blur-sm rounded-xl border border-orange-500/30 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-6 h-6 text-orange-500" />
                  <h2 className="text-lg font-semibold text-orange-400">{t.matchDisputed}</h2>
                </div>
                <p className="text-gray-400 text-sm">{match.dispute?.reason}</p>
              </div>
            )}
          </div>
        </div>

        {/* Result Modal */}
        {showResultModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-dark-900 border border-white/10 rounded-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-white mb-6">{t.reportResult}</h3>
              
              {match.gameMode === 'Duel' ? (
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleSubmitResult('self')}
                    disabled={submittingResult}
                    className="py-4 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 font-semibold hover:bg-green-500/30 transition-colors"
                  >
                    {t.iWon}
                  </button>
                  <button
                    onClick={() => handleSubmitResult('opponent')}
                    disabled={submittingResult}
                    className="py-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 font-semibold hover:bg-red-500/30 transition-colors"
                  >
                    {t.theyWon}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleSubmitResult('team1')}
                    disabled={submittingResult}
                    className="py-4 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 font-semibold hover:bg-blue-500/30 transition-colors"
                  >
                    {t.team1Won}
                  </button>
                  <button
                    onClick={() => handleSubmitResult('team2')}
                    disabled={submittingResult}
                    className="py-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 font-semibold hover:bg-red-500/30 transition-colors"
                  >
                    {t.team2Won}
                  </button>
                </div>
              )}
              
              <button
                onClick={() => setShowResultModal(false)}
                className="w-full mt-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                {language === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
            </div>
          </div>
        )}

        {/* Dispute Modal */}
        {showDisputeModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-dark-900 border border-white/10 rounded-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-white mb-4">{t.reportDispute}</h3>
              
              <p className="text-orange-400 text-sm mb-4">{t.disputeWarning}</p>
              
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder={t.disputeReasonPlaceholder}
                className="w-full h-32 bg-dark-800 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 resize-none mb-4"
              />
              
              <div className="flex gap-4">
                <button
                  onClick={() => setShowDisputeModal(false)}
                  className="flex-1 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  {language === 'fr' ? 'Annuler' : 'Cancel'}
                </button>
                <button
                  onClick={handleSubmitDispute}
                  disabled={submittingDispute || !disputeReason.trim()}
                  className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-white font-semibold disabled:opacity-50 transition-colors"
                >
                  {submittingDispute ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t.submitDispute}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Battle Report Modal */}
        {battleReport && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-dark-900 border border-white/10 rounded-xl max-w-md w-full p-6 text-center">
              <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${battleReport.isWinner ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                {battleReport.isWinner ? (
                  <Trophy className="w-10 h-10 text-yellow-500" />
                ) : (
                  <XCircle className="w-10 h-10 text-red-500" />
                )}
              </div>
              
              <h3 className={`text-2xl font-bold mb-6 ${battleReport.isWinner ? 'text-green-400' : 'text-red-400'}`}>
                {battleReport.isWinner ? t.victory : t.defeat}
              </h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center p-3 bg-dark-800 rounded-lg">
                  <span className="text-gray-400 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    {t.xpGained}
                  </span>
                  <span className="text-white font-bold">+{battleReport.xp || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-dark-800 rounded-lg">
                  <span className="text-gray-400 flex items-center gap-2">
                    <Coins className="w-4 h-4" />
                    {t.coinsGained}
                  </span>
                  <span className="text-yellow-400 font-bold">+{battleReport.coins || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-dark-800 rounded-lg">
                  <span className="text-gray-400 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    {t.pointsChange}
                  </span>
                  <span className={`font-bold ${battleReport.points >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {battleReport.points >= 0 ? '+' : ''}{battleReport.points || 0}
                  </span>
                </div>
              </div>
              
              <button
                onClick={() => setBattleReport(null)}
                className={`w-full py-3 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-lg text-white font-semibold hover:opacity-90 transition-opacity`}
              >
                {language === 'fr' ? 'Continuer' : 'Continue'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RankedMatchSheet;
