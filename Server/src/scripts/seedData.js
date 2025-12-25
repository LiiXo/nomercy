// Script pour initialiser la base de données avec les produits de la boutique
// Exécuter avec: node src/scripts/seedData.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Import models
import ShopItem from '../models/ShopItem.js';
import Ranking from '../models/Ranking.js';
import User from '../models/User.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nomercy';

// ==================== SHOP ITEMS ====================
const shopItems = [
  // ORNAMENTS (Avatar Borders) - IMPRESSIVE & ANIMATED
  {
    name: 'Aura Démoniaque',
    nameTranslations: { fr: 'Aura Démoniaque', en: 'Demonic Aura', de: 'Dämonische Aura', it: 'Aura Demoniaca' },
    description: 'Une aura infernale de feu et de ténèbres qui enveloppe ton avatar',
    descriptionTranslations: { fr: 'Une aura infernale de feu et de ténèbres qui enveloppe ton avatar', en: 'An infernal aura of fire and darkness that envelops your avatar', de: 'Eine höllische Aura aus Feuer und Dunkelheit, die deinen Avatar umhüllt', it: 'Un\'aura infernale di fuoco e oscurità che avvolge il tuo avatar' },
    category: 'ornament',
    price: 2000,
    rarity: 'legendary',
    icon: 'Skull',
    color: 'red',
    mode: 'all',
    sortOrder: 1,
    ornamentData: {
      borderColor: 'from-red-600 via-red-800 to-red-900',
      glowColor: 'rgba(220, 38, 38, 0.8)',
      borderWidth: 10,
      animated: true,
      animationType: 'demon-fire',
      multiLayer: true,
      layer2Color: 'from-red-500 via-orange-600 to-red-700',
      layer3Color: 'from-red-400 via-red-600 to-red-800'
    }
  },
  {
    name: 'Halo Angélique',
    nameTranslations: { fr: 'Halo Angélique', en: 'Angelic Halo', de: 'Engelshalo', it: 'Alone Angelico' },
    description: 'Une couronne de lumière divine qui brille autour de ton avatar',
    descriptionTranslations: { fr: 'Une couronne de lumière divine qui brille autour de ton avatar', en: 'A crown of divine light that shines around your avatar', de: 'Eine Krone aus göttlichem Licht, die um deinen Avatar leuchtet', it: 'Una corona di luce divina che brilla intorno al tuo avatar' },
    category: 'ornament',
    price: 2500,
    rarity: 'legendary',
    icon: 'Star',
    color: 'yellow',
    mode: 'all',
    sortOrder: 2,
    ornamentData: {
      borderColor: 'from-yellow-200 via-white to-yellow-100',
      glowColor: 'rgba(255, 255, 255, 0.9)',
      borderWidth: 12,
      animated: true,
      animationType: 'angel-halo',
      multiLayer: true,
      layer2Color: 'from-yellow-300 via-amber-200 to-yellow-200',
      layer3Color: 'from-yellow-400 via-white to-yellow-300'
    }
  },
  {
    name: 'Énergie Manga',
    nameTranslations: { fr: 'Énergie Manga', en: 'Manga Energy', de: 'Manga-Energie', it: 'Energia Manga' },
    description: 'Une explosion d\'énergie colorée style manga/anime autour de ton avatar',
    descriptionTranslations: { fr: 'Une explosion d\'énergie colorée style manga/anime autour de ton avatar', en: 'A colorful manga/anime-style energy explosion around your avatar', de: 'Eine farbenfrohe Manga/Anime-Energieexplosion um deinen Avatar', it: 'Un\'esplosione di energia colorata in stile manga/anime intorno al tuo avatar' },
    category: 'ornament',
    price: 1800,
    rarity: 'legendary',
    icon: 'Zap',
    color: 'purple',
    mode: 'all',
    sortOrder: 3,
    ornamentData: {
      borderColor: 'from-purple-500 via-pink-500 to-purple-600',
      glowColor: 'rgba(168, 85, 247, 0.8)',
      borderWidth: 10,
      animated: true,
      animationType: 'manga-energy',
      multiLayer: true,
      layer2Color: 'from-purple-400 via-violet-500 to-purple-700',
      layer3Color: 'from-pink-400 via-purple-500 to-violet-600'
    }
  },
  {
    name: 'Néon Cyberpunk',
    nameTranslations: { fr: 'Néon Cyberpunk', en: 'Cyberpunk Neon', de: 'Cyberpunk-Neon', it: 'Neon Cyberpunk' },
    description: 'Des néons cyberpunk multicolores qui pulsent autour de ton avatar',
    descriptionTranslations: { fr: 'Des néons cyberpunk multicolores qui pulsent autour de ton avatar', en: 'Multicolored cyberpunk neons that pulse around your avatar', de: 'Bunte Cyberpunk-Neonlichter, die um deinen Avatar pulsieren', it: 'Neon cyberpunk multicolori che pulsano intorno al tuo avatar' },
    category: 'ornament',
    price: 2200,
    rarity: 'legendary',
    icon: 'Zap',
    color: 'cyan',
    mode: 'all',
    sortOrder: 4,
    ornamentData: {
      borderColor: 'from-cyan-400 via-pink-500 to-purple-500',
      glowColor: 'rgba(6, 182, 212, 0.8)',
      borderWidth: 11,
      animated: true,
      animationType: 'cyber-neon',
      multiLayer: true,
      layer2Color: 'from-cyan-500 via-fuchsia-500 to-purple-600',
      layer3Color: 'from-pink-400 via-cyan-400 to-violet-500'
    }
  },
  {
    name: 'Écailles de Dragon',
    nameTranslations: { fr: 'Écailles de Dragon', en: 'Dragon Scales', de: 'Drachenschuppen', it: 'Squame di Drago' },
    description: 'Des écailles de dragon vertes qui brillent et pulsent avec puissance',
    descriptionTranslations: { fr: 'Des écailles de dragon vertes qui brillent et pulsent avec puissance', en: 'Green dragon scales that glow and pulse with power', de: 'Grüne Drachenschuppen, die mit Macht leuchten und pulsieren', it: 'Squame di drago verdi che brillano e pulsano con potenza' },
    category: 'ornament',
    price: 1900,
    rarity: 'legendary',
    icon: 'Shield',
    color: 'green',
    mode: 'all',
    sortOrder: 5,
    ornamentData: {
      borderColor: 'from-green-400 via-emerald-500 to-green-600',
      glowColor: 'rgba(34, 197, 94, 0.8)',
      borderWidth: 10,
      animated: true,
      animationType: 'dragon-scale',
      multiLayer: true,
      layer2Color: 'from-green-500 via-teal-500 to-emerald-600',
      layer3Color: 'from-emerald-400 via-green-500 to-teal-600'
    }
  },
  {
    name: 'Aura du Vide',
    nameTranslations: { fr: 'Aura du Vide', en: 'Void Aura', de: 'Leeren-Aura', it: 'Aura del Vuoto' },
    description: 'Une aura mystérieuse et sombre du vide cosmique',
    descriptionTranslations: { fr: 'Une aura mystérieuse et sombre du vide cosmique', en: 'A mysterious and dark aura of cosmic void', de: 'Eine geheimnisvolle und dunkle Aura des kosmischen Voids', it: 'Un\'aura misteriosa e oscura del vuoto cosmico' },
    category: 'ornament',
    price: 2100,
    rarity: 'legendary',
    icon: 'Diamond',
    color: 'indigo',
    mode: 'all',
    sortOrder: 6,
    ornamentData: {
      borderColor: 'from-indigo-600 via-purple-600 to-indigo-700',
      glowColor: 'rgba(99, 102, 241, 0.8)',
      borderWidth: 11,
      animated: true,
      animationType: 'void-aura',
      multiLayer: true,
      layer2Color: 'from-indigo-500 via-violet-600 to-indigo-800',
      layer3Color: 'from-purple-500 via-indigo-600 to-violet-700'
    }
  },
  {
    name: 'Flamme du Phénix',
    nameTranslations: { fr: 'Flamme du Phénix', en: 'Phoenix Flame', de: 'Phönix-Flamme', it: 'Fiamma della Fenice' },
    description: 'Les flammes éternelles du phénix qui renaissent sans cesse',
    descriptionTranslations: { fr: 'Les flammes éternelles du phénix qui renaissent sans cesse', en: 'The eternal flames of the phoenix that are reborn endlessly', de: 'Die ewigen Flammen des Phönix, die endlos wiedergeboren werden', it: 'Le fiamme eterne della fenice che rinascono continuamente' },
    category: 'ornament',
    price: 2400,
    rarity: 'legendary',
    icon: 'Flame',
    color: 'orange',
    mode: 'all',
    sortOrder: 7,
    ornamentData: {
      borderColor: 'from-yellow-400 via-orange-500 to-red-500',
      glowColor: 'rgba(251, 191, 36, 0.8)',
      borderWidth: 12,
      animated: true,
      animationType: 'phoenix-flame',
      multiLayer: true,
      layer2Color: 'from-amber-400 via-orange-600 to-yellow-500',
      layer3Color: 'from-yellow-500 via-red-500 to-orange-600'
    }
  },
  {
    name: 'Cristal de Glace',
    nameTranslations: { fr: 'Cristal de Glace', en: 'Ice Crystal', de: 'Eiskristall', it: 'Cristallo di Ghiaccio' },
    description: 'Un cristal de glace éternel qui scintille et brille',
    descriptionTranslations: { fr: 'Un cristal de glace éternel qui scintille et brille', en: 'An eternal ice crystal that sparkles and shines', de: 'Ein ewiger Eiskristall, der funkelt und glänzt', it: 'Un cristallo di ghiaccio eterno che scintilla e brilla' },
    category: 'ornament',
    price: 1700,
    rarity: 'epic',
    icon: 'Diamond',
    color: 'blue',
    mode: 'all',
    sortOrder: 8,
    ornamentData: {
      borderColor: 'from-blue-300 via-cyan-400 to-blue-500',
      glowColor: 'rgba(147, 197, 253, 0.8)',
      borderWidth: 9,
      animated: true,
      animationType: 'ice-crystal',
      multiLayer: true,
      layer2Color: 'from-sky-300 via-blue-400 to-cyan-500',
      layer3Color: 'from-cyan-300 via-blue-300 to-sky-400'
    }
  },
  {
    name: 'Étoile Cosmique',
    nameTranslations: { fr: 'Étoile Cosmique', en: 'Cosmic Star', de: 'Kosmischer Stern', it: 'Stella Cosmica' },
    description: 'Une étoile cosmique qui tourne et brille avec la puissance de l\'univers',
    descriptionTranslations: { fr: 'Une étoile cosmique qui tourne et brille avec la puissance de l\'univers', en: 'A cosmic star that rotates and shines with the power of the universe', de: 'Ein kosmischer Stern, der sich dreht und mit der Kraft des Universums leuchtet', it: 'Una stella cosmica che ruota e brilla con il potere dell\'universo' },
    category: 'ornament',
    price: 3000,
    rarity: 'legendary',
    icon: 'Star',
    color: 'purple',
    mode: 'all',
    sortOrder: 9,
    ornamentData: {
      borderColor: 'from-purple-400 via-violet-500 to-purple-600',
      glowColor: 'rgba(139, 92, 246, 0.9)',
      borderWidth: 14,
      animated: true,
      animationType: 'cosmic-star',
      multiLayer: true,
      layer2Color: 'from-violet-400 via-purple-500 to-fuchsia-500',
      layer3Color: 'from-purple-300 via-violet-400 to-purple-500'
    }
  },
  {
    name: 'Flammes Infernales',
    nameTranslations: { fr: 'Flammes Infernales', en: 'Infernal Flames', de: 'Höllenfeuer', it: 'Fiamme Infernali' },
    description: 'Un halo de flammes ardentes autour de ton avatar',
    descriptionTranslations: { fr: 'Un halo de flammes ardentes autour de ton avatar', en: 'A halo of burning flames around your avatar', de: 'Ein Flammenhalo um deinen Avatar', it: 'Un alone di fiamme ardenti intorno al tuo avatar' },
    category: 'ornament',
    price: 500,
    rarity: 'epic',
    icon: 'Flame',
    color: 'orange',
    mode: 'all',
    sortOrder: 10,
    ornamentData: {
      borderColor: 'from-orange-500 via-red-500 to-yellow-500',
      glowColor: 'rgba(249, 115, 22, 0.5)',
      borderWidth: 6,
      animated: true,
      animationType: 'pulse'
    }
  },

  // TITLES
  {
    name: 'Le Destructeur',
    nameTranslations: { fr: 'Le Destructeur', en: 'The Destroyer', de: 'Der Zerstörer', it: 'Il Distruttore' },
    description: 'Pour ceux qui ne laissent rien debout',
    descriptionTranslations: { fr: 'Pour ceux qui ne laissent rien debout', en: 'For those who leave nothing standing', de: 'Für die, die nichts stehen lassen', it: 'Per chi non lascia nulla in piedi' },
    category: 'title',
    price: 300,
    rarity: 'rare',
    icon: 'Target',
    color: 'red',
    mode: 'hardcore',
    sortOrder: 10
  },
  {
    name: 'Légende Vivante',
    nameTranslations: { fr: 'Légende Vivante', en: 'Living Legend', de: 'Lebende Legende', it: 'Leggenda Vivente' },
    description: 'Un titre de prestige ultime',
    descriptionTranslations: { fr: 'Un titre de prestige ultime', en: 'The ultimate prestige title', de: 'Der ultimative Prestigetitel', it: 'Un titolo di prestigio supremo' },
    category: 'title',
    price: 800,
    rarity: 'legendary',
    icon: 'Trophy',
    color: 'yellow',
    mode: 'all',
    sortOrder: 11
  },
  {
    name: 'Sans Pitié',
    nameTranslations: { fr: 'Sans Pitié', en: 'No Mercy', de: 'Gnadenlos', it: 'Senza Pietà' },
    description: 'La miséricorde est pour les faibles',
    descriptionTranslations: { fr: 'La miséricorde est pour les faibles', en: 'Mercy is for the weak', de: 'Gnade ist für die Schwachen', it: 'La pietà è per i deboli' },
    category: 'title',
    price: 450,
    rarity: 'epic',
    icon: 'Skull',
    color: 'gray',
    mode: 'hardcore',
    sortOrder: 12
  },
  {
    name: 'Cœur de Champion',
    nameTranslations: { fr: 'Cœur de Champion', en: 'Champion\'s Heart', de: 'Herz eines Champions', it: 'Cuore di Campione' },
    description: 'La victoire coule dans tes veines',
    descriptionTranslations: { fr: 'La victoire coule dans tes veines', en: 'Victory flows through your veins', de: 'Der Sieg fließt durch deine Adern', it: 'La vittoria scorre nelle tue vene' },
    category: 'title',
    price: 500,
    rarity: 'epic',
    icon: 'Heart',
    color: 'pink',
    mode: 'all',
    sortOrder: 13
  },
  {
    name: 'L\'Invincible',
    nameTranslations: { fr: 'L\'Invincible', en: 'The Invincible', de: 'Der Unbesiegbare', it: 'L\'Invincibile' },
    description: 'Jamais vaincu, toujours debout',
    descriptionTranslations: { fr: 'Jamais vaincu, toujours debout', en: 'Never defeated, always standing', de: 'Nie besiegt, immer aufrecht', it: 'Mai sconfitto, sempre in piedi' },
    category: 'title',
    price: 650,
    rarity: 'legendary',
    icon: 'Shield',
    color: 'green',
    mode: 'all',
    sortOrder: 14
  },

  // EMOTES
  {
    name: 'GG',
    nameTranslations: { fr: 'GG', en: 'GG', de: 'GG', it: 'GG' },
    description: 'Émote GG pour féliciter l\'adversaire',
    descriptionTranslations: { fr: 'Émote GG pour féliciter l\'adversaire', en: 'GG emote to congratulate opponent', de: 'GG-Emote, um den Gegner zu gratulieren', it: 'Emote GG per congratularsi con l\'avversario' },
    category: 'emote',
    price: 100,
    rarity: 'common',
    icon: 'ThumbsUp',
    color: 'green',
    mode: 'all',
    sortOrder: 15,
    isUsable: true,
    effectType: 'emote',
    duration: 0,
    usableInMatch: true,
    allowMultiplePurchases: false // Acheté une fois, utilisable à l'infini
  },
  {
    name: 'EZ',
    nameTranslations: { fr: 'EZ', en: 'EZ', de: 'EZ', it: 'EZ' },
    description: 'Émote EZ pour montrer ta supériorité',
    descriptionTranslations: { fr: 'Émote EZ pour montrer ta supériorité', en: 'EZ emote to show your superiority', de: 'EZ-Emote, um deine Überlegenheit zu zeigen', it: 'Emote EZ per mostrare la tua superiorità' },
    category: 'emote',
    price: 150,
    rarity: 'rare',
    icon: 'Zap',
    color: 'yellow',
    mode: 'all',
    sortOrder: 16,
    isUsable: true,
    effectType: 'emote',
    duration: 0,
    usableInMatch: true,
    allowMultiplePurchases: false
  },
  {
    name: 'Clutch',
    nameTranslations: { fr: 'Clutch', en: 'Clutch', de: 'Clutch', it: 'Clutch' },
    description: 'Émote Clutch pour célébrer un round serré',
    descriptionTranslations: { fr: 'Émote Clutch pour célébrer un round serré', en: 'Clutch emote to celebrate a tight round', de: 'Clutch-Emote, um eine knappe Runde zu feiern', it: 'Emote Clutch per celebrare un round serrato' },
    category: 'emote',
    price: 200,
    rarity: 'epic',
    icon: 'Trophy',
    color: 'orange',
    mode: 'all',
    sortOrder: 17,
    isUsable: true,
    effectType: 'emote',
    duration: 0,
    usableInMatch: true,
    allowMultiplePurchases: false
  },
  {
    name: 'Respect',
    nameTranslations: { fr: 'Respect', en: 'Respect', de: 'Respekt', it: 'Rispetto' },
    description: 'Émote Respect pour montrer ton respect',
    descriptionTranslations: { fr: 'Émote Respect pour montrer ton respect', en: 'Respect emote to show your respect', de: 'Respekt-Emote, um deinen Respekt zu zeigen', it: 'Emote Rispetto per mostrare il tuo rispetto' },
    category: 'emote',
    price: 120,
    rarity: 'common',
    icon: 'Heart',
    color: 'pink',
    mode: 'all',
    sortOrder: 18,
    isUsable: true,
    effectType: 'emote',
    duration: 0,
    usableInMatch: true,
    allowMultiplePurchases: false
  },
  {
    name: 'Lucky',
    nameTranslations: { fr: 'Lucky', en: 'Lucky', de: 'Glücklich', it: 'Fortunato' },
    description: 'Émote Lucky pour célébrer ta chance',
    descriptionTranslations: { fr: 'Émote Lucky pour célébrer ta chance', en: 'Lucky emote to celebrate your luck', de: 'Glücklich-Emote, um dein Glück zu feiern', it: 'Emote Fortunato per celebrare la tua fortuna' },
    category: 'emote',
    price: 180,
    rarity: 'rare',
    icon: 'Star',
    color: 'cyan',
    mode: 'all',
    sortOrder: 19,
    isUsable: true,
    effectType: 'emote',
    duration: 0,
    usableInMatch: true,
    allowMultiplePurchases: false
  },

  // BADGES
  {
    name: 'Étoile d\'Or',
    nameTranslations: { fr: 'Étoile d\'Or', en: 'Golden Star', de: 'Goldener Stern', it: 'Stella d\'Oro' },
    description: 'Badge de prestige doré',
    descriptionTranslations: { fr: 'Badge de prestige doré', en: 'Golden prestige badge', de: 'Goldenes Prestige-Abzeichen', it: 'Badge di prestigio dorato' },
    category: 'badge',
    price: 200,
    rarity: 'rare',
    icon: 'Star',
    color: 'yellow',
    mode: 'all',
    sortOrder: 20
  },
  {
    name: 'Vétéran',
    nameTranslations: { fr: 'Vétéran', en: 'Veteran', de: 'Veteran', it: 'Veterano' },
    description: 'Pour les joueurs expérimentés',
    descriptionTranslations: { fr: 'Pour les joueurs expérimentés', en: 'For experienced players', de: 'Für erfahrene Spieler', it: 'Per giocatori esperti' },
    category: 'badge',
    price: 350,
    rarity: 'epic',
    icon: 'Award',
    color: 'purple',
    mode: 'all',
    sortOrder: 21
  },
  {
    name: 'Fondateur',
    nameTranslations: { fr: 'Fondateur', en: 'Founder', de: 'Gründer', it: 'Fondatore' },
    description: 'Badge exclusif des premiers membres',
    descriptionTranslations: { fr: 'Badge exclusif des premiers membres', en: 'Exclusive badge for early members', de: 'Exklusives Abzeichen für frühe Mitglieder', it: 'Badge esclusivo per i primi membri' },
    category: 'badge',
    price: 1500,
    rarity: 'legendary',
    icon: 'Crown',
    color: 'yellow',
    mode: 'all',
    stock: 100,
    sortOrder: 22
  },

  // BOOSTS - USABLE ITEMS
  {
    name: 'Double XP',
    nameTranslations: { fr: 'Double XP', en: 'Double XP', de: 'Doppeltes XP', it: 'XP Doppio' },
    description: 'Double les points gagnés pendant 24h',
    descriptionTranslations: { fr: 'Double les points gagnés pendant 24h', en: 'Double points earned for 24h', de: 'Verdoppelt verdiente Punkte für 24h', it: 'Raddoppia i punti guadagnati per 24h' },
    category: 'boost',
    price: 150,
    rarity: 'rare',
    icon: 'Zap',
    color: 'green',
    mode: 'all',
    sortOrder: 30,
    isUsable: true,
    effectType: 'double_xp',
    duration: 24,
    usableInMatch: false,
    allowMultiplePurchases: true // Can buy multiple times
  },
  {
    name: 'Double Gold',
    nameTranslations: { fr: 'Double Gold', en: 'Double Gold', de: 'Doppeltes Gold', it: 'Oro Doppio' },
    description: 'Double les pièces gagnées pendant 24h',
    descriptionTranslations: { fr: 'Double les pièces gagnées pendant 24h', en: 'Double coins earned for 24h', de: 'Verdoppelt verdiente Münzen für 24h', it: 'Raddoppia le monete guadagnate per 24h' },
    category: 'boost',
    price: 200,
    rarity: 'rare',
    icon: 'Coins',
    color: 'yellow',
    mode: 'all',
    sortOrder: 31,
    isUsable: true,
    effectType: 'double_gold',
    duration: 24,
    usableInMatch: false,
    allowMultiplePurchases: true // Can buy multiple times
  },
  {
    name: 'Poudre de Perlinpinpin',
    nameTranslations: { fr: 'Poudre de Perlinpinpin', en: 'Magic Powder', de: 'Zauberpulver', it: 'Polvere Magica' },
    description: 'Annule un match sans l\'accord de l\'équipe adverse',
    descriptionTranslations: { fr: 'Annule un match sans l\'accord de l\'équipe adverse', en: 'Cancel a match without the opposing team\'s agreement', de: 'Bricht ein Match ohne Zustimmung der gegnerischen Mannschaft ab', it: 'Annulla una partita senza il consenso della squadra avversaria' },
    category: 'boost',
    price: 1000,
    rarity: 'legendary',
    icon: 'XCircle',
    color: 'red',
    mode: 'all',
    sortOrder: 32,
    isUsable: true,
    effectType: 'cancel_match',
    duration: 0, // One-time use
    usableInMatch: true,
    allowMultiplePurchases: true // Can buy multiple times
  },

  // COSMETICS
  {
    name: 'Explosion de Confettis',
    nameTranslations: { fr: 'Explosion de Confettis', en: 'Confetti Explosion', de: 'Konfetti-Explosion', it: 'Esplosione di Coriandoli' },
    description: 'Effet de victoire festif',
    descriptionTranslations: { fr: 'Effet de victoire festif', en: 'Festive victory effect', de: 'Festlicher Siegeseffekt', it: 'Effetto vittoria festivo' },
    category: 'cosmetic',
    price: 200,
    rarity: 'common',
    icon: 'Sparkles',
    color: 'pink',
    mode: 'all',
    sortOrder: 40
  },
  {
    name: 'Onde de Choc',
    nameTranslations: { fr: 'Onde de Choc', en: 'Shockwave', de: 'Schockwelle', it: 'Onda d\'Urto' },
    description: 'Fais trembler l\'arène à chaque victoire',
    descriptionTranslations: { fr: 'Fais trembler l\'arène à chaque victoire', en: 'Shake the arena with every victory', de: 'Lass die Arena bei jedem Sieg erzittern', it: 'Fai tremare l\'arena ad ogni vittoria' },
    category: 'cosmetic',
    price: 450,
    rarity: 'epic',
    icon: 'Zap',
    color: 'blue',
    mode: 'all',
    sortOrder: 41
  },
  {
    name: 'Tempête de Feu',
    nameTranslations: { fr: 'Tempête de Feu', en: 'Fire Storm', de: 'Feuersturm', it: 'Tempesta di Fuoco' },
    description: 'Embrase le champ de bataille',
    descriptionTranslations: { fr: 'Embrase le champ de bataille', en: 'Set the battlefield ablaze', de: 'Entfache das Schlachtfeld', it: 'Incendia il campo di battaglia' },
    category: 'cosmetic',
    price: 550,
    rarity: 'epic',
    icon: 'Flame',
    color: 'orange',
    mode: 'hardcore',
    sortOrder: 42
  },
  {
    name: 'Ascension Divine',
    nameTranslations: { fr: 'Ascension Divine', en: 'Divine Ascension', de: 'Göttlicher Aufstieg', it: 'Ascensione Divina' },
    description: 'Monte vers la gloire avec style',
    descriptionTranslations: { fr: 'Monte vers la gloire avec style', en: 'Rise to glory in style', de: 'Steige stilvoll zum Ruhm auf', it: 'Sali verso la gloria con stile' },
    category: 'cosmetic',
    price: 800,
    rarity: 'legendary',
    icon: 'Star',
    color: 'yellow',
    mode: 'all',
    sortOrder: 43
  },

];

// ==================== SEED FUNCTIONS ====================

async function seedShopItems() {
  console.log('🛒 Seeding shop items...');
  
  // Clear existing items
  await ShopItem.deleteMany({});
  
  // Insert new items
  const items = await ShopItem.insertMany(shopItems);
  console.log(`   ✓ ${items.length} shop items created`);
  
  return items;
}

async function seedTestRankings() {
  console.log('🏆 Seeding test rankings...');
  
  // Get all users with complete profiles
  const users = await User.find({ isProfileComplete: true }).limit(20);
  
  if (users.length === 0) {
    console.log('   ⚠ No users found, skipping rankings');
    return;
  }

  // Clear existing rankings
  await Ranking.deleteMany({});

  const rankings = [];
  
  // Create rankings for each user
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    
    // Hardcore ranking
    rankings.push({
      user: user._id,
      mode: 'hardcore',
      season: 1,
      points: Math.floor(Math.random() * 5000) + 100,
      wins: Math.floor(Math.random() * 100) + 10,
      losses: Math.floor(Math.random() * 50) + 5,
      kills: Math.floor(Math.random() * 500) + 50,
      deaths: Math.floor(Math.random() * 300) + 30,
      team: ['OpTic', 'FaZe', 'Team NoMercy', '100T', 'NRG'][Math.floor(Math.random() * 5)]
    });

    // CDL ranking
    rankings.push({
      user: user._id,
      mode: 'cdl',
      season: 1,
      points: Math.floor(Math.random() * 5000) + 100,
      wins: Math.floor(Math.random() * 100) + 10,
      losses: Math.floor(Math.random() * 50) + 5,
      kills: Math.floor(Math.random() * 500) + 50,
      deaths: Math.floor(Math.random() * 300) + 30,
      team: ['Atlanta FaZe', 'OpTic Texas', 'LA Thieves', 'Seattle Surge', 'Toronto Ultra'][Math.floor(Math.random() * 5)]
    });
  }

  if (rankings.length > 0) {
    await Ranking.insertMany(rankings);
    console.log(`   ✓ ${rankings.length} rankings created`);
  }
}

async function main() {
  try {
    console.log('\n🚀 Starting database seed...\n');
    console.log(`📦 Connecting to: ${MONGODB_URI}\n`);
    
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    await seedShopItems();
    await seedTestRankings();

    console.log('\n✅ Database seeded successfully!\n');
  } catch (error) {
    console.error('\n❌ Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected from MongoDB\n');
    process.exit(0);
  }
}

main();

