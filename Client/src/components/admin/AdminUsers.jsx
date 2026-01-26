import React from 'react';
import { 
  Search, Coins, Shield, Edit2, RotateCcw, Ban, Trash2, ShieldAlert, AlertTriangle, Gamepad2, Globe, History, Gift, Trophy, Loader2 
} from 'lucide-react';
import { getAvatarUrl } from '../../utils/avatar';

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
  handleTestTrophyDistribution,
  testTrophyLoading
}) => {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Gestion des Utilisateurs</h2>
        <div className="text-gray-400 text-xs sm:text-sm">
          {users.length} utilisateur(s) • Page {page}/{totalPages || 1}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-gray-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          placeholder="Rechercher un utilisateur..."
          className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 bg-dark-800 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500/50"
        />
      </div>

      {/* Users - Mobile Cards */}
      <div className="md:hidden space-y-3">
        {users.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Aucun utilisateur trouvé</div>
        ) : (
          users.map((user) => (
            <div key={user._id} className="bg-dark-800/50 border border-white/10 rounded-xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <img
                  src={getAvatarUrl(user.avatarUrl || user.avatar) || '/avatar.jpg'}
                  alt=""
                  className="w-12 h-12 rounded-full flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{user.username || user.discordUsername || 'Sans identifiant'}</p>
                  <p className="text-gray-500 text-xs truncate">{user.discordUsername}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {user.roles?.map((role) => (
                      <span key={role} className={`px-1.5 py-0.5 text-[10px] font-medium rounded bg-${getRoleColor(role)}-500/20 text-${getRoleColor(role)}-400`}>
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {user.isBanned ? (
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-red-500/20 text-red-400">Banni</span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-green-500/20 text-green-400">Actif</span>
                  )}
                  <div className="flex items-center gap-1 text-yellow-400 text-sm">
                    <Coins className="w-3 h-3" />
                    <span className="font-medium">{user.goldCoins || 0}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                {user.squad && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Shield className="w-3 h-3 text-purple-400" />
                    <span className="text-white truncate max-w-[120px]">{user.squad.name}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 ml-auto">
                  {/* Admin only: Purchase history and give item */}
                  {userIsAdmin && openUserPurchasesModal && <button onClick={() => openUserPurchasesModal(user)} className="p-1.5 text-amber-400 hover:bg-amber-500/20 rounded-lg" title="Historique achats"><History className="w-4 h-4" /></button>}
                  {userIsAdmin && openGiveItemModal && <button onClick={() => openGiveItemModal(user)} className="p-1.5 text-green-400 hover:bg-green-500/20 rounded-lg" title="Donner objet"><Gift className="w-4 h-4" /></button>}
                  {userIsAdmin && handleTestTrophyDistribution && (
                    <button 
                      onClick={() => handleTestTrophyDistribution(user)} 
                      disabled={testTrophyLoading === user._id}
                      className="p-1.5 text-cyan-400 hover:bg-cyan-500/20 rounded-lg disabled:opacity-50" 
                      title="Test distribution trophée"
                    >
                      {testTrophyLoading === user._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                    </button>
                  )}
                  {/* Arbitre only sees block referent and ban buttons */}
                  {!userIsArbitre && <button onClick={() => openEditModal('user', user)} className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded-lg"><Edit2 className="w-4 h-4" /></button>}
                  {!userIsArbitre && <button onClick={() => setResetStatsConfirm(user)} className="p-1.5 text-purple-400 hover:bg-purple-500/20 rounded-lg"><RotateCcw className="w-4 h-4" /></button>}
                  <button onClick={() => openWarnModal(user)} className="p-1.5 text-orange-400 hover:bg-orange-500/20 rounded-lg" title="Avertir"><AlertTriangle className="w-4 h-4" /></button>
                  <button onClick={() => openRankedBanModal(user)} className={`p-1.5 rounded-lg ${user.isRankedBanned ? 'text-purple-400 hover:bg-purple-500/20' : 'text-gray-400 hover:bg-gray-500/20'}`} title={user.isRankedBanned ? 'Débannir ranked' : 'Bannir ranked'}><Gamepad2 className="w-4 h-4" /></button>
                  <button onClick={() => handleToggleReferentBan(user)} className={`p-1.5 rounded-lg ${user.isReferentBanned ? 'text-yellow-400 hover:bg-yellow-500/20' : 'text-gray-400 hover:bg-gray-500/20'}`} title={user.isReferentBanned ? 'Autoriser référent' : 'Bloquer référent'}><ShieldAlert className="w-4 h-4" /></button>
                  <button onClick={() => openBanModal(user)} className={`p-1.5 rounded-lg ${user.isBanned ? 'text-green-400 hover:bg-green-500/20' : 'text-orange-400 hover:bg-orange-500/20'}`}><Ban className="w-4 h-4" /></button>
                  {!userIsArbitre && <button onClick={() => setDeleteConfirm({ type: 'user', id: user._id })} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Users Table - Desktop */}
      <div className="hidden md:block bg-dark-800/50 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-900/50">
              <tr>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Utilisateur</th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Discord</th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Escouade</th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Rôles</th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Coins</th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Statut</th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase hidden xl:table-cell">IP</th>
                <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase hidden xl:table-cell">Date</th>
                <th className="px-4 lg:px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-8 text-center text-gray-400">
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user._id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 lg:px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={getAvatarUrl(user.avatarUrl || user.avatar) || '/avatar.jpg'}
                          alt=""
                          className="w-10 h-10 rounded-full"
                        />
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">{user.username || user.discordUsername || 'Sans identifiant'}</p>
                          <p className="text-gray-500 text-xs truncate max-w-[150px]">{user._id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <p className="text-white text-sm truncate max-w-[120px]">{user.discordUsername}</p>
                      <p className="text-gray-500 text-xs truncate">{user.discordId}</p>
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      {user.squad ? (
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-purple-400 flex-shrink-0" />
                          <span className="text-white text-sm truncate max-w-[100px]">{user.squad.name}</span>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {user.roles?.map((role) => (
                          <span
                            key={role}
                            className={`px-2 py-0.5 text-xs font-medium rounded bg-${getRoleColor(role)}-500/20 text-${getRoleColor(role)}-400`}
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <div className="flex items-center gap-1 text-yellow-400">
                        <Coins className="w-4 h-4" />
                        <span className="font-medium">{user.goldCoins || 0}</span>
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      {user.isBanned ? (
                        <span className="px-2 py-1 text-xs font-medium rounded bg-red-500/20 text-red-400">
                          Banni
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded bg-green-500/20 text-green-400">
                          Actif
                        </span>
                      )}
                    </td>
                    <td className="px-4 lg:px-6 py-4 hidden xl:table-cell">
                      {user.lastIp ? (
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                          <span className="text-cyan-400 text-xs font-mono">{user.lastIp}</span>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-gray-400 text-sm hidden xl:table-cell">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {/* Admin only: Purchase history and give item */}
                        {userIsAdmin && openUserPurchasesModal && <button onClick={() => openUserPurchasesModal(user)} className="p-1.5 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-colors" title="Historique achats"><History className="w-4 h-4" /></button>}
                        {userIsAdmin && openGiveItemModal && <button onClick={() => openGiveItemModal(user)} className="p-1.5 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors" title="Donner objet"><Gift className="w-4 h-4" /></button>}
                        {userIsAdmin && handleTestTrophyDistribution && (
                          <button 
                            onClick={() => handleTestTrophyDistribution(user)} 
                            disabled={testTrophyLoading === user._id}
                            className="p-1.5 text-cyan-400 hover:bg-cyan-500/20 rounded-lg transition-colors disabled:opacity-50" 
                            title="Test distribution trophée"
                          >
                            {testTrophyLoading === user._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                          </button>
                        )}
                        {/* Arbitre only sees block referent and ban buttons */}
                        {!userIsArbitre && <button onClick={() => openEditModal('user', user)} className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors" title="Modifier"><Edit2 className="w-4 h-4" /></button>}
                        {!userIsArbitre && <button onClick={() => setResetStatsConfirm(user)} className="p-1.5 text-purple-400 hover:bg-purple-500/20 rounded-lg transition-colors" title="Reset Stats"><RotateCcw className="w-4 h-4" /></button>}
                        <button onClick={() => openWarnModal(user)} className="p-1.5 text-orange-400 hover:bg-orange-500/20 rounded-lg transition-colors" title="Avertir"><AlertTriangle className="w-4 h-4" /></button>
                        <button onClick={() => openRankedBanModal(user)} className={`p-1.5 rounded-lg transition-colors ${user.isRankedBanned ? 'text-purple-400 hover:bg-purple-500/20' : 'text-gray-400 hover:bg-gray-500/20'}`} title={user.isRankedBanned ? 'Débannir ranked' : 'Bannir ranked'}><Gamepad2 className="w-4 h-4" /></button>
                        <button onClick={() => handleToggleReferentBan(user)} className={`p-1.5 rounded-lg transition-colors ${user.isReferentBanned ? 'text-yellow-400 hover:bg-yellow-500/20' : 'text-gray-400 hover:bg-gray-500/20'}`} title={user.isReferentBanned ? 'Autoriser référent' : 'Bloquer référent'}><ShieldAlert className="w-4 h-4" /></button>
                        <button onClick={() => openBanModal(user)} className={`p-1.5 rounded-lg transition-colors ${user.isBanned ? 'text-green-400 hover:bg-green-500/20' : 'text-orange-400 hover:bg-orange-500/20'}`} title={user.isBanned ? 'Débannir' : 'Bannir'}><Ban className="w-4 h-4" /></button>
                        {!userIsArbitre && <button onClick={() => setDeleteConfirm({ type: 'user', id: user._id })} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors" title="Supprimer"><Trash2 className="w-4 h-4" /></button>}
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
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-full sm:w-auto px-4 py-2 bg-dark-800 text-white rounded-lg hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Précédent
          </button>
          <span className="text-gray-400 text-sm">
            Page {page} sur {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-full sm:w-auto px-4 py-2 bg-dark-800 text-white rounded-lg hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
