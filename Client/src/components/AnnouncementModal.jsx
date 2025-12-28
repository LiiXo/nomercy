import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useMode } from '../ModeContext';
import { useLanguage } from '../LanguageContext';
import { 
  X, Bell, AlertTriangle, Info, Megaphone, Calendar, Wrench, 
  FileText, ChevronRight, ChevronLeft, Check, Loader2
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const AnnouncementModal = () => {
  const { isAuthenticated, user } = useAuth();
  const { selectedMode } = useMode();
  const { language } = useLanguage();
  const location = useLocation();
  
  // Only show announcements on dashboard pages (hardcore or cdl)
  const isOnDashboard = location.pathname === '/hardcore' || location.pathname === '/cdl';
  
  const [announcements, setAnnouncements] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only fetch announcements when on dashboard pages
    if (isAuthenticated && selectedMode && isOnDashboard) {
      fetchPendingAnnouncements();
    }
  }, [isAuthenticated, selectedMode, isOnDashboard]);

  const fetchPendingAnnouncements = async () => {
    try {
      const response = await fetch(`${API_URL}/announcements/pending?mode=${selectedMode}`, {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success && data.announcements.length > 0) {
        setAnnouncements(data.announcements);
        setShow(true);
      }
    } catch (err) {
      console.error('Error fetching announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!announcements[currentIndex]) return;
    
    setAcknowledging(true);
    try {
      await fetch(`${API_URL}/announcements/${announcements[currentIndex]._id}/acknowledge`, {
        method: 'POST',
        credentials: 'include'
      });

      // Move to next announcement or close
      if (currentIndex < announcements.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setShow(false);
        setAnnouncements([]);
      }
    } catch (err) {
      console.error('Error acknowledging:', err);
    } finally {
      setAcknowledging(false);
    }
  };

  const getTypeIcon = (type) => {
    const icons = {
      patch_note: FileText,
      announcement: Megaphone,
      maintenance: Wrench,
      event: Calendar,
      rules: FileText,
      important: AlertTriangle
    };
    return icons[type] || Bell;
  };

  const getTypeLabel = (type) => {
    const labels = {
      patch_note: language === 'fr' ? 'Notes de mise à jour' : 'Patch Notes',
      announcement: language === 'fr' ? 'Annonce' : 'Announcement',
      maintenance: 'Maintenance',
      event: language === 'fr' ? 'Événement' : 'Event',
      rules: language === 'fr' ? 'Règlement' : 'Rules',
      important: 'Important'
    };
    return labels[type] || type;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      normal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      critical: 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return colors[priority] || colors.normal;
  };

  const getTypeColor = (type) => {
    const colors = {
      patch_note: 'from-purple-500 to-pink-600',
      announcement: 'from-blue-500 to-cyan-600',
      maintenance: 'from-orange-500 to-amber-600',
      event: 'from-green-500 to-emerald-600',
      rules: 'from-gray-500 to-slate-600',
      important: 'from-red-500 to-rose-600'
    };
    return colors[type] || colors.announcement;
  };

  if (!show || announcements.length === 0) return null;

  const currentAnnouncement = announcements[currentIndex];
  const TypeIcon = getTypeIcon(currentAnnouncement.type);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-8">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-dark-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className={`bg-gradient-to-r ${getTypeColor(currentAnnouncement.type)} p-6`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <TypeIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-white/70 text-xs font-medium uppercase tracking-wider">
                  {getTypeLabel(currentAnnouncement.type)}
                  {currentAnnouncement.version && ` v${currentAnnouncement.version}`}
                </span>
                <h2 className="text-xl font-bold text-white mt-1">{currentAnnouncement.title}</h2>
              </div>
            </div>
            
            {/* Priority Badge */}
            {currentAnnouncement.priority !== 'normal' && (
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(currentAnnouncement.priority)}`}>
                {currentAnnouncement.priority === 'critical' ? '⚠️ ' : ''}
                {currentAnnouncement.priority.charAt(0).toUpperCase() + currentAnnouncement.priority.slice(1)}
              </span>
            )}
          </div>
          
          {/* Pagination indicator */}
          {announcements.length > 1 && (
            <div className="flex items-center space-x-2 mt-4">
              {announcements.map((_, idx) => (
                <div 
                  key={idx}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === currentIndex ? 'w-8 bg-white' : 'w-2 bg-white/30'
                  }`}
                />
              ))}
              <span className="text-white/70 text-xs ml-2">
                {currentIndex + 1} / {announcements.length}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="prose prose-invert max-w-none">
            {/* Parse content - support basic markdown-like formatting */}
            {currentAnnouncement.content.split('\n').map((paragraph, idx) => {
              // Headers
              if (paragraph.startsWith('### ')) {
                return <h3 key={idx} className="text-lg font-semibold text-white mt-4 mb-2">{paragraph.replace('### ', '')}</h3>;
              }
              if (paragraph.startsWith('## ')) {
                return <h2 key={idx} className="text-xl font-bold text-white mt-4 mb-2">{paragraph.replace('## ', '')}</h2>;
              }
              // List items
              if (paragraph.startsWith('- ') || paragraph.startsWith('• ')) {
                return (
                  <div key={idx} className="flex items-start space-x-2 text-gray-300 my-1">
                    <span className="text-purple-400 mt-1">•</span>
                    <span>{paragraph.replace(/^[-•]\s/, '')}</span>
                  </div>
                );
              }
              // Empty lines
              if (paragraph.trim() === '') {
                return <div key={idx} className="h-3"></div>;
              }
              // Regular paragraphs
              return <p key={idx} className="text-gray-300 my-2 leading-relaxed">{paragraph}</p>;
            })}
          </div>

          {/* Meta info */}
          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-gray-500">
            <span>
              {language === 'fr' ? 'Publié le' : 'Published on'}{' '}
              {new Date(currentAnnouncement.publishAt).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </span>
            {currentAnnouncement.createdBy && (
              <span>
                {language === 'fr' ? 'Par' : 'By'} {currentAnnouncement.createdBy.username}
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 p-4 bg-dark-950/50">
          <div className="flex items-center justify-between">
            {/* Navigation for multiple announcements */}
            <div className="flex items-center space-x-2">
              {currentIndex > 0 && (
                <button
                  onClick={() => setCurrentIndex(currentIndex - 1)}
                  className="flex items-center space-x-1 px-3 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="text-sm">{language === 'fr' ? 'Précédent' : 'Previous'}</span>
                </button>
              )}
            </div>

            {/* Acknowledge button */}
            <button
              onClick={handleAcknowledge}
              disabled={acknowledging}
              className={`flex items-center space-x-2 px-6 py-3 bg-gradient-to-r ${getTypeColor(currentAnnouncement.type)} text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-all shadow-lg`}
            >
              {acknowledging ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>
                    {currentIndex < announcements.length - 1 
                      ? (language === 'fr' ? 'J\'ai lu, suivant' : 'I\'ve read, next')
                      : (language === 'fr' ? 'J\'ai lu et compris' : 'I\'ve read and understood')
                    }
                  </span>
                  {currentIndex < announcements.length - 1 && <ChevronRight className="w-4 h-4" />}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementModal;

