import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, TrendingDown, X, Trophy, Shield, Crown, 
  Star, ChevronRight, ArrowRight, Users, Check, Loader2, Crosshair
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { getUserAvatar } from '../utils/avatar';
import { API_URL } from '../config';

// Combat report sound
const COMBAT_REPORT_SOUND = '/soundRapport.mp3';

// Stricker Ranks
const STRICKER_RANKS = [
  { name: 'Recrues', min: 0, max: 249, gradient: 'from-lime-600 to-green-700', image: '/stricker1.png' },
  { name: 'Opérateurs', min: 250, max: 499, gradient: 'from-lime-500 to-green-600', image: '/stricker2.png' },
  { name: 'Vétérans', min: 500, max: 749, gradient: 'from-lime-400 to-green-500', image: '/stricker3.png' },
  { name: 'Commandants', min: 750, max: 999, gradient: 'from-green-400 to-emerald-500', image: '/stricker4.png' },
  { name: 'Seigneurs de Guerre', min: 1000, max: 1499, gradient: 'from-emerald-400 to-teal-500', image: '/stricker5.png' },
  { name: 'Immortel', min: 1500, max: 99999, gradient: 'from-teal-400 via-emerald-500 to-lime-600', image: '/stricker6.png' }
];

const getRankFromPoints = (points) => {
  for (const rank of [...STRICKER_RANKS].reverse()) {
    if (points >= rank.min) return rank;
  }
  return STRICKER_RANKS[0];
};

const StrickerMatchReport = ({ 
  show, 
  onClose, 
  isWinner, 
  rewards, 
  oldRank,
  newRank,
  matchId,
  isReferent = false,
  isMvp = false,
  mvpBonus = 5,
  mvpPlayer = null,
  // MVP voting props
  players = [],
  mvpVotingActive = false,
  mvpConfirmed = false,
  mvpVotes = [],
  onMvpVote = null,
  isTestMatch = false,
  // Team info for MVP voting rules
  winningTeam = null,
  userTeam = null,
  // Squad info
  squadName = '',
  cranesEarned = 0
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const [animationStep, setAnimationStep] = useState(0);
  const [progressAnimation, setProgressAnimation] = useState(0);
  const [submittingMvpVote, setSubmittingMvpVote] = useState(false);
  const audioRef = useRef(null);
  
  // Play sound when combat report is shown
  useEffect(() => {
    if (show) {
      const audio = new Audio(COMBAT_REPORT_SOUND);
      audio.volume = 0.1;
      audioRef.current = audio;
      
      audio.play().catch(err => {
        console.warn('[StrickerMatchReport] Audio play failed:', err);
      });
      
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
      voteSubtitle: 'Sélectionnez le meilleur joueur de l\'équipe gagnante',
      votingProgress: 'Votes MVP',
      waitingVotes: 'En attente des autres votes...',
      mvpElected: 'MVP ÉLU',
      youVoted: 'Vous avez voté',
      votes: 'votes',
      mustVote: 'Vous devez voter pour continuer',
      onlyLosingTeam: 'Seule l\'équipe perdante peut voter'
    },
    en: {
      voteTitle: 'Vote for MVP',
      voteSubtitle: 'Select the best player from the winning team',
      votingProgress: 'MVP Votes',
      waitingVotes: 'Waiting for other votes...',
      mvpElected: 'MVP ELECTED',
      youVoted: 'You voted',
      votes: 'votes',
      mustVote: 'You must vote to continue',
      onlyLosingTeam: 'Only the losing team can vote'
    }
  };
  
  const t = mvpT[language] || mvpT.fr;
  
  // Calculate ranks
  const oldPoints = oldRank?.points || 0;
  const newPoints = newRank?.points || rewards?.newPoints || 0;
  const oldRankData = getRankFromPoints(oldPoints);
  const newRankData = getRankFromPoints(newPoints);
  const didRankUp = newRankData.min > oldRankData.min;
  const didRankDown = newRankData.min < oldRankData.min;
  
  // Progress to next rank
  const progressToNext = newRankData.max !== 99999 
    ? ((newPoints - newRankData.min) / (newRankData.max - newRankData.min + 1)) * 100 
    : 100;
  
  // Check if user is from losing team (can vote)
  const losingTeam = winningTeam === 1 ? 2 : 1;
  const canVoteForMvp = userTeam === losingTeam && mvpVotingActive && !mvpConfirmed;
  
  // Check if user already voted
  const userMvpVote = mvpVotes?.find(v => 
    v.voter && (v.voter._id || v.voter).toString() === (user?._id?.toString() || user?.id?.toString())
  );
  
  // Get winning team players for MVP voting
  const winningTeamPlayers = players.filter(p => p.team === winningTeam && !p.isFake && p.user);
  
  // Handle MVP vote
  const handleMvpVoteClick = async (playerId) => {
    if (!onMvpVote || submittingMvpVote || userMvpVote) return;
    
    setSubmittingMvpVote(true);
    try {
      await onMvpVote(playerId);
    } finally {
      setSubmittingMvpVote(false);
    }
  };
  
  // Animation steps
  useEffect(() => {
    if (show) {
      setAnimationStep(0);
      setProgressAnimation(0);
      
      const timer1 = setTimeout(() => setAnimationStep(1), 300);
      const timer2 = setTimeout(() => setAnimationStep(2), 800);
      const timer3 = setTimeout(() => setAnimationStep(3), 1300);
      const timer4 = setTimeout(() => {
        setAnimationStep(4);
        // Animate progress bar
        let progress = 0;
        const progressInterval = setInterval(() => {
          progress += 2;
          setProgressAnimation(Math.min(progress, progressToNext));
          if (progress >= progressToNext) clearInterval(progressInterval);
        }, 20);
      }, 1800);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        clearTimeout(timer4);
      };
    }
  }, [show, progressToNext]);
  
  // Close handler - check if MVP vote is required
  const handleClose = () => {
    // If user is from losing team and hasn't voted yet, don't allow close
    if (canVoteForMvp && !userMvpVote && !isTestMatch) {
      return; // Must vote first
    }
    onClose();
  };
  
  if (!show) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-sm">
      <div 
        className={`relative w-full max-w-lg bg-gradient-to-b ${
          isWinner ? 'from-lime-900/50 to-dark-900' : 'from-red-900/50 to-dark-900'
        } rounded-2xl sm:rounded-3xl border-2 ${
          isWinner ? 'border-lime-500/50' : 'border-red-500/50'
        } shadow-2xl overflow-hidden`}
        style={{
          animation: animationStep >= 1 ? 'slideUp 0.5s ease-out forwards' : 'none',
          opacity: animationStep >= 1 ? 1 : 0,
          transform: animationStep >= 1 ? 'translateY(0)' : 'translateY(50px)'
        }}
      >
        {/* Close button - disabled if MVP vote required */}
        <button
          onClick={handleClose}
          disabled={canVoteForMvp && !userMvpVote && !isTestMatch}
          className={`absolute top-3 right-3 sm:top-4 sm:right-4 z-10 p-2 rounded-full transition-colors ${
            canVoteForMvp && !userMvpVote && !isTestMatch
              ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
              : 'bg-dark-800/50 hover:bg-dark-700 text-gray-400 hover:text-white'
          }`}
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* Header with result */}
        <div 
          className={`relative py-4 sm:py-6 px-4 sm:px-8 text-center ${
            isWinner 
              ? 'bg-gradient-to-r from-lime-600/30 via-green-500/30 to-lime-600/30' 
              : 'bg-gradient-to-r from-red-600/30 via-red-500/30 to-red-600/30'
          }`}
          style={{
            animation: animationStep >= 2 ? 'fadeIn 0.5s ease-out forwards' : 'none',
            opacity: animationStep >= 2 ? 1 : 0
          }}
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <Crosshair className={`w-6 h-6 sm:w-8 sm:h-8 ${isWinner ? 'text-lime-400' : 'text-red-400'}`} />
            <h2 className={`text-2xl sm:text-3xl font-black ${isWinner ? 'text-lime-400' : 'text-red-400'}`}>
              {isWinner ? (language === 'fr' ? 'VICTOIRE !' : 'VICTORY!') : (language === 'fr' ? 'DÉFAITE' : 'DEFEAT')}
            </h2>
            <Crosshair className={`w-6 h-6 sm:w-8 sm:h-8 ${isWinner ? 'text-lime-400' : 'text-red-400'}`} />
          </div>
          
          {squadName && (
            <p className="text-gray-300 text-sm">
              {squadName}
            </p>
          )}
          
          {isTestMatch && (
            <div className="mt-2 inline-block px-3 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full">
              <span className="text-yellow-400 text-xs font-bold">🧪 TEST MATCH</span>
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Points Change */}
          <div 
            className="text-center"
            style={{
              animation: animationStep >= 3 ? 'slideUp 0.5s ease-out forwards' : 'none',
              opacity: animationStep >= 3 ? 1 : 0
            }}
          >
            <h3 className="text-white font-bold text-base sm:text-lg mb-3 sm:mb-4">
              {isWinner ? '🎁 Récompenses' : '📉 Points perdus'}
            </h3>
            
            <div className="flex items-center justify-center gap-4">
              {/* Points */}
              <div className={`bg-dark-900/50 rounded-xl p-4 border-2 ${
                (rewards?.pointsChange || 0) >= 0 
                  ? 'border-lime-500/30' 
                  : 'border-red-500/30'
              } ${isMvp ? 'ring-2 ring-yellow-400/50' : ''}`}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  {(rewards?.pointsChange || 0) >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-lime-400" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-400" />
                  )}
                  <span className="text-gray-400 text-sm">Points</span>
                </div>
                <div className={`text-2xl sm:text-3xl font-bold ${
                  (rewards?.pointsChange || 0) >= 0 ? 'text-lime-400' : 'text-red-400'
                }`}>
                  {(rewards?.pointsChange || 0) > 0 ? '+' : ''}{rewards?.pointsChange || 0}
                  {isMvp && (
                    <span className="text-yellow-400 ml-2 text-lg">+{mvpBonus}</span>
                  )}
                </div>
                {isMvp && (
                  <p className="text-yellow-400 text-xs mt-1">⭐ MVP Bonus</p>
                )}
              </div>
              
              {/* Munitions */}
              {cranesEarned > 0 && (
                <div className="bg-dark-900/50 rounded-xl p-4 border-2 border-amber-500/30">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-xl">💀</span>
                    <span className="text-gray-400 text-sm">Munitions</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-amber-400">
                    +{cranesEarned}
                  </div>
                  <p className="text-amber-400/70 text-xs mt-1">Escouade</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Rank Progression */}
          <div 
            className="bg-dark-800/50 rounded-xl p-4 border border-white/10"
            style={{
              animation: animationStep >= 4 ? 'fadeIn 0.5s ease-out forwards' : 'none',
              opacity: animationStep >= 4 ? 1 : 0
            }}
          >
            <h4 className="text-gray-400 text-sm mb-3 text-center">
              {language === 'fr' ? 'Progression' : 'Progression'}
            </h4>
            
            <div className="flex items-center justify-center gap-4 mb-4">
              {/* Old Rank */}
              <div className="text-center">
                <img 
                  src={oldRankData.image} 
                  alt={oldRankData.name} 
                  className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-1 object-contain"
                />
                <p className="text-gray-500 text-xs">{oldRankData.name}</p>
                <p className="text-gray-600 text-xs">{oldPoints} pts</p>
              </div>
              
              {/* Arrow */}
              <ArrowRight className={`w-6 h-6 ${
                didRankUp ? 'text-lime-400' : didRankDown ? 'text-red-400' : 'text-gray-500'
              }`} />
              
              {/* New Rank */}
              <div className="text-center">
                <img 
                  src={newRankData.image} 
                  alt={newRankData.name} 
                  className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-1 object-contain ${
                    didRankUp ? 'animate-bounce' : ''
                  }`}
                />
                <p className={`text-xs font-medium ${
                  didRankUp ? 'text-lime-400' : didRankDown ? 'text-red-400' : 'text-white'
                }`}>
                  {newRankData.name}
                </p>
                <p className={`text-xs ${
                  didRankUp ? 'text-lime-400' : didRankDown ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {newPoints} pts
                </p>
              </div>
            </div>
            
            {/* Progress bar to next rank */}
            {newRankData.max !== 99999 && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{newRankData.min} pts</span>
                  <span>{newRankData.max + 1} pts</span>
                </div>
                <div className="h-2 bg-dark-900 rounded-full overflow-hidden">
                  <div 
                    className={`h-full bg-gradient-to-r ${newRankData.gradient} transition-all duration-500`}
                    style={{ width: `${progressAnimation}%` }}
                  />
                </div>
                <p className="text-center text-xs text-gray-500 mt-1">
                  {newRankData.max + 1 - newPoints} pts {language === 'fr' ? 'pour' : 'to'} {
                    STRICKER_RANKS[STRICKER_RANKS.indexOf(newRankData) + 1]?.name || 'MAX'
                  }
                </p>
              </div>
            )}
            
            {/* Rank up celebration */}
            {didRankUp && (
              <div className="mt-3 p-2 bg-lime-500/20 border border-lime-500/30 rounded-lg text-center">
                <span className="text-lime-400 font-bold text-sm">
                  🎉 {language === 'fr' ? 'RANG SUPÉRIEUR !' : 'RANK UP!'}
                </span>
              </div>
            )}
          </div>
          
          {/* MVP Section */}
          {(mvpVotingActive || mvpConfirmed) && (
            <div 
              className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl p-4"
              style={{
                animation: animationStep >= 4 ? 'fadeIn 0.5s ease-out forwards' : 'none',
                opacity: animationStep >= 4 ? 1 : 0
              }}
            >
              {/* MVP Confirmed */}
              {mvpConfirmed && mvpPlayer && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Star className="w-6 h-6 text-yellow-400 animate-pulse" />
                    <span className="text-yellow-400 font-bold">{t.mvpElected}</span>
                    <Star className="w-6 h-6 text-yellow-400 animate-pulse" />
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <img 
                      src={getUserAvatar(mvpPlayer)}
                      alt={mvpPlayer.username}
                      className="w-12 h-12 rounded-full border-2 border-yellow-400"
                    />
                    <div>
                      <p className="text-white font-bold text-lg">{mvpPlayer.username}</p>
                      <p className="text-yellow-400 text-xs">+{mvpBonus} bonus points</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* MVP Voting */}
              {mvpVotingActive && !mvpConfirmed && (
                <div>
                  <div className="text-center mb-4">
                    <h4 className="text-yellow-400 font-bold">{t.voteTitle}</h4>
                    <p className="text-gray-400 text-xs">{t.voteSubtitle}</p>
                  </div>
                  
                  {/* Can vote - show player list */}
                  {canVoteForMvp && !userMvpVote && (
                    <div className="space-y-2">
                      {winningTeamPlayers.map((player) => {
                        const playerUser = player.user;
                        const playerId = (playerUser._id || playerUser).toString();
                        const votesForPlayer = mvpVotes.filter(v => 
                          (v.votedFor._id || v.votedFor).toString() === playerId
                        ).length;
                        
                        return (
                          <button
                            key={playerId}
                            onClick={() => handleMvpVoteClick(playerId)}
                            disabled={submittingMvpVote}
                            className="w-full flex items-center gap-3 p-3 bg-dark-800/50 hover:bg-dark-700/50 rounded-lg border border-yellow-500/20 hover:border-yellow-500/50 transition-all disabled:opacity-50"
                          >
                            <img 
                              src={getUserAvatar(playerUser)}
                              alt={playerUser.username}
                              className="w-10 h-10 rounded-full border border-yellow-500/30"
                            />
                            <div className="flex-1 text-left">
                              <p className="text-white font-medium">{playerUser.username}</p>
                              {votesForPlayer > 0 && (
                                <p className="text-yellow-400 text-xs">{votesForPlayer} {t.votes}</p>
                              )}
                            </div>
                            {submittingMvpVote ? (
                              <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
                            ) : (
                              <Star className="w-5 h-5 text-yellow-400/50" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Already voted */}
                  {userMvpVote && (
                    <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                      <Check className="w-8 h-8 text-lime-400 mx-auto mb-2" />
                      <p className="text-lime-400 font-medium">{t.youVoted}</p>
                      <p className="text-gray-400 text-sm">{t.waitingVotes}</p>
                    </div>
                  )}
                  
                  {/* Winning team - can't vote */}
                  {userTeam === winningTeam && (
                    <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                      <Trophy className="w-8 h-8 text-lime-400 mx-auto mb-2" />
                      <p className="text-gray-400 text-sm">{t.onlyLosingTeam}</p>
                      <p className="text-gray-500 text-xs">{t.waitingVotes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Must vote warning */}
          {canVoteForMvp && !userMvpVote && !isTestMatch && (
            <div className="text-center p-2 bg-orange-500/20 border border-orange-500/30 rounded-lg">
              <p className="text-orange-400 text-sm font-medium">⚠️ {t.mustVote}</p>
            </div>
          )}
        </div>
      </div>
      
      {/* CSS Animations */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(50px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default StrickerMatchReport;
