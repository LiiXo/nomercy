import mongoose from 'mongoose';
import ShopItem from '../src/models/ShopItem.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined in .env file');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected for seeding shop titles'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const titles = [
  {
    name: 'Warzone Veteran',
    description: 'Un vétéran de Warzone qui a survécu à des centaines de batailles.',
    nameTranslations: {
      fr: 'Vétéran Warzone',
      en: 'Warzone Veteran',
      de: 'Warzone-Veteran',
      it: 'Veterano Warzone'
    },
    descriptionTranslations: {
      fr: 'Un vétéran de Warzone qui a survécu à des centaines de batailles.',
      en: 'A Warzone veteran who survived hundreds of battles.',
      de: 'Ein Warzone-Veteran, der Hunderte von Schlachten überlebt hat.',
      it: 'Un veterano di Warzone che è sopravvissuto a centinaia di battaglie.'
    },
    category: 'title',
    price: 500,
    icon: 'Shield',
    color: 'green',
    rarity: 'common',
    sortOrder: 1
  },
  {
    name: 'Ghost Operator',
    description: 'Silencieux, mortel, invisible. Un vrai fantôme sur le champ de bataille.',
    nameTranslations: {
      fr: 'Opérateur Fantôme',
      en: 'Ghost Operator',
      de: 'Geist-Operator',
      it: 'Operatore Fantasma'
    },
    descriptionTranslations: {
      fr: 'Silencieux, mortel, invisible. Un vrai fantôme sur le champ de bataille.',
      en: 'Silent, deadly, invisible. A true ghost on the battlefield.',
      de: 'Leise, tödlich, unsichtbar. Ein echter Geist auf dem Schlachtfeld.',
      it: 'Silenzioso, mortale, invisibile. Un vero fantasma sul campo di battaglia.'
    },
    category: 'title',
    price: 750,
    icon: 'Skull',
    color: 'gray',
    rarity: 'rare',
    sortOrder: 2
  },
  {
    name: 'Nuke Launcher',
    description: 'Celui qui a déclenché le chaos nucléaire. 25 kills sans mourir.',
    nameTranslations: {
      fr: 'Lanceur de Nuke',
      en: 'Nuke Launcher',
      de: 'Nuke-Starter',
      it: 'Lanciatore Nuke'
    },
    descriptionTranslations: {
      fr: 'Celui qui a déclenché le chaos nucléaire. 25 kills sans mourir.',
      en: 'The one who unleashed nuclear chaos. 25 kills without dying.',
      de: 'Derjenige, der das nukleare Chaos entfesselt hat. 25 Kills ohne zu sterben.',
      it: 'Colui che ha scatenato il caos nucleare. 25 uccisioni senza morire.'
    },
    category: 'title',
    price: 2000,
    icon: 'Zap',
    color: 'red',
    rarity: 'legendary',
    sortOrder: 3
  },
  {
    name: 'Quickscope Master',
    description: 'Maître du tir rapide à la lunette. Précision mortelle.',
    nameTranslations: {
      fr: 'Maître du Quickscope',
      en: 'Quickscope Master',
      de: 'Quickscope-Meister',
      it: 'Maestro del Quickscope'
    },
    descriptionTranslations: {
      fr: 'Maître du tir rapide à la lunette. Précision mortelle.',
      en: 'Master of quick scoping. Deadly precision.',
      de: 'Meister des schnellen Zielens. Tödliche Präzision.',
      it: 'Maestro del tiro rapido. Precisione mortale.'
    },
    category: 'title',
    price: 1000,
    icon: 'Target',
    color: 'blue',
    rarity: 'epic',
    sortOrder: 4
  },
  {
    name: 'Prestige Legend',
    description: 'A atteint le prestige ultime. Respect éternel.',
    nameTranslations: {
      fr: 'Légende Prestige',
      en: 'Prestige Legend',
      de: 'Prestige-Legende',
      it: 'Leggenda Prestigio'
    },
    descriptionTranslations: {
      fr: 'A atteint le prestige ultime. Respect éternel.',
      en: 'Reached the ultimate prestige. Eternal respect.',
      de: 'Hat das ultimative Prestige erreicht. Ewiger Respekt.',
      it: 'Ha raggiunto il prestigio definitivo. Rispetto eterno.'
    },
    category: 'title',
    price: 1500,
    icon: 'Crown',
    color: 'purple',
    rarity: 'epic',
    sortOrder: 5
  },
  {
    name: 'Hardpoint King',
    description: 'Le roi incontesté du Hardpoint. Maître de la zone.',
    nameTranslations: {
      fr: 'Roi du Hardpoint',
      en: 'Hardpoint King',
      de: 'Hardpoint-König',
      it: 'Re del Hardpoint'
    },
    descriptionTranslations: {
      fr: 'Le roi incontesté du Hardpoint. Maître de la zone.',
      en: 'The undisputed king of Hardpoint. Master of the zone.',
      de: 'Der unbestrittene König des Hardpoint. Meister der Zone.',
      it: 'Il re indiscusso del Hardpoint. Maestro della zona.'
    },
    category: 'title',
    price: 800,
    icon: 'Flame',
    color: 'orange',
    rarity: 'rare',
    sortOrder: 6
  },
  {
    name: 'Search & Destroy Pro',
    description: 'Spécialiste en Search & Destroy. Chaque round compte.',
    nameTranslations: {
      fr: 'Pro Search & Destroy',
      en: 'Search & Destroy Pro',
      de: 'Search & Destroy Profi',
      it: 'Pro Search & Destroy'
    },
    descriptionTranslations: {
      fr: 'Spécialiste en Search & Destroy. Chaque round compte.',
      en: 'Search & Destroy specialist. Every round counts.',
      de: 'Search & Destroy Spezialist. Jede Runde zählt.',
      it: 'Specialista Search & Destroy. Ogni round conta.'
    },
    category: 'title',
    price: 900,
    icon: 'Target',
    color: 'amber',
    rarity: 'rare',
    sortOrder: 7
  },
  {
    name: 'Demon Slayer',
    description: 'Terreur du lobby. Les démons tremblent à son approche.',
    nameTranslations: {
      fr: 'Tueur de Démons',
      en: 'Demon Slayer',
      de: 'Dämonentöter',
      it: 'Cacciatore di Demoni'
    },
    descriptionTranslations: {
      fr: 'Terreur du lobby. Les démons tremblent à son approche.',
      en: 'Terror of the lobby. Demons tremble at their approach.',
      de: 'Terror der Lobby. Dämonen zittern bei seiner Ankunft.',
      it: 'Terrore della lobby. I demoni tremano al suo avvicinarsi.'
    },
    category: 'title',
    price: 1200,
    icon: 'Skull',
    color: 'red',
    rarity: 'epic',
    sortOrder: 8
  },
  {
    name: 'CDL Champion',
    description: 'Champion de la Call of Duty League. L\'élite parmi l\'élite.',
    nameTranslations: {
      fr: 'Champion CDL',
      en: 'CDL Champion',
      de: 'CDL-Champion',
      it: 'Campione CDL'
    },
    descriptionTranslations: {
      fr: 'Champion de la Call of Duty League. L\'élite parmi l\'élite.',
      en: 'Call of Duty League Champion. The elite among the elite.',
      de: 'Call of Duty League Champion. Die Elite unter der Elite.',
      it: 'Campione della Call of Duty League. L\'élite tra l\'élite.'
    },
    category: 'title',
    price: 2500,
    icon: 'Trophy',
    color: 'yellow',
    rarity: 'legendary',
    sortOrder: 9
  },
  {
    name: 'No Mercy',
    description: 'Aucune pitié. Aucun survivant. Le titre ultime de NoMercy.',
    nameTranslations: {
      fr: 'Sans Pitié',
      en: 'No Mercy',
      de: 'Keine Gnade',
      it: 'Nessuna Pietà'
    },
    descriptionTranslations: {
      fr: 'Aucune pitié. Aucun survivant. Le titre ultime de NoMercy.',
      en: 'No mercy. No survivors. The ultimate NoMercy title.',
      de: 'Keine Gnade. Keine Überlebenden. Der ultimative NoMercy-Titel.',
      it: 'Nessuna pietà. Nessun sopravvissuto. Il titolo definitivo di NoMercy.'
    },
    category: 'title',
    price: 3000,
    icon: 'Flame',
    color: 'red',
    rarity: 'legendary',
    sortOrder: 10
  }
];

const seedTitles = async () => {
  try {
    console.log('Starting shop titles seeding...');
    console.log(`Will insert ${titles.length} titles.\n`);
    
    let insertedCount = 0;
    let skippedCount = 0;
    
    for (const titleData of titles) {
      // Check if title already exists
      const existing = await ShopItem.findOne({ 
        name: titleData.name, 
        category: 'title' 
      });
      
      if (existing) {
        console.log(`⏭️  Skipping "${titleData.name}": already exists`);
        skippedCount++;
        continue;
      }
      
      const item = new ShopItem({
        ...titleData,
        isActive: true,
        stock: -1, // Unlimited
        mode: 'all',
        allowMultiplePurchases: false
      });
      
      await item.save();
      console.log(`✅ Inserted "${titleData.name}" (${titleData.rarity}) - ${titleData.price} coins`);
      insertedCount++;
    }
    
    console.log(`\n========================================`);
    console.log(`Seeding complete:`);
    console.log(`  ✅ Inserted: ${insertedCount} titles`);
    console.log(`  ⏭️  Skipped: ${skippedCount} titles (already existed)`);
    console.log(`========================================`);
    
  } catch (error) {
    console.error('Error during seeding:', error);
  } finally {
    mongoose.disconnect();
  }
};

seedTitles();
