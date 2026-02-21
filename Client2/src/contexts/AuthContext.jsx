import { createContext, useContext, useState, useEffect } from 'react'
import { API_URL } from '../config'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Check authentication status on mount
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/status`, {
        credentials: 'include'
      })
      const data = await response.json()

      if (data.success && data.isAuthenticated) {
        if (data.user?.isBanned) {
          setUser(null)
          await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
          })
        } else {
          setUser(data.user)
        }
      } else {
        setUser(null)
      }
    } catch (err) {
      console.error('Auth check failed:', err)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const login = () => {
    // Redirect to Discord OAuth
    window.location.href = `${API_URL}/auth/discord`
  }

  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      })
      setUser(null)
      window.location.href = '/'
    } catch (err) {
      console.error('Logout failed:', err)
    }
  }

  const refreshUser = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        credentials: 'include'
      })
      const data = await response.json()
      if (data.success) {
        setUser(data.user)
      }
    } catch (err) {
      console.error('Failed to refresh user:', err)
    }
  }

  // Helper functions for roles
  const hasRole = (role) => user?.roles?.includes(role) || false
  const isAdmin = () => hasRole('admin')
  const isStaff = () => hasRole('admin') || hasRole('staff')
  const isVip = () => hasRole('vip')  // VIP only, admin doesn't count

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading,
      isAuthenticated: !!user,
      isProfileComplete: user?.isProfileComplete || false,
      login, 
      logout,
      refreshUser,
      hasRole,
      isAdmin,
      isStaff,
      isVip
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
