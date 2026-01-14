import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const DataContext = createContext(null);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

export const DataProvider = ({ children }) => {
  // App settings (shared across all pages)
  const [appSettings, setAppSettings] = useState(null);
  const [appSettingsLoading, setAppSettingsLoading] = useState(true);
  
  // Ladder rewards (shared)
  const [ladderRewards, setLadderRewards] = useState({
    chill: { playerCoinsWin: 40 },
    competitive: { playerCoinsWin: 60 }
  });
  
  // Note: topPlayer and topSquad are now fetched locally in each dashboard
  // with the appropriate mode (hardcore or cdl) to keep stats separate
  
  // Cache timestamps for smart refetching
  const [lastFetchTimes, setLastFetchTimes] = useState({
    appSettings: 0,
    ladderRewards: 0
  });
  
  // Cache duration in ms (5 minutes for most data)
  const CACHE_DURATION = 5 * 60 * 1000;
  
  // Fetch app settings with caching
  const fetchAppSettings = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && appSettings && (now - lastFetchTimes.appSettings) < CACHE_DURATION) {
      return appSettings;
    }
    
    try {
      const response = await fetch(`${API_URL}/app-settings/public`);
      const data = await response.json();
      if (data.success) {
        setAppSettings(data);
        setLastFetchTimes(prev => ({ ...prev, appSettings: now }));
        return data;
      }
    } catch (err) {
      console.error('Error fetching app settings:', err);
    } finally {
      setAppSettingsLoading(false);
    }
    return null;
  }, [appSettings, lastFetchTimes.appSettings]);
  
  // Fetch ladder rewards with caching
  const fetchLadderRewards = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && (now - lastFetchTimes.ladderRewards) < CACHE_DURATION) {
      return ladderRewards;
    }
    
    try {
      const [chillRes, compRes] = await Promise.all([
        fetch(`${API_URL}/config/rewards/squad?ladderId=duo-trio`),
        fetch(`${API_URL}/config/rewards/squad?ladderId=squad-team`)
      ]);
      const [chillData, compData] = await Promise.all([chillRes.json(), compRes.json()]);
      
      if (chillData.success && compData.success) {
        const rewards = {
          chill: chillData.rewards,
          competitive: compData.rewards
        };
        setLadderRewards(rewards);
        setLastFetchTimes(prev => ({ ...prev, ladderRewards: now }));
        return rewards;
      }
    } catch (err) {
      console.error('Error fetching ladder rewards:', err);
    }
    return ladderRewards;
  }, [ladderRewards, lastFetchTimes.ladderRewards]);
  
  // Initial fetch on mount
  useEffect(() => {
    const initFetch = async () => {
      await Promise.all([
        fetchAppSettings(),
        fetchLadderRewards()
      ]);
    };
    initFetch();
  }, []);
  
  // Track current time for duo-trio open status (updates every minute)
  const [currentMinute, setCurrentMinute] = useState(Date.now());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMinute(Date.now());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);
  
  // Check if duo-trio is currently open
  const isDuoTrioOpen = useMemo(() => {
    if (!appSettings?.ladderSettings) return true;
    if (appSettings.ladderSettings.duoTrioTimeRestriction?.enabled === false) {
      return true;
    }
    const parisHour = parseInt(new Date().toLocaleString('en-US', { 
      timeZone: 'Europe/Paris', 
      hour: 'numeric', 
      hour12: false 
    }));
    const startHour = appSettings.ladderSettings.duoTrioTimeRestriction?.startHour ?? 0;
    const endHour = appSettings.ladderSettings.duoTrioTimeRestriction?.endHour ?? 20;
    return parisHour >= startHour && parisHour < endHour;
  }, [appSettings, currentMinute]);
  
  // Get gold coins for a ladder type
  const getGoldCoinsForLadder = useCallback((ladderId) => {
    if (ladderId === 'squad-team') {
      return ladderRewards.competitive?.playerCoinsWin || 60;
    }
    return ladderRewards.chill?.playerCoinsWin || 40;
  }, [ladderRewards]);
  
  const value = useMemo(() => ({
    // App settings
    appSettings,
    appSettingsLoading,
    fetchAppSettings,
    
    // Ladder rewards
    ladderRewards,
    fetchLadderRewards,
    getGoldCoinsForLadder,
    
    // Computed values
    isDuoTrioOpen,
  }), [
    appSettings, 
    appSettingsLoading, 
    fetchAppSettings,
    ladderRewards, 
    fetchLadderRewards, 
    getGoldCoinsForLadder,
    isDuoTrioOpen
  ]);
  
  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

export default DataContext;

