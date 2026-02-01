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
  Medal, Star, ChevronRight, Flame, Sparkles, Eye, Bot, Radio, BookOpen, Coins, X, Map, RefreshCw
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

// Audio pour le matchmaking - Web Audio API avec plusieurs sons aléatoires
let audioContext = null;
let audioBuffers = []; // Array of audio buffers for random selection
let audioLoaded = false;

// URLs des sons - dans le dossier public du client
const SOUND_URLS = [
  '/sound.mp3',
  '/sound2.mp3',
  '/sound3.mp3',
  '/sound4.mp3',
  '/sound5.mp3'
];

const initAudioContext = async () => {
  if (audioContext && audioBuffers.length > 0) return;
  
  try {
    // Créer le contexte audio
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log('[Audio] AudioContext créé');
    }
    
    // Charger tous les fichiers audio depuis l'API
    if (audioBuffers.length === 0) {
      console.log('[Audio] Chargement de', SOUND_URLS.length, 'sons...');
      
      const loadPromises = SOUND_URLS.map(async (url, index) => {
        try {
          const response = await fetch(url);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            if (arrayBuffer.byteLength > 0) {
              const buffer = await audioContext.decodeAudioData(arrayBuffer);
              console.log(`[Audio] ✓ Son ${index + 1} chargé!`);
              return buffer;
            }
          } else {
            console.error(`[Audio] ✗ Son ${index + 1} non trouvé:`, response.status);
          }
        } catch (err) {
          console.error(`[Audio] Erreur chargement son ${index + 1}:`, err);
        }
        return null;
      });
      
      const loadedBuffers = await Promise.all(loadPromises);
      audioBuffers = loadedBuffers.filter(buffer => buffer !== null);
      
      if (audioBuffers.length > 0) {
        audioLoaded = true;
        console.log(`[Audio] ✓ ${audioBuffers.length}/${SOUND_URLS.length} sons chargés!`);
      }
    }
  } catch (err) {
    console.error('[Audio] Erreur initialisation:', err);
  }
};

let currentAudioSource = null;

const playMatchFoundSound = () => {
  console.log('[Audio] Tentative de lecture...', { hasContext: !!audioContext, bufferCount: audioBuffers.length, loaded: audioLoaded });
  
  if (!audioContext || audioBuffers.length === 0) {
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
    
    // Sélectionner un son aléatoire parmi les buffers chargés
    const randomIndex = Math.floor(Math.random() * audioBuffers.length);
    const selectedBuffer = audioBuffers[randomIndex];
    console.log(`[Audio] Son sélectionné: ${randomIndex + 1}/${audioBuffers.length}`);
    
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    
    source.buffer = selectedBuffer;
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    gainNode.gain.value = 0.15;
    
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

// Helper pour obtenir le nom traduit d'un rang
const getRankName = (rankKey, language) => {
  return RANK_NAMES[rankKey]?.[language] || RANK_NAMES[rankKey]?.en || rankKey;
};

// Rank styling data (constante - ne change pas)
const RANK_STYLES = {
  bronze: { key: 'bronze', color: '#CD7F32', gradient: 'from-amber-700 to-amber-900', icon: Shield, tier: 'IV-I', image: '/1.png' },
  silver: { key: 'silver', color: '#C0C0C0', gradient: 'from-slate-400 to-slate-600', icon: Shield, tier: 'IV-I', image: '/2.png' },
  gold: { key: 'gold', color: '#FFD700', gradient: 'from-yellow-500 to-amber-600', icon: Medal, tier: 'IV-I', image: '/3.png' },
  platinum: { key: 'platinum', color: '#00CED1', gradient: 'from-teal-400 to-cyan-600', icon: Medal, tier: 'IV-I', image: '/4.png' },
  diamond: { key: 'diamond', color: '#B9F2FF', gradient: 'from-cyan-300 to-blue-500', icon: Star, tier: 'IV-I', image: '/5.png' },
  master: { key: 'master', color: '#9B59B6', gradient: 'from-purple-500 to-pink-600', icon: Crown, tier: 'III-I', image: '/6.png' },
  grandmaster: { key: 'grandmaster', color: '#E74C3C', gradient: 'from-red-500 to-orange-600', icon: Flame, tier: 'II-I', image: '/7.png' },
  champion: { key: 'champion', color: '#F1C40F', gradient: 'from-yellow-400 via-orange-500 to-red-600', icon: Zap, tier: 'Top 10', image: '/8.png' }
};

// Helper to build RANKS array from thresholds
const buildRanksFromThresholds = (thresholds, language = 'en') => {
  const rankOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'champion'];
  return rankOrder.map(key => {
    const threshold = thresholds[key] || DEFAULT_RANK_THRESHOLDS[key];
    const style = RANK_STYLES[key];
    return {
      key,
      name: getRankName(key, language),
      min: threshold.min ?? 0,
      max: threshold.max ?? 99999,
      color: style.color,
      gradient: style.gradient,
      icon: style.icon,
      tier: style.tier,
      image: style.image
    };
  });
};

// Active Booster Item showing remaining matches
const ActiveBoosterItem = ({ booster, language, t, onExpire }) => {
  // remainingMatches: number of matches remaining (null = unlimited)
  const remainingMatches = booster.remainingMatches;
  
  // Check if unlimited (null) or has matches remaining
  const isUnlimited = remainingMatches === null || remainingMatches === undefined;
  const isLowMatches = !isUnlimited && remainingMatches <= 1 && remainingMatches > 0;
  
  // Format matches display
  const formatMatches = (count) => {
    if (count === null || count === undefined) return '∞';
    if (count <= 0) return '0';
    return count.toString();
  };
  
  return (
    <div 
      className={`flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 border ${isLowMatches ? 'border-orange-500/50 animate-pulse' : 'border-green-500/30'}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
          {booster.effectType === 'double_pts' ? (
            <Zap className="w-5 h-5 text-yellow-400" />
          ) : (
            <Coins className="w-5 h-5 text-amber-400" />
          )}
        </div>
        <div>
          <p className="text-white font-semibold text-sm">
            {booster.item?.nameTranslations?.[language] || booster.item?.name}
          </p>
          <p className={`text-xs flex items-center gap-1 ${isLowMatches ? 'text-orange-400' : 'text-green-400'}`}>
            <Target className="w-3 h-3" />
            {isUnlimited ? (
              <span className="font-bold">∞ {language === 'fr' ? 'Illimité' : 'Unlimited'}</span>
            ) : (
              <span className="font-bold">
                {formatMatches(remainingMatches)} {language === 'fr' ? 'match' : 'match'}{remainingMatches > 1 ? (language === 'fr' ? 's restants' : 'es left') : (language === 'fr' ? ' restant' : ' left')}
              </span>
            )}
          </p>
        </div>
      </div>
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/30 text-green-400">
        {t.active || 'Actif'}
      </span>
    </div>
  );
};

const RankedMode = () => {
  const { language } = useLanguage();
  const { selectedMode, selectMode } = useMode();
  const { user, isAuthenticated } = useAuth();
  const { on, isConnected, joinPage, leavePage, emit, modeOnlineUsers, joinMode, leaveMode, joinRankedMatch, leaveRankedMatch } = useSocket();
  const navigate = useNavigate();
  
  // Player stats
  const [myRanking, setMyRanking] = useState(null);
  const [loadingRanking, setLoadingRanking] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [refreshingLeaderboard, setRefreshingLeaderboard] = useState(false);
  
  // Calculated stats from match history (for accurate display)
  const [calculatedStats, setCalculatedStats] = useState({ wins: 0, losses: 0, total: 0 });
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [leaderboardTotalPages, setLeaderboardTotalPages] = useState(1);
  const LEADERBOARD_PER_PAGE = 10;
  const LEADERBOARD_TOTAL = 100;
  
  // Game mode & Matchmaking
  const [selectedGameMode, setSelectedGameMode] = useState('Search & Destroy');
  const [inQueue, setInQueue] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [globalQueueCount, setGlobalQueueCount] = useState(0); // Total players in matchmaking for this mode
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
  const [showActiveMatchDialog, setShowActiveMatchDialog] = useState(false);
  const [savedActiveMatch, setSavedActiveMatch] = useState(null); // Save match info for dialog
  
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
  const [testMatchGameMode, setTestMatchGameMode] = useState('Search & Destroy');
  
  // Staff test queue (admin only)
  const [staffQueueMode, setStaffQueueMode] = useState(false); // Toggle between normal queue and staff queue
  const [inStaffQueue, setInStaffQueue] = useState(false);
  const [staffQueueSize, setStaffQueueSize] = useState(0);
  const [staffQueuePlayers, setStaffQueuePlayers] = useState([]);
  const [staffQueueTimerActive, setStaffQueueTimerActive] = useState(false);
  const [staffQueueTimerEndTime, setStaffQueueTimerEndTime] = useState(null);
  const [joiningStaffQueue, setJoiningStaffQueue] = useState(false);
  const [leavingStaffQueue, setLeavingStaffQueue] = useState(false);
  const [addingStaffBots, setAddingStaffBots] = useState(false);
  const [clearingStaffBots, setClearingStaffBots] = useState(false);
  const [forcingStaffMatch, setForcingStaffMatch] = useState(false);
  
  // Rules modal
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [rules, setRules] = useState(null);
  const [loadingRules, setLoadingRules] = useState(false);
  
  
  // Shuffle animation state
  const [showShuffleAnimation, setShowShuffleAnimation] = useState(false);
  const [shuffleMatchData, setShuffleMatchData] = useState(null);
  const [shufflePhase, setShufflePhase] = useState(0); // 0: mixing, 1: distributing, 2: complete, 3: countdown, 4: map vote
  const [shuffledPlayers, setShuffledPlayers] = useState([]);
  const [shuffleCountdown, setShuffleCountdown] = useState(10);
  
  // Map vote state
  const [mapVoteOptions, setMapVoteOptions] = useState([]);
  const [mapVoteCountdown, setMapVoteCountdown] = useState(15);
  const [selectedMapIndex, setSelectedMapIndex] = useState(null);
  const [selectedMap, setSelectedMap] = useState(null);
  const mapVoteOptionsRef = useRef([]);
  const currentMatchIdRef = useRef(null); // Ref to track current match ID for socket listeners
  
  // Roster selection state (for test matches)
  const [rosterSelection, setRosterSelection] = useState({
    isActive: false,
    currentTurn: 1,
    team1Referent: null,
    team2Referent: null,
    team2ReferentInfo: null, // Bot referent info (username, points, rank)
    availablePlayers: [],
    team1Players: [],
    team2Players: [],
    timeRemaining: 10,
    totalPlayersToSelect: 0,
    totalPicks: 0,
    // Flags calculés par le serveur
    isYourTurn: false,
    isTeam1Referent: false,
    isTeam2Referent: false
  });
  const [rosterSelectionCountdown, setRosterSelectionCountdown] = useState(10);
  
  // Map vote cancellation state
  const [mapVoteCancellation, setMapVoteCancellation] = useState({
    currentVotes: 0,
    requiredVotes: 0,
    hasVoted: false,
    isActive: false
  });
  const [votingCancellation, setVotingCancellation] = useState(false);
  
  // Voice channels for map vote phase
  const [voiceChannels, setVoiceChannels] = useState({
    team1: null,
    team2: null,
    myTeam: null
  });
  
  // Cancellation button timeout state
  const [showCancellationButton, setShowCancellationButton] = useState(true);
  const [cancellationTimeoutId, setCancellationTimeoutId] = useState(null);
  const fallbackRedirectTimeoutRef = useRef(null);
  
  // Rewards from config
  
  // Dynamic ranks from config
  const [ranks, setRanks] = useState(() => buildRanksFromThresholds(DEFAULT_RANK_THRESHOLDS, language));
  const [currentThresholds, setCurrentThresholds] = useState(DEFAULT_RANK_THRESHOLDS);
  
  // Points loss per rank from config - with defaults
  const DEFAULT_POINTS_LOSS_PER_RANK = {
    bronze: -10,
    silver: -12,
    gold: -15,
    platinum: -18,
    diamond: -20,
    master: -22,
    grandmaster: -25,
    champion: -30
  };
  const [pointsLossPerRank, setPointsLossPerRank] = useState(DEFAULT_POINTS_LOSS_PER_RANK);
  
  // Ranked rewards per game mode (points won per match)
  const [rankedRewardsPerMode, setRankedRewardsPerMode] = useState({});
  
  // Active events (Double XP, Double Gold)
  const [activeEvents, setActiveEvents] = useState({ doubleXP: false, doubleGold: false });
  
  // Matchmaking enabled/disabled
  const [matchmakingEnabled, setMatchmakingEnabled] = useState(true);
  
  // Current season from config
  const [currentSeason, setCurrentSeason] = useState(1);
  const [seasonLoaded, setSeasonLoaded] = useState(false);
  
  // Season rewards and countdown
  const [seasonRewardsInfo, setSeasonRewardsInfo] = useState(null);
  const [nextResetDate, setNextResetDate] = useState(null);
  const [countdownText, setCountdownText] = useState('');
  
  // Rank animation state
  const [rankAnimationPhase, setRankAnimationPhase] = useState(0);
  
  // Ref for matchmaking section scroll
  const matchmakingRef = useRef(null);
  
  // Maps modal state
  const [showMapsModal, setShowMapsModal] = useState(false);
  const [availableMaps, setAvailableMaps] = useState({ '4v4': [], '5v5': [] });
  const [mapsWarnings, setMapsWarnings] = useState({ '4v4': null, '5v5': null });
  const [mapsBestOf, setMapsBestOf] = useState(3);
  const [loadingMaps, setLoadingMaps] = useState(false);

  // Usable items / Boosters
  const [availableBoosters, setAvailableBoosters] = useState([]);
  const [activeBoosters, setActiveBoosters] = useState([]);
  const [loadingBoosters, setLoadingBoosters] = useState(false);
  const [activatingBooster, setActivatingBooster] = useState(null);

  const isHardcore = selectedMode === 'hardcore';
  const accent = isHardcore ? 'red' : 'cyan';
  
  // CDL: 8 players max (4v4), Hardcore: 10 players max (5v5)
  const maxPlayers = selectedMode === 'cdl' ? 8 : 10;
  
  // Update default game mode when switching modes - both modes use Search & Destroy
  useEffect(() => {
    setSelectedGameMode('Search & Destroy');
    setTestMatchGameMode('Search & Destroy');
  }, [selectedMode]);
  
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
  
  // Fetch available maps for ranked mode
  const fetchAvailableMaps = async () => {
    setLoadingMaps(true);
    try {
      // Fetch maps for both formats
      const [maps4v4Response, maps5v5Response] = await Promise.all([
        fetch(`${API_URL}/maps/ranked?format=4v4&mode=${selectedMode}&gameMode=${encodeURIComponent(selectedGameMode)}`),
        fetch(`${API_URL}/maps/ranked?format=5v5&mode=${selectedMode}&gameMode=${encodeURIComponent(selectedGameMode)}`)
      ]);
      
      const maps4v4Data = await maps4v4Response.json();
      const maps5v5Data = await maps5v5Response.json();
      
      setAvailableMaps({
        '4v4': maps4v4Data.success ? maps4v4Data.maps : [],
        '5v5': maps5v5Data.success ? maps5v5Data.maps : []
      });
      
      // Capturer les avertissements si pas assez de maps
      setMapsWarnings({
        '4v4': maps4v4Data.warning || null,
        '5v5': maps5v5Data.warning || null
      });
      
      // Capturer le format BO actuel
      setMapsBestOf(maps4v4Data.bestOf || 3);
    } catch (err) {
      console.error('Error fetching maps:', err);
      setAvailableMaps({ '4v4': [], '5v5': [] });
      setMapsWarnings({ '4v4': null, '5v5': null });
    } finally {
      setLoadingMaps(false);
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

  // Rebuild ranks when language changes
  useEffect(() => {
    setRanks(buildRanksFromThresholds(currentThresholds, language));
  }, [language, currentThresholds]);

  // Fetch rank thresholds and points loss per rank from config
  const fetchRankThresholds = async () => {
    try {
      // Fetch app settings for rank thresholds
      const appSettingsRes = await fetch(`${API_URL}/app-settings/public`);
      const appSettingsData = await appSettingsRes.json();
      if (appSettingsData.success && appSettingsData.rankedSettings?.rankPointsThresholds) {
        const thresholds = appSettingsData.rankedSettings.rankPointsThresholds;
        setCurrentThresholds(thresholds);
        setRanks(buildRanksFromThresholds(thresholds, language));
      }
      
      // Fetch current season
      if (appSettingsData.success && appSettingsData.rankedSettings?.currentSeason) {
        setCurrentSeason(appSettingsData.rankedSettings.currentSeason);
      }
      
      // Fetch main config for points loss per rank (configured in admin panel)
      const configRes = await fetch(`${API_URL}/config`);
      const configData = await configRes.json();
      if (configData.success && configData.config?.rankedPointsLossPerRank) {
        // Merge with defaults to ensure all ranks have valid negative values
        const mergedLoss = { ...DEFAULT_POINTS_LOSS_PER_RANK };
        Object.keys(DEFAULT_POINTS_LOSS_PER_RANK).forEach(rank => {
          const value = configData.config.rankedPointsLossPerRank[rank];
          // Only use config value if it's a valid negative number
          if (typeof value === 'number' && value < 0) {
            mergedLoss[rank] = value;
          }
        });
        setPointsLossPerRank(mergedLoss);
      }
    } catch (err) {
      console.error('Error fetching rank thresholds:', err);
    } finally {
      setSeasonLoaded(true);
    }
  };
  
  // Fetch ranked rewards for all game modes
  const fetchRankedRewards = async () => {
    try {
      // Get game modes based on mode
      // Hardcore: Duel, Team Deathmatch, Search & Destroy
      // CDL: Hardpoint, Search & Destroy
      const gameModes = isHardcore 
        ? ['Duel', 'Team Deathmatch', 'Search & Destroy']
        : ['Hardpoint', 'Search & Destroy'];
      
      const rewards = {};
      
      // Fetch rewards for each game mode
      await Promise.all(gameModes.map(async (gameMode) => {
        const response = await fetch(`${API_URL}/config/rewards/ranked?mode=${selectedMode}&gameMode=${encodeURIComponent(gameMode)}`);
        const data = await response.json();
        if (data.success) {
          rewards[gameMode] = data.rewards;
        }
      }));
      
      setRankedRewardsPerMode(rewards);
      
      // Fetch active events (Double XP, Double Gold) from app-settings
      const eventsResponse = await fetch(`${API_URL}/app-settings/public`);
      const eventsData = await eventsResponse.json();
      if (eventsData.success && eventsData.events) {
        const now = new Date();
        setActiveEvents({
          doubleXP: eventsData.events.doubleXP?.enabled && 
                    (!eventsData.events.doubleXP?.expiresAt || new Date(eventsData.events.doubleXP.expiresAt) > now),
          doubleGold: eventsData.events.doubleGold?.enabled && 
                      (!eventsData.events.doubleGold?.expiresAt || new Date(eventsData.events.doubleGold.expiresAt) > now)
        });
      }
    } catch (err) {
      console.error('Error fetching ranked rewards:', err);
    }
  };

  // Fetch season rewards info and countdown
  const fetchSeasonRewardsInfo = async () => {
    try {
      const response = await fetch(`${API_URL}/seasons/ranked/rewards-info`);
      const data = await response.json();
      if (data.success) {
        setSeasonRewardsInfo(data.rewards);
        setNextResetDate(new Date(data.nextResetDate));
        setCurrentSeason(data.currentSeason);
      }
    } catch (err) {
      console.error('Error fetching season rewards info:', err);
    }
  };

  // Update countdown every second
  useEffect(() => {
    if (!nextResetDate) return;
    
    const updateCountdown = () => {
      const now = new Date();
      const diff = nextResetDate.getTime() - now.getTime();
      
      if (diff <= 0) {
        setCountdownText(language === 'fr' ? 'Reset imminent' : 'Reset imminent');
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      if (language === 'fr') {
        setCountdownText(`${days}j ${hours}h ${minutes}m ${seconds}s`);
      } else if (language === 'de') {
        setCountdownText(`${days}T ${hours}Std ${minutes}Min ${seconds}Sek`);
      } else if (language === 'it') {
        setCountdownText(`${days}g ${hours}h ${minutes}m ${seconds}s`);
      } else {
        setCountdownText(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      }
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextResetDate, language]);

  // Get rank from points (using dynamic ranks)
  const getRankFromPoints = (points) => {
    return ranks.find(r => points >= r.min && points <= r.max) || ranks[0];
  };

  // Fetch available and active boosters
  const fetchBoosters = async () => {
    if (!isAuthenticated) return;
    setLoadingBoosters(true);
    try {
      const [availableRes, activeRes] = await Promise.all([
        fetch(`${API_URL}/shop/my-available-boosters`, { credentials: 'include' }),
        fetch(`${API_URL}/shop/my-active-boosters`, { credentials: 'include' })
      ]);
      const availableData = await availableRes.json();
      const activeData = await activeRes.json();
      
      if (availableData.success) setAvailableBoosters(availableData.boosters || []);
      if (activeData.success) setActiveBoosters(activeData.boosters || []);
    } catch (err) {
      console.error('Error fetching boosters:', err);
    } finally {
      setLoadingBoosters(false);
    }
  };

  // Activate a booster
  const activateBooster = async (purchaseId) => {
    setActivatingBooster(purchaseId);
    try {
      const response = await fetch(`${API_URL}/shop/use-item/${purchaseId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        // Refresh boosters
        await fetchBoosters();
      } else {
        console.error('Failed to activate booster:', data.message);
      }
    } catch (err) {
      console.error('Error activating booster:', err);
    } finally {
      setActivatingBooster(null);
    }
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

  // Fetch ranked match history and calculate accurate stats (filtered by current season)
  const fetchCalculatedStats = async (season) => {
    if (!isAuthenticated || !user?.id || !season) return;
    try {
      const response = await fetch(`${API_URL}/ranked-matches/player-history/${user.id}?limit=500&mode=${selectedMode}&season=${season}`, { credentials: 'include' });
      const data = await response.json();
      if (data.success && data.matches) {
        // Calculate wins/losses from actual match history
        let wins = 0;
        let losses = 0;
        data.matches.forEach(match => {
          if (match.isWinner) wins++;
          else losses++;
        });
        setCalculatedStats({ wins, losses, total: wins + losses });
      }
    } catch (err) {
      console.error('Error fetching ranked match history for stats:', err);
    }
  };

  // Fetch leaderboard with pagination (filtered by current season)
  const fetchLeaderboard = async (page = 1, force = false) => {
    if (force) {
      setRefreshingLeaderboard(true);
    } else {
      setLoadingLeaderboard(true);
    }
    try {
      const url = `${API_URL}/rankings/leaderboard/${selectedMode}?season=${currentSeason}&limit=${LEADERBOARD_PER_PAGE}&page=${page}${force ? '&force=true' : ''}`;
      
      const response = await fetch(url, { credentials: 'include' });
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
      setRefreshingLeaderboard(false);
    }
  };

  // Force refresh leaderboard (bypass cache)
  const handleRefreshLeaderboard = () => {
    fetchLeaderboard(leaderboardPage, true);
  };

  // Check active match and handle reconnection to appropriate phase
  const checkActiveMatch = async () => {
    if (!isAuthenticated) return;
    try {
      console.log('[RankedMode] Checking for active match (any mode)...');
      const response = await fetch(`${API_URL}/ranked-matches/active/me`, { credentials: 'include' });
      const data = await response.json();
      console.log('[RankedMode] Active match response:', { hasMatch: !!data.match, matchMode: data.match?.mode, currentSelectedMode: selectedMode });
      if (data.success && data.match) {
        const match = data.match;
        setActiveMatch(match);
        
        console.log('[RankedMode] Active match found:', {
          id: match._id,
          status: match.status,
          rosterSelectionActive: match.rosterSelection?.isActive,
          hasSelectedMap: !!match.selectedMap,
          team1Referent: match.team1Referent?._id || match.team1Referent,
          team2Referent: match.team2Referent?._id || match.team2Referent,
          userId: user?.id
        });
        
        // Si le match est en phase de sélection de roster (pending + rosterSelection.isActive)
        if (match.status === 'pending' && match.rosterSelection?.isActive) {
          console.log('[RankedMode] Reconnecting to roster selection phase');
          
          // Restaurer l'état de la sélection de roster
          const team1ReferentId = match.team1Referent?._id?.toString() || match.team1Referent?.toString();
          const team2ReferentId = match.team2Referent?._id?.toString() || match.team2Referent?.toString();
          
          // Obtenir les avatars des joueurs
          const getPlayerAvatar = (player) => {
            if (player.user?.discordId && player.user?.discordAvatar) {
              return `https://cdn.discordapp.com/avatars/${player.user.discordId}/${player.user.discordAvatar}.png`;
            } else if (player.user?.avatar) {
              return player.user.avatar;
            }
            return null;
          };
          
          const availablePlayers = match.players
            .filter(p => p.team === null)
            .map(p => ({
              id: p.user?._id?.toString() || p.user?.toString() || p.username,
              username: p.username,
              points: p.points || 0,
              rank: p.rank,
              isFake: p.isFake,
              avatar: getPlayerAvatar(p)
            }));
          
          const team1Players = match.players
            .filter(p => p.team === 1)
            .map(p => ({
              id: p.user?._id?.toString() || p.user?.toString(),
              username: p.username,
              points: p.points || 0,
              rank: p.rank,
              isFake: p.isFake,
              avatar: getPlayerAvatar(p)
            }));
          
          const team2Players = match.players
            .filter(p => p.team === 2)
            .map(p => ({
              id: p.user?._id?.toString() || p.user?.toString(),
              username: p.username,
              points: p.points || 0,
              rank: p.rank,
              isFake: p.isFake,
              avatar: getPlayerAvatar(p)
            }));
          
          setRosterSelection({
            isActive: true,
            currentTurn: match.rosterSelection.currentTurn || 1,
            team1Referent: team1ReferentId,
            team2Referent: team2ReferentId,
            availablePlayers,
            team1Players,
            team2Players,
            timeRemaining: 10,
            totalPlayersToSelect: match.players.filter(p => p.team === null).length,
            totalPicks: match.rosterSelection.totalPicks || 0
          });
          
          // Stocker les données du match et le matchId
          currentMatchIdRef.current = match._id;
          setShuffleMatchData({
            matchId: match._id,
            players: match.players.map(p => ({
              id: p.user?._id?.toString() || p.user?.toString() || p.username,
              username: p.username,
              avatar: getPlayerAvatar(p),
              team: p.team,
              isFake: p.isFake,
              points: p.points || 0
            })),
            isTestMatch: match.isTestMatch,
            hasRosterSelection: true,
            mapVoteOptions: match.mapVoteOptions?.map(m => ({ name: m.name, image: m.image, votes: m.votes || 0 })) || []
          });
          
          mapVoteOptionsRef.current = match.mapVoteOptions?.map(m => ({ name: m.name, image: m.image, votes: m.votes || 0 })) || [];
          setMapVoteOptions(mapVoteOptionsRef.current);
          setRosterSelectionCountdown(10);
          setShufflePhase(5);
          setShowShuffleAnimation(true);
          playMatchFoundSound();
          return;
        }
        
        // Si le match est en phase de vote de map (pending + pas de rosterSelection active + pas de map sélectionnée)
        if (match.status === 'pending' && !match.rosterSelection?.isActive && !match.selectedMap && match.mapVoteOptions?.length > 0) {
          console.log('[RankedMode] Reconnecting to map vote phase');
          
          // Stocker les données du match
          currentMatchIdRef.current = match._id;
          setShuffleMatchData({
            matchId: match._id,
            players: match.players.map(p => ({
              id: p.user?._id?.toString() || p.user?.toString() || p.username,
              username: p.username,
              team: p.team,
              isFake: p.isFake
            })),
            isTestMatch: match.isTestMatch
          });
          
          mapVoteOptionsRef.current = match.mapVoteOptions.map(m => ({ name: m.name, image: m.image, votes: m.votes || 0 }));
          setMapVoteOptions(mapVoteOptionsRef.current);
          setMapVoteCountdown(15);
          setShufflePhase(4);
          setShowShuffleAnimation(true);
          playMatchFoundSound();
          return;
        }
        
        // Sinon, ne pas rediriger automatiquement - l'utilisateur peut rester sur la page
        // et rejoindre via le bouton "Rejoindre" dans la bannière de match actif
        console.log('[RankedMode] Active match found, displaying banner instead of redirecting');
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
        
        // Si le joueur a un match en cours dans CE mode
        if (data.inMatch && data.match) {
          setActiveMatch(data.match);
          // Ne pas rediriger automatiquement - l'utilisateur peut rester sur la page
          // et rejoindre via le bouton "Rejoindre" dans la bannière de match actif
        }
        // Note: Ne PAS reset activeMatch ici si !inMatch, car le joueur pourrait avoir
        // un match actif dans l'AUTRE mode (ex: match Hardcore en cours, mais on regarde CDL)
        // checkActiveMatch() gère la vérification cross-mode
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
          gameMode: testMatchGameMode, 
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
  const isAdmin = user?.roles?.includes('admin');

  // ==================== STAFF TEST QUEUE FUNCTIONS (Admin only) ====================
  
  // Fetch staff queue status
  const fetchStaffQueueStatus = async () => {
    if (!isAdmin) return;
    try {
      const response = await fetch(
        `${API_URL}/ranked-matches/staff-queue/status?gameMode=${encodeURIComponent(selectedGameMode)}&mode=${selectedMode}`,
        { credentials: 'include' }
      );
      const data = await response.json();
      if (data.success) {
        setInStaffQueue(data.inQueue);
        setStaffQueueSize(data.queueSize);
        setStaffQueuePlayers(data.players || []);
        setStaffQueueTimerActive(data.timerActive);
        setStaffQueueTimerEndTime(data.timerEndTime);
      }
    } catch (err) {
      console.error('Error fetching staff queue status:', err);
    }
  };
  
  // Join staff queue
  const joinStaffQueue = async () => {
    unlockAudio();
    setMatchmakingError(null);
    setJoiningStaffQueue(true);
    try {
      const response = await fetch(`${API_URL}/ranked-matches/staff-queue/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ gameMode: selectedGameMode, mode: selectedMode })
      });
      const data = await response.json();
      if (data.success) {
        setInStaffQueue(true);
        setStaffQueueSize(data.queueSize);
      } else {
        setMatchmakingError(data.message);
        if (data.activeMatchId) setActiveMatch({ _id: data.activeMatchId });
      }
    } catch (err) {
      setMatchmakingError(language === 'fr' ? 'Erreur de connexion' : 'Connection error');
    } finally {
      setJoiningStaffQueue(false);
    }
  };
  
  // Leave staff queue
  const leaveStaffQueue = async () => {
    setLeavingStaffQueue(true);
    try {
      const response = await fetch(`${API_URL}/ranked-matches/staff-queue/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ gameMode: selectedGameMode, mode: selectedMode })
      });
      const data = await response.json();
      if (data.success) {
        setInStaffQueue(false);
        setStaffQueueSize(0);
        setStaffQueuePlayers([]);
        setStaffQueueTimerActive(false);
        setStaffQueueTimerEndTime(null);
      }
    } catch (err) {
      console.error('Error leaving staff queue:', err);
    } finally {
      setLeavingStaffQueue(false);
    }
  };
  
  // Add bots to staff queue
  const addBotsToStaffQueue = async (count = 1) => {
    setAddingStaffBots(true);
    try {
      const response = await fetch(`${API_URL}/ranked-matches/staff-queue/add-bots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ gameMode: selectedGameMode, mode: selectedMode, count })
      });
      const data = await response.json();
      if (data.success) {
        setStaffQueueSize(data.queueSize);
        await fetchStaffQueueStatus();
      } else {
        setMatchmakingError(data.message);
      }
    } catch (err) {
      console.error('Error adding bots:', err);
    } finally {
      setAddingStaffBots(false);
    }
  };
  
  // Clear all bots from staff queue
  const clearStaffQueueBots = async () => {
    setClearingStaffBots(true);
    try {
      const response = await fetch(`${API_URL}/ranked-matches/staff-queue/clear-bots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ gameMode: selectedGameMode, mode: selectedMode })
      });
      const data = await response.json();
      if (data.success) {
        setStaffQueueSize(data.queueSize);
        await fetchStaffQueueStatus();
      }
    } catch (err) {
      console.error('Error clearing bots:', err);
    } finally {
      setClearingStaffBots(false);
    }
  };
  
  // Force start staff match
  const forceStartStaffMatch = async () => {
    setForcingStaffMatch(true);
    try {
      const response = await fetch(`${API_URL}/ranked-matches/staff-queue/force-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ gameMode: selectedGameMode, mode: selectedMode })
      });
      const data = await response.json();
      if (!data.success) {
        setMatchmakingError(data.message);
      }
    } catch (err) {
      console.error('Error force starting match:', err);
    } finally {
      setForcingStaffMatch(false);
    }
  };

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
          ? 'Vous avez été retiré de la file d\'attente après 15 minutes sans match trouvé.'
          : 'You have been removed from the queue after 15 minutes without finding a match.');
        setTimeout(() => setMatchmakingError(null), 5000);
      }
    });
    const unsubMatch = on('rankedMatchFound', (data) => {
      console.log('[RankedMode] Match trouvé!', data);
      setInQueue(false);
      setInStaffQueue(false); // Reset staff queue state too
      
      // Jouer le son quand le match est trouvé
      playMatchFoundSound();
      
      // Rejoindre la room du match pour recevoir les updates (roster selection, map vote, etc.)
      if (data.matchId) {
        joinRankedMatch(data.matchId);
        console.log('[RankedMode] Joined ranked match room:', data.matchId);
      }
      
      // Reset pre-match states for new match (important for consecutive matches)
      setShowCancellationButton(true);
      setMapVoteCancellation({
        currentVotes: 0,
        requiredVotes: 0,
        hasVoted: false,
        isActive: false
      });
      setVotingCancellation(false);
      setShufflePhase(0);
      setShuffleCountdown(10);
      
      // Clear any existing timeouts from previous match
      if (cancellationTimeoutId) {
        clearTimeout(cancellationTimeoutId);
        setCancellationTimeoutId(null);
      }
      if (fallbackRedirectTimeoutRef.current) {
        clearTimeout(fallbackRedirectTimeoutRef.current);
        fallbackRedirectTimeoutRef.current = null;
      }
      
      // Store map vote options
      if (data.mapVoteOptions) {
        setMapVoteOptions(data.mapVoteOptions);
        mapVoteOptionsRef.current = data.mapVoteOptions;
        setMapVoteCountdown(15);
        setSelectedMapIndex(null);
        setSelectedMap(null);
        console.log('[RankedMode] Map vote options stored:', data.mapVoteOptions);
      }
      
      // Initialize roster selection state if applicable (test matches)
      if (data.hasRosterSelection && data.rosterSelection) {
        console.log('[RankedMode] Roster selection active:', data.rosterSelection);
        console.log('[RankedMode] isYourTurn from server:', data.rosterSelection.isYourTurn);
        setRosterSelection({
          isActive: true,
          currentTurn: data.rosterSelection.currentTurn || 1,
          team1Referent: data.rosterSelection.team1Referent,
          team2Referent: data.rosterSelection.team2Referent,
          team2ReferentInfo: data.rosterSelection.team2ReferentInfo || null, // Bot referent info
          availablePlayers: data.rosterSelection.availablePlayers || [],
          team1Players: data.rosterSelection.team1Players || [], // Staff déjà dans l'équipe 1
          team2Players: data.rosterSelection.team2Players || [], // Bot référent déjà dans l'équipe 2
          timeRemaining: data.rosterSelection.timeRemaining || 10,
          totalPlayersToSelect: data.rosterSelection.totalPlayersToSelect || 0,
          totalPicks: 0,
          // Utiliser les flags du serveur
          isYourTurn: data.rosterSelection.isYourTurn || false,
          isTeam1Referent: data.rosterSelection.isTeam1Referent || false,
          isTeam2Referent: data.rosterSelection.isTeam2Referent || false
        });
        setRosterSelectionCountdown(data.rosterSelection.timeRemaining || 10);
      }
      
      // Show shuffle animation before navigating
      if (data.players && data.players.length > 0) {
        // Store matchId in ref for socket listeners
        currentMatchIdRef.current = data.matchId;
        
        setShuffleMatchData({
          ...data,
          isTestMatch: data.isTestMatch || false, // Store test match flag
          hasRosterSelection: data.hasRosterSelection || false // Store roster selection flag
        });
        setShuffledPlayers(data.players.map((p, i) => ({ ...p, shuffleIndex: i })));
        
        // For test matches with roster selection, skip shuffle and go directly to roster selection
        if (data.hasRosterSelection && data.rosterSelection) {
          setShufflePhase(5); // Go directly to roster selection
          console.log('[RankedMode] Test match with roster selection - skipping shuffle, going to phase 5');
        } else {
          setShufflePhase(0); // Normal shuffle animation
        }
        setShowShuffleAnimation(true);
      } else {
        // No player data, navigate directly
        stopMatchFoundSound();
        navigate(`/ranked/match/${data.matchId}`);
      }
    });
    
    // Listen for map vote updates
    const unsubMapVote = on('mapVoteUpdate', (data) => {
      console.log('[RankedMode] Map vote update:', data);
      if (data.mapVoteOptions) {
        setMapVoteOptions(data.mapVoteOptions);
      }
    });
    
    // Listen for final map selection
    const unsubMapSelected = on('mapSelected', (data) => {
      console.log('[RankedMode] Map selected:', data);
      if (data.selectedMap) {
        setSelectedMap(data.selectedMap);
        // Map selected by server means 20-second window has passed - redirect immediately
        setShowCancellationButton(false);
        // Clear fallback timeout since we're redirecting now
        if (fallbackRedirectTimeoutRef.current) {
          clearTimeout(fallbackRedirectTimeoutRef.current);
          fallbackRedirectTimeoutRef.current = null;
        }
        console.log('[RankedMode] Map finalized, redirecting to match sheet');
        stopMatchFoundSound();
        setShowShuffleAnimation(false);
        navigate(`/ranked/match/${data.matchId}`);
      }
    });
    
    // Listen for cancellation vote updates during map vote
    const unsubCancellationVote = on('cancellationVoteUpdate', (data) => {
      console.log('[RankedMode] Cancellation vote update:', data);
      if (data.matchId === currentMatchIdRef.current) {
        setMapVoteCancellation({
          currentVotes: data.currentVotes || 0,
          requiredVotes: data.requiredVotes || 0,
          hasVoted: data.votedBy === user?.id,
          isActive: data.currentVotes > 0
        });
        
        // Si le match est annulé, fermer l'animation
        if (data.isCancelled) {
          // Clear fallback timeout
          if (fallbackRedirectTimeoutRef.current) {
            clearTimeout(fallbackRedirectTimeoutRef.current);
            fallbackRedirectTimeoutRef.current = null;
          }
          stopMatchFoundSound();
          setShowShuffleAnimation(false);
          setMatchmakingError(language === 'fr' ? 'Match annulé par vote des joueurs.' : 'Match cancelled by player vote.');
          setTimeout(() => setMatchmakingError(null), 5000);
        }
      }
    });
    
    // Listen for roster selection updates (test matches)
    const unsubRosterUpdate = on('rosterSelectionUpdate', (data) => {
      console.log('[RankedMode] Roster selection update received:', data);
      console.log('[RankedMode] isYourTurn from server:', data.isYourTurn);
      if (data.matchId?.toString() === currentMatchIdRef.current?.toString()) {
        setRosterSelection(prev => {
          const newState = {
            ...prev,
            team1Referent: data.team1Referent || prev.team1Referent,
            team2Referent: data.team2Referent || prev.team2Referent,
            currentTurn: data.currentTurn,
            availablePlayers: data.availablePlayers || [],
            team1Players: data.team1Players || prev.team1Players,
            team2Players: data.team2Players || prev.team2Players,
            timeRemaining: data.timeRemaining || 10,
            totalPicks: data.totalPicks || prev.totalPicks,
            // IMPORTANT: Utiliser le flag isYourTurn calculé par le serveur
            isYourTurn: data.isYourTurn || false,
            isTeam1Referent: data.isTeam1Referent || false,
            isTeam2Referent: data.isTeam2Referent || false
          };
          console.log('[RankedMode] Setting new rosterSelection state, isYourTurn:', newState.isYourTurn);
          return newState;
        });
        setRosterSelectionCountdown(data.timeRemaining || 10);
      } else {
        console.log('[RankedMode] Match ID mismatch, ignoring update');
      }
    });
    
    // Listen for roster selection completion
    const unsubRosterComplete = on('rosterSelectionComplete', (data) => {
      console.log('[RankedMode] Roster selection complete:', data);
      if (data.matchId?.toString() === currentMatchIdRef.current?.toString()) {
        setRosterSelection(prev => ({
          ...prev,
          isActive: false,
          team1Players: data.team1Players || prev.team1Players,
          team2Players: data.team2Players || prev.team2Players
        }));
        
        // Store voice channels for display during map vote
        if (data.team1VoiceChannel || data.team2VoiceChannel) {
          setVoiceChannels({
            team1: data.team1VoiceChannel,
            team2: data.team2VoiceChannel,
            myTeam: data.yourTeam
          });
          console.log('[RankedMode] Voice channels received:', data.team1VoiceChannel, data.team2VoiceChannel, 'myTeam:', data.yourTeam);
        }
        
        // Update map vote options if provided
        if (data.mapVoteOptions) {
          setMapVoteOptions(data.mapVoteOptions);
          mapVoteOptionsRef.current = data.mapVoteOptions;
        }
        
        // Transition to map vote phase
        setMapVoteCountdown(15);
        setShufflePhase(4);
        console.log('[RankedMode] Roster selection complete, transitioning to map vote');
        
        // Fallback redirect at 25 seconds
        fallbackRedirectTimeoutRef.current = setTimeout(() => {
          console.log('[RankedMode] Fallback redirect - mapSelected not received');
          stopMatchFoundSound();
          setShowShuffleAnimation(false);
          navigate(`/ranked/match/${currentMatchIdRef.current}`);
        }, 25000);
      }
    });
    
    return () => {
      unsubQueue();
      unsubMatch();
      unsubMapVote();
      unsubMapSelected();
      unsubCancellationVote();
      unsubRosterUpdate();
      unsubRosterComplete();
      // Quitter la room du match si on était dedans
      if (currentMatchIdRef.current) {
        leaveRankedMatch(currentMatchIdRef.current);
      }
    };
  }, [isAuthenticated, isConnected, on, navigate, joinRankedMatch, leaveRankedMatch]);

  // Listen for global queue count (for all users viewing the page)
  useEffect(() => {
    if (!isConnected) return;
    
    const unsubGlobalQueue = on('rankedGlobalQueueCount', (data) => {
      if (data.mode === selectedMode) {
        setGlobalQueueCount(data.count);
      }
    });
    
    return () => { unsubGlobalQueue(); };
  }, [isConnected, selectedMode, on]);

  // Listen for staff queue updates (admin only)
  useEffect(() => {
    if (!isConnected || !isAdmin) return;
    
    const unsubStaffQueue = on('staffQueueUpdate', (data) => {
      if (data.type === 'queue_status') {
        setStaffQueueSize(data.queueSize);
        setStaffQueuePlayers(data.players || []);
        setStaffQueueTimerActive(data.timerActive);
        setStaffQueueTimerEndTime(data.timerEndTime);
      }
    });
    
    return () => { unsubStaffQueue(); };
  }, [isConnected, isAdmin, on]);
  
  // Fetch staff queue status when admin enables staff mode
  useEffect(() => {
    if (staffQueueMode && isAdmin) {
      fetchStaffQueueStatus();
    }
  }, [staffQueueMode, isAdmin, selectedGameMode, selectedMode]);

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
        setShuffleCountdown(5);
        setShufflePhase(3);
      }, 1500);
      return () => clearTimeout(timer);
    }

    // Phase 3: Countdown 5 seconds then go to roster selection (test matches) or map vote
    if (shufflePhase === 3) {
      if (shuffleCountdown <= 0) {
        // Check if this is a test match with roster selection
        if (shuffleMatchData.hasRosterSelection && rosterSelection.isActive) {
          console.log('[RankedMode] Phase 3 complete, transitioning to roster selection (phase 5)');
          setRosterSelectionCountdown(10);
          setShufflePhase(5);
          return;
        }
        
        // Otherwise, transition to map vote phase if maps available (use ref for latest value)
        console.log('[RankedMode] Phase 3 complete, checking maps:', mapVoteOptionsRef.current);
        if (mapVoteOptionsRef.current.length > 0) {
          setMapVoteCountdown(15);
          setShufflePhase(4);
          console.log('[RankedMode] Transitioning to phase 4 (map vote)');
          
          // Start 20-second timeout for cancellation button
          const timeoutId = setTimeout(() => {
            setShowCancellationButton(false);
            console.log('[RankedMode] 20 seconds cancellation window ended');
            // Don't redirect here - wait for mapSelected event from backend
            // The backend will finalize the map and send mapSelected at 30 seconds total
          }, 20000);
          setCancellationTimeoutId(timeoutId);
          
          // Fallback redirect at 25 seconds in case mapSelected event doesn't arrive
          fallbackRedirectTimeoutRef.current = setTimeout(() => {
            console.log('[RankedMode] Fallback redirect - mapSelected not received');
            stopMatchFoundSound();
            setShowShuffleAnimation(false);
            navigate(`/ranked/match/${shuffleMatchData.matchId}`);
          }, 25000);
        } else {
          // No maps, navigate directly
          console.log('[RankedMode] No maps available, navigating to match sheet');
          stopMatchFoundSound();
          setShowShuffleAnimation(false);
          navigate(`/ranked/match/${shuffleMatchData.matchId}`);
        }
        return;
      }
      const timer = setTimeout(() => {
        setShuffleCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
    
    // Phase 5: Roster selection (10 seconds per turn) - only for test matches
    if (shufflePhase === 5) {
      // Server handles the timer and will send rosterSelectionUpdate or rosterSelectionComplete events
      // We just update the countdown locally for display
      if (rosterSelectionCountdown <= 0) {
        // Timer expired - server will handle random pick and send update
        return;
      }
      const timer = setTimeout(() => {
        setRosterSelectionCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
    
    // Phase 4: Map vote (15 seconds)
    if (shufflePhase === 4) {
      // If map is already selected (from server), wait for navigation via mapSelected event
      if (selectedMap) {
        return;
      }
      
      if (mapVoteCountdown <= 0) {
        // Time's up - server will handle final selection
        return;
      }
      const timer = setTimeout(() => {
        setMapVoteCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [showShuffleAnimation, shuffleMatchData, shufflePhase, shuffleCountdown, mapVoteOptions, mapVoteCountdown, selectedMap, rosterSelection, rosterSelectionCountdown, navigate]);

  // Handle roster pick (for test matches)
  const handleRosterPick = (playerId) => {
    if (shuffleMatchData?.matchId && playerId && rosterSelection.isActive) {
      emit('rosterPick', { matchId: shuffleMatchData.matchId, playerId });
      console.log('[RankedMode] Picked player:', playerId);
    }
  };

  // Handle map vote
  const handleMapVote = (mapIndex) => {
    if (shuffleMatchData?.matchId && mapIndex !== selectedMapIndex) {
      setSelectedMapIndex(mapIndex);
      emit('mapVote', { matchId: shuffleMatchData.matchId, mapIndex });
      console.log('[RankedMode] Voted for map:', mapVoteOptions[mapIndex]?.name);
      // Don't hide cancellation button or redirect - wait for the 20-second window to complete
    }
  };
  
  // Handle map vote cancellation toggle
  const handleToggleMapVoteCancellation = async () => {
    if (!shuffleMatchData?.matchId || votingCancellation) return;
    setVotingCancellation(true);
    try {
      const response = await fetch(`${API_URL}/ranked-matches/${shuffleMatchData.matchId}/cancellation/vote`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setMapVoteCancellation({
          currentVotes: data.currentVotes || 0,
          requiredVotes: data.requiredVotes || 0,
          hasVoted: data.hasVoted || false,
          isActive: data.currentVotes > 0
        });
        
        // Si le match est annulé, fermer l'animation et rediriger
        if (data.isCancelled) {
          // Clear fallback timeout
          if (fallbackRedirectTimeoutRef.current) {
            clearTimeout(fallbackRedirectTimeoutRef.current);
            fallbackRedirectTimeoutRef.current = null;
          }
          stopMatchFoundSound();
          setShowShuffleAnimation(false);
          // Rediriger vers la page du mode classé
          setMatchmakingError(language === 'fr' ? 'Match annulé par vote des joueurs.' : 'Match cancelled by player vote.');
          setTimeout(() => setMatchmakingError(null), 5000);
        }
      }
    } catch (err) {
      console.error('Error toggling map vote cancellation:', err);
    } finally {
      setVotingCancellation(false);
    }
  };

  // Cleanup timeouts when component unmounts or animation ends
  useEffect(() => {
    return () => {
      if (cancellationTimeoutId) {
        clearTimeout(cancellationTimeoutId);
      }
      if (fallbackRedirectTimeoutRef.current) {
        clearTimeout(fallbackRedirectTimeoutRef.current);
        fallbackRedirectTimeoutRef.current = null;
      }
    };
  }, [cancellationTimeoutId]);

  // Fetch leaderboard when page changes (only after season is loaded)
  useEffect(() => {
    if (!seasonLoaded) return;
    fetchLeaderboard(leaderboardPage);
  }, [leaderboardPage, selectedMode, seasonLoaded]);

  // Handle leaderboard page change
  const handleLeaderboardPageChange = (newPage) => {
    if (newPage >= 1 && newPage <= leaderboardTotalPages) {
      setLeaderboardPage(newPage);
    }
  };

  // Initial load
  useEffect(() => {
    setSeasonLoaded(false);
    fetchMyRanking();
    fetchActiveMatchesStats();
    fetchMatchmakingStatus();
    fetchRankThresholds(); // Fetch dynamic rank thresholds from config (sets seasonLoaded)
    fetchRankedRewards(); // Fetch ranked rewards per game mode
    fetchSeasonRewardsInfo(); // Fetch season rewards info and countdown
    if (isAuthenticated) {
      checkActiveMatch();
      fetchQueueStatus();
      fetchBoosters(); // Fetch available and active boosters
      if (user?.platform === 'PC') checkGGSecure();
    }
    
    // Refresh active matches stats every 30 seconds
    const statsInterval = setInterval(fetchActiveMatchesStats, 30000);
    return () => clearInterval(statsInterval);
  }, [isAuthenticated, selectedMode, selectedGameMode]);

  // Fetch calculated stats and leaderboard AFTER season is loaded (uses currentSeason for filtering)
  useEffect(() => {
    if (!seasonLoaded || !currentSeason) return;
    fetchCalculatedStats(currentSeason);
    fetchLeaderboard(leaderboardPage);
  }, [seasonLoaded, isAuthenticated, selectedMode, currentSeason]);

  // Check active match when user becomes available (after login or page load)
  useEffect(() => {
    if (isAuthenticated && user) {
      checkActiveMatch();
    }
  }, [user, isAuthenticated]);

  // Show dialog when active match is detected
  useEffect(() => {
    if (activeMatch && activeMatch._id) {
      // Check if we've already shown the dialog for this match in this session
      const shownMatchId = sessionStorage.getItem('shownMatchDialog');
      
      if (shownMatchId !== activeMatch._id) {
        // Save the match info and show dialog
        setSavedActiveMatch(activeMatch);
        setShowActiveMatchDialog(true);
        // Mark this match as shown in session
        sessionStorage.setItem('shownMatchDialog', activeMatch._id);
      }
    } else if (!activeMatch) {
      // Clear the session storage when there's no active match
      sessionStorage.removeItem('shownMatchDialog');
    }
  }, [activeMatch]);

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
      playersSearching: 'joueur(s) en recherche',
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
      // Staff test queue translations
      staffTestQueue: 'File de test Admin',
      staffQueueMode: 'Mode file test',
      normalQueueMode: 'File normale',
      joinStaffQueue: 'Rejoindre la file',
      addBot: 'Ajouter un bot',
      addBots: 'Ajouter des bots',
      clearBots: 'Supprimer les bots',
      forceStart: 'Forcer le démarrage',
      botsInQueue: 'bot(s) dans la file',
      staffQueueInfo: 'File test pour tester le matchmaking avec des bots',
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
      seasonLaunch: '(Lancement)',
      requestCancellation: 'Demander l\'annulation',
      cancellationVotes: 'Votes pour annuler',
      cancelMatch: 'Annuler le match',
      removeVote: 'Retirer le vote',
      votesRequired: 'votes requis',
      voteForMap: 'Votez pour une map',
      usableItems: 'Objets utilisables',
      noUsableItems: 'Aucun objet disponible',
      activate: 'Activer',
      active: 'Actif',
      expiresIn: 'Expire dans',
      boosterActive: 'Booster actif !',
      matchRewards: 'Récompenses par match',
      winRewards: 'En cas de victoire',
      lossRewards: 'En cas de défaite',
      goldReward: 'Gold',
      xpReward: 'XP',
      ptsReward: 'Points',
      seasonTrophies: 'Trophées de fin de saison',
      seasonEndsIn: 'Fin de saison dans',
      seasonRewards: 'Récompenses de fin de saison',
      goldRewardsTop5: 'Récompenses Gold (Top 5)',
      trophyRewards: 'Trophées de rang',
      andAbove: 'et plus',
      leaderboardUpdateNotice: 'Le classement est mis à jour toutes les 15 minutes',
      activeMatchFound: 'Match en cours détecté',
      activeMatchFoundDesc: 'Vous avez un match en cours. Voulez-vous rejoindre la feuille de match ?',
      joinMatchSheet: 'Rejoindre le match',
      stayOnPage: 'Rester sur la page',
      matchMode: 'Mode'
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
      playersSearching: 'player(s) searching',
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
      // Staff test queue translations
      staffTestQueue: 'Admin Test Queue',
      staffQueueMode: 'Test queue mode',
      normalQueueMode: 'Normal queue',
      joinStaffQueue: 'Join queue',
      addBot: 'Add a bot',
      addBots: 'Add bots',
      clearBots: 'Clear bots',
      forceStart: 'Force start',
      botsInQueue: 'bot(s) in queue',
      staffQueueInfo: 'Test queue to test matchmaking with bots',
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
      seasonLaunch: '(Launch)',
      requestCancellation: 'Request Cancellation',
      cancellationVotes: 'Cancellation Votes',
      cancelMatch: 'Cancel Match',
      removeVote: 'Remove Vote',
      votesRequired: 'votes required',
      voteForMap: 'Vote for a map',
      usableItems: 'Usable Items',
      noUsableItems: 'No items available',
      activate: 'Activate',
      active: 'Active',
      expiresIn: 'Expires in',
      boosterActive: 'Booster active!',
      matchRewards: 'Match Rewards',
      winRewards: 'On victory',
      lossRewards: 'On defeat',
      goldReward: 'Gold',
      xpReward: 'XP',
      ptsReward: 'Points',
      seasonTrophies: 'End of Season Trophies',
      seasonEndsIn: 'Season ends in',
      seasonRewards: 'Season End Rewards',
      goldRewardsTop5: 'Gold Rewards (Top 5)',
      trophyRewards: 'Rank Trophies',
      andAbove: 'and above',
      leaderboardUpdateNotice: 'Leaderboard is updated every 15 minutes',
      activeMatchFound: 'Active Match Detected',
      activeMatchFoundDesc: 'You have an active match. Do you want to join the match sheet?',
      joinMatchSheet: 'Join Match',
      stayOnPage: 'Stay on Page',
      matchMode: 'Mode'
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
      playersSearching: 'Spieler in der Suche',
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
      seasonLaunch: '(Start)',
      requestCancellation: 'Abbruch anfordern',
      cancellationVotes: 'Abbruchstimmen',
      cancelMatch: 'Match abbrechen',
      removeVote: 'Stimme entfernen',
      votesRequired: 'Stimmen erforderlich',
      voteForMap: 'Für eine Karte stimmen',
      usableItems: 'Verwendbare Gegenstände',
      noUsableItems: 'Keine Gegenstände verfügbar',
      activate: 'Aktivieren',
      active: 'Aktiv',
      expiresIn: 'Läuft ab in',
      boosterActive: 'Booster aktiv!',
      matchRewards: 'Match-Belohnungen',
      winRewards: 'Bei Sieg',
      lossRewards: 'Bei Niederlage',
      goldReward: 'Gold',
      xpReward: 'XP',
      ptsReward: 'Punkte',
      seasonTrophies: 'Saisonende-Trophäen',
      seasonEndsIn: 'Saison endet in',
      seasonRewards: 'Saisonende-Belohnungen',
      goldRewardsTop5: 'Gold-Belohnungen (Top 5)',
      trophyRewards: 'Rang-Trophäen',
      andAbove: 'und höher',
      leaderboardUpdateNotice: 'Die Bestenliste wird alle 15 Minuten aktualisiert',
      activeMatchFound: 'Aktives Spiel erkannt',
      activeMatchFoundDesc: 'Sie haben ein aktives Spiel. Möchten Sie dem Match-Blatt beitreten?',
      joinMatchSheet: 'Spiel beitreten',
      stayOnPage: 'Auf der Seite bleiben',
      matchMode: 'Modus'
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
      playersSearching: 'giocatore(i) in ricerca',
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
      seasonLaunch: '(Lancio)',
      requestCancellation: 'Richiedi annullamento',
      cancellationVotes: 'Voti per annullamento',
      cancelMatch: 'Annulla partita',
      removeVote: 'Rimuovi voto',
      votesRequired: 'voti richiesti',
      voteForMap: 'Vota per una mappa',
      usableItems: 'Oggetti utilizzabili',
      noUsableItems: 'Nessun oggetto disponibile',
      activate: 'Attiva',
      active: 'Attivo',
      expiresIn: 'Scade tra',
      boosterActive: 'Booster attivo!',
      matchRewards: 'Ricompense partita',
      winRewards: 'In caso di vittoria',
      lossRewards: 'In caso di sconfitta',
      goldReward: 'Gold',
      xpReward: 'XP',
      ptsReward: 'Punti',
      seasonTrophies: 'Trofei di fine stagione',
      seasonEndsIn: 'Stagione termina tra',
      seasonRewards: 'Ricompense di fine stagione',
      goldRewardsTop5: 'Ricompense Gold (Top 5)',
      trophyRewards: 'Trofei di grado',
      andAbove: 'e superiori',
      leaderboardUpdateNotice: 'La classifica viene aggiornata ogni 15 minuti',
      activeMatchFound: 'Partita attiva rilevata',
      activeMatchFoundDesc: 'Hai una partita in corso. Vuoi unirti al foglio partita?',
      joinMatchSheet: 'Unisciti alla partita',
      stayOnPage: 'Rimani sulla pagina',
      matchMode: 'Modalità'
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
                  <div className="flex items-baseline gap-2">
                    <span 
                      className={`text-2xl sm:text-4xl font-black tracking-tight bg-gradient-to-r ${isHardcore ? 'from-orange-400 via-yellow-200 via-white to-red-400' : 'from-cyan-400 via-white via-cyan-200 to-blue-400'} bg-clip-text text-transparent animate-text-shimmer`}
                    >
                      {language === 'fr' ? `Saison ${currentSeason}` : language === 'en' ? `Season ${currentSeason}` : language === 'de' ? `Staffel ${currentSeason}` : `Stagione ${currentSeason}`}
                    </span>
                  </div>
                  <span className={`text-[10px] sm:text-xs uppercase tracking-widest ${isHardcore ? 'text-orange-400/70' : 'text-cyan-400/70'} font-semibold`}>
                    {language === 'fr' ? 'En cours' : language === 'en' ? 'In Progress' : language === 'it' ? 'In Corso' : 'Läuft'}
                  </span>
                </div>
              </div>
              
              {/* Season Countdown */}
              {countdownText && (
                <div className="mt-3">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-800/60 border ${isHardcore ? 'border-orange-500/20' : 'border-cyan-500/20'} backdrop-blur-sm`}>
                    <Clock className={`w-4 h-4 ${isHardcore ? 'text-orange-400' : 'text-cyan-400'}`} />
                    <span className="text-gray-400 text-xs sm:text-sm">{t.seasonEndsIn}:</span>
                    <span className={`font-mono font-bold text-sm sm:text-base ${isHardcore ? 'text-orange-400' : 'text-cyan-400'}`}>
                      {countdownText}
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Active Event Banner */}
            {(activeEvents.doubleXP || activeEvents.doubleGold) && (
              <div className="relative overflow-hidden mx-auto max-w-md mb-4">
                <div className={`relative rounded-xl border ${activeEvents.doubleXP && activeEvents.doubleGold ? 'bg-gradient-to-r from-purple-500/20 via-yellow-500/20 to-purple-500/20 border-purple-500/30' : activeEvents.doubleXP ? 'bg-gradient-to-r from-purple-500/20 via-purple-600/20 to-purple-500/20 border-purple-500/30' : 'bg-gradient-to-r from-yellow-500/20 via-amber-500/20 to-yellow-500/20 border-yellow-500/30'} p-3 overflow-hidden`}>
                  {/* Animated background shimmer */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                  
                  {/* Sparkles decoration */}
                  <div className="absolute top-1 left-2 animate-pulse"><Sparkles className="w-3 h-3 text-white/30" /></div>
                  <div className="absolute bottom-1 right-2 animate-pulse" style={{ animationDelay: '0.5s' }}><Sparkles className="w-3 h-3 text-white/30" /></div>
                  
                  <div className="relative flex items-center justify-center gap-3">
                    {activeEvents.doubleXP && (
                      <div className="flex items-center gap-2 animate-pulse">
                        <div className="p-1.5 rounded-lg bg-purple-500/30">
                          <Zap className="w-4 h-4 text-purple-400" />
                        </div>
                        <div className="text-center">
                          <span className="text-purple-400 font-black text-lg">x2</span>
                          <span className="text-purple-300 font-bold text-sm ml-1">
                            {{ fr: 'POINTS', en: 'POINTS', de: 'PUNKTE', it: 'PUNTI' }[language] || 'POINTS'}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {activeEvents.doubleXP && activeEvents.doubleGold && (
                      <div className="w-px h-6 bg-white/20" />
                    )}
                    
                    {activeEvents.doubleGold && (
                      <div className="flex items-center gap-2 animate-pulse" style={{ animationDelay: '0.3s' }}>
                        <div className="p-1.5 rounded-lg bg-yellow-500/30">
                          <Coins className="w-4 h-4 text-yellow-400" />
                        </div>
                        <div className="text-center">
                          <span className="text-yellow-400 font-black text-lg">x2</span>
                          <span className="text-yellow-300 font-bold text-sm ml-1">GOLD</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-center text-[10px] text-white/50 mt-1 relative">
                    {{ fr: '🎉 Événement en cours !', en: '🎉 Event active!', de: '🎉 Event aktiv!', it: '🎉 Evento attivo!' }[language] || '🎉 Event active!'}
                  </p>
                </div>
              </div>
            )}
            
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
                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
                      {/* Left: Rank Badge with glow */}
                      <div className="relative flex-shrink-0">
                        {/* Animated glow ring */}
                        <div 
                          className="absolute -inset-3 rounded-full opacity-30 blur-xl"
                          style={{ 
                            background: `radial-gradient(circle, ${playerRank.color} 0%, transparent 70%)`
                          }}
                        />
                        {/* Logo container with border */}
                        <div 
                          className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-2xl flex items-center justify-center"
                          style={{
                            background: `linear-gradient(145deg, ${playerRank.color}15, transparent)`,
                            border: `2px solid ${playerRank.color}40`
                          }}
                        >
                          <img 
                            src={playerRank.image} 
                            alt={playerRank.name}
                            className="w-16 h-16 sm:w-24 sm:h-24 object-contain" 
                            style={{ filter: `drop-shadow(0 4px 12px ${playerRank.color}50)` }}
                          />
                        </div>
                        {/* Division badge */}
                        <div 
                          className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg"
                          style={{ 
                            background: `linear-gradient(135deg, ${playerRank.color}, ${playerRank.color}CC)`,
                            boxShadow: `0 4px 12px ${playerRank.color}40`
                          }}
                        >
                          <span className="text-xs font-bold text-white">{playerRank.tier}</span>
                        </div>
                      </div>

                      {/* Center: Rank Info */}
                      <div className="flex-1 text-center sm:text-left">
                        <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">{t.yourRank}</p>
                        <h2 className="text-3xl sm:text-4xl font-black mb-1" style={{ color: playerRank.color }}>{playerRank.name}</h2>
                        <p className="text-gray-400 text-sm">
                          #{myRanking.rank} • <span className={`text-${accent}-400 font-bold`}>{myRanking.points} pts</span>
                        </p>
                      </div>

                      {/* Right: Stats */}
                      <div className="flex items-center gap-6 sm:gap-8">
                        <div className="text-center">
                          <p className="text-2xl sm:text-3xl font-black text-green-400">{calculatedStats.wins}</p>
                          <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">{t.wins}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl sm:text-3xl font-black text-red-400">{calculatedStats.losses}</p>
                          <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">{t.losses}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl sm:text-3xl font-black text-yellow-400">
                            {calculatedStats.total > 0 
                              ? Math.round((calculatedStats.wins / calculatedStats.total) * 100) 
                              : 0}%
                          </p>
                          <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">{t.winRate}</p>
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
                          <div className="w-full mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10">
                            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                              <span className="text-xs sm:text-sm text-gray-400">{language === 'fr' ? 'Rang Maximum Atteint' : 'Maximum Rank Achieved'}</span>
                              <span className="text-xs sm:text-sm font-bold" style={{ color: currentRank.color }}>🏆 Champion</span>
                            </div>
                            <div className="relative h-2 sm:h-3 rounded-full overflow-hidden bg-dark-700">
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
                        <div className="w-full mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10">
                          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <span className="text-xs sm:text-sm text-gray-400">{language === 'fr' ? 'Prochain rang:' : 'Next rank:'}</span>
                              <span className="text-xs sm:text-sm font-bold" style={{ color: nextRank.color }}>{nextRank.name}</span>
                            </div>
                            <span className="text-xs sm:text-sm text-gray-400">
                              <span className="font-bold" style={{ color: nextRank.color }}>{pointsToNextRank}</span> {language === 'fr' ? 'pts restants' : 'pts left'}
                            </span>
                          </div>
                          <div className="relative h-2 sm:h-3 rounded-full overflow-hidden bg-dark-700">
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
                            <span className="text-[10px] sm:text-xs text-gray-500">{currentRank.min} pts</span>
                            <span className="text-[10px] sm:text-xs text-gray-500">{nextRank.min} pts</span>
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
                  // HARDCORE: S&D only
                  <div className="flex justify-center">
                    {/* Search & Destroy - Available */}
                    <button
                      onClick={() => setSelectedGameMode('Search & Destroy')}
                      className={`relative p-4 rounded-2xl border-2 transition-all w-full max-w-xs ${
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
                
                {/* Récompenses pour le mode sélectionné - Compact */}
                {rankedRewardsPerMode[selectedGameMode] && (
                  <div className="mt-4">
                    {/* Active boosters indicator */}
                    {activeBoosters.length > 0 && (
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <Zap className="w-3 h-3 text-purple-400" />
                        <span className="text-[10px] text-purple-400 font-medium">
                          {language === 'fr' ? 'Boost actif :' : 'Active boost:'}
                        </span>
                        {activeBoosters.map((b, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                            {b.effectType === 'double_gold' ? '💰 x2 Gold' : b.effectType === 'double_pts' ? '⚡ x2 Pts' : '✨ x2 XP'}
                            <span className="text-purple-400/70 ml-1">({b.remainingMatches} match{b.remainingMatches > 1 ? 's' : ''})</span>
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {/* Rewards row */}
                    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-dark-800/80 border border-white/5">
                      <span className="text-gray-400 text-xs font-medium">
                        {language === 'fr' ? 'Victoire' : 'Win'}
                      </span>
                      <div className="flex items-center gap-4">
                        {/* Points */}
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                          <span className={`text-sm font-bold ${(activeEvents.doubleXP || activeBoosters.some(b => b.effectType === 'double_pts')) ? 'text-green-300' : 'text-green-400'}`}>
                            +{(activeEvents.doubleXP || activeBoosters.some(b => b.effectType === 'double_pts')) 
                              ? (rankedRewardsPerMode[selectedGameMode]?.pointsWin ?? 0) * 2 
                              : (rankedRewardsPerMode[selectedGameMode]?.pointsWin ?? 0)}
                          </span>
                          {(activeEvents.doubleXP || activeBoosters.some(b => b.effectType === 'double_pts')) && (
                            <span className="text-[9px] text-green-400 font-bold">x2</span>
                          )}
                        </div>
                        
                        <div className="w-px h-4 bg-white/10" />
                        
                        {/* Gold */}
                        <div className="flex items-center gap-1.5">
                          <Coins className="w-3.5 h-3.5 text-yellow-400" />
                          <span className={`text-sm font-bold ${(activeEvents.doubleGold || activeBoosters.some(b => b.effectType === 'double_gold')) ? 'text-yellow-300' : 'text-yellow-400'}`}>
                            +{(activeEvents.doubleGold || activeBoosters.some(b => b.effectType === 'double_gold')) 
                              ? (rankedRewardsPerMode[selectedGameMode]?.coinsWin ?? 0) * 2 
                              : (rankedRewardsPerMode[selectedGameMode]?.coinsWin ?? 0)}
                          </span>
                          {(activeEvents.doubleGold || activeBoosters.some(b => b.effectType === 'double_gold')) && (
                            <span className="text-[9px] text-yellow-400 font-bold">x2</span>
                          )}
                        </div>
                        
                        <div className="w-px h-4 bg-white/10" />
                        
                        {/* XP */}
                        <div className="flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="text-sm font-bold text-cyan-400">
                            {rankedRewardsPerMode[selectedGameMode]?.xpWinMin ?? 0}-{rankedRewardsPerMode[selectedGameMode]?.xpWinMax ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>
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
                
                {/* Bouton Maps disponibles */}
                <button
                  onClick={() => {
                    fetchAvailableMaps();
                    setShowMapsModal(true);
                  }}
                  className={`mt-2 w-full py-3 rounded-xl border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 transition-all flex items-center justify-center gap-2`}
                >
                  <Map className="w-5 h-5 text-green-400" />
                  <span className="text-green-400 font-semibold">
                    {language === 'fr' ? 'Maps disponibles' : 'Available Maps'}
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
                  {activeMatch && !activeMatch.isTestMatch && (() => {
                    const matchMode = activeMatch.mode || 'hardcore';
                    const isOtherMode = matchMode !== selectedMode;
                    const modeName = matchMode === 'cdl' ? 'CDL' : 'Hardcore';
                    
                    return (
                      <div className={`mb-4 p-4 rounded-2xl ${isOtherMode ? 'bg-purple-500/20 border border-purple-500/30' : 'bg-orange-500/20 border border-orange-500/30'} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
                        <div className="flex items-center gap-3">
                          <AlertTriangle className={`w-5 h-5 ${isOtherMode ? 'text-purple-400' : 'text-orange-400'}`} />
                          <div>
                            <span className={`${isOtherMode ? 'text-purple-300' : 'text-orange-300'} font-medium`}>
                              {t.activeMatch}
                            </span>
                            <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${matchMode === 'cdl' ? 'bg-cyan-500/30 text-cyan-300' : 'bg-red-500/30 text-red-300'}`}>
                              {modeName}
                            </span>
                            {isOtherMode && (
                              <p className="text-xs text-gray-400 mt-1">
                                {language === 'fr' ? 'Vous devez terminer ce match avant d\'en lancer un autre' : 'You must finish this match before starting another'}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (isOtherMode) {
                              // Switch to the match's mode first
                              selectMode(matchMode);
                            }
                            navigate(`/ranked/match/${activeMatch._id}`);
                          }}
                          className={`px-4 py-2 ${isOtherMode ? 'bg-purple-500 hover:bg-purple-600' : 'bg-orange-500 hover:bg-orange-600'} rounded-xl text-white font-semibold transition-colors whitespace-nowrap`}
                        >
                          {t.rejoin}
                        </button>
                      </div>
                    );
                  })()}

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
                            {[...Array(maxPlayers)].map((_, i) => (
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
                            {queueSize}<span className="text-gray-500 text-lg sm:text-xl">/{maxPlayers}</span>
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
                            style={{ width: `${(queueSize / maxPlayers) * 100}%` }}
                          >
                            {/* Shimmer effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                          </div>
                        </div>
                        {/* Milestone markers - 4v4 at 80% for Hardcore (8/10), 100% for CDL (8/8) */}
                        <div className="absolute top-0 left-0 w-full h-3 flex items-center">
                          {selectedMode === 'hardcore' && (
                            <div className="absolute left-[80%] w-0.5 h-full bg-white/20" title="4v4" />
                          )}
                        </div>
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

                      {/* Usable Items / Boosters Section */}
                      {isAuthenticated && (availableBoosters.length > 0 || activeBoosters.length > 0) && (
                        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-purple-500/10 border border-purple-500/20 mb-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Zap className="w-5 h-5 text-purple-400" />
                            <h4 className="text-white font-bold">{t.usableItems}</h4>
                          </div>
                          
                          {/* Active Boosters */}
                          {activeBoosters.length > 0 && (
                            <div className="mb-3 space-y-2">
                              {activeBoosters.map((booster) => (
                                <ActiveBoosterItem 
                                  key={booster.usageId} 
                                  booster={booster} 
                                  language={language} 
                                  t={t}
                                  onExpire={fetchBoosters}
                                />
                              ))}
                            </div>
                          )}
                          
                          {/* Available Boosters */}
                          {availableBoosters.length > 0 && (
                            <div className="space-y-2">
                              {availableBoosters.map((booster) => {
                                const isAlreadyActive = activeBoosters.some(ab => ab.effectType === booster.item.effectType);
                                const isInMatch = activeMatch && !activeMatch.isTestMatch;
                                const isDisabled = activatingBooster === booster.purchaseId || isAlreadyActive || isInMatch;
                                
                                return (
                                  <div 
                                    key={booster.item._id}
                                    className={`flex items-center justify-between p-3 rounded-xl bg-dark-700/50 border transition-all ${
                                      isAlreadyActive 
                                        ? 'border-orange-500/30 opacity-60' 
                                        : 'border-white/5 hover:border-purple-500/30'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`w-10 h-10 rounded-lg bg-${booster.item.color || 'purple'}-500/20 flex items-center justify-center`}>
                                        {booster.item.effectType === 'double_pts' ? (
                                          <Zap className="w-5 h-5 text-yellow-400" />
                                        ) : (
                                          <Coins className="w-5 h-5 text-amber-400" />
                                        )}
                                      </div>
                                      <div>
                                        <p className="text-white font-semibold text-sm">
                                          {booster.item?.nameTranslations?.[language] || booster.item?.name}
                                        </p>
                                        <p className="text-gray-400 text-xs">
                                          x{booster.quantity} • {booster.item.matchCount} match{booster.item.matchCount > 1 ? 's' : ''}
                                        </p>
                                      </div>
                                    </div>
                                    {isAlreadyActive ? (
                                      <span className="px-3 py-2 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-medium">
                                        {language === 'fr' ? 'Déjà actif' : 'Already active'}
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => activateBooster(booster.purchaseId)}
                                        disabled={isDisabled}
                                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                      >
                                        {activatingBooster === booster.purchaseId ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <>
                                            <Zap className="w-3 h-3" />
                                            {t.activate}
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
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

                      {/* Players in Matchmaking Counter */}
                      <div className="flex items-center justify-center gap-2 mb-4 py-3 px-4 rounded-xl bg-dark-800/50 border border-white/5">
                        <Users className={`w-5 h-5 text-${accent}-400`} />
                        <span className="text-gray-300 font-medium">
                          <span className={`text-${accent}-400 font-bold`}>{globalQueueCount}</span>
                          {' '}{t.playersSearching}
                        </span>
                      </div>

                      {/* Admin Staff Queue Toggle */}
                      {isAdmin && (
                        <div className="mb-4">
                          <div className="flex items-center justify-center gap-2 mb-3">
                            <button
                              onClick={() => setStaffQueueMode(false)}
                              className={`px-4 py-2 rounded-l-xl text-sm font-medium transition-all ${
                                !staffQueueMode
                                  ? 'bg-purple-500 text-white'
                                  : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                              }`}
                            >
                              {t.normalQueueMode}
                            </button>
                            <button
                              onClick={() => setStaffQueueMode(true)}
                              className={`px-4 py-2 rounded-r-xl text-sm font-medium transition-all ${
                                staffQueueMode
                                  ? 'bg-purple-500 text-white'
                                  : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                              }`}
                            >
                              {t.staffQueueMode}
                            </button>
                          </div>
                          
                          {staffQueueMode && (
                            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 space-y-3">
                              <div className="flex items-center gap-2 text-purple-400">
                                <Bot className="w-5 h-5" />
                                <span className="font-semibold">{t.staffTestQueue}</span>
                              </div>
                              <p className="text-gray-400 text-xs">{t.staffQueueInfo}</p>
                              
                              {/* Staff Queue Status */}
                              <div className="flex items-center justify-between p-3 rounded-xl bg-dark-800/50">
                                <span className="text-gray-300 text-sm">
                                  <span className="text-purple-400 font-bold">{staffQueueSize}</span>/{maxPlayers} {t.playersInQueue}
                                </span>
                                {staffQueueTimerActive && staffQueueTimerEndTime && (
                                  <span className="text-green-400 text-sm font-medium animate-pulse">
                                    {t.matchIn} {Math.max(0, Math.ceil((staffQueueTimerEndTime - Date.now()) / 1000))}s
                                  </span>
                                )}
                              </div>
                              
                              {/* Staff Queue Players List */}
                              {staffQueuePlayers.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {staffQueuePlayers.map((player, idx) => (
                                    <div 
                                      key={idx}
                                      className={`px-2 py-1 rounded-lg text-xs font-medium ${
                                        player.isFake 
                                          ? 'bg-gray-700 text-gray-400'
                                          : 'bg-purple-500/30 text-purple-300'
                                      }`}
                                    >
                                      {player.isFake && <Bot className="w-3 h-3 inline mr-1" />}
                                      {player.username}
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Staff Queue Actions */}
                              {!inStaffQueue ? (
                                <button
                                  onClick={joinStaffQueue}
                                  disabled={joiningStaffQueue || !!activeMatch}
                                  className="w-full py-3 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                  {joiningStaffQueue ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                  ) : (
                                    <>
                                      <Play className="w-5 h-5" />
                                      {t.joinStaffQueue}
                                    </>
                                  )}
                                </button>
                              ) : (
                                <div className="space-y-2">
                                  {/* Add Bots Buttons */}
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => addBotsToStaffQueue(1)}
                                      disabled={addingStaffBots || staffQueueSize >= 10}
                                      className="flex-1 py-2 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                                    >
                                      {addingStaffBots ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                                      +1 Bot
                                    </button>
                                    <button
                                      onClick={() => addBotsToStaffQueue(5)}
                                      disabled={addingStaffBots || staffQueueSize >= 10}
                                      className="flex-1 py-2 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                                    >
                                      {addingStaffBots ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                                      +5 Bots
                                    </button>
                                  </div>
                                  
                                  {/* Clear Bots & Force Start */}
                                  <div className="flex gap-2">
                                    <button
                                      onClick={clearStaffQueueBots}
                                      disabled={clearingStaffBots}
                                      className="flex-1 py-2 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-400 text-sm font-medium hover:bg-orange-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                                    >
                                      {clearingStaffBots ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                                      {t.clearBots}
                                    </button>
                                    <button
                                      onClick={forceStartStaffMatch}
                                      disabled={forcingStaffMatch || staffQueueSize < 8}
                                      className="flex-1 py-2 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                                    >
                                      {forcingStaffMatch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                      {t.forceStart}
                                    </button>
                                  </div>
                                  
                                  {/* Leave Queue */}
                                  <button
                                    onClick={leaveStaffQueue}
                                    disabled={leavingStaffQueue}
                                    className="w-full py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 font-semibold hover:bg-red-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                  >
                                    {leavingStaffQueue ? <Loader2 className="w-5 h-5 animate-spin" /> : <Square className="w-5 h-5" />}
                                    {t.cancel}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Find Match Button - Only show if not in staff queue mode */}
                      {(!isAdmin || !staffQueueMode) && (
                        <button
                          onClick={joinQueue}
                          disabled={joiningQueue || (activeMatch && !activeMatch.isTestMatch) || (user?.platform === 'PC' && ggsecureConnected === false) || (!matchmakingEnabled && !isStaffOrAdmin)}
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
                      )}
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
                
                <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2 relative z-10">
                  <Sparkles className={`w-5 h-5 text-${accent}-500 animate-pulse`} />
                  {t.ranks}
                </h3>
                
                <div className="space-y-1.5 relative z-10">
                  {/* Reverse ranks to show Champion at top, Bronze at bottom */}
                  {[...ranks].reverse().map((rank, index) => {
                    const isCurrentRank = myRanking && myRanking.points >= rank.min && myRanking.points <= rank.max;
                    const animationDelay = index * 0.05;
                    
                    return (
                      <div 
                        key={rank.name}
                        className={`group relative flex items-center gap-4 p-2.5 sm:p-3 rounded-xl transition-all duration-300 cursor-default ${
                          isCurrentRank 
                            ? 'border-2' 
                            : 'hover:bg-white/5'
                        }`}
                        style={{
                          borderColor: isCurrentRank ? rank.color : 'transparent',
                          background: isCurrentRank ? `linear-gradient(135deg, ${rank.color}20, ${rank.color}05)` : undefined,
                          boxShadow: isCurrentRank ? `0 0 25px ${rank.color}25, inset 0 0 20px ${rank.color}10` : undefined,
                          animation: `slideInRight 0.4s ease-out ${animationDelay}s both`
                        }}
                      >
                        {/* Rank image - BIGGER */}
                        <div className="relative flex-shrink-0">
                          <img 
                            src={rank.image}
                            alt={rank.name}
                            className="w-12 h-12 sm:w-14 sm:h-14 object-contain transition-transform duration-300 group-hover:scale-110"
                            style={{ 
                              filter: `drop-shadow(0 2px 8px ${rank.color}50)`
                            }}
                          />
                          {isCurrentRank && (
                            <div 
                              className="absolute inset-0 blur-lg opacity-40"
                              style={{ background: rank.color }}
                            />
                          )}
                        </div>
                        
                        {/* Rank info */}
                        <div className="flex-1 min-w-0">
                          <p 
                            className={`font-bold text-base sm:text-lg transition-colors truncate ${isCurrentRank ? '' : 'text-white group-hover:text-white'}`}
                            style={{ 
                              color: isCurrentRank ? rank.color : undefined,
                              textShadow: isCurrentRank ? `0 0 15px ${rank.color}60` : undefined
                            }}
                          >
                            {rank.name}
                          </p>
                          <p className="text-xs sm:text-sm text-gray-500">{rank.min} - {rank.max === 99999 ? '∞' : rank.max} pts</p>
                        </div>
                        
                        {/* Right side badge */}
                        {isCurrentRank ? (
                          <div className="flex items-center gap-2">
                            <span 
                              className="px-3 py-1.5 rounded-lg text-xs font-bold"
                              style={{ 
                                background: rank.color,
                                color: '#000',
                                boxShadow: `0 0 15px ${rank.color}50`
                              }}
                            >
                              {t.you}
                            </span>
                            <ChevronRight className="w-5 h-5" style={{ color: rank.color }} />
                          </div>
                        ) : (
                          <span 
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-gray-400"
                            style={{ background: `${rank.color}15`, color: `${rank.color}CC` }}
                          >
                            {rank.tier}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Season End Rewards */}
              {seasonRewardsInfo && (
                <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-900/20 via-dark-800/50 to-dark-800/50 backdrop-blur-xl border border-amber-500/20 p-4 sm:p-6 relative overflow-hidden">
                  {/* Background glow */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />
                  
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 relative z-10">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    {t.seasonRewards}
                  </h3>
                  
                  {/* Gold Rewards for Top 5 */}
                  <div className="mb-4 relative z-10">
                    <p className="text-sm font-medium text-amber-400/80 mb-2 flex items-center gap-2">
                      <Coins className="w-4 h-4" />
                      {t.goldRewardsTop5}
                    </p>
                    <div className="space-y-1.5">
                      {seasonRewardsInfo.gold && Object.entries(seasonRewardsInfo.gold).map(([position, gold]) => (
                        <div key={position} className="flex items-center justify-between px-3 py-2 rounded-lg bg-dark-900/50">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                              position === '1' ? 'bg-yellow-500/20 text-yellow-400' :
                              position === '2' ? 'bg-gray-400/20 text-gray-300' :
                              position === '3' ? 'bg-orange-600/20 text-orange-400' :
                              'bg-dark-700 text-gray-400'
                            }`}>
                              {position}
                            </span>
                            <span className="text-sm text-gray-300">
                              {position === '1' ? (language === 'fr' ? '1er' : '1st') :
                               position === '2' ? (language === 'fr' ? '2ème' : '2nd') :
                               position === '3' ? (language === 'fr' ? '3ème' : '3rd') :
                               `${position}${language === 'fr' ? 'ème' : 'th'}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Coins className="w-4 h-4 text-yellow-400" />
                            <span className="text-yellow-400 font-bold">{gold.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Trophy Rewards */}
                  <div className="relative z-10">
                    <p className="text-sm font-medium text-purple-400/80 mb-2 flex items-center gap-2">
                      <Medal className="w-4 h-4" />
                      {t.trophyRewards}
                    </p>
                    <div className="p-3 rounded-lg bg-dark-900/50 border border-purple-500/10">
                      <div className="flex flex-wrap gap-2">
                        {seasonRewardsInfo.trophyDivisions && seasonRewardsInfo.trophyDivisions.map((division) => {
                          const divisionConfig = {
                            platinum: { color: '#5EEAD4', image: '/4.png', name: language === 'fr' ? 'Platine' : 'Platinum' },
                            diamond: { color: '#22D3EE', image: '/5.png', name: language === 'fr' ? 'Diamant' : 'Diamond' },
                            master: { color: '#9B59B6', image: '/6.png', name: language === 'fr' ? 'Maître' : 'Master' },
                            grandmaster: { color: '#E74C3C', image: '/7.png', name: language === 'fr' ? 'Grand Maître' : 'Grandmaster' },
                            champion: { color: '#F1C40F', image: '/8.png', name: 'Champion' }
                          }[division] || { color: '#666', image: '/1.png', name: division };
                          
                          return (
                            <div 
                              key={division}
                              className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                              style={{ background: `${divisionConfig.color}15`, border: `1px solid ${divisionConfig.color}30` }}
                            >
                              <img src={divisionConfig.image} alt={divisionConfig.name} className="w-5 h-5 object-contain" />
                              <span className="text-xs font-medium" style={{ color: divisionConfig.color }}>
                                {divisionConfig.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-2 text-center">
                        {language === 'fr' ? 'Trophée de saison attribué à chaque joueur atteignant ces rangs' :
                         language === 'de' ? 'Saisontrophäe für jeden Spieler, der diese Ränge erreicht' :
                         language === 'it' ? 'Trofeo stagionale assegnato a ogni giocatore che raggiunge questi gradi' :
                         'Season trophy awarded to each player reaching these ranks'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Points Loss Per Rank Info */}
          {(pointsLossPerRank || DEFAULT_POINTS_LOSS_PER_RANK) && (
            <div className={`rounded-2xl bg-dark-800/50 backdrop-blur-xl border ${isHardcore ? 'border-red-500/20' : 'border-cyan-500/20'} overflow-hidden mb-6`}>
              <div className={`px-4 py-3 bg-gradient-to-r ${isHardcore ? 'from-red-500/10 to-orange-500/5' : 'from-cyan-500/10 to-blue-500/5'} border-b border-white/10`}>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <AlertTriangle className={`w-4 h-4 ${isHardcore ? 'text-red-400' : 'text-cyan-400'}`} />
                  {{ fr: 'Points perdus en cas de défaite (par rang)', en: 'Points lost on defeat (by rank)', de: 'Verlorene Punkte bei Niederlage (pro Rang)', it: 'Punti persi in caso di sconfitta (per rango)' }[language] || 'Points lost on defeat (by rank)'}
                </h4>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'champion'].map((rankKey) => {
                    const style = RANK_STYLES[rankKey];
                    const rankName = getRankName(rankKey, language);
                    // Use config value if valid negative number, otherwise use default
                    const configValue = pointsLossPerRank?.[rankKey];
                    const loss = (typeof configValue === 'number' && configValue < 0) 
                      ? configValue 
                      : DEFAULT_POINTS_LOSS_PER_RANK[rankKey];
                    return (
                      <div 
                        key={rankKey}
                        className="flex flex-col items-center p-2 rounded-xl bg-dark-900/50 border border-white/5"
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-1`}>
                          <img src={style.image} alt={rankName} className="w-7 h-7 object-contain" />
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium truncate">{rankName}</span>
                        <span className="text-sm font-bold text-red-400">{loss}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center">
                  {{ 
                    fr: 'Plus votre rang est élevé, plus vous perdez de points en cas de défaite.', 
                    en: 'The higher your rank, the more points you lose on defeat.',
                    de: 'Je höher Ihr Rang, desto mehr Punkte verlieren Sie bei einer Niederlage.',
                    it: 'Più alto è il tuo rango, più punti perdi in caso di sconfitta.'
                  }[language] || 'The higher your rank, the more points you lose on defeat.'}
                </p>
              </div>
            </div>
          )}

          {/* Classement Mode Classé */}
          <div className="rounded-3xl bg-dark-800/50 backdrop-blur-xl border border-white/10 overflow-hidden">
            {/* Header */}
            <div className={`px-6 py-4 bg-gradient-to-r ${isHardcore ? 'from-red-500/20 to-orange-500/10' : 'from-cyan-500/20 to-blue-500/10'} border-b border-white/10`}>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                  <div className={`p-2 rounded-xl bg-gradient-to-br ${isHardcore ? 'from-red-500 to-orange-600' : 'from-cyan-400 to-blue-600'}`}>
                    <Crown className="w-5 h-5 text-white" />
                  </div>
                  {t.leaderboard} - Top 100
                </h3>
                {/* Refresh button */}
                <button
                  onClick={handleRefreshLeaderboard}
                  disabled={refreshingLeaderboard || loadingLeaderboard}
                  className={`p-2 rounded-xl border transition-all duration-200 ${isHardcore ? 'border-red-500/30 hover:border-red-500/60 hover:bg-red-500/10' : 'border-cyan-500/30 hover:border-cyan-500/60 hover:bg-cyan-500/10'} disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={language === 'fr' ? 'Actualiser le classement' : 'Refresh leaderboard'}
                >
                  <RefreshCw className={`w-4 h-4 ${isHardcore ? 'text-red-400' : 'text-cyan-400'} ${refreshingLeaderboard ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {/* Update notice */}
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                {t.leaderboardUpdateNotice}
              </p>
            </div>

            {loadingLeaderboard ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className={`w-8 h-8 text-${accent}-500 animate-spin`} />
              </div>
            ) : leaderboard.length > 0 ? (
              <div className="p-4 space-y-2">
                {/* Top 3 Animated Podium */}
                {leaderboardPage === 1 && leaderboard.length >= 3 && (
                  <div className="mb-6 pb-6 border-b border-white/10">
                    <div className="flex items-end justify-center gap-4 h-[360px] pt-28">
                      {/* 2nd Place - Left */}
                      {(() => {
                        const player = leaderboard[1];
                        const rank = getRankFromPoints(player.points);
                        const winRate = player.wins + player.losses > 0 
                          ? Math.round((player.wins / (player.wins + player.losses)) * 100) 
                          : 0;
                        return (
                          <button
                            onClick={() => navigate(`/player/${player.user?._id}`)}
                            className="relative group flex flex-col items-center animate-[slideUp_0.6s_ease-out_0.2s_both]"
                          >
                            {/* Glow effect */}
                            <div className="absolute inset-0 bg-gradient-to-t from-gray-400/30 via-gray-300/20 to-transparent blur-3xl rounded-full scale-150 animate-pulse" />
                            
                            {/* Medal badge */}
                            <div className="relative mb-2">
                              <div className="absolute -top-1 -right-1 w-8 h-8 bg-gradient-to-br from-gray-300 via-white to-gray-400 rounded-full flex items-center justify-center shadow-lg z-10 animate-bounce">
                                <span className="font-bold text-gray-700 text-sm">2</span>
                              </div>
                              
                              {/* Avatar with ring */}
                              <div className="relative">
                                <div className="absolute -inset-1 bg-gradient-to-r from-gray-300 via-white to-gray-400 rounded-full animate-spin-slow opacity-75" />
                                <img 
                                  src={getUserAvatar(player.user)}
                                  alt=""
                                  className="relative w-20 h-20 rounded-full object-cover border-4 border-gray-300 group-hover:scale-110 transition-transform duration-300"
                                  onError={(e) => { e.target.src = '/avatar.jpg'; }}
                                />
                              </div>
                            </div>
                            
                            {/* Player info */}
                            <div className="text-center mt-2 relative z-10">
                              <p className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-200 via-white to-gray-300 text-base max-w-[120px] truncate">
                                🥈 {player.user?.username || 'Unknown'}
                              </p>
                              <div className="flex items-center justify-center gap-1 mt-1">
                                <img src={rank.image} alt={rank.name} className="w-5 h-5 object-contain" />
                                <span className="text-xs text-gray-400">{rank.name}</span>
                              </div>
                              <p className="text-gray-300 font-bold text-lg mt-1">{player.points} pts</p>
                              <p className="text-xs text-gray-500">
                                <span className="text-green-400">{player.wins}V</span> / <span className="text-red-400">{player.losses}D</span>
                              </p>
                            </div>
                            
                            {/* Podium base */}
                            <div className="w-28 h-20 mt-3 bg-gradient-to-t from-gray-500 via-gray-400 to-gray-300 rounded-t-lg shadow-2xl flex items-center justify-center">
                              <Medal className="w-8 h-8 text-gray-700" />
                            </div>
                          </button>
                        );
                      })()}
                      
                      {/* 1st Place - Center (Highest) */}
                      {(() => {
                        const player = leaderboard[0];
                        const rank = getRankFromPoints(player.points);
                        const winRate = player.wins + player.losses > 0 
                          ? Math.round((player.wins / (player.wins + player.losses)) * 100) 
                          : 0;
                        return (
                          <button
                            onClick={() => navigate(`/player/${player.user?._id}`)}
                            className="relative group flex flex-col items-center animate-[slideUp_0.6s_ease-out_both]"
                          >
                            {/* Golden glow effect */}
                            <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/40 via-amber-400/30 to-transparent blur-3xl rounded-full scale-150 animate-pulse" />
                            
                            {/* Crown */}
                            <div className="relative mb-2">
                              <Crown className="absolute -top-6 left-1/2 -translate-x-1/2 w-8 h-8 text-yellow-400 animate-bounce drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]" />
                              
                              {/* Avatar with golden ring */}
                              <div className="relative">
                                <div className="absolute -inset-2 bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 rounded-full animate-spin-slow" />
                                <div className="absolute -inset-1 bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-400 rounded-full animate-pulse" />
                                <img 
                                  src={getUserAvatar(player.user)}
                                  alt=""
                                  className="relative w-24 h-24 rounded-full object-cover border-4 border-yellow-400 group-hover:scale-110 transition-transform duration-300"
                                  onError={(e) => { e.target.src = '/avatar.jpg'; }}
                                />
                              </div>
                              
                              {/* Sparkles */}
                              <Sparkles className="absolute -top-2 -left-2 w-5 h-5 text-yellow-300 animate-ping" />
                              <Sparkles className="absolute -top-2 -right-2 w-5 h-5 text-yellow-300 animate-ping delay-100" />
                              <Star className="absolute -bottom-1 -right-3 w-4 h-4 text-yellow-400 animate-pulse" />
                              <Star className="absolute -bottom-1 -left-3 w-4 h-4 text-yellow-400 animate-pulse delay-200" />
                            </div>
                            
                            {/* Player info */}
                            <div className="text-center mt-2 relative z-10">
                              <p className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-400 to-yellow-300 text-lg max-w-[140px] truncate animate-pulse">
                                👑 {player.user?.username || 'Unknown'}
                              </p>
                              <div className="flex items-center justify-center gap-1 mt-1">
                                <img src={rank.image} alt={rank.name} className="w-6 h-6 object-contain" />
                                <span className="text-sm text-yellow-200">{rank.name}</span>
                              </div>
                              <p className="text-yellow-400 font-bold text-xl mt-1 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">{player.points} pts</p>
                              <p className="text-xs text-gray-400">
                                <span className="text-green-400">{player.wins}V</span> / <span className="text-red-400">{player.losses}D</span>
                              </p>
                            </div>
                            
                            {/* Podium base - Tallest */}
                            <div className="w-32 h-28 mt-3 bg-gradient-to-t from-yellow-600 via-amber-500 to-yellow-400 rounded-t-lg shadow-2xl flex items-center justify-center relative overflow-hidden">
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                              <Trophy className="w-10 h-10 text-yellow-900" />
                            </div>
                          </button>
                        );
                      })()}
                      
                      {/* 3rd Place - Right */}
                      {(() => {
                        const player = leaderboard[2];
                        const rank = getRankFromPoints(player.points);
                        const winRate = player.wins + player.losses > 0 
                          ? Math.round((player.wins / (player.wins + player.losses)) * 100) 
                          : 0;
                        return (
                          <button
                            onClick={() => navigate(`/player/${player.user?._id}`)}
                            className="relative group flex flex-col items-center animate-[slideUp_0.6s_ease-out_0.4s_both]"
                          >
                            {/* Glow effect */}
                            <div className="absolute inset-0 bg-gradient-to-t from-orange-500/30 via-amber-400/20 to-transparent blur-3xl rounded-full scale-150 animate-pulse" />
                            
                            {/* Medal badge */}
                            <div className="relative mb-2">
                              <div className="absolute -top-1 -right-1 w-8 h-8 bg-gradient-to-br from-orange-400 via-amber-500 to-orange-600 rounded-full flex items-center justify-center shadow-lg z-10 animate-bounce">
                                <span className="font-bold text-orange-900 text-sm">3</span>
                              </div>
                              
                              {/* Avatar with ring */}
                              <div className="relative">
                                <div className="absolute -inset-1 bg-gradient-to-r from-orange-400 via-amber-500 to-orange-500 rounded-full animate-spin-slow opacity-75" />
                                <img 
                                  src={getUserAvatar(player.user)}
                                  alt=""
                                  className="relative w-20 h-20 rounded-full object-cover border-4 border-orange-400 group-hover:scale-110 transition-transform duration-300"
                                  onError={(e) => { e.target.src = '/avatar.jpg'; }}
                                />
                              </div>
                            </div>
                            
                            {/* Player info */}
                            <div className="text-center mt-2 relative z-10">
                              <p className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-300 via-amber-400 to-orange-400 text-base max-w-[120px] truncate">
                                🥉 {player.user?.username || 'Unknown'}
                              </p>
                              <div className="flex items-center justify-center gap-1 mt-1">
                                <img src={rank.image} alt={rank.name} className="w-5 h-5 object-contain" />
                                <span className="text-xs text-orange-200">{rank.name}</span>
                              </div>
                              <p className="text-orange-400 font-bold text-lg mt-1">{player.points} pts</p>
                              <p className="text-xs text-gray-500">
                                <span className="text-green-400">{player.wins}V</span> / <span className="text-red-400">{player.losses}D</span>
                              </p>
                            </div>
                            
                            {/* Podium base */}
                            <div className="w-28 h-16 mt-3 bg-gradient-to-t from-orange-600 via-amber-500 to-orange-400 rounded-t-lg shadow-2xl flex items-center justify-center">
                              <Medal className="w-8 h-8 text-orange-900" />
                            </div>
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                )}
                
                {leaderboard
                  .filter((_, idx) => {
                    // Skip first 3 players on page 1 ONLY if podium is shown (>= 3 players)
                    if (leaderboardPage === 1 && leaderboard.length >= 3 && idx < 3) return false;
                    return true;
                  })
                  .map((player, idx) => {
                  // Calculate actual position based on current page
                  // On page 1 with podium (>= 3 players), skip first 3, so position starts at 4
                  // On page 1 without podium (< 3 players), position starts at 1
                  const hasPodium = leaderboardPage === 1 && leaderboard.length >= 3;
                  const actualIdx = hasPodium ? idx + 3 : idx;
                  const position = (leaderboardPage - 1) * LEADERBOARD_PER_PAGE + actualIdx + 1;
                  const rank = getRankFromPoints(player.points);
                  const winRate = player.wins + player.losses > 0 
                    ? Math.round((player.wins / (player.wins + player.losses)) * 100) 
                    : 0;
                  const isMe = user && player.user?._id === user.id;
                  
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
                          <div className={`w-5 h-5 rounded flex items-center justify-center`}>
                            <img src={rank.image} alt={rank.name} className="w-5 h-5 object-contain" />
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

                {/* Show my position if I'm not in current page's top 10 */}
                {myRanking && user && (() => {
                  // Calculate current page range
                  const pageStart = (leaderboardPage - 1) * LEADERBOARD_PER_PAGE + 1;
                  const pageEnd = leaderboardPage * LEADERBOARD_PER_PAGE;
                  // Show player if they're not in the current page and within top 100
                  const isInCurrentPage = myRanking.rank >= pageStart && myRanking.rank <= pageEnd;
                  const isInTop100 = myRanking.rank <= LEADERBOARD_TOTAL;
                  return !isInCurrentPage && isInTop100;
                })() && (
                  <>
                    {/* Separator */}
                    <div className="flex items-center gap-2 py-2">
                      <div className="flex-1 border-t border-white/10"></div>
                      <span className="text-xs text-gray-500">...</span>
                      <div className="flex-1 border-t border-white/10"></div>
                    </div>
                    
                    {/* My position */}
                    <button
                      onClick={() => navigate(`/player/${user.id}`)}
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
                          <div className={`w-5 h-5 rounded flex items-center justify-center`}>
                            <img src={playerRank.image} alt={playerRank.name} className="w-5 h-5 object-contain" />
                          </div>
                          <span className="text-xs text-gray-500">{playerRank.name}</span>
                        </div>
                      </div>
                      
                      {/* Stats */}
                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold ${isHardcore ? 'text-red-400' : 'text-cyan-400'}`}>{myRanking.points} pts</p>
                        <p className="text-xs text-gray-500">
                          <span className="text-green-400">{calculatedStats.wins}V</span>
                          <span className="mx-1">/</span>
                          <span className="text-red-400">{calculatedStats.losses}D</span>
                        </p>
                      </div>
                    </button>
                  </>
                )}
                
                {/* Show my position if I'm beyond top 100 (always show as 11th position) */}
                {myRanking && user && myRanking.rank > LEADERBOARD_TOTAL && (
                  <>
                    {/* Separator */}
                    <div className="flex items-center gap-2 py-2">
                      <div className="flex-1 border-t border-white/10"></div>
                      <span className="text-xs text-gray-500">...</span>
                      <div className="flex-1 border-t border-white/10"></div>
                    </div>
                    
                    {/* My position */}
                    <button
                      onClick={() => navigate(`/player/${user.id}`)}
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
                          <div className={`w-5 h-5 rounded flex items-center justify-center`}>
                            <img src={playerRank.image} alt={playerRank.name} className="w-5 h-5 object-contain" />
                          </div>
                          <span className="text-xs text-gray-500">{playerRank.name}</span>
                        </div>
                      </div>
                      
                      {/* Stats */}
                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold ${isHardcore ? 'text-red-400' : 'text-cyan-400'}`}>{myRanking.points} pts</p>
                        <p className="text-xs text-gray-500">
                          <span className="text-green-400">{calculatedStats.wins}V</span>
                          <span className="mx-1">/</span>
                          <span className="text-red-400">{calculatedStats.losses}D</span>
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

      {/* Maps Modal */}
      {showMapsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-dark-900 rounded-2xl p-4 sm:p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-green-500/30 shadow-xl my-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
                <Map className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
                {language === 'fr' ? 'Maps Disponibles' : 'Available Maps'}
              </h2>
              <button
                onClick={() => setShowMapsModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            {loadingMaps ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Current Mode & Game Mode Info */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-dark-800/50 rounded-xl border border-white/10">
                  <span className={`px-3 py-1 rounded-lg text-sm font-medium ${isHardcore ? 'bg-red-500/20 text-red-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                    {isHardcore ? 'Hardcore' : 'CDL'}
                  </span>
                  <span className="px-3 py-1 rounded-lg text-sm font-medium bg-purple-500/20 text-purple-400">
                    {selectedGameMode}
                  </span>
                  <span className="px-3 py-1 rounded-lg text-sm font-medium bg-green-500/20 text-green-400">
                    BO{mapsBestOf} ({mapsBestOf === 1 ? '1 map requise' : '3 maps requises'})
                  </span>
                </div>
                
                {/* 4v4 Format */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-bold">4v4</div>
                    <span className="text-gray-400 text-sm">
                      {availableMaps['4v4'].length} {language === 'fr' ? 'map(s)' : 'map(s)'}
                    </span>
                  </div>
                  
                  {/* Warning if not enough maps */}
                  {mapsWarnings['4v4'] && (
                    <div className="mb-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <p className="text-yellow-400 text-xs sm:text-sm flex items-start gap-2">
                        <span className="text-yellow-500">⚠️</span>
                        {mapsWarnings['4v4']}
                      </p>
                    </div>
                  )}
                  
                  {availableMaps['4v4'].length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                      {availableMaps['4v4'].map((map, index) => (
                        <div key={map._id || index} className="relative group rounded-xl overflow-hidden border border-blue-500/20 hover:border-blue-500/50 transition-all">
                          {map.image ? (
                            <img 
                              src={map.image} 
                              alt={map.name}
                              className="w-full h-20 sm:h-24 object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-20 sm:h-24 bg-dark-700 flex items-center justify-center">
                              <Map className="w-8 h-8 text-gray-600" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end">
                            <p className="w-full text-center text-white text-xs sm:text-sm font-semibold p-2 truncate">{map.name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-dark-800/30 rounded-xl border border-white/5">
                      <Map className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">
                        {language === 'fr' ? 'Aucune map configurée pour ce format' : 'No maps configured for this format'}
                      </p>
                    </div>
                  )}
                </div>
                
                {/* 5v5 Format - Only for Hardcore */}
                {isHardcore && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-lg text-sm font-bold">5v5</div>
                      <span className="text-gray-400 text-sm">
                        {availableMaps['5v5'].length} {language === 'fr' ? 'map(s)' : 'map(s)'}
                      </span>
                    </div>
                    
                    {/* Warning if not enough maps */}
                    {mapsWarnings['5v5'] && (
                      <div className="mb-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <p className="text-yellow-400 text-xs sm:text-sm flex items-start gap-2">
                          <span className="text-yellow-500">⚠️</span>
                          {mapsWarnings['5v5']}
                        </p>
                      </div>
                    )}
                    
                    {availableMaps['5v5'].length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                        {availableMaps['5v5'].map((map, index) => (
                          <div key={map._id || index} className="relative group rounded-xl overflow-hidden border border-orange-500/20 hover:border-orange-500/50 transition-all">
                            {map.image ? (
                              <img 
                                src={map.image} 
                                alt={map.name}
                                className="w-full h-20 sm:h-24 object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-20 sm:h-24 bg-dark-700 flex items-center justify-center">
                                <Map className="w-8 h-8 text-gray-600" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end">
                              <p className="w-full text-center text-white text-xs sm:text-sm font-semibold p-2 truncate">{map.name}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 bg-dark-800/30 rounded-xl border border-white/5">
                        <Map className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">
                          {language === 'fr' ? 'Aucune map configurée pour ce format' : 'No maps configured for this format'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <button
              onClick={() => setShowMapsModal(false)}
              className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold hover:opacity-90 transition-all"
            >
              {language === 'fr' ? 'Fermer' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* Shuffle Animation Modal */}
      {showShuffleAnimation && shuffleMatchData && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[60] p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-4xl mx-2 sm:mx-4 my-auto">
            {/* Title */}
            <div className="text-center mb-4 sm:mb-8">
              <div className={`inline-flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-2 sm:py-3 rounded-full bg-gradient-to-r ${isHardcore ? 'from-red-500/20 to-orange-500/20 border-red-500/50' : 'from-cyan-500/20 to-blue-500/20 border-cyan-500/50'} border mb-2 sm:mb-4`}>
                <Swords className={`w-4 sm:w-6 h-4 sm:h-6 ${isHardcore ? 'text-red-400' : 'text-cyan-400'} ${shufflePhase === 0 ? 'animate-pulse' : ''}`} />
                <span className="text-lg sm:text-2xl font-bold text-white">
                  {t.matchFound || 'Match trouvé !'}
                </span>
                <Swords className={`w-4 sm:w-6 h-4 sm:h-6 ${isHardcore ? 'text-red-400' : 'text-cyan-400'} ${shufflePhase === 0 ? 'animate-pulse' : ''}`} />
              </div>
              <p className={`text-sm sm:text-lg ${isHardcore ? 'text-red-400' : 'text-cyan-400'}`}>
                {shufflePhase === 0 && (t.shufflingPlayers || 'Mélange des joueurs...')}
                {shufflePhase === 1 && (t.distributingTeams || 'Répartition dans les équipes...')}
                {shufflePhase === 2 && (t.teamsReady || 'Équipes prêtes !')}
                {shufflePhase === 3 && (t.getReady || 'Préparez-vous !')}
                {shufflePhase === 4 && !selectedMap && (language === 'fr' ? 'Votez pour la map !' : 'Vote for the map!')}
                {shufflePhase === 4 && selectedMap && (language === 'fr' ? `Map sélectionnée: ${selectedMap.name}` : `Selected map: ${selectedMap.name}`)}
              </p>
            </div>

            {/* Players Display */}
            <div className="relative">
              {/* Phase 0: Shuffling - All players in center */}
              {shufflePhase === 0 && (
                <div className="flex flex-wrap justify-center gap-2 sm:gap-4 animate-pulse">
                  {shuffledPlayers.map((player, index) => (
                    <div
                      key={player.id || index}
                      className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-gray-800/80 border border-gray-600/50 transform transition-all duration-300`}
                      style={{
                        transform: `translateX(${Math.sin(index * 0.8) * 10}px) translateY(${Math.cos(index * 0.8) * 5}px)`,
                      }}
                    >
                      <div className="w-6 sm:w-8 h-6 sm:h-8 rounded-full overflow-hidden bg-gray-700">
                        <img
                          src={player.avatar || `https://cdn.discordapp.com/embed/avatars/${index % 5}.png`}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.src = `https://cdn.discordapp.com/embed/avatars/${index % 5}.png`; }}
                        />
                      </div>
                      <span className="text-white font-medium text-xs sm:text-base truncate max-w-[80px] sm:max-w-none">{player.username || `Joueur ${index + 1}`}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Phase 1, 2 & 3: Teams Split */}
              {(shufflePhase === 1 || shufflePhase === 2 || shufflePhase === 3) && (
                <div className="grid grid-cols-2 gap-2 sm:gap-8">
                  {/* Team A */}
                  <div className={`p-2 sm:p-6 rounded-xl sm:rounded-2xl border-2 transition-all duration-500 ${
                    (shufflePhase === 2 || shufflePhase === 3)
                      ? 'bg-cyan-500/10 border-cyan-500/50'
                      : 'bg-gray-800/50 border-gray-600/30'
                  }`}>
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-4">
                      <div className="w-2 sm:w-3 h-2 sm:h-3 rounded-full bg-cyan-400"></div>
                      <h3 className="text-sm sm:text-xl font-bold text-cyan-400">{language === 'fr' ? 'Équipe 1' : 'Team 1'}</h3>
                    </div>
                    <div className="space-y-1.5 sm:space-y-3">
                      {shuffleMatchData.players
                        ?.filter(p => p.team === 1 || p.team === 'A')
                        .map((player, index) => {
                          const playerRankInfo = getRankFromPoints(player.points || 0);
                          return (
                          <div
                            key={player.id || index}
                            className={`flex items-center gap-1.5 sm:gap-3 px-2 sm:px-4 py-1.5 sm:py-3 rounded-lg sm:rounded-xl bg-gray-900/50 border border-cyan-500/20 transform transition-all duration-500 ${
                              (shufflePhase === 2 || shufflePhase === 3) ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'
                            }`}
                            style={{ transitionDelay: `${index * 100}ms` }}
                          >
                            <div className="w-7 sm:w-10 h-7 sm:h-10 rounded-full overflow-hidden bg-gray-700 border sm:border-2 border-cyan-500/50 flex-shrink-0">
                              <img
                                src={player.avatar || `https://cdn.discordapp.com/embed/avatars/${index % 5}.png`}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.src = `https://cdn.discordapp.com/embed/avatars/${index % 5}.png`; }}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-white font-semibold text-xs sm:text-base truncate block">{player.username || `Joueur ${index + 1}`}</span>
                              <div className="flex gap-1 flex-wrap items-center">
                                {player.isHost && <span className="text-yellow-400 text-[10px] sm:text-xs">(Host)</span>}
                                {player.isReferent && <span className="text-purple-400 text-[10px] sm:text-xs">(Réf.)</span>}
                              </div>
                            </div>
                            {/* Animated Rank Badge */}
                            <div 
                              className="relative flex-shrink-0"
                              style={{ animation: (shufflePhase === 2 || shufflePhase === 3) ? `pulse 2s ease-in-out infinite ${index * 0.2}s` : 'none' }}
                            >
                              <div 
                                className="absolute inset-0 rounded-lg blur-md opacity-50"
                                style={{ backgroundColor: playerRankInfo.color }}
                              ></div>
                              <div 
                                className={`relative flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg bg-gradient-to-r ${playerRankInfo.gradient} border border-white/20`}
                              >
                                <img src={playerRankInfo.image} alt={playerRankInfo.name} className="w-4 h-4 sm:w-5 sm:h-5 object-contain" style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.5))' }} />
                                <span className="text-white text-[10px] sm:text-xs font-bold">{playerRankInfo.name}</span>
                              </div>
                            </div>
                          </div>
                        );
                        })}
                    </div>
                  </div>

                  {/* VS Divider */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <div className={`w-10 sm:w-16 h-10 sm:h-16 rounded-full flex items-center justify-center font-bold text-sm sm:text-xl ${
                      isHardcore 
                        ? 'bg-gradient-to-br from-red-500 to-orange-600' 
                        : 'bg-gradient-to-br from-cyan-400 to-blue-600'
                    } shadow-lg ${(shufflePhase === 2 || shufflePhase === 3) ? 'animate-bounce' : ''}`}>
                      VS
                    </div>
                  </div>

                  {/* Team B */}
                  <div className={`p-2 sm:p-6 rounded-xl sm:rounded-2xl border-2 transition-all duration-500 ${
                    (shufflePhase === 2 || shufflePhase === 3)
                      ? 'bg-orange-500/10 border-orange-500/50'
                      : 'bg-gray-800/50 border-gray-600/30'
                  }`}>
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-4 justify-end">
                      <h3 className="text-sm sm:text-xl font-bold text-orange-400">{language === 'fr' ? 'Équipe 2' : 'Team 2'}</h3>
                      <div className="w-2 sm:w-3 h-2 sm:h-3 rounded-full bg-orange-400"></div>
                    </div>
                    <div className="space-y-1.5 sm:space-y-3">
                      {shuffleMatchData.players
                        ?.filter(p => p.team === 2 || p.team === 'B')
                        .map((player, index) => {
                          const playerRankInfo = getRankFromPoints(player.points || 0);
                          return (
                          <div
                            key={player.id || index}
                            className={`flex items-center gap-1.5 sm:gap-3 px-2 sm:px-4 py-1.5 sm:py-3 rounded-lg sm:rounded-xl bg-gray-900/50 border border-orange-500/20 transform transition-all duration-500 ${
                              (shufflePhase === 2 || shufflePhase === 3) ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
                            }`}
                            style={{ transitionDelay: `${index * 100}ms` }}
                          >
                            {/* Animated Rank Badge - Left side for Team 2 */}
                            <div 
                              className="relative flex-shrink-0"
                              style={{ animation: (shufflePhase === 2 || shufflePhase === 3) ? `pulse 2s ease-in-out infinite ${index * 0.2}s` : 'none' }}
                            >
                              <div 
                                className="absolute inset-0 rounded-lg blur-md opacity-50"
                                style={{ backgroundColor: playerRankInfo.color }}
                              ></div>
                              <div 
                                className={`relative flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg bg-gradient-to-r ${playerRankInfo.gradient} border border-white/20`}
                              >
                                <img src={playerRankInfo.image} alt={playerRankInfo.name} className="w-4 h-4 sm:w-5 sm:h-5 object-contain" style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.5))' }} />
                                <span className="text-white text-[10px] sm:text-xs font-bold">{playerRankInfo.name}</span>
                              </div>
                            </div>
                            <div className="w-7 sm:w-10 h-7 sm:h-10 rounded-full overflow-hidden bg-gray-700 border sm:border-2 border-orange-500/50 flex-shrink-0">
                              <img
                                src={player.avatar || `https://cdn.discordapp.com/embed/avatars/${index % 5}.png`}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.src = `https://cdn.discordapp.com/embed/avatars/${index % 5}.png`; }}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-white font-semibold text-xs sm:text-base truncate block">{player.username || `Joueur ${index + 1}`}</span>
                              <div className="flex gap-1 flex-wrap items-center">
                                {player.isHost && <span className="text-yellow-400 text-[10px] sm:text-xs">(Host)</span>}
                                {player.isReferent && <span className="text-purple-400 text-[10px] sm:text-xs">(Réf.)</span>}
                              </div>
                            </div>
                          </div>
                        );
                        })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Redirect indicator / Countdown */}
            {(shufflePhase === 2 || shufflePhase === 3) && (
              <div className="text-center mt-4 sm:mt-8">
                {shufflePhase === 3 ? (
                  <div className="flex flex-col items-center gap-2 sm:gap-4">
                    <div className={`w-16 sm:w-24 h-16 sm:h-24 rounded-full flex items-center justify-center text-2xl sm:text-4xl font-bold border-4 ${
                      isHardcore 
                        ? 'bg-red-500/20 border-red-500 text-red-400' 
                        : 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                    } animate-pulse`}>
                      {shuffleCountdown}
                    </div>
                    <span className="text-gray-400 text-sm sm:text-base">
                      {shuffleMatchData?.hasRosterSelection 
                        ? (language === 'fr' ? 'Sélection du roster dans...' : 'Roster selection in...')
                        : (language === 'fr' ? 'Choix des maps dans...' : 'Map selection in...')}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-gray-400 text-sm sm:text-base">
                    <Loader2 className="w-4 sm:w-5 h-4 sm:h-5 animate-spin" />
                    <span>{t.teamsReady || 'Équipes prêtes !'}</span>
                  </div>
                )}  
              </div>
            )}
            
            {/* Phase 5: Roster Selection (Test matches only) */}
            {shufflePhase === 5 && (
              <div className="mt-4 sm:mt-8">
                {/* Header */}
                <div className="text-center mb-4 sm:mb-6">
                  <h3 className={`text-lg sm:text-2xl font-bold ${isHardcore ? 'text-red-400' : 'text-cyan-400'}`}>
                    {language === 'fr' ? 'Sélection du Roster' : 'Roster Selection'}
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">
                    {language === 'fr' ? 'Les référents choisissent les joueurs à tour de rôle' : 'Referents pick players in turns'}
                  </p>
                </div>
                
                {/* Referents Display */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Team 1 Referent */}
                  {(() => {
                    // Trouver le vrai référent équipe 1
                    const team1RefId = rosterSelection.team1Referent?.toString();
                    const team1RefPlayer = shuffleMatchData?.players?.find(p => p.id === team1RefId || (p.isReferent && p.team === 1));
                    const isMe = team1RefId === user?.id?.toString();
                    const team1RefUsername = team1RefPlayer?.username || (isMe ? user?.username : 'Référent 1');
                    const team1RefAvatar = isMe ? user?.avatar : team1RefPlayer?.avatar;
                    
                    return (
                      <div className={`rounded-xl p-3 border-2 ${rosterSelection.currentTurn === 1 ? 'border-cyan-500 bg-cyan-500/10' : 'border-cyan-500/30 bg-cyan-500/5'}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                          <span className="text-cyan-400 font-bold text-sm">{language === 'fr' ? 'Référent Équipe 1' : 'Team 1 Referent'}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 border-2 border-cyan-500 flex items-center justify-center">
                            {team1RefAvatar ? (
                              <img src={team1RefAvatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-6 h-6 bg-cyan-500/50 rounded-full"></div>
                            )}
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm">{team1RefUsername}</p>
                            <p className="text-cyan-400 text-xs">
                              {isMe ? (language === 'fr' ? '(Vous)' : '(You)') : (language === 'fr' ? '(Joueur)' : '(Player)')}
                            </p>
                          </div>
                        </div>
                        {rosterSelection.currentTurn === 1 && (
                          <p className="text-green-400 text-xs font-bold animate-pulse mt-2">
                            {isMe 
                              ? (language === 'fr' ? 'À vous de choisir !' : 'Your pick!')
                              : (language === 'fr' ? 'Leur tour de choisir...' : 'Their turn to pick...')}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                  
                  {/* Team 2 Referent (Real player or Bot) */}
                  {(() => {
                    // Déterminer si Team 2 référent est un vrai joueur ou un bot
                    const team2RefId = rosterSelection.team2Referent?.toString();
                    const isBot = !team2RefId || rosterSelection.team2ReferentInfo;
                    const team2RefPlayer = !isBot 
                      ? shuffleMatchData?.players?.find(p => p.id === team2RefId || (p.isReferent && p.team === 2))
                      : null;
                    const isMe = team2RefId === user?.id?.toString();
                    const team2RefUsername = team2RefPlayer?.username || rosterSelection.team2ReferentInfo?.username || 'Bot';
                    const team2RefAvatar = isMe ? user?.avatar : team2RefPlayer?.avatar;
                    
                    return (
                      <div className={`rounded-xl p-3 border-2 ${rosterSelection.currentTurn === 2 ? 'border-orange-500 bg-orange-500/10' : 'border-orange-500/30 bg-orange-500/5'}`}>
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-orange-400 font-bold text-sm">{language === 'fr' ? 'Référent Équipe 2' : 'Team 2 Referent'}</span>
                          <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                        </div>
                        <div className="flex items-center gap-3 mt-2 justify-end">
                          <div className="text-right">
                            <p className="text-white font-medium text-sm">
                              {team2RefUsername}
                            </p>
                            <p className="text-orange-400 text-xs">
                              {isMe 
                                ? (language === 'fr' ? '(Vous)' : '(You)')
                                : (isBot 
                                    ? (language === 'fr' ? '(Bot Auto)' : '(Auto Bot)')
                                    : (language === 'fr' ? '(Joueur)' : '(Player)'))}
                            </p>
                          </div>
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 border-2 border-orange-500 flex items-center justify-center">
                            {!isBot && team2RefAvatar ? (
                              <img src={team2RefAvatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Bot className="w-6 h-6 text-orange-400" />
                            )}
                          </div>
                        </div>
                        {rosterSelection.currentTurn === 2 && (
                          <p className="text-orange-400 text-xs font-bold animate-pulse mt-2 text-right">
                            {isMe
                              ? (language === 'fr' ? 'À vous de choisir !' : 'Your pick!')
                              : (isBot
                                  ? (language === 'fr' ? 'Le bot choisit...' : 'Bot is picking...')
                                  : (language === 'fr' ? 'Leur tour de choisir...' : 'Their turn to pick...'))}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
                
                {/* Timer and Turn Indicator */}
                <div className="flex justify-center items-center gap-4 mb-6">
                  <div className={`w-14 sm:w-20 h-14 sm:h-20 rounded-full flex items-center justify-center text-2xl sm:text-3xl font-bold border-4 ${
                    isHardcore 
                      ? 'bg-red-500/20 border-red-500 text-red-400' 
                      : 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                  } ${rosterSelectionCountdown <= 3 ? 'animate-pulse' : ''}`}>
                    {rosterSelectionCountdown}
                  </div>
                  <div className="text-left">
                    <p className="text-gray-500 text-xs sm:text-sm">
                      {language === 'fr' ? 'Tour de' : 'Turn for'}
                    </p>
                    <p className={`text-lg sm:text-xl font-bold ${rosterSelection.currentTurn === 1 ? 'text-cyan-400' : 'text-orange-400'}`}>
                      {rosterSelection.currentTurn === 1 
                        ? (language === 'fr' ? 'Équipe 1' : 'Team 1')
                        : (language === 'fr' ? 'Équipe 2' : 'Team 2')}
                    </p>
                  </div>
                </div>
                
                {/* Available Players */}
                <div className="bg-dark-800/50 rounded-xl p-4 mb-4 border border-white/10">
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {language === 'fr' ? 'Joueurs disponibles' : 'Available Players'}
                    <span className="text-gray-500 text-sm">({rosterSelection.availablePlayers.length})</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {rosterSelection.availablePlayers.map((player, index) => {
                      const playerRankInfo = getRankFromPoints(player.points || 0);
                      // Utiliser le flag isYourTurn calculé par le serveur
                      const isMyTurn = rosterSelection.isYourTurn || false;
                      
                      // Debug log pour le premier joueur seulement
                      if (index === 0) {
                        console.log('[RankedMode] isMyTurn check:', {
                          currentTurn: rosterSelection.currentTurn,
                          isYourTurnFromServer: rosterSelection.isYourTurn,
                          isTeam1Referent: rosterSelection.isTeam1Referent,
                          isTeam2Referent: rosterSelection.isTeam2Referent,
                          isMyTurn
                        });
                      }
                      
                      // Obtenir l'avatar du joueur (depuis les données ou shuffleMatchData.players)
                      const playerAvatar = player.avatar || 
                        shuffleMatchData?.players?.find(p => p.username === player.username)?.avatar ||
                        (player.isFake ? null : `https://cdn.discordapp.com/embed/avatars/${index % 5}.png`);
                      
                      return (
                        <button
                          key={player.id || index}
                          onClick={() => isMyTurn && handleRosterPick(player.id)}
                          disabled={!isMyTurn}
                          className={`p-2 sm:p-3 rounded-lg border transition-all ${
                            isMyTurn 
                              ? `${isHardcore ? 'border-red-500/50 hover:border-red-500 hover:bg-red-500/20' : 'border-cyan-500/50 hover:border-cyan-500 hover:bg-cyan-500/20'} cursor-pointer`
                              : 'border-gray-700 opacity-50 cursor-not-allowed'
                          } bg-dark-900/50`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 border-2 border-gray-600 flex items-center justify-center">
                              {playerAvatar ? (
                                <img
                                  src={playerAvatar}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Bot className="w-6 h-6 text-gray-500" />
                              )}
                            </div>
                            <span className="text-white text-xs sm:text-sm font-medium truncate w-full text-center">
                              {player.username}
                            </span>
                            <div className={`px-2 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r ${playerRankInfo.gradient}`}>
                              {playerRankInfo.name}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Teams */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Team 1 */}
                  <div className={`rounded-xl p-3 border-2 ${isHardcore ? 'border-red-500/30 bg-red-500/5' : 'border-cyan-500/30 bg-cyan-500/5'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                      <h4 className="text-cyan-400 font-bold text-sm">{language === 'fr' ? 'Équipe 1' : 'Team 1'}</h4>
                      <span className="text-gray-500 text-xs">({rosterSelection.team1Players.length})</span>
                    </div>
                    <div className="space-y-1">
                      {rosterSelection.team1Players.map((player, index) => {
                        const playerAvatar = player.avatar || 
                          shuffleMatchData?.players?.find(p => p.username === player.username)?.avatar;
                        return (
                          <div key={player.id || index} className="flex items-center gap-2 p-1.5 rounded bg-dark-800/50">
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center">
                              {playerAvatar ? (
                                <img src={playerAvatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Bot className="w-4 h-4 text-gray-500" />
                              )}
                            </div>
                            <span className="text-white text-xs truncate">{player.username}</span>
                            {player.isFake && <span className="text-gray-500 text-[10px]">(Bot)</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Team 2 */}
                  <div className={`rounded-xl p-3 border-2 ${isHardcore ? 'border-orange-500/30 bg-orange-500/5' : 'border-orange-500/30 bg-orange-500/5'}`}>
                    <div className="flex items-center gap-2 mb-2 justify-end">
                      <span className="text-gray-500 text-xs">({rosterSelection.team2Players.length})</span>
                      <h4 className="text-orange-400 font-bold text-sm">{language === 'fr' ? 'Équipe 2' : 'Team 2'}</h4>
                      <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                    </div>
                    <div className="space-y-1">
                      {rosterSelection.team2Players.map((player, index) => {
                        const playerAvatar = player.avatar || 
                          shuffleMatchData?.players?.find(p => p.username === player.username)?.avatar;
                        return (
                          <div key={player.id || index} className="flex items-center gap-2 p-1.5 rounded bg-dark-800/50">
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center">
                              {playerAvatar ? (
                                <img src={playerAvatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Bot className="w-4 h-4 text-gray-500" />
                              )}
                            </div>
                            <span className="text-white text-xs truncate">{player.username}</span>
                            {player.isFake && <span className="text-gray-500 text-[10px]">(Bot)</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                
                {/* Info text */}
                <p className="text-center text-gray-500 text-xs mt-4">
                  {language === 'fr' 
                    ? '10 secondes par tour - Sélection aléatoire si le temps expire'
                    : '10 seconds per turn - Random pick if time expires'}
                </p>
              </div>
            )}
            
            {/* Phase 4: Map Vote */}
            {shufflePhase === 4 && (
              <div className="mt-4 sm:mt-8">
                {/* Timer */}
                <div className="flex justify-center mb-4 sm:mb-6">
                  <div className={`w-14 sm:w-20 h-14 sm:h-20 rounded-full flex items-center justify-center text-2xl sm:text-3xl font-bold border-4 ${
                    isHardcore 
                      ? 'bg-red-500/20 border-red-500 text-red-400' 
                      : 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                  } ${mapVoteCountdown <= 5 ? 'animate-pulse' : ''}`}>
                    {mapVoteCountdown}
                  </div>
                </div>
                
                {/* Selected Map Result */}
                {selectedMap ? (
                  <div className="text-center">
                    <div className={`inline-block p-4 sm:p-6 rounded-xl sm:rounded-2xl border-2 ${
                      isHardcore ? 'border-red-500 bg-red-500/10' : 'border-cyan-500 bg-cyan-500/10'
                    }`}>
                      {selectedMap.image && (
                        <img 
                          src={selectedMap.image} 
                          alt={selectedMap.name}
                          className="w-32 sm:w-48 h-20 sm:h-32 object-cover rounded-lg mx-auto mb-2 sm:mb-4"
                        />
                      )}
                      <p className="text-xl sm:text-2xl font-bold text-white">{selectedMap.name}</p>
                      <p className="text-gray-400 mt-1 sm:mt-2 text-sm sm:text-base">
                        {selectedMap.votes} {language === 'fr' ? 'vote(s)' : 'vote(s)'}
                      </p>
                    </div>
                    <p className={`mt-3 sm:mt-4 text-sm sm:text-base ${isHardcore ? 'text-red-400' : 'text-cyan-400'}`}>
                      {language === 'fr' ? 'Redirection vers la feuille de match...' : 'Redirecting to match sheet...'}
                    </p>
                  </div>
                ) : (
                  /* Map Vote Options */
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-3xl mx-auto px-1">
                    {mapVoteOptions.map((map, index) => (
                      <button
                        key={index}
                        onClick={() => handleMapVote(index)}
                        className={`relative p-2 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all duration-300 hover:scale-105 ${
                          selectedMapIndex === index
                            ? isHardcore 
                              ? 'border-red-500 bg-red-500/20 ring-2 ring-red-500/50' 
                              : 'border-cyan-500 bg-cyan-500/20 ring-2 ring-cyan-500/50'
                            : 'border-gray-600 bg-gray-800/50 hover:border-gray-500'
                        }`}
                      >
                        {/* Map Image */}
                        {map.image ? (
                          <img 
                            src={map.image} 
                            alt={map.name}
                            className="w-full h-16 sm:h-24 object-cover rounded-md sm:rounded-lg mb-2 sm:mb-3"
                          />
                        ) : (
                          <div className="w-full h-16 sm:h-24 bg-gray-700 rounded-md sm:rounded-lg mb-2 sm:mb-3 flex items-center justify-center">
                            <Map className="w-5 sm:w-8 h-5 sm:h-8 text-gray-500" />
                          </div>
                        )}
                        
                        {/* Map Name */}
                        <p className="text-white font-semibold text-center text-xs sm:text-base truncate">{map.name}</p>
                        
                        {/* Vote Count */}
                        <div className={`mt-1 sm:mt-2 text-center text-xs sm:text-sm ${
                          map.votes > 0 
                            ? isHardcore ? 'text-red-400' : 'text-cyan-400'
                            : 'text-gray-500'
                        }`}>
                          {map.votes} {language === 'fr' ? 'vote(s)' : 'vote(s)'}
                        </div>
                        
                        {/* Selected indicator */}
                        {selectedMapIndex === index && (
                          <div className={`absolute top-1 sm:top-2 right-1 sm:right-2 w-5 sm:w-6 h-5 sm:h-6 rounded-full flex items-center justify-center ${
                            isHardcore ? 'bg-red-500' : 'bg-cyan-500'
                          }`}>
                            <span className="text-white text-[10px] sm:text-xs">✓</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Voice Channel - Visible during map vote */}
                {!selectedMap && (
                  <div className="mt-4 sm:mt-6 animate-fadeIn">
                    {/* Show team's voice channel if available */}
                    {(() => {
                      const myChannel = voiceChannels.myTeam === 1 ? voiceChannels.team1 : voiceChannels.team2;
                      const isTeam1 = voiceChannels.myTeam === 1;
                      
                      if (myChannel?.channelId) {
                        return (
                          <div className={`p-4 rounded-xl border ${isTeam1 ? 'bg-blue-500/10 border-blue-500/30' : 'bg-purple-500/10 border-purple-500/30'}`}>
                            <div className="flex items-center justify-center gap-2 mb-3">
                              <svg className={`w-6 h-6 ${isTeam1 ? 'text-blue-400' : 'text-purple-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                              </svg>
                              <span className={`font-bold text-sm ${isTeam1 ? 'text-blue-300' : 'text-purple-300'}`}>
                                {language === 'fr' ? 'Rejoignez votre salon vocal !' : 'Join your voice channel!'}
                              </span>
                            </div>
                            <p className="text-gray-400 text-xs text-center mb-3">
                              {language === 'fr' 
                                ? 'Votre salon vocal est prêt. Rejoignez-le dès maintenant !' 
                                : 'Your voice channel is ready. Join now!'}
                            </p>
                            <a
                              href={`https://discord.com/channels/1448744757261070467/${myChannel.channelId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all hover:scale-[1.02] ${isTeam1 ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                              </svg>
                              <span>{myChannel.channelName}</span>
                              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                            </a>
                          </div>
                        );
                      }
                      
                      // Fallback: show general Discord invite if no voice channel
                      return (
                        <div className="p-4 rounded-xl border bg-indigo-500/10 border-indigo-500/30">
                          <div className="flex items-center justify-center gap-2 mb-3">
                            <svg className="w-6 h-6 text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                            </svg>
                            <span className="text-indigo-300 font-bold text-sm">
                              {language === 'fr' ? 'Rejoignez le Discord !' : 'Join Discord!'}
                            </span>
                          </div>
                          <p className="text-gray-400 text-xs text-center mb-3">
                            {language === 'fr' 
                              ? 'Préparez-vous pour le match' 
                              : 'Get ready for the match'}
                          </p>
                          <a
                            href="https://discord.gg/JwEaKFjSVR"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all hover:scale-[1.02] bg-indigo-600 hover:bg-indigo-500 text-white"
                          >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                            </svg>
                            {language === 'fr' ? 'Rejoindre le serveur Discord' : 'Join Discord Server'}
                          </a>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Match Dialog */}
      {showActiveMatchDialog && savedActiveMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className={`bg-dark-900 rounded-2xl border ${isHardcore ? 'border-red-500/30' : 'border-cyan-500/30'} p-6 max-w-md w-full shadow-2xl`}>
            <div className="text-center mb-6">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-gradient-to-br ${isHardcore ? 'from-red-500 to-orange-600' : 'from-cyan-400 to-blue-600'}`}>
                <Swords className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                {t.activeMatchFound}
              </h3>
              <p className="text-gray-400 text-sm mb-1">
                {t.activeMatchFoundDesc}
              </p>
              {savedActiveMatch.mode && (
                <p className="text-xs text-gray-500 mt-2">
                  {t.matchMode}: <span className={`font-semibold ${savedActiveMatch.mode === 'hardcore' ? 'text-red-400' : 'text-cyan-400'}`}>
                    {savedActiveMatch.mode === 'hardcore' ? 'Hardcore' : 'CDL'}
                  </span>
                </p>
              )}
            </div>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  if (savedActiveMatch.mode && savedActiveMatch.mode !== selectedMode) {
                    selectMode(savedActiveMatch.mode);
                  }
                  navigate(`/ranked/match/${savedActiveMatch._id}`);
                  setShowActiveMatchDialog(false);
                }}
                className={`w-full py-4 rounded-xl bg-gradient-to-r ${isHardcore ? 'from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700' : 'from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700'} text-white font-bold text-lg shadow-xl transition-all flex items-center justify-center gap-3 group`}
              >
                <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
                {t.joinMatchSheet}
              </button>
              
              <button
                onClick={() => setShowActiveMatchDialog(false)}
                className="w-full py-3 rounded-xl bg-dark-800 hover:bg-dark-700 text-gray-400 hover:text-white font-medium transition-all"
              >
                {t.stayOnPage}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RankedMode;
