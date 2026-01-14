import React from 'react';
import { Users, Shield, Swords, Eye, Activity, UserPlus, Target } from 'lucide-react';

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
