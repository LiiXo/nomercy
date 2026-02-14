import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { Shield, CheckCircle, XCircle, Loader } from 'lucide-react';

import { API_URL } from '../config';

export default function IrisAuthorize() {
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [error, setError] = useState('');

  const handleAuthorize = async () => {
    setStatus('loading');
    setError('');

    try {
      const response = await fetch(`${API_URL}/iris/authorize`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setStatus('success');
        // Redirect to Iris app
        window.location.href = data.redirectUrl;
      } else {
        setStatus('error');
        setError(data.message || 'Authorization failed');
      }
    } catch (err) {
      setStatus('error');
      setError('Connection error. Please try again.');
    }
  };

  // Auto-redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = `${API_URL}/auth/discord?redirect=/iris/authorize`;
    }
  }, [authLoading, isAuthenticated]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <Loader className="w-8 h-8 text-red-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(239, 68, 68, 0.15) 0%, transparent 60%)' }}></div>
      
      <div className="relative z-10 w-full max-w-md">
        {/* Card */}
        <div className="bg-dark-900/80 backdrop-blur-xl border border-red-500/20 rounded-2xl p-8 text-center">
          {/* Logo */}
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 blur-2xl opacity-40 bg-gradient-to-r from-red-500 to-orange-600"></div>
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg">
              <Shield className="w-10 h-10 text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '4px' }}>
            IRIS
          </h1>
          <p className="text-gray-400 text-sm mb-8">NoMercy Security System</p>

          {status === 'success' ? (
            // Success
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold text-white">Autorisation réussie</h2>
              <p className="text-gray-400">
                Vous allez être redirigé vers Iris...
              </p>
            </div>
          ) : status === 'error' ? (
            // Error
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-semibold text-white">Erreur</h2>
              <p className="text-red-400">{error}</p>
              <button
                onClick={() => setStatus('idle')}
                className="px-6 py-2 bg-dark-800 text-white rounded-lg hover:bg-dark-700 transition-colors"
              >
                Réessayer
              </button>
            </div>
          ) : (
            // Idle - ready to authorize
            <div className="space-y-6">
              <div className="bg-dark-800/50 rounded-xl p-4 text-left">
                <p className="text-sm text-gray-400 mb-2">Connecté en tant que:</p>
                <div className="flex items-center gap-3">
                  {user?.avatarUrl && (
                    <img 
                      src={user.avatarUrl} 
                      alt={user.username} 
                      className="w-10 h-10 rounded-full"
                    />
                  )}
                  <div>
                    <p className="text-white font-medium">{user?.username}</p>
                    <p className="text-xs text-gray-500">{user?.discordUsername}</p>
                  </div>
                </div>
              </div>

              <p className="text-gray-400 text-sm">
                L'application Iris demande l'accès à votre compte NoMercy pour lier cette machine.
              </p>

              <button
                onClick={handleAuthorize}
                disabled={status === 'loading'}
                className="w-full py-3 bg-gradient-to-r from-red-500 to-orange-600 text-white font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {status === 'loading' ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>Autorisation...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    <span>Autoriser Iris</span>
                  </>
                )}
              </button>

              <p className="text-xs text-gray-600">
                En autorisant, vous acceptez de lier cette machine à votre compte.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-6">
          NoMercy Security &copy; 2024
        </p>
      </div>
    </div>
  );
}
