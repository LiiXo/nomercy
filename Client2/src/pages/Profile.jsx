import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, Navigate } from 'react-router-dom'
import Button from '../components/Button'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { API_URL, UPLOADS_BASE_URL } from '../config'

const Profile = () => {
  const { t } = useLanguage()
  const { user, isAuthenticated, loading, logout, refreshUser, isVip } = useAuth()
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [formData, setFormData] = useState({
    username: '',
    activisionId: '',
    platform: '',
    avatarUrl: ''
  })

  // Initialize form when user data loads
  useState(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        activisionId: user.activisionId || '',
        platform: user.platform || '',
        avatarUrl: ''
      })
    }
  }, [user])

  // Redirect to home if not authenticated
  if (!loading && !isAuthenticated) {
    return <Navigate to="/" replace />
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen pt-24 md:pt-36 pb-24 md:pb-12 px-4 md:px-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">{t('loading')}</p>
        </div>
      </div>
    )
  }

  // Get avatar URL
  const getAvatarUrl = () => {
    if (user?.avatar) {
      if (user.avatar.startsWith('http')) return user.avatar
      return `${UPLOADS_BASE_URL}${user.avatar}`
    }
    if (user?.discordAvatar && user?.discordId) {
      return `https://cdn.discordapp.com/avatars/${user.discordId}/${user.discordAvatar}.png?size=256`
    }
    return '/avatar.jpg'
  }

  // Calculate total XP
  const totalXP = (user?.statsHardcore?.xp || 0) + (user?.statsCdl?.xp || 0) + (user?.stats?.xp || 0)

  // Calculate level from XP (1000 XP per level)
  const level = Math.floor(totalXP / 1000) + 1
  const xpForNextLevel = 1000
  const currentLevelXP = totalXP % 1000
  const xpProgress = (currentLevelXP / xpForNextLevel) * 100

  // Calculate total stats
  const totalWins = (user?.statsHardcore?.wins || 0) + (user?.statsCdl?.wins || 0)
  const totalLosses = (user?.statsHardcore?.losses || 0) + (user?.statsCdl?.losses || 0)
  const totalMatches = totalWins + totalLosses
  const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0

  // Start editing
  const handleEdit = () => {
    setFormData({
      username: user?.username || '',
      activisionId: user?.activisionId || '',
      platform: user?.platform || '',
      avatarUrl: ''
    })
    setIsEditing(true)
  }

  // Save profile changes
  const handleSave = async () => {
    setSaving(true)
    try {
      const updates = {}
      if (formData.username !== user?.username) updates.username = formData.username
      if (formData.activisionId !== user?.activisionId) updates.activisionId = formData.activisionId
      if (formData.platform !== user?.platform) updates.platform = formData.platform
      if (formData.avatarUrl) updates.avatar = formData.avatarUrl

      const response = await fetch(`${API_URL}/users/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates)
      })

      const data = await response.json()
      if (data.success) {
        await refreshUser()
        setIsEditing(false)
      }
    } catch (err) {
      console.error('Error saving profile:', err)
    } finally {
      setSaving(false)
    }
  }

  // Reset stats (keep XP)
  const handleResetStats = async () => {
    setResetting(true)
    try {
      const response = await fetch(`${API_URL}/users/reset-stats`, {
        method: 'POST',
        credentials: 'include'
      })

      const data = await response.json()
      if (data.success) {
        await refreshUser()
        setShowResetConfirm(false)
      }
    } catch (err) {
      console.error('Error resetting stats:', err)
    } finally {
      setResetting(false)
    }
  }

  // Delete account
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return
    
    setDeleting(true)
    try {
      const response = await fetch(`${API_URL}/users/delete-account`, {
        method: 'DELETE',
        credentials: 'include'
      })

      const data = await response.json()
      if (data.success) {
        logout()
      }
    } catch (err) {
      console.error('Error deleting account:', err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen pt-24 md:pt-36 pb-24 md:pb-12 px-4 md:px-6">
      <div className="max-w-2xl mx-auto">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass rounded-2xl p-6 md:p-8 mb-6"
        >
          {/* Avatar & Basic Info */}
          <div className="flex flex-col items-center text-center mb-6">
            {/* Avatar */}
            <div className="relative mb-4">
              <div className="w-28 h-28 md:w-36 md:h-36 rounded-full border-4 border-accent-primary/30 overflow-hidden bg-dark-800 shadow-lg shadow-accent-primary/20">
                <img 
                  src={getAvatarUrl()} 
                  alt={user?.username || 'Avatar'}
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Level badge */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-accent-primary to-fire-600 rounded-full">
                <span className="text-white text-sm font-bold">Nv. {level}</span>
              </div>
            </div>

            {/* Username & Info */}
            <h1 className="text-2xl md:text-3xl font-bold text-white mt-2">
              {user?.username || user?.discordUsername}
            </h1>
            {user?.activisionId && (
              <p className="text-accent-primary text-sm md:text-base mt-1">
                {user.activisionId}
              </p>
            )}
            {user?.platform && (
              <p className="text-gray-400 text-sm mt-1">
                {user.platform}
              </p>
            )}
          </div>

          {/* Level Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">{t('level')} {level}</span>
              <span className="text-accent-primary">{currentLevelXP} / {xpForNextLevel} XP</span>
            </div>
            <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress}%` }}
                transition={{ delay: 0.3, duration: 1 }}
                className="h-full bg-gradient-to-r from-accent-primary to-fire-600 rounded-full"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1 text-center">
              {totalXP.toLocaleString()} XP {t('total')}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-center">
            {!isEditing ? (
              <>
                <Button variant="primary" size="sm" onClick={handleEdit}>
                  {t('editProfile')}
                </Button>
                <button
                  onClick={() => isVip() ? setShowResetConfirm(true) : null}
                  disabled={!isVip()}
                  className={`relative px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                    isVip()
                      ? 'bg-dark-600 hover:bg-dark-500 text-white'
                      : 'bg-dark-700 text-gray-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  {t('resetStats')}
                  <span className="absolute -top-2 -right-2 px-1.5 py-0.5 text-[10px] bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold rounded-full">
                    VIP
                  </span>
                </button>
                <Button variant="secondary" size="sm" onClick={logout}>
                  {t('logout')}
                </Button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition-all border border-red-500/30"
                >
                  {t('deleteAccount')}
                </button>
              </>
            ) : (
              <>
                <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? t('saving') : t('save')}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
                  {t('cancel')}
                </Button>
              </>
            )}
          </div>
        </motion.div>

        {/* Reset Stats Confirmation Dialog */}
        <AnimatePresence>
          {showResetConfirm && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowResetConfirm(false)}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="glass-orange rounded-2xl p-6 max-w-sm w-full border border-red-500/30"
                >
                  <div className="text-center">
                    <div className="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">⚠️</span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{t('resetStatsTitle')}</h3>
                    <p className="text-sm text-gray-400 mb-6">{t('resetStatsDesc')}</p>
                    <div className="flex gap-3">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => setShowResetConfirm(false)}
                      >
                        {t('cancel')}
                      </Button>
                      <button
                        onClick={handleResetStats}
                        disabled={resetting}
                        className="flex-1 py-2 px-4 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                      >
                        {resetting ? t('resetting') : t('confirmReset')}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>

        {/* Delete Account Confirmation Dialog */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="glass-orange rounded-2xl p-6 max-w-sm w-full border border-red-500/30"
                >
                  <div className="text-center">
                    <div className="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">🗑️</span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{t('deleteAccountTitle')}</h3>
                    <p className="text-sm text-gray-400 mb-4">{t('deleteAccountDesc')}</p>
                    
                    <p className="text-xs text-red-400 mb-2">{t('typeDeleteConfirm')}</p>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="DELETE"
                      className="w-full px-4 py-2 bg-dark-800 border border-red-500/30 rounded-xl text-white text-center text-sm focus:outline-none focus:border-red-500/50 mb-4"
                    />
                    
                    <div className="flex gap-3">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}
                      >
                        {t('cancel')}
                      </Button>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleting || deleteConfirmText !== 'DELETE'}
                        className="flex-1 py-2 px-4 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
                      >
                        {deleting ? t('deleting') : t('confirmDelete')}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>

        {/* Edit Form */}
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-6 mb-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">{t('editProfile')}</h3>
            
            <div className="space-y-4">
              {/* Avatar URL */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t('avatarUrl')}</label>
                <input
                  type="text"
                  value={formData.avatarUrl}
                  onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-accent-primary/50"
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t('username')}</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder={t('username')}
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-accent-primary/50"
                />
              </div>

              {/* Activision ID */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Activision ID</label>
                <input
                  type="text"
                  value={formData.activisionId}
                  onChange={(e) => setFormData({ ...formData, activisionId: e.target.value })}
                  placeholder="Player#1234567"
                  className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-accent-primary/50"
                />
              </div>

              {/* Platform */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t('platform')}</label>
                <div className="grid grid-cols-3 gap-3">
                  {['PC', 'PlayStation', 'Xbox'].map((platform) => (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => setFormData({ ...formData, platform })}
                      className={`py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
                        formData.platform === platform
                          ? 'bg-accent-primary/20 border-accent-primary text-accent-primary'
                          : 'bg-dark-800 border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      {platform === 'PC' ? '🖥️' : '🎮'} {platform}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
        >
          {[
            { label: t('matches'), value: totalMatches, icon: '🎮' },
            { label: t('victories'), value: totalWins, icon: '🏆' },
            { label: t('defeats'), value: totalLosses, icon: '💀' },
            { label: t('winRate'), value: `${winRate}%`, icon: '📊' }
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + index * 0.1, duration: 0.3 }}
              className="glass rounded-xl p-4 text-center"
            >
              <span className="text-2xl mb-2 block">{stat.icon}</span>
              <p className="text-xl md:text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-gray-400">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Back to Lobby */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-center"
        >
          <Link to="/">
            <Button variant="secondary">
              {t('backToLobby')}
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  )
}

export default Profile
