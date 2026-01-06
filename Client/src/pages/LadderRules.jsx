import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { 
  ArrowLeft, ScrollText, Loader2, AlertCircle, FileText,
  Map, Clock, Users, Trophy, Shield, Target
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const LadderRules = () => {
  const { ladderId } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { selectedMode } = useMode();

  const isHardcore = selectedMode === 'hardcore';
  const accentColor = isHardcore ? 'red' : 'cyan';
  const gradientFrom = isHardcore ? 'from-red-500' : 'from-cyan-400';
  const gradientTo = isHardcore ? 'to-orange-600' : 'to-cyan-600';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rules, setRules] = useState(null);

  // Traductions
  const texts = {
    fr: {
      back: 'Retour',
      title: 'Règles du Classement',
      loading: 'Chargement des règles...',
      error: 'Erreur de chargement',
      notFound: 'Règles non trouvées',
      noContent: 'Aucune règle définie pour ce classement.',
      duoTrio: 'Chill',
      squadTeam: 'Compétitif',
      allowedMaps: 'Maps autorisées',
      schedule: 'Horaires',
      requirements: 'Prérequis',
    },
    en: {
      back: 'Back',
      title: 'Ranking Rules',
      loading: 'Loading rules...',
      error: 'Loading error',
      notFound: 'Rules not found',
      noContent: 'No rules defined for this ranking.',
      duoTrio: 'Chill',
      squadTeam: 'Compétitif',
      allowedMaps: 'Allowed Maps',
      schedule: 'Schedule',
      requirements: 'Requirements',
    },
    de: {
      back: 'Zurück',
      title: 'Ranglisten-Regeln',
      loading: 'Regeln werden geladen...',
      error: 'Ladefehler',
      notFound: 'Regeln nicht gefunden',
      noContent: 'Keine Regeln für diese Rangliste definiert.',
      duoTrio: 'Chill',
      squadTeam: 'Compétitif',
      allowedMaps: 'Erlaubte Karten',
      schedule: 'Zeitplan',
      requirements: 'Voraussetzungen',
    },
    it: {
      back: 'Indietro',
      title: 'Regole della Classifica',
      loading: 'Caricamento regole...',
      error: 'Errore di caricamento',
      notFound: 'Regole non trovate',
      noContent: 'Nessuna regola definita per questa classifica.',
      duoTrio: 'Chill',
      squadTeam: 'Compétitif',
      allowedMaps: 'Mappe consentite',
      schedule: 'Orario',
      requirements: 'Requisiti',
    },
  };

  const t = texts[language] || texts.en;

  // Fetch rules
  useEffect(() => {
    const fetchRules = async () => {
      if (!ladderId) {
        setError(t.notFound);
        setLoading(false);
        return;
      }

      try {
        const mode = isHardcore ? 'hardcore' : 'cdl';
        const response = await fetch(`${API_URL}/ladder-rules/${mode}/${ladderId}`);
        const data = await response.json();

        if (data.success && data.rules) {
          setRules(data.rules);
        } else {
          setError(data.message || t.notFound);
        }
      } catch (err) {
        console.error('Error fetching rules:', err);
        setError(t.error);
      } finally {
        setLoading(false);
      }
    };

    fetchRules();
  }, [ladderId, isHardcore]);

  // Get ladder name
  const getLadderName = () => {
    if (ladderId === 'duo-trio') return t.duoTrio;
    if (ladderId === 'squad-team') return t.squadTeam;
    return ladderId;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className={`w-8 h-8 text-${accentColor}-500 animate-spin`} />
          <p className="text-gray-400">{t.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className={`flex items-center gap-2 text-gray-400 hover:text-${accentColor}-400 transition-colors mb-6`}
        >
          <ArrowLeft className="w-5 h-5" />
          {t.back}
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center`}>
            <ScrollText className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className={`text-3xl font-bold bg-gradient-to-r ${gradientFrom} ${gradientTo} bg-clip-text text-transparent`}>
              {t.title}
            </h1>
            <p className="text-gray-400">{getLadderName()}</p>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex items-center gap-4">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
            <div>
              <h3 className="text-red-400 font-semibold">{t.error}</h3>
              <p className="text-gray-400 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Rules content */}
        {!error && rules && (
          <div className="space-y-6">
            {/* Title */}
            {rules.title && (
              <div className="bg-dark-900/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
                <h2 className="text-xl font-bold text-white">
                  {rules.title[language] || rules.title.fr || rules.title.en || rules.title}
                </h2>
              </div>
            )}

            {/* Sections */}
            {rules.sections && rules.sections.length > 0 ? (
              rules.sections.sort((a, b) => a.order - b.order).map((section, index) => (
                <div 
                  key={section._id || index}
                  className="bg-dark-900/50 backdrop-blur-sm rounded-xl border border-white/10 p-6"
                >
                  <h3 className={`text-lg font-semibold text-${accentColor}-400 mb-4 flex items-center gap-2`}>
                    <FileText className="w-5 h-5" />
                    {section.title?.[language] || section.title?.fr || section.title?.en || section.title}
                  </h3>
                  <div 
                    className="prose prose-invert prose-sm max-w-none text-gray-300"
                    dangerouslySetInnerHTML={{ 
                      __html: section.content?.[language] || section.content?.fr || section.content?.en || section.content || ''
                    }}
                  />
                </div>
              ))
            ) : rules.content ? (
              <div className="bg-dark-900/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
                <div 
                  className="prose prose-invert prose-sm max-w-none text-gray-300"
                  dangerouslySetInnerHTML={{ 
                    __html: rules.content[language] || rules.content.fr || rules.content.en || rules.content
                  }}
                />
              </div>
            ) : (
              <div className="bg-dark-900/50 backdrop-blur-sm rounded-xl border border-white/10 p-6 text-center">
                <FileText className={`w-12 h-12 text-${accentColor}-500/30 mx-auto mb-4`} />
                <p className="text-gray-400">{t.noContent}</p>
              </div>
            )}

            {/* Allowed Maps */}
            {rules.allowedMaps && rules.allowedMaps.length > 0 && (
              <div className="bg-dark-900/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
                <h3 className={`text-lg font-semibold text-${accentColor}-400 mb-4 flex items-center gap-2`}>
                  <Map className="w-5 h-5" />
                  {t.allowedMaps}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {rules.allowedMaps.map((map, index) => (
                    <div 
                      key={map._id || index}
                      className={`bg-dark-800/50 border border-${accentColor}-500/20 rounded-lg p-3 text-center`}
                    >
                      {map.imageUrl && (
                        <img 
                          src={map.imageUrl} 
                          alt={map.name} 
                          className="w-full h-20 object-cover rounded-lg mb-2"
                        />
                      )}
                      <p className="text-white text-sm font-medium">{map.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* No rules */}
        {!error && !rules && (
          <div className="bg-dark-900/50 backdrop-blur-sm rounded-xl border border-white/10 p-12 text-center">
            <ScrollText className={`w-16 h-16 text-${accentColor}-500/30 mx-auto mb-4`} />
            <h3 className="text-xl font-semibold text-white mb-2">{t.notFound}</h3>
            <p className="text-gray-400">{t.noContent}</p>
          </div>
        )}

        {/* Back to rankings */}
        <div className="mt-8">
          <Link
            to={`/${selectedMode}/rankings`}
            className={`inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-xl text-white font-semibold hover:opacity-90 transition-opacity`}
          >
            <Trophy className="w-5 h-5" />
            {language === 'fr' ? 'Voir les classements' : 
             language === 'de' ? 'Ranglisten anzeigen' : 
             language === 'it' ? 'Vedi classifiche' : 
             'View rankings'}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LadderRules;
