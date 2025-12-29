import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { 
  MessageSquare, Search, Send, ArrowLeft, Loader2, X, 
  Users, Archive, MoreVertical, Ban, AlertCircle, CheckCheck,
  UserPlus, Shield, ImagePlus
} from 'lucide-react';
import { getDefaultAvatar, getAvatarUrl } from '../utils/avatar';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const Messages = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const messagesEndRef = useRef(null);
  
  // States
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState('');
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [searchUsers, setSearchUsers] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef(null);
  const [enlargedImage, setEnlargedImage] = useState(null);
  
  // Translations
  const t = {
    fr: {
      title: 'Messages',
      conversations: 'Conversations',
      noConversations: 'Aucune conversation',
      startConversation: 'Démarrer une conversation',
      searchPlaceholder: 'Rechercher...',
      typeMessage: 'Écrire un message...',
      send: 'Envoyer',
      archive: 'Archiver',
      archived: 'Archivées',
      block: 'Bloquer',
      unblock: 'Débloquer',
      newMessage: 'Nouveau message',
      searchUsers: 'Rechercher un utilisateur...',
      noUsers: 'Aucun utilisateur trouvé',
      selectConversation: 'Sélectionnez une conversation',
      staffBadge: 'Staff',
      you: 'Vous',
      blocked: 'Conversation bloquée',
      unread: 'non lu(s)'
    },
    en: {
      title: 'Messages',
      conversations: 'Conversations',
      noConversations: 'No conversations',
      startConversation: 'Start a conversation',
      searchPlaceholder: 'Search...',
      typeMessage: 'Type a message...',
      send: 'Send',
      archive: 'Archive',
      archived: 'Archived',
      block: 'Block',
      unblock: 'Unblock',
      newMessage: 'New message',
      searchUsers: 'Search for a user...',
      noUsers: 'No users found',
      selectConversation: 'Select a conversation',
      staffBadge: 'Staff',
      you: 'You',
      blocked: 'Conversation blocked',
      unread: 'unread'
    },
    de: {
      title: 'Nachrichten',
      conversations: 'Konversationen',
      noConversations: 'Keine Konversationen',
      startConversation: 'Konversation starten',
      searchPlaceholder: 'Suchen...',
      typeMessage: 'Nachricht schreiben...',
      send: 'Senden',
      archive: 'Archivieren',
      archived: 'Archiviert',
      block: 'Blockieren',
      unblock: 'Entsperren',
      newMessage: 'Neue Nachricht',
      searchUsers: 'Benutzer suchen...',
      noUsers: 'Keine Benutzer gefunden',
      selectConversation: 'Konversation auswählen',
      staffBadge: 'Staff',
      you: 'Du',
      blocked: 'Konversation blockiert',
      unread: 'ungelesen'
    },
    it: {
      title: 'Messaggi',
      conversations: 'Conversazioni',
      noConversations: 'Nessuna conversazione',
      startConversation: 'Inizia una conversazione',
      searchPlaceholder: 'Cerca...',
      typeMessage: 'Scrivi un messaggio...',
      send: 'Invia',
      archive: 'Archivia',
      archived: 'Archiviate',
      block: 'Blocca',
      unblock: 'Sblocca',
      newMessage: 'Nuovo messaggio',
      searchUsers: 'Cerca un utente...',
      noUsers: 'Nessun utente trovato',
      selectConversation: 'Seleziona una conversazione',
      staffBadge: 'Staff',
      you: 'Tu',
      blocked: 'Conversazione bloccata',
      unread: 'non letti'
    }
  };
  
  const txt = t[language] || t.en;
  
  // Fetch conversations
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    fetchConversations();
    
    // Polling for new messages every 10 seconds
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated, showArchived]);
  
  // Auto-scroll to bottom when messages change (within container only)
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);
  
  // Check for targetUser in URL params
  useEffect(() => {
    const targetUserId = searchParams.get('user');
    if (targetUserId) {
      startConversationWith(targetUserId);
    }
  }, [searchParams]);
  
  const fetchConversations = async () => {
    try {
      const response = await fetch(`${API_URL}/messages/conversations?archived=${showArchived}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setConversations(data.conversations);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchMessages = async (conversationId) => {
    setLoadingMessages(true);
    try {
      const response = await fetch(`${API_URL}/messages/conversations/${conversationId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setSelectedConversation(data.conversation);
        setMessages(data.messages);
        // Refresh conversations to update unread counts
        fetchConversations();
        // Dispatch event to update navbar unread count
        window.dispatchEvent(new CustomEvent('messagesRead'));
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };
  
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;
    
    setSending(true);
    try {
      const response = await fetch(`${API_URL}/messages/conversations/${selectedConversation._id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: newMessage.trim() })
      });
      
      const data = await response.json();
      if (data.success) {
        setMessages([...messages, data.message]);
        setNewMessage('');
        fetchConversations();
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };
  
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversation) return;

    // Check file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError(language === 'fr' ? 'Image trop volumineuse (max 5MB)' : 'Image too large (max 5MB)');
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${API_URL}/messages/conversations/${selectedConversation._id}/messages/image`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        setMessages([...messages, data.message]);
        fetchConversations();
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur lors de l\'envoi de l\'image');
    } finally {
      setUploadingImage(false);
      // Reset input
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  };
  
  const startConversationWith = async (targetUserId) => {
    try {
      const response = await fetch(`${API_URL}/messages/conversations/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetUserId })
      });
      
      const data = await response.json();
      if (data.success) {
        setShowNewConversation(false);
        setSearchUsers('');
        setUserResults([]);
        fetchConversations();
        fetchMessages(data.conversation._id);
      }
    } catch (err) {
      console.error('Error starting conversation:', err);
    }
  };
  
  const searchForUsers = async (query) => {
    if (!query.trim()) {
      setUserResults([]);
      return;
    }
    
    setSearchingUsers(true);
    try {
      const response = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}&limit=10`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        // Filter out current user
        setUserResults(data.users.filter(u => u._id !== user.id));
      }
    } catch (err) {
      console.error('Error searching users:', err);
    } finally {
      setSearchingUsers(false);
    }
  };
  
  const archiveConversation = async (conversationId) => {
    try {
      await fetch(`${API_URL}/messages/conversations/${conversationId}/archive`, {
        method: 'POST',
        credentials: 'include'
      });
      fetchConversations();
      if (selectedConversation?._id === conversationId) {
        setSelectedConversation(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Error archiving conversation:', err);
    }
  };
  
  const blockConversation = async (conversationId) => {
    try {
      await fetch(`${API_URL}/messages/conversations/${conversationId}/block`, {
        method: 'POST',
        credentials: 'include'
      });
      fetchMessages(conversationId);
    } catch (err) {
      console.error('Error blocking conversation:', err);
    }
  };
  
  const unblockConversation = async (conversationId) => {
    try {
      await fetch(`${API_URL}/messages/conversations/${conversationId}/unblock`, {
        method: 'POST',
        credentials: 'include'
      });
      fetchMessages(conversationId);
    } catch (err) {
      console.error('Error unblocking conversation:', err);
    }
  };
  
  const getUserAvatarLocal = (participant) => {
    if (participant.avatar) return getAvatarUrl(participant.avatar);
    if (participant.avatarUrl) return getAvatarUrl(participant.avatarUrl);
    if (participant.discordAvatar) return participant.discordAvatar;
    return getDefaultAvatar(participant.username || 'User');
  };
  
  const isStaff = (participant) => {
    return participant.roles?.includes('admin') || participant.roles?.includes('staff');
  };
  
  const isBlocked = selectedConversation?.blockedBy?.length > 0;
  
  // Filter conversations by search
  const filteredConversations = conversations.filter(conv => 
    conv.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div className="min-h-screen bg-dark-950">
      {/* Background */}
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-20"></div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">{txt.title}</h1>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 h-[calc(100vh-140px)] lg:h-[calc(100vh-160px)]">
          {/* Conversations List */}
          <div className={`lg:col-span-1 bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-cyan-500/20 overflow-hidden flex flex-col ${selectedConversation ? 'hidden lg:flex' : ''}`}>
            {/* Header */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-white">{txt.conversations}</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowArchived(!showArchived)}
                    className={`p-2 rounded-lg transition-colors ${
                      showArchived ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                    title={txt.archived}
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowNewConversation(true)}
                    className="p-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg text-white"
                    title={txt.newMessage}
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={txt.searchPlaceholder}
                  className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>
            
            {/* Conversations */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
                </div>
              ) : filteredConversations.length > 0 ? (
                <div className="divide-y divide-white/5">
                  {filteredConversations.map((conv) => (
                    <button
                      key={conv._id}
                      onClick={() => fetchMessages(conv._id)}
                      className={`w-full p-4 text-left hover:bg-white/5 transition-colors ${
                        selectedConversation?._id === conv._id ? 'bg-cyan-500/10' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {conv.participants.length > 0 && (
                            <img
                              src={getUserAvatarLocal(conv.participants[0])}
                              alt=""
                              className="w-12 h-12 rounded-full object-cover bg-dark-800"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = getDefaultAvatar(conv.participants[0]?.username || 'User');
                              }}
                            />
                          )}
                          {conv.isStaffInitiated && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                              <Shield className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-white truncate">{conv.name}</p>
                            {conv.unreadCount > 0 && (
                              <span className="px-2 py-0.5 bg-cyan-500 text-white text-xs font-bold rounded-full">
                                {conv.unreadCount}
                              </span>
                            )}
                          </div>
                          {conv.lastMessage && (
                            <p className="text-gray-400 text-sm truncate">
                              {conv.lastMessage.content}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
                  <p>{txt.noConversations}</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Messages Area */}
          <div className={`lg:col-span-2 bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-cyan-500/20 overflow-hidden flex flex-col ${selectedConversation ? '' : 'hidden lg:flex'}`}>
            {selectedConversation ? (
              <>
                {/* Conversation Header */}
                <div className="p-3 lg:p-4 border-b border-white/10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 lg:gap-3 min-w-0">
                    {/* Back button mobile */}
                    <button
                      onClick={() => setSelectedConversation(null)}
                      className="lg:hidden p-1.5 rounded-lg bg-dark-800 text-gray-400 hover:text-white transition-colors flex-shrink-0"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    {selectedConversation.participants.filter(p => p._id !== user.id).map((p, idx) => (
                      <div key={idx} className="flex items-center gap-2 lg:gap-3 min-w-0">
                        <img
                          src={getUserAvatarLocal(p)}
                          alt=""
                          className="w-8 h-8 lg:w-10 lg:h-10 rounded-full object-cover bg-dark-800 flex-shrink-0"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = getDefaultAvatar(p?.username || 'User');
                          }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <Link 
                              to={`/player/${p.username}`}
                              className="font-semibold text-white hover:text-cyan-400 transition-colors"
                            >
                              {p.username}
                            </Link>
                            {isStaff(p) && (
                              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                                {txt.staffBadge}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {!selectedConversation.isStaffInitiated && (
                      <>
                        <button
                          onClick={() => archiveConversation(selectedConversation._id)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                          title={txt.archive}
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => isBlocked 
                            ? unblockConversation(selectedConversation._id)
                            : blockConversation(selectedConversation._id)
                          }
                          className={`p-2 rounded-lg transition-colors ${
                            isBlocked 
                              ? 'bg-red-500/20 text-red-400' 
                              : 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
                          }`}
                          title={isBlocked ? txt.unblock : txt.block}
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {loadingMessages ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
                    </div>
                  ) : (
                    <>
                      {messages.map((msg, idx) => {
                        const isOwn = msg.sender?._id === user.id;
                        return (
                          <div
                            key={idx}
                            className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`flex gap-3 max-w-[70%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                              <img
                                src={getUserAvatarLocal(msg.sender || {})}
                                alt=""
                                className="w-8 h-8 rounded-full object-cover flex-shrink-0 bg-dark-800"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = getDefaultAvatar(msg.sender?.username || 'User');
                                }}
                              />
                              <div>
                                <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'justify-end' : ''}`}>
                                  {isOwn ? (
                                    <span className="text-xs text-gray-400">{txt.you}</span>
                                  ) : (
                                    <Link 
                                      to={`/player/${msg.sender?.username}`}
                                      className={`text-xs hover:underline ${
                                        isStaff(msg.sender || {}) ? 'text-purple-400' : 'text-gray-400'
                                      }`}
                                    >
                                      {msg.sender?.username}
                                    </Link>
                                  )}
                                  <span className="text-gray-500 text-xs">
                                    {new Date(msg.createdAt).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <div className={`px-4 py-2 rounded-2xl ${
                                  isOwn 
                                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-br-md' 
                                    : 'bg-dark-800 text-gray-200 rounded-bl-md'
                                }`}>
                                  {msg.imageUrl && (
                                    <img 
                                      src={msg.imageUrl} 
                                      alt="Message image" 
                                      className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity mb-1" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEnlargedImage(msg.imageUrl);
                                      }}
                                    />
                                  )}
                                  {msg.content && <p className="break-words">{msg.content}</p>}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>
                
                {/* Input */}
                {isBlocked ? (
                  <div className="p-4 border-t border-white/10 bg-red-500/10">
                    <div className="flex items-center justify-center gap-2 text-red-400">
                      <Ban className="w-4 h-4" />
                      <span>{txt.blocked}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 border-t border-white/10">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        placeholder={txt.typeMessage}
                        className="flex-1 px-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500/50"
                      />
                      <input
                        type="file"
                        ref={imageInputRef}
                        onChange={handleImageUpload}
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="px-4 py-3 bg-dark-800 hover:bg-dark-700 border border-white/10 rounded-xl text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
                        title={language === 'fr' ? 'Envoyer une image' : 'Send an image'}
                      >
                        {uploadingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || sending}
                        className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                      >
                        {sending ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg">{txt.selectConversation}</p>
                <button
                  onClick={() => setShowNewConversation(true)}
                  className="mt-4 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
                >
                  {txt.startConversation}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* New Conversation Modal */}
      {showNewConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-dark-900 rounded-2xl border border-cyan-500/20 p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">{txt.newMessage}</h3>
              <button
                onClick={() => {
                  setShowNewConversation(false);
                  setSearchUsers('');
                  setUserResults([]);
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchUsers}
                onChange={(e) => {
                  setSearchUsers(e.target.value);
                  searchForUsers(e.target.value);
                }}
                placeholder={txt.searchUsers}
                className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500/50"
                autoFocus
              />
            </div>
            
            <div className="max-h-64 overflow-y-auto">
              {searchingUsers ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
                </div>
              ) : userResults.length > 0 ? (
                <div className="space-y-2">
                  {userResults.map((u) => (
                    <button
                      key={u._id}
                      onClick={() => startConversationWith(u._id)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors"
                    >
                      <img
                        src={getAvatarUrl(u.avatar || u.avatarUrl) || u.discordAvatar || getDefaultAvatar(u.username)}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover bg-dark-800"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = getDefaultAvatar(u.username);
                        }}
                      />
                      <div className="text-left">
                        <p className="text-white font-medium">{u.username}</p>
                        {u.activisionId && (
                          <p className="text-gray-400 text-sm">{u.activisionId}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : searchUsers.length > 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>{txt.noUsers}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
      
      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-400">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {enlargedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm cursor-pointer"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <img 
              src={enlargedImage} 
              alt="Enlarged" 
              className="w-full h-full object-contain rounded-lg"
            />
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;


