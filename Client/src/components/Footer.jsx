import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { Zap, Shield, ExternalLink, Settings, Skull, Crosshair, Users, MessageSquare, BookOpen, Gamepad2, Heart } from 'lucide-react';

const Footer = () => {
  const { t, language } = useLanguage();
  const { selectedMode } = useMode();
  const { isAuthenticated, user, isStaff, isArbitre, hasAdminAccess } = useAuth();
  
  const isHardcore = selectedMode === 'hardcore';

  // Build quick links - ranked mode visible to everyone
  const quickLinks = [
    { label: t('home'), href: '/', icon: <Zap className="w-3.5 h-3.5" /> },
    { label: t('rankedMode'), href: `/${selectedMode}/ranked`, icon: <Crosshair className="w-3.5 h-3.5" /> },
  ];

  // Staff-only links
  const showStrickerLink = isAuthenticated && user && (hasAdminAccess?.() || isStaff?.() || isArbitre?.());

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
    <footer className="relative bg-dark-950 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
      <div className={`absolute inset-0 ${isHardcore ? 'bg-radial-glow-bottom' : ''} pointer-events-none`} />
      
      {/* Accent Line */}
      <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${isHardcore ? 'via-neon-red/50' : 'via-accent-500/50'} to-transparent`} />
      
      {/* Main Footer Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand Section */}
          <div className="space-y-6 lg:col-span-1">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl ${
                isHardcore 
                  ? 'bg-gradient-to-br from-neon-red to-neon-orange shadow-neon-red' 
                  : 'bg-gradient-to-br from-accent-500 to-blue-600 shadow-neon-cyan'
              }`}>
                {isHardcore ? <Skull className="w-7 h-7 text-white" /> : <Zap className="w-7 h-7 text-white" />}
              </div>
              <div>
                <span className={`text-3xl font-display tracking-wider ${isHardcore ? 'text-gradient-fire' : 'text-gradient-ice'}`}>
                  NOMERCY
                </span>
                <p className={`text-xs font-semibold uppercase tracking-widest ${isHardcore ? 'text-neon-red/60' : 'text-accent-500/60'}`}>
                  {isHardcore ? 'HARDCORE' : 'CDL'}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              {t('aboutText')}
            </p>
            {/* Social Links */}
            <div className="flex items-center gap-3">
              <a
                href="https://discord.gg/tmzDaGTwuV"
                target="_blank"
                rel="noopener noreferrer"
                className={`w-11 h-11 rounded-xl glass flex items-center justify-center text-gray-400 hover:text-[#5865F2] hover:bg-[#5865F2]/10 transition-all hover:scale-110 ${isHardcore ? 'neon-border-red-hover' : ''}`}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs font-bold text-white mb-6 uppercase tracking-widest flex items-center gap-2">
              <span className={`w-8 h-px ${isHardcore ? 'bg-neon-red' : 'bg-accent-500'}`} />
              {t('quickLinks')}
            </h3>
            <ul className="space-y-4">
              {quickLinks.map((link, index) => (
                <li key={index}>
                  <Link
                    to={link.href}
                    className={`text-sm text-gray-400 hover:text-white transition-all flex items-center gap-3 group hover:translate-x-1`}
                  >
                    <span className={`transition-colors ${
                      isHardcore ? 'text-neon-red/50 group-hover:text-neon-red' : 'text-accent-500/50 group-hover:text-accent-500'
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
                    to="/stricker"
                    className={`text-sm text-gray-400 hover:text-white transition-all flex items-center gap-3 group hover:translate-x-1`}
                  >
                    <span className={`transition-colors ${
                      isHardcore ? 'text-neon-red/50 group-hover:text-neon-red' : 'text-accent-500/50 group-hover:text-accent-500'
                    }`}>
                      <Gamepad2 className="w-3.5 h-3.5" />
                    </span>
                    <span>Stricker</span>
                  </Link>
                </li>
              )}
              <li>
                <Link
                  to="/team"
                  className={`text-sm text-gray-400 hover:text-white transition-all flex items-center gap-3 group hover:translate-x-1`}
                >
                  <span className={`transition-colors ${
                    isHardcore ? 'text-neon-red/50 group-hover:text-neon-red' : 'text-accent-500/50 group-hover:text-accent-500'
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
            <h3 className="text-xs font-bold text-white mb-6 uppercase tracking-widest flex items-center gap-2">
              <span className={`w-8 h-px ${isHardcore ? 'bg-neon-red' : 'bg-accent-500'}`} />
              {language === 'fr' ? 'Autres' : language === 'de' ? 'Andere' : language === 'it' ? 'Altri' : 'Others'}
            </h3>
            <ul className="space-y-4">
              {supportLinks.map((link, index) => (
                <li key={index}>
                  {link.isLink ? (
                    <Link
                      to={link.href}
                      className={`text-sm text-gray-400 hover:text-white transition-all flex items-center gap-3 group hover:translate-x-1`}
                    >
                      <span className={`transition-colors ${
                        isHardcore ? 'text-neon-red/50 group-hover:text-neon-red' : 'text-accent-500/50 group-hover:text-accent-500'
                      }`}>
                        {link.icon}
                      </span>
                      <span>{link.label}</span>
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      className={`text-sm text-gray-400 hover:text-white transition-all flex items-center gap-3 group hover:translate-x-1`}
                    >
                      <span className={`transition-colors ${
                        isHardcore ? 'text-neon-red/50 group-hover:text-neon-red' : 'text-accent-500/50 group-hover:text-accent-500'
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

          {/* GGSecure Anti-Cheat */}
          <div className="flex flex-col">
            <h3 className="text-xs font-bold text-white mb-6 uppercase tracking-widest flex items-center gap-2">
              <span className={`w-8 h-px ${isHardcore ? 'bg-neon-red' : 'bg-accent-500'}`} />
              {t('security')}
            </h3>
            <a
              href="https://ggsecure.io"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 px-5 py-5 rounded-2xl glass-card hover:scale-[1.02] transition-all duration-300 border border-emerald-500/20 hover:border-emerald-500/50"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-40 group-hover:opacity-60 transition-opacity" />
                <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <Shield className="w-7 h-7 text-white" />
                </div>
              </div>
              <div>
                <p className="text-[10px] text-emerald-400/80 font-medium uppercase tracking-wider">{t('protectedBy')}</p>
                <p className="text-white font-bold text-sm group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                  <span>GGSecure Anti-Cheat</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                </p>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* Admin Panel Link - Mobile Only */}
      {isAuthenticated && user && hasAdminAccess && hasAdminAccess() && (
        <div className="md:hidden border-t border-white/5">
          <div className="px-6 py-4">
            <Link
              to="/admin"
              className={`flex items-center justify-center gap-2 w-full py-3.5 rounded-xl transition-all ${
                isArbitre && isArbitre() && !(isStaff && isStaff())
                  ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 text-yellow-400 hover:text-yellow-300 hover:border-yellow-400/50'
                  : 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-400 hover:text-purple-300 hover:border-purple-400/50'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span className="font-semibold text-sm">
                {isArbitre && isArbitre() && !(isStaff && isStaff()) ? 'Panel Arbitre' : 'Admin Panel'}
              </span>
            </Link>
          </div>
        </div>
      )}

      {/* Bottom Bar */}
      <div className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full animate-pulse ${isHardcore ? 'bg-neon-red' : 'bg-accent-500'}`} />
              <p className="text-sm text-gray-500">
                © 2026 <span className={`font-semibold ${isHardcore ? 'text-neon-red' : 'text-accent-400'}`}>NoMercy</span>. {t('allRightsReserved')}.
              </p>
            </div>
            <div className="flex items-center gap-6">
              {legalLinks.map((link, index) => (
                link.isLink ? (
                  <Link
                    key={index}
                    to={link.href}
                    className="text-sm text-gray-500 hover:text-white transition-colors hover:underline underline-offset-4"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={index}
                    href={link.href}
                    className="text-sm text-gray-500 hover:text-white transition-colors hover:underline underline-offset-4"
                  >
                    {link.label}
                  </a>
                )
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
