import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, Coins, Shield, Edit2, RotateCcw, Ban, Trash2, ShieldAlert, AlertTriangle, Gamepad2, Globe, History, Gift, ChevronDown, Users, Gavel, X, Star, Trophy, Minus, Loader2, Megaphone, Calendar, Clock, Send 
} from 'lucide-react';
import { getAvatarUrl } from '../../utils/avatar';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const AdminUsers = ({ 
  users, 
  searchTerm, 
  setSearchTerm, 
  page, 
  setPage, 
  totalPages,
  openEditModal,
  openBanModal,
  openWarnModal,
  openRankedBanModal,
  setResetStatsConfirm,
  setDeleteConfirm,
  handleToggleReferentBan,
  formatDate,
  getRoleColor,
  userIsArbitre = false,
  userIsAdmin = false,
  openUserPurchasesModal,
  openGiveItemModal,
  currentUser
}) => {
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [arbitrageUser, setArbitrageUser] = useState(null);
  const [resetStatsUser, setResetStatsUser] = useState(null);
  const [resetStatsLoading, setResetStatsLoading] = useState(false);
  const [userFullData, setUserFullData] = useState(null);
  const [resetOptions, setResetOptions] = useState({
    generalKeepLosses: false,
    rankedKeepLosses: false,
    xpReduction: 100,
    newRankedPoints: null
  });
  const [summonUser, setSummonUser] = useState(null);
  const [summonLoading, setSummonLoading] = useState(false);
  const [summonData, setSummonData] = useState({
    date: '',
    timeStart: '',
    timeEnd: '',
    reason: ''
  });
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenDropdown = (userId, event) => {
    if (openDropdown === userId) {
      setOpenDropdown(null);
      return;
    }
    
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const dropdownWidth = 208; // w-52 = 13rem = 208px
    
    setDropdownPosition({
      top: rect.bottom + 4,
      left: Math.min(rect.right - dropdownWidth, window.innerWidth - dropdownWidth - 16)
    });
    setOpenDropdown(userId);
  };

  const handleAction = (action, user) => {
    setOpenDropdown(null);
    action(user);
  };

  const openResetStatsDialog = async (user) => {
    setResetStatsUser(user);
    setUserFullData(null);
    
    // Fetch full user data to get rankedStats
    try {
      const response = await fetch(`${API_URL}/users/admin/${user._id}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success && data.user) {
        setUserFullData(data.user);
        // Total ranked points (sum of all modes)
        const totalRankedPoints = (data.user.rankedPoints?.hardcore || 0) + (data.user.rankedPoints?.cdl || 0);
        setResetOptions({
          generalKeepLosses: false,
          rankedKeepLosses: false,
          xpReduction: 100,
          newRankedPoints: totalRankedPoints
        });
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
    }
  };

  const handleResetGeneral = async () => {
    if (!resetStatsUser) return;
    setResetStatsLoading(true);
    try {
      const response = await fetch(`${API_URL}/users/admin/${resetStatsUser._id}/reset-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          type: 'general',
          keepLosses: resetOptions.generalKeepLosses 
        })
      });
      if (response.ok) {
        setResetStatsUser(null);
        setArbitrageUser(null);
      }
    } catch (err) {
      console.error('Error resetting stats:', err);
    }
    setResetStatsLoading(false);
  };

  const handleResetRanked = async () => {
    if (!resetStatsUser) return;
    setResetStatsLoading(true);
    try {
      const response = await fetch(`${API_URL}/users/admin/${resetStatsUser._id}/reset-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          type: 'ranked',
          keepLosses: resetOptions.rankedKeepLosses 
        })
      });
      if (response.ok) {
        setResetStatsUser(null);
        setArbitrageUser(null);
      }
    } catch (err) {
      console.error('Error resetting ranked stats:', err);
    }
    setResetStatsLoading(false);
  };

  const handleResetXP = async () => {
    if (!resetStatsUser) return;
    setResetStatsLoading(true);
    try {
      const response = await fetch(`${API_URL}/users/admin/${resetStatsUser._id}/reset-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          type: 'xp',
          reduction: resetOptions.xpReduction 
        })
      });
      if (response.ok) {
        setResetStatsUser(null);
        setArbitrageUser(null);
      }
    } catch (err) {
      console.error('Error resetting XP:', err);
    }
    setResetStatsLoading(false);
  };

  const handleUpdateRankedPoints = async () => {
    if (!resetStatsUser || resetOptions.newRankedPoints === null) return;
    setResetStatsLoading(true);
    try {
      const response = await fetch(`${API_URL}/users/admin/${resetStatsUser._id}/reset-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          type: 'ranked-points',
          newPoints: resetOptions.newRankedPoints 
        })
      });
      if (response.ok) {
        setResetStatsUser(null);
        setArbitrageUser(null);
      }
    } catch (err) {
      console.error('Error updating ranked points:', err);
    }
    setResetStatsLoading(false);
  };

  const openSummonDialog = (user) => {
    setSummonUser(user);
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    setSummonData({
      date: today,
      timeStart: '18:00',
      timeEnd: '19:00',
      reason: ''
    });
  };

  const handleSendSummon = async () => {
    if (!summonUser || !summonData.date || !summonData.timeStart || !summonData.timeEnd || !summonData.reason.trim()) return;
    setSummonLoading(true);
    try {
      const response = await fetch(`${API_URL}/users/admin/${summonUser._id}/summon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          date: summonData.date,
          timeStart: summonData.timeStart,
          timeEnd: summonData.timeEnd,
          reason: summonData.reason,
          summonedBy: {
            id: currentUser?._id,
            username: currentUser?.username || currentUser?.discordUsername
          }
        })
      });
      const data = await response.json();
      if (data.success) {
        setSummonUser(null);
        setArbitrageUser(null);
        setSummonData({ date: '', timeStart: '', timeEnd: '', reason: '' });
        // Show success message (could be enhanced with toast notification)
        if (data.dmFailed) {
          alert('Salon vocal cr\u00e9\u00e9 mais le DM n\'a pas pu \u00eatre envoy\u00e9 (DMs ferm\u00e9s).');
        }
      } else {
        alert(data.message || 'Erreur lors de l\'envoi de la convocation.');
      }
    } catch (err) {
      console.error('Error sending summon:', err);
      alert('Erreur lors de l\'envoi de la convocation.');
    }
    setSummonLoading(false);
  };

  const getActionItems = (user) => {
    const items = [];
    
    // Arbitrage - available to everyone
    items.push({ 
      label: 'Arbitrage', 
      icon: Gavel, 
      color: 'orange', 
      action: () => setArbitrageUser(user) 
    });
    
    // Admin only actions below
    if (userIsAdmin) {
      if (openUserPurchasesModal) {
        items.push({ label: 'Historique achats', icon: History, color: 'amber', action: () => openUserPurchasesModal(user) });
      }
      if (openGiveItemModal) {
        items.push({ label: 'Donner objet', icon: Gift, color: 'green', action: () => openGiveItemModal(user) });
      }
      items.push({ label: 'Modifier', icon: Edit2, color: 'blue', action: () => openEditModal('user', user) });
      items.push({ label: 'Supprimer', icon: Trash2, color: 'red', action: () => setDeleteConfirm({ type: 'user', id: user._id }), danger: true });
    }
    
    return items;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
            <Users className="w-5 sm:w-7 h-5 sm:h-7 text-purple-400" />
            Gestion des Utilisateurs
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {users.length} utilisateur(s) trouvé(s)
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg font-medium">
            Page {page}/{totalPages || 1}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          placeholder="Rechercher par nom, Discord ID, email..."
          className="w-full pl-12 pr-4 py-3 bg-dark-800/80 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
        />
      </div>

      {/* Users - Mobile Cards */}
      <div className="md:hidden space-y-3">
        {users.length === 0 ? (
          <div className="text-center py-12 bg-dark-800/30 rounded-xl border border-white/5">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Aucun utilisateur trouvé</p>
          </div>
        ) : (
          users.map((user) => (
            <div key={user._id} className="bg-dark-800/50 border border-white/10 rounded-xl p-4 hover:border-purple-500/30 transition-all">
              <div className="flex items-start gap-3 mb-3">
                <img
                  src={getAvatarUrl(user.avatarUrl || user.avatar) || '/avatar.jpg'}
                  alt=""
                  className="w-12 h-12 rounded-full ring-2 ring-white/10 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{user.username || user.discordUsername || 'Sans identifiant'}</p>
                  <p className="text-gray-500 text-xs truncate">{user.discordUsername}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {user.roles?.map((role) => (
                      <span key={role} className={`px-1.5 py-0.5 text-[10px] font-medium rounded bg-${getRoleColor(role)}-500/20 text-${getRoleColor(role)}-400`}>
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {user.isBanned ? (
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Banni</span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Actif</span>
                  )}
                  <div className="flex items-center gap-1 text-yellow-400 text-sm">
                    <Coins className="w-3.5 h-3.5" />
                    <span className="font-semibold">{user.goldCoins || 0}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                {user.squad ? (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Shield className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-white truncate max-w-[120px]">{user.squad.name}</span>
                  </div>
                ) : (
                  <span className="text-gray-500 text-xs">Sans escouade</span>
                )}
                <div className="relative ml-auto">
                  <button
                    onClick={(e) => handleOpenDropdown(`mobile-${user._id}`, e)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-purple-300 text-sm font-medium transition-colors"
                  >
                    Actions
                    <ChevronDown className={`w-4 h-4 transition-transform ${openDropdown === `mobile-${user._id}` ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Users Table - Desktop */}
      <div className="hidden md:block">
        <div className="bg-dark-800/50 border border-white/10 rounded-xl">
          <table className="w-full table-fixed">
            <thead className="bg-dark-900/80 border-b border-white/10">
              <tr>
                <th className="w-[18%] px-3 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Utilisateur</th>
                <th className="w-[14%] px-3 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Discord</th>
                <th className="w-[12%] px-3 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Escouade</th>
                <th className="w-[10%] px-3 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Rôles</th>
                <th className="w-[8%] px-3 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Coins</th>
                <th className="w-[8%] px-3 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Statut</th>
                <th className="w-[12%] px-3 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider hidden xl:table-cell">IP</th>
                <th className="w-[10%] px-3 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider hidden xl:table-cell">Inscription</th>
                <th className="w-[8%] px-3 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center">
                    <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">Aucun utilisateur trouvé</p>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user._id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <img
                          src={getAvatarUrl(user.avatarUrl || user.avatar) || '/avatar.jpg'}
                          alt=""
                          className="w-9 h-9 rounded-full ring-2 ring-white/10 flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-white font-medium text-sm truncate">{user.username || user.discordUsername || 'Sans identifiant'}</p>
                          <p className="text-gray-500 text-[10px] truncate font-mono">{user._id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-white text-sm truncate">{user.discordUsername}</p>
                      <p className="text-gray-500 text-[10px] truncate font-mono">{user.discordId}</p>
                    </td>
                    <td className="px-3 py-3">
                      {user.squad ? (
                        <div className="flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                          <span className="text-white text-sm truncate">{user.squad.name}</span>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.roles?.map((role) => (
                          <span
                            key={role}
                            className={`px-1.5 py-0.5 text-[10px] font-medium rounded bg-${getRoleColor(role)}-500/20 text-${getRoleColor(role)}-400`}
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1 text-yellow-400">
                        <Coins className="w-3.5 h-3.5" />
                        <span className="font-semibold text-sm">{user.goldCoins || 0}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {user.isBanned ? (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                          Banni
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                          Actif
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 hidden xl:table-cell">
                      {user.lastIp ? (
                        <div className="flex items-center gap-1">
                          <Globe className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                          <span className="text-cyan-400 text-xs font-mono truncate">{user.lastIp}</span>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-400 text-xs hidden xl:table-cell">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={(e) => handleOpenDropdown(user._id, e)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-purple-300 text-xs font-medium transition-colors"
                        >
                          Actions
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openDropdown === user._id ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-full sm:w-auto px-5 py-2.5 bg-dark-800 text-white rounded-xl hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Précédent
          </button>
          <div className="flex items-center gap-2">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                    page === pageNum
                      ? 'bg-purple-500 text-white'
                      : 'bg-dark-800 text-gray-400 hover:bg-dark-700 hover:text-white'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-full sm:w-auto px-5 py-2.5 bg-dark-800 text-white rounded-xl hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Suivant
          </button>
        </div>
      )}

      {/* Dropdown Portal */}
      {openDropdown && (
        <div 
          ref={dropdownRef}
          className="fixed w-52 bg-dark-900 border border-white/10 rounded-xl shadow-2xl py-1.5 max-h-80 overflow-y-auto"
          style={{ 
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            zIndex: 9999 
          }}
        >
          {getActionItems(users.find(u => u._id === openDropdown || u._id === openDropdown.replace('mobile-', '')) || {}).map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleAction(item.action, users.find(u => u._id === openDropdown || u._id === openDropdown.replace('mobile-', '')))}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors ${
                item.danger ? 'text-red-400 hover:bg-red-500/10' : `text-${item.color}-400`
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Arbitrage Dialog */}
      {arbitrageUser && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setArbitrageUser(null)} />
          <div className="relative bg-dark-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-white/10">
              <div className="p-2 bg-orange-500/20 rounded-xl">
                <Gavel className="w-5 h-5 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white">Arbitrage</h3>
                <p className="text-gray-400 text-sm truncate">{arbitrageUser.username || arbitrageUser.discordUsername}</p>
              </div>
              <button 
                onClick={() => setArbitrageUser(null)} 
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* User Info */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <img
                  src={getAvatarUrl(arbitrageUser.avatarUrl || arbitrageUser.avatar) || '/avatar.jpg'}
                  alt=""
                  className="w-12 h-12 rounded-full ring-2 ring-white/10"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium">{arbitrageUser.username || arbitrageUser.discordUsername || 'Sans identifiant'}</p>
                  <p className="text-gray-500 text-xs truncate">{arbitrageUser.discordId}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {arbitrageUser.isBanned && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Banni</span>
                  )}
                  {arbitrageUser.isRankedBanned && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">Ranked Ban</span>
                  )}
                  {arbitrageUser.isReferentBanned && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Ref. Bloqué</span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 space-y-2">
              {/* Convoquer */}
              <button
                onClick={() => openSummonDialog(arbitrageUser)}
                className="w-full flex items-center gap-3 p-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl text-blue-400 transition-colors"
              >
                <Megaphone className="w-5 h-5" />
                <div className="text-left">
                  <p className="font-medium">Convoquer</p>
                  <p className="text-xs text-blue-400/70">Inviter en vocal via Discord</p>
                </div>
              </button>

              {/* Reset Stats - Admin only */}
              {userIsAdmin && (
                <button
                  onClick={() => openResetStatsDialog(arbitrageUser)}
                  className="w-full flex items-center gap-3 p-3 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-xl text-purple-400 transition-colors"
                >
                  <RotateCcw className="w-5 h-5" />
                  <div className="text-left">
                    <p className="font-medium">Reset Stats</p>
                    <p className="text-xs text-purple-400/70">Gérer les statistiques du joueur</p>
                  </div>
                </button>
              )}

              {/* Avertir */}
              <button
                onClick={() => { setArbitrageUser(null); openWarnModal(arbitrageUser); }}
                className="w-full flex items-center gap-3 p-3 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 rounded-xl text-orange-400 transition-colors"
              >
                <AlertTriangle className="w-5 h-5" />
                <div className="text-left">
                  <p className="font-medium">Avertir</p>
                  <p className="text-xs text-orange-400/70">Envoyer un avertissement</p>
                </div>
              </button>

              {/* Bannir Ranked */}
              <button
                onClick={() => { setArbitrageUser(null); openRankedBanModal(arbitrageUser); }}
                className={`w-full flex items-center gap-3 p-3 border rounded-xl transition-colors ${
                  arbitrageUser.isRankedBanned 
                    ? 'bg-green-500/10 hover:bg-green-500/20 border-green-500/20 text-green-400' 
                    : 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20 text-purple-400'
                }`}
              >
                <Gamepad2 className="w-5 h-5" />
                <div className="text-left">
                  <p className="font-medium">{arbitrageUser.isRankedBanned ? 'Débannir Ranked' : 'Bannir Ranked'}</p>
                  <p className={`text-xs ${arbitrageUser.isRankedBanned ? 'text-green-400/70' : 'text-purple-400/70'}`}>
                    {arbitrageUser.isRankedBanned ? 'Autoriser l\'accès au mode classé' : 'Bloquer l\'accès au mode classé'}
                  </p>
                </div>
              </button>

              {/* Bloquer Référent */}
              <button
                onClick={() => { setArbitrageUser(null); handleToggleReferentBan(arbitrageUser); }}
                className={`w-full flex items-center gap-3 p-3 border rounded-xl transition-colors ${
                  arbitrageUser.isReferentBanned 
                    ? 'bg-green-500/10 hover:bg-green-500/20 border-green-500/20 text-green-400' 
                    : 'bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/20 text-yellow-400'
                }`}
              >
                <ShieldAlert className="w-5 h-5" />
                <div className="text-left">
                  <p className="font-medium">{arbitrageUser.isReferentBanned ? 'Autoriser Référent' : 'Bloquer Référent'}</p>
                  <p className={`text-xs ${arbitrageUser.isReferentBanned ? 'text-green-400/70' : 'text-yellow-400/70'}`}>
                    {arbitrageUser.isReferentBanned ? 'Autoriser à être référent' : 'Empêcher d\'être référent'}
                  </p>
                </div>
              </button>

              {/* Bannir */}
              <button
                onClick={() => { setArbitrageUser(null); openBanModal(arbitrageUser); }}
                className={`w-full flex items-center gap-3 p-3 border rounded-xl transition-colors ${
                  arbitrageUser.isBanned 
                    ? 'bg-green-500/10 hover:bg-green-500/20 border-green-500/20 text-green-400' 
                    : 'bg-red-500/10 hover:bg-red-500/20 border-red-500/20 text-red-400'
                }`}
              >
                <Ban className="w-5 h-5" />
                <div className="text-left">
                  <p className="font-medium">{arbitrageUser.isBanned ? 'Débannir' : 'Bannir'}</p>
                  <p className={`text-xs ${arbitrageUser.isBanned ? 'text-green-400/70' : 'text-red-400/70'}`}>
                    {arbitrageUser.isBanned ? 'Réactiver l\'accès au compte' : 'Bloquer complètement l\'accès'}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Stats Dialog */}
      {resetStatsUser && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setResetStatsUser(null)} />
          <div className="relative bg-dark-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-white/10 sticky top-0 bg-dark-900 z-10">
              <div className="p-2 bg-purple-500/20 rounded-xl">
                <RotateCcw className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white">Reset Stats</h3>
                <p className="text-gray-400 text-sm truncate">{resetStatsUser.username || resetStatsUser.discordUsername}</p>
              </div>
              <button 
                onClick={() => setResetStatsUser(null)} 
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Loading state */}
              {!userFullData && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                </div>
              )}

              {userFullData && (
                <>
                  {/* Current Stats Summary */}
                  <div className="space-y-3 p-3 bg-dark-800/50 border border-white/10 rounded-xl">
                    {/* Mode Hardcore */}
                    <div className="pb-2 border-b border-white/5">
                      <p className="text-orange-400 text-xs font-medium mb-2">Mode Hardcore</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center">
                          <p className="text-gray-500 text-[10px]">Points</p>
                          <p className="text-purple-400 font-bold">{userFullData.rankedPoints?.hardcore ?? 0}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500 text-[10px]">XP</p>
                          <p className="text-yellow-400 font-bold">{userFullData.statsHardcore?.xp ?? 0}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500 text-[10px]">V/D</p>
                          <p className="text-white font-medium text-sm">
                            <span className="text-green-400">{userFullData.rankedStats?.hardcore?.wins ?? 0}</span>
                            <span className="text-gray-500"> / </span>
                            <span className="text-red-400">{userFullData.rankedStats?.hardcore?.losses ?? 0}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                    {/* Mode CDL */}
                    <div className="pb-2 border-b border-white/5">
                      <p className="text-cyan-400 text-xs font-medium mb-2">Mode CDL</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center">
                          <p className="text-gray-500 text-[10px]">Points</p>
                          <p className="text-purple-400 font-bold">{userFullData.rankedPoints?.cdl ?? 0}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500 text-[10px]">XP</p>
                          <p className="text-yellow-400 font-bold">{userFullData.statsCdl?.xp ?? 0}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500 text-[10px]">V/D</p>
                          <p className="text-white font-medium text-sm">
                            <span className="text-green-400">{userFullData.rankedStats?.cdl?.wins ?? 0}</span>
                            <span className="text-gray-500"> / </span>
                            <span className="text-red-400">{userFullData.rankedStats?.cdl?.losses ?? 0}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                    {/* Général */}
                    <div>
                      <p className="text-gray-400 text-xs font-medium mb-2">Stats Générales</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-center">
                          <p className="text-gray-500 text-[10px]">V/D Ladder</p>
                          <p className="text-white font-medium text-sm">
                            <span className="text-green-400">{userFullData.stats?.wins ?? 0}</span>
                            <span className="text-gray-500"> / </span>
                            <span className="text-red-400">{userFullData.stats?.losses ?? 0}</span>
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500 text-[10px]">Gold Coins</p>
                          <p className="text-amber-400 font-bold">{userFullData.goldCoins ?? 0}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Reset Stats Général */}
                  <div className="bg-dark-800/50 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-medium">Reset Stats Général</h4>
                    <p className="text-gray-400 text-xs">Supprime victoires, défaites et historique complet</p>
                  </div>
                </div>
                <label className="flex items-center gap-2 mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={resetOptions.generalKeepLosses}
                    onChange={(e) => setResetOptions(prev => ({ ...prev, generalKeepLosses: e.target.checked }))}
                    className="w-4 h-4 rounded border-white/20 bg-dark-700 text-orange-500 focus:ring-orange-500/50"
                  />
                  <span className="text-orange-400 text-sm">Conserver les défaites (sanction)</span>
                </label>
                <button
                  onClick={handleResetGeneral}
                  disabled={resetStatsLoading}
                  className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {resetStatsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Reset Stats Général
                </button>
              </div>

              {/* Reset Mode Classé */}
              <div className="bg-dark-800/50 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-cyan-500/20 rounded-lg">
                    <Gamepad2 className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-medium">Reset Mode Classé</h4>
                    <p className="text-gray-400 text-xs">Supprime stats et historique du mode classé</p>
                  </div>
                </div>
                <label className="flex items-center gap-2 mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={resetOptions.rankedKeepLosses}
                    onChange={(e) => setResetOptions(prev => ({ ...prev, rankedKeepLosses: e.target.checked }))}
                    className="w-4 h-4 rounded border-white/20 bg-dark-700 text-orange-500 focus:ring-orange-500/50"
                  />
                  <span className="text-orange-400 text-sm">Conserver les défaites (sanction)</span>
                </label>
                <button
                  onClick={handleResetRanked}
                  disabled={resetStatsLoading}
                  className="w-full py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg text-cyan-400 font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {resetStatsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Reset Mode Classé
                </button>
              </div>

              {/* Reset XP Joueur */}
              <div className="bg-dark-800/50 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <Star className="w-4 h-4 text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-medium">Reset XP Joueur</h4>
                    <p className="text-gray-400 text-xs">
                      Hardcore: <span className="text-orange-400 font-medium">{userFullData?.statsHardcore?.xp ?? 0}</span>
                      {' | '}CDL: <span className="text-cyan-400 font-medium">{userFullData?.statsCdl?.xp ?? 0}</span>
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[100, 10, 20, 30, 40, 50, 60, 70].map((val) => (
                    <button
                      key={val}
                      onClick={() => setResetOptions(prev => ({ ...prev, xpReduction: val }))}
                      className={`py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                        resetOptions.xpReduction === val
                          ? 'bg-yellow-500 text-black'
                          : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                      }`}
                    >
                      {val === 100 ? 'Reset 0' : `-${val}%`}
                    </button>
                  ))}
                </div>
                <p className="text-gray-400 text-xs mb-3 text-center">
                  Résultat: <span className="text-yellow-400 font-medium">
                    {resetOptions.xpReduction === 100 
                      ? '0 XP (tous modes)' 
                      : `Hardcore: ${Math.round((userFullData?.statsHardcore?.xp ?? 0) * (1 - resetOptions.xpReduction / 100))} | CDL: ${Math.round((userFullData?.statsCdl?.xp ?? 0) * (1 - resetOptions.xpReduction / 100))}`
                    }
                  </span>
                </p>
                <button
                  onClick={handleResetXP}
                  disabled={resetStatsLoading}
                  className="w-full py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 rounded-lg text-yellow-400 font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {resetStatsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Minus className="w-4 h-4" />}
                  {resetOptions.xpReduction === 100 ? 'Reset XP à 0' : `Retirer ${resetOptions.xpReduction}% XP`}
                </button>
              </div>

              {/* Retrait Points Mode Classé */}
              <div className="bg-dark-800/50 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Trophy className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-medium">Retrait Points Mode Classé</h4>
                    <p className="text-gray-400 text-xs">
                      Hardcore: <span className="text-orange-400 font-medium">{userFullData?.rankedPoints?.hardcore ?? 0}</span>
                      {' | '}CDL: <span className="text-cyan-400 font-medium">{userFullData?.rankedPoints?.cdl ?? 0}</span>
                      {' | '}Total: <span className="text-purple-400 font-medium">{(userFullData?.rankedPoints?.hardcore ?? 0) + (userFullData?.rankedPoints?.cdl ?? 0)} pts</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="range"
                    min="0"
                    max={(userFullData?.rankedPoints?.hardcore ?? 0) + (userFullData?.rankedPoints?.cdl ?? 0)}
                    value={resetOptions.newRankedPoints ?? ((userFullData?.rankedPoints?.hardcore ?? 0) + (userFullData?.rankedPoints?.cdl ?? 0))}
                    onChange={(e) => setResetOptions(prev => ({ ...prev, newRankedPoints: parseInt(e.target.value) }))}
                    className="flex-1 h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <input
                    type="number"
                    min="0"
                    max={(userFullData?.rankedPoints?.hardcore ?? 0) + (userFullData?.rankedPoints?.cdl ?? 0)}
                    value={resetOptions.newRankedPoints ?? ((userFullData?.rankedPoints?.hardcore ?? 0) + (userFullData?.rankedPoints?.cdl ?? 0))}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      const max = (userFullData?.rankedPoints?.hardcore ?? 0) + (userFullData?.rankedPoints?.cdl ?? 0);
                      setResetOptions(prev => ({ ...prev, newRankedPoints: Math.min(val, max) }));
                    }}
                    className="w-20 px-2 py-1 bg-dark-700 border border-white/10 rounded-lg text-white text-center text-sm"
                  />
                </div>
                <p className="text-gray-400 text-xs mb-3 text-center">
                  Retrait: <span className="text-red-400 font-medium">
                    -{((userFullData?.rankedPoints?.hardcore ?? 0) + (userFullData?.rankedPoints?.cdl ?? 0)) - (resetOptions.newRankedPoints ?? ((userFullData?.rankedPoints?.hardcore ?? 0) + (userFullData?.rankedPoints?.cdl ?? 0)))} pts
                  </span>
                </p>
                <button
                  onClick={handleUpdateRankedPoints}
                  disabled={resetStatsLoading || (resetOptions.newRankedPoints ?? ((userFullData?.rankedPoints?.hardcore ?? 0) + (userFullData?.rankedPoints?.cdl ?? 0))) >= ((userFullData?.rankedPoints?.hardcore ?? 0) + (userFullData?.rankedPoints?.cdl ?? 0))}
                  className="w-full py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-400 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {resetStatsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Minus className="w-4 h-4" />}
                  Appliquer le retrait
                </button>
              </div>
              </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summon Dialog */}
      {summonUser && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSummonUser(null)} />
          <div className="relative bg-dark-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-white/10">
              <div className="p-2 bg-blue-500/20 rounded-xl">
                <Megaphone className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white">Convoquer</h3>
                <p className="text-gray-400 text-sm truncate">{summonUser.username || summonUser.discordUsername}</p>
              </div>
              <button 
                onClick={() => setSummonUser(null)} 
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* User Info */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <img
                  src={getAvatarUrl(summonUser.avatarUrl || summonUser.avatar) || '/avatar.jpg'}
                  alt=""
                  className="w-12 h-12 rounded-full ring-2 ring-white/10"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium">{summonUser.username || summonUser.discordUsername || 'Sans identifiant'}</p>
                  <p className="text-gray-500 text-xs truncate">Discord: {summonUser.discordUsername}</p>
                </div>
              </div>
              <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-blue-400 text-xs">
                  <span className="font-medium">Info:</span> Une notification sera envoyée en français et en anglais via Discord. Un salon vocal sera créé dans la catégorie Support-Ticket.
                </p>
              </div>
            </div>

            {/* Form */}
            <div className="p-4 space-y-4">
              {/* Date */}
              <div>
                <label className="flex items-center gap-2 text-white text-sm font-medium mb-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  Date du rendez-vous
                </label>
                <input
                  type="date"
                  value={summonData.date}
                  onChange={(e) => setSummonData(prev => ({ ...prev, date: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2.5 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Time Range */}
              <div>
                <label className="flex items-center gap-2 text-white text-sm font-medium mb-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  Plage horaire
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={summonData.timeStart}
                    onChange={(e) => setSummonData(prev => ({ ...prev, timeStart: e.target.value }))}
                    className="flex-1 px-3 py-2.5 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <span className="text-gray-400">à</span>
                  <input
                    type="time"
                    value={summonData.timeEnd}
                    onChange={(e) => setSummonData(prev => ({ ...prev, timeEnd: e.target.value }))}
                    className="flex-1 px-3 py-2.5 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="flex items-center gap-2 text-white text-sm font-medium mb-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  Raison de la convocation
                </label>
                <textarea
                  value={summonData.reason}
                  onChange={(e) => setSummonData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Expliquez brièvement la raison..."
                  rows={3}
                  className="w-full px-3 py-2.5 bg-dark-800 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 resize-none"
                />
              </div>

              {/* Preview */}
              <div className="p-3 bg-dark-800/50 border border-white/10 rounded-xl">
                <p className="text-gray-400 text-xs mb-2 font-medium">Aperçu du message:</p>
                <div className="text-sm space-y-2">
                  <div className="p-2 bg-dark-700/50 rounded-lg">
                    <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Français</p>
                    <p className="text-white text-xs">
                      Vous êtes convoqué(e) par <span className="text-orange-400 font-medium">{currentUser?.username || currentUser?.discordUsername || 'Admin'}</span> le <span className="text-blue-400">{summonData.date ? new Date(summonData.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '...'}</span> entre <span className="text-blue-400">{summonData.timeStart || '...'}</span> et <span className="text-blue-400">{summonData.timeEnd || '...'}</span>.
                    </p>
                    {summonData.reason && (
                      <p className="text-gray-400 text-xs mt-1">Raison: <span className="text-white">{summonData.reason}</span></p>
                    )}
                  </div>
                  <div className="p-2 bg-dark-700/50 rounded-lg">
                    <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">English</p>
                    <p className="text-white text-xs">
                      You are summoned by <span className="text-orange-400 font-medium">{currentUser?.username || currentUser?.discordUsername || 'Admin'}</span> on <span className="text-blue-400">{summonData.date ? new Date(summonData.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '...'}</span> between <span className="text-blue-400">{summonData.timeStart || '...'}</span> and <span className="text-blue-400">{summonData.timeEnd || '...'}</span>.
                    </p>
                    {summonData.reason && (
                      <p className="text-gray-400 text-xs mt-1">Reason: <span className="text-white">{summonData.reason}</span></p>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSendSummon}
                disabled={summonLoading || !summonData.date || !summonData.timeStart || !summonData.timeEnd || !summonData.reason.trim()}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-xl text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {summonLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Envoyer la convocation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
