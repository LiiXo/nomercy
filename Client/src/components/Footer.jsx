import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { Zap, Shield, ExternalLink, Settings } from 'lucide-react';

const Footer = () => {
  const { t, language } = useLanguage();
  const { selectedMode } = useMode();
  const { isAuthenticated, user, isStaff } = useAuth();
  
  // Couleurs selon le mode
  const isHardcore = selectedMode === 'hardcore';
  const borderColor = isHardcore ? 'border-red-500/10' : 'border-cyan-500/10';
  const hoverBorderColor = isHardcore ? 'hover:border-red-500/30' : 'hover:border-cyan-500/30';
  const bgAccent = isHardcore ? 'hover:bg-red-500/5' : 'hover:bg-cyan-500/5';
  const textAccent = isHardcore ? 'text-red-400' : 'text-cyan-400';
  const textAccentHover = isHardcore ? 'hover:text-red-400' : 'hover:text-cyan-400';
  const dotColor = isHardcore ? 'bg-red-500/50' : 'bg-cyan-500/50';
  const dotHoverColor = isHardcore ? 'group-hover:bg-red-400' : 'group-hover:bg-cyan-400';
  const logoGradient = isHardcore ? 'from-red-500 to-orange-600' : 'from-cyan-400 to-cyan-600';
  const logoShadow = isHardcore ? 'shadow-red-500/30' : 'shadow-cyan-500/30';
  const logoText = isHardcore ? 'text-white' : 'text-dark-950';

  const quickLinks = [
    { label: t('home'), href: '/' },
    { label: t('rankings'), href: '/hardcore/rankings' },
    { label: t('rankedMode'), href: '/hardcore/ranked' },
  ];

  const supportLinks = [
    { label: t('rules'), href: '/rules', isLink: true },
    { label: t('anticheat'), href: '/anticheat', isLink: true },
    { label: language === 'fr' ? 'Squad Hub' : language === 'de' ? 'Squad Hub' : language === 'it' ? 'Squad Hub' : 'Squad Hub', href: '/squad-hub', isLink: true },
  ];

  const legalLinks = [
    { label: t('termsOfService'), href: '/terms', isLink: true },
    { label: t('privacyPolicy'), href: '/privacy', isLink: true },
  ];

  return (
    <footer className={`bg-dark-950 border-t ${borderColor}`}>
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* About Section */}
          <div className="space-y-5">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 bg-gradient-to-br ${logoGradient} rounded-lg flex items-center justify-center shadow-lg ${logoShadow}`}>
                <Zap className={`w-5 h-5 ${logoText}`} />
              </div>
              <span className="text-xl font-bold text-gradient tracking-wider">
                NoMercy
              </span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              {t('aboutText')}
            </p>
            {/* Discord Link */}
            <a
              href="https://discord.gg/tmzDaGTwuV"
              aria-label="Discord"
              target="_blank"
              rel="noopener noreferrer"
              className={`w-10 h-10 rounded-lg border border-white/10 flex items-center justify-center text-gray-400 hover:text-[#5865F2] ${hoverBorderColor} ${bgAccent} transition-all duration-300`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
            </a>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
              {t('quickLinks')}
            </h3>
            <ul className="space-y-3">
              {quickLinks.map((link, index) => (
                <li key={index}>
                  <Link
                    to={link.href}
                    className={`text-sm text-gray-400 ${textAccentHover} transition-colors flex items-center space-x-2 group`}
                  >
                    <span className={`w-1 h-1 ${dotColor} rounded-full ${dotHoverColor} transition-colors`}></span>
                    <span>{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Autres */}
          <div>
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
              {language === 'fr' ? 'Autres' : language === 'de' ? 'Andere' : language === 'it' ? 'Altri' : 'Others'}
            </h3>
            <ul className="space-y-3">
              {supportLinks.map((link, index) => (
                <li key={index}>
                  {link.isLink ? (
                    <Link
                      to={link.href}
                      className={`text-sm text-gray-400 ${textAccentHover} transition-colors flex items-center space-x-2 group`}
                    >
                      <span className={`w-1 h-1 ${dotColor} rounded-full ${dotHoverColor} transition-colors`}></span>
                      <span>{link.label}</span>
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      className={`text-sm text-gray-400 ${textAccentHover} transition-colors flex items-center space-x-2 group`}
                    >
                      <span className={`w-1 h-1 ${dotColor} rounded-full ${dotHoverColor} transition-colors`}></span>
                      <span>{link.label}</span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* GGSecure Anti-Cheat Badge */}
          <div className="flex flex-col items-start">
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
              {t('security')}
            </h3>
            <a
              href="https://ggsecure.io"
              target="_blank"
              rel="noopener noreferrer"
              className={`group flex items-center space-x-3 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300`}
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-emerald-400 font-medium">{t('protectedBy')}</p>
                <p className="text-white font-bold text-sm group-hover:text-emerald-400 transition-colors flex items-center space-x-1">
                  <span>GGSecure Anti-Cheat</span>
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </p>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* Admin Panel Link - Mobile Only */}
      {isAuthenticated && user && isStaff && isStaff() && (
        <div className={`md:hidden border-t ${borderColor}`}>
          <div className="px-4 py-4">
            <Link
              to="/admin"
              className="flex items-center justify-center space-x-2 w-full py-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-400 hover:text-purple-300 transition-all"
            >
              <Settings className="w-4 h-4" />
              <span className="font-medium text-sm">Admin Panel</span>
            </Link>
          </div>
        </div>
      )}

      {/* Bottom Bar */}
      <div className={`border-t ${borderColor}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} <span className={textAccent}>NoMercy</span>. {t('allRightsReserved')}.
            </p>
            <div className="flex items-center space-x-6">
              {legalLinks.map((link, index) => (
                link.isLink ? (
                  <Link
                    key={index}
                    to={link.href}
                    className={`text-sm text-gray-500 ${textAccentHover} transition-colors`}
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={index}
                    href={link.href}
                    className={`text-sm text-gray-500 ${textAccentHover} transition-colors`}
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
