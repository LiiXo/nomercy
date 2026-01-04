import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { useSocket } from '../SocketContext';
import { getDefaultAvatar, getAvatarUrl } from '../utils/avatar';
import { Users, Clock, Check, X, Loader2, Swords, Shield } from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const HelperConfirmationDialog = () => {
  const { user, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const { on } = useSocket();
  const [pendingRequest, setPendingRequest] = useState(null);
  const [responding, setResponding] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  const texts = {
    fr: {
      title: 'Demande d\'aide',
      description: 'veut vous ajouter comme aide pour un match',
      actionPost: 'Poster un match',
      actionAccept: 'Prendre un match',
      gameMode: 'Mode de jeu',
      format: 'Format',
      accept: 'Accepter',
      decline: 'Refuser',
      timeLeft: 'Temps restant',
      seconds: 's',
    },
    en: {
      title: 'Help Request',
      description: 'wants to add you as a helper for a match',
      actionPost: 'Post a match',
      actionAccept: 'Accept a match',
      gameMode: 'Game mode',
      format: 'Format',
      accept: 'Accept',
      decline: 'Decline',
      timeLeft: 'Time left',
      seconds: 's',
    },
    de: {
      title: 'Hilfsanfrage',
      description: 'möchte Sie als Helfer für ein Match hinzufügen',
      actionPost: 'Match posten',
      actionAccept: 'Match annehmen',
      gameMode: 'Spielmodus',
      format: 'Format',
      accept: 'Akzeptieren',
      decline: 'Ablehnen',
      timeLeft: 'Zeit übrig',
      seconds: 's',
    },
    it: {
      title: 'Richiesta di aiuto',
      description: 'vuole aggiungerti come aiuto per una partita',
      actionPost: 'Pubblica partita',
      actionAccept: 'Accetta partita',
      gameMode: 'Modalità',
      format: 'Formato',
      accept: 'Accetta',
      decline: 'Rifiuta',
      timeLeft: 'Tempo rimasto',
      seconds: 's',
    },
  };

  const t = texts[language] || texts.en;

  // Get user ID (handle both 'id' and '_id' formats)
  const userId = user?.id || user?._id;

  // Check for pending requests via API (backup in case socket misses the event)
  const checkPendingRequests = async () => {
    if (!isAuthenticated || !userId) return;
    
    try {
      const res = await fetch(`${API_URL}/helper-confirmation/pending`, {
        credentials: 'include'
      });
      const data = await res.json();
      
      if (data.success && data.confirmations && data.confirmations.length > 0) {
        const latestRequest = data.confirmations[0];
        console.log('[HELPER] Found pending request via API:', latestRequest);
        
        // Convert API response format to match socket format
        setPendingRequest({
          confirmationId: latestRequest._id,
          requester: latestRequest.requester,
          squad: latestRequest.squad,
          actionType: latestRequest.actionType,
          matchDetails: latestRequest.matchDetails,
          expiresAt: latestRequest.expiresAt
        });
        
        // Calculate time left
        const expiresAt = new Date(latestRequest.expiresAt);
        const now = new Date();
        const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
        setTimeLeft(remaining);
      }
    } catch (error) {
      console.error('[HELPER] Error checking pending requests:', error);
    }
  };

  // Check pending requests on mount and periodically
  useEffect(() => {
    if (!isAuthenticated || !user?._id) return;
    
    // Check immediately on mount
    checkPendingRequests();
    
    // Also check every 5 seconds as backup
    const interval = setInterval(checkPendingRequests, 5000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, userId]);

  // Listen for helper confirmation requests using shared socket
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    console.log('[HELPER] Setting up listener for user:', userId);
    
    // Listen for helper confirmation requests via shared socket
    const unsubscribe = on('helperConfirmationRequest', (data) => {
      console.log('[HELPER] Received confirmation request via socket:', data);
      setPendingRequest(data);
      
      // Calculate time left
      const expiresAt = new Date(data.expiresAt);
      const now = new Date();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeLeft(remaining);
    });

    return () => {
      console.log('[HELPER] Cleaning up listener');
      unsubscribe();
    };
  }, [isAuthenticated, userId, on]);

  // Countdown timer
  useEffect(() => {
    if (!pendingRequest) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time expired, close dialog
          setPendingRequest(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingRequest]);

  // Handle response (accept/decline)
  const handleResponse = async (response) => {
    if (!pendingRequest) return;
    
    setResponding(true);
    try {
      const res = await fetch(`${API_URL}/helper-confirmation/${pendingRequest.confirmationId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ response })
      });
      
      const data = await res.json();
      console.log('[HELPER] Response sent:', data);
      
      // Close the dialog regardless of response
      setPendingRequest(null);
    } catch (error) {
      console.error('[HELPER] Error responding:', error);
    } finally {
      setResponding(false);
    }
  };

  // Don't render if no pending request
  if (!pendingRequest) return null;

  const progressPercent = (timeLeft / 30) * 100;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-dark-900 border border-yellow-500/50 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-scaleIn">
        {/* Progress bar */}
        <div className="h-1 bg-dark-800">
          <div 
            className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-b border-yellow-500/30">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-yellow-500/20 flex items-center justify-center animate-pulse">
              <Users className="w-7 h-7 text-yellow-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">{t.title}</h2>
              <div className="flex items-center gap-2 text-yellow-400 text-sm mt-1">
                <Clock className="w-4 h-4" />
                <span>{t.timeLeft}: <strong>{timeLeft}{t.seconds}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Requester info */}
          <div className="flex items-center gap-4 mb-6">
            <img
              src={getAvatarUrl(pendingRequest.requester?.avatarUrl) || getDefaultAvatar(pendingRequest.requester?.username)}
              alt={pendingRequest.requester?.username}
              className="w-14 h-14 rounded-xl object-cover border-2 border-yellow-500/50"
            />
            <div className="flex-1">
              <p className="text-white font-bold text-lg">{pendingRequest.requester?.username}</p>
              <p className="text-gray-400 text-sm">{t.description}</p>
            </div>
          </div>

          {/* Squad info */}
          <div className="p-4 bg-dark-800/50 rounded-xl border border-white/10 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center border border-white/20"
                style={{ 
                  backgroundColor: pendingRequest.squad?.color === 'transparent' 
                    ? 'rgba(255,255,255,0.05)' 
                    : `${pendingRequest.squad?.color}30` 
                }}
              >
                {pendingRequest.squad?.logo ? (
                  <img src={pendingRequest.squad.logo} alt="" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <Shield className="w-5 h-5" style={{ color: pendingRequest.squad?.color || '#fff' }} />
                )}
              </div>
              <div>
                <p className="text-white font-semibold">{pendingRequest.squad?.name}</p>
                <p className="text-gray-500 text-sm">[{pendingRequest.squad?.tag}]</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Swords className="w-4 h-4 text-gray-500" />
                <span className="text-gray-400">{t.gameMode}:</span>
                <span className="text-white font-medium">{pendingRequest.matchDetails?.gameMode}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-500" />
                <span className="text-gray-400">{t.format}:</span>
                <span className="text-white font-medium">{pendingRequest.matchDetails?.teamSize}v{pendingRequest.matchDetails?.teamSize}</span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-white/10">
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
                pendingRequest.actionType === 'post' 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-blue-500/20 text-blue-400'
              }`}>
                {pendingRequest.actionType === 'post' ? t.actionPost : t.actionAccept}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => handleResponse('decline')}
              disabled={responding}
              className="flex-1 px-6 py-4 bg-dark-800 hover:bg-red-500/20 border border-white/10 hover:border-red-500/50 rounded-xl text-white font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {responding ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <X className="w-5 h-5 text-red-400" />
                  {t.decline}
                </>
              )}
            </button>
            <button
              onClick={() => handleResponse('accept')}
              disabled={responding}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 rounded-xl text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/25"
            >
              {responding ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  {t.accept}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default HelperConfirmationDialog;

