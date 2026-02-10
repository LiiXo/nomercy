import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useAuth } from '../AuthContext';
import { useSocket } from '../SocketContext';
import { useData } from '../DataContext';
import { getDefaultAvatar, getAvatarUrl } from '../utils/avatar';
import { Trophy, Users, Medal, Target, Crown, Clock, MapPin, Shuffle, Play, X, Coins, Loader2, Shield, Plus, Swords, AlertTriangle, Check, Zap, Eye, UserCheck, Ban, ChevronRight, Lock, Star } from 'lucide-react';

import { API_URL } from '../config';

// Countdown component - defined outside to prevent re-creation
const ReadyCountdown = ({ createdAt, onExpire }) => {
  const [remaining, setRemaining] = useState(() => {
    if (!createdAt) return 0;
    const created = new Date(createdAt);
    if (isNaN(created.getTime())) return 0;
    const expiresAt = new Date(created.getTime() + 10 * 60 * 1000);
    return Math.max(0, Math.floor((expiresAt - new Date()) / 1000));
  });

  useEffect(() => {
    if (!createdAt) return;
    const interval = setInterval(() => {
      const created = new Date(createdAt);
      if (isNaN(created.getTime())) {
        setRemaining(0);
        return;
      }
      const expiresAt = new Date(created.getTime() + 10 * 60 * 1000);
      const newRemaining = Math.max(0, Math.floor((expiresAt - new Date()) / 1000));
      setRemaining(newRemaining);
      if (newRemaining === 0 && onExpire) onExpire();
    }, 1000);
    return () => clearInterval(interval);
  }, [createdAt, onExpire]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse" />
      <span className="text-neon-green text-sm font-bold">GO</span>
      <span className={`text-xs ${remaining < 60 ? 'text-red-400' : 'text-gray-400'}`}>
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
};

const CDLDashboard = () => {
  const { language, t } = useLanguage();
  const { isAuthenticated, user } = useAuth();
  const { on, off, joinPage, leavePage, modeOnlineUsers, joinMode, leaveMode } = useSocket();
  const navigate = useNavigate();
  const { 
    appSettings, 
    ladderRewards, 
    getGoldCoinsForLadder,
    isDuoTrioOpen: duoTrioOpenFromContext,
    isStrickerModeEnabled
  } = useData();
  
  // CDL-specific top player and squad (separate from hardcore)
  const [topPlayer, setTopPlayer] = useState(null);
  const [topSquad, setTopSquad] = useState(null);
  const [mvpLeader, setMvpLeader] = useState(null);
  
  // Ranked matches stats for the banner
  const [rankedMatchesStats, setRankedMatchesStats] = useState({ totalMatches: 0, totalPlayers: 0, stats: [] });
  
  // Stricker matches stats for the banner
  const [strickerMatchesStats, setStrickerMatchesStats] = useState({ totalMatches: 0, totalPlayers: 0, stats: [] });
  
  // Site statistics
  const [siteStats, setSiteStats] = useState({ totalUsers: 0, totalSquads: 0, totalMatches: 0, avgMatchesPerDay: 0 });
  
  // Check if user is admin or staff (can bypass disabled features)
  const isAdminOrStaff = user?.roles?.some(r => ['admin', 'staff', 'gerant_cdl', 'gerant_hardcore'].includes(r));

  // Memoized translations to prevent recreation on every render
  const txt = useMemo(() => ({
    fr: {
      matchmaking: 'Matchmaking',
      matches: 'matchs',
      postMatch: 'Poster un match',
      close: 'Fermer',
      readyNow: 'Prêt maintenant',
      schedule: 'Planifier',
      ladder: 'Classement',
      gameMode: 'Mode de jeu',
      map: 'Map',
      random: 'Aléatoire',
      free: 'Libre',
      status: 'Statut',
      dateTime: 'Date & Heure',
      instantMatch: 'Match instantané',
      findOpponent: 'Chercher un adversaire',
      scheduleMatch: 'Planifier le match',
      duoTrio: 'Chill',
      squadTeam: 'Compétitif',
      yourMatch: 'Votre match',
      cancel: 'Annuler',
      notRegistered: 'Non inscrit',
      play: 'JOUER',
      go: 'GO',
      expiresIn: 'Expire dans',
      startsAt: 'Début à',
      inProgress: 'En cours',
      viewMatch: 'Voir',
      myActiveMatches: 'Mes matchs en cours',
      noMatches: 'Aucun match disponible',
      filters: 'Filtres',
      selectAll: 'Tout',
      clearAll: 'Aucun',
      top10Players: 'Top 10 Joueurs',
      top10Teams: 'Top 10 Équipes',
      viewAll: 'Voir tout',
      tournaments: 'Tournois',
      live: 'EN DIRECT',
      filling: 'Inscription',
      full: 'Complet',
      players: 'joueurs',
      prize: 'Prix',
      seeAll: 'Voir tous',
      coins: 'pièces',
      selectRoster: 'Sélectionner le roster',
      selectPlayers: 'Cochez les membres qui jouent',
      rosterPlayers: 'Joueurs',
      helper: 'Aide externe',
      searchHelper: 'Rechercher un joueur externe',
      searchPlaceholder: 'Entrez un pseudo...',
      noResults: 'Aucun joueur trouvé',
      addAsHelper: 'Ajouter comme aide',
      confirm: 'Confirmer',
      platform: 'Plateforme',
      activisionId: 'ID Activision',
      pc: 'PC',
      console: 'Console',
      squadMembers: 'Membres de l\'escouade',
      rematchCooldown: '⏱️ Délai de rematch non respecté ! Vous avez déjà affronté cette équipe récemment. Vous pourrez les affronter à nouveau dans',
      hourUnit: 'h',
      minuteUnit: 'min',
      openHours: '✓ Ouvert • 00h00 - 20h00',
      closedHours: '✗ Fermé • 00h00 - 20h00',
      matchesInProgress: 'match(s) en cours',
      inLadder: 'dans le classement',
      totalPlayers: 'Joueurs',
      totalMatches: 'Matchs',
      totalSquads: 'Escouades',
      avgMatchesPerDay: 'Matchs/jour',
      siteStatistics: 'Statistiques du site',
      waitingHelperConfirmation: 'En attente de confirmation de l\'aide...',
      helperAccepted: 'L\'aide a accepté !',
      helperDeclined: 'L\'aide a refusé de jouer.',
      helperTimeout: 'L\'aide n\'a pas répondu à temps.',
      secondsLeft: 's restantes',
      newSquad: 'Nouvelle équipe',
      newSquadWarning: '⚠️ Équipe récente',
      viewRoster: 'Voir le roster',
      newSquadApprovalTitle: 'Demande de match - Nouvelle équipe',
      newSquadApprovalDesc: 'Une nouvelle équipe souhaite accepter votre match. Cette équipe a moins de 3 jours et moins de 3 matchs joués.',
      acceptMatch: 'Accepter le match',
      rejectMatch: 'Refuser',
      waitingApproval: 'En attente d\'approbation...',
      approvalTimeout: 'L\'équipe adverse n\'a pas répondu à temps',
      approvalRejected: 'L\'équipe adverse a refusé le match',
      teamCreatedOn: 'Équipe créée le',
    },
    en: {
      matchmaking: 'Matchmaking',
      matches: 'matches',
      postMatch: 'Post a match',
      close: 'Close',
      readyNow: 'Ready now',
      schedule: 'Schedule',
      ladder: 'Ladder',
      gameMode: 'Game mode',
      map: 'Map',
      random: 'Random',
      free: 'Free',
      status: 'Status',
      dateTime: 'Date & Time',
      instantMatch: 'Instant match',
      findOpponent: 'Find opponent',
      scheduleMatch: 'Schedule match',
      duoTrio: 'Chill',
      squadTeam: 'Compétitif',
      yourMatch: 'Your match',
      cancel: 'Cancel',
      notRegistered: 'Not registered',
      play: 'PLAY',
      go: 'GO',
      expiresIn: 'Expires in',
      startsAt: 'Starts at',
      inProgress: 'In progress',
      viewMatch: 'View',
      myActiveMatches: 'My active matches',
      noMatches: 'No matches available',
      filters: 'Filters',
      selectAll: 'All',
      clearAll: 'None',
      top10Players: 'Top 10 Players',
      top10Teams: 'Top 10 Teams',
      viewAll: 'View all',
      tournaments: 'Tournaments',
      live: 'LIVE',
      filling: 'Filling',
      full: 'Full',
      players: 'players',
      prize: 'Prize',
      seeAll: 'See all',
      coins: 'coins',
      selectRoster: 'Select Roster',
      selectPlayers: 'Check the members who are playing',
      rosterPlayers: 'Players',
      helper: 'External helper',
      searchHelper: 'Search for external player',
      searchPlaceholder: 'Enter username...',
      noResults: 'No player found',
      addAsHelper: 'Add as helper',
      confirm: 'Confirm',
      platform: 'Platform',
      activisionId: 'Activision ID',
      pc: 'PC',
      console: 'Console',
      squadMembers: 'Squad members',
      rematchCooldown: '⏱️ Rematch cooldown not met! You already faced this team recently. You can face them again in',
      hourUnit: 'h',
      minuteUnit: 'min',
      openHours: '✓ Open • 00:00 - 20:00',
      closedHours: '✗ Closed • 00:00 - 20:00',
      matchesInProgress: 'match(es) in progress',
      inLadder: 'in the',
      totalPlayers: 'Players',
      totalMatches: 'Matches',
      totalSquads: 'Squads',
      avgMatchesPerDay: 'Matches/day',
      siteStatistics: 'Site Statistics',
      waitingHelperConfirmation: 'Waiting for helper confirmation...',
      helperAccepted: 'Helper accepted!',
      helperDeclined: 'Helper declined to play.',
      helperTimeout: 'Helper did not respond in time.',
      secondsLeft: 's left',
      newSquad: 'New team',
      newSquadWarning: '⚠️ Recent team',
      viewRoster: 'View roster',
      newSquadApprovalTitle: 'Match request - New team',
      newSquadApprovalDesc: 'A new team wants to accept your match. This team is less than 3 days old and has less than 3 matches played.',
      acceptMatch: 'Accept match',
      rejectMatch: 'Reject',
      waitingApproval: 'Waiting for approval...',
      approvalTimeout: 'The other team did not respond in time',
      approvalRejected: 'The other team rejected the match',
      teamCreatedOn: 'Team created on',
    },
    de: {
      matchmaking: 'Matchmaking',
      matches: 'Spiele',
      postMatch: 'Spiel posten',
      close: 'Schließen',
      readyNow: 'Jetzt bereit',
      schedule: 'Planen',
      ladder: 'Rangliste',
      gameMode: 'Spielmodus',
      map: 'Karte',
      random: 'Zufällig',
      free: 'Frei',
      status: 'Status',
      dateTime: 'Datum & Zeit',
      instantMatch: 'Sofortiges Spiel',
      findOpponent: 'Gegner finden',
      scheduleMatch: 'Spiel planen',
      duoTrio: 'Chill',
      squadTeam: 'Compétitif',
      yourMatch: 'Dein Spiel',
      cancel: 'Abbrechen',
      notRegistered: 'Nicht registriert',
      play: 'SPIELEN',
      go: 'LOS',
      expiresIn: 'Läuft ab in',
      startsAt: 'Startet um',
      inProgress: 'Läuft',
      viewMatch: 'Ansehen',
      myActiveMatches: 'Meine aktiven Spiele',
      noMatches: 'Keine Spiele verfügbar',
      filters: 'Filter',
      selectAll: 'Alle',
      clearAll: 'Keine',
      top10Players: 'Top 10 Spieler',
      top10Teams: 'Top 10 Teams',
      viewAll: 'Alle ansehen',
      tournaments: 'Turniere',
      live: 'LIVE',
      filling: 'Anmeldung',
      full: 'Voll',
      players: 'Spieler',
      prize: 'Preis',
      seeAll: 'Alle sehen',
      coins: 'Münzen',
      selectRoster: 'Roster auswählen',
      selectPlayers: 'Markiere die Mitglieder die spielen',
      rosterPlayers: 'Spieler',
      helper: 'Externer Helfer',
      searchHelper: 'Externen Spieler suchen',
      searchPlaceholder: 'Benutzername eingeben...',
      noResults: 'Kein Spieler gefunden',
      addAsHelper: 'Als Helfer hinzufügen',
      confirm: 'Bestätigen',
      platform: 'Plattform',
      activisionId: 'Activision-ID',
      pc: 'PC',
      console: 'Konsole',
      squadMembers: 'Squad-Mitglieder',
      rematchCooldown: '⏱️ Rematch-Abklingzeit nicht erfüllt!',
      hourUnit: ' Std.',
      minuteUnit: ' Min.',
      openHours: '✓ Geöffnet • 00:00 - 20:00',
      closedHours: '✗ Geschlossen • 00:00 - 20:00',
      matchesInProgress: 'Spiel(e) läuft',
      inLadder: 'in der Rangliste',
      totalPlayers: 'Spieler',
      totalMatches: 'Spiele',
      totalSquads: 'Squads',
      avgMatchesPerDay: 'Spiele/Tag',
      siteStatistics: 'Seitenstatistiken',
      waitingHelperConfirmation: 'Warte auf Helferbestätigung...',
      helperAccepted: 'Helfer hat akzeptiert!',
      helperDeclined: 'Helfer hat abgelehnt.',
      helperTimeout: 'Helfer hat nicht rechtzeitig geantwortet.',
      secondsLeft: 's verbleibend',
      newSquad: 'Neues Team',
      newSquadWarning: '⚠️ Neues Team',
      viewRoster: 'Roster ansehen',
      newSquadApprovalTitle: 'Spielanfrage - Neues Team',
      newSquadApprovalDesc: 'Ein neues Team möchte Ihr Spiel annehmen. Dieses Team ist weniger als 3 Tage alt und hat weniger als 3 Spiele gespielt.',
      acceptMatch: 'Spiel akzeptieren',
      rejectMatch: 'Ablehnen',
      waitingApproval: 'Warte auf Genehmigung...',
      approvalTimeout: 'Das andere Team hat nicht rechtzeitig geantwortet',
      approvalRejected: 'Das andere Team hat das Spiel abgelehnt',
      teamCreatedOn: 'Team erstellt am',
    },
    it: {
      matchmaking: 'Matchmaking',
      matches: 'partite',
      postMatch: 'Pubblica partita',
      close: 'Chiudi',
      readyNow: 'Pronto ora',
      schedule: 'Programma',
      ladder: 'Classifica',
      gameMode: 'Modalità',
      map: 'Mappa',
      random: 'Casuale',
      free: 'Libera',
      status: 'Stato',
      dateTime: 'Data e Ora',
      instantMatch: 'Partita istantanea',
      findOpponent: 'Trova avversario',
      scheduleMatch: 'Programma partita',
      duoTrio: 'Chill',
      squadTeam: 'Compétitif',
      yourMatch: 'La tua partita',
      cancel: 'Annulla',
      notRegistered: 'Non registrato',
      play: 'GIOCA',
      go: 'VAI',
      expiresIn: 'Scade tra',
      startsAt: 'Inizia alle',
      inProgress: 'In corso',
      viewMatch: 'Vedi',
      myActiveMatches: 'Le mie partite attive',
      noMatches: 'Nessuna partita disponibile',
      filters: 'Filtri',
      selectAll: 'Tutti',
      clearAll: 'Nessuno',
      top10Players: 'Top 10 Giocatori',
      top10Teams: 'Top 10 Squadre',
      viewAll: 'Vedi tutto',
      tournaments: 'Tornei',
      live: 'IN DIRETTA',
      filling: 'Iscrizione',
      full: 'Pieno',
      players: 'giocatori',
      prize: 'Premio',
      seeAll: 'Vedi tutti',
      coins: 'monete',
      selectRoster: 'Seleziona Roster',
      selectPlayers: 'Seleziona i membri che giocano',
      rosterPlayers: 'Giocatori',
      helper: 'Aiuto esterno',
      searchHelper: 'Cerca giocatore esterno',
      searchPlaceholder: 'Inserisci username...',
      noResults: 'Nessun giocatore trovato',
      addAsHelper: 'Aggiungi come aiuto',
      confirm: 'Conferma',
      platform: 'Piattaforma',
      activisionId: 'ID Activision',
      pc: 'PC',
      console: 'Console',
      squadMembers: 'Membri della squadra',
      rematchCooldown: '⏱️ Tempo di attesa non rispettato!',
      hourUnit: 'h',
      minuteUnit: 'min',
      openHours: '✓ Aperto • 00:00 - 20:00',
      closedHours: '✗ Chiuso • 00:00 - 20:00',
      matchesInProgress: 'partita(e) in corso',
      inLadder: 'nella classifica',
      totalPlayers: 'Giocatori',
      totalMatches: 'Partite',
      totalSquads: 'Squadre',
      avgMatchesPerDay: 'Partite/giorno',
      siteStatistics: 'Statistiche del sito',
      waitingHelperConfirmation: 'In attesa di conferma dell\'aiuto...',
      helperAccepted: 'L\'aiuto ha accettato!',
      helperDeclined: 'L\'aiuto ha rifiutato di giocare.',
      helperTimeout: 'L\'aiuto non ha risposto in tempo.',
      secondsLeft: 's rimanenti',
      newSquad: 'Nuova squadra',
      newSquadWarning: '⚠️ Squadra recente',
      viewRoster: 'Vedi roster',
      newSquadApprovalTitle: 'Richiesta partita - Nuova squadra',
      newSquadApprovalDesc: 'Una nuova squadra vuole accettare la tua partita. Questa squadra ha meno di 3 giorni e meno di 3 partite giocate.',
      acceptMatch: 'Accetta partita',
      rejectMatch: 'Rifiuta',
      waitingApproval: 'In attesa di approvazione...',
      approvalTimeout: 'L\'altra squadra non ha risposto in tempo',
      approvalRejected: 'L\'altra squadra ha rifiutato la partita',
      teamCreatedOn: 'Squadra creata il',
    },
  })[language] || {}, [language]);
  
  // Matchmaking states
  const [mySquad, setMySquad] = useState(null);
  const mySquadRef = useRef(null);
  const [squadTeamMatches, setSquadTeamMatches] = useState([]);
  const [duoTrioMatches, setDuoTrioMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [showPostMatch, setShowPostMatch] = useState(null);
  const [postingMatch, setPostingMatch] = useState(false);
  const [acceptingMatch, setAcceptingMatch] = useState(null);
  const [matchMessage, setMatchMessage] = useState({ type: '', text: '' });
  const [matchForm, setMatchForm] = useState({
    ladder: '',
    gameMode: 'Hardpoint',
    teamSize: 4,
    mapType: 'free'
  });
  const [inProgressCounts, setInProgressCounts] = useState({ 'squad-team': 0, 'duo-trio': 0, total: 0 });
  
  // Roster selection states
  const [showRosterDialog, setShowRosterDialog] = useState(null);
  const [selectedRoster, setSelectedRoster] = useState([]);
  const [selectedHelper, setSelectedHelper] = useState(null);
  const [helperSearch, setHelperSearch] = useState('');
  const [helperSearchResults, setHelperSearchResults] = useState([]);
  const [searchingHelper, setSearchingHelper] = useState(false);
  const [pendingMatchAction, setPendingMatchAction] = useState(null);
  const [rosterError, setRosterError] = useState('');
  const [checkingAnticheat, setCheckingAnticheat] = useState(false);
  
  // Helper confirmation states
  const [waitingHelperConfirmation, setWaitingHelperConfirmation] = useState(false);
  const [helperConfirmationId, setHelperConfirmationId] = useState(null);
  const [helperConfirmationTimeLeft, setHelperConfirmationTimeLeft] = useState(30);
  
  // New squad approval states (for match poster receiving request)
  const [newSquadApprovalRequest, setNewSquadApprovalRequest] = useState(null);
  const [newSquadApprovalTimeLeft, setNewSquadApprovalTimeLeft] = useState(30);
  const [respondingToApproval, setRespondingToApproval] = useState(false);
  
  // State for viewing a match's roster (for new squads)
  const [viewingRoster, setViewingRoster] = useState(null);
  
  // Note: L'approbation est gérée par l'API avec polling côté serveur
  
  const availableModes = ['cdlHP', 'cdlSND', 'cdlControl'];
  
  const [activeModes, setActiveModes] = useState(() => {
    const saved = localStorage.getItem('cdlMatchFilters');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return availableModes;
      }
    }
    return availableModes;
  });
  
  useEffect(() => {
    const titles = {
      fr: 'NoMercy - CDL',
      en: 'NoMercy - CDL',
      it: 'NoMercy - CDL',
      de: 'NoMercy - CDL',
    };
    document.title = titles[language] || titles.en;
  }, [language]);
  
  useEffect(() => {
    localStorage.setItem('cdlMatchFilters', JSON.stringify(activeModes));
  }, [activeModes]);

  // Fetch CDL-specific top player and top squad
  useEffect(() => {
    const fetchTopStats = async () => {
      try {
        const [playerRes, squadRes, mvpRes] = await Promise.all([
          fetch(`${API_URL}/rankings/top-player?mode=cdl`),
          fetch(`${API_URL}/rankings/top-squad?mode=cdl`),
          fetch(`${API_URL}/rankings/mvp-leader?mode=cdl`)
        ]);
        const [playerData, squadData, mvpData] = await Promise.all([playerRes.json(), squadRes.json(), mvpRes.json()]);
        
        if (playerData.success && playerData.player) {
          setTopPlayer(playerData.player);
        }
        if (squadData.success && squadData.squad) {
          setTopSquad(squadData.squad);
        }
        if (mvpData.success && mvpData.player) {
          setMvpLeader(mvpData.player);
        }
      } catch (err) {
        console.error('Error fetching CDL top stats:', err);
      }
    };
    fetchTopStats();
  }, []);

  // App settings and ladder rewards are now provided by DataContext

  const gameModeApiNames = {
    fr: { 'Hardpoint': 'Hardpoint', 'Search & Destroy': 'Recherche & Destruction', 'Control': 'Contrôle' },
    en: { 'Hardpoint': 'Hardpoint', 'Search & Destroy': 'Search & Destroy', 'Control': 'Control' },
  };

  const getGameModeName = (mode) => gameModeApiNames[language]?.[mode] || gameModeApiNames['en'][mode] || mode;

  // Fetch my squad
  useEffect(() => {
    const fetchMySquad = async () => {
      if (!isAuthenticated) return;
      try {
        const response = await fetch(`${API_URL}/squads/my-squad?mode=cdl`, { credentials: 'include' });
        const data = await response.json();
        if (data.success && data.squad) {
          setMySquad(data.squad);
          mySquadRef.current = data.squad;
        }
      } catch (err) {
        console.error('Error fetching squad:', err);
      }
    };
    fetchMySquad();
  }, [isAuthenticated]);

  // Fetch matches - parallel fetching for both ladders
  const fetchMatches = async (isInitial = false) => {
    if (isInitial) setLoadingMatches(true);
    try {
      const [squadRes, duoRes] = await Promise.all([
        fetch(`${API_URL}/matches/available/squad-team?mode=cdl`),
        fetch(`${API_URL}/matches/available/duo-trio?mode=cdl`)
      ]);
      const [squadData, duoData] = await Promise.all([squadRes.json(), duoRes.json()]);
      
      if (squadData.success) {
        setSquadTeamMatches(squadData.matches);
      }
      if (duoData.success) {
        setDuoTrioMatches(duoData.matches);
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
    } finally {
      if (isInitial) setLoadingMatches(false);
    }
  };

  // Fetch in-progress matches count
  const fetchInProgressCounts = async () => {
    try {
      const response = await fetch(`${API_URL}/matches/in-progress/count?mode=cdl`);
      const data = await response.json();
      if (data.success) {
        setInProgressCounts(data.counts);
      }
    } catch (err) {
      console.error('Error fetching in-progress counts:', err);
    }
  };

  // Fetch ranked matches stats for the banner
  const fetchRankedMatchesStats = async () => {
    try {
      const response = await fetch(`${API_URL}/ranked-matches/active-matches/stats?mode=cdl`);
      const data = await response.json();
      if (data.success) {
        // Calculate total players based on format (4v4 = 8 players, 5v5 = 10 players, etc.)
        let totalPlayers = 0;
        data.stats?.forEach(stat => {
          stat.formats?.forEach(fmt => {
            const teamSize = parseInt(fmt.format.split('v')[0]) || 4;
            totalPlayers += fmt.count * teamSize * 2; // 2 teams per match
          });
        });
        setRankedMatchesStats({
          totalMatches: data.totalMatches || 0,
          totalPlayers,
          stats: data.stats || []
        });
      }
    } catch (err) {
      console.error('Error fetching ranked matches stats:', err);
    }
  };

  // Fetch site statistics
  const fetchSiteStats = async () => {
    try {
      const response = await fetch(`${API_URL}/system/stats`);
      const data = await response.json();
      if (data.success) {
        setSiteStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching site stats:', err);
    }
  };

  // Fetch Stricker matches stats for the banner
  const fetchStrickerMatchesStats = async () => {
    try {
      const response = await fetch(`${API_URL}/stricker/active-matches/stats?mode=cdl`);
      const data = await response.json();
      if (data.success) {
        setStrickerMatchesStats({
          totalMatches: data.totalMatches || 0,
          totalPlayers: data.totalPlayers || 0,
          stats: data.stats || []
        });
      }
    } catch (err) {
      console.error('Error fetching stricker matches stats:', err);
    }
  };

  // Initial fetch and unified refresh interval
  useEffect(() => {
    // Run all initial fetches in parallel
    Promise.all([
      fetchMatches(true),
      fetchInProgressCounts(),
      fetchRankedMatchesStats(),
      fetchStrickerMatchesStats(),
      fetchSiteStats(),
      ...(isAuthenticated ? [fetchMyActiveMatches()] : [])
    ]);
    
    // Single unified interval for all periodic refreshes
    const refreshInterval = setInterval(() => {
      Promise.all([
        fetchMatches(false),
        fetchInProgressCounts(),
        fetchRankedMatchesStats(),
        fetchStrickerMatchesStats(),
        fetchSiteStats(),
        ...(isAuthenticated ? [fetchMyActiveMatches()] : [])
      ]);
    }, 30000);
    
    return () => clearInterval(refreshInterval);
  }, [isAuthenticated]);

  // Socket.io events for real-time match updates
  useEffect(() => {
    // Join the page room and mode room
    joinPage('cdl-dashboard');
    joinMode('cdl');

    // Handle match created events
    const handleMatchCreated = (data) => {
      if (data.mode === 'cdl') {
        if (data.ladderId === 'squad-team') {
          setSquadTeamMatches(prev => [data.match, ...prev]);
        } else if (data.ladderId === 'duo-trio') {
          setDuoTrioMatches(prev => [data.match, ...prev]);
        }
      }
    };

    // Handle match accepted events
    const handleMatchAccepted = (data) => {
      if (data.mode === 'cdl') {
        console.log('[CDLDashboard] matchAccepted event:', data);
        
        const currentSquad = mySquadRef.current;
        const currentSquadId = (currentSquad?._id || currentSquad?.id)?.toString();
        const challengerId = data.match?.challenger?._id?.toString() || data.match?.challenger?.id?.toString();
        const opponentId = data.match?.opponent?._id?.toString() || data.match?.opponent?.id?.toString();
        const isMyMatch = currentSquadId && (challengerId === currentSquadId || opponentId === currentSquadId);
        
        console.log('[CDLDashboard] Is my match?', isMyMatch, {currentSquadId, challengerId, opponentId});
        
        // Retirer le match de la liste des disponibles (sauf si c'est mon match - il va dans myActiveMatches)
        if (data.ladderId === 'squad-team') {
          setSquadTeamMatches(prev => {
            const filtered = prev.filter(m => m._id !== data.matchId);
            console.log('[CDLDashboard] squadTeamMatches updated:', prev.length, '->', filtered.length);
            return filtered;
          });
          setInProgressCounts(prev => ({ ...prev, 'squad-team': prev['squad-team'] + 1, total: prev.total + 1 }));
        } else if (data.ladderId === 'duo-trio') {
          setDuoTrioMatches(prev => {
            const filtered = prev.filter(m => m._id !== data.matchId);
            console.log('[CDLDashboard] duoTrioMatches updated:', prev.length, '->', filtered.length);
            return filtered;
          });
          setInProgressCounts(prev => ({ ...prev, 'duo-trio': prev['duo-trio'] + 1, total: prev.total + 1 }));
        }
        
        // Ajouter à mes matchs actifs si c'est mon match
        if (data.match && isMyMatch) {
          setMyActiveMatches(prev => {
            if (prev.some(m => m._id === data.match._id)) return prev;
            console.log('[CDLDashboard] Adding to myActiveMatches:', data.match._id);
            return [data.match, ...prev];
          });
          
          // Rediriger vers la feuille de match si c'est mon match (match pris ou mon match accepté)
          console.log('[CDLDashboard] Redirecting to match sheet:', data.match._id);
          navigate(`/match/${data.match._id}`);
        }
        
        // Fallback: refresh active matches to ensure consistency
        setTimeout(() => {
          if (isAuthenticated) fetchMyActiveMatches();
        }, 1000);
      }
    };

    // Handle match cancelled events
    const handleMatchCancelled = (data) => {
      if (data.mode === 'cdl') {
        if (data.ladderId === 'squad-team') {
          setSquadTeamMatches(prev => prev.filter(m => m._id !== data.matchId));
        } else if (data.ladderId === 'duo-trio') {
          setDuoTrioMatches(prev => prev.filter(m => m._id !== data.matchId));
        }
      }
    };

    // Handle new squad approval request (for match poster)
    const handleNewSquadApprovalRequest = (data) => {
      console.log('[NEW SQUAD] Received approval request:', data);
      setNewSquadApprovalRequest(data);
      setNewSquadApprovalTimeLeft(30);
    };

    // Handle new squad approval response (for the new squad waiting for approval)
    // Note: Principalement informatif car l'API gère tout avec polling
    const handleNewSquadApprovalResponse = (data) => {
      console.log('[NEW SQUAD] Received approval response via socket:', data);
      
      if (!data.approved) {
        // Notification anticipée que le match a été refusé
        setMatchMessage({ type: 'error', text: txt.approvalRejected || 'Match refusé' });
        setTimeout(() => setMatchMessage({ type: '', text: '' }), 4000);
      }
    };

    // Subscribe to events
    const unsubCreated = on('matchCreated', handleMatchCreated);
    const unsubAccepted = on('matchAccepted', handleMatchAccepted);
    const unsubCancelled = on('matchCancelled', handleMatchCancelled);
    const unsubNewSquadApproval = on('newSquadApprovalRequest', handleNewSquadApprovalRequest);
    const unsubNewSquadResponse = on('newSquadApprovalResponse', handleNewSquadApprovalResponse);

    return () => {
      leavePage('cdl-dashboard');
      leaveMode('cdl');
      unsubCreated();
      unsubAccepted();
      unsubCancelled();
      unsubNewSquadApproval();
      unsubNewSquadResponse();
    };
  }, [on, joinPage, leavePage, joinMode, leaveMode, isAuthenticated, language]);

  // Match functions
  const handleOpenPostRoster = (e, ladderId, gameMode) => {
    e.preventDefault();
    if (!mySquad) return;
    setPendingMatchAction({ type: 'post', ladderId, gameMode });
    setSelectedRoster([]);
    setSelectedHelper(null);
    setRosterError('');
    setShowRosterDialog('post');
  };

  const handlePostMatch = async (ladderId, roster, gameMode) => {
    if (!mySquad) return false;
    setPostingMatch(true);
    try {
      const actualGameMode = gameMode || matchForm.gameMode;
      const isVariantMode = actualGameMode === 'Variant';
      const response = await fetch(`${API_URL}/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ladderId,
          gameMode: actualGameMode,
          teamSize: matchForm.teamSize,
          isReady: true,
          mapType: matchForm.mapType,
          roster: roster,
          isVariant: isVariantMode,
          variantGameModes: isVariantMode ? ['Hardpoint', 'Search & Destroy', 'Control'] : undefined
        })
      });
      const data = await response.json();
      if (data.success) {
        setMatchMessage({ type: 'success', text: txt.postMatch + ' ✓' });
        setShowPostMatch(null);
        setMatchForm({ ladder: 'squad-team', gameMode: 'Hardpoint', teamSize: 4, mapType: 'free' });
        const res = await fetch(`${API_URL}/matches/available/${ladderId}?mode=cdl`);
        const resData = await res.json();
        if (resData.success) {
          if (ladderId === 'squad-team') setSquadTeamMatches(resData.matches);
          else if (ladderId === 'duo-trio') setDuoTrioMatches(resData.matches);
        }
        setTimeout(async () => { await fetchMyActiveMatches(); }, 500);
        setTimeout(() => setMatchMessage({ type: '', text: '' }), 3000);
        return true;
      } else {
        setRosterError(data.message);
        return false;
      }
    } catch (err) {
      console.error('Error posting match:', err);
      setRosterError(language === 'fr' ? 'Erreur serveur' : 'Server error');
      return false;
    } finally {
      setPostingMatch(false);
    }
  };

  const handleOpenAcceptRoster = (matchId, ladderId, teamSize) => {
    setPendingMatchAction({ type: 'accept', matchId, ladderId, teamSize });
    setSelectedRoster([]);
    setSelectedHelper(null);
    setRosterError('');
    setShowRosterDialog('accept');
  };

  const handleAcceptMatch = async (matchId, ladderId, roster) => {
    setAcceptingMatch(matchId);
    try {
      const response = await fetch(`${API_URL}/matches/${matchId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ roster })
      });
      const data = await response.json();
      if (data.success) {
        setMatchMessage({ type: 'success', text: '✓' });
        const res = await fetch(`${API_URL}/matches/available/${ladderId}?mode=cdl`);
        const resData = await res.json();
        if (resData.success) setSquadTeamMatches(resData.matches);
        setTimeout(async () => { await fetchMyActiveMatches(); }, 500);
        setTimeout(() => setMatchMessage({ type: '', text: '' }), 3000);
        return true;
      } else {
        if (data.errorCode === 'REMATCH_COOLDOWN' && data.cooldownData) {
          const { hours, minutes } = data.cooldownData;
          let timeString = hours > 0 && minutes > 0 ? `${hours}${txt.hourUnit} ${minutes}${txt.minuteUnit}` : hours > 0 ? `${hours}${txt.hourUnit}` : `${minutes}${txt.minuteUnit}`;
          setRosterError(`${txt.rematchCooldown} ${timeString}.`);
        } else if (data.errorCode === 'NEW_SQUAD_TIMEOUT') {
          setRosterError(txt.approvalTimeout || 'L\'équipe adverse n\'a pas répondu à temps');
        } else if (data.errorCode === 'NEW_SQUAD_REJECTED') {
          setRosterError(txt.approvalRejected || 'L\'équipe adverse a refusé le match');
        } else {
          setRosterError(data.message);
        }
        return false;
      }
    } catch (err) {
      console.error('Error accepting match:', err);
      setRosterError(language === 'fr' ? 'Erreur serveur' : 'Server error');
      return false;
    } finally {
      setAcceptingMatch(null);
    }
  };

  const checkPlayerAnticheat = async (playerId) => {
    try {
      const response = await fetch(`${API_URL}/users/anticheat-status/${playerId}`);
      const data = await response.json();
      return data.isOnline || false;
    } catch {
      return false;
    }
  };

  // Request helper confirmation and wait for response
  const requestHelperConfirmation = async (helperId, actionType, matchDetails) => {
    return new Promise((resolve, reject) => {
      setWaitingHelperConfirmation(true);
      setHelperConfirmationTimeLeft(30);
      
      // Create timeout for 30 seconds
      let timeoutId;
      let countdownId;
      let unsubscribe;
      
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (countdownId) clearInterval(countdownId);
        setWaitingHelperConfirmation(false);
        setHelperConfirmationId(null);
        if (unsubscribe) unsubscribe();
      };
      
      // Start countdown
      countdownId = setInterval(() => {
        setHelperConfirmationTimeLeft(prev => {
          if (prev <= 1) {
            cleanup();
            reject(new Error('timeout'));
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      // Set timeout for 30 seconds
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('timeout'));
      }, 30000);
      
      // Listen for response using socket context
      unsubscribe = on('helperConfirmationResponse', (data) => {
        console.log('[HELPER] Received confirmation response:', data);
        cleanup();
        if (data.status === 'accepted') {
          resolve(true);
        } else {
          reject(new Error(data.status));
        }
      });
      
      // Send request to server
      fetch(`${API_URL}/helper-confirmation/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          helperId,
          actionType,
          matchDetails
        })
      })
        .then(res => res.json())
        .then(data => {
          if (!data.success) {
            cleanup();
            reject(new Error(data.message));
          } else {
            setHelperConfirmationId(data.confirmationId);
          }
        })
        .catch(err => {
          cleanup();
          reject(err);
        });
    });
  };

  const handleConfirmRoster = async () => {
    setRosterError('');
    setCheckingAnticheat(true);
    
    try {
      const allSelectedPlayers = [
        ...selectedRoster.map(userId => {
          const member = mySquad?.members?.find(m => (m.user._id || m.user.id) === userId);
          return member?.user;
        }).filter(Boolean),
        ...(selectedHelper ? [selectedHelper] : [])
      ];
      
      const pcPlayers = allSelectedPlayers.filter(p => p?.platform === 'PC');
      
      if (pcPlayers.length > 0) {
        const disconnectedPlayers = [];
        for (const player of pcPlayers) {
          const playerId = player._id || player.id;
          const isOnline = await checkPlayerAnticheat(playerId);
          if (!isOnline) disconnectedPlayers.push(player.username);
        }
        if (disconnectedPlayers.length > 0) {
          setRosterError(`GGSecure non connecté : ${disconnectedPlayers.join(', ')}`);
          setCheckingAnticheat(false);
          return;
        }
      }
      
      setCheckingAnticheat(false);
      
      // If there's a helper, request confirmation first
      if (selectedHelper) {
        const action = pendingMatchAction;
        const matchDetails = {
          ladderId: action?.ladderId,
          gameMode: action?.gameMode || matchForm.gameMode,
          teamSize: action?.teamSize || matchForm.teamSize,
          matchId: action?.matchId || null
        };
        
        try {
          await requestHelperConfirmation(selectedHelper._id, action?.type || 'post', matchDetails);
          // Helper accepted, proceed with the action
        } catch (error) {
          // Helper declined or timeout
          if (error.message === 'timeout') {
            setRosterError(txt.helperTimeout || 'L\'aide n\'a pas répondu à temps.');
          } else if (error.message === 'declined') {
            setRosterError(txt.helperDeclined || 'L\'aide a refusé de jouer.');
          } else {
            setRosterError(error.message || 'Erreur lors de la confirmation de l\'aide');
          }
          return;
        }
      }
      
      const roster = [
        ...selectedRoster.map(userId => ({ user: userId, isHelper: false })),
        ...(selectedHelper ? [{ user: selectedHelper._id, isHelper: true }] : [])
      ];
      
      console.log('[ROSTER DEBUG] selectedRoster:', selectedRoster);
      console.log('[ROSTER DEBUG] selectedHelper:', selectedHelper);
      console.log('[ROSTER DEBUG] Final roster to send:', JSON.stringify(roster, null, 2));
      
      const action = pendingMatchAction;
      let actionSuccess = false;
      const matchIdToRedirect = action?.type === 'accept' ? action.matchId : null;
      if (action?.type === 'post') actionSuccess = await handlePostMatch(action.ladderId, roster, action.gameMode);
      else if (action?.type === 'accept') actionSuccess = await handleAcceptMatch(action.matchId, action.ladderId, roster);
      
      if (actionSuccess) {
        setShowRosterDialog(null);
        setPendingMatchAction(null);
        setSelectedRoster([]);
        setSelectedHelper(null);
        setHelperSearch('');
        setHelperSearchResults([]);
        setRosterError('');
        
        // Rediriger vers la feuille de match après acceptation réussie
        if (matchIdToRedirect) {
          console.log('[CDLDashboard] Redirecting to match sheet after accept:', matchIdToRedirect);
          navigate(`/match/${matchIdToRedirect}`);
        }
      }
    } catch (error) {
      console.error('Error confirming roster:', error);
      setRosterError(language === 'fr' ? 'Erreur lors de la vérification' : 'Verification error');
    } finally {
      setCheckingAnticheat(false);
    }
  };

  const togglePlayerInRoster = (userId) => {
    setSelectedRoster(prev => {
      if (prev.includes(userId)) return prev.filter(id => id !== userId);
      const maxPlayers = showRosterDialog === 'accept' && pendingMatchAction?.teamSize ? pendingMatchAction.teamSize : matchForm.teamSize;
      const currentTotal = prev.length + (selectedHelper ? 1 : 0);
      if (currentTotal >= maxPlayers) return prev;
      return [...prev, userId];
    });
  };

  const searchForHelper = async (query) => {
    if (!query || query.length < 2) { setHelperSearchResults([]); return; }
    setSearchingHelper(true);
    try {
      const response = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}&limit=5`);
      const data = await response.json();
      if (data.success) {
        const squadMemberIds = mySquad?.members?.map(m => m.user._id) || [];
        setHelperSearchResults(data.users.filter(u => !squadMemberIds.includes(u._id)));
      }
    } catch (err) {
      console.error('Error searching users:', err);
    } finally {
      setSearchingHelper(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => { searchForHelper(helperSearch); }, 300);
    return () => clearTimeout(timer);
  }, [helperSearch]);

  const selectHelper = (user) => { setSelectedHelper(user); setHelperSearch(''); setHelperSearchResults([]); };
  const removeHelper = () => { setSelectedHelper(null); };

  const handleCancelMatch = async (matchId, ladderId) => {
    try {
      const response = await fetch(`${API_URL}/matches/${matchId}`, { method: 'DELETE', credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setMatchMessage({ type: 'success', text: txt.cancel + ' ✓' });
        const res = await fetch(`${API_URL}/matches/available/${ladderId}?mode=cdl`);
        const resData = await res.json();
        if (resData.success) {
          if (ladderId === 'squad-team') setSquadTeamMatches(resData.matches);
          else if (ladderId === 'duo-trio') setDuoTrioMatches(resData.matches);
        }
        setTimeout(() => setMatchMessage({ type: '', text: '' }), 3000);
      }
    } catch (err) {
      console.error('Error cancelling match:', err);
    }
  };

  // CDL specific game modes by ladder
  // Chill (duo-trio): S&D only
  // Competitive (squad-team): Point Stratégique, Recherche et Destruction, Variant
  const getGameModesForLadder = (ladderId) => {
    if (ladderId === 'duo-trio') {
      return ['Search & Destroy'];
    }
    // squad-team - CDL competitive with Variant option
    return ['Hardpoint', 'Search & Destroy', 'Variant'];
  };
  const isRegisteredToLadder = (ladderId) => mySquad?.registeredLadders?.some(l => l.ladderId === ladderId);

  // Use isDuoTrioOpen from DataContext
  const isDuoTrioOpen = useCallback(() => duoTrioOpenFromContext, [duoTrioOpenFromContext]);
  
  // Get formatted time slot text - memoized
  const getDuoTrioTimeText = useMemo(() => {
    if (appSettings?.ladderSettings?.duoTrioTimeRestriction?.enabled === false) {
      return language === 'fr' ? '✓ Disponible 24h/24' : '✓ Available 24/7';
    }
    const startHour = appSettings?.ladderSettings?.duoTrioTimeRestriction?.startHour ?? 0;
    const endHour = appSettings?.ladderSettings?.duoTrioTimeRestriction?.endHour ?? 20;
    const isOpen = duoTrioOpenFromContext;
    const timeStr = `${startHour.toString().padStart(2, '0')}h00 - ${endHour.toString().padStart(2, '0')}h00`;
    return isOpen ? `✓ ${language === 'fr' ? 'Ouvert' : 'Open'} • ${timeStr}` : `✗ ${language === 'fr' ? 'Fermé' : 'Closed'} • ${timeStr}`;
  }, [appSettings, duoTrioOpenFromContext, language]);

  const [myActiveMatches, setMyActiveMatches] = useState([]);

  const fetchMyActiveMatches = async () => {
    if (!isAuthenticated) return;
    try {
      const response = await fetch(`${API_URL}/matches/my-active`, { credentials: 'include' });
      const data = await response.json();
      if (data.success) setMyActiveMatches(data.matches);
    } catch (err) {
      console.error('Error fetching my active matches:', err);
    }
  };

  // Note: Interval already handled in unified refresh above

  // Callback for when countdown expires
  const handleCountdownExpire = () => fetchMatches(false);

  // New squad approval countdown effect
  useEffect(() => {
    if (!newSquadApprovalRequest) return;
    
    let isActive = true;
    
    const interval = setInterval(() => {
      if (!isActive) return;
      
      setNewSquadApprovalTimeLeft(prev => {
        if (prev <= 1) {
          // Auto-reject when time expires - only once
          if (isActive) {
            isActive = false;
            clearInterval(interval);
            handleRespondToNewSquadApproval(false);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [newSquadApprovalRequest]);

  // Handle responding to new squad approval request
  const handleRespondToNewSquadApproval = useCallback(async (approved) => {
    if (!newSquadApprovalRequest || respondingToApproval) return;
    
    const currentApprovalId = newSquadApprovalRequest.approvalId;
    const requestingUserId = newSquadApprovalRequest.requestingUserId;
    setRespondingToApproval(true);
    
    try {
      const response = await fetch(`${API_URL}/matches/new-squad-approval/${currentApprovalId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ approved })
      });
      
      const data = await response.json();
      
      // Fermer le dialog dans tous les cas (succès ou erreur)
      setNewSquadApprovalRequest(null);
      
      if (data.success) {
        if (approved) {
          setMatchMessage({ type: 'success', text: language === 'fr' ? 'Match accepté !' : 'Match accepted!' });
        } else {
          setMatchMessage({ type: 'info', text: language === 'fr' ? 'Match refusé' : 'Match rejected' });
        }
        setTimeout(() => setMatchMessage({ type: '', text: '' }), 3000);
      } else {
        console.error('Error responding to approval:', data.message);
      }
    } catch (error) {
      console.error('Error responding to new squad approval:', error);
      // Fermer le dialog en cas d'erreur réseau aussi
      setNewSquadApprovalRequest(null);
    } finally {
      setRespondingToApproval(false);
    }
  }, [newSquadApprovalRequest, respondingToApproval, language]);

  // getGoldCoinsForLadder is now provided by DataContext

  // Match card component
  const renderMatchCard = (match, ladder, isMyMatch, isActiveMatch = false) => {
    const canCancel = match.isReady || !match.scheduledAt || (new Date(match.scheduledAt) - new Date()) > 5 * 60 * 1000;
    const goldCoins = getGoldCoinsForLadder(ladder);
    const isNewSquadMatch = match.challengerIsNewSquad && !isMyMatch && !isActiveMatch;
    
    return (
      <div key={match._id} className={`match-card p-4 sm:p-5 ${
        isActiveMatch ? 'border-2 border-neon-green/50' : isMyMatch ? 'border-2 border-cyan-500/40' : isNewSquadMatch ? 'border-2 border-yellow-500/40' : ''
      }`}>
        {/* New Squad Warning Badge */}
        {isNewSquadMatch && (
          <div className="mb-3 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-yellow-400 text-xs font-semibold">{txt.newSquadWarning}</span>
              <span className="text-white text-xs ml-2 font-bold">{match.challenger?.name}</span>
              {match.challenger?.tag && <span className="text-gray-400 text-xs ml-1">[{match.challenger.tag}]</span>}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setViewingRoster({ match, roster: match.challengerRoster || [] });
              }}
              className="px-2 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 rounded-lg text-yellow-400 text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <Eye className="w-3 h-3" />
              {txt.viewRoster}
            </button>
          </div>
        )}
        
        {/* Mobile Layout */}
        <div className="flex flex-col sm:hidden gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 text-xs font-semibold">
              {getGameModeName(match.gameMode)}
            </span>
            <span className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${
              match.mapType === 'random' ? 'bg-purple-500/20 border border-purple-500/30 text-purple-400' : 'bg-accent-500/20 border border-accent-500/30 text-accent-400'
            }`}>
              {match.mapType === 'random' ? <Shuffle className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
              {match.mapType === 'random' ? txt.random?.slice(0,4) : txt.free}
            </span>
            <span className="text-white text-xs font-bold">{match.teamSize}v{match.teamSize}</span>
          </div>
          
          <div className="flex items-center justify-between">
            {isActiveMatch ? (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse" />
                <span className="text-neon-green text-xs font-semibold">{txt.inProgress}</span>
              </div>
            ) : match.isReady ? (
              <ReadyCountdown createdAt={match.createdAt} onExpire={handleCountdownExpire} />
            ) : (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-blue-400" />
                <span className="text-white text-xs">
                  {new Date(match.scheduledAt).toLocaleString(language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Coins className="w-3 h-3 text-yellow-400" />
              <span className="text-yellow-400 text-xs font-semibold">+{goldCoins}</span>
            </div>
          </div>
          
          {(isActiveMatch || match.opponent) && match.challenger && match.opponent && (
            <div className="flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500/10 via-pink-500/20 to-purple-500/10 border border-purple-500/40 rounded-xl">
              <span className={`text-xs font-bold truncate max-w-[80px] ${match.challenger._id === mySquad?._id ? 'text-yellow-400' : 'text-white'}`}>
                {match.challenger.name}
              </span>
              <span className="text-pink-400 text-[10px] font-black px-2 py-0.5 bg-pink-500/30 rounded">VS</span>
              <span className={`text-xs font-bold truncate max-w-[80px] ${match.opponent._id === mySquad?._id ? 'text-yellow-400' : 'text-white'}`}>
                {match.opponent.name}
              </span>
            </div>
          )}
          
          <div className="flex justify-end">
            {isActiveMatch ? (
              <Link to={`/match/${match._id}`} className="px-4 py-2 bg-gradient-to-r from-neon-green to-emerald-600 rounded-xl text-white font-bold text-xs flex items-center gap-1">
                <Play className="w-3 h-3" />{txt.viewMatch}
              </Link>
            ) : isMyMatch ? (
              canCancel ? (
                <button onClick={() => handleCancelMatch(match._id, ladder)} className="px-4 py-2 glass border border-cyan-500/30 rounded-xl text-cyan-400 text-xs font-medium">
                  {txt.cancel}
                </button>
              ) : (
                <span className="px-4 py-2 glass text-gray-500 text-xs rounded-xl">🔒</span>
              )
            ) : isAuthenticated && mySquad && isRegisteredToLadder(ladder) ? (
              <button onClick={() => handleOpenAcceptRoster(match._id, ladder, match.teamSize)} disabled={acceptingMatch === match._id}
                className={`px-5 py-2 rounded-xl text-white font-bold text-xs ${match.isReady ? 'bg-gradient-to-r from-neon-green to-emerald-600' : 'bg-gradient-to-r from-cyan-500 to-blue-600'}`}>
                {acceptingMatch === match._id ? <Loader2 className="w-3 h-3 animate-spin" /> : match.isReady ? txt.play : txt.go}
              </button>
            ) : (
              <span className="px-4 py-2 text-gray-500 text-xs">{txt.notRegistered}</span>
            )}
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex items-center justify-between">
          <div className="flex items-center gap-4 lg:gap-6 flex-1">
            <span className="px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400 text-sm font-semibold min-w-[140px]">
              {getGameModeName(match.gameMode)}
            </span>
            <span className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 ${
              match.mapType === 'random' ? 'bg-purple-500/20 border border-purple-500/30 text-purple-400' : 'bg-accent-500/20 border border-accent-500/30 text-accent-400'
            }`}>
              {match.mapType === 'random' ? <Shuffle className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
              <span>{match.mapType === 'random' ? txt.random : txt.free}</span>
            </span>
            <div className="flex items-center gap-2 min-w-[160px]">
              {isActiveMatch ? (
                <><div className="w-2 h-2 bg-neon-green rounded-full animate-pulse" /><span className="text-neon-green text-sm font-semibold">{txt.inProgress}</span></>
              ) : match.isReady ? (
                <ReadyCountdown createdAt={match.createdAt} onExpire={handleCountdownExpire} />
              ) : (
                <><Clock className="w-4 h-4 text-blue-400" /><span className="text-white text-sm">{new Date(match.scheduledAt).toLocaleString(language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span className="text-white text-sm font-medium">{match.teamSize}v{match.teamSize}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 text-sm font-semibold">+{goldCoins}</span>
            </div>
            {isMyMatch && !isActiveMatch && !match.opponent && (
              <span className="px-3 py-1 bg-cyan-500/20 rounded-lg text-cyan-400 text-xs font-bold">{txt.yourMatch}</span>
            )}
          </div>
          {(isActiveMatch || match.opponent) && match.challenger && match.opponent && (
            <div className="flex items-center gap-3 mr-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/10 via-pink-500/20 to-purple-500/10 border border-purple-500/40 rounded-xl">
                <Link to={`/squad/${match.challenger._id}`} className={`text-sm font-bold ${match.challenger._id === mySquad?._id ? 'text-yellow-400' : 'text-white hover:text-purple-400'}`}>
                  {match.challenger.name}
                </Link>
                <span className="text-pink-400 text-xs font-black px-2 py-0.5 bg-pink-500/30 rounded">VS</span>
                <Link to={`/squad/${match.opponent._id}`} className={`text-sm font-bold ${match.opponent._id === mySquad?._id ? 'text-yellow-400' : 'text-white hover:text-purple-400'}`}>
                  {match.opponent.name}
                </Link>
              </div>
            </div>
          )}
          {isActiveMatch ? (
            <Link to={`/match/${match._id}`} className="px-5 py-2.5 bg-gradient-to-r from-neon-green to-emerald-600 rounded-xl text-white font-bold text-sm hover:scale-105 transition-all flex items-center gap-2">
              <Play className="w-4 h-4" />{txt.viewMatch}
            </Link>
          ) : isMyMatch ? (
            canCancel ? (
              <button onClick={() => handleCancelMatch(match._id, ladder)} className="px-5 py-2.5 glass border border-cyan-500/30 rounded-xl text-cyan-400 font-medium text-sm hover:bg-cyan-500/10 transition-all">{txt.cancel}</button>
            ) : (
              <span className="px-5 py-2.5 glass text-gray-500 text-sm rounded-xl">🔒</span>
            )
          ) : isAuthenticated && mySquad && isRegisteredToLadder(ladder) ? (
            appSettings?.features?.ladderMatchmaking?.enabled === false && !isAdminOrStaff ? (
              <div className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>{appSettings.features.ladderMatchmaking.disabledMessage || 'Prise désactivée'}</span>
              </div>
            ) : (
              <button onClick={() => handleOpenAcceptRoster(match._id, ladder, match.teamSize)} disabled={acceptingMatch === match._id}
                className={`px-6 py-2.5 rounded-xl text-white font-bold text-sm transition-all hover:scale-105 disabled:opacity-50 flex items-center gap-2 ${match.isReady ? 'bg-gradient-to-r from-neon-green to-emerald-600' : 'bg-gradient-to-r from-cyan-500 to-blue-600'}`}>
                {acceptingMatch === match._id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {match.isReady ? txt.play : txt.go}
              </button>
            )
          ) : (
            <span className="px-5 py-2.5 text-gray-500 text-sm">{txt.notRegistered}</span>
          )}
        </div>
      </div>
    );
  };

  // Top players and squads
  const [topPlayers, setTopPlayers] = useState([]);
  const [topSquads, setTopSquads] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [loadingSquads, setLoadingSquads] = useState(true);
  const [mySquadRank, setMySquadRank] = useState(null);
  const [myPlayerRank, setMyPlayerRank] = useState(null);

  useEffect(() => {
    const fetchTopPlayers = async () => {
      setLoadingPlayers(true);
      try {
        const response = await fetch(`${API_URL}/rankings/top-players/cdl?limit=10`);
        const data = await response.json();
        if (data.success) {
          const players = data.rankings.map((r, idx) => {
            const u = r.user;
            // Handle avatar with Discord fallback
            let avatarUrl = getAvatarUrl(u?.avatarUrl || u?.avatar);
            if (!avatarUrl && u?.discordId && u?.discordAvatar) {
              avatarUrl = `https://cdn.discordapp.com/avatars/${u.discordId}/${u.discordAvatar}.png`;
            }
            return {
              rank: idx + 1,
              id: u?._id,
              player: u?.username || u?.discordUsername || 'Deleted',
              avatar: avatarUrl,
              points: r.points
            };
          });
          setTopPlayers(players);
          
          // Check if current user is in top 10
          const currentUserId = user?.id || user?._id;
          if (currentUserId) {
            const isInTop10 = players.some(p => p.id === currentUserId);
            if (!isInTop10) {
              // Fetch user's rank
              try {
                const rankResponse = await fetch(`${API_URL}/rankings/player-rank/${currentUserId}?mode=cdl`);
                const rankData = await rankResponse.json();
                if (rankData.success && rankData.rank) {
                  // Get user avatar
                  let userAvatar = getAvatarUrl(user?.avatarUrl || user?.avatar);
                  if (!userAvatar && user?.discordId && user?.discordAvatar) {
                    userAvatar = `https://cdn.discordapp.com/avatars/${user.discordId}/${user.discordAvatar}.png`;
                  }
                  setMyPlayerRank({
                    rank: rankData.rank,
                    id: currentUserId,
                    player: user?.username || user?.discordUsername || 'You',
                    avatar: userAvatar,
                    points: rankData.points || 0
                  });
                }
              } catch (rankErr) {
                console.error('Error fetching player rank:', rankErr);
              }
            } else {
              setMyPlayerRank(null);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching top players:', err);
      } finally {
        setLoadingPlayers(false);
      }
    };
    fetchTopPlayers();
  }, [user]);

  useEffect(() => {
    const fetchTopSquads = async () => {
      setLoadingSquads(true);
      try {
        const response = await fetch(`${API_URL}/squads/leaderboard/cdl?limit=10`);
        const data = await response.json();
        if (data.success) {
          const squads = data.squads.map((s, idx) => ({
            rank: idx + 1,
            id: s._id,
            team: s.name,
            tag: s.tag,
            color: s.color,
            logo: s.logo,
            points: s.stats?.totalPoints || 0,
            totalMatches: s.totalMatches || (s.stats?.totalWins || 0) + (s.stats?.totalLosses || 0),
            totalWins: s.totalWins || s.stats?.totalWins || 0,
            totalLosses: s.totalLosses || s.stats?.totalLosses || 0
          }));
          setTopSquads(squads);
          
          // Check if user's squad is in top 10
          if (mySquad) {
            const mySquadId = String(mySquad._id || mySquad.id);
            const isInTop10 = squads.some(s => String(s.id) === mySquadId);
            if (!isInTop10) {
              // Fetch user's squad rank
              try {
                const rankResponse = await fetch(`${API_URL}/squads/${mySquad._id}/rank?mode=cdl`);
                const rankData = await rankResponse.json();
                if (rankData.success && rankData.rank) {
                  setMySquadRank({
                    rank: rankData.rank,
                    id: mySquad._id,
                    team: mySquad.name,
                    tag: mySquad.tag,
                    color: mySquad.color,
                    logo: mySquad.logo,
                    points: rankData.points || mySquad.stats?.totalPoints || 0
                  });
                }
              } catch (rankErr) {
                console.error('Error fetching squad rank:', rankErr);
              }
            } else {
              setMySquadRank(null);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching top squads:', err);
      } finally {
        setLoadingSquads(false);
      }
    };
    fetchTopSquads();
  }, [mySquad]);

  return (
    <div className="min-h-screen bg-dark-950 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-dark-base" />
      <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      <div className="absolute inset-0 bg-radial-glow" />
      <div className="absolute inset-0 bg-noise pointer-events-none" />
      
      <div className="relative z-10 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header with Banner */}
          <div className="relative mb-12 rounded-2xl overflow-hidden">
            {/* Background Banner */}
            <div className="absolute inset-0">
              <img
                src="/bo7.jpg"
                alt="Call of Duty: Black Ops 7"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-dark-950 via-dark-950/85 to-dark-950/60"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-transparent to-transparent"></div>
            </div>
            
            {/* Content */}
            <div className="relative z-10 px-6 py-8">
              <div className="flex items-center gap-5">
                <img 
                  src="/logo_cdl.png" 
                  alt="CDL" 
                  className="h-16 md:h-20 object-contain drop-shadow-2xl"
                />
                <div>
                  <p className="text-gray-400">{t('cdlDashboardDesc')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Top Player & MVP Leader & Top Squad Section */}
          {(topPlayer || mvpLeader || topSquad) && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mb-8">
              {/* Top Player */}
              {topPlayer && (
                <Link
                  to={`/player/${topPlayer._id}`}
                  className="group relative w-full sm:w-auto"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative glass-card rounded-2xl border border-yellow-500/30 hover:border-yellow-400/50 transition-all duration-300 transform group-hover:scale-[1.02] overflow-hidden">
                    {/* Animated background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 via-orange-500/5 to-yellow-500/5 animate-pulse" />
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-500 animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                    
                    <div className="relative flex items-center gap-4 p-5 sm:p-6">
                      {/* Crown icon with glow */}
                      <div className="absolute top-3 left-3 z-10">
                        <div className="relative">
                          <Crown className="w-6 h-6 text-yellow-400 animate-bounce" style={{ animationDuration: '2s' }} />
                          <div className="absolute inset-0 text-yellow-400 blur-sm animate-pulse">
                            <Crown className="w-6 h-6" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Avatar */}
                      <div className="relative ml-6">
                        <img
                          src={getAvatarUrl(topPlayer.avatarUrl || topPlayer.avatar) || '/avatar.jpg'}
                          alt={topPlayer.username}
                          className="relative w-16 h-16 rounded-full object-cover"
                        />
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-yellow-400 font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Trophy className="w-3.5 h-3.5" />
                          {language === 'fr' ? 'Top 1 Expérience' : 'Top 1 XP'}
                        </p>
                        <p className="text-white font-bold text-xl truncate group-hover:text-yellow-400 transition-colors">
                          {topPlayer.username}
                        </p>
                        <p className="text-gray-400 text-sm mt-0.5">
                          <span className="text-yellow-400 font-semibold">{(topPlayer.xp || 0).toLocaleString()}</span> XP
                        </p>
                      </div>
                      
                      {/* Decorative medal */}
                      <div className="relative">
                        <Medal className="w-10 h-10 text-yellow-500/30 group-hover:text-yellow-500/60 transition-colors" />
                      </div>
                    </div>
                  </div>
                </Link>
              )}
              
              {/* MVP Leader */}
              {mvpLeader && (
                <Link
                  to={`/player/${mvpLeader._id}`}
                  className="group relative w-full sm:w-auto"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative glass-card rounded-2xl border border-cyan-500/30 hover:border-cyan-400/50 transition-all duration-300 transform group-hover:scale-[1.02] overflow-hidden">
                    {/* Animated background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-blue-500/5 to-cyan-500/5 animate-pulse" />
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500 animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                    
                    <div className="relative flex items-center gap-4 p-5 sm:p-6">
                      {/* Star icon with glow */}
                      <div className="absolute top-3 left-3 z-10">
                        <div className="relative">
                          <Star className="w-6 h-6 text-cyan-400 animate-bounce" style={{ animationDuration: '2s' }} />
                          <div className="absolute inset-0 text-cyan-400 blur-sm animate-pulse">
                            <Star className="w-6 h-6" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Avatar */}
                      <div className="relative ml-6">
                        <img
                          src={getAvatarUrl(mvpLeader.avatarUrl || mvpLeader.avatar) || '/avatar.jpg'}
                          alt={mvpLeader.username}
                          className="relative w-16 h-16 rounded-full object-cover"
                        />
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-cyan-400 font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Star className="w-3.5 h-3.5" />
                          {language === 'fr' ? 'Leader MVP' : 'MVP Leader'}
                        </p>
                        <p className="text-white font-bold text-xl truncate group-hover:text-cyan-400 transition-colors">
                          {mvpLeader.username}
                        </p>
                        <p className="text-gray-400 text-sm mt-0.5">
                          <span className="text-cyan-400 font-semibold">{(mvpLeader.mvpCount || 0).toLocaleString()}</span> MVP
                        </p>
                      </div>
                      
                      {/* Decorative star */}
                      <div className="relative">
                        <Star className="w-10 h-10 text-cyan-500/30 group-hover:text-cyan-500/60 transition-colors" />
                      </div>
                    </div>
                  </div>
                </Link>
              )}
              
              {/* Top Squad */}
              {topSquad && (
                <Link
                  to={`/squad/${topSquad._id}`}
                  className="group relative w-full sm:w-auto"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative glass-card rounded-2xl border border-purple-500/30 hover:border-purple-400/50 transition-all duration-300 transform group-hover:scale-[1.02] overflow-hidden">
                    {/* Animated background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-purple-500/5 animate-pulse" />
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                    
                    <div className="relative flex items-center gap-4 p-5 sm:p-6">
                      {/* Trophy icon with glow */}
                      <div className="absolute top-3 right-3 z-10">
                        <div className="relative">
                          <Trophy className="w-6 h-6 text-purple-400 animate-bounce" style={{ animationDuration: '2.5s' }} />
                          <div className="absolute inset-0 text-purple-400 blur-sm animate-pulse">
                            <Trophy className="w-6 h-6" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Squad Logo */}
                      <div className="relative">
                        <div 
                          className="relative w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden"
                          style={{ backgroundColor: (topSquad.color || '#a855f7') + '30' }}
                        >
                          {topSquad.logo ? (
                            <img src={topSquad.logo} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Shield className="w-9 h-9" style={{ color: topSquad.color || '#a855f7' }} />
                          )}
                        </div>
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-purple-400 font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {language === 'fr' ? 'Meilleure Escouade' : 'Top Squad'}
                        </p>
                        <p className="text-white font-bold text-xl truncate group-hover:text-purple-400 transition-colors">
                          {topSquad.name} <span className="text-gray-500">[{topSquad.tag}]</span>
                        </p>
                        <p className="text-gray-400 text-sm mt-0.5">
                          <span className="text-purple-400 font-semibold">{(topSquad.totalPoints || topSquad.stats?.totalPoints || 0).toLocaleString()}</span> {language === 'fr' ? 'points' : 'points'}
                        </p>
                      </div>
                      
                      {/* Decorative trophy */}
                      <div className="relative">
                        <Trophy className="w-10 h-10 text-purple-500/30 group-hover:text-purple-500/60 transition-colors" />
                      </div>
                    </div>
                  </div>
                </Link>
              )}
            </div>
          )}

          {/* Mode Selection Banners */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {/* Ranked Mode Banner */}
            <Link
              to="/cdl/ranked"
              className="group relative block overflow-hidden rounded-2xl h-full"
            >
              {/* Animated background gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/30 via-blue-500/20 to-cyan-600/30 animate-pulse" />
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djJIMjR2LTJoMTJ6bTAtNHYySDI0di0yaDEyem0wLTR2Mkg0djJIMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20" />
              
              {/* Glow effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-blue-500/30 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              {/* Border animation */}
              <div className="absolute inset-0 rounded-2xl border-2 border-cyan-500/30 group-hover:border-cyan-500/60 transition-colors duration-300" />
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" style={{ animation: 'shimmer 2s linear infinite' }} />
              
              <div className="relative flex flex-col p-4 sm:p-6">
                <div className="flex items-center gap-4 mb-4">
                  {/* Animated icon */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-cyan-500/30 rounded-xl blur-xl animate-pulse" />
                    <div className="relative w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/30">
                      <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-white" style={{ animation: 'bounce 2s ease-in-out infinite' }} />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-cyan-400 transition-colors">
                        {language === 'fr' ? 'Mode Classé' : 'Ranked Mode'}
                      </h3>
                    </div>
                    <p className="text-gray-400 text-sm sm:text-base">
                      {language === 'fr' 
                        ? 'Affronte les meilleurs joueurs et grimpe les échelons !' 
                        : 'Face the best players and climb the ranks!'}
                    </p>
                  </div>
                </div>
                
                {/* Ranked matches stats */}
                <div className="flex items-center gap-3 mb-4 min-h-[26px]">
                  {rankedMatchesStats.totalMatches > 0 ? (
                    <>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green-500/20 border border-green-500/30">
                        <Swords className="w-3 h-3 text-green-400" />
                        <span className="text-green-400 text-xs font-semibold">
                          {rankedMatchesStats.totalMatches} {language === 'fr' ? 'match(s) en cours' : 'active match(es)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-cyan-500/20 border border-cyan-500/30">
                        <Users className="w-3 h-3 text-cyan-400" />
                        <span className="text-cyan-400 text-xs font-semibold">
                          {rankedMatchesStats.totalPlayers} {language === 'fr' ? 'joueurs en match' : 'players in match'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="text-gray-500 text-xs">
                      {language === 'fr' ? 'Aucun match en cours actuellement' : 'No active matches currently'}
                    </span>
                  )}
                </div>
                
                {/* CTA Button */}
                <div className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-400 to-blue-600 rounded-xl text-white font-semibold group-hover:scale-105 transition-transform shadow-lg shadow-cyan-500/30">
                  <span>{language === 'fr' ? 'Jouer' : 'Play'}</span>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            {/* Mode Stricker Banner - Conditional: Active or Coming Soon */}
            {isStrickerModeEnabled ? (
              <Link to="/cdl/stricker" className="group relative block overflow-hidden rounded-2xl h-full">
                {/* Animated background gradient - Yellow-Green (Apple) */}
                <div className="absolute inset-0 bg-gradient-to-r from-lime-500/30 via-yellow-500/20 to-lime-500/30" />
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djJIMjR2LTJoMTJ6bTAtNHYySDI0di0yaDEyem0wLTR2Mkg0djJIMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20" />
                <div className="absolute inset-0 bg-gradient-to-r from-lime-500/0 via-green-500/30 to-lime-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                {/* Border animation */}
                <div className="absolute inset-0 rounded-2xl border-2 border-lime-500/30 group-hover:border-lime-500/60 transition-colors duration-300" />
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-lime-400 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" style={{ animation: 'shimmer 2s linear infinite' }} />
                
                <div className="relative flex flex-col p-4 sm:p-6">
                  <div className="flex items-center gap-4 mb-4">
                    {/* Animated icon */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-lime-500/30 rounded-xl blur-xl animate-pulse" />
                      <div className="relative w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-lime-400 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-lime-500/30">
                        <Target className="w-6 h-6 sm:w-8 sm:h-8 text-white" style={{ animation: 'bounce 2s ease-in-out infinite' }} />
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-lime-400 transition-colors">
                          Mode Stricker
                        </h3>
                      </div>
                      <p className="text-gray-400 text-sm sm:text-base">
                        {language === 'fr' 
                          ? "L'élite contre l'élite - Ranked 5v5 en équipe !" 
                          : 'Elite vs Elite - Ranked 5v5 Team Mode!'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Stricker matches stats */}
                  <div className="flex items-center gap-3 mb-4 min-h-[26px]">
                    {strickerMatchesStats.totalMatches > 0 ? (
                      <>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-lime-500/20 border border-lime-500/30">
                          <Swords className="w-3 h-3 text-lime-400" />
                          <span className="text-lime-400 text-xs font-semibold">
                            {strickerMatchesStats.totalMatches} {language === 'fr' ? 'match(s) en cours' : 'active match(es)'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green-500/20 border border-green-500/30">
                          <Users className="w-3 h-3 text-green-400" />
                          <span className="text-green-400 text-xs font-semibold">
                            {strickerMatchesStats.totalPlayers} {language === 'fr' ? 'joueurs en match' : 'players in match'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <span className="text-lime-400 text-xs font-semibold">
                        {language === 'fr' ? 'Mode S&D en 5v5 avec votre escouade' : 'S&D mode 5v5 with your squad'}
                      </span>
                    )}
                  </div>
                  
                  {/* CTA Button */}
                  <div className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-lime-500 to-green-600 rounded-xl text-white font-semibold group-hover:scale-105 transition-transform shadow-lg shadow-lime-500/30">
                    <span>{language === 'fr' ? 'Jouer' : 'Play'}</span>
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            ) : (
              <div className="group relative block overflow-hidden rounded-2xl cursor-not-allowed h-full">
                {/* Animated background gradient - Yellow-Green (Apple) */}
                <div className="absolute inset-0 bg-gradient-to-r from-lime-500/30 via-yellow-500/20 to-lime-500/30 animate-pulse" />
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djJIMjR2LTJoMTJ6bTAtNHYySDI0di0yaDEyem0wLTR2Mkg0djJIMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20" />
                
                {/* Border animation */}
                <div className="absolute inset-0 rounded-2xl border-2 border-lime-500/30 transition-colors duration-300" />
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-lime-400 to-transparent opacity-50" style={{ animation: 'shimmer 2s linear infinite' }} />
                
                <div className="relative flex flex-col p-4 sm:p-6">
                  <div className="flex items-center gap-4 mb-4">
                    {/* Animated icon */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-lime-500/30 rounded-xl blur-xl animate-pulse" />
                      <div className="relative w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-lime-400 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg shadow-lime-500/30">
                        <Users className="w-6 h-6 sm:w-8 sm:h-8 text-white" style={{ animation: 'bounce 2s ease-in-out infinite' }} />
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg sm:text-xl font-bold text-white">
                          Mode Stricker
                        </h3>
                        <span className="px-2 py-0.5 bg-lime-500/20 border border-lime-500/40 rounded-full text-lime-400 text-xs font-semibold animate-pulse">
                          {language === 'fr' ? 'TRÈS BIENTÔT' : 'VERY SOON'}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm sm:text-base">
                        {language === 'fr' 
                          ? "L'élite contre l'élite - Ranked 5v5 en équipe !" 
                          : 'Elite vs Elite - Ranked 5v5 Team Mode!'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Placeholder for consistent height */}
                  <div className="flex items-center gap-3 mb-4 min-h-[26px]">
                    <span className="text-gray-500 text-xs">
                      {language === 'fr' ? 'Préparez-vous pour le lancement !' : 'Get ready for launch!'}
                    </span>
                  </div>
                  
                  {/* Locked indicator */}
                  <div className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-gray-400 font-semibold">
                    <Lock className="w-4 h-4" />
                    <span>{language === 'fr' ? 'Bientôt' : 'Soon'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tournaments - Coming Soon */}
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                <Trophy className="w-5 h-5 text-cyan-400" />
              </div>
              <h2 className="text-2xl font-display text-white">{t('tournaments')}</h2>
            </div>

            <div className="glass-card rounded-3xl p-12 text-center neon-border-cyan">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 border-2 border-cyan-500/50 flex items-center justify-center animate-bounce-subtle">
                <Trophy className="w-12 h-12 text-cyan-400" />
              </div>
              <h3 className="text-3xl font-display text-white mb-4">
                {language === 'fr' ? 'BIENTÔT DISPONIBLE' : 'COMING SOON'}
              </h3>
              <p className="text-gray-400 text-lg max-w-xl mx-auto">
                {language === 'fr' ? 'Les tournois arrivent bientôt ! Préparez-vous à affronter les meilleurs joueurs.' : 'Tournaments are coming soon! Get ready to face the best players.'}
              </p>
            </div>
          </section>

          {/* Rankings */}
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                <Crown className="w-5 h-5 text-yellow-500" />
              </div>
              <h2 className="text-2xl font-display text-white">{language === 'fr' ? 'CLASSEMENTS' : 'RANKINGS'}</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Top Players */}
              <div className="glass-card rounded-2xl overflow-hidden neon-border-cyan flex flex-col">
                <div className="px-6 py-4 border-b border-white/5 bg-gradient-to-r from-cyan-500/10 to-transparent">
                  <h3 className="font-display text-xl text-white flex items-center gap-3">
                    <Users className="w-5 h-5 text-cyan-400" />
                    {language === 'fr' ? 'TOP 10 JOUEURS' : 'TOP 10 PLAYERS'}
                  </h3>
                </div>
                <div className="flex-1 min-h-[520px]">
                  {loadingPlayers ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                    </div>
                  ) : topPlayers.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">{language === 'fr' ? 'Aucun joueur classé' : 'No ranked players'}</div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {topPlayers.map((player) => (
                        <div key={player.rank} className={`px-6 py-3 hover:bg-white/5 transition-all ${player.rank <= 3 ? 'bg-gradient-to-r from-yellow-500/5 to-transparent' : ''}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 w-14">
                                {player.rank === 1 && <Medal className="w-4 h-4 text-yellow-500" />}
                                {player.rank === 2 && <Medal className="w-4 h-4 text-gray-400" />}
                                {player.rank === 3 && <Medal className="w-4 h-4 text-amber-600" />}
                                <span className={`font-bold text-sm ${player.rank <= 3 ? 'text-white' : 'text-gray-400'}`}>#{player.rank}</span>
                              </div>
                              <img src={player.avatar || getDefaultAvatar(player.player)} alt="" className={`w-8 h-8 rounded-full ${player.rank <= 3 ? 'ring-2 ring-offset-1 ring-offset-dark-900 ' + (player.rank === 1 ? 'ring-yellow-500' : player.rank === 2 ? 'ring-gray-400' : 'ring-amber-600') : ''}`} />
                              <Link to={`/player/${player.id}`} className={`font-semibold text-sm hover:text-cyan-400 transition-colors ${player.rank === 1 ? 'text-yellow-500' : player.rank === 2 ? 'text-gray-300' : player.rank === 3 ? 'text-amber-600' : 'text-white'}`}>
                                {player.player}
                              </Link>
                            </div>
                            <span className="text-cyan-400 font-bold text-sm">{player.points.toLocaleString()} XP</span>
                          </div>
                        </div>
                      ))}
                      
                      {/* User's player position if not in top 10 */}
                      {myPlayerRank && (
                        <>
                          <div className="px-6 py-2 flex items-center justify-center gap-2">
                            <span className="text-gray-600 text-xs">• • •</span>
                          </div>
                          <div className="px-6 py-3 bg-gradient-to-r from-cyan-500/20 to-blue-500/10 border-t border-cyan-500/30">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 w-14">
                                  <span className="font-bold text-sm text-cyan-400">#{myPlayerRank.rank}</span>
                                </div>
                                <img 
                                  src={myPlayerRank.avatar || getDefaultAvatar(myPlayerRank.player)} 
                                  alt="" 
                                  className="w-8 h-8 rounded-full ring-2 ring-cyan-500/50" 
                                />
                                <Link to={`/player/${myPlayerRank.id}`} className="font-semibold text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
                                  {myPlayerRank.player}
                                  <span className="ml-2 text-[10px] uppercase tracking-wider text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">
                                    {language === 'fr' ? 'Toi' : 'You'}
                                  </span>
                                </Link>
                              </div>
                              <span className="text-cyan-400 font-bold text-sm">{myPlayerRank.points.toLocaleString()} XP</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Top Squads */}
              <div className="glass-card rounded-2xl overflow-hidden neon-border-cyan flex flex-col">
                <div className="px-6 py-4 border-b border-white/5 bg-gradient-to-r from-cyan-500/10 to-transparent">
                  <h3 className="font-display text-xl text-white flex items-center gap-3">
                    <Shield className="w-5 h-5 text-cyan-400" />
                    {language === 'fr' ? 'TOP 10 ESCOUADES' : 'TOP 10 SQUADS'}
                  </h3>
                </div>
                <div className="flex-1 min-h-[520px]">
                  {loadingSquads ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                    </div>
                  ) : topSquads.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">{language === 'fr' ? 'Aucune escouade classée' : 'No ranked squads'}</div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {topSquads.map((squad) => {
                        const isMySquadInList = mySquad && (squad.id === mySquad._id || squad.id === mySquad.id);
                        return (
                        <div key={squad.rank} className={`px-6 py-3 hover:bg-white/5 transition-all ${isMySquadInList ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10' : squad.rank <= 3 ? 'bg-gradient-to-r from-yellow-500/5 to-transparent' : ''}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 w-14">
                                {squad.rank === 1 && <Medal className="w-4 h-4 text-yellow-500" />}
                                {squad.rank === 2 && <Medal className="w-4 h-4 text-gray-400" />}
                                {squad.rank === 3 && <Medal className="w-4 h-4 text-amber-600" />}
                                <span className={`font-bold text-sm ${isMySquadInList ? 'text-cyan-400' : squad.rank <= 3 ? 'text-white' : 'text-gray-400'}`}>#{squad.rank}</span>
                              </div>
                              {squad.logo ? (
                                <img src={squad.logo} alt="" className={`w-8 h-8 rounded object-contain ${isMySquadInList ? 'ring-2 ring-cyan-500/50' : ''}`} />
                              ) : (
                                <div className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold ${isMySquadInList ? 'border-2 border-cyan-500/50' : 'border border-white/10'}`} style={{ backgroundColor: squad.color === 'transparent' ? 'transparent' : squad.color + '30', color: squad.color === 'transparent' ? '#9ca3af' : squad.color }}>
                                  {squad.tag?.charAt(0) || 'S'}
                                </div>
                              )}
                              <Link to={`/squad/${squad.id}`} className={`font-semibold text-sm hover:text-cyan-400 transition-colors ${isMySquadInList ? 'text-cyan-400' : squad.rank === 1 ? 'text-yellow-500' : squad.rank === 2 ? 'text-gray-300' : squad.rank === 3 ? 'text-amber-600' : 'text-white'}`}>
                                {squad.team}
                                {squad.tag && <span className={`${isMySquadInList ? 'text-cyan-400/60' : 'text-gray-500'} ml-1 text-xs`}>[{squad.tag}]</span>}
                                {isMySquadInList && (
                                  <span className="ml-2 text-[10px] uppercase tracking-wider text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">
                                    {language === 'fr' ? 'Ton équipe' : 'Your team'}
                                  </span>
                                )}
                              </Link>
                            </div>
                            <span className="text-cyan-400 font-bold text-sm">{squad.points.toLocaleString()} PTS</span>
                          </div>
                        </div>
                        );
                      })}
                      
                      {/* User's squad position if not in top 10 */}
                      {mySquadRank && (
                        <>
                          <div className="px-6 py-2 flex items-center justify-center gap-2">
                            <span className="text-gray-600 text-xs">• • •</span>
                          </div>
                          <div className="px-6 py-3 bg-gradient-to-r from-cyan-500/20 to-blue-500/10 border-t border-cyan-500/30">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 w-14">
                                  <span className="font-bold text-sm text-cyan-400">#{mySquadRank.rank}</span>
                                </div>
                                {mySquadRank.logo ? (
                                  <img src={mySquadRank.logo} alt="" className="w-8 h-8 rounded object-contain ring-2 ring-cyan-500/50" />
                                ) : (
                                  <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold border-2 border-cyan-500/50" style={{ backgroundColor: mySquadRank.color === 'transparent' ? 'transparent' : mySquadRank.color + '30', color: mySquadRank.color === 'transparent' ? '#9ca3af' : mySquadRank.color }}>
                                    {mySquadRank.tag?.charAt(0) || 'S'}
                                  </div>
                                )}
                                <Link to={`/squad/${mySquadRank.id}`} className="font-semibold text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
                                  {mySquadRank.team}
                                  {mySquadRank.tag && <span className="text-cyan-400/60 ml-1 text-xs">[{mySquadRank.tag}]</span>}
                                  <span className="ml-2 text-[10px] uppercase tracking-wider text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">
                                    {language === 'fr' ? 'Ton équipe' : 'Your team'}
                                  </span>
                                </Link>
                              </div>
                              <span className="text-cyan-400 font-bold text-sm">{mySquadRank.points.toLocaleString()} PTS</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Site Statistics */}
          <section className="mt-16 mb-8">
            <div className="max-w-5xl mx-auto glass-card rounded-2xl p-8 neon-border-cyan">
              <h2 className="text-2xl font-display text-white mb-6 text-center flex items-center justify-center gap-3">
                <Target className="w-6 h-6 text-cyan-400" />
                {txt.siteStatistics}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Players */}
                <div className="p-6 glass rounded-xl border border-cyan-500/30 hover:border-cyan-500/50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-cyan-500/20 rounded-xl">
                      <Users className="w-8 h-8 text-cyan-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-400 text-sm uppercase tracking-wider">{txt.totalPlayers}</p>
                      <p className="text-3xl font-bold text-white mt-1">{siteStats.totalUsers.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Total Matches */}
                <div className="p-6 glass rounded-xl border border-blue-500/30 hover:border-blue-500/50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/20 rounded-xl">
                      <Swords className="w-8 h-8 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-400 text-sm uppercase tracking-wider">{txt.totalMatches}</p>
                      <p className="text-3xl font-bold text-white mt-1">{siteStats.totalMatches.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Total Squads */}
                <div className="p-6 glass rounded-xl border border-neon-green/30 hover:border-neon-green/50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-neon-green/20 rounded-xl">
                      <Shield className="w-8 h-8 text-neon-green" />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-400 text-sm uppercase tracking-wider">{txt.totalSquads}</p>
                      <p className="text-3xl font-bold text-white mt-1">{siteStats.totalSquads.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Avg Matches Per Day */}
                <div className="p-6 glass rounded-xl border border-purple-500/30 hover:border-purple-500/50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-500/20 rounded-xl">
                      <Target className="w-8 h-8 text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-400 text-sm uppercase tracking-wider">{txt.avgMatchesPerDay}</p>
                      <p className="text-3xl font-bold text-white mt-1">{siteStats.avgMatchesPerDay}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>

      {/* Roster Selection Dialog */}
      {showRosterDialog && mySquad && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-card rounded-3xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto neon-border-cyan">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-display text-white flex items-center gap-3">
                <Users className="w-6 h-6 text-cyan-400" />
                {txt.selectRoster}
              </h3>
              <button
                onClick={() => { setShowRosterDialog(null); setPendingMatchAction(null); setSelectedRoster([]); setSelectedHelper(null); setHelperSearch(''); setHelperSearchResults([]); }}
                className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              {(() => {
                const requiredSize = showRosterDialog === 'accept' && pendingMatchAction?.teamSize ? pendingMatchAction.teamSize : matchForm.teamSize;
                const totalSelected = selectedRoster.length + (selectedHelper ? 1 : 0);
                const isComplete = totalSelected === requiredSize;
                return (
                  <p className={`text-xs uppercase tracking-wider mb-3 ${isComplete ? 'text-neon-green' : 'text-gray-400'}`}>
                    {txt.squadMembers} ({totalSelected}/{requiredSize})
                    {!isComplete && <span className="text-neon-red ml-2">({requiredSize - totalSelected} {language === 'fr' ? 'restant(s)' : 'remaining'})</span>}
                  </p>
                );
              })()}
              <p className="text-gray-500 text-sm mb-4">{txt.selectPlayers}</p>
              
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {mySquad.members?.map((member) => {
                  const memberUser = member.user;
                  const isSelected = selectedRoster.includes(memberUser._id);
                  const avatar = getAvatarUrl(memberUser.avatarUrl || memberUser.avatar) || getDefaultAvatar(memberUser.username);
                  
                  return (
                    <div
                      key={memberUser._id}
                      onClick={() => togglePlayerInRoster(memberUser._id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-cyan-500/20 border-cyan-500/50' : 'glass hover:bg-white/5'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-cyan-500 border-cyan-500' : 'border-gray-500'}`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <img src={avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm truncate">{memberUser.username}</p>
                          {memberUser.activisionId && <p className="text-gray-500 text-xs truncate">{memberUser.activisionId}</p>}
                        </div>
                        {memberUser.platform && (
                          <span className={`text-[10px] px-2 py-0.5 rounded ${memberUser.platform === 'PC' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                            {memberUser.platform}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Helper Section */}
            <div className="mb-6 pt-4 border-t border-white/10">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">{txt.helper} (0/1)</p>
              {selectedHelper ? (
                <div className="p-3 rounded-xl bg-yellow-500/20 border border-yellow-500/50">
                  <div className="flex items-center gap-3">
                    <img src={getAvatarUrl(selectedHelper.avatarUrl || selectedHelper.avatar) || getDefaultAvatar(selectedHelper.username)} alt="" className="w-9 h-9 rounded-full object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{selectedHelper.username}</p>
                      {selectedHelper.activisionId && <p className="text-gray-500 text-xs truncate">{selectedHelper.activisionId}</p>}
                    </div>
                    <button onClick={removeHelper} className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={helperSearch}
                    onChange={(e) => setHelperSearch(e.target.value)}
                    placeholder={txt.searchPlaceholder}
                    className="w-full px-4 py-3 glass rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
                  />
                  {searchingHelper && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 animate-spin" />}
                  
                  {helperSearchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 glass rounded-xl overflow-hidden z-10 shadow-xl">
                      {helperSearchResults.map((user) => (
                        <div key={user._id} onClick={() => selectHelper(user)} className="p-3 hover:bg-white/5 cursor-pointer flex items-center gap-3">
                          <img src={getAvatarUrl(user.avatarUrl || user.avatar) || getDefaultAvatar(user.username)} alt="" className="w-8 h-8 rounded-full object-cover" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm truncate">{user.username}</p>
                            {user.activisionId && <p className="text-gray-500 text-xs truncate">{user.activisionId}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {rosterError && (
              <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl">
                <p className="text-red-400 text-sm font-medium">{rosterError}</p>
              </div>
            )}

            {(() => {
              const requiredSize = showRosterDialog === 'accept' && pendingMatchAction?.teamSize ? pendingMatchAction.teamSize : matchForm.teamSize;
              const totalSelected = selectedRoster.length + (selectedHelper ? 1 : 0);
              const isValidRoster = totalSelected === requiredSize;
              
              // Show waiting state for helper confirmation
              if (waitingHelperConfirmation) {
                return (
                  <div className="space-y-3">
                    <div className="p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-xl">
                      <div className="flex items-center gap-3 mb-2">
                        <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
                        <span className="text-yellow-400 font-medium">{txt.waitingHelperConfirmation}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-yellow-400" />
                        <span className="text-yellow-400 text-sm font-bold">{helperConfirmationTimeLeft}{txt.secondsLeft}</span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-3 h-2 bg-dark-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-1000 ease-linear"
                          style={{ width: `${(helperConfirmationTimeLeft / 30) * 100}%` }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setWaitingHelperConfirmation(false);
                        setHelperConfirmationId(null);
                      }}
                      className="w-full py-3 glass border border-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
                    >
                      {txt.cancel}
                    </button>
                  </div>
                );
              }
              
              return (
                <button
                  onClick={handleConfirmRoster}
                  disabled={!isValidRoster || postingMatch || acceptingMatch || checkingAnticheat}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {(postingMatch || acceptingMatch || checkingAnticheat) ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : !isValidRoster ? (
                    <span>{language === 'fr' ? `Sélectionnez ${requiredSize} joueurs` : `Select ${requiredSize} players`}</span>
                  ) : (
                    txt.confirm
                  )}
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* View Roster Dialog (for new squads) */}
      {viewingRoster && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-card rounded-3xl p-6 max-w-md w-full shadow-2xl max-h-[80vh] overflow-y-auto border border-yellow-500/30">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-yellow-500/20">
                  <Users className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-lg font-display text-white">{viewingRoster.match?.challenger?.name}</h3>
                  <p className="text-yellow-400 text-xs flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {txt.newSquad}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingRoster(null)}
                className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Squad info */}
            {viewingRoster.match?.challenger?.createdAt && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <p className="text-gray-400 text-xs">
                  {txt.teamCreatedOn}: <span className="text-white font-medium">
                    {new Date(viewingRoster.match.challenger.createdAt).toLocaleDateString(language, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </p>
              </div>
            )}

            {/* Roster */}
            <div className="mb-4">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">{txt.rosterPlayers} ({viewingRoster.roster?.length || 0})</p>
              <div className="space-y-2">
                {viewingRoster.roster && viewingRoster.roster.length > 0 ? (
                  viewingRoster.roster.map((player, idx) => {
                    const playerUser = player.user || player;
                    const avatar = getAvatarUrl(playerUser.avatarUrl || playerUser.avatar) || getDefaultAvatar(playerUser.username);
                    return (
                      <div key={playerUser._id || idx} className="p-3 glass rounded-xl flex items-center gap-3">
                        <img src={avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm truncate">{playerUser.username}</p>
                          {playerUser.activisionId && <p className="text-gray-500 text-xs truncate">{playerUser.activisionId}</p>}
                        </div>
                        {playerUser.platform && (
                          <span className={`text-[10px] px-2 py-0.5 rounded ${playerUser.platform === 'PC' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                            {playerUser.platform}
                          </span>
                        )}
                        {player.isHelper && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                            {txt.helper}
                          </span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-gray-500 text-sm text-center py-4">{language === 'fr' ? 'Roster non disponible' : 'Roster not available'}</p>
                )}
              </div>
            </div>

            <button
              onClick={() => setViewingRoster(null)}
              className="w-full py-3 glass border border-white/10 rounded-xl text-white font-medium hover:bg-white/5 transition-colors"
            >
              {txt.close}
            </button>
          </div>
        </div>
      )}

      {/* New Squad Approval Dialog (for match poster) */}
      {newSquadApprovalRequest && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="glass-card rounded-3xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto border-2 border-yellow-500/50 animate-pulse-slow">
            {/* Header with warning */}
            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-yellow-500 blur-xl opacity-40 animate-pulse" />
                <div className="relative w-14 h-14 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-display text-white">{txt.newSquadApprovalTitle}</h3>
                <p className="text-yellow-400 text-sm">{txt.newSquadApprovalDesc}</p>
              </div>
            </div>

            {/* Countdown timer */}
            <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-yellow-400 text-sm font-medium">{language === 'fr' ? 'Temps restant' : 'Time remaining'}</span>
                <span className={`text-lg font-bold ${newSquadApprovalTimeLeft <= 10 ? 'text-neon-red animate-pulse' : 'text-yellow-400'}`}>
                  {newSquadApprovalTimeLeft}s
                </span>
              </div>
              <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ease-linear ${newSquadApprovalTimeLeft <= 10 ? 'bg-neon-red' : 'bg-gradient-to-r from-yellow-500 to-orange-500'}`}
                  style={{ width: `${(newSquadApprovalTimeLeft / 30) * 100}%` }}
                />
              </div>
            </div>

            {/* Requesting squad info */}
            <div className="mb-6 p-4 glass rounded-xl">
              <div className="flex items-center gap-4 mb-4">
                {newSquadApprovalRequest.requestingSquad?.logo ? (
                  <img src={newSquadApprovalRequest.requestingSquad.logo} alt="" className="w-12 h-12 rounded-xl object-cover" />
                ) : (
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
                    style={{ backgroundColor: (newSquadApprovalRequest.requestingSquad?.color || '#06b6d4') + '30', color: newSquadApprovalRequest.requestingSquad?.color || '#06b6d4' }}
                  >
                    {newSquadApprovalRequest.requestingSquad?.tag?.charAt(0) || 'S'}
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-white font-bold text-lg">{newSquadApprovalRequest.requestingSquad?.name}</p>
                  {newSquadApprovalRequest.requestingSquad?.tag && (
                    <p className="text-gray-400 text-sm">[{newSquadApprovalRequest.requestingSquad.tag}]</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-yellow-400 text-xs font-semibold">{txt.newSquad}</p>
                  <p className="text-gray-500 text-xs">
                    {newSquadApprovalRequest.requestingSquad?.createdAt && 
                      new Date(newSquadApprovalRequest.requestingSquad.createdAt).toLocaleDateString(language, { day: 'numeric', month: 'short' })
                    }
                  </p>
                </div>
              </div>

              {/* Match info */}
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span className="px-2 py-1 bg-cyan-500/20 rounded text-cyan-400 text-xs">{newSquadApprovalRequest.gameMode}</span>
                <span className="px-2 py-1 bg-white/10 rounded text-white text-xs">{newSquadApprovalRequest.teamSize}v{newSquadApprovalRequest.teamSize}</span>
              </div>
            </div>

            {/* Roster preview */}
            <div className="mb-6">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">{txt.rosterPlayers} ({newSquadApprovalRequest.roster?.length || 0})</p>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {newSquadApprovalRequest.roster && newSquadApprovalRequest.roster.length > 0 ? (
                  newSquadApprovalRequest.roster.map((player, idx) => {
                    const avatar = getAvatarUrl(player.avatarUrl || player.avatar) || getDefaultAvatar(player.username);
                    return (
                      <div key={player._id || idx} className="p-3 glass rounded-xl flex items-center gap-3">
                        <img src={avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm truncate">{player.username}</p>
                          {player.activisionId && <p className="text-gray-500 text-xs truncate">{player.activisionId}</p>}
                        </div>
                        {player.platform && (
                          <span className={`text-[10px] px-2 py-0.5 rounded ${player.platform === 'PC' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                            {player.platform}
                          </span>
                        )}
                        {player.isHelper && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                            {txt.helper}
                          </span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-gray-500 text-sm text-center py-4">{language === 'fr' ? 'Roster non disponible' : 'Roster not available'}</p>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => handleRespondToNewSquadApproval(false)}
                disabled={respondingToApproval}
                className="flex-1 py-4 glass border border-red-500/30 rounded-xl text-red-400 font-bold hover:bg-red-500/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {respondingToApproval ? <Loader2 className="w-5 h-5 animate-spin" /> : <Ban className="w-5 h-5" />}
                {txt.rejectMatch}
              </button>
              <button
                onClick={() => handleRespondToNewSquadApproval(true)}
                disabled={respondingToApproval}
                className="flex-1 py-4 bg-gradient-to-r from-neon-green to-emerald-600 rounded-xl text-white font-bold hover:scale-105 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {respondingToApproval ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserCheck className="w-5 h-5" />}
                {txt.acceptMatch}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CDLDashboard;
