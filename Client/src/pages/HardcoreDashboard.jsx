import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { getDefaultAvatar } from '../utils/avatar';
import { io } from 'socket.io-client';
import { Trophy, Users, Skull, Medal, Target, ChevronLeft, ChevronRight, Crown, Clock, MapPin, Shuffle, Play, Filter, X, Coins, Loader2, Shield, Plus, Swords, AlertTriangle, Check, Zap } from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';
const SOCKET_URL = 'https://api-nomercy.ggsecure.io';

const HardcoreDashboard = () => {
  const { language, t } = useLanguage();
  const { selectedMode } = useMode();
  const { user, isAuthenticated } = useAuth();
  const scrollRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Local translations
  const txt = {
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
      duoTrio: 'Duo / Trio',
      squadTeam: 'Squad / Team',
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
      duoTrio: 'Duo / Trio',
      squadTeam: 'Squad / Team',
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
      duoTrio: 'Duo / Trio',
      squadTeam: 'Squad / Team',
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
      rematchCooldown: '⏱️ Rematch-Abklingzeit nicht erfüllt! Sie haben dieses Team kürzlich bereits bekämpft. Sie können sie erneut bekämpfen in',
      hourUnit: ' Std.',
      minuteUnit: ' Min.',
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
      duoTrio: 'Duo / Trio',
      squadTeam: 'Squad / Team',
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
      rematchCooldown: '⏱️ Tempo di attesa non rispettato! Hai già affrontato questa squadra di recente. Potrai affrontarli di nuovo tra',
      hourUnit: 'h',
      minuteUnit: 'min',
    },
  }[language] || {
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
    duoTrio: 'Duo / Trio',
    squadTeam: 'Squad / Team',
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
  };
  
  // Matchmaking states
  const [mySquad, setMySquad] = useState(null);
  const mySquadRef = useRef(null); // Ref to access current mySquad in socket callbacks
  const [squadTeamMatches, setSquadTeamMatches] = useState([]);
  const [duoTrioMatches, setDuoTrioMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(true); // Initial load only
  const socketRef = useRef(null);
  const [onlineViewers, setOnlineViewers] = useState(0);
  const [showPostMatch, setShowPostMatch] = useState(null); // 'form' or null
  const [postingMatch, setPostingMatch] = useState(false);
  const [acceptingMatch, setAcceptingMatch] = useState(null);
  const [matchMessage, setMatchMessage] = useState({ type: '', text: '' });
  const [matchForm, setMatchForm] = useState({
    ladder: '',
    gameMode: 'Search & Destroy',
    teamSize: 5,
    mapType: 'free' // 'random' = aléatoire, 'free' = libre
  });
  
  // Roster selection states
  const [showRosterDialog, setShowRosterDialog] = useState(null); // 'post' | 'accept' | null
  const [selectedRoster, setSelectedRoster] = useState([]);
  const [selectedHelper, setSelectedHelper] = useState(null);
  const [helperSearch, setHelperSearch] = useState('');
  const [helperSearchResults, setHelperSearchResults] = useState([]);
  const [searchingHelper, setSearchingHelper] = useState(false);
  const [pendingMatchAction, setPendingMatchAction] = useState(null); // { type: 'post' | 'accept', matchId?, ladderId? }
  const [rosterError, setRosterError] = useState('');
  const [checkingAnticheat, setCheckingAnticheat] = useState(false);
  
  // Modes disponibles en Hardcore avec traductions
  const gameModeTranslations = {
    'hardcoreSND': t('hardcoreSND'),
    'hardcoreDom': t('hardcoreDom'),
    'hardcoreTDM': t('hardcoreTDM'),
    'hardcoreKC': t('hardcoreKC'),
  };
  
  const availableModes = ['hardcoreSND', 'hardcoreDom', 'hardcoreTDM'];
  
  // Charger les filtres depuis localStorage (tous sélectionnés par défaut)
  const [activeModes, setActiveModes] = useState(() => {
    const saved = localStorage.getItem('hardcoreMatchFilters');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return availableModes;
      }
    }
    return availableModes;
  });
  
  // Set page title
  useEffect(() => {
    const titles = {
      fr: 'NoMercy - Hardcore',
      en: 'NoMercy - Hardcore',
      it: 'NoMercy - Hardcore',
      de: 'NoMercy - Hardcore',
    };
    document.title = titles[language] || titles.en;
  }, [language]);
  
  // Sauvegarder dans localStorage quand les filtres changent
  useEffect(() => {
    localStorage.setItem('hardcoreMatchFilters', JSON.stringify(activeModes));
  }, [activeModes]);
  
  const toggleMode = (mode) => {
    setActiveModes(prev => {
      if (prev.includes(mode)) {
        // Ne pas permettre de tout désactiver
        if (prev.length === 1) return prev;
        return prev.filter(m => m !== mode);
      } else {
        return [...prev, mode];
      }
    });
  };
  
  const selectAllModes = () => setActiveModes(availableModes);
  const clearAllModes = () => setActiveModes([availableModes[0]]);

  // Traductions des modes de jeu pour l'API
  const gameModeApiNames = {
    fr: {
      'Search & Destroy': 'Recherche & Destruction',
      'Domination': 'Domination',
      'Team Deathmatch': 'Mêlée générale',
    },
    en: {
      'Search & Destroy': 'Search & Destroy',
      'Domination': 'Domination',
      'Team Deathmatch': 'Team Deathmatch',
    },
  };

  const getGameModeName = (mode) => {
    return gameModeApiNames[language]?.[mode] || gameModeApiNames['en'][mode] || mode;
  };

  // Fetch my squad
  useEffect(() => {
    const fetchMySquad = async () => {
      if (!isAuthenticated) return;
      try {
        const response = await fetch(`${API_URL}/squads/my-squad`, {
          credentials: 'include'
        });
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

  // Fetch matches for all ladders
  const fetchMatches = async (isInitial = false) => {
    if (isInitial) setLoadingMatches(true);
    try {
      // Fetch squad-team matches
      const squadRes = await fetch(`${API_URL}/matches/available/squad-team?mode=hardcore`);
      const squadData = await squadRes.json();
      if (squadData.success) setSquadTeamMatches(squadData.matches);
      
      // Fetch duo-trio matches
      const duoRes = await fetch(`${API_URL}/matches/available/duo-trio?mode=hardcore`);
      const duoData = await duoRes.json();
      if (duoData.success) setDuoTrioMatches(duoData.matches);
    } catch (err) {
      console.error('Error fetching matches:', err);
    } finally {
      if (isInitial) setLoadingMatches(false);
    }
  };

  useEffect(() => {
    fetchMatches(true); // Initial load with spinner
    
    // Refresh every 30 seconds (silent)
    const interval = setInterval(() => fetchMatches(false), 30000);
    return () => clearInterval(interval);
  }, []);

  // Socket.io connection for real-time match updates
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 Dashboard connected to socket');
      // Join the dashboard page for viewer count
      socket.emit('joinPage', { page: 'hardcore-dashboard' });
    });

    // Real-time viewer count
    socket.on('viewerCount', (count) => {
      setOnlineViewers(count);
    });

    // New match posted
    socket.on('matchCreated', (data) => {
      console.log('📢 New match created:', data);
      if (data.mode === 'hardcore') {
        if (data.ladderId === 'squad-team') {
          setSquadTeamMatches(prev => [data.match, ...prev]);
        } else if (data.ladderId === 'duo-trio') {
          setDuoTrioMatches(prev => [data.match, ...prev]);
        }
      }
    });

    // Match accepted (remove from available list + add to active if it's my squad)
    socket.on('matchAccepted', (data) => {
      console.log('✅ Match accepted:', data);
      if (data.mode === 'hardcore') {
        // Remove from available lists
        if (data.ladderId === 'squad-team') {
          setSquadTeamMatches(prev => prev.filter(m => m._id !== data.matchId));
        } else if (data.ladderId === 'duo-trio') {
          setDuoTrioMatches(prev => prev.filter(m => m._id !== data.matchId));
        }
        
        // If it's my squad's match, add to active matches
        const currentSquad = mySquadRef.current;
        if (data.match && currentSquad) {
          const isMyMatch = 
            data.match.challenger?._id === currentSquad._id || 
            data.match.opponent?._id === currentSquad._id;
          if (isMyMatch) {
            setMyActiveMatches(prev => {
              // Avoid duplicates
              if (prev.some(m => m._id === data.match._id)) return prev;
              return [data.match, ...prev];
            });
          }
        }
      }
    });

    // Match cancelled (remove from available list)
    socket.on('matchCancelled', (data) => {
      console.log('❌ Match cancelled:', data);
      if (data.mode === 'hardcore') {
        if (data.ladderId === 'squad-team') {
          setSquadTeamMatches(prev => prev.filter(m => m._id !== data.matchId));
        } else if (data.ladderId === 'duo-trio') {
          setDuoTrioMatches(prev => prev.filter(m => m._id !== data.matchId));
        }
      }
    });

    return () => {
      socket.emit('leavePage', { page: 'hardcore-dashboard' });
      socket.disconnect();
    };
  }, []);

  // Post a match
  // Ouvre le dialog de roster avant de poster un match
  const handleOpenPostRoster = (e, ladderId, gameMode) => {
    e.preventDefault();
    if (!mySquad) return;
    setPendingMatchAction({ type: 'post', ladderId, gameMode });
    setSelectedRoster([]);
    setSelectedHelper(null);
    setRosterError('');
    setShowRosterDialog('post');
  };

  // Poste le match avec le roster sélectionné
  const handlePostMatch = async (ladderId, roster, gameMode) => {
    if (!mySquad) return false;

    setPostingMatch(true);
    try {
      const response = await fetch(`${API_URL}/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ladderId,
          gameMode: gameMode || matchForm.gameMode,
          teamSize: matchForm.teamSize,
          isReady: true, // Always ready immediately
          mapType: matchForm.mapType,
          roster: roster
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setMatchMessage({ type: 'success', text: txt.postMatch + ' ✓' });
        setShowPostMatch(null);
        setMatchForm({ ladder: 'squad-team', gameMode: 'Search & Destroy', teamSize: 4, mapType: 'free' });
        // Refresh matches for the posted ladder
        const res = await fetch(`${API_URL}/matches/available/${ladderId}?mode=hardcore`);
        const resData = await res.json();
        if (resData.success) {
          if (ladderId === 'squad-team') {
            setSquadTeamMatches(resData.matches);
          } else if (ladderId === 'duo-trio') {
            setDuoTrioMatches(resData.matches);
          }
        }
        setTimeout(() => setMatchMessage({ type: '', text: '' }), 3000);
        return true;
      } else {
        // Afficher l'erreur dans le dialogue de roster
        setRosterError(data.message);
        return false;
      }
    } catch (err) {
      console.error('Error posting match:', err);
      setRosterError(language === 'fr' ? 'Erreur serveur' : language === 'de' ? 'Serverfehler' : language === 'it' ? 'Errore server' : 'Server error');
      return false;
    } finally {
      setPostingMatch(false);
    }
  };

  // Accept a match
  // Ouvre le dialog de roster avant d'accepter un match
  const handleOpenAcceptRoster = (matchId, ladderId, teamSize) => {
    setPendingMatchAction({ type: 'accept', matchId, ladderId, teamSize });
    setSelectedRoster([]);
    setSelectedHelper(null);
    setRosterError('');
    setShowRosterDialog('accept');
  };

  // Accepte le match avec le roster sélectionné
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
        
        // Refresh available matches
        const res = await fetch(`${API_URL}/matches/available/${ladderId}?mode=hardcore`);
        const resData = await res.json();
        if (resData.success) {
          setSquadTeamMatches(resData.matches);
        }
        
        // Refresh my active matches immediately (small delay to ensure server processed)
        setTimeout(async () => {
          await fetchMyActiveMatches();
        }, 500);
        
        setTimeout(() => setMatchMessage({ type: '', text: '' }), 3000);
        return true;
      } else {
        // Gérer les codes d'erreur spécifiques
        if (data.errorCode === 'REMATCH_COOLDOWN' && data.cooldownData) {
          const { hours, minutes } = data.cooldownData;
          let timeString = '';
          if (hours > 0 && minutes > 0) {
            timeString = `${hours}${txt.hourUnit} ${minutes}${txt.minuteUnit}`;
          } else if (hours > 0) {
            timeString = `${hours}${txt.hourUnit}`;
          } else {
            timeString = `${minutes}${txt.minuteUnit}`;
          }
          setRosterError(`${txt.rematchCooldown} ${timeString}.`);
        } else {
          // Afficher l'erreur dans le dialogue de roster
          setRosterError(data.message);
        }
        return false;
      }
    } catch (err) {
      console.error('Error accepting match:', err);
      setRosterError(language === 'fr' ? 'Erreur serveur' : language === 'de' ? 'Serverfehler' : language === 'it' ? 'Errore server' : 'Server error');
      return false;
    } finally {
      setAcceptingMatch(null);
    }
  };

  // Check GGSecure status for a player
  const checkPlayerAnticheat = async (playerId) => {
    try {
      const response = await fetch(`${API_URL}/users/anticheat-status/${playerId}`);
      const data = await response.json();
      return data.isOnline || false;
    } catch (error) {
      console.error('Error checking anticheat status:', error);
      return false;
    }
  };

  // Confirme le roster et exécute l'action (post ou accept)
  const handleConfirmRoster = async () => {
    setRosterError('');
    setCheckingAnticheat(true);
    
    try {
      // Get all selected players (squad members + helper)
      const allSelectedPlayers = [
        ...selectedRoster.map(userId => {
          const member = mySquad?.members?.find(m => (m.user._id || m.user.id) === userId);
          return member?.user;
        }).filter(Boolean),
        ...(selectedHelper ? [selectedHelper] : [])
      ];
      
      console.log('[GGSecure Check] All selected players:', allSelectedPlayers);
      
      // Check PC players for GGSecure connection
      const pcPlayers = allSelectedPlayers.filter(p => p?.platform === 'PC');
      console.log('[GGSecure Check] PC players:', pcPlayers);
      
      if (pcPlayers.length > 0) {
        const disconnectedPlayers = [];
        
        for (const player of pcPlayers) {
          const playerId = player._id || player.id;
          const isOnline = await checkPlayerAnticheat(playerId);
          if (!isOnline) {
            disconnectedPlayers.push(player.username);
          }
        }
        
        if (disconnectedPlayers.length > 0) {
          const errorMsg = language === 'fr' 
            ? `GGSecure non connecté : ${disconnectedPlayers.join(', ')}`
            : `GGSecure not connected: ${disconnectedPlayers.join(', ')}`;
          setRosterError(errorMsg);
          setCheckingAnticheat(false);
          return;
        }
      }
      
      const roster = [
        ...selectedRoster.map(userId => ({ user: userId, isHelper: false })),
        ...(selectedHelper ? [{ user: selectedHelper._id, isHelper: true }] : [])
      ];
      
      const action = pendingMatchAction;
      
      // Exécuter l'action AVANT de fermer le dialog
      let actionSuccess = false;
      if (action?.type === 'post') {
        actionSuccess = await handlePostMatch(action.ladderId, roster, action.gameMode);
      } else if (action?.type === 'accept') {
        actionSuccess = await handleAcceptMatch(action.matchId, action.ladderId, roster);
      }
      
      // Fermer le dialog SEULEMENT si l'action a réussi
      if (actionSuccess) {
        setShowRosterDialog(null);
        setPendingMatchAction(null);
        setSelectedRoster([]);
        setSelectedHelper(null);
        setHelperSearch('');
        setHelperSearchResults([]);
        setRosterError('');
      }
    } catch (error) {
      console.error('Error confirming roster:', error);
      setRosterError(language === 'fr' ? 'Erreur lors de la vérification' : language === 'de' ? 'Fehler bei der Überprüfung' : language === 'it' ? 'Errore durante la verifica' : 'Verification error');
    } finally {
      setCheckingAnticheat(false);
    }
  };

  // Toggle player selection in roster (squad members only)
  const togglePlayerInRoster = (userId) => {
    setSelectedRoster(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      }
      // Check max players based on team size (use pendingMatchAction.teamSize when accepting a match)
      const maxPlayers = showRosterDialog === 'accept' && pendingMatchAction?.teamSize 
        ? pendingMatchAction.teamSize 
        : matchForm.teamSize;
      // Account for helper in the count
      const currentTotal = prev.length + (selectedHelper ? 1 : 0);
      if (currentTotal >= maxPlayers) return prev;
      return [...prev, userId];
    });
  };

  // Search for external helper
  const searchForHelper = async (query) => {
    if (!query || query.length < 2) {
      setHelperSearchResults([]);
      return;
    }
    
    setSearchingHelper(true);
    try {
      const response = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}&limit=5`);
      const data = await response.json();
      if (data.success) {
        // Filter out squad members
        const squadMemberIds = mySquad?.members?.map(m => m.user._id) || [];
        setHelperSearchResults(data.users.filter(u => !squadMemberIds.includes(u._id)));
      }
    } catch (err) {
      console.error('Error searching users:', err);
    } finally {
      setSearchingHelper(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchForHelper(helperSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [helperSearch]);

  // Select helper from search results
  const selectHelper = (user) => {
    setSelectedHelper(user);
    setHelperSearch('');
    setHelperSearchResults([]);
  };

  // Remove helper
  const removeHelper = () => {
    setSelectedHelper(null);
  };

  // Cancel a match
  const handleCancelMatch = async (matchId, ladderId) => {
    try {
      const response = await fetch(`${API_URL}/matches/${matchId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();
      
      if (data.success) {
        setMatchMessage({ type: 'success', text: txt.cancel + ' ✓' });
        // Refresh matches
        const res = await fetch(`${API_URL}/matches/available/${ladderId}?mode=hardcore`);
        const resData = await res.json();
        if (resData.success) {
          setSquadTeamMatches(resData.matches);
        }
        setTimeout(() => setMatchMessage({ type: '', text: '' }), 3000);
      }
    } catch (err) {
      console.error('Error cancelling match:', err);
    }
  };

  // Format time remaining
  const formatTimeRemaining = (date) => {
    const now = new Date();
    const matchDate = new Date(date);
    const diff = matchDate - now;
    
    if (diff < 0) return '—';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}j ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
  };

  // Get game modes for a ladder
  const getGameModesForLadder = (ladderId) => {
    return ['Search & Destroy'];
  };

  // Check if squad is registered to a ladder
  const isRegisteredToLadder = (ladderId) => {
    return mySquad?.registeredLadders?.some(l => l.ladderId === ladderId);
  };

  // Check if duo-trio is currently open (00:00 - 20:00 French time)
  const isDuoTrioOpen = () => {
    const now = new Date();
    // Get current hour in Paris timezone
    const parisHour = parseInt(new Date().toLocaleString('en-US', { 
      timeZone: 'Europe/Paris', 
      hour: 'numeric', 
      hour12: false 
    }));
    return parisHour < 20; // Open from 00:00 to 20:00
  };

  // État pour les matchs en cours (de mon escouade)
  const [myActiveMatches, setMyActiveMatches] = useState([]);

  // Fonction pour récupérer les matchs en cours de mon escouade
  const fetchMyActiveMatches = async () => {
    if (!mySquad) return;
    try {
      const response = await fetch(`${API_URL}/matches/my-active`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setMyActiveMatches(data.matches);
      }
    } catch (err) {
      console.error('Error fetching my active matches:', err);
    }
  };

  // Auto-refresh des matchs toutes les 30 secondes
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      fetchMatches();
      if (mySquad) {
        fetchMyActiveMatches();
      }
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [mySquad]);

  // Fetch active matches when squad changes
  useEffect(() => {
    if (mySquad) {
      fetchMyActiveMatches();
    }
  }, [mySquad]);

  // Composant pour le compte à rebours en temps réel
  const ReadyCountdown = ({ createdAt }) => {
    const [remaining, setRemaining] = useState(() => {
      const created = new Date(createdAt);
      const expiresAt = new Date(created.getTime() + 10 * 60 * 1000);
      return Math.max(0, Math.floor((expiresAt - new Date()) / 1000));
    });

    useEffect(() => {
      const interval = setInterval(() => {
        const created = new Date(createdAt);
        const expiresAt = new Date(created.getTime() + 10 * 60 * 1000);
        const newRemaining = Math.max(0, Math.floor((expiresAt - new Date()) / 1000));
        setRemaining(newRemaining);
        
        // Refresh la liste si expiré (silencieux)
        if (newRemaining === 0) {
          fetchMatches(false);
        }
      }, 1000);

      return () => clearInterval(interval);
    }, [createdAt]);

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;

    return (
      <div className="flex items-center space-x-1 sm:space-x-2">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        <span className="text-green-400 text-xs sm:text-sm font-semibold">GO</span>
        <span className={`text-[10px] sm:text-xs ${remaining < 60 ? 'text-red-400' : 'text-gray-400'}`}>
          {minutes}:{seconds.toString().padStart(2, '0')}
        </span>
      </div>
    );
  };

  // Render match card component
  const renderMatchCard = (match, ladder, isMyMatch, isActiveMatch = false) => {
    const canCancel = match.isReady || !match.scheduledAt || 
      (new Date(match.scheduledAt) - new Date()) > 5 * 60 * 1000;
    
    return (
      <div key={match._id} className={`bg-dark-900/80 backdrop-blur-xl rounded-xl p-3 sm:p-4 transition-all duration-300 ${
        isActiveMatch 
          ? 'border-2 border-green-500/50 hover:border-green-500/70 shadow-lg shadow-green-500/10'
          : isMyMatch 
            ? 'border-2 border-red-500/40 hover:border-red-500/60' 
            : 'border border-white/10 hover:border-red-500/40'
      }`}>
        {/* Mobile Layout */}
        <div className="flex flex-col sm:hidden gap-3">
          {/* Top row - Mode & Map */}
          <div className="flex items-center justify-between gap-2">
            <span className="px-2 py-1 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-xs font-semibold truncate max-w-[120px]">
              {getGameModeName(match.gameMode)}
            </span>
            <span className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${
              match.mapType === 'random' 
                ? 'bg-purple-500/20 border border-purple-500/30 text-purple-400'
                : 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400'
            }`}>
              {match.mapType === 'random' ? <Shuffle className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
              {match.mapType === 'random' ? txt.random.slice(0,4) : txt.free}
            </span>
            <span className="text-white text-xs font-bold">{match.teamSize}v{match.teamSize}</span>
          </div>
          
          {/* Middle row - Status/Time & Coins */}
          <div className="flex items-center justify-between">
            {isActiveMatch ? (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400 text-xs font-semibold">{txt.inProgress}</span>
              </div>
            ) : match.isReady ? (
              <ReadyCountdown createdAt={match.createdAt} />
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
              <span className="text-yellow-400 text-xs font-semibold">+50</span>
            </div>
          </div>
          
          {/* Teams display (mobile) */}
          {(isActiveMatch || match.opponent) && match.challenger && match.opponent && (
            <div className="flex items-center justify-center gap-2 px-2 py-1.5 bg-gradient-to-r from-purple-500/10 via-pink-500/20 to-purple-500/10 border border-purple-500/40 rounded-lg">
              <span className={`text-xs font-bold truncate max-w-[80px] ${match.challenger._id === mySquad?._id ? 'text-yellow-400' : 'text-white'}`}>
                {match.challenger.name}
              </span>
              <span className="text-pink-400 text-[10px] font-black px-1.5 py-0.5 bg-pink-500/30 rounded">VS</span>
              <span className={`text-xs font-bold truncate max-w-[80px] ${match.opponent._id === mySquad?._id ? 'text-yellow-400' : 'text-white'}`}>
                {match.opponent.name}
              </span>
            </div>
          )}
          
          {/* Action Button (mobile) */}
          <div className="flex justify-end">
            {isActiveMatch ? (
              <Link to={`/match/${match._id}`} className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg text-white font-bold text-xs">
                <Play className="w-3 h-3 inline mr-1" />{txt.viewMatch}
              </Link>
            ) : isMyMatch ? (
              canCancel ? (
                <button onClick={() => handleCancelMatch(match._id, ladder)} className="px-3 py-1.5 bg-dark-700 border border-red-500/30 rounded-lg text-red-400 text-xs">
                  {txt.cancel}
                </button>
              ) : (
                <span className="px-3 py-1.5 bg-dark-800 border border-white/10 rounded-lg text-gray-500 text-xs">🔒</span>
              )
            ) : isAuthenticated && mySquad && isRegisteredToLadder(ladder) ? (
              <button onClick={() => handleOpenAcceptRoster(match._id, ladder, match.teamSize)} disabled={acceptingMatch === match._id}
                className={`px-4 py-2 rounded-lg text-white font-bold text-xs ${match.isReady ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-orange-600'}`}>
                {acceptingMatch === match._id ? <Loader2 className="w-3 h-3 animate-spin" /> : match.isReady ? txt.play : txt.go}
              </button>
            ) : (
              <span className="px-3 py-1.5 text-gray-500 text-xs">{txt.notRegistered}</span>
            )}
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex items-center justify-between">
          <div className="flex items-center space-x-4 lg:space-x-6 flex-1">
            <div className="min-w-[100px] lg:min-w-[140px]">
              <span className="px-2 lg:px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-xs font-semibold">
                {getGameModeName(match.gameMode)}
              </span>
            </div>
            <div className="min-w-[70px] lg:min-w-[90px]">
              <span className={`px-2 lg:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                match.mapType === 'random' ? 'bg-purple-500/20 border border-purple-500/30 text-purple-400' : 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400'
              }`}>
                {match.mapType === 'random' ? <Shuffle className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                <span className="hidden lg:inline">{match.mapType === 'random' ? txt.random : txt.free}</span>
                <span className="lg:hidden">{match.mapType === 'random' ? txt.random.slice(0,3) : txt.free}</span>
              </span>
            </div>
            <div className="flex items-center space-x-2 min-w-[140px] lg:min-w-[200px]">
              {isActiveMatch ? (
                <><div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div><span className="text-green-400 text-sm font-semibold">{txt.inProgress}</span></>
              ) : match.isReady ? (
                <ReadyCountdown createdAt={match.createdAt} />
              ) : (
                <><Clock className="w-4 h-4 text-blue-400" /><span className="text-white text-sm font-medium">{new Date(match.scheduledAt).toLocaleString(language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></>
              )}
            </div>
            <div className="flex items-center space-x-2 min-w-[50px] lg:min-w-[70px]">
              <Users className="w-4 h-4 text-orange-400" />
              <span className="text-white text-sm font-medium">{match.teamSize}v{match.teamSize}</span>
            </div>
            <div className="flex items-center space-x-1.5 min-w-[50px] lg:min-w-[60px]">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 text-sm font-semibold">+50</span>
            </div>
            {isMyMatch && !isActiveMatch && !match.opponent && (
              <span className="px-2 py-1 bg-red-500/20 rounded-lg text-red-400 text-xs font-bold hidden lg:inline">{txt.yourMatch}</span>
            )}
          </div>
          {(isActiveMatch || match.opponent) && match.challenger && match.opponent && (
            <div className="flex items-center gap-2 mr-2 lg:mr-4">
              <div className="flex items-center gap-1 lg:gap-2 px-2 lg:px-3 py-1.5 lg:py-2 bg-gradient-to-r from-purple-500/10 via-pink-500/20 to-purple-500/10 border border-purple-500/40 rounded-lg lg:rounded-xl relative overflow-hidden">
                <Link to={`/squad/${match.challenger._id}`} className={`relative text-xs lg:text-sm font-bold ${match.challenger._id === mySquad?._id ? 'text-yellow-400' : 'text-white hover:text-purple-400'}`}>
                  {match.challenger.name}
                </Link>
                <span className="text-pink-400 text-[10px] lg:text-xs font-black px-1 lg:px-2 py-0.5 bg-pink-500/30 rounded border border-pink-500/50">VS</span>
                <Link to={`/squad/${match.opponent._id}`} className={`relative text-xs lg:text-sm font-bold ${match.opponent._id === mySquad?._id ? 'text-yellow-400' : 'text-white hover:text-purple-400'}`}>
                  {match.opponent.name}
                </Link>
              </div>
            </div>
          )}
          {isActiveMatch ? (
            <Link to={`/match/${match._id}`} className="px-3 lg:px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg text-white font-bold text-xs lg:text-sm hover:shadow-lg transition-all flex items-center gap-1 lg:gap-2">
              <Play className="w-3 lg:w-4 h-3 lg:h-4" /><span className="hidden lg:inline">{txt.viewMatch}</span>
            </Link>
          ) : isMyMatch ? (
            canCancel ? (
              <button onClick={() => handleCancelMatch(match._id, ladder)} className="px-3 lg:px-4 py-2 bg-dark-700 hover:bg-dark-600 border border-red-500/30 rounded-lg text-red-400 font-medium text-xs lg:text-sm">{txt.cancel}</button>
            ) : (
              <span className="px-3 lg:px-4 py-2 bg-dark-800 border border-white/10 rounded-lg text-gray-500 text-xs lg:text-sm">🔒</span>
            )
          ) : isAuthenticated && mySquad && isRegisteredToLadder(ladder) ? (
            <button onClick={() => handleOpenAcceptRoster(match._id, ladder, match.teamSize)} disabled={acceptingMatch === match._id}
              className={`px-4 lg:px-6 py-2 rounded-lg text-white font-bold text-xs lg:text-sm transition-all hover:scale-105 disabled:opacity-50 flex items-center gap-1 lg:gap-2 ${match.isReady ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-orange-600'}`}>
              {acceptingMatch === match._id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {match.isReady ? txt.play : txt.go}
            </button>
          ) : (
            <span className="px-3 lg:px-4 py-2 text-gray-500 text-xs lg:text-sm">{txt.notRegistered}</span>
          )}
        </div>
      </div>
    );
  };

  // Matchs récents (résultats)
  const recentMatches = [
    { id: 1, winner: 'Shadow Squad', loser: 'Elite Warriors', mode: 'hardcoreSND', time: '14:35' },
    { id: 2, winner: 'No Mercy', loser: 'Dark Legion', mode: 'hardcoreDom', time: '14:42' },
    { id: 3, winner: 'Blood Brothers', loser: 'Night Riders', mode: 'hardcoreTDM', time: '14:48' },
    { id: 4, winner: 'Ghost Company', loser: 'Sniper Elite', mode: 'hardcoreSND', time: '14:55' },
    { id: 5, winner: 'Death Brigade', loser: 'Hardcore Heroes', mode: 'hardcoreDom', time: '15:02' },
  ];

  const ongoingTournaments = [
    { id: 1, name: 'Hardcore Friday Night', mode: 'Team Deathmatch', players: '64/64', prize: '$500', status: 'live', startsIn: 'EN COURS', map: 'Shoot House' },
    { id: 2, name: 'Weekend Warriors HC', mode: 'Search & Destroy', players: '32/64', prize: '$750', status: 'filling', startsIn: '2h 15min', map: 'Shipment' },
    { id: 3, name: 'Hardcore Arena', mode: 'Domination', players: '48/64', prize: '$1,000', status: 'filling', startsIn: '4h 30min', map: 'Rust' },
    { id: 4, name: 'Nightmare Mode', mode: 'Team Deathmatch', players: '64/64', prize: '$1,200', status: 'full', startsIn: '8h 00min', map: 'Nuketown' },
    { id: 5, name: 'Elite Hardcore', mode: 'Search & Destroy', players: '56/64', prize: '$900', status: 'filling', startsIn: '1h 30min', map: 'Firing Range' },
    { id: 6, name: 'Deathmatch Pro', mode: 'Domination', players: '40/64', prize: '$600', status: 'filling', startsIn: '3h 45min', map: 'Hijacked' },
  ];

  const sortedTournaments = [...ongoingTournaments].sort((a, b) => {
    const statusOrder = { live: 0, filling: 1, full: 2 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  // State pour les classements depuis la DB
  const [topPlayers, setTopPlayers] = useState([]);
  const [topSquads, setTopSquads] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [loadingSquads, setLoadingSquads] = useState(true);

  // Fetch top 10 players from DB
  useEffect(() => {
    const fetchTopPlayers = async () => {
      setLoadingPlayers(true);
      try {
        const response = await fetch(`${API_URL}/rankings/top-players/hardcore?limit=10`);
        const data = await response.json();
        if (data.success) {
          setTopPlayers(data.rankings.map((r, idx) => ({
            rank: idx + 1,
            id: r.user?._id,
            player: r.user?.username || (language === 'fr' ? 'Compte supprimé' : language === 'de' ? 'Gelöschtes Konto' : language === 'it' ? 'Account eliminato' : 'Deleted account'),
            avatar: r.user?.avatarUrl || r.user?.avatar || null,
            points: r.points
          })));
        }
      } catch (err) {
        console.error('Error fetching top players:', err);
      } finally {
        setLoadingPlayers(false);
      }
    };
    fetchTopPlayers();
  }, []);

  // Fetch top 10 squads from DB
  useEffect(() => {
    const fetchTopSquads = async () => {
      setLoadingSquads(true);
      try {
        const response = await fetch(`${API_URL}/squads/leaderboard/hardcore?limit=10`);
        const data = await response.json();
        console.log('Hardcore Top Squads Response:', data);
        if (data.success) {
          const squadsData = data.squads.map((s, idx) => ({
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
          console.log('Hardcore Top Squads Processed:', squadsData);
          setTopSquads(squadsData);
        }
      } catch (err) {
        console.error('Error fetching top squads:', err);
      } finally {
        setLoadingSquads(false);
      }
    };
    fetchTopSquads();
  }, []);

  const scroll = (direction) => {
    const container = scrollRef.current;
    if (container) {
      const scrollAmount = 320;
      container.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    const container = scrollRef.current;
    if (container) {
      setShowLeftArrow(container.scrollLeft > 0);
      setShowRightArrow(container.scrollLeft < container.scrollWidth - container.clientWidth - 10);
    }
  };

  useEffect(() => {
    handleScroll();
    window.addEventListener('resize', handleScroll);
    return () => window.removeEventListener('resize', handleScroll);
  }, []);

  const getStatusBadge = (status) => {
    switch(status) {
      case 'live': return { text: '● LIVE', bg: 'bg-red-500/20', border: 'border-red-500/50', textColor: 'text-red-400' };
      case 'filling': return { text: '○ OPEN', bg: 'bg-orange-500/20', border: 'border-orange-500/50', textColor: 'text-orange-400' };
      case 'full': return { text: '✓ FULL', bg: 'bg-gray-500/20', border: 'border-gray-500/50', textColor: 'text-gray-400' };
      default: return { text: '○ OPEN', bg: 'bg-orange-500/20', border: 'border-orange-500/50', textColor: 'text-orange-400' };
    }
  };

  const gameModes = [
    { name: t('hardcoreDuel'), icon: '🗡️' },
    { name: t('hardcoreSND'), icon: '💣' },
    { name: t('hardcoreDom'), icon: '🏴' },
    { name: t('hardcoreTDM'), icon: '⚔️' },
  ];

  return (
    <div className="min-h-screen bg-dark-950 relative">
      {/* Background Effects - Red Theme */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 20% 20%, rgba(239, 68, 68, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(249, 115, 22, 0.05) 0%, transparent 50%)' }}></div>
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-30"></div>
      
      <div className="relative z-10 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
          <div className="mb-10">
          <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/30 blur-xl"></div>
                <div className="relative w-14 h-14 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/40">
                  <Skull className="w-7 h-7 text-white" />
                </div>
            </div>
            <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-1">Hardcore</h1>
                <p className="text-gray-400 text-sm">{t('hardcoreDashboardDesc')}</p>
            </div>
          </div>
        </div>

          {/* Available Matches Section */}
          <section className="mb-10">
            {/* Online viewers count */}
            <div className="flex justify-center mb-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-dark-800/50 border border-white/10">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-gray-300 text-sm font-medium">
                  {onlineViewers}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <Play className="w-4 h-4 text-red-400 animate-pulse" />
                </div>
                <h2 className="text-xl font-bold text-white">
                  {t('availableMatches')}
            </h2>
                <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
                  {squadTeamMatches.length + duoTrioMatches.length}
                </span>
              </div>
              
              {/* Post Match Buttons */}
              <div className="flex gap-2">
                {/* Duo/Trio Post Button */}
                {isAuthenticated && mySquad && isRegisteredToLadder('duo-trio') && (
                  <button
                    onClick={() => {
                      if (showPostMatch === 'duo-trio') {
                        setShowPostMatch(null);
                      } else {
                        setMatchForm({
                          ladder: 'duo-trio',
                          gameMode: 'Search & Destroy',
                          teamSize: 2,
                          mapType: 'free'
                        });
                        setShowPostMatch('duo-trio');
                      }
                    }}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                      showPostMatch === 'duo-trio'
                        ? 'bg-dark-700 text-gray-300'
                        : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg hover:shadow-cyan-500/30'
                    }`}
                  >
                    {showPostMatch === 'duo-trio' ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    <span className="hidden sm:inline">Duo/Trio</span>
                  </button>
                )}

                {/* Squad/Team Post Button */}
                {isAuthenticated && mySquad && isRegisteredToLadder('squad-team') && (
                  <button
                    onClick={() => {
                      if (showPostMatch === 'squad-team') {
                        setShowPostMatch(null);
                      } else {
                        setMatchForm({
                          ladder: 'squad-team',
                          gameMode: 'Search & Destroy',
                          teamSize: 5,
                          mapType: 'free'
                        });
                        setShowPostMatch('squad-team');
                      }
                    }}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                      showPostMatch === 'squad-team'
                        ? 'bg-dark-700 text-gray-300'
                        : 'bg-gradient-to-r from-red-500 to-orange-600 text-white hover:shadow-lg hover:shadow-red-500/30'
                    }`}
                  >
                    {showPostMatch === 'squad-team' ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    <span className="hidden sm:inline">Squad/Team</span>
                  </button>
                )}
              </div>
          </div>

            {/* Post Match Form */}
            {showPostMatch && (
              <div className={`mb-4 p-5 bg-dark-900/80 backdrop-blur-xl rounded-2xl border shadow-xl ${
                showPostMatch === 'duo-trio' 
                  ? 'border-cyan-500/30 shadow-cyan-500/5' 
                  : 'border-red-500/30 shadow-red-500/5'
              }`}>
                {/* Time restriction info for duo-trio */}
                {showPostMatch === 'duo-trio' && (
                  <div className={`mb-4 px-3 py-2 rounded-lg border flex items-center gap-2 ${
                    isDuoTrioOpen()
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  }`}>
                    <Clock className={`w-4 h-4 flex-shrink-0 ${isDuoTrioOpen() ? 'text-green-400' : 'text-red-400'}`} />
                    <span className={`text-xs font-medium ${isDuoTrioOpen() ? 'text-green-400' : 'text-red-400'}`}>
                      {isDuoTrioOpen()
                        ? (language === 'fr' 
                            ? '✓ Ouvert • Horaires : 00h00 - 20h00 (heure française)'
                            : language === 'de'
                              ? '✓ Geöffnet • Öffnungszeiten: 00:00 - 20:00 (französische Zeit)'
                              : language === 'it'
                                ? '✓ Aperto • Orari: 00:00 - 20:00 (ora francese)'
                                : '✓ Open • Hours: 00:00 - 20:00 (French time)')
                        : (language === 'fr' 
                            ? '✗ Fermé • Horaires : 00h00 - 20h00 (heure française)'
                            : language === 'de'
                              ? '✗ Geschlossen • Öffnungszeiten: 00:00 - 20:00 (französische Zeit)'
                              : language === 'it'
                                ? '✗ Chiuso • Orari: 00:00 - 20:00 (ora francese)'
                                : '✗ Closed • Hours: 00:00 - 20:00 (French time)')
                      }
                    </span>
                  </div>
                )}
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const ladderId = showPostMatch;
                  // Auto-correct gameMode if invalid for the ladder
                  const validModes = getGameModesForLadder(ladderId);
                  const correctedGameMode = validModes.includes(matchForm.gameMode) ? matchForm.gameMode : validModes[0];
                  if (correctedGameMode !== matchForm.gameMode) {
                    setMatchForm(prev => ({...prev, gameMode: correctedGameMode}));
                  }
                  handleOpenPostRoster(e, ladderId, correctedGameMode);
                }}>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-5">
                    {/* Classement */}
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">{txt.ladder}</label>
                      <div className="relative">
                        <div className={`w-full px-4 py-3 bg-dark-800/80 border border-white/10 rounded-xl text-white text-sm ${
                          showPostMatch === 'duo-trio' ? 'text-cyan-400' : 'text-white'
                        }`}>
                          {showPostMatch === 'duo-trio' ? 'Duo / Trio' : 'Squad / Team'}
                        </div>
                      </div>
                    </div>

                    {/* Format */}
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">Format</label>
                      {showPostMatch === 'duo-trio' ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setMatchForm({...matchForm, teamSize: 2})}
                            className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm text-center transition-all ${
                              matchForm.teamSize === 2
                                ? 'bg-cyan-500/20 border-2 border-cyan-500 text-cyan-400'
                                : 'bg-dark-800/80 border border-white/10 text-gray-400 hover:border-white/20'
                            }`}
                          >
                            2v2
                          </button>
                          <button
                            type="button"
                            onClick={() => setMatchForm({...matchForm, teamSize: 3})}
                            className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm text-center transition-all ${
                              matchForm.teamSize === 3
                                ? 'bg-cyan-500/20 border-2 border-cyan-500 text-cyan-400'
                                : 'bg-dark-800/80 border border-white/10 text-gray-400 hover:border-white/20'
                            }`}
                          >
                            3v3
                          </button>
                        </div>
                      ) : (
                        <div className="py-3 px-4 rounded-xl bg-red-500/20 border-2 border-red-500 text-red-400 font-bold text-sm text-center">
                          5v5
                        </div>
                      )}
                    </div>

                    {/* Mode de jeu */}
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">{txt.gameMode}</label>
                      <div className="relative">
                        <select
                          value={matchForm.gameMode}
                          onChange={(e) => setMatchForm({...matchForm, gameMode: e.target.value})}
                          className={`w-full px-4 py-3 bg-dark-800/80 border border-white/10 rounded-xl text-white text-sm focus:outline-none appearance-none cursor-pointer hover:border-white/20 transition-colors ${
                            showPostMatch === 'duo-trio' ? 'focus:border-cyan-500/50' : 'focus:border-red-500/50'
                          }`}
                        >
                          {getGameModesForLadder(showPostMatch).map(mode => (
                            <option key={mode} value={mode}>{getGameModeName(mode)}</option>
                          ))}
                        </select>
                        <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 rotate-90 pointer-events-none" />
                    </div>
                      </div>
                      
                    {/* Map */}
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">{txt.map}</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setMatchForm({...matchForm, mapType: 'random'})}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${
                            matchForm.mapType === 'random'
                              ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                              : 'bg-dark-800/80 border-white/10 text-gray-400 hover:border-white/20'
                          }`}
                        >
                          <Shuffle className="w-4 h-4" />
                          {txt.random}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMatchForm({...matchForm, mapType: 'free'})}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${
                            matchForm.mapType === 'free'
                              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                              : 'bg-dark-800/80 border-white/10 text-gray-400 hover:border-white/20'
                          }`}
                        >
                          <MapPin className="w-4 h-4" />
                          {txt.free}
                        </button>
                      </div>
                      </div>
                      </div>
                      
                  {/* Bouton poster */}
                  <button
                    type="submit"
                    disabled={postingMatch || (showPostMatch === 'duo-trio' && !isDuoTrioOpen())}
                    className={`w-full py-3.5 rounded-xl text-white font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                      showPostMatch === 'duo-trio'
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-lg hover:shadow-cyan-500/30'
                        : 'bg-gradient-to-r from-red-500 to-orange-600 hover:shadow-lg hover:shadow-red-500/30'
                    }`}
                  >
                    {postingMatch ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Swords className="w-5 h-5" />
                        {language === 'fr' ? 'Chercher un adversaire' : language === 'de' ? 'Gegner finden' : language === 'it' ? 'Trova avversario' : 'Find opponent'}
                      </>
                    )}
                  </button>
                </form>
                        </div>
            )}

            {/* Warning: Squad not registered to any ladder */}
            {isAuthenticated && mySquad && !isRegisteredToLadder('squad-team') && !isRegisteredToLadder('duo-trio') && (
              <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-yellow-400 font-medium text-sm">
                    {language === 'fr' 
                      ? 'Votre escouade n\'est inscrite à aucun classement'
                      : 'Your squad is not registered to any ranking'
                    }
                  </p>
                  <p className="text-yellow-400/70 text-xs mt-1">
                    {language === 'fr' 
                      ? 'Inscrivez-vous à un classement pour pouvoir poster et accepter des matchs.'
                      : 'Register to a ranking to post and accept matches.'
                    }
                  </p>
                </div>
                <Link
                  to="/hardcore/rankings"
                  className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 text-sm font-medium rounded-lg hover:bg-yellow-500/30 transition-colors whitespace-nowrap"
                >
                  {language === 'fr' ? 'S\'inscrire' : language === 'de' ? 'Registrieren' : language === 'it' ? 'Registrati' : 'Register'}
                </Link>
              </div>
            )}

            {/* Matches List */}
            {loadingMatches ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
                      </div>
            ) : (
            <div className="space-y-6">
                {/* My Active Matches Section */}
                {myActiveMatches.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-px flex-1 bg-gradient-to-r from-green-500/50 to-transparent"></div>
                      <div className="flex flex-col items-center">
                        <span className="text-green-400 font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                          {language === 'fr' ? 'Vos matchs en cours' : language === 'de' ? 'Deine aktiven Spiele' : language === 'it' ? 'Le tue partite attive' : 'Your active matches'}
                          <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full text-xs font-bold">
                            {myActiveMatches.length}
                          </span>
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">
                            Squad/Team
                          </span>
                        </div>
                      </div>
                      <div className="h-px flex-1 bg-gradient-to-l from-green-500/50 to-transparent"></div>
                    </div>
                    <div className="grid gap-3">
                      {myActiveMatches.map((match) => renderMatchCard(match, match.ladderId, true, true))}
                    </div>
                  </div>
                )}

                {/* Duo/Trio Section */}
                {duoTrioMatches.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-px flex-1 bg-gradient-to-r from-cyan-500/50 to-transparent"></div>
                      <span className="text-cyan-400 font-semibold text-sm uppercase tracking-wider">Duo / Trio</span>
                      <span className="text-cyan-400/50 text-xs">({duoTrioMatches.length})</span>
                      <div className="h-px flex-1 bg-gradient-to-l from-cyan-500/50 to-transparent"></div>
                    </div>
                    <div className="grid gap-3">
                      {duoTrioMatches.map((match) => {
                        const isMyMatch = match.challenger?._id === mySquad?._id;
                        return renderMatchCard(match, 'duo-trio', isMyMatch);
                      })}
                    </div>
                  </div>
                )}

                {/* Squad/Team Section */}
                {squadTeamMatches.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-px flex-1 bg-gradient-to-r from-purple-500/50 to-transparent"></div>
                      <span className="text-purple-400 font-semibold text-sm uppercase tracking-wider">Squad / Team</span>
                      <span className="text-purple-400/50 text-xs">({squadTeamMatches.length})</span>
                      <div className="h-px flex-1 bg-gradient-to-l from-purple-500/50 to-transparent"></div>
                    </div>
                    <div className="grid gap-3">
                      {squadTeamMatches.map((match) => {
                        const isMyMatch = match.challenger?._id === mySquad?._id;
                        return renderMatchCard(match, 'squad-team', isMyMatch);
                      })}
                    </div>
                  </div>
                )}

                {/* No matches */}
                {squadTeamMatches.length === 0 && duoTrioMatches.length === 0 && myActiveMatches.length === 0 && (
                  <div className="bg-dark-900/80 backdrop-blur-xl rounded-xl p-8 border border-red-500/20 text-center">
                    <Swords className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500">{language === 'fr' ? 'Aucun match disponible pour le moment' : language === 'de' ? 'Derzeit keine Spiele verfügbar' : language === 'it' ? 'Nessuna partita disponibile al momento' : 'No matches available at the moment'}</p>
                  </div>
                )}
            </div>
            )}
          </section>

          {/* Tournaments - Coming Soon */}
          <section className="mb-10">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                <Trophy className="w-4 h-4 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white">
                {t('tournaments')}
              </h2>
            </div>

            {/* Coming Soon Banner */}
            <div className="bg-gradient-to-r from-red-500/10 via-orange-500/10 to-red-500/10 border-2 border-red-500/30 rounded-2xl p-8 md:p-12 text-center relative overflow-hidden">
              {/* Animated background */}
              <div className="absolute inset-0 opacity-30">
                <div className="absolute top-0 left-0 w-40 h-40 bg-red-500/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-0 right-0 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
              </div>
              
              <div className="relative z-10">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-red-500/30 to-orange-500/30 border-2 border-red-500/50 flex items-center justify-center animate-bounce">
                  <Trophy className="w-10 h-10 text-red-400" />
                </div>
                
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
                  {language === 'fr' ? 'Bientôt disponible' : language === 'de' ? 'Bald verfügbar' : language === 'it' ? 'Prossimamente' : 'Coming Soon'}
                </h3>
                
                <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto">
                  {language === 'fr' 
                    ? 'Les tournois arrivent bientôt ! Préparez-vous à affronter les meilleurs joueurs et à remporter des récompenses exclusives.'
                    : language === 'de'
                      ? 'Turniere kommen bald! Bereiten Sie sich darauf vor, die besten Spieler herauszufordern und exklusive Belohnungen zu gewinnen.'
                      : language === 'it'
                        ? 'I tornei arrivano presto! Preparati a sfidare i migliori giocatori e vincere premi esclusivi.'
                        : 'Tournaments are coming soon! Get ready to challenge the best players and win exclusive rewards.'}
                </p>
              </div>
            </div>
        </section>

          {/* Rankings */}
          <section className="mb-10">
          <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <Crown className="w-4 h-4 text-yellow-500" />
              </div>
              <h2 className="text-xl font-bold text-white">
                {language === 'fr' ? 'Classements général' : language === 'it' ? 'Classifiche generali' : language === 'de' ? 'Allgemeine Ranglisten' : 'General Rankings'}
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Top 10 Players */}
              <div className="bg-dark-900/80 backdrop-blur-xl rounded-xl border border-red-500/20 overflow-hidden">
                <div className="px-5 py-4 border-b border-red-500/10 bg-gradient-to-r from-red-500/10 to-transparent">
                  <h3 className="font-bold text-white flex items-center space-x-2">
                  <Users className="w-5 h-5 text-red-400" />
                    <span>{language === 'fr' ? 'Top 10 Joueurs' : language === 'de' ? 'Top 10 Spieler' : language === 'it' ? 'Top 10 Giocatori' : 'Top 10 Players'}</span>
                </h3>
              </div>
              {loadingPlayers ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
                </div>
              ) : topPlayers.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm">
                  {language === 'fr' ? 'Aucun joueur classé' : language === 'de' ? 'Keine Spieler klassifiziert' : language === 'it' ? 'Nessun giocatore classificato' : 'No ranked players'}
                </div>
              ) : (
              <div className="divide-y divide-white/5">
                  {topPlayers.map((player) => {
                  const isTop3 = player.rank <= 3;
                  return (
                      <div key={player.rank} className={`px-5 py-3 hover:bg-white/5 transition-all ${isTop3 ? 'bg-gradient-to-r from-yellow-500/5 to-transparent' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2 w-12">
                              {player.rank === 1 && <Medal className="w-4 h-4 text-yellow-500" />}
                              {player.rank === 2 && <Medal className="w-4 h-4 text-gray-400" />}
                              {player.rank === 3 && <Medal className="w-4 h-4 text-amber-600" />}
                              <span className={`font-bold text-sm ${isTop3 ? 'text-white' : 'text-gray-400'}`}>#{player.rank}</span>
                          </div>
                          <div className="relative">
                            {player.avatar ? (
                              <img 
                                src={player.avatar} 
                                alt="" 
                                className={`w-7 h-7 rounded-full ${player.rank === 1 ? 'ring-2 ring-yellow-500 ring-offset-1 ring-offset-dark-900' : player.rank === 2 ? 'ring-2 ring-gray-400 ring-offset-1 ring-offset-dark-900' : player.rank === 3 ? 'ring-2 ring-amber-600 ring-offset-1 ring-offset-dark-900' : ''}`}
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = getDefaultAvatar(player.player);
                                }}
                              />
                            ) : (
                              <div className={`w-7 h-7 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-xs font-bold text-white ${player.rank === 1 ? 'ring-2 ring-yellow-500 ring-offset-1 ring-offset-dark-900' : player.rank === 2 ? 'ring-2 ring-gray-400 ring-offset-1 ring-offset-dark-900' : player.rank === 3 ? 'ring-2 ring-amber-600 ring-offset-1 ring-offset-dark-900' : ''}`}>
                                {player.player?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                            )}
                            {/* Ornament for top 3 */}
                            {player.rank === 1 && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/50">
                                <Crown className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                            {player.rank === 2 && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full flex items-center justify-center shadow-lg shadow-gray-400/50">
                                <Medal className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                            {player.rank === 3 && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-amber-500 to-amber-700 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/50">
                                <Medal className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                          </div>
                            <Link to={`/player/${encodeURIComponent(player.player)}`} className={`font-semibold text-sm hover:text-red-400 transition-colors ${player.rank === 1 ? 'text-yellow-500' : player.rank === 2 ? 'text-gray-300' : player.rank === 3 ? 'text-amber-600' : 'text-white'}`}>
                            {player.player}
                          </Link>
                        </div>
                          <span className="text-red-400 font-bold text-sm">{player.points.toLocaleString()} XP</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>

            {/* Top 10 Squads */}
              <div className="bg-dark-900/80 backdrop-blur-xl rounded-xl border border-red-500/20 overflow-hidden">
                <div className="px-5 py-4 border-b border-red-500/10 bg-gradient-to-r from-red-500/10 to-transparent">
                  <h3 className="font-bold text-white flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-orange-400" />
                    <span>{language === 'fr' ? 'Top 10 Escouades' : language === 'de' ? 'Top 10 Squads' : language === 'it' ? 'Top 10 Squadre' : 'Top 10 Squads'}</span>
                </h3>
              </div>
              {loadingSquads ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
                </div>
              ) : topSquads.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm">
                  {language === 'fr' ? 'Aucune escouade classée' : language === 'de' ? 'Keine Squads klassifiziert' : language === 'it' ? 'Nessuna squadra classificata' : 'No ranked squads'}
                </div>
              ) : (
              <div className="divide-y divide-white/5">
                  {topSquads.map((squad) => {
                  const isTop3 = squad.rank <= 3;
                  return (
                      <div key={squad.rank} className={`px-5 py-3 hover:bg-white/5 transition-all ${isTop3 ? 'bg-gradient-to-r from-yellow-500/5 to-transparent' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2 w-12">
                              {squad.rank === 1 && <Medal className="w-4 h-4 text-yellow-500" />}
                              {squad.rank === 2 && <Medal className="w-4 h-4 text-gray-400" />}
                              {squad.rank === 3 && <Medal className="w-4 h-4 text-amber-600" />}
                              <span className={`font-bold text-sm ${isTop3 ? 'text-white' : 'text-gray-400'}`}>#{squad.rank}</span>
                          </div>
                          {squad.logo ? (
                            <img src={squad.logo} alt="" className="w-6 h-6 rounded object-contain" />
                          ) : (
                            <div 
                              className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: squad.color + '30', color: squad.color }}
                            >
                              {squad.tag?.charAt(0) || 'S'}
                            </div>
                          )}
                            <Link to={`/squad/${squad.id}`} className={`font-semibold text-sm hover:text-red-400 transition-colors ${squad.rank === 1 ? 'text-yellow-500' : squad.rank === 2 ? 'text-gray-300' : squad.rank === 3 ? 'text-amber-600' : 'text-white'}`}>
                            {squad.team}
                            {squad.tag && <span className="text-gray-500 ml-1 text-xs">[{squad.tag}]</span>}
                          </Link>
                        </div>
                          <div className="flex items-center gap-3">
                            <div className="hidden sm:flex items-center gap-2 text-xs">
                              <span className="text-gray-500">{squad.totalMatches}M</span>
                              <span className="text-green-400">{squad.totalWins}W</span>
                              <span className="text-red-400">{squad.totalLosses}L</span>
                            </div>
                            <span className="text-red-400 font-bold text-sm">{squad.points} pts</span>
                          </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          </div>
        </section>

        {/* Game Modes */}
          <section>
          <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white">
                {language === 'fr' ? 'Modes de jeu' : language === 'de' ? 'Spielmodi' : language === 'it' ? 'Modalità di gioco' : 'Game Modes'}
            </h2>
          </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {gameModes.map((mode, index) => (
                <div key={index} className="bg-dark-900/80 backdrop-blur-xl rounded-xl p-5 border border-white/10 hover:border-red-500/30 transition-all duration-300 cursor-pointer text-center hover:scale-105">
                <div className="text-4xl mb-3">{mode.icon}</div>
                  <h3 className="text-white font-semibold text-sm">{mode.name}</h3>
              </div>
            ))}
          </div>
        </section>
        </div>
      </div>

      {/* Roster Selection Dialog */}
      {showRosterDialog && mySquad && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-dark-900 rounded-2xl border border-red-500/30 p-4 sm:p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-red-400" />
                {txt.selectRoster}
              </h3>
              <button
                onClick={() => {
                  setShowRosterDialog(null);
                  setPendingMatchAction(null);
                  setSelectedRoster([]);
                  setSelectedHelper(null);
                  setHelperSearch('');
                  setHelperSearchResults([]);
                }}
                className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Squad Members Section */}
            <div className="mb-4">
              {(() => {
                const requiredSize = showRosterDialog === 'accept' && pendingMatchAction?.teamSize 
                  ? pendingMatchAction.teamSize 
                  : matchForm.teamSize;
                // Helper counts as a player
                const totalSelected = selectedRoster.length + (selectedHelper ? 1 : 0);
                const isComplete = totalSelected === requiredSize;
                return (
                  <p className={`text-xs uppercase tracking-wider mb-2 ${isComplete ? 'text-green-400' : 'text-gray-400'}`}>
                    {txt.squadMembers} ({totalSelected}/{requiredSize})
                    {!isComplete && <span className="text-red-400 ml-2">({requiredSize - totalSelected} {language === 'fr' ? 'restant(s)' : language === 'de' ? 'verbleibend' : language === 'it' ? 'rimanenti' : 'remaining'})</span>}
                  </p>
                );
              })()}
              <p className="text-gray-500 text-xs mb-3">{txt.selectPlayers}</p>
              
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {mySquad.members?.map((member) => {
                  const memberUser = member.user;
                  const isSelected = selectedRoster.includes(memberUser._id);
                  const avatar = memberUser.avatarUrl || memberUser.avatar || getDefaultAvatar(memberUser.username);
                  
                  return (
                    <div
                      key={memberUser._id}
                      onClick={() => togglePlayerInRoster(memberUser._id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-red-500/20 border-red-500/50' 
                          : 'bg-dark-800/50 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'bg-red-500 border-red-500' : 'border-gray-500'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <img src={avatar} alt={memberUser.username} className="w-8 h-8 rounded-full object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm truncate">{memberUser.username}</p>
                          {memberUser.activisionId && (
                            <p className="text-gray-500 text-xs truncate">{memberUser.activisionId}</p>
                          )}
                        </div>
                        {memberUser.platform && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            memberUser.platform === 'PC' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                          }`}>
                            {memberUser.platform}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* External Helper Section */}
            <div className="mb-4 pt-4 border-t border-white/10">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">{txt.helper} (0/1)</p>
              
              {selectedHelper ? (
                /* Helper selected - show them */
                <div className="p-2.5 rounded-xl bg-yellow-500/20 border border-yellow-500/50">
                  <div className="flex items-center gap-3">
                    <img 
                      src={selectedHelper.avatarUrl || selectedHelper.avatar || getDefaultAvatar(selectedHelper.username)} 
                      alt={selectedHelper.username} 
                      className="w-8 h-8 rounded-full object-cover" 
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{selectedHelper.username}</p>
                      {selectedHelper.activisionId && (
                        <p className="text-gray-500 text-xs truncate">{selectedHelper.activisionId}</p>
                      )}
                    </div>
                    {selectedHelper.platform && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        selectedHelper.platform === 'PC' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                      }`}>
                        {selectedHelper.platform}
                      </span>
                    )}
                    <button
                      onClick={removeHelper}
                      className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Search for helper */
                <div className="relative">
                  <input
                    type="text"
                    value={helperSearch}
                    onChange={(e) => setHelperSearch(e.target.value)}
                    placeholder={txt.searchPlaceholder}
                    className="w-full px-3 py-2.5 bg-dark-800 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
                  />
                  {searchingHelper && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 animate-spin" />
                  )}
                  
                  {/* Search Results */}
                  {helperSearchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-dark-800 border border-white/10 rounded-xl overflow-hidden z-10 shadow-xl">
                      {helperSearchResults.map((user) => {
                        const avatar = user.avatarUrl || user.avatar || getDefaultAvatar(user.username);
                        return (
                          <div
                            key={user._id}
                            onClick={() => selectHelper(user)}
                            className="p-2.5 hover:bg-white/5 cursor-pointer transition-colors flex items-center gap-3"
                          >
                            <img src={avatar} alt={user.username} className="w-7 h-7 rounded-full object-cover" />
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm truncate">{user.username}</p>
                              {user.activisionId && <p className="text-gray-500 text-xs truncate">{user.activisionId}</p>}
                            </div>
                            {user.platform && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                user.platform === 'PC' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                              }`}>
                                {user.platform}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {helperSearch.length >= 2 && !searchingHelper && helperSearchResults.length === 0 && (
                    <p className="text-gray-500 text-xs mt-2 text-center">{txt.noResults}</p>
                  )}
                </div>
              )}
            </div>

            {/* Error Message */}
            {rosterError && (
              <div className="mb-3 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm font-medium">{rosterError}</p>
                {rosterError.includes('GGSecure') && (
                  <Link 
                    to="/anticheat" 
                    className="mt-2 inline-flex items-center gap-1 text-xs text-red-300 hover:text-white underline transition-colors"
                  >
                    {language === 'fr' 
                      ? '→ Comment installer GGSecure ?' 
                      : language === 'de'
                        ? '→ Wie installiere ich GGSecure?'
                        : language === 'it'
                          ? '→ Come installare GGSecure?'
                          : '→ How to install GGSecure?'}
                  </Link>
                )}
              </div>
            )}

            {/* Confirm Button */}
            {(() => {
              const requiredSize = showRosterDialog === 'accept' && pendingMatchAction?.teamSize 
                ? pendingMatchAction.teamSize 
                : matchForm.teamSize;
              // Helper counts as a player
              const totalSelected = selectedRoster.length + (selectedHelper ? 1 : 0);
              const isValidRoster = totalSelected === requiredSize;
              return (
            <button
              onClick={handleConfirmRoster}
                  disabled={!isValidRoster || postingMatch || acceptingMatch || checkingAnticheat}
              className="w-full py-3 bg-gradient-to-r from-red-500 to-orange-600 rounded-xl text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {(postingMatch || acceptingMatch || checkingAnticheat) ? (
                <Loader2 className="w-5 h-5 animate-spin" />
                  ) : !isValidRoster ? (
                    <span>{language === 'fr' ? `Sélectionnez ${requiredSize} joueurs` : language === 'de' ? `${requiredSize} Spieler auswählen` : language === 'it' ? `Seleziona ${requiredSize} giocatori` : `Select ${requiredSize} players`}</span>
              ) : (
                txt.confirm
              )}
            </button>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default HardcoreDashboard;
