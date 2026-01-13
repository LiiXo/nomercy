import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { 
  Trophy, TrendingUp, TrendingDown, Coins, Zap, X, 
  ChevronRight, Star, Shield, Crown, Medal, Flame, ArrowRight, AlertTriangle, Loader2
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

// Définition des rangs (même que RankedMode.jsx)
const RANKS = [
  { name: 'Bronze', min: 0, max: 499, color: '#CD7F32', gradient: 'from-amber-700 to-amber-900', icon: Shield },
  { name: 'Silver', min: 500, max: 999, color: '#C0C0C0', gradient: 'from-slate-400 to-slate-600', icon: Shield },
  { name: 'Gold', min: 1000, max: 1499, color: '#FFD700', gradient: 'from-yellow-500 to-amber-600', icon: Medal },
  { name: 'Platinum', min: 1500, max: 1999, color: '#00CED1', gradient: 'from-teal-400 to-cyan-600', icon: Medal },
  { name: 'Diamond', min: 2000, max: 2499, color: '#B9F2FF', gradient: 'from-cyan-300 to-blue-500', icon: Star },
  { name: 'Master', min: 2500, max: 2999, color: '#9B59B6', gradient: 'from-purple-500 to-pink-600', icon: Crown },
  { name: 'Grandmaster', min: 3000, max: 3499, color: '#E74C3C', gradient: 'from-red-500 to-orange-600', icon: Flame },
  { name: 'Champion', min: 3500, max: 99999, color: '#F1C40F', gradient: 'from-yellow-400 via-orange-500 to-red-600', icon: Zap },
];

const RankedMatchReport = ({ 
  show, 
  onClose, 
  isWinner, 
  rewards, 
  oldRank, 
  newRank, 
  mode = 'hardcore',
  matchId,
  isReferent = false
}) => {
  const navigate = useNavigate();
  const params = useParams();
  const { refreshUser } = useAuth();
  const [animationStep, setAnimationStep] = useState(0);
  const [progressAnimation, setProgressAnimation] = useState(0);
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [disputeError, setDisputeError] = useState(null);
  const [disputeSuccess, setDisputeSuccess] = useState(false);
  
  // Log pour debugging
  console.log('[RankedMatchReport] Component rendered');
  console.log('[RankedMatchReport] show:', show);
  console.log('[RankedMatchReport] isWinner:', isWinner);
  console.log('[RankedMatchReport] rewards:', rewards);
  console.log('[RankedMatchReport] oldRank:', oldRank);
  console.log('[RankedMatchReport] newRank:', newRank);
  console.log('[RankedMatchReport] mode:', mode);

  // Calculer les infos de rang
  const getRankInfo = (points) => {
    return RANKS.find(r => points >= r.min && points <= r.max) || RANKS[0];
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

  // Fonction pour créer un litige
  const handleCreateDispute = async () => {
    const mId = matchId || params?.matchId;
    if (!mId) return;

    setDisputeLoading(true);
    setDisputeError(null);

    try {
      const response = await fetch(`${API_URL}/ranked-matches/${mId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          reason: 'Litige signalé depuis le rapport de match' 
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setDisputeSuccess(true);
        // Après 2 secondes, rediriger vers mes litiges
        setTimeout(() => {
          onClose();
          navigate('/my-disputes');
        }, 2000);
      } else {
        setDisputeError(data.message || 'Erreur lors de la création du litige');
      }
    } catch (err) {
      console.error('Error creating dispute:', err);
      setDisputeError('Erreur de connexion');
    } finally {
      setDisputeLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-pink-900/20" />

      {/* Modal */}
      <div 
        className={`relative w-full max-w-2xl mx-4 transform transition-all duration-500 ${
          animationStep >= 1 ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        }`}
      >
        {/* Carte principale */}
        <div className={`relative bg-gradient-to-br ${
          isWinner 
            ? 'from-green-900/40 to-emerald-900/40 border-green-500/50' 
            : 'from-red-900/40 to-orange-900/40 border-red-500/50'
        } border-2 rounded-2xl p-8 backdrop-blur-xl shadow-2xl`}>
          
          {/* Bouton fermer */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {/* Header - Victoire ou Défaite */}
          <div className="text-center mb-8">
            <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full ${
              isWinner 
                ? 'bg-green-500/20 border-2 border-green-500/50' 
                : 'bg-red-500/20 border-2 border-red-500/50'
            }`}>
              {isWinner ? (
                <>
                  <Trophy className="w-8 h-8 text-yellow-400" />
                  <span className="text-2xl font-bold text-white">VICTOIRE</span>
                  <Trophy className="w-8 h-8 text-yellow-400" />
                </>
              ) : (
                <>
                  <TrendingDown className="w-8 h-8 text-red-400" />
                  <span className="text-2xl font-bold text-white">DÉFAITE</span>
                  <TrendingDown className="w-8 h-8 text-red-400" />
                </>
              )}
            </div>
          </div>

          {/* Récompenses */}
          <div 
            className={`mb-8 transition-all duration-500 delay-300 ${
              animationStep >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <h3 className="text-white font-bold text-lg mb-4 text-center">
              {isWinner ? '🎁 Récompenses Obtenues' : '💔 Pertes et Consolations'}
            </h3>
            
            <div className="grid grid-cols-3 gap-4">
              {/* Points Ladder */}
              <div className={`bg-dark-900/50 rounded-xl p-4 border-2 ${
                (rewards?.pointsChange || 0) >= 0 
                  ? 'border-purple-500/30' 
                  : 'border-red-500/30'
              }`}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  {(rewards?.pointsChange || 0) >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-purple-400" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-400" />
                  )}
                  <span className="text-gray-400 text-sm">Points Ladder</span>
                </div>
                <div className={`text-2xl font-bold text-center ${
                  (rewards?.pointsChange || 0) >= 0 ? 'text-purple-400' : 'text-red-400'
                }`}>
                  {(rewards?.pointsChange || 0) > 0 ? '+' : ''}{rewards?.pointsChange || 0}
                </div>
                <p className={`text-xs text-center mt-1 ${(rewards?.pointsChange || 0) >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                  {(rewards?.pointsChange || 0) >= 0 ? '🏆 Gagné' : '📉 Perdu'}
                </p>
              </div>

              {/* Gold */}
              <div className={`bg-dark-900/50 rounded-xl p-4 border-2 ${
                isWinner ? 'border-yellow-500/30' : 'border-orange-500/30'
              }`}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Coins className={`w-5 h-5 ${isWinner ? 'text-yellow-400' : 'text-orange-400'}`} />
                  <span className="text-gray-400 text-sm">
                    {isWinner ? 'Gold Gagné' : 'Gold Consolation'}
                  </span>
                </div>
                <div className={`text-2xl font-bold text-center ${
                  isWinner ? 'text-yellow-400' : 'text-orange-400'
                }`}>
                  +{rewards?.goldEarned || 0}
                </div>
                <p className={`text-xs text-center mt-1 ${isWinner ? 'text-yellow-400/70' : 'text-orange-400/70'}`}>
                  {isWinner ? '💰 Récompense' : '🎁 Lot de consolation'}
                </p>
              </div>

              {/* XP */}
              <div className={`bg-dark-900/50 rounded-xl p-4 border-2 ${
                (rewards?.xpEarned || 0) > 0 
                  ? 'border-cyan-500/30' 
                  : 'border-gray-500/30'
              }`}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Zap className={`w-5 h-5 ${
                    (rewards?.xpEarned || 0) > 0 ? 'text-cyan-400' : 'text-gray-500'
                  }`} />
                  <span className="text-gray-400 text-sm">XP Top Player</span>
                </div>
                <div className={`text-2xl font-bold text-center ${
                  (rewards?.xpEarned || 0) > 0 ? 'text-cyan-400' : 'text-gray-500'
                }`}>
                  {(rewards?.xpEarned || 0) > 0 ? '+' : ''}{rewards?.xpEarned || 0}
                </div>
                <p className={`text-xs text-center mt-1 ${(rewards?.xpEarned || 0) > 0 ? 'text-cyan-400/70' : 'text-gray-500'}`}>
                  {(rewards?.xpEarned || 0) > 0 ? '⚡ Expérience gagnée' : '❌ Aucune XP'}
                </p>
              </div>
            </div>
          </div>

          {/* Rang et Progression */}
          <div 
            className={`transition-all duration-500 delay-500 ${
              animationStep >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <div className="bg-dark-900/50 rounded-xl p-6 border-2 border-white/10">
              {/* Changement de rang */}
              {rankChanged && (
                <div className="mb-6 text-center">
                  <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-full ${
                    rankUp 
                      ? 'bg-green-500/20 border border-green-500/50' 
                      : 'bg-red-500/20 border border-red-500/50'
                  }`}>
                    <span className="text-white font-semibold">
                      {rankUp ? '🎉 PROMOTION !' : '📉 Rétrogradation'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-center gap-4 mt-4">
                    <div className="text-center">
                      <div className={`w-16 h-16 mx-auto mb-2 rounded-full bg-gradient-to-br ${oldRankInfo.gradient} flex items-center justify-center`}>
                        {React.createElement(oldRankInfo.icon, { className: 'w-8 h-8 text-white' })}
                      </div>
                      <span className="text-gray-400 text-sm">{oldRankInfo.name}</span>
                    </div>
                    
                    <ArrowRight className="w-6 h-6 text-white" />
                    
                    <div className="text-center">
                      <div className={`w-16 h-16 mx-auto mb-2 rounded-full bg-gradient-to-br ${newRankInfo.gradient} flex items-center justify-center animate-pulse`}>
                        {React.createElement(newRankInfo.icon, { className: 'w-8 h-8 text-white' })}
                      </div>
                      <span className="text-white font-bold text-sm">{newRankInfo.name}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Rang actuel et progression */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${currentRankInfo.gradient} flex items-center justify-center`}>
                      <RankIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="text-white font-bold">{currentRankInfo.name}</div>
                      <div className="text-gray-400 text-sm">
                        {newRank?.points || 0} / {currentRankInfo.max + 1} points
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-white font-bold text-lg">
                      {oldRank?.points || 0} <ChevronRight className="inline w-4 h-4" /> {newRank?.points || 0}
                    </div>
                    <div className="text-gray-400 text-sm">
                      {Math.round(progressInCurrentRank)}% vers {RANKS[RANKS.findIndex(r => r.name === currentRankInfo.name) + 1]?.name || 'Max'}
                    </div>
                  </div>
                </div>

                {/* Barre de progression animée */}
                <div className="relative h-3 bg-dark-800 rounded-full overflow-hidden">
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

          {/* Message de succès/erreur du litige */}
          {disputeSuccess && (
            <div className="mt-4 p-4 rounded-xl bg-green-500/20 border border-green-500/30 text-center">
              <p className="text-green-400 font-medium">✅ Litige créé avec succès ! Redirection...</p>
            </div>
          )}
          {disputeError && (
            <div className="mt-4 p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-center">
              <p className="text-red-400 font-medium">{disputeError}</p>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            {/* Bouton litige - uniquement pour les référents */}
            {isReferent && !disputeSuccess && (
              <button
                onClick={handleCreateDispute}
                disabled={disputeLoading}
                className="px-6 py-3 rounded-xl font-semibold text-orange-400 border-2 border-orange-500/50 bg-orange-500/10 hover:bg-orange-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {disputeLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
                Lancer un litige
              </button>
            )}
            
            {/* Bouton continuer */}
            <button
              onClick={handleClose}
              disabled={disputeLoading}
              className={`px-8 py-3 rounded-xl font-bold text-white transition-all hover:scale-105 disabled:opacity-50 ${
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
