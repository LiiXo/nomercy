import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { ArrowLeft, Loader2, FileText, AlertCircle } from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const GameModeRules = () => {
  const { mode } = useParams();
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const [rules, setRules] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentMode = mode || selectedMode || 'common';
  const isHardcore = currentMode === 'hardcore';
  const accentColor = isHardcore ? 'red' : 'cyan';
  const gradientFrom = isHardcore ? 'from-red-500' : 'from-cyan-500';
  const gradientTo = isHardcore ? 'to-orange-600' : 'to-blue-600';
  const borderColor = isHardcore ? 'border-red-500/20' : 'border-cyan-500/20';
  const textAccent = isHardcore ? 'text-red-400' : 'text-cyan-400';
  const bgAccent = isHardcore ? 'bg-red-500/10' : 'bg-cyan-500/10';

  const getText = (key) => {
    const texts = {
      pageTitle: {
        fr: 'Règles du Mode',
        en: 'Game Mode Rules',
        it: 'Regole della Modalità',
        de: 'Spielmodus-Regeln',
      },
      back: {
        fr: 'Retour',
        en: 'Back',
        it: 'Indietro',
        de: 'Zurück',
      },
      loading: {
        fr: 'Chargement...',
        en: 'Loading...',
        it: 'Caricamento...',
        de: 'Laden...',
      },
      noRules: {
        fr: 'Aucune règle disponible pour ce mode',
        en: 'No rules available for this mode',
        it: 'Nessuna regola disponibile per questa modalità',
        de: 'Keine Regeln für diesen Modus verfügbar',
      },
      errorLoading: {
        fr: 'Erreur lors du chargement des règles',
        en: 'Error loading rules',
        it: 'Errore nel caricamento delle regole',
        de: 'Fehler beim Laden der Regeln',
      }
    };
    return texts[key]?.[language] || texts[key]?.en || key;
  };

  useEffect(() => {
    fetchRules();
  }, [currentMode]);

  useEffect(() => {
    document.title = `NoMercy - ${getText('pageTitle')}`;
  }, [language]);

  const fetchRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/game-mode-rules/${currentMode}`);
      const data = await response.json();
      if (data.success) {
        setRules(data.rules);
      } else {
        setError(data.message);
      }
    } catch (err) {
      console.error('Error fetching rules:', err);
      setError(getText('errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className={`w-12 h-12 ${textAccent} animate-spin mx-auto mb-4`} />
          <p className="text-gray-400">{getText('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 relative">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none" style={{ 
        background: isHardcore 
          ? 'radial-gradient(ellipse at 20% 20%, rgba(239, 68, 68, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(249, 115, 22, 0.05) 0%, transparent 50%)'
          : 'radial-gradient(ellipse at 20% 20%, rgba(34, 211, 238, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(59, 130, 246, 0.05) 0%, transparent 50%)'
      }}></div>
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-30"></div>

      <div className="relative z-10 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back button */}
          <Link 
            to={currentMode ? `/${currentMode}` : '/'}
            className={`inline-flex items-center space-x-2 ${textAccent} hover:underline mb-6`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{getText('back')}</span>
          </Link>

          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className={`absolute inset-0 ${isHardcore ? 'bg-red-500/30' : 'bg-cyan-500/30'} blur-xl`}></div>
                <div className={`relative w-14 h-14 bg-gradient-to-br ${gradientFrom} ${gradientTo} rounded-xl flex items-center justify-center shadow-lg ${isHardcore ? 'shadow-red-500/40' : 'shadow-cyan-500/40'}`}>
                  <FileText className="w-7 h-7 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-1">
                  {rules?.title?.[language] || rules?.title?.en || getText('pageTitle')}
                </h1>
                <p className="text-gray-400 text-sm capitalize">{currentMode}</p>
              </div>
            </div>
          </div>

          {/* Rules Content */}
          {error ? (
            <div className="bg-dark-900/80 backdrop-blur-xl rounded-xl border border-red-500/20 p-8 text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <p className="text-gray-300">{error}</p>
            </div>
          ) : !rules || !rules.sections || rules.sections.length === 0 ? (
            <div className="bg-dark-900/80 backdrop-blur-xl rounded-xl border border-gray-600/20 p-8 text-center">
              <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">{getText('noRules')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {rules.sections.sort((a, b) => a.order - b.order).map((section, index) => (
                <div 
                  key={section._id || index}
                  className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border ${borderColor} overflow-hidden`}
                >
                  <div className={`px-6 py-4 border-b ${borderColor} ${bgAccent}`}>
                    <h2 className="font-bold text-white text-xl">
                      {section.title?.[language] || section.title?.en || `Section ${index + 1}`}
                    </h2>
                  </div>
                  <div className="p-6">
                    <div 
                      className="prose prose-invert max-w-none text-gray-300"
                      dangerouslySetInnerHTML={{ 
                        __html: section.content?.[language] || section.content?.en || '' 
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="mt-10 text-center text-gray-500 text-sm">
            <p>
              {rules?.updatedAt && 
                `Dernière mise à jour : ${new Date(rules.updatedAt).toLocaleDateString(language)}`
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameModeRules;


















