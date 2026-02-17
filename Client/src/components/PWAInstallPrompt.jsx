import React, { useState, useEffect, useMemo } from 'react';
import { Monitor, X, Download, Zap, MoreHorizontal, MoreVertical } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

const getBrowser = () => {
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) return 'edge';
  if (ua.includes('Chrome/')) return 'chrome';
  if (ua.includes('Firefox/')) return 'firefox';
  return 'other';
};

const PWAInstallPrompt = () => {
  const { t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPanel, setShowPanel] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const browser = useMemo(() => getBrowser(), []);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const wasDismissed = sessionStorage.getItem('pwa-install-dismissed');
    if (wasDismissed) {
      setDismissed(true);
    } else {
      setTimeout(() => {
        setShowPanel(true);
        requestAnimationFrame(() => setIsVisible(true));
      }, 1500);
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPanel(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      setShowPanel(false);
    } catch {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      setShowPanel(false);
      setDismissed(true);
      sessionStorage.setItem('pwa-install-dismissed', 'true');
    }, 300);
  };

  const handleReopen = () => {
    setShowPanel(true);
    setDismissed(false);
    sessionStorage.removeItem('pwa-install-dismissed');
    requestAnimationFrame(() => setIsVisible(true));
  };

  const getFallbackSteps = () => {
    if (browser === 'edge') return t('pwaFallbackEdge');
    return t('pwaFallbackChrome');
  };

  if (isInstalled) return null;

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) return null;

  if (!showPanel && dismissed) {
    return (
      <button
        onClick={handleReopen}
        className="fixed bottom-6 left-6 z-50 group"
        title={t('pwaInstallApp')}
      >
        <div className="absolute inset-0 bg-neon-red/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative glass neon-border-red neon-border-red-hover p-3.5 rounded-2xl transition-all duration-300 group-hover:scale-105">
          <Monitor className="w-5 h-5 text-neon-red" />
        </div>
      </button>
    );
  }

  if (!showPanel) return null;

  const FallbackIcon = browser === 'edge' ? MoreHorizontal : MoreVertical;

  return (
    <div
      className="fixed bottom-6 left-6 z-50 transition-all duration-500 ease-out"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
      }}
    >
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-neon-red/20 to-neon-orange/20 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500" />

        <div className="relative glass-card neon-border-red rounded-2xl overflow-hidden w-[300px]">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-neon-red/50 to-transparent" />

          <div className="p-5">
            <div className="flex items-start gap-4">
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 bg-neon-red/30 blur-lg rounded-xl" />
                <div className="relative w-11 h-11 bg-gradient-to-br from-neon-red to-neon-orange rounded-xl flex items-center justify-center shadow-neon-red">
                  <Monitor className="w-5 h-5 text-white" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg tracking-wider text-white">
                    {t('pwaDesktopApp').toUpperCase()}
                  </h3>
                  <button
                    onClick={handleDismiss}
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 text-dark-500 hover:text-white transition-all duration-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[13px] text-dark-400 mt-1.5 leading-relaxed font-body">
                  {t('pwaInstallDesc')}
                </p>
              </div>
            </div>

            {deferredPrompt ? (
              <button
                onClick={handleInstall}
                className="btn-primary w-full mt-4 !py-3 !px-4 !rounded-xl flex items-center justify-center gap-2.5 text-sm font-semibold tracking-wide"
              >
                <Download className="w-4 h-4" />
                {t('pwaInstallBtn')}
                <Zap className="w-3.5 h-3.5 opacity-60" />
              </button>
            ) : (
              <div className="mt-4 flex items-start gap-3 px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <FallbackIcon className="w-5 h-5 text-neon-red flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-dark-300 leading-relaxed font-body">
                  {getFallbackSteps()}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
