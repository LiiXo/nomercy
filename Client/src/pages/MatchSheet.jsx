import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { useSocket } from '../SocketContext';
import { 
  ArrowLeft, Trophy, Users, Clock, Send, Loader2, Shield, 
  Swords, MessageCircle, AlertTriangle, Crown, Shuffle, Map
} from 'lucide-react';
import RankedMatchReport from '../components/RankedMatchReport';
import LadderMatchReport from '../components/LadderMatchReport';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

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
  
  // Rapport de combat (mode classé)
  const [showMatchReport, setShowMatchReport] = useState(false);
  const [matchReportData, setMatchReportData] = useState(null);
  
  // Rapport de combat (match ladder)
  const [showLadderReport, setShowLadderReport] = useState(false);
  const [ladderReportData, setLadderReportData] = useState(null);
  
  // Flag pour éviter d'afficher le rapport plusieurs fois
  const [reportShownForMatch, setReportShownForMatch] = useState(null);

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
      onlyReferentCanValidate: 'Seul le référent peut valider',
      warningMessage: '⚠️ Rappel : Tout débordement ou comportement inacceptable peuvent entraîner des sanctions sévères.',
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
      onlyReferentCanValidate: 'Only the referent can validate',
      warningMessage: '⚠️ Warning: Any misconduct or unacceptable behavior may result in severe penalties.',
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
      onlyReferentCanValidate: 'Nur der Referent kann bestätigen',
      warningMessage: '⚠️ Warnung: Jedes Fehlverhalten oder inakzeptables Verhalten kann zu schweren Strafen führen.',
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
      onlyReferentCanValidate: 'Solo il referente può confermare',
      warningMessage: '⚠️ Avviso: Qualsiasi comportamento scorretto o inaccettabile può comportare sanzioni severe.',
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
  }, [matchId, isAuthenticated]);

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
          // Si le match est annulé, rediriger vers la liste des matchs
          if (data.match.status === 'cancelled') {
            navigate('/matches');
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
        navigate('/matches');
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
      
      // Cleanup pour les listeners ranked
      return () => {
        socket.off('newChatMessage', handleNewChatMessage);
        socket.off('matchUpdate', handleMatchUpdate);
        socket.off('matchCancellationApproved', handleMatchCancelled);
        socket.off('rankedMatchUpdate', handleRankedMatchUpdate);
        socket.off('rankedMatchMessage', handleRankedMatchMessage);
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

  // Submit match result
  const handleSubmitResult = async (winner) => {
    if (isRankedMatch) {
      if (!isReferent && !isStaff) return;
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
        
        // Afficher un message si on attend l'autre équipe
        if (data.waitingForOther) {
          // Ajouter un message système dans le chat
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
        // Si l'annulation est acceptée, rediriger vers la liste des matchs
        if (approved && data.match?.status === 'cancelled') {
          navigate('/matches');
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

  // Check who can validate (leader/officer for ladder, referent for ranked)
  const canValidateResult = () => {
    if (isRankedMatch) {
      return isReferent;
    }
    return canManageMatch();
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
                  <span className={`px-2 py-0.5 bg-${accentColor}-500/20 rounded text-${accentColor}-400 text-xs font-medium`}>
                    {match.gameMode}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-gray-500 text-sm">{t.mapSelection}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    isRankedMatch || match.mapType === 'random'
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'bg-cyan-500/20 text-cyan-400'
                  }`}>
                    {isRankedMatch ? t.mapRandom : (match.mapType === 'random' ? t.mapRandom : t.mapFree)}
                  </span>
                </div>
                
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

            {/* Maps tirées au sort */}
            {((match.maps && match.maps.length > 0) || (match.randomMaps && match.randomMaps.length > 0)) && (
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

            {/* Actions - Sélectionner gagnant */}
            {isParticipant && canValidateResult() && ['accepted', 'in_progress', 'ready'].includes(match.status) && (
              <button
                onClick={() => setShowResultModal(true)}
                className={`w-full py-2.5 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2`}
              >
                <Trophy className="w-4 h-4" />
                {t.selectWinner}
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
                      const isMsgStaff = msg.isStaff || msg.user?.roles?.some(r => ['admin', 'staff', 'gerant_cdl', 'gerant_hardcore'].includes(r));
                      
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
              {t.selectWinner}
            </h3>
            
            {/* Info rapports existants (mode classé) */}
            {isRankedMatch && (match.result?.team1Report || match.result?.team2Report) && (
              <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <p className="text-cyan-400 text-sm font-medium mb-2">📋 Rapports enregistrés :</p>
                <div className="space-y-1 text-xs">
                  {match.result?.team1Report && (
                    <p className="text-gray-300">
                      • Équipe 1 : <span className="text-green-400">Équipe {match.result.team1Report.winner} gagnante</span>
                    </p>
                  )}
                  {match.result?.team2Report && (
                    <p className="text-gray-300">
                      • Équipe 2 : <span className="text-green-400">Équipe {match.result.team2Report.winner} gagnante</span>
                    </p>
                  )}
                  {(!match.result?.team1Report || !match.result?.team2Report) && (
                    <p className="text-orange-400 text-xs mt-2">
                      ⏳ En attente du rapport de l'équipe {!match.result?.team1Report ? '1' : '2'}
                    </p>
                  )}
                </div>
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
