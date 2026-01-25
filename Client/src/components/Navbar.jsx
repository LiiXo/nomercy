import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { getDefaultAvatar } from '../utils/avatar';
import { Menu, X, Trophy, Home, ChevronDown, LogOut, Zap, Medal, User, Shield, Coins, Gift, Search, Loader2, Users, MessageSquare, ShoppingBag } from 'lucide-react';
import SpinWheel from './SpinWheel';

const Navbar = () => {
  const { language, setLanguage, t } = useLanguage();
  const { selectedMode, resetMode } = useMode();
  const { user, isAuthenticated, login, logout, isStaff, isArbitre, hasAdminAccess } = useAuth();
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
  const [canSpin, setCanSpin] = useState(false);

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

  // Fetch squad join requests count
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
    const interval = setInterval(fetchUnreadMessages, 15000);
    
    const handleMessagesRead = () => fetchUnreadMessages();
    window.addEventListener('messagesRead', handleMessagesRead);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('messagesRead', handleMessagesRead);
    };
  }, [isAuthenticated]);

  // Fetch spin status to show/hide yellow notification dot
  useEffect(() => {
    const fetchSpinStatus = async () => {
      if (!isAuthenticated) {
        setCanSpin(false);
        return;
      }
      
      try {
        const response = await fetch('https://api-nomercy.ggsecure.io/api/spin/status', {
          credentials: 'include'
        });
        const data = await response.json();
        if (data.success) {
          setCanSpin(data.canSpin);
        }
      } catch (err) {
        console.error('Error fetching spin status:', err);
      }
    };

    fetchSpinStatus();
    // Check every minute for spin availability
    const interval = setInterval(fetchSpinStatus, 60000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const isActive = (path) => location.pathname === path;

  const handleChangeMode = () => {
    resetMode();
    navigate('/');
  };

  const handleDiscordLogin = () => login();

  // Build navigation links - ranked mode visible to everyone
  const navLinks = [
    { path: `/${selectedMode}`, label: t('home'), icon: Home },
    { path: `/${selectedMode}/ranked`, label: t('rankedMode'), icon: Medal },
  ];

  // Check if user is admin (for admin panel access)
  const isAdmin = user?.roles?.includes('admin');

  const isHardcore = selectedMode === 'hardcore';

  return (
    <nav className="sticky top-0 z-50 glass-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Logo */}
          <Link to={`/${selectedMode}`} className="flex items-center gap-3 group">
            <div className="relative">
              <div className={`absolute inset-0 blur-xl opacity-50 group-hover:opacity-70 transition-opacity ${isHardcore ? 'bg-neon-red' : 'bg-accent-500'}`} />
              <div className={`relative w-11 h-11 rounded-xl flex items-center justify-center shadow-lg ${
                isHardcore 
                  ? 'bg-gradient-to-br from-neon-red to-neon-orange shadow-neon-red' 
                  : 'bg-gradient-to-br from-accent-500 to-blue-600 shadow-neon-cyan'
              }`}>
                <Zap className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <span className={`text-xl font-display tracking-wider ${isHardcore ? 'text-gradient-fire' : 'text-gradient-ice'}`}>
                NOMERCY
              </span>
              <div className={`text-[10px] uppercase tracking-[0.2em] ${isHardcore ? 'text-neon-red/60' : 'text-accent-400/60'}`}>
                {selectedMode === 'hardcore' ? 'Hardcore' : 'CDL'}
              </div>
            </div>
          </Link>

          {/* Center Navigation - Desktop */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`nav-link flex items-center gap-2 ${isActive(path) ? 'active' : ''}`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </Link>
            ))}
            {/* Shop - Available to everyone */}
            <Link
              to={`/${selectedMode}/shop`}
              className={`nav-link flex items-center gap-2 ${isActive(`/${selectedMode}/shop`) ? 'active' : ''}`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{language === 'fr' ? 'Boutique' : 'Shop'}</span>
            </Link>
          </div>

          {/* Right Side - Desktop */}
          <div className="hidden md:flex items-center gap-3">
            {/* Change Mode Button */}
            <button
              onClick={handleChangeMode}
              className="p-2.5 rounded-xl glass hover:bg-white/10 transition-all group"
              title="Changer de mode"
            >
              <LogOut className={`w-4 h-4 ${isHardcore ? 'text-amber-400' : 'text-amber-400'} group-hover:text-amber-300`} />
            </button>

            {/* Daily Spin */}
            {isAuthenticated && (
              <button
                onClick={() => setShowSpinWheel(true)}
                className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium text-sm hover:scale-105 transition-all shadow-lg shadow-purple-500/25"
              >
                <Gift className="w-4 h-4" />
                <span className="hidden lg:inline">{language === 'fr' ? 'Roue' : 'Wheel'}</span>
                {canSpin && <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />}
              </button>
            )}

            {/* Messages */}
            {isAuthenticated && (
              <Link
                to="/messages"
                className="relative p-2.5 rounded-xl glass hover:bg-white/10 transition-all"
              >
                <MessageSquare className="w-4 h-4 text-gray-400 hover:text-white" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-neon-red text-white text-xs font-bold rounded-full">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </Link>
            )}

            {/* Search */}
            <div className="relative" ref={searchRef}>
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="p-2.5 rounded-xl glass hover:bg-white/10 transition-all"
              >
                <Search className="w-4 h-4 text-gray-400 hover:text-white" />
              </button>

              {showSearch && (
                <div className="absolute right-0 mt-2 w-80 glass rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
                  <div className="p-4">
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={language === 'fr' ? 'Rechercher un joueur...' : 'Search player...'}
                        className="w-full px-4 py-3 pl-10 bg-dark-800 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-neon-red/50"
                        autoFocus
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      {searchLoading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 animate-spin" />
                      )}
                    </div>
                  </div>
                  
                  {searchResults.length > 0 && (
                    <div className="border-t border-white/5 max-h-60 overflow-y-auto">
                      {searchResults.map((player) => (
                        <Link
                          key={player._id}
                          to={`/player/${player._id}`}
                          onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                        >
                          <img src={player.avatarUrl || player.avatar || getDefaultAvatar(player.username)} alt="" className="w-10 h-10 rounded-full object-cover" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{player.username}</p>
                            {player.activisionId && <p className="text-gray-500 text-xs truncate">{player.activisionId}</p>}
                          </div>
                          {player.platform && (
                            <span className={`text-[10px] px-2 py-0.5 rounded ${player.platform === 'PC' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                              {player.platform}
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                  
                  {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
                    <div className="px-4 py-4 text-center text-gray-500 text-sm border-t border-white/5">
                      {language === 'fr' ? 'Aucun joueur trouvé' : 'No player found'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Auth Section */}
            {isAuthenticated && user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl glass hover:bg-white/10 transition-all"
                >
                  <img 
                    src={user.avatar || getDefaultAvatar(user.username)} 
                    alt=""
                    className="w-8 h-8 rounded-full"
                  />
                  <span className="text-sm font-medium text-white max-w-[100px] truncate">{user.username}</span>
                  <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-60 glass rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
                    <div className="px-4 py-4 border-b border-white/5">
                      <p className="text-white font-medium truncate">{user.username}</p>
                      <p className="text-xs text-gray-500 truncate">{user.discordUsername}</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Coins className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm text-yellow-400 font-medium">{user.goldCoins || 0}</span>
                      </div>
                    </div>

                    <div className="py-2">
                      <Link to="/my-profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                        <User className="w-4 h-4" />
                        <span>{language === 'fr' ? 'Mon Profil' : 'My Profile'}</span>
                      </Link>

                      <Link to="/my-squad" onClick={() => setUserMenuOpen(false)} className="flex items-center justify-between px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3">
                          <Users className="w-4 h-4" />
                          <span>{language === 'fr' ? 'Mon Escouade' : 'My Squad'}</span>
                        </div>
                        {squadRequestsCount > 0 && (
                          <span className="px-2 py-0.5 text-xs font-bold bg-neon-red text-white rounded-full">{squadRequestsCount}</span>
                        )}
                      </Link>

                      <Link to="/my-purchases" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                        <ShoppingBag className="w-4 h-4" />
                        <span>{language === 'fr' ? 'Mes Achats' : 'My Purchases'}</span>
                      </Link>

                      {hasAdminAccess() && (
                        <Link to="/admin" onClick={() => setUserMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${isArbitre() && !isStaff() ? 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10' : 'text-purple-400 hover:text-purple-300 hover:bg-purple-500/10'}`}>
                          <Shield className="w-4 h-4" />
                          <span>{isArbitre() && !isStaff() ? 'Panel Arbitre' : 'Admin Panel'}</span>
                        </Link>
                      )}

                      <div className="my-2 border-t border-white/5" />

                      <button onClick={() => { setUserMenuOpen(false); logout(); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
                        <LogOut className="w-4 h-4" />
                        <span>{language === 'fr' ? 'Déconnexion' : 'Logout'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleDiscordLogin}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium text-sm transition-all hover:scale-105"
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
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl glass hover:bg-white/10 transition-all"
              >
                <img src={currentLanguage.flag} alt={currentLanguage.label} className="w-5 h-5 rounded object-cover" />
                <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${languageMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {languageMenuOpen && (
                <div className="absolute right-0 mt-2 glass rounded-xl p-2 animate-scale-in">
                  <div className="flex flex-col gap-1">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => { setLanguage(lang.code); setLanguageMenuOpen(false); }}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all hover:bg-white/10 p-1.5 ${
                          language === lang.code ? 'bg-neon-red/20 ring-2 ring-neon-red' : ''
                        }`}
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
            className="md:hidden p-2.5 rounded-xl glass"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden glass-dark border-t border-white/5 animate-slide-down">
          <div className="px-4 py-4 space-y-2">
            {/* User Info Mobile */}
            {isAuthenticated && user && (
              <div className={`flex items-center gap-3 px-4 py-3 mb-3 rounded-xl ${isHardcore ? 'bg-neon-red/10 border border-neon-red/20' : 'bg-accent-500/10 border border-accent-500/20'}`}>
                <img 
                  src={user.avatar || getDefaultAvatar(user.username)} 
                  alt=""
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{user.username}</p>
                  <div className="flex items-center gap-1">
                    <Coins className="w-3 h-3 text-yellow-400" />
                    <span className="text-xs text-yellow-400">{user.goldCoins || 0}</span>
                  </div>
                </div>
              </div>
            )}

            {navLinks.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all text-sm ${
                  isActive(path)
                    ? `text-white ${isHardcore ? 'bg-gradient-to-r from-neon-red to-neon-orange' : 'bg-gradient-to-r from-accent-500 to-blue-600'}`
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </Link>
            ))}
            
            {/* Mobile Search Bar */}
            <div className="mb-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={language === 'fr' ? 'Rechercher un joueur...' : 'Search player...'}
                  className="w-full px-4 py-3 pl-10 bg-dark-800/50 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-neon-red/50"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                {searchLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 animate-spin" />
                )}
              </div>
              
              {searchResults.length > 0 && (
                <div className="mt-2 glass rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  {searchResults.map((player) => (
                    <Link
                      key={player._id}
                      to={`/player/${player._id}`}
                      onClick={() => { setMobileMenuOpen(false); setSearchQuery(''); setSearchResults([]); }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                    >
                      <img src={player.avatarUrl || player.avatar || getDefaultAvatar(player.username)} alt="" className="w-10 h-10 rounded-full object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{player.username}</p>
                        {player.activisionId && <p className="text-gray-500 text-xs truncate">{player.activisionId}</p>}
                      </div>
                      {player.platform && (
                        <span className={`text-[10px] px-2 py-0.5 rounded ${player.platform === 'PC' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                          {player.platform}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
              
              {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
                <div className="mt-2 px-4 py-3 text-center text-gray-500 text-sm glass rounded-xl">
                  {language === 'fr' ? 'Aucun joueur trouvé' : 'No player found'}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-white/5 space-y-2">
              {isAuthenticated && user && (
                <>
                  <Link to="/my-profile" onClick={() => setMobileMenuOpen(false)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl glass text-gray-300 hover:text-white text-sm">
                    <User className="w-4 h-4" />
                    <span>{language === 'fr' ? 'Mon Profil' : 'My Profile'}</span>
                  </Link>

                  <Link to="/my-squad" onClick={() => setMobileMenuOpen(false)} className="w-full flex items-center justify-between px-4 py-3 rounded-xl glass text-gray-300 hover:text-white text-sm">
                    <div className="flex items-center gap-3">
                      <Users className="w-4 h-4" />
                      <span>{language === 'fr' ? 'Mon Escouade' : 'My Squad'}</span>
                    </div>
                    {squadRequestsCount > 0 && (
                      <span className="px-2 py-0.5 text-xs font-bold bg-neon-red text-white rounded-full">{squadRequestsCount}</span>
                    )}
                  </Link>

                  <Link to="/my-purchases" onClick={() => setMobileMenuOpen(false)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl glass text-gray-300 hover:text-white text-sm">
                    <ShoppingBag className="w-4 h-4" />
                    <span>{language === 'fr' ? 'Mes Achats' : 'My Purchases'}</span>
                  </Link>

                  <Link to="/messages" onClick={() => setMobileMenuOpen(false)} className="w-full flex items-center justify-between px-4 py-3 rounded-xl glass text-gray-300 hover:text-white text-sm">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="w-4 h-4" />
                      <span>{language === 'fr' ? 'Messages' : 'Messages'}</span>
                    </div>
                    {unreadMessages > 0 && (
                      <span className="px-2 py-0.5 text-xs font-bold bg-neon-red text-white rounded-full">{unreadMessages}</span>
                    )}
                  </Link>

                  <button
                    onClick={() => { setMobileMenuOpen(false); setShowSpinWheel(true); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium text-sm"
                  >
                    <Gift className="w-4 h-4" />
                    <span>{language === 'fr' ? 'Roue quotidienne' : 'Daily Wheel'}</span>
                  </button>

                  {/* Shop - Available to everyone (mobile) */}
                  <Link 
                    to={`/${selectedMode}/shop`}
                    onClick={() => setMobileMenuOpen(false)} 
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium bg-yellow-500/10 border border-yellow-500/30 text-yellow-400"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>{language === 'fr' ? 'Boutique' : 'Shop'}</span>
                  </Link>

                  {hasAdminAccess() && (
                    <Link 
                      to="/admin" 
                      onClick={() => setMobileMenuOpen(false)} 
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${isArbitre() && !isStaff() ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400' : 'bg-purple-500/10 border border-purple-500/30 text-purple-400'}`}
                    >
                      <Shield className="w-4 h-4" />
                      <span>{isArbitre() && !isStaff() ? 'Panel Arbitre' : 'Admin Panel'}</span>
                    </Link>
                  )}
                </>
              )}

              <button
                onClick={handleChangeMode}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl glass text-gray-300 hover:text-white text-sm"
              >
                <LogOut className="w-4 h-4" />
                <span>Changer de mode</span>
              </button>

              {/* Mobile Language Selector */}
              <div className="flex items-center justify-center gap-3 px-4 py-3">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => { setLanguage(lang.code); setMobileMenuOpen(false); }}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all p-2 ${
                      language === lang.code ? 'bg-neon-red/20 ring-2 ring-neon-red scale-110' : 'glass'
                    }`}
                  >
                    <img src={lang.flag} alt={lang.label} className="w-full h-full rounded object-cover" />
                  </button>
                ))}
              </div>
              
              {/* Auth Buttons Mobile */}
              {isAuthenticated && user ? (
                <button
                  onClick={() => { setMobileMenuOpen(false); logout(); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-medium text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{language === 'fr' ? 'Déconnexion' : 'Logout'}</span>
                </button>
              ) : (
                <button
                  onClick={() => { setMobileMenuOpen(false); handleDiscordLogin(); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#5865F2] text-white font-medium text-sm"
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
      <SpinWheel isOpen={showSpinWheel} onClose={() => { 
        setShowSpinWheel(false);
        // Refetch spin status after closing the wheel
        fetch('https://api-nomercy.ggsecure.io/api/spin/status', { credentials: 'include' })
          .then(res => res.json())
          .then(data => { if (data.success) setCanSpin(data.canSpin); })
          .catch(() => {});
      }} />
    </nav>
  );
};

export default Navbar;
