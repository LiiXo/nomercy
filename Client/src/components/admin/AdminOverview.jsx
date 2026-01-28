import React from 'react';
import { Users, Shield, Swords, Eye, Activity, UserPlus, Target, Coins, Calendar, TrendingUp } from 'lucide-react';

const AdminOverview = ({ stats }) => {
  if (!stats) return <div className="text-gray-400">Chargement des statistiques...</div>;

  const statCards = [
    { label: 'Utilisateurs', value: stats.totalUsers || 0, icon: Users, color: 'blue' },
    { label: 'Escouades', value: stats.totalSquads || 0, icon: Shield, color: 'purple' },
    { label: 'Matchs Totaux (Completed)', value: stats.totalMatches || 0, icon: Swords, color: 'green' },
  ];

  // Use real registration data from API or empty array
  const registrationsData = stats.registrationsLast30Days || [];
  const hasVisitorsData = stats.visitorsLast30Days && stats.visitorsLast30Days.length > 0;
  const visitorsData = stats.visitorsLast30Days || [];

  const maxRegistrations = registrationsData.length > 0 ? Math.max(...registrationsData.map(d => d.value), 1) : 1;
  const maxVisitors = visitorsData.length > 0 ? Math.max(...visitorsData.map(d => d.value), 1) : 1;

  return (
    <div className="space-y-4 sm:space-y-6">
      <h2 className="text-xl sm:text-2xl font-bold text-white">Vue d'ensemble</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-dark-800/50 border border-white/10 rounded-xl p-4 sm:p-6 hover:border-white/20 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs sm:text-sm mb-1">{stat.label}</p>
                  <p className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</p>
                </div>
                <div className={`w-10 sm:w-14 h-10 sm:h-14 rounded-xl bg-${stat.color}-500/20 flex items-center justify-center`}>
                  <Icon className={`w-5 sm:w-7 h-5 sm:h-7 text-${stat.color}-400`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Gold Statistics */}
      {stats.goldStats && (
        <div className="bg-dark-800/50 border border-yellow-500/20 rounded-xl p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Coins className="w-4 sm:w-5 h-4 sm:h-5 text-yellow-400" />
            Statistiques Gold
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* Top Gold User */}
            <div className="bg-dark-900/50 rounded-lg p-3 sm:p-4 border border-yellow-500/20">
              <p className="text-gray-400 text-xs sm:text-sm mb-2">👑 Plus riche</p>
              {stats.goldStats.topUser ? (
                <div className="flex items-center gap-3">
                  <img 
                    src={stats.goldStats.topUser.avatar || '/default-avatar.png'} 
                    alt="" 
                    className="w-10 h-10 rounded-full border-2 border-yellow-500/50"
                  />
                  <div>
                    <p className="text-white font-semibold text-sm">{stats.goldStats.topUser.username}</p>
                    <p className="text-yellow-400 font-bold">{stats.goldStats.topUser.goldCoins.toLocaleString()}</p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Aucun utilisateur</p>
              )}
            </div>
            {/* Average Gold */}
            <div className="bg-dark-900/50 rounded-lg p-3 sm:p-4 border border-yellow-500/20">
              <p className="text-gray-400 text-xs sm:text-sm mb-1">📊 Moyenne par joueur</p>
              <p className="text-xl sm:text-2xl font-bold text-yellow-400">{stats.goldStats.averageGold.toLocaleString()}</p>
              <p className="text-gray-500 text-xs mt-1">{stats.goldStats.usersWithGold} joueurs actifs</p>
            </div>
            {/* Total Gold */}
            <div className="bg-dark-900/50 rounded-lg p-3 sm:p-4 border border-yellow-500/20">
              <p className="text-gray-400 text-xs sm:text-sm mb-1">💰 Total en circulation</p>
              <p className="text-xl sm:text-2xl font-bold text-yellow-400">{stats.goldStats.totalGold.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Matchs Ladder (Completed) */}
      {stats.matchesByLadder && (
        <div className="bg-dark-800/50 border border-purple-500/20 rounded-xl p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Shield className="w-4 sm:w-5 h-4 sm:h-5 text-purple-400" />
            Matchs Ladder (Completed)
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-dark-900/50 rounded-lg p-3 sm:p-4 border border-green-500/20">
              <p className="text-gray-400 text-xs sm:text-sm mb-1">🎮 Chill (Duo/Trio)</p>
              <p className="text-xl sm:text-2xl font-bold text-green-400">{stats.matchesByLadder.duoTrio || 0}</p>
            </div>
            <div className="bg-dark-900/50 rounded-lg p-3 sm:p-4 border border-purple-500/20">
              <p className="text-gray-400 text-xs sm:text-sm mb-1">⚔️ Compétitif (Squad/Team)</p>
              <p className="text-xl sm:text-2xl font-bold text-purple-400">{stats.matchesByLadder.squadTeam || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Matchs Ranked (Completed) */}
      <div className="bg-dark-800/50 border border-orange-500/20 rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Target className="w-4 sm:w-5 h-4 sm:h-5 text-orange-400" />
          Matchs Ranked (Completed)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="bg-dark-900/50 rounded-lg p-3 sm:p-4 border border-orange-500/20">
            <p className="text-gray-400 text-xs sm:text-sm mb-1">🎯 Total Matchs Classés</p>
            <p className="text-xl sm:text-2xl font-bold text-orange-400">{stats.matchesByLadder?.ranked || stats.totalRankedMatches || 0}</p>
          </div>
          <div className="bg-dark-900/50 rounded-lg p-3 sm:p-4 border border-cyan-500/20">
            <p className="text-gray-400 text-xs sm:text-sm mb-1">🔥 Search & Destroy</p>
            <p className="text-xl sm:text-2xl font-bold text-cyan-400">{stats.rankedByMode?.searchAndDestroy || stats.matchesByLadder?.ranked || 0}</p>
          </div>
        </div>
      </div>

      {/* Ranked Matches Last 10 Days Table */}
      {stats.rankedMatchesLast10Days && stats.rankedMatchesLast10Days.length > 0 && (
        <div className="bg-dark-800/50 border border-purple-500/20 rounded-xl p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-4 sm:w-5 h-4 sm:h-5 text-purple-400" />
            Matchs Ranked - 10 derniers jours
          </h3>
          
          {/* Stats summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-dark-900/50 rounded-lg p-3 border border-purple-500/20">
              <p className="text-gray-400 text-xs mb-1">Total</p>
              <p className="text-xl font-bold text-purple-400">
                {stats.rankedMatchesLast10Days.reduce((a, b) => a + b.value, 0)}
              </p>
            </div>
            <div className="bg-dark-900/50 rounded-lg p-3 border border-cyan-500/20">
              <p className="text-gray-400 text-xs mb-1">Moyenne/jour</p>
              <p className="text-xl font-bold text-cyan-400">
                {(stats.rankedMatchesLast10Days.reduce((a, b) => a + b.value, 0) / 10).toFixed(1)}
              </p>
            </div>
            <div className="bg-dark-900/50 rounded-lg p-3 border border-green-500/20">
              <p className="text-gray-400 text-xs mb-1">Meilleur jour</p>
              <p className="text-xl font-bold text-green-400">
                {Math.max(...stats.rankedMatchesLast10Days.map(d => d.value))}
              </p>
            </div>
          </div>
          
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-gray-400 text-xs sm:text-sm font-medium">Date</th>
                  <th className="text-center py-2 px-3 text-gray-400 text-xs sm:text-sm font-medium">Matchs</th>
                  <th className="text-right py-2 px-3 text-gray-400 text-xs sm:text-sm font-medium hidden sm:table-cell">Tendance</th>
                </tr>
              </thead>
              <tbody>
                {stats.rankedMatchesLast10Days.map((day, index) => {
                  const prevDay = index > 0 ? stats.rankedMatchesLast10Days[index - 1] : null;
                  const trend = prevDay ? day.value - prevDay.value : 0;
                  const isToday = index === stats.rankedMatchesLast10Days.length - 1;
                  const maxValue = Math.max(...stats.rankedMatchesLast10Days.map(d => d.value), 1);
                  const barWidth = (day.value / maxValue) * 100;
                  
                  return (
                    <tr 
                      key={day.fullDate} 
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                        isToday ? 'bg-purple-500/10' : ''
                      }`}
                    >
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${isToday ? 'text-purple-400 font-bold' : 'text-white'}`}>
                            {day.date}
                          </span>
                          {isToday && (
                            <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] font-bold rounded">
                              Aujourd'hui
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 sm:w-24 h-2 bg-dark-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full transition-all"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className={`text-sm font-bold min-w-[2rem] text-center ${
                            day.value === 0 ? 'text-gray-500' : 'text-white'
                          }`}>
                            {day.value}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right hidden sm:table-cell">
                        {index > 0 && (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                            trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-gray-500'
                          }`}>
                            {trend > 0 ? (
                              <><TrendingUp className="w-3 h-3" />+{trend}</>
                            ) : trend < 0 ? (
                              <><TrendingUp className="w-3 h-3 rotate-180" />{trend}</>
                            ) : (
                              <span>-</span>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Visitors Chart - Last 30 Days */}
      <div className="bg-dark-800/50 border border-white/10 rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Eye className="w-4 sm:w-5 h-4 sm:h-5 text-cyan-400" />
          Visiteurs - 30 derniers jours
        </h3>
        {!hasVisitorsData ? (
          <div className="h-32 sm:h-48 flex items-center justify-center">
            <div className="text-center">
              <Activity className="w-10 sm:w-12 h-10 sm:h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-xs sm:text-sm">Suivi des visiteurs non configuré</p>
            </div>
          </div>
        ) : (
          <>
            <div className="h-32 sm:h-48 flex items-end gap-0.5 sm:gap-1 overflow-x-auto">
              {visitorsData.map((day, index) => (
                <div key={index} className="flex-1 min-w-[8px] sm:min-w-[12px] flex flex-col items-center group">
                  <div className="relative w-full">
                    <div
                      className="w-full bg-cyan-500/30 hover:bg-cyan-500/50 rounded-t transition-all cursor-pointer"
                      style={{ height: `${(day.value / maxVisitors) * 120}px`, minHeight: '4px' }}
                    />
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-dark-900 px-2 py-1 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 hidden sm:block">
                      {day.value} visiteurs
                    </div>
                  </div>
                  {index % 7 === 0 && (
                    <span className="text-[7px] sm:text-[9px] text-gray-500 mt-1 rotate-45 origin-left hidden sm:block">{day.date}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs sm:text-sm gap-2">
              <span className="text-gray-400">Total: <span className="text-cyan-400 font-bold">{visitorsData.reduce((a, b) => a + b.value, 0)}</span> visiteurs</span>
              <span className="text-gray-400">Moyenne: <span className="text-cyan-400 font-bold">{Math.round(visitorsData.reduce((a, b) => a + b.value, 0) / 30)}</span>/jour</span>
            </div>
          </>
        )}
      </div>

      {/* Registrations Chart - Last 30 Days */}
      <div className="bg-dark-800/50 border border-white/10 rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
          <UserPlus className="w-4 sm:w-5 h-4 sm:h-5 text-green-400" />
          Inscriptions - 30 derniers jours
        </h3>
        {registrationsData.length === 0 ? (
          <div className="h-32 sm:h-48 flex items-center justify-center">
            <div className="text-center">
              <UserPlus className="w-10 sm:w-12 h-10 sm:h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-xs sm:text-sm">Aucune donnée d'inscription disponible</p>
            </div>
          </div>
        ) : (
          <>
            <div className="h-32 sm:h-48 flex items-end gap-0.5 sm:gap-1 overflow-x-auto">
              {registrationsData.map((day, index) => (
                <div key={index} className="flex-1 min-w-[8px] sm:min-w-[12px] flex flex-col items-center group">
                  <div className="relative w-full">
                    <div
                      className="w-full bg-green-500/30 hover:bg-green-500/50 rounded-t transition-all cursor-pointer"
                      style={{ height: `${(day.value / maxRegistrations) * 120}px`, minHeight: '4px' }}
                    />
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-dark-900 px-2 py-1 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 hidden sm:block">
                      {day.value} inscription{day.value > 1 ? 's' : ''}
                    </div>
                  </div>
                  {index % 7 === 0 && (
                    <span className="text-[7px] sm:text-[9px] text-gray-500 mt-1 rotate-45 origin-left hidden sm:block">{day.date}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs sm:text-sm gap-2">
              <span className="text-gray-400">Total: <span className="text-green-400 font-bold">{registrationsData.reduce((a, b) => a + b.value, 0)}</span> inscriptions</span>
              <span className="text-gray-400">Moyenne: <span className="text-green-400 font-bold">{(registrationsData.reduce((a, b) => a + b.value, 0) / 30).toFixed(1)}</span>/jour</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminOverview;
