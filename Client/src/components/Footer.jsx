import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { Zap, Shield, ExternalLink, Settings, Skull, Crosshair, Users, MessageSquare, BookOpen, Gamepad2, Heart, ArrowUp, Medal } from 'lucide-react';
import { API_URL } from '../config';

const Footer = () => {
  const { t, language } = useLanguage();
  const { selectedMode } = useMode();
  const { isAuthenticated, user, isStaff, isArbitre, hasAdminAccess } = useAuth();
  const [strickerModeEnabled, setStrickerModeEnabled] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  
  const isHardcore = selectedMode === 'hardcore';

  // Handle scroll for back to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Fetch stricker mode enabled status
  useEffect(() => {
    const fetchStrickerMode = async () => {
      try {
        const response = await fetch(`${API_URL}/app-settings/public`);
        const data = await response.json();
        if (data.success) {
          setStrickerModeEnabled(data.features?.strickerMode?.enabled || false);
        }
      } catch (err) {
        console.error('Error fetching stricker mode status:', err);
      }
    };

    fetchStrickerMode();
  }, []);

  // Build quick links - ranked mode visible to everyone
  const quickLinks = [
    { label: t('home'), href: '/', icon: <Zap className="w-3.5 h-3.5" /> },
    { label: 'Ranked', href: `/${selectedMode}/ranked`, icon: <Medal className="w-3.5 h-3.5" />, isRanked: true },
  ];

  // Stricker link - visible when enabled globally OR for admin/staff/arbitre
  const showStrickerLink = strickerModeEnabled || (isAuthenticated && user && (hasAdminAccess?.() || isStaff?.() || isArbitre?.()));

  const supportLinks = [
    { label: t('rules'), href: '/rules', icon: <BookOpen className="w-3.5 h-3.5" />, isLink: true },
    { label: t('anticheat'), href: '/anticheat', icon: <Shield className="w-3.5 h-3.5" />, isLink: true },
    { label: language === 'fr' ? 'Toutes les Escouades' : 'All Squads', href: '/squads', icon: <Users className="w-3.5 h-3.5" />, isLink: true },
  ];

  const legalLinks = [
    { label: t('termsOfService'), href: '/terms', isLink: true },
    { label: t('privacyPolicy'), href: '/privacy', isLink: true },
  ];

  return (
    <footer className={`relative overflow-hidden ${
      isHardcore 
        ? 'bg-gradient-to-t from-dark-950 via-dark-950/98 to-dark-900/95' 
        : 'bg-gradient-to-t from-dark-950 via-dark-950/98 to-dark-900/95'
    }`}>
      {/* Subtle neon glow effect */}
      <div className={`absolute inset-0 opacity-20 pointer-events-none ${
        isHardcore 
          ? 'bg-[radial-gradient(ellipse_at_bottom,rgba(255,45,85,0.12),transparent_60%)]'
          : 'bg-[radial-gradient(ellipse_at_bottom,rgba(0,212,255,0.12),transparent_60%)]'
      }`} />
      
      {/* Top Border */}
      <div className={`absolute top-0 left-0 right-0 h-[1px] ${
        isHardcore ? 'bg-neon-red/10' : 'bg-accent-500/10'
      }`} />
      
      {/* Main Footer Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand Section */}
          <div className="space-y-5 lg:col-span-1">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={`absolute inset-0 blur-xl opacity-40 ${isHardcore ? 'bg-neon-red' : 'bg-accent-500'}`} />
                <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center ${
                  isHardcore 
                    ? 'bg-gradient-to-br from-neon-red via-neon-orange to-yellow-500' 
                    : 'bg-gradient-to-br from-accent-500 via-blue-500 to-cyan-400'
                }`}>
                  {isHardcore ? <Skull className="w-6 h-6 text-white" /> : <Zap className="w-6 h-6 text-white" />}
                </div>
              </div>
              <div>
                <span className={`text-2xl font-display font-bold tracking-wide ${isHardcore ? 'text-gradient-fire' : 'text-gradient-ice'}`}>
                  NOMERCY
                </span>
                <p className={`text-[9px] font-semibold uppercase tracking-[0.25em] ${isHardcore ? 'text-neon-red/40' : 'text-accent-400/40'}`}>
                  {isHardcore ? 'HARDCORE' : 'CDL'}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              {t('aboutText')}
            </p>
            {/* Social Links */}
            <div className="flex items-center gap-2">
              <a
                href="https://discord.gg/tmzDaGTwuV"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-white/[0.03] hover:bg-[#5865F2]/10 border border-white/[0.04] hover:border-[#5865F2]/30 flex items-center justify-center text-gray-600 hover:text-[#5865F2] transition-all duration-300 hover:scale-105"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 mb-5 uppercase tracking-widest">
              {t('quickLinks')}
            </h3>
            <ul className="space-y-3">
              {quickLinks.map((link, index) => (
                <li key={index}>
                  <Link
                    to={link.href}
                    className="text-sm text-gray-600 hover:text-white transition-all flex items-center gap-2.5 group"
                  >
                    <span className={`transition-colors ${
                      link.isRanked
                        ? 'text-neon-orange/40 group-hover:text-neon-orange'
                        : isHardcore ? 'text-neon-red/40 group-hover:text-neon-red' : 'text-accent-500/40 group-hover:text-accent-500'
                    }`}>
                      {link.icon}
                    </span>
                    <span>{link.label}</span>
                  </Link>
                </li>
              ))}
              {showStrickerLink && (
                <li>
                  <Link
                    to={`/${selectedMode}/stricker`}
                    className="text-sm text-gray-600 hover:text-white transition-all flex items-center gap-2.5 group"
                  >
                    <span className="text-lime-400/40 group-hover:text-lime-400 transition-colors">
                      <Gamepad2 className="w-3.5 h-3.5" />
                    </span>
                    <span>Stricker</span>
                  </Link>
                </li>
              )}
              <li>
                <Link
                  to="/team"
                  className="text-sm text-gray-600 hover:text-white transition-all flex items-center gap-2.5 group"
                >
                  <span className={`transition-colors ${
                    isHardcore ? 'text-neon-red/40 group-hover:text-neon-red' : 'text-accent-500/40 group-hover:text-accent-500'
                  }`}>
                    <Heart className="w-3.5 h-3.5" />
                  </span>
                  <span>{language === 'fr' ? "L'Équipe" : 'The Team'}</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 mb-5 uppercase tracking-widest">
              {language === 'fr' ? 'Autres' : language === 'de' ? 'Andere' : language === 'it' ? 'Altri' : 'Others'}
            </h3>
            <ul className="space-y-3">
              {supportLinks.map((link, index) => (
                <li key={index}>
                  {link.isLink ? (
                    <Link
                      to={link.href}
                      className="text-sm text-gray-600 hover:text-white transition-all flex items-center gap-2.5 group"
                    >
                      <span className={`transition-colors ${
                        isHardcore ? 'text-neon-red/40 group-hover:text-neon-red' : 'text-accent-500/40 group-hover:text-accent-500'
                      }`}>
                        {link.icon}
                      </span>
                      <span>{link.label}</span>
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      className="text-sm text-gray-600 hover:text-white transition-all flex items-center gap-2.5 group"
                    >
                      <span className={`transition-colors ${
                        isHardcore ? 'text-neon-red/40 group-hover:text-neon-red' : 'text-accent-500/40 group-hover:text-accent-500'
                      }`}>
                        {link.icon}
                      </span>
                      <span>{link.label}</span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Iris Anti-Cheat */}
          <div className="flex flex-col">
            <h3 className="text-xs font-bold text-gray-400 mb-5 uppercase tracking-widest">
              {t('security')}
            </h3>
            <a
              href="https://nomercy.gg"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 px-4 py-4 rounded-xl bg-white/[0.02] hover:bg-emerald-500/5 border border-white/[0.04] hover:border-emerald-500/30 transition-all duration-300"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500 blur-lg opacity-30 group-hover:opacity-50 transition-opacity" />
                <div className="relative w-11 h-11 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <p className="text-[10px] text-emerald-400/60 font-medium uppercase tracking-wider">{t('protectedBy')}</p>
                <p className="text-white font-semibold text-sm group-hover:text-emerald-400 transition-colors flex items-center gap-1">
                  <span>Iris Anti-Cheat</span>
                  <ExternalLink className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                </p>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* Admin Panel Link - Mobile Only */}
      {isAuthenticated && user && hasAdminAccess && hasAdminAccess() && (
        <div className="md:hidden border-t border-white/[0.04]">
          <div className="px-6 py-4">
            <Link
              to="/admin"
              className={`flex items-center justify-center gap-2 w-full py-3 rounded-lg border transition-all ${
                isArbitre && isArbitre() && !(isStaff && isStaff())
                  ? 'bg-yellow-500/5 border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/10 hover:border-yellow-500/30'
                  : 'bg-purple-500/5 border-purple-500/20 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/30'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span className="font-medium text-sm">
                {isArbitre && isArbitre() && !(isStaff && isStaff()) ? 'Panel Arbitre' : 'Admin Panel'}
              </span>
            </Link>
          </div>
        </div>
      )}

      {/* Bottom Bar */}
      <div className="border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isHardcore ? 'bg-neon-red' : 'bg-accent-500'} animate-pulse`} />
              <p className="text-sm text-gray-600">
                © 2026 <span className={`font-semibold ${isHardcore ? 'text-neon-red' : 'text-accent-400'}`}>NoMercy</span>. {t('allRightsReserved')}.
              </p>
            </div>
            <div className="flex items-center gap-6">
              {legalLinks.map((link, index) => (
                link.isLink ? (
                  <Link
                    key={index}
                    to={link.href}
                    className="text-sm text-gray-600 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={index}
                    href={link.href}
                    className="text-sm text-gray-600 hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                )
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className={`fixed bottom-8 right-8 z-50 p-3 rounded-xl transition-all duration-300 hover:scale-110 shadow-2xl ${
            isHardcore
              ? 'bg-neon-orange/90 hover:bg-neon-orange text-white shadow-neon-orange/30'
              : 'bg-accent-500/90 hover:bg-accent-500 text-white shadow-accent-500/30'
          }`}
          aria-label="Back to top"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </footer>
  );
};

export default Footer;
