import React, { createContext, useContext } from 'react';

// Create the AdminContext
const AdminContext = createContext(null);

// Custom hook to use the admin context
export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};

// Provider component
export const AdminProvider = ({ children, value }) => {
  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
};

export default AdminContext;
