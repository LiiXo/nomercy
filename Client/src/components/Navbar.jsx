import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { getDefaultAvatar } from '../utils/avatar';
import { Menu, X, Trophy, Home, ChevronDown, LogOut, Zap, Medal, User, Shield, Coins, Gift, Search, Loader2, Users, MessageSquare, ShoppingBag, Target } from 'lucide-react';
import SpinWheel from './SpinWheel';
import { API_URL } from '../config';

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
  const [strickerModeEnabled, setStrickerModeEnabled] = useState(false);

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
        const response = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(searchQuery)}&limit=5`);
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
      // Check mode-specific squad field
      const hasSquad = selectedMode === 'hardcore' ? user?.squadHardcore : user?.squadCdl;
      if (!isAuthenticated || !hasSquad) {
        setSquadRequestsCount(0);
        return;
      }
      
      try {
        const response = await fetch(`${API_URL}/squads/my-squad/requests-count?mode=${selectedMode}`, {
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
  }, [isAuthenticated, selectedMode, user?.squadHardcore, user?.squadCdl]);

  // Fetch unread messages count
  useEffect(() => {
    const fetchUnreadMessages = async () => {
      if (!isAuthenticated) {
        setUnreadMessages(0);
        return;
      }
      
      try {
        const response = await fetch(`${API_URL}/messages/unread-count`, {
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
        const response = await fetch(`${API_URL}/spin/status`, {
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

  // Fetch stricker mode enabled status from app settings
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
    // Re-check every 30 seconds
    const interval = setInterval(fetchStrickerMode, 30000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (path) => location.pathname === path;

  const handleChangeMode = () => {
    resetMode();
    navigate('/');
  };

  const handleDiscordLogin = () => login();

  // Build navigation links - ranked mode visible to everyone
  const navLinks = [
    { path: `/${selectedMode}`, label: t('home'), icon: Home },
    { path: `/${selectedMode}/ranked`, label: 'Ranked', icon: Medal },
  ];

  // Check if user is admin (for admin panel access)
  const isAdmin = user?.roles?.includes('admin');

  const isHardcore = selectedMode === 'hardcore';

  return (
    <nav className={`sticky top-0 z-50 backdrop-blur-xl border-b shadow-2xl relative ${
      isHardcore 
        ? 'bg-gradient-to-b from-dark-950/95 via-dark-900/90 to-dark-900/85 border-neon-red/10 shadow-neon-red/5' 
        : 'bg-gradient-to-b from-dark-950/95 via-dark-900/90 to-dark-900/85 border-accent-500/10 shadow-accent-500/5'
    }`}>
      {/* Subtle neon glow effect */}
      <div className={`absolute inset-0 opacity-30 pointer-events-none ${
        isHardcore 
          ? 'bg-[radial-gradient(ellipse_at_top,rgba(255,45,85,0.08),transparent_50%)]'
          : 'bg-[radial-gradient(ellipse_at_top,rgba(0,212,255,0.08),transparent_50%)]'
      }`} />
      
      <div className="max-w-[1600px] mx-auto px-6 relative">
        <div className="flex items-center h-16">
          {/* Logo - Fixed width */}
          <Link to={`/${selectedMode}`} className="flex items-center gap-3 group shrink-0">
            <div className="relative">
              <div className={`absolute inset-0 blur-2xl opacity-30 group-hover:opacity-50 transition-all duration-500 ${isHardcore ? 'bg-neon-red' : 'bg-accent-500'}`} />
              <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105 ${
                isHardcore 
                  ? 'bg-gradient-to-br from-neon-red via-neon-orange to-yellow-500 shadow-lg shadow-neon-red/25' 
                  : 'bg-gradient-to-br from-accent-500 via-blue-500 to-cyan-400 shadow-lg shadow-accent-500/25'
              }`}>
                <Zap className="w-5 h-5 text-white drop-shadow-lg" />
              </div>
            </div>
            <div className="hidden sm:block">
              <span className={`text-lg font-display font-bold tracking-wide ${isHardcore ? 'text-gradient-fire' : 'text-gradient-ice'}`}>
                NOMERCY
              </span>
              <div className={`text-[9px] uppercase tracking-[0.25em] -mt-0.5 transition-colors duration-300 ${isHardcore ? 'text-neon-red/40 group-hover:text-neon-red/60' : 'text-accent-400/40 group-hover:text-accent-400/60'}`}>
                {selectedMode === 'hardcore' ? 'Hardcore' : 'CDL'}
              </div>
            </div>
          </Link>

          {/* Center Navigation - Desktop */}
          <div className="hidden md:flex items-center justify-center flex-1 px-8">
            <div className="flex items-center gap-1">
              {/* Accueil */}
              <Link
                to={`/${selectedMode}`}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium tracking-wide uppercase transition-all duration-300 group ${
                  isActive(`/${selectedMode}`)
                    ? `text-white ${isHardcore ? 'bg-neon-red/10 shadow-[inset_0_0_12px_rgba(255,45,85,0.1)]' : 'bg-accent-500/10 shadow-[inset_0_0_12px_rgba(0,212,255,0.1)]'}`
                    : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.03]'
                }`}
              >
                <Home className={`w-4 h-4 transition-all duration-300 ${isActive(`/${selectedMode}`) ? (isHardcore ? 'text-neon-red' : 'text-accent-400') : 'group-hover:scale-110'}`} />
                <span>{t('home')}</span>
                {isActive(`/${selectedMode}`) && (
                  <span className={`absolute bottom-0 left-3 right-3 h-[2px] rounded-full ${isHardcore ? 'bg-gradient-to-r from-neon-red to-neon-orange' : 'bg-gradient-to-r from-accent-500 to-blue-500'}`} />
                )}
              </Link>

              {/* Ranked - Theme Orange */}
              <Link
                to={`/${selectedMode}/ranked`}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium tracking-wide uppercase transition-all duration-300 group ${
                  isActive(`/${selectedMode}/ranked`)
                    ? 'text-white bg-neon-orange/10 shadow-[inset_0_0_12px_rgba(255,107,44,0.1)]'
                    : 'text-gray-500 hover:text-orange-300 hover:bg-neon-orange/5'
                }`}
              >
                <Medal className={`w-4 h-4 transition-all duration-300 ${isActive(`/${selectedMode}/ranked`) ? 'text-neon-orange' : 'group-hover:scale-110'}`} />
                <span>Ranked</span>
                {isActive(`/${selectedMode}/ranked`) && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-gradient-to-r from-neon-orange to-amber-400" />
                )}
              </Link>

              {/* Stricker - Theme Vert */}
              {(strickerModeEnabled || hasAdminAccess()) && (
                <Link
                  to={`/${selectedMode}/stricker`}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium tracking-wide uppercase transition-all duration-300 group ${
                    isActive(`/${selectedMode}/stricker`) || location.pathname.includes('/stricker')
                      ? 'text-white bg-lime-500/10 shadow-[inset_0_0_12px_rgba(132,204,22,0.1)]'
                      : 'text-gray-500 hover:text-lime-300 hover:bg-lime-500/5'
                  }`}
                >
                  <Target className={`w-4 h-4 transition-all duration-300 ${(isActive(`/${selectedMode}/stricker`) || location.pathname.includes('/stricker')) ? 'text-lime-400' : 'group-hover:scale-110'}`} />
                  <span>Stricker</span>
                  {(isActive(`/${selectedMode}/stricker`) || location.pathname.includes('/stricker')) && (
                    <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-gradient-to-r from-lime-400 to-emerald-400" />
                  )}
                </Link>
              )}

              {/* Boutique */}
              <Link
                to={`/${selectedMode}/shop`}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium tracking-wide uppercase transition-all duration-300 group ${
                  isActive(`/${selectedMode}/shop`)
                    ? `text-white ${isHardcore ? 'bg-neon-red/10 shadow-[inset_0_0_12px_rgba(255,45,85,0.1)]' : 'bg-accent-500/10 shadow-[inset_0_0_12px_rgba(0,212,255,0.1)]'}`
                    : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.03]'
                }`}
              >
                <ShoppingBag className={`w-4 h-4 transition-all duration-300 ${isActive(`/${selectedMode}/shop`) ? (isHardcore ? 'text-neon-red' : 'text-accent-400') : 'group-hover:scale-110'}`} />
                <span>{language === 'fr' ? 'Boutique' : 'Shop'}</span>
                {isActive(`/${selectedMode}/shop`) && (
                  <span className={`absolute bottom-0 left-3 right-3 h-[2px] rounded-full ${isHardcore ? 'bg-gradient-to-r from-neon-red to-neon-orange' : 'bg-gradient-to-r from-accent-500 to-blue-500'}`} />
                )}
              </Link>
            </div>
          </div>

          {/* Right Side - Desktop */}
          <div className="hidden md:flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleChangeMode}
              className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.05] transition-all duration-300"
              title={language === 'fr' ? 'Changer de mode' : 'Change mode'}
            >
              <LogOut className="w-4 h-4" />
            </button>

            {isAuthenticated && (
              <button
                onClick={() => setShowSpinWheel(true)}
                className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-300 ${
                  isHardcore
                    ? 'text-neon-orange bg-neon-orange/10 hover:bg-neon-orange/15 border border-neon-orange/20'
                    : 'text-accent-400 bg-accent-500/10 hover:bg-accent-500/15 border border-accent-500/20'
                }`}
              >
                <Gift className="w-4 h-4" />
                <span className="hidden lg:inline">{language === 'fr' ? 'Roue' : 'Wheel'}</span>
                {canSpin && <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full animate-pulse ring-2 ring-dark-900 ${isHardcore ? 'bg-neon-orange' : 'bg-accent-400'}`} />}
              </button>
            )}

            <div className="w-px h-5 bg-white/[0.06] mx-0.5" />

            {isAuthenticated && (
              <Link
                to="/messages"
                className="relative p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.05] transition-all duration-300"
              >
                <MessageSquare className="w-4 h-4" />
                {unreadMessages > 0 && (
                  <span className={`absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center text-white text-[9px] font-bold rounded-full px-0.5 ${isHardcore ? 'bg-neon-red' : 'bg-accent-500'}`}>
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </Link>
            )}

            <div className="relative" ref={searchRef}>
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.05] transition-all duration-300"
              >
                <Search className="w-4 h-4" />
              </button>

              {showSearch && (
                <div className="absolute right-0 mt-2 w-80 bg-dark-900 border border-white/[0.06] rounded-xl shadow-2xl shadow-black/60 overflow-hidden animate-scale-in">
                  <div className="p-3">
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={language === 'fr' ? 'Rechercher un joueur...' : 'Search player...'}
                        className={`w-full px-4 py-2.5 pl-9 bg-white/[0.03] border border-white/[0.06] rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none transition-colors duration-300 ${isHardcore ? 'focus:border-neon-red/30' : 'focus:border-accent-500/30'}`}
                        autoFocus
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                      {searchLoading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 animate-spin" />
                      )}
                    </div>
                  </div>
                  
                  {searchResults.length > 0 && (
                    <div className="border-t border-white/[0.04] max-h-60 overflow-y-auto">
                      {searchResults.map((player) => (
                        <Link
                          key={player._id}
                          to={`/player/${player._id}`}
                          onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}
                          className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] transition-all duration-200"
                        >
                          <img src={player.avatarUrl || player.avatar || getDefaultAvatar(player.username)} alt="" className="w-9 h-9 rounded-full object-cover ring-1 ring-white/10" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{player.username}</p>
                            {player.activisionId && <p className="text-gray-600 text-xs truncate">{player.activisionId}</p>}
                          </div>
                          {player.platform && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${player.platform === 'PC' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-400'}`}>
                              {player.platform}
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                  
                  {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
                    <div className="px-3 py-3 text-center text-gray-600 text-sm border-t border-white/[0.04]">
                      {language === 'fr' ? 'Aucun joueur trouvé' : 'No player found'}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="w-px h-5 bg-white/[0.06] mx-0.5" />

            {isAuthenticated && user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-lg hover:bg-white/[0.04] transition-all duration-300"
                >
                  <img 
                    src={user.avatar || getDefaultAvatar(user.username)} 
                    alt=""
                    className={`w-7 h-7 rounded-md object-cover ring-1 ${isHardcore ? 'ring-neon-red/30' : 'ring-accent-500/30'}`}
                  />
                  <span className="text-sm font-medium text-gray-300 max-w-[80px] truncate">{user.username}</span>
                  <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform duration-300 ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-dark-900 border border-white/[0.06] rounded-xl shadow-2xl shadow-black/60 overflow-hidden animate-scale-in">
                    <div className="px-4 py-3 border-b border-white/[0.04]">
                      <p className="text-white font-medium truncate text-sm">{user.username}</p>
                      <p className="text-[11px] text-gray-600 truncate">{user.discordUsername}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Coins className="w-3 h-3 text-yellow-500" />
                        <span className="text-xs text-yellow-500 font-semibold">{user.goldCoins || 0}</span>
                      </div>
                    </div>

                    <div className="py-1">
                      <Link to="/my-profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/[0.04] transition-all duration-200">
                        <User className="w-4 h-4" />
                        <span>{language === 'fr' ? 'Mon Profil' : 'My Profile'}</span>
                      </Link>

                      <Link to="/my-squad" onClick={() => setUserMenuOpen(false)} className="flex items-center justify-between px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/[0.04] transition-all duration-200">
                        <div className="flex items-center gap-3">
                          <Users className="w-4 h-4" />
                          <span>{language === 'fr' ? 'Mon Escouade' : 'My Squad'}</span>
                        </div>
                        {squadRequestsCount > 0 && (
                          <span className={`px-1.5 py-0.5 text-[10px] font-bold text-white rounded-full ${isHardcore ? 'bg-neon-red' : 'bg-accent-500'}`}>{squadRequestsCount}</span>
                        )}
                      </Link>

                      <Link to="/my-purchases" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/[0.04] transition-all duration-200">
                        <ShoppingBag className="w-4 h-4" />
                        <span>{language === 'fr' ? 'Mes Achats' : 'My Purchases'}</span>
                      </Link>

                      {hasAdminAccess() && (
                        <Link to="/admin" onClick={() => setUserMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2 text-sm transition-all duration-200 ${isArbitre() && !isStaff() ? 'text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/5' : 'text-purple-400 hover:text-purple-300 hover:bg-purple-500/5'}`}>
                          <Shield className="w-4 h-4" />
                          <span>{isArbitre() && !isStaff() ? 'Panel Arbitre' : 'Admin Panel'}</span>
                        </Link>
                      )}

                      <div className="my-1 border-t border-white/[0.04]" />

                      <button onClick={() => { setUserMenuOpen(false); logout(); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/5 transition-all duration-200">
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
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#5865F2]/15 border border-[#5865F2]/25 text-[#8B9DFF] hover:text-white hover:bg-[#5865F2]/25 font-medium text-[13px] transition-all duration-300"
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
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-all duration-300"
              >
                <img src={currentLanguage.flag} alt={currentLanguage.label} className="w-5 h-3.5 rounded-sm object-cover" />
                <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform duration-300 ${languageMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {languageMenuOpen && (
                <div className="absolute right-0 mt-2 bg-dark-900 border border-white/[0.06] rounded-lg p-1.5 animate-scale-in shadow-2xl shadow-black/60">
                  <div className="flex flex-col gap-0.5">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => { setLanguage(lang.code); setLanguageMenuOpen(false); }}
                        className={`w-9 h-7 rounded-md flex items-center justify-center transition-all duration-200 hover:bg-white/[0.06] p-1.5 ${
                          language === lang.code ? `${isHardcore ? 'bg-neon-red/10 ring-1 ring-neon-red/40' : 'bg-accent-500/10 ring-1 ring-accent-500/40'}` : ''
                        }`}
                      >
                        <img src={lang.flag} alt={lang.label} className="w-full h-full rounded-sm object-cover" />
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
            className="md:hidden p-2 rounded-lg hover:bg-white/[0.05] transition-all duration-300"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-gray-400" /> : <Menu className="w-5 h-5 text-gray-400" />}
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

            {/* Stricker Mode - right below Ranked (mobile) */}
            {(strickerModeEnabled || hasAdminAccess()) && (
              <Link 
                to={`/${selectedMode}/stricker`}
                onClick={() => setMobileMenuOpen(false)} 
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium bg-lime-500/10 border border-lime-500/30 text-lime-400"
              >
                <Target className="w-4 h-4" />
                <span>Mode Stricker</span>
              </Link>
            )}
            
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
        fetch(`${API_URL}/spin/status`, { credentials: 'include' })
          .then(res => res.json())
          .then(data => { if (data.success) setCanSpin(data.canSpin); })
          .catch(() => {});
      }} />
    </nav>
  );
};

export default Navbar;
