import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { 
  Trophy, Users, Skull, Check, Eye, 
  Loader2, AlertCircle, CheckCircle, X, Crown, Medal, ChevronRight, AlertTriangle, FileText, Clock, ScrollText, UserPlus, UserMinus, Info
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const Rankings = () => {
  const { t, language } = useLanguage();
  const { selectedMode } = useMode();
  const { user, isAuthenticated } = useAuth();

  const isHardcore = selectedMode === 'hardcore';
  
  const [mySquad, setMySquad] = useState(null);
  const [loadingSquad, setLoadingSquad] = useState(false);
  const [duoTrioLeaderboard, setDuoTrioLeaderboard] = useState([]);
  const [squadTeamLeaderboard, setSquadTeamLeaderboard] = useState([]);
  const [loadingDuoTrio, setLoadingDuoTrio] = useState(false);
  const [loadingSquadTeam, setLoadingSquadTeam] = useState(false);
  const [registering, setRegistering] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [ladderToUnregister, setLadderToUnregister] = useState(null);
  const [myDuoTrioRank, setMyDuoTrioRank] = useState(null);
  const [mySquadTeamRank, setMySquadTeamRank] = useState(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [selectedLadderForRules, setSelectedLadderForRules] = useState(null);
  const [ladderRules, setLadderRules] = useState(null);
  const [loadingRules, setLoadingRules] = useState(false);
  
  const colors = {
    primary: isHardcore ? 'red' : 'cyan',
    gradient: isHardcore ? 'from-red-500 to-orange-500' : 'from-cyan-500 to-blue-500',
    glow: isHardcore ? 'shadow-red-500/30' : 'shadow-cyan-500/30',
    border: isHardcore ? 'border-red-500/30' : 'border-cyan-500/30',
    borderHover: isHardcore ? 'hover:border-red-500/50' : 'hover:border-cyan-500/50',
    text: isHardcore ? 'text-red-400' : 'text-cyan-400',
    bg: isHardcore ? 'bg-red-500/10' : 'bg-cyan-500/10',
  };

  // Check if duo-trio is currently open (00:00 - 20:00 French time)
  const isDuoTrioOpen = () => {
    const parisHour = parseInt(new Date().toLocaleString('en-US', { 
      timeZone: 'Europe/Paris', 
      hour: 'numeric', 
      hour12: false 
    }));
    return parisHour < 20;
  };

  const [duoTrioOpen, setDuoTrioOpen] = useState(isDuoTrioOpen);

  // Update duo-trio status every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setDuoTrioOpen(isDuoTrioOpen());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch ladder rules from API when modal opens
  useEffect(() => {
    const fetchLadderRules = async () => {
      if (!selectedLadderForRules) return;
      
      setLoadingRules(true);
      try {
        const mode = isHardcore ? 'hardcore' : 'cdl';
        const response = await fetch(`${API_URL}/game-mode-rules/${mode}/rankings/${selectedLadderForRules}`);
        const data = await response.json();
        if (data.success && data.rules) {
          setLadderRules(data.rules);
        } else {
          setLadderRules(null);
        }
      } catch (err) {
        console.error('Error fetching ladder rules:', err);
        setLadderRules(null);
      } finally {
        setLoadingRules(false);
      }
    };
    fetchLadderRules();
  }, [isHardcore, selectedLadderForRules]);

  // Textes traduits
  const txt = {
    fr: {
      duoTrio: 'Duo / Trio',
      duoTrioDesc: 'Affrontez d\'autres équipes en 2v2 ou 3v3. Ouvert de 00h00 à 20h00 (heure française).',
      squadTeam: 'Squad / Team',
      squadTeamDesc: 'Le format compétitif en 5v5. Disponible 24h/24.',
      join: 'S\'inscrire au classement',
      unregister: 'Se désinscrire',
      confirmUnregister: 'Êtes-vous sûr de vouloir vous désinscrire ?',
      unregisterWarning: 'Toutes les données liées à ce classement seront perdues (points, victoires, défaites).',
      needSquad: 'Vous devez avoir une escouade pour participer',
      needLogin: 'Connectez-vous pour participer',
      rules: 'Règles du jeu',
      informations: 'Informations',
      top20: 'Top 20',
      noTeams: 'Aucune équipe inscrite',
      points: 'pts',
      wins: 'V',
      losses: 'D',
      registrationSuccess: 'Inscription réussie !',
      unregistrationSuccess: 'Désinscription réussie !',
      cancel: 'Annuler',
      confirm: 'Confirmer',
      yourPosition: 'Votre position',
      notRanked: 'Non classé',
      registered: 'Inscrit',
      open: 'Ouvert',
      closed: 'Fermé',
      alwaysOpen: 'Toujours ouvert',
      hours: '00h00 - 20h00',
    },
    en: {
      duoTrio: 'Duo / Trio',
      duoTrioDesc: 'Face other teams in 2v2 or 3v3. Open from 00:00 to 20:00 (French time).',
      squadTeam: 'Squad / Team',
      squadTeamDesc: 'Competitive format in 5v5. Available 24/7.',
      join: 'Join ranking',
      unregister: 'Unregister',
      confirmUnregister: 'Are you sure you want to unregister?',
      unregisterWarning: 'All data related to this ranking will be lost (points, wins, losses).',
      needSquad: 'You need a squad to participate',
      needLogin: 'Login to participate',
      rules: 'Game rules',
      informations: 'Informations',
      top20: 'Top 20',
      noTeams: 'No teams registered',
      points: 'pts',
      wins: 'W',
      losses: 'L',
      registrationSuccess: 'Registration successful!',
      unregistrationSuccess: 'Unregistration successful!',
      cancel: 'Cancel',
      confirm: 'Confirm',
      yourPosition: 'Your position',
      notRanked: 'Not ranked',
      registered: 'Registered',
      open: 'Open',
      closed: 'Closed',
      alwaysOpen: 'Always open',
      hours: '00:00 - 20:00',
    },
    de: {
      duoTrio: 'Duo / Trio',
      duoTrioDesc: 'Tretet gegen andere Teams im 2v2 oder 3v3 an. Geöffnet von 00:00 bis 20:00 (französische Zeit).',
      squadTeam: 'Squad / Team',
      squadTeamDesc: 'Wettkampfformat im 5v5. 24/7 verfügbar.',
      join: 'Rangliste beitreten',
      unregister: 'Abmelden',
      confirmUnregister: 'Sind Sie sicher, dass Sie sich abmelden möchten?',
      unregisterWarning: 'Alle mit dieser Rangliste verbundenen Daten gehen verloren.',
      needSquad: 'Sie brauchen ein Squad um teilzunehmen',
      needLogin: 'Melden Sie sich an um teilzunehmen',
      rules: 'Spielregeln',
      informations: 'Informationen',
      top20: 'Top 20',
      noTeams: 'Keine Teams registriert',
      points: 'Pkt',
      wins: 'S',
      losses: 'N',
      registrationSuccess: 'Registrierung erfolgreich!',
      unregistrationSuccess: 'Abmeldung erfolgreich!',
      cancel: 'Abbrechen',
      confirm: 'Bestätigen',
      yourPosition: 'Ihre Position',
      notRanked: 'Nicht gewertet',
      registered: 'Registriert',
      open: 'Geöffnet',
      closed: 'Geschlossen',
      alwaysOpen: 'Immer geöffnet',
      hours: '00:00 - 20:00',
    },
    it: {
      duoTrio: 'Duo / Trio',
      duoTrioDesc: 'Affronta altre squadre in 2v2 o 3v3. Aperto dalle 00:00 alle 20:00 (ora francese).',
      squadTeam: 'Squad / Team',
      squadTeamDesc: 'Formato competitivo in 5v5. Disponibile 24/7.',
      join: 'Iscriviti alla classifica',
      unregister: 'Annulla iscrizione',
      confirmUnregister: 'Sei sicuro di volerti disiscrivere?',
      unregisterWarning: 'Tutti i dati relativi a questa classifica andranno persi.',
      needSquad: 'Hai bisogno di una squadra per partecipare',
      needLogin: 'Accedi per partecipare',
      rules: 'Regole del gioco',
      informations: 'Informazioni',
      top20: 'Top 20',
      noTeams: 'Nessuna squadra registrata',
      points: 'pti',
      wins: 'V',
      losses: 'S',
      registrationSuccess: 'Iscrizione riuscita!',
      unregistrationSuccess: 'Cancellazione riuscita!',
      cancel: 'Annulla',
      confirm: 'Conferma',
      yourPosition: 'La tua posizione',
      notRanked: 'Non classificato',
      registered: 'Iscritto',
      open: 'Aperto',
      closed: 'Chiuso',
      alwaysOpen: 'Sempre aperto',
      hours: '00:00 - 20:00',
    },
  }[language] || {
    duoTrio: 'Duo / Trio',
    duoTrioDesc: 'Face other teams in 2v2 or 3v3. Open from 00:00 to 20:00 (French time).',
    squadTeam: 'Squad / Team',
    squadTeamDesc: 'Competitive format in 5v5. Available 24/7.',
    join: 'Join ranking',
    unregister: 'Unregister',
    confirmUnregister: 'Are you sure you want to unregister?',
    unregisterWarning: 'All data related to this ranking will be lost.',
    needSquad: 'You need a squad to participate',
    needLogin: 'Login to participate',
    rules: 'Game rules',
    informations: 'Informations',
    top20: 'Top 20',
    noTeams: 'No teams registered',
    points: 'pts',
    wins: 'W',
    losses: 'L',
    registrationSuccess: 'Registration successful!',
    unregistrationSuccess: 'Unregistration successful!',
    cancel: 'Cancel',
    confirm: 'Confirm',
    yourPosition: 'Your position',
    notRanked: 'Not ranked',
    registered: 'Registered',
    open: 'Open',
    closed: 'Closed',
    alwaysOpen: 'Always open',
    hours: '00:00 - 20:00',
  };

  // Set page title
  useEffect(() => {
    const titles = {
      fr: 'NoMercy - Classements',
      en: 'NoMercy - Rankings',
      it: 'NoMercy - Classifiche',
      de: 'NoMercy - Ranglisten',
    };
    document.title = titles[language] || titles.en;
  }, [language]);

  // Fetch user's squad
  useEffect(() => {
    const fetchMySquad = async () => {
      if (!isAuthenticated) return;
      
      setLoadingSquad(true);
      try {
        const response = await fetch(`${API_URL}/squads/my-squad`, {
          credentials: 'include'
        });
        const data = await response.json();
        if (data.success && data.squad) {
          setMySquad(data.squad);
        }
      } catch (err) {
        console.error('Error fetching squad:', err);
      } finally {
        setLoadingSquad(false);
      }
    };

    fetchMySquad();
  }, [isAuthenticated]);

  // Fetch leaderboard for a specific ladder
  const fetchLeaderboard = async (ladderId, showLoading = true) => {
    if (ladderId === 'duo-trio') {
      if (showLoading) setLoadingDuoTrio(true);
      try {
        const response = await fetch(`${API_URL}/squads/ladder/duo-trio/leaderboard?limit=20`);
        const data = await response.json();
        if (data.success) {
          setDuoTrioLeaderboard(data.squads);
        }
      } catch (err) {
        console.error('Error fetching duo-trio leaderboard:', err);
      } finally {
        if (showLoading) setLoadingDuoTrio(false);
      }
    } else if (ladderId === 'squad-team') {
      if (showLoading) setLoadingSquadTeam(true);
      try {
        const response = await fetch(`${API_URL}/squads/ladder/squad-team/leaderboard?limit=20`);
        const data = await response.json();
        if (data.success) {
          setSquadTeamLeaderboard(data.squads);
        }
      } catch (err) {
        console.error('Error fetching squad-team leaderboard:', err);
      } finally {
        if (showLoading) setLoadingSquadTeam(false);
      }
    }
  };

  // Fetch all leaderboards
  const fetchAllLeaderboards = async () => {
    await Promise.all([
      fetchLeaderboard('duo-trio'),
      fetchLeaderboard('squad-team')
    ]);
  };

  // Initial fetch
  useEffect(() => {
    fetchAllLeaderboards();
  }, []);

  // Find my squad's rank in each ladder
  useEffect(() => {
    if (!mySquad) return;

    // Check Duo/Trio rank
    const duoTrioIndex = duoTrioLeaderboard.findIndex(s => s._id === mySquad._id);
    if (duoTrioIndex !== -1) {
      setMyDuoTrioRank(duoTrioLeaderboard[duoTrioIndex]);
    } else if (isRegistered('duo-trio')) {
      // Squad is registered but not in top 20, fetch their rank
      fetchMyRank('duo-trio');
    }

    // Check Squad/Team rank
    const squadTeamIndex = squadTeamLeaderboard.findIndex(s => s._id === mySquad._id);
    if (squadTeamIndex !== -1) {
      setMySquadTeamRank(squadTeamLeaderboard[squadTeamIndex]);
    } else if (isRegistered('squad-team')) {
      // Squad is registered but not in top 20, fetch their rank
      fetchMyRank('squad-team');
    }
  }, [mySquad, duoTrioLeaderboard, squadTeamLeaderboard]);

  const fetchMyRank = async (ladderId) => {
    try {
      const response = await fetch(`${API_URL}/squads/my-squad/ladder-rank/${ladderId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success && data.rank) {
        if (ladderId === 'duo-trio') {
          setMyDuoTrioRank(data.rank);
        } else {
          setMySquadTeamRank(data.rank);
        }
      }
    } catch (err) {
      console.error('Error fetching my rank:', err);
    }
  };

  // Check if squad is registered to a ladder
  const isRegistered = (ladderId) => {
    return mySquad?.registeredLadders?.some(l => l.ladderId === ladderId);
  };

  // Register to ladder
  const handleRegister = async (ladderId, ladderName) => {
    if (!mySquad) return;
    
    setRegistering(ladderId);
    try {
      const response = await fetch(`${API_URL}/squads/${mySquad._id}/register-ladder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ladderId, ladderName })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMySquad(data.squad);
        setMessage({ type: 'success', text: txt.registrationSuccess });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        
        // Refresh the leaderboard to show the new registration
        await fetchLeaderboard(ladderId, false);
        
        // Set initial rank for the new registration
        if (ladderId === 'duo-trio') {
          setMyDuoTrioRank({ rank: duoTrioLeaderboard.length + 1, ladderPoints: 0, ladderWins: 0, ladderLosses: 0 });
        } else {
          setMySquadTeamRank({ rank: squadTeamLeaderboard.length + 1, ladderPoints: 0, ladderWins: 0, ladderLosses: 0 });
        }
        
        // Fetch the real rank
        await fetchMyRank(ladderId);
      } else {
        setMessage({ type: 'error', text: data.message });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      }
    } catch (err) {
      console.error('Error registering:', err);
    } finally {
      setRegistering(null);
    }
  };

  // Unregister from ladder
  const handleUnregister = async (ladderId) => {
    if (!mySquad) return;
    
    setRegistering(ladderId);
    try {
      const response = await fetch(`${API_URL}/squads/${mySquad._id}/unregister-ladder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ladderId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMySquad(data.squad);
        if (ladderId === 'duo-trio') {
          setMyDuoTrioRank(null);
        } else {
          setMySquadTeamRank(null);
        }
        setMessage({ type: 'success', text: txt.unregistrationSuccess });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        
        // Refresh the leaderboard to update the list
        await fetchLeaderboard(ladderId, false);
      }
    } catch (err) {
      console.error('Error unregistering:', err);
    } finally {
      setRegistering(null);
      setLadderToUnregister(null);
    }
  };

  // Render a leaderboard section
  const renderLeaderboard = (ladder, leaderboard, loading, myRank) => {
    const isDuoTrio = ladder.id === 'duo-trio';
    const isOpen = isDuoTrio ? duoTrioOpen : true;
    const registered = isRegistered(ladder.id);

    return (
      <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border ${colors.border} overflow-hidden`}>
        {/* Header */}
        <div className={`p-5 border-b border-white/10 bg-gradient-to-r ${colors.gradient}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{ladder.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  {ladder.teamSizes.map((size) => (
                    <span key={size} className="text-xs font-bold text-white/80 uppercase tracking-wider px-2 py-0.5 rounded bg-white/20">
                      {size}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Status Badge */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl shadow-lg ${
              isOpen 
                ? 'bg-green-500/30 border-2 border-green-400 shadow-green-500/30' 
                : 'bg-red-500/30 border-2 border-red-400 shadow-red-500/30'
            }`}>
              <div className={`w-3 h-3 rounded-full ${isOpen ? 'bg-green-400 animate-pulse shadow-lg shadow-green-400/50' : 'bg-red-400 shadow-lg shadow-red-400/50'}`}></div>
              <span className={`text-sm font-bold uppercase tracking-wider ${isOpen ? 'text-green-300' : 'text-red-300'}`}>
                {isOpen ? txt.open : txt.closed}
              </span>
            </div>
          </div>
          
          {/* Time info */}
          <div className="mt-3 flex items-center gap-2 text-white/70 text-sm">
            <Clock className="w-4 h-4" />
            <span>{isDuoTrio ? txt.hours : txt.alwaysOpen}</span>
          </div>
        </div>

        {/* Actions Bar - Register/Unregister */}
        <div className="p-4 border-b border-white/10 bg-dark-800/50">
          {loadingSquad ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ) : isAuthenticated && mySquad ? (
            <div className="flex items-center justify-between gap-4">
              {registered ? (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-medium">{txt.registered}</span>
                  </div>
                  <button
                    onClick={() => setLadderToUnregister({ id: ladder.id, name: ladder.name })}
                    disabled={registering === ladder.id}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                  >
                    {registering === ladder.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <UserMinus className="w-4 h-4" />
                        <span className="font-medium">{txt.unregister}</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleRegister(ladder.id, ladder.name)}
                  disabled={registering === ladder.id}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white bg-gradient-to-r ${colors.gradient} hover:opacity-90 transition-all disabled:opacity-50`}
                >
                  {registering === ladder.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      <span>{txt.join}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-2 text-gray-500 text-sm">
              {isAuthenticated ? txt.needSquad : txt.needLogin}
            </div>
          )}
        </div>

        {/* My Squad Position - Only if registered */}
        {registered && mySquad && myRank && (
          <div className={`p-4 border-b border-white/10 bg-gradient-to-r ${colors.bg}`}>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">{txt.yourPosition}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${
                  myRank.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                  myRank.rank === 2 ? 'bg-gray-400/20 text-gray-300' :
                  myRank.rank === 3 ? 'bg-orange-500/20 text-orange-400' :
                  `${colors.bg} ${colors.text}`
                }`}>
                  {myRank.rank <= 3 ? (
                    <Crown className="w-5 h-5" />
                  ) : (
                    `#${myRank.rank}`
                  )}
                </div>
                <div>
                  <p className="text-white font-bold">{mySquad.name}</p>
                  <p className="text-gray-400 text-sm">[{mySquad.tag}]</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-bold text-lg ${colors.text}`}>{myRank.ladderPoints} {txt.points}</p>
                <p className="text-sm text-gray-400">
                  <span className="text-green-400">{myRank.ladderWins}{txt.wins}</span>
                  <span className="mx-1">/</span>
                  <span className="text-red-400">{myRank.ladderLosses}{txt.losses}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Buttons: Informations & Rules */}
        <div className="p-4 border-b border-white/10 flex gap-3">
          <button
            onClick={() => {
              setSelectedLadderForRules(ladder.id);
              setShowRulesModal(true);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium border ${colors.border} hover:bg-white/5 transition-all`}
          >
            <ScrollText className={`w-4 h-4 ${colors.text}`} />
            <span className={colors.text}>{txt.rules}</span>
          </button>
          <Link
            to={`/${selectedMode}/ladder-rules`}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium border border-white/20 hover:bg-white/5 transition-all text-gray-300"
          >
            <Info className="w-4 h-4" />
            <span>{txt.informations}</span>
          </Link>
        </div>

        {/* Top 20 Leaderboard */}
        <div className="p-4">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Trophy className={`w-4 h-4 ${colors.text}`} />
            {txt.top20}
          </h3>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className={`w-6 h-6 ${colors.text} animate-spin`} />
            </div>
          ) : leaderboard.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {leaderboard.map((squad) => (
                <Link
                  key={squad._id}
                  to={`/squad/${squad._id}`}
                  className={`flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all ${
                    squad._id === mySquad?._id ? `${colors.bg} border ${colors.border}` : ''
                  }`}
                >
                  {/* Rank */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                    squad.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                    squad.rank === 2 ? 'bg-gray-400/20 text-gray-300' :
                    squad.rank === 3 ? 'bg-orange-500/20 text-orange-400' :
                    'bg-dark-800 text-gray-500'
                  }`}>
                    {squad.rank <= 3 ? (
                      squad.rank === 1 ? <Crown className="w-4 h-4" /> :
                      squad.rank === 2 ? <Medal className="w-4 h-4" /> :
                      <Medal className="w-4 h-4" />
                    ) : squad.rank}
                  </div>

                  {/* Team Info */}
                  <div 
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: squad.color + '30' }}
                  >
                    {squad.logo ? (
                      <img src={squad.logo} alt="" className="w-6 h-6 object-contain" />
                    ) : (
                      <Users className="w-4 h-4" style={{ color: squad.color }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{squad.name}</p>
                    <p className="text-gray-500 text-xs">[{squad.tag}]</p>
                  </div>

                  {/* Stats */}
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold ${colors.text}`}>{squad.ladderPoints} {txt.points}</p>
                    <p className="text-xs text-gray-500">
                      <span className="text-green-400">{squad.ladderWins}{txt.wins}</span>
                      <span className="mx-1">/</span>
                      <span className="text-red-400">{squad.ladderLosses}{txt.losses}</span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Trophy className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">{txt.noTeams}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-dark-950 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-20"></div>
      {isHardcore ? (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 30% 0%, rgba(239, 68, 68, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 100%, rgba(249, 115, 22, 0.05) 0%, transparent 50%)' }}></div>
      ) : (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 30% 0%, rgba(6, 182, 212, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 100%, rgba(59, 130, 246, 0.05) 0%, transparent 50%)' }}></div>
      )}

      <div className="relative z-10 py-6 sm:py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Message */}
          {message.text && (
            <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
              message.type === 'success' ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400" />
              )}
              <span className={message.type === 'success' ? 'text-green-400' : 'text-red-400'}>
                {message.text}
              </span>
            </div>
          )}

          {/* Header */}
          <div className="relative mb-8 sm:mb-12 rounded-2xl overflow-hidden">
            <div className="absolute inset-0">
              <img
                src="/bo7.jpg"
                alt="Call of Duty: Black Ops 7"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-dark-950 via-dark-950/90 to-dark-950/70"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-transparent to-transparent"></div>
            </div>
            
            <div className="relative z-10 px-6 sm:px-10 py-8 sm:py-12">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center shadow-lg ${colors.glow}`}>
                  <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                </div>
                <div>
                  <p className={`text-xs uppercase tracking-[0.3em] ${colors.text} font-semibold`}>{t('currentGame')}</p>
                  <h1 className="text-2xl sm:text-4xl font-bold text-white">{t('rankings')}</h1>
                </div>
              </div>
              
              {/* Squad Info */}
              {isAuthenticated && mySquad && (
                <Link 
                  to={`/squad/${mySquad._id}`}
                  className="inline-flex items-center gap-3 px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-colors"
                >
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: mySquad.color + '30' }}
                  >
                    {mySquad.logo ? (
                      <img src={mySquad.logo} alt="" className="w-5 h-5 object-contain" />
                    ) : (
                      <Users className="w-4 h-4" style={{ color: mySquad.color }} />
                    )}
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{mySquad.name}</p>
                    <p className="text-gray-400 text-xs">[{mySquad.tag}]</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </Link>
              )}
            </div>
          </div>

          {/* Leaderboards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Duo/Trio */}
            {renderLeaderboard(
              { id: 'duo-trio', name: txt.duoTrio, teamSizes: ['2v2', '3v3'] },
              duoTrioLeaderboard,
              loadingDuoTrio,
              myDuoTrioRank
            )}

            {/* Squad/Team */}
            {renderLeaderboard(
              { id: 'squad-team', name: txt.squadTeam, teamSizes: ['5v5'] },
              squadTeamLeaderboard,
              loadingSquadTeam,
              mySquadTeamRank
            )}
          </div>
        </div>
      </div>

      {/* Unregister Confirmation Modal */}
      {ladderToUnregister && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-dark-900 rounded-2xl border border-red-500/30 p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{txt.unregister}</h3>
                <p className="text-gray-400 text-sm">{ladderToUnregister.name}</p>
              </div>
            </div>
            
            <div className="mb-6 space-y-3">
              <p className="text-gray-300">{txt.confirmUnregister}</p>
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{txt.unregisterWarning}</span>
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setLadderToUnregister(null)}
                className="flex-1 py-3 px-4 bg-dark-800 text-white font-medium rounded-xl hover:bg-dark-700 transition-colors"
              >
                {txt.cancel}
              </button>
              <button
                onClick={() => handleUnregister(ladderToUnregister.id)}
                disabled={registering === ladderToUnregister.id}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {registering === ladderToUnregister.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  txt.confirm
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-dark-900 rounded-2xl border border-white/10 p-6 max-w-5xl w-full shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${colors.gradient} flex items-center justify-center`}>
                  <ScrollText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {ladderRules?.title?.[language] || ladderRules?.title?.fr || (language === 'fr' ? 'Règles du Classement' : language === 'de' ? 'Regeln der Rangliste' : language === 'it' ? 'Regole della Classifica' : 'Ranking Rules')}
                  </h3>
                  <p className={`text-sm ${colors.text}`}>
                    {selectedLadderForRules === 'duo-trio' ? txt.duoTrio : txt.squadTeam}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowRulesModal(false);
                  setSelectedLadderForRules(null);
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            {loadingRules ? (
              <div className="flex justify-center py-8">
                <Loader2 className={`w-8 h-8 ${colors.text} animate-spin`} />
              </div>
            ) : ladderRules?.sections && ladderRules.sections.length > 0 ? (
              <div className="space-y-6">
                {ladderRules.sections.sort((a, b) => a.order - b.order).map((section, index) => (
                  <div key={section._id || index} className="border-b border-white/10 pb-6 last:border-0">
                    <h4 className={`text-lg font-semibold ${colors.text} mb-3`}>
                      {section.title?.[language] || section.title?.fr || section.title?.en}
                    </h4>
                    <div 
                      className="prose prose-invert max-w-none text-gray-300 prose-headings:text-white prose-strong:text-white prose-ul:text-gray-300 prose-ol:text-gray-300"
                      dangerouslySetInnerHTML={{ 
                        __html: section.content?.[language] || section.content?.fr || section.content?.en || '' 
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic text-center py-8">
                {language === 'fr' ? 'Aucune règle définie pour le moment.' : language === 'de' ? 'Noch keine Regeln definiert.' : language === 'it' ? 'Nessuna regola definita per il momento.' : 'No rules defined yet.'}
              </p>
            )}
            
            <button
              onClick={() => {
                setShowRulesModal(false);
                setSelectedLadderForRules(null);
              }}
              className={`w-full mt-6 py-3 rounded-xl font-medium text-white bg-gradient-to-r ${colors.gradient} hover:opacity-90 transition-opacity`}
            >
              {language === 'fr' ? 'Fermer' : language === 'de' ? 'Schließen' : language === 'it' ? 'Chiudi' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rankings;
