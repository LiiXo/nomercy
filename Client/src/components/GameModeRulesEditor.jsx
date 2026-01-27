import React, { useState, useEffect, useRef } from 'react';
import { 
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, 
  List, ListOrdered, Type, Heading1, Heading2, Heading3, 
  Save, X, Plus, Edit2, Trash2, Loader2, Eye, Code,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const MODES = [
  { value: 'hardcore', label: 'Hardcore', color: 'red' },
  { value: 'cdl', label: 'CDL', color: 'cyan' },
  { value: 'stricker', label: 'Stricker', color: 'lime' }
];

// Translations for locations
const getLocationLabels = (lang) => {
  const translations = {
    fr: {
      rankings: { label: '📊 Classements', sublabel: 'Dialog règles dans la page Rankings' },
      ranked: { label: '🎮 Mode Classé', sublabel: 'Dialog règles dans la page Ranked' },
      stricker: { label: '🎯 Mode Stricker', sublabel: 'Dialog règles dans la page Stricker' }
    },
    en: {
      rankings: { label: '📊 Rankings', sublabel: 'Rules dialog in Rankings page' },
      ranked: { label: '🎮 Ranked Mode', sublabel: 'Rules dialog in Ranked page' },
      stricker: { label: '🎯 Stricker Mode', sublabel: 'Rules dialog in Stricker page' }
    },
    it: {
      rankings: { label: '📊 Classifiche', sublabel: 'Dialog regole nella pagina Classifiche' },
      ranked: { label: '🎮 Modalità Classificata', sublabel: 'Dialog regole nella pagina Classificata' },
      stricker: { label: '🎯 Modalità Stricker', sublabel: 'Dialog regole nella pagina Stricker' }
    },
    de: {
      rankings: { label: '📊 Rangliste', sublabel: 'Regeln-Dialog in der Rangliste-Seite' },
      ranked: { label: '🎮 Ranglisten-Modus', sublabel: 'Regeln-Dialog in der Ranglisten-Seite' },
      stricker: { label: '🎯 Stricker-Modus', sublabel: 'Regeln-Dialog in der Stricker-Seite' }
    }
  };
  return translations[lang] || translations.en;
};

// Sub-types based on location and mode
// Hardcore ranked: Duel, TDM (Mêlée Générale), S&D (Recherche et Destruction)
// CDL ranked: Hardpoint (Points Stratégiques), S&D (Recherche et Destruction)
// Stricker: S&D only (5v5)
const getSubTypeLabels = (lang, mode = 'hardcore') => {
  const translations = {
    fr: {
      rankings: [
        { value: 'duo-trio', label: '👥 Chill', sublabel: 'Ladder Chill' },
        { value: 'squad-team', label: '👥👥 Compétitif', sublabel: 'Ladder Compétitif' }
      ],
      ranked_hardcore: [
        { value: 'duel', label: '⚔️ Duel 1v1', sublabel: 'Mode Duel' },
        { value: 'tdm', label: '💀 Mêlée Générale', sublabel: 'Team Deathmatch' },
        { value: 'snd', label: '💣 Recherche & Destruction', sublabel: 'Search and Destroy' }
      ],
      ranked_cdl: [
        { value: 'hardpoint', label: '📍 Points Stratégiques', sublabel: 'Hardpoint' },
        { value: 'snd', label: '💣 Recherche & Destruction', sublabel: 'Search and Destroy' }
      ],
      ranked_stricker: [
        { value: 'stricker-snd', label: '💣 Recherche & Destruction 5v5', sublabel: 'Mode Stricker S&D' }
      ]
    },
    en: {
      rankings: [
        { value: 'duo-trio', label: '👥 Chill', sublabel: 'Chill Ladder' },
        { value: 'squad-team', label: '👥👥 Compétitif', sublabel: 'Compétitif Ladder' }
      ],
      ranked_hardcore: [
        { value: 'duel', label: '⚔️ Duel 1v1', sublabel: 'Duel Mode' },
        { value: 'tdm', label: '💀 Team Deathmatch', sublabel: 'Team Deathmatch' },
        { value: 'snd', label: '💣 Search & Destroy', sublabel: 'Search and Destroy' }
      ],
      ranked_cdl: [
        { value: 'hardpoint', label: '📍 Hardpoint', sublabel: 'Hardpoint Mode' },
        { value: 'snd', label: '💣 Search & Destroy', sublabel: 'Search and Destroy' }
      ],
      ranked_stricker: [
        { value: 'stricker-snd', label: '💣 Search & Destroy 5v5', sublabel: 'Stricker S&D Mode' }
      ]
    },
    it: {
      rankings: [
        { value: 'duo-trio', label: '👥 Chill', sublabel: 'Classifica Chill' },
        { value: 'squad-team', label: '👥👥 Compétitif', sublabel: 'Classifica Compétitif' }
      ],
      ranked_hardcore: [
        { value: 'duel', label: '⚔️ Duello 1v1', sublabel: 'Modalità Duello' },
        { value: 'tdm', label: '💀 Mischia Generale', sublabel: 'Team Deathmatch' },
        { value: 'snd', label: '💣 Cerca e Distruggi', sublabel: 'Cerca e Distruggi' }
      ],
      ranked_cdl: [
        { value: 'hardpoint', label: '📍 Punti Strategici', sublabel: 'Hardpoint' },
        { value: 'snd', label: '💣 Cerca e Distruggi', sublabel: 'Cerca e Distruggi' }
      ],
      ranked_stricker: [
        { value: 'stricker-snd', label: '💣 Cerca e Distruggi 5v5', sublabel: 'Modalità Stricker S&D' }
      ]
    },
    de: {
      rankings: [
        { value: 'duo-trio', label: '👥 Chill', sublabel: 'Chill-Rangliste' },
        { value: 'squad-team', label: '👥👥 Compétitif', sublabel: 'Compétitif-Rangliste' }
      ],
      ranked_hardcore: [
        { value: 'duel', label: '⚔️ Duell 1v1', sublabel: 'Duell-Modus' },
        { value: 'tdm', label: '💀 Team Deathmatch', sublabel: 'Team Deathmatch' },
        { value: 'snd', label: '💣 Suchen & Zerstören', sublabel: 'Suchen & Zerstören' }
      ],
      ranked_cdl: [
        { value: 'hardpoint', label: '📍 Hardpoint', sublabel: 'Hardpoint-Modus' },
        { value: 'snd', label: '💣 Suchen & Zerstören', sublabel: 'Suchen & Zerstören' }
      ],
      ranked_stricker: [
        { value: 'stricker-snd', label: '💣 Suchen & Zerstören 5v5', sublabel: 'Stricker S&D-Modus' }
      ]
    }
  };
  const t = translations[lang] || translations.en;
  // Return the appropriate list based on location and mode
  return {
    rankings: t.rankings,
    ranked: mode === 'cdl' ? t.ranked_cdl : mode === 'stricker' ? t.ranked_stricker : t.ranked_hardcore
  };
};

const LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
  { code: 'de', label: 'Deutsch' }
];

// Translations object
const translations = {
  fr: {
    destinationTitle: '📍 Destination d\'affichage des règles',
    subTypeTitleRankings: '🎯 Type de Ladder',
    subTypeTitleRanked: '🎯 Mode de Jeu',
    existingSections: 'Sections existantes',
    newSection: 'Nouvelle section',
    editSection: 'Modifier la section',
    cancel: 'Annuler',
    sectionTitle: 'Titre de la section',
    content: 'Contenu',
    preview: 'Aperçu',
    previewPlaceholder: 'Le contenu apparaîtra ici...',
    save: 'Sauvegarder',
    saving: 'Sauvegarde...',
    updateSection: 'Mettre à jour la section',
    addSection: 'Ajouter la section',
    sectionUpdated: 'Section mise à jour',
    sectionAdded: 'Section ajoutée',
    sectionDeleted: 'Section supprimée',
    errorLoading: 'Erreur lors du chargement des règles',
    errorSaving: 'Erreur lors de la sauvegarde',
    errorUpdating: 'Erreur lors de la mise à jour',
    errorAdding: 'Erreur lors de l\'ajout',
    errorDeleting: 'Erreur lors de la suppression',
    requiredFields: 'Le titre et le contenu en FR et EN sont obligatoires',
    confirmDelete: 'Êtes-vous sûr de vouloir supprimer cette section ?',
    // Tooltips
    bold: 'Gras',
    italic: 'Italique',
    underline: 'Souligné',
    alignLeft: 'Aligner à gauche',
    alignCenter: 'Centrer',
    alignRight: 'Aligner à droite',
    bulletList: 'Liste à puces',
    numberedList: 'Liste numérotée',
    heading1: 'Titre 1',
    heading2: 'Titre 2',
    heading3: 'Titre 3',
    paragraph: 'Paragraphe normal'
  },
  en: {
    destinationTitle: '📍 Rules Display Destination',
    subTypeTitleRankings: '🎯 Ladder Type',
    subTypeTitleRanked: '🎯 Game Mode',
    existingSections: 'Existing sections',
    newSection: 'New section',
    editSection: 'Edit section',
    cancel: 'Cancel',
    sectionTitle: 'Section title',
    content: 'Content',
    preview: 'Preview',
    previewPlaceholder: 'Content will appear here...',
    save: 'Save',
    saving: 'Saving...',
    updateSection: 'Update section',
    addSection: 'Add section',
    sectionUpdated: 'Section updated',
    sectionAdded: 'Section added',
    sectionDeleted: 'Section deleted',
    errorLoading: 'Error loading rules',
    errorSaving: 'Error saving',
    errorUpdating: 'Error updating',
    errorAdding: 'Error adding',
    errorDeleting: 'Error deleting',
    requiredFields: 'Title and content (FR, EN) are required',
    confirmDelete: 'Are you sure you want to delete this section?',
    // Tooltips
    bold: 'Bold',
    italic: 'Italic',
    underline: 'Underline',
    alignLeft: 'Align left',
    alignCenter: 'Center',
    alignRight: 'Align right',
    bulletList: 'Bullet list',
    numberedList: 'Numbered list',
    heading1: 'Heading 1',
    heading2: 'Heading 2',
    heading3: 'Heading 3',
    paragraph: 'Normal paragraph'
  },
  it: {
    destinationTitle: '📍 Destinazione di visualizzazione delle regole',
    subTypeTitleRankings: '🎯 Tipo di Classifica',
    subTypeTitleRanked: '🎯 Modalità di Gioco',
    existingSections: 'Sezioni esistenti',
    newSection: 'Nuova sezione',
    editSection: 'Modifica sezione',
    cancel: 'Annulla',
    sectionTitle: 'Titolo della sezione',
    content: 'Contenuto',
    preview: 'Anteprima',
    previewPlaceholder: 'Il contenuto apparirà qui...',
    save: 'Salva',
    saving: 'Salvataggio...',
    updateSection: 'Aggiorna sezione',
    addSection: 'Aggiungi sezione',
    sectionUpdated: 'Sezione aggiornata',
    sectionAdded: 'Sezione aggiunta',
    sectionDeleted: 'Sezione eliminata',
    errorLoading: 'Errore nel caricamento delle regole',
    errorSaving: 'Errore nel salvataggio',
    errorUpdating: 'Errore nell\'aggiornamento',
    errorAdding: 'Errore nell\'aggiunta',
    errorDeleting: 'Errore nell\'eliminazione',
    requiredFields: 'Il titolo e il contenuto (FR, EN) sono obbligatori',
    confirmDelete: 'Sei sicuro di voler eliminare questa sezione?',
    // Tooltips
    bold: 'Grassetto',
    italic: 'Corsivo',
    underline: 'Sottolineato',
    alignLeft: 'Allinea a sinistra',
    alignCenter: 'Centra',
    alignRight: 'Allinea a destra',
    bulletList: 'Elenco puntato',
    numberedList: 'Elenco numerato',
    heading1: 'Titolo 1',
    heading2: 'Titolo 2',
    heading3: 'Titolo 3',
    paragraph: 'Paragrafo normale'
  },
  de: {
    destinationTitle: '📍 Regeln-Anzeigeziel',
    subTypeTitleRankings: '🎯 Ranglisten-Typ',
    subTypeTitleRanked: '🎯 Spielmodus',
    existingSections: 'Vorhandene Abschnitte',
    newSection: 'Neuer Abschnitt',
    editSection: 'Abschnitt bearbeiten',
    cancel: 'Abbrechen',
    sectionTitle: 'Abschnittstitel',
    content: 'Inhalt',
    preview: 'Vorschau',
    previewPlaceholder: 'Der Inhalt wird hier angezeigt...',
    save: 'Speichern',
    saving: 'Speichern...',
    updateSection: 'Abschnitt aktualisieren',
    addSection: 'Abschnitt hinzufügen',
    sectionUpdated: 'Abschnitt aktualisiert',
    sectionAdded: 'Abschnitt hinzugefügt',
    sectionDeleted: 'Abschnitt gelöscht',
    errorLoading: 'Fehler beim Laden der Regeln',
    errorSaving: 'Fehler beim Speichern',
    errorUpdating: 'Fehler beim Aktualisieren',
    errorAdding: 'Fehler beim Hinzufügen',
    errorDeleting: 'Fehler beim Löschen',
    requiredFields: 'Titel und Inhalt (FR, EN) sind erforderlich',
    confirmDelete: 'Sind Sie sicher, dass Sie diesen Abschnitt löschen möchten?',
    // Tooltips
    bold: 'Fett',
    italic: 'Kursiv',
    underline: 'Unterstrichen',
    alignLeft: 'Links ausrichten',
    alignCenter: 'Zentrieren',
    alignRight: 'Rechts ausrichten',
    bulletList: 'Aufzählungsliste',
    numberedList: 'Nummerierte Liste',
    heading1: 'Überschrift 1',
    heading2: 'Überschrift 2',
    heading3: 'Überschrift 3',
    paragraph: 'Normaler Absatz'
  }
};

const GameModeRulesEditor = () => {
  const { language } = useLanguage();
  const t = (key) => translations[language]?.[key] || translations.en[key] || key;
  
  const [selectedMode, setSelectedMode] = useState('hardcore');
  const [selectedLocation, setSelectedLocation] = useState('rankings');
  const [selectedSubType, setSelectedSubType] = useState('duo-trio');
  const [selectedLang, setSelectedLang] = useState('fr');
  const [rules, setRules] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [expandedSections, setExpandedSections] = useState({});
  
  // Section editor states
  const [editingSection, setEditingSection] = useState(null);
  const [sectionForm, setSectionForm] = useState({
    title: { fr: '', en: '', it: '', de: '' },
    content: { fr: '', en: '', it: '', de: '' },
    icon: 'fileText'
  });
  
  const editorRef = useRef(null);

  useEffect(() => {
    fetchRules();
  }, [selectedMode, selectedLocation, selectedSubType]);
  
  // Reset subType when location or mode changes
  useEffect(() => {
    if (selectedLocation === 'rankings') {
      setSelectedSubType('duo-trio');
    } else {
      // For ranked, set default based on mode
      if (selectedMode === 'cdl') {
        setSelectedSubType('hardpoint');
      } else if (selectedMode === 'stricker') {
        setSelectedSubType('stricker-snd');
      } else {
        setSelectedSubType('duel');
      }
    }
  }, [selectedLocation, selectedMode]);

  // Update editor content when language changes
  useEffect(() => {
    if (editorRef.current) {
      const currentContent = sectionForm.content[selectedLang] || '';
      // Only update if content is different to avoid cursor issues
      if (editorRef.current.innerHTML !== currentContent) {
        editorRef.current.innerHTML = currentContent;
      }
    }
  }, [selectedLang]);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/game-mode-rules/${selectedMode}/${selectedLocation}/${selectedSubType}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setRules(data.rules);
        if (data.rules?.sections) {
          const expanded = {};
          data.rules.sections.forEach(section => {
            expanded[section._id] = true;
          });
          setExpandedSections(expanded);
        }
      }
    } catch (err) {
      console.error('Error fetching rules:', err);
      setError(t('errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const applyFormat = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleSaveSection = async () => {
    if (!sectionForm.title.fr || !sectionForm.title.en || 
        !sectionForm.content.fr || !sectionForm.content.en) {
      setError(t('requiredFields'));
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (editingSection) {
        // Update existing section
        const response = await fetch(
          `${API_URL}/game-mode-rules/admin/${selectedMode}/${selectedLocation}/${selectedSubType}/section/${editingSection._id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(sectionForm)
          }
        );
        const data = await response.json();
        if (data.success) {
          setRules(data.rules);
          setSuccess(t('sectionUpdated'));
          resetSectionForm();
        } else {
          setError(data.message || t('errorUpdating'));
        }
      } else {
        // Add new section
        const response = await fetch(
          `${API_URL}/game-mode-rules/admin/${selectedMode}/${selectedLocation}/${selectedSubType}/section`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(sectionForm)
          }
        );
        const data = await response.json();
        if (data.success) {
          setRules(data.rules);
          setSuccess(t('sectionAdded'));
          resetSectionForm();
        } else {
          setError(data.message || t('errorAdding'));
        }
      }
    } catch (err) {
      console.error('Error saving section:', err);
      setError(t('errorSaving'));
    } finally {
      setSaving(false);
      setTimeout(() => {
        setSuccess('');
        setError('');
      }, 3000);
    }
  };

  const handleDeleteSection = async (sectionId) => {
    if (!confirm(t('confirmDelete'))) return;

    try {
      const response = await fetch(
        `${API_URL}/game-mode-rules/admin/${selectedMode}/${selectedLocation}/${selectedSubType}/section/${sectionId}`,
        {
          method: 'DELETE',
          credentials: 'include'
        }
      );
      const data = await response.json();
      if (data.success) {
        setRules(data.rules);
        setSuccess(t('sectionDeleted'));
      } else {
        setError(data.message || t('errorDeleting'));
      }
    } catch (err) {
      console.error('Error deleting section:', err);
      setError(t('errorDeleting'));
    }
  };

  const resetSectionForm = () => {
    setEditingSection(null);
    setSectionForm({
      title: { fr: '', en: '', it: '', de: '' },
      content: { fr: '', en: '', it: '', de: '' },
      icon: 'fileText'
    });
    // Clear editor content
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
  };

  const startEditSection = (section) => {
    setEditingSection(section);
    setSectionForm({
      title: section.title,
      content: section.content,
      icon: section.icon || 'fileText'
    });
    // Update editor content after a small delay to ensure state is updated
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = section.content[selectedLang] || '';
      }
    }, 0);
  };

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const getModeColor = () => {
    const mode = MODES.find(m => m.value === selectedMode);
    return mode?.color || 'purple';
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header with mode selector */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          
          {/* Mode selector */}
          <div className="flex gap-2 w-full sm:w-auto">
            {MODES.map(mode => (
              <button
                key={mode.value}
                onClick={() => setSelectedMode(mode.value)}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                  selectedMode === mode.value
                    ? `bg-${mode.color}-500 text-white shadow-lg shadow-${mode.color}-500/50`
                    : 'bg-dark-800 text-gray-400 hover:text-white hover:bg-dark-700'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Location selector - Where rules will be displayed */}
        <div className="bg-dark-800/50 rounded-xl p-3 sm:p-4 border border-white/10">
          <h3 className="text-xs sm:text-sm font-medium text-gray-400 mb-3">{t('destinationTitle')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {['rankings', 'ranked'].map(locValue => {
              const locLabels = getLocationLabels(language)[locValue];
              return (
                <button
                  key={locValue}
                  onClick={() => setSelectedLocation(locValue)}
                  className={`p-3 sm:p-4 rounded-xl text-left transition-all border-2 ${
                    selectedLocation === locValue
                      ? locValue === 'rankings' 
                        ? 'bg-purple-500/20 border-purple-500 shadow-lg shadow-purple-500/20'
                        : 'bg-cyan-500/20 border-cyan-500 shadow-lg shadow-cyan-500/20'
                      : 'bg-dark-900 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className={`font-medium text-sm ${
                    selectedLocation === locValue
                      ? locValue === 'rankings' ? 'text-purple-400' : 'text-cyan-400'
                      : 'text-white'
                  }`}>
                    {locLabels.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{locLabels.sublabel}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* SubType selector - Specific game mode or ladder type */}
        <div className="bg-dark-800/50 rounded-xl p-3 sm:p-4 border border-white/10">
          <h3 className="text-xs sm:text-sm font-medium text-gray-400 mb-3">
            {selectedLocation === 'rankings' ? t('subTypeTitleRankings') : t('subTypeTitleRanked')}
          </h3>
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${selectedLocation === 'ranked' && selectedMode === 'hardcore' ? 'lg:grid-cols-3' : ''} gap-2 sm:gap-3`}>
            {getSubTypeLabels(language, selectedMode)[selectedLocation].map(sub => (
              <button
                key={sub.value}
                onClick={() => setSelectedSubType(sub.value)}
                className={`p-2 sm:p-3 rounded-xl text-left transition-all border-2 ${
                  selectedSubType === sub.value
                    ? selectedLocation === 'rankings'
                      ? 'bg-purple-500/20 border-purple-500 shadow-lg shadow-purple-500/20'
                      : 'bg-cyan-500/20 border-cyan-500 shadow-lg shadow-cyan-500/20'
                    : 'bg-dark-900 border-white/10 hover:border-white/20'
                }`}
              >
                <div className={`font-medium text-xs sm:text-sm ${
                  selectedSubType === sub.value
                    ? selectedLocation === 'rankings' ? 'text-purple-400' : 'text-cyan-400'
                    : 'text-white'
                }`}>
                  {sub.label}
                </div>
                <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5">{sub.sublabel}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Success/Error messages */}
      {success && (
        <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400">
          {success}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Existing sections */}
          {rules?.sections && rules.sections.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-base sm:text-lg font-semibold text-white">
                {t('existingSections')} ({rules.sections.length})
              </h3>
              {rules.sections.sort((a, b) => a.order - b.order).map(section => (
                <div
                  key={section._id}
                  className="bg-dark-900/80 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden"
                >
                  <div className="flex items-center justify-between p-3 sm:p-4 bg-dark-800/50 gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => toggleSection(section._id)}
                        className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
                      >
                        {expandedSections[section._id] ? (
                          <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" />
                        ) : (
                          <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                        )}
                      </button>
                      <h4 className="text-white font-medium text-sm sm:text-base truncate">
                        {section.title.fr || section.title.en}
                      </h4>
                    </div>
                    <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                      <button
                        onClick={() => startEditSection(section)}
                        className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSection(section._id)}
                        className="p-1.5 sm:p-2 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {expandedSections[section._id] && (
                    <div className="p-3 sm:p-4 space-y-3">
                      {LANGUAGES.map(lang => (
                        <div key={lang.code} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 font-medium">{lang.label}</span>
                          </div>
                          <div className="text-xs sm:text-sm text-gray-400">
                            <strong>{language === 'fr' ? 'Titre:' : language === 'en' ? 'Title:' : language === 'it' ? 'Titolo:' : 'Titel:'}</strong> {section.title[lang.code] || '-'}
                          </div>
                          <div 
                            className="text-xs sm:text-sm text-gray-300 prose prose-invert prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: section.content[lang.code] || '-' }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Section editor */}
          <div className="bg-dark-900/80 backdrop-blur-xl rounded-xl border border-purple-500/20 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
              <h3 className="text-lg sm:text-xl font-semibold text-white">
                {editingSection ? t('editSection') : t('newSection')}
              </h3>
              {editingSection && (
                <button
                  onClick={resetSectionForm}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm w-full sm:w-auto justify-center"
                >
                  <X className="w-4 h-4" />
                  {t('cancel')}
                </button>
              )}
            </div>

            {/* Language tabs */}
            <div className="flex gap-1 sm:gap-2 mb-4 sm:mb-6 border-b border-white/10 pb-2 overflow-x-auto">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLang(lang.code)}
                  className={`px-3 sm:px-4 py-2 rounded-t-lg font-medium transition-colors text-sm whitespace-nowrap ${
                    selectedLang === lang.code
                      ? 'bg-purple-500 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            {/* Title input */}
            <div className="mb-4 sm:mb-6">
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                {t('sectionTitle')} ({selectedLang.toUpperCase()})
                {(selectedLang === 'fr' || selectedLang === 'en') && (
                  <span className="text-red-400 ml-1">*</span>
                )}
              </label>
              <input
                type="text"
                value={sectionForm.title[selectedLang]}
                onChange={(e) => setSectionForm({
                  ...sectionForm,
                  title: { ...sectionForm.title, [selectedLang]: e.target.value }
                })}
                placeholder={`${t('sectionTitle')} ${LANGUAGES.find(l => l.code === selectedLang)?.label ? 'in ' + LANGUAGES.find(l => l.code === selectedLang).label : ''}`}
                className="w-full px-3 sm:px-4 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:border-purple-500/50"
              />
            </div>

            {/* Rich text editor toolbar */}
            <div className="mb-2">
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                {t('content')} ({selectedLang.toUpperCase()})
                {(selectedLang === 'fr' || selectedLang === 'en') && (
                  <span className="text-red-400 ml-1">*</span>
                )}
              </label>
              <div className="flex flex-wrap gap-0.5 sm:gap-1 p-1 sm:p-2 bg-dark-800 border border-white/10 rounded-t-lg overflow-x-auto">
                <button
                  type="button"
                  onClick={() => applyFormat('bold')}
                  className="p-1.5 sm:p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                  title={t('bold')}
                >
                  <Bold className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('italic')}
                  className="p-1.5 sm:p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                  title={t('italic')}
                >
                  <Italic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('underline')}
                  className="p-1.5 sm:p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                  title={t('underline')}
                >
                  <Underline className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <div className="w-px bg-white/10 mx-0.5 sm:mx-1"></div>
                <button
                  type="button"
                  onClick={() => applyFormat('justifyLeft')}
                  className="p-1.5 sm:p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                  title={t('alignLeft')}
                >
                  <AlignLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('justifyCenter')}
                  className="p-1.5 sm:p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                  title={t('alignCenter')}
                >
                  <AlignCenter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('justifyRight')}
                  className="p-1.5 sm:p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                  title={t('alignRight')}
                >
                  <AlignRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <div className="w-px bg-white/10 mx-0.5 sm:mx-1"></div>
                <button
                  type="button"
                  onClick={() => applyFormat('insertUnorderedList')}
                  className="p-1.5 sm:p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                  title={t('bulletList')}
                >
                  <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('insertOrderedList')}
                  className="p-1.5 sm:p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                  title={t('numberedList')}
                >
                  <ListOrdered className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <div className="w-px bg-white/10 mx-0.5 sm:mx-1"></div>
                <button
                  type="button"
                  onClick={() => applyFormat('formatBlock', '<h1>')}
                  className="p-1.5 sm:p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                  title={t('heading1')}
                >
                  <Heading1 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('formatBlock', '<h2>')}
                  className="p-1.5 sm:p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                  title={t('heading2')}
                >
                  <Heading2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('formatBlock', '<h3>')}
                  className="p-1.5 sm:p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                  title={t('heading3')}
                >
                  <Heading3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('formatBlock', '<p>')}
                  className="p-1.5 sm:p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                  title={t('paragraph')}
                >
                  <Type className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>

            {/* Content editor */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => {
                setSectionForm({
                  ...sectionForm,
                  content: { ...sectionForm.content, [selectedLang]: e.currentTarget.innerHTML }
                });
              }}
              className="w-full min-h-[200px] sm:min-h-[300px] p-3 sm:p-4 bg-dark-800 border border-white/10 rounded-b-lg text-white text-sm sm:text-base focus:outline-none focus:border-purple-500/50 prose prose-invert max-w-none overflow-y-auto"
            />

            {/* Preview toggle */}
            <div className="mt-4 p-3 sm:p-4 bg-dark-800/50 rounded-lg border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                <span className="text-xs sm:text-sm font-medium text-gray-300">{t('preview')}</span>
              </div>
              <div 
                className="prose prose-invert max-w-none text-xs sm:text-sm"
                dangerouslySetInnerHTML={{ __html: sectionForm.content[selectedLang] || `<p class="text-gray-500">${t('previewPlaceholder')}</p>` }}
              />
            </div>

            {/* Save button */}
            <button
              onClick={handleSaveSection}
              disabled={saving}
              className="w-full mt-4 sm:mt-6 flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 text-white rounded-lg transition-colors font-medium text-sm sm:text-base"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  {t('saving')}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                  {editingSection ? t('updateSection') : t('addSection')}
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default GameModeRulesEditor;

