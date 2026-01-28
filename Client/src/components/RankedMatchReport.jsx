import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { getAvatarUrl, getUserAvatar } from '../utils/avatar';
import { 
  Trophy, TrendingUp, TrendingDown, Coins, Zap, X, 
  ChevronRight, Star, Shield, Crown, Medal, Flame, ArrowRight, Users, Check, Loader2
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

// Sons aléatoires pour le rapport de combat
const COMBAT_REPORT_SOUNDS = [
  '/sound.mp3',
  '/sound2.mp3',
  '/sound3.mp3',
  '/sound4.mp3',
  '/sound5.mp3'
];

// Définition des rangs par défaut (seuils dynamiques chargés depuis AppSettings)
const DEFAULT_RANKS = [
  { name: 'Bronze', min: 0, max: 499, color: '#CD7F32', gradient: 'from-amber-700 to-amber-900', icon: Shield },
  { name: 'Silver', min: 500, max: 999, color: '#C0C0C0', gradient: 'from-slate-400 to-slate-600', icon: Shield },
  { name: 'Gold', min: 1000, max: 1499, color: '#FFD700', gradient: 'from-yellow-500 to-amber-600', icon: Medal },
  { name: 'Platinum', min: 1500, max: 1999, color: '#00CED1', gradient: 'from-teal-400 to-cyan-600', icon: Medal },
  { name: 'Diamond', min: 2000, max: 2499, color: '#B9F2FF', gradient: 'from-cyan-300 to-blue-500', icon: Star },
  { name: 'Master', min: 2500, max: 2999, color: '#9B59B6', gradient: 'from-purple-500 to-pink-600', icon: Crown },
  { name: 'Grandmaster', min: 3000, max: 3499, color: '#E74C3C', gradient: 'from-red-500 to-orange-600', icon: Flame },
  { name: 'Champion', min: 3500, max: 99999, color: '#F1C40F', gradient: 'from-yellow-400 via-orange-500 to-red-600', icon: Zap },
];

// Styles des rangs (couleurs, gradients, icons)
const RANK_STYLES = {
  bronze: { color: '#CD7F32', gradient: 'from-amber-700 to-amber-900', icon: Shield },
  silver: { color: '#C0C0C0', gradient: 'from-slate-400 to-slate-600', icon: Shield },
  gold: { color: '#FFD700', gradient: 'from-yellow-500 to-amber-600', icon: Medal },
  platinum: { color: '#00CED1', gradient: 'from-teal-400 to-cyan-600', icon: Medal },
  diamond: { color: '#B9F2FF', gradient: 'from-cyan-300 to-blue-500', icon: Star },
  master: { color: '#9B59B6', gradient: 'from-purple-500 to-pink-600', icon: Crown },
  grandmaster: { color: '#E74C3C', gradient: 'from-red-500 to-orange-600', icon: Flame },
  champion: { color: '#F1C40F', gradient: 'from-yellow-400 via-orange-500 to-red-600', icon: Zap },
};

// Construire les rangs depuis les seuils configurés
const buildRanksFromThresholds = (thresholds) => {
  const rankOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'champion'];
  const rankNames = {
    bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum',
    diamond: 'Diamond', master: 'Master', grandmaster: 'Grandmaster', champion: 'Champion'
  };
  
  return rankOrder.map(key => {
    const threshold = thresholds[key];
    const style = RANK_STYLES[key];
    return {
      name: rankNames[key],
      min: threshold?.min ?? DEFAULT_RANKS.find(r => r.name === rankNames[key])?.min ?? 0,
      max: threshold?.max ?? DEFAULT_RANKS.find(r => r.name === rankNames[key])?.max ?? 99999,
      color: style.color,
      gradient: style.gradient,
      icon: style.icon
    };
  });
};

const RankedMatchReport = ({ 
  show, 
  onClose, 
  isWinner, 
  rewards, 
  oldRank, 
  newRank, 
  mode = 'hardcore',
  matchId,
  isReferent = false,
  doublePts = false,
  doubleGold = false,
  isMvp = false,
  mvpBonus = 5,
  mvpPlayer = null,
  // MVP voting props
  players = [],
  mvpVotingActive = false,
  mvpConfirmed = false,
  mvpVotes = [],
  onMvpVote = null,
  isTestMatch = false
}) => {
  const navigate = useNavigate();
  const params = useParams();
  const { user, refreshUser } = useAuth();
  const { language } = useLanguage();
  const [animationStep, setAnimationStep] = useState(0);
  const [progressAnimation, setProgressAnimation] = useState(0);
  const [ranks, setRanks] = useState(DEFAULT_RANKS);
  const [submittingMvpVote, setSubmittingMvpVote] = useState(false);
  const audioRef = useRef(null);
  
  // Play random sound when combat report is shown
  useEffect(() => {
    if (show) {
      // Select a random sound
      const randomIndex = Math.floor(Math.random() * COMBAT_REPORT_SOUNDS.length);
      const soundUrl = COMBAT_REPORT_SOUNDS[randomIndex];
      
      console.log('[RankedMatchReport] 🎵 Playing sound:', soundUrl);
      
      // Create and play audio
      const audio = new Audio(soundUrl);
      audio.volume = 0.5;
      audioRef.current = audio;
      
      audio.play().catch(err => {
        console.warn('[RankedMatchReport] Audio play failed:', err);
      });
      
      // Cleanup on unmount or when report closes
      return () => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
      };
    }
  }, [show]);
  
  // MVP voting translations
  const mvpT = {
    fr: {
      voteTitle: 'Votez pour le MVP',
      voteSubtitle: 'Sélectionnez le meilleur joueur du match',
      votingProgress: 'Votes MVP',
      waitingVotes: 'En attente des autres votes...',
      mvpElected: 'MVP ÉLU',
      youVoted: 'Vous avez voté',
      votes: 'votes'
    },
    en: {
      voteTitle: 'Vote for MVP',
      voteSubtitle: 'Select the best player of the match',
      votingProgress: 'MVP Votes',
      waitingVotes: 'Waiting for other votes...',
      mvpElected: 'MVP ELECTED',
      youVoted: 'You voted',
      votes: 'votes'
    },
    de: {
      voteTitle: 'Für MVP stimmen',
      voteSubtitle: 'Wählen Sie den besten Spieler des Spiels',
      votingProgress: 'MVP-Stimmen',
      waitingVotes: 'Warten auf andere Stimmen...',
      mvpElected: 'MVP GEWÄHLT',
      youVoted: 'Sie haben gewählt',
      votes: 'Stimmen'
    },
    it: {
      voteTitle: 'Vota per MVP',
      voteSubtitle: 'Seleziona il miglior giocatore della partita',
      votingProgress: 'Voti MVP',
      waitingVotes: 'In attesa degli altri voti...',
      mvpElected: 'MVP ELETTO',
      youVoted: 'Hai votato',
      votes: 'voti'
    }
  };
  const t = mvpT[language] || mvpT.fr;
  
  // Charger les seuils de rang depuis AppSettings
  useEffect(() => {
    const fetchRankThresholds = async () => {
      try {
        const response = await fetch(`${API_URL}/app-settings/public`);
        const data = await response.json();
        if (data.success && data.rankedSettings?.rankPointsThresholds) {
          const dynamicRanks = buildRanksFromThresholds(data.rankedSettings.rankPointsThresholds);
          setRanks(dynamicRanks);
          console.log('[RankedMatchReport] Loaded dynamic rank thresholds:', dynamicRanks);
        }
      } catch (err) {
        console.error('[RankedMatchReport] Error loading rank thresholds:', err);
      }
    };
    fetchRankThresholds();
  }, []);
  
  // Log pour debugging
  console.log('[RankedMatchReport] Component rendered');
  console.log('[RankedMatchReport] show:', show);
  console.log('[RankedMatchReport] isWinner:', isWinner);
  console.log('[RankedMatchReport] rewards:', rewards);
  console.log('[RankedMatchReport] oldRank:', oldRank);
  console.log('[RankedMatchReport] newRank:', newRank);
  console.log('[RankedMatchReport] mode:', mode);

  // Calculer les infos de rang (utilise les rangs dynamiques)
  const getRankInfo = (points) => {
    return ranks.find(r => points >= r.min && points <= r.max) || ranks[0];
  };

  const oldRankInfo = getRankInfo(oldRank?.points || 0);
  const newRankInfo = getRankInfo(newRank?.points || 0);
  const currentRankInfo = newRankInfo;

  // Progression dans le rang actuel
  const progressInCurrentRank = newRank?.points 
    ? ((newRank.points - currentRankInfo.min) / (currentRankInfo.max - currentRankInfo.min)) * 100 
    : 0;

  const oldProgressInRank = oldRank?.points 
    ? ((oldRank.points - oldRankInfo.min) / (oldRankInfo.max - oldRankInfo.min)) * 100 
    : 0;

  // Déterminer si on a changé de rang
  const rankChanged = oldRankInfo.name !== newRankInfo.name;
  const rankUp = rankChanged && newRankInfo.min > oldRankInfo.min;
  const rankDown = rankChanged && newRankInfo.min < oldRankInfo.min;

  const RankIcon = currentRankInfo.icon;
  
  // MVP voting helpers
  const realPlayers = players.filter(p => !p.isFake);
  const totalRealPlayers = realPlayers.length;
  const userId = (user?._id || user?.id)?.toString();
  
  // Count votes per player
  const voteCount = {};
  mvpVotes.forEach(v => {
    const votedForId = (v.votedFor?._id || v.votedFor)?.toString();
    if (votedForId) {
      voteCount[votedForId] = (voteCount[votedForId] || 0) + 1;
    }
  });
  
  // Check if current user has voted
  const myVoteObj = mvpVotes.find(v => (v.voter?._id || v.voter)?.toString() === userId);
  const myVote = myVoteObj ? (myVoteObj.votedFor?._id || myVoteObj.votedFor)?.toString() : null;
  const hasVoted = !!myVoteObj;
  
  // Required votes (1 for test matches, all players for normal)
  const requiredVotes = isTestMatch ? 1 : totalRealPlayers;
  
  // Show MVP voting if active and not confirmed
  const showMvpVoting = mvpVotingActive && !mvpConfirmed && onMvpVote;
  
  // Handle MVP vote
  const handleMvpVote = async (mvpPlayerId) => {
    if (!onMvpVote || submittingMvpVote) return;
    setSubmittingMvpVote(true);
    try {
      await onMvpVote(mvpPlayerId);
    } finally {
      setSubmittingMvpVote(false);
    }
  };

  useEffect(() => {
    if (!show) {
      console.log('[RankedMatchReport] Not showing (show=false)');
      return;
    }
    
    console.log('[RankedMatchReport] 🎬 Starting animations!');

    // Animation par étapes
    const timer1 = setTimeout(() => {
      console.log('[RankedMatchReport] Animation step 1');
      setAnimationStep(1);
    }, 300);
    const timer2 = setTimeout(() => {
      console.log('[RankedMatchReport] Animation step 2');
      setAnimationStep(2);
    }, 800);
    const timer3 = setTimeout(() => {
      console.log('[RankedMatchReport] Animation step 3');
      setAnimationStep(3);
    }, 1300);
    
    // Animation de progression de la barre
    const progressTimer = setTimeout(() => {
      let progress = oldProgressInRank;
      const interval = setInterval(() => {
        progress += (progressInCurrentRank - oldProgressInRank) / 50;
        if (progress >= progressInCurrentRank) {
          progress = progressInCurrentRank;
          clearInterval(interval);
        }
        setProgressAnimation(progress);
      }, 20);
    }, 1500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(progressTimer);
    };
  }, [show, oldProgressInRank, progressInCurrentRank]);

  const handleClose = async () => {
    // Rafraîchir les données utilisateur (gold, XP, etc.) avant de fermer
    await refreshUser();
    onClose();
    // Redirection vers le mode classé avec le bon préfixe de mode
    navigate(`/${mode}/ranked`);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center bg-black/90 backdrop-blur-sm overflow-y-auto py-4 sm:py-8">
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-pink-900/20 pointer-events-none" />

      {/* Modal */}
      <div 
        className={`relative w-full max-w-2xl mx-3 sm:mx-4 my-auto transform transition-all duration-500 ${
          animationStep >= 1 ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        }`}
      >
        {/* Carte principale */}
        <div className={`relative bg-gradient-to-br ${
          isWinner 
            ? 'from-green-900/40 to-emerald-900/40 border-green-500/50' 
            : 'from-red-900/40 to-orange-900/40 border-red-500/50'
        } border-2 rounded-xl sm:rounded-2xl p-4 sm:p-8 backdrop-blur-xl shadow-2xl max-h-[90vh] sm:max-h-none overflow-y-auto`}>
          
          {/* Bouton fermer */}
          <button
            onClick={handleClose}
            className="absolute top-2 right-2 sm:top-4 sm:right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors z-10"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {/* Header - Victoire ou Défaite */}
          <div className="text-center mb-4 sm:mb-8">
            <div className={`inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 rounded-full ${
              isWinner 
                ? 'bg-green-500/20 border-2 border-green-500/50' 
                : 'bg-red-500/20 border-2 border-red-500/50'
            }`}>
              {isWinner ? (
                <>
                  <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400" />
                  <span className="text-xl sm:text-2xl font-bold text-white">VICTOIRE</span>
                  <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400" />
                </>
              ) : (
                <>
                  <TrendingDown className="w-6 h-6 sm:w-8 sm:h-8 text-red-400" />
                  <span className="text-xl sm:text-2xl font-bold text-white">DÉFAITE</span>
                  <TrendingDown className="w-6 h-6 sm:w-8 sm:h-8 text-red-400" />
                </>
              )}
            </div>
          </div>

          {/* Récompenses */}
          <div 
            className={`mb-4 sm:mb-8 transition-all duration-500 delay-300 ${
              animationStep >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <h3 className="text-white font-bold text-base sm:text-lg mb-3 sm:mb-4 text-center">
              {isWinner ? '🎁 Récompenses Obtenues' : '💔 Pertes et Consolations'}
            </h3>
            
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {/* Points Ladder */}
              <div className={`bg-dark-900/50 rounded-lg sm:rounded-xl p-2 sm:p-4 border-2 ${
                (rewards?.pointsChange || 0) >= 0 
                  ? 'border-purple-500/30' 
                  : 'border-red-500/30'
              } ${doublePts && isWinner ? 'ring-2 ring-yellow-400/50' : ''} ${isMvp ? 'ring-2 ring-yellow-400/50' : ''}`}>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                  {(rewards?.pointsChange || 0) >= 0 ? (
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                  )}
                  <span className="text-gray-400 text-[10px] sm:text-sm text-center">Points</span>
                  {doublePts && isWinner && (
                    <span className="px-1 py-0.5 bg-yellow-500/30 text-yellow-400 text-[8px] sm:text-[10px] font-bold rounded animate-pulse">x2</span>
                  )}
                </div>
                <div className={`text-lg sm:text-2xl font-bold text-center ${
                  (rewards?.pointsChange || 0) >= 0 ? 'text-purple-400' : 'text-red-400'
                }`}>
                  {(rewards?.pointsChange || 0) > 0 ? '+' : ''}{rewards?.pointsChange || 0}
                  {isMvp && (
                    <span className="text-yellow-400 ml-1 text-sm sm:text-base">+{mvpBonus}</span>
                  )}
                </div>
                <p className={`text-[10px] sm:text-xs text-center mt-1 ${
                  isMvp ? 'text-yellow-400/70' : ((rewards?.pointsChange || 0) >= 0 ? 'text-green-400/70' : 'text-red-400/70')
                }`}>
                  {isMvp ? '⭐ MVP' : (doublePts && isWinner ? '🔥 Boosté' : ((rewards?.pointsChange || 0) >= 0 ? '🏆 Gagné' : '📉 Perdu'))}
                </p>
              </div>

              {/* Gold */}
              <div className={`bg-dark-900/50 rounded-lg sm:rounded-xl p-2 sm:p-4 border-2 ${
                isWinner ? 'border-yellow-500/30' : 'border-orange-500/30'
              } ${doubleGold && isWinner ? 'ring-2 ring-yellow-400/50' : ''}`}>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                  <Coins className={`w-4 h-4 sm:w-5 sm:h-5 ${isWinner ? 'text-yellow-400' : 'text-orange-400'}`} />
                  <span className="text-gray-400 text-[10px] sm:text-sm text-center">Gold</span>
                  {doubleGold && isWinner && (
                    <span className="px-1 py-0.5 bg-yellow-500/30 text-yellow-400 text-[8px] sm:text-[10px] font-bold rounded animate-pulse">x2</span>
                  )}
                </div>
                <div className={`text-lg sm:text-2xl font-bold text-center ${
                  isWinner ? 'text-yellow-400' : 'text-orange-400'
                }`}>
                  +{rewards?.goldEarned || 0}
                </div>
                <p className={`text-[10px] sm:text-xs text-center mt-1 ${isWinner ? 'text-yellow-400/70' : 'text-orange-400/70'}`}>
                  {doubleGold && isWinner ? '🔥 Boosté' : (isWinner ? '💰 Récompense' : '🎁 Consolation')}
                </p>
              </div>

              {/* XP */}
              <div className={`bg-dark-900/50 rounded-lg sm:rounded-xl p-2 sm:p-4 border-2 ${
                (rewards?.xpEarned || 0) > 0 
                  ? 'border-cyan-500/30' 
                  : 'border-gray-500/30'
              }`}>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                  <Zap className={`w-4 h-4 sm:w-5 sm:h-5 ${
                    (rewards?.xpEarned || 0) > 0 ? 'text-cyan-400' : 'text-gray-500'
                  }`} />
                  <span className="text-gray-400 text-[10px] sm:text-sm text-center">XP</span>
                </div>
                <div className={`text-lg sm:text-2xl font-bold text-center ${
                  (rewards?.xpEarned || 0) > 0 ? 'text-cyan-400' : 'text-gray-500'
                }`}>
                  {(rewards?.xpEarned || 0) > 0 ? '+' : ''}{rewards?.xpEarned || 0}
                </div>
                <p className={`text-[10px] sm:text-xs text-center mt-1 ${(rewards?.xpEarned || 0) > 0 ? 'text-cyan-400/70' : 'text-gray-500'}`}>
                  {(rewards?.xpEarned || 0) > 0 ? '⚡ XP gagnée' : '❌ Aucune'}
                </p>
              </div>
            </div>
            
            {/* MVP Bonus Section */}
            {isMvp && (
              <div className="mt-4 p-4 bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-yellow-500/20 border-2 border-yellow-500/50 rounded-xl relative overflow-hidden">
                {/* Animated background */}
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-yellow-500/10 animate-pulse" />
                
                <div className="relative flex items-center justify-center gap-4">
                  <div className="relative">
                    <Star className="w-10 h-10 text-yellow-400 animate-bounce" />
                    <div className="absolute inset-0 blur-md bg-yellow-400/50" />
                  </div>
                  
                  <div className="text-center">
                    <p className="text-yellow-400 font-bold text-lg">MVP DU MATCH !</p>
                    <p className="text-white text-sm">Vous avez été élu meilleur joueur</p>
                    <div className="mt-2 inline-flex items-center gap-2 px-4 py-1 bg-yellow-500/30 rounded-full">
                      <TrendingUp className="w-4 h-4 text-yellow-400" />
                      <span className="text-yellow-400 font-bold">+{mvpBonus} pts bonus</span>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <Star className="w-10 h-10 text-yellow-400 animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="absolute inset-0 blur-md bg-yellow-400/50" />
                  </div>
                </div>
              </div>
            )}
            
            {/* MVP Voting Section */}
            {showMvpVoting && (
              <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-purple-500/20 border-2 border-purple-500/50 rounded-lg sm:rounded-xl relative">
                <div className="text-center mb-3 sm:mb-4">
                  <div className="flex items-center justify-center gap-2 mb-1 sm:mb-2">
                    <Star className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
                    <h3 className="text-white font-bold text-base sm:text-lg">{t.voteTitle}</h3>
                    <Star className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
                  </div>
                  <p className="text-gray-400 text-xs sm:text-sm">{t.voteSubtitle}</p>
                  <p className="text-purple-400 text-xs mt-1">
                    {t.votingProgress}: {mvpVotes.length}/{requiredVotes}
                  </p>
                </div>
                
                {!hasVoted ? (
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {realPlayers.map((p, idx) => {
                      const player = p.user || p;
                      const playerId = (player._id || player.id || p._id)?.toString();
                      // Build avatar URL properly
                      const avatar = player.avatarUrl || player.avatar 
                        ? (player.avatarUrl || player.avatar).startsWith('/uploads/')
                          ? `https://api-nomercy.ggsecure.io${player.avatarUrl || player.avatar}`
                          : (player.avatarUrl || player.avatar)
                        : player.discordAvatar && player.discordId
                          ? `https://cdn.discordapp.com/avatars/${player.discordId}/${player.discordAvatar}.png`
                          : `https://ui-avatars.com/api/?name=${encodeURIComponent((player.username || p.username || 'U').charAt(0))}&background=6366f1&color=fff&size=128&bold=true`;
                      const playerVotes = voteCount[playerId] || 0;
                      
                      return (
                        <button
                          key={idx}
                          onClick={() => handleMvpVote(playerId)}
                          disabled={submittingMvpVote}
                          className="flex flex-col items-center p-2 sm:p-3 rounded-lg bg-dark-800/50 border border-white/10 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all disabled:opacity-50 active:scale-95"
                        >
                          <img
                            src={avatar}
                            alt=""
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-purple-500/50 mb-1 sm:mb-2"
                          />
                          <span className="text-white text-xs sm:text-sm font-medium truncate max-w-full">
                            {player.username || p.username}
                          </span>
                          {playerVotes > 0 && (
                            <span className="text-purple-400 text-[10px] sm:text-xs mt-1">
                              {playerVotes} {t.votes}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-3 sm:py-4">
                    <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg mb-2 sm:mb-3">
                      <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                      <span className="text-green-400 font-medium text-sm sm:text-base">{t.youVoted}</span>
                    </div>
                    <p className="text-gray-400 text-xs sm:text-sm flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t.waitingVotes}
                    </p>
                    <p className="text-purple-400 text-xs mt-2">
                      {mvpVotes.length}/{requiredVotes} {t.votes}
                    </p>
                  </div>
                )}
                
                {submittingMvpVote && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                    <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                  </div>
                )}
              </div>
            )}
            
            {/* MVP Confirmed Display (when voting just completed but not current user) */}
            {mvpConfirmed && mvpPlayer && !isMvp && (
              <div className="mt-4 p-4 bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-yellow-500/10 border-2 border-yellow-500/30 rounded-xl">
                <div className="flex items-center justify-center gap-3">
                  <Star className="w-6 h-6 text-yellow-400" />
                  <div className="text-center">
                    <p className="text-yellow-400 font-bold">{t.mvpElected}</p>
                    <p className="text-white font-medium">
                      {mvpPlayer.username || mvpPlayer}
                    </p>
                  </div>
                  <Star className="w-6 h-6 text-yellow-400" />
                </div>
              </div>
            )}
          </div>

          {/* Rang et Progression */}
          <div 
            className={`transition-all duration-500 delay-500 ${
              animationStep >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <div className="bg-dark-900/50 rounded-lg sm:rounded-xl p-3 sm:p-6 border-2 border-white/10">
              {/* Changement de rang */}
              {rankChanged && (
                <div className="mb-4 sm:mb-6 text-center">
                  <div className={`inline-flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full ${
                    rankUp 
                      ? 'bg-green-500/20 border border-green-500/50' 
                      : 'bg-red-500/20 border border-red-500/50'
                  }`}>
                    <span className="text-white font-semibold text-sm sm:text-base">
                      {rankUp ? '🎉 PROMOTION !' : '📉 Rétrogradation'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-center gap-3 sm:gap-4 mt-3 sm:mt-4">
                    <div className="text-center">
                      <div className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-1 sm:mb-2 rounded-full bg-gradient-to-br ${oldRankInfo.gradient} flex items-center justify-center`}>
                        {React.createElement(oldRankInfo.icon, { className: 'w-6 h-6 sm:w-8 sm:h-8 text-white' })}
                      </div>
                      <span className="text-gray-400 text-xs sm:text-sm">{oldRankInfo.name}</span>
                    </div>
                    
                    <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    
                    <div className="text-center">
                      <div className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-1 sm:mb-2 rounded-full bg-gradient-to-br ${newRankInfo.gradient} flex items-center justify-center animate-pulse`}>
                        {React.createElement(newRankInfo.icon, { className: 'w-6 h-6 sm:w-8 sm:h-8 text-white' })}
                      </div>
                      <span className="text-white font-bold text-xs sm:text-sm">{newRankInfo.name}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Rang actuel et progression */}
              <div>
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br ${currentRankInfo.gradient} flex items-center justify-center flex-shrink-0`}>
                      <RankIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-white font-bold text-sm sm:text-base">{currentRankInfo.name}</div>
                      <div className="text-gray-400 text-xs sm:text-sm">
                        {newRank?.points || 0} / {currentRankInfo.max + 1} points
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right flex-shrink-0">
                    <div className="text-white font-bold text-sm sm:text-lg">
                      {oldRank?.points || 0} <ChevronRight className="inline w-3 h-3 sm:w-4 sm:h-4" /> {newRank?.points || 0}
                    </div>
                    <div className="text-gray-400 text-[10px] sm:text-sm">
                      {Math.round(progressInCurrentRank)}% vers {ranks[ranks.findIndex(r => r.name === currentRankInfo.name) + 1]?.name || 'Max'}
                    </div>
                  </div>
                </div>

                {/* Barre de progression animée */}
                <div className="relative h-2 sm:h-3 bg-dark-800 rounded-full overflow-hidden">
                  <div 
                    className={`absolute inset-y-0 left-0 bg-gradient-to-r ${currentRankInfo.gradient} transition-all duration-1000 ease-out`}
                    style={{ width: `${progressAnimation}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="mt-4 sm:mt-8 flex justify-center pb-2">
            {/* Bouton continuer */}
            <button
              onClick={handleClose}
              className={`px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-bold text-white transition-all hover:scale-105 active:scale-95 text-sm sm:text-base ${
                isWinner 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700' 
                  : 'bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700'
              }`}
            >
              Continuer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RankedMatchReport;
