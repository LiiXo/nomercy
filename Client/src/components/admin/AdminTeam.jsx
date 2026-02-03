import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Trash2, Edit2, Save, X, Crown, Star, Shield, Gavel,
  GripVertical, ChevronDown, Loader2, AlertCircle, CheckCircle, Eye, EyeOff, Search
} from 'lucide-react';

import { API_URL } from '../../config';

const AdminTeam = () => {
  const [members, setMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // User search
  const [userSearch, setUserSearch] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  
  // Edit/Add dialog
  const [showDialog, setShowDialog] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [formData, setFormData] = useState({
    userId: null,
    name: '',
    role: '',
    description: '',
    avatar: '',
    discordUsername: '',
    category: 'other',
    order: 0,
    isActive: true
  });

  const categories = [
    { value: 'direction', label: 'Direction', icon: Crown, color: 'text-amber-500' },
    { value: 'staff', label: 'Staff', icon: Star, color: 'text-purple-500' },
    { value: 'arbitre', label: 'Arbitre', icon: Gavel, color: 'text-orange-500' },
    { value: 'moderator', label: 'Modérateur', icon: Shield, color: 'text-blue-500' },
    { value: 'other', label: 'Autre', icon: Users, color: 'text-gray-500' }
  ];

  useEffect(() => {
    fetchMembers();
    fetchUsers();
  }, []);

  const fetchMembers = async () => {
    try {
      const response = await fetch(`${API_URL}/team/admin/all`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setMembers(data.members);
        setError(null);
      } else {
        setError(data.message || 'Erreur lors du chargement.');
      }
    } catch (err) {
      console.error('Fetch members error:', err);
      setError('Erreur lors du chargement des membres.');
    }
    setLoading(false);
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/users/admin/all?limit=500`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success && data.users) {
        // Debug: log first user to see available fields
        if (data.users.length > 0) {
          console.log('[AdminTeam] Sample user data:', {
            avatar: data.users[0].avatar,
            avatarUrl: data.users[0].avatarUrl,
            discordId: data.users[0].discordId,
            discordAvatar: data.users[0].discordAvatar
          });
        }
        setAllUsers(data.users);
      }
    } catch (err) {
      console.error('Fetch users error:', err);
    }
  };

  const openAddDialog = () => {
    setEditingMember(null);
    setUserSearch('');
    setFormData({
      userId: null,
      name: '',
      role: '',
      description: '',
      avatar: '',
      discordUsername: '',
      category: 'other',
      order: members.length,
      isActive: true
    });
    setShowDialog(true);
  };

  const openEditDialog = (member) => {
    setEditingMember(member);
    setUserSearch(member.name || '');
    setFormData({
      userId: member.userId || null,
      name: member.name || '',
      role: member.role || '',
      description: member.description || '',
      avatar: member.avatar || '',
      discordUsername: member.discordUsername || '',
      category: member.category || 'other',
      order: member.order || 0,
      isActive: member.isActive !== false
    });
    setShowDialog(true);
  };

  const selectUser = (user) => {
    // Debug log
    console.log('[AdminTeam] Selected user:', {
      id: user._id,
      username: user.username,
      avatar: user.avatar,
      avatarUrl: user.avatarUrl,
      discordId: user.discordId,
      discordAvatar: user.discordAvatar
    });
    
    // Use avatarUrl which is computed on the server (handles Discord avatar)
    const avatarUrl = user.avatarUrl || user.avatar || 
      (user.discordAvatar && user.discordId 
        ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.discordAvatar}.png` 
        : '');
    
    console.log('[AdminTeam] Using avatar URL:', avatarUrl);
    
    setFormData({
      ...formData,
      userId: user._id,
      name: user.username || user.discordUsername || '',
      avatar: avatarUrl,
      discordUsername: user.discordUsername || ''
    });
    setUserSearch(user.username || user.discordUsername || '');
    setShowUserDropdown(false);
  };

  const filteredUsers = allUsers.filter(user => {
    const search = userSearch.toLowerCase();
    const username = (user.username || '').toLowerCase();
    const discordName = (user.discordUsername || '').toLowerCase();
    return username.includes(search) || discordName.includes(search);
  }).slice(0, 10);

  const handleSave = async () => {
    if (!formData.name || !formData.role) {
      setError('Utilisateur et rôle sont requis.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = editingMember 
        ? `${API_URL}/team/admin/${editingMember._id}`
        : `${API_URL}/team/admin`;
      
      const response = await fetch(url, {
        method: editingMember ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(editingMember ? 'Membre mis à jour.' : 'Membre ajouté.');
        setShowDialog(false);
        fetchMembers();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.message || 'Erreur lors de la sauvegarde.');
      }
    } catch (err) {
      console.error('Save error:', err);
      setError('Erreur lors de la sauvegarde.');
    }
    setSaving(false);
  };

  const handleDelete = async (memberId) => {
    if (!window.confirm('Supprimer ce membre ?')) return;

    try {
      const response = await fetch(`${API_URL}/team/admin/${memberId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess('Membre supprimé.');
        fetchMembers();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.message || 'Erreur lors de la suppression.');
      }
    } catch (err) {
      console.error('Delete error:', err);
      setError('Erreur lors de la suppression.');
    }
  };

  const toggleActive = async (member) => {
    try {
      const response = await fetch(`${API_URL}/team/admin/${member._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !member.isActive })
      });

      const data = await response.json();
      
      if (data.success) {
        fetchMembers();
      }
    } catch (err) {
      setError('Erreur lors de la mise à jour.');
    }
  };

  const getCategoryInfo = (categoryValue) => {
    return categories.find(c => c.value === categoryValue) || categories[4];
  };

  // Group members by category
  const groupedMembers = categories.reduce((acc, cat) => {
    acc[cat.value] = members.filter(m => m.category === cat.value);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" />
            Gestion de l'Équipe
          </h2>
          <p className="text-gray-400 text-sm">{members.length} membre(s)</p>
        </div>
        <button
          onClick={openAddDialog}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Ajouter un membre
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-500/20 border border-green-500/30 rounded-xl text-green-400">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      {/* Members by Category */}
      {categories.map(cat => {
        const categoryMembers = groupedMembers[cat.value];
        if (!categoryMembers || categoryMembers.length === 0) return null;

        const CategoryIcon = cat.icon;
        
        return (
          <div key={cat.value} className="bg-dark-800/50 rounded-xl border border-white/10 overflow-hidden">
            {/* Category Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-dark-700/50">
              <CategoryIcon className={`w-5 h-5 ${cat.color}`} />
              <span className="font-semibold text-white">{cat.label}</span>
              <span className="text-gray-500 text-sm">({categoryMembers.length})</span>
            </div>
            
            {/* Members */}
            <div className="divide-y divide-white/5">
              {categoryMembers.map(member => (
                <div 
                  key={member._id}
                  className={`flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition-colors ${!member.isActive ? 'opacity-50' : ''}`}
                >
                  {/* Avatar */}
                  {member.avatar ? (
                    <img 
                      src={member.avatar} 
                      alt={member.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className={`w-10 h-10 rounded-full ${cat.color.replace('text-', 'bg-')}/20 flex items-center justify-center`}>
                      <span className={`font-bold ${cat.color}`}>
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate">{member.name}</span>
                      {!member.isActive && (
                        <span className="px-2 py-0.5 text-xs bg-gray-500/20 text-gray-400 rounded">Inactif</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 truncate">{member.role}</p>
                  </div>
                  
                  {/* Discord */}
                  {member.discordUsername && (
                    <span className="text-xs text-gray-500 hidden md:block">@{member.discordUsername}</span>
                  )}
                  
                  {/* Order */}
                  <span className="text-xs text-gray-600 w-8 text-center">#{member.order}</span>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleActive(member)}
                      className={`p-2 rounded-lg transition-colors ${member.isActive ? 'hover:bg-amber-500/20 text-amber-500' : 'hover:bg-green-500/20 text-green-500'}`}
                      title={member.isActive ? 'Désactiver' : 'Activer'}
                    >
                      {member.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => openEditDialog(member)}
                      className="p-2 hover:bg-blue-500/20 text-blue-500 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(member._id)}
                      className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Empty State */}
      {members.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Aucun membre dans l'équipe.</p>
          <button
            onClick={openAddDialog}
            className="mt-4 text-purple-400 hover:text-purple-300 text-sm"
          >
            Ajouter le premier membre
          </button>
        </div>
      )}

      {/* Add/Edit Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-dark-800 rounded-2xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Dialog Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-bold text-white">
                {editingMember ? 'Modifier le membre' : 'Ajouter un membre'}
              </h3>
              <button 
                onClick={() => setShowDialog(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Dialog Content */}
            <div className="p-4 space-y-4">
              {/* User Selection */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-300 mb-1">Utilisateur *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setShowUserDropdown(true);
                    }}
                    onFocus={() => setShowUserDropdown(true)}
                    className="w-full pl-10 pr-3 py-2 bg-dark-700 border border-white/10 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                    placeholder="Rechercher un utilisateur..."
                  />
                </div>
                
                {/* User Dropdown */}
                {showUserDropdown && filteredUsers.length > 0 && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowUserDropdown(false)}
                    />
                    <div className="absolute z-50 w-full mt-1 bg-dark-700 border border-white/10 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                    {filteredUsers.map(user => {
                      // Use avatarUrl (computed on server) or build from Discord data
                      const displayAvatar = user.avatarUrl || user.avatar ||
                        (user.discordAvatar && user.discordId 
                          ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.discordAvatar}.png` 
                          : null);
                      
                      return (
                        <button
                          key={user._id}
                          onClick={() => selectUser(user)}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/10 transition-colors text-left"
                        >
                          {displayAvatar ? (
                            <img src={displayAvatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                              <span className="text-purple-400 text-sm font-bold">
                                {(user.username || user.discordUsername || '?').charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm truncate">{user.username || user.discordUsername}</p>
                          {user.discordUsername && user.username !== user.discordUsername && (
                            <p className="text-gray-500 text-xs truncate">@{user.discordUsername}</p>
                          )}
                        </div>
                      </button>
                      );
                    })}
                    </div>
                  </>
                )}
                
                {/* Selected User Info */}
                {formData.name && (
                  <div className="mt-2 flex items-center gap-2 p-2 bg-purple-500/20 border border-purple-500/30 rounded-lg">
                    {formData.avatar ? (
                      <img src={formData.avatar} alt="" className="w-6 h-6 rounded-full" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center">
                        <span className="text-purple-400 text-xs">{formData.name.charAt(0)}</span>
                      </div>
                    )}
                    <span className="text-purple-300 text-sm">{formData.name}</span>
                    <button
                      onClick={() => {
                        setFormData({ ...formData, userId: null, name: '', avatar: '', discordUsername: '' });
                        setUserSearch('');
                      }}
                      className="ml-auto p-1 hover:bg-white/10 rounded"
                    >
                      <X className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>
                )}
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Rôle *</label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                  placeholder="Ex: Community Manager, Fondateur, Arbitre..."
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Catégorie</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-xl text-white focus:border-purple-500 focus:outline-none resize-none"
                  placeholder="Courte description..."
                />
              </div>

              {/* Order */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Ordre d'affichage</label>
                <input
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                  min="0"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Visible publiquement</span>
                <button
                  onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${formData.isActive ? 'bg-purple-600' : 'bg-dark-600'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.isActive ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>

            {/* Dialog Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
              <button
                onClick={() => setShowDialog(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl transition-colors"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {editingMember ? 'Mettre à jour' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTeam;
