import React, { createContext, useContext, useState, useEffect } from 'react';

const ModeContext = createContext();

export const useMode = () => {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
};

export const ModeProvider = ({ children }) => {
  // Récupérer le mode depuis localStorage au démarrage
  const [selectedMode, setSelectedMode] = useState(() => {
    const saved = localStorage.getItem('selectedMode');
    return saved || null;
  });

  // Sauvegarder le mode dans localStorage quand il change
  useEffect(() => {
    if (selectedMode) {
      localStorage.setItem('selectedMode', selectedMode);
    }
  }, [selectedMode]);

  const selectMode = (mode) => {
    setSelectedMode(mode);
    localStorage.setItem('selectedMode', mode);
  };

  const resetMode = () => {
    setSelectedMode(null);
    localStorage.removeItem('selectedMode');
  };

  return (
    <ModeContext.Provider value={{ selectedMode, selectMode, resetMode }}>
      {children}
    </ModeContext.Provider>
  );
};
