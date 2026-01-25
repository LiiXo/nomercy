import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ShopItem from '../src/models/ShopItem.js';

dotenv.config();

const profileAnimations = [
  {
    name: 'Inferno',
    description: 'Unleash the flames of war with this fiery profile animation',
    nameTranslations: {
      fr: 'Inferno',
      en: 'Inferno',
      de: 'Inferno',
      it: 'Inferno'
    },
    descriptionTranslations: {
      fr: 'Libérez les flammes de la guerre avec cette animation de profil enflammée',
      en: 'Unleash the flames of war with this fiery profile animation',
      de: 'Entfesseln Sie die Flammen des Krieges mit dieser feurigen Profilanimation',
      it: 'Scatena le fiamme della guerra con questa animazione del profilo infuocata'
    },
    category: 'profile_animation',
    price: 2500,
    rarity: 'legendary',
    icon: 'Flame',
    color: 'orange',
    profileAnimationData: {
      animationName: 'profile-inferno',
      backgroundEffect: 'radial-gradient(ellipse at center, rgba(255,100,0,0.3) 0%, transparent 70%)',
      particleEffect: 'fire',
      borderEffect: 'border-fire',
      glowEffect: 'rgba(255, 100, 0, 0.6)'
    }
  },
  {
    name: 'Arctic Storm',
    description: 'Embrace the cold with this icy blizzard effect',
    nameTranslations: {
      fr: 'Tempête Arctique',
      en: 'Arctic Storm',
      de: 'Arktischer Sturm',
      it: 'Tempesta Artica'
    },
    descriptionTranslations: {
      fr: 'Embrassez le froid avec cet effet de blizzard glacé',
      en: 'Embrace the cold with this icy blizzard effect',
      de: 'Umarmen Sie die Kälte mit diesem eisigen Blizzard-Effekt',
      it: 'Abbraccia il freddo con questo effetto blizzard ghiacciato'
    },
    category: 'profile_animation',
    price: 2000,
    rarity: 'epic',
    icon: 'Snowflake',
    color: 'cyan',
    profileAnimationData: {
      animationName: 'profile-arctic',
      backgroundEffect: 'radial-gradient(ellipse at center, rgba(0,200,255,0.25) 0%, transparent 70%)',
      particleEffect: 'snow',
      borderEffect: 'border-ice',
      glowEffect: 'rgba(0, 200, 255, 0.5)'
    }
  },
  {
    name: 'Nuke Incoming',
    description: 'The ultimate killstreak - nuclear radiation effect',
    nameTranslations: {
      fr: 'Nuke en Approche',
      en: 'Nuke Incoming',
      de: 'Nuke im Anflug',
      it: 'Nuke in Arrivo'
    },
    descriptionTranslations: {
      fr: 'La série de kills ultime - effet de radiation nucléaire',
      en: 'The ultimate killstreak - nuclear radiation effect',
      de: 'Der ultimative Killstreak - Nuklearstrahlungseffekt',
      it: 'La serie di uccisioni definitiva - effetto radiazioni nucleari'
    },
    category: 'profile_animation',
    price: 3000,
    rarity: 'legendary',
    icon: 'Radiation',
    color: 'yellow',
    profileAnimationData: {
      animationName: 'profile-nuke',
      backgroundEffect: 'radial-gradient(ellipse at center, rgba(255,255,0,0.3) 0%, rgba(255,150,0,0.2) 50%, transparent 70%)',
      particleEffect: 'radiation',
      borderEffect: 'border-nuke',
      glowEffect: 'rgba(255, 255, 0, 0.6)'
    }
  },
  {
    name: 'Dark Aether',
    description: 'Corrupted by the Dark Aether dimension',
    nameTranslations: {
      fr: 'Éther Noir',
      en: 'Dark Aether',
      de: 'Dunkler Äther',
      it: 'Etere Oscuro'
    },
    descriptionTranslations: {
      fr: 'Corrompu par la dimension de l\'Éther Noir',
      en: 'Corrupted by the Dark Aether dimension',
      de: 'Korrumpiert durch die Dunkle Äther-Dimension',
      it: 'Corrotto dalla dimensione dell\'Etere Oscuro'
    },
    category: 'profile_animation',
    price: 2800,
    rarity: 'legendary',
    icon: 'Ghost',
    color: 'purple',
    profileAnimationData: {
      animationName: 'profile-dark-aether',
      backgroundEffect: 'radial-gradient(ellipse at center, rgba(147,51,234,0.35) 0%, rgba(88,28,135,0.2) 50%, transparent 70%)',
      particleEffect: 'aether',
      borderEffect: 'border-aether',
      glowEffect: 'rgba(147, 51, 234, 0.6)'
    }
  },
  {
    name: 'Tactical Neon',
    description: 'High-tech cyberpunk tactical display',
    nameTranslations: {
      fr: 'Néon Tactique',
      en: 'Tactical Neon',
      de: 'Taktisches Neon',
      it: 'Neon Tattico'
    },
    descriptionTranslations: {
      fr: 'Affichage tactique cyberpunk haute technologie',
      en: 'High-tech cyberpunk tactical display',
      de: 'High-Tech Cyberpunk taktische Anzeige',
      it: 'Display tattico cyberpunk ad alta tecnologia'
    },
    category: 'profile_animation',
    price: 1800,
    rarity: 'epic',
    icon: 'Cpu',
    color: 'green',
    profileAnimationData: {
      animationName: 'profile-tactical',
      backgroundEffect: 'linear-gradient(135deg, rgba(0,255,100,0.1) 0%, transparent 50%, rgba(0,200,255,0.1) 100%)',
      particleEffect: 'scan',
      borderEffect: 'border-tactical',
      glowEffect: 'rgba(0, 255, 100, 0.4)'
    }
  },
  {
    name: 'Blood Moon',
    description: 'The night hunter rises under the blood moon',
    nameTranslations: {
      fr: 'Lune de Sang',
      en: 'Blood Moon',
      de: 'Blutmond',
      it: 'Luna di Sangue'
    },
    descriptionTranslations: {
      fr: 'Le chasseur de nuit se lève sous la lune de sang',
      en: 'The night hunter rises under the blood moon',
      de: 'Der Nachtjäger erhebt sich unter dem Blutmond',
      it: 'Il cacciatore notturno sorge sotto la luna di sangue'
    },
    category: 'profile_animation',
    price: 2200,
    rarity: 'epic',
    icon: 'Moon',
    color: 'red',
    profileAnimationData: {
      animationName: 'profile-blood-moon',
      backgroundEffect: 'radial-gradient(ellipse at top, rgba(220,38,38,0.3) 0%, rgba(127,29,29,0.2) 50%, transparent 70%)',
      particleEffect: 'blood',
      borderEffect: 'border-blood',
      glowEffect: 'rgba(220, 38, 38, 0.5)'
    }
  },
  {
    name: 'Electric Surge',
    description: 'Overcharged with pure electrical energy',
    nameTranslations: {
      fr: 'Surge Électrique',
      en: 'Electric Surge',
      de: 'Elektrischer Stoß',
      it: 'Scarica Elettrica'
    },
    descriptionTranslations: {
      fr: 'Surchargé d\'énergie électrique pure',
      en: 'Overcharged with pure electrical energy',
      de: 'Überladen mit reiner elektrischer Energie',
      it: 'Sovraccaricato di pura energia elettrica'
    },
    category: 'profile_animation',
    price: 1500,
    rarity: 'rare',
    icon: 'Zap',
    color: 'blue',
    profileAnimationData: {
      animationName: 'profile-electric',
      backgroundEffect: 'radial-gradient(ellipse at center, rgba(59,130,246,0.25) 0%, transparent 60%)',
      particleEffect: 'electric',
      borderEffect: 'border-electric',
      glowEffect: 'rgba(59, 130, 246, 0.5)'
    }
  },
  {
    name: 'Phantom',
    description: 'Silent and deadly - become invisible',
    nameTranslations: {
      fr: 'Fantôme',
      en: 'Phantom',
      de: 'Phantom',
      it: 'Fantasma'
    },
    descriptionTranslations: {
      fr: 'Silencieux et mortel - devenez invisible',
      en: 'Silent and deadly - become invisible',
      de: 'Leise und tödlich - werde unsichtbar',
      it: 'Silenzioso e mortale - diventa invisibile'
    },
    category: 'profile_animation',
    price: 1200,
    rarity: 'rare',
    icon: 'Eye',
    color: 'gray',
    profileAnimationData: {
      animationName: 'profile-phantom',
      backgroundEffect: 'radial-gradient(ellipse at center, rgba(150,150,150,0.2) 0%, transparent 60%)',
      particleEffect: 'smoke',
      borderEffect: 'border-phantom',
      glowEffect: 'rgba(150, 150, 150, 0.4)'
    }
  },
  {
    name: 'Golden Prestige',
    description: 'Maximum prestige achieved - golden glory',
    nameTranslations: {
      fr: 'Prestige Doré',
      en: 'Golden Prestige',
      de: 'Goldenes Prestige',
      it: 'Prestigio Dorato'
    },
    descriptionTranslations: {
      fr: 'Prestige maximum atteint - gloire dorée',
      en: 'Maximum prestige achieved - golden glory',
      de: 'Maximales Prestige erreicht - goldener Ruhm',
      it: 'Massimo prestigio raggiunto - gloria dorata'
    },
    category: 'profile_animation',
    price: 2500,
    rarity: 'legendary',
    icon: 'Crown',
    color: 'yellow',
    profileAnimationData: {
      animationName: 'profile-golden',
      backgroundEffect: 'radial-gradient(ellipse at center, rgba(251,191,36,0.3) 0%, rgba(217,119,6,0.2) 50%, transparent 70%)',
      particleEffect: 'sparkle',
      borderEffect: 'border-golden',
      glowEffect: 'rgba(251, 191, 36, 0.6)'
    }
  },
  {
    name: 'Warzone Drop',
    description: 'Dropping into the warzone - military deployment effect',
    nameTranslations: {
      fr: 'Largage Warzone',
      en: 'Warzone Drop',
      de: 'Warzone Abwurf',
      it: 'Lancio Warzone'
    },
    descriptionTranslations: {
      fr: 'Largage dans la zone de guerre - effet de déploiement militaire',
      en: 'Dropping into the warzone - military deployment effect',
      de: 'Abwurf in die Warzone - militärischer Einsatzeffekt',
      it: 'Lancio nella zona di guerra - effetto dispiegamento militare'
    },
    category: 'profile_animation',
    price: 1000,
    rarity: 'common',
    icon: 'Plane',
    color: 'slate',
    profileAnimationData: {
      animationName: 'profile-warzone',
      backgroundEffect: 'linear-gradient(180deg, rgba(100,116,139,0.2) 0%, transparent 50%)',
      particleEffect: 'dust',
      borderEffect: 'border-military',
      glowEffect: 'rgba(100, 116, 139, 0.4)'
    }
  }
];

async function seedProfileAnimations() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    for (const animation of profileAnimations) {
      // Check if animation already exists
      const existing = await ShopItem.findOne({ 
        name: animation.name, 
        category: 'profile_animation' 
      });

      if (existing) {
        console.log(`Animation "${animation.name}" already exists, skipping...`);
        continue;
      }

      const newAnimation = new ShopItem({
        ...animation,
        isActive: true,
        mode: 'all'
      });

      await newAnimation.save();
      console.log(`Created animation: ${animation.name} (${animation.rarity})`);
    }

    console.log('\nProfile animations seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding profile animations:', error);
    process.exit(1);
  }
}

seedProfileAnimations();
