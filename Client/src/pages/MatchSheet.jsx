import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { useSocket } from '../SocketContext';
import { 
  ArrowLeft, Trophy, Users, Clock, Send, Loader2, Shield, 
  Swords, MessageCircle, AlertTriangle, Crown, Shuffle, Map,
  Medal, Star, Flame, Zap, BookOpen, X
} from 'lucide-react';
import RankedMatchReport from '../components/RankedMatchReport';
import LadderMatchReport from '../components/LadderMatchReport';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

// Traductions des noms de rangs
const RANK_NAMES = {
  bronze: { fr: 'Bronze', en: 'Bronze', de: 'Bronze', it: 'Bronzo' },
  silver: { fr: 'Argent', en: 'Silver', de: 'Silber', it: 'Argento' },
  gold: { fr: 'Or', en: 'Gold', de: 'Gold', it: 'Oro' },
  platinum: { fr: 'Platine', en: 'Platinum', de: 'Platin', it: 'Platino' },
  diamond: { fr: 'Diamant', en: 'Diamond', de: 'Diamant', it: 'Diamante' },
  master: { fr: 'Maître', en: 'Master', de: 'Meister', it: 'Maestro' },
  grandmaster: { fr: 'Grand Maître', en: 'Grandmaster', de: 'Großmeister', it: 'Gran Maestro' },
  champion: { fr: 'Champion', en: 'Champion', de: 'Champion', it: 'Campione' }
};

// Styles des rangs (constante - ne change pas)
const RANK_STYLES = {
  bronze: { key: 'bronze', color: '#CD7F32', gradient: 'from-amber-700 to-amber-900', icon: Shield, image: '/1.png' },
  silver: { key: 'silver', color: '#C0C0C0', gradient: 'from-slate-400 to-slate-600', icon: Shield, image: '/2.png' },
  gold: { key: 'gold', color: '#FFD700', gradient: 'from-yellow-500 to-amber-600', icon: Medal, image: '/3.png' },
  platinum: { key: 'platinum', color: '#00CED1', gradient: 'from-teal-400 to-cyan-600', icon: Medal, image: '/4.png' },
  diamond: { key: 'diamond', color: '#B9F2FF', gradient: 'from-cyan-300 to-blue-500', icon: Star, image: '/5.png' },
  master: { key: 'master', color: '#9B59B6', gradient: 'from-purple-500 to-pink-600', icon: Crown, image: '/6.png' },
  grandmaster: { key: 'grandmaster', color: '#E74C3C', gradient: 'from-red-500 to-orange-600', icon: Flame, image: '/7.png' },
  champion: { key: 'champion', color: '#F1C40F', gradient: 'from-yellow-400 via-orange-500 to-red-600', icon: Zap, image: '/8.png' }
};

// Seuils par défaut (seront remplacés par les seuils configurés depuis l'API)
const DEFAULT_RANK_THRESHOLDS = {
  bronze: { min: 0, max: 499 },
  silver: { min: 500, max: 999 },
  gold: { min: 1000, max: 1499 },
  platinum: { min: 1500, max: 1999 },
  diamond: { min: 2000, max: 2499 },
  master: { min: 2500, max: 2999 },
  grandmaster: { min: 3000, max: 3499 },
  champion: { min: 3500, max: null }
};

// Helper pour construire les rangs avec les seuils dynamiques
const buildRanksFromThresholds = (thresholds) => {
  const rankOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'champion'];
  return rankOrder.map(key => {
    const threshold = thresholds[key] || DEFAULT_RANK_THRESHOLDS[key];
    const style = RANK_STYLES[key];
    return {
      key,
      min: threshold.min ?? 0,
      max: threshold.max ?? 99999,
      color: style.color,
      gradient: style.gradient,
      icon: style.icon,
      image: style.image
    };
  });
};

// Obtenir le rang à partir des points avec le nom traduit (utilise les seuils passés en paramètre)
const getRankFromPointsWithThresholds = (points, thresholds, language = 'en') => {
  const ranks = buildRanksFromThresholds(thresholds);
  const rank = ranks.find(r => points >= r.min && points <= r.max) || ranks[0];
  return {
    ...rank,
    name: RANK_NAMES[rank.key]?.[language] || RANK_NAMES[rank.key]?.en || rank.key
  };
};

const MatchSheet = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const { user, isAuthenticated } = useAuth();
  const { socket } = useSocket();

  // Détecter si c'est un match classé via l'URL
  const isRankedMatch = location.pathname.includes('/ranked/match/');

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
  const [submittingResult, setSubmittingResult] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [submittingCancellation, setSubmittingCancellation] = useState(false);
  const [respondingCancellation, setRespondingCancellation] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  
  // Pour les matchs classés
  const [myTeam, setMyTeam] = useState(null);
  const [isReferent, setIsReferent] = useState(false);
  
  // Demande d'annulation par vote (mode classé uniquement)
  const [cancellationVotes, setCancellationVotes] = useState({
    currentVotes: 0,
    requiredVotes: 0,
    totalPlayers: 0,
    hasVoted: false,
    isActive: false
  });
  const [votingCancellation, setVotingCancellation] = useState(false);
  
  // Appel arbitre (mode classé)
  const [callingArbitrator, setCallingArbitrator] = useState(false);
  const [hasCalledArbitrator, setHasCalledArbitrator] = useState(false);
  
  // Rapport de combat (mode classé)
  const [showMatchReport, setShowMatchReport] = useState(false);
  const [matchReportData, setMatchReportData] = useState(null);
  
  // Rapport de combat (match ladder)
  const [showLadderReport, setShowLadderReport] = useState(false);
  const [ladderReportData, setLadderReportData] = useState(null);
  
  // Flag pour éviter d'afficher le rapport plusieurs fois
  const [reportShownForMatch, setReportShownForMatch] = useState(null);
  
  // Seuils de rangs configurés (récupérés depuis l'API)
  const [rankThresholds, setRankThresholds] = useState(DEFAULT_RANK_THRESHOLDS);
  
  // État pour les règles du mode de jeu
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [rules, setRules] = useState(null);
  const [loadingRules, setLoadingRules] = useState(false);
  
  // Helper local pour obtenir le rang à partir des points
  const getRankFromPoints = (points, lang = language) => {
    return getRankFromPointsWithThresholds(points, rankThresholds, lang);
  };

  // Translations
  const t = {
    fr: {
      back: 'Retour',
      matchSheet: 'Feuille de match',
      matchInfo: 'Informations du match',
      gameMode: 'Mode de jeu',
      format: 'Format',
      ladder: 'Classement',
      rankedMode: 'Mode classé',
      mapSelection: 'Sélection de map',
      mapFree: 'Libre',
      mapRandom: 'Aléatoire',
      mapVoted: 'Votée',
      status: 'Statut',
      startedAt: 'Début du match',
      chat: 'Chat du match',
      typePlaceholder: 'Écrivez un message...',
      send: 'Envoyer',
      vs: 'VS',
      pending: 'En attente',
      accepted: 'Accepté',
      ready: 'Prêt',
      inProgress: 'En cours',
      completed: 'Terminé',
      cancelled: 'Annulé',
      disputed: 'Litige en cours',
      chill: 'Chill',
      competitive: 'Compétitif',
      notFound: 'Match non trouvé',
      loadingError: 'Erreur de chargement',
      yourTeam: 'Votre équipe',
      selectWinner: 'Sélectionner le gagnant',
      weWon: 'Nous avons gagné',
      theyWon: 'Ils ont gagné',
      reportDispute: 'Signaler un litige',
      disputeReason: 'Raison du litige',
      disputeReasonPlaceholder: 'Décrivez le problème...',
      disputeWarning: 'Un litige bloquera le match jusqu\'à ce qu\'un membre du staff le résolve.',
      submitDispute: 'Soumettre le litige',
      matchDisputed: 'Match en litige',
      disputeInfo: 'Ce match est en cours d\'examen par le staff.',
      disputedBy: 'Signalé par',
      matchEnded: 'Match terminé',
      winner: 'Gagnant',
      host: 'Hôte',
      roster: 'Roster',
      maps: 'Maps',
      mapsDrawn: 'Maps tirées au sort',
      noMaps: 'Aucune map tirée',
      referents: 'Référents',
      team: 'Équipe',
      noRoster: 'Aucun roster défini',
      onlyLeaderCanValidate: 'Seul le leader ou un officier peut valider',
      onlyReferentCanValidate: 'Tous les joueurs peuvent voter pour le gagnant',
      warningMessage: '⚠️ Rappel : Tout débordement ou comportement inacceptable peuvent entraîner des sanctions sévères.',
      voiceChannelRequired: '🎙️ Salon vocal recommandé',
      voiceChannelMessage: 'Tous les joueurs d\'une même équipe peuvent rejoindre un salon vocal sur le serveur Discord NoMercy. Ce n\'est pas obligatoire mais fortement recommandé.',
      joinDiscord: 'Rejoindre le Discord',
      playerDisconnected: 's\'est déconnecté de l\'anti-cheat (GGSecure)',
      playerReconnected: 's\'est reconnecté à l\'anti-cheat (GGSecure)',
      requestCancellation: 'Demander l\'annulation',
      cancellationRequest: 'Demande d\'annulation',
      cancellationReason: 'Raison de l\'annulation',
      cancellationReasonPlaceholder: 'Expliquez pourquoi vous souhaitez annuler...',
      cancellationWarning: 'Une demande d\'annulation sera envoyée à l\'équipe adverse pour approbation.',
      submitCancellation: 'Envoyer la demande',
      cancel: 'Annuler',
      cancellationRequestSent: 'a demandé l\'annulation du match',
      cancellationRequestSentSuccess: 'Demande d\'annulation envoyée',
      pendingCancellation: 'Demande d\'annulation en attente',
      acceptCancellation: 'Accepter l\'annulation',
      rejectCancellation: 'Refuser l\'annulation',
      cancellationAccepted: 'Annulation acceptée',
      cancellationRejected: 'Annulation refusée',
      referentWarning: '⚠️ Attention : Valider un gagnant sans avoir joué le match peut entraîner de lourdes sanctions (ban temporaire ou permanent). Assurez-vous que le match a bien été joué avant de voter.',
      voteCancellation: 'Voter pour annuler',
      removeVote: 'Retirer mon vote',
      cancellationVotes: 'Votes pour annuler',
      votesProgress: 'votes sur',
      required: 'requis',
      matchCancelledByVote: 'Match annulé par vote des joueurs',
      winnerVoteProgress: 'Votes pour le gagnant',
      voteForWinner: 'Voter pour le gagnant',
      yourVote: 'Votre vote',
      changeVote: 'Changer mon vote',
      noVoteYet: 'Pas encore voté',
      waitingFor60Percent: '60% des joueurs doivent voter pour le même gagnant',
      voteRecorded: 'Vote enregistré',
      viewGameRules: 'Voir les règles du mode',
      gameRules: 'Règles du jeu',
      close: 'Fermer',
      loadingRules: 'Chargement des règles...',
      callArbitrator: 'Appeler un arbitre',
      arbitratorCalled: 'Arbitre appelé',
      arbitratorCalledDesc: 'Un arbitre a été notifié et interviendra dès que possible.',
      alreadyCalledArbitrator: 'Vous avez déjà appelé un arbitre',
    },
    en: {
      back: 'Back',
      matchSheet: 'Match Sheet',
      matchInfo: 'Match Information',
      gameMode: 'Game Mode',
      format: 'Format',
      ladder: 'Ladder',
      rankedMode: 'Ranked Mode',
      mapSelection: 'Map Selection',
      mapFree: 'Free',
      mapRandom: 'Random',
      mapVoted: 'Voted',
      status: 'Status',
      startedAt: 'Match started',
      chat: 'Match Chat',
      typePlaceholder: 'Type a message...',
      send: 'Send',
      vs: 'VS',
      pending: 'Pending',
      accepted: 'Accepted',
      ready: 'Ready',
      inProgress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
      disputed: 'Disputed',
      chill: 'Chill',
      competitive: 'Competitive',
      notFound: 'Match not found',
      loadingError: 'Loading error',
      yourTeam: 'Your team',
      selectWinner: 'Select winner',
      weWon: 'We won',
      theyWon: 'They won',
      reportDispute: 'Report dispute',
      disputeReason: 'Dispute reason',
      disputeReasonPlaceholder: 'Describe the issue...',
      disputeWarning: 'A dispute will block the match until staff resolves it.',
      submitDispute: 'Submit dispute',
      matchDisputed: 'Match disputed',
      disputeInfo: 'This match is being reviewed by staff.',
      disputedBy: 'Reported by',
      matchEnded: 'Match ended',
      winner: 'Winner',
      host: 'Host',
      roster: 'Roster',
      maps: 'Maps',
      mapsDrawn: 'Drawn maps',
      noMaps: 'No maps drawn',
      referents: 'Referents',
      team: 'Team',
      noRoster: 'No roster defined',
      onlyLeaderCanValidate: 'Only the leader or an officer can validate',
      onlyReferentCanValidate: 'All players can vote for the winner',
      warningMessage: '⚠️ Warning: Any misconduct or unacceptable behavior may result in severe penalties.',
      voiceChannelRequired: '🎙️ Voice channel recommended',
      voiceChannelMessage: 'All players on the same team can join a voice channel on the NoMercy Discord server. This is not mandatory but strongly recommended.',
      joinDiscord: 'Join Discord',
      playerDisconnected: 'disconnected from anti-cheat (GGSecure)',
      playerReconnected: 'reconnected to anti-cheat (GGSecure)',
      requestCancellation: 'Request cancellation',
      cancellationRequest: 'Cancellation request',
      cancellationReason: 'Cancellation reason',
      cancellationReasonPlaceholder: 'Explain why you want to cancel...',
      cancellationWarning: 'A cancellation request will be sent to the opposing team for approval.',
      submitCancellation: 'Send request',
      cancel: 'Cancel',
      cancellationRequestSent: 'requested match cancellation',
      cancellationRequestSentSuccess: 'Cancellation request sent',
      pendingCancellation: 'Cancellation request pending',
      acceptCancellation: 'Accept cancellation',
      rejectCancellation: 'Reject cancellation',
      cancellationAccepted: 'Cancellation accepted',
      cancellationRejected: 'Cancellation rejected',
      referentWarning: '⚠️ Warning Referents: Validating a winner without playing the match may result in severe sanctions (temporary or permanent ban). Make sure the match has been played before validating.',
      voteCancellation: 'Vote to cancel',
      removeVote: 'Remove my vote',
      cancellationVotes: 'Votes to cancel',
      votesProgress: 'votes of',
      required: 'required',
      matchCancelledByVote: 'Match cancelled by player vote',
      winnerVoteProgress: 'Votes for winner',
      voteForWinner: 'Vote for winner',
      yourVote: 'Your vote',
      changeVote: 'Change my vote',
      noVoteYet: 'Not voted yet',
      waitingFor60Percent: '60% of players must vote for the same winner',
      voteRecorded: 'Vote recorded',
      viewGameRules: 'View Game Rules',
      gameRules: 'Game Rules',
      close: 'Close',
      loadingRules: 'Loading rules...',
      callArbitrator: 'Call an arbitrator',
      arbitratorCalled: 'Arbitrator called',
      arbitratorCalledDesc: 'An arbitrator has been notified and will intervene as soon as possible.',
      alreadyCalledArbitrator: 'You have already called an arbitrator',
    },
    de: {
      back: 'Zurück',
      matchSheet: 'Spielblatt',
      matchInfo: 'Spielinformationen',
      gameMode: 'Spielmodus',
      format: 'Format',
      ladder: 'Rangliste',
      rankedMode: 'Ranglistenmodus',
      mapSelection: 'Kartenauswahl',
      mapFree: 'Frei',
      mapRandom: 'Zufällig',
      mapVoted: 'Abgestimmt',
      status: 'Status',
      startedAt: 'Spielbeginn',
      chat: 'Match Chat',
      typePlaceholder: 'Nachricht eingeben...',
      send: 'Senden',
      vs: 'VS',
      pending: 'Ausstehend',
      accepted: 'Akzeptiert',
      ready: 'Bereit',
      inProgress: 'Im Gange',
      completed: 'Abgeschlossen',
      cancelled: 'Abgebrochen',
      disputed: 'Umstritten',
      chill: 'Chill',
      competitive: 'Wettbewerbsfähig',
      notFound: 'Match nicht gefunden',
      loadingError: 'Ladefehler',
      yourTeam: 'Dein Team',
      selectWinner: 'Gewinner wählen',
      weWon: 'Wir haben gewonnen',
      theyWon: 'Sie haben gewonnen',
      reportDispute: 'Streitfall melden',
      disputeReason: 'Grund des Streits',
      disputeReasonPlaceholder: 'Beschreiben Sie das Problem...',
      disputeWarning: 'Ein Streitfall blockiert das Spiel bis das Staff es löst.',
      submitDispute: 'Streitfall einreichen',
      matchDisputed: 'Spiel im Streit',
      disputeInfo: 'Dieses Spiel wird vom Staff überprüft.',
      disputedBy: 'Gemeldet von',
      matchEnded: 'Spiel beendet',
      winner: 'Gewinner',
      host: 'Host',
      roster: 'Roster',
      maps: 'Karten',
      mapsDrawn: 'Gezogene Karten',
      noMaps: 'Keine Karten gezogen',
      referents: 'Referenten',
      team: 'Team',
      noRoster: 'Kein Roster definiert',
      onlyLeaderCanValidate: 'Nur der Leader oder ein Offizier kann bestätigen',
      onlyReferentCanValidate: 'Alle Spieler können für den Gewinner stimmen',
      warningMessage: '⚠️ Warnung: Jedes Fehlverhalten oder inakzeptables Verhalten kann zu schweren Strafen führen.',
      voiceChannelRequired: '🎙️ Sprachkanal empfohlen',
      voiceChannelMessage: 'Alle Spieler im selben Team können einem Sprachkanal auf dem NoMercy Discord-Server beitreten. Dies ist nicht verpflichtend, aber sehr empfohlen.',
      joinDiscord: 'Discord beitreten',
      playerDisconnected: 'hat sich vom Anti-Cheat (GGSecure) getrennt',
      playerReconnected: 'hat sich wieder mit dem Anti-Cheat (GGSecure) verbunden',
      requestCancellation: 'Stornierung anfordern',
      cancellationRequest: 'Stornierungsanfrage',
      cancellationReason: 'Grund der Stornierung',
      cancellationReasonPlaceholder: 'Erklären Sie, warum Sie stornieren möchten...',
      cancellationWarning: 'Eine Stornierungsanfrage wird zur Genehmigung an das gegnerische Team gesendet.',
      submitCancellation: 'Anfrage senden',
      cancel: 'Abbrechen',
      cancellationRequestSent: 'hat die Stornierung des Spiels beantragt',
      cancellationRequestSentSuccess: 'Stornierungsanfrage gesendet',
      pendingCancellation: 'Stornierungsanfrage ausstehend',
      acceptCancellation: 'Stornierung akzeptieren',
      rejectCancellation: 'Stornierung ablehnen',
      cancellationAccepted: 'Stornierung akzeptiert',
      cancellationRejected: 'Stornierung abgelehnt',
      referentWarning: '⚠️ Achtung Referenten: Das Validieren eines Gewinners ohne das Spiel gespielt zu haben, kann schwere Sanktionen nach sich ziehen (temporärer oder permanenter Bann). Stellen Sie sicher, dass das Spiel gespielt wurde, bevor Sie validieren.',
      voteCancellation: 'Für Stornierung stimmen',
      removeVote: 'Meine Stimme entfernen',
      cancellationVotes: 'Stimmen für Stornierung',
      votesProgress: 'Stimmen von',
      required: 'erforderlich',
      matchCancelledByVote: 'Spiel durch Spielerabstimmung abgebrochen',
      winnerVoteProgress: 'Stimmen für Gewinner',
      voteForWinner: 'Für Gewinner stimmen',
      yourVote: 'Ihre Stimme',
      changeVote: 'Stimme ändern',
      noVoteYet: 'Noch nicht abgestimmt',
      waitingFor60Percent: '60% der Spieler müssen für denselben Gewinner stimmen',
      voteRecorded: 'Stimme aufgezeichnet',
      viewGameRules: 'Spielregeln anzeigen',
      gameRules: 'Spielregeln',
      close: 'Schließen',
      loadingRules: 'Regeln werden geladen...',
      callArbitrator: 'Schiedsrichter rufen',
      arbitratorCalled: 'Schiedsrichter gerufen',
      arbitratorCalledDesc: 'Ein Schiedsrichter wurde benachrichtigt und wird so schnell wie möglich eingreifen.',
      alreadyCalledArbitrator: 'Sie haben bereits einen Schiedsrichter gerufen',
    },
    it: {
      back: 'Indietro',
      matchSheet: 'Scheda partita',
      matchInfo: 'Informazioni partita',
      gameMode: 'Modalità',
      format: 'Formato',
      ladder: 'Classifica',
      rankedMode: 'Modalità classificata',
      mapSelection: 'Selezione mappa',
      mapFree: 'Libera',
      mapRandom: 'Casuale',
      mapVoted: 'Votata',
      status: 'Stato',
      startedAt: 'Inizio partita',
      chat: 'Chat partita',
      typePlaceholder: 'Scrivi un messaggio...',
      send: 'Invia',
      vs: 'VS',
      pending: 'In attesa',
      accepted: 'Accettato',
      ready: 'Pronto',
      inProgress: 'In corso',
      completed: 'Completato',
      cancelled: 'Annullato',
      disputed: 'Controverso',
      chill: 'Chill',
      competitive: 'Competitivo',
      notFound: 'Partita non trovata',
      loadingError: 'Errore di caricamento',
      yourTeam: 'La tua squadra',
      selectWinner: 'Seleziona vincitore',
      weWon: 'Abbiamo vinto',
      theyWon: 'Hanno vinto',
      reportDispute: 'Segnala controversia',
      disputeReason: 'Motivo della controversia',
      disputeReasonPlaceholder: 'Descrivi il problema...',
      disputeWarning: 'Una controversia bloccherà la partita fino a quando lo staff non la risolverà.',
      submitDispute: 'Invia controversia',
      matchDisputed: 'Partita in controversia',
      disputeInfo: 'Questa partita è in fase di revisione da parte dello staff.',
      disputedBy: 'Segnalato da',
      matchEnded: 'Partita terminata',
      winner: 'Vincitore',
      host: 'Ospite',
      roster: 'Roster',
      maps: 'Mappe',
      mapsDrawn: 'Mappe sorteggiate',
      noMaps: 'Nessuna mappa sorteggiata',
      referents: 'Referenti',
      team: 'Squadra',
      noRoster: 'Nessun roster definito',
      onlyLeaderCanValidate: 'Solo il leader o un ufficiale può confermare',
      onlyReferentCanValidate: 'Tutti i giocatori possono votare per il vincitore',
      warningMessage: '⚠️ Avviso: Qualsiasi comportamento scorretto o inaccettabile può comportare sanzioni severe.',
      voiceChannelRequired: '🎙️ Canale vocale consigliato',
      voiceChannelMessage: 'Tutti i giocatori della stessa squadra possono unirsi a un canale vocale sul server Discord NoMercy. Questo non è obbligatorio ma fortemente consigliato.',
      joinDiscord: 'Unisciti a Discord',
      playerDisconnected: 'si è disconnesso dall\'anti-cheat (GGSecure)',
      playerReconnected: 'si è riconnesso all\'anti-cheat (GGSecure)',
      requestCancellation: 'Richiedi annullamento',
      cancellationRequest: 'Richiesta di annullamento',
      cancellationReason: 'Motivo dell\'annullamento',
      cancellationReasonPlaceholder: 'Spiega perché vuoi annullare...',
      cancellationWarning: 'Una richiesta di annullamento sarà inviata alla squadra avversaria per approvazione.',
      submitCancellation: 'Invia richiesta',
      cancel: 'Annulla',
      cancellationRequestSent: 'ha richiesto l\'annullamento della partita',
      cancellationRequestSentSuccess: 'Richiesta di annullamento inviata',
      pendingCancellation: 'Richiesta di annullamento in attesa',
      acceptCancellation: 'Accetta annullamento',
      rejectCancellation: 'Rifiuta annullamento',
      cancellationAccepted: 'Annullamento accettato',
      cancellationRejected: 'Annullamento rifiutato',
      referentWarning: '⚠️ Attenzione Referenti: Convalidare un vincitore senza aver giocato la partita può comportare sanzioni severe (ban temporaneo o permanente). Assicuratevi che la partita sia stata giocata prima di convalidare.',
      voteCancellation: 'Vota per annullare',
      removeVote: 'Rimuovi il mio voto',
      cancellationVotes: 'Voti per annullare',
      votesProgress: 'voti su',
      required: 'richiesti',
      matchCancelledByVote: 'Partita annullata per voto dei giocatori',
      winnerVoteProgress: 'Voti per il vincitore',
      voteForWinner: 'Vota per il vincitore',
      yourVote: 'Il tuo voto',
      changeVote: 'Cambia voto',
      noVoteYet: 'Non hai ancora votato',
      waitingFor60Percent: 'Il 60% dei giocatori deve votare per lo stesso vincitore',
      voteRecorded: 'Voto registrato',
      viewGameRules: 'Visualizza regole del gioco',
      gameRules: 'Regole del gioco',
      close: 'Chiudi',
      loadingRules: 'Caricamento regole...',
      callArbitrator: 'Chiama un arbitro',
      arbitratorCalled: 'Arbitro chiamato',
      arbitratorCalledDesc: 'Un arbitro è stato notificato e interverrà il prima possibile.',
      alreadyCalledArbitrator: 'Hai già chiamato un arbitro',
    },
  }[language] || {};

  // Track if initial load is done
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Fetch match data
  const fetchMatchData = async (isInitial = false) => {
    console.log('[MatchSheet] fetchMatchData called, isInitial:', isInitial);
    if (isInitial) setLoading(true);
    try {
      const apiUrl = isRankedMatch 
        ? `${API_URL}/ranked-matches/${matchId}`
        : `${API_URL}/matches/${matchId}`;
      
      const response = await fetch(apiUrl, {
        credentials: 'include'
      });
      const data = await response.json();
      console.log('[MatchSheet] Match data fetched:', data.success ? 'success' : 'failed');
      
      if (data.success) {
        if (data.isStaff !== undefined) {
          setIsStaff(data.isStaff);
        }
        
        if (isRankedMatch) {
          if (data.myTeam !== undefined) setMyTeam(data.myTeam);
          if (data.isReferent !== undefined) setIsReferent(data.isReferent);
          // Vérifier si un arbitre a déjà été appelé pour ce match (un seul appel par match)
          if (data.match.arbitratorCalls && data.match.arbitratorCalls.length > 0) {
            setHasCalledArbitrator(true);
          }
          // Debug: vérifier si les maps sont présentes
          if (data.match.maps) {
            console.log('[MatchSheet] Maps reçues (classé):', data.match.maps);
          } else {
            console.log('[MatchSheet] Aucune map reçue pour ce match classé');
          }
        } else {
          // Debug pour les matchs ladder
          if (data.match.randomMaps) {
            console.log('[MatchSheet] Maps reçues (ladder):', data.match.randomMaps);
          } else {
            console.log('[MatchSheet] Aucune map reçue pour ce match ladder');
          }
        }
        
        setMatch(prev => {
          if (!prev || prev.status !== data.match.status || prev.opponent?._id !== data.match.opponent?._id) {
            return data.match;
          }
          return prev;
        });
        
        setMessages(prev => {
          const newMessages = data.match.chat || [];
          if (prev.length !== newMessages.length) {
            return newMessages;
          }
          return prev;
        });
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

  // Fetch cancellation vote status (for ranked matches)
  const fetchCancellationStatus = async () => {
    if (!isRankedMatch || !matchId) return;
    try {
      const response = await fetch(`${API_URL}/ranked-matches/${matchId}/cancellation/status`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setCancellationVotes({
          currentVotes: data.currentVotes || 0,
          requiredVotes: data.requiredVotes || 0,
          totalPlayers: data.totalPlayers || 0,
          hasVoted: data.hasVoted || false,
          isActive: data.isActive || false
        });
      }
    } catch (err) {
      console.error('Error fetching cancellation status:', err);
    }
  };

  // Toggle cancellation vote (for ranked matches)
  const handleToggleCancellationVote = async () => {
    if (!isRankedMatch || votingCancellation) return;
    setVotingCancellation(true);
    try {
      const response = await fetch(`${API_URL}/ranked-matches/${matchId}/cancellation/vote`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setCancellationVotes({
          currentVotes: data.currentVotes || 0,
          requiredVotes: data.requiredVotes || 0,
          totalPlayers: data.totalPlayers || 0,
          hasVoted: data.hasVoted || false,
          isActive: data.currentVotes > 0
        });
        // Si le match a été annulé, rafraîchir les données
        if (data.isCancelled) {
          fetchMatchData(false);
        }
      }
    } catch (err) {
      console.error('Error toggling cancellation vote:', err);
    } finally {
      setVotingCancellation(false);
    }
  };

  // Call arbitrator (for ranked matches) - can only be used once per player
  const handleCallArbitrator = async () => {
    if (!isRankedMatch || callingArbitrator || hasCalledArbitrator) return;
    setCallingArbitrator(true);
    try {
      const response = await fetch(`${API_URL}/ranked-matches/${matchId}/call-arbitrator`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setHasCalledArbitrator(true);
        // Rafraîchir les données du match pour mettre à jour le chat
        fetchMatchData(false);
      } else {
        // Si l'erreur indique qu'un arbitre a déjà été appelé, mettre à jour l'état
        if (data.message?.includes('déjà') && data.message?.includes('appelé')) {
          setHasCalledArbitrator(true);
        }
        console.error('Call arbitrator error:', data.message);
      }
    } catch (err) {
      console.error('Error calling arbitrator:', err);
    } finally {
      setCallingArbitrator(false);
    }
  };

  // Fetch my squad (for ladder matches)
  const fetchMySquad = async () => {
    if (!isAuthenticated || isRankedMatch) return;
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
    if (isRankedMatch) {
      fetchCancellationStatus();
    }
  }, [matchId, isAuthenticated, isRankedMatch]);

  // Récupérer les seuils de rangs configurés depuis l'API (pour les matchs classés)
  useEffect(() => {
    if (!isRankedMatch) return;
    
    const fetchRankThresholds = async () => {
      try {
        const res = await fetch(`${API_URL}/app-settings`, { credentials: 'include' });
        const data = await res.json();
        if (data.success && data.settings?.rankedSettings?.rankPointsThresholds) {
          setRankThresholds(data.settings.rankedSettings.rankPointsThresholds);
        }
      } catch (err) {
        console.error('Error fetching rank thresholds:', err);
      }
    };
    
    fetchRankThresholds();
  }, [isRankedMatch]);

  // 🎯 Effet pour détecter quand le match devient complété et afficher le rapport
  useEffect(() => {
    console.log('[MatchSheet] 🔍 Checking for match completion...');
    console.log('[MatchSheet] match:', match?.status);
    console.log('[MatchSheet] reportShownForMatch:', reportShownForMatch);
    console.log('[MatchSheet] matchId:', matchId);
    
    // Éviter d'afficher le rapport plusieurs fois pour le même match
    if (!match || match.status !== 'completed' || reportShownForMatch === matchId) {
      return;
    }
    
    console.log('[MatchSheet] ✅ Match is completed! Preparing report...');
    setReportShownForMatch(matchId);
    
    if (isRankedMatch) {
      // ========== RAPPORT MODE CLASSÉ ==========
      console.log('[MatchSheet] 📊 Preparing RANKED match report');
      console.log('[MatchSheet] Players:', match.players);
      console.log('[MatchSheet] User ID:', user?._id || user?.id);
      
      // Trouver le joueur actuel - utiliser user._id OU user.id selon le contexte
      const currentUserId = (user?._id || user?.id)?.toString();
      const currentPlayer = match.players?.find(p => {
        const pUserId = p.user?._id?.toString() || p.user?.toString();
        return pUserId === currentUserId;
      });
      
      console.log('[MatchSheet] Current player:', currentPlayer);
      console.log('[MatchSheet] Current user ID used:', currentUserId);
      
      if (currentPlayer && currentPlayer.rewards) {
        const pointsChange = currentPlayer.rewards.pointsChange || 0;
        const goldEarned = currentPlayer.rewards.goldEarned || 0;
        const xpEarned = currentPlayer.rewards.xpEarned || 0;
        
        // Déterminer si le joueur a gagné
        // IMPORTANT: Convertir en Number pour éviter les problèmes de comparaison string vs number
        const playerTeam = Number(currentPlayer.team);
        const winnerTeam = Number(match.result?.winner);
        
        console.log('[MatchSheet] 🎯 Winner determination:', {
          playerTeam,
          winnerTeam,
          playerTeamType: typeof currentPlayer.team,
          winnerTeamType: typeof match.result?.winner,
          pointsChange
        });
        
        // Utiliser les points comme source de vérité principale car ils reflètent ce qui a été calculé côté serveur
        // Si pointsChange > 0 = victoire, si pointsChange < 0 = défaite
        let isWinner = pointsChange > 0;
        
        // Vérification de cohérence avec l'équipe gagnante
        if (winnerTeam && playerTeam) {
          const teamBasedWinner = playerTeam === winnerTeam;
          if (teamBasedWinner !== isWinner) {
            console.warn('[MatchSheet] ⚠️ Mismatch between pointsChange and team winner!', {
              pointsBasedWinner: isWinner,
              teamBasedWinner,
              playerTeam,
              winnerTeam
            });
          }
        }
        
        console.log('[MatchSheet] 🏆 Final isWinner:', isWinner);
        
        // Utiliser les points explicites si disponibles, sinon calculer
        const newPoints = currentPlayer.rewards.newPoints ?? currentPlayer.points ?? 0;
        const oldPoints = currentPlayer.rewards.oldPoints ?? Math.max(0, newPoints - pointsChange);
        
        console.log('[MatchSheet] 🎉 RANKED Report data:', {
          isWinner,
          pointsChange,
          goldEarned,
          xpEarned,
          oldPoints,
          newPoints,
          rewards: currentPlayer.rewards
        });
        
        setMatchReportData({
          isWinner,
          rewards: {
            pointsChange: pointsChange,
            goldEarned: goldEarned,
            xpEarned: xpEarned
          },
          oldRank: { points: oldPoints },
          newRank: { points: newPoints },
          mode: match.mode || selectedMode
        });
        
        setTimeout(() => setShowMatchReport(true), 500);
      } else {
        console.warn('[MatchSheet] ⚠️ No rewards found for ranked player');
      }
    } else {
      // ========== RAPPORT MATCH LADDER ==========
      console.log('[MatchSheet] 📊 Preparing LADDER match report');
      console.log('[MatchSheet] Result:', match.result);
      console.log('[MatchSheet] RewardsGiven:', match.result?.rewardsGiven);
      console.log('[MatchSheet] RewardsGiven winners:', match.result?.rewardsGiven?.winners);
      console.log('[MatchSheet] RewardsGiven xpGained:', match.result?.rewardsGiven?.winners?.xpGained);
      console.log('[MatchSheet] MySquad:', mySquad);
      console.log('[MatchSheet] Challenger:', match.challenger);
      console.log('[MatchSheet] Opponent:', match.opponent);
      console.log('[MatchSheet] Current user ID:', user?._id);
      
      if (match.result) {
        const winnerId = match.result.winner?._id?.toString() || match.result.winner?.toString();
        
        // Déterminer mon escouade : soit depuis mySquad, soit en cherchant dans challenger/opponent
        let mySquadId = mySquad?._id?.toString();
        let mySquadData = mySquad;
        
        // Si mySquad n'est pas chargé, essayer de le déterminer depuis le roster du match
        if (!mySquadId && user?._id) {
          const userIdStr = user._id.toString();
          
          // Chercher dans le roster du challenger
          const isInChallenger = match.challengerRoster?.some(r => 
            (r.user?._id?.toString() || r.user?.toString()) === userIdStr
          );
          
          // Chercher dans le roster de l'opponent
          const isInOpponent = match.opponentRoster?.some(r => 
            (r.user?._id?.toString() || r.user?.toString()) === userIdStr
          );
          
          if (isInChallenger) {
            mySquadId = match.challenger?._id?.toString();
            mySquadData = match.challenger;
            console.log('[MatchSheet] Found user in challenger roster');
          } else if (isInOpponent) {
            mySquadId = match.opponent?._id?.toString();
            mySquadData = match.opponent;
            console.log('[MatchSheet] Found user in opponent roster');
          }
        }
        
        if (mySquadId) {
          const isWinner = winnerId === mySquadId;
          
          console.log('[MatchSheet] Winner ID:', winnerId);
          console.log('[MatchSheet] My Squad ID:', mySquadId);
          console.log('[MatchSheet] Is winner:', isWinner);
          
          const rewardsGiven = match.result.rewardsGiven;
          
        if (rewardsGiven) {
          let playerXP = 0;
          if (isWinner && rewardsGiven.winners?.xpGained) {
            const userIdStr = user?._id?.toString();
            console.log('[MatchSheet] Looking for XP with userId:', userIdStr);
            console.log('[MatchSheet] xpGained array:', rewardsGiven.winners.xpGained);
            
            // Chercher l'XP du joueur dans le tableau
            const xpEntry = rewardsGiven.winners.xpGained.find(entry => {
              const entryPlayerId = entry.playerId?.toString() || entry.userId?.toString();
              console.log('[MatchSheet] Comparing:', entryPlayerId, '===', userIdStr);
              return entryPlayerId === userIdStr;
            });
            
            if (xpEntry) {
              playerXP = xpEntry.xp || 0;
              console.log('[MatchSheet] Found xpEntry:', xpEntry);
            } else if (rewardsGiven.winners.xpGained.length > 0) {
              // Si on ne trouve pas le joueur mais qu'il y a des XP, prendre la moyenne
              const totalXP = rewardsGiven.winners.xpGained.reduce((sum, e) => sum + (e.xp || 0), 0);
              playerXP = Math.floor(totalXP / rewardsGiven.winners.xpGained.length);
              console.log('[MatchSheet] Player not found in xpGained, using average XP:', playerXP);
            }
          } else if (isWinner && rewardsGiven.winners?.xp) {
            // Fallback: si xp est directement sur winners (ancien format)
            playerXP = rewardsGiven.winners.xp;
            console.log('[MatchSheet] Using direct winners.xp:', playerXP);
          }
            
            // Utiliser mySquadData ou retrouver depuis challenger/opponent
            if (!mySquadData) {
              mySquadData = match.challenger?._id?.toString() === mySquadId 
                ? match.challenger 
                : match.opponent;
            }
            
            console.log('[MatchSheet] 🎉 LADDER Report data:', {
              isWinner,
              playerGold: isWinner ? rewardsGiven.winners?.coins : rewardsGiven.losers?.coins,
              playerXP,
              squadLadderPoints: isWinner ? rewardsGiven.squad?.ladderPointsWin : rewardsGiven.squad?.ladderPointsLoss,
              squadGeneralPoints: isWinner ? rewardsGiven.squad?.generalPointsWin : rewardsGiven.squad?.generalPointsLoss
            });
            
            setLadderReportData({
              isWinner,
              mySquad: mySquadData,
              rewards: {
                playerGold: isWinner ? rewardsGiven.winners?.coins : rewardsGiven.losers?.coins,
                playerXP: playerXP,
                squadLadderPoints: isWinner 
                  ? rewardsGiven.squad?.ladderPointsWin 
                  : rewardsGiven.squad?.ladderPointsLoss,
                squadGeneralPoints: isWinner 
                  ? rewardsGiven.squad?.generalPointsWin 
                  : rewardsGiven.squad?.generalPointsLoss
              },
              mode: match.mode || selectedMode
            });
            
            setTimeout(() => setShowLadderReport(true), 500);
          } else {
            console.warn('[MatchSheet] ⚠️ No rewardsGiven found in match result');
          }
        } else {
          console.warn('[MatchSheet] ⚠️ Could not determine mySquadId');
        }
      } else {
        console.warn('[MatchSheet] ⚠️ No match.result found');
      }
    }
  }, [match?.status, match?._id, matchId, mySquad, user, isRankedMatch, selectedMode, reportShownForMatch]);

  // Poll for updates
  useEffect(() => {
    if (!initialLoadDone) return;
    const interval = setInterval(() => fetchMatchData(false), 30000);
    return () => clearInterval(interval);
  }, [initialLoadDone, matchId]);

  // Listen for new chat messages in real-time
  useEffect(() => {
    if (!socket || !matchId) return;

    const handleNewChatMessage = (data) => {
      if (data.matchId === matchId || data.matchId?.toString() === matchId) {
        // Skip if this message was sent by us (already added locally)
        if (data.message._id && sentMessageIdsRef.current.has(data.message._id)) {
          console.log('[MatchSheet] Skipping duplicate socket message:', data.message._id);
          return;
        }
        // Vérifier si le message n'existe pas déjà
        setMessages(prev => {
          const exists = prev.some(m => m._id === data.message._id);
          if (exists) return prev;
          return [...prev, data.message];
        });
        setTimeout(scrollChatToBottom, 50);
      }
    };

    const handleMatchUpdate = (data) => {
      console.log('[MatchSheet] 📨 matchUpdate received:', data);
      
      if (data.matchId === matchId || data.matchId?.toString() === matchId) {
        console.log('[MatchSheet] ✅ Match ID matches, updating state...');
        if (data.match) {
          // Si le match est annulé, rediriger vers la page ranked du bon mode
          if (data.match.status === 'cancelled') {
            const matchMode = data.match.mode || selectedMode || 'hardcore';
            navigate(`/${matchMode}/ranked`);
            return;
          }
          
          console.log('[MatchSheet] Setting match with status:', data.match.status);
          // Le useEffect séparé va détecter le changement et afficher le rapport
          setMatch(data.match);
        } else {
          console.log('[MatchSheet] No match data in event, fetching...');
          fetchMatchData(false);
        }
      }
    };
    
    // Écouter l'annulation du match
    const handleMatchCancelled = (data) => {
      if (data.matchId === matchId || data.matchId?.toString() === matchId) {
        // Rediriger vers la page ranked du bon mode
        const matchMode = data.mode || selectedMode || 'hardcore';
        navigate(`/${matchMode}/ranked`);
      }
    };
    
    socket.on('matchCancellationApproved', handleMatchCancelled);

    // Rejoindre la room du match
    console.log('[MatchSheet] Joining match room:', matchId, 'isRanked:', isRankedMatch);
    if (isRankedMatch) {
      socket.emit('joinRankedMatch', matchId);
    } else {
      socket.emit('joinMatch', matchId);
    }

    socket.on('newChatMessage', handleNewChatMessage);
    socket.on('matchUpdate', handleMatchUpdate);
    socket.on('matchCancellationApproved', handleMatchCancelled);
    
    // Listener spécifique pour les mises à jour de matchs classés
    if (isRankedMatch) {
      const handleRankedMatchUpdate = (updatedMatch) => {
        console.log('[MatchSheet] rankedMatchUpdate received:', updatedMatch);
        handleMatchUpdate({ match: updatedMatch, matchId: updatedMatch._id });
      };
      
      const handleRankedMatchMessage = (message) => {
        console.log('[MatchSheet] rankedMatchMessage received:', message);
        handleNewChatMessage({ message, matchId });
      };
      
      socket.on('rankedMatchUpdate', handleRankedMatchUpdate);
      socket.on('rankedMatchMessage', handleRankedMatchMessage);

      // Listener pour les mises à jour de vote d'annulation
      const handleCancellationVoteUpdate = (data) => {
        console.log('[MatchSheet] cancellationVoteUpdate received:', data);
        if (data.matchId === matchId || data.matchId?.toString() === matchId) {
          setCancellationVotes({
            currentVotes: data.currentVotes || 0,
            requiredVotes: data.requiredVotes || 0,
            totalPlayers: data.totalPlayers || 0,
            hasVoted: data.votedBy?.toString() === (user?._id || user?.id)?.toString() ? data.hasVoted : cancellationVotes.hasVoted,
            isActive: data.currentVotes > 0
          });
          // Si annulé, rediriger vers la page ranked du bon mode
          if (data.isCancelled) {
            const matchMode = data.mode || selectedMode || 'hardcore';
            navigate(`/${matchMode}/ranked`);
          }
        }
      };
      socket.on('cancellationVoteUpdate', handleCancellationVoteUpdate);

      // Cleanup pour les listeners ranked
      return () => {
        socket.off('newChatMessage', handleNewChatMessage);
        socket.off('matchUpdate', handleMatchUpdate);
        socket.off('matchCancellationApproved', handleMatchCancelled);
        socket.off('rankedMatchUpdate', handleRankedMatchUpdate);
        socket.off('rankedMatchMessage', handleRankedMatchMessage);
        socket.off('cancellationVoteUpdate', handleCancellationVoteUpdate);
      };
    }
    
    console.log('[MatchSheet] Socket listeners attached');

    return () => {
      socket.off('newChatMessage', handleNewChatMessage);
      socket.off('matchUpdate', handleMatchUpdate);
      socket.off('matchCancellationApproved', handleMatchCancelled);
      if (isRankedMatch) {
        socket.emit('leaveRankedMatch', matchId);
      } else {
        socket.emit('leaveMatch', matchId);
      }
    };
  }, [socket, matchId, isRankedMatch, navigate]);

  // Listen for GGSecure connection status changes
  useEffect(() => {
    if (!socket || !matchId) return;

    const handleGGSecureDisconnect = (data) => {
      if (data.matchId === matchId || data.matchId === parseInt(matchId)) {
        const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
        
        const systemMessage = {
          _id: `ggsecure-disconnect-${Date.now()}`,
          isSystem: true,
          messageType: 'ggsecure_disconnect',
          username: data.username, // Stocker le nom du joueur pour l'affichage traduit
          createdAt: timestamp,
          user: { username: 'SYSTEM' }
        };
        setMessages(prev => [...prev, systemMessage]);
        setTimeout(scrollChatToBottom, 50);
      }
    };

    const handleGGSecureReconnect = (data) => {
      if (data.matchId === matchId || data.matchId === parseInt(matchId)) {
        const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
        
        const systemMessage = {
          _id: `ggsecure-reconnect-${Date.now()}`,
          isSystem: true,
          messageType: 'ggsecure_reconnect',
          username: data.username, // Stocker le nom du joueur pour l'affichage traduit
          createdAt: timestamp,
          user: { username: 'SYSTEM' }
        };
        setMessages(prev => [...prev, systemMessage]);
        setTimeout(scrollChatToBottom, 50);
      }
    };

    socket.on('playerGGSecureDisconnect', handleGGSecureDisconnect);
    socket.on('playerGGSecureReconnect', handleGGSecureReconnect);

    return () => {
      socket.off('playerGGSecureDisconnect', handleGGSecureDisconnect);
      socket.off('playerGGSecureReconnect', handleGGSecureReconnect);
    };
  }, [socket, matchId, t.playerDisconnected, t.playerReconnected]);

  // Chat container ref
  const chatContainerRef = useRef(null);
  
  const scrollChatToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  const initialScrollDone = useRef(false);
  useEffect(() => {
    if (initialLoadDone && messages.length > 0 && !initialScrollDone.current) {
      setTimeout(() => {
        scrollChatToBottom();
        initialScrollDone.current = true;
      }, 100);
    }
  }, [initialLoadDone, messages.length]);

  // Track sent message IDs to avoid duplicates
  const sentMessageIdsRef = useRef(new Set());
  
  // Force result (admin/staff only)
  const handleForceResult = async (winner) => {
    if (!isStaff) return;
    
    setSubmittingResult(true);
    try {
      const response = await fetch(`${API_URL}/ranked-matches/admin/${matchId}/force-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ winner, reason: 'Résultat forcé via feuille de match' })
      });
      
      const data = await response.json();
      console.log('[MatchSheet] Force result response:', data);
      
      if (data.success) {
        setMatch(data.match);
        setShowResultModal(false);
      } else {
        alert(data.message || 'Erreur lors du forçage du résultat');
      }
    } catch (err) {
      console.error('Error forcing result:', err);
      alert('Erreur lors du forçage du résultat');
    } finally {
      setSubmittingResult(false);
    }
  };
  
  // Resolve dispute (admin/staff only)
  const handleResolveDispute = async (winner) => {
    if (!isStaff) return;
    
    setSubmittingResult(true);
    try {
      const apiUrl = isRankedMatch 
        ? `${API_URL}/ranked-matches/admin/${matchId}/resolve-dispute`
        : `${API_URL}/matches/admin/${matchId}/resolve-dispute`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          winner: isRankedMatch ? winner : (winner === 1 ? match.challenger?._id : match.opponent?._id), 
          resolution: 'Résolu par le staff via feuille de match' 
        })
      });
      
      const data = await response.json();
      console.log('[MatchSheet] Resolve dispute response:', data);
      
      if (data.success) {
        setMatch(data.match);
        alert(language === 'fr' ? 'Litige résolu avec succès !' : 'Dispute resolved successfully!');
      } else {
        alert(data.message || 'Erreur lors de la résolution du litige');
      }
    } catch (err) {
      console.error('Error resolving dispute:', err);
      alert('Erreur lors de la résolution du litige');
    } finally {
      setSubmittingResult(false);
    }
  };
  
  // Cancel match (admin/staff only)
  const handleCancelMatch = async () => {
    if (!isStaff) return;
    
    const reason = prompt(language === 'fr' ? 'Raison de l\'annulation :' : 'Cancellation reason:');
    if (!reason) return;
    
    setSubmittingResult(true);
    try {
      const apiUrl = isRankedMatch 
        ? `${API_URL}/ranked-matches/admin/${matchId}/cancel`
        : `${API_URL}/matches/admin/${matchId}/cancel`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason })
      });
      
      const data = await response.json();
      console.log('[MatchSheet] Cancel match response:', data);
      
      if (data.success) {
        alert(language === 'fr' ? 'Match annulé avec succès !' : 'Match cancelled successfully!');
        navigate(-1);
      } else {
        alert(data.message || 'Erreur lors de l\'annulation du match');
      }
    } catch (err) {
      console.error('Error cancelling match:', err);
      alert('Erreur lors de l\'annulation du match');
    } finally {
      setSubmittingResult(false);
    }
  };
  
  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sendingMessage) return;

    setSendingMessage(true);
    try {
      const apiUrl = isRankedMatch 
        ? `${API_URL}/ranked-matches/${matchId}/chat`
        : `${API_URL}/matches/${matchId}/chat`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: newMessage.trim() })
      });

      const data = await response.json();
      if (data.success) {
        // Track this message ID to avoid socket duplicate
        if (data.message._id) {
          sentMessageIdsRef.current.add(data.message._id);
          // Clean up after 5 seconds
          setTimeout(() => {
            sentMessageIdsRef.current.delete(data.message._id);
          }, 5000);
        }
        setMessages(prev => {
          // Double check it doesn't exist
          const exists = prev.some(m => m._id === data.message._id);
          if (exists) return prev;
          return [...prev, data.message];
        });
        setNewMessage('');
        setTimeout(scrollChatToBottom, 50);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  // Check if user is leader
  const isLeader = () => {
    if (!mySquad || !user) return false;
    // Le leader est stocké dans mySquad.leader, pas dans members[].role
    const leaderId = mySquad.leader?._id || mySquad.leader;
    return leaderId?.toString() === user.id?.toString();
  };

  // Check if user is leader or officer (can manage matches)
  const canManageMatch = () => {
    if (!mySquad || !user) return false;
    
    // Vérifier si c'est le leader
    const leaderId = mySquad.leader?._id || mySquad.leader;
    if (leaderId?.toString() === user.id?.toString()) return true;
    
    // Vérifier si c'est un officier
    const member = mySquad.members?.find(m => 
      (m.user?._id || m.user)?.toString() === user.id?.toString()
    );
    return member?.role === 'officer';
  };

  // Submit match result (vote for winner in ranked mode)
  const handleSubmitResult = async (winner) => {
    if (isRankedMatch) {
      // En mode classé, tous les participants peuvent voter
      if (!isRankedParticipant && !isStaff) return;
    } else {
      if (!canManageMatch()) return;
    }
    
    setSubmittingResult(true);
    try {
      const apiUrl = isRankedMatch 
        ? `${API_URL}/ranked-matches/${matchId}/result`
        : `${API_URL}/matches/${matchId}/result`;
      
      const body = isRankedMatch 
        ? { winner }
        : { winnerId: winner };
      
      console.log('[MatchSheet] Submitting result:', { apiUrl, body });
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      const data = await response.json();
      console.log('[MatchSheet] Result response:', data);
      
      if (data.success) {
        setMatch(data.match);
        setShowResultModal(false);
        
        // Afficher un message de confirmation du vote (mode classé)
        if (isRankedMatch && data.message) {
          const systemMessage = {
            _id: `vote-report-${Date.now()}`,
            isSystem: true,
            message: data.message,
            createdAt: new Date(),
            user: { username: 'SYSTEM' }
          };
          setMessages(prev => [...prev, systemMessage]);
        } else if (data.waitingForOther) {
          // Afficher un message si on attend l'autre équipe (mode ladder)
          const systemMessage = {
            _id: `result-report-${Date.now()}`,
            isSystem: true,
            message: data.message || `Rapport enregistré. En attente de l'autre équipe.`,
            createdAt: new Date(),
            user: { username: 'SYSTEM' }
          };
          setMessages(prev => [...prev, systemMessage]);
        }
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error('Error submitting result:', err);
      alert('Erreur lors de la soumission du résultat');
    } finally {
      setSubmittingResult(false);
    }
  };


  // Check if my team is the host
  const isMyTeamHost = () => {
    if (isRankedMatch) {
      return match.hostTeam === myTeam;
    }
    return mySquad && match.hostTeam && match.hostTeam._id === mySquad._id;
  };

  // Submit cancellation request (ladder matches only)
  const handleSubmitCancellation = async () => {
    if (!cancellationReason.trim()) return;
    
    setSubmittingCancellation(true);
    try {
      const response = await fetch(`${API_URL}/matches/${matchId}/request-cancellation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: cancellationReason })
      });

      const data = await response.json();
      console.log('[MatchSheet] Cancellation request response:', data);
      if (data.success) {
        setMatch(data.match);
        setShowCancellationModal(false);
        setCancellationReason('');
        console.log('[MatchSheet] Cancellation request sent successfully, match updated');
        // Le message sera affiché dans le chat via Socket.io
      } else {
        // Afficher l'erreur dans le chat comme message système
        const errorMessage = {
          _id: `error-${Date.now()}`,
          isSystem: true,
          message: data.message || 'Erreur lors de la demande',
          createdAt: new Date(),
          user: { username: 'SYSTEM' }
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (err) {
      console.error('Error submitting cancellation:', err);
      const errorMessage = {
        _id: `error-${Date.now()}`,
        isSystem: true,
        message: 'Erreur lors de l\'envoi de la demande d\'annulation',
        createdAt: new Date(),
        user: { username: 'SYSTEM' }
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSubmittingCancellation(false);
    }
  };
  
  // Fetch game mode rules
  const fetchRules = async () => {
    if (!match || !match.gameMode) return;
    
    setLoadingRules(true);
    try {
      // Map game mode to rules slug
      const gameModeSlug = match.gameMode === 'Search & Destroy' ? 'snd' 
        : match.gameMode === 'Hardpoint' ? 'hardpoint'
        : match.gameMode === 'Team Deathmatch' ? 'tdm' 
        : match.gameMode === 'Duel' ? 'duel' 
        : 'snd';
        
      const response = await fetch(`${API_URL}/game-mode-rules/${selectedMode}/ranked/${gameModeSlug}`);
      const data = await response.json();
      
      if (data.success && data.rules) {
        setRules(data.rules);
      }
    } catch (err) {
      console.error('Error fetching rules:', err);
    } finally {
      setLoadingRules(false);
    }
  };
  // Respond to cancellation request (accept or reject)
  const handleRespondCancellation = async (approved) => {
    setRespondingCancellation(true);
    try {
      const response = await fetch(`${API_URL}/matches/${matchId}/respond-cancellation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ approved })
      });

      const data = await response.json();
      if (data.success) {
        // Si l'annulation est acceptée, rediriger vers le dashboard du mode
        if (approved && data.match?.status === 'cancelled') {
          navigate(`/${selectedMode}`);
          return;
        }
        setMatch(data.match);
      } else {
        const errorMessage = {
          _id: `error-${Date.now()}`,
          isSystem: true,
          message: data.message || 'Erreur lors de la réponse',
          createdAt: new Date(),
          user: { username: 'SYSTEM' }
        };
        setMessages(prev => [...prev, errorMessage]);
        setTimeout(scrollChatToBottom, 50);
      }
    } catch (err) {
      console.error('Error responding to cancellation:', err);
      const errorMessage = {
        _id: `error-${Date.now()}`,
        isSystem: true,
        message: 'Erreur lors de la réponse à la demande',
        createdAt: new Date(),
        user: { username: 'SYSTEM' }
      };
      setMessages(prev => [...prev, errorMessage]);
      setTimeout(scrollChatToBottom, 50);
    } finally {
      setRespondingCancellation(false);
    }
  };

  // Check if there's a pending cancellation request and if the user can respond
  const canRespondToCancellation = () => {
    if (!match?.cancellationRequest || match.cancellationRequest.status !== 'pending') return false;
    if (!mySquad) return false;
    if (!canManageMatch()) return false;
    
    // L'équipe qui a demandé ne peut pas répondre
    const requestedBySquadId = match.cancellationRequest.requestedBy?.toString() || match.cancellationRequest.requestedBy;
    const mySquadId = mySquad._id?.toString() || mySquad._id;
    
    return requestedBySquadId !== mySquadId;
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { color: 'yellow', text: t.pending },
      accepted: { color: 'blue', text: t.accepted },
      ready: { color: 'green', text: t.inProgress }, // Pour mode classé, "ready" = "en cours"
      in_progress: { color: 'green', text: t.inProgress },
      completed: { color: 'gray', text: t.completed },
      cancelled: { color: 'red', text: t.cancelled },
      disputed: { color: 'orange', text: t.disputed },
    };
    return statusMap[status] || statusMap.pending;
  };

  // Check who can validate (leader/officer for ladder, all participants for ranked)
  const canValidateResult = () => {
    if (isRankedMatch) {
      // En mode classé, tous les participants peuvent voter
      return isRankedParticipant;
    }
    return canManageMatch();
  };
  
  // Helper pour calculer les stats de vote pour le gagnant
  const getWinnerVoteStats = () => {
    if (!isRankedMatch || !match.result?.playerVotes) {
      return { votesForTeam1: 0, votesForTeam2: 0, totalPlayers: 0, threshold: 0, hasVoted: false, myVote: null };
    }
    const totalPlayers = match.players?.length || 0;
    const playerVotes = match.result.playerVotes || [];
    const votesForTeam1 = playerVotes.filter(v => v.winner === 1).length;
    const votesForTeam2 = playerVotes.filter(v => v.winner === 2).length;
    const threshold = Math.ceil(totalPlayers * 0.6);
    const userId = (user?._id || user?.id)?.toString();
    const myVoteObj = playerVotes.find(v => (v.user?._id || v.user)?.toString() === userId);
    return {
      votesForTeam1,
      votesForTeam2,
      totalPlayers,
      threshold,
      hasVoted: !!myVoteObj,
      myVote: myVoteObj?.winner || null
    };
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

  const isMyTeamChallenger = mySquad?._id?.toString() === match.challenger?._id?.toString();
  const isMyTeamOpponent = mySquad?._id?.toString() === match.opponent?._id?.toString();
  
  const isRankedParticipant = isRankedMatch && match.players?.some(p => {
    const pUserId = (p.user?._id || p.user)?.toString();
    const currentUserId = (user?._id || user?.id)?.toString();
    return pUserId === currentUserId;
  });
  const isParticipant = isRankedMatch ? isRankedParticipant : (isMyTeamChallenger || isMyTeamOpponent);
  
  // Debug logs for ranked validation
  if (isRankedMatch) {
    console.log('[MatchSheet] Ranked match validation check:', {
      isRankedParticipant,
      isReferent,
      matchStatus: match.status,
      canValidate: canValidateResult(),
      myTeam,
      userId: (user?._id || user?.id)?.toString(),
      players: match.players?.map(p => ({
        oderId: (p.user?._id || p.user)?.toString(),
        username: p.user?.username
      }))
    });
  }
  
  const statusBadge = getStatusBadge(match.status);

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

        {/* Teams Display */}
        <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-${accentColor}-500/20 p-4 sm:p-6 mb-4 sm:mb-6`}>
          <div className="flex items-center justify-center gap-3 sm:gap-8">
            {isRankedMatch ? (
              <>
                {/* Équipe 1 */}
                <div className={`flex-1 text-center ${myTeam === 1 ? 'relative' : ''}`}>
                  {myTeam === 1 && (
                    <span className="absolute -top-1 sm:-top-2 left-1/2 -translate-x-1/2 px-1.5 sm:px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] sm:text-xs rounded-full whitespace-nowrap">
                      {t.yourTeam}
                    </span>
                  )}
                  <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-lg sm:rounded-xl mx-auto mb-2 sm:mb-3 bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center border-2 border-blue-500/50">
                    <span className="text-white font-black text-lg sm:text-3xl">1</span>
                  </div>
                  <h3 className={`text-sm sm:text-xl font-bold transition-colors truncate ${myTeam === 1 ? 'text-yellow-400' : 'text-blue-400'}`}>
                    {t.team} 1
                  </h3>
                  {match.hostTeam === 1 && (
                    <span className="text-green-400 text-xs flex items-center justify-center gap-1 mt-1">
                      <Crown className="w-3 h-3" /> ({t.host})
                    </span>
                  )}
                </div>

                {/* VS */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center shadow-lg shadow-${accentColor}-500/30`}>
                    <span className="text-white font-black text-sm sm:text-xl">{t.vs}</span>
                  </div>
                </div>

                {/* Équipe 2 */}
                <div className={`flex-1 text-center ${myTeam === 2 ? 'relative' : ''}`}>
                  {myTeam === 2 && (
                    <span className="absolute -top-1 sm:-top-2 left-1/2 -translate-x-1/2 px-1.5 sm:px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] sm:text-xs rounded-full whitespace-nowrap">
                      {t.yourTeam}
                    </span>
                  )}
                  <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-lg sm:rounded-xl mx-auto mb-2 sm:mb-3 bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center border-2 border-purple-500/50">
                    <span className="text-white font-black text-lg sm:text-3xl">2</span>
                  </div>
                  <h3 className={`text-sm sm:text-xl font-bold transition-colors truncate ${myTeam === 2 ? 'text-yellow-400' : 'text-purple-400'}`}>
                    {t.team} 2
                  </h3>
                  {match.hostTeam === 2 && (
                    <span className="text-green-400 text-xs flex items-center justify-center gap-1 mt-1">
                      <Crown className="w-3 h-3" /> ({t.host})
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Challenger - Ladder */}
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
                  </Link>
                  {match.hostTeam?._id === match.challenger?._id && (
                    <span className="text-green-400 text-xs flex items-center justify-center gap-1 mt-1">
                      <Crown className="w-3 h-3" /> ({t.host})
                    </span>
                  )}
                </div>

                {/* VS */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center shadow-lg shadow-${accentColor}-500/30`}>
                    <span className="text-white font-black text-sm sm:text-xl">{t.vs}</span>
                  </div>
                </div>

                {/* Opponent - Ladder */}
                <div className={`flex-1 text-center ${isMyTeamOpponent ? 'relative' : ''}`}>
                  {isMyTeamOpponent && (
                    <span className="absolute -top-1 sm:-top-2 left-1/2 -translate-x-1/2 px-1.5 sm:px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] sm:text-xs rounded-full whitespace-nowrap">
                      {t.yourTeam}
                    </span>
                  )}
                  {match.opponent ? (
                    <>
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
                      </Link>
                      {match.hostTeam?._id === match.opponent?._id && (
                        <span className="text-green-400 text-xs flex items-center justify-center gap-1 mt-1">
                          <Crown className="w-3 h-3" /> ({t.host})
                        </span>
                      )}
                    </>
                  ) : (
                    <div className="opacity-50">
                      <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-lg sm:rounded-xl mx-auto mb-2 sm:mb-3 bg-dark-800 flex items-center justify-center border-2 border-dashed border-white/20">
                        <span className="text-xl sm:text-3xl">?</span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-500">...</h3>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Voice Channel Warning - Only for ranked matches that are not completed */}
        {isRankedMatch && !['completed', 'cancelled'].includes(match.status) && (
          <div className="bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl sm:rounded-2xl p-4 sm:p-5 mb-4 sm:mb-6">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-purple-500/20 rounded-xl flex-shrink-0">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-sm sm:text-base mb-1">{t.voiceChannelRequired}</h3>
                <p className="text-gray-300 text-xs sm:text-sm">{t.voiceChannelMessage}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Column - Match Info */}
          <div className="lg:col-span-1 space-y-4 sm:space-y-4">
            {/* Match Info */}
            <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-${accentColor}-500/20 p-4 sm:p-5`}>
              <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <Shield className={`w-4 h-4 text-${accentColor}-400`} />
                {t.matchInfo}
              </h2>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-gray-500 text-sm">{t.gameMode}</span>
                  {match.isVariant && match.mode === 'cdl' ? (
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2 py-0.5 bg-${accentColor}-500/20 rounded text-${accentColor}-400 text-xs font-medium`}>
                        Variant
                      </span>
                      <div className="flex flex-wrap gap-1 justify-end">
                        <span className="px-1.5 py-0.5 bg-cyan-500/10 rounded text-cyan-400 text-[10px]">
                          {language === 'fr' ? 'Points Stratégiques' : 'Hardpoint'}
                        </span>
                        <span className="px-1.5 py-0.5 bg-purple-500/10 rounded text-purple-400 text-[10px]">
                          {language === 'fr' ? 'Recherche et Destruction' : 'Search & Destroy'}
                        </span>
                        <span className="px-1.5 py-0.5 bg-orange-500/10 rounded text-orange-400 text-[10px]">
                          {language === 'fr' ? 'Surcharge' : 'Control'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className={`px-2 py-0.5 bg-${accentColor}-500/20 rounded text-${accentColor}-400 text-xs font-medium`}>
                      {match.gameMode}
                    </span>
                  )}
                </div>
                
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-gray-500 text-sm">{t.mapSelection}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    isRankedMatch && match.selectedMap?.name
                      ? 'bg-green-500/20 text-green-400'
                      : isRankedMatch || match.mapType === 'random'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-cyan-500/20 text-cyan-400'
                  }`}>
                    {isRankedMatch 
                      ? (match.selectedMap?.name ? t.mapVoted : t.mapRandom) 
                      : (match.mapType === 'random' ? t.mapRandom : t.mapFree)}
                  </span>
                </div>
                
                {/* Selected Map (ranked mode) */}
                {isRankedMatch && match.selectedMap?.name && (
                  <div className="py-2 border-b border-white/5">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500 text-sm flex items-center gap-1.5">
                        <Map className="w-3.5 h-3.5" />
                        {language === 'fr' ? 'Map' : 'Map'}
                      </span>
                      <span className={`px-2 py-0.5 bg-${accentColor}-500/20 rounded text-${accentColor}-400 text-xs font-bold`}>
                        {match.selectedMap.name}
                      </span>
                    </div>
                    {match.selectedMap.image && (
                      <div className="mt-2 rounded-lg overflow-hidden border border-white/10">
                        <img 
                          src={match.selectedMap.image} 
                          alt={match.selectedMap.name}
                          className="w-full h-24 object-cover"
                        />
                      </div>
                    )}
                  </div>
                )}
                
                {!isRankedMatch && (
                  <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                    <span className="text-gray-500 text-sm">{t.ladder}</span>
                    <span className="text-white text-sm font-medium">
                      {match.ladderId === 'duo-trio' ? t.chill : t.competitive}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-gray-500 text-sm">{t.format}</span>
                  <span className="text-white font-semibold text-sm">{match.teamSize}v{match.teamSize}</span>
                </div>
                
                {(match.acceptedAt || match.scheduledAt || match.startedAt || match.createdAt) && (
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-gray-500 text-sm">{t.startedAt}</span>
                    <span className="text-white text-sm font-medium">
                      {new Date(match.acceptedAt || match.startedAt || match.scheduledAt || match.createdAt).toLocaleString(
                        language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : language === 'it' ? 'it-IT' : 'en-US',
                        { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Bouton pour voir les règles du mode de jeu - Uniquement pour les matchs classés */}
            {isRankedMatch && (
              <button
                onClick={() => {
                  fetchRules();
                  setShowRulesModal(true);
                }}
                className={`w-full py-2.5 rounded-lg border border-${accentColor}-500/30 bg-${accentColor}-500/10 hover:bg-${accentColor}-500/20 transition-all flex items-center justify-center gap-2`}
              >
                <BookOpen className={`w-4 h-4 text-${accentColor}-400`} />
                <span className={`text-${accentColor}-400 font-medium text-sm`}>
                  {t.viewGameRules}
                </span>
              </button>
            )}

            {/* Référents - Uniquement pour mode classé */}
            {isRankedMatch && (match.team1Referent || match.team2Referent) && (
              <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-yellow-500/20 p-4 sm:p-5`}>
                <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                  <Crown className="w-4 h-4 text-yellow-400" />
                  {t.referents}
                </h2>
                
                <div className="space-y-3">
                  {match.team1Referent && (
                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <div className="w-1 h-8 rounded-full bg-blue-500"></div>
                      <img 
                        src={match.team1Referent.avatarUrl || (match.team1Referent.discordAvatar 
                          ? `https://cdn.discordapp.com/avatars/${match.team1Referent.discordId}/${match.team1Referent.discordAvatar}.png` 
                          : 'https://cdn.discordapp.com/embed/avatars/0.png')}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover border border-blue-500/30"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{match.team1Referent.username}</p>
                        <p className="text-blue-400 text-xs">{t.team} 1</p>
                      </div>
                      <Crown className="w-4 h-4 text-yellow-400" />
                    </div>
                  )}
                  
                  {match.team2Referent && (
                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <div className="w-1 h-8 rounded-full bg-purple-500"></div>
                      <img 
                        src={match.team2Referent.avatarUrl || (match.team2Referent.discordAvatar 
                          ? `https://cdn.discordapp.com/avatars/${match.team2Referent.discordId}/${match.team2Referent.discordAvatar}.png` 
                          : 'https://cdn.discordapp.com/embed/avatars/0.png')}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover border border-purple-500/30"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{match.team2Referent.username}</p>
                        <p className="text-purple-400 text-xs">{t.team} 2</p>
                      </div>
                      <Crown className="w-4 h-4 text-yellow-400" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Maps tirées au sort - Ne pas afficher si une map a été votée en ranked */}
            {((match.maps && match.maps.length > 0) || (match.randomMaps && match.randomMaps.length > 0)) && !(isRankedMatch && match.selectedMap?.name) && (
              <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-${accentColor}-500/20 p-4 sm:p-5`}>
                <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                  <Shuffle className={`w-4 h-4 text-${accentColor}-400`} />
                  {t.mapsDrawn}
                </h2>
                
                <div className="space-y-2">
                  {(match.maps || match.randomMaps || []).map((map, index) => {
                    // Pour les matchs classés, winner est 1 ou 2
                    // Pour les matchs ladder, winner est l'ID de la squad
                    const isWinnerTeam1 = isRankedMatch ? map.winner === 1 : map.winner === match.challenger?._id;
                    const isWinnerTeam2 = isRankedMatch ? map.winner === 2 : map.winner === match.opponent?._id;
                    
                    return (
                    <div 
                      key={index}
                      className={`relative overflow-hidden rounded-lg border ${
                        isWinnerTeam1
                          ? 'border-blue-500/50 bg-blue-500/10' 
                          : isWinnerTeam2
                            ? 'border-purple-500/50 bg-purple-500/10'
                            : 'border-white/10 bg-dark-800/50'
                      }`}
                    >
                      {/* Image de la map en background */}
                      {map.image && (
                        <div className="absolute inset-0">
                          <img 
                            src={map.image} 
                            alt={map.name}
                            className="w-full h-full object-cover opacity-20"
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-dark-900/90 via-dark-900/70 to-transparent"></div>
                        </div>
                      )}
                      
                      <div className="relative flex items-center gap-3 p-3">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                          isWinnerTeam1
                            ? 'bg-blue-500 text-white' 
                            : isWinnerTeam2
                              ? 'bg-purple-500 text-white'
                              : `bg-${accentColor}-500/20 text-${accentColor}-400`
                        }`}>
                          {map.order || index + 1}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm truncate">{map.name}</p>
                          {map.winner && (
                            <p className={`text-xs ${isWinnerTeam1 ? 'text-blue-400' : 'text-purple-400'}`}>
                              {isRankedMatch 
                                ? (language === 'fr' ? `Gagnée par Équipe ${map.winner}` : `Won by Team ${map.winner}`)
                                : (language === 'fr' ? `Gagnée par ${isWinnerTeam1 ? match.challenger?.name : match.opponent?.name}` : `Won by ${isWinnerTeam1 ? match.challenger?.name : match.opponent?.name}`)
                              }
                            </p>
                          )}
                        </div>
                        
                        {map.winner && (
                          <Trophy className={`w-4 h-4 ${isWinnerTeam1 ? 'text-blue-400' : 'text-purple-400'}`} />
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Vote Progress for Winner - Ranked matches only */}
            {isRankedMatch && ['ready', 'in_progress'].includes(match.status) && match.result?.playerVotes?.length > 0 && (
              <div className="bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-cyan-500/20 p-4">
                <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-cyan-400" />
                  {t.winnerVoteProgress || 'Votes pour le gagnant'}
                </h3>
                
                {/* Vote bars */}
                <div className="space-y-2 mb-3">
                  {/* Team 1 votes */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-blue-400">{t.team} 1</span>
                      <span className="text-gray-400">{getWinnerVoteStats().votesForTeam1} {language === 'fr' ? 'vote(s)' : 'vote(s)'}</span>
                    </div>
                    <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${(getWinnerVoteStats().votesForTeam1 / Math.max(1, getWinnerVoteStats().threshold)) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Team 2 votes */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-purple-400">{t.team} 2</span>
                      <span className="text-gray-400">{getWinnerVoteStats().votesForTeam2} {language === 'fr' ? 'vote(s)' : 'vote(s)'}</span>
                    </div>
                    <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500 transition-all duration-300"
                        style={{ width: `${(getWinnerVoteStats().votesForTeam2 / Math.max(1, getWinnerVoteStats().threshold)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Threshold info */}
                <div className="text-xs text-center text-gray-400 mb-3">
                  {language === 'fr' 
                    ? `${getWinnerVoteStats().threshold} votes requis sur ${getWinnerVoteStats().totalPlayers} joueurs (60%)`
                    : `${getWinnerVoteStats().threshold} votes required out of ${getWinnerVoteStats().totalPlayers} players (60%)`
                  }
                </div>
                
                {/* Current user vote status */}
                {getWinnerVoteStats().hasVoted && (
                  <div className="text-center text-xs py-2 bg-green-500/10 rounded-lg border border-green-500/20">
                    <span className="text-green-400">
                      ✓ {t.yourVote || 'Votre vote'}: {t.team} {getWinnerVoteStats().myVote}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Actions - Sélectionner gagnant */}
            {isParticipant && canValidateResult() && ['accepted', 'in_progress', 'ready'].includes(match.status) && (
              <button
                onClick={() => setShowResultModal(true)}
                className={`w-full py-2.5 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2`}
              >
                <Trophy className="w-4 h-4" />
                {getWinnerVoteStats().hasVoted ? (t.changeVote || 'Changer mon vote') : (t.voteForWinner || t.selectWinner)}
              </button>
            )}
            
            {/* Staff Controls - For in_progress, ready, accepted matches */}
            {isStaff && ['accepted', 'in_progress', 'ready'].includes(match.status) && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-yellow-400 text-sm font-bold mb-3 flex items-center gap-2">
                  ⚡ {language === 'fr' ? 'Actions Staff' : 'Staff Actions'}
                </p>
                
                <div className="space-y-3">
                  {/* Forcer un résultat */}
                  <div>
                    <p className="text-gray-400 text-xs mb-2">{language === 'fr' ? 'Forcer le résultat :' : 'Force result:'}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => isRankedMatch ? handleForceResult(1) : handleResolveDispute(1)}
                        disabled={submittingResult}
                        className="flex-1 py-2 px-3 bg-blue-500/20 border border-blue-500/40 rounded-lg text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-all disabled:opacity-50"
                      >
                        {isRankedMatch ? `${t.team} 1` : match.challenger?.name}
                      </button>
                      <button
                        onClick={() => isRankedMatch ? handleForceResult(2) : handleResolveDispute(2)}
                        disabled={submittingResult}
                        className="flex-1 py-2 px-3 bg-purple-500/20 border border-purple-500/40 rounded-lg text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-all disabled:opacity-50"
                      >
                        {isRankedMatch ? `${t.team} 2` : match.opponent?.name}
                      </button>
                    </div>
                  </div>
                  
                  {/* Annuler le match */}
                  <button
                    onClick={handleCancelMatch}
                    disabled={submittingResult}
                    className="w-full py-2 px-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 text-sm font-medium hover:bg-red-500/30 transition-all disabled:opacity-50"
                  >
                    {language === 'fr' ? '❌ Annuler le match' : '❌ Cancel Match'}
                  </button>
                </div>
              </div>
            )}

            {/* Demande d'annulation par vote - Uniquement pour les matchs classés */}
            {isRankedMatch && isRankedParticipant && ['ready', 'in_progress'].includes(match.status) && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-orange-400 font-semibold text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {t.cancellationVotes || 'Votes pour annuler'}
                  </h3>
                  <span className="text-xs text-gray-400">
                    {cancellationVotes.requiredVotes > 0 && (
                      <>80% {t.required || 'requis'}</>
                    )}
                  </span>
                </div>
                
                {/* Barre de progression des votes */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{cancellationVotes.currentVotes} {t.votesProgress || 'votes sur'} {cancellationVotes.totalPlayers}</span>
                    <span>{cancellationVotes.requiredVotes} {t.required || 'requis'}</span>
                  </div>
                  <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        cancellationVotes.currentVotes >= cancellationVotes.requiredVotes 
                          ? 'bg-green-500' 
                          : 'bg-orange-500'
                      }`}
                      style={{ 
                        width: `${Math.min(100, (cancellationVotes.currentVotes / Math.max(1, cancellationVotes.requiredVotes)) * 100)}%` 
                      }}
                    />
                  </div>
                </div>
                
                {/* Bouton de vote */}
                <button
                  onClick={handleToggleCancellationVote}
                  disabled={votingCancellation}
                  className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    cancellationVotes.hasVoted
                      ? 'bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30'
                      : 'bg-orange-500/20 border border-orange-500/40 text-orange-400 hover:bg-orange-500/30'
                  } disabled:opacity-50`}
                >
                  {votingCancellation ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : cancellationVotes.hasVoted ? (
                    <>
                      <Shield className="w-4 h-4" />
                      {t.removeVote || 'Retirer mon vote'}
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4" />
                      {t.voteCancellation || 'Voter pour annuler'}
                    </>
                  )}
                </button>
                
                <p className="text-xs text-gray-500 mt-2 text-center">
                  {language === 'fr' 
                    ? '80% des joueurs doivent voter pour annuler le match' 
                    : '80% of players must vote to cancel the match'}
                </p>
              </div>
            )}

            {/* Bouton Appeler un arbitre - Uniquement pour les matchs classés en cours */}
            {isRankedMatch && isRankedParticipant && ['ready', 'in_progress'].includes(match.status) && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <h3 className="text-blue-400 font-semibold text-sm">
                    {hasCalledArbitrator ? (t.arbitratorCalled || 'Arbitre appelé') : (t.callArbitrator || 'Appeler un arbitre')}
                  </h3>
                </div>
                
                {hasCalledArbitrator ? (
                  <div className="text-center py-2">
                    <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="font-medium">{t.arbitratorCalled || 'Arbitre appelé'}</span>
                    </div>
                    <p className="text-gray-400 text-xs">
                      {t.arbitratorCalledDesc || 'Un arbitre a été notifié et interviendra dès que possible.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleCallArbitrator}
                      disabled={callingArbitrator}
                      className="w-full py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 bg-blue-500/20 border border-blue-500/40 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50"
                    >
                      {callingArbitrator ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                          {t.callArbitrator || 'Appeler un arbitre'}
                        </>
                      )}
                    </button>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      {language === 'fr' 
                        ? 'Ce bouton ne peut être utilisé qu\'une seule fois par match' 
                        : 'This button can only be used once per match'}
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Bouton demande d'annulation - Uniquement pour les matchs ladder */}
            {/* Afficher si pas de demande en cours OU si la dernière demande a été refusée OU si pending sans requestedBy (données corrompues) */}
            {!isRankedMatch && isParticipant && canManageMatch() && ['accepted', 'in_progress', 'ready'].includes(match.status) && (!match.cancellationRequest?.status || match.cancellationRequest?.status === 'rejected' || (match.cancellationRequest?.status === 'pending' && !match.cancellationRequest?.requestedBy)) && (
              <button
                onClick={() => setShowCancellationModal(true)}
                className="w-full py-2.5 bg-orange-500/10 border border-orange-500/30 rounded-lg text-orange-400 text-sm font-medium hover:bg-orange-500/20 transition-all flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                {t.requestCancellation}
              </button>
            )}

            {/* Demande d'annulation en attente - Boutons pour l'autre équipe */}
            {!isRankedMatch && match.cancellationRequest?.requestedBy && match.cancellationRequest?.status === 'pending' && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-blue-400" />
                  <h3 className="text-blue-400 font-semibold">{t.pendingCancellation}</h3>
                </div>
                <p className="text-gray-300 text-sm mb-2">
                  <span className="font-semibold text-blue-400">{match.cancellationRequest.requestedBySquadName || 'Une équipe'}</span> {t.cancellationRequestSent}
                </p>
                {match.cancellationRequest.reason && (
                  <p className="text-gray-400 text-xs mb-3 italic">"{match.cancellationRequest.reason}"</p>
                )}
                
                {canRespondToCancellation() && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRespondCancellation(true)}
                      disabled={respondingCancellation}
                      className="flex-1 py-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm font-medium hover:bg-green-500/30 transition-all disabled:opacity-50"
                    >
                      {respondingCancellation ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t.acceptCancellation}
                    </button>
                    <button
                      onClick={() => handleRespondCancellation(false)}
                      disabled={respondingCancellation}
                      className="flex-1 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm font-medium hover:bg-red-500/30 transition-all disabled:opacity-50"
                    >
                      {respondingCancellation ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t.rejectCancellation}
                    </button>
                  </div>
                )}
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
                  {match.dispute?.reason && (
                    <div className="mt-2 p-2 bg-dark-800/50 rounded border border-white/5">
                      <p className="text-gray-400 text-xs uppercase mb-1">{t.disputeReason}:</p>
                      <p className="text-white text-sm">{match.dispute.reason}</p>
                    </div>
                  )}
                  
                  {/* Staff Controls for Dispute Resolution */}
                  {isStaff && (
                    <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <p className="text-yellow-400 text-sm font-bold mb-3 flex items-center gap-2">
                        ⚡ {language === 'fr' ? 'Résoudre le litige (Staff)' : 'Resolve Dispute (Staff)'}
                      </p>
                      
                      <div className="space-y-3">
                        {/* Donner la victoire */}
                        <div>
                          <p className="text-gray-400 text-xs mb-2">{language === 'fr' ? 'Donner la victoire à :' : 'Award victory to:'}</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleResolveDispute(1)}
                              disabled={submittingResult}
                              className="flex-1 py-2 px-3 bg-blue-500/20 border border-blue-500/40 rounded-lg text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-all disabled:opacity-50"
                            >
                              {isRankedMatch ? `${t.team} 1` : match.challenger?.name}
                            </button>
                            <button
                              onClick={() => handleResolveDispute(2)}
                              disabled={submittingResult}
                              className="flex-1 py-2 px-3 bg-purple-500/20 border border-purple-500/40 rounded-lg text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-all disabled:opacity-50"
                            >
                              {isRankedMatch ? `${t.team} 2` : match.opponent?.name}
                            </button>
                          </div>
                        </div>
                        
                        {/* Annuler le match */}
                        <button
                          onClick={handleCancelMatch}
                          disabled={submittingResult}
                          className="w-full py-2 px-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 text-sm font-medium hover:bg-red-500/30 transition-all disabled:opacity-50"
                        >
                          {language === 'fr' ? '❌ Annuler le match' : '❌ Cancel Match'}
                        </button>
                      </div>
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
                    {isRankedMatch 
                      ? `${t.team} ${match.result.winner}`
                      : (match.result.winner === match.challenger?._id ? match.challenger?.name : match.opponent?.name)
                    }
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Chat & Rosters */}
          <div className="lg:col-span-2 space-y-4">
            {/* Chat */}
            <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl sm:rounded-2xl border ${match.status === 'disputed' ? 'border-orange-500/30' : `border-${accentColor}-500/20`} p-3 sm:p-4 flex flex-col`}>
              <h2 className={`text-xs sm:text-sm font-semibold ${match.status === 'disputed' ? 'text-orange-400' : 'text-gray-300'} mb-2 sm:mb-3 flex items-center gap-2 uppercase tracking-wider`}>
                <MessageCircle className="w-3 sm:w-4 h-3 sm:h-4" />
                {t.chat}
              </h2>
              
              {/* Messages */}
              <div 
                ref={chatContainerRef}
                className={`flex-1 bg-dark-950/50 rounded-lg p-2 sm:p-3 mb-2 sm:mb-3 overflow-y-auto max-h-[200px] sm:max-h-[250px] min-h-[120px] border ${match.status === 'disputed' ? 'border-orange-500/20' : 'border-white/5'}`}
              >
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <p className="text-gray-600 text-sm">💬</p>
                    <div className="px-3 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg max-w-[90%]">
                      <p className="text-orange-400 text-xs text-center">{t.warningMessage}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Message de prévention système */}
                    <div className="flex justify-center">
                      <div className="px-3 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg max-w-[90%]">
                        <p className="text-orange-400 text-xs text-center">{t.warningMessage}</p>
                      </div>
                    </div>
                    
                    {messages.filter(msg => {
                      // Filtrer les messages vides (sauf messages système avec messageType)
                      if (msg.isSystem && msg.messageType) return true;
                      if (msg.isSystem && msg.message && msg.message.trim()) return true;
                      if (!msg.isSystem && msg.message && msg.message.trim()) return true;
                      return false;
                    }).map((msg, index) => {
                      // Message système
                      if (msg.isSystem) {
                        let displayMessage = msg.message || '';
                        let messageStyle = 'default'; // default, disconnect, reconnect, cancellation
                        
                        // Si c'est un message GGSecure avec messageType, traduire
                        if (msg.messageType === 'ggsecure_disconnect' || msg.messageType === 'ggsecure_reconnect') {
                          const timestamp = new Date(msg.createdAt);
                          const timeString = timestamp.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            second: '2-digit'
                          });
                          const username = msg.username || msg.user?.username || 'Joueur';
                          
                          if (msg.messageType === 'ggsecure_disconnect') {
                            displayMessage = `${username} ${t.playerDisconnected} (${timeString})`;
                            messageStyle = 'disconnect';
                          } else {
                            displayMessage = `${username} ${t.playerReconnected} (${timeString})`;
                            messageStyle = 'reconnect';
                          }
                        }
                        
                        // Si c'est une demande d'annulation
                        if (msg.messageType === 'cancellation_request') {
                          const squadName = msg.username || 'Une équipe';
                          displayMessage = `${squadName} ${t.cancellationRequestSent}`;
                          if (msg.message) {
                            displayMessage += ` - Raison : ${msg.message}`;
                          }
                          messageStyle = 'cancellation';
                        }
                        
                        // Si c'est une réponse à une demande d'annulation
                        if (msg.messageType === 'cancellation_accepted') {
                          const squadName = msg.username || 'Une équipe';
                          displayMessage = `${squadName} ${t.cancellationAccepted}`;
                          messageStyle = 'reconnect'; // vert
                        }
                        
                        if (msg.messageType === 'cancellation_rejected') {
                          const squadName = msg.username || 'Une équipe';
                          displayMessage = `${squadName} ${t.cancellationRejected}`;
                          messageStyle = 'disconnect'; // rouge
                        }
                        
                        // Styles selon le type de message
                        let bgClass = 'bg-gray-500/10 border-gray-500/30';
                        let textClass = 'text-gray-400';
                        
                        if (messageStyle === 'disconnect') {
                          bgClass = 'bg-red-500/10 border-red-500/30';
                          textClass = 'text-red-400';
                        } else if (messageStyle === 'reconnect') {
                          bgClass = 'bg-green-500/10 border-green-500/30';
                          textClass = 'text-green-400';
                        } else if (messageStyle === 'cancellation') {
                          bgClass = 'bg-blue-500/10 border-blue-500/30';
                          textClass = 'text-blue-400';
                        }
                        
                        return (
                          <div key={msg._id || index} className="flex justify-center">
                            <div className={`px-3 py-1.5 ${bgClass} border rounded-lg max-w-[85%]`}>
                              <p className={`${textClass} text-xs text-center`}>{displayMessage}</p>
                            </div>
                          </div>
                        );
                      }

                      const isMyMessage = msg.user?._id === user?.id;
                      const isMsgStaff = msg.isStaff || msg.user?.roles?.some(r => ['admin', 'staff', 'arbitre', 'gerant_cdl', 'gerant_hardcore'].includes(r));
                      
                      let teamColor = 'gray';
                      if (isMsgStaff) {
                        teamColor = 'yellow';
                      } else if (isRankedMatch) {
                        teamColor = msg.team === 1 ? 'blue' : 'purple';
                      } else {
                        const isChallenger = msg.squad === match.challenger?._id;
                        teamColor = isChallenger ? 'blue' : 'purple';
                      }
                      
                      return (
                        <div key={msg._id || index} className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%]`}>
                            <div className={`flex items-center gap-1.5 mb-0.5 ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                              {isMsgStaff && <span className="px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/30 rounded text-[10px] font-bold text-yellow-400">STAFF</span>}
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
                  <input 
                    type="text" 
                    value={newMessage} 
                    onChange={(e) => setNewMessage(e.target.value)} 
                    placeholder={t.typePlaceholder} 
                    className={`flex-1 px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-${accentColor}-500/50`} 
                    maxLength={500} 
                  />
                  <button 
                    type="submit" 
                    disabled={!newMessage.trim() || sendingMessage} 
                    className={`px-4 py-2 bg-${accentColor}-500/20 hover:bg-${accentColor}-500/30 border border-${accentColor}-500/30 rounded-lg text-${accentColor}-400 disabled:opacity-30`}
                  >
                    {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>
              )}
            </div>

            {/* Rosters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {isRankedMatch ? (
                <>
                  {/* Équipe 1 - Mode classé */}
                  <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-blue-500/20 p-3 sm:p-4`}>
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      {t.team} 1
                      {match.hostTeam === 1 && (
                        <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded">{t.host}</span>
                      )}
                    </h3>
                    <div className="space-y-2">
                      {match.players?.filter(p => p.team === 1).map((p, idx) => {
                        const player = p.user || { username: p.username, isFake: p.isFake };
                        const avatar = player.avatarUrl || (player.discordAvatar 
                          ? `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png` 
                          : 'https://cdn.discordapp.com/embed/avatars/0.png');
                        // Le référent doit être un vrai joueur et correspondre à l'ID du référent de l'équipe
                        const isRef = !p.isFake && player._id && match.team1Referent?._id && 
                                     (match.team1Referent._id.toString() === player._id.toString() || 
                                      match.team1Referent.toString() === player._id.toString());
                        // Obtenir le rang du joueur
                        const playerRank = getRankFromPoints(p.points || 0, language);
                        return (
                          <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg ${isRef ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-dark-800/50'}`}>
                            <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                            <div className="flex-1 min-w-0">
                              {!p.isFake && player._id ? (
                                <Link to={`/player/${player._id}`} className="hover:text-cyan-400 transition-colors">
                                  <p className="text-white text-sm font-medium truncate hover:underline">{player.username || p.username}</p>
                                </Link>
                              ) : (
                                <p className="text-white text-sm font-medium truncate">{player.username || p.username}</p>
                              )}
                              {player.activisionId && <p className="text-gray-500 text-xs truncate">{player.activisionId}</p>}
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Badge de rang */}
                              <div 
                                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gradient-to-r ${playerRank.gradient} border border-white/20`}
                                title={`${playerRank.name} - ${p.points || 0} pts`}
                              >
                                <img src={playerRank.image} alt={playerRank.name} className="w-4 h-4 object-contain" />
                                <span className="text-white text-[10px] font-bold">{playerRank.name}</span>
                              </div>
                              {player.platform && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${player.platform === 'PC' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                                  {player.platform}
                                </span>
                              )}
                              {isRef && <Crown className="w-3.5 h-3.5 text-yellow-400" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Équipe 2 - Mode classé */}
                  <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-purple-500/20 p-3 sm:p-4`}>
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-400" />
                      {t.team} 2
                      {match.hostTeam === 2 && (
                        <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded">{t.host}</span>
                      )}
                    </h3>
                    <div className="space-y-2">
                      {match.players?.filter(p => p.team === 2).map((p, idx) => {
                        const player = p.user || { username: p.username, isFake: p.isFake };
                        const avatar = player.avatarUrl || (player.discordAvatar 
                          ? `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png` 
                          : 'https://cdn.discordapp.com/embed/avatars/0.png');
                        // Le référent doit être un vrai joueur et correspondre à l'ID du référent de l'équipe
                        const isRef = !p.isFake && player._id && match.team2Referent?._id && 
                                     (match.team2Referent._id.toString() === player._id.toString() || 
                                      match.team2Referent.toString() === player._id.toString());
                        // Obtenir le rang du joueur
                        const playerRank = getRankFromPoints(p.points || 0, language);
                        return (
                          <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg ${isRef ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-dark-800/50'}`}>
                            <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                            <div className="flex-1 min-w-0">
                              {!p.isFake && player._id ? (
                                <Link to={`/player/${player._id}`} className="hover:text-cyan-400 transition-colors">
                                  <p className="text-white text-sm font-medium truncate hover:underline">{player.username || p.username}</p>
                                </Link>
                              ) : (
                                <p className="text-white text-sm font-medium truncate">{player.username || p.username}</p>
                              )}
                              {player.activisionId && <p className="text-gray-500 text-xs truncate">{player.activisionId}</p>}
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Badge de rang */}
                              <div 
                                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gradient-to-r ${playerRank.gradient} border border-white/20`}
                                title={`${playerRank.name} - ${p.points || 0} pts`}
                              >
                                <img src={playerRank.image} alt={playerRank.name} className="w-4 h-4 object-contain" />
                                <span className="text-white text-[10px] font-bold">{playerRank.name}</span>
                              </div>
                              {player.platform && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${player.platform === 'PC' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                                  {player.platform}
                                </span>
                              )}
                              {isRef && <Crown className="w-3.5 h-3.5 text-yellow-400" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Challenger Roster - Ladder */}
                  <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-blue-500/20 p-3 sm:p-4`}>
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      {match.challenger?.name}
                      {match.hostTeam?._id === match.challenger?._id && (
                        <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded">{t.host}</span>
                      )}
                    </h3>
                    {match.challengerRoster?.length > 0 ? (
                      <div className="space-y-2">
                        {match.challengerRoster.map((p, idx) => {
                          const player = p.user;
                          if (!player) return null;
                          const avatar = player.avatarUrl || (player.discordAvatar ? `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png');
                          return (
                            <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg bg-dark-800/50`}>
                              <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                              <div className="flex-1 min-w-0">
                                {player._id ? (
                                  <Link to={`/player/${player._id}`} className="hover:text-cyan-400 transition-colors">
                                    <p className="text-white text-sm font-medium truncate hover:underline">{player.username}</p>
                                  </Link>
                                ) : (
                                  <p className="text-white text-sm font-medium truncate">{player.username}</p>
                                )}
                                {player.activisionId && <p className="text-gray-500 text-xs truncate">{player.activisionId}</p>}
                              </div>
                              {player.platform && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${player.platform === 'PC' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                                  {player.platform}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-xs text-center py-4">{t.noRoster}</p>
                    )}
                  </div>

                  {/* Opponent Roster - Ladder */}
                  {match.opponent && (
                    <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-purple-500/20 p-3 sm:p-4`}>
                      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-400" />
                        {match.opponent?.name}
                        {match.hostTeam?._id === match.opponent?._id && (
                          <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded">{t.host}</span>
                        )}
                      </h3>
                      {match.opponentRoster?.length > 0 ? (
                        <div className="space-y-2">
                          {match.opponentRoster.map((p, idx) => {
                            const player = p.user;
                            if (!player) return null;
                            const avatar = player.avatarUrl || (player.discordAvatar ? `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png');
                            return (
                              <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg bg-dark-800/50`}>
                                <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                                <div className="flex-1 min-w-0">
                                  {player._id ? (
                                    <Link to={`/player/${player._id}`} className="hover:text-cyan-400 transition-colors">
                                      <p className="text-white text-sm font-medium truncate hover:underline">{player.username}</p>
                                    </Link>
                                  ) : (
                                    <p className="text-white text-sm font-medium truncate">{player.username}</p>
                                  )}
                                  {player.activisionId && <p className="text-gray-500 text-xs truncate">{player.activisionId}</p>}
                                </div>
                                {player.platform && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${player.platform === 'PC' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                                    {player.platform}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-xs text-center py-4">{t.noRoster}</p>
                      )}
                    </div>
                  )}
                </>
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
              {isRankedMatch 
                ? (getWinnerVoteStats().hasVoted ? (t.changeVote || 'Changer mon vote') : (t.voteForWinner || 'Voter pour le gagnant'))
                : t.selectWinner
              }
            </h3>
            
            {/* Info votes existants (mode classé - nouveau système) */}
            {isRankedMatch && match.result?.playerVotes?.length > 0 && (
              <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <p className="text-cyan-400 text-sm font-medium mb-2">📊 {language === 'fr' ? 'Votes en cours' : 'Current votes'}:</p>
                <div className="space-y-2">
                  {/* Team 1 votes */}
                  <div className="flex items-center justify-between">
                    <span className="text-blue-400 text-sm">{t.team} 1</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-dark-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${(getWinnerVoteStats().votesForTeam1 / Math.max(1, getWinnerVoteStats().threshold)) * 100}%` }}
                        />
                      </div>
                      <span className="text-gray-400 text-xs">{getWinnerVoteStats().votesForTeam1} vote(s)</span>
                    </div>
                  </div>
                  {/* Team 2 votes */}
                  <div className="flex items-center justify-between">
                    <span className="text-purple-400 text-sm">{t.team} 2</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-dark-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-500 transition-all"
                          style={{ width: `${(getWinnerVoteStats().votesForTeam2 / Math.max(1, getWinnerVoteStats().threshold)) * 100}%` }}
                        />
                      </div>
                      <span className="text-gray-400 text-xs">{getWinnerVoteStats().votesForTeam2} vote(s)</span>
                    </div>
                  </div>
                </div>
                <p className="text-gray-400 text-xs mt-2 text-center">
                  {language === 'fr' 
                    ? `${getWinnerVoteStats().threshold} votes requis sur ${getWinnerVoteStats().totalPlayers} joueurs`
                    : `${getWinnerVoteStats().threshold} votes required out of ${getWinnerVoteStats().totalPlayers} players`
                  }
                </p>
                {getWinnerVoteStats().hasVoted && (
                  <p className="text-green-400 text-xs mt-1 text-center">
                    ✓ {t.yourVote || 'Votre vote'}: {t.team} {getWinnerVoteStats().myVote}
                  </p>
                )}
              </div>
            )}
            
            <div className="space-y-3">
              {isRankedMatch ? (
                <>
                  {/* Admin/Staff : Forcer le résultat */}
                  {isStaff && (
                    <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <p className="text-yellow-400 text-sm font-bold mb-3">⚡ Mode Staff - Forcer le résultat</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleForceResult(1)}
                          disabled={submittingResult}
                          className="flex-1 py-2 px-3 bg-blue-500/20 border border-blue-500/40 rounded-lg text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-all disabled:opacity-50"
                        >
                          Équipe 1 gagne
                        </button>
                        <button
                          onClick={() => handleForceResult(2)}
                          disabled={submittingResult}
                          className="flex-1 py-2 px-3 bg-purple-500/20 border border-purple-500/40 rounded-lg text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-all disabled:opacity-50"
                        >
                          Équipe 2 gagne
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Mon équipe a gagné */}
                  <button
                    onClick={() => handleSubmitResult(myTeam)}
                    disabled={submittingResult}
                    className="w-full p-4 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-xl text-left transition-all group disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${myTeam === 1 ? 'bg-blue-500/30' : 'bg-purple-500/30'}`}>
                          <span className={`font-bold text-lg ${myTeam === 1 ? 'text-blue-400' : 'text-purple-400'}`}>{myTeam}</span>
                        </div>
                        <div>
                          <p className="text-white font-semibold">{t.team} {myTeam}</p>
                          <p className="text-green-400 text-sm">{t.weWon}</p>
                        </div>
                      </div>
                      <Trophy className="w-6 h-6 text-green-400" />
                    </div>
                  </button>

                  {/* L'autre équipe a gagné */}
                  <button
                    onClick={() => handleSubmitResult(myTeam === 1 ? 2 : 1)}
                    disabled={submittingResult}
                    className="w-full p-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-left transition-all group disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${myTeam === 1 ? 'bg-purple-500/30' : 'bg-blue-500/30'}`}>
                          <span className={`font-bold text-lg ${myTeam === 1 ? 'text-purple-400' : 'text-blue-400'}`}>{myTeam === 1 ? 2 : 1}</span>
                        </div>
                        <div>
                          <p className="text-white font-semibold">{t.team} {myTeam === 1 ? 2 : 1}</p>
                          <p className="text-red-400 text-sm">{t.theyWon}</p>
                        </div>
                      </div>
                      <AlertTriangle className="w-6 h-6 text-red-400" />
                    </div>
                  </button>
                </>
              ) : (
                <>
                  {/* Notre squad a gagné */}
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
                      <Trophy className="w-6 h-6 text-green-400" />
                    </div>
                  </button>

                  {/* L'autre squad a gagné */}
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
                      <AlertTriangle className="w-6 h-6 text-red-400" />
                    </div>
                  </button>
                </>
              )}
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

      {/* Cancellation Request Modal - Ladder matches only */}
      {showCancellationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-dark-900 rounded-2xl border border-orange-500/30 p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-orange-400" />
              {t.cancellationRequest}
            </h3>
            
            <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <p className="text-orange-400 text-sm">{t.cancellationWarning}</p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">{t.cancellationReason}</label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder={t.cancellationReasonPlaceholder}
                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500/50 resize-none"
                rows={4}
                maxLength={500}
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCancellationModal(false);
                  setCancellationReason('');
                }}
                className="flex-1 py-2.5 bg-dark-800 hover:bg-dark-700 border border-white/10 rounded-lg text-gray-400 font-medium transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleSubmitCancellation}
                disabled={!cancellationReason.trim() || submittingCancellation}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 rounded-lg text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submittingCancellation ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    {t.submitCancellation}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal des règles du mode de jeu */}
      {showRulesModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 rounded-2xl border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <BookOpen className="w-6 h-6 text-cyan-400" />
                {t.gameRules} - {match?.gameMode}
              </h2>
              <button
                onClick={() => setShowRulesModal(false)}
                className="p-2 rounded-lg bg-dark-800 hover:bg-dark-700 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingRules ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
                  <span className="ml-3 text-gray-400">{t.loadingRules}</span>
                </div>
              ) : rules && rules.sections?.length > 0 ? (
                <div className="space-y-6">
                  {rules.sections.sort((a, b) => a.order - b.order).map((section, idx) => (
                    <div key={idx} className="bg-dark-800/50 rounded-xl p-4 border border-white/5">
                      <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
                        {section.title[language] || section.title.fr}
                      </h3>
                      <div 
                        className="text-gray-300 text-sm leading-relaxed prose prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ 
                          __html: section.content[language] || section.content.fr || '' 
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500">{language === 'fr' ? 'Aucune règle disponible pour ce mode de jeu' : 'No rules available for this game mode'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rapport de Combat (Mode Classé uniquement) */}
      {isRankedMatch && showMatchReport && matchReportData && (
        <RankedMatchReport
          show={showMatchReport}
          onClose={() => setShowMatchReport(false)}
          isWinner={matchReportData.isWinner}
          rewards={matchReportData.rewards}
          oldRank={matchReportData.oldRank}
          newRank={matchReportData.newRank}
          mode={matchReportData.mode}
          matchId={matchId}
          isReferent={isReferent}
        />
      )}

      {/* Rapport de Combat (Match Ladder) */}
      {!isRankedMatch && showLadderReport && ladderReportData && (
        <LadderMatchReport
          show={showLadderReport}
          onClose={() => setShowLadderReport(false)}
          isWinner={ladderReportData.isWinner}
          mySquad={ladderReportData.mySquad}
          rewards={ladderReportData.rewards}
          mode={ladderReportData.mode}
          matchId={matchId}
          canDispute={canManageMatch()}
        />
      )}
    </div>
  );
};

export default MatchSheet;
