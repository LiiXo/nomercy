import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { getDefaultAvatar } from '../utils/avatar';
import { Menu, X, Gamepad2, Trophy, Home, ChevronDown, LogOut, Zap, Medal, ShoppingBag, User, Settings, Shield, Coins, Gift, Search, Loader2, Users, MessageSquare, AlertTriangle } from 'lucide-react';
import SpinWheel from './SpinWheel';

const Navbar = () => {
  const { language, setLanguage, t } = useLanguage();
  const { selectedMode, resetMode } = useMode();
  const { user, isAuthenticated, login, logout, isAdmin, isStaff } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showSpinWheel, setShowSpinWheel] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [squadRequestsCount, setSquadRequestsCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const languageRef = useRef(null);
  const userMenuRef = useRef(null);
  const searchRef = useRef(null);

  const languages = [
    { code: 'fr', label: 'Français', flag: '/flags/fr.png' },
    { code: 'en', label: 'English', flag: '/flags/gb.png' },
    { code: 'it', label: 'Italiano', flag: '/flags/it.png' },
    { code: 'de', label: 'Deutsch', flag: '/flags/de.png' },
  ];

  const currentLanguage = languages.find(lang => lang.code === language);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (languageRef.current && !languageRef.current.contains(event.target)) {
        setLanguageMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearch(false);
        setSearchQuery('');
        setSearchResults([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search for players
  useEffect(() => {
    const searchPlayers = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }
      
      setSearchLoading(true);
      try {
        const response = await fetch(`https://api-nomercy.ggsecure.io/api/users/search?q=${encodeURIComponent(searchQuery)}&limit=5`);
        const data = await response.json();
        if (data.success) {
          setSearchResults(data.users);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setSearchLoading(false);
      }
    };

    const timer = setTimeout(searchPlayers, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch squad join requests count for leaders
  useEffect(() => {
    const fetchSquadRequestsCount = async () => {
      if (!isAuthenticated || !user?.squad) {
        setSquadRequestsCount(0);
        return;
      }
      
      try {
        const response = await fetch('https://api-nomercy.ggsecure.io/api/squads/my-squad/requests-count', {
          credentials: 'include'
        });
        const data = await response.json();
        if (data.success) {
          setSquadRequestsCount(data.count || 0);
        }
      } catch (err) {
        console.error('Error fetching squad requests:', err);
      }
    };

    fetchSquadRequestsCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchSquadRequestsCount, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, user?.squad]);

  // Fetch unread messages count
  useEffect(() => {
    const fetchUnreadMessages = async () => {
      if (!isAuthenticated) {
        setUnreadMessages(0);
        return;
      }
      
      try {
        const response = await fetch('https://api-nomercy.ggsecure.io/api/messages/unread-count', {
          credentials: 'include'
        });
        const data = await response.json();
        if (data.success) {
          setUnreadMessages(data.count || 0);
        }
      } catch (err) {
        console.error('Error fetching unread messages:', err);
      }
    };

    fetchUnreadMessages();
    // Refresh every 15 seconds
    const interval = setInterval(fetchUnreadMessages, 15000);
    
    // Listen for messagesRead event to refresh immediately
    const handleMessagesRead = () => fetchUnreadMessages();
    window.addEventListener('messagesRead', handleMessagesRead);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('messagesRead', handleMessagesRead);
    };
  }, [isAuthenticated]);

  const isActive = (path) => {
    return location.pathname === path;
  };

  const handleChangeMode = () => {
    resetMode();
    navigate('/');
  };

  const handleDiscordLogin = () => {
    login();
  };

  const allNavLinks = [
    { path: `/${selectedMode}`, label: t('home'), icon: Home },
    { path: `/${selectedMode}/rankings`, label: t('rankings'), icon: Trophy },
    { path: `/${selectedMode}/ranked`, label: t('rankedMode'), icon: Medal },
  ];

  // Toujours afficher les liens de navigation
  const navLinks = allNavLinks;

  // Couleurs selon le mode
  const isHardcore = selectedMode === 'hardcore';
  const accentColor = isHardcore ? 'red' : 'cyan';
  const gradientFrom = isHardcore ? 'from-red-500' : 'from-cyan-400';
  const gradientTo = isHardcore ? 'to-orange-600' : 'to-cyan-600';
  const borderColor = isHardcore ? 'border-red-500/10' : 'border-cyan-500/10';
  const hoverBorderColor = isHardcore ? 'hover:border-red-500/30' : 'hover:border-cyan-500/30';
  const bgAccent = isHardcore ? 'bg-red-500/10' : 'bg-cyan-500/10';
  const textAccent = isHardcore ? 'text-red-400' : 'text-cyan-400';
  const textAccentHover = isHardcore ? 'hover:text-red-300' : 'hover:text-cyan-300';
  const badgeBg = isHardcore ? 'bg-red-500/20 border-red-500/50' : 'bg-cyan-500/20 border-cyan-500/50';
  const badgeText = isHardcore ? 'text-red-400' : 'text-cyan-400';
  const buttonGradient = isHardcore ? 'from-red-500 to-orange-600' : 'from-cyan-500 to-cyan-400';
  const buttonText = isHardcore ? 'text-white' : 'text-dark-950';
  const buttonShadow = isHardcore ? 'shadow-red-500/30' : 'shadow-cyan-500/30';
  const logoGlow = isHardcore ? 'bg-red-500' : 'bg-cyan-500';
  const logoGradient = isHardcore ? 'from-red-500 to-orange-600' : 'from-cyan-400 to-cyan-600';
  const logoShadow = isHardcore ? 'shadow-red-500/40' : 'shadow-cyan-500/40';
  const subtitleColor = isHardcore ? 'text-red-400/70' : 'text-cyan-400/70';

  return (
    <nav className={`sticky top-0 z-50 bg-dark-950/90 backdrop-blur-xl border-b ${borderColor}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link 
            to={`/${selectedMode}`}
            className="flex items-center space-x-3 group"
          >
            <div className="relative">
              <div className={`absolute inset-0 ${logoGlow} blur-lg opacity-40 group-hover:opacity-60 transition-opacity`}></div>
              <div className={`relative w-10 h-10 bg-gradient-to-br ${logoGradient} rounded-lg flex items-center justify-center shadow-lg ${logoShadow}`}>
                <Zap className={`w-5 h-5 ${isHardcore ? 'text-white' : 'text-dark-950'}`} />
              </div>
            </div>
            <div>
              <span className="text-xl font-bold text-gradient tracking-wider">
                NoMercy
              </span>
              <div className={`text-[10px] ${subtitleColor} uppercase tracking-widest font-medium`}>
                {selectedMode === 'hardcore' ? 'Hardcore' : 'CDL'}
              </div>
            </div>
          </Link>

          {/* Center Navigation - Desktop */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map(({ path, label, icon: Icon, comingSoon }) => (
              <Link
                key={path}
                to={comingSoon ? '#' : path}
                onClick={comingSoon ? (e) => e.preventDefault() : undefined}
                className={`
                  relative px-5 py-2 rounded-lg font-medium transition-all duration-300
                  flex items-center space-x-2 group text-sm
                  ${comingSoon 
                    ? 'text-gray-500 cursor-not-allowed opacity-60'
                    : isActive(path) 
                      ? `${buttonText} bg-gradient-to-r ${buttonGradient} shadow-lg ${buttonShadow}` 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
                {comingSoon && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[9px] font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 rounded-full animate-pulse">
                    {language === 'fr' ? 'Bientôt' : language === 'de' ? 'Bald' : language === 'it' ? 'Presto' : 'Soon'}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Right Side - Desktop */}
          <div className="hidden md:flex items-center space-x-3">
            {/* Change Mode Button - Orange/Amber color */}
            <button
              onClick={handleChangeMode}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 hover:border-amber-500/50 transition-all duration-300 group"
              title="Changer de mode"
            >
              <LogOut className="w-4 h-4 text-amber-400 group-hover:text-amber-300 transition-colors" />
            </button>

            {/* Daily Spin Wheel Button */}
            {isAuthenticated && (
              <button
                onClick={() => setShowSpinWheel(true)}
                className="relative flex items-center space-x-2 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium text-sm transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 group"
                title={language === 'fr' ? 'Roue quotidienne' : 'Daily Wheel'}
              >
                <Gift className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                <span className="hidden lg:inline">{language === 'fr' ? 'Roue' : 'Wheel'}</span>
                {/* Notification dot - you can add logic to show when spin is available */}
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></span>
              </button>
            )}

            {/* Messages Button */}
            {isAuthenticated && (
              <Link
                to="/messages"
                className={`relative flex items-center space-x-2 px-3 py-2 rounded-lg border border-white/10 ${hoverBorderColor} ${bgAccent} transition-all duration-300 group`}
                title={language === 'fr' ? 'Messages' : 'Messages'}
              >
                <MessageSquare className={`w-4 h-4 text-gray-400 ${isHardcore ? 'group-hover:text-red-400' : 'group-hover:text-cyan-400'} transition-colors`} />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </Link>
            )}

            {/* Search Button */}
            <div className="relative" ref={searchRef}>
              <button
                onClick={() => setShowSearch(!showSearch)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg border border-white/10 ${hoverBorderColor} ${bgAccent} transition-all duration-300 group`}
                title={language === 'fr' ? 'Rechercher un joueur' : 'Search player'}
              >
                <Search className={`w-4 h-4 text-gray-400 ${isHardcore ? 'group-hover:text-red-400' : 'group-hover:text-cyan-400'} transition-colors`} />
              </button>

              {/* Search Dropdown */}
              {showSearch && (
                <div className={`absolute right-0 mt-2 w-72 bg-dark-900/95 backdrop-blur-xl rounded-xl shadow-xl border ${isHardcore ? 'border-red-500/20' : 'border-cyan-500/20'} overflow-hidden animate-slide-down`}>
                  <div className="p-3">
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={language === 'fr' ? 'Rechercher un joueur...' : 'Search player...'}
                        className={`w-full px-4 py-2 pl-10 bg-dark-800 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-${accentColor}-500/50`}
                        autoFocus
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      {searchLoading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 animate-spin" />
                      )}
                    </div>
                  </div>
                  
                  {/* Results */}
                  {searchResults.length > 0 && (
                    <div className={`border-t ${isHardcore ? 'border-red-500/10' : 'border-cyan-500/10'} max-h-60 overflow-y-auto`}>
                      {searchResults.map((player) => {
                        const avatar = player.avatarUrl || player.avatar || getDefaultAvatar(player.username);
                        return (
                          <Link
                            key={player._id}
                            to={`/player/${player.username}`}
                            onClick={() => {
                              setShowSearch(false);
                              setSearchQuery('');
                              setSearchResults([]);
                            }}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors"
                          >
                            <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium truncate">{player.username}</p>
                              {player.activisionId && (
                                <p className="text-gray-500 text-xs truncate">{player.activisionId}</p>
                              )}
                            </div>
                            {player.platform && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${player.platform === 'PC' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                                {player.platform}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* No results */}
                  {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
                    <div className={`px-4 py-3 text-center text-gray-500 text-sm border-t ${isHardcore ? 'border-red-500/10' : 'border-cyan-500/10'}`}>
                      {language === 'fr' ? 'Aucun joueur trouvé' : 'No player found'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Auth Section */}
            {isAuthenticated && user ? (
              /* User Menu */
              <div className="relative" ref={userMenuRef}>
            <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className={`flex items-center space-x-2 px-2 py-1.5 rounded-lg border border-white/10 ${hoverBorderColor} ${bgAccent} transition-all duration-300 group`}
                >
                  <img 
                    src={user.avatar || getDefaultAvatar(user.username)} 
                    alt="Avatar"
                    className={`w-8 h-8 rounded-full border-2 ${isHardcore ? 'border-red-500/50' : 'border-cyan-500/50'}`}
                  />
                  <span className="text-sm font-medium text-white max-w-[100px] truncate">{user.username}</span>
                  <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

                {/* User Dropdown */}
                {userMenuOpen && (
                  <div className={`absolute right-0 mt-2 w-56 bg-dark-900/95 backdrop-blur-xl rounded-xl shadow-xl border ${isHardcore ? 'border-red-500/20' : 'border-cyan-500/20'} overflow-hidden animate-slide-down`}>
                    {/* User Info Header */}
                    <div className={`px-4 py-3 border-b ${isHardcore ? 'border-red-500/10' : 'border-cyan-500/10'}`}>
                      <p className="text-white font-medium truncate">{user.username}</p>
                      <p className="text-xs text-gray-500 truncate">{user.discordUsername}</p>
                      {/* Gold Coins */}
                      <div className="flex items-center space-x-1.5 mt-2">
                        <Coins className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm text-yellow-400 font-medium">{user.goldCoins || 0}</span>
                      </div>
                    </div>

                    <div className="py-2">
                      <Link
                        to="/my-profile"
                        onClick={() => setUserMenuOpen(false)}
                        className={`flex items-center space-x-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors`}
                      >
                        <User className="w-4 h-4" />
                        <span>{language === 'fr' ? 'Mon Profil' : 'My Profile'}</span>
                      </Link>

                      {/* My Squad Link */}
                      <Link
                        to="/my-squad"
                        onClick={() => setUserMenuOpen(false)}
                        className={`flex items-center justify-between px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors`}
                      >
                        <div className="flex items-center space-x-3">
                          <Users className="w-4 h-4" />
                          <span>{language === 'fr' ? 'Mon Escouade' : language === 'de' ? 'Mein Squad' : language === 'it' ? 'La mia Squadra' : 'My Squad'}</span>
                        </div>
                        {squadRequestsCount > 0 && (
                          <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
                            {squadRequestsCount}
                          </span>
                        )}
                      </Link>

                      {/* My Disputes Link */}
                      <Link
                        to="/my-disputes"
                        onClick={() => setUserMenuOpen(false)}
                        className={`flex items-center space-x-3 px-4 py-2.5 text-sm text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 transition-colors`}
                      >
                        <AlertTriangle className="w-4 h-4" />
                        <span>{language === 'fr' ? 'Mes Litiges' : language === 'de' ? 'Meine Streitigkeiten' : language === 'it' ? 'Le mie controversie' : 'My Disputes'}</span>
                      </Link>

                      {/* Admin Panel Link */}
                      {isStaff() && (
                        <Link
                          to="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className={`flex items-center space-x-3 px-4 py-2.5 text-sm text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors`}
                        >
                          <Shield className="w-4 h-4" />
                          <span>Admin Panel</span>
                        </Link>
                      )}

                      <div className={`my-2 border-t ${isHardcore ? 'border-red-500/10' : 'border-cyan-500/10'}`}></div>

                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          logout();
                        }}
                        className={`w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors`}
                      >
                        <LogOut className="w-4 h-4" />
                        <span>{language === 'fr' ? 'Déconnexion' : 'Logout'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Discord Login Button */
            <button
                onClick={handleDiscordLogin}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium text-sm transition-all shadow-lg shadow-[#5865F2]/30 hover:shadow-[#4752C4]/40"
            >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037 13.13 13.13 0 00-.608 1.25 18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037 19.736 19.736 0 00-4.884 1.515.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128c.122-.093.244-.19.361-.289a.074.074 0 01.078-.012c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.118.098.24.195.361.288a.077.077 0 01-.006.128 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
                <span>{language === 'fr' ? 'Connexion' : 'Login'}</span>
            </button>
            )}

            {/* Language Selector */}
            <div className="relative" ref={languageRef}>
              <button
                onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg border border-white/10 ${hoverBorderColor} ${bgAccent} transition-all duration-300 group`}
              >
                <img src={currentLanguage.flag} alt={currentLanguage.label} className="w-5 h-5 rounded object-cover" />
                <ChevronDown className={`w-3 h-3 text-gray-400 ${isHardcore ? 'group-hover:text-red-400' : 'group-hover:text-cyan-400'} transition-all ${languageMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {languageMenuOpen && (
                <div className={`absolute right-0 mt-2 bg-dark-900/95 backdrop-blur-xl rounded-lg shadow-xl border ${badgeBg.replace('bg-', 'border-').replace('/20', '/20')} p-2 animate-slide-down`}>
                  <div className="flex flex-col space-y-1">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setLanguageMenuOpen(false);
                        }}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgAccent} transition-all p-1.5 ${
                          language === lang.code ? `${badgeBg} ring-2 ${isHardcore ? 'ring-red-500' : 'ring-cyan-500'}` : ''
                        }`}
                        title={lang.label}
                      >
                        <img src={lang.flag} alt={lang.label} className="w-full h-full rounded object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`md:hidden p-2 rounded-lg text-gray-300 ${textAccentHover} ${bgAccent} transition-colors`}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className={`md:hidden border-t ${borderColor} bg-dark-950/95 backdrop-blur-xl animate-slide-down`}>
          <div className="px-4 py-4 space-y-2">
            {/* User Info Mobile */}
            {isAuthenticated && user && (
              <div className={`flex items-center space-x-3 px-4 py-3 mb-3 rounded-xl ${bgAccent} border ${isHardcore ? 'border-red-500/20' : 'border-cyan-500/20'}`}>
                <img 
                  src={user.avatar || getDefaultAvatar(user.username)} 
                  alt="Avatar"
                  className={`w-10 h-10 rounded-full border-2 ${isHardcore ? 'border-red-500/50' : 'border-cyan-500/50'}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{user.username}</p>
                  <div className="flex items-center space-x-1">
                    <Coins className="w-3 h-3 text-yellow-400" />
                    <span className="text-xs text-yellow-400">{user.goldCoins || 0}</span>
                  </div>
                </div>
              </div>
            )}

            {navLinks.map(({ path, label, icon: Icon, comingSoon }) => (
              <Link
                key={path}
                to={comingSoon ? '#' : path}
                onClick={comingSoon ? (e) => e.preventDefault() : () => setMobileMenuOpen(false)}
                className={`
                  flex items-center space-x-3 px-4 py-2.5 rounded-lg font-medium transition-all text-sm relative
                  ${comingSoon 
                    ? 'text-gray-500 cursor-not-allowed opacity-60'
                    : isActive(path)
                      ? `${buttonText} bg-gradient-to-r ${buttonGradient} shadow-lg`
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
                {comingSoon && (
                  <span className="ml-auto px-1.5 py-0.5 text-[9px] font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 rounded-full">
                    {language === 'fr' ? 'Bientôt' : language === 'de' ? 'Bald' : language === 'it' ? 'Presto' : 'Soon'}
                  </span>
                )}
              </Link>
            ))}
            
            <div className={`pt-2 border-t ${borderColor} space-y-2`}>
              {/* My Profile Mobile */}
              {isAuthenticated && user && (
                <Link
                  to="/my-profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg border border-white/10 ${hoverBorderColor} transition-all text-gray-300 hover:text-white text-sm`}
                >
                  <User className="w-4 h-4" />
                  <span>{language === 'fr' ? 'Mon Profil' : 'My Profile'}</span>
                </Link>
              )}

              {/* My Squad Mobile */}
              {isAuthenticated && user && (
                <Link
                  to="/my-squad"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-white/10 ${hoverBorderColor} transition-all text-gray-300 hover:text-white text-sm`}
                >
                  <div className="flex items-center space-x-3">
                    <Users className="w-4 h-4" />
                    <span>{language === 'fr' ? 'Mon Escouade' : language === 'de' ? 'Mein Squad' : language === 'it' ? 'La mia Squadra' : 'My Squad'}</span>
                  </div>
                  {squadRequestsCount > 0 && (
                    <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
                      {squadRequestsCount}
                    </span>
                  )}
                </Link>
              )}

              {/* My Disputes Mobile */}
              {isAuthenticated && user && (
                <Link
                  to="/my-disputes"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg border border-orange-500/30 bg-orange-500/10 transition-all text-orange-400 hover:text-orange-300 text-sm`}
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>{language === 'fr' ? 'Mes Litiges' : language === 'de' ? 'Meine Streitigkeiten' : language === 'it' ? 'Le mie controversie' : 'My Disputes'}</span>
                </Link>
              )}

              {/* Messages Mobile */}
              {isAuthenticated && user && (
                <Link
                  to="/messages"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-white/10 ${hoverBorderColor} transition-all text-gray-300 hover:text-white text-sm`}
                >
                  <div className="flex items-center space-x-3">
                    <MessageSquare className="w-4 h-4" />
                    <span>{language === 'fr' ? 'Messages' : 'Messages'}</span>
                  </div>
                  {unreadMessages > 0 && (
                    <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
                      {unreadMessages}
                    </span>
                  )}
                </Link>
              )}

              {/* Admin Panel Mobile */}
              {isAuthenticated && user && isStaff && isStaff() && (
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg border border-purple-500/30 bg-purple-500/10 transition-all text-purple-400 hover:text-purple-300 text-sm`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Admin Panel</span>
                </Link>
              )}

              {/* Change Mode Button Mobile */}
              <button
                onClick={handleChangeMode}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg border border-white/10 ${hoverBorderColor} ${bgAccent} transition-all text-gray-300 hover:text-white text-sm`}
              >
                <LogOut className="w-4 h-4" />
                <span>Changer de mode</span>
              </button>

              {/* Daily Spin Wheel Button Mobile */}
              {isAuthenticated && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowSpinWheel(true);
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium text-sm shadow-lg"
                >
                  <Gift className="w-4 h-4" />
                  <span>{language === 'fr' ? 'Roue quotidienne' : 'Daily Wheel'}</span>
                </button>
              )}

              {/* Mobile Language Selector */}
              <div className="px-4 py-2 text-xs text-cyan-400/70 font-semibold uppercase tracking-wider">{t('language')}</div>
              <div className="flex items-center justify-center space-x-3 px-4 py-2">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang.code);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all p-2 ${
                      language === lang.code
                        ? `${badgeBg} ring-2 ${isHardcore ? 'ring-red-500' : 'ring-cyan-500'} scale-110`
                        : `border border-white/10 ${hoverBorderColor}`
                    }`}
                    title={lang.label}
                  >
                    <img src={lang.flag} alt={lang.label} className="w-full h-full rounded object-cover" />
                  </button>
                ))}
              </div>
              
              {/* Auth Buttons Mobile */}
              {isAuthenticated && user ? (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 font-medium text-sm transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{language === 'fr' ? 'Déconnexion' : 'Logout'}</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleDiscordLogin();
                  }}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium text-sm transition-all shadow-lg shadow-[#5865F2]/30"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037 13.13 13.13 0 00-.608 1.25 18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037 19.736 19.736 0 00-4.884 1.515.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128c.122-.093.244-.19.361-.289a.074.074 0 01.078-.012c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.118.098.24.195.361.288a.077.077 0 01-.006.128 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                  <span>{language === 'fr' ? 'Connexion Discord' : 'Discord Login'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Spin Wheel Modal */}
      <SpinWheel isOpen={showSpinWheel} onClose={() => setShowSpinWheel(false)} />
    </nav>
  );
};

export default Navbar;
