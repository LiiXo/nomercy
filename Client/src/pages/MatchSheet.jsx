import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { 
  ArrowLeft, Trophy, Users, Clock, Coins, Send, Loader2, 
  TrendingUp, TrendingDown, Minus, Shield, Swords, MessageCircle,
  CheckCircle, XCircle, AlertTriangle, Crown
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const MatchSheet = () => {
  const { matchId } = useParams();
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
  const [match, setMatch] = useState(null);
  const [error, setError] = useState(null);
  const [mySquad, setMySquad] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [ladderData, setLadderData] = useState(null);
  const [submittingResult, setSubmittingResult] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [gameCode, setGameCode] = useState('');
  const [submittingCode, setSubmittingCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Points configuration
  const POINTS_WIN = 25;
  const POINTS_LOSS = -10;
  const COINS_WIN = 50;

  // Translations
  const t = {
    fr: {
      back: 'Retour',
      matchSheet: 'Feuille de match',
      matchInfo: 'Informations du match',
      gameMode: 'Mode de jeu',
      format: 'Format',
      ladder: 'Classement',
      status: 'Statut',
      scheduledAt: 'Prévu à',
      startedAt: 'Début du match',
      rewards: 'Récompenses en cas de victoire',
      coins: 'Pièces',
      points: 'Points',
      rankPreview: 'Prévisualisation classement',
      currentRank: 'Position actuelle',
      ifWin: 'Si victoire',
      ifLoss: 'Si défaite',
      promotion: 'Monté',
      stagnation: 'Stagné',
      demotion: 'Descente',
      chat: 'Chat du match',
      typePlaceholder: 'Écrivez un message...',
      send: 'Envoyer',
      vs: 'VS',
      pending: 'En attente',
      accepted: 'Accepté',
      inProgress: 'En cours',
      completed: 'Terminé',
      cancelled: 'Annulé',
      duoTrio: 'Duo / Trio',
      squadTeam: 'Squad / Team',
      notFound: 'Match non trouvé',
      loadingError: 'Erreur de chargement',
      yourTeam: 'Votre équipe',
      reportResult: 'Signaler le résultat',
      waitingOpponent: 'En attente de l\'adversaire',
      ready: 'Prêt',
      endMatch: 'Terminer le match',
      selectWinner: 'Sélectionner le gagnant',
      weWon: 'Nous avons gagné',
      theyWon: 'Ils ont gagné',
      onlyLeader: 'Seul le leader peut valider',
      matchEnded: 'Match terminé',
      winner: 'Gagnant',
      reportDispute: 'Signaler un litige',
      disputeReason: 'Raison du litige',
      disputeReasonPlaceholder: 'Décrivez le problème...',
      disputeWarning: 'Un litige bloquera le match jusqu\'à ce qu\'un membre du staff le résolve.',
      submitDispute: 'Soumettre le litige',
      matchDisputed: 'Match en litige',
      disputeInfo: 'Ce match est en cours d\'examen par le staff.',
      disputedBy: 'Signalé par',
      staffMessage: 'STAFF',
      gameCode: 'Code de partie',
      waitingForCode: 'En attente du code',
      hostTeam: 'Équipe hôte',
      enterCode: 'Entrez le code de partie',
      codePlaceholder: 'Ex: ABCD1234',
      submitCode: 'Valider',
      copyCode: 'Copier',
      codeCopied: 'Code copié !',
      joinWithCode: 'Rejoignez avec ce code',
      youAreHost: 'Vous hébergez la partie',
      waitingHost: 'En attente du code de l\'hôte',
      roster: 'Roster',
      players: 'Joueurs',
      helper: 'Aide',
      noRoster: 'Aucun roster défini',
    },
    en: {
      back: 'Back',
      matchSheet: 'Match Sheet',
      matchInfo: 'Match Information',
      gameMode: 'Game Mode',
      format: 'Format',
      ladder: 'Ladder',
      status: 'Status',
      scheduledAt: 'Scheduled at',
      startedAt: 'Match started',
      rewards: 'Rewards if you win',
      coins: 'Coins',
      points: 'Points',
      rankPreview: 'Rank Preview',
      currentRank: 'Current rank',
      ifWin: 'If win',
      ifLoss: 'If loss',
      promotion: 'Promoted',
      stagnation: 'Same',
      demotion: 'Demoted',
      chat: 'Match Chat',
      typePlaceholder: 'Type a message...',
      send: 'Send',
      vs: 'VS',
      pending: 'Pending',
      accepted: 'Accepted',
      inProgress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
      duoTrio: 'Duo / Trio',
      squadTeam: 'Squad / Team',
      notFound: 'Match not found',
      loadingError: 'Loading error',
      yourTeam: 'Your team',
      reportResult: 'Report Result',
      waitingOpponent: 'Waiting for opponent',
      ready: 'Ready',
      endMatch: 'End match',
      selectWinner: 'Select winner',
      weWon: 'We won',
      theyWon: 'They won',
      onlyLeader: 'Only the leader can validate',
      matchEnded: 'Match ended',
      winner: 'Winner',
      reportDispute: 'Report dispute',
      disputeReason: 'Dispute reason',
      disputeReasonPlaceholder: 'Describe the issue...',
      disputeWarning: 'A dispute will block the match until staff resolves it.',
      submitDispute: 'Submit dispute',
      matchDisputed: 'Match disputed',
      disputeInfo: 'This match is being reviewed by staff.',
      disputedBy: 'Reported by',
      staffMessage: 'STAFF',
      gameCode: 'Game Code',
      waitingForCode: 'Waiting for code',
      hostTeam: 'Host team',
      enterCode: 'Enter game code',
      codePlaceholder: 'Ex: ABCD1234',
      submitCode: 'Submit',
      copyCode: 'Copy',
      codeCopied: 'Code copied!',
      joinWithCode: 'Join with this code',
      youAreHost: 'You are hosting',
      waitingHost: 'Waiting for host code',
      roster: 'Roster',
      players: 'Players',
      helper: 'Helper',
      noRoster: 'No roster defined',
    },
    de: {
      back: 'Zurück',
      matchSheet: 'Spielblatt',
      matchInfo: 'Spielinformationen',
      gameMode: 'Spielmodus',
      format: 'Format',
      ladder: 'Rangliste',
      status: 'Status',
      scheduledAt: 'Geplant für',
      startedAt: 'Spielbeginn',
      rewards: 'Belohnungen bei Sieg',
      coins: 'Münzen',
      points: 'Punkte',
      rankPreview: 'Rangvorschau',
      currentRank: 'Aktueller Rang',
      ifWin: 'Bei Sieg',
      ifLoss: 'Bei Niederlage',
      promotion: 'Aufgestiegen',
      stagnation: 'Gleich',
      demotion: 'Abgestiegen',
      chat: 'Match Chat',
      typePlaceholder: 'Nachricht eingeben...',
      send: 'Senden',
      vs: 'VS',
      pending: 'Ausstehend',
      accepted: 'Akzeptiert',
      inProgress: 'Im Gange',
      completed: 'Abgeschlossen',
      cancelled: 'Abgebrochen',
      duoTrio: 'Duo / Trio',
      squadTeam: 'Squad / Team',
      notFound: 'Match nicht gefunden',
      loadingError: 'Ladefehler',
      yourTeam: 'Dein Team',
      reportResult: 'Ergebnis melden',
      waitingOpponent: 'Warte auf Gegner',
      ready: 'Bereit',
      endMatch: 'Spiel beenden',
      selectWinner: 'Gewinner wählen',
      weWon: 'Wir haben gewonnen',
      theyWon: 'Sie haben gewonnen',
      onlyLeader: 'Nur der Leader kann bestätigen',
      matchEnded: 'Spiel beendet',
      winner: 'Gewinner',
      reportDispute: 'Streitfall melden',
      disputeReason: 'Grund des Streits',
      disputeReasonPlaceholder: 'Beschreiben Sie das Problem...',
      disputeWarning: 'Ein Streitfall blockiert das Spiel bis das Staff es löst.',
      submitDispute: 'Streitfall einreichen',
      matchDisputed: 'Spiel im Streit',
      disputeInfo: 'Dieses Spiel wird vom Staff überprüft.',
      disputedBy: 'Gemeldet von',
      staffMessage: 'STAFF',
      gameCode: 'Spielcode',
      waitingForCode: 'Warte auf Code',
      hostTeam: 'Host-Team',
      enterCode: 'Spielcode eingeben',
      codePlaceholder: 'Z.B.: ABCD1234',
      submitCode: 'Absenden',
      copyCode: 'Kopieren',
      codeCopied: 'Code kopiert!',
      joinWithCode: 'Mit diesem Code beitreten',
      youAreHost: 'Sie hosten das Spiel',
      waitingHost: 'Warte auf Host-Code',
      roster: 'Roster',
      players: 'Spieler',
      helper: 'Helfer',
      noRoster: 'Kein Roster definiert',
    },
    it: {
      back: 'Indietro',
      matchSheet: 'Scheda partita',
      matchInfo: 'Informazioni partita',
      gameMode: 'Modalità',
      format: 'Formato',
      ladder: 'Classifica',
      status: 'Stato',
      scheduledAt: 'Programmato per',
      startedAt: 'Inizio partita',
      rewards: 'Ricompense in caso di vittoria',
      coins: 'Monete',
      points: 'Punti',
      rankPreview: 'Anteprima classifica',
      currentRank: 'Posizione attuale',
      ifWin: 'Se vinci',
      ifLoss: 'Se perdi',
      promotion: 'Promosso',
      stagnation: 'Stabile',
      demotion: 'Retrocesso',
      chat: 'Chat partita',
      typePlaceholder: 'Scrivi un messaggio...',
      send: 'Invia',
      vs: 'VS',
      pending: 'In attesa',
      accepted: 'Accettato',
      inProgress: 'In corso',
      completed: 'Completato',
      cancelled: 'Annullato',
      duoTrio: 'Duo / Trio',
      squadTeam: 'Squad / Team',
      notFound: 'Partita non trovata',
      loadingError: 'Errore di caricamento',
      yourTeam: 'La tua squadra',
      reportResult: 'Segnala risultato',
      waitingOpponent: 'In attesa dell\'avversario',
      ready: 'Pronto',
      endMatch: 'Termina partita',
      selectWinner: 'Seleziona vincitore',
      weWon: 'Abbiamo vinto',
      theyWon: 'Hanno vinto',
      onlyLeader: 'Solo il leader può confermare',
      matchEnded: 'Partita terminata',
      winner: 'Vincitore',
      reportDispute: 'Segnala controversia',
      disputeReason: 'Motivo della controversia',
      disputeReasonPlaceholder: 'Descrivi il problema...',
      disputeWarning: 'Una controversia bloccherà la partita fino a quando lo staff non la risolverà.',
      submitDispute: 'Invia controversia',
      matchDisputed: 'Partita in controversia',
      disputeInfo: 'Questa partita è in fase di revisione da parte dello staff.',
      disputedBy: 'Segnalato da',
      staffMessage: 'STAFF',
      gameCode: 'Codice partita',
      waitingForCode: 'In attesa del codice',
      hostTeam: 'Squadra ospitante',
      enterCode: 'Inserisci il codice partita',
      codePlaceholder: 'Es: ABCD1234',
      submitCode: 'Invia',
      copyCode: 'Copia',
      codeCopied: 'Codice copiato!',
      joinWithCode: 'Unisciti con questo codice',
      youAreHost: 'Stai ospitando',
      waitingHost: 'In attesa del codice host',
      roster: 'Roster',
      players: 'Giocatori',
      helper: 'Aiuto',
      noRoster: 'Nessun roster definito',
    },
  }[language] || {
    back: 'Back',
    matchSheet: 'Match Sheet',
    // ... default to English
  };

  // Track if initial load is done
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Fetch match data
  const fetchMatchData = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const response = await fetch(`${API_URL}/matches/${matchId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        // Store staff status
        if (data.isStaff !== undefined) {
          setIsStaff(data.isStaff);
        }
        
        // Only update if data changed (compare by stringifying key fields)
        setMatch(prev => {
          if (!prev || prev.status !== data.match.status || prev.opponent?._id !== data.match.opponent?._id || prev.dispute?.reportedAt !== data.match.dispute?.reportedAt) {
            return data.match;
          }
          return prev;
        });
        
        // Only update messages if count changed
        setMessages(prev => {
          const newMessages = data.match.chat || [];
          if (prev.length !== newMessages.length) {
            return newMessages;
          }
          return prev;
        });
        
        // Fetch ladder data only on initial load
        if (isInitial && data.match.ladderId) {
          const ladderRes = await fetch(`${API_URL}/squads/ladder/${data.match.ladderId}/leaderboard?limit=100`);
          const ladderData = await ladderRes.json();
          if (ladderData.success) {
            setLadderData(ladderData.squads);
          }
        }
      } else {
        setError(t.notFound);
      }
    } catch (err) {
      console.error('Error fetching match:', err);
      if (isInitial) setError(t.loadingError);
    } finally {
      if (isInitial) {
        setLoading(false);
        setInitialLoadDone(true);
      }
    }
  };

  // Fetch my squad
  const fetchMySquad = async () => {
    if (!isAuthenticated) return;
    try {
      const response = await fetch(`${API_URL}/squads/my-squad`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success && data.squad) {
        setMySquad(data.squad);
      }
    } catch (err) {
      console.error('Error fetching my squad:', err);
    }
  };

  useEffect(() => {
    fetchMatchData(true);
    fetchMySquad();
  }, [matchId, isAuthenticated]);

  // Poll for updates every 30 seconds (silent, only after initial load)
  useEffect(() => {
    if (!initialLoadDone) return;
    
    const interval = setInterval(() => fetchMatchData(false), 30000);
    return () => clearInterval(interval);
  }, [initialLoadDone, matchId]);

  // Chat container ref for scrolling
  const chatContainerRef = useRef(null);
  
  // Scroll to bottom of chat
  const scrollChatToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  // Scroll chat to bottom on initial load when messages are available
  const initialScrollDone = useRef(false);
  useEffect(() => {
    if (initialLoadDone && messages.length > 0 && !initialScrollDone.current) {
      setTimeout(() => {
        scrollChatToBottom();
        initialScrollDone.current = true;
      }, 100);
    }
  }, [initialLoadDone, messages.length]);

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sendingMessage) return;

    setSendingMessage(true);
    try {
      const response = await fetch(`${API_URL}/matches/${matchId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: newMessage.trim() })
      });

      const data = await response.json();
      if (data.success) {
        setMessages(prev => [...prev, data.message]);
        setNewMessage('');
        // Scroll chat after a small delay to let the DOM update
        setTimeout(scrollChatToBottom, 50);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  // Check if user is leader of their squad
  const isLeader = () => {
    if (!mySquad || !user) return false;
    const member = mySquad.members?.find(m => 
      (m.user?._id || m.user) === user.id
    );
    return member?.role === 'leader';
  };

  // Submit match result
  const handleSubmitResult = async (winnerId) => {
    if (!isLeader()) return;
    
    setSubmittingResult(true);
    try {
      const response = await fetch(`${API_URL}/matches/${matchId}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ winnerId })
      });

      const data = await response.json();
      if (data.success) {
        setMatch(data.match);
        setShowResultModal(false);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error('Error submitting result:', err);
    } finally {
      setSubmittingResult(false);
    }
  };

  // Submit game code
  const handleSubmitCode = async () => {
    if (!gameCode.trim()) return;
    
    setSubmittingCode(true);
    try {
      const response = await fetch(`${API_URL}/matches/${matchId}/code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: gameCode })
      });

      const data = await response.json();
      if (data.success) {
        setMatch(data.match);
        setGameCode('');
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error('Error submitting code:', err);
    } finally {
      setSubmittingCode(false);
    }
  };

  // Copy code to clipboard
  const handleCopyCode = () => {
    if (match.gameCode) {
      navigator.clipboard.writeText(match.gameCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  // Check if my team is the host
  const isMyTeamHost = () => {
    return mySquad && match.hostTeam && match.hostTeam._id === mySquad._id;
  };

  // Submit dispute
  const handleSubmitDispute = async () => {
    if (!disputeReason.trim()) return;
    
    setSubmittingDispute(true);
    try {
      const response = await fetch(`${API_URL}/matches/${matchId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: disputeReason })
      });

      const data = await response.json();
      if (data.success) {
        setMatch(data.match);
        setShowDisputeModal(false);
        setDisputeReason('');
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error('Error submitting dispute:', err);
    } finally {
      setSubmittingDispute(false);
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { color: 'yellow', text: t.pending },
      accepted: { color: 'blue', text: t.accepted },
      in_progress: { color: 'green', text: t.inProgress },
      completed: { color: 'gray', text: t.completed },
      cancelled: { color: 'red', text: t.cancelled },
      disputed: { color: 'orange', text: t.matchDisputed },
    };
    return statusMap[status] || statusMap.pending;
  };

  // Get current rank in ladder
  const getCurrentRank = () => {
    if (!ladderData || !mySquad) return null;
    const myRank = ladderData.find(s => s._id === mySquad._id);
    return myRank?.rank || ladderData.length + 1;
  };

  // Calculate potential rank after win/loss
  const getPotentialRank = (isWin) => {
    if (!ladderData || !mySquad) return null;
    
    const currentRank = getCurrentRank();
    const myLadderData = mySquad.registeredLadders?.find(l => l.ladderId === match?.ladderId);
    const currentPoints = myLadderData?.points || 0;
    const newPoints = currentPoints + (isWin ? POINTS_WIN : POINTS_LOSS);
    
    // Count how many squads would be ahead
    let newRank = 1;
    for (const squad of ladderData) {
      if (squad._id !== mySquad._id) {
        const squadLadder = squad.registeredLadders?.find(l => l.ladderId === match?.ladderId);
        const squadPoints = squadLadder?.points || squad.ladderPoints || 0;
        if (squadPoints > newPoints) {
          newRank++;
        }
      }
    }
    
    return newRank;
  };

  // Get rank change indicator
  const getRankChange = (currentRank, newRank) => {
    if (newRank < currentRank) {
      return { icon: TrendingUp, color: 'text-green-400', label: t.promotion };
    } else if (newRank > currentRank) {
      return { icon: TrendingDown, color: 'text-red-400', label: t.demotion };
    }
    return { icon: Minus, color: 'text-gray-400', label: t.stagnation };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <Loader2 className={`w-12 h-12 animate-spin ${isHardcore ? 'text-red-500' : 'text-cyan-500'}`} />
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">{error || t.notFound}</h2>
          <button
            onClick={() => navigate(-1)}
            className={`mt-4 px-6 py-2 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-lg text-white font-medium`}
          >
            {t.back}
          </button>
        </div>
      </div>
    );
  }

  const isMyTeamChallenger = mySquad?._id === match.challenger?._id;
  const isMyTeamOpponent = mySquad?._id === match.opponent?._id;
  const isParticipant = isMyTeamChallenger || isMyTeamOpponent;
  const statusBadge = getStatusBadge(match.status);
  const currentRank = getCurrentRank();
  const potentialWinRank = getPotentialRank(true);
  const potentialLossRank = getPotentialRank(false);

  return (
    <div className="min-h-screen bg-dark-950 relative">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-0 left-1/4 w-96 h-96 bg-${accentColor}-500/10 rounded-full blur-3xl`}></div>
        <div className={`absolute bottom-0 right-1/4 w-96 h-96 bg-${accentColor}-500/5 rounded-full blur-3xl`}></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-8 gap-2">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center space-x-1 sm:space-x-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 sm:w-5 h-4 sm:h-5" />
            <span className="text-sm sm:text-base hidden sm:inline">{t.back}</span>
          </button>
          <h1 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
            <Swords className={`w-5 sm:w-6 h-5 sm:h-6 ${isHardcore ? 'text-red-400' : 'text-cyan-400'}`} />
            <span className="hidden sm:inline">{t.matchSheet}</span>
            <span className="sm:hidden">Match</span>
          </h1>
          <div className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-${statusBadge.color}-500/20 border border-${statusBadge.color}-500/30`}>
            <span className={`text-${statusBadge.color}-400 text-xs sm:text-sm font-semibold`}>{statusBadge.text}</span>
          </div>
        </div>

        {/* Teams Header */}
        <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-${accentColor}-500/20 p-4 sm:p-6 mb-4 sm:mb-6`}>
          <div className="flex items-center justify-center gap-3 sm:gap-8">
            {/* Challenger */}
            <div className={`flex-1 text-center ${isMyTeamChallenger ? 'relative' : ''}`}>
              {isMyTeamChallenger && (
                <span className="absolute -top-1 sm:-top-2 left-1/2 -translate-x-1/2 px-1.5 sm:px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] sm:text-xs rounded-full whitespace-nowrap">
                  {t.yourTeam}
                </span>
              )}
              <Link to={`/squad/${match.challenger?._id}`} className="group">
                {match.challenger?.logo ? (
                  <img 
                    src={match.challenger.logo} 
                    alt={match.challenger.name}
                    className="w-12 h-12 sm:w-20 sm:h-20 rounded-lg sm:rounded-xl mx-auto mb-2 sm:mb-3 border-2 border-white/20 group-hover:border-white/40 transition-colors object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-lg sm:rounded-xl mx-auto mb-2 sm:mb-3 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center border-2 border-white/20 group-hover:border-white/40 transition-colors">
                    <Shield className="w-6 h-6 sm:w-10 sm:h-10 text-gray-500" />
                  </div>
                )}
                <h3 className={`text-sm sm:text-xl font-bold group-hover:text-${accentColor}-400 transition-colors truncate ${isMyTeamChallenger ? 'text-yellow-400' : 'text-white'}`}>
                  {match.challenger?.name}
                </h3>
                {match.challenger?.tag && (
                  <span className="text-gray-500 text-xs sm:text-sm hidden sm:inline">[{match.challenger.tag}]</span>
                )}
              </Link>
            </div>

            {/* VS */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center shadow-lg shadow-${accentColor}-500/30`}>
                <span className="text-white font-black text-sm sm:text-xl">{t.vs}</span>
              </div>
            </div>

            {/* Opponent */}
            <div className={`flex-1 text-center ${isMyTeamOpponent ? 'relative' : ''}`}>
              {isMyTeamOpponent && (
                <span className="absolute -top-1 sm:-top-2 left-1/2 -translate-x-1/2 px-1.5 sm:px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] sm:text-xs rounded-full whitespace-nowrap">
                  {t.yourTeam}
                </span>
              )}
              {match.opponent ? (
                <Link to={`/squad/${match.opponent?._id}`} className="group">
                  {match.opponent?.logo ? (
                    <img 
                      src={match.opponent.logo} 
                      alt={match.opponent.name}
                      className="w-12 h-12 sm:w-20 sm:h-20 rounded-lg sm:rounded-xl mx-auto mb-2 sm:mb-3 border-2 border-white/20 group-hover:border-white/40 transition-colors object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-lg sm:rounded-xl mx-auto mb-2 sm:mb-3 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center border-2 border-white/20 group-hover:border-white/40 transition-colors">
                      <Shield className="w-6 h-6 sm:w-10 sm:h-10 text-gray-500" />
                    </div>
                  )}
                  <h3 className={`text-sm sm:text-xl font-bold group-hover:text-${accentColor}-400 transition-colors truncate ${isMyTeamOpponent ? 'text-yellow-400' : 'text-white'}`}>
                    {match.opponent?.name}
                  </h3>
                  {match.opponent?.tag && (
                    <span className="text-gray-500 text-xs sm:text-sm hidden sm:inline">[{match.opponent.tag}]</span>
                  )}
                </Link>
              ) : (
                <div className="opacity-50">
                  <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-lg sm:rounded-xl mx-auto mb-2 sm:mb-3 bg-dark-800 flex items-center justify-center border-2 border-dashed border-white/20">
                    <span className="text-xl sm:text-3xl">?</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-500">{t.waitingOpponent}</h3>
                </div>
              )}
            </div>
          </div>
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Column - Match Info */}
          <div className="lg:col-span-1 space-y-4 sm:space-y-6">
            {/* Match Info */}
            <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-${accentColor}-500/20 p-4 sm:p-5`}>
              <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <Shield className={`w-4 h-4 text-${accentColor}-400`} />
                {t.matchInfo}
              </h2>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-gray-500 text-sm">{t.gameMode}</span>
                  <span className={`px-2 py-0.5 bg-${accentColor}-500/20 rounded text-${accentColor}-400 text-xs font-medium`}>
                    {match.gameMode}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-gray-500 text-sm">Map</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${
                    match.mapType === 'random' 
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'bg-cyan-500/20 text-cyan-400'
                  }`}>
                    {match.mapType === 'random' ? (language === 'fr' ? 'Aléatoire' : 'Random') : (language === 'fr' ? 'Libre' : 'Free')}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-gray-500 text-sm">{t.format}</span>
                  <span className="text-white font-semibold text-sm">{match.teamSize}v{match.teamSize}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-gray-500 text-sm">{t.ladder}</span>
                  <span className="text-white text-sm">{match.ladderId === 'duo-trio' ? t.duoTrio : t.squadTeam}</span>
                </div>
                {/* Heure de début */}
                {(match.acceptedAt || match.scheduledAt) && (
                  <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                    <span className="text-gray-500 text-sm">{t.startedAt}</span>
                    <span className="text-white text-sm font-medium">
                      {new Date(match.acceptedAt || match.scheduledAt).toLocaleString(
                        language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : language === 'it' ? 'it-IT' : 'en-US',
                        { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
                      )}
                    </span>
                  </div>
                )}
                {match.isReady && !match.acceptedAt && (
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-gray-500 text-sm">{t.status}</span>
                    <span className="flex items-center gap-1.5 text-green-400 text-sm">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                      {t.ready}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Match Actions - Only for participants, leaders, and active matches */}
            {isParticipant && match.opponent && (match.status === 'accepted' || match.status === 'in_progress') && isLeader() && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowResultModal(true)}
                  className={`flex-1 py-2.5 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2`}
                >
                  <Trophy className="w-4 h-4" />
                  {t.selectWinner}
                </button>
                <button
                  onClick={() => setShowDisputeModal(true)}
                  className="px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Match Disputed */}
            {match.status === 'disputed' && (
              <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-orange-500/30 p-5`}>
                <h2 className="text-base font-bold text-orange-400 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  {t.matchDisputed}
                </h2>
                
                <div className="bg-orange-500/10 rounded-lg p-4 border border-orange-500/20 space-y-3">
                  <p className="text-gray-300 text-sm">{t.disputeInfo}</p>
                  {match.dispute?.reportedBy && (
                    <p className="text-gray-400 text-xs">
                      {t.disputedBy}: <span className="text-orange-400 font-medium">{match.dispute.reportedBy.name || 'Unknown'}</span>
                    </p>
                  )}
                  {match.dispute?.reason && (
                    <div className="mt-2 p-2 bg-dark-800/50 rounded border border-white/5">
                      <p className="text-gray-400 text-xs uppercase mb-1">{t.disputeReason}:</p>
                      <p className="text-white text-sm">{match.dispute.reason}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Match Completed */}
            {match.status === 'completed' && match.result?.winner && (
              <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-green-500/20 p-5`}>
                <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-green-400" />
                  {t.matchEnded}
                </h2>
                
                <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/20 text-center">
                  <p className="text-green-400 text-sm mb-1">{t.winner}</p>
                  <p className="text-white font-bold text-lg">
                    {match.result.winner === match.challenger?._id ? match.challenger?.name : match.opponent?.name}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Chat & Rosters */}
          <div className="lg:col-span-2 space-y-4">
            {/* Chat - Always visible */}
            <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl sm:rounded-2xl border ${match.status === 'disputed' ? 'border-orange-500/30' : `border-${accentColor}-500/20`} p-3 sm:p-4 flex flex-col`}>
              <h2 className={`text-xs sm:text-sm font-semibold ${match.status === 'disputed' ? 'text-orange-400' : 'text-gray-300'} mb-2 sm:mb-3 flex items-center gap-2 uppercase tracking-wider`}>
                <MessageCircle className="w-3 sm:w-4 h-3 sm:h-4" />
                {t.chat}
                {match.status === 'disputed' && <span className="text-orange-400">- {t.matchDisputed}</span>}
              </h2>
              
              {/* Messages */}
              <div 
                ref={chatContainerRef}
                className={`flex-1 bg-dark-950/50 rounded-lg p-2 sm:p-3 mb-2 sm:mb-3 overflow-y-auto max-h-[200px] sm:max-h-[250px] min-h-[120px] border ${match.status === 'disputed' ? 'border-orange-500/20' : 'border-white/5'}`}
              >
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-600 text-sm">💬</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {messages.map((msg, index) => {
                      const isMyMessage = msg.user?._id === user?.id;
                      const isChallenger = msg.squad === match.challenger?._id;
                      const isMsgStaff = msg.isStaff || msg.user?.roles?.some(r => ['admin', 'staff', 'cdl_manager', 'hardcore_manager'].includes(r));
                      const teamColor = isMsgStaff ? 'yellow' : (isChallenger ? 'blue' : 'purple');
                      
                      return (
                        <div key={index} className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%]`}>
                            <div className={`flex items-center gap-1.5 mb-0.5 ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                              {isMsgStaff && <span className="px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/30 rounded text-[10px] font-bold text-yellow-400">{t.staffMessage}</span>}
                              <span className={`text-xs font-medium ${isMsgStaff ? 'text-yellow-400' : `text-${teamColor}-400`}`}>{msg.user?.username}</span>
                              <span className="text-gray-600 text-[10px]">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className={`px-3 py-1.5 rounded-lg text-sm ${isMsgStaff ? 'bg-yellow-500/20 text-yellow-100 border-2 border-yellow-500/50' : isMyMessage ? `bg-${teamColor}-500/20 text-${teamColor}-100 border border-${teamColor}-500/30` : 'bg-dark-800 text-gray-200 border border-white/5'}`}>
                              {msg.message}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {(isParticipant || isStaff) && (
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder={t.typePlaceholder} className={`flex-1 px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-${accentColor}-500/50`} maxLength={500} />
                  <button type="submit" disabled={!newMessage.trim() || sendingMessage} className={`px-4 py-2 bg-${accentColor}-500/20 hover:bg-${accentColor}-500/30 border border-${accentColor}-500/30 rounded-lg text-${accentColor}-400 disabled:opacity-30`}>
                    {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>
              )}
            </div>

            {/* Rosters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Challenger Roster */}
              <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-${accentColor}-500/20 p-3 sm:p-4`}>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Users className={`w-4 h-4 text-${accentColor}-400`} />
                  {match.challenger?.name}
                </h3>
                {match.challengerRoster?.length > 0 ? (
                  <div className="space-y-2">
                    {match.challengerRoster.map((p, idx) => {
                      const player = p.user;
                      if (!player) return null;
                      const avatar = player.avatarUrl || (player.discordAvatar ? `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png');
                      return (
                        <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg ${p.isHelper ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-dark-800/50'}`}>
                          <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{player.username}</p>
                            {player.activisionId && <p className="text-gray-500 text-xs truncate">{player.activisionId}</p>}
                          </div>
                          <div className="flex items-center gap-1">
                            {player.platform && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${player.platform === 'PC' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                                {player.platform}
                              </span>
                            )}
                            {p.isHelper && <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">{t.helper}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 text-xs text-center py-4">{t.noRoster}</p>
                )}
              </div>

              {/* Opponent Roster */}
              {match.opponent && (
                <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-purple-500/20 p-3 sm:p-4`}>
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-400" />
                    {match.opponent?.name}
                  </h3>
                  {match.opponentRoster?.length > 0 ? (
                    <div className="space-y-2">
                      {match.opponentRoster.map((p, idx) => {
                        const player = p.user;
                        if (!player) return null;
                        const avatar = player.avatarUrl || (player.discordAvatar ? `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png');
                        return (
                          <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg ${p.isHelper ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-dark-800/50'}`}>
                            <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium truncate">{player.username}</p>
                              {player.activisionId && <p className="text-gray-500 text-xs truncate">{player.activisionId}</p>}
                            </div>
                            <div className="flex items-center gap-1">
                              {player.platform && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${player.platform === 'PC' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                                  {player.platform}
                                </span>
                              )}
                              {p.isHelper && <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">{t.helper}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-xs text-center py-4">{t.noRoster}</p>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Result Selection Modal */}
      {showResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className={`bg-dark-900 rounded-2xl border border-${accentColor}-500/30 p-6 max-w-md w-full shadow-2xl`}>
            <h3 className="text-xl font-bold text-white mb-6 text-center flex items-center justify-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-400" />
              {t.selectWinner}
            </h3>
            
            <div className="space-y-3">
              {/* Our team won */}
              <button
                onClick={() => handleSubmitResult(mySquad._id)}
                disabled={submittingResult}
                className="w-full p-4 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-xl text-left transition-all group disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {mySquad?.logo ? (
                      <img src={mySquad.logo} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-green-400" />
                      </div>
                    )}
                    <div>
                      <p className="text-white font-semibold">{mySquad?.name}</p>
                      <p className="text-green-400 text-sm">{t.weWon}</p>
                    </div>
                  </div>
                  <CheckCircle className="w-6 h-6 text-green-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>

              {/* Other team won */}
              <button
                onClick={() => handleSubmitResult(isMyTeamChallenger ? match.opponent._id : match.challenger._id)}
                disabled={submittingResult}
                className="w-full p-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-left transition-all group disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {(isMyTeamChallenger ? match.opponent?.logo : match.challenger?.logo) ? (
                      <img 
                        src={isMyTeamChallenger ? match.opponent?.logo : match.challenger?.logo} 
                        alt="" 
                        className="w-10 h-10 rounded-lg object-cover" 
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-red-400" />
                      </div>
                    )}
                    <div>
                      <p className="text-white font-semibold">
                        {isMyTeamChallenger ? match.opponent?.name : match.challenger?.name}
                      </p>
                      <p className="text-red-400 text-sm">{t.theyWon}</p>
                    </div>
                  </div>
                  <XCircle className="w-6 h-6 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            </div>

            {/* Cancel button */}
            <button
              onClick={() => setShowResultModal(false)}
              className="w-full mt-4 py-2 bg-dark-800 hover:bg-dark-700 border border-white/10 rounded-lg text-gray-400 text-sm transition-colors"
            >
              {language === 'fr' ? 'Annuler' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-dark-900 rounded-2xl border border-red-500/30 p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              {t.reportDispute}
            </h3>
            
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">{t.disputeWarning}</p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">{t.disputeReason}</label>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder={t.disputeReasonPlaceholder}
                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-red-500/50 resize-none"
                rows={4}
                maxLength={500}
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDisputeModal(false);
                  setDisputeReason('');
                }}
                className="flex-1 py-2.5 bg-dark-800 hover:bg-dark-700 border border-white/10 rounded-lg text-gray-400 font-medium transition-colors"
              >
                {language === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                onClick={handleSubmitDispute}
                disabled={!disputeReason.trim() || submittingDispute}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 rounded-lg text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submittingDispute ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    {t.submitDispute}
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

export default MatchSheet;

