import React, { useState } from 'react';
import { 
  Power, AlertTriangle, AlertCircle, Settings, Trophy, Target, Bell,
  Trash2, Plus, Megaphone, Save, Loader2, Lock, Shield, X, RotateCcw
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const AdminApplication = ({ 
  appSettings, 
  setAppSettings,
  fetchAppSettings,
  setSuccess,
  setError
}) => {
  const [alertMessage, setAlertMessage] = useState('');
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showResetLeaderboardModal, setShowResetLeaderboardModal] = useState(false);
  const [resetLeaderboardMode, setResetLeaderboardMode] = useState(null);
  const [resettingLeaderboard, setResettingLeaderboard] = useState(false);

  if (!appSettings) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  const featureLabels = {
    rankedMatchmaking: { label: 'Matchmaking Classé', desc: 'Recherche de parties classées' },
    rankedPosting: { label: 'Création de matchs classés', desc: 'Poster des matchs classés' },
    ladderMatchmaking: { label: 'Matchmaking Ladder', desc: 'Recherche de parties ladder' },
    ladderPosting: { label: 'Création de matchs Ladder', desc: 'Poster des matchs ladder' },
    squadCreation: { label: 'Création d\'escouades', desc: 'Créer de nouvelles escouades' },
    squadInvites: { label: 'Invitations escouade', desc: 'Envoyer des invitations' },
    shopPurchases: { label: 'Achats boutique', desc: 'Effectuer des achats' },
    profileEditing: { label: 'Modification de profil', desc: 'Modifier son profil' },
    hardcoreMode: { label: 'Mode Hardcore', desc: 'Accès au mode Hardcore' },
    cdlMode: { label: 'Mode CDL', desc: 'Accès au mode CDL' },
    registration: { label: 'Inscriptions', desc: 'Nouvelles inscriptions' }
  };

  const toggleFeature = async (key, enabled) => {
    try {
      const response = await fetch(`${API_URL}/app-settings/admin/feature/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(`${featureLabels[key]?.label || key} ${enabled ? 'activé' : 'désactivé'}`);
        fetchAppSettings();
      }
    } catch (err) {
      setError('Erreur lors de la modification');
    }
  };

  const updateFeatureMessage = async (key, message) => {
    try {
      const response = await fetch(`${API_URL}/app-settings/admin/feature/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ disabledMessage: message })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Message mis à jour');
        fetchAppSettings();
      }
    } catch (err) {
      setError('Erreur lors de la mise à jour');
    }
  };

  const handleAddAlert = async () => {
    if (!alertMessage.trim()) return;
    
    try {
      const response = await fetch(`${API_URL}/app-settings/admin/alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'info', message: alertMessage })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Alerte ajoutée');
        setAlertMessage('');
        setShowAlertModal(false);
        fetchAppSettings();
      }
    } catch (err) {
      setError('Erreur lors de l\'ajout de l\'alerte');
    }
  };

  const handleResetLeaderboard = async () => {
    if (!resetLeaderboardMode) return;
    
    setResettingLeaderboard(true);
    try {
      const response = await fetch(`${API_URL}/app-settings/admin/reset-ranked-leaderboard/${resetLeaderboardMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(data.message);
        setShowResetLeaderboardModal(false);
        setResetLeaderboardMode(null);
      } else {
        setError(data.message || 'Erreur lors de la réinitialisation');
      }
    } catch (err) {
      setError('Erreur lors de la réinitialisation du classement');
    } finally {
      setResettingLeaderboard(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
            <Power className="w-5 sm:w-7 h-5 sm:h-7 text-purple-400" />
            Gestion de l'Application
          </h2>
          <p className="text-gray-400 mt-1 text-xs sm:text-sm">
            Activez ou désactivez les fonctionnalités de l'application
          </p>
        </div>
      </div>

      {/* Maintenance Mode */}
      <div className="bg-dark-800/50 border border-red-500/30 rounded-xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <AlertTriangle className="w-5 sm:w-6 h-5 sm:h-6 text-red-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm sm:text-base">Mode Maintenance</h3>
              <p className="text-gray-400 text-xs sm:text-sm">Désactiver temporairement toute l'application</p>
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                const response = await fetch(`${API_URL}/app-settings/admin/maintenance`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ enabled: !appSettings.maintenance?.enabled })
                });
                const data = await response.json();
                if (data.success) {
                  setSuccess(`Mode maintenance ${!appSettings.maintenance?.enabled ? 'activé' : 'désactivé'}`);
                  fetchAppSettings();
                }
              } catch (err) {
                setError('Erreur');
              }
            }}
            className={`relative w-14 h-8 rounded-full transition-colors flex-shrink-0 ${
              appSettings.maintenance?.enabled ? 'bg-red-500' : 'bg-dark-700'
            }`}
          >
            <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
              appSettings.maintenance?.enabled ? 'translate-x-6' : ''
            }`} />
          </button>
        </div>
        {appSettings.maintenance?.enabled && (
          <div className="mt-4 p-3 sm:p-4 bg-red-500/10 rounded-lg">
            <p className="text-red-400 text-xs sm:text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              L'application est actuellement en maintenance
            </p>
          </div>
        )}
      </div>

      {/* Feature Toggles */}
      <div className="bg-dark-800/50 border border-white/10 rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-white mb-4 sm:mb-6 flex items-center gap-2">
          <Settings className="w-4 sm:w-5 h-4 sm:h-5" />
          Fonctionnalités
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {Object.entries(featureLabels).map(([key, { label, desc }]) => {
            const feature = appSettings.features?.[key];
            const isEnabled = feature?.enabled !== false;
            
            return (
              <div key={key} className="bg-dark-900/50 rounded-lg p-3 sm:p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="min-w-0 flex-1 pr-3">
                    <h4 className="text-white font-medium text-sm sm:text-base truncate">{label}</h4>
                    <p className="text-gray-500 text-[10px] sm:text-xs truncate">{desc}</p>
                  </div>
                  <button
                    onClick={() => toggleFeature(key, !isEnabled)}
                    className={`relative w-10 sm:w-12 h-5 sm:h-6 rounded-full transition-colors flex-shrink-0 ${
                      isEnabled ? 'bg-green-500' : 'bg-dark-700'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 sm:w-5 h-4 sm:h-5 bg-white rounded-full transition-transform ${
                      isEnabled ? 'translate-x-5 sm:translate-x-6' : ''
                    }`} />
                  </button>
                </div>
                {!isEnabled && (
                  <input
                    type="text"
                    placeholder="Message quand désactivé..."
                    defaultValue={feature?.disabledMessage || ''}
                    onBlur={(e) => {
                      if (e.target.value !== feature?.disabledMessage) {
                        updateFeatureMessage(key, e.target.value);
                      }
                    }}
                    className="w-full mt-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:border-purple-500/50"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Ladder Settings */}
      <div className="bg-dark-800/50 border border-amber-500/30 rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-white mb-4 sm:mb-6 flex items-center gap-2">
          <Trophy className="w-4 sm:w-5 h-4 sm:h-5 text-amber-400" />
          Paramètres Ladder
        </h3>
        
        {/* Chill Time Restriction */}
        <div className="bg-dark-900/50 rounded-lg p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
            <div>
              <h4 className="text-white font-medium text-sm sm:text-base">Restriction horaire Chill</h4>
              <p className="text-gray-500 text-[10px] sm:text-xs">
                {appSettings.ladderSettings?.duoTrioTimeRestriction?.enabled 
                  ? `Ouvert de ${appSettings.ladderSettings?.duoTrioTimeRestriction?.startHour || 0}h à ${appSettings.ladderSettings?.duoTrioTimeRestriction?.endHour || 20}h (heure française)`
                  : 'Le ladder Chill est toujours ouvert'}
              </p>
            </div>
            <button
              onClick={async () => {
                const newEnabled = !appSettings.ladderSettings?.duoTrioTimeRestriction?.enabled;
                try {
                  const response = await fetch(`${API_URL}/app-settings/admin/ladder-settings`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ 
                      duoTrioTimeRestriction: { enabled: newEnabled }
                    })
                  });
                  const data = await response.json();
                  if (data.success) {
                    setSuccess(newEnabled ? 'Restriction horaire activée' : 'Ladder Chill toujours ouvert');
                    fetchAppSettings();
                  } else {
                    setError(data.message || 'Erreur');
                  }
                } catch (err) {
                  setError('Erreur lors de la modification');
                }
              }}
              className={`relative w-10 sm:w-12 h-5 sm:h-6 rounded-full transition-colors flex-shrink-0 ${
                appSettings.ladderSettings?.duoTrioTimeRestriction?.enabled ? 'bg-amber-500' : 'bg-dark-700'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 sm:w-5 h-4 sm:h-5 bg-white rounded-full transition-transform ${
                appSettings.ladderSettings?.duoTrioTimeRestriction?.enabled ? 'translate-x-5 sm:translate-x-6' : ''
              }`} />
            </button>
          </div>
          
          {appSettings.ladderSettings?.duoTrioTimeRestriction?.enabled && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center gap-2">
                <label className="text-gray-400 text-xs sm:text-sm">De</label>
                <select
                  value={appSettings.ladderSettings?.duoTrioTimeRestriction?.startHour || 0}
                  onChange={async (e) => {
                    try {
                      const response = await fetch(`${API_URL}/app-settings/admin/ladder-settings`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ 
                          duoTrioTimeRestriction: { startHour: parseInt(e.target.value) }
                        })
                      });
                      const data = await response.json();
                      if (data.success) fetchAppSettings();
                    } catch (err) {
                      setError('Erreur');
                    }
                  }}
                  className="px-2 sm:px-3 py-1.5 sm:py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:border-amber-500/50"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{i}h</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-gray-400 text-xs sm:text-sm">À</label>
                <select
                  value={appSettings.ladderSettings?.duoTrioTimeRestriction?.endHour || 20}
                  onChange={async (e) => {
                    try {
                      const response = await fetch(`${API_URL}/app-settings/admin/ladder-settings`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ 
                          duoTrioTimeRestriction: { endHour: parseInt(e.target.value) }
                        })
                      });
                      const data = await response.json();
                      if (data.success) fetchAppSettings();
                    } catch (err) {
                      setError('Erreur');
                    }
                  }}
                  className="px-2 sm:px-3 py-1.5 sm:py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:border-amber-500/50"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{i}h</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ranked Settings */}
      <div className="bg-dark-800/50 border border-orange-500/30 rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-white mb-4 sm:mb-6 flex items-center gap-2">
          <Target className="w-4 sm:w-5 h-4 sm:h-5 text-orange-400" />
          Mode Classé - Search & Destroy
        </h3>
        
        <div className="bg-dark-900/50 rounded-lg p-3 sm:p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div>
              <h4 className="text-white font-medium text-sm sm:text-base">Mode S&D</h4>
              <p className="text-gray-500 text-[10px] sm:text-xs">Mode de matchmaking Search and Destroy</p>
            </div>
            <button
              onClick={async () => {
                const newEnabled = !appSettings.rankedSettings?.searchAndDestroy?.enabled;
                try {
                  const response = await fetch(`${API_URL}/app-settings/admin/ranked-settings`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ 
                      searchAndDestroy: { enabled: newEnabled }
                    })
                  });
                  const data = await response.json();
                  if (data.success) {
                    setSuccess(`S&D ${newEnabled ? 'activé' : 'désactivé'}`);
                    fetchAppSettings();
                  }
                } catch (err) {
                  setError('Erreur');
                }
              }}
              className={`relative w-10 sm:w-12 h-5 sm:h-6 rounded-full transition-colors flex-shrink-0 ${
                appSettings.rankedSettings?.searchAndDestroy?.enabled ? 'bg-orange-500' : 'bg-dark-700'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 sm:w-5 h-4 sm:h-5 bg-white rounded-full transition-transform ${
                appSettings.rankedSettings?.searchAndDestroy?.enabled ? 'translate-x-5 sm:translate-x-6' : ''
              }`} />
            </button>
          </div>

          {appSettings.rankedSettings?.searchAndDestroy?.enabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4 pt-4 border-t border-white/10">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Points Victoire</label>
                <input
                  type="number"
                  value={appSettings.rankedSettings?.searchAndDestroy?.rewards?.pointsWin || 25}
                  onChange={async (e) => {
                    try {
                      const response = await fetch(`${API_URL}/app-settings/admin/ranked-settings`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ 
                          searchAndDestroy: { rewards: { pointsWin: parseInt(e.target.value) || 25 } }
                        })
                      });
                      if ((await response.json()).success) fetchAppSettings();
                    } catch (err) {
                      setError('Erreur');
                    }
                  }}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:border-orange-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Points Défaite</label>
                <input
                  type="number"
                  value={appSettings.rankedSettings?.searchAndDestroy?.rewards?.pointsLose || -15}
                  onChange={async (e) => {
                    try {
                      const response = await fetch(`${API_URL}/app-settings/admin/ranked-settings`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ 
                          searchAndDestroy: { rewards: { pointsLose: parseInt(e.target.value) || -15 } }
                        })
                      });
                      if ((await response.json()).success) fetchAppSettings();
                    } catch (err) {
                      setError('Erreur');
                    }
                  }}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:border-orange-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Gold Victoire</label>
                <input
                  type="number"
                  value={appSettings.rankedSettings?.searchAndDestroy?.rewards?.goldWin || 50}
                  onChange={async (e) => {
                    try {
                      const response = await fetch(`${API_URL}/app-settings/admin/ranked-settings`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ 
                          searchAndDestroy: { rewards: { goldWin: parseInt(e.target.value) || 50 } }
                        })
                      });
                      if ((await response.json()).success) fetchAppSettings();
                    } catch (err) {
                      setError('Erreur');
                    }
                  }}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:border-orange-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Timer Matchmaking (s)</label>
                <input
                  type="number"
                  value={appSettings.rankedSettings?.searchAndDestroy?.matchmaking?.waitTimer || 120}
                  onChange={async (e) => {
                    try {
                      const response = await fetch(`${API_URL}/app-settings/admin/ranked-settings`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ 
                          searchAndDestroy: { matchmaking: { waitTimer: parseInt(e.target.value) || 120 } }
                        })
                      });
                      if ((await response.json()).success) fetchAppSettings();
                    } catch (err) {
                      setError('Erreur');
                    }
                  }}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:border-orange-500/50"
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Hardpoint / Point Stratégique (CDL) */}
        <div className="bg-dark-900/50 rounded-lg p-3 sm:p-4 space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div>
              <h4 className="text-white font-medium text-sm sm:text-base flex items-center gap-2">
                Point Stratégique
                <span className="px-2 py-0.5 text-[10px] bg-cyan-500/20 text-cyan-400 rounded">CDL</span>
              </h4>
              <p className="text-gray-500 text-[10px] sm:text-xs">Mode Hardpoint pour le classé CDL</p>
            </div>
            <button
              onClick={async () => {
                const newEnabled = !appSettings.rankedSettings?.hardpoint?.enabled;
                try {
                  const response = await fetch(`${API_URL}/app-settings/admin/ranked-settings`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ 
                      hardpoint: { enabled: newEnabled }
                    })
                  });
                  const data = await response.json();
                  if (data.success) {
                    setSuccess(`Point Stratégique ${newEnabled ? 'activé' : 'désactivé'}`);
                    fetchAppSettings();
                  }
                } catch (err) {
                  setError('Erreur');
                }
              }}
              className={`relative w-10 sm:w-12 h-5 sm:h-6 rounded-full transition-colors flex-shrink-0 ${
                appSettings.rankedSettings?.hardpoint?.enabled !== false ? 'bg-cyan-500' : 'bg-dark-700'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 sm:w-5 h-4 sm:h-5 bg-white rounded-full transition-transform ${
                appSettings.rankedSettings?.hardpoint?.enabled !== false ? 'translate-x-5 sm:translate-x-6' : ''
              }`} />
            </button>
          </div>

          {appSettings.rankedSettings?.hardpoint?.enabled !== false && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4 pt-4 border-t border-white/10">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Points Victoire</label>
                <input
                  type="number"
                  value={appSettings.rankedSettings?.hardpoint?.rewards?.pointsWin || 25}
                  onChange={async (e) => {
                    try {
                      const response = await fetch(`${API_URL}/app-settings/admin/ranked-settings`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ 
                          hardpoint: { rewards: { pointsWin: parseInt(e.target.value) || 25 } }
                        })
                      });
                      if ((await response.json()).success) fetchAppSettings();
                    } catch (err) {
                      setError('Erreur');
                    }
                  }}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Points Défaite</label>
                <input
                  type="number"
                  value={appSettings.rankedSettings?.hardpoint?.rewards?.pointsLose || -15}
                  onChange={async (e) => {
                    try {
                      const response = await fetch(`${API_URL}/app-settings/admin/ranked-settings`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ 
                          hardpoint: { rewards: { pointsLose: parseInt(e.target.value) || -15 } }
                        })
                      });
                      if ((await response.json()).success) fetchAppSettings();
                    } catch (err) {
                      setError('Erreur');
                    }
                  }}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Gold Victoire</label>
                <input
                  type="number"
                  value={appSettings.rankedSettings?.hardpoint?.rewards?.goldWin || 50}
                  onChange={async (e) => {
                    try {
                      const response = await fetch(`${API_URL}/app-settings/admin/ranked-settings`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ 
                          hardpoint: { rewards: { goldWin: parseInt(e.target.value) || 50 } }
                        })
                      });
                      if ((await response.json()).success) fetchAppSettings();
                    } catch (err) {
                      setError('Erreur');
                    }
                  }}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Timer Matchmaking (s)</label>
                <input
                  type="number"
                  value={appSettings.rankedSettings?.hardpoint?.matchmaking?.waitTimer || 120}
                  onChange={async (e) => {
                    try {
                      const response = await fetch(`${API_URL}/app-settings/admin/ranked-settings`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ 
                          hardpoint: { matchmaking: { waitTimer: parseInt(e.target.value) || 120 } }
                        })
                      });
                      if ((await response.json()).success) fetchAppSettings();
                    } catch (err) {
                      setError('Erreur');
                    }
                  }}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Other modes - Coming Soon */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-4">
          {['Mêlée générale', 'Duel'].map((mode) => (
            <div key={mode} className="bg-dark-900/50 rounded-lg p-3 sm:p-4 opacity-50">
              <div className="flex items-center gap-2 sm:gap-3">
                <Lock className="w-3 sm:w-4 h-3 sm:h-4 text-gray-500" />
                <span className="text-gray-400 text-xs sm:text-sm">{mode}</span>
                <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs bg-gray-700/50 rounded text-gray-500">À venir</span>
              </div>
            </div>
          ))}
        </div>
        
        {/* Points Loss Per Rank */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <h4 className="text-white font-medium text-sm mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-red-400" />
            Points perdus par rang (défaite)
          </h4>
          <p className="text-gray-500 text-xs mb-3">
            Configurez les points perdus en défaite selon le rang du joueur. Les joueurs de rangs élevés perdent plus de points.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {[
              { key: 'bronze', label: 'Bronze', color: 'text-amber-600' },
              { key: 'silver', label: 'Argent', color: 'text-gray-300' },
              { key: 'gold', label: 'Or', color: 'text-yellow-400' },
              { key: 'platinum', label: 'Platine', color: 'text-teal-400' },
              { key: 'diamond', label: 'Diamant', color: 'text-cyan-300' },
              { key: 'master', label: 'Maître', color: 'text-purple-400' },
              { key: 'grandmaster', label: 'Grand Maître', color: 'text-red-400' },
              { key: 'champion', label: 'Champion', color: 'text-yellow-300' }
            ].map(({ key, label, color }) => {
              const currentValue = appSettings?.rankedSettings?.pointsLossPerRank?.[key] ?? 
                ({ bronze: -10, silver: -12, gold: -15, platinum: -18, diamond: -20, master: -22, grandmaster: -25, champion: -30 }[key]);
              
              return (
                <div key={key} className="bg-dark-900/50 rounded-lg p-2 sm:p-3">
                  <label className={`block text-xs font-medium mb-1 ${color}`}>{label}</label>
                  <input
                    type="number"
                    max="0"
                    value={currentValue}
                    onChange={async (e) => {
                      // Keep default negative value if input is empty or invalid
                      const defaultValues = { bronze: -10, silver: -12, gold: -15, platinum: -18, diamond: -20, master: -22, grandmaster: -25, champion: -30 };
                      const parsed = parseInt(e.target.value);
                      const newValue = !isNaN(parsed) && parsed < 0 ? parsed : defaultValues[key];
                      
                      try {
                        // Update AppSettings (for display in this panel)
                        const response = await fetch(`${API_URL}/app-settings/admin`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({
                            rankedSettings: {
                              pointsLossPerRank: {
                                ...appSettings?.rankedSettings?.pointsLossPerRank,
                                [key]: newValue
                              }
                            }
                          })
                        });
                        
                        // ALSO update Config (which is used by the server for actual calculations)
                        await fetch(`${API_URL}/config/admin`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({
                            rankedPointsLossPerRank: {
                              ...appSettings?.rankedSettings?.pointsLossPerRank,
                              [key]: newValue
                            }
                          })
                        });
                        
                        const data = await response.json();
                        if (data.success) fetchAppSettings();
                      } catch (err) {
                        setError('Erreur');
                      }
                    }}
                    className="w-full px-2 py-1.5 bg-dark-800 border border-red-500/30 rounded-lg text-red-400 text-xs sm:text-sm font-semibold focus:outline-none focus:border-red-500/50 text-center"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      <div className="bg-dark-800/50 border border-white/10 rounded-xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Bell className="w-4 sm:w-5 h-4 sm:h-5" />
            Alertes Globales
          </h3>
          <button
            onClick={() => setShowAlertModal(true)}
            className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors text-xs sm:text-sm"
          >
            <Plus className="w-3 sm:w-4 h-3 sm:h-4" />
            Ajouter
          </button>
        </div>
        
        {appSettings.globalAlerts?.length > 0 ? (
          <div className="space-y-2 sm:space-y-3">
            {appSettings.globalAlerts.map((alert) => (
              <div key={alert.id} className={`p-3 sm:p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 ${
                alert.type === 'error' ? 'bg-red-500/20 border border-red-500/30' :
                alert.type === 'warning' ? 'bg-orange-500/20 border border-orange-500/30' :
                alert.type === 'success' ? 'bg-green-500/20 border border-green-500/30' :
                'bg-blue-500/20 border border-blue-500/30'
              }`}>
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <AlertCircle className={`w-4 sm:w-5 h-4 sm:h-5 flex-shrink-0 ${
                    alert.type === 'error' ? 'text-red-400' :
                    alert.type === 'warning' ? 'text-orange-400' :
                    alert.type === 'success' ? 'text-green-400' :
                    'text-blue-400'
                  }`} />
                  <span className="text-white text-xs sm:text-sm break-words">{alert.message}</span>
                </div>
                <button
                  onClick={async () => {
                    const response = await fetch(`${API_URL}/app-settings/admin/alert/${alert.id}`, {
                      method: 'DELETE',
                      credentials: 'include'
                    });
                    const data = await response.json();
                    if (data.success) {
                      fetchAppSettings();
                    }
                  }}
                  className="p-1.5 sm:p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-3 sm:w-4 h-3 sm:h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-center py-4 text-xs sm:text-sm">Aucune alerte active</p>
        )}
      </div>

      {/* Fixed Banner */}
      <div className="bg-dark-800/50 border border-purple-500/30 rounded-xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Megaphone className="w-5 sm:w-6 h-5 sm:h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm sm:text-base">Bannière Fixe</h3>
              <p className="text-gray-400 text-[10px] sm:text-sm">Affiche une bannière en haut de toutes les pages</p>
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                const response = await fetch(`${API_URL}/app-settings/admin`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ 
                    banner: { 
                      ...appSettings.banner,
                      enabled: !appSettings.banner?.enabled 
                    }
                  })
                });
                const data = await response.json();
                if (data.success) {
                  setSuccess(`Bannière ${!appSettings.banner?.enabled ? 'activée' : 'désactivée'}`);
                  fetchAppSettings();
                }
              } catch (err) {
                setError('Erreur');
              }
            }}
            className={`relative w-14 h-8 rounded-full transition-colors flex-shrink-0 ${
              appSettings.banner?.enabled ? 'bg-purple-500' : 'bg-dark-700'
            }`}
          >
            <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
              appSettings.banner?.enabled ? 'translate-x-6' : ''
            }`} />
          </button>
        </div>
        
        <div className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">Message de la bannière</label>
            <input
              type="text"
              value={appSettings.banner?.message || ''}
              onChange={(e) => setAppSettings({
                ...appSettings,
                banner: { ...appSettings.banner, message: e.target.value }
              })}
              placeholder="Ex: 🎉 Nouvelle saison disponible !"
              className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-dark-900 border border-white/10 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-purple-500/50"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">Couleur de fond</label>
              <select
                value={appSettings.banner?.bgColor || 'purple'}
                onChange={(e) => setAppSettings({
                  ...appSettings,
                  banner: { ...appSettings.banner, bgColor: e.target.value }
                })}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-dark-900 border border-white/10 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-purple-500/50"
              >
                <option value="purple">Violet</option>
                <option value="blue">Bleu</option>
                <option value="green">Vert</option>
                <option value="orange">Orange</option>
                <option value="red">Rouge</option>
                <option value="cyan">Cyan</option>
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">Lien (optionnel)</label>
              <input
                type="text"
                value={appSettings.banner?.link || ''}
                onChange={(e) => setAppSettings({
                  ...appSettings,
                  banner: { ...appSettings.banner, link: e.target.value }
                })}
                placeholder="/hardcore ou https://..."
                className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-dark-900 border border-white/10 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-purple-500/50"
              />
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                const response = await fetch(`${API_URL}/app-settings/admin`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ banner: appSettings.banner })
                });
                const data = await response.json();
                if (data.success) {
                  setSuccess('Bannière mise à jour');
                  fetchAppSettings();
                }
              } catch (err) {
                setError('Erreur');
              }
            }}
            className="w-full py-2.5 sm:py-3 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm"
          >
            <Save className="w-4 sm:w-5 h-4 sm:h-5" />
            Sauvegarder la bannière
          </button>
        </div>
        
        {appSettings.banner?.enabled && appSettings.banner?.message && (
          <div className="mt-4">
            <p className="text-gray-400 text-xs sm:text-sm mb-2">Aperçu:</p>
            <div className={`w-full py-2 px-4 rounded-lg text-center text-white font-medium text-xs sm:text-sm ${
              appSettings.banner?.bgColor === 'blue' ? 'bg-blue-500' :
              appSettings.banner?.bgColor === 'green' ? 'bg-green-500' :
              appSettings.banner?.bgColor === 'orange' ? 'bg-orange-500' :
              appSettings.banner?.bgColor === 'red' ? 'bg-red-500' :
              appSettings.banner?.bgColor === 'cyan' ? 'bg-cyan-500' :
              'bg-purple-500'
            }`}>
              {appSettings.banner.message}
            </div>
          </div>
        )}
      </div>

      {/* Staff Admin Access Control */}
      <div className="bg-dark-800/50 border border-purple-500/30 rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Shield className="w-4 sm:w-5 h-4 sm:h-5 text-purple-400" />
          Accès Staff au Panel Admin
        </h3>
        <p className="text-gray-400 text-xs sm:text-sm mb-4">
          Contrôlez les onglets accessibles aux comptes avec le rôle "staff"
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {[
            { key: 'overview', label: 'Vue d\'ensemble' },
            { key: 'users', label: 'Utilisateurs' },
            { key: 'squads', label: 'Escouades' },
            { key: 'announcements', label: 'Annonces' },
            { key: 'maps', label: 'Cartes' },
            { key: 'gamerules', label: 'Règles de Jeu' }
          ].map(({ key, label }) => {
            const isEnabled = appSettings?.staffAdminAccess?.[key] !== false;
            return (
              <div key={key} className="flex items-center justify-between bg-dark-900/50 rounded-lg p-2.5 sm:p-3">
                <span className="text-white text-xs sm:text-sm">{label}</span>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch(`${API_URL}/app-settings/admin`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                          staffAdminAccess: {
                            ...appSettings?.staffAdminAccess,
                            [key]: !isEnabled
                          }
                        })
                      });
                      const data = await response.json();
                      if (data.success) {
                        setSuccess(`Accès ${label} ${!isEnabled ? 'activé' : 'désactivé'} pour le staff`);
                        fetchAppSettings();
                      }
                    } catch (err) {
                      setError('Erreur');
                    }
                  }}
                  className={`relative w-8 sm:w-10 h-4 sm:h-5 rounded-full transition-colors ${
                    isEnabled ? 'bg-purple-500' : 'bg-dark-700'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-3 sm:w-4 h-3 sm:h-4 bg-white rounded-full transition-transform ${
                    isEnabled ? 'translate-x-4 sm:translate-x-5' : ''
                  }`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reset Ranked Leaderboard Section */}
      <div className="bg-dark-800/50 border border-red-500/30 rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
          <RotateCcw className="w-4 sm:w-5 h-4 sm:h-5 text-red-400" />
          Réinitialisation du Classement Mode Classé
        </h3>
        <p className="text-gray-400 text-xs sm:text-sm mb-4">
          Remettre à zéro tous les points, victoires, défaites et rangs du classement mode classé.
          <span className="text-red-400 font-medium"> Cette action est irréversible.</span>
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Hardcore Reset */}
          <div className="bg-dark-900/50 rounded-lg p-3 sm:p-4 border border-orange-500/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <Trophy className="w-4 sm:w-5 h-4 sm:h-5 text-orange-400" />
              </div>
              <div>
                <h4 className="text-white font-medium text-sm sm:text-base">Hardcore</h4>
                <p className="text-gray-500 text-[10px] sm:text-xs">Classement mode Hardcore</p>
              </div>
            </div>
            <button
              onClick={() => {
                setResetLeaderboardMode('hardcore');
                setShowResetLeaderboardModal(true);
              }}
              className="w-full py-2 px-3 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-400 rounded-lg transition-colors text-xs sm:text-sm font-medium flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
              Réinitialiser Hardcore
            </button>
          </div>
          
          {/* CDL Reset */}
          <div className="bg-dark-900/50 rounded-lg p-3 sm:p-4 border border-cyan-500/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <Trophy className="w-4 sm:w-5 h-4 sm:h-5 text-cyan-400" />
              </div>
              <div>
                <h4 className="text-white font-medium text-sm sm:text-base">CDL</h4>
                <p className="text-gray-500 text-[10px] sm:text-xs">Classement mode CDL</p>
              </div>
            </div>
            <button
              onClick={() => {
                setResetLeaderboardMode('cdl');
                setShowResetLeaderboardModal(true);
              }}
              className="w-full py-2 px-3 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 rounded-lg transition-colors text-xs sm:text-sm font-medium flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
              Réinitialiser CDL
            </button>
          </div>
        </div>
      </div>

      {/* Reset Leaderboard Confirmation Modal */}
      {showResetLeaderboardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowResetLeaderboardModal(false)}></div>
          <div className="relative bg-dark-900 border border-red-500/30 rounded-2xl p-4 sm:p-6 max-w-md w-full">
            <div className="text-center mb-4">
              <div className="w-12 sm:w-16 h-12 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 sm:w-8 h-6 sm:h-8 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Confirmer la réinitialisation</h3>
              <p className="text-gray-400 text-sm mb-2">
                Vous êtes sur le point de réinitialiser le classement 
                <span className={`font-bold ${resetLeaderboardMode === 'hardcore' ? 'text-orange-400' : 'text-cyan-400'}`}>
                  {' '}{resetLeaderboardMode === 'hardcore' ? 'Hardcore' : 'CDL'}
                </span>.
              </p>
              <p className="text-red-400 text-xs">
                Tous les points, victoires, défaites et rangs seront remis à zéro.
                Cette action est irréversible !
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowResetLeaderboardModal(false);
                  setResetLeaderboardMode(null);
                }}
                className="flex-1 py-2.5 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleResetLeaderboard}
                disabled={resettingLeaderboard}
                className="flex-1 py-2.5 px-4 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {resettingLeaderboard ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Réinitialiser
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal - Replaces prompt() to fix Illegal constructor error */}
      {showAlertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowAlertModal(false)}></div>
          <div className="relative bg-dark-900 border border-purple-500/20 rounded-2xl p-4 sm:p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-purple-400" />
                Nouvelle Alerte
              </h3>
              <button
                onClick={() => setShowAlertModal(false)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              value={alertMessage}
              onChange={(e) => setAlertMessage(e.target.value)}
              placeholder="Message de l'alerte..."
              className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowAlertModal(false)}
                className="flex-1 py-2.5 px-4 bg-dark-800 text-white rounded-xl hover:bg-dark-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleAddAlert}
                disabled={!alertMessage.trim()}
                className="flex-1 py-2.5 px-4 bg-purple-500 text-white font-medium rounded-xl hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminApplication;
