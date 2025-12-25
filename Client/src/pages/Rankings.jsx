import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { 
  Trophy, Users, Target, Flag, Skull, Check, Eye, ArrowLeft,
  Loader2, AlertCircle, CheckCircle, X, Crown, Medal, ChevronRight, AlertTriangle, FileText, Clock, ScrollText
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const Rankings = () => {
  const { t, language } = useLanguage();
  const { selectedMode } = useMode();
  const { user, isAuthenticated } = useAuth();

  const isHardcore = selectedMode === 'hardcore';
  
  const [mySquad, setMySquad] = useState(null);
  const [loadingSquad, setLoadingSquad] = useState(false);
  const [selectedLadder, setSelectedLadder] = useState(null);
  const [ladderLeaderboard, setLadderLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [registering, setRegistering] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [ladderToUnregister, setLadderToUnregister] = useState(null);
  const [showLadderRulesModal, setShowLadderRulesModal] = useState(false);
  const [selectedLadderType, setSelectedLadderType] = useState(null); // 'duo-trio' or 'squad-team'
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

  // Traductions des modes de jeu
  const gameModeNames = {
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
    de: {
      'Search & Destroy': 'Suchen & Zerstören',
      'Domination': 'Herrschaft',
      'Team Deathmatch': 'Team-Deathmatch',
    },
    it: {
      'Search & Destroy': 'Cerca e Distruggi',
      'Domination': 'Dominazione',
      'Team Deathmatch': 'Deathmatch a squadre',
    },
  };

  const getModeName = (mode) => {
    return gameModeNames[language]?.[mode] || gameModeNames['en'][mode] || mode;
  };

  // Textes traduits
  const texts = {
    fr: {
      duoTrio: 'Duo / Trio',
      duoTrioDesc: 'Affrontez d\'autres équipes en 2v2 ou 3v3. Parfait pour les petites escouades.',
      squadTeam: 'Squad / Team',
      squadTeamDesc: 'Le format compétitif en 5v5. Pour les équipes coordonnées.',
      formats: 'Formats',
      availableModes: 'Modes disponibles',
      join: 'Rejoindre ce classement',
      viewDetails: 'Voir le classement',
      registered: 'Inscrit',
      unregister: 'Se désinscrire',
      confirmUnregister: 'Êtes-vous sûr de vouloir vous désinscrire ?',
      unregisterWarning: 'Toutes les données liées à ce classement seront perdues (points, victoires, défaites).',
      needSquad: 'Créez ou rejoignez une escouade pour participer',
      needLogin: 'Connectez-vous pour participer',
      rules: 'Règlement',
      leaderboard: 'Classement',
      top100: 'Top 100 équipes',
      noTeams: 'Aucune équipe inscrite pour le moment',
      points: 'Points',
      wins: 'Victoires',
      losses: 'Défaites',
      members: 'Membres',
      registrationSuccess: 'Inscription réussie !',
      unregistrationSuccess: 'Désinscription réussie !',
      back: 'Retour',
      // Matchmaking
      findMatch: 'Trouver un match',
      postMatch: 'Poster un match',
      availableMatches: 'Matchs disponibles',
      noMatches: 'Aucun match disponible',
      acceptMatch: 'Accepter',
      cancelMatch: 'Annuler',
      matchPosted: 'Match posté avec succès !',
      matchAccepted: 'Match accepté !',
      matchCancelled: 'Match annulé',
      gameMode: 'Mode de jeu',
      scheduledAt: 'Date et heure',
      description: 'Description (optionnel)',
      descPlaceholder: 'Message pour les adversaires...',
      vsTeam: 'vs',
      postedBy: 'Posté par',
      in: 'dans',
      yourMatch: 'Votre match',
      close: 'Fermer',
      myMatches: 'Mes matchs',
      pendingMatches: 'En attente',
      acceptedMatches: 'Acceptés',
      timeRestriction: 'Ouvert de 00h00 à 20h00 (heure française)',
      timeRestrictionClosed: 'Ce classement est fermé entre 20h00 et 00h00',
      ladderRules: {
        duoTrio: [
          '⏰ HORAIRES: Matchs disponibles de 00h00 à 20h00 (heure française)',
          'Les équipes doivent avoir 2 ou 3 joueurs actifs',
          'Mode: Search & Destroy uniquement',
          'Maps autorisées: Nuketown, Firing Range, Summit, Slums, Raid, Standoff',
          'Les matchs se jouent en BO3 (Best of 3)',
          'Chaque victoire rapporte 25 points',
          'Chaque défaite retire 15 points',
          'Triche = ban permanent de l\'équipe',
          'Les joueurs doivent être présents 10 minutes avant le match',
        ],
        squadTeam: [
          'Les équipes doivent avoir 4 ou 5 joueurs actifs',
          'Mode: Search & Destroy uniquement',
          'Maps autorisées: Nuketown, Firing Range, Summit, Slums, Raid, Standoff, Hijacked, Express',
          'Les matchs se jouent en BO5 (Best of 5)',
          'Chaque victoire rapporte 30 points',
          'Chaque défaite retire 20 points',
          'Triche = ban permanent de l\'équipe',
          'Les joueurs doivent être présents 15 minutes avant le match',
          'Un coach peut être présent mais ne peut pas jouer',
        ],
      },
    },
    en: {
      duoTrio: 'Duo / Trio',
      duoTrioDesc: 'Face other teams in 2v2 or 3v3. Perfect for small squads.',
      squadTeam: 'Squad / Team',
      timeRestriction: 'Open from 00:00 to 20:00 (French time)',
      timeRestrictionClosed: 'This ranking is closed between 20:00 and 00:00',
      squadTeamDesc: 'Competitive format in 4v4 or 5v5. For coordinated teams.',
      formats: 'Formats',
      availableModes: 'Available modes',
      join: 'Join this ranking',
      viewDetails: 'View ranking',
      registered: 'Registered',
      unregister: 'Unregister',
      confirmUnregister: 'Are you sure you want to unregister?',
      unregisterWarning: 'All data related to this ranking will be lost (points, wins, losses).',
      needSquad: 'Create or join a squad to participate',
      needLogin: 'Login to participate',
      rules: 'Rules',
      leaderboard: 'Leaderboard',
      top100: 'Top 100 teams',
      noTeams: 'No teams registered yet',
      points: 'Points',
      wins: 'Wins',
      losses: 'Losses',
      members: 'Members',
      registrationSuccess: 'Registration successful!',
      unregistrationSuccess: 'Unregistration successful!',
      back: 'Back',
      // Matchmaking
      findMatch: 'Find a match',
      postMatch: 'Post a match',
      availableMatches: 'Available matches',
      noMatches: 'No matches available',
      acceptMatch: 'Accept',
      cancelMatch: 'Cancel',
      matchPosted: 'Match posted successfully!',
      matchAccepted: 'Match accepted!',
      matchCancelled: 'Match cancelled',
      gameMode: 'Game mode',
      scheduledAt: 'Date and time',
      description: 'Description (optional)',
      descPlaceholder: 'Message for opponents...',
      vsTeam: 'vs',
      postedBy: 'Posted by',
      in: 'in',
      yourMatch: 'Your match',
      close: 'Close',
      myMatches: 'My matches',
      pendingMatches: 'Pending',
      acceptedMatches: 'Accepted',
      ladderRules: {
        duoTrio: [
          '⏰ HOURS: Matches available from 00:00 to 20:00 (French time)',
          'Teams must have 2 or 3 active players',
          'Mode: Search & Destroy only',
          'Allowed maps: Nuketown, Firing Range, Summit, Slums, Raid, Standoff',
          'Matches are played in BO3 (Best of 3)',
          'Each win gives 25 points',
          'Each loss removes 15 points',
          'Cheating = permanent team ban',
          'Players must be present 10 minutes before the match',
        ],
        squadTeam: [
          'Teams must have 4 or 5 active players',
          'Mode: Search & Destroy only',
          'Allowed maps: Nuketown, Firing Range, Summit, Slums, Raid, Standoff, Hijacked, Express',
          'Matches are played in BO5 (Best of 5)',
          'Each win gives 30 points',
          'Each loss removes 20 points',
          'Cheating = permanent team ban',
          'Players must be present 15 minutes before the match',
          'A coach can be present but cannot play',
        ],
      },
    },
    de: {
      duoTrio: 'Duo / Trio',
      duoTrioDesc: 'Tretet gegen andere Teams im 2v2 oder 3v3 an. Perfekt für kleine Squads.',
      squadTeam: 'Squad / Team',
      squadTeamDesc: 'Wettkampfformat im 5v5. Für koordinierte Teams.',
      timeRestriction: 'Geöffnet von 00:00 bis 20:00 (französische Zeit)',
      timeRestrictionClosed: 'Diese Rangliste ist zwischen 20:00 und 00:00 geschlossen',
      formats: 'Formate',
      availableModes: 'Verfügbare Modi',
      join: 'Dieser Rangliste beitreten',
      viewDetails: 'Rangliste ansehen',
      registered: 'Registriert',
      unregister: 'Abmelden',
      confirmUnregister: 'Sind Sie sicher, dass Sie sich abmelden möchten?',
      unregisterWarning: 'Alle mit dieser Rangliste verbundenen Daten gehen verloren (Punkte, Siege, Niederlagen).',
      needSquad: 'Erstelle oder tritt einem Squad bei um teilzunehmen',
      needLogin: 'Melde dich an um teilzunehmen',
      rules: 'Regeln',
      leaderboard: 'Rangliste',
      top100: 'Top 100 Teams',
      noTeams: 'Noch keine Teams registriert',
      points: 'Punkte',
      wins: 'Siege',
      losses: 'Niederlagen',
      members: 'Mitglieder',
      registrationSuccess: 'Registrierung erfolgreich!',
      unregistrationSuccess: 'Abmeldung erfolgreich!',
      back: 'Zurück',
      // Matchmaking
      findMatch: 'Match finden',
      postMatch: 'Match erstellen',
      availableMatches: 'Verfügbare Matches',
      noMatches: 'Keine Matches verfügbar',
      acceptMatch: 'Annehmen',
      cancelMatch: 'Abbrechen',
      matchPosted: 'Match erfolgreich erstellt!',
      matchAccepted: 'Match angenommen!',
      matchCancelled: 'Match abgebrochen',
      gameMode: 'Spielmodus',
      scheduledAt: 'Datum und Uhrzeit',
      description: 'Beschreibung (optional)',
      descPlaceholder: 'Nachricht für Gegner...',
      vsTeam: 'vs',
      postedBy: 'Erstellt von',
      in: 'in',
      yourMatch: 'Dein Match',
      close: 'Schließen',
      myMatches: 'Meine Matches',
      pendingMatches: 'Ausstehend',
      acceptedMatches: 'Angenommen',
      ladderRules: {
        duoTrio: [
          '⏰ ZEITEN: Matches von 00:00 bis 20:00 (französische Zeit) verfügbar',
          'Teams müssen 2 oder 3 aktive Spieler haben',
          'Modus: Nur Search & Destroy',
          'Erlaubte Karten: Nuketown, Firing Range, Summit, Slums, Raid, Standoff',
          'Spiele werden im BO3 (Best of 3) gespielt',
          'Jeder Sieg bringt 25 Punkte',
          'Jede Niederlage entfernt 15 Punkte',
          'Cheating = permanenter Team-Ban',
          'Spieler müssen 10 Minuten vor dem Match anwesend sein',
        ],
        squadTeam: [
          'Teams müssen 4 oder 5 aktive Spieler haben',
          'Modus: Nur Search & Destroy',
          'Erlaubte Karten: Nuketown, Firing Range, Summit, Slums, Raid, Standoff, Hijacked, Express',
          'Spiele werden im BO5 (Best of 5) gespielt',
          'Jeder Sieg bringt 30 Punkte',
          'Jede Niederlage entfernt 20 Punkte',
          'Cheating = permanenter Team-Ban',
          'Spieler müssen 15 Minuten vor dem Match anwesend sein',
          'Ein Coach kann anwesend sein aber nicht spielen',
        ],
      },
    },
    it: {
      duoTrio: 'Duo / Trio',
      duoTrioDesc: 'Affronta altre squadre in 2v2 o 3v3. Perfetto per piccole squadre.',
      squadTeam: 'Squad / Team',
      squadTeamDesc: 'Formato competitivo in 4v4 o 5v5. Per squadre coordinate.',
      timeRestriction: 'Aperto dalle 00:00 alle 20:00 (ora francese)',
      timeRestrictionClosed: 'Questa classifica è chiusa tra le 20:00 e le 00:00',
      formats: 'Formati',
      availableModes: 'Modalità disponibili',
      join: 'Unisciti a questa classifica',
      viewDetails: 'Vedi classifica',
      registered: 'Iscritto',
      unregister: 'Annulla iscrizione',
      confirmUnregister: 'Sei sicuro di volerti disiscrivere?',
      unregisterWarning: 'Tutti i dati relativi a questa classifica andranno persi (punti, vittorie, sconfitte).',
      needSquad: 'Crea o unisciti a una squadra per partecipare',
      needLogin: 'Accedi per partecipare',
      rules: 'Regolamento',
      leaderboard: 'Classifica',
      top100: 'Top 100 squadre',
      noTeams: 'Nessuna squadra registrata ancora',
      points: 'Punti',
      wins: 'Vittorie',
      losses: 'Sconfitte',
      members: 'Membri',
      registrationSuccess: 'Iscrizione riuscita!',
      unregistrationSuccess: 'Cancellazione riuscita!',
      back: 'Indietro',
      // Matchmaking
      findMatch: 'Trova partita',
      postMatch: 'Pubblica partita',
      availableMatches: 'Partite disponibili',
      noMatches: 'Nessuna partita disponibile',
      acceptMatch: 'Accetta',
      cancelMatch: 'Annulla',
      matchPosted: 'Partita pubblicata con successo!',
      matchAccepted: 'Partita accettata!',
      matchCancelled: 'Partita annullata',
      gameMode: 'Modalità di gioco',
      scheduledAt: 'Data e ora',
      description: 'Descrizione (opzionale)',
      descPlaceholder: 'Messaggio per gli avversari...',
      vsTeam: 'vs',
      postedBy: 'Pubblicato da',
      in: 'tra',
      yourMatch: 'La tua partita',
      close: 'Chiudi',
      myMatches: 'Le mie partite',
      pendingMatches: 'In attesa',
      acceptedMatches: 'Accettate',
      ladderRules: {
        duoTrio: [
          '⏰ ORARI: Partite disponibili dalle 00:00 alle 20:00 (ora francese)',
          'Le squadre devono avere 2 o 3 giocatori attivi',
          'Modalità: Solo Search & Destroy',
          'Mappe consentite: Nuketown, Firing Range, Summit, Slums, Raid, Standoff',
          'Le partite si giocano in BO3 (Best of 3)',
          'Ogni vittoria dà 25 punti',
          'Ogni sconfitta rimuove 15 punti',
          'Cheating = ban permanente della squadra',
          'I giocatori devono essere presenti 10 minuti prima della partita',
        ],
        squadTeam: [
          'Le squadre devono avere 4 o 5 giocatori attivi',
          'Modalità: Solo Search & Destroy',
          'Mappe consentite: Nuketown, Firing Range, Summit, Slums, Raid, Standoff, Hijacked, Express',
          'Le partite si giocano in BO5 (Best of 5)',
          'Ogni vittoria dà 30 punti',
          'Ogni sconfitta rimuove 20 punti',
          'Cheating = ban permanente della squadra',
          'I giocatori devono essere presenti 15 minuti prima della partita',
          'Un coach può essere presente ma non può giocare',
        ],
      },
    },
  };

  const txt = texts[language] || texts.en;

  // Icon mapping
  const iconMap = {
    Target: Target,
    Flag: Flag,
    Skull: Skull,
    Check: Check,
  };

  // Ladders hardcodés
  const ladders = [
    {
      id: 'duo-trio',
      name: txt.duoTrio,
      teamSizes: ['2v2', '3v3'],
      description: txt.duoTrioDesc,
      rulesKey: 'duoTrio',
      gameModes: [
        { name: 'Search & Destroy', icon: 'Skull', isActive: true },
      ],
      timeRestriction: true, // Match posting restricted to 00:00 - 20:00 French time
    },
    {
      id: 'squad-team',
      name: txt.squadTeam,
      teamSizes: ['5v5'],
      description: txt.squadTeamDesc,
      rulesKey: 'squadTeam',
      gameModes: [
        { name: 'Search & Destroy', icon: 'Skull', isActive: true },
      ]
    },
  ];

  // Set page title
  useEffect(() => {
    const titles = {
      fr: 'NoMercy - Classement',
      en: 'NoMercy - Rankings',
      it: 'NoMercy - Classifica',
      de: 'NoMercy - Rangliste',
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

  // Fetch ladder rules from new rich rules API when modal opens
  useEffect(() => {
    const fetchLadderRules = async () => {
      if (!selectedLadderType) return;
      
      setLoadingRules(true);
      try {
        const mode = isHardcore ? 'hardcore' : 'cdl';
        const response = await fetch(`${API_URL}/game-mode-rules/${mode}/rankings/${selectedLadderType}`);
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
  }, [isHardcore, selectedLadderType]);

  // Fetch ladder leaderboard
  const fetchLeaderboard = async (ladderId) => {
    setLoadingLeaderboard(true);
    try {
      const response = await fetch(`${API_URL}/squads/ladder/${ladderId}/leaderboard?limit=100`);
      const data = await response.json();
      if (data.success) {
        setLadderLeaderboard(data.squads);
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  // Check if squad is registered to a ladder
  const isRegistered = (ladderId) => {
    return mySquad?.registeredLadders?.some(l => l.ladderId === ladderId);
  };

  // Register to ladder
  const handleRegister = async (ladder) => {
    if (!mySquad) return;
    
    setRegistering(ladder.id);
    try {
      const response = await fetch(`${API_URL}/squads/${mySquad._id}/register-ladder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ladderId: ladder.id, ladderName: ladder.name })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMySquad(data.squad);
        setMessage({ type: 'success', text: txt.registrationSuccess });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
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
        setMessage({ type: 'success', text: txt.unregistrationSuccess });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      }
    } catch (err) {
      console.error('Error unregistering:', err);
    } finally {
      setRegistering(null);
    }
  };

  // Open ladder details
  const openLadderDetails = (ladder) => {
    setSelectedLadder(ladder);
    fetchLeaderboard(ladder.id);
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

      <div className="relative z-10 py-4 sm:py-8">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8">
          
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
          
          {/* Header avec image */}
          <div className="relative mb-6 sm:mb-10 rounded-xl sm:rounded-2xl overflow-hidden">
            <div className="absolute inset-0">
              <img
                src="/bo7.jpg"
                alt="Call of Duty: Black Ops 7"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-dark-950 via-dark-950/90 to-dark-950/70"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-transparent to-transparent"></div>
            </div>
            
            <div className="relative z-10 px-4 sm:px-8 py-6 sm:py-10">
              <div className="flex items-center space-x-3 sm:space-x-4 mb-3 sm:mb-4">
                <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center shadow-lg ${colors.glow}`}>
                  <Trophy className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                </div>
                <div>
                  <p className={`text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] ${colors.text} font-semibold`}>{t('currentGame')}</p>
                  <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-white">Black Ops 7</h1>
                </div>
              </div>
              <p className="text-gray-400 text-sm sm:text-base max-w-xl hidden sm:block">
                {language === 'fr' 
                  ? 'Rejoins un classement et affronte les meilleurs joueurs de la communauté.'
                  : language === 'it'
                  ? 'Unisciti a una classifica e sfida i migliori giocatori della community.'
                  : language === 'de'
                  ? 'Tritt einer Rangliste bei und fordere die besten Spieler der Community heraus.'
                  : 'Join a ladder and compete against the best players in the community.'}
              </p>
              
              {/* Squad status */}
              {isAuthenticated && (
                <div className="mt-4">
                  {loadingSquad ? (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Chargement...</span>
                    </div>
                  ) : mySquad ? (
                    <Link to={`/squad/${mySquad._id}`} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: mySquad.color + '30', borderColor: mySquad.color }}>
                        <Users className="w-3 h-3" style={{ color: mySquad.color }} />
                      </div>
                      <span className="text-white font-medium">{mySquad.name}</span>
                      <span className="text-gray-400 text-sm">[{mySquad.tag}]</span>
                    </Link>
                  ) : (
                    <p className="text-gray-500 text-sm">{txt.needSquad}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Titre section */}
          <div className="flex items-center space-x-3 mb-6">
            <div className={`w-1 h-8 rounded-full bg-gradient-to-b ${colors.gradient}`}></div>
            <h2 className="text-xl font-bold text-white">{t('rankings')}</h2>
          </div>

          {/* Cartes de classement */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {ladders.map((ladder) => {
              const registered = isRegistered(ladder.id);
              
              return (
                <div 
                  key={ladder.id}
                  className={`group relative bg-dark-900/80 backdrop-blur-xl rounded-2xl border ${colors.border} ${colors.borderHover} transition-all duration-300 overflow-hidden hover:shadow-xl ${colors.glow} flex flex-col`}
                >
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${colors.gradient}`}></div>
                  
                  {registered && (
                    <div className="absolute top-4 right-4 flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-lg">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      <span className="text-xs text-green-400 font-medium">{txt.registered}</span>
                    </div>
                  )}
                  
                  <div className="p-6 flex flex-col flex-grow">
                    {/* Time Restriction Banner for Duo-Trio */}
                    {ladder.timeRestriction && (
                      <div className={`mb-4 px-3 py-2 rounded-lg border flex items-center gap-2 ${
                        duoTrioOpen 
                          ? 'bg-green-500/10 border-green-500/30' 
                          : 'bg-red-500/10 border-red-500/30'
                      }`}>
                        <Clock className={`w-4 h-4 flex-shrink-0 ${duoTrioOpen ? 'text-green-400' : 'text-red-400'}`} />
                        <span className={`text-xs font-medium ${duoTrioOpen ? 'text-green-400' : 'text-red-400'}`}>
                          {duoTrioOpen ? txt.timeRestriction : txt.timeRestrictionClosed}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center space-x-3">
                        <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center border ${colors.border}`}>
                          <Users className={`w-6 h-6 ${colors.text}`} />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white">{ladder.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            {ladder.teamSizes.map((size) => (
                              <span key={size} className={`text-xs font-bold ${colors.text} uppercase tracking-wider px-2 py-0.5 rounded ${colors.bg} border ${colors.border}`}>
                                {size}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-gray-400 text-sm mb-4">{ladder.description}</p>

                    {ladder.gameModes && ladder.gameModes.length > 0 && (
                      <div className="mb-6">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{txt.availableModes}</p>
                        <div className="flex flex-wrap gap-2">
                          {ladder.gameModes.filter(mode => mode.isActive).map((mode, idx) => {
                            const IconComponent = iconMap[mode.icon] || Target;
                            return (
                              <div key={idx} className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${colors.bg} border ${colors.border}`}>
                                <IconComponent className={`w-4 h-4 ${colors.text}`} />
                                <span className="text-sm text-white font-medium">{getModeName(mode.name)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="mt-auto space-y-3">
                      {/* Informations Button (formerly Rules & Maps) */}
                      <Link
                        to={`/${selectedMode}/ladder-rules/${ladder.id}`}
                        className={`w-full py-3.5 rounded-xl font-bold border-2 ${colors.border} hover:border-${colors.primary}-500/50 bg-gradient-to-r ${colors.gradient} bg-clip-text text-transparent hover:bg-white/5 transition-all flex items-center justify-center gap-2 group relative overflow-hidden`}
                      >
                        <div className={`absolute inset-0 bg-gradient-to-r ${colors.gradient} opacity-0 group-hover:opacity-10 transition-opacity`}></div>
                        <FileText className={`w-5 h-5 ${colors.text} relative z-10`} />
                        <span className={`${colors.text} font-bold text-base relative z-10`}>
                          {language === 'fr' ? '📖 Informations' : language === 'de' ? '📖 Informationen' : language === 'it' ? '📖 Informazioni' : '📖 Informations'}
                        </span>
                        <ChevronRight className={`w-4 h-4 ${colors.text} opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all relative z-10`} />
                      </Link>

                      {/* Rules Button */}
                      <button
                        onClick={() => {
                          setSelectedLadderType(ladder.id);
                          setShowLadderRulesModal(true);
                        }}
                        className={`w-full py-3 rounded-xl font-medium text-gray-300 border ${colors.border} bg-dark-800/50 hover:bg-white/5 transition-all flex items-center justify-center gap-2`}
                      >
                        <ScrollText className="w-4 h-4" />
                        {language === 'fr' ? '📜 Règles' : language === 'de' ? '📜 Regeln' : language === 'it' ? '📜 Regole' : '📜 Rules'}
                      </button>

                      {/* View Details Button */}
                      <button 
                        onClick={() => openLadderDetails(ladder)}
                        className={`w-full py-3 rounded-xl font-medium text-white border ${colors.border} ${colors.bg} hover:bg-white/10 transition-all flex items-center justify-center gap-2`}
                      >
                        <Eye className="w-4 h-4" />
                        {txt.viewDetails}
                      </button>
                      
                      {/* Join/Unregister Button */}
                      {isAuthenticated && mySquad ? (
                        registered ? (
                          <button 
                            onClick={() => setLadderToUnregister(ladder)}
                            disabled={registering === ladder.id}
                            className="w-full py-3 rounded-xl font-medium text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {registering === ladder.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <X className="w-4 h-4" />
                                {txt.unregister}
                              </>
                            )}
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleRegister(ladder)}
                            disabled={registering === ladder.id}
                            className={`w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r ${colors.gradient} shadow-lg ${colors.glow} hover:shadow-xl hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50`}
                          >
                            {registering === ladder.id ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              txt.join
                            )}
                          </button>
                        )
                      ) : (
                        <div className="w-full py-3 rounded-xl text-center text-gray-500 bg-dark-800/50 border border-white/10">
                          {isAuthenticated ? txt.needSquad : txt.needLogin}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ladder Details Modal */}
      {selectedLadder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedLadder(null)}></div>
          
          <div className="relative w-full max-w-4xl bg-dark-900 border border-white/10 rounded-xl sm:rounded-2xl shadow-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col mx-2 sm:mx-0">
            {/* Header */}
            <div className={`p-6 border-b border-white/10 bg-gradient-to-r ${colors.gradient}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setSelectedLadder(null)}
                    className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-white" />
                  </button>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{selectedLadder.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedLadder.teamSizes.map((size) => (
                        <span key={size} className="text-xs font-bold text-white/80 uppercase tracking-wider px-2 py-0.5 rounded bg-white/20">
                          {size}
                        </span>
              ))}
            </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedLadder(null)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-3 sm:p-6">
                {/* Next Reset Info */}
                <div className={`mb-4 p-3 rounded-xl bg-gradient-to-r ${colors.bg} border ${colors.border} flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <Clock className={`w-4 h-4 ${colors.text}`} />
                    <span className="text-gray-300 text-sm">
                      {language === 'fr' ? 'Prochain reset :' : language === 'de' ? 'Nächster Reset:' : language === 'it' ? 'Prossimo reset:' : 'Next reset:'}
                    </span>
                  </div>
                  <span className={`font-bold ${colors.text}`}>
                    {(() => {
                      const now = new Date();
                      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                      return nextMonth.toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : language === 'it' ? 'it-IT' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
                    })()}
                  </span>
                </div>

                {/* Leaderboard */}
                <div>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Trophy className={`w-5 h-5 ${colors.text}`} />
                    {txt.top100}
                  </h3>
                  
                  {loadingLeaderboard ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className={`w-8 h-8 ${colors.text} animate-spin`} />
                    </div>
                  ) : ladderLeaderboard.length > 0 ? (
                    <div className="bg-dark-800/50 rounded-xl overflow-hidden">
                      <div className="max-h-[400px] overflow-y-auto">
                        {/* Mobile: Cards */}
                        <div className="sm:hidden divide-y divide-white/5">
                          {ladderLeaderboard.map((squad) => (
                            <Link 
                              key={squad._id} 
                              to={`/squad/${squad._id}`}
                              className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors"
                            >
                              <span className={`font-bold text-sm w-6 ${
                                squad.rank === 1 ? 'text-yellow-400' :
                                squad.rank === 2 ? 'text-gray-300' :
                                squad.rank === 3 ? 'text-orange-400' :
                                'text-gray-500'
                              }`}>
                                {squad.rank === 1 && <Crown className="w-3 h-3 inline mr-0.5" />}
                                {squad.rank}
                              </span>
                              <div 
                                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: squad.color + '30' }}
                              >
                                {squad.logo ? (
                                  <img src={squad.logo} alt="" className="w-5 h-5 object-contain" />
                                ) : (
                                  <Users className="w-4 h-4" style={{ color: squad.color }} />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-medium text-sm truncate">{squad.name}</p>
                                <div className="flex items-center gap-2 text-xs">
                                  <span className={`font-bold ${colors.text}`}>{squad.ladderPoints} pts</span>
                                  <span className="text-gray-500">•</span>
                                  <span className="text-green-400">{squad.ladderWins}W</span>
                                  <span className="text-red-400">{squad.ladderLosses}L</span>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>

                        {/* Desktop: Table */}
                        <table className="w-full hidden sm:table">
                          <thead className="sticky top-0 bg-dark-800">
                            <tr className="border-b border-white/10">
                              <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">#</th>
                              <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">{txt.leaderboard}</th>
                              <th className="text-center text-xs font-medium text-gray-500 uppercase px-4 py-3">{txt.points}</th>
                              <th className="text-center text-xs font-medium text-gray-500 uppercase px-4 py-3">W/L</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {ladderLeaderboard.map((squad) => (
                              <tr key={squad._id} className="hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3">
                                  <span className={`font-bold ${
                                    squad.rank === 1 ? 'text-yellow-400' :
                                    squad.rank === 2 ? 'text-gray-300' :
                                    squad.rank === 3 ? 'text-orange-400' :
                                    'text-gray-500'
                                  }`}>
                                    {squad.rank === 1 && <Crown className="w-4 h-4 inline mr-1" />}
                                    {squad.rank}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <Link to={`/squad/${squad._id}`} className="flex items-center gap-3 hover:opacity-80">
                                    <div 
                                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                                      style={{ backgroundColor: squad.color + '30' }}
                                    >
                                      {squad.logo ? (
                                        <img src={squad.logo} alt="" className="w-6 h-6 object-contain" />
                                      ) : (
                                        <Users className="w-4 h-4" style={{ color: squad.color }} />
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-white font-medium">{squad.name}</p>
                                      <p className="text-gray-500 text-xs">[{squad.tag}]</p>
                                    </div>
                                  </Link>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`font-bold ${colors.text}`}>{squad.ladderPoints}</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="text-green-400">{squad.ladderWins}</span>
                                  <span className="text-gray-500 mx-1">/</span>
                                  <span className="text-red-400">{squad.ladderLosses}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-dark-800/50 rounded-xl">
                      <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500">{txt.noTeams}</p>
            </div>
          )}
        </div>
      </div>
            </div>
          </div>
        </div>
      )}

      {/* Unregister Confirmation Dialog */}
      {ladderToUnregister && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-dark-900 rounded-2xl border border-red-500/30 p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{txt.unregister}</h3>
                <p className="text-gray-400 text-sm">
                  {ladderToUnregister.id === 'duo-trio' ? txt.duoTrio : txt.squadTeam}
                </p>
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
                className="flex-1 py-2 px-4 bg-dark-800 text-white font-medium rounded-lg hover:bg-dark-700 transition-colors"
              >
                {txt.back}
              </button>
              <button
                onClick={() => {
                  handleUnregister(ladderToUnregister.id);
                  setLadderToUnregister(null);
                }}
                disabled={registering === ladderToUnregister.id}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {registering === ladderToUnregister.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  txt.unregister
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ladder Rules Modal */}
      {showLadderRulesModal && (
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
                    {selectedLadderType === 'duo-trio' ? txt.duoTrio : txt.squadTeam}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowLadderRulesModal(false);
                  setSelectedLadderType(null);
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            {loadingRules ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
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
                setShowLadderRulesModal(false);
                setSelectedLadderType(null);
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
