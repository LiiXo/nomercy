import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, CheckCircle, XCircle, Loader } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://nomercy.ggsecure.io/api';

export default function IrisCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);
  const [username, setUsername] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    
    if (!code) {
      setStatus('error');
      setError('Code d\'autorisation manquant');
      return;
    }

    // Call backend to exchange code for token
    exchangeCode(code);
  }, [searchParams]);

  const exchangeCode = async (code) => {
    try {
      const response = await fetch(`${API_URL}/iris/exchange-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });

      const data = await response.json();

      if (data.success) {
        setUsername(data.username);
        setStatus('success');
        
        // Redirect to Iris app
        setTimeout(() => {
          window.location.href = data.redirectUrl;
        }, 500);
      } else {
        setStatus('error');
        setError(data.message || 'Erreur d\'authentification');
      }
    } catch (err) {
      console.error('Exchange error:', err);
      setStatus('error');
      setError('Erreur de connexion au serveur');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
      <div className="text-center p-10 max-w-md">
        {/* Logo */}
        <div className="w-20 h-20 bg-gradient-to-br from-[#ff2d55] to-[#ff6b2c] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(255,45,85,0.4)]">
          <Shield className="w-10 h-10 text-white" />
        </div>
        
        <h1 className="text-3xl font-bold text-[#ff2d55] tracking-[4px] mb-2">IRIS</h1>
        <p className="text-zinc-500 text-sm mb-8">NOMERCY SECURITY</p>

        {status === 'processing' && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <Loader className="w-8 h-8 text-[#ff2d55] animate-spin mx-auto mb-4" />
            <p className="text-zinc-400">Authentification en cours...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="bg-zinc-900/50 border border-green-900/50 rounded-xl p-6">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-4" />
            <p className="text-white font-medium mb-2">Bienvenue, {username}</p>
            <p className="text-green-500 mb-4">Autorisation réussie</p>
            <p className="text-zinc-500 text-sm">Retournez sur l'application Iris</p>
            <p className="text-zinc-600 text-xs mt-4">Vous pouvez fermer cet onglet</p>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-zinc-900/50 border border-red-900/50 rounded-xl p-6">
            <XCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
            <p className="text-red-500 font-medium mb-2">Erreur</p>
            <p className="text-zinc-400">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
