import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, AlertCircle, AlertTriangle, CheckCircle, Info, Wrench, ExternalLink } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { useAuth } from '../AuthContext';
import { translations } from '../translations';

import { API_URL } from '../config';

const GlobalAlerts = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const t = (key) => translations[language]?.[key] || translations.en[key] || key;
  
  // Check if user has admin access (admin, staff, or arbitre)
  const hasAdminAccess = user?.roles?.includes('admin') || user?.roles?.includes('staff') || user?.roles?.includes('arbitre');
  
  const [settings, setSettings] = useState(null);
  const [dismissedAlerts, setDismissedAlerts] = useState(() => {
    const saved = localStorage.getItem('dismissedAlerts');
    return saved ? JSON.parse(saved) : [];
  });
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    return localStorage.getItem('bannerDismissed') === 'true';
  });

  useEffect(() => {
    fetchSettings();
    // Refresh every 5 minutes
    const interval = setInterval(fetchSettings, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Add padding to body when banner is shown
  useEffect(() => {
    const banner = settings?.banner;
    const showBanner = banner?.enabled && banner?.message && !bannerDismissed;
    
    if (showBanner) {
      document.body.style.paddingTop = '40px';
    } else {
      document.body.style.paddingTop = '0';
    }
    
    return () => {
      document.body.style.paddingTop = '0';
    };
  }, [settings, bannerDismissed]);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/app-settings/public`);
      const data = await response.json();
      if (data.success) {
        setSettings(data);
        // Reset banner dismissed if banner message changed
        if (data.banner?.message && localStorage.getItem('lastBannerMessage') !== data.banner.message) {
          setBannerDismissed(false);
          localStorage.removeItem('bannerDismissed');
          localStorage.setItem('lastBannerMessage', data.banner.message);
        }
      }
    } catch (error) {
      console.error('Error fetching app settings:', error);
    }
  };

  const dismissAlert = (alertId) => {
    const newDismissed = [...dismissedAlerts, alertId];
    setDismissedAlerts(newDismissed);
    localStorage.setItem('dismissedAlerts', JSON.stringify(newDismissed));
  };

  const dismissBanner = () => {
    setBannerDismissed(true);
    localStorage.setItem('bannerDismissed', 'true');
  };

  if (!settings) return null;

  // Maintenance mode check disabled - admin can toggle it from admin panel
  // if (settings.maintenance?.enabled && !hasAdminAccess) {
  //   return (
  //     <div className="fixed inset-0 z-[9999] bg-dark-950 flex items-center justify-center p-4">
  //       <div className="max-w-md w-full bg-dark-900 border border-orange-500/30 rounded-2xl p-8 text-center">
  //         <Wrench className="w-16 h-16 text-orange-400 mx-auto mb-6 animate-pulse" />
  //         <h1 className="text-2xl font-bold text-white mb-4">{t('maintenanceInProgress')}</h1>
  //         <p className="text-gray-400 mb-6">{settings.maintenance.message}</p>
  //         {settings.maintenance.estimatedEndTime && (
  //           <p className="text-orange-400 text-sm">
  //             {t('estimatedEnd')} : {new Date(settings.maintenance.estimatedEndTime).toLocaleString()}
  //           </p>
  //         )}
  //       </div>
  //     </div>
  //   );
  // }

  // Get active alerts that haven't been dismissed
  const activeAlerts = settings.globalAlerts?.filter(
    alert => alert.active && !dismissedAlerts.includes(alert.id)
  ) || [];

  // Don't show disabled features as global alerts anymore
  // They are now shown contextually where they're used

  // Banner configuration
  const banner = settings.banner;
  const showBanner = banner?.enabled && banner?.message && !bannerDismissed;

  const getBannerColor = (color) => {
    switch (color) {
      case 'blue': return 'bg-blue-500';
      case 'green': return 'bg-green-500';
      case 'orange': return 'bg-orange-500';
      case 'red': return 'bg-red-500';
      case 'cyan': return 'bg-cyan-500';
      default: return 'bg-purple-500';
    }
  };

  const hasContent = showBanner || activeAlerts.length > 0;
  if (!hasContent) return null;

  const getAlertIcon = (type) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />;
    }
  };

  const getAlertStyles = (type) => {
    switch (type) {
      case 'error':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      case 'warning':
        return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
      case 'success':
        return 'bg-green-500/10 border-green-500/30 text-green-400';
      default:
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
    }
  };

  const BannerContent = () => {
    if (banner?.link) {
      const isExternal = banner.link.startsWith('http');
      if (isExternal) {
        return (
          <a 
            href={banner.link} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 hover:underline"
          >
            {banner.message}
            <ExternalLink className="w-4 h-4" />
          </a>
        );
      }
      return (
        <Link to={banner.link} className="flex items-center justify-center gap-2 hover:underline">
          {banner.message}
        </Link>
      );
    }
    return <span>{banner?.message}</span>;
  };

  return (
    <>
      {/* Fixed Banner at top */}
      {showBanner && (
        <div className={`fixed top-0 left-0 right-0 z-[9999] ${getBannerColor(banner.bgColor)} text-white py-2 px-4`}>
          <div className="max-w-7xl mx-auto flex items-center justify-center relative">
            <div className="text-sm font-medium text-center">
              <BannerContent />
            </div>
            <button
              onClick={dismissBanner}
              className="absolute right-0 p-1 hover:bg-white/20 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating alerts */}
      {activeAlerts.length > 0 && (
        <div className={`fixed ${showBanner ? 'top-12' : 'top-4'} left-1/2 -translate-x-1/2 z-[9998] w-full max-w-2xl px-4 space-y-2`}>
          {/* Global Alerts */}
          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-center gap-3 p-4 rounded-xl border backdrop-blur-sm ${getAlertStyles(alert.type)}`}
            >
              {getAlertIcon(alert.type)}
              <span className="flex-1 text-sm font-medium">{alert.message}</span>
              {alert.dismissible && (
                <button
                  onClick={() => dismissAlert(alert.id)}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default GlobalAlerts;

