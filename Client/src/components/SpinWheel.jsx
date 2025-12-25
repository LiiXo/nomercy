import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../LanguageContext';
import { useAuth } from '../AuthContext';
import { X, Loader2, Coins, Sparkles, Clock } from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const SpinWheel = ({ isOpen, onClose }) => {
  const { language } = useLanguage();
  const { refreshUser, isAuthenticated } = useAuth();
  
  const [canSpin, setCanSpin] = useState(false);
  const [nextSpinAt, setNextSpinAt] = useState(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState('');
  
  const canvasRef = useRef(null);

  // Prizes - Gold coins only (avec 1 JACKPOT très rare)
  const prizes = [
    { amount: 10, color: '#92400E', isJackpot: false },
    { amount: 25, color: '#B45309', isJackpot: false },
    { amount: 50, color: '#D97706', isJackpot: false },
    { amount: 10, color: '#92400E', isJackpot: false },
    { amount: 100, color: '#F59E0B', isJackpot: false },
    { amount: 25, color: '#B45309', isJackpot: false },
    { amount: 10000, color: '#DC2626', isJackpot: true }, // JACKPOT!
    { amount: 50, color: '#D97706', isJackpot: false },
    { amount: 75, color: '#B45309', isJackpot: false },
    { amount: 25, color: '#B45309', isJackpot: false },
    { amount: 150, color: '#FBBF24', isJackpot: false },
    { amount: 10, color: '#92400E', isJackpot: false },
  ];

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchStatus();
      setLoading(false);
    }
  }, [isOpen, isAuthenticated]);

  // Draw wheel on canvas
  useEffect(() => {
    if (!canvasRef.current || loading) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const center = size / 2;
    const radius = center - 8;
    const segmentAngle = (2 * Math.PI) / prizes.length;
    
    // Clear canvas
    ctx.clearRect(0, 0, size, size);
    
    // Draw outer golden ring
    ctx.beginPath();
    ctx.arc(center, center, radius + 6, 0, 2 * Math.PI);
    ctx.strokeStyle = '#FCD34D';
    ctx.lineWidth = 8;
    ctx.stroke();
    
    // Draw segments
    prizes.forEach((prize, i) => {
      const startAngle = i * segmentAngle - Math.PI / 2;
      const endAngle = startAngle + segmentAngle;
      
      // Segment background with gradient effect
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.closePath();
      
      // Gradient - special for jackpot
      const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
      if (prize.isJackpot) {
        gradient.addColorStop(0, '#7F1D1D');
        gradient.addColorStop(0.5, '#DC2626');
        gradient.addColorStop(1, '#EF4444');
      } else {
        gradient.addColorStop(0, '#78350F');
        gradient.addColorStop(1, prize.color);
      }
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Segment border
      ctx.strokeStyle = prize.isJackpot ? '#FCA5A5' : '#FDE68A';
      ctx.lineWidth = prize.isJackpot ? 3 : 2;
      ctx.stroke();
      
      // Coin icon and text
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(startAngle + segmentAngle / 2);
      
      // Draw small coin circle (or star for jackpot)
      const coinX = radius - 55;
      ctx.beginPath();
      ctx.arc(coinX, 0, 12, 0, 2 * Math.PI);
      ctx.fillStyle = prize.isJackpot ? '#FEF08A' : '#FCD34D';
      ctx.fill();
      ctx.strokeStyle = prize.isJackpot ? '#EAB308' : '#F59E0B';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Symbol
      ctx.fillStyle = prize.isJackpot ? '#92400E' : '#92400E';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(prize.isJackpot ? '★' : '$', coinX, 0);
      
      // Amount text
      ctx.fillStyle = prize.isJackpot ? '#FEF08A' : '#FEF3C7';
      ctx.font = prize.isJackpot ? 'bold 11px sans-serif' : 'bold 16px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(prize.isJackpot ? '10K' : prize.amount.toString(), radius - 18, 0);
      
      ctx.restore();
    });
    
    // Inner decorative ring
    ctx.beginPath();
    ctx.arc(center, center, 50, 0, 2 * Math.PI);
    ctx.strokeStyle = '#FCD34D';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Center circle - treasure chest style
    const centerGradient = ctx.createRadialGradient(center, center, 0, center, center, 45);
    centerGradient.addColorStop(0, '#FDE68A');
    centerGradient.addColorStop(0.5, '#F59E0B');
    centerGradient.addColorStop(1, '#B45309');
    
    ctx.beginPath();
    ctx.arc(center, center, 45, 0, 2 * Math.PI);
    ctx.fillStyle = centerGradient;
    ctx.fill();
    ctx.strokeStyle = '#FCD34D';
    ctx.lineWidth = 4;
    ctx.stroke();
    
  }, [loading, isOpen]);

  // Countdown timer
  useEffect(() => {
    if (!nextSpinAt) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      const next = new Date(nextSpinAt);
      const diff = next - now;
      
      if (diff <= 0) {
        setCanSpin(true);
        setNextSpinAt(null);
        setCountdown('');
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setCountdown(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [nextSpinAt]);

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/spin/status`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setCanSpin(data.canSpin);
        setNextSpinAt(data.nextSpinAt);
      }
    } catch (err) {
      console.error('Error fetching spin status:', err);
    }
  };

  const handleSpin = async () => {
    if (!canSpin || isSpinning) return;
    
    setIsSpinning(true);
    setResult(null);
    
    try {
      const response = await fetch(`${API_URL}/spin/spin`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        // Find all segment indices that match the won prize amount
        const matchingIndices = prizes
          .map((prize, index) => prize.amount === data.prize.amount ? index : -1)
          .filter(index => index !== -1);
        
        // Pick a random matching segment (if multiple exist with same amount)
        const prizeIndex = matchingIndices[Math.floor(Math.random() * matchingIndices.length)];
        const segmentAngle = 360 / prizes.length;
        
        // Calculate final rotation to land on the correct segment
        const targetAngle = 360 - (prizeIndex * segmentAngle) - (segmentAngle / 2);
        const spins = 6 + Math.floor(Math.random() * 4);
        // Add small random offset within segment bounds to look natural (max ±10 degrees within the 30° segment)
        const randomOffset = (Math.random() * 16 - 8);
        const finalRotation = rotation + (spins * 360) + targetAngle + randomOffset;
        
        setRotation(finalRotation);
        
        // Show result after animation
        setTimeout(() => {
          setResult(data.prize);
          setCanSpin(false);
          
          const nextSpin = new Date();
          nextSpin.setTime(nextSpin.getTime() + (12 * 60 * 60 * 1000));
          setNextSpinAt(nextSpin);
          
          refreshUser();
          setIsSpinning(false);
        }, 6000);
      } else {
        alert(data.message || 'Erreur lors du spin');
        setIsSpinning(false);
      }
    } catch (err) {
      console.error('Spin error:', err);
      setIsSpinning(false);
    }
  };

  const texts = {
    fr: {
      title: 'Roue des Trésors',
      subtitle: 'Tourne toutes les 12h pour gagner des pièces !',
      spin: 'TOURNER LA ROUE',
      spinning: 'La roue tourne...',
      nextSpin: 'Prochain tour dans',
      youWon: 'Félicitations !',
      close: 'Récupérer',
      gold: 'pièces d\'or'
    },
    en: {
      title: 'Treasure Wheel',
      subtitle: 'Spin every 12h to win gold coins!',
      spin: 'SPIN THE WHEEL',
      spinning: 'Spinning...',
      nextSpin: 'Next spin in',
      youWon: 'Congratulations!',
      close: 'Collect',
      gold: 'gold coins'
    }
  };

  const t = texts[language] || texts.en;

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => !isSpinning && onClose()}>
      <div className="relative my-auto" onClick={(e) => e.stopPropagation()}>
        {/* Modal */}
        <div className={`relative bg-gradient-to-b from-amber-950 via-amber-900 to-amber-950 border-2 border-yellow-500/50 rounded-2xl shadow-2xl shadow-yellow-500/20 overflow-hidden transition-all duration-300 ${result ? 'w-[450px]' : 'w-[340px]'}`}>
          {/* Decorative corners */}
          <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-yellow-400 rounded-tl-2xl"></div>
          <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-yellow-400 rounded-tr-2xl"></div>
          <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-yellow-400 rounded-bl-2xl"></div>
          <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-yellow-400 rounded-br-2xl"></div>
          
          {/* Glow effects */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 bg-yellow-500/30 rounded-full blur-3xl pointer-events-none"></div>
          
          {/* Close button */}
          <button 
            onClick={() => !isSpinning && onClose()}
            disabled={isSpinning}
            className="absolute top-4 right-4 z-20 p-2 rounded-full bg-amber-800/50 hover:bg-amber-700/50 text-yellow-400 hover:text-yellow-300 transition-all disabled:opacity-50 border border-yellow-500/30"
          >
            <X className="w-5 h-5" />
          </button>
          
          {/* Header */}
          <div className="relative text-center pt-4 pb-1">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-600 shadow-lg shadow-yellow-500/50 mb-2 border-2 border-yellow-300">
              <Coins className="w-6 h-6 text-amber-900" />
            </div>
            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-300">{t.title}</h2>
            <p className="text-amber-300/70 text-xs mt-1">{t.subtitle}</p>
          </div>

          {/* Content */}
          <div className="relative px-4 pb-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
              </div>
            ) : result ? (
              // Result screen
              <div className="relative z-30 text-center py-6">
                <div className="mb-6 relative">
                  {/* Animated coins */}
                  <div className="relative w-32 h-32 mx-auto">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className={`w-24 h-24 rounded-full shadow-2xl flex items-center justify-center border-4 animate-bounce ${
                        result.isJackpot 
                          ? 'bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/50 border-red-300' 
                          : 'bg-gradient-to-br from-yellow-400 to-amber-500 shadow-yellow-500/50 border-yellow-300'
                      }`}>
                        <Coins className={`w-12 h-12 ${result.isJackpot ? 'text-red-900' : 'text-amber-900'}`} />
                      </div>
                    </div>
                    <Sparkles className={`absolute top-0 right-2 w-8 h-8 animate-pulse ${result.isJackpot ? 'text-red-400' : 'text-yellow-400'}`} />
                    <Sparkles className={`absolute bottom-2 left-0 w-6 h-6 animate-pulse ${result.isJackpot ? 'text-red-300' : 'text-yellow-300'}`} style={{ animationDelay: '0.5s' }} />
                    <Sparkles className={`absolute top-4 left-4 w-5 h-5 animate-pulse ${result.isJackpot ? 'text-red-300' : 'text-amber-300'}`} style={{ animationDelay: '0.3s' }} />
                  </div>
                </div>
                {result.isJackpot && (
                  <div className="text-red-400 text-lg font-bold mb-2 animate-pulse">🎉 JACKPOT! 🎉</div>
                )}
                <h3 className={`text-2xl font-bold mb-2 ${result.isJackpot ? 'text-red-400' : 'text-yellow-400'}`}>{t.youWon}</h3>
                <div className={`inline-flex items-center gap-3 px-8 py-4 rounded-2xl shadow-2xl border-2 ${
                  result.isJackpot 
                    ? 'bg-gradient-to-r from-red-500 to-red-600 border-red-300' 
                    : 'bg-gradient-to-r from-yellow-500 to-amber-500 border-yellow-300'
                }`}>
                  <span className={`text-4xl font-bold ${result.isJackpot ? 'text-white' : 'text-amber-900'}`}>+{result.amount.toLocaleString()}</span>
                  <Coins className={`w-8 h-8 ${result.isJackpot ? 'text-red-200' : 'text-amber-800'}`} />
                </div>
                <p className={`mt-2 ${result.isJackpot ? 'text-red-300/70' : 'text-amber-300/70'}`}>{t.gold}</p>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onClose();
                  }}
                  type="button"
                  className={`relative z-50 mt-6 px-10 py-3 font-bold rounded-xl transition-all shadow-lg border-2 cursor-pointer select-none active:scale-95 ${
                    result.isJackpot 
                      ? 'bg-gradient-to-r from-red-500 to-red-600 text-white border-red-300 hover:from-red-400 hover:to-red-500 shadow-red-500/30' 
                      : 'bg-gradient-to-r from-yellow-500 to-amber-500 text-amber-900 border-yellow-300 hover:from-yellow-400 hover:to-amber-400 shadow-yellow-500/30'
                  }`}
                  style={{ touchAction: 'manipulation' }}
                >
                  {t.close}
                </button>
              </div>
            ) : (
              // Wheel
              <div className="flex flex-col items-center">
                {/* Wheel container */}
                <div className="relative my-4">
                  {/* Outer glow */}
                  <div className="absolute inset-[-10px] rounded-full bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500 blur-xl opacity-40"></div>
                  
                  {/* Pointer */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                    <div className="relative">
                      <div className="w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-t-[28px] border-t-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]"></div>
                      <div className="absolute top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[18px] border-t-yellow-200"></div>
                    </div>
                  </div>

                  {/* Wheel */}
                  <div 
                    className="relative w-72 h-72 rounded-full shadow-2xl shadow-amber-900/50"
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      transition: isSpinning 
                        ? 'transform 6s cubic-bezier(0.2, 0.8, 0.2, 1)' 
                        : 'none',
                    }}
                  >
                    <canvas 
                      ref={canvasRef} 
                      width={288} 
                      height={288}
                      className="w-full h-full"
                    />
                  </div>

                  {/* Center coin overlay */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 shadow-xl flex items-center justify-center border-4 border-yellow-200 z-10">
                    <Coins className="w-10 h-10 text-amber-800" />
                  </div>
                </div>

                {/* Spin button or countdown */}
                {canSpin ? (
                  <button
                    onClick={handleSpin}
                    disabled={isSpinning}
                    className={`w-full py-4 rounded-xl font-bold text-lg transition-all border-2 ${
                      isSpinning 
                        ? 'bg-amber-800/50 text-amber-500 border-amber-700 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-yellow-500 to-amber-500 text-amber-900 border-yellow-300 hover:from-yellow-400 hover:to-amber-400 hover:scale-[1.02] shadow-xl shadow-yellow-500/30'
                    }`}
                  >
                    {isSpinning ? (
                      <span className="flex items-center justify-center gap-3">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        {t.spinning}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Sparkles className="w-6 h-6" />
                        {t.spin}
                      </span>
                    )}
                  </button>
                ) : (
                  <div className="w-full text-center py-4 px-6 rounded-xl bg-amber-900/50 border border-yellow-500/30">
                    <div className="flex items-center justify-center gap-2 text-amber-400/70 mb-2">
                      <Clock className="w-5 h-5" />
                      <span>{t.nextSpin}</span>
                    </div>
                    <div className="text-4xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-300">
                      {countdown || '--:--:--'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SpinWheel;
