import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useAuth } from '../AuthContext';
import { getDefaultAvatar, getAvatarUrl } from '../utils/avatar';
import { io } from 'socket.io-client';
import { Trophy, Users, Skull, Medal, Target, Crown, Clock, MapPin, Shuffle, Play, X, Coins, Loader2, Shield, Plus, Swords, AlertTriangle, Check, Zap } from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';
const SOCKET_URL = 'https://api-nomercy.ggsecure.io';

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
      <span className={`text-xs ${remaining < 60 ? 'text-neon-red' : 'text-gray-400'}`}>
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
};

const HardcoreDashboard = () => {
  const { language, t } = useLanguage();
  const { isAuthenticated, user } = useAuth();
  
  // Check if user is admin or staff (can bypass disabled features)
  const isAdminOrStaff = user?.roles?.some(r => ['admin', 'staff', 'gerant_cdl', 'gerant_hardcore'].includes(r));

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
      openHours: '✓ Ouvert • 00h00 - 20h00',
      closedHours: '✗ Fermé • 00h00 - 20h00',
      matchesInProgress: 'match(s) en cours',
      inLadder: 'dans le classement',
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
      openHours: '✓ Open • 00:00 - 20:00',
      closedHours: '✗ Closed • 00:00 - 20:00',
      matchesInProgress: 'match(es) in progress',
      inLadder: 'in the',
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
      rematchCooldown: '⏱️ Rematch-Abklingzeit nicht erfüllt!',
      hourUnit: ' Std.',
      minuteUnit: ' Min.',
      openHours: '✓ Geöffnet • 00:00 - 20:00',
      closedHours: '✗ Geschlossen • 00:00 - 20:00',
      matchesInProgress: 'Spiel(e) läuft',
      inLadder: 'in der Rangliste',
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
      rematchCooldown: '⏱️ Tempo di attesa non rispettato!',
      hourUnit: 'h',
      minuteUnit: 'min',
      openHours: '✓ Aperto • 00:00 - 20:00',
      closedHours: '✗ Chiuso • 00:00 - 20:00',
      matchesInProgress: 'partita(e) in corso',
      inLadder: 'nella classifica',
    },
  }[language] || {};
  
  // Matchmaking states
  const [mySquad, setMySquad] = useState(null);
  const mySquadRef = useRef(null);
  const [squadTeamMatches, setSquadTeamMatches] = useState([]);
  const [duoTrioMatches, setDuoTrioMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const socketRef = useRef(null);
  const [totalOnlineUsers, setTotalOnlineUsers] = useState(0);
  const [showPostMatch, setShowPostMatch] = useState(null);
  const [postingMatch, setPostingMatch] = useState(false);
  const [acceptingMatch, setAcceptingMatch] = useState(null);
  const [matchMessage, setMatchMessage] = useState({ type: '', text: '' });
  const [matchForm, setMatchForm] = useState({
    ladder: '',
    gameMode: 'Search & Destroy',
    teamSize: 5,
    mapType: 'free'
  });
  const [appSettings, setAppSettings] = useState(null);
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
  
  const availableModes = ['hardcoreSND', 'hardcoreDom', 'hardcoreTDM'];
  
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
  
  useEffect(() => {
    const titles = {
      fr: 'NoMercy - Hardcore',
      en: 'NoMercy - Hardcore',
      it: 'NoMercy - Hardcore',
      de: 'NoMercy - Hardcore',
    };
    document.title = titles[language] || titles.en;
  }, [language]);
  
  useEffect(() => {
    localStorage.setItem('hardcoreMatchFilters', JSON.stringify(activeModes));
  }, [activeModes]);

  // Fetch app settings to check feature flags
  useEffect(() => {
    const fetchAppSettings = async () => {
      try {
        const response = await fetch(`${API_URL}/app-settings/public`);
        const data = await response.json();
        if (data.success) {
          setAppSettings(data);
        }
      } catch (err) {
        console.error('Error fetching app settings:', err);
      }
    };
    fetchAppSettings();
  }, []);

  const gameModeApiNames = {
    fr: { 'Search & Destroy': 'Recherche & Destruction', 'Domination': 'Domination', 'Team Deathmatch': 'Mêlée générale' },
    en: { 'Search & Destroy': 'Search & Destroy', 'Domination': 'Domination', 'Team Deathmatch': 'Team Deathmatch' },
  };

  const getGameModeName = (mode) => gameModeApiNames[language]?.[mode] || gameModeApiNames['en'][mode] || mode;

  // Fetch my squad
  useEffect(() => {
    const fetchMySquad = async () => {
      if (!isAuthenticated) return;
      try {
        const response = await fetch(`${API_URL}/squads/my-squad`, { credentials: 'include' });
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

  // Fetch matches
  const fetchMatches = async (isInitial = false) => {
    if (isInitial) setLoadingMatches(true);
    try {
      const squadRes = await fetch(`${API_URL}/matches/available/squad-team?mode=hardcore`);
      const squadData = await squadRes.json();
      if (squadData.success) setSquadTeamMatches(squadData.matches);
      
      const duoRes = await fetch(`${API_URL}/matches/available/duo-trio?mode=hardcore`);
      const duoData = await duoRes.json();
      if (duoData.success) setDuoTrioMatches(duoData.matches);
    } catch (err) {
      console.error('Error fetching matches:', err);
    } finally {
      if (isInitial) setLoadingMatches(false);
    }
  };

  // Fetch in-progress matches count
  const fetchInProgressCounts = async () => {
    try {
      const response = await fetch(`${API_URL}/matches/in-progress/count?mode=hardcore`);
      const data = await response.json();
      if (data.success) {
        setInProgressCounts(data.counts);
      }
    } catch (err) {
      console.error('Error fetching in-progress counts:', err);
    }
  };

  useEffect(() => {
    fetchMatches(true);
    fetchInProgressCounts();
    const interval = setInterval(() => {
      fetchMatches(false);
      fetchInProgressCounts();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Socket.io connection
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'], withCredentials: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('joinPage', { page: 'hardcore-dashboard' });
    });

    socket.on('totalOnlineUsers', (count) => setTotalOnlineUsers(count));

    socket.on('matchCreated', (data) => {
      if (data.mode === 'hardcore') {
        if (data.ladderId === 'squad-team') {
          setSquadTeamMatches(prev => [data.match, ...prev]);
        } else if (data.ladderId === 'duo-trio') {
          setDuoTrioMatches(prev => [data.match, ...prev]);
        }
      }
    });

    socket.on('matchAccepted', (data) => {
      if (data.mode === 'hardcore') {
        if (data.ladderId === 'squad-team') {
          setSquadTeamMatches(prev => prev.filter(m => m._id !== data.matchId));
          setInProgressCounts(prev => ({ ...prev, 'squad-team': prev['squad-team'] + 1, total: prev.total + 1 }));
        } else if (data.ladderId === 'duo-trio') {
          setDuoTrioMatches(prev => prev.filter(m => m._id !== data.matchId));
          setInProgressCounts(prev => ({ ...prev, 'duo-trio': prev['duo-trio'] + 1, total: prev.total + 1 }));
        }
        
        const currentSquad = mySquadRef.current;
        if (data.match && currentSquad) {
          const isMyMatch = data.match.challenger?._id === currentSquad._id || data.match.opponent?._id === currentSquad._id;
          if (isMyMatch) {
            setMyActiveMatches(prev => {
              if (prev.some(m => m._id === data.match._id)) return prev;
              return [data.match, ...prev];
            });
          }
        }
      }
    });

    socket.on('matchCancelled', (data) => {
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
      const response = await fetch(`${API_URL}/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ladderId,
          gameMode: gameMode || matchForm.gameMode,
          teamSize: matchForm.teamSize,
          isReady: true,
          mapType: matchForm.mapType,
          roster: roster
        })
      });
      const data = await response.json();
      if (data.success) {
        setMatchMessage({ type: 'success', text: txt.postMatch + ' ✓' });
        setShowPostMatch(null);
        setMatchForm({ ladder: 'squad-team', gameMode: 'Search & Destroy', teamSize: 4, mapType: 'free' });
        const res = await fetch(`${API_URL}/matches/available/${ladderId}?mode=hardcore`);
        const resData = await res.json();
        if (resData.success) {
          if (ladderId === 'squad-team') setSquadTeamMatches(resData.matches);
          else if (ladderId === 'duo-trio') setDuoTrioMatches(resData.matches);
        }
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
        const res = await fetch(`${API_URL}/matches/available/${ladderId}?mode=hardcore`);
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
      
      const roster = [
        ...selectedRoster.map(userId => ({ user: userId, isHelper: false })),
        ...(selectedHelper ? [{ user: selectedHelper._id, isHelper: true }] : [])
      ];
      
      console.log('[ROSTER DEBUG] selectedRoster:', selectedRoster);
      console.log('[ROSTER DEBUG] selectedHelper:', selectedHelper);
      console.log('[ROSTER DEBUG] Final roster to send:', JSON.stringify(roster, null, 2));
      
      const action = pendingMatchAction;
      let actionSuccess = false;
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
        const res = await fetch(`${API_URL}/matches/available/${ladderId}?mode=hardcore`);
        const resData = await res.json();
        if (resData.success) setSquadTeamMatches(resData.matches);
        setTimeout(() => setMatchMessage({ type: '', text: '' }), 3000);
      }
    } catch (err) {
      console.error('Error cancelling match:', err);
    }
  };

  const getGameModesForLadder = (ladderId) => ['Search & Destroy'];
  const isRegisteredToLadder = (ladderId) => mySquad?.registeredLadders?.some(l => l.ladderId === ladderId);

  const isDuoTrioOpen = () => {
    const parisHour = parseInt(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris', hour: 'numeric', hour12: false }));
    return parisHour < 20;
  };

  const [myActiveMatches, setMyActiveMatches] = useState([]);

  const fetchMyActiveMatches = async () => {
    if (!mySquad) return;
    try {
      const response = await fetch(`${API_URL}/matches/my-active`, { credentials: 'include' });
      const data = await response.json();
      if (data.success) setMyActiveMatches(data.matches);
    } catch (err) {
      console.error('Error fetching my active matches:', err);
    }
  };

  useEffect(() => {
    const refreshInterval = setInterval(() => {
      fetchMatches();
      if (mySquad) fetchMyActiveMatches();
    }, 30000);
    return () => clearInterval(refreshInterval);
  }, [mySquad]);

  useEffect(() => { if (mySquad) fetchMyActiveMatches(); }, [mySquad]);

  // Callback for when countdown expires
  const handleCountdownExpire = () => fetchMatches(false);

  // Match card component
  const renderMatchCard = (match, ladder, isMyMatch, isActiveMatch = false) => {
    const canCancel = match.isReady || !match.scheduledAt || (new Date(match.scheduledAt) - new Date()) > 5 * 60 * 1000;
    
    return (
      <div key={match._id} className={`match-card p-4 sm:p-5 ${
        isActiveMatch ? 'border-2 border-neon-green/50' : isMyMatch ? 'border-2 border-neon-red/40' : ''
      }`}>
        {/* Mobile Layout */}
        <div className="flex flex-col sm:hidden gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="px-3 py-1 bg-neon-red/20 border border-neon-red/30 rounded-lg text-neon-red text-xs font-semibold">
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
              <span className="text-yellow-400 text-xs font-semibold">+50</span>
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
                <button onClick={() => handleCancelMatch(match._id, ladder)} className="px-4 py-2 glass border border-neon-red/30 rounded-xl text-neon-red text-xs font-medium">
                  {txt.cancel}
                </button>
              ) : (
                <span className="px-4 py-2 glass text-gray-500 text-xs rounded-xl">🔒</span>
              )
            ) : isAuthenticated && mySquad && isRegisteredToLadder(ladder) ? (
              <button onClick={() => handleOpenAcceptRoster(match._id, ladder, match.teamSize)} disabled={acceptingMatch === match._id}
                className={`px-5 py-2 rounded-xl text-white font-bold text-xs ${match.isReady ? 'bg-gradient-to-r from-neon-green to-emerald-600' : 'bg-gradient-to-r from-neon-red to-neon-orange'}`}>
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
            <span className="px-4 py-2 bg-neon-red/20 border border-neon-red/30 rounded-xl text-neon-red text-sm font-semibold min-w-[140px]">
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
              <Users className="w-4 h-4 text-neon-orange" />
              <span className="text-white text-sm font-medium">{match.teamSize}v{match.teamSize}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 text-sm font-semibold">+50</span>
            </div>
            {isMyMatch && !isActiveMatch && !match.opponent && (
              <span className="px-3 py-1 bg-neon-red/20 rounded-lg text-neon-red text-xs font-bold">{txt.yourMatch}</span>
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
              <button onClick={() => handleCancelMatch(match._id, ladder)} className="px-5 py-2.5 glass border border-neon-red/30 rounded-xl text-neon-red font-medium text-sm hover:bg-neon-red/10 transition-all">{txt.cancel}</button>
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
                className={`px-6 py-2.5 rounded-xl text-white font-bold text-sm transition-all hover:scale-105 disabled:opacity-50 flex items-center gap-2 ${match.isReady ? 'bg-gradient-to-r from-neon-green to-emerald-600' : 'bg-gradient-to-r from-neon-red to-neon-orange'}`}>
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

  useEffect(() => {
    const fetchTopPlayers = async () => {
      setLoadingPlayers(true);
      try {
        const response = await fetch(`${API_URL}/rankings/top-players/hardcore?limit=10`);
        const data = await response.json();
        if (data.success) {
          setTopPlayers(data.rankings.map((r, idx) => {
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
          }));
        }
      } catch (err) {
        console.error('Error fetching top players:', err);
      } finally {
        setLoadingPlayers(false);
      }
    };
    fetchTopPlayers();
  }, []);

  useEffect(() => {
    const fetchTopSquads = async () => {
      setLoadingSquads(true);
      try {
        const response = await fetch(`${API_URL}/squads/leaderboard/hardcore?limit=10`);
        const data = await response.json();
        if (data.success) {
          setTopSquads(data.squads.map((s, idx) => ({
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
          })));
        }
      } catch (err) {
        console.error('Error fetching top squads:', err);
      } finally {
        setLoadingSquads(false);
      }
    };
    fetchTopSquads();
  }, []);

  const gameModes = [
    { name: t('hardcoreDuel'), icon: '🗡️' },
    { name: t('hardcoreSND'), icon: '💣' },
    { name: t('hardcoreDom'), icon: '🏴' },
    { name: t('hardcoreTDM'), icon: '⚔️' },
  ];

  return (
    <div className="min-h-screen bg-dark-950 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-dark-base" />
      <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      <div className="absolute inset-0 bg-radial-glow" />
      <div className="absolute inset-0 bg-noise pointer-events-none" />
      
      <div className="relative z-10 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="absolute inset-0 bg-neon-red blur-2xl opacity-40" />
                <div className="relative w-16 h-16 bg-gradient-to-br from-neon-red to-neon-orange rounded-2xl flex items-center justify-center shadow-neon-red">
                  <Skull className="w-8 h-8 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-display text-white mb-1">HARDCORE</h1>
                <p className="text-gray-400">{t('hardcoreDashboardDesc')}</p>
              </div>
            </div>
          </div>

          {/* Available Matches Section */}
          <section className="mb-12">
            {/* Online users */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full glass">
                <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse" />
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-gray-300 text-sm font-medium">{totalOnlineUsers}</span>
              </div>
            </div>

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-neon-red/20 rounded-xl flex items-center justify-center">
                  <Play className="w-5 h-5 text-neon-red animate-pulse" />
                </div>
                <div>
                  <h2 className="text-2xl font-display text-white">{t('availableMatches')}</h2>
                  {inProgressCounts.total > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {inProgressCounts['squad-team'] > 0 && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neon-green/10 border border-neon-green/30 animate-pulse">
                          <div className="w-2 h-2 bg-neon-green rounded-full animate-ping" />
                          <span className="text-neon-green text-xs font-semibold">
                            {inProgressCounts['squad-team']} {txt.matchesInProgress} {txt.inLadder} Squad/Team
                          </span>
                        </div>
                      )}
                      {inProgressCounts['duo-trio'] > 0 && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-500/10 border border-accent-500/30 animate-pulse">
                          <div className="w-2 h-2 bg-accent-400 rounded-full animate-ping" />
                          <span className="text-accent-400 text-xs font-semibold">
                            {inProgressCounts['duo-trio']} {txt.matchesInProgress} {txt.inLadder} Duo/Trio
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Post Match Buttons */}
              <div className="flex gap-3">
                {appSettings?.features?.ladderPosting?.enabled === false && !isAdminOrStaff ? (
                  <div className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{appSettings.features.ladderPosting.disabledMessage || 'Publication désactivée'}</span>
                  </div>
                ) : (
                  <>
                    {isAuthenticated && mySquad && isRegisteredToLadder('duo-trio') && (
                      <button
                        onClick={() => {
                          if (showPostMatch === 'duo-trio') setShowPostMatch(null);
                          else {
                            setMatchForm({ ladder: 'duo-trio', gameMode: 'Search & Destroy', teamSize: 2, mapType: 'free' });
                            setShowPostMatch('duo-trio');
                          }
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all text-sm ${
                          showPostMatch === 'duo-trio' ? 'glass text-gray-300' : 'bg-gradient-to-r from-accent-500 to-blue-600 text-white hover:scale-105'
                        }`}
                      >
                        {showPostMatch === 'duo-trio' ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        <span className="hidden sm:inline">Duo/Trio</span>
                      </button>
                    )}

                    {isAuthenticated && mySquad && isRegisteredToLadder('squad-team') && (
                      <button
                        onClick={() => {
                          if (showPostMatch === 'squad-team') setShowPostMatch(null);
                          else {
                            setMatchForm({ ladder: 'squad-team', gameMode: 'Search & Destroy', teamSize: 5, mapType: 'free' });
                            setShowPostMatch('squad-team');
                          }
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all text-sm ${
                          showPostMatch === 'squad-team' ? 'glass text-gray-300' : 'bg-gradient-to-r from-neon-red to-neon-orange text-white hover:scale-105'
                        }`}
                      >
                        {showPostMatch === 'squad-team' ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        <span className="hidden sm:inline">Squad/Team</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Post Match Form */}
            {showPostMatch && (
              <div className={`mb-6 p-6 glass-card rounded-2xl ${showPostMatch === 'duo-trio' ? 'neon-border-cyan' : 'neon-border-red'}`}>
                {showPostMatch === 'duo-trio' && (
                  <div className={`mb-4 px-4 py-2.5 rounded-xl flex items-center gap-2 ${isDuoTrioOpen() ? 'bg-neon-green/10 border border-neon-green/30' : 'bg-neon-red/10 border border-neon-red/30'}`}>
                    <Clock className={`w-4 h-4 ${isDuoTrioOpen() ? 'text-neon-green' : 'text-neon-red'}`} />
                    <span className={`text-sm font-medium ${isDuoTrioOpen() ? 'text-neon-green' : 'text-neon-red'}`}>
                      {isDuoTrioOpen() ? txt.openHours : txt.closedHours}
                    </span>
                  </div>
                )}
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const ladderId = showPostMatch;
                  const validModes = getGameModesForLadder(ladderId);
                  const correctedGameMode = validModes.includes(matchForm.gameMode) ? matchForm.gameMode : validModes[0];
                  handleOpenPostRoster(e, ladderId, correctedGameMode);
                }}>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">{txt.ladder}</label>
                      <div className={`w-full px-4 py-3 glass rounded-xl text-sm font-medium ${showPostMatch === 'duo-trio' ? 'text-accent-400' : 'text-white'}`}>
                        {showPostMatch === 'duo-trio' ? 'Duo / Trio' : 'Squad / Team'}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">Format</label>
                      {showPostMatch === 'duo-trio' ? (
                        <div className="flex gap-2">
                          {[2, 3].map(size => (
                            <button
                              key={size}
                              type="button"
                              onClick={() => setMatchForm({...matchForm, teamSize: size})}
                              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
                                matchForm.teamSize === size ? 'bg-accent-500/20 border-2 border-accent-500 text-accent-400' : 'glass text-gray-400 hover:bg-white/5'
                              }`}
                            >
                              {size}v{size}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="py-3 px-4 rounded-xl bg-neon-red/20 border-2 border-neon-red text-neon-red font-bold text-sm text-center">5v5</div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">{txt.gameMode}</label>
                      <select
                        value={matchForm.gameMode}
                        onChange={(e) => setMatchForm({...matchForm, gameMode: e.target.value})}
                        className="w-full px-4 py-3 glass rounded-xl text-white text-sm focus:outline-none appearance-none cursor-pointer"
                      >
                        {getGameModesForLadder(showPostMatch).map(mode => (
                          <option key={mode} value={mode}>{getGameModeName(mode)}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">{txt.map}</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setMatchForm({...matchForm, mapType: 'random'})}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
                            matchForm.mapType === 'random' ? 'bg-purple-500/20 border border-purple-500/50 text-purple-400' : 'glass text-gray-400'
                          }`}
                        >
                          <Shuffle className="w-4 h-4" />{txt.random}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMatchForm({...matchForm, mapType: 'free'})}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
                            matchForm.mapType === 'free' ? 'bg-accent-500/20 border border-accent-500/50 text-accent-400' : 'glass text-gray-400'
                          }`}
                        >
                          <MapPin className="w-4 h-4" />{txt.free}
                        </button>
                      </div>
                    </div>
                  </div>
                      
                  <button
                    type="submit"
                    disabled={postingMatch || (showPostMatch === 'duo-trio' && !isDuoTrioOpen())}
                    className={`w-full py-4 rounded-xl text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                      showPostMatch === 'duo-trio' ? 'bg-gradient-to-r from-accent-500 to-blue-600' : 'bg-gradient-to-r from-neon-red to-neon-orange'
                    }`}
                  >
                    {postingMatch ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Swords className="w-5 h-5" />{txt.findOpponent}</>}
                  </button>
                </form>
              </div>
            )}

            {/* Warning: Squad not registered */}
            {isAuthenticated && mySquad && !isRegisteredToLadder('squad-team') && !isRegisteredToLadder('duo-trio') && (
              <div className="mb-6 p-5 glass-card rounded-2xl border border-yellow-500/30 flex items-center gap-4">
                <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-yellow-400 font-medium">{language === 'fr' ? 'Votre escouade n\'est inscrite à aucun classement' : 'Your squad is not registered to any ranking'}</p>
                  <p className="text-yellow-400/70 text-sm mt-1">{language === 'fr' ? 'Inscrivez-vous pour pouvoir poster et accepter des matchs.' : 'Register to post and accept matches.'}</p>
                </div>
                <Link to="/hardcore/rankings" className="px-4 py-2 bg-yellow-500/20 text-yellow-400 text-sm font-medium rounded-xl hover:bg-yellow-500/30 transition-colors">
                  {language === 'fr' ? 'S\'inscrire' : 'Register'}
                </Link>
              </div>
            )}

            {/* GGSecure Info for PC Players */}
            <div className="mb-6 p-4 glass-card rounded-2xl border border-cyan-500/30 flex items-start gap-4">
              <Shield className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-cyan-400 font-medium">
                  {language === 'fr' 
                    ? 'Anti-Cheat GGSecure requis pour les joueurs PC' 
                    : language === 'de' 
                    ? 'GGSecure Anti-Cheat für PC-Spieler erforderlich'
                    : language === 'it'
                    ? 'Anti-Cheat GGSecure richiesto per i giocatori PC'
                    : 'GGSecure Anti-Cheat required for PC players'}
                </p>
                <p className="text-cyan-400/70 text-sm mt-1">
                  {language === 'fr' 
                    ? 'Les joueurs PC non connectés à notre anti-cheat GGSecure ne pourront pas être sélectionnés dans le roster.' 
                    : language === 'de' 
                    ? 'PC-Spieler, die nicht mit unserem GGSecure Anti-Cheat verbunden sind, können nicht im Roster ausgewählt werden.'
                    : language === 'it'
                    ? 'I giocatori PC non connessi al nostro anti-cheat GGSecure non potranno essere selezionati nel roster.'
                    : 'PC players not connected to our GGSecure anti-cheat cannot be selected in the roster.'}
                </p>
                <Link 
                  to="/anticheat" 
                  className="inline-flex items-center gap-1 text-cyan-400 text-sm font-medium mt-2 hover:text-cyan-300 transition-colors"
                >
                  {language === 'fr' ? 'En savoir plus sur GGSecure' : language === 'de' ? 'Mehr über GGSecure' : language === 'it' ? 'Scopri di più su GGSecure' : 'Learn more about GGSecure'}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </Link>
              </div>
            </div>

            {/* Matches List */}
            {loadingMatches ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-10 h-10 text-neon-red animate-spin" />
              </div>
            ) : (
              <div className="space-y-8">
                {/* My Active Matches */}
                {myActiveMatches.length > 0 && (
                  <div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-px flex-1 bg-gradient-to-r from-neon-green/50 to-transparent" />
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse" />
                        <span className="text-neon-green font-semibold text-sm uppercase tracking-wider">
                          {language === 'fr' ? 'Vos matchs en cours' : 'Your active matches'}
                        </span>
                        <span className="bg-neon-green/20 text-neon-green px-2 py-0.5 rounded-full text-xs font-bold">{myActiveMatches.length}</span>
                      </div>
                      <div className="h-px flex-1 bg-gradient-to-l from-neon-green/50 to-transparent" />
                    </div>
                    <div className="grid gap-4">
                      {myActiveMatches.map((match) => renderMatchCard(match, match.ladderId, true, true))}
                    </div>
                  </div>
                )}

                {/* Duo/Trio */}
                {duoTrioMatches.length > 0 && (
                  <div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-px flex-1 bg-gradient-to-r from-accent-500/50 to-transparent" />
                      <span className="text-accent-400 font-semibold text-sm uppercase tracking-wider">Duo / Trio</span>
                      <span className="text-accent-400/50 text-xs">({duoTrioMatches.length})</span>
                      <div className="h-px flex-1 bg-gradient-to-l from-accent-500/50 to-transparent" />
                    </div>
                    <div className="grid gap-4">
                      {duoTrioMatches.map((match) => renderMatchCard(match, 'duo-trio', match.challenger?._id === mySquad?._id))}
                    </div>
                  </div>
                )}

                {/* Squad/Team */}
                {squadTeamMatches.length > 0 && (
                  <div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-px flex-1 bg-gradient-to-r from-purple-500/50 to-transparent" />
                      <span className="text-purple-400 font-semibold text-sm uppercase tracking-wider">Squad / Team</span>
                      <span className="text-purple-400/50 text-xs">({squadTeamMatches.length})</span>
                      <div className="h-px flex-1 bg-gradient-to-l from-purple-500/50 to-transparent" />
                    </div>
                    <div className="grid gap-4">
                      {squadTeamMatches.map((match) => renderMatchCard(match, 'squad-team', match.challenger?._id === mySquad?._id))}
                    </div>
                  </div>
                )}

                {/* No matches */}
                {squadTeamMatches.length === 0 && duoTrioMatches.length === 0 && myActiveMatches.length === 0 && (
                  <div className="glass-card rounded-2xl p-12 text-center">
                    <Swords className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">{language === 'fr' ? 'Aucun match disponible pour le moment' : 'No matches available at the moment'}</p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Tournaments - Coming Soon */}
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-neon-red/20 rounded-xl flex items-center justify-center">
                <Trophy className="w-5 h-5 text-neon-red" />
              </div>
              <h2 className="text-2xl font-display text-white">{t('tournaments')}</h2>
            </div>

            <div className="glass-card rounded-3xl p-12 text-center neon-border-red">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-neon-red/30 to-neon-orange/30 border-2 border-neon-red/50 flex items-center justify-center animate-bounce-subtle">
                <Trophy className="w-12 h-12 text-neon-red" />
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
              <div className="glass-card rounded-2xl overflow-hidden neon-border-red flex flex-col">
                <div className="px-6 py-4 border-b border-white/5 bg-gradient-to-r from-neon-red/10 to-transparent">
                  <h3 className="font-display text-xl text-white flex items-center gap-3">
                    <Users className="w-5 h-5 text-neon-red" />
                    {language === 'fr' ? 'TOP 10 JOUEURS' : 'TOP 10 PLAYERS'}
                  </h3>
                </div>
                <div className="flex-1 min-h-[520px]">
                  {loadingPlayers ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-6 h-6 text-neon-red animate-spin" />
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
                              <Link to={`/player/${player.id}`} className={`font-semibold text-sm hover:text-neon-red transition-colors ${player.rank === 1 ? 'text-yellow-500' : player.rank === 2 ? 'text-gray-300' : player.rank === 3 ? 'text-amber-600' : 'text-white'}`}>
                                {player.player}
                              </Link>
                            </div>
                            <span className="text-neon-red font-bold text-sm">{player.points.toLocaleString()} XP</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Top Squads */}
              <div className="glass-card rounded-2xl overflow-hidden neon-border-red flex flex-col">
                <div className="px-6 py-4 border-b border-white/5 bg-gradient-to-r from-neon-red/10 to-transparent">
                  <h3 className="font-display text-xl text-white flex items-center gap-3">
                    <Shield className="w-5 h-5 text-neon-orange" />
                    {language === 'fr' ? 'TOP 10 ESCOUADES' : 'TOP 10 SQUADS'}
                  </h3>
                </div>
                <div className="flex-1 min-h-[520px]">
                  {loadingSquads ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-6 h-6 text-neon-orange animate-spin" />
                    </div>
                  ) : topSquads.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">{language === 'fr' ? 'Aucune escouade classée' : 'No ranked squads'}</div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {topSquads.map((squad) => (
                        <div key={squad.rank} className={`px-6 py-3 hover:bg-white/5 transition-all ${squad.rank <= 3 ? 'bg-gradient-to-r from-yellow-500/5 to-transparent' : ''}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 w-14">
                                {squad.rank === 1 && <Medal className="w-4 h-4 text-yellow-500" />}
                                {squad.rank === 2 && <Medal className="w-4 h-4 text-gray-400" />}
                                {squad.rank === 3 && <Medal className="w-4 h-4 text-amber-600" />}
                                <span className={`font-bold text-sm ${squad.rank <= 3 ? 'text-white' : 'text-gray-400'}`}>#{squad.rank}</span>
                              </div>
                              {squad.logo ? (
                                <img src={squad.logo} alt="" className="w-8 h-8 rounded object-contain" />
                              ) : (
                                <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold" style={{ backgroundColor: squad.color + '30', color: squad.color }}>
                                  {squad.tag?.charAt(0) || 'S'}
                                </div>
                              )}
                              <Link to={`/squad/${squad.id}`} className={`font-semibold text-sm hover:text-neon-red transition-colors ${squad.rank === 1 ? 'text-yellow-500' : squad.rank === 2 ? 'text-gray-300' : squad.rank === 3 ? 'text-amber-600' : 'text-white'}`}>
                                {squad.team}
                                {squad.tag && <span className="text-gray-500 ml-1 text-xs">[{squad.tag}]</span>}
                              </Link>
                            </div>
                            <span className="text-neon-red font-bold text-sm">{squad.points.toLocaleString()} PTS</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Game Modes */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-neon-red/20 rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5 text-neon-red" />
              </div>
              <h2 className="text-2xl font-display text-white">{language === 'fr' ? 'MODES DE JEU' : 'GAME MODES'}</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {gameModes.map((mode, index) => (
                <div key={index} className="glass-card rounded-2xl p-6 text-center card-hover cursor-pointer neon-border-red neon-border-red-hover">
                  <div className="text-5xl mb-4">{mode.icon}</div>
                  <h3 className="text-white font-semibold">{mode.name}</h3>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Roster Selection Dialog */}
      {showRosterDialog && mySquad && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-card rounded-3xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto neon-border-red">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-display text-white flex items-center gap-3">
                <Users className="w-6 h-6 text-neon-red" />
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
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-neon-red/20 border-neon-red/50' : 'glass hover:bg-white/5'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-neon-red border-neon-red' : 'border-gray-500'}`}>
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
              return (
                <button
                  onClick={handleConfirmRoster}
                  disabled={!isValidRoster || postingMatch || acceptingMatch || checkingAnticheat}
                  className="w-full py-4 bg-gradient-to-r from-neon-red to-neon-orange rounded-xl text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2"
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
    </div>
  );
};

export default HardcoreDashboard;
