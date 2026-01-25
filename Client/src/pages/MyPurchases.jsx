import React, { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { useAuth } from '../AuthContext';
import { 
  Coins, 
  Crown, 
  Sparkles, 
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
  Package,
  Loader2,
  ShoppingBag,
  Gift,
  CircleDot,
  Check,
  Palette,
  Snowflake,
  Radiation,
  Ghost,
  Cpu,
  Moon,
  Eye,
  Plane
} from 'lucide-react';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const MyPurchases = () => {
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const { user, isAuthenticated, refreshUser } = useAuth();
  const [activeCategory, setActiveCategory] = useState('all');
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [equipping, setEquipping] = useState(null);
  const [equippedTitle, setEquippedTitle] = useState(null);
  const [equippedProfileAnimation, setEquippedProfileAnimation] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

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
    fr: 'Mes Achats',
    en: 'My Purchases',
    it: 'I Miei Acquisti',
    de: 'Meine Käufe',
  };

  const pageSubtitle = {
    fr: 'Gère tes objets achetés et équipe tes titres et animations',
    en: 'Manage your purchased items and equip your titles and animations',
    it: 'Gestisci i tuoi oggetti acquistati ed equipaggia i tuoi titoli e animazioni',
    de: 'Verwalte deine gekauften Gegenstände und rüste deine Titel und Animationen aus',
  };

  // Icon mapping
  const iconMap = {
    Flame, Star, Shield, Zap, Skull, Diamond, Target, Trophy, Heart, 
    Crown, Award, Sparkles, Package, Gift, Snowflake, Radiation, Ghost, Cpu, Moon, Eye, Plane
  };

  const categories = [
    { id: 'all', icon: ShoppingBag, label: { fr: 'Tout', en: 'All', it: 'Tutto', de: 'Alles' } },
    { id: 'title', icon: Star, label: { fr: 'Titres', en: 'Titles', it: 'Titoli', de: 'Titel' } },
    { id: 'profile_animation', icon: Palette, label: { fr: 'Animations', en: 'Animations', it: 'Animazioni', de: 'Animationen' } },
    { id: 'ornament', icon: CircleDot, label: { fr: 'Ornements', en: 'Ornaments', it: 'Ornamenti', de: 'Ornamente' } },
    { id: 'avatar_frame', icon: Crown, label: { fr: 'Cadres', en: 'Frames', it: 'Cornici', de: 'Rahmen' } },
    { id: 'badge', icon: Award, label: { fr: 'Badges', en: 'Badges', it: 'Badge', de: 'Abzeichen' } },
    { id: 'emote', icon: MessageSquare, label: { fr: 'Emotes', en: 'Emotes', it: 'Emote', de: 'Emotes' } },
    { id: 'boost', icon: Zap, label: { fr: 'Boosts', en: 'Boosts', it: 'Boost', de: 'Boosts' } },
    { id: 'cosmetic', icon: Sparkles, label: { fr: 'Cosmétiques', en: 'Cosmetics', it: 'Cosmetici', de: 'Kosmetik' } },
    { id: 'other', icon: Package, label: { fr: 'Services', en: 'Services', it: 'Servizi', de: 'Dienste' } },
  ];

  const rarityColors = {
    common: { bg: 'bg-gray-500/20', border: 'border-gray-500/40', text: 'text-gray-400', label: { fr: 'Commun', en: 'Common', it: 'Comune', de: 'Gewöhnlich' } },
    rare: { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-400', label: { fr: 'Rare', en: 'Rare', it: 'Raro', de: 'Selten' } },
    epic: { bg: 'bg-purple-500/20', border: 'border-purple-500/40', text: 'text-purple-400', label: { fr: 'Épique', en: 'Epic', it: 'Epico', de: 'Episch' } },
    legendary: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-400', label: { fr: 'Légendaire', en: 'Legendary', it: 'Leggendario', de: 'Legendär' } },
  };

  // Set page title
  useEffect(() => {
    const titles = {
      fr: 'NoMercy - Mes Achats',
      en: 'NoMercy - My Purchases',
      it: 'NoMercy - I Miei Acquisti',
      de: 'NoMercy - Meine Käufe',
    };
    document.title = titles[language] || titles.en;
  }, [language]);

  // Fetch purchases
  useEffect(() => {
    if (isAuthenticated) {
      fetchPurchases();
    }
  }, [isAuthenticated]);

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/shop/my-purchases`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setPurchases(data.purchases);
        setEquippedTitle(data.equippedTitle);
        setEquippedProfileAnimation(data.equippedProfileAnimation);
      }
    } catch (err) {
      console.error('Error fetching purchases:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEquipTitle = async (itemId) => {
    setEquipping(itemId);
    try {
      const response = await fetch(`${API_URL}/shop/equip-title/${itemId}`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();

      if (data.success) {
        setEquippedTitle(itemId === 'none' ? null : itemId);
        setMessage({ 
          type: 'success', 
          text: itemId === 'none' 
            ? (language === 'fr' ? 'Titre retiré' : 'Title unequipped')
            : (language === 'fr' ? 'Titre équipé !' : 'Title equipped!')
        });
        refreshUser();
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error equipping title' });
    } finally {
      setEquipping(null);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const handleEquipProfileAnimation = async (itemId) => {
    setEquipping(itemId);
    try {
      const response = await fetch(`${API_URL}/shop/equip-profile-animation/${itemId}`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();

      if (data.success) {
        setEquippedProfileAnimation(itemId === 'none' ? null : itemId);
        setMessage({ 
          type: 'success', 
          text: itemId === 'none' 
            ? (language === 'fr' ? 'Animation retirée' : 'Animation unequipped')
            : (language === 'fr' ? 'Animation équipée !' : 'Animation equipped!')
        });
        refreshUser();
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error equipping animation' });
    } finally {
      setEquipping(null);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const getItemIcon = (iconName) => {
    return iconMap[iconName] || Package;
  };

  // Group purchases by item to count duplicates
  const groupedPurchases = purchases.reduce((acc, purchase) => {
    if (!purchase.item) return acc;
    const itemId = purchase.item._id;
    if (!acc[itemId]) {
      acc[itemId] = {
        item: purchase.item,
        count: 1,
        firstPurchase: purchase.createdAt
      };
    } else {
      acc[itemId].count++;
    }
    return acc;
  }, {});

  const purchaseItems = Object.values(groupedPurchases);

  const filteredItems = activeCategory === 'all' 
    ? purchaseItems 
    : purchaseItems.filter(p => p.item.category === activeCategory);

  const getCategoryCount = (categoryId) => {
    if (categoryId === 'all') return purchaseItems.length;
    return purchaseItems.filter(p => p.item.category === categoryId).length;
  };

  return (
    <div className="min-h-screen bg-dark-950 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-20"></div>
      {isHardcore ? (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(239, 68, 68, 0.1) 0%, transparent 50%)' }}></div>
      ) : (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(6, 182, 212, 0.1) 0%, transparent 50%)' }}></div>
      )}

      <div className="relative z-10 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{pageTitle[language]}</h1>
            <p className="text-gray-400">{pageSubtitle[language]}</p>
          </div>

          {/* Message */}
          {message.text && (
            <div className={`mb-6 p-4 rounded-xl ${message.type === 'success' ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
              <p className={`text-center ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{message.text}</p>
            </div>
          )}

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-4 mb-6">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              const count = getCategoryCount(cat.id);
              
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
                {language === 'fr' ? 'Aucun achat dans cette catégorie' : 'No purchases in this category'}
              </p>
              <p className="text-gray-600 text-sm mt-2">
                {language === 'fr' ? 'Visite la boutique pour acheter des objets !' : 'Visit the shop to buy items!'}
              </p>
            </div>
          ) : (
            /* Grid of items */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map(({ item, count }) => {
                const rarity = rarityColors[item.rarity] || rarityColors.common;
                const Icon = getItemIcon(item.icon);
                const isTitle = item.category === 'title';
                const isProfileAnimation = item.category === 'profile_animation';
                const isEquipped = isTitle ? equippedTitle === item._id : isProfileAnimation ? equippedProfileAnimation === item._id : false;
                const isEquippingThis = equipping === item._id;
                
                return (
                  <div
                    key={item._id}
                    className={`group relative bg-dark-900/80 backdrop-blur-xl rounded-xl border-2 ${
                      isEquipped ? 'border-green-500 ring-2 ring-green-500/30' : rarity.border
                    } overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl`}
                  >
                    {/* Rarity badge */}
                    <div className={`absolute top-3 right-3 px-2 py-1 rounded-md text-xs font-semibold ${rarity.bg} ${rarity.text}`}>
                      {rarity.label[language]}
                    </div>

                    {/* Quantity badge */}
                    {count > 1 && (
                      <div className="absolute top-3 left-3 px-2 py-1 rounded-md text-xs font-semibold bg-blue-500/20 text-blue-400 flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        <span>x{count}</span>
                      </div>
                    )}

                    {/* Equipped badge */}
                    {isEquipped && (
                      <div className="absolute top-12 right-3 px-2 py-1 rounded-md text-xs font-semibold bg-green-500/20 text-green-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {language === 'fr' ? 'Équipé' : 'Equipped'}
                      </div>
                    )}

                    <div className="p-5">
                      {/* Icon */}
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
                      <p className="text-xs text-gray-500 text-center mb-4 uppercase tracking-wider">
                        {categories.find(c => c.id === item.category)?.label[language] || item.category}
                      </p>

                      {/* Equip button for titles */}
                      {isTitle && (
                        <div className="flex flex-col gap-2">
                          {isEquipped ? (
                            <button
                              onClick={() => handleEquipTitle('none')}
                              disabled={isEquippingThis}
                              className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                            >
                              {isEquippingThis ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  {language === 'fr' ? 'Retirer' : 'Unequip'}
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleEquipTitle(item._id)}
                              disabled={isEquippingThis}
                              className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 bg-gradient-to-r ${colors.gradient} text-white hover:shadow-lg ${colors.glow}`}
                            >
                              {isEquippingThis ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="w-4 h-4" />
                                  {language === 'fr' ? 'Équiper' : 'Equip'}
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Equip button for profile animations */}
                      {isProfileAnimation && (
                        <div className="flex flex-col gap-2">
                          {isEquipped ? (
                            <button
                              onClick={() => handleEquipProfileAnimation('none')}
                              disabled={isEquippingThis}
                              className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                            >
                              {isEquippingThis ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  {language === 'fr' ? 'Retirer' : 'Unequip'}
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleEquipProfileAnimation(item._id)}
                              disabled={isEquippingThis}
                              className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 bg-gradient-to-r ${colors.gradient} text-white hover:shadow-lg ${colors.glow}`}
                            >
                              {isEquippingThis ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="w-4 h-4" />
                                  {language === 'fr' ? 'Équiper' : 'Equip'}
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Shine effect on hover */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none"></div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default MyPurchases;
