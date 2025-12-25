import React, { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { getDefaultAvatar } from '../utils/avatar';
import { 
  Coins, 
  Crown, 
  Sparkles, 
  Image, 
  MessageSquare, 
  Flame,
  Star,
  Shield,
  Zap,
  Trophy,
  Target,
  Skull,
  Heart,
  Diamond,
  Award,
  CheckCircle,
  RefreshCw,
  Wrench,
  Package,
  Loader2,
  ShoppingBag,
  Gift,
  Eye,
  X,
  CircleDot
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const Shop = () => {
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const { user, isAuthenticated, refreshUser } = useAuth();
  const [activeCategory, setActiveCategory] = useState('all');
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [previewItem, setPreviewItem] = useState(null);

  const isHardcore = selectedMode === 'hardcore';
  
  const colors = {
    primary: isHardcore ? 'red' : 'cyan',
    gradient: isHardcore ? 'from-red-500 to-orange-500' : 'from-cyan-500 to-blue-500',
    glow: isHardcore ? 'shadow-red-500/30' : 'shadow-cyan-500/30',
    border: isHardcore ? 'border-red-500/30' : 'border-cyan-500/30',
    text: isHardcore ? 'text-red-400' : 'text-cyan-400',
    bg: isHardcore ? 'bg-red-500/10' : 'bg-cyan-500/10',
  };

  const pageTitle = {
    fr: 'Boutique',
    en: 'Shop',
    it: 'Negozio',
    de: 'Shop',
  };

  const pageSubtitle = {
    fr: 'Personnalise ton profil avec des objets exclusifs',
    en: 'Customize your profile with exclusive items',
    it: 'Personalizza il tuo profilo con oggetti esclusivi',
    de: 'Personalisiere dein Profil mit exklusiven Gegenständen',
  };

  // Icon mapping
  const iconMap = {
    Flame, Star, Shield, Zap, Skull, Diamond, Target, Trophy, Heart, 
    Crown, Award, Sparkles, RefreshCw, Package, Gift
  };

  const categories = [
    { id: 'all', icon: ShoppingBag, label: { fr: 'Tout', en: 'All', it: 'Tutto', de: 'Alles' } },
    { id: 'ornament', icon: CircleDot, label: { fr: 'Ornements', en: 'Ornaments', it: 'Ornamenti', de: 'Ornamente' } },
    { id: 'avatar_frame', icon: Crown, label: { fr: 'Cadres', en: 'Frames', it: 'Cornici', de: 'Rahmen' } },
    { id: 'title', icon: Star, label: { fr: 'Titres', en: 'Titles', it: 'Titoli', de: 'Titel' } },
    { id: 'badge', icon: Award, label: { fr: 'Badges', en: 'Badges', it: 'Badge', de: 'Abzeichen' } },
    { id: 'emote', icon: MessageSquare, label: { fr: 'Emotes', en: 'Emotes', it: 'Emote', de: 'Emotes' } },
    { id: 'boost', icon: Zap, label: { fr: 'Boosts', en: 'Boosts', it: 'Boost', de: 'Boosts' } },
    { id: 'cosmetic', icon: Sparkles, label: { fr: 'Cosmétiques', en: 'Cosmetics', it: 'Cosmetici', de: 'Kosmetik' } },
    { id: 'other', icon: Package, label: { fr: 'Services', en: 'Services', it: 'Servizi', de: 'Dienste' } },
  ];

  const previewLabel = {
    fr: 'Aperçu',
    en: 'Preview',
    it: 'Anteprima',
    de: 'Vorschau',
  };

  const buyLabel = {
    fr: 'Acheter',
    en: 'Buy',
    it: 'Acquista',
    de: 'Kaufen',
  };

  const ownedLabel = {
    fr: 'Possédé',
    en: 'Owned',
    it: 'Posseduto',
    de: 'Besitzt',
  };

  const rarityColors = {
    common: { bg: 'bg-gray-500/20', border: 'border-gray-500/40', text: 'text-gray-400', label: { fr: 'Commun', en: 'Common', it: 'Comune', de: 'Gewöhnlich' } },
    rare: { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-400', label: { fr: 'Rare', en: 'Rare', it: 'Raro', de: 'Selten' } },
    epic: { bg: 'bg-purple-500/20', border: 'border-purple-500/40', text: 'text-purple-400', label: { fr: 'Épique', en: 'Epic', it: 'Epico', de: 'Episch' } },
    legendary: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-400', label: { fr: 'Légendaire', en: 'Legendary', it: 'Leggendario', de: 'Legendär' } },
  };

  // Set page title
  useEffect(() => {
    const titles = {
      fr: 'NoMercy - Boutique',
      en: 'NoMercy - Shop',
      it: 'NoMercy - Negozio',
      de: 'NoMercy - Shop',
    };
    document.title = titles[language] || titles.en;
  }, [language]);

  // Fetch items from API
  useEffect(() => {
    fetchItems();
    if (isAuthenticated) {
      fetchPurchases();
    }
  }, [selectedMode, isAuthenticated]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/shop/items?mode=${selectedMode}`, {
        credentials: 'include' // Send cookies for auth
      });
      const data = await response.json();
      if (data.success) {
        setItems(data.items);
      }
    } catch (err) {
      console.error('Error fetching items:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchases = async () => {
    try {
      const response = await fetch(`${API_URL}/shop/my-purchases`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setPurchases(data.purchases);
      }
    } catch (err) {
      console.error('Error fetching purchases:', err);
    }
  };

  const handlePurchase = async (item) => {
    if (!isAuthenticated) {
      setMessage({ type: 'error', text: language === 'fr' ? 'Connecte-toi pour acheter' : 'Login to purchase' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      return;
    }

    if (user.goldCoins < item.price) {
      setMessage({ type: 'error', text: language === 'fr' ? 'Pas assez de gold coins' : 'Not enough gold coins' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      return;
    }

    setPurchasing(item._id);
    try {
      const response = await fetch(`${API_URL}/shop/purchase/${item._id}`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: language === 'fr' ? 'Achat réussi !' : 'Purchase successful!' });
        refreshUser();
        fetchPurchases();
        fetchItems(); // Refresh items to update owned quantity
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error processing purchase' });
    } finally {
      setPurchasing(null);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const isOwned = (itemId) => {
    return purchases.some(p => p.item?._id === itemId || p.item === itemId);
  };

  const getItemIcon = (iconName) => {
    return iconMap[iconName] || Package;
  };

  const filteredItems = activeCategory === 'all' 
    ? items 
    : items.filter(item => item.category === activeCategory);

  const userCoins = user?.goldCoins || 0;

  return (
    <div className="min-h-screen bg-dark-950 relative overflow-hidden">
      {/* Coming Soon Overlay */}
      <div className="absolute inset-0 z-50 bg-dark-950/95 backdrop-blur-md flex items-center justify-center">
        <div className="text-center max-w-lg mx-auto px-6">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/50 flex items-center justify-center animate-pulse">
            <ShoppingBag className="w-12 h-12 text-yellow-400" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {language === 'fr' ? 'Bientôt disponible' : language === 'de' ? 'Bald verfügbar' : language === 'it' ? 'Prossimamente' : 'Coming Soon'}
          </h2>
          <p className="text-gray-400 text-lg">
            {language === 'fr' 
              ? 'La boutique arrive bientôt ! Préparez vos gold coins pour des objets exclusifs.'
              : language === 'de'
                ? 'Der Shop kommt bald! Bereiten Sie Ihre Gold Coins für exklusive Gegenstände vor.'
                : language === 'it'
                  ? 'Il negozio arriva presto! Prepara le tue Gold Coins per oggetti esclusivi.'
                  : 'The shop is coming soon! Get your gold coins ready for exclusive items.'}
          </p>
        </div>
      </div>

      {/* Background Effects */}
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-20"></div>
      {isHardcore ? (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(239, 68, 68, 0.1) 0%, transparent 50%)' }}></div>
      ) : (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(6, 182, 212, 0.1) 0%, transparent 50%)' }}></div>
      )}

      <div className="relative z-10 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header avec solde */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
            <div className="text-center md:text-left mb-4 md:mb-0">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{pageTitle[language]}</h1>
              <p className="text-gray-400">{pageSubtitle[language]}</p>
            </div>
            
            {/* Solde de pièces */}
            {isAuthenticated && (
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/40 shadow-lg shadow-yellow-500/10">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg">
                  <Coins className="w-5 h-5 text-yellow-900" />
                </div>
                <div>
                  <p className="text-xs text-yellow-500/70 uppercase tracking-wider">
                    {language === 'fr' ? 'Tes pièces' : language === 'it' ? 'Le tue monete' : language === 'de' ? 'Deine Münzen' : 'Your coins'}
                  </p>
                  <p className="text-2xl font-bold text-yellow-400">{userCoins.toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>

          {/* Message */}
          {message.text && (
            <div className={`mb-6 p-4 rounded-xl ${message.type === 'success' ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
              <p className={`text-center ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{message.text}</p>
            </div>
          )}

          {/* Catégories */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-4 mb-6">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              const count = cat.id === 'all' ? items.length : items.filter(i => i.category === cat.id).length;
              
              if (cat.id !== 'all' && count === 0) return null;
              
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium whitespace-nowrap transition-all duration-300 ${
                    isActive 
                      ? `bg-gradient-to-r ${colors.gradient} text-white shadow-lg ${colors.glow}`
                      : 'bg-dark-900/60 text-gray-400 hover:text-white hover:bg-dark-800/60'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {cat.label[language]}
                  <span className="text-xs opacity-70">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Loading */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className={`w-8 h-8 ${colors.text} animate-spin`} />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-20">
              <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                {language === 'fr' ? 'Aucun article disponible' : 'No items available'}
              </p>
            </div>
          ) : (
            /* Grille d'items */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map((item) => {
                const rarity = rarityColors[item.rarity] || rarityColors.common;
                const Icon = getItemIcon(item.icon);
                const owned = isOwned(item._id);
                const canAfford = userCoins >= item.price;
                const isPurchasing = purchasing === item._id;
                
                return (
                  <div
                    key={item._id}
                    className={`group relative bg-dark-900/80 backdrop-blur-xl rounded-xl border-2 ${rarity.border} overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${owned ? 'opacity-70' : ''}`}
                  >
                    {/* Badge rareté */}
                    <div className={`absolute top-3 right-3 px-2 py-1 rounded-md text-xs font-semibold ${rarity.bg} ${rarity.text}`}>
                      {rarity.label[language]}
                    </div>

                    {/* Badge possédé / Quantité */}
                    {isAuthenticated && item.ownedQuantity > 0 && (
                      <div className={`absolute top-3 left-3 px-2 py-1 rounded-md text-xs font-semibold ${
                        item.allowMultiplePurchases 
                          ? 'bg-blue-500/20 text-blue-400' 
                          : 'bg-green-500/20 text-green-400'
                      } flex items-center gap-1`}>
                        {item.allowMultiplePurchases ? (
                          <>
                            <Package className="w-3 h-3" />
                            <span>{item.ownedQuantity}x</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            {ownedLabel[language]}
                          </>
                        )}
                      </div>
                    )}

                    {/* Promo badge */}
                    {item.originalPrice && item.originalPrice > item.price && (
                      <div className="absolute top-12 right-3 px-2 py-1 rounded-md text-xs font-semibold bg-green-500/20 text-green-400">
                        -{Math.round((1 - item.price / item.originalPrice) * 100)}%
                      </div>
                    )}

                    <div className="p-5">
                      {/* Icône */}
                      <div className="mb-4">
                        <div className={`w-16 h-16 mx-auto rounded-xl bg-gradient-to-br from-${item.color || colors.primary}-500/30 to-${item.color || colors.primary}-600/30 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 border ${rarity.border}`}>
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-10 h-10 object-contain" />
                          ) : (
                            <Icon className={`w-8 h-8 ${rarity.text}`} />
                          )}
                        </div>
                      </div>

                      {/* Info */}
                      <h3 className="text-lg font-bold text-white mb-1 text-center">
                        {item.nameTranslations?.[language] || item.name}
                      </h3>
                      <p className="text-sm text-gray-500 mb-4 text-center line-clamp-2">
                        {item.descriptionTranslations?.[language] || item.description}
                      </p>

                      {/* Prix et bouton */}
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex items-center gap-2">
                          {item.originalPrice && item.originalPrice > item.price && (
                            <span className="text-gray-500 line-through text-sm">{item.originalPrice}</span>
                          )}
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center">
                              <Coins className="w-3.5 h-3.5 text-yellow-900" />
                            </div>
                            <span className="text-xl font-bold text-yellow-400">{item.price}</span>
                          </div>
                        </div>

                        {/* Preview button for ornaments */}
                        {item.category === 'ornament' && item.ornamentData && (
                          <button
                            onClick={() => setPreviewItem(item)}
                            className="w-full py-2 rounded-lg font-medium text-sm transition-all duration-300 flex items-center justify-center gap-2 bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10 hover:border-white/20"
                          >
                            <Eye className="w-4 h-4" />
                            {previewLabel[language]}
                          </button>
                        )}
                        
                        {(!owned || item.allowMultiplePurchases) && (
                          <button 
                            onClick={() => handlePurchase(item)}
                            disabled={!canAfford || isPurchasing || !isAuthenticated}
                            className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
                              !isAuthenticated
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : canAfford
                                  ? `bg-gradient-to-r ${colors.gradient} text-white hover:shadow-lg ${colors.glow}`
                                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            {isPurchasing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <ShoppingBag className="w-4 h-4" />
                                {buyLabel[language]}
                                {item.allowMultiplePurchases && item.ownedQuantity > 0 && (
                                  <span className="text-xs opacity-75">(+1)</span>
                                )}
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Effet de brillance au hover */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none"></div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Info en bas */}
          {!loading && items.length > 0 && (
            <div className={`mt-10 p-6 rounded-xl bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30`}>
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg">
                    <Award className="w-6 h-6 text-green-900" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold">
                      {language === 'fr' ? 'Gagne des pièces gratuitement !' : language === 'it' ? 'Guadagna monete gratis!' : language === 'de' ? 'Verdiene Münzen kostenlos!' : 'Earn coins for free!'}
                    </h4>
                    <p className="text-gray-400 text-sm">
                      {language === 'fr' ? 'Chaque victoire te rapporte des pièces bonus' : language === 'it' ? 'Ogni vittoria ti fa guadagnare monete bonus' : language === 'de' ? 'Jeder Sieg bringt dir Bonusmünzen' : 'Every victory earns you bonus coins'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/30">
                  <Trophy className="w-5 h-5 text-green-400" />
                  <span className="text-green-400 font-bold">+50</span>
                  <Coins className="w-4 h-4 text-yellow-400" />
                  <span className="text-gray-400 text-sm">/ {language === 'fr' ? 'victoire' : language === 'it' ? 'vittoria' : language === 'de' ? 'Sieg' : 'win'}</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setPreviewItem(null)}>
          <div 
            className={`bg-dark-900 border ${colors.border} rounded-2xl p-6 max-w-md w-full shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">{previewLabel[language]}: {previewItem.nameTranslations?.[language] || previewItem.name}</h3>
              <button 
                onClick={() => setPreviewItem(null)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Avatar Preview */}
            <div className="flex flex-col items-center mb-6">
              <p className="text-gray-400 text-sm mb-4">
                {language === 'fr' ? 'Aperçu sur ton avatar' : language === 'it' ? 'Anteprima sul tuo avatar' : language === 'de' ? 'Vorschau auf deinem Avatar' : 'Preview on your avatar'}
              </p>
              
              <div className="relative">
                {/* Avatar with ornament preview */}
                <div className="relative w-32 h-32">
                  {/* Ornament border */}
                  {previewItem.ornamentData?.borderColor && (
                    <div 
                      className={`absolute inset-0 rounded-full bg-gradient-to-r ${previewItem.ornamentData.borderColor} ${
                        previewItem.ornamentData.animated && previewItem.ornamentData.animationType === 'pulse' ? 'animate-pulse' : ''
                      } ${
                        previewItem.ornamentData.animated && previewItem.ornamentData.animationType === 'spin' ? 'animate-spin-slow' : ''
                      } ${
                        previewItem.ornamentData.animated && previewItem.ornamentData.animationType === 'glow' ? 'animate-glow' : ''
                      }`}
                      style={{ padding: `${previewItem.ornamentData.borderWidth || 4}px` }}
                    />
                  )}
                  
                  {/* User avatar */}
                  <img
                    src={user?.avatar || getDefaultAvatar(user?.username)}
                    alt="Preview"
                    className="absolute rounded-full w-full h-full object-cover"
                    style={{ 
                      padding: `${previewItem.ornamentData?.borderWidth || 4}px`,
                      zIndex: 1
                    }}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = getDefaultAvatar(user?.username);
                    }}
                  />
                </div>
              </div>

              <p className="text-white font-medium mt-4">{user?.username || 'Username'}</p>
            </div>

            {/* Item Info */}
            <div className={`p-4 rounded-xl ${rarityColors[previewItem.rarity]?.bg || 'bg-gray-500/20'} border ${rarityColors[previewItem.rarity]?.border || 'border-gray-500/40'} mb-4`}>
              <p className="text-gray-300 text-sm">{previewItem.descriptionTranslations?.[language] || previewItem.description}</p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setPreviewItem(null)}
                className="flex-1 py-3 rounded-lg font-medium text-gray-400 bg-white/5 hover:bg-white/10 transition-colors"
              >
                {language === 'fr' ? 'Fermer' : language === 'it' ? 'Chiudi' : language === 'de' ? 'Schließen' : 'Close'}
              </button>
              {!isOwned(previewItem._id) && (
                <button
                  onClick={() => {
                    handlePurchase(previewItem);
                    setPreviewItem(null);
                  }}
                  disabled={userCoins < previewItem.price || !isAuthenticated}
                  className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                    userCoins >= previewItem.price && isAuthenticated
                      ? `bg-gradient-to-r ${colors.gradient} text-white hover:shadow-lg ${colors.glow}`
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  {buyLabel[language]} ({previewItem.price} <Coins className="w-3 h-3 inline" />)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shop;
