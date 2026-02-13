import React, { useState, useEffect, useRef } from 'react';
import { 
  Bold, Italic, Underline, List, ListOrdered, Type, Heading2, Heading3, 
  Save, X, Plus, Edit2, Trash2, Loader2, Eye, ChevronDown, ChevronUp, 
  Flame, Swords, Target
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';

import { API_URL } from '../config';

// Rule destinations
const RULE_DESTINATIONS = [
  { 
    id: 'ranked-hardcore',
    label: 'Ranked Hardcore',
    icon: Flame,
    color: 'orange',
    mode: 'hardcore',
    location: 'ranked',
    description: { fr: 'Mode Classé Hardcore', en: 'Hardcore Ranked mode' },
    subTypes: [
      { value: 'snd', label: { fr: '💣 Recherche & Destruction', en: '💣 Search & Destroy' } }
    ]
  },
  { 
    id: 'ranked-cdl',
    label: 'Ranked CDL',
    icon: Target,
    color: 'cyan',
    mode: 'cdl',
    location: 'ranked',
    description: { fr: 'Mode Classé CDL', en: 'CDL Ranked mode' },
    subTypes: [
      { value: 'hardpoint', label: { fr: '📍 Hardpoint', en: '📍 Hardpoint' } },
      { value: 'snd', label: { fr: '💣 Recherche & Destruction', en: '💣 Search & Destroy' } }
    ]
  },
  { 
    id: 'stricker',
    label: 'Stricker Mode',
    icon: Swords,
    color: 'lime',
    mode: 'stricker',
    location: 'ranked',
    description: { fr: 'Mode Stricker S&D', en: 'Stricker S&D mode' },
    subTypes: [
      { value: 'stricker-snd-3v3', label: { fr: '💣 S&D 3v3', en: '💣 S&D 3v3' } },
      { value: 'stricker-snd-5v5', label: { fr: '💣 S&D 5v5', en: '💣 S&D 5v5' } }
    ]
  }
];

const LANGUAGES = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'it', label: 'IT' },
  { code: 'de', label: 'DE' }
];

const translations = {
  fr: {
    selectDestination: 'Destination',
    selectGameMode: 'Mode de jeu',
    existingSections: 'Sections',
    addSection: 'Ajouter une section',
    editSection: 'Modifier',
    cancel: 'Annuler',
    sectionTitle: 'Titre',
    content: 'Contenu',
    preview: 'Aperçu',
    save: 'Sauvegarder',
    saving: 'Sauvegarde...',
    update: 'Mettre à jour',
    add: 'Ajouter',
    sectionUpdated: 'Section mise à jour',
    sectionAdded: 'Section ajoutée',
    sectionDeleted: 'Section supprimée',
    errorLoading: 'Erreur de chargement',
    errorSaving: 'Erreur de sauvegarde',
    requiredFields: 'Titre et contenu (FR, EN) requis',
    confirmDelete: 'Supprimer cette section ?',
    noSections: 'Aucune section configurée',
    noSectionsDesc: 'Cliquez sur "Ajouter une section" pour créer des règles.'
  },
  en: {
    selectDestination: 'Destination',
    selectGameMode: 'Game mode',
    existingSections: 'Sections',
    addSection: 'Add section',
    editSection: 'Edit',
    cancel: 'Cancel',
    sectionTitle: 'Title',
    content: 'Content',
    preview: 'Preview',
    save: 'Save',
    saving: 'Saving...',
    update: 'Update',
    add: 'Add',
    sectionUpdated: 'Section updated',
    sectionAdded: 'Section added',
    sectionDeleted: 'Section deleted',
    errorLoading: 'Loading error',
    errorSaving: 'Save error',
    requiredFields: 'Title and content (FR, EN) required',
    confirmDelete: 'Delete this section?',
    noSections: 'No sections configured',
    noSectionsDesc: 'Click "Add section" to create rules.'
  }
};

const GameModeRulesEditor = () => {
  const { language } = useLanguage();
  const t = (key) => translations[language]?.[key] || translations.en[key] || key;
  
  const [selectedDestination, setSelectedDestination] = useState(RULE_DESTINATIONS[0]);
  const [selectedSubType, setSelectedSubType] = useState(RULE_DESTINATIONS[0].subTypes[0].value);
  const [selectedLang, setSelectedLang] = useState('fr');
  const [rules, setRules] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [expandedSections, setExpandedSections] = useState({});
  
  // Editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [sectionForm, setSectionForm] = useState({
    title: { fr: '', en: '', it: '', de: '' },
    content: { fr: '', en: '', it: '', de: '' }
  });
  
  const editorRef = useRef(null);

  useEffect(() => {
    fetchRules();
  }, [selectedDestination, selectedSubType]);

  useEffect(() => {
    setSelectedSubType(selectedDestination.subTypes[0].value);
  }, [selectedDestination]);

  useEffect(() => {
    if (editorRef.current && showEditor) {
      const currentContent = sectionForm.content[selectedLang] || '';
      if (editorRef.current.innerHTML !== currentContent) {
        editorRef.current.innerHTML = currentContent;
      }
    }
  }, [selectedLang, showEditor]);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/game-mode-rules/${selectedDestination.mode}/${selectedDestination.location}/${selectedSubType}`,
        { credentials: 'include' }
      );
      const data = await response.json();
      if (data.success) {
        setRules(data.rules);
        if (data.rules?.sections) {
          const expanded = {};
          data.rules.sections.forEach(section => { expanded[section._id] = false; });
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
      const url = editingSection
        ? `${API_URL}/game-mode-rules/admin/${selectedDestination.mode}/${selectedDestination.location}/${selectedSubType}/section/${editingSection._id}`
        : `${API_URL}/game-mode-rules/admin/${selectedDestination.mode}/${selectedDestination.location}/${selectedSubType}/section`;
      
      const response = await fetch(url, {
        method: editingSection ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(sectionForm)
      });
      
      const data = await response.json();
      if (data.success) {
        setRules(data.rules);
        setSuccess(editingSection ? t('sectionUpdated') : t('sectionAdded'));
        closeEditor();
      } else {
        setError(data.message || t('errorSaving'));
      }
    } catch (err) {
      console.error('Error saving section:', err);
      setError(t('errorSaving'));
    } finally {
      setSaving(false);
      setTimeout(() => { setSuccess(''); setError(''); }, 3000);
    }
  };

  const handleDeleteSection = async (sectionId) => {
    if (!confirm(t('confirmDelete'))) return;

    try {
      const response = await fetch(
        `${API_URL}/game-mode-rules/admin/${selectedDestination.mode}/${selectedDestination.location}/${selectedSubType}/section/${sectionId}`,
        { method: 'DELETE', credentials: 'include' }
      );
      const data = await response.json();
      if (data.success) {
        setRules(data.rules);
        setSuccess(t('sectionDeleted'));
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Error deleting section:', err);
    }
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditingSection(null);
    setSectionForm({
      title: { fr: '', en: '', it: '', de: '' },
      content: { fr: '', en: '', it: '', de: '' }
    });
    if (editorRef.current) editorRef.current.innerHTML = '';
  };

  const openAddSection = () => {
    setEditingSection(null);
    setSectionForm({
      title: { fr: '', en: '', it: '', de: '' },
      content: { fr: '', en: '', it: '', de: '' }
    });
    setShowEditor(true);
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = '';
    }, 0);
  };

  const startEditSection = (section) => {
    setEditingSection(section);
    setSectionForm({ title: section.title, content: section.content });
    setShowEditor(true);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = section.content[selectedLang] || '';
      }
    }, 0);
  };

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const colors = {
    orange: { bg: 'bg-orange-500', bgLight: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-400' },
    cyan: { bg: 'bg-cyan-500', bgLight: 'bg-cyan-500/20', border: 'border-cyan-500', text: 'text-cyan-400' },
    lime: { bg: 'bg-lime-500', bgLight: 'bg-lime-500/20', border: 'border-lime-500', text: 'text-lime-400' },
    purple: { bg: 'bg-purple-500', bgLight: 'bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-400' }
  };
  const c = colors[selectedDestination.color];

  return (
    <div className="space-y-3 sm:space-y-4 px-2 sm:px-0">
      {/* Destination & GameMode selectors - responsive */}
      <div className="flex flex-col gap-3">
        {/* Destination tabs - horizontally scrollable on mobile */}
        <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
          <div className="flex gap-1 bg-dark-800/50 rounded-lg p-1 min-w-max sm:min-w-0">
            {RULE_DESTINATIONS.map(dest => {
              const Icon = dest.icon;
              const isSelected = selectedDestination.id === dest.id;
              const destColor = colors[dest.color];
              return (
                <button
                  key={dest.id}
                  onClick={() => setSelectedDestination(dest)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                    isSelected ? `${destColor.bg} text-white` : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span>{dest.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SubType selector & Add button row */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* SubType selector */}
          {selectedDestination.subTypes.length > 1 && (
            <div className="flex gap-1 bg-dark-800/50 rounded-lg p-1 overflow-x-auto flex-1">
              {selectedDestination.subTypes.map(sub => (
                <button
                  key={sub.value}
                  onClick={() => setSelectedSubType(sub.value)}
                  className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                    selectedSubType === sub.value
                      ? `${c.bg} text-white`
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {sub.label[language] || sub.label.en}
                </button>
              ))}
            </div>
          )}

          {/* Add section button */}
          {!showEditor && (
            <button
              onClick={openAddSection}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 ${c.bgLight} ${c.text} rounded-lg text-xs sm:text-sm font-medium hover:opacity-80 transition-all flex-shrink-0 ${selectedDestination.subTypes.length > 1 ? '' : 'ml-auto'}`}
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{t('addSection')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {success && (
        <div className="p-2.5 sm:p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-xs sm:text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="p-2.5 sm:p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-xs sm:text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8 sm:py-12">
          <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Editor panel (shown when adding/editing) */}
          {showEditor && (
            <div className={`bg-dark-900 rounded-xl border-2 ${editingSection ? 'border-amber-500/50' : c.border} p-3 sm:p-4`}>
              <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
                <h3 className="text-sm sm:text-lg font-semibold text-white truncate flex-1">
                  {editingSection ? (
                    <span className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                      <span className="text-xs sm:text-base">{t('editSection')}:</span>
                      <span className="text-xs sm:text-base text-gray-300 truncate">
                        {editingSection.title.fr || editingSection.title.en}
                      </span>
                    </span>
                  ) : t('addSection')}
                </h3>
                <button
                  onClick={closeEditor}
                  className="flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded-lg text-xs sm:text-sm flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('cancel')}</span>
                </button>
              </div>

              {/* Language tabs - scrollable on mobile */}
              <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 mb-3 sm:mb-4">
                <div className="flex gap-1 min-w-max sm:min-w-0">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => setSelectedLang(lang.code)}
                      className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex-shrink-0 ${
                        selectedLang === lang.code ? `${c.bg} text-white` : 'bg-dark-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                {/* Title input */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    {t('sectionTitle')} ({selectedLang.toUpperCase()})
                    {(selectedLang === 'fr' || selectedLang === 'en') && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  <input
                    type="text"
                    value={sectionForm.title[selectedLang]}
                    onChange={(e) => setSectionForm({
                      ...sectionForm,
                      title: { ...sectionForm.title, [selectedLang]: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/30"
                  />
                </div>

                {/* Content editor */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    {t('content')} ({selectedLang.toUpperCase()})
                    {(selectedLang === 'fr' || selectedLang === 'en') && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  {/* Toolbar - scrollable on mobile */}
                  <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
                    <div className="flex gap-0.5 p-1 bg-dark-800 border border-white/10 rounded-t-lg min-w-max sm:min-w-0">
                      <button type="button" onClick={() => applyFormat('bold')} className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white flex-shrink-0"><Bold className="w-4 h-4" /></button>
                      <button type="button" onClick={() => applyFormat('italic')} className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white flex-shrink-0"><Italic className="w-4 h-4" /></button>
                      <button type="button" onClick={() => applyFormat('underline')} className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white flex-shrink-0"><Underline className="w-4 h-4" /></button>
                      <div className="w-px bg-white/10 mx-0.5" />
                      <button type="button" onClick={() => applyFormat('insertUnorderedList')} className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white flex-shrink-0"><List className="w-4 h-4" /></button>
                      <button type="button" onClick={() => applyFormat('insertOrderedList')} className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white flex-shrink-0"><ListOrdered className="w-4 h-4" /></button>
                      <div className="w-px bg-white/10 mx-0.5" />
                      <button type="button" onClick={() => applyFormat('formatBlock', '<h2>')} className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white flex-shrink-0"><Heading2 className="w-4 h-4" /></button>
                      <button type="button" onClick={() => applyFormat('formatBlock', '<h3>')} className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white flex-shrink-0"><Heading3 className="w-4 h-4" /></button>
                      <button type="button" onClick={() => applyFormat('formatBlock', '<p>')} className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white flex-shrink-0"><Type className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => setSectionForm({
                      ...sectionForm,
                      content: { ...sectionForm.content, [selectedLang]: e.currentTarget.innerHTML }
                    })}
                    className="w-full min-h-[180px] sm:min-h-[200px] p-3 bg-dark-800 border border-white/10 border-t-0 rounded-b-lg text-white text-sm focus:outline-none prose prose-invert max-w-none overflow-y-auto"
                  />
                </div>

                {/* Preview - collapsible on mobile */}
                <div className="lg:hidden">
                  <details className="group">
                    <summary className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-400 mb-2 select-none">
                      <Eye className="w-4 h-4" />
                      <span>{t('preview')}</span>
                      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="p-3 bg-dark-800/50 rounded-lg border border-white/10 min-h-[120px] mt-2">
                      <h3 className="text-base font-bold text-white mb-2">{sectionForm.title[selectedLang] || '...'}</h3>
                      <div 
                        className="prose prose-invert max-w-none text-sm"
                        dangerouslySetInnerHTML={{ __html: sectionForm.content[selectedLang] || '<p class="text-gray-500">...</p>' }}
                      />
                    </div>
                  </details>
                </div>

                {/* Preview - always visible on desktop */}
                <div className="hidden lg:block">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-medium text-gray-400">{t('preview')}</span>
                  </div>
                  <div className="p-4 bg-dark-800/50 rounded-lg border border-white/10 min-h-[240px]">
                    <h3 className="text-lg font-bold text-white mb-3">{sectionForm.title[selectedLang] || '...'}</h3>
                    <div 
                      className="prose prose-invert max-w-none text-sm"
                      dangerouslySetInnerHTML={{ __html: sectionForm.content[selectedLang] || '<p class="text-gray-500">...</p>' }}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleSaveSection}
                disabled={saving}
                className={`w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 ${c.bg} hover:opacity-90 disabled:bg-gray-600 text-white rounded-lg transition-colors font-medium text-sm`}
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> {t('saving')}</>
                ) : (
                  <><Save className="w-4 h-4 sm:w-5 sm:h-5" /> {editingSection ? t('update') : t('add')}</>
                )}
              </button>
            </div>
          )}

          {/* Existing sections list */}
          <div className={`bg-dark-900/50 rounded-xl border ${c.border}/30 p-3 sm:p-4`}>
            <h3 className={`text-sm font-semibold ${c.text} mb-3 flex items-center gap-2`}>
              {t('existingSections')}
              <span className="px-2 py-0.5 bg-white/10 rounded text-xs text-gray-400">
                {rules?.sections?.length || 0}
              </span>
            </h3>
            
            {!rules?.sections || rules.sections.length === 0 ? (
              <div className="text-center py-6 sm:py-8">
                <div className="text-gray-500 text-xs sm:text-sm">{t('noSections')}</div>
                <div className="text-gray-600 text-xs mt-1">{t('noSectionsDesc')}</div>
              </div>
            ) : (
              <div className="space-y-2">
                {rules.sections.sort((a, b) => (a.order || 0) - (b.order || 0)).map(section => (
                  <div
                    key={section._id}
                    className="bg-dark-800/50 rounded-lg border border-white/5 overflow-hidden"
                  >
                    <div className="flex items-center justify-between p-3 gap-2">
                      <button
                        onClick={() => toggleSection(section._id)}
                        className="flex items-center gap-2 flex-1 text-left min-w-0"
                      >
                        {expandedSections[section._id] ? (
                          <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        )}
                        <span className="text-white font-medium text-sm truncate">
                          {section.title.fr || section.title.en}
                        </span>
                      </button>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => startEditSection(section)}
                          className="p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                          title={t('editSection')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSection(section._id)}
                          className="p-2 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {expandedSections[section._id] && (
                      <div className="px-3 pb-3 pt-0 border-t border-white/5">
                        {/* Language titles - 2 cols on mobile, 4 on desktop */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                          {LANGUAGES.map(lang => (
                            <div key={lang.code} className="bg-dark-900/50 rounded-lg p-2">
                              <div className="text-xs text-gray-500 font-medium mb-1">{lang.label}</div>
                              <div className="text-xs text-gray-400 truncate" title={section.title[lang.code]}>
                                {section.title[lang.code] || '-'}
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Content preview */}
                        <div className="mt-3 p-3 bg-dark-900/50 rounded-lg">
                          <div className="text-xs text-gray-500 mb-2">Contenu (FR)</div>
                          <div 
                            className="prose prose-invert prose-sm max-w-none text-gray-300 text-xs sm:text-sm [&>*]:mb-1 [&>*:last-child]:mb-0"
                            dangerouslySetInnerHTML={{ __html: section.content.fr || section.content.en || '-' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default GameModeRulesEditor;

