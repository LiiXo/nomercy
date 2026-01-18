import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const API_URL = 'https://api-nomercy.ggsecure.io/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [banInfo, setBanInfo] = useState(null);

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/status`, {
        credentials: 'include'
      });
      const data = await response.json();

      if (data.success && data.isAuthenticated) {
        // Check if user is banned
        if (data.user?.isBanned) {
          // User is banned, logout and store ban info
          setBanInfo({
            reason: data.user.banReason,
            expiresAt: data.user.banExpiresAt
          });
          setUser(null);
          await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
          });
        } else {
          setUser(data.user);
          setBanInfo(null);
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = () => {
    // Redirect to Discord OAuth
    window.location.href = `${API_URL}/auth/discord`;
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
      window.location.href = '/';
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const setupProfile = async (username, bio, platform, activisionId) => {
    try {
      setError(null);
      const response = await fetch(`${API_URL}/users/setup-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ username, bio, platform, activisionId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Profile setup failed');
      }

      setUser(data.user);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const updateProfile = async (updates) => {
    try {
      setError(null);
      const response = await fetch(`${API_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(updates)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Profile update failed');
      }

      setUser(data.user);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const checkUsername = async (username) => {
    try {
      const response = await fetch(`${API_URL}/users/check-username/${encodeURIComponent(username)}`, {
        credentials: 'include'
      });
      return await response.json();
    } catch (err) {
      return { available: false, message: 'Error checking username' };
    }
  };

  const refreshUser = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        credentials: 'include'
      });
      const data = await response.json();

      if (data.success) {
        setUser(data.user);
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  // Check if user has a specific role
  const hasRole = (role) => {
    return user?.roles?.includes(role) || false;
  };

  // Check if user is admin
  const isAdmin = () => hasRole('admin');

  // Check if user is staff (admin or staff)
  const isStaff = () => hasRole('admin') || hasRole('staff');

  // Check if user is arbitre (referee)
  const isArbitre = () => hasRole('arbitre');

  // Check if user has admin panel access (admin, staff, or arbitre)
  const hasAdminAccess = () => hasRole('admin') || hasRole('staff') || hasRole('arbitre');

  // Check if user is CDL manager
  const isCDLManager = () => hasRole('admin') || hasRole('gerant_cdl');

  // Check if user is Hardcore manager
  const isHardcoreManager = () => hasRole('admin') || hasRole('gerant_hardcore');

  const clearBanInfo = () => {
    setBanInfo(null);
  };

  const value = {
    user,
    loading,
    error,
    setError,
    banInfo,
    clearBanInfo,
    isAuthenticated: !!user,
    isProfileComplete: user?.isProfileComplete || false,
    login,
    logout,
    setupProfile,
    updateProfile,
    checkUsername,
    refreshUser,
    hasRole,
    isAdmin,
    isStaff,
    isArbitre,
    hasAdminAccess,
    isCDLManager,
    isHardcoreManager
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

