import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { 
  AlertTriangle, ArrowLeft, Loader2, Calendar, Users, Swords,
  Eye, Clock, Shield, MapPin
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const MyDisputes = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const { selectedMode } = useMode();

  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isHardcore = selectedMode === 'hardcore';
  const accentColor = isHardcore ? 'red' : 'cyan';
  const gradientFrom = isHardcore ? 'from-red-500' : 'from-cyan-400';
  const gradientTo = isHardcore ? 'to-orange-600' : 'to-cyan-600';

  const t = {
    fr: {
      title: 'Mes Litiges',
      subtitle: 'Matchs en attente de résolution',
      noDisputes: 'Aucun litige en cours',
      noDisputesDesc: 'Vous n\'avez pas de match en litige actuellement.',
      ladder: 'Ladder',
      ranked: 'Classé',
      reportedAt: 'Signalé le',
      reason: 'Raison',
      viewMatch: 'Voir la feuille de match',
      vsLabel: 'contre',
      waitingResolution: 'En attente de résolution par le staff',
      back: 'Retour'
    },
    en: {
      title: 'My Disputes',
      subtitle: 'Matches awaiting resolution',
      noDisputes: 'No ongoing disputes',
      noDisputesDesc: 'You don\'t have any disputed matches at the moment.',
      ladder: 'Ladder',
      ranked: 'Ranked',
      reportedAt: 'Reported on',
      reason: 'Reason',
      viewMatch: 'View match sheet',
      vsLabel: 'vs',
      waitingResolution: 'Awaiting staff resolution',
      back: 'Back'
    },
    de: {
      title: 'Meine Streitigkeiten',
      subtitle: 'Spiele warten auf Lösung',
      noDisputes: 'Keine laufenden Streitigkeiten',
      noDisputesDesc: 'Sie haben derzeit keine strittigen Spiele.',
      ladder: 'Ladder',
      ranked: 'Ranked',
      reportedAt: 'Gemeldet am',
      reason: 'Grund',
      viewMatch: 'Spielübersicht anzeigen',
      vsLabel: 'gegen',
      waitingResolution: 'Wartet auf Mitarbeiterlösung',
      back: 'Zurück'
    },
    it: {
      title: 'Le mie controversie',
      subtitle: 'Partite in attesa di risoluzione',
      noDisputes: 'Nessuna controversia in corso',
      noDisputesDesc: 'Non hai partite contestate al momento.',
      ladder: 'Ladder',
      ranked: 'Classificato',
      reportedAt: 'Segnalato il',
      reason: 'Motivo',
      viewMatch: 'Vedi foglio partita',
      vsLabel: 'vs',
      waitingResolution: 'In attesa della risoluzione dello staff',
      back: 'Indietro'
    }
  }[language] || {
    title: 'My Disputes',
    subtitle: 'Matches awaiting resolution',
    noDisputes: 'No ongoing disputes',
    noDisputesDesc: 'You don\'t have any disputed matches at the moment.',
    ladder: 'Ladder',
    ranked: 'Ranked',
    reportedAt: 'Reported on',
    reason: 'Reason',
    viewMatch: 'View match sheet',
    vsLabel: 'vs',
    waitingResolution: 'Awaiting staff resolution',
    back: 'Back'
  };

  useEffect(() => {
    const titles = {
      fr: 'NoMercy - Mes Litiges',
      en: 'NoMercy - My Disputes',
      it: 'NoMercy - Le mie controversie',
      de: 'NoMercy - Meine Streitigkeiten',
    };
    document.title = titles[language] || titles.en;
  }, [language]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDisputes();
    }
  }, [isAuthenticated]);

  const fetchDisputes = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/matches/my-disputes`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setDisputes(data.disputes || []);
      } else {
        setError(data.message || 'Error fetching disputes');
      }
    } catch (err) {
      console.error('Error fetching disputes:', err);
      setError('Erreur lors du chargement des litiges');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : language === 'it' ? 'it-IT' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isAuthenticated) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-dark-950 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className={`p-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-gray-400 hover:text-white transition-colors`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <AlertTriangle className="w-7 h-7 text-orange-400" />
              {t.title}
            </h1>
            <p className="text-gray-400 text-sm mt-1">{t.subtitle}</p>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className={`w-8 h-8 animate-spin ${isHardcore ? 'text-red-500' : 'text-cyan-500'}`} />
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-red-400">{error}</p>
          </div>
        ) : disputes.length === 0 ? (
          <div className="bg-dark-900 border border-white/10 rounded-xl p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-10 h-10 text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">{t.noDisputes}</h3>
            <p className="text-gray-400">{t.noDisputesDesc}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {disputes.map((match) => {
              const isLadder = match.disputeType === 'ladder';
              const matchUrl = isLadder ? `/match/${match._id}` : `/ranked/match/${match._id}`;
              
              return (
                <div 
                  key={match._id}
                  className="bg-dark-900 border border-orange-500/30 rounded-xl overflow-hidden"
                >
                  {/* Match Header */}
                  <div className="px-4 py-3 bg-orange-500/10 border-b border-orange-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        isLadder 
                          ? 'bg-blue-500/20 text-blue-400' 
                          : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {isLadder ? t.ladder : t.ranked}
                      </span>
                      <span className="text-orange-400 text-sm font-medium flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        {t.waitingResolution}
                      </span>
                    </div>
                    {match.mode && (
                      <span className="text-xs text-gray-500 uppercase">
                        {match.mode}
                      </span>
                    )}
                  </div>

                  {/* Match Content */}
                  <div className="p-4">
                    {isLadder ? (
                      // Ladder Match Display
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {match.challenger?.logo && (
                            <img 
                              src={match.challenger.logo} 
                              alt=""
                              className="w-12 h-12 rounded-lg object-cover"
                            />
                          )}
                          <div>
                            <p className="font-semibold text-white">{match.challenger?.name || 'Team 1'}</p>
                            {match.challenger?.tag && (
                              <p className="text-xs text-gray-500">[{match.challenger.tag}]</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="px-4 py-2 bg-dark-800 rounded-lg">
                          <span className="text-gray-400 font-medium">{t.vsLabel}</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-semibold text-white">{match.opponent?.name || 'Team 2'}</p>
                            {match.opponent?.tag && (
                              <p className="text-xs text-gray-500">[{match.opponent.tag}]</p>
                            )}
                          </div>
                          {match.opponent?.logo && (
                            <img 
                              src={match.opponent.logo} 
                              alt=""
                              className="w-12 h-12 rounded-lg object-cover"
                            />
                          )}
                        </div>
                      </div>
                    ) : (
                      // Ranked Match Display
                      <div className="flex items-center justify-center gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <Swords className="w-5 h-5 text-purple-400" />
                          <span className="text-white font-medium">
                            {match.gameMode} - {match.players?.length || 2} joueurs
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Dispute Info */}
                    {match.dispute && (
                      <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 mb-4">
                        <p className="text-orange-400 text-xs font-medium mb-1">{t.reason}:</p>
                        <p className="text-gray-300 text-sm">{match.dispute.reason || '-'}</p>
                        {match.dispute.reportedAt && (
                          <p className="text-gray-500 text-xs mt-2">
                            {t.reportedAt} {formatDate(match.dispute.reportedAt)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Match Info */}
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center gap-4">
                        {match.selectedMap && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {match.selectedMap}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(match.createdAt)}
                        </span>
                      </div>
                      
                      <Link
                        to={matchUrl}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r ${gradientFrom} ${gradientTo} ${isHardcore ? 'text-white' : 'text-dark-950'} font-medium text-sm hover:opacity-90 transition-opacity`}
                      >
                        <Eye className="w-4 h-4" />
                        {t.viewMatch}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyDisputes;


























