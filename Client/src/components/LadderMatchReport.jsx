import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { 
  Trophy, TrendingUp, TrendingDown, Coins, Zap, X, 
  Shield, Star, Users, Crown
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const LadderMatchReport = ({ 
  show, 
  onClose, 
  isWinner, 
  mySquad,
  rewards,
  mode = 'hardcore',
  matchId
}) => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [animationStep, setAnimationStep] = useState(0);

  console.log('[LadderMatchReport] Component rendered');
  console.log('[LadderMatchReport] show:', show);
  console.log('[LadderMatchReport] isWinner:', isWinner);
  console.log('[LadderMatchReport] mySquad:', mySquad);
  console.log('[LadderMatchReport] rewards:', rewards);

  useEffect(() => {
    if (!show) {
      console.log('[LadderMatchReport] Not showing (show=false)');
      return;
    }
    
    console.log('[LadderMatchReport] 🎬 Starting animations!');

    // Animation par étapes
    const timer1 = setTimeout(() => {
      console.log('[LadderMatchReport] Animation step 1');
      setAnimationStep(1);
    }, 300);
    const timer2 = setTimeout(() => {
      console.log('[LadderMatchReport] Animation step 2');
      setAnimationStep(2);
    }, 800);
    const timer3 = setTimeout(() => {
      console.log('[LadderMatchReport] Animation step 3');
      setAnimationStep(3);
    }, 1300);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [show]);

  const handleClose = async () => {
    // Rafraîchir les données utilisateur (gold, XP, etc.) avant de fermer
    await refreshUser();
    onClose();
    // Redirection vers l'accueil du mode
    const modeRoute = mode === 'hardcore' ? '/hardcore' : '/cdl';
    navigate(modeRoute);
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

          {/* Récompenses Personnelles */}
          <div 
            className={`mb-8 transition-all duration-500 delay-300 ${
              animationStep >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <h3 className="text-white font-bold text-lg mb-4 text-center">
              {isWinner ? '🎁 Récompenses Personnelles' : '💔 Pertes et Consolations'}
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
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
                  +{rewards?.playerGold || 0}
                </div>
                <p className={`text-xs text-center mt-1 ${isWinner ? 'text-yellow-400/70' : 'text-orange-400/70'}`}>
                  {isWinner ? '💰 Récompense' : '🎁 Lot de consolation'}
                </p>
              </div>

              {/* XP */}
              <div className={`bg-dark-900/50 rounded-xl p-4 border-2 ${
                isWinner 
                  ? 'border-cyan-500/30' 
                  : 'border-gray-500/30'
              }`}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Zap className={`w-5 h-5 ${
                    isWinner ? 'text-cyan-400' : 'text-gray-500'
                  }`} />
                  <span className="text-gray-400 text-sm">XP Top Player</span>
                </div>
                <div className={`text-2xl font-bold text-center ${
                  isWinner ? 'text-cyan-400' : 'text-gray-500'
                }`}>
                  {isWinner ? (
                    rewards?.playerXP > 0 ? `+${rewards.playerXP}` : '+350-550'
                  ) : (
                    '0'
                  )}
                </div>
                <p className={`text-xs text-center mt-1 ${isWinner ? 'text-cyan-400/70' : 'text-gray-500'}`}>
                  {isWinner 
                    ? (rewards?.playerXP > 0 ? '⚡ Expérience gagnée' : '⚡ XP attribué')
                    : '❌ Perdants: pas d\'XP'}
                </p>
              </div>
            </div>
          </div>

          {/* Récompenses Escouade */}
          <div 
            className={`transition-all duration-500 delay-500 ${
              animationStep >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <div className="bg-dark-900/50 rounded-xl p-6 border-2 border-white/10">
              <h3 className="text-white font-bold text-lg mb-4 text-center flex items-center justify-center gap-2">
                <Users className="w-5 h-5" />
                Récompenses Escouade
              </h3>

              {/* Nom de l'escouade */}
              {mySquad && (
                <div className="mb-4 text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg">
                    <Shield className={`w-5 h-5 ${isWinner ? 'text-green-400' : 'text-red-400'}`} />
                    <span className="text-white font-semibold">{mySquad.name}</span>
                    {mySquad.tag && (
                      <span className="text-gray-400 text-sm">[{mySquad.tag}]</span>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Points Ladder Spécifique */}
                <div className={`bg-dark-800/50 rounded-lg p-4 border ${
                  isWinner ? 'border-purple-500/30' : 'border-red-500/30'
                }`}>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {isWinner ? (
                      <TrendingUp className="w-4 h-4 text-purple-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-gray-400 text-xs">Points Ladder</span>
                  </div>
                  <div className={`text-xl font-bold text-center ${
                    isWinner ? 'text-purple-400' : 'text-red-400'
                  }`}>
                    {isWinner ? '+' : '-'}{rewards?.squadLadderPoints || 0}
                  </div>
                  <p className={`text-xs text-center mt-1 ${isWinner ? 'text-green-400/70' : 'text-red-400/70'}`}>
                    {isWinner ? '🏆 Gagné' : '📉 Perdu'}
                  </p>
                </div>

                {/* Points Généraux */}
                <div className={`bg-dark-800/50 rounded-lg p-4 border ${
                  isWinner ? 'border-blue-500/30' : 'border-orange-500/30'
                }`}>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {isWinner ? (
                      <TrendingUp className="w-4 h-4 text-blue-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-orange-400" />
                    )}
                    <span className="text-gray-400 text-xs">Points Généraux</span>
                  </div>
                  <div className={`text-xl font-bold text-center ${
                    isWinner ? 'text-blue-400' : 'text-orange-400'
                  }`}>
                    {isWinner ? '+' : '-'}{rewards?.squadGeneralPoints || 0}
                  </div>
                  <p className={`text-xs text-center mt-1 ${isWinner ? 'text-green-400/70' : 'text-red-400/70'}`}>
                    {isWinner ? '🏆 Gagné' : '📉 Perdu'}
                  </p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-white/5 rounded-lg">
                <p className="text-gray-400 text-xs text-center">
                  <strong className="text-white">Points Ladder</strong> : Classement dans ce ladder spécifique
                  <br />
                  <strong className="text-white">Points Généraux</strong> : Classement général de l'escouade
                </p>
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="mt-8 flex justify-center">
            {/* Bouton continuer */}
            <button
              onClick={handleClose}
              className={`px-8 py-3 rounded-xl font-bold text-white transition-all hover:scale-105 ${
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

export default LadderMatchReport;
