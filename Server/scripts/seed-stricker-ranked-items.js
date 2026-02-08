import mongoose from 'mongoose';
import ShopItem from '../src/models/ShopItem.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined in .env file');
  process.exit(1);
}

// ==================== STRICKER MODE TITLES ====================
const strickerTitles = [
  {
    name: 'Lucky Strike',
    nameTranslations: {
      fr: 'Coup de Chance',
      en: 'Lucky Strike',
      de: 'Glückstreffer',
      it: 'Colpo Fortunato'
    },
    description: 'La chance te sourit toujours. Chaque Stricker est une opportunité.',
    descriptionTranslations: {
      fr: 'La chance te sourit toujours. Chaque Stricker est une opportunité.',
      en: 'Luck always smiles upon you. Every Stricker is an opportunity.',
      de: 'Das Glück lächelt dir immer zu. Jeder Stricker ist eine Chance.',
      it: 'La fortuna ti sorride sempre. Ogni Stricker è un\'opportunità.'
    },
    category: 'title',
    price: 800,
    icon: 'Sparkles',
    color: 'yellow',
    rarity: 'rare',
    sortOrder: 50
  },
  {
    name: 'Jackpot Hunter',
    nameTranslations: {
      fr: 'Chasseur de Jackpot',
      en: 'Jackpot Hunter',
      de: 'Jackpot-Jäger',
      it: 'Cacciatore di Jackpot'
    },
    description: 'Tu chasses le gros lot. Les Strickers légendaires tremblent.',
    descriptionTranslations: {
      fr: 'Tu chasses le gros lot. Les Strickers légendaires tremblent.',
      en: 'You hunt for the jackpot. Legendary Strickers tremble.',
      de: 'Du jagst den Jackpot. Legendäre Stricker zittern.',
      it: 'Cacci il jackpot. Gli Stricker leggendari tremano.'
    },
    category: 'title',
    price: 1500,
    icon: 'Trophy',
    color: 'amber',
    rarity: 'epic',
    sortOrder: 51
  },
  {
    name: 'Golden Gambler',
    nameTranslations: {
      fr: 'Parieur Doré',
      en: 'Golden Gambler',
      de: 'Goldener Spieler',
      it: 'Scommettitore Dorato'
    },
    description: 'L\'or coule dans tes veines. Tu ne perds jamais vraiment.',
    descriptionTranslations: {
      fr: 'L\'or coule dans tes veines. Tu ne perds jamais vraiment.',
      en: 'Gold flows through your veins. You never truly lose.',
      de: 'Gold fließt durch deine Adern. Du verlierst nie wirklich.',
      it: 'L\'oro scorre nelle tue vene. Non perdi mai veramente.'
    },
    category: 'title',
    price: 2000,
    icon: 'Coins',
    color: 'yellow',
    rarity: 'legendary',
    sortOrder: 52
  },
  {
    name: 'Stricker God',
    nameTranslations: {
      fr: 'Dieu du Stricker',
      en: 'Stricker God',
      de: 'Stricker-Gott',
      it: 'Dio dello Stricker'
    },
    description: 'Maître absolu du mode Stricker. La roue de la fortune t\'obéit.',
    descriptionTranslations: {
      fr: 'Maître absolu du mode Stricker. La roue de la fortune t\'obéit.',
      en: 'Absolute master of Stricker mode. The wheel of fortune obeys you.',
      de: 'Absoluter Meister des Stricker-Modus. Das Glücksrad gehorcht dir.',
      it: 'Maestro assoluto della modalità Stricker. La ruota della fortuna ti obbedisce.'
    },
    category: 'title',
    price: 3500,
    icon: 'Crown',
    color: 'purple',
    rarity: 'legendary',
    sortOrder: 53
  },
  {
    name: 'Fortune Favored',
    nameTranslations: {
      fr: 'Béni par la Fortune',
      en: 'Fortune Favored',
      de: 'Vom Glück Begünstigt',
      it: 'Favorito dalla Fortuna'
    },
    description: 'Le destin est de ton côté. Chaque spin est un spectacle.',
    descriptionTranslations: {
      fr: 'Le destin est de ton côté. Chaque spin est un spectacle.',
      en: 'Destiny is on your side. Every spin is a spectacle.',
      de: 'Das Schicksal ist auf deiner Seite. Jeder Dreh ist ein Spektakel.',
      it: 'Il destino è dalla tua parte. Ogni giro è uno spettacolo.'
    },
    category: 'title',
    price: 1200,
    icon: 'Star',
    color: 'pink',
    rarity: 'epic',
    sortOrder: 54
  },
  {
    name: 'Dice Master',
    nameTranslations: {
      fr: 'Maître des Dés',
      en: 'Dice Master',
      de: 'Würfelmeister',
      it: 'Maestro dei Dadi'
    },
    description: 'Tu maîtrises le hasard comme un art.',
    descriptionTranslations: {
      fr: 'Tu maîtrises le hasard comme un art.',
      en: 'You master randomness like an art.',
      de: 'Du meisterst den Zufall wie eine Kunst.',
      it: 'Padroneggi il caso come un\'arte.'
    },
    category: 'title',
    price: 600,
    icon: 'Dices',
    color: 'cyan',
    rarity: 'common',
    sortOrder: 55
  }
];

// ==================== RANKED MODE TITLES ====================
const rankedTitles = [
  {
    name: 'ELO Destroyer',
    nameTranslations: {
      fr: 'Destructeur d\'ELO',
      en: 'ELO Destroyer',
      de: 'ELO-Zerstörer',
      it: 'Distruttore di ELO'
    },
    description: 'Tu écrases l\'ELO de tes adversaires sans pitié.',
    descriptionTranslations: {
      fr: 'Tu écrases l\'ELO de tes adversaires sans pitié.',
      en: 'You crush your opponents\' ELO mercilessly.',
      de: 'Du zerschmetterst das ELO deiner Gegner gnadenlos.',
      it: 'Distruggi l\'ELO dei tuoi avversari senza pietà.'
    },
    category: 'title',
    price: 1000,
    icon: 'Sword',
    color: 'red',
    rarity: 'rare',
    sortOrder: 60
  },
  {
    name: 'Diamond Climber',
    nameTranslations: {
      fr: 'Grimpeur Diamant',
      en: 'Diamond Climber',
      de: 'Diamant-Aufsteiger',
      it: 'Scalatore Diamante'
    },
    description: 'Tu as gravi les échelons jusqu\'au diamant. L\'élite t\'attend.',
    descriptionTranslations: {
      fr: 'Tu as gravi les échelons jusqu\'au diamant. L\'élite t\'attend.',
      en: 'You climbed the ranks to diamond. The elite awaits.',
      de: 'Du bist bis zum Diamant aufgestiegen. Die Elite wartet.',
      it: 'Hai scalato i ranghi fino al diamante. L\'élite ti attende.'
    },
    category: 'title',
    price: 1800,
    icon: 'Diamond',
    color: 'cyan',
    rarity: 'epic',
    sortOrder: 61
  },
  {
    name: 'Ranked Royalty',
    nameTranslations: {
      fr: 'Royauté Ranked',
      en: 'Ranked Royalty',
      de: 'Ranglistenroyalty',
      it: 'Realtà Ranked'
    },
    description: 'La couronne du classement t\'appartient. Incline-toi, plèbe.',
    descriptionTranslations: {
      fr: 'La couronne du classement t\'appartient. Incline-toi, plèbe.',
      en: 'The ranking crown belongs to you. Bow down, peasants.',
      de: 'Die Ranglistenkrone gehört dir. Verbeuge dich, Pöbel.',
      it: 'La corona della classifica ti appartiene. Inchinati, plebe.'
    },
    category: 'title',
    price: 3000,
    icon: 'Crown',
    color: 'purple',
    rarity: 'legendary',
    sortOrder: 62
  },
  {
    name: 'Masters Elite',
    nameTranslations: {
      fr: 'Élite des Maîtres',
      en: 'Masters Elite',
      de: 'Meister-Elite',
      it: 'Élite dei Maestri'
    },
    description: 'Le rang Master n\'est que le début de ta domination.',
    descriptionTranslations: {
      fr: 'Le rang Master n\'est que le début de ta domination.',
      en: 'Master rank is just the beginning of your domination.',
      de: 'Der Master-Rang ist nur der Anfang deiner Dominanz.',
      it: 'Il grado Master è solo l\'inizio del tuo dominio.'
    },
    category: 'title',
    price: 2500,
    icon: 'Award',
    color: 'gold',
    rarity: 'legendary',
    sortOrder: 63
  },
  {
    name: 'Ranked Predator',
    nameTranslations: {
      fr: 'Prédateur Ranked',
      en: 'Ranked Predator',
      de: 'Ranglistenraubtier',
      it: 'Predatore Ranked'
    },
    description: 'Tu chasses tes proies dans le classement. Aucune échappatoire.',
    descriptionTranslations: {
      fr: 'Tu chasses tes proies dans le classement. Aucune échappatoire.',
      en: 'You hunt your prey in the rankings. No escape.',
      de: 'Du jagst deine Beute in den Rankings. Kein Entkommen.',
      it: 'Cacci le tue prede nella classifica. Nessuna via di fuga.'
    },
    category: 'title',
    price: 1500,
    icon: 'Target',
    color: 'red',
    rarity: 'epic',
    sortOrder: 64
  },
  {
    name: 'Unranked Terror',
    nameTranslations: {
      fr: 'Terreur des Ranked',
      en: 'Unranked Terror',
      de: 'Schrecken der Unranked',
      it: 'Terrore degli Unranked'
    },
    description: 'Même sans rang, tu fais trembler les classements.',
    descriptionTranslations: {
      fr: 'Même sans rang, tu fais trembler les classements.',
      en: 'Even without rank, you make the rankings tremble.',
      de: 'Selbst ohne Rang bringst du die Ranglisten zum Zittern.',
      it: 'Anche senza grado, fai tremare le classifiche.'
    },
    category: 'title',
    price: 700,
    icon: 'Skull',
    color: 'gray',
    rarity: 'common',
    sortOrder: 65
  },
  {
    name: 'Season Champion',
    nameTranslations: {
      fr: 'Champion de Saison',
      en: 'Season Champion',
      de: 'Saisonchampion',
      it: 'Campione di Stagione'
    },
    description: 'Tu as dominé toute une saison. Légende vivante.',
    descriptionTranslations: {
      fr: 'Tu as dominé toute une saison. Légende vivante.',
      en: 'You dominated an entire season. Living legend.',
      de: 'Du hast eine ganze Saison dominiert. Lebende Legende.',
      it: 'Hai dominato un\'intera stagione. Leggenda vivente.'
    },
    category: 'title',
    price: 4000,
    icon: 'Trophy',
    color: 'yellow',
    rarity: 'legendary',
    sortOrder: 66
  },
  {
    name: 'Winstreak Warrior',
    nameTranslations: {
      fr: 'Guerrier Invaincu',
      en: 'Winstreak Warrior',
      de: 'Siegesserie-Krieger',
      it: 'Guerriero Invitto'
    },
    description: 'Ta série de victoires est légendaire. Imbattable.',
    descriptionTranslations: {
      fr: 'Ta série de victoires est légendaire. Imbattable.',
      en: 'Your winstreak is legendary. Unbeatable.',
      de: 'Deine Siegesserie ist legendär. Unschlagbar.',
      it: 'La tua serie di vittorie è leggendaria. Imbattibile.'
    },
    category: 'title',
    price: 1300,
    icon: 'Flame',
    color: 'orange',
    rarity: 'epic',
    sortOrder: 67
  }
];

// ==================== STRICKER MODE PROFILE ANIMATIONS ====================
const strickerAnimations = [
  {
    name: 'Slot Machine Fever',
    nameTranslations: {
      fr: 'Fièvre du Jackpot',
      en: 'Slot Machine Fever',
      de: 'Spielautomat Fieber',
      it: 'Febbre della Slot'
    },
    description: 'Effet casino éblouissant avec pièces d\'or tombantes',
    descriptionTranslations: {
      fr: 'Effet casino éblouissant avec pièces d\'or tombantes',
      en: 'Dazzling casino effect with falling gold coins',
      de: 'Blendender Casino-Effekt mit fallenden Goldmünzen',
      it: 'Effetto casinò abbagliante con monete d\'oro che cadono'
    },
    category: 'profile_animation',
    price: 2800,
    rarity: 'legendary',
    icon: 'Coins',
    color: 'yellow',
    profileAnimationData: {
      animationName: 'profile-slot-machine',
      backgroundEffect: 'radial-gradient(ellipse at center, rgba(251,191,36,0.4) 0%, rgba(217,119,6,0.25) 40%, transparent 70%)',
      particleEffect: 'coins',
      borderEffect: 'border-golden-pulse',
      glowEffect: 'rgba(251, 191, 36, 0.7)'
    }
  },
  {
    name: 'Lucky Clover',
    nameTranslations: {
      fr: 'Trèfle Chanceux',
      en: 'Lucky Clover',
      de: 'Glücksklee',
      it: 'Quadrifoglio Fortunato'
    },
    description: 'Aura de chance pure avec trèfles scintillants',
    descriptionTranslations: {
      fr: 'Aura de chance pure avec trèfles scintillants',
      en: 'Pure luck aura with sparkling clovers',
      de: 'Reine Glücksaura mit funkelnden Kleeblättern',
      it: 'Aura di pura fortuna con quadrifogli scintillanti'
    },
    category: 'profile_animation',
    price: 2200,
    rarity: 'epic',
    icon: 'Clover',
    color: 'green',
    profileAnimationData: {
      animationName: 'profile-lucky-clover',
      backgroundEffect: 'radial-gradient(ellipse at center, rgba(34,197,94,0.35) 0%, rgba(22,163,74,0.2) 50%, transparent 70%)',
      particleEffect: 'clover',
      borderEffect: 'border-luck',
      glowEffect: 'rgba(34, 197, 94, 0.6)'
    }
  },
  {
    name: 'Diamond Rush',
    nameTranslations: {
      fr: 'Pluie de Diamants',
      en: 'Diamond Rush',
      de: 'Diamantregen',
      it: 'Pioggia di Diamanti'
    },
    description: 'Des diamants scintillants pleuvent sur ton profil',
    descriptionTranslations: {
      fr: 'Des diamants scintillants pleuvent sur ton profil',
      en: 'Sparkling diamonds rain on your profile',
      de: 'Funkelnde Diamanten regnen auf dein Profil',
      it: 'Diamanti scintillanti piovono sul tuo profilo'
    },
    category: 'profile_animation',
    price: 3200,
    rarity: 'legendary',
    icon: 'Diamond',
    color: 'cyan',
    profileAnimationData: {
      animationName: 'profile-diamond-rush',
      backgroundEffect: 'radial-gradient(ellipse at center, rgba(103,232,249,0.35) 0%, rgba(34,211,238,0.2) 50%, transparent 70%)',
      particleEffect: 'diamond',
      borderEffect: 'border-diamond',
      glowEffect: 'rgba(103, 232, 249, 0.7)'
    }
  },
  {
    name: 'Fortune Wheel',
    nameTranslations: {
      fr: 'Roue de la Fortune',
      en: 'Fortune Wheel',
      de: 'Glücksrad',
      it: 'Ruota della Fortuna'
    },
    description: 'Effet hypnotique de roue tournante avec éclats dorés',
    descriptionTranslations: {
      fr: 'Effet hypnotique de roue tournante avec éclats dorés',
      en: 'Hypnotic spinning wheel effect with golden sparks',
      de: 'Hypnotischer Drehrad-Effekt mit goldenen Funken',
      it: 'Effetto ipnotico di ruota girevole con scintille dorate'
    },
    category: 'profile_animation',
    price: 1800,
    rarity: 'epic',
    icon: 'CircleDot',
    color: 'amber',
    profileAnimationData: {
      animationName: 'profile-fortune-wheel',
      backgroundEffect: 'conic-gradient(from 0deg, rgba(251,191,36,0.3), rgba(245,158,11,0.3), rgba(217,119,6,0.3), rgba(251,191,36,0.3))',
      particleEffect: 'sparkle-gold',
      borderEffect: 'border-spinning',
      glowEffect: 'rgba(245, 158, 11, 0.5)'
    }
  },
  {
    name: 'Rainbow Luck',
    nameTranslations: {
      fr: 'Chance Arc-en-Ciel',
      en: 'Rainbow Luck',
      de: 'Regenbogen-Glück',
      it: 'Fortuna Arcobaleno'
    },
    description: 'Un arc-en-ciel de chance enveloppe ton profil',
    descriptionTranslations: {
      fr: 'Un arc-en-ciel de chance enveloppe ton profil',
      en: 'A rainbow of luck wraps your profile',
      de: 'Ein Regenbogen des Glücks umhüllt dein Profil',
      it: 'Un arcobaleno di fortuna avvolge il tuo profilo'
    },
    category: 'profile_animation',
    price: 1500,
    rarity: 'rare',
    icon: 'Rainbow',
    color: 'pink',
    profileAnimationData: {
      animationName: 'profile-rainbow-luck',
      backgroundEffect: 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(249,115,22,0.2) 16%, rgba(234,179,8,0.2) 33%, rgba(34,197,94,0.2) 50%, rgba(59,130,246,0.2) 66%, rgba(139,92,246,0.2) 83%, rgba(236,72,153,0.2) 100%)',
      particleEffect: 'rainbow',
      borderEffect: 'border-rainbow',
      glowEffect: 'rgba(168, 85, 247, 0.4)'
    }
  }
];

// ==================== RANKED MODE PROFILE ANIMATIONS ====================
const rankedAnimations = [
  {
    name: 'Champion\'s Glory',
    nameTranslations: {
      fr: 'Gloire du Champion',
      en: 'Champion\'s Glory',
      de: 'Ruhm des Champions',
      it: 'Gloria del Campione'
    },
    description: 'Aura victorieuse dorée avec couronne lumineuse',
    descriptionTranslations: {
      fr: 'Aura victorieuse dorée avec couronne lumineuse',
      en: 'Golden victorious aura with luminous crown',
      de: 'Goldene siegreiche Aura mit leuchtender Krone',
      it: 'Aura vittoriosa dorata con corona luminosa'
    },
    category: 'profile_animation',
    price: 3500,
    rarity: 'legendary',
    icon: 'Crown',
    color: 'yellow',
    profileAnimationData: {
      animationName: 'profile-champion-glory',
      backgroundEffect: 'radial-gradient(ellipse at top, rgba(251,191,36,0.5) 0%, rgba(234,179,8,0.3) 30%, transparent 60%)',
      particleEffect: 'crown-sparkle',
      borderEffect: 'border-champion',
      glowEffect: 'rgba(251, 191, 36, 0.8)'
    }
  },
  {
    name: 'Rank Up Surge',
    nameTranslations: {
      fr: 'Surge de Rang',
      en: 'Rank Up Surge',
      de: 'Rangaufstiegswelle',
      it: 'Ondata di Grado'
    },
    description: 'Énergie ascendante symbolisant ta montée en puissance',
    descriptionTranslations: {
      fr: 'Énergie ascendante symbolisant ta montée en puissance',
      en: 'Rising energy symbolizing your power climb',
      de: 'Aufsteigende Energie, die deinen Machtaufstieg symbolisiert',
      it: 'Energia ascendente che simboleggia la tua ascesa al potere'
    },
    category: 'profile_animation',
    price: 2000,
    rarity: 'epic',
    icon: 'TrendingUp',
    color: 'green',
    profileAnimationData: {
      animationName: 'profile-rank-surge',
      backgroundEffect: 'linear-gradient(to top, rgba(34,197,94,0.4) 0%, rgba(16,185,129,0.2) 50%, transparent 100%)',
      particleEffect: 'rising-arrows',
      borderEffect: 'border-ascending',
      glowEffect: 'rgba(34, 197, 94, 0.6)'
    }
  },
  {
    name: 'Diamond Division',
    nameTranslations: {
      fr: 'Division Diamant',
      en: 'Diamond Division',
      de: 'Diamant-Division',
      it: 'Divisione Diamante'
    },
    description: 'Éclat de diamant pur pour l\'élite du classement',
    descriptionTranslations: {
      fr: 'Éclat de diamant pur pour l\'élite du classement',
      en: 'Pure diamond brilliance for the ranking elite',
      de: 'Reiner Diamantglanz für die Ranglistenelite',
      it: 'Brillantezza di diamante puro per l\'élite della classifica'
    },
    category: 'profile_animation',
    price: 3000,
    rarity: 'legendary',
    icon: 'Diamond',
    color: 'cyan',
    profileAnimationData: {
      animationName: 'profile-diamond-division',
      backgroundEffect: 'radial-gradient(ellipse at center, rgba(6,182,212,0.4) 0%, rgba(34,211,238,0.25) 40%, transparent 70%)',
      particleEffect: 'diamond-elite',
      borderEffect: 'border-diamond-rank',
      glowEffect: 'rgba(6, 182, 212, 0.7)'
    }
  },
  {
    name: 'Victory Flames',
    nameTranslations: {
      fr: 'Flammes de Victoire',
      en: 'Victory Flames',
      de: 'Siegesflammen',
      it: 'Fiamme della Vittoria'
    },
    description: 'Flammes ardentes symbolisant ta série de victoires',
    descriptionTranslations: {
      fr: 'Flammes ardentes symbolisant ta série de victoires',
      en: 'Blazing flames symbolizing your winning streak',
      de: 'Lodernde Flammen, die deine Siegesserie symbolisieren',
      it: 'Fiamme ardenti che simboleggiano la tua serie di vittorie'
    },
    category: 'profile_animation',
    price: 2500,
    rarity: 'epic',
    icon: 'Flame',
    color: 'orange',
    profileAnimationData: {
      animationName: 'profile-victory-flames',
      backgroundEffect: 'radial-gradient(ellipse at bottom, rgba(249,115,22,0.5) 0%, rgba(234,88,12,0.3) 40%, transparent 70%)',
      particleEffect: 'victory-fire',
      borderEffect: 'border-victory',
      glowEffect: 'rgba(249, 115, 22, 0.7)'
    }
  },
  {
    name: 'Elo Master',
    nameTranslations: {
      fr: 'Maître de l\'ELO',
      en: 'Elo Master',
      de: 'ELO-Meister',
      it: 'Maestro dell\'ELO'
    },
    description: 'Aura numérique représentant ta maîtrise du système ELO',
    descriptionTranslations: {
      fr: 'Aura numérique représentant ta maîtrise du système ELO',
      en: 'Digital aura representing your ELO system mastery',
      de: 'Digitale Aura, die deine ELO-System-Meisterschaft darstellt',
      it: 'Aura digitale che rappresenta la tua padronanza del sistema ELO'
    },
    category: 'profile_animation',
    price: 1800,
    rarity: 'epic',
    icon: 'BarChart2',
    color: 'blue',
    profileAnimationData: {
      animationName: 'profile-elo-master',
      backgroundEffect: 'linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(37,99,235,0.2) 50%, rgba(29,78,216,0.3) 100%)',
      particleEffect: 'data-flow',
      borderEffect: 'border-digital',
      glowEffect: 'rgba(59, 130, 246, 0.5)'
    }
  },
  {
    name: 'Predator Instinct',
    nameTranslations: {
      fr: 'Instinct du Prédateur',
      en: 'Predator Instinct',
      de: 'Raubtierinstinkt',
      it: 'Istinto del Predatore'
    },
    description: 'Aura sombre et menaçante du prédateur ranked ultime',
    descriptionTranslations: {
      fr: 'Aura sombre et menaçante du prédateur ranked ultime',
      en: 'Dark and menacing aura of the ultimate ranked predator',
      de: 'Dunkle und bedrohliche Aura des ultimativen Ranglistenraubtiers',
      it: 'Aura oscura e minacciosa del predatore ranked definitivo'
    },
    category: 'profile_animation',
    price: 2800,
    rarity: 'legendary',
    icon: 'Eye',
    color: 'red',
    profileAnimationData: {
      animationName: 'profile-predator',
      backgroundEffect: 'radial-gradient(ellipse at center, rgba(220,38,38,0.4) 0%, rgba(127,29,29,0.3) 50%, rgba(0,0,0,0.4) 70%)',
      particleEffect: 'predator-eyes',
      borderEffect: 'border-predator',
      glowEffect: 'rgba(220, 38, 38, 0.6)'
    }
  },
  {
    name: 'Season Legend',
    nameTranslations: {
      fr: 'Légende de Saison',
      en: 'Season Legend',
      de: 'Saison-Legende',
      it: 'Leggenda di Stagione'
    },
    description: 'Animation prestigieuse pour les légendes de saison',
    descriptionTranslations: {
      fr: 'Animation prestigieuse pour les légendes de saison',
      en: 'Prestigious animation for season legends',
      de: 'Prestigeträchtige Animation für Saisonlegenden',
      it: 'Animazione prestigiosa per le leggende di stagione'
    },
    category: 'profile_animation',
    price: 4000,
    rarity: 'legendary',
    icon: 'Trophy',
    color: 'purple',
    profileAnimationData: {
      animationName: 'profile-season-legend',
      backgroundEffect: 'radial-gradient(ellipse at center, rgba(168,85,247,0.45) 0%, rgba(139,92,246,0.3) 35%, rgba(124,58,237,0.2) 60%, transparent 80%)',
      particleEffect: 'legendary-stars',
      borderEffect: 'border-legendary',
      glowEffect: 'rgba(168, 85, 247, 0.8)'
    }
  }
];

// Combine all items
const allTitles = [...strickerTitles, ...rankedTitles];
const allAnimations = [...strickerAnimations, ...rankedAnimations];

async function seedStrickerRankedItems() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    let titlesInserted = 0;
    let titlesSkipped = 0;
    let animationsInserted = 0;
    let animationsSkipped = 0;

    // Seed Titles
    console.log('🏷️  SEEDING STRICKER & RANKED TITLES...\n');
    console.log('─'.repeat(50));
    
    for (const titleData of allTitles) {
      const existing = await ShopItem.findOne({ 
        name: titleData.name, 
        category: 'title' 
      });
      
      if (existing) {
        console.log(`⏭️  Skipping "${titleData.name}": already exists`);
        titlesSkipped++;
        continue;
      }
      
      const item = new ShopItem({
        ...titleData,
        isActive: true,
        stock: -1,
        mode: 'all',
        allowMultiplePurchases: false
      });
      
      await item.save();
      console.log(`✨ Inserted "${titleData.name}" (${titleData.rarity}) - ${titleData.price} coins`);
      titlesInserted++;
    }

    console.log('\n' + '─'.repeat(50));
    console.log('🎬 SEEDING STRICKER & RANKED ANIMATIONS...\n');
    console.log('─'.repeat(50));

    // Seed Animations
    for (const animData of allAnimations) {
      const existing = await ShopItem.findOne({ 
        name: animData.name, 
        category: 'profile_animation' 
      });

      if (existing) {
        console.log(`⏭️  Skipping "${animData.name}": already exists`);
        animationsSkipped++;
        continue;
      }

      const newAnimation = new ShopItem({
        ...animData,
        isActive: true,
        mode: 'all',
        stock: -1,
        allowMultiplePurchases: false
      });

      await newAnimation.save();
      console.log(`🎨 Created animation: "${animData.name}" (${animData.rarity}) - ${animData.price} coins`);
      animationsInserted++;
    }

    console.log('\n' + '═'.repeat(50));
    console.log('🎉 SEEDING COMPLETE!');
    console.log('═'.repeat(50));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   🏷️  Titles inserted: ${titlesInserted}`);
    console.log(`   🏷️  Titles skipped: ${titlesSkipped}`);
    console.log(`   🎬 Animations inserted: ${animationsInserted}`);
    console.log(`   🎬 Animations skipped: ${animationsSkipped}`);
    console.log(`\n   📦 Total new items: ${titlesInserted + animationsInserted}`);
    console.log('═'.repeat(50) + '\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding items:', error);
    process.exit(1);
  }
}

seedStrickerRankedItems();
