import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { useSocket } from '../SocketContext';
import { 
  ArrowLeft, Trophy, Users, Clock, Coins, Send, Loader2, 
  TrendingUp, TrendingDown, Minus, Shield, Swords, MessageCircle,
  CheckCircle, XCircle, AlertTriangle, Crown, Home, Map, Ban, Zap
} from 'lucide-react';

import { getAvatarUrl, getDefaultAvatar } from '../utils/avatar';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const MatchSheet = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const { user, isAuthenticated, refreshUser } = useAuth();

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
  const [requestingCancel, setRequestingCancel] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showStaffVictoryModal, setShowStaffVictoryModal] = useState(false);
  const [staffActionLoading, setStaffActionLoading] = useState(false);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const evidenceInputRef = useRef(null);
  const { on, joinMatch, leaveMatch } = useSocket();
  const [rewardsConfig, setRewardsConfig] = useState(null);
  const [showCombatReport, setShowCombatReport] = useState(false);
  const [hasSeenCombatReport, setHasSeenCombatReport] = useState(false);
  
  // GGSecure status tracking for PC players
  const [ggsecureStatuses, setGgsecureStatuses] = useState({});
  const ggsecureStatusesRef = useRef({});
  const lastGGSecureMessageRef = useRef({}); // Track last message sent for each player to avoid duplicates
  
  // Team form (last 5 matches)
  const [challengerForm, setChallengerForm] = useState([]);
  const [opponentForm, setOpponentForm] = useState([]);

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
      duoTrio: 'Chill',
      squadTeam: 'Compétitif',
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
      onlyLeader: 'Seul le leader ou un officier peut valider',
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
      requestCancel: 'Demander l\'annulation',
      cancelRequested: 'Annulation demandée',
      waitingOpponentCancel: 'En attente de l\'adversaire',
      cancelConfirm: 'Voulez-vous demander l\'annulation de ce match ? L\'adversaire devra confirmer.',
      cancelMatch: 'Annuler le match',
      bothTeamsCancel: 'Les deux équipes doivent accepter l\'annulation.',
      randomMaps: 'Maps du match',
      map: 'Map',
      gameModes: {
        'Search & Destroy': 'Recherche et Destruction',
        'Domination': 'Domination',
        'Kill Confirmed': 'Meurtre Confirmé',
        'CTF': 'Capture du Drapeau',
      },
      staffActions: 'Actions Staff',
      giveVictory: 'Donner la victoire',
      removeDispute: 'Retirer le litige',
      selectTeam: 'Sélectionnez l\'équipe gagnante',
      evidence: 'Preuves',
      uploadEvidence: 'Ajouter une preuve',
      evidenceDescription: 'Description (optionnel)',
      evidenceDescriptionPlaceholder: 'Décrivez brièvement cette preuve...',
      uploadedBy: 'Envoyé par',
      noEvidence: 'Aucune preuve ajoutée',
      maxEvidenceReached: 'Limite de 5 preuves atteinte',
      dragDropEvidence: 'Glissez-déposez une image ou cliquez pour sélectionner',
      supportedFormats: 'Formats: JPG, PNG, GIF, WebP (max 5 Mo)',
      uploading: 'Envoi en cours...',
      systemMessages: {
        result_declared: (p) => `🏆 ${p.playerName} a déclaré ${p.winnerName} vainqueur du match.`,
        dispute_reported: (p) => `⚠️ ${p.playerName} a signalé un litige.${p.reason ? ` Raison: ${p.reason}` : ''}`,
        evidence_added: (p) => `📷 ${p.username} a ajouté une preuve au litige.`,
        match_cancelled_mutual: () => `⚠️ Match annulé d'un commun accord entre les deux équipes.`,
        cancel_requested: (p) => `🔄 ${p.playerName} demande l'annulation du match.`,
        match_cancelled_staff: (p) => `❌ Match annulé par le staff.${p.reason ? ` Raison: ${p.reason}` : ''}`,
        victory_assigned_staff: (p) => `👑 Le staff a attribué la victoire à ${p.winnerName}.`,
        dispute_removed_staff: () => `✅ Le litige a été retiré par le staff. Le match reprend.`,
      },
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
      duoTrio: 'Chill',
      squadTeam: 'Compétitif',
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
      onlyLeader: 'Only the leader or an officer can validate',
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
      requestCancel: 'Request cancellation',
      cancelRequested: 'Cancellation requested',
      waitingOpponentCancel: 'Waiting for opponent',
      cancelConfirm: 'Do you want to request the cancellation of this match? The opponent must confirm.',
      cancelMatch: 'Cancel match',
      bothTeamsCancel: 'Both teams must agree to cancel.',
      randomMaps: 'Match maps',
      map: 'Map',
      gameModes: {
        'Search & Destroy': 'Search & Destroy',
        'Domination': 'Domination',
        'Kill Confirmed': 'Kill Confirmed',
        'CTF': 'Capture the Flag',
      },
      staffActions: 'Staff Actions',
      giveVictory: 'Give victory',
      removeDispute: 'Remove dispute',
      selectTeam: 'Select the winning team',
      evidence: 'Evidence',
      uploadEvidence: 'Add evidence',
      evidenceDescription: 'Description (optional)',
      evidenceDescriptionPlaceholder: 'Briefly describe this evidence...',
      uploadedBy: 'Uploaded by',
      noEvidence: 'No evidence added',
      maxEvidenceReached: 'Limit of 5 pieces of evidence reached',
      dragDropEvidence: 'Drag and drop an image or click to select',
      supportedFormats: 'Formats: JPG, PNG, GIF, WebP (max 5 MB)',
      uploading: 'Uploading...',
      systemMessages: {
        result_declared: (p) => `🏆 ${p.playerName} declared ${p.winnerName} as the match winner.`,
        dispute_reported: (p) => `⚠️ ${p.playerName} reported a dispute.${p.reason ? ` Reason: ${p.reason}` : ''}`,
        evidence_added: (p) => `📷 ${p.username} added evidence to the dispute.`,
        match_cancelled_mutual: () => `⚠️ Match cancelled by mutual agreement.`,
        cancel_requested: (p) => `🔄 ${p.playerName} is requesting match cancellation.`,
        match_cancelled_staff: (p) => `❌ Match cancelled by staff.${p.reason ? ` Reason: ${p.reason}` : ''}`,
        victory_assigned_staff: (p) => `👑 Staff assigned victory to ${p.winnerName}.`,
        dispute_removed_staff: () => `✅ Dispute has been removed by staff. Match resumes.`,
      },
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
      duoTrio: 'Chill',
      squadTeam: 'Compétitif',
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
      onlyLeader: 'Nur der Leader oder ein Offizier kann bestätigen',
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
      requestCancel: 'Abbruch anfordern',
      cancelRequested: 'Abbruch angefordert',
      waitingOpponentCancel: 'Warte auf Gegner',
      cancelConfirm: 'Möchten Sie den Abbruch dieses Spiels anfordern? Der Gegner muss bestätigen.',
      cancelMatch: 'Spiel abbrechen',
      bothTeamsCancel: 'Beide Teams müssen dem Abbruch zustimmen.',
      randomMaps: 'Spielkarten',
      map: 'Karte',
      gameModes: {
        'Search & Destroy': 'Suchen & Zerstören',
        'Domination': 'Herrschaft',
        'Kill Confirmed': 'Kill Bestätigt',
        'CTF': 'Flaggenraub',
      },
      staffActions: 'Staff-Aktionen',
      giveVictory: 'Sieg geben',
      removeDispute: 'Streit entfernen',
      selectTeam: 'Wählen Sie das Gewinnerteam',
      evidence: 'Beweise',
      uploadEvidence: 'Beweis hinzufügen',
      evidenceDescription: 'Beschreibung (optional)',
      evidenceDescriptionPlaceholder: 'Beschreiben Sie diesen Beweis kurz...',
      uploadedBy: 'Hochgeladen von',
      noEvidence: 'Keine Beweise hinzugefügt',
      maxEvidenceReached: 'Limit von 5 Beweisen erreicht',
      dragDropEvidence: 'Bild hierher ziehen oder klicken zum Auswählen',
      supportedFormats: 'Formate: JPG, PNG, GIF, WebP (max 5 MB)',
      uploading: 'Wird hochgeladen...',
      systemMessages: {
        result_declared: (p) => `🏆 ${p.playerName} hat ${p.winnerName} als Sieger erklärt.`,
        dispute_reported: (p) => `⚠️ ${p.playerName} hat einen Streit gemeldet.${p.reason ? ` Grund: ${p.reason}` : ''}`,
        evidence_added: (p) => `📷 ${p.username} hat einen Beweis hinzugefügt.`,
        match_cancelled_mutual: () => `⚠️ Spiel wurde einvernehmlich abgesagt.`,
        cancel_requested: (p) => `🔄 ${p.playerName} beantragt die Absage.`,
        match_cancelled_staff: (p) => `❌ Spiel wurde vom Staff abgesagt.${p.reason ? ` Grund: ${p.reason}` : ''}`,
        victory_assigned_staff: (p) => `👑 Staff hat ${p.winnerName} den Sieg zugesprochen.`,
        dispute_removed_staff: () => `✅ Der Streit wurde vom Staff entfernt. Das Spiel wird fortgesetzt.`,
      },
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
      duoTrio: 'Chill',
      squadTeam: 'Compétitif',
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
      onlyLeader: 'Solo il leader o un ufficiale può confermare',
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
      requestCancel: 'Richiedi annullamento',
      cancelRequested: 'Annullamento richiesto',
      waitingOpponentCancel: 'In attesa dell\'avversario',
      cancelConfirm: 'Vuoi richiedere l\'annullamento di questa partita? L\'avversario deve confermare.',
      cancelMatch: 'Annulla partita',
      bothTeamsCancel: 'Entrambe le squadre devono accettare l\'annullamento.',
      randomMaps: 'Mappe della partita',
      map: 'Mappa',
      gameModes: {
        'Search & Destroy': 'Cerca e Distruggi',
        'Domination': 'Dominazione',
        'Kill Confirmed': 'Uccisione Confermata',
        'CTF': 'Cattura la Bandiera',
      },
      staffActions: 'Azioni Staff',
      giveVictory: 'Dare la vittoria',
      removeDispute: 'Rimuovi controversia',
      selectTeam: 'Seleziona la squadra vincente',
      evidence: 'Prove',
      uploadEvidence: 'Aggiungi prova',
      evidenceDescription: 'Descrizione (opzionale)',
      evidenceDescriptionPlaceholder: 'Descrivi brevemente questa prova...',
      uploadedBy: 'Caricato da',
      noEvidence: 'Nessuna prova aggiunta',
      maxEvidenceReached: 'Limite di 5 prove raggiunto',
      dragDropEvidence: 'Trascina un\'immagine o clicca per selezionare',
      supportedFormats: 'Formati: JPG, PNG, GIF, WebP (max 5 MB)',
      uploading: 'Caricamento...',
      systemMessages: {
        result_declared: (p) => `🏆 ${p.playerName} ha dichiarato ${p.winnerName} vincitore.`,
        dispute_reported: (p) => `⚠️ ${p.playerName} ha segnalato una controversia.${p.reason ? ` Motivo: ${p.reason}` : ''}`,
        evidence_added: (p) => `📷 ${p.username} ha aggiunto una prova.`,
        match_cancelled_mutual: () => `⚠️ Partita annullata di comune accordo.`,
        cancel_requested: (p) => `🔄 ${p.playerName} richiede l'annullamento.`,
        match_cancelled_staff: (p) => `❌ Partita annullata dallo staff.${p.reason ? ` Motivo: ${p.reason}` : ''}`,
        victory_assigned_staff: (p) => `👑 Lo staff ha assegnato la vittoria a ${p.winnerName}.`,
        dispute_removed_staff: () => `✅ La controversia è stata rimossa dallo staff. La partita riprende.`,
      },
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
        console.log('[MATCH SHEET] Received match data:', data.match);
        console.log('[MATCH SHEET] challengerRoster:', data.match?.challengerRoster);
        console.log('[MATCH SHEET] opponentRoster:', data.match?.opponentRoster);
        
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

  // Fetch rewards configuration based on match ladder type
  useEffect(() => {
    const fetchRewardsConfig = async () => {
      try {
        // Pass ladderId to get correct rewards (chill vs competitive)
        const ladderId = match?.ladderId || 'duo-trio';
        const response = await fetch(`${API_URL}/config/rewards/squad?ladderId=${ladderId}`);
        const data = await response.json();
        if (data.success) {
          setRewardsConfig(data.rewards);
        }
      } catch (err) {
        console.error('Error fetching rewards config:', err);
      }
    };
    // Only fetch when we have match data
    if (match?.ladderId) {
      fetchRewardsConfig();
    }
  }, [match?.ladderId]);

  useEffect(() => {
    fetchMatchData(true);
    fetchMySquad();
  }, [matchId, isAuthenticated]);

  // Fetch team form (last 5 matches) for both teams
  const fetchTeamForm = async (squadId) => {
    try {
      const response = await fetch(`${API_URL}/matches/history/${squadId}?limit=5`);
      const data = await response.json();
      if (data.success && data.matches) {
        return data.matches.map(m => {
          // Handle both populated winner (object with _id) and non-populated (just ObjectId)
          const winnerId = m.result?.winner?._id?.toString() || m.result?.winner?.toString();
          return {
            isWin: winnerId === squadId.toString(),
            opponentName: m.challenger?._id?.toString() === squadId.toString() 
              ? m.opponent?.name 
              : m.challenger?.name
          };
        });
      }
    } catch (err) {
      console.error('Error fetching team form:', err);
    }
    return [];
  };

  useEffect(() => {
    const loadTeamForms = async () => {
      if (match?.challenger?._id) {
        const form = await fetchTeamForm(match.challenger._id);
        setChallengerForm(form);
      }
      if (match?.opponent?._id) {
        const form = await fetchTeamForm(match.opponent._id);
        setOpponentForm(form);
      }
    };
    loadTeamForms();
  }, [match?.challenger?._id, match?.opponent?._id]);

  // Show combat report when match is completed
  useEffect(() => {
    const isMatchParticipant = mySquad && (mySquad._id === match?.challenger?._id || mySquad._id === match?.opponent?._id);
    if (match?.status === 'completed' && match?.result?.rewardsGiven && !hasSeenCombatReport && isMatchParticipant) {
      setShowCombatReport(true);
      setHasSeenCombatReport(true);
    }
  }, [match?.status, match?.result?.rewardsGiven, hasSeenCombatReport, mySquad, match?.challenger?._id, match?.opponent?._id]);

  // Poll for updates every 30 seconds (silent, only after initial load)
  useEffect(() => {
    if (!initialLoadDone) return;
    
    const interval = setInterval(() => fetchMatchData(false), 30000);
    return () => clearInterval(interval);
  }, [initialLoadDone, matchId]);

  // GGSecure status monitoring for PC players
  const ggsecureMonitoringStarted = useRef(false);
  const ggsecureIntervalRef = useRef(null);
  
  const checkPlayerGGSecure = async (playerId) => {
    try {
      const response = await fetch(`${API_URL}/users/anticheat-status/${playerId}`);
      const data = await response.json();
      return data.isOnline || false;
    } catch {
      return null; // Error checking, don't change status
    }
  };

  const sendGGSecureStatusMessage = async (playerId, username, isOnline) => {
    const now = Date.now();
    const lastSent = lastGGSecureMessageRef.current[playerId];
    
    // Skip if we already sent a message for this exact status recently (60 seconds)
    if (lastSent && lastSent.status === isOnline && (now - lastSent.time) < 60000) {
      console.log(`[GGSecure] Skipping - same status message sent recently for ${username}`);
      return;
    }
    
    try {
      await fetch(`${API_URL}/matches/${matchId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          message: `🛡️ GGSecure ${isOnline ? 'ON' : 'OFF'} - ${username}`,
          isSystemGGSecure: true
        })
      });
      lastGGSecureMessageRef.current[playerId] = { time: now, status: isOnline };
      console.log(`[GGSecure] Message sent for ${username}: ${isOnline ? 'ON' : 'OFF'}`);
    } catch (err) {
      console.error('Error sending GGSecure status message:', err);
    }
  };

  // Check GGSecure status for all PC players in rosters
  const checkAllGGSecureStatuses = async (isInitialCheck = false) => {
    if (!match || (match.status !== 'in_progress' && match.status !== 'accepted')) return;
    
    // Get all PC players from both rosters
    const allPlayers = [];
    
    if (match.challengerRoster) {
      match.challengerRoster.forEach(p => {
        if (p.user?.platform === 'PC') {
          allPlayers.push({ 
            id: p.user._id, 
            username: p.user.username,
            platform: p.user.platform
          });
        }
      });
    }
    
    if (match.opponentRoster) {
      match.opponentRoster.forEach(p => {
        if (p.user?.platform === 'PC') {
          allPlayers.push({ 
            id: p.user._id, 
            username: p.user.username,
            platform: p.user.platform
          });
        }
      });
    }
    
    if (allPlayers.length === 0) return;
    
    // Check each PC player's status
    for (const player of allPlayers) {
      const isOnline = await checkPlayerGGSecure(player.id);
      
      // Skip if error checking
      if (isOnline === null) continue;
      
      const previousStatus = ggsecureStatusesRef.current[player.id];
      
      // Only send message if:
      // 1. This is NOT the initial check (we don't want to spam on page load)
      // 2. We had a previous status to compare
      // 3. The status actually changed
      if (!isInitialCheck && previousStatus !== undefined && previousStatus !== isOnline) {
        console.log(`[GGSecure] Status CHANGED for ${player.username}: ${previousStatus} -> ${isOnline}`);
        await sendGGSecureStatusMessage(player.id, player.username, isOnline);
      }
      
      // Update status (silently on initial check)
      ggsecureStatusesRef.current[player.id] = isOnline;
      setGgsecureStatuses(prev => ({ ...prev, [player.id]: isOnline }));
    }
  };

  // Start GGSecure monitoring when match is in progress - only once
  useEffect(() => {
    if (!match || (match.status !== 'in_progress' && match.status !== 'accepted')) {
      // Match not ready or finished, stop monitoring
      if (ggsecureIntervalRef.current) {
        clearInterval(ggsecureIntervalRef.current);
        ggsecureIntervalRef.current = null;
      }
      ggsecureMonitoringStarted.current = false;
      return;
    }
    
    // Only start monitoring once
    if (ggsecureMonitoringStarted.current) return;
    ggsecureMonitoringStarted.current = true;
    
    console.log('[GGSecure] Starting monitoring...');
    
    // Initial check - silent, just to get initial statuses
    checkAllGGSecureStatuses(true);
    
    // Check every 15 seconds - these can send messages if status changes
    ggsecureIntervalRef.current = setInterval(() => checkAllGGSecureStatuses(false), 15000);
    
    return () => {
      if (ggsecureIntervalRef.current) {
        clearInterval(ggsecureIntervalRef.current);
        ggsecureIntervalRef.current = null;
      }
    };
  }, [match?.status, matchId]);

  // Socket.io events for real-time updates
  useEffect(() => {
    if (!matchId) return;

    // Join match room
    joinMatch(matchId);

    // Real-time chat messages
    const handleChatMessage = (data) => {
      if (data.matchId === matchId) {
        setMessages(prev => {
          // Avoid duplicates
          if (prev.some(m => m.createdAt === data.message.createdAt && m.user?._id === data.message.user?._id)) {
            return prev;
          }
          return [...prev, data.message];
        });
        // Scroll to bottom after receiving new message
        setTimeout(scrollChatToBottom, 50);
      }
    };

    // Match updates (cancel requests, status changes, etc.)
    const handleMatchUpdate = (data) => {
      if (data.match?._id === matchId) {
        setMatch(data.match);
        
        // Sync chat messages from match update (for system messages from staff actions, etc.)
        if (data.match.chat) {
          setMessages(prev => {
            const newMessages = data.match.chat;
            // Only update if there are new messages
            if (newMessages.length > prev.length) {
              return newMessages;
            }
            return prev;
          });
        }
        
        // Si le match est annulé, rediriger vers l'accueil du mode
        if (data.match.status === 'cancelled') {
          const redirectPath = data.match.mode === 'hardcore' ? '/hardcore' : '/cdl';
          navigate(redirectPath);
        }
      }
    };

    // Subscribe to events
    const unsubChat = on('newChatMessage', handleChatMessage);
    const unsubMatch = on('matchUpdate', handleMatchUpdate);

    return () => {
      leaveMatch(matchId);
      unsubChat();
      unsubMatch();
    };
  }, [matchId, navigate, on, joinMatch, leaveMatch]);

  // Chat container ref for scrolling
  const chatContainerRef = useRef(null);
  
  // Scroll to bottom of chat
  const scrollChatToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  // Track previous message count to detect new messages
  const prevMessageCount = useRef(0);
  
  // Scroll chat to bottom whenever a new message arrives
  useEffect(() => {
    if (messages.length > 0) {
      // Always scroll to bottom when messages change
      setTimeout(scrollChatToBottom, 50);
    }
    prevMessageCount.current = messages.length;
  }, [messages.length]);

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
        // Ne pas ajouter le message ici - Socket.io s'en charge
        setNewMessage('');
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  // Check if user is leader or officer of their squad
  const isLeaderOrOfficer = () => {
    if (!mySquad || !user) return false;
    const member = mySquad.members?.find(m => 
      (m.user?._id || m.user) === user.id
    );
    return member?.role === 'leader' || member?.role === 'officer';
  };

  // Submit match result
  const handleSubmitResult = async (winnerId) => {
    if (!isLeaderOrOfficer()) return;
    
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
        // Dispatch event to update disputes count in Navbar
        window.dispatchEvent(new Event('disputeCreated'));
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error('Error submitting dispute:', err);
    } finally {
      setSubmittingDispute(false);
    }
  };

  // Request match cancellation
  const handleRequestCancel = async () => {
    setRequestingCancel(true);
    try {
      const response = await fetch(`${API_URL}/matches/${matchId}/cancel-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      const data = await response.json();
      if (data.success) {
        setMatch(data.match);
        setShowCancelModal(false);
        
        // Si le match est annulé (les deux équipes ont confirmé), rediriger vers l'accueil du mode
        if (data.cancelled) {
          const redirectPath = isHardcore ? '/hardcore' : '/cdl';
          navigate(redirectPath);
        }
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error('Error requesting cancellation:', err);
    } finally {
      setRequestingCancel(false);
    }
  };

  // Check if my team has already requested cancellation
  const hasMyTeamRequestedCancel = () => {
    if (!mySquad || !match?.cancelRequests) return false;
    return match.cancelRequests.some(r => 
      (r.squad?._id || r.squad)?.toString() === mySquad._id?.toString()
    );
  };

  // Check if opponent has requested cancellation
  const hasOpponentRequestedCancel = () => {
    if (!mySquad || !match?.cancelRequests) return false;
    const mySquadId = mySquad._id?.toString();
    return match.cancelRequests.some(r => {
      const squadId = (r.squad?._id || r.squad)?.toString();
      return squadId !== mySquadId;
    });
  };

  // Staff: Resolve dispute by giving victory
  const handleStaffResolveVictory = async (winnerId) => {
    setStaffActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/matches/${matchId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ winnerId, resolution: 'Victoire attribuée par le staff' })
      });

      const data = await response.json();
      if (data.success) {
        setMatch(data.match);
        setShowStaffVictoryModal(false);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error('Error resolving dispute:', err);
    } finally {
      setStaffActionLoading(false);
    }
  };

  // Staff: Cancel disputed match
  const handleStaffCancelMatch = async () => {
    if (!confirm(language === 'fr' ? 'Êtes-vous sûr de vouloir annuler ce match ?' : 'Are you sure you want to cancel this match?')) return;
    
    setStaffActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/matches/${matchId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ winnerId: null, resolution: 'Match annulé par le staff', cancel: true })
      });

      const data = await response.json();
      if (data.success) {
        setMatch(data.match);
        const redirectPath = isHardcore ? '/hardcore' : '/cdl';
        navigate(redirectPath);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error('Error cancelling match:', err);
    } finally {
      setStaffActionLoading(false);
    }
  };

  // Upload evidence for dispute
  const handleUploadEvidence = async (file) => {
    if (!file) return;
    
    // Validate file
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert(language === 'fr' ? 'Type de fichier non autorisé. Seuls les images sont acceptées.' : 'File type not allowed. Only images are accepted.');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      alert(language === 'fr' ? 'Fichier trop volumineux (max 5 Mo)' : 'File too large (max 5 MB)');
      return;
    }
    
    setUploadingEvidence(true);
    try {
      const formData = new FormData();
      formData.append('evidence', file);
      formData.append('description', evidenceDescription);
      
      const response = await fetch(`${API_URL}/matches/${matchId}/dispute-evidence`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        setMatch(data.match);
        setEvidenceDescription('');
        if (evidenceInputRef.current) {
          evidenceInputRef.current.value = '';
        }
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error('Error uploading evidence:', err);
      alert(language === 'fr' ? 'Erreur lors de l\'upload' : 'Upload error');
    } finally {
      setUploadingEvidence(false);
    }
  };

  // Handle file drop
  const handleEvidenceDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      handleUploadEvidence(file);
    }
  };

  // Handle file select
  const handleEvidenceSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadEvidence(file);
    }
  };

  // Get my team's evidence count
  const getMyEvidenceCount = () => {
    if (!mySquad || !match?.dispute?.evidence) return 0;
    return match.dispute.evidence.filter(e => 
      e.squad?._id?.toString() === mySquad._id?.toString() ||
      e.squad?.toString() === mySquad._id?.toString()
    ).length;
  };

  // Translate system message
  const getSystemMessage = (msg) => {
    // If it's a new format with messageType
    if (msg.messageType && t.systemMessages?.[msg.messageType]) {
      return t.systemMessages[msg.messageType](msg.messageParams || {});
    }
    // Fallback to old format (plain message string)
    return msg.message || '';
  };

  // Staff: Remove dispute (put match back in progress)
  const handleStaffRemoveDispute = async () => {
    if (!confirm(language === 'fr' ? 'Êtes-vous sûr de vouloir retirer le litige ?' : 'Are you sure you want to remove the dispute?')) return;
    
    setStaffActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/matches/${matchId}/cancel-dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      const data = await response.json();
      if (data.success) {
        setMatch(data.match);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error('Error removing dispute:', err);
    } finally {
      setStaffActionLoading(false);
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
    if (!ladderData || !mySquad || !rewardsConfig) return null;
    
    const currentRank = getCurrentRank();
    const myLadderData = mySquad.registeredLadders?.find(l => l.ladderId === match?.ladderId);
    const currentPoints = myLadderData?.points || 0;
    const pointsChange = isWin ? (rewardsConfig.playerPointsWin || 20) : -(rewardsConfig.playerPointsLoss || 10);
    const newPoints = Math.max(0, currentPoints + pointsChange);
    
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
              {/* Team Form - Last 5 matches */}
              {challengerForm.length > 0 && (
                <div className="flex items-center justify-center gap-1 mt-2">
                  <span className="text-gray-500 text-[10px] mr-1">{language === 'fr' ? 'Forme:' : 'Form:'}</span>
                  {challengerForm.map((m, idx) => (
                    <div
                      key={idx}
                      className={`w-4 h-4 sm:w-5 sm:h-5 rounded text-[10px] sm:text-xs font-bold flex items-center justify-center ${
                        m.isWin 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}
                      title={m.opponentName}
                    >
                      {m.isWin ? 'V' : 'D'}
                    </div>
                  ))}
                </div>
              )}
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
                    {match.opponent?.tag && (
                      <span className="text-gray-500 text-xs sm:text-sm hidden sm:inline">[{match.opponent.tag}]</span>
                    )}
                  </Link>
                  {/* Team Form - Last 5 matches */}
                  {opponentForm.length > 0 && (
                    <div className="flex items-center justify-center gap-1 mt-2">
                      <span className="text-gray-500 text-[10px] mr-1">{language === 'fr' ? 'Forme:' : 'Form:'}</span>
                      {opponentForm.map((m, idx) => (
                        <div
                          key={idx}
                          className={`w-4 h-4 sm:w-5 sm:h-5 rounded text-[10px] sm:text-xs font-bold flex items-center justify-center ${
                            m.isWin 
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}
                          title={m.opponentName}
                        >
                          {m.isWin ? 'V' : 'D'}
                        </div>
                      ))}
                    </div>
                  )}
                </>
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
                    {t.gameModes?.[match.gameMode] || match.gameMode}
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

            {/* Rewards Display */}
            {rewardsConfig && match.status !== 'completed' && (
              <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-${accentColor}-500/20 p-4 mb-4`}>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Trophy className={`w-4 h-4 text-${accentColor}-400`} />
                  {language === 'fr' ? 'Enjeux du match' : 'Match Stakes'}
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded bg-${accentColor}-500/20 text-${accentColor}-400`}>
                    {match.ladderId === 'duo-trio' ? 'Chill' : 'Compétitif'}
                  </span>
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Si victoire */}
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-green-400 text-xs font-semibold mb-3 uppercase border-b border-green-500/20 pb-2">
                      {language === 'fr' ? '🏆 Victoire' : '🏆 Victory'}
                    </p>
                    <div className="space-y-2">
                      {/* Escouade - Ladder */}
                      <div className="pb-2 border-b border-white/5">
                        <p className="text-gray-500 text-[10px] uppercase mb-1">{language === 'fr' ? 'Escouade' : 'Squad'}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-xs">Ladder {match.ladderId === 'duo-trio' ? 'Chill' : 'Comp'}</span>
                          <span className="text-green-400 text-sm font-bold">+{rewardsConfig.ladderPointsWin} pts</span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-gray-400 text-xs">{language === 'fr' ? 'Top Général' : 'General Top'}</span>
                          <span className="text-green-400 text-sm font-bold">+{rewardsConfig.generalSquadPointsWin} pts</span>
                        </div>
                      </div>
                      {/* Joueur */}
                      <div>
                        <p className="text-gray-500 text-[10px] uppercase mb-1">{language === 'fr' ? 'Joueur' : 'Player'}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-xs">Gold</span>
                          <span className="text-yellow-400 text-sm font-bold flex items-center gap-1">
                            <Coins className="w-3 h-3" />+{rewardsConfig.playerCoinsWin}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-gray-400 text-xs">XP</span>
                          <span className="text-cyan-400 text-sm font-bold flex items-center gap-1">
                            <Zap className="w-3 h-3" />+{rewardsConfig.playerXPWinMin}-{rewardsConfig.playerXPWinMax}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Si défaite */}
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-red-400 text-xs font-semibold mb-3 uppercase border-b border-red-500/20 pb-2">
                      {language === 'fr' ? '💔 Défaite' : '💔 Defeat'}
                    </p>
                    <div className="space-y-2">
                      {/* Escouade - Ladder */}
                      <div className="pb-2 border-b border-white/5">
                        <p className="text-gray-500 text-[10px] uppercase mb-1">{language === 'fr' ? 'Escouade' : 'Squad'}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-xs">Ladder {match.ladderId === 'duo-trio' ? 'Chill' : 'Comp'}</span>
                          <span className="text-red-400 text-sm font-bold">-{rewardsConfig.ladderPointsLoss} pts</span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-gray-400 text-xs">{language === 'fr' ? 'Top Général' : 'General Top'}</span>
                          <span className="text-red-400 text-sm font-bold">-{rewardsConfig.generalSquadPointsLoss} pts</span>
                        </div>
                      </div>
                      {/* Joueur */}
                      <div>
                        <p className="text-gray-500 text-[10px] uppercase mb-1">{language === 'fr' ? 'Joueur' : 'Player'}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-xs">Gold</span>
                          <span className="text-yellow-400 text-sm font-bold flex items-center gap-1">
                            <Coins className="w-3 h-3" />+{rewardsConfig.playerCoinsLoss}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-gray-400 text-xs">XP</span>
                          <span className="text-gray-500 text-sm">—</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Host Team Display */}
            {match.hostTeam && match.opponent && (
              <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-yellow-500/20 p-4 mb-4`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                    <Home className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-yellow-400 text-xs font-medium uppercase">{t.hostTeam}</p>
                    <p className="text-white font-semibold">{match.hostTeam.name || match.hostTeam.tag}</p>
                  </div>
                  {isMyTeamHost() && (
                    <span className="ml-auto px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                      {t.youAreHost}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Random Maps Display */}
            {match.mapType === 'random' && match.randomMaps?.length > 0 && (
              <div className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border border-purple-500/20 p-4 mb-4`}>
                <h3 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2">
                  <Map className="w-4 h-4" />
                  {t.randomMaps}
                </h3>
                <div className="space-y-2">
                  {match.randomMaps.map((map, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 bg-dark-800/50 rounded-lg border border-white/5">
                      {map.image ? (
                        <img src={map.image} alt={map.name} className="w-12 h-8 rounded object-cover" />
                      ) : (
                        <div className="w-12 h-8 rounded bg-purple-500/20 flex items-center justify-center">
                          <Map className="w-4 h-4 text-purple-400" />
                        </div>
                      )}
                      <div>
                        <span className="text-purple-400 text-xs">#{map.order}</span>
                        <p className="text-white text-sm font-medium">{map.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Match Actions - Only for participants, leaders/officers, and active matches */}
            {isParticipant && match.opponent && (match.status === 'accepted' || match.status === 'in_progress') && isLeaderOrOfficer() && (
              <div className="space-y-2">
                {/* Sélectionner le gagnant */}
                <button
                  onClick={() => setShowResultModal(true)}
                  className={`w-full py-2.5 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2`}
                >
                  <Trophy className="w-4 h-4" />
                  {t.selectWinner}
                </button>

                {/* Signaler un litige */}
                <button
                  onClick={() => setShowDisputeModal(true)}
                  className="w-full py-2.5 bg-orange-500/10 border border-orange-500/30 rounded-lg text-orange-400 text-sm font-medium hover:bg-orange-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                  {t.reportDispute}
                </button>

                {/* Cancel Request Button */}
                {hasMyTeamRequestedCancel() ? (
                  <div className="flex items-center justify-center gap-2 py-2 px-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-orange-400 text-sm">
                    <Ban className="w-4 h-4" />
                    <span>{t.cancelRequested}</span>
                    {!hasOpponentRequestedCancel() && (
                      <span className="text-xs opacity-70">• {t.waitingOpponentCancel}</span>
                    )}
                  </div>
                ) : hasOpponentRequestedCancel() ? (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="w-full py-2.5 bg-orange-500/20 border border-orange-500/30 rounded-lg text-orange-400 text-sm font-medium hover:bg-orange-500/30 transition-all flex items-center justify-center gap-2"
                  >
                    <Ban className="w-4 h-4" />
                    <span>{t.cancelMatch}</span>
                    <span className="text-xs bg-orange-500/30 px-2 py-0.5 rounded-full animate-pulse">
                      {language === 'fr' ? 'L\'adversaire attend' : 'Opponent waiting'}
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="w-full py-2 bg-dark-800/50 border border-white/10 rounded-lg text-gray-400 text-sm hover:bg-dark-700/50 hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <Ban className="w-4 h-4" />
                    {t.requestCancel}
                  </button>
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

                {/* Staff Actions */}
                {isStaff && (
                  <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <h3 className="text-sm font-bold text-yellow-400 mb-3 flex items-center gap-2">
                      <Crown className="w-4 h-4" />
                      {t.staffActions}
                    </h3>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={() => setShowStaffVictoryModal(true)}
                        disabled={staffActionLoading}
                        className="w-full py-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm font-medium hover:bg-green-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Trophy className="w-4 h-4" />
                        {t.giveVictory}
                      </button>
                      <button
                        onClick={handleStaffRemoveDispute}
                        disabled={staffActionLoading}
                        className="w-full py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {t.removeDispute}
                      </button>
                      <button
                        onClick={handleStaffCancelMatch}
                        disabled={staffActionLoading}
                        className="w-full py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm font-medium hover:bg-red-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Ban className="w-4 h-4" />
                        {t.cancelMatch}
                      </button>
                    </div>
                  </div>
                )}
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
                {/* Warning Message */}
                <div className="mb-3 px-3 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg text-xs text-orange-400 text-center">
                  ⚠️ {language === 'fr' 
                    ? 'Rappel : Tout débordement, insulte ou comportement toxique peut entraîner des sanctions graves (ban temporaire ou permanent).' 
                    : language === 'de'
                      ? 'Erinnerung: Jegliche Beleidigungen oder toxisches Verhalten kann zu schweren Sanktionen führen (temporäre oder permanente Sperre).'
                      : language === 'it'
                        ? 'Promemoria: Qualsiasi insulto o comportamento tossico può comportare sanzioni gravi (ban temporaneo o permanente).'
                        : 'Reminder: Any insults or toxic behavior may result in severe sanctions (temporary or permanent ban).'}
                </div>
                
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-600 text-sm">💬</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {messages.map((msg, index) => {
                      // System messages
                      if (msg.isSystem) {
                        return (
                          <div key={index} className="flex justify-center">
                            <div className="px-3 py-1.5 bg-dark-800/50 border border-white/10 rounded-lg text-xs text-gray-400 text-center max-w-[90%]">
                              {getSystemMessage(msg)}
                              <span className="text-gray-600 ml-2 text-[10px]">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      
                      // Regular user messages
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

            {/* Evidence Section - Horizontal above rosters (only for disputed matches) */}
            {match.status === 'disputed' && (
              <div className="p-4 bg-dark-900/80 backdrop-blur-xl rounded-xl border border-orange-500/20">
                <h3 className="text-sm font-bold text-orange-400 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {t.evidence}
                </h3>
                
                {/* Horizontal scrollable evidence gallery */}
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-orange-500/30 scrollbar-track-transparent">
                  {/* Existing Evidence */}
                  {match.dispute?.evidence?.map((ev, idx) => (
                    <div 
                      key={ev._id || idx}
                      className="flex-shrink-0 relative group rounded-lg overflow-hidden border border-white/10 bg-dark-800/50 w-32"
                    >
                      <img 
                        src={`https://api-nomercy.ggsecure.io${ev.imageUrl}`}
                        alt={`Evidence ${idx + 1}`}
                        className="w-32 h-24 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => window.open(`https://api-nomercy.ggsecure.io${ev.imageUrl}`, '_blank')}
                      />
                      <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/90 to-transparent">
                        <p className="text-[10px] text-gray-300 truncate">
                          {ev.uploadedBy?.username || 'Unknown'}
                          {ev.squad && <span className="text-orange-400 ml-1">[{ev.squad.tag || ev.squad.name}]</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  {/* Upload button for participants */}
                  {isParticipant && getMyEvidenceCount() < 5 && (
                    <div 
                      onClick={() => !uploadingEvidence && evidenceInputRef.current?.click()}
                      className={`flex-shrink-0 w-32 h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all
                        ${uploadingEvidence 
                          ? 'border-orange-500/50 bg-orange-500/10' 
                          : 'border-white/20 hover:border-orange-500/50 hover:bg-orange-500/5'
                        }`}
                    >
                      <input
                        ref={evidenceInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                        onChange={handleEvidenceSelect}
                        className="hidden"
                        disabled={uploadingEvidence}
                      />
                      {uploadingEvidence ? (
                        <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
                      ) : (
                        <>
                          <svg className="w-6 h-6 text-gray-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                          </svg>
                          <span className="text-gray-500 text-[10px]">{t.uploadEvidence}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                
                {isParticipant && getMyEvidenceCount() >= 5 && (
                  <p className="text-orange-400 text-xs mt-2">{t.maxEvidenceReached}</p>
                )}
              </div>
            )}

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
                      // Utiliser le username sauvegardé si le compte est supprimé
                      const displayName = player?.username || p.username || (language === 'fr' ? 'Joueur supprimé' : 'Deleted player');
                      const isDeleted = !player;
                      const avatar = player ? (getAvatarUrl(player.avatarUrl || player.avatar) || (player.discordAvatar ? `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png` : getDefaultAvatar(player.username))) : getDefaultAvatar(displayName);
                      return (
                        <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg ${p.isHelper ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-dark-800/50'}`}>
                          <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                          <div className="flex-1 min-w-0">
                            {isDeleted ? (
                              <span className="text-gray-400 text-sm font-medium truncate block italic">
                                {displayName}
                              </span>
                            ) : (
                              <Link 
                                to={`/player/${player._id}`} 
                                className="text-white text-sm font-medium truncate hover:text-cyan-400 transition-colors cursor-pointer block"
                              >
                                {displayName}
                              </Link>
                            )}
                            {player?.activisionId && <p className="text-gray-500 text-xs truncate">{player.activisionId}</p>}
                          </div>
                          <div className="flex items-center gap-1">
                            {player?.platform === 'PC' && (
                              <span 
                                className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                  ggsecureStatuses[player._id] === true 
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                    : ggsecureStatuses[player._id] === false
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    : 'bg-blue-500/20 text-blue-400'
                                }`}
                                title={ggsecureStatuses[player._id] === true ? 'GGSecure Online' : ggsecureStatuses[player._id] === false ? 'GGSecure Offline' : 'PC Player'}
                              >
                                {ggsecureStatuses[player._id] !== undefined && (
                                  <span className={`w-1.5 h-1.5 rounded-full ${ggsecureStatuses[player._id] ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                                )}
                                PC
                              </span>
                            )}
                            {player?.platform && player.platform !== 'PC' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
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
                        // Utiliser le username sauvegardé si le compte est supprimé
                        const displayName = player?.username || p.username || (language === 'fr' ? 'Joueur supprimé' : 'Deleted player');
                        const isDeleted = !player;
                        const avatar = player ? (getAvatarUrl(player.avatarUrl || player.avatar) || (player.discordAvatar ? `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png` : getDefaultAvatar(player.username))) : getDefaultAvatar(displayName);
                        return (
                          <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg ${p.isHelper ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-dark-800/50'}`}>
                            <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                            <div className="flex-1 min-w-0">
                              {isDeleted ? (
                                <span className="text-gray-400 text-sm font-medium truncate block italic">
                                  {displayName}
                                </span>
                              ) : (
                                <Link 
                                  to={`/player/${player._id}`} 
                                  className="text-white text-sm font-medium truncate hover:text-purple-400 transition-colors cursor-pointer block"
                                >
                                  {displayName}
                                </Link>
                              )}
                              {player?.activisionId && <p className="text-gray-500 text-xs truncate">{player.activisionId}</p>}
                            </div>
                            <div className="flex items-center gap-1">
                              {player?.platform === 'PC' && (
                                <span 
                                  className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                    ggsecureStatuses[player._id] === true 
                                      ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                      : ggsecureStatuses[player._id] === false
                                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                      : 'bg-blue-500/20 text-blue-400'
                                  }`}
                                  title={ggsecureStatuses[player._id] === true ? 'GGSecure Online' : ggsecureStatuses[player._id] === false ? 'GGSecure Offline' : 'PC Player'}
                                >
                                  {ggsecureStatuses[player._id] !== undefined && (
                                    <span className={`w-1.5 h-1.5 rounded-full ${ggsecureStatuses[player._id] ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                                  )}
                                  PC
                                </span>
                              )}
                              {player?.platform && player.platform !== 'PC' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
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

      {/* Cancel Request Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-dark-900 rounded-2xl border border-orange-500/30 p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Ban className="w-6 h-6 text-orange-400" />
              {t.requestCancel}
            </h3>
            
            <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <p className="text-orange-400 text-sm">{t.bothTeamsCancel}</p>
            </div>

            <p className="text-gray-300 text-sm mb-6">{t.cancelConfirm}</p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2.5 bg-dark-800 hover:bg-dark-700 border border-white/10 rounded-lg text-gray-400 font-medium transition-colors"
              >
                {language === 'fr' ? 'Retour' : 'Back'}
              </button>
              <button
                onClick={handleRequestCancel}
                disabled={requestingCancel}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 rounded-lg text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {requestingCancel ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Ban className="w-4 h-4" />
                    {hasOpponentRequestedCancel() ? (language === 'fr' ? 'Confirmer l\'annulation' : 'Confirm cancellation') : t.requestCancel}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Victory Modal */}
      {showStaffVictoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-dark-900 rounded-2xl border border-yellow-500/30 p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Crown className="w-6 h-6 text-yellow-400" />
              {t.giveVictory}
            </h3>
            
            <p className="text-gray-400 text-sm mb-4">{t.selectTeam}</p>

            <div className="space-y-3">
              {/* Challenger */}
              <button
                onClick={() => handleStaffResolveVictory(match.challenger?._id)}
                disabled={staffActionLoading}
                className="w-full p-4 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-xl text-left transition-all group disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {match.challenger?.logo ? (
                      <img src={match.challenger.logo} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-green-400" />
                      </div>
                    )}
                    <div>
                      <p className="text-white font-semibold">{match.challenger?.name}</p>
                      <p className="text-gray-500 text-xs">[{match.challenger?.tag}]</p>
                    </div>
                  </div>
                  <Trophy className="w-6 h-6 text-green-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>

              {/* Opponent */}
              <button
                onClick={() => handleStaffResolveVictory(match.opponent?._id)}
                disabled={staffActionLoading}
                className="w-full p-4 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-xl text-left transition-all group disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {match.opponent?.logo ? (
                      <img src={match.opponent.logo} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-green-400" />
                      </div>
                    )}
                    <div>
                      <p className="text-white font-semibold">{match.opponent?.name}</p>
                      <p className="text-gray-500 text-xs">[{match.opponent?.tag}]</p>
                    </div>
                  </div>
                  <Trophy className="w-6 h-6 text-green-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowStaffVictoryModal(false)}
              className="w-full mt-4 py-2 bg-dark-800 hover:bg-dark-700 border border-white/10 rounded-lg text-gray-400 text-sm transition-colors"
            >
              {language === 'fr' ? 'Annuler' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Combat Report Modal */}
      {showCombatReport && match?.result?.rewardsGiven && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <div className={`bg-dark-900 rounded-2xl border ${
            match.result.winner === mySquad?._id 
              ? 'border-green-500/50 shadow-lg shadow-green-500/20' 
              : 'border-red-500/50 shadow-lg shadow-red-500/20'
          } p-6 max-w-md w-full`}>
            {/* Header */}
            <div className="text-center mb-6">
              {match.result.winner === mySquad?._id ? (
                <>
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center animate-pulse">
                    <Trophy className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-green-400 mb-1">
                    {language === 'fr' ? 'VICTOIRE !' : 'VICTORY!'}
                  </h2>
                  <p className="text-gray-400">
                    {language === 'fr' ? 'Félicitations ! Voici vos gains :' : 'Congratulations! Here are your rewards:'}
                  </p>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                    <XCircle className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-red-400 mb-1">
                    {language === 'fr' ? 'DÉFAITE' : 'DEFEAT'}
                  </h2>
                  <p className="text-gray-400">
                    {language === 'fr' ? 'Ne baissez pas les bras ! Voici le bilan :' : 'Don\'t give up! Here\'s the summary:'}
                  </p>
                </>
              )}
            </div>

            {/* Rewards/Losses */}
            <div className="space-y-3 mb-6">
              {match.result.winner === mySquad?._id ? (
                <>
                  {/* Gold gagné */}
                  <div className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                    <span className="text-gray-300 flex items-center gap-2">
                      <Coins className="w-5 h-5 text-yellow-400" />
                      Gold
                    </span>
                    <span className="text-yellow-400 font-bold text-lg">+{match.result.rewardsGiven?.winners?.coins || 50}</span>
                  </div>
                  {/* XP gagnée */}
                  <div className="flex items-center justify-between p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
                    <span className="text-gray-300 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-cyan-400" />
                      XP
                    </span>
                    <span className="text-cyan-400 font-bold text-lg">
                      +{match.result.rewardsGiven?.winners?.xpGained?.[0]?.xp || '450-550'}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  {/* Gold de consolation */}
                  <div className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                    <span className="text-gray-300 flex items-center gap-2">
                      <Coins className="w-5 h-5 text-yellow-400" />
                      Gold ({language === 'fr' ? 'consolation' : 'consolation'})
                    </span>
                    <span className="text-yellow-400 font-bold text-lg">+{match.result.rewardsGiven?.losers?.coins || 25}</span>
                  </div>
                  {/* Pas d'XP */}
                  <div className="flex items-center justify-between p-3 bg-gray-500/10 border border-gray-500/20 rounded-xl">
                    <span className="text-gray-400 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-gray-500" />
                      XP
                    </span>
                    <span className="text-gray-500 font-medium">—</span>
                  </div>
                </>
              )}
            </div>

            {/* Squad stats */}
            <div className="p-3 bg-dark-800/50 border border-white/10 rounded-xl mb-4">
              <p className="text-gray-500 text-xs uppercase mb-2">{language === 'fr' ? 'Escouade' : 'Squad'}</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Ladder</span>
                <span className={match.result.winner === mySquad?._id ? 'text-green-400' : 'text-red-400'}>
                  {match.result.winner === mySquad?._id 
                    ? `+${match.result.rewardsGiven.squad.ladderPointsWin}` 
                    : `-${match.result.rewardsGiven.squad.ladderPointsLoss}`} pts
                </span>
              </div>
            </div>

            {/* Dispute button */}
            <button
              onClick={() => {
                setShowCombatReport(false);
                setShowDisputeModal(true);
              }}
              className="w-full py-2.5 mb-3 rounded-xl font-medium text-orange-400 bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20 transition-all flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              {language === 'fr' ? 'Signaler un litige' : 'Report a dispute'}
            </button>

            {/* Close button */}
            <button
              onClick={async () => {
                setShowCombatReport(false);
                // Rafraîchir les données utilisateur pour mettre à jour le gold dans la navbar
                await refreshUser();
                // Rediriger vers l'accueil du mode
                const redirectPath = match.mode === 'hardcore' ? '/hardcore' : '/cdl';
                navigate(redirectPath);
              }}
              className={`w-full py-3 rounded-xl font-bold text-white transition-all ${
                match.result.winner === mySquad?._id 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700' 
                  : 'bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700'
              }`}
            >
              {language === 'fr' ? 'Continuer' : 'Continue'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchSheet;

