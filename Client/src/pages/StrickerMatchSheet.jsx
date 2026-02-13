import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Users, Trophy, Shield, Crown, MessageCircle, 
  Send, Loader2, CheckCircle, XCircle, Phone, AlertTriangle,
  Map, Check, Play, Clock, User, Shuffle, X, ChevronRight, Mic, Ban, Crosshair, BookOpen, Eye
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { useSocket } from '../SocketContext';
import { useMode } from '../ModeContext';
import { getUserAvatar } from '../utils/avatar';
import StrickerMatchReport from '../components/StrickerMatchReport';

import { API_URL } from '../config';

// Stricker Ranks
const STRICKER_RANKS = {
  recrues: { key: 'recrues', name: 'Recrues', min: 0, max: 249, color: '#7ED321', image: '/stricker1.png' },
  operateurs: { key: 'operateurs', name: 'Opérateurs', min: 250, max: 499, color: '#7ED321', image: '/stricker2.png' },
  veterans: { key: 'veterans', name: 'Vétérans', min: 500, max: 749, color: '#7ED321', image: '/stricker3.png' },
  commandants: { key: 'commandants', name: 'Commandants', min: 750, max: 999, color: '#7ED321', image: '/stricker4.png' },
  seigneurs: { key: 'seigneurs', name: 'Seigneurs de Guerre', min: 1000, max: 1499, color: '#7ED321', image: '/stricker5.png' },
  immortel: { key: 'immortel', name: 'Immortel', min: 1500, max: Infinity, color: '#7ED321', image: '/stricker6.png' }
};

const getStrickerRank = (points) => {
  if (points >= 1500) return STRICKER_RANKS.immortel;
  if (points >= 1000) return STRICKER_RANKS.seigneurs;
  if (points >= 750) return STRICKER_RANKS.commandants;
  if (points >= 500) return STRICKER_RANKS.veterans;
  if (points >= 250) return STRICKER_RANKS.operateurs;
  return STRICKER_RANKS.recrues;
};

// Helper function for animated title styling (same as public profile)
const getTitleStyles = (rarity) => {
  const baseClasses = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border shadow-sm';
  
  const rarityClasses = {
    legendary: 'bg-gradient-to-r from-yellow-500/30 via-amber-400/30 to-yellow-500/30 border-yellow-400/60 text-yellow-300',
    epic: 'bg-gradient-to-r from-purple-500/30 via-pink-400/30 to-purple-500/30 border-purple-400/60 text-purple-300',
    rare: 'bg-gradient-to-r from-blue-500/30 via-cyan-400/30 to-blue-500/30 border-blue-400/60 text-blue-300',
    common: 'bg-gradient-to-r from-gray-500/30 via-slate-400/30 to-gray-500/30 border-gray-400/60 text-gray-300'
  };

  const animations = {
    legendary: 'glowPulseLegendary 2s ease-in-out infinite',
    epic: 'glowPulseEpic 2s ease-in-out infinite',
    rare: 'glowPulseRare 2s ease-in-out infinite',
    common: 'glowPulseCommon 2s ease-in-out infinite'
  };

  const textShadows = {
    legendary: '0 0 15px rgba(251, 191, 36, 0.8), 0 0 30px rgba(251, 191, 36, 0.4)',
    epic: '0 0 15px rgba(168, 85, 247, 0.8), 0 0 30px rgba(168, 85, 247, 0.4)',
    rare: '0 0 10px rgba(59, 130, 246, 0.6), 0 0 20px rgba(59, 130, 246, 0.3)',
    common: '0 0 8px rgba(156, 163, 175, 0.4)'
  };

  const r = rarity || 'common';
  
  return {
    className: `${baseClasses} ${rarityClasses[r] || rarityClasses.common}`,
    style: {
      animation: animations[r] || animations.common,
      textShadow: textShadows[r] || textShadows.common
    }
  };
};

// Helper to check if a PC player is connected to Iris (heartbeat within last 3 minutes)
const isPlayerConnectedToIris = (player) => {
  if (!player || player.platform !== 'PC') return null; // Not a PC player
  if (!player.irisLastSeen) return false; // Never connected
  
  const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
  const lastSeen = new Date(player.irisLastSeen);
  return lastSeen > threeMinutesAgo;
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
    drawnMaps: 'Maps tirées au sort',
    status: {
      pending: 'En attente',
      roster_selection: 'Sélection du roster',
      map_vote: 'Vote de la map',
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
    notVotedYet: 'Pas encore voté',
    // Pre-match translations
    preMatchTitle: 'Avant Match',
    rosterSelection: 'Sélection du Roster',
    rosterSelectionDesc: 'Choisissez les joueurs de votre escouade qui participeront au match',
    selectPlayer: 'Sélectionner',
    selectedPlayers: 'Joueurs sélectionnés',
    availableMembers: 'Membres disponibles',
    waitingOpponent: 'En attente de l\'adversaire...',
    rosterReady: 'Roster prêt !',
    mapVote: 'Vote de la Map',
    mapVoteDesc: 'Votez pour la carte sur laquelle vous souhaitez jouer',
    voteForMap: 'Voter',
    votes: 'votes',
    searchAndDestroy: 'Recherche et Destruction',
    format3v3: '3v3',
    format5v5: '5v5',
    squadVsSquad: 'Escouade vs Escouade',
    readyToStart: 'Prêt à démarrer',
    confirmReady: 'Confirmer prêt',
    waitingForReady: 'En attente que tous les joueurs soient prêts',
    matchStarting: 'Le match va commencer !',
    joinVoiceChannel: 'Rejoindre le vocal',
    voiceChannelRequired: 'Salon vocal obligatoire',
    matchFound: 'Match trouvé !',
    preparingMatch: 'Préparation du match...',
    selectingRoster: 'Sélection des joueurs...',
    onlyLeaderOrOfficer: 'Seul le leader ou un officier peut effectuer cette action',
    // Cancellation
    requestCancel: 'Demander l\'annulation',
    cancelVote: 'Annuler le match ?',
    cancelYes: 'Oui, annuler',
    cancelNo: 'Non, continuer',
    waitingOpponentCancelVote: 'En attente de l\'autre équipe...',
    yourTeamWantsCancel: 'Votre équipe veut annuler',
    opponentWantsCancel: 'demande l\'annulation',
    bothMustAgree: 'Les deux référents doivent être d\'accord',
    matchCancelledByAgreement: 'Match annulé d\'un commun accord',
    cancelRequestPending: 'Demande d\'annulation en cours',
    doYouWantToCancel: 'Souhaitez-vous annuler ?',
    // Map ban
    mapBan: 'Bannissement de Maps',
    mapBanDesc: 'Chaque référent bannit 1 map à tour de rôle',
    banMap: 'Bannir',
    banned: 'Bannie',
    yourTurnToBan: 'C\'est votre tour de bannir une map',
    opponentTurnToBan: 'Tour de l\'adversaire de bannir',
    waitingForBans: 'En attente des bannissements...',
    randomSelection: 'Tirage au sort en cours...',
    team1Banned: 'Équipe 1 a banni',
    team2Banned: 'Équipe 2 a banni',
    // Report AFK
    reportAfk: 'Signaler équipe AFK',
    reportAfkSent: 'Signalement envoyé',
    reportAfkCooldown: 'Disponible dans',
    reportAfkDesc: 'L\'\u00e9quipe adverse a \u00e9t\u00e9 signal\u00e9e aux arbitres',
    cranes: 'munitions',
    validateWinner: 'Valider le gagnant',
    validateWinnerDesc: 'Les deux r\u00e9f\u00e9rents doivent valider le gagnant',
    onlyReferentCanVote: 'Seul le référent peut valider',
    youAreReferent: 'Vous êtes référent',
    waitingReferentVote: 'En attente de la validation des référents...',
    bothMustValidate: 'Les deux référents doivent être d\'accord',
    matchStartTime: 'Heure de début',
    requestCancellation: 'Demander l\'annulation',
    cancellationRequested: 'Annulation demandée',
    waitingOpponentCancelResponse: 'En attente de la réponse adverse',
    opponentRequestedCancellation: 'L\'équipe adverse demande l\'annulation',
    acceptCancellation: 'Accepter',
    refuseCancellation: 'Refuser',
    viewRules: 'Voir les règles',
    rules: 'Règles',
    loadingRules: 'Chargement des règles...',
    noRulesConfigured: 'Aucune règle configurée pour ce mode.',
    close: 'Fermer',
    matchStartDeadline: 'Le match doit commencer dans les 10 minutes',
    deadlineWarning: 'L\'arbitre peut sanctionner après ce délai',
    deadlineExpired: 'Délai dépassé - Sanction possible',
    ggsecureRequired: 'GGSecure requis',
    ggsecureNotConnected: 'Non connecté à GGSecure',
    ggsecureConnected: 'GGSecure connecté',
    pcPlayer: 'Joueur PC',
    // Admin controls
    adminControls: 'Panneau Admin',
    changeStatus: 'Changer le statut',
    forceVictory: 'Forcer la victoire',
    forceVictoryConfirm: 'Confirmer la victoire forcée',
    forceVictoryDesc: 'Cette action va terminer le match et distribuer les récompenses. Êtes-vous sûr ?',
    confirm: 'Confirmer',
    cancelAction: 'Annuler',
    forceWinTeam: 'Forcer victoire',
    // Helper translations
    searchHelper: 'Rechercher une aide',
    searchHelperPlaceholder: 'Rechercher un joueur...',
    addHelper: 'Ajouter une aide',
    helperBadge: 'Aide',
    oneHelperAllowed: 'Une seule aide autorisée par équipe',
    helperAlreadySelected: 'Aide déjà sélectionnée',
    selectAsHelper: 'Sélectionner comme aide',
    noResultsFound: 'Aucun résultat',
    minSearchChars: 'Minimum 2 caractères'
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
    drawnMaps: 'Drawn maps',
    status: {
      pending: 'Pending',
      roster_selection: 'Roster Selection',
      map_vote: 'Map Vote',
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
    notVotedYet: 'Not voted yet',
    // Pre-match translations
    preMatchTitle: 'Pre-Match',
    rosterSelection: 'Roster Selection',
    rosterSelectionDesc: 'Choose the players from your squad who will participate in the match',
    selectPlayer: 'Select',
    selectedPlayers: 'Selected Players',
    availableMembers: 'Available Members',
    waitingOpponent: 'Waiting for opponent...',
    rosterReady: 'Roster ready!',
    mapVote: 'Map Vote',
    mapVoteDesc: 'Vote for the map you want to play on',
    voteForMap: 'Vote',
    votes: 'votes',
    searchAndDestroy: 'Search and Destroy',
    format3v3: '3v3',
    format5v5: '5v5',
    squadVsSquad: 'Squad vs Squad',
    readyToStart: 'Ready to start',
    confirmReady: 'Confirm ready',
    waitingForReady: 'Waiting for all players to be ready',
    matchStarting: 'Match is starting!',
    joinVoiceChannel: 'Join voice channel',
    voiceChannelRequired: 'Voice channel required',
    matchFound: 'Match found!',
    preparingMatch: 'Preparing match...',
    selectingRoster: 'Selecting players...',
    onlyLeaderOrOfficer: 'Only the leader or an officer can perform this action',
    // Cancellation
    requestCancel: 'Request Cancellation',
    cancelVote: 'Cancel the match?',
    cancelYes: 'Yes, cancel',
    cancelNo: 'No, continue',
    waitingOpponentCancelVote: 'Waiting for other team...',
    yourTeamWantsCancel: 'Your team wants to cancel',
    opponentWantsCancel: 'requests cancellation',
    bothMustAgree: 'Both referents must agree',
    matchCancelledByAgreement: 'Match cancelled by mutual agreement',
    cancelRequestPending: 'Cancellation request pending',
    doYouWantToCancel: 'Do you want to cancel?',
    // Map ban
    mapBan: 'Map Ban',
    mapBanDesc: 'Each referent bans 1 map in turn',
    banMap: 'Ban',
    banned: 'Banned',
    yourTurnToBan: 'Your turn to ban a map',
    opponentTurnToBan: 'Opponent\'s turn to ban',
    waitingForBans: 'Waiting for bans...',
    randomSelection: 'Random selection in progress...',
    team1Banned: 'Team 1 banned',
    team2Banned: 'Team 2 banned',
    // Report AFK
    reportAfk: 'Report AFK team',
    reportAfkSent: 'Report sent',
    reportAfkCooldown: 'Available in',
    reportAfkDesc: 'The opposing team has been reported to arbitrators',
    cranes: 'ammo',
    validateWinner: 'Validate Winner',
    validateWinnerDesc: 'Both referents must validate the winner',
    onlyReferentCanVote: 'Only the referent can validate',
    youAreReferent: 'You are the referent',
    waitingReferentVote: 'Waiting for referent validation...',
    bothMustValidate: 'Both referents must agree',
    matchStartTime: 'Start time',
    requestCancellation: 'Request cancellation',
    cancellationRequested: 'Cancellation requested',
    waitingOpponentCancelResponse: 'Waiting for opponent response',
    opponentRequestedCancellation: 'Opponent team requests cancellation',
    acceptCancellation: 'Accept',
    refuseCancellation: 'Refuse',
    viewRules: 'View rules',
    rules: 'Rules',
    loadingRules: 'Loading rules...',
    noRulesConfigured: 'No rules configured for this mode.',
    close: 'Close',
    matchStartDeadline: 'Match must start within 10 minutes',
    deadlineWarning: 'Arbitrator can sanction after this deadline',
    deadlineExpired: 'Deadline passed - Sanction possible',
    ggsecureRequired: 'GGSecure required',
    ggsecureNotConnected: 'Not connected to GGSecure',
    ggsecureConnected: 'GGSecure connected',
    pcPlayer: 'PC Player',
    // Admin controls
    adminControls: 'Admin Panel',
    changeStatus: 'Change status',
    forceVictory: 'Force victory',
    forceVictoryConfirm: 'Confirm forced victory',
    forceVictoryDesc: 'This action will end the match and distribute rewards. Are you sure?',
    confirm: 'Confirm',
    cancelAction: 'Cancel',
    forceWinTeam: 'Force win',
    // Helper translations
    searchHelper: 'Search for helper',
    searchHelperPlaceholder: 'Search for a player...',
    addHelper: 'Add helper',
    helperBadge: 'Helper',
    oneHelperAllowed: 'Only one helper allowed per team',
    helperAlreadySelected: 'Helper already selected',
    selectAsHelper: 'Select as helper',
    noResultsFound: 'No results found',
    minSearchChars: 'Minimum 2 characters'
  }
};

const StrickerMatchSheet = () => {
  const { matchId, mode } = useParams(); // Get both matchId and mode from URL
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user, isAuthenticated, hasAdminAccess } = useAuth();
  const { socket, on, emit, joinStrickerMatch, leaveStrickerMatch } = useSocket();
  const { selectedMode } = useMode();
  const chatRef = useRef(null);
  const preMatchAudioRef = useRef(null);
  
  // States
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState(null);
  const [error, setError] = useState(null);
  const [myTeam, setMyTeam] = useState(null);
  const [isReferent, setIsReferent] = useState(false);
  const [mySquad, setMySquad] = useState(null);
  
  // Pre-match states
  const [preMatchPhase, setPreMatchPhase] = useState('loading'); // loading, roster_selection, map_vote, ready, match
  const [rosterSelection, setRosterSelection] = useState({
    isActive: false,
    currentTurn: 1,
    availableMembers: [],
    team1Selected: [],
    team2Selected: [],
    timeRemaining: 30
  });
  const [mapVoteOptions, setMapVoteOptions] = useState([]);
  const [selectedMapIndex, setSelectedMapIndex] = useState(null);
  const [mapVoteCountdown, setMapVoteCountdown] = useState(20);
  
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

  // Cancellation
  const [cancellationVotes, setCancellationVotes] = useState({ team1: null, team2: null });
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [submittingCancelVote, setSubmittingCancelVote] = useState(false);

  // Map bans
  const [mapBans, setMapBans] = useState({ team1BannedMap: null, team2BannedMap: null, currentTurn: 1 });
  const [banningMap, setBanningMap] = useState(false);

  // Report AFK
  const [reportAfkCooldown, setReportAfkCooldown] = useState(0);
  const [reportingAfk, setReportingAfk] = useState(false);
  const [hasReportedAfk, setHasReportedAfk] = useState(false);
  const [afkWaitCountdown, setAfkWaitCountdown] = useState(300); // 5 min wait before can report

  // Combat Report
  const [showMatchReport, setShowMatchReport] = useState(false);
  const [matchReportData, setMatchReportData] = useState(null);
  const [matchReportShown, setMatchReportShown] = useState(false);

  // Rules Modal
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [rules, setRules] = useState(null);
  const [loadingRules, setLoadingRules] = useState(false);

  // 10-minute countdown state for match start deadline
  const [startCountdown, setStartCountdown] = useState(null);

  // Admin controls
  const [forcingWinner, setForcingWinner] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [showForceConfirm, setShowForceConfirm] = useState(null); // null | 1 | 2

  // Helper search
  const [helperSearchQuery, setHelperSearchQuery] = useState('');
  const [helperSearchResults, setHelperSearchResults] = useState([]);
  const [searchingHelper, setSearchingHelper] = useState(false);
  const [selectingHelper, setSelectingHelper] = useState(null);
  const [myTeamHasHelper, setMyTeamHasHelper] = useState(false);

  // Translations
  const t = translations[language] || translations.en;
  
  // Use mode from URL params first, then match.mode, then selectedMode from context
  const currentMode = mode || match?.mode || selectedMode || 'hardcore';

  // Fetch match data
  const fetchMatch = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/stricker/match/${matchId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        console.log('[StrickerMatchSheet] Match data:', {
          status: data.match.status,
          isReferent: data.isReferent,
          myTeam: data.myTeam,
          team1Referent: data.match.team1Referent,
          team2Referent: data.match.team2Referent,
          userId: user?._id
        });
        setMatch(data.match);
        setMyTeam(data.myTeam);
        setIsReferent(data.isReferent);
        setMessages(data.match.chat || []);
        setMySquad(data.mySquad);
        
        // Determine pre-match phase
        if (data.match.rosterSelection?.isActive) {
          setPreMatchPhase('roster_selection');
          setRosterSelection({
            isActive: true,
            currentTurn: data.match.rosterSelection.currentTurn || 1,
            availableMembers: data.availableMembers || [],
            team1Selected: data.match.players?.filter(p => p.team === 1) || [],
            team2Selected: data.match.players?.filter(p => p.team === 2) || [],
            timeRemaining: data.match.rosterSelection.timeRemaining || 30
          });
        } else if (data.match.status === 'pending' && !(data.match.selectedMap && (typeof data.match.selectedMap === 'string' ? data.match.selectedMap : data.match.selectedMap.name)) && !data.match.freeMapChoice) {
          // Map ban phase - roster done but no map selected yet and not free choice
          setPreMatchPhase('map_vote');
          if (data.match.mapVoteOptions?.length > 0) {
            setMapVoteOptions(data.match.mapVoteOptions);
          }
          // Initialize mapBans from server data
          if (data.match.mapBans) {
            setMapBans(data.match.mapBans);
          }
        } else if (data.match.status === 'ready' || data.match.status === 'in_progress' || data.match.status === 'completed' || data.match.status === 'disputed') {
          setPreMatchPhase('match');
        } else {
          setPreMatchPhase('match');
        }
        
        // Check if current user (as referent) already voted
        if (data.isReferent) {
          if (data.myTeam === 1 && data.match.result?.team1Report?.winner) {
            setMyVote(data.match.result.team1Report.winner);
          } else if (data.myTeam === 2 && data.match.result?.team2Report?.winner) {
            setMyVote(data.match.result.team2Report.winner);
          }
        }
        
        // Check if arbitrator already called
        if (data.match.arbitratorCalls?.length > 0) {
          setHasCalledArbitrator(true);
        }
        
        // Initialize cancellation votes
        if (data.match.cancellationVotes) {
          setCancellationVotes(data.match.cancellationVotes);
        }
        
        // Initialize map bans
        if (data.match.mapBans) {
          setMapBans(data.match.mapBans);
        }
        
        // Check if my team has helper
        const hasHelper = data.myTeam === 1 ? data.team1HasHelper : data.team2HasHelper;
        setMyTeamHasHelper(hasHelper || false);
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

  // Socket events for pre-match phases
  useEffect(() => {
    if (!socket || !matchId) return;

    // Listen for roster selection updates
    const unsubRosterUpdate = on('strickerRosterUpdate', (data) => {
      if (data.matchId === matchId) {
        setRosterSelection(prev => ({
          ...prev,
          availableMembers: data.availableMembers || prev.availableMembers,
          team1Selected: data.team1Selected || prev.team1Selected,
          team2Selected: data.team2Selected || prev.team2Selected
        }));
      }
    });

    // Listen for roster selection complete
    const unsubRosterComplete = on('strickerRosterComplete', (data) => {
      if (data.matchId === matchId) {
        setRosterSelection(prev => ({ ...prev, isActive: false }));
        setPreMatchPhase('map_vote');
        if (data.mapVoteOptions) {
          setMapVoteOptions(data.mapVoteOptions);
        }
      }
    });

    // Listen for map vote updates
    const unsubMapVote = on('strickerMapVoteUpdate', (data) => {
      if (data.matchId === matchId && data.mapVoteOptions) {
        setMapVoteOptions(data.mapVoteOptions);
      }
    });

    // Listen for map ban updates
    const unsubMapBan = on('strickerMapBanUpdate', (data) => {
      if (data.matchId === matchId && data.mapBans) {
        setMapBans(data.mapBans);
      }
    });

    // Listen for map selected
    const unsubMapSelected = on('strickerMapSelected', (data) => {
      if (data.matchId === matchId) {
        setPreMatchPhase('match');
        fetchMatch();
      }
    });

    // Listen for match updates
    const unsubMatchUpdate = on('strickerMatchUpdate', (data) => {
      if (data.matchId === matchId) {
        fetchMatch();
      }
    });

    // Listen for cancellation vote updates
    const unsubCancelVote = on('strickerCancelVoteUpdate', (data) => {
      if (data.matchId === matchId) {
        setCancellationVotes(data.cancellationVotes);
      }
    });

    // Listen for match cancelled
    const unsubMatchCancelled = on('strickerMatchCancelled', (data) => {
      if (data.matchId === matchId) {
        // Redirect to stricker page based on current mode
        navigate(`/${currentMode}/stricker`);
      }
    });

    // GGSecure listeners removed - no longer relevant (Iris is used instead)

    return () => {
      unsubRosterUpdate();
      unsubRosterComplete();
      unsubMapVote();
      unsubMapBan();
      unsubMapSelected();
      unsubMatchUpdate();
      unsubCancelVote();
      unsubMatchCancelled();
    };
  }, [socket, matchId, on, fetchMatch]);

  // Fallback polling - only as safety net since socket events handle all updates
  // (strickerMatchUpdate, strickerRosterUpdate, strickerMapVoteUpdate, etc.)
  useEffect(() => {
    if (!match || match.status === 'completed' || match.status === 'cancelled') return;
    
    // Poll every 30s as fallback only (was 5s - caused server overload with many players)
    const interval = setInterval(fetchMatch, 30000);
    
    // Also refetch when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchMatch();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [match, fetchMatch]);

  // Auto scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // Join/Leave Stricker match room
  useEffect(() => {
    if (matchId && socket) {
      joinStrickerMatch(matchId);
      
      return () => {
        if (socket) {
          leaveStrickerMatch(matchId);
        }
      };
    }
  }, [matchId, socket, joinStrickerMatch, leaveStrickerMatch]);

  // No countdown timer for roster selection in Stricker mode - selections are manual

  // Map vote countdown
  useEffect(() => {
    if (preMatchPhase !== 'map_vote') return;
    
    const timer = setInterval(() => {
      setMapVoteCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(timer);
  }, [preMatchPhase]);

  // Pre-match background music
  useEffect(() => {
    const audio = preMatchAudioRef.current;
    if (!audio) return;
    
    const isPreMatch = preMatchPhase === 'roster_selection' || preMatchPhase === 'map_vote';
    
    if (isPreMatch) {
      // Play pre-match music
      audio.volume = 0.3;
      audio.play().catch(err => {
        console.log('[Audio] Pre-match music autoplay blocked:', err);
      });
    } else {
      // Fade out and stop when match starts or is cancelled
      if (!audio.paused) {
        const fadeOut = () => {
          if (audio.volume > 0.05) {
            audio.volume = Math.max(0, audio.volume - 0.05);
            setTimeout(fadeOut, 100);
          } else {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 0.3;
          }
        };
        fadeOut();
      }
    }
    
    return () => {
      // Cleanup on unmount
      if (audio && !audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, [preMatchPhase]);

  // Show combat report when match is completed
  useEffect(() => {
    if (!match || matchReportShown) return;
    
    if (match.status === 'completed' && match.result?.confirmed) {
      // Find current player in match
      const currentPlayer = match.players?.find(p => 
        p.user && ((p.user._id || p.user).toString() === (user?._id?.toString() || user?.id?.toString()))
      );
      
      if (currentPlayer) {
        const winnerTeam = match.result.winner;
        const isWinner = currentPlayer.team === winnerTeam;
        const rewards = currentPlayer.rewards || {};
        
        // Prepare report data
        setMatchReportData({
          isWinner,
          rewards: {
            pointsChange: rewards.pointsChange || 0,
            oldPoints: rewards.oldPoints || 0,
            newPoints: rewards.newPoints || 0,
            goldEarned: rewards.goldEarned || 0,
            xpEarned: rewards.xpEarned || 0
          },
          oldRank: { points: rewards.oldPoints || 0 },
          newRank: { points: rewards.newPoints || 0 },
          squadName: myTeam === 1 ? match.team1Squad?.name : match.team2Squad?.name,
          cranesEarned: rewards.cranesEarned || 0,
          goldEarned: rewards.goldEarned || 0,
          xpEarned: rewards.xpEarned || 0,
          topSquadPointsChange: rewards.topSquadPointsChange || 0
        });
        
        setMatchReportShown(true);
        setTimeout(() => setShowMatchReport(true), 500);
      }
    }
  }, [match, user, matchReportShown, myTeam]);

  // 10-minute countdown for match start deadline (before match completion)
  useEffect(() => {
    if (!match?.createdAt || match?.status === 'completed' || match?.status === 'cancelled') {
      setStartCountdown(null);
      return;
    }
    
    const calculateRemaining = () => {
      const created = new Date(match.createdAt).getTime();
      const deadline = created + 10 * 60 * 1000; // 10 minutes
      const remaining = Math.floor((deadline - Date.now()) / 1000);
      return remaining;
    };
    
    setStartCountdown(calculateRemaining());
    
    const timer = setInterval(() => {
      const remaining = calculateRemaining();
      setStartCountdown(remaining);
      // Keep running even if expired to show negative state
    }, 1000);
    
    return () => clearInterval(timer);
  }, [match?.createdAt, match?.status]);

  // Select roster member with optimistic UI
  const [selectingMember, setSelectingMember] = useState(null);
  const handleSelectRosterMember = async (memberId) => {
    if (!isReferent || selectingMember) return;
    
    // Find the member data for optimistic update
    const member = rosterSelection.availableMembers.find(m => m._id === memberId);
    
    setSelectingMember(memberId);
    
    // Optimistic: immediately move member to selected team
    if (member) {
      const optimisticPlayer = {
        user: { _id: memberId, username: member.username, avatarUrl: member.avatarUrl, discordAvatar: member.discordAvatar, discordId: member.discordId, equippedTitle: member.equippedTitle },
        username: member.username,
        team: myTeam,
        isReferent: false
      };
      setRosterSelection(prev => ({
        ...prev,
        availableMembers: prev.availableMembers.filter(m => m._id !== memberId),
        ...(myTeam === 1 
          ? { team1Selected: [...prev.team1Selected, optimisticPlayer] }
          : { team2Selected: [...prev.team2Selected, optimisticPlayer] }
        )
      }));
    }
    
    try {
      const response = await fetch(`${API_URL}/stricker/match/${matchId}/roster/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ memberId })
      });
      const data = await response.json();
      
      if (!data.success) {
        // Revert optimistic update on failure
        await fetchMatch();
      }
      // On success, optimistic state is already correct - no need to refetch
    } catch (err) {
      console.error('Error selecting roster member:', err);
      // Revert on error
      await fetchMatch();
    } finally {
      setSelectingMember(null);
    }
  };

  // Deselect/remove roster member with optimistic UI
  const [deselectingMember, setDeselectingMember] = useState(null);
  const handleDeselectRosterMember = async (memberId) => {
    if (!isReferent || deselectingMember) return;
    
    setDeselectingMember(memberId);
    
    // Find the player being removed for optimistic rollback
    const teamSelected = myTeam === 1 ? rosterSelection.team1Selected : rosterSelection.team2Selected;
    const removedPlayer = teamSelected.find(p => (p.user?._id || p.user) === memberId);
    
    // Optimistic: immediately remove from selected, add back to available
    if (removedPlayer) {
      const memberData = removedPlayer.user && typeof removedPlayer.user === 'object' ? removedPlayer.user : { _id: memberId, username: removedPlayer.username };
      
      // If removing a helper, update the helper state
      if (removedPlayer.isHelper) {
        setMyTeamHasHelper(false);
        // Don't add helper back to available members (they weren't from the squad)
        setRosterSelection(prev => ({
          ...prev,
          ...(myTeam === 1 
            ? { team1Selected: prev.team1Selected.filter(p => (p.user?._id || p.user) !== memberId) }
            : { team2Selected: prev.team2Selected.filter(p => (p.user?._id || p.user) !== memberId) }
          )
        }));
      } else {
        // Regular member - add back to available
        setRosterSelection(prev => ({
          ...prev,
          availableMembers: [...prev.availableMembers, { _id: memberData._id, username: memberData.username || removedPlayer.username, avatarUrl: memberData.avatarUrl, discordAvatar: memberData.discordAvatar, discordId: memberData.discordId, equippedTitle: memberData.equippedTitle }],
          ...(myTeam === 1 
            ? { team1Selected: prev.team1Selected.filter(p => (p.user?._id || p.user) !== memberId) }
            : { team2Selected: prev.team2Selected.filter(p => (p.user?._id || p.user) !== memberId) }
          )
        }));
      }
    }
    
    try {
      const response = await fetch(`${API_URL}/stricker/match/${matchId}/roster/deselect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ memberId })
      });
      const data = await response.json();
      
      if (!data.success) {
        // Revert optimistic update on failure
        await fetchMatch();
      }
      // On success, optimistic state is already correct
    } catch (err) {
      console.error('Error deselecting roster member:', err);
      await fetchMatch();
    } finally {
      setDeselectingMember(null);
    }
  };

  // Search for helper players
  const handleHelperSearch = async (query) => {
    setHelperSearchQuery(query);
    
    if (query.length < 2) {
      setHelperSearchResults([]);
      return;
    }
    
    setSearchingHelper(true);
    try {
      const response = await fetch(`${API_URL}/stricker/match/${matchId}/roster/search-helper?query=${encodeURIComponent(query)}`, {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        setHelperSearchResults(data.users || []);
      }
    } catch (err) {
      console.error('Error searching helpers:', err);
    } finally {
      setSearchingHelper(false);
    }
  };

  // Select helper player
  const handleSelectHelper = async (helperId) => {
    if (!isReferent || selectingHelper || myTeamHasHelper) return;
    
    const helper = helperSearchResults.find(u => u._id === helperId);
    
    setSelectingHelper(helperId);
    
    // Optimistic: immediately add helper to selected team
    if (helper) {
      const optimisticPlayer = {
        user: { _id: helperId, username: helper.username, avatarUrl: helper.avatarUrl, discordAvatar: helper.discordAvatar, discordId: helper.discordId, equippedTitle: helper.equippedTitle },
        username: helper.username,
        team: myTeam,
        isReferent: false,
        isHelper: true
      };
      setRosterSelection(prev => ({
        ...prev,
        ...(myTeam === 1 
          ? { team1Selected: [...prev.team1Selected, optimisticPlayer] }
          : { team2Selected: [...prev.team2Selected, optimisticPlayer] }
        )
      }));
      setMyTeamHasHelper(true);
      setHelperSearchQuery('');
      setHelperSearchResults([]);
    }
    
    try {
      const response = await fetch(`${API_URL}/stricker/match/${matchId}/roster/select-helper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ helperId })
      });
      const data = await response.json();
      
      if (!data.success) {
        // Revert optimistic update on failure
        await fetchMatch();
      }
    } catch (err) {
      console.error('Error selecting helper:', err);
      await fetchMatch();
    } finally {
      setSelectingHelper(null);
    }
  };

  // Vote for map
  const handleMapVote = async (mapIndex) => {
    if (selectedMapIndex === mapIndex) return;
    
    try {
      setSelectedMapIndex(mapIndex);
      const response = await fetch(`${API_URL}/stricker/match/${matchId}/map-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mapIndex })
      });
      const data = await response.json();
      
      if (data.success && data.mapVoteOptions) {
        setMapVoteOptions(data.mapVoteOptions);
      }
    } catch (err) {
      console.error('Error voting for map:', err);
    }
  };

  // Send chat message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || sendingMessage) return;
    
    const messageText = newMessage.trim();
    setSendingMessage(true);
    setNewMessage(''); // Clear input immediately for responsiveness
    
    // Optimistic: add message to chat immediately
    const optimisticMsg = {
      user: { _id: user?._id || user?.id, username: user?.username },
      message: messageText,
      timestamp: new Date().toISOString(),
      isSystem: false,
      _optimistic: true
    };
    setMessages(prev => [...prev, optimisticMsg]);
    
    try {
      const response = await fetch(`${API_URL}/stricker/match/${matchId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: messageText })
      });
      const data = await response.json();
      
      if (!data.success) {
        // Revert optimistic message on failure
        setMessages(prev => prev.filter(m => !m._optimistic));
        setNewMessage(messageText); // Restore the message
      }
      // Socket event will update messages for everyone
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages(prev => prev.filter(m => !m._optimistic));
      setNewMessage(messageText);
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

  // Admin: Force winner
  const handleForceWinner = async (team) => {
    if (forcingWinner) return;
    setForcingWinner(true);
    try {
      const response = await fetch(`${API_URL}/stricker/admin/match/${matchId}/force-winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ winner: team })
      });
      const data = await response.json();
      if (data.success) {
        setShowForceConfirm(null);
        fetchMatch();
      }
    } catch (err) {
      console.error('Error forcing winner:', err);
    } finally {
      setForcingWinner(false);
    }
  };

  // Admin: Change match status
  const handleAdminStatusChange = async (status) => {
    if (changingStatus) return;
    setChangingStatus(true);
    try {
      const response = await fetch(`${API_URL}/stricker/admin/matches/${matchId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      if (data.success) {
        fetchMatch();
      }
    } catch (err) {
      console.error('Error changing status:', err);
    } finally {
      setChangingStatus(false);
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

  // Handle cancellation vote
  const handleCancelVote = async (vote) => {
    if (submittingCancelVote || !isReferent) return;
    
    setSubmittingCancelVote(true);
    try {
      const response = await fetch(`${API_URL}/stricker/match/${matchId}/cancel-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ vote })
      });
      const data = await response.json();
      
      if (data.success) {
        setCancellationVotes(data.cancellationVotes);
        setShowCancelDialog(false);
        if (data.matchCancelled) {
          // Redirect to stricker page based on current mode
          navigate(`/${currentMode}/stricker`);
        }
      }
    } catch (err) {
      console.error('Error submitting cancel vote:', err);
    } finally {
      setSubmittingCancelVote(false);
    }
  };

  // Handle map ban (referents only)
  const handleMapBan = async (mapName) => {
    if (banningMap || !isReferent) return;
    
    // Check if it's my turn
    const isMyTurnToBan = (myTeam === 1 && mapBans.currentTurn === 1) || 
                          (myTeam === 2 && mapBans.currentTurn === 2);
    if (!isMyTurnToBan) return;
    
    // Check if map is already banned
    if (mapBans.team1BannedMap === mapName || mapBans.team2BannedMap === mapName) return;
    
    setBanningMap(true);
    try {
      const response = await fetch(`${API_URL}/stricker/match/${matchId}/map-ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mapName })
      });
      const data = await response.json();
      
      if (data.success) {
        setMapBans(data.mapBans);
        if (data.banComplete) {
          // Map selection complete, will transition via socket event
          fetchMatch();
        }
      }
    } catch (err) {
      console.error('Error banning map:', err);
    } finally {
      setBanningMap(false);
    }
  };

  // Handle report AFK team
  const handleReportAfk = async () => {
    if (reportingAfk || hasReportedAfk || reportAfkCooldown > 0 || afkWaitCountdown > 0 || !isReferent) return;
    
    setReportingAfk(true);
    try {
      const response = await fetch(`${API_URL}/stricker/match/${matchId}/report-afk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        setHasReportedAfk(true);
        setReportAfkCooldown(300); // 5 minutes in seconds
      }
    } catch (err) {
      console.error('Error reporting AFK:', err);
    } finally {
      setReportingAfk(false);
    }
  };

  // Fetch rules for Stricker mode
  const fetchRules = async () => {
    if (rules) return; // Already loaded
    
    setLoadingRules(true);
    try {
      // Stricker mode uses format-specific rules: stricker-snd-3v3 or stricker-snd-5v5
      const subType = match?.format === '3v3' ? 'stricker-snd-3v3' : 'stricker-snd-5v5';
      const response = await fetch(`${API_URL}/game-mode-rules/stricker/ranked/${subType}`, {
        credentials: 'include'
      });
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

  // Cooldown timer for report AFK
  useEffect(() => {
    if (reportAfkCooldown <= 0) return;
    
    const timer = setInterval(() => {
      setReportAfkCooldown(prev => {
        if (prev <= 1) {
          setHasReportedAfk(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [reportAfkCooldown]);

  // Initial 5min wait countdown before can report AFK
  useEffect(() => {
    if (!match?.createdAt) return;
    
    const calculateWait = () => {
      const matchStart = new Date(match.createdAt).getTime();
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000; // 5 minutes in ms
      const elapsed = now - matchStart;
      const remaining = Math.max(0, Math.ceil((fiveMinutes - elapsed) / 1000));
      setAfkWaitCountdown(remaining);
    };
    
    calculateWait();
    
    if (afkWaitCountdown > 0) {
      const timer = setInterval(calculateWait, 1000);
      return () => clearInterval(timer);
    }
  }, [match?.createdAt, afkWaitCountdown]);

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
            onClick={() => navigate(`/${currentMode}/stricker`)}
            className="mt-4 px-6 py-3 bg-lime-500 hover:bg-lime-600 text-white font-semibold rounded-lg transition-colors"
          >
            {t.backToStricker}
          </button>
        </div>
      </div>
    );
  }

  // Determine if we're in a pre-match phase
  const isPreMatch = preMatchPhase === 'roster_selection' || preMatchPhase === 'map_vote';

  // ============ PRE-MATCH: ROSTER SELECTION ============
  if (preMatchPhase === 'roster_selection') {
    const team1Name = match.team1Squad?.name || t.team1;
    const team2Name = match.team2Squad?.name || t.team2;
    const team1Logo = match.team1Squad?.logo;
    const team2Logo = match.team2Squad?.logo;
    
    // Check if my team is full (based on match format - 3 for 3v3, 5 for 5v5)
    const requiredTeamSize = match?.teamSize || 5;
    const myTeamCount = myTeam === 1 
      ? rosterSelection.team1Selected.length 
      : rosterSelection.team2Selected.length;
    const myTeamFull = myTeamCount >= requiredTeamSize;
    const canSelectPlayers = isReferent && !myTeamFull;
    
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
        {/* Pre-match background music */}
        <audio
          ref={preMatchAudioRef}
          src="/stricker.mp3.mp3"
          loop
          preload="auto"
          className="hidden"
        />
        <div className="max-w-6xl w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-lime-500/20 border border-lime-500/30 rounded-full mb-4">
              <Shuffle className="w-5 h-5 text-lime-400 animate-pulse" />
              <span className="text-lime-400 font-bold">{t.rosterSelection}</span>
            </div>
            <h1 className="text-3xl font-black text-white mb-2">{t.preMatchTitle}</h1>
            <p className="text-gray-400">{t.rosterSelectionDesc}</p>
            <p className="text-orange-400/80 text-sm mt-2">
              {language === 'fr' 
                ? '⏰ Vous avez 5 minutes pour sélectionner votre roster, sinon une demande d\'annulation sera possible'
                : '⏰ You have 5 minutes to select your roster, otherwise a cancellation request will be possible'
              }
            </p>
          </div>
          
          {/* Cancellation Bar - AT THE TOP */}
          {isReferent && (() => {
            const myTeamVote = myTeam === 1 ? cancellationVotes.team1 : cancellationVotes.team2;
            const opponentVote = myTeam === 1 ? cancellationVotes.team2 : cancellationVotes.team1;
            const opponentTeamName = myTeam === 1 ? team2Name : team1Name;
            const hasMyTeamVoted = myTeamVote !== null && myTeamVote !== undefined;
            const hasOpponentVoted = opponentVote !== null && opponentVote !== undefined;
            
            // If opponent requested cancellation and we haven't voted yet - show dynamic prompt
            if (opponentVote === true && !hasMyTeamVoted) {
              return (
                <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-orange-400" />
                      <div className="text-center sm:text-left">
                        <span className="text-orange-400 font-bold">{opponentTeamName}</span>
                        <span className="text-white"> {t.opponentWantsCancel}</span>
                        <p className="text-gray-400 text-sm">{t.doYouWantToCancel}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleCancelVote(true)}
                        disabled={submittingCancelVote}
                        className="px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 rounded-xl font-medium transition-colors disabled:opacity-50"
                      >
                        {submittingCancelVote ? <Loader2 className="w-5 h-5 animate-spin" /> : t.cancelYes}
                      </button>
                      <button
                        onClick={() => handleCancelVote(false)}
                        disabled={submittingCancelVote}
                        className="px-5 py-2.5 bg-lime-500/20 hover:bg-lime-500/30 border border-lime-500/50 text-lime-400 rounded-xl font-medium transition-colors disabled:opacity-50"
                      >
                        {t.cancelNo}
                      </button>
                    </div>
                  </div>
                </div>
              );
            }
            
            // If my team requested cancellation - show waiting
            if (myTeamVote === true) {
              return (
                <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
                    <span className="text-orange-400 font-medium">{t.waitingOpponentCancelVote}</span>
                  </div>
                </div>
              );
            }
            
            // No votes yet - show request button
            if (!hasMyTeamVoted && !hasOpponentVoted) {
              return (
                <div className="mb-6 text-center">
                  <button
                    onClick={() => handleCancelVote(true)}
                    disabled={submittingCancelVote}
                    className="px-6 py-3 bg-dark-800 hover:bg-dark-700 border border-red-500/30 text-red-400 rounded-xl font-medium transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {submittingCancelVote ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    {t.requestCancel}
                  </button>
                </div>
              );
            }
            
            return null;
          })()}
          
          {/* Status indicator */}
          <div className="text-center mb-8">
            {myTeamFull ? (
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-500/20 border border-green-500/30 rounded-xl">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-bold">{t.rosterReady}</span>
              </div>
            ) : canSelectPlayers ? (
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-lime-500/30 border border-lime-500 rounded-xl animate-pulse">
                <Play className="w-5 h-5 text-lime-400" />
                <span className="text-lime-400 font-bold text-lg">{language === 'fr' ? 'Sélectionnez vos joueurs' : 'Select your players'}</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-dark-800 border border-gray-700 rounded-xl">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                <span className="text-gray-400">{t.waitingOpponent}</span>
              </div>
            )}
          </div>
          
          {/* Report AFK Section - at the top */}
          {isReferent && (
            <div className="text-center mb-6">
              {hasReportedAfk ? (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-xl">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 font-medium">{t.reportAfkSent}</span>
                  {reportAfkCooldown > 0 && (
                    <span className="text-gray-400 text-sm">
                      ({t.reportAfkCooldown} {Math.floor(reportAfkCooldown / 60)}:{String(reportAfkCooldown % 60).padStart(2, '0')})
                    </span>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleReportAfk}
                  disabled={reportingAfk || reportAfkCooldown > 0 || afkWaitCountdown > 0}
                  className="px-6 py-3 bg-dark-800 hover:bg-dark-700 border border-orange-500/30 text-orange-400 rounded-xl font-medium transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {reportingAfk ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  {afkWaitCountdown > 0
                    ? `${t.reportAfkCooldown} ${Math.floor(afkWaitCountdown / 60)}:${String(afkWaitCountdown % 60).padStart(2, '0')}`
                    : reportAfkCooldown > 0 
                      ? `${t.reportAfkCooldown} ${Math.floor(reportAfkCooldown / 60)}:${String(reportAfkCooldown % 60).padStart(2, '0')}`
                      : t.reportAfk
                  }
                </button>
              )}
            </div>
          )}
          
          {/* Teams display */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Team 1 */}
            <div className={`bg-dark-900 border rounded-2xl p-6 ${myTeam === 1 ? 'border-lime-500' : 'border-lime-500/20'}`}>
              <div className="flex items-center gap-3 mb-4">
                {team1Logo ? (
                  <img src={team1Logo} alt={team1Name} className="w-12 h-12 object-contain" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-lime-500/20 border border-lime-500/30 flex items-center justify-center">
                    <Users className="w-6 h-6 text-lime-400" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-white font-bold">{team1Name}</h3>
                  {myTeam === 1 && <span className="text-lime-400 text-xs">{t.yourTeam}</span>}
                </div>
                <span className={`text-sm font-bold ${rosterSelection.team1Selected.length >= requiredTeamSize ? 'text-green-400' : 'text-gray-400'}`}>
                  {rosterSelection.team1Selected.length}/{requiredTeamSize}
                </span>
              </div>
              <div className="space-y-2">
                {rosterSelection.team1Selected.map((player, idx) => {
                  const playerUser = player.user || player;
                  const equippedTitle = playerUser.equippedTitle;
                  const titleName = equippedTitle?.nameTranslations?.[language] || equippedTitle?.name;
                  const canRemove = isReferent && myTeam === 1 && !player.isReferent;
                  const isDeselecting = deselectingMember === (playerUser._id || player.user);
                  
                  return (
                    <div 
                      key={idx} 
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                        isDeselecting 
                          ? 'bg-red-500/20 border border-red-500/50 scale-95 opacity-50' 
                          : 'bg-lime-500/10 border border-lime-500/30 hover:bg-lime-500/15 hover:border-lime-500/50'
                      }`}
                    >
                      <img 
                        src={getUserAvatar(playerUser)} 
                        alt={player.username}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{player.username}</span>
                          {player.isReferent && <Crown className="w-4 h-4 text-amber-400" />}
                          {player.isHelper && (
                            <span className="px-1.5 py-0.5 bg-purple-500/30 border border-purple-500/50 text-purple-300 text-xs font-bold rounded">
                              {t.helperBadge}
                            </span>
                          )}
                        </div>
                        {titleName && (
                          <span 
                            className={getTitleStyles(equippedTitle?.rarity).className}
                            style={getTitleStyles(equippedTitle?.rarity).style}
                          >
                            {titleName}
                          </span>
                        )}
                      </div>
                      {canRemove && (
                        <button
                          onClick={() => handleDeselectRosterMember(playerUser._id || player.user)}
                          disabled={isDeselecting}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/30 rounded-lg transition-all hover:scale-110 disabled:opacity-50"
                          title="Retirer du roster"
                        >
                          {isDeselecting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
                {Array(Math.max(0, requiredTeamSize - rosterSelection.team1Selected.length)).fill(null).map((_, idx) => (
                  <div key={`empty-${idx}`} className="flex items-center gap-3 p-3 bg-dark-800/50 border border-dashed border-gray-700 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-dark-700 flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-600" />
                    </div>
                    <span className="text-gray-600">En attente...</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Available Members */}
            <div className="bg-dark-900 border border-gray-700 rounded-2xl p-6">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-400" />
                {t.availableMembers}
              </h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                {rosterSelection.availableMembers.map((member, idx) => {
                  const equippedTitle = member.equippedTitle;
                  const titleName = equippedTitle?.nameTranslations?.[language] || equippedTitle?.name;
                  const isSelecting = selectingMember === member._id;
                  
                  // Check if PC player and not connected to GGSecure
                  const isPcPlayer = member.platform === 'PC';
                  const isGGSecureConnected = member.ggsecureConnected !== false; // null means non-PC or API unavailable
                  const canSelectMember = canSelectPlayers && (isPcPlayer ? isGGSecureConnected : true);
                  
                  return (
                    <div 
                      key={idx} 
                      className={`group flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                        isSelecting
                          ? 'bg-lime-500/30 border border-lime-500 opacity-70'
                          : canSelectMember && canSelectPlayers
                            ? 'bg-dark-800 border border-lime-500/30 hover:border-lime-500 hover:bg-lime-500/10 cursor-pointer' 
                            : isPcPlayer && !isGGSecureConnected
                              ? 'bg-red-500/10 border border-red-500/30 opacity-60 cursor-not-allowed'
                              : 'bg-dark-800/50 border border-gray-700 opacity-50'
                      }`}
                      onClick={() => canSelectMember && !isSelecting && handleSelectRosterMember(member._id)}
                      title={isPcPlayer && !isGGSecureConnected ? t.ggsecureNotConnected : ''}
                    >
                      <div className="relative">
                        <img 
                          src={getUserAvatar(member)} 
                          alt={member.username}
                          className="w-10 h-10 rounded-full object-cover transition-transform"
                        />
                        {/* GGSecure status indicator for PC players */}
                        {isPcPlayer && (
                          <div 
                            className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-dark-900 ${
                              isGGSecureConnected ? 'bg-green-500' : 'bg-red-500'
                            }`}
                            title={isGGSecureConnected ? t.ggsecureConnected : t.ggsecureNotConnected}
                          >
                            <Shield className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium truncate">{member.username}</span>
                          {isPcPlayer && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              isGGSecureConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              PC
                            </span>
                          )}
                        </div>
                        {titleName && (
                          <span 
                            className={getTitleStyles(equippedTitle?.rarity).className}
                            style={getTitleStyles(equippedTitle?.rarity).style}
                          >
                            {titleName}
                          </span>
                        )}
                        {/* GGSecure warning message */}
                        {isPcPlayer && !isGGSecureConnected && (
                          <div className="flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3 h-3 text-red-400" />
                            <span className="text-red-400 text-xs">{t.ggsecureNotConnected}</span>
                          </div>
                        )}
                      </div>
                      {(canSelectMember && canSelectPlayers) || isSelecting ? (
                        <div className="px-3 py-1.5 bg-lime-500/20 text-lime-400 rounded-lg text-sm font-medium transition-all group-hover:bg-lime-500/30">
                          {isSelecting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            t.selectPlayer
                          )}
                        </div>
                      ) : isPcPlayer && !isGGSecureConnected ? (
                        <div className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          {t.ggsecureRequired}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              
              {/* Helper Search Section */}
              {isReferent && !myTeamFull && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span className="text-purple-400 font-medium text-sm">{t.addHelper}</span>
                    {myTeamHasHelper && (
                      <span className="text-xs text-gray-500">({t.helperAlreadySelected})</span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs mb-3">{t.oneHelperAllowed}</p>
                  
                  {!myTeamHasHelper && (
                    <>
                      <div className="relative">
                        <input
                          type="text"
                          value={helperSearchQuery}
                          onChange={(e) => handleHelperSearch(e.target.value)}
                          placeholder={t.searchHelperPlaceholder}
                          className="w-full px-4 py-2.5 bg-dark-800 border border-purple-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                        />
                        {searchingHelper && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                          </div>
                        )}
                      </div>
                      
                      {helperSearchQuery.length > 0 && helperSearchQuery.length < 2 && (
                        <p className="text-gray-500 text-xs mt-2">{t.minSearchChars}</p>
                      )}
                      
                      {/* Search Results */}
                      {helperSearchResults.length > 0 && (
                        <div className="mt-2 space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                          {helperSearchResults.map((user, idx) => {
                            const equippedTitle = user.equippedTitle;
                            const titleName = equippedTitle?.nameTranslations?.[language] || equippedTitle?.name;
                            const isSelectingThis = selectingHelper === user._id;
                            const isInMatch = user.inActiveMatch;
                            
                            return (
                              <div 
                                key={idx}
                                onClick={() => !isSelectingThis && !isInMatch && handleSelectHelper(user._id)}
                                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                                  isInMatch
                                    ? 'bg-dark-800/50 border border-gray-700 opacity-60 cursor-not-allowed'
                                    : isSelectingThis
                                      ? 'bg-purple-500/30 border border-purple-500 opacity-70 cursor-pointer'
                                      : 'bg-dark-800 border border-purple-500/30 hover:border-purple-500 hover:bg-purple-500/10 cursor-pointer'
                                }`}
                                title={isInMatch ? (language === 'fr' ? 'Ce joueur est actuellement en match' : 'This player is currently in a match') : ''}
                              >
                                <img 
                                  src={getUserAvatar(user)} 
                                  alt={user.username}
                                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-white font-medium" title={user.username}>{user.username}</span>
                                    <span className="text-purple-400 text-xs flex-shrink-0">{user.strickerPoints || 0} pts</span>
                                    {isInMatch && (
                                      <span className="text-xs px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded flex-shrink-0">
                                        {language === 'fr' ? 'En match' : 'In match'}
                                      </span>
                                    )}
                                  </div>
                                  {titleName && (
                                    <span 
                                      className={getTitleStyles(equippedTitle?.rarity).className}
                                      style={getTitleStyles(equippedTitle?.rarity).style}
                                    >
                                      {titleName}
                                    </span>
                                  )}
                                </div>
                                {isInMatch ? (
                                  <div className="px-3 py-1.5 bg-gray-500/20 text-gray-400 rounded-lg text-xs font-medium flex-shrink-0">
                                    {language === 'fr' ? 'Indisponible' : 'Unavailable'}
                                  </div>
                                ) : (
                                  <div className="px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-medium flex-shrink-0">
                                    {isSelectingThis ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      t.selectAsHelper
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {helperSearchQuery.length >= 2 && helperSearchResults.length === 0 && !searchingHelper && (
                        <p className="text-gray-500 text-sm mt-2 text-center">{t.noResultsFound}</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            
            {/* Team 2 */}
            <div className={`bg-dark-900 border rounded-2xl p-6 ${myTeam === 2 ? 'border-blue-500' : 'border-blue-500/20'}`}>
              <div className="flex items-center gap-3 mb-4">
                {team2Logo ? (
                  <img src={team2Logo} alt={team2Name} className="w-12 h-12 object-contain" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-400" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-white font-bold">{team2Name}</h3>
                  {myTeam === 2 && <span className="text-blue-400 text-xs">{t.yourTeam}</span>}
                </div>
                <span className={`text-sm font-bold ${rosterSelection.team2Selected.length >= requiredTeamSize ? 'text-green-400' : 'text-gray-400'}`}>
                  {rosterSelection.team2Selected.length}/{requiredTeamSize}
                </span>
              </div>
              <div className="space-y-2">
                {rosterSelection.team2Selected.map((player, idx) => {
                  const playerUser = player.user || player;
                  const equippedTitle = playerUser.equippedTitle;
                  const titleName = equippedTitle?.nameTranslations?.[language] || equippedTitle?.name;
                  const canRemove = isReferent && myTeam === 2 && !player.isReferent;
                  const isDeselecting = deselectingMember === (playerUser._id || player.user);
                  
                  return (
                    <div 
                      key={idx} 
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                        isDeselecting 
                          ? 'bg-red-500/20 border border-red-500/50 scale-95 opacity-50' 
                          : 'bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/15 hover:border-blue-500/50'
                      }`}
                    >
                      <img 
                        src={getUserAvatar(playerUser)} 
                        alt={player.username}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{player.username}</span>
                          {player.isReferent && <Crown className="w-4 h-4 text-amber-400" />}
                          {player.isHelper && (
                            <span className="px-1.5 py-0.5 bg-purple-500/30 border border-purple-500/50 text-purple-300 text-xs font-bold rounded">
                              {t.helperBadge}
                            </span>
                          )}
                        </div>
                        {titleName && (
                          <span 
                            className={getTitleStyles(equippedTitle?.rarity).className}
                            style={getTitleStyles(equippedTitle?.rarity).style}
                          >
                            {titleName}
                          </span>
                        )}
                      </div>
                      {canRemove && (
                        <button
                          onClick={() => handleDeselectRosterMember(playerUser._id || player.user)}
                          disabled={isDeselecting}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/30 rounded-lg transition-all hover:scale-110 disabled:opacity-50"
                          title="Retirer du roster"
                        >
                          {isDeselecting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
                {Array(Math.max(0, requiredTeamSize - rosterSelection.team2Selected.length)).fill(null).map((_, idx) => (
                  <div key={`empty-${idx}`} className="flex items-center gap-3 p-3 bg-dark-800/50 border border-dashed border-gray-700 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-dark-700 flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-600" />
                    </div>
                    <span className="text-gray-600">En attente...</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ PRE-MATCH: MAP BAN ============
  if (preMatchPhase === 'map_vote') {
    const team1Name = match.team1Squad?.name || t.team1;
    const team2Name = match.team2Squad?.name || t.team2;
    
    // Check if it's my turn to ban
    const isMyTurnToBan = isReferent && (
      (myTeam === 1 && mapBans.currentTurn === 1 && !mapBans.team1BannedMap) || 
      (myTeam === 2 && mapBans.currentTurn === 2 && !mapBans.team2BannedMap)
    );
    
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
        {/* Pre-match background music */}
        <audio
          ref={preMatchAudioRef}
          src="/stricker.mp3.mp3"
          loop
          preload="auto"
          className="hidden"
        />
        <div className="max-w-4xl w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-red-500/20 border border-red-500/30 rounded-full mb-4">
              <Ban className="w-5 h-5 text-red-400" />
              <span className="text-red-400 font-bold">{t.mapBan}</span>
            </div>
            <h1 className="text-3xl font-black text-white mb-2">{team1Name} vs {team2Name}</h1>
            <p className="text-gray-400">{t.mapBanDesc}</p>
          </div>
          
          {/* Cancellation Bar - AT THE TOP */}
          {isReferent && (() => {
            const myTeamVote = myTeam === 1 ? cancellationVotes.team1 : cancellationVotes.team2;
            const opponentVote = myTeam === 1 ? cancellationVotes.team2 : cancellationVotes.team1;
            const opponentTeamName = myTeam === 1 ? team2Name : team1Name;
            const hasMyTeamVoted = myTeamVote !== null && myTeamVote !== undefined;
            const hasOpponentVoted = opponentVote !== null && opponentVote !== undefined;
            
            // If opponent requested cancellation and we haven't voted yet - show dynamic prompt
            if (opponentVote === true && !hasMyTeamVoted) {
              return (
                <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-orange-400" />
                      <div className="text-center sm:text-left">
                        <span className="text-orange-400 font-bold">{opponentTeamName}</span>
                        <span className="text-white"> {t.opponentWantsCancel}</span>
                        <p className="text-gray-400 text-sm">{t.doYouWantToCancel}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleCancelVote(true)}
                        disabled={submittingCancelVote}
                        className="px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 rounded-xl font-medium transition-colors disabled:opacity-50"
                      >
                        {submittingCancelVote ? <Loader2 className="w-5 h-5 animate-spin" /> : t.cancelYes}
                      </button>
                      <button
                        onClick={() => handleCancelVote(false)}
                        disabled={submittingCancelVote}
                        className="px-5 py-2.5 bg-lime-500/20 hover:bg-lime-500/30 border border-lime-500/50 text-lime-400 rounded-xl font-medium transition-colors disabled:opacity-50"
                      >
                        {t.cancelNo}
                      </button>
                    </div>
                  </div>
                </div>
              );
            }
            
            // If my team requested cancellation - show waiting
            if (myTeamVote === true) {
              return (
                <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
                    <span className="text-orange-400 font-medium">{t.waitingOpponentCancelVote}</span>
                  </div>
                </div>
              );
            }
            
            // No votes yet - show request button
            if (!hasMyTeamVoted && !hasOpponentVoted) {
              return (
                <div className="mb-6 text-center">
                  <button
                    onClick={() => handleCancelVote(true)}
                    disabled={submittingCancelVote}
                    className="px-6 py-3 bg-dark-800 hover:bg-dark-700 border border-red-500/30 text-red-400 rounded-xl font-medium transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {submittingCancelVote ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    {t.requestCancel}
                  </button>
                </div>
              );
            }
            
            return null;
          })()}
          
          {/* Report AFK Section - map ban phase */}
          {isReferent && (
            <div className="text-center mb-6">
              {hasReportedAfk ? (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-xl">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 font-medium">{t.reportAfkSent}</span>
                  {reportAfkCooldown > 0 && (
                    <span className="text-gray-400 text-sm">
                      ({t.reportAfkCooldown} {Math.floor(reportAfkCooldown / 60)}:{String(reportAfkCooldown % 60).padStart(2, '0')})
                    </span>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleReportAfk}
                  disabled={reportingAfk || reportAfkCooldown > 0 || afkWaitCountdown > 0}
                  className="px-6 py-3 bg-dark-800 hover:bg-dark-700 border border-orange-500/30 text-orange-400 rounded-xl font-medium transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {reportingAfk ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  {afkWaitCountdown > 0
                    ? `${t.reportAfkCooldown} ${Math.floor(afkWaitCountdown / 60)}:${String(afkWaitCountdown % 60).padStart(2, '0')}`
                    : reportAfkCooldown > 0 
                      ? `${t.reportAfkCooldown} ${Math.floor(reportAfkCooldown / 60)}:${String(reportAfkCooldown % 60).padStart(2, '0')}`
                      : t.reportAfk
                  }
                </button>
              )}
            </div>
          )}
          
          {/* Turn indicator */}
          <div className="text-center mb-8">
            {isMyTurnToBan ? (
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-red-500/30 border border-red-500 rounded-xl animate-pulse">
                <Ban className="w-5 h-5 text-red-400" />
                <span className="text-red-400 font-bold text-lg">{t.yourTurnToBan}</span>
              </div>
            ) : mapBans.team1BannedMap && mapBans.team2BannedMap ? (
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-lime-500/20 border border-lime-500/30 rounded-xl">
                <Shuffle className="w-5 h-5 text-lime-400 animate-spin" />
                <span className="text-lime-400 font-bold text-lg">{t.randomSelection}</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-dark-800 border border-gray-700 rounded-xl">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                <span className="text-gray-400 font-medium">{isReferent ? t.opponentTurnToBan : t.waitingForBans}</span>
              </div>
            )}
          </div>
          
          {/* Ban status */}
          {(mapBans.team1BannedMap || mapBans.team2BannedMap) && (
            <div className="flex justify-center gap-8 mb-8">
              {mapBans.team1BannedMap && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30">
                  <span className="text-red-400 font-bold">{mapBans.team1BannedMap}</span>
                  <Ban className="w-4 h-4 text-red-400" />
                </div>
              )}
              {mapBans.team2BannedMap && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30">
                  <span className="text-red-400 font-bold">{mapBans.team2BannedMap}</span>
                  <Ban className="w-4 h-4 text-red-400" />
                </div>
              )}
            </div>
          )}
          
          {/* Maps Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mapVoteOptions.map((mapOption, idx) => {
              const isBannedByTeam1 = mapBans.team1BannedMap === mapOption.name;
              const isBannedByTeam2 = mapBans.team2BannedMap === mapOption.name;
              const isBanned = isBannedByTeam1 || isBannedByTeam2;
              const canBan = isMyTurnToBan && !isBanned;
              
              return (
                <div
                  key={idx}
                  onClick={() => canBan && handleMapBan(mapOption.name)}
                  className={`relative bg-dark-900 rounded-2xl overflow-hidden transition-all ${
                    isBanned 
                      ? 'opacity-50 grayscale' 
                      : canBan 
                        ? 'cursor-pointer transform hover:scale-[1.02] border border-red-500/30 hover:border-red-500' 
                        : 'border border-gray-700'
                  }`}
                >
                  {/* Map image */}
                  <div className="aspect-video bg-dark-800 relative">
                    {mapOption.image ? (
                      <img 
                        src={mapOption.image} 
                        alt={mapOption.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Map className="w-12 h-12 text-gray-600" />
                      </div>
                    )}
                    
                    {/* Banned overlay */}
                    {isBanned && (
                      <div className="absolute inset-0 bg-red-900/50 flex items-center justify-center">
                        <div className="text-center">
                          <Ban className="w-12 h-12 text-red-500 mx-auto mb-2" />
                          <span className="text-red-400 font-bold text-lg">{t.banned}</span>
                          <p className="text-red-300 text-sm mt-1">
                            {isBannedByTeam1 ? team1Name : team2Name}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {/* Ban button for referent */}
                    {canBan && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                        <button className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl flex items-center gap-2">
                          <Ban className="w-5 h-5" />
                          {t.banMap}
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Map name */}
                  <div className="p-4">
                    <h3 className={`font-bold text-lg ${isBanned ? 'text-gray-500 line-through' : 'text-white'}`}>
                      {mapOption.name}
                    </h3>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ============ MATCH SHEET ============
  const team1Players = match.players?.filter(p => p.team === 1) || [];
  const team2Players = match.players?.filter(p => p.team === 2) || [];
  const isCompleted = match.status === 'completed';
  const winner = match.result?.winner;
  const myPlayer = match.players?.find(p => p.user?._id === user?._id || p.user === user?._id);
  const didWin = myPlayer && winner === myPlayer.team;
  
  const team1Name = match.team1Squad?.name || t.team1;
  const team2Name = match.team2Squad?.name || t.team2;
  const team1Logo = match.team1Squad?.logo;
  const team2Logo = match.team2Squad?.logo;
  
  // Get squad total points - try statsStricker first, then stats
  const team1TotalPoints = match.team1Squad?.statsStricker?.points || match.team1Squad?.stats?.points || 0;
  const team2TotalPoints = match.team2Squad?.statsStricker?.points || match.team2Squad?.stats?.points || 0;
  
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
              onClick={() => navigate(`/${currentMode}/stricker`)}
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
                match.status === 'disputed' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
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
                  <img src={team1Logo} alt={team1Name} className="w-16 h-16 sm:w-20 sm:h-20 object-contain mb-2" />
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
              <p className="text-lime-400/60 text-xs mt-2">{match.format || '5v5'}</p>
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
                  <img src={team2Logo} alt={team2Name} className="w-16 h-16 sm:w-20 sm:h-20 object-contain mb-2" />
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Column - Match Info */}
          <div className="lg:col-span-1 space-y-4">
            {/* Match Info */}
            <div className="bg-dark-900/80 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-lime-500/20 p-4 sm:p-5">
              <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-lime-400" />
                {language === 'fr' ? 'Informations' : 'Match Info'}
              </h2>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-gray-500 text-sm">{language === 'fr' ? 'Mode' : 'Game Mode'}</span>
                  <span className="px-2 py-0.5 bg-lime-500/20 rounded text-lime-400 text-xs font-medium">
                    {match.gameMode || 'Search & Destroy'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-gray-500 text-sm">{language === 'fr' ? 'Format' : 'Format'}</span>
                  <span className="text-white font-semibold text-sm">{match.format || '5v5'}</span>
                </div>
                
                {/* 10-minute countdown warning - before match completion */}
                {startCountdown !== null && match.status !== 'completed' && match.status !== 'cancelled' && (
                  <div className={`mt-3 p-3 rounded-lg border ${
                    startCountdown <= 0 
                      ? 'bg-red-500/10 border-red-500/40' 
                      : startCountdown <= 120 
                        ? 'bg-orange-500/10 border-orange-500/40'
                        : 'bg-amber-500/10 border-amber-500/40'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className={`w-4 h-4 ${
                        startCountdown <= 0 
                          ? 'text-red-400' 
                          : startCountdown <= 120 
                            ? 'text-orange-400'
                            : 'text-amber-400'
                      }`} />
                      <span className={`text-xs font-medium ${
                        startCountdown <= 0 
                          ? 'text-red-400' 
                          : startCountdown <= 120 
                            ? 'text-orange-400'
                            : 'text-amber-400'
                      }`}>
                        {startCountdown <= 0 ? t.deadlineExpired : t.matchStartDeadline}
                      </span>
                    </div>
                    <div className={`text-2xl font-bold text-center my-2 ${
                      startCountdown <= 0 
                        ? 'text-red-400' 
                        : startCountdown <= 120 
                          ? 'text-orange-400'
                          : 'text-amber-400'
                    }`}>
                      {startCountdown <= 0 ? (
                        <span className="flex items-center justify-center gap-1">
                          <AlertTriangle className="w-5 h-5" />
                          00:00
                        </span>
                      ) : (
                        `${String(Math.floor(startCountdown / 60)).padStart(2, '0')}:${String(startCountdown % 60).padStart(2, '0')}`
                      )}
                    </div>
                    <p className={`text-xs text-center ${
                      startCountdown <= 0 
                        ? 'text-red-400/80' 
                        : 'text-amber-400/80'
                    }`}>
                      ⚠️ {t.deadlineWarning}
                    </p>
                  </div>
                )}
                
                {/* Host Team Display */}
                {match.hostTeam && (
                  <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                    <span className="text-gray-500 text-sm">{t.host}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      match.hostTeam === 1 
                        ? 'bg-lime-500/20 text-lime-400' 
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {match.hostTeam === 1 ? team1Name : team2Name}
                    </span>
                  </div>
                )}
                
                {match.createdAt && (
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-gray-500 text-sm">{language === 'fr' ? 'Créé le' : 'Created'}</span>
                    <span className="text-white text-sm font-medium">
                      {new Date(match.createdAt).toLocaleString(
                        language === 'fr' ? 'fr-FR' : 'en-US',
                        { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
                      )}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Rules Button */}
              <button
                onClick={() => {
                  fetchRules();
                  setShowRulesModal(true);
                }}
                className="mt-4 w-full py-2.5 rounded-lg border border-lime-500/30 bg-lime-500/10 hover:bg-lime-500/20 transition-all flex items-center justify-center gap-2"
              >
                <BookOpen className="w-4 h-4 text-lime-400" />
                <span className="text-lime-400 font-medium text-sm">{t.viewRules}</span>
              </button>
            </div>

            {/* Banned Maps Section */}
            {(match.mapBans?.team1BannedMap || match.mapBans?.team2BannedMap || mapBans.team1BannedMap || mapBans.team2BannedMap) && (
              <div className="bg-dark-900/80 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-red-500/20 p-4 sm:p-5">
                <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                  <Ban className="w-4 h-4 text-red-400" />
                  {language === 'fr' ? 'Maps Bannies' : 'Banned Maps'}
                </h2>
                
                <div className="space-y-2">
                  {(match.mapBans?.team1BannedMap || mapBans.team1BannedMap) && (
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-6 rounded-full bg-lime-500"></div>
                        <span className="text-gray-400 text-sm">{team1Name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 font-medium text-sm">{match.mapBans?.team1BannedMap || mapBans.team1BannedMap}</span>
                        <Ban className="w-3.5 h-3.5 text-red-400" />
                      </div>
                    </div>
                  )}
                  {(match.mapBans?.team2BannedMap || mapBans.team2BannedMap) && (
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-6 rounded-full bg-blue-500"></div>
                        <span className="text-gray-400 text-sm">{team2Name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 font-medium text-sm">{match.mapBans?.team2BannedMap || mapBans.team2BannedMap}</span>
                        <Ban className="w-3.5 h-3.5 text-red-400" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Drawn Maps (3 maps) or Free Map Choice */}
            {(match.maps?.length > 0 || match.selectedMap?.name || match.freeMapChoice) && (
              <div className="bg-dark-900/80 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-lime-500/20 p-4 sm:p-5">
                <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                  <Map className="w-4 h-4 text-lime-400" />
                  {match.freeMapChoice 
                    ? (language === 'fr' ? 'Carte' : 'Map')
                    : match.maps?.length > 0 ? t.drawnMaps : t.selectedMap
                  }
                </h2>
                
                {/* Free Map Choice */}
                {match.freeMapChoice ? (
                  <div className="py-2">
                    {/* BO3 Format Explanation */}
                    <div className="mb-4 p-3 bg-dark-800/50 rounded-xl border border-lime-500/20">
                      <p className="text-lime-400 font-bold text-sm mb-2 text-center">
                        {language === 'fr' ? 'Format BO3 - Choix de maps' : 'BO3 Format - Map Selection'}
                      </p>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-start gap-2">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-lime-500 flex items-center justify-center text-xs font-bold text-black">1</span>
                          <p className="text-gray-300">
                            <span className="text-lime-400 font-medium">{team1Name}</span>
                            {language === 'fr' ? ' choisit sa map' : ' picks their map'}
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white">2</span>
                          <p className="text-gray-300">
                            <span className="text-blue-400 font-medium">{team2Name}</span>
                            {language === 'fr' ? ' choisit sa map' : ' picks their map'}
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold text-black">3</span>
                          <p className="text-gray-300">
                            {language === 'fr' 
                              ? 'En cas d\'égalité (1-1), la map 3 est déterminée par le goal average. Si égalité parfaite, utiliser les maps tiebreaker ci-dessous (dans l\'ordre)'
                              : 'If tied (1-1), map 3 is determined by goal average. If perfect tie, use tiebreaker maps below (in order)'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Tiebreaker Maps - Vertical List */}
                    {match.randomMaps?.length > 0 && (
                      <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30">
                        <div className="flex items-center gap-2 mb-3">
                          <Shuffle className="w-4 h-4 text-amber-400" />
                          <p className="text-amber-400 font-bold text-sm">
                            {language === 'fr' ? 'Maps Tiebreaker (en cas d\'égalité parfaite)' : 'Tiebreaker Maps (if perfect tie)'}
                          </p>
                        </div>
                        <p className="text-gray-400 text-xs mb-3">
                          {language === 'fr' 
                            ? 'Prendre la première map non jouée dans l\'ordre. Si une map a déjà été jouée, passer à la suivante.'
                            : 'Pick the first unplayed map in order. If a map was already played, skip to the next one.'
                          }
                        </p>
                        <div className="space-y-2">
                          {match.randomMaps.map((map, index) => (
                            <div key={index} className="flex items-center gap-3 p-2 bg-dark-800/50 rounded-lg border border-amber-500/20">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-xs font-bold text-amber-400">
                                {index + 1}
                              </span>
                              {map.image && (
                                <div className="w-16 h-10 rounded overflow-hidden border border-white/10 flex-shrink-0">
                                  <img 
                                    src={map.image} 
                                    alt={map.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <p className="text-white font-medium text-sm">{map.name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : match.maps?.length > 0 ? (
                  /* Display 3 maps in a grid */
                  <div className="grid grid-cols-3 gap-2">
                    {match.maps.map((map, index) => (
                      <div key={index} className="text-center">
                        <div className="relative rounded-lg overflow-hidden border border-white/10 mb-2">
                          {map.image && (
                            <img 
                              src={map.image} 
                              alt={map.name}
                              className="w-full h-16 sm:h-20 object-cover"
                            />
                          )}
                          <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-lime-500 flex items-center justify-center text-xs font-bold text-black">
                            {index + 1}
                          </div>
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-lime-400 truncate">{map.name}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Fallback for old format with single map */
                  <div className="text-center">
                    {match.selectedMap.image && (
                      <div className="rounded-lg overflow-hidden border border-white/10 mb-3">
                        <img 
                          src={match.selectedMap.image} 
                          alt={match.selectedMap.name}
                          className="w-full h-24 object-cover"
                        />
                      </div>
                    )}
                    <p className="text-xl font-bold text-lime-400">{match.selectedMap.name}</p>
                  </div>
                )}
                
                {match.startedAt && (
                  <div className="mt-3 pt-2 border-t border-lime-500/20">
                    <div className="flex items-center justify-center gap-2 text-xs">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-gray-400">{t.matchStartTime}:</span>
                      <span className="text-white font-medium">
                        {new Date(match.startedAt).toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Referents */}
            {(match.team1Referent || match.team2Referent) && (
              <div className="bg-dark-900/80 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-yellow-500/20 p-4 sm:p-5">
                <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                  <Crown className="w-4 h-4 text-yellow-400" />
                  {language === 'fr' ? 'Référents' : 'Referents'}
                </h2>
                
                <div className="space-y-3">
                  {team1Players.find(p => p.isReferent) && (
                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-lime-500/10 border border-lime-500/20">
                      <div className="w-1 h-8 rounded-full bg-lime-500"></div>
                      <img 
                        src={getUserAvatar(team1Players.find(p => p.isReferent)?.user)}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover border border-lime-500/30"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{team1Players.find(p => p.isReferent)?.username}</p>
                        <p className="text-lime-400 text-xs">{team1Name}</p>
                      </div>
                      <Crown className="w-4 h-4 text-yellow-400" />
                    </div>
                  )}
                  
                  {team2Players.find(p => p.isReferent) && (
                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <div className="w-1 h-8 rounded-full bg-blue-500"></div>
                      <img 
                        src={getUserAvatar(team2Players.find(p => p.isReferent)?.user)}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover border border-blue-500/30"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{team2Players.find(p => p.isReferent)?.username}</p>
                        <p className="text-blue-400 text-xs">{team2Name}</p>
                      </div>
                      <Crown className="w-4 h-4 text-yellow-400" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Result Voting - Referents Only */}
            {(match.status === 'ready' || match.status === 'in_progress' || match.status === 'disputed') && isReferent && (
              <div className={`bg-gradient-to-br ${match.status === 'disputed' ? 'from-red-500/20 to-orange-500/10' : 'from-lime-500/20 to-green-500/10'} border-2 rounded-xl p-4 ${match.status === 'disputed' ? 'border-red-500/50' : 'border-lime-500/50'}`}>
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Trophy className={`w-5 h-5 ${match.status === 'disputed' ? 'text-red-400' : 'text-lime-400'}`} />
                  {t.validateWinner}
                </h3>
                <p className="text-gray-400 text-sm mb-4">{t.validateWinnerDesc}</p>
                
                {/* Dispute notification */}
                {match.status === 'disputed' && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-red-400 mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="font-bold text-sm">{t.disputeTitle}</span>
                    </div>
                    <p className="text-gray-400 text-xs">{t.disputeDesc}</p>
                  </div>
                )}
                
                {/* Voting buttons - Only for referents */}
                {match.status !== 'disputed' && (
                  myVote ? (
                    <div className="text-center py-3 bg-dark-800/50 rounded-lg">
                      <CheckCircle className="w-10 h-10 text-lime-400 mx-auto mb-2" />
                      <p className="text-lime-400 font-medium text-sm">
                        {t.yourTeamVoted}: <span className="font-bold">{myVote === 1 ? team1Name : team2Name}</span>
                      </p>
                      <p className="text-gray-500 text-xs mt-2">{t.waitingOtherTeam}</p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Crown className="w-4 h-4 text-amber-400" />
                        <span className="text-amber-400 text-xs font-medium">{t.youAreReferent}</span>
                      </div>
                      <p className="text-center text-gray-400 text-xs mb-3">{t.reportResult}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleSubmitResult(1)}
                          disabled={submittingResult}
                          className="py-3 bg-lime-500/20 hover:bg-lime-500/40 text-lime-400 font-bold rounded-lg border-2 border-lime-500/50 transition-all disabled:opacity-50 hover:scale-[1.02] text-sm"
                        >
                          {submittingResult ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : team1Name}
                        </button>
                        <button
                          onClick={() => handleSubmitResult(2)}
                          disabled={submittingResult}
                          className="py-3 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 font-bold rounded-lg border-2 border-blue-500/50 transition-all disabled:opacity-50 hover:scale-[1.02] text-sm"
                        >
                          {submittingResult ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : team2Name}
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Call Arbitrator */}
            {match.status !== 'completed' && match.status !== 'cancelled' && (
              <div className="bg-dark-900/80 backdrop-blur-xl rounded-xl border border-orange-500/20 p-4">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-orange-400" />
                  {language === 'fr' ? 'Assistance' : 'Support'}
                </h3>
                
                {hasCalledArbitrator ? (
                  <div className="text-center py-2">
                    <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                      <CheckCircle className="w-4 h-4" />
                      <span className="font-medium text-sm">{t.arbitratorCalled}</span>
                    </div>
                    <p className="text-gray-400 text-xs">{t.arbitratorCalledDesc}</p>
                  </div>
                ) : (
                  <button
                    onClick={handleCallArbitrator}
                    disabled={callingArbitrator}
                    className="w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 bg-orange-500/20 border border-orange-500/40 text-orange-400 hover:bg-orange-500/30 disabled:opacity-50"
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

            {/* Admin Controls - Admin/Staff/Arbitre Only */}
            {hasAdminAccess() && (
              <div className="bg-gradient-to-br from-red-500/10 to-amber-500/10 border-2 border-red-500/30 rounded-xl p-4">
                <h3 className="text-sm font-bold text-red-400 mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  {t.adminControls}
                </h3>
                
                {/* Status Change */}
                <div className="mb-3">
                  <label className="text-xs text-gray-400 mb-1.5 block">{t.changeStatus}</label>
                  <select
                    value={match.status}
                    onChange={(e) => handleAdminStatusChange(e.target.value)}
                    disabled={changingStatus}
                    className="w-full px-3 py-2 bg-dark-900 border border-white/10 rounded-lg text-white text-sm focus:border-red-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="pending">{language === 'fr' ? 'En attente' : 'Pending'}</option>
                    <option value="ready">{language === 'fr' ? 'Pr\u00eat' : 'Ready'}</option>
                    <option value="in_progress">{language === 'fr' ? 'En cours' : 'In Progress'}</option>
                    <option value="completed">{language === 'fr' ? 'Termin\u00e9' : 'Completed'}</option>
                    <option value="disputed">{language === 'fr' ? 'En litige' : 'Disputed'}</option>
                    <option value="cancelled">{language === 'fr' ? 'Annul\u00e9' : 'Cancelled'}</option>
                  </select>
                </div>
                
                {/* Force Victory */}
                {match.status !== 'completed' && (
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">{t.forceVictory}</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setShowForceConfirm(1)}
                        disabled={forcingWinner}
                        className="py-2 bg-lime-500/20 hover:bg-lime-500/30 text-lime-400 font-bold rounded-lg border border-lime-500/40 transition-all disabled:opacity-50 text-xs"
                      >
                        {t.forceWinTeam} {team1Name}
                      </button>
                      <button
                        onClick={() => setShowForceConfirm(2)}
                        disabled={forcingWinner}
                        className="py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-bold rounded-lg border border-blue-500/40 transition-all disabled:opacity-50 text-xs"
                      >
                        {t.forceWinTeam} {team2Name}
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Force Victory Confirmation */}
                {showForceConfirm && (
                  <div className="mt-3 p-3 bg-red-500/10 border border-red-500/40 rounded-lg">
                    <p className="text-red-400 font-bold text-sm mb-1 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      {t.forceVictoryConfirm}
                    </p>
                    <p className="text-gray-400 text-xs mb-3">
                      {t.forceVictoryDesc}
                    </p>
                    <p className="text-white text-sm font-medium mb-3">
                      {language === 'fr' ? 'Gagnant' : 'Winner'}: <span className={showForceConfirm === 1 ? 'text-lime-400' : 'text-blue-400'}>{showForceConfirm === 1 ? team1Name : team2Name}</span>
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleForceWinner(showForceConfirm)}
                        disabled={forcingWinner}
                        className="py-2 bg-red-500/30 hover:bg-red-500/40 text-red-400 font-bold rounded-lg border border-red-500/50 transition-all disabled:opacity-50 text-xs flex items-center justify-center gap-1"
                      >
                        {forcingWinner ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><CheckCircle className="w-3.5 h-3.5" /> {t.confirm}</>}
                      </button>
                      <button
                        onClick={() => setShowForceConfirm(null)}
                        disabled={forcingWinner}
                        className="py-2 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded-lg border border-gray-600 transition-all disabled:opacity-50 text-xs"
                      >
                        {t.cancelAction}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Match Cancellation Request - Referents Only */}
            {(match.status === 'ready' || match.status === 'in_progress') && isReferent && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-orange-400 font-semibold text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {language === 'fr' ? 'Annulation du match' : 'Match Cancellation'}
                  </h3>
                </div>
                
                {/* Progress indicator */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{language === 'fr' ? 'Accord mutuel requis' : 'Mutual agreement required'}</span>
                    <span>
                      {(cancellationVotes.team1 === true ? 1 : 0) + (cancellationVotes.team2 === true ? 1 : 0)}/2
                    </span>
                  </div>
                  <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        cancellationVotes.team1 === true && cancellationVotes.team2 === true 
                          ? 'bg-green-500' 
                          : 'bg-orange-500'
                      }`}
                      style={{ 
                        width: `${((cancellationVotes.team1 === true ? 1 : 0) + (cancellationVotes.team2 === true ? 1 : 0)) * 50}%` 
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className={cancellationVotes.team1 === true ? 'text-orange-400' : 'text-gray-500'}>
                      {team1Name}: {cancellationVotes.team1 === true ? '✓' : '-'}
                    </span>
                    <span className={cancellationVotes.team2 === true ? 'text-orange-400' : 'text-gray-500'}>
                      {team2Name}: {cancellationVotes.team2 === true ? '✓' : '-'}
                    </span>
                  </div>
                </div>
                
                {(() => {
                  const myTeamVote = myTeam === 1 ? cancellationVotes.team1 : cancellationVotes.team2;
                  const opponentVote = myTeam === 1 ? cancellationVotes.team2 : cancellationVotes.team1;
                  const opponentTeamName = myTeam === 1 ? team2Name : team1Name;
                  
                  // Opponent requested cancellation - show accept/refuse buttons
                  if (opponentVote === true && myTeamVote !== true) {
                    return (
                      <div>
                        <div className="mb-3 p-2 bg-orange-500/20 border border-orange-500/30 rounded-lg">
                          <p className="text-orange-400 text-xs text-center">
                            <span className="font-bold">{opponentTeamName}</span> {t.opponentRequestedCancellation}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleCancelVote(true)}
                            disabled={submittingCancelVote}
                            className="py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 text-green-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            {submittingCancelVote ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-3.5 h-3.5" /> {t.acceptCancellation}</>}
                          </button>
                          <button
                            onClick={() => handleCancelVote(false)}
                            disabled={submittingCancelVote}
                            className="py-2 bg-dark-700 hover:bg-dark-600 border border-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {t.refuseCancellation}
                          </button>
                        </div>
                      </div>
                    );
                  }
                  
                  // My team requested cancellation - show waiting with option to cancel request
                  if (myTeamVote === true) {
                    return (
                      <button
                        onClick={() => handleCancelVote(false)}
                        disabled={submittingCancelVote}
                        className="w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30 disabled:opacity-50"
                      >
                        {submittingCancelVote ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Shield className="w-4 h-4" />
                            {language === 'fr' ? 'Retirer ma demande' : 'Remove my request'}
                          </>
                        )}
                      </button>
                    );
                  }
                  
                  // No cancellation request - show request button
                  return (
                    <button
                      onClick={() => handleCancelVote(true)}
                      disabled={submittingCancelVote}
                      className="w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 bg-orange-500/20 border border-orange-500/40 text-orange-400 hover:bg-orange-500/30 disabled:opacity-50"
                    >
                      {submittingCancelVote ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4" />
                          {t.requestCancellation}
                        </>
                      )}
                    </button>
                  );
                })()}
                
                <p className="text-xs text-gray-500 mt-2 text-center">
                  {language === 'fr' 
                    ? 'Les deux équipes doivent accepter pour annuler' 
                    : 'Both teams must agree to cancel'}
                </p>
              </div>
            )}

            {/* Match Completed */}
            {match.status === 'completed' && match.result?.winner && (
              <div className="bg-dark-900/80 backdrop-blur-xl rounded-xl border border-green-500/20 p-4">
                <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-green-400" />
                  {language === 'fr' ? 'Match terminé' : 'Match Ended'}
                </h2>
                
                <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/20 text-center">
                  <p className="text-green-400 text-sm mb-1">{t.winner}</p>
                  <p className="text-white font-bold text-lg">
                    {match.result.winner === 1 ? team1Name : team2Name}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Chat & Rosters */}
          <div className="lg:col-span-2 space-y-4">
            {/* Chat */}
            <div className="bg-dark-900/80 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-lime-500/20 p-3 sm:p-4 flex flex-col">
              <h2 className="text-xs sm:text-sm font-semibold text-gray-300 mb-2 sm:mb-3 flex items-center gap-2 uppercase tracking-wider">
                <MessageCircle className="w-3 sm:w-4 h-3 sm:h-4" />
                {t.chat}
              </h2>
              
              {/* Messages */}
              <div 
                ref={chatRef}
                className="flex-1 bg-dark-950/50 rounded-lg p-2 sm:p-3 mb-2 sm:mb-3 overflow-y-auto max-h-[200px] sm:max-h-[250px] min-h-[120px] border border-white/5"
              >
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    {language === 'fr' ? 'Aucun message' : 'No messages'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {messages.filter(msg => {
                      // Filter out empty messages
                      // Exclure les messages GGSecure - plus utilisé (remplacé par Iris)
                      if (msg.messageType === 'ggsecure_disconnect' || msg.messageType === 'ggsecure_reconnect') return false;
                      if (msg.isSystem && msg.messageType) return true; // Keep typed system messages
                      if (msg.isSystem && msg.message && msg.message.trim()) return true;
                      if (!msg.isSystem && msg.message && msg.message.trim()) return true;
                      return false;
                    }).map((msg, idx) => {
                      // Handle system messages
                      if (msg.isSystem) {
                        let displayMessage = msg.message || '';
                        let messageStyle = 'default';
                        
                        // Skip empty system messages
                        if (!displayMessage.trim()) return null;
                        
                        // Styles based on message type
                        let bgClass = 'bg-gray-500/10 border-gray-500/30';
                        let textClass = 'text-gray-400';
                        
                        if (messageStyle === 'disconnect') {
                          bgClass = 'bg-red-500/10 border-red-500/30';
                          textClass = 'text-red-400';
                        } else if (messageStyle === 'reconnect') {
                          bgClass = 'bg-green-500/10 border-green-500/30';
                          textClass = 'text-green-400';
                        } else {
                          bgClass = 'bg-lime-500/10 border-lime-500/20';
                          textClass = 'text-lime-400';
                        }
                        
                        return (
                          <div key={idx} className="flex justify-center">
                            <div className={`px-3 py-1.5 ${bgClass} border rounded-lg max-w-[85%]`}>
                              <p className={`${textClass} text-xs text-center`}>{displayMessage}</p>
                            </div>
                          </div>
                        );
                      }

                      // Regular user messages
                      const isOwnMessage = msg.user?._id === user?._id || msg.user === user?._id;
                      const isStaffMessage = msg.isStaff || msg.user?.roles?.some(r => ['admin', 'staff', 'arbitre'].includes(r));
                      
                      let teamColor = 'gray';
                      if (isStaffMessage) {
                        teamColor = 'yellow';
                      } else {
                        teamColor = msg.team === 1 ? 'lime' : 'blue';
                      }
                      
                      return (
                        <div key={idx} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                          <div className="max-w-[75%]">
                            <div className={`flex items-center gap-1.5 mb-0.5 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                              {isStaffMessage && <span className="px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/30 rounded text-[10px] font-bold text-yellow-400">STAFF</span>}
                              <span className={`text-xs font-medium text-${teamColor}-400`}>{msg.user?.username || msg.username}</span>
                              <span className="text-gray-600 text-[10px]">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className={`px-3 py-1.5 rounded-lg text-sm ${
                              isStaffMessage 
                                ? 'bg-yellow-500/20 text-yellow-100 border-2 border-yellow-500/50' 
                                : isOwnMessage 
                                  ? `bg-${teamColor}-500/20 text-${teamColor}-100 border border-${teamColor}-500/30` 
                                  : 'bg-dark-800 text-gray-200 border border-white/5'
                            }`}>
                              {msg.message}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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

            {/* Rosters - Side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Team 1 Roster */}
              <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border ${winner === 1 ? 'border-lime-500/50' : 'border-lime-500/20'} p-3 sm:p-4`}>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-lime-400" />
                  {team1Name}
                  {match.hostTeam === 1 && (
                    <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded">{t.host}</span>
                  )}
                </h3>
                <div className="space-y-2">
                  {team1Players.map((player, idx) => {
                    const isRef = player.isReferent;
                    const equippedTitle = player.user?.equippedTitle;
                    const titleName = equippedTitle?.nameTranslations?.[language] || equippedTitle?.name;
                    const playerRank = getStrickerRank(player.points || 0);
                    
                    return (
                      <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg ${isRef ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-dark-800/50'}`}>
                        <img 
                          src={getUserAvatar(player.user)} 
                          alt={player.username}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          {player.user?._id ? (
                            <Link to={`/player/${player.user._id}`} className="hover:text-lime-400 transition-colors">
                              <p className="text-white text-sm font-medium truncate hover:underline">{player.username}</p>
                            </Link>
                          ) : (
                            <p className="text-white text-sm font-medium truncate">{player.username}</p>
                          )}
                          {titleName && !player.isFake && (
                            <span 
                              className={getTitleStyles(equippedTitle?.rarity).className}
                              style={getTitleStyles(equippedTitle?.rarity).style}
                            >
                              {titleName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Rank badge */}
                          <div 
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-lime-500/20 border border-lime-500/30"
                            title={`${playerRank.name} - ${player.points || 0} pts`}
                          >
                            <img src={playerRank.image} alt={playerRank.name} className="w-4 h-4 object-contain" />
                            <span className="text-lime-400 text-[10px] font-bold">{playerRank.name}</span>
                          </div>
                          {/* Platform badge */}
                          {player.user?.platform && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${player.user.platform === 'PC' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                              {player.user.platform}
                            </span>
                          )}
                          {/* Iris connection status for PC players */}
                          {player.user?.platform === 'PC' && !player.isFake && (() => {
                            const irisConnected = isPlayerConnectedToIris(player.user);
                            return (
                              <div 
                                className={`p-1 rounded ${irisConnected ? 'bg-green-500/20' : 'bg-red-500/20'}`}
                                title={irisConnected ? 'Iris connecté' : 'Iris déconnecté'}
                              >
                                <Eye className={`w-3 h-3 ${irisConnected ? 'text-green-400' : 'text-red-400'}`} />
                              </div>
                            );
                          })()}
                          {isRef && <Crown className="w-3.5 h-3.5 text-yellow-400" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Team 2 Roster */}
              <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border ${winner === 2 ? 'border-blue-500/50' : 'border-blue-500/20'} p-3 sm:p-4`}>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  {team2Name}
                  {match.hostTeam === 2 && (
                    <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded">{t.host}</span>
                  )}
                </h3>
                <div className="space-y-2">
                  {team2Players.map((player, idx) => {
                    const isRef = player.isReferent;
                    const equippedTitle = player.user?.equippedTitle;
                    const titleName = equippedTitle?.nameTranslations?.[language] || equippedTitle?.name;
                    const playerRank = getStrickerRank(player.points || 0);
                    
                    return (
                      <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg ${isRef ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-dark-800/50'}`}>
                        <img 
                          src={getUserAvatar(player.user)} 
                          alt={player.username}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          {player.user?._id ? (
                            <Link to={`/player/${player.user._id}`} className="hover:text-blue-400 transition-colors">
                              <p className="text-white text-sm font-medium truncate hover:underline">{player.username}</p>
                            </Link>
                          ) : (
                            <p className="text-white text-sm font-medium truncate">{player.username}</p>
                          )}
                          {titleName && !player.isFake && (
                            <span 
                              className={getTitleStyles(equippedTitle?.rarity).className}
                              style={getTitleStyles(equippedTitle?.rarity).style}
                            >
                              {titleName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Rank badge */}
                          <div 
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-500/20 border border-blue-500/30"
                            title={`${playerRank.name} - ${player.points || 0} pts`}
                          >
                            <img src={playerRank.image} alt={playerRank.name} className="w-4 h-4 object-contain" />
                            <span className="text-blue-400 text-[10px] font-bold">{playerRank.name}</span>
                          </div>
                          {/* Platform badge */}
                          {player.user?.platform && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${player.user.platform === 'PC' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                              {player.user.platform}
                            </span>
                          )}
                          {/* Iris connection status for PC players */}
                          {player.user?.platform === 'PC' && !player.isFake && (() => {
                            const irisConnected = isPlayerConnectedToIris(player.user);
                            return (
                              <div 
                                className={`p-1 rounded ${irisConnected ? 'bg-green-500/20' : 'bg-red-500/20'}`}
                                title={irisConnected ? 'Iris connecté' : 'Iris déconnecté'}
                              >
                                <Eye className={`w-3 h-3 ${irisConnected ? 'text-green-400' : 'text-red-400'}`} />
                              </div>
                            );
                          })()}
                          {isRef && <Crown className="w-3.5 h-3.5 text-yellow-400" />}
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

      {/* Rules Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 rounded-2xl border border-lime-500/30 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0 bg-gradient-to-r from-lime-500/20 to-green-500/10">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <BookOpen className="w-6 h-6 text-lime-400" />
                {t.rules} - Search & Destroy
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
                  <Loader2 className="w-8 h-8 text-lime-500 animate-spin" />
                  <span className="ml-3 text-gray-400">{t.loadingRules}</span>
                </div>
              ) : rules && rules.sections && rules.sections.length > 0 ? (
                <div className="space-y-6">
                  {rules.sections.map((section, idx) => (
                    <div key={idx} className="bg-dark-800/50 rounded-xl p-4 border border-white/5">
                      <h3 className="text-lg font-bold text-lime-400 mb-3 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-lime-500/20 flex items-center justify-center text-sm font-bold text-lime-400">
                          {idx + 1}
                        </span>
                        {section.title?.[language] || section.title?.fr || `Section ${idx + 1}`}
                      </h3>
                      <div 
                        className="prose prose-invert prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: section.content?.[language] || section.content?.fr || 'Pas de contenu' }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500">{t.noRulesConfigured}</p>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-white/10 flex-shrink-0">
              <button
                onClick={() => setShowRulesModal(false)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-lime-500 to-green-600 text-white font-semibold hover:opacity-90 transition-all"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Combat Report Modal */}
      {showMatchReport && matchReportData && (
        <StrickerMatchReport
          show={showMatchReport}
          onClose={() => setShowMatchReport(false)}
          isWinner={matchReportData.isWinner}
          rewards={matchReportData.rewards}
          oldRank={matchReportData.oldRank}
          newRank={matchReportData.newRank}
          matchId={matchId}
          isReferent={isReferent}
          squadName={matchReportData.squadName}
          cranesEarned={matchReportData.cranesEarned}
          goldEarned={matchReportData.goldEarned}
          xpEarned={matchReportData.xpEarned}
          topSquadPointsChange={matchReportData.topSquadPointsChange}
          matchMode={match?.mode}
          matchFormat={match?.format || '5v5'}
          mapBans={{
            team1BannedMap: match?.mapBans?.team1BannedMap || mapBans.team1BannedMap,
            team2BannedMap: match?.mapBans?.team2BannedMap || mapBans.team2BannedMap,
            team1Name: match?.team1Squad?.name || t.team1,
            team2Name: match?.team2Squad?.name || t.team2
          }}
          selectedMap={typeof match?.selectedMap === 'string' ? match.selectedMap : match?.selectedMap?.name}
        />
      )}
    </div>
  );
};

export default StrickerMatchSheet;