import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { useSocket } from '../SocketContext';
import { getUserAvatar } from '../utils/avatar';
import { 
  Trophy, Crown, Zap, Shield, Target, Loader2, TrendingUp, Swords, Lock, 
  Users, Clock, Play, Square, AlertTriangle, ShieldCheck, Crosshair, 
  Medal, Star, ChevronRight, Flame, Sparkles, Eye, Bot, Radio, BookOpen, Coins, X
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

// Audio pour le matchmaking - Web Audio API avec fichier sound.mp3
let audioContext = null;
let audioBuffer = null;
let audioLoaded = false;

// URL du son - hébergé sur le serveur API
const SOUND_URL = 'https://api-nomercy.ggsecure.io/public/sounds/sound.mp3';

const initAudioContext = async () => {
  if (audioContext && audioBuffer) return;
  
  try {
    // Créer le contexte audio
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log('[Audio] AudioContext créé');
    }
    
    // Charger le fichier audio depuis l'API
    if (!audioBuffer) {
      console.log('[Audio] Chargement depuis:', SOUND_URL);
      
      const response = await fetch(SOUND_URL);
      console.log('[Audio] Réponse:', response.status);
      
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        console.log('[Audio] Taille:', arrayBuffer.byteLength, 'bytes');
        
        if (arrayBuffer.byteLength > 0) {
          audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          audioLoaded = true;
          console.log('[Audio] ✓ Audio chargé!');
        }
      } else {
        console.error('[Audio] ✗ Fichier non trouvé:', response.status);
      }
    }
  } catch (err) {
    console.error('[Audio] Erreur initialisation:', err);
  }
};

let currentAudioSource = null;

const playMatchFoundSound = () => {
  console.log('[Audio] Tentative de lecture...', { hasContext: !!audioContext, hasBuffer: !!audioBuffer, loaded: audioLoaded });
  
  if (!audioContext || !audioBuffer) {
    console.warn('[Audio] Audio non prêt, tentative de lecture avec fallback...');
    playFallbackBeep();
    return;
  }
  
  // Reprendre le contexte si suspendu
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  
  try {
    // Arrêter le son précédent si en cours (arrêt immédiat pour le nouveau son)
    if (currentAudioSource) {
      try { currentAudioSource.stop(); } catch (e) {}
      currentAudioSource = null;
      currentGainNode = null;
    }
    
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    
    source.buffer = audioBuffer;
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    gainNode.gain.value = 0.5;
    
    currentAudioSource = source;
    currentGainNode = gainNode;
    source.start(0);
    console.log('[Audio] Lecture en cours!');
    
    // Nettoyer la référence quand le son est terminé
    source.onended = () => {
      currentAudioSource = null;
      currentGainNode = null;
    };
  } catch (err) {
    console.warn('[Audio] Erreur lecture:', err);
    playFallbackBeep();
  }
};

let currentGainNode = null;

const stopMatchFoundSound = (fadeOutDuration = 1.5) => {
  if (currentAudioSource && currentGainNode && audioContext) {
    try {
      // Fade out progressif
      const currentTime = audioContext.currentTime;
      currentGainNode.gain.setValueAtTime(currentGainNode.gain.value, currentTime);
      currentGainNode.gain.linearRampToValueAtTime(0, currentTime + fadeOutDuration);
      
      // Arrêter complètement après le fade out
      setTimeout(() => {
        if (currentAudioSource) {
          try {
            currentAudioSource.stop();
          } catch (err) {
            // Ignorer si déjà arrêté
          }
          currentAudioSource = null;
          currentGainNode = null;
        }
      }, fadeOutDuration * 1000);
      
      console.log('[Audio] Fade out en cours...');
    } catch (err) {
      // Fallback: arrêt direct
      try {
        currentAudioSource.stop();
      } catch (e) {}
      currentAudioSource = null;
      currentGainNode = null;
    }
  }
};

const playFallbackBeep = () => {
  if (!audioContext) return;
  try {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 880;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
    console.log('[Audio] Fallback beep joué');
  } catch (err) {
    console.warn('[Audio] Fallback échoué:', err);
  }
};

const unlockMatchFoundAudio = async () => {
  console.log('[Audio] Déblocage et chargement...');
  
  await initAudioContext();
  
  if (audioContext && audioContext.state === 'suspended') {
    await audioContext.resume();
    console.log('[Audio] AudioContext repris');
  }
};

// Default rank data avec couleurs et icônes (sera mis à jour avec les seuils de config)
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

// Rank styling data (constante - ne change pas)
const RANK_STYLES = {
  bronze: { name: 'Bronze', color: '#CD7F32', gradient: 'from-amber-700 to-amber-900', icon: Shield, tier: 'IV-I' },
  silver: { name: 'Silver', color: '#C0C0C0', gradient: 'from-slate-400 to-slate-600', icon: Shield, tier: 'IV-I' },
  gold: { name: 'Gold', color: '#FFD700', gradient: 'from-yellow-500 to-amber-600', icon: Medal, tier: 'IV-I' },
  platinum: { name: 'Platinum', color: '#00CED1', gradient: 'from-teal-400 to-cyan-600', icon: Medal, tier: 'IV-I' },
  diamond: { name: 'Diamond', color: '#B9F2FF', gradient: 'from-cyan-300 to-blue-500', icon: Star, tier: 'IV-I' },
  master: { name: 'Master', color: '#9B59B6', gradient: 'from-purple-500 to-pink-600', icon: Crown, tier: 'III-I' },
  grandmaster: { name: 'Grandmaster', color: '#E74C3C', gradient: 'from-red-500 to-orange-600', icon: Flame, tier: 'II-I' },
  champion: { name: 'Champion', color: '#F1C40F', gradient: 'from-yellow-400 via-orange-500 to-red-600', icon: Zap, tier: 'Top 100' }
};

// Helper to build RANKS array from thresholds
const buildRanksFromThresholds = (thresholds) => {
  const rankOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'champion'];
  return rankOrder.map(key => {
    const threshold = thresholds[key] || DEFAULT_RANK_THRESHOLDS[key];
    const style = RANK_STYLES[key];
    return {
      key,
      name: style.name,
      min: threshold.min ?? 0,
      max: threshold.max ?? 99999,
      color: style.color,
      gradient: style.gradient,
      icon: style.icon,
      tier: style.tier
    };
  });
};

const RankedMode = () => {
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const { user, isAuthenticated } = useAuth();
  const { on, isConnected, joinPage, leavePage, emit, modeOnlineUsers, joinMode, leaveMode } = useSocket();
  const navigate = useNavigate();
  
  // Player stats
  const [myRanking, setMyRanking] = useState(null);
  const [loadingRanking, setLoadingRanking] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [leaderboardTotalPages, setLeaderboardTotalPages] = useState(1);
  const LEADERBOARD_PER_PAGE = 20;
  const LEADERBOARD_TOTAL = 100;
  
  // Game mode & Matchmaking
  const [selectedGameMode, setSelectedGameMode] = useState('Search & Destroy');
  const [inQueue, setInQueue] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [queuePosition, setQueuePosition] = useState(null);
  const [timerActive, setTimerActive] = useState(false);
  const [timerEndTime, setTimerEndTime] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [currentFormat, setCurrentFormat] = useState(null); // Format déterminé dynamiquement par le serveur
  const [joiningQueue, setJoiningQueue] = useState(false);
  const [leavingQueue, setLeavingQueue] = useState(false);
  const [matchmakingError, setMatchmakingError] = useState(null);
  const [ggsecureConnected, setGgsecureConnected] = useState(null);
  const [activeMatch, setActiveMatch] = useState(null);
  
  // Note: Using totalOnlineUsers from SocketContext for global online count
  
  // Active matches stats
  const [activeMatchesStats, setActiveMatchesStats] = useState({ totalMatches: 0, stats: [] });
  
  // Search animation state
  const [searchingDots, setSearchingDots] = useState('');
  const [pulseAnimation, setPulseAnimation] = useState(0);
  
  // Adding fake players (staff/admin)
  const [addingFakePlayers, setAddingFakePlayers] = useState(false);
  
  // Staff test match
  const [startingTestMatch, setStartingTestMatch] = useState(false);
  const [testMatchTeamSize, setTestMatchTeamSize] = useState(4);
  
  // Rules modal
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [rules, setRules] = useState(null);
  const [loadingRules, setLoadingRules] = useState(false);
  
  
  // Shuffle animation state
  const [showShuffleAnimation, setShowShuffleAnimation] = useState(false);
  const [shuffleMatchData, setShuffleMatchData] = useState(null);
  const [shufflePhase, setShufflePhase] = useState(0); // 0: mixing, 1: distributing, 2: complete, 3: countdown
  const [shuffledPlayers, setShuffledPlayers] = useState([]);
  const [shuffleCountdown, setShuffleCountdown] = useState(10);
  
  // Rewards from config
  
  // Dynamic ranks from config
  const [ranks, setRanks] = useState(() => buildRanksFromThresholds(DEFAULT_RANK_THRESHOLDS));
  
  // Matchmaking enabled/disabled
  const [matchmakingEnabled, setMatchmakingEnabled] = useState(true);
  
  // Rank animation state
  const [rankAnimationPhase, setRankAnimationPhase] = useState(0);
  
  // Ref for matchmaking section scroll
  const matchmakingRef = useRef(null);

  const isHardcore = selectedMode === 'hardcore';
  const accent = isHardcore ? 'red' : 'cyan';
  
  // Update default game mode when switching between hardcore/cdl
  useEffect(() => {
    if (isHardcore) {
      setSelectedGameMode('Search & Destroy');
    } else {
      // CDL defaults to Hardpoint
      setSelectedGameMode('Hardpoint');
    }
  }, [selectedMode, isHardcore]);
  
  // Rank animation effect
  useEffect(() => {
    const interval = setInterval(() => {
      setRankAnimationPhase(prev => (prev + 1) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);
  
  // Fetch rules for the selected game mode
  const fetchRules = async () => {
    setLoadingRules(true);
    try {
      // Map game mode to rules slug
      const gameModeSlug = selectedGameMode === 'Search & Destroy' ? 'snd' 
        : selectedGameMode === 'Hardpoint' ? 'hardpoint'
        : selectedGameMode === 'Team Deathmatch' ? 'tdm' 
        : selectedGameMode === 'Duel' ? 'duel' 
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

  // Fetch active matches stats
  const fetchActiveMatchesStats = async () => {
    try {
      const response = await fetch(`${API_URL}/ranked-matches/active-matches/stats?mode=${selectedMode}`);
      const data = await response.json();
      if (data.success) {
        setActiveMatchesStats({
          totalMatches: data.totalMatches,
          stats: data.stats
        });
      }
    } catch (err) {
      console.error('Error fetching active matches stats:', err);
    }
  };

  // Fetch matchmaking status (enabled/disabled)
  const fetchMatchmakingStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/config/ranked/matchmaking-status`);
      const data = await response.json();
      if (data.success) {
        setMatchmakingEnabled(data.enabled);
      }
    } catch (err) {
      console.error('Error fetching matchmaking status:', err);
    }
  };

  // Fetch rank thresholds from config
  const fetchRankThresholds = async () => {
    try {
      const response = await fetch(`${API_URL}/app-settings/public`);
      const data = await response.json();
      if (data.success && data.rankedSettings?.rankPointsThresholds) {
        const thresholds = data.rankedSettings.rankPointsThresholds;
        setRanks(buildRanksFromThresholds(thresholds));
      }
    } catch (err) {
      console.error('Error fetching rank thresholds:', err);
    }
  };

  // Get rank from points (using dynamic ranks)
  const getRankFromPoints = (points) => {
    return ranks.find(r => points >= r.min && points <= r.max) || ranks[0];
  };

  // Fetch player ranking
  const fetchMyRanking = async () => {
    if (!isAuthenticated) {
      setLoadingRanking(false);
      return;
    }
    setLoadingRanking(true);
    try {
      const response = await fetch(`${API_URL}/rankings/me/${selectedMode}`, { credentials: 'include' });
      const data = await response.json();
      if (data.success) setMyRanking(data.ranking);
    } catch (err) {
      console.error('Error fetching ranking:', err);
    } finally {
      setLoadingRanking(false);
    }
  };

  // Fetch leaderboard with pagination
  const fetchLeaderboard = async (page = 1) => {
    setLoadingLeaderboard(true);
    try {
      const response = await fetch(
        `${API_URL}/rankings/leaderboard/${selectedMode}?limit=${LEADERBOARD_PER_PAGE}&page=${page}`, 
        { credentials: 'include' }
      );
      const data = await response.json();
      if (data.success) {
        setLeaderboard(data.rankings);
        // Calculate total pages based on total players (max 100)
        const totalPlayers = Math.min(data.pagination?.total || 0, LEADERBOARD_TOTAL);
        setLeaderboardTotalPages(Math.ceil(totalPlayers / LEADERBOARD_PER_PAGE));
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  // Check active match and redirect if found
  const checkActiveMatch = async () => {
    if (!isAuthenticated) return;
    try {
      const response = await fetch(`${API_URL}/ranked-matches/active/me`, { credentials: 'include' });
      const data = await response.json();
      if (data.success && data.match) {
        setActiveMatch(data.match);
        // Redirection automatique vers le match en cours
        navigate(`/ranked/match/${data.match._id}`);
      } else {
        setActiveMatch(null);
      }
    } catch (err) {
      console.error('Error checking active match:', err);
    }
  };

  // Check GGSecure
  const checkGGSecure = async () => {
    if (!user || user.platform !== 'PC') {
      setGgsecureConnected(true);
      return true;
    }
    try {
      const response = await fetch(`${API_URL}/users/anticheat-status/${user._id || user.id}`, { credentials: 'include' });
      const data = await response.json();
      const connected = data.isOnline || data.reason === 'not_pc' || data.reason === 'api_key_missing';
      setGgsecureConnected(connected);
      return connected;
    } catch {
      setGgsecureConnected(true);
      return true;
    }
  };

  // Fetch queue status
  const fetchQueueStatus = async (autoRedirect = false) => {
    if (!isAuthenticated) return;
    try {
      const response = await fetch(
        `${API_URL}/ranked-matches/matchmaking/status?gameMode=${encodeURIComponent(selectedGameMode)}&mode=${selectedMode}`,
        { credentials: 'include' }
      );
      const data = await response.json();
      if (data.success) {
        setInQueue(data.inQueue);
        setQueueSize(data.queueSize);
        setQueuePosition(data.position);
        setTimerActive(data.timerActive);
        setTimerEndTime(data.timerEndTime);
        setCurrentFormat(data.currentFormat || null);
        
        // Si le joueur a un match en cours
        if (data.inMatch && data.match) {
          setActiveMatch(data.match);
          // Redirection automatique vers le match au chargement initial
          if (autoRedirect) {
            navigate(`/ranked/match/${data.match._id}`);
          }
        } else {
          setActiveMatch(null);
        }
      }
    } catch (err) {
      console.error('Error fetching queue status:', err);
    }
  };

  // Unlock audio (call on user interaction to enable audio playback)
  const unlockAudio = async () => {
    await unlockMatchFoundAudio();
  };

  // Join queue
  const joinQueue = async () => {
    unlockAudio(); // Unlock audio on user interaction
    setMatchmakingError(null);
    if (user?.platform === 'PC') {
      const connected = await checkGGSecure();
      if (!connected) {
        setMatchmakingError(language === 'fr' ? 'Connectez-vous à GGSecure pour jouer.' : 'Connect to GGSecure to play.');
        return;
      }
    }
    setJoiningQueue(true);
    try {
      const response = await fetch(`${API_URL}/ranked-matches/matchmaking/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ gameMode: selectedGameMode, mode: selectedMode })
      });
      const data = await response.json();
      if (data.success) {
        setInQueue(true);
        setQueueSize(data.queueSize);
        setQueuePosition(data.position);
        // Scroll to matchmaking section
        setTimeout(() => {
          matchmakingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      } else {
        setMatchmakingError(data.message);
        if (data.activeMatchId) setActiveMatch({ _id: data.activeMatchId });
      }
    } catch (err) {
      setMatchmakingError(language === 'fr' ? 'Erreur de connexion' : 'Connection error');
    } finally {
      setJoiningQueue(false);
    }
  };

  // Leave queue
  const leaveQueue = async () => {
    setLeavingQueue(true);
    try {
      const response = await fetch(`${API_URL}/ranked-matches/matchmaking/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ gameMode: selectedGameMode, mode: selectedMode })
      });
      const data = await response.json();
      if (data.success) {
        setInQueue(false);
        setQueueSize(0);
        setQueuePosition(null);
        setTimerActive(false);
        setTimerEndTime(null);
        setCurrentFormat(null);
      }
    } catch (err) {
      console.error('Error leaving queue:', err);
    } finally {
      setLeavingQueue(false);
    }
  };
  
  // Add fake players (staff/admin only)
  const addFakePlayers = async (count = 5) => {
    setAddingFakePlayers(true);
    try {
      const response = await fetch(`${API_URL}/ranked-matches/matchmaking/add-fake-players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ gameMode: selectedGameMode, mode: selectedMode, count })
      });
      const data = await response.json();
      if (data.success) {
        setQueueSize(data.queueSize);
      } else {
        setMatchmakingError(data.message);
      }
    } catch (err) {
      console.error('Error adding fake players:', err);
      setMatchmakingError(language === 'fr' ? 'Erreur lors de l\'ajout' : 'Error adding fake players');
    } finally {
      setAddingFakePlayers(false);
    }
  };
  
  // Start test match (staff only - separate matchmaking with bots)
  const startTestMatch = async () => {
    unlockAudio(); // Unlock audio on user interaction
    setMatchmakingError(null);
    setStartingTestMatch(true);
    try {
      const response = await fetch(`${API_URL}/ranked-matches/matchmaking/start-test-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          gameMode: selectedGameMode, 
          mode: selectedMode, 
          teamSize: testMatchTeamSize 
        })
      });
      const data = await response.json();
      if (data.success) {
        // Le socket 'rankedMatchFound' va gérer l'animation puis la redirection
        // Ne pas naviguer directement ici pour permettre l'animation de s'afficher
        console.log('[Test Match] Match créé, en attente de l\'événement socket pour l\'animation...');
      } else {
        setMatchmakingError(data.message);
        if (data.activeMatchId) {
          setActiveMatch({ _id: data.activeMatchId });
        }
      }
    } catch (err) {
      console.error('Error starting test match:', err);
      setMatchmakingError(language === 'fr' ? 'Erreur lors du lancement du test' : 'Error starting test match');
    } finally {
      setStartingTestMatch(false);
    }
  };
  
  // Check if user is staff or admin
  const isStaffOrAdmin = user?.roles?.includes('staff') || user?.roles?.includes('admin');

  // Page tracking for socket (optional, for analytics)
  useEffect(() => {
    if (!isConnected) return;
    
    const pageName = `ranked-mode-${selectedMode}`;
    joinPage(pageName);
    
    return () => {
      leavePage(pageName);
    };
  }, [isConnected, selectedMode, joinPage, leavePage]);
  
  // Search animation effects
  useEffect(() => {
    if (!inQueue) {
      setSearchingDots('');
      setPulseAnimation(0);
      return;
    }
    
    // Dots animation
    const dotsInterval = setInterval(() => {
      setSearchingDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    
    // Pulse animation for the radar effect
    const pulseInterval = setInterval(() => {
      setPulseAnimation(prev => (prev + 1) % 4);
    }, 800);
    
    return () => {
      clearInterval(dotsInterval);
      clearInterval(pulseInterval);
    };
  }, [inQueue]);

  // Socket events
  useEffect(() => {
    if (!isAuthenticated || !isConnected) return;
    const unsubQueue = on('rankedQueueUpdate', (data) => {
      if (data.type === 'queue_status' || data.type === 'stayed_in_queue') {
        setQueueSize(data.queueSize);
        setQueuePosition(data.position);
        setTimerActive(data.timerActive);
        setTimerEndTime(data.timerEndTime);
        setCurrentFormat(data.currentFormat || null);
      }
      if (data.type === 'ejected') {
        // Le joueur a été éjecté de la file pour équilibrer le match
        setInQueue(false);
        setQueueSize(0);
        setQueuePosition(null);
        setTimerActive(false);
        setTimerEndTime(null);
        setCurrentFormat(null);
        setMatchmakingError(language === 'fr' 
          ? 'Match lancé sans vous (nombre impair). Veuillez relancer une recherche.'
          : 'Match started without you (odd number). Please search again.');
        setTimeout(() => setMatchmakingError(null), 5000);
      }
      if (data.type === 'timeout') {
        // Le joueur a été retiré de la file après 5 minutes sans match
        setInQueue(false);
        setQueueSize(0);
        setQueuePosition(null);
        setTimerActive(false);
        setTimerEndTime(null);
        setCurrentFormat(null);
        setMatchmakingError(language === 'fr'
          ? 'Vous avez été retiré de la file d\'attente après 5 minutes sans match trouvé.'
          : 'You have been removed from the queue after 5 minutes without finding a match.');
        setTimeout(() => setMatchmakingError(null), 5000);
      }
    });
    const unsubMatch = on('rankedMatchFound', (data) => {
      console.log('[RankedMode] Match trouvé!', data);
      setInQueue(false);
      
      // Jouer le son quand le match est trouvé
      playMatchFoundSound();
      
      // Show shuffle animation before navigating
      if (data.players && data.players.length > 0) {
        setShuffleMatchData(data);
        setShuffledPlayers(data.players.map((p, i) => ({ ...p, shuffleIndex: i })));
        setShufflePhase(0);
        setShowShuffleAnimation(true);
      } else {
        // No player data, navigate directly
        stopMatchFoundSound();
        navigate(`/ranked/match/${data.matchId}`);
      }
    });
    return () => { unsubQueue(); unsubMatch(); };
  }, [isAuthenticated, isConnected, on, navigate]);

  // Timer countdown
  useEffect(() => {
    if (!timerActive || !timerEndTime) { setTimeRemaining(null); return; }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((timerEndTime - Date.now()) / 1000));
      setTimeRemaining(remaining);
      if (remaining <= 0) setTimerActive(false);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [timerActive, timerEndTime]);

  // Init audio context on mount
  useEffect(() => {
    initAudioContext();
  }, []);

  // Shuffle animation effect
  useEffect(() => {
    if (!showShuffleAnimation || !shuffleMatchData) return;

    // Phase 0: Mixing animation (shuffle the players visually for 2 seconds)
    if (shufflePhase === 0) {
      let shuffleCount = 0;
      const shuffleInterval = setInterval(() => {
        setShuffledPlayers(prev => {
          const shuffled = [...prev];
          // Fisher-Yates shuffle for visual effect
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          return shuffled.map((p, i) => ({ ...p, shuffleIndex: i }));
        });
        shuffleCount++;
        if (shuffleCount >= 10) {
          clearInterval(shuffleInterval);
          setShufflePhase(1);
        }
      }, 200);

      return () => clearInterval(shuffleInterval);
    }

    // Phase 1: Distributing to teams (1.5 seconds)
    if (shufflePhase === 1) {
      const timer = setTimeout(() => {
        setShufflePhase(2);
      }, 1500);
      return () => clearTimeout(timer);
    }

    // Phase 2: Show final teams, then start countdown
    if (shufflePhase === 2) {
      const timer = setTimeout(() => {
        setShuffleCountdown(10);
        setShufflePhase(3);
      }, 1500);
      return () => clearTimeout(timer);
    }

    // Phase 3: Countdown 10 seconds then navigate
    if (shufflePhase === 3) {
      if (shuffleCountdown <= 0) {
        stopMatchFoundSound(); // Arrêter le son avant la navigation
        setShowShuffleAnimation(false);
        navigate(`/ranked/match/${shuffleMatchData.matchId}`);
        return;
      }
      const timer = setTimeout(() => {
        setShuffleCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [showShuffleAnimation, shuffleMatchData, shufflePhase, shuffleCountdown, navigate]);

  // Fetch leaderboard when page changes
  useEffect(() => {
    fetchLeaderboard(leaderboardPage);
  }, [leaderboardPage, selectedMode]);

  // Handle leaderboard page change
  const handleLeaderboardPageChange = (newPage) => {
    if (newPage >= 1 && newPage <= leaderboardTotalPages) {
      setLeaderboardPage(newPage);
    }
  };

  // Initial load
  useEffect(() => {
    fetchMyRanking();
    fetchActiveMatchesStats();
    fetchMatchmakingStatus();
    fetchRankThresholds(); // Fetch dynamic rank thresholds from config
    if (isAuthenticated) {
      checkActiveMatch();
      fetchQueueStatus();
      if (user?.platform === 'PC') checkGGSecure();
    }
    
    // Refresh active matches stats every 30 seconds
    const statsInterval = setInterval(fetchActiveMatchesStats, 30000);
    return () => clearInterval(statsInterval);
  }, [isAuthenticated, selectedMode, selectedGameMode]);

  // Join mode room for mode-specific online users tracking
  useEffect(() => {
    if (selectedMode) {
      joinMode(selectedMode);
    }
    return () => {
      if (selectedMode) {
        leaveMode(selectedMode);
      }
    };
  }, [selectedMode, joinMode, leaveMode]);

  const playerRank = myRanking ? getRankFromPoints(myRanking.points) : ranks[0];
  const PlayerRankIcon = playerRank.icon;

  // Translations - 4 languages
  const translations = {
    fr: {
      title: 'Mode Classé',
      subtitle: 'Affronte les meilleurs joueurs et grimpe les échelons',
      yourRank: 'Ton rang',
      points: 'Points',
      wins: 'Victoires',
      losses: 'Défaites',
      winRate: 'Ratio',
      noRank: 'Pas encore classé',
      playFirst: 'Joue ta première partie !',
      gameMode: 'Mode de jeu',
      searchDestroy: 'Recherche & Destruction',
      hardpoint: 'Points Stratégiques',
      teamDeathmatch: 'Mêlée générale',
      duel: 'Duel',
      available: 'Disponible',
      comingSoon: 'À venir',
      findMatch: 'Rechercher un match',
      searching: 'Recherche...',
      cancel: 'Annuler',
      playersInQueue: 'joueurs en file',
      matchIn: 'Match dans',
      waitingMore: 'En attente de joueurs...',
      minPlayers: 'Minimum 8 joueurs (4v4)',
      activeMatch: 'Match en cours',
      rejoin: 'Rejoindre',
      ggsecureRequired: 'GGSecure requis pour les joueurs PC',
      leaderboard: 'Classement',
      ranks: 'Les rangs',
      soloMode: 'Mode solo uniquement',
      dynamicFormat: 'Format automatique (4v4 → 5v5)',
      playersOnline: 'joueurs en ligne',
      activeMatches: 'match(s) en cours',
      addFakePlayers: 'Ajouter des joueurs test',
      startTestMatch: 'Lancer un match de test',
      testMatchInfo: 'Match solo avec bots (file séparée)',
      searchingPlayers: 'Recherche de joueurs',
      loginToPlay: 'Connecte-toi pour jouer',
      loginRequired: 'Tu dois être connecté pour accéder au mode classé.',
      viewAll: 'Voir tout',
      noRankedPlayers: 'Aucun joueur classé',
      you: 'Toi',
      position: 'Position',
      ready4v4: '4v4 prêt, en attente du 5v5...',
      creatingMatch: 'Création du match...',
      topPlayers: 'Meilleurs joueurs',
      mandatoryMatchWarning: '⚠️ En lançant un match classé, vous vous engagez à le jouer. Ne pas jouer un match après l\'avoir lancé peut entraîner des sanctions si cela se reproduit plusieurs fois.',
      recentMatches: 'Derniers matchs',
      viewRecentMatches: 'Voir les 30 derniers matchs',
      noRecentMatches: 'Aucun match récent',
      matchDuration: 'Durée',
      winner: 'Gagnant',
      host: 'Hôte',
      referent: 'Référent',
      matchFound: 'Match trouvé !',
      shufflingPlayers: 'Mélange des joueurs...',
      distributingTeams: 'Répartition dans les équipes...',
      teamsReady: 'Équipes prêtes !',
      redirecting: 'Redirection vers le match...',
    },
    en: {
      title: 'Ranked Mode',
      subtitle: 'Face the best players and climb the ranks',
      yourRank: 'Your Rank',
      points: 'Points',
      wins: 'Wins',
      losses: 'Losses',
      winRate: 'Win Rate',
      noRank: 'Not ranked yet',
      playFirst: 'Play your first match!',
      gameMode: 'Game Mode',
      searchDestroy: 'Search & Destroy',
      hardpoint: 'Hardpoint',
      teamDeathmatch: 'Team Deathmatch',
      duel: 'Duel',
      available: 'Available',
      comingSoon: 'Coming Soon',
      findMatch: 'Find Match',
      searching: 'Searching...',
      cancel: 'Cancel',
      playersInQueue: 'players in queue',
      matchIn: 'Match in',
      waitingMore: 'Waiting for players...',
      minPlayers: 'Minimum 8 players (4v4)',
      activeMatch: 'Active Match',
      rejoin: 'Rejoin',
      ggsecureRequired: 'GGSecure required for PC players',
      leaderboard: 'Leaderboard',
      ranks: 'Ranks',
      soloMode: 'Solo mode only',
      dynamicFormat: 'Automatic format (4v4 → 5v5)',
      playersOnline: 'players online',
      activeMatches: 'active match(es)',
      addFakePlayers: 'Add test players',
      startTestMatch: 'Start test match',
      testMatchInfo: 'Solo match with bots (separate queue)',
      searchingPlayers: 'Searching for players',
      loginToPlay: 'Login to Play',
      loginRequired: 'You must be logged in to access ranked mode.',
      viewAll: 'View All',
      noRankedPlayers: 'No ranked players',
      you: 'You',
      position: 'Position',
      ready4v4: '4v4 ready, waiting for 5v5...',
      creatingMatch: 'Creating match...',
      topPlayers: 'Top Players',
      mandatoryMatchWarning: '⚠️ By starting a ranked match, you commit to playing it. Not playing a match after starting it may result in sanctions if repeated multiple times.',
      recentMatches: 'Recent Matches',
      viewRecentMatches: 'View last 30 matches',
      noRecentMatches: 'No recent matches',
      matchDuration: 'Duration',
      winner: 'Winner',
      host: 'Host',
      referent: 'Referent',
      matchFound: 'Match found!',
      shufflingPlayers: 'Shuffling players...',
      distributingTeams: 'Distributing to teams...',
      teamsReady: 'Teams ready!',
      redirecting: 'Redirecting to match...',
    },
    de: {
      title: 'Ranglisten-Modus',
      subtitle: 'Tritt gegen die besten Spieler an und steige auf',
      yourRank: 'Dein Rang',
      points: 'Punkte',
      wins: 'Siege',
      losses: 'Niederlagen',
      winRate: 'Siegquote',
      noRank: 'Noch nicht platziert',
      playFirst: 'Spiele dein erstes Match!',
      gameMode: 'Spielmodus',
      searchDestroy: 'Suchen & Zerstören',
      hardpoint: 'Hardpoint',
      teamDeathmatch: 'Team-Deathmatch',
      duel: 'Duell',
      available: 'Verfügbar',
      comingSoon: 'Demnächst',
      findMatch: 'Match finden',
      searching: 'Suche...',
      cancel: 'Abbrechen',
      playersInQueue: 'Spieler in Warteschlange',
      matchIn: 'Match in',
      waitingMore: 'Warte auf Spieler...',
      minPlayers: 'Minimum 8 Spieler (4v4)',
      activeMatch: 'Aktives Match',
      rejoin: 'Beitreten',
      ggsecureRequired: 'GGSecure erforderlich für PC-Spieler',
      leaderboard: 'Bestenliste',
      ranks: 'Ränge',
      soloMode: 'Nur Solomodus',
      dynamicFormat: 'Automatisches Format (4v4 → 5v5)',
      playersOnline: 'Spieler online',
      activeMatches: 'aktive(s) Match(es)',
      addFakePlayers: 'Testspieler hinzufügen',
      startTestMatch: 'Testmatch starten',
      testMatchInfo: 'Solo-Match mit Bots (separate Warteschlange)',
      searchingPlayers: 'Suche nach Spielern',
      loginToPlay: 'Zum Spielen einloggen',
      loginRequired: 'Du musst eingeloggt sein, um den Ranglisten-Modus zu nutzen.',
      viewAll: 'Alle anzeigen',
      noRankedPlayers: 'Keine platzierten Spieler',
      you: 'Du',
      position: 'Position',
      ready4v4: '4v4 bereit, warte auf 5v5...',
      creatingMatch: 'Match wird erstellt...',
      topPlayers: 'Top-Spieler',
      mandatoryMatchWarning: '⚠️ Mit dem Starten eines Ranglistenspiels verpflichten Sie sich, es zu spielen. Wenn Sie ein Spiel nach dem Starten nicht spielen, kann dies bei mehrfacher Wiederholung zu Sanktionen führen.',
      recentMatches: 'Letzte Spiele',
      viewRecentMatches: 'Letzte 30 Spiele anzeigen',
      noRecentMatches: 'Keine kürzlichen Spiele',
      matchDuration: 'Dauer',
      winner: 'Gewinner',
      host: 'Host',
      referent: 'Referent',
      matchFound: 'Spiel gefunden!',
      shufflingPlayers: 'Spieler werden gemischt...',
      distributingTeams: 'Aufteilung in Teams...',
      teamsReady: 'Teams bereit!',
      redirecting: 'Weiterleitung zum Spiel...',
    },
    it: {
      title: 'Modalità Classificata',
      subtitle: 'Affronta i migliori giocatori e scala le classifiche',
      yourRank: 'Il tuo grado',
      points: 'Punti',
      wins: 'Vittorie',
      losses: 'Sconfitte',
      winRate: 'Percentuale',
      noRank: 'Non ancora classificato',
      playFirst: 'Gioca la tua prima partita!',
      gameMode: 'Modalità di gioco',
      searchDestroy: 'Cerca e Distruggi',
      hardpoint: 'Hardpoint',
      teamDeathmatch: 'Deathmatch a squadre',
      duel: 'Duello',
      available: 'Disponibile',
      comingSoon: 'In arrivo',
      findMatch: 'Trova partita',
      searching: 'Ricerca...',
      cancel: 'Annulla',
      playersInQueue: 'giocatori in coda',
      matchIn: 'Partita tra',
      waitingMore: 'In attesa di giocatori...',
      minPlayers: 'Minimo 8 giocatori (4v4)',
      activeMatch: 'Partita in corso',
      rejoin: 'Rientra',
      ggsecureRequired: 'GGSecure richiesto per giocatori PC',
      leaderboard: 'Classifica',
      ranks: 'Gradi',
      soloMode: 'Solo modalità singola',
      dynamicFormat: 'Formato automatico (4v4 → 5v5)',
      playersOnline: 'giocatori online',
      activeMatches: 'partita/e in corso',
      addFakePlayers: 'Aggiungi giocatori test',
      startTestMatch: 'Avvia partita di test',
      testMatchInfo: 'Partita singola con bot (coda separata)',
      searchingPlayers: 'Ricerca giocatori',
      loginToPlay: 'Accedi per giocare',
      loginRequired: 'Devi effettuare l\'accesso per la modalità classificata.',
      viewAll: 'Vedi tutto',
      noRankedPlayers: 'Nessun giocatore classificato',
      you: 'Tu',
      position: 'Posizione',
      ready4v4: '4v4 pronto, in attesa del 5v5...',
      creatingMatch: 'Creazione partita...',
      topPlayers: 'Migliori giocatori',
      mandatoryMatchWarning: '⚠️ Avviando una partita classificata, ti impegni a giocarla. Non giocare una partita dopo averla avviata può comportare sanzioni se ripetuto più volte.',
      recentMatches: 'Partite recenti',
      viewRecentMatches: 'Vedi ultime 30 partite',
      noRecentMatches: 'Nessuna partita recente',
      matchDuration: 'Durata',
      winner: 'Vincitore',
      host: 'Ospite',
      referent: 'Referente',
      matchFound: 'Partita trovata!',
      shufflingPlayers: 'Mescolando i giocatori...',
      distributingTeams: 'Distribuzione nelle squadre...',
      teamsReady: 'Squadre pronte!',
      redirecting: 'Reindirizzamento alla partita...',
    }
  };
  
  const t = translations[language] || translations.en;

  return (
    <div className={`min-h-screen bg-gradient-to-b from-dark-950 via-dark-900 to-dark-950`}>
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className={`absolute top-0 left-1/4 w-96 h-96 bg-${accent}-500/10 rounded-full blur-3xl`}></div>
          <div className={`absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl`}></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djJIMjR2LTJoMTJ6bTAtNHYySDI0di0yaDEyem0wLTR2Mkg0djJIMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ2MmgydjJoMnYtMmgydi0yaDJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-12">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-12">
            <div className="inline-flex items-center justify-center mb-2 sm:mb-4">
              <img 
                src={isHardcore ? '/logo_hc.png' : '/logo_cdl.png'} 
                alt={isHardcore ? 'Hardcore' : 'CDL'} 
                className="h-14 sm:h-20 md:h-28 object-contain drop-shadow-2xl"
              />
            </div>
            
            {/* Season Badge */}
            <div className="mb-4 sm:mb-6">
              <div className={`inline-flex items-center gap-3 px-6 sm:px-8 py-3 sm:py-4 rounded-2xl bg-gradient-to-r ${isHardcore ? 'from-red-500/20 via-orange-500/10 to-red-500/20 border-red-500/30' : 'from-cyan-500/20 via-blue-500/10 to-cyan-500/20 border-cyan-500/30'} border backdrop-blur-xl shadow-2xl`}>
                <div className={`relative`}>
                  <Trophy className={`w-6 h-6 sm:w-8 sm:h-8 ${isHardcore ? 'text-orange-400' : 'text-cyan-400'}`} />
                  <Sparkles className={`absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 ${isHardcore ? 'text-yellow-400' : 'text-cyan-300'} animate-pulse`} />
                </div>
                <div className="flex flex-col items-start">
                  <span 
                    className={`text-2xl sm:text-4xl font-black tracking-tight bg-gradient-to-r ${isHardcore ? 'from-orange-400 via-yellow-200 via-white to-red-400' : 'from-cyan-400 via-white via-cyan-200 to-blue-400'} bg-clip-text text-transparent animate-text-shimmer`}
                  >
                    SAISON 1
                  </span>
                  <span className={`text-[10px] sm:text-xs uppercase tracking-widest ${isHardcore ? 'text-orange-400/70' : 'text-cyan-400/70'} font-semibold`}>
                    {language === 'fr' ? 'En cours' : language === 'en' ? 'In Progress' : language === 'it' ? 'In Corso' : 'Läuft'}
                  </span>
                </div>
              </div>
            </div>
            
            <p className="text-gray-400 text-sm sm:text-lg max-w-xl mx-auto px-4">{t.subtitle}</p>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-4 sm:mb-8">
            {/* Left Column - Player Card & Matchmaking */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-6">
              
              {/* Player Rank Card */}
              {isAuthenticated && (
                <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-dark-800/80 to-dark-900/80 backdrop-blur-xl border border-white/10 p-4 sm:p-6">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full"></div>
                  
                  {loadingRanking ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className={`w-8 h-8 text-${accent}-500 animate-spin`} />
                    </div>
                  ) : myRanking ? (
                    <>
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      {/* Rank Badge - Animated */}
                      <div className="relative group">
                        {/* Glow effect animé */}
                        <div 
                          className="absolute -inset-2 rounded-3xl opacity-60 blur-xl transition-all group-hover:opacity-80"
                          style={{
                            background: `conic-gradient(from ${rankAnimationPhase}deg, ${playerRank.color}40, transparent, ${playerRank.color}60, transparent, ${playerRank.color}40)`
                          }}
                        ></div>
                        {/* Outer ring animé */}
                        <div 
                          className="absolute -inset-1 rounded-2xl opacity-70"
                          style={{
                            background: `linear-gradient(${rankAnimationPhase}deg, ${playerRank.color}, transparent, ${playerRank.color})`,
                            animation: 'spin 4s linear infinite'
                          }}
                        ></div>
                        <div className={`relative w-20 h-20 sm:w-28 sm:h-28 rounded-xl sm:rounded-2xl bg-gradient-to-br ${playerRank.gradient} p-1 shadow-2xl transform transition-transform group-hover:scale-105`}>
                          <div className="w-full h-full rounded-lg sm:rounded-xl bg-dark-900/50 flex items-center justify-center backdrop-blur-sm">
                            <PlayerRankIcon 
                              className="w-8 h-8 sm:w-12 sm:h-12 text-white drop-shadow-lg" 
                              style={{ 
                                filter: `drop-shadow(0 0 8px ${playerRank.color}80)`,
                                animation: 'pulse 2s ease-in-out infinite'
                              }}
                            />
                          </div>
                        </div>
                        <div 
                          className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-dark-900 border-2 shadow-lg"
                          style={{ borderColor: `${playerRank.color}50` }}
                        >
                          <span className="text-xs font-bold" style={{ color: playerRank.color }}>{playerRank.tier}</span>
                        </div>
                        {/* Sparkles effect */}
                        <div className="absolute -top-1 -right-1 animate-ping">
                          <Sparkles className="w-4 h-4" style={{ color: playerRank.color }} />
                        </div>
                      </div>

                      {/* Rank Info */}
                      <div className="flex-1 text-center md:text-left">
                        <p className="text-gray-500 text-xs sm:text-sm uppercase tracking-wider">{t.yourRank}</p>
                        <h2 className="text-2xl sm:text-3xl font-black text-white mb-1" style={{ color: playerRank.color }}>{playerRank.name}</h2>
                        <p className="text-gray-400 text-sm sm:text-base">#{myRanking.rank} • <span className={`text-${accent}-400 font-semibold`}>{myRanking.points} pts</span></p>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full md:w-auto md:min-w-[240px]">
                        <div className="text-center p-2 sm:p-3 rounded-lg sm:rounded-xl bg-dark-800/50">
                          <p className="text-lg sm:text-2xl font-bold text-green-400">{myRanking.wins}</p>
                          <p className="text-[10px] sm:text-xs text-gray-500 uppercase">{t.wins}</p>
                        </div>
                        <div className="text-center p-2 sm:p-3 rounded-lg sm:rounded-xl bg-dark-800/50">
                          <p className="text-lg sm:text-2xl font-bold text-red-400">{myRanking.losses}</p>
                          <p className="text-[10px] sm:text-xs text-gray-500 uppercase">{t.losses}</p>
                        </div>
                        <div className="text-center p-2 sm:p-3 rounded-lg sm:rounded-xl bg-dark-800/50">
                          <p className="text-lg sm:text-2xl font-bold text-yellow-400">
                            {myRanking.wins + myRanking.losses > 0 
                              ? Math.round((myRanking.wins / (myRanking.wins + myRanking.losses)) * 100) 
                              : 0}%
                          </p>
                          <p className="text-[10px] sm:text-xs text-gray-500 uppercase">{t.winRate}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Progress Bar to Next Rank */}
                    {(() => {
                      const currentRankIndex = ranks.findIndex(r => myRanking.points >= r.min && myRanking.points <= r.max);
                      const currentRank = ranks[currentRankIndex] || ranks[0];
                      const nextRank = ranks[currentRankIndex + 1];
                      
                      if (!nextRank) {
                        // Already at max rank (Champion)
                        return (
                          <div className="w-full mt-4 pt-4 border-t border-white/10">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-400">{language === 'fr' ? 'Rang Maximum Atteint' : 'Maximum Rank Achieved'}</span>
                              <span className="text-sm font-bold" style={{ color: currentRank.color }}>🏆 Champion</span>
                            </div>
                            <div className="relative h-3 rounded-full overflow-hidden bg-dark-700">
                              <div 
                                className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600"
                                style={{ width: '100%' }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent animate-pulse" />
                            </div>
                          </div>
                        );
                      }
                      
                      const pointsInCurrentRank = myRanking.points - currentRank.min;
                      const pointsNeededForNextRank = nextRank.min - currentRank.min;
                      const progressPercent = Math.min(100, (pointsInCurrentRank / pointsNeededForNextRank) * 100);
                      const pointsToNextRank = nextRank.min - myRanking.points;
                      
                      return (
                        <div className="w-full mt-4 pt-4 border-t border-white/10">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-400">{language === 'fr' ? 'Prochain rang:' : 'Next rank:'}</span>
                              <span className="text-sm font-bold" style={{ color: nextRank.color }}>{nextRank.name}</span>
                            </div>
                            <span className="text-sm text-gray-400">
                              <span className="font-bold" style={{ color: nextRank.color }}>{pointsToNextRank}</span> pts restants
                            </span>
                          </div>
                          <div className="relative h-3 rounded-full overflow-hidden bg-dark-700">
                            {/* Progress fill */}
                            <div 
                              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                              style={{ 
                                width: `${progressPercent}%`,
                                background: `linear-gradient(90deg, ${currentRank.color}, ${nextRank.color})`
                              }}
                            />
                            {/* Glow effect on the edge */}
                            <div 
                              className="absolute inset-y-0 w-4 rounded-full blur-sm"
                              style={{ 
                                left: `calc(${progressPercent}% - 8px)`,
                                background: nextRank.color,
                                opacity: 0.6
                              }}
                            />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-xs text-gray-500">{currentRank.min} pts</span>
                            <span className="text-xs text-gray-500">{nextRank.min} pts</span>
                          </div>
                        </div>
                      );
                    })()}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${ranks[0].gradient} p-1`}>
                        <div className="w-full h-full rounded-xl bg-dark-900/50 flex items-center justify-center">
                          <Shield className="w-10 h-10 text-white/50" />
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">{t.noRank}</h3>
                      <p className="text-gray-500">{t.playFirst}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Game Mode Selection */}
              <div className="rounded-2xl sm:rounded-3xl bg-dark-800/50 backdrop-blur-xl border border-white/10 p-4 sm:p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Target className={`w-5 h-5 text-${accent}-500`} />
                  {t.gameMode}
                </h3>
                
                {/* Different game modes for Hardcore vs CDL */}
                {isHardcore ? (
                  // HARDCORE: S&D, TDM (soon), Duel (soon)
                  <div className="grid grid-cols-3 gap-3">
                    {/* Search & Destroy - Available */}
                    <button
                      onClick={() => setSelectedGameMode('Search & Destroy')}
                      className={`relative p-4 rounded-2xl border-2 transition-all ${
                        selectedGameMode === 'Search & Destroy'
                          ? `border-${accent}-500 bg-${accent}-500/10 shadow-lg shadow-${accent}-500/20`
                          : 'border-white/10 bg-dark-800/30 hover:border-white/20'
                      }`}
                    >
                      <div className={`w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center ${
                        selectedGameMode === 'Search & Destroy'
                          ? `bg-gradient-to-br from-red-500 to-orange-600`
                          : 'bg-dark-700'
                      }`}>
                        <Crosshair className="w-6 h-6 text-white" />
                      </div>
                      <p className="text-white font-semibold text-sm">{t.searchDestroy}</p>
                      <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        selectedGameMode === 'Search & Destroy'
                          ? `bg-green-500/20 text-green-400`
                          : 'bg-green-500/10 text-green-400/70'
                      }`}>
                        {t.available}
                      </span>
                    </button>

                    {/* Mêlée générale - Indisponible */}
                    <button
                      disabled
                      className="relative p-4 rounded-2xl border-2 transition-all border-white/5 bg-dark-800/20 cursor-not-allowed opacity-50"
                    >
                      <div className="absolute top-2 right-2">
                        <Lock className="w-4 h-4 text-gray-500" />
                      </div>
                      <div className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center bg-dark-700/50">
                        <Swords className="w-6 h-6 text-gray-500" />
                      </div>
                      <p className="text-gray-500 font-semibold text-sm">{t.teamDeathmatch}</p>
                      <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-500/10 text-gray-500">
                        {t.comingSoon}
                      </span>
                    </button>

                    {/* Duel - Indisponible */}
                    <button
                      disabled
                      className="relative p-4 rounded-2xl border-2 transition-all border-white/5 bg-dark-800/20 cursor-not-allowed opacity-50"
                    >
                      <div className="absolute top-2 right-2">
                        <Lock className="w-4 h-4 text-gray-500" />
                      </div>
                      <div className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center bg-dark-700/50">
                        <Target className="w-6 h-6 text-gray-500" />
                      </div>
                      <p className="text-gray-500 font-semibold text-sm">{t.duel}</p>
                      <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-500/10 text-gray-500">
                        {t.comingSoon}
                      </span>
                    </button>
                  </div>
                ) : (
                  // CDL: Hardpoint & S&D only (format 4v4)
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {/* Hardpoint - Available */}
                    <button
                      onClick={() => setSelectedGameMode('Hardpoint')}
                      className={`relative p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all ${
                        selectedGameMode === 'Hardpoint'
                          ? `border-${accent}-500 bg-${accent}-500/10 shadow-lg shadow-${accent}-500/20`
                          : 'border-white/10 bg-dark-800/30 hover:border-white/20'
                      }`}
                    >
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 rounded-lg sm:rounded-xl flex items-center justify-center ${
                        selectedGameMode === 'Hardpoint'
                          ? `bg-gradient-to-br from-cyan-400 to-blue-600`
                          : 'bg-dark-700'
                      }`}>
                        <Target className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <p className="text-white font-semibold text-xs sm:text-sm">{t.hardpoint}</p>
                      <span className={`inline-block mt-1 sm:mt-2 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase ${
                        selectedGameMode === 'Hardpoint'
                          ? `bg-green-500/20 text-green-400`
                          : 'bg-green-500/10 text-green-400/70'
                      }`}>
                        {t.available}
                      </span>
                    </button>

                    {/* Search & Destroy - Available */}
                    <button
                      onClick={() => setSelectedGameMode('Search & Destroy')}
                      className={`relative p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all ${
                        selectedGameMode === 'Search & Destroy'
                          ? `border-${accent}-500 bg-${accent}-500/10 shadow-lg shadow-${accent}-500/20`
                          : 'border-white/10 bg-dark-800/30 hover:border-white/20'
                      }`}
                    >
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 rounded-lg sm:rounded-xl flex items-center justify-center ${
                        selectedGameMode === 'Search & Destroy'
                          ? `bg-gradient-to-br from-cyan-400 to-blue-600`
                          : 'bg-dark-700'
                      }`}>
                        <Crosshair className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <p className="text-white font-semibold text-xs sm:text-sm">{t.searchDestroy}</p>
                      <span className={`inline-block mt-1 sm:mt-2 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase ${
                        selectedGameMode === 'Search & Destroy'
                          ? `bg-green-500/20 text-green-400`
                          : 'bg-green-500/10 text-green-400/70'
                      }`}>
                        {t.available}
                      </span>
                    </button>
                  </div>
                )}
                
                {/* Bouton Règles du mode */}
                <button
                  onClick={() => {
                    fetchRules();
                    setShowRulesModal(true);
                  }}
                  className={`mt-4 w-full py-3 rounded-xl border border-${accent}-500/30 bg-${accent}-500/10 hover:bg-${accent}-500/20 transition-all flex items-center justify-center gap-2`}
                >
                  <BookOpen className={`w-5 h-5 text-${accent}-400`} />
                  <span className={`text-${accent}-400 font-semibold`}>
                    {language === 'fr' ? 'Voir les règles du mode' : 'View game mode rules'}
                  </span>
                </button>
                
                {/* Bouton Historique des matchs récents */}
                <button
                  onClick={() => navigate(`/${selectedMode}/ranked/recent-matches`)}
                  className={`mt-2 w-full py-3 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 transition-all flex items-center justify-center gap-2`}
                >
                  <Clock className="w-5 h-5 text-purple-400" />
                  <span className="text-purple-400 font-semibold">
                    {t.viewRecentMatches || 'Voir les 30 derniers matchs'}
                  </span>
                </button>
              </div>

              {/* Matchmaking Section */}
              {isAuthenticated && (
                <div ref={matchmakingRef} className="rounded-2xl sm:rounded-3xl bg-dark-800/50 backdrop-blur-xl border border-white/10 p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Swords className={`w-5 h-5 text-${accent}-500`} />
                      {t.findMatch}
                    </h3>
                    {/* Online players counter (global) */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-dark-700/50 border border-white/10">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <Users className={`w-4 h-4 text-${accent}-400`} />
                      <span className="text-sm text-gray-400">
                        <span className={`font-semibold text-${accent}-400`}>{modeOnlineUsers[selectedMode] || 0}</span> {t.playersOnline}
                      </span>
                    </div>
                  </div>

                  {/* Active Matches Stats */}
                  {activeMatchesStats.totalMatches > 0 && (
                    <div className="mb-4 p-4 rounded-2xl bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Swords className="w-4 h-4 text-green-400" />
                        <span className="text-green-400 font-semibold">
                          {activeMatchesStats.totalMatches} {t.activeMatches}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {activeMatchesStats.stats.map((stat, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="px-2 py-1 rounded-lg bg-dark-800/50 text-xs text-gray-300">
                              {stat.gameMode}
                            </span>
                            {stat.formats.map((f, fIdx) => (
                              <span 
                                key={fIdx} 
                                className={`px-2 py-1 rounded-lg text-xs font-medium ${isHardcore ? 'bg-red-500/20 text-red-300' : 'bg-cyan-500/20 text-cyan-300'}`}
                              >
                                {f.count}× {f.format}
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active Match Alert */}
                  {activeMatch && (
                    <div className="mb-4 p-4 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-orange-400" />
                        <span className="text-orange-300 font-medium">{t.activeMatch}</span>
                      </div>
                      <button
                        onClick={() => navigate(`/ranked/match/${activeMatch._id}`)}
                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-xl text-white font-semibold transition-colors"
                      >
                        {t.rejoin}
                      </button>
                    </div>
                  )}

                  {/* GGSecure Warning */}
                  {user?.platform === 'PC' && ggsecureConnected === false && (
                    <div className="mb-4 p-4 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center gap-3">
                      <ShieldCheck className="w-5 h-5 text-red-400" />
                      <span className="text-red-300">{t.ggsecureRequired}</span>
                    </div>
                  )}

                  {/* Error */}
                  {matchmakingError && (
                    <div className="mb-4 p-4 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      <span className="text-red-300">{matchmakingError}</span>
                    </div>
                  )}

                  {/* Queue Status or Find Button */}
                  {inQueue ? (
                    <div className="space-y-4">
                      {/* Dynamic searching animation header */}
                      <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-dark-900 to-dark-800 border border-white/10 p-4 sm:p-6">
                        {/* Radar animation background */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className={`absolute w-32 h-32 rounded-full border-2 ${isHardcore ? 'border-red-500/20' : 'border-cyan-500/20'} animate-ping`} style={{ animationDuration: '2s' }} />
                          <div className={`absolute w-48 h-48 rounded-full border ${isHardcore ? 'border-red-500/10' : 'border-cyan-500/10'} animate-ping`} style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
                          <div className={`absolute w-64 h-64 rounded-full border ${isHardcore ? 'border-red-500/5' : 'border-cyan-500/5'} animate-ping`} style={{ animationDuration: '3s', animationDelay: '1s' }} />
                        </div>
                        
                        {/* Scanning line effect */}
                        <div className="absolute inset-0 overflow-hidden">
                          <div 
                            className={`absolute w-full h-1 ${isHardcore ? 'bg-gradient-to-r from-transparent via-red-500/50 to-transparent' : 'bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent'} animate-pulse`}
                            style={{ 
                              top: '50%', 
                              transform: 'translateY(-50%)',
                              animation: 'scanLine 2s ease-in-out infinite'
                            }}
                          />
                        </div>
                        
                        <div className="relative z-10 text-center">
                          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${isHardcore ? 'bg-red-500/20 border border-red-500/30' : 'bg-cyan-500/20 border border-cyan-500/30'} mb-4`}>
                            <Radio className={`w-4 h-4 ${isHardcore ? 'text-red-400' : 'text-cyan-400'} animate-pulse`} />
                            <span className={`text-sm font-medium ${isHardcore ? 'text-red-300' : 'text-cyan-300'}`}>
                              {t.searchingPlayers}{searchingDots}
                            </span>
                          </div>
                          
                          {/* Animated player icons */}
                          <div className="flex justify-center flex-wrap gap-1.5 sm:gap-2 mb-4">
                            {[...Array(isHardcore ? 10 : 8)].map((_, i) => (
                              <div 
                                key={i}
                                className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                                  i < queueSize 
                                    ? `${isHardcore ? 'bg-red-500' : 'bg-cyan-500'} scale-100 shadow-lg ${isHardcore ? 'shadow-red-500/30' : 'shadow-cyan-500/30'}` 
                                    : 'bg-dark-700 scale-90 opacity-50'
                                }`}
                                style={{ 
                                  animationDelay: `${i * 0.1}s`,
                                  animation: i < queueSize ? 'bounce 1s ease-in-out infinite' : 'none'
                                }}
                              >
                                <Users className={`w-3 h-3 sm:w-4 sm:h-4 ${i < queueSize ? 'text-white' : 'text-gray-600'}`} />
                              </div>
                            ))}
                          </div>
                          
                          <p className={`text-2xl sm:text-3xl font-black ${isHardcore ? 'text-red-400' : 'text-cyan-400'}`}>
                            {queueSize}<span className="text-gray-500 text-lg sm:text-xl">/{isHardcore ? 10 : 8}</span>
                          </p>
                          <p className="text-gray-500 text-xs sm:text-sm">{t.playersInQueue}</p>
                        </div>
                      </div>
                      
                      {/* Queue Stats - more compact */}
                      <div className="grid grid-cols-2 gap-2 sm:gap-4">
                        <div className={`text-center p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30`}>
                          <Target className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 mx-auto mb-1 sm:mb-2" />
                          <p className="text-lg sm:text-xl font-bold text-white">#{queuePosition || '?'}</p>
                          <p className="text-[10px] sm:text-xs text-gray-500">Position</p>
                        </div>
                        <div className={`text-center p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30`}>
                          <Clock className={`w-4 h-4 sm:w-5 sm:h-5 text-green-400 mx-auto mb-1 sm:mb-2 ${timerActive ? 'animate-pulse' : ''}`} />
                          <p className="text-lg sm:text-xl font-bold text-white">
                            {timerActive && timeRemaining !== null
                              ? `${Math.floor(timeRemaining / 60)}:${String(timeRemaining % 60).padStart(2, '0')}`
                              : '--:--'}
                          </p>
                          <p className="text-[10px] sm:text-xs text-gray-500">{timerActive ? t.matchIn : t.waitingMore}</p>
                        </div>
                      </div>

                      {/* Progress Bar with glow effect */}
                      <div className="relative">
                        <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r ${isHardcore ? 'from-red-500 to-orange-500' : 'from-cyan-400 to-blue-500'} transition-all duration-500 relative`}
                            style={{ width: `${(queueSize / (isHardcore ? 10 : 8)) * 100}%` }}
                          >
                            {/* Shimmer effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                          </div>
                        </div>
                        {/* Milestone markers - 4v4 at 80% for Hardcore (8/10), 100% for CDL (8/8) */}
                        {isHardcore && (
                          <div className="absolute top-0 left-0 w-full h-3 flex items-center">
                            <div className="absolute left-[80%] w-0.5 h-full bg-white/20" title="4v4" />
                          </div>
                        )}
                      </div>

                      {/* Staff/Admin: Add fake players button */}
                      {isStaffOrAdmin && (
                        <button
                          onClick={() => addFakePlayers(5)}
                          disabled={addingFakePlayers}
                          className="w-full py-3 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 font-medium hover:bg-purple-500/30 transition-all flex items-center justify-center gap-2"
                        >
                          {addingFakePlayers ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              <Bot className="w-5 h-5" />
                              {t.addFakePlayers}
                            </>
                          )}
                        </button>
                      )}

                      {/* Cancel Button */}
                      <button
                        onClick={leaveQueue}
                        disabled={leavingQueue}
                        className="w-full py-4 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-400 font-semibold hover:bg-red-500/30 transition-all flex items-center justify-center gap-2"
                      >
                        {leavingQueue ? <Loader2 className="w-5 h-5 animate-spin" /> : <Square className="w-5 h-5" />}
                        {t.cancel}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Mode Info */}
                      <div className="flex items-center gap-4 p-4 rounded-2xl bg-dark-800/50 border border-white/5">
                        <div className={`p-3 rounded-xl bg-gradient-to-br ${isHardcore ? 'from-red-500 to-orange-600' : 'from-cyan-400 to-blue-600'}`}>
                          {selectedGameMode === 'Search & Destroy' && <Crosshair className="w-6 h-6 text-white" />}
                          {selectedGameMode === 'Hardpoint' && <Target className="w-6 h-6 text-white" />}
                          {selectedGameMode === 'Team Deathmatch' && <Swords className="w-6 h-6 text-white" />}
                          {selectedGameMode === 'Duel' && <Target className="w-6 h-6 text-white" />}
                        </div>
                        <div>
                          <p className="text-white font-semibold">
                            {selectedGameMode === 'Search & Destroy' ? t.searchDestroy : 
                             selectedGameMode === 'Hardpoint' ? t.hardpoint :
                             selectedGameMode === 'Team Deathmatch' ? t.teamDeathmatch : 
                             t.duel}
                          </p>
                          <p className="text-gray-500 text-sm">
                            {t.soloMode} • {selectedGameMode === 'Duel' ? '1v1' : isHardcore ? '4v4 → 5v5' : '4v4'}
                          </p>
                        </div>
                      </div>

                      {/* Matchmaking Disabled Message */}
                      {!matchmakingEnabled && (
                        <div className={`mb-4 p-4 rounded-2xl ${isStaffOrAdmin ? 'bg-purple-500/20 border-purple-500/30' : 'bg-yellow-500/20 border-yellow-500/30'} border flex items-center gap-3`}>
                          <AlertTriangle className={`w-5 h-5 ${isStaffOrAdmin ? 'text-purple-400' : 'text-yellow-400'}`} />
                          <span className={isStaffOrAdmin ? 'text-purple-300' : 'text-yellow-300'}>
                            {isStaffOrAdmin 
                              ? (language === 'fr' ? '⚡ Mode staff : Le matchmaking est publiquement fermé mais vous y avez accès.' : '⚡ Staff mode: Matchmaking is publicly closed but you have access.')
                              : (language === 'fr' ? 'Le matchmaking est temporairement désactivé.' : 'Matchmaking is temporarily disabled.')
                            }
                          </span>
                        </div>
                      )}

                      {/* Staff Test Match Section */}
                      {isStaffOrAdmin && (
                        <div className="mb-4 p-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/10 border border-purple-500/30">
                          <div className="flex items-center gap-2 mb-3">
                            <Bot className="w-5 h-5 text-purple-400" />
                            <span className="text-purple-300 font-semibold">
                              {language === 'fr' ? '⚡ Mode Test Staff' : '⚡ Staff Test Mode'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 mb-3">
                            {t.testMatchInfo}
                          </p>
                          
                          {/* Team size selector */}
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-sm text-gray-400">Format:</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setTestMatchTeamSize(4)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                  testMatchTeamSize === 4 
                                    ? 'bg-purple-500 text-white' 
                                    : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
                                }`}
                              >
                                4v4
                              </button>
                              <button
                                onClick={() => setTestMatchTeamSize(5)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                  testMatchTeamSize === 5 
                                    ? 'bg-purple-500 text-white' 
                                    : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
                                }`}
                              >
                                5v5
                              </button>
                            </div>
                          </div>
                          
                          <button
                            onClick={startTestMatch}
                            disabled={startingTestMatch || !!activeMatch}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {startingTestMatch ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <>
                                <Zap className="w-5 h-5" />
                                {t.startTestMatch}
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {/* Mandatory Match Warning */}
                      <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500/20 via-red-500/20 to-orange-500/20 border border-orange-500/30 mb-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                          <p className="text-orange-300 text-sm font-medium leading-relaxed">
                            {t.mandatoryMatchWarning}
                          </p>
                        </div>
                      </div>

                      {/* Find Match Button */}
                      <button
                        onClick={joinQueue}
                        disabled={joiningQueue || !!activeMatch || (user?.platform === 'PC' && ggsecureConnected === false) || (!matchmakingEnabled && !isStaffOrAdmin)}
                        className={`w-full py-5 rounded-2xl bg-gradient-to-r ${
                          isHardcore ? 'from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700' : 'from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700'
                        } text-white font-bold text-lg shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 group`}
                      >
                        {joiningQueue ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <>
                            <Play className="w-6 h-6 group-hover:scale-110 transition-transform" />
                            {t.findMatch}
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Login Prompt */}
              {!isAuthenticated && (
                <div className="rounded-2xl sm:rounded-3xl bg-dark-800/50 backdrop-blur-xl border border-white/10 p-4 sm:p-8 text-center">
                  <Swords className={`w-16 h-16 text-${accent}-500/50 mx-auto mb-4`} />
                  <h3 className="text-xl font-bold text-white mb-2">{t.loginToPlay}</h3>
                  <p className="text-gray-500">{t.loginRequired}</p>
                </div>
              )}
            </div>

            {/* Right Column - Ranks & Leaderboard */}
            <div className="space-y-6">
              {/* Ranks Overview - Animated Ladder */}
              <div className="rounded-2xl sm:rounded-3xl bg-dark-800/50 backdrop-blur-xl border border-white/10 p-4 sm:p-6 relative overflow-hidden">
                {/* Background glow effect */}
                <div 
                  className="absolute inset-0 opacity-30 pointer-events-none"
                  style={{
                    background: `linear-gradient(180deg, 
                      rgba(241, 196, 15, 0.1) 0%, 
                      rgba(231, 76, 60, 0.1) 15%, 
                      rgba(155, 89, 182, 0.1) 30%, 
                      rgba(185, 242, 255, 0.1) 45%, 
                      rgba(0, 206, 209, 0.1) 60%, 
                      rgba(255, 215, 0, 0.1) 75%, 
                      rgba(192, 192, 192, 0.1) 90%, 
                      rgba(205, 127, 50, 0.1) 100%)`
                  }}
                />
                
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 relative z-10">
                  <Sparkles className={`w-5 h-5 text-${accent}-500 animate-pulse`} />
                  {t.ranks}
                </h3>
                
                {/* Animated connection line */}
                <div className="absolute left-10 top-16 bottom-6 w-0.5 bg-gradient-to-b from-yellow-400 via-purple-500 to-amber-700 opacity-30" />
                
                <div className="space-y-2 relative z-10">
                  {/* Reverse ranks to show Champion at top, Bronze at bottom */}
                  {[...ranks].reverse().map((rank, index) => {
                    const Icon = rank.icon;
                    const isCurrentRank = myRanking && myRanking.points >= rank.min && myRanking.points <= rank.max;
                    const animationDelay = index * 0.1;
                    const isTopRank = index < 2; // Champion & Grandmaster
                    
                    return (
                      <div 
                        key={rank.name}
                        className={`group relative flex items-center gap-3 p-3 rounded-xl transition-all duration-300 hover:scale-[1.02] cursor-default ${
                          isCurrentRank 
                            ? `bg-gradient-to-r ${rank.gradient} bg-opacity-30 border-2 shadow-lg` 
                            : 'bg-dark-800/30 hover:bg-dark-800/60 border border-transparent hover:border-white/10'
                        }`}
                        style={{
                          borderColor: isCurrentRank ? `${rank.color}50` : undefined,
                          boxShadow: isCurrentRank ? `0 0 20px ${rank.color}30` : undefined,
                          animation: `slideInRight 0.5s ease-out ${animationDelay}s both`
                        }}
                      >
                        {/* Animated glow for current rank */}
                        {isCurrentRank && (
                          <div 
                            className="absolute -inset-0.5 rounded-xl opacity-50 blur-sm -z-10"
                            style={{
                              background: `linear-gradient(${rankAnimationPhase}deg, ${rank.color}, transparent, ${rank.color})`,
                            }}
                          />
                        )}
                        
                        {/* Rank icon with animation */}
                        <div 
                          className={`relative w-10 h-10 rounded-lg bg-gradient-to-br ${rank.gradient} flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${isTopRank ? 'ring-2 ring-white/20' : ''}`}
                          style={{
                            boxShadow: `0 4px 15px ${rank.color}40`
                          }}
                        >
                          <Icon 
                            className={`w-5 h-5 text-white ${isCurrentRank ? 'animate-pulse' : ''}`}
                            style={{ 
                              filter: isTopRank ? `drop-shadow(0 0 6px ${rank.color})` : undefined
                            }}
                          />
                          {/* Sparkle effect for top ranks */}
                          {isTopRank && (
                            <div className="absolute -top-1 -right-1">
                              <Sparkles 
                                className="w-3 h-3 animate-ping" 
                                style={{ color: rank.color, animationDuration: '2s' }}
                              />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1">
                          <p 
                            className={`font-bold text-sm transition-colors ${isCurrentRank ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}
                            style={{ 
                              color: isCurrentRank ? rank.color : undefined,
                              textShadow: isCurrentRank ? `0 0 10px ${rank.color}60` : undefined
                            }}
                          >
                            {rank.name}
                          </p>
                          <p className="text-xs text-gray-500">{rank.min} - {rank.max === 99999 ? '∞' : rank.max} pts</p>
                        </div>
                        
                        {/* Current rank indicator */}
                        {isCurrentRank && (
                          <div className="flex items-center gap-2">
                            <span 
                              className="px-2.5 py-1 rounded-full text-xs font-bold animate-pulse"
                              style={{ 
                                backgroundColor: `${rank.color}30`,
                                color: rank.color,
                                boxShadow: `0 0 10px ${rank.color}40`
                              }}
                            >
                              {t.you}
                            </span>
                            <ChevronRight className="w-4 h-4 text-white animate-bounce" style={{ animationDuration: '1.5s' }} />
                          </div>
                        )}
                        
                        {/* Tier badge for top ranks */}
                        {isTopRank && !isCurrentRank && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-gray-400">
                            {rank.tier}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

          {/* Classement Mode Classé */}
          <div className="rounded-3xl bg-dark-800/50 backdrop-blur-xl border border-white/10 overflow-hidden">
            {/* Header */}
            <div className={`px-6 py-4 bg-gradient-to-r ${isHardcore ? 'from-red-500/20 to-orange-500/10' : 'from-cyan-500/20 to-blue-500/10'} border-b border-white/10`}>
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <div className={`p-2 rounded-xl bg-gradient-to-br ${isHardcore ? 'from-red-500 to-orange-600' : 'from-cyan-400 to-blue-600'}`}>
                  <Crown className="w-5 h-5 text-white" />
                </div>
                {t.leaderboard} - Top 100
              </h3>
            </div>
            
            {loadingLeaderboard ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className={`w-8 h-8 text-${accent}-500 animate-spin`} />
              </div>
            ) : leaderboard.length > 0 ? (
              <div className="p-4 space-y-2">
                {leaderboard.map((player, idx) => {
                  // Calculate actual position based on current page
                  const position = (leaderboardPage - 1) * LEADERBOARD_PER_PAGE + idx + 1;
                  const rank = getRankFromPoints(player.points);
                  const RankIcon = rank.icon;
                  const winRate = player.wins + player.losses > 0 
                    ? Math.round((player.wins / (player.wins + player.losses)) * 100) 
                    : 0;
                  const isMe = user && player.user?._id === user._id;
                  
                  return (
                    <button
                      key={player._id}
                      onClick={() => navigate(`/player/${player.user?._id}`)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-white/5 ${
                        isMe ? `${isHardcore ? 'bg-red-500/10 border border-red-500/30' : 'bg-cyan-500/10 border border-cyan-500/30'}` : ''
                      }`}
                    >
                      {/* Position */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                        position === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                        position === 2 ? 'bg-gray-400/20 text-gray-300' :
                        position === 3 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-dark-800 text-gray-500'
                      }`}>
                        {position <= 3 ? (
                          position === 1 ? <Crown className="w-4 h-4" /> :
                          <Medal className="w-4 h-4" />
                        ) : position}
                      </div>
                      
                      {/* Avatar */}
                      <img 
                        src={getUserAvatar(player.user)}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        onError={(e) => { e.target.src = '/avatar.jpg'; }}
                      />
                      
                      {/* Name & Rank */}
                      <div className="flex-1 min-w-0 text-left">
                        <p className={`font-medium truncate ${
                          position === 1 
                            ? 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-amber-500 via-yellow-400 to-yellow-200 font-bold text-base animate-text-shimmer' 
                            : position === 2 
                              ? 'text-transparent bg-clip-text bg-gradient-to-r from-gray-200 via-white to-slate-300 via-white to-gray-200 font-bold animate-text-shimmer' 
                              : position === 3 
                                ? 'text-transparent bg-clip-text bg-gradient-to-r from-orange-300 via-amber-400 to-orange-500 via-amber-400 to-orange-300 font-bold animate-text-shimmer' 
                                : 'text-white'
                        }`}>
                          {position === 1 && '👑 '}{player.user?.username || 'Unknown'}
                        </p>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded bg-gradient-to-br ${rank.gradient} flex items-center justify-center`}>
                            <RankIcon className="w-2.5 h-2.5 text-white" />
                          </div>
                          <span className="text-xs text-gray-500">{rank.name}</span>
                        </div>
                      </div>
                      
                      {/* Stats */}
                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold ${isHardcore ? 'text-red-400' : 'text-cyan-400'}`}>{player.points} pts</p>
                        <p className="text-xs text-gray-500">
                          <span className="text-green-400">{player.wins}V</span>
                          <span className="mx-1">/</span>
                          <span className="text-red-400">{player.losses}D</span>
                        </p>
                      </div>
                    </button>
                  );
                })}
                
                {/* Pagination controls */}
                {leaderboardTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-4 border-t border-white/10 mt-4">
                    <button
                      onClick={() => handleLeaderboardPageChange(leaderboardPage - 1)}
                      disabled={leaderboardPage === 1}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        leaderboardPage === 1 
                          ? 'bg-dark-800 text-gray-600 cursor-not-allowed' 
                          : `bg-${accent}-500/20 text-${accent}-400 hover:bg-${accent}-500/30`
                      }`}
                    >
                      ←
                    </button>
                    
                    {Array.from({ length: leaderboardTotalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => handleLeaderboardPageChange(page)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                          page === leaderboardPage 
                            ? `bg-${accent}-500 text-white` 
                            : 'bg-dark-800 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    
                    <button
                      onClick={() => handleLeaderboardPageChange(leaderboardPage + 1)}
                      disabled={leaderboardPage === leaderboardTotalPages}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        leaderboardPage === leaderboardTotalPages 
                          ? 'bg-dark-800 text-gray-600 cursor-not-allowed' 
                          : `bg-${accent}-500/20 text-${accent}-400 hover:bg-${accent}-500/30`
                      }`}
                    >
                      →
                    </button>
                  </div>
                )}

                {/* Show my position if I'm not in top 100 */}
                {myRanking && myRanking.rank > LEADERBOARD_TOTAL && user && (
                  <>
                    {/* Separator */}
                    <div className="flex items-center gap-2 py-2">
                      <div className="flex-1 border-t border-white/10"></div>
                      <span className="text-xs text-gray-500">...</span>
                      <div className="flex-1 border-t border-white/10"></div>
                    </div>
                    
                    {/* My position */}
                    <button
                      onClick={() => navigate(`/player/${user._id}`)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                        isHardcore ? 'bg-red-500/10 border border-red-500/30' : 'bg-cyan-500/10 border border-cyan-500/30'
                      }`}
                    >
                      {/* Position */}
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm bg-dark-800 text-gray-500">
                        {myRanking.rank}
                      </div>
                      
                      {/* Avatar */}
                      <img 
                        src={getUserAvatar(user)}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        onError={(e) => { e.target.src = '/avatar.jpg'; }}
                      />
                      
                      {/* Name & Rank */}
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium truncate">{user.username}</p>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isHardcore ? 'bg-red-500/20 text-red-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                            {t.you}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded bg-gradient-to-br ${playerRank.gradient} flex items-center justify-center`}>
                            <PlayerRankIcon className="w-2.5 h-2.5 text-white" />
                          </div>
                          <span className="text-xs text-gray-500">{playerRank.name}</span>
                        </div>
                      </div>
                      
                      {/* Stats */}
                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold ${isHardcore ? 'text-red-400' : 'text-cyan-400'}`}>{myRanking.points} pts</p>
                        <p className="text-xs text-gray-500">
                          <span className="text-green-400">{myRanking.wins}V</span>
                          <span className="mx-1">/</span>
                          <span className="text-red-400">{myRanking.losses}D</span>
                        </p>
                      </div>
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="p-12 text-center">
                <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500">{t.noRankedPlayers}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Rules Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className={`bg-dark-900 rounded-xl sm:rounded-2xl border border-${accent}-500/30 p-4 sm:p-6 md:p-8 max-w-5xl w-full max-h-[90vh] sm:max-h-[85vh] overflow-y-auto shadow-2xl mx-2 sm:mx-0`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <div className={`p-2 rounded-xl bg-gradient-to-br ${isHardcore ? 'from-red-500 to-orange-600' : 'from-cyan-400 to-blue-600'}`}>
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                {language === 'fr' ? 'Règles - ' : 'Rules - '}
                {selectedGameMode === 'Search & Destroy' ? t.searchDestroy : 
                 selectedGameMode === 'Hardpoint' ? t.hardpoint :
                 selectedGameMode === 'Team Deathmatch' ? t.teamDeathmatch : 
                 t.duel}
              </h3>
              <button
                onClick={() => setShowRulesModal(false)}
                className="p-2 rounded-lg bg-dark-800 hover:bg-dark-700 transition-colors"
              >
                <span className="text-gray-400 text-xl">×</span>
              </button>
            </div>
            
            {loadingRules ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className={`w-8 h-8 text-${accent}-500 animate-spin`} />
              </div>
            ) : rules && rules.sections?.length > 0 ? (
              <div className="space-y-6">
                {rules.sections.sort((a, b) => a.order - b.order).map((section, idx) => (
                  <div key={idx} className="bg-dark-800/50 rounded-xl p-4 border border-white/5">
                    <h4 className={`text-lg font-bold text-${accent}-400 mb-3 flex items-center gap-2`}>
                      {section.icon === 'shield' && <Shield className="w-5 h-5" />}
                      {section.icon === 'target' && <Target className="w-5 h-5" />}
                      {section.icon === 'crosshair' && <Crosshair className="w-5 h-5" />}
                      {section.icon === 'users' && <Users className="w-5 h-5" />}
                      {section.icon === 'trophy' && <Trophy className="w-5 h-5" />}
                      {section.icon === 'swords' && <Swords className="w-5 h-5" />}
                      {(!section.icon || section.icon === 'fileText') && <BookOpen className="w-5 h-5" />}
                      {section.title?.[language] || section.title?.fr || section.title?.en}
                    </h4>
                    <div 
                      className="text-gray-300 text-sm prose prose-invert prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ 
                        __html: section.content?.[language] || section.content?.fr || section.content?.en 
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500">
                  {language === 'fr' 
                    ? 'Aucune règle configurée pour ce mode.' 
                    : 'No rules configured for this mode.'}
                </p>
              </div>
            )}
            
            <button
              onClick={() => setShowRulesModal(false)}
              className={`mt-6 w-full py-3 rounded-xl bg-gradient-to-r ${isHardcore ? 'from-red-500 to-orange-600' : 'from-cyan-400 to-blue-600'} text-white font-semibold hover:opacity-90 transition-all`}
            >
              {language === 'fr' ? 'Fermer' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* Shuffle Animation Modal */}
      {showShuffleAnimation && shuffleMatchData && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[60]">
          <div className="w-full max-w-4xl mx-4">
            {/* Title */}
            <div className="text-center mb-8">
              <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r ${isHardcore ? 'from-red-500/20 to-orange-500/20 border-red-500/50' : 'from-cyan-500/20 to-blue-500/20 border-cyan-500/50'} border mb-4`}>
                <Swords className={`w-6 h-6 ${isHardcore ? 'text-red-400' : 'text-cyan-400'} ${shufflePhase === 0 ? 'animate-pulse' : ''}`} />
                <span className="text-2xl font-bold text-white">
                  {t.matchFound || 'Match trouvé !'}
                </span>
                <Swords className={`w-6 h-6 ${isHardcore ? 'text-red-400' : 'text-cyan-400'} ${shufflePhase === 0 ? 'animate-pulse' : ''}`} />
              </div>
              <p className={`text-lg ${isHardcore ? 'text-red-400' : 'text-cyan-400'}`}>
                {shufflePhase === 0 && (t.shufflingPlayers || 'Mélange des joueurs...')}
                {shufflePhase === 1 && (t.distributingTeams || 'Répartition dans les équipes...')}
                {shufflePhase === 2 && (t.teamsReady || 'Équipes prêtes !')}
                {shufflePhase === 3 && (t.getReady || 'Préparez-vous !')}
              </p>
            </div>

            {/* Players Display */}
            <div className="relative">
              {/* Phase 0: Shuffling - All players in center */}
              {shufflePhase === 0 && (
                <div className="flex flex-wrap justify-center gap-4 animate-pulse">
                  {shuffledPlayers.map((player, index) => (
                    <div
                      key={player.id || index}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800/80 border border-gray-600/50 transform transition-all duration-300`}
                      style={{
                        transform: `translateX(${Math.sin(index * 0.8) * 20}px) translateY(${Math.cos(index * 0.8) * 10}px)`,
                      }}
                    >
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700">
                        <img
                          src={player.avatar || `https://cdn.discordapp.com/embed/avatars/${index % 5}.png`}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.src = `https://cdn.discordapp.com/embed/avatars/${index % 5}.png`; }}
                        />
                      </div>
                      <span className="text-white font-medium">{player.username || `Joueur ${index + 1}`}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Phase 1, 2 & 3: Teams Split */}
              {(shufflePhase === 1 || shufflePhase === 2 || shufflePhase === 3) && (
                <div className="grid grid-cols-2 gap-8">
                  {/* Team A */}
                  <div className={`p-6 rounded-2xl border-2 transition-all duration-500 ${
                    (shufflePhase === 2 || shufflePhase === 3)
                      ? 'bg-cyan-500/10 border-cyan-500/50'
                      : 'bg-gray-800/50 border-gray-600/30'
                  }`}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 rounded-full bg-cyan-400"></div>
                      <h3 className="text-xl font-bold text-cyan-400">Team A</h3>
                    </div>
                    <div className="space-y-3">
                      {shuffleMatchData.players
                        ?.filter(p => p.team === 1 || p.team === 'A')
                        .map((player, index) => (
                          <div
                            key={player.id || index}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-900/50 border border-cyan-500/20 transform transition-all duration-500 ${
                              (shufflePhase === 2 || shufflePhase === 3) ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'
                            }`}
                            style={{ transitionDelay: `${index * 100}ms` }}
                          >
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 border-2 border-cyan-500/50">
                              <img
                                src={player.avatar || `https://cdn.discordapp.com/embed/avatars/${index % 5}.png`}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.src = `https://cdn.discordapp.com/embed/avatars/${index % 5}.png`; }}
                              />
                            </div>
                            <div>
                              <span className="text-white font-semibold">{player.username || `Joueur ${index + 1}`}</span>
                              {player.isHost && <span className="ml-2 text-yellow-400 text-xs">(Host)</span>}
                              {player.isReferent && <span className="ml-2 text-purple-400 text-xs">(Réf.)</span>}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* VS Divider */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl ${
                      isHardcore 
                        ? 'bg-gradient-to-br from-red-500 to-orange-600' 
                        : 'bg-gradient-to-br from-cyan-400 to-blue-600'
                    } shadow-lg ${(shufflePhase === 2 || shufflePhase === 3) ? 'animate-bounce' : ''}`}>
                      VS
                    </div>
                  </div>

                  {/* Team B */}
                  <div className={`p-6 rounded-2xl border-2 transition-all duration-500 ${
                    (shufflePhase === 2 || shufflePhase === 3)
                      ? 'bg-orange-500/10 border-orange-500/50'
                      : 'bg-gray-800/50 border-gray-600/30'
                  }`}>
                    <div className="flex items-center gap-2 mb-4 justify-end">
                      <h3 className="text-xl font-bold text-orange-400">Team B</h3>
                      <div className="w-3 h-3 rounded-full bg-orange-400"></div>
                    </div>
                    <div className="space-y-3">
                      {shuffleMatchData.players
                        ?.filter(p => p.team === 2 || p.team === 'B')
                        .map((player, index) => (
                          <div
                            key={player.id || index}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-900/50 border border-orange-500/20 transform transition-all duration-500 ${
                              (shufflePhase === 2 || shufflePhase === 3) ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
                            }`}
                            style={{ transitionDelay: `${index * 100}ms` }}
                          >
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 border-2 border-orange-500/50">
                              <img
                                src={player.avatar || `https://cdn.discordapp.com/embed/avatars/${index % 5}.png`}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.src = `https://cdn.discordapp.com/embed/avatars/${index % 5}.png`; }}
                              />
                            </div>
                            <div>
                              <span className="text-white font-semibold">{player.username || `Joueur ${index + 1}`}</span>
                              {player.isHost && <span className="ml-2 text-yellow-400 text-xs">(Host)</span>}
                              {player.isReferent && <span className="ml-2 text-purple-400 text-xs">(Réf.)</span>}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Redirect indicator / Countdown */}
            {(shufflePhase === 2 || shufflePhase === 3) && (
              <div className="text-center mt-8">
                {shufflePhase === 3 ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold border-4 ${
                      isHardcore 
                        ? 'bg-red-500/20 border-red-500 text-red-400' 
                        : 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                    } animate-pulse`}>
                      {shuffleCountdown}
                    </div>
                    <span className="text-gray-400">{t.redirectingIn || 'Redirection dans...'}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t.teamsReady || 'Équipes prêtes !'}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RankedMode;
