import React from 'react';
import { 
  Search, Shield, TrendingUp, Crown, Star, Trophy, Trash2, X
} from 'lucide-react';
import { getAvatarUrl } from '../../utils/avatar';

const AdminSquads = ({
  squads,
  searchTerm,
  setSearchTerm,
  page,
  setPage,
  totalPages,
  userIsAdmin,
  openEditModal,
  openLadderPointsModal,
  openSquadTrophyModal,
  setDeleteConfirm,
  handleKickMember
}) => {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Gestion des Escouades</h2>
        <div className="text-gray-400 text-xs sm:text-sm">
          {squads.length} escouade(s) • Page {page}/{totalPages || 1}
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
          placeholder="Rechercher une escouade..."
          className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 bg-dark-800 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500/50"
        />
      </div>

      {/* Squads Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {squads.length === 0 ? (
          <div className="col-span-full text-center text-gray-400 py-8">
            Aucune escouade trouvée
          </div>
        ) : (
          squads.map((squad) => (
            <div
              key={squad._id}
              className="bg-dark-800/50 border border-white/10 rounded-xl p-4 sm:p-6 hover:border-white/20 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 sm:w-12 h-10 sm:h-12 rounded-lg flex items-center justify-center border border-white/10 flex-shrink-0"
                    style={{ backgroundColor: squad.color === 'transparent' ? 'transparent' : squad.color + '30' }}
                  >
                    {squad.logo ? (
                      <img src={squad.logo} alt="" className="w-6 sm:w-8 h-6 sm:h-8 object-contain" />
                    ) : (
                      <Shield className="w-5 sm:w-6 h-5 sm:h-6" style={{ color: squad.color === 'transparent' ? '#9ca3af' : squad.color }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-white font-bold text-sm sm:text-base truncate">{squad.name}</h3>
                    <p className="text-gray-400 text-xs sm:text-sm">[{squad.tag}]</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 sm:space-y-2 mb-4 text-xs sm:text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Membres</span>
                  <span className="text-white font-medium">{squad.members?.length || 0}/{squad.maxMembers}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Mode</span>
                  <span className="text-white font-medium">{squad.mode}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Level</span>
                  <span className="text-white font-medium">{squad.level || 1}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Points Top Escouade</span>
                  <span className="text-amber-400 font-bold">{squad.stats?.totalPoints || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">W/L</span>
                  <span className="text-white font-medium">{squad.stats?.totalWins || 0}W - {squad.stats?.totalLosses || 0}L</span>
                </div>
              </div>

              {/* Ladder Points */}
              {squad.registeredLadders && squad.registeredLadders.length > 0 && (
                <div className="mb-4 p-2.5 sm:p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg">
                  <p className="text-[10px] sm:text-xs text-purple-400 mb-2 font-medium flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Points Ladder
                  </p>
                  <div className="space-y-1 sm:space-y-1.5">
                    {squad.registeredLadders.map((ladder, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="text-gray-300 text-[10px] sm:text-xs">{ladder.ladderName || ladder.ladderId}</span>
                        <span className="text-purple-400 font-bold">{ladder.points} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Members list */}
              {squad.members && squad.members.length > 0 && (
                <div className="mb-4 p-2.5 sm:p-3 bg-dark-900/50 rounded-lg">
                  <p className="text-[10px] sm:text-xs text-gray-400 mb-2">Membres :</p>
                  <div className="space-y-1 sm:space-y-1.5 max-h-24 sm:max-h-32 overflow-y-auto">
                    {squad.members.map((member, idx) => {
                      const userId = member.user?._id || member.user;
                      const username = member.user?.username || member.user?.discordUsername || 'Inconnu';
                      const avatarUrl = getAvatarUrl(member.user?.avatarUrl || member.user?.avatar) || '/avatar.jpg';
                      const isLeader = userId?.toString() === squad.leader?._id?.toString() || userId?.toString() === squad.leader?.toString();
                      
                      return (
                        <div key={userId || idx} className="flex items-center justify-between text-xs sm:text-sm">
                          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                            <img 
                              src={avatarUrl} 
                              alt="" 
                              className="w-5 sm:w-6 h-5 sm:h-6 rounded-full object-cover border border-white/10 flex-shrink-0"
                            />
                            <span className="text-white text-[10px] sm:text-xs truncate max-w-[80px] sm:max-w-[100px]">{username}</span>
                            {isLeader && (
                              <Crown className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                            )}
                            {member.role === 'officer' && !isLeader && (
                              <Star className="w-3 h-3 text-purple-400 flex-shrink-0" />
                            )}
                          </div>
                          {!isLeader && (
                            <button
                              onClick={() => handleKickMember(squad._id, userId)}
                              className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                              title="Kick"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Trophies */}
              {squad.trophies && squad.trophies.length > 0 && (
                <div className="mb-4 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  {squad.trophies.slice(0, 3).map((t, i) => (
                    <div key={i} className="w-5 sm:w-6 h-5 sm:h-6 bg-yellow-500/20 rounded-full flex items-center justify-center">
                      <Trophy className="w-2.5 sm:w-3 h-2.5 sm:h-3 text-yellow-400" />
                    </div>
                  ))}
                  {squad.trophies.length > 3 && (
                    <span className="text-[10px] sm:text-xs text-gray-400">+{squad.trophies.length - 3}</span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <button
                  onClick={() => openEditModal('squad', squad)}
                  className="flex-1 py-1.5 sm:py-2 px-2 sm:px-3 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-xs sm:text-sm font-medium"
                >
                  Modifier
                </button>
                {userIsAdmin && squad.registeredLadders && squad.registeredLadders.length > 0 && (
                  <button
                    onClick={() => openLadderPointsModal(squad)}
                    className="py-1.5 sm:py-2 px-2 sm:px-3 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
                    title="Modifier les points Ladder"
                  >
                    <TrendingUp className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  </button>
                )}
                {userIsAdmin && (
                  <button
                    onClick={() => openSquadTrophyModal(squad)}
                    className="py-1.5 sm:py-2 px-2 sm:px-3 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors"
                    title="Gérer les trophées"
                  >
                    <Trophy className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  </button>
                )}
                <button
                  onClick={() => setDeleteConfirm({ type: 'squad', id: squad._id })}
                  className="py-1.5 sm:py-2 px-2 sm:px-3 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  <Trash2 className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-full sm:w-auto px-4 py-2 bg-dark-800 text-white rounded-lg hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Précédent
          </button>
          <span className="text-gray-400 text-sm">
            Page {page} sur {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-full sm:w-auto px-4 py-2 bg-dark-800 text-white rounded-lg hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminSquads;
