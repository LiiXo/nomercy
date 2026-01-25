import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ShopItem from '../src/models/ShopItem.js';

dotenv.config();

const usableItems = [
  {
    name: 'Points Doublés',
    description: 'Double les points gagnés à la fin d\'un match classé pendant 3 matchs.',
    nameTranslations: {
      fr: 'Points Doublés',
      en: 'Double Points',
      de: 'Doppelte Punkte',
      it: 'Punti Raddoppiati'
    },
    descriptionTranslations: {
      fr: 'Double les points gagnés à la fin d\'un match classé pendant 3 matchs.',
      en: 'Doubles points earned at the end of a ranked match for 3 matches.',
      de: 'Verdoppelt die am Ende eines Ranglistenspiels verdienten Punkte für 3 Spiele.',
      it: 'Raddoppia i punti guadagnati alla fine di una partita classificata per 3 partite.'
    },
    category: 'usable_item',
    price: 500,
    icon: 'Zap',
    color: 'yellow',
    rarity: 'rare',
    isActive: true,
    mode: 'all',
    isUsable: true,
    effectType: 'double_pts',
    matchCount: 3, // 3 matches
    usableInMatch: false,
    allowMultiplePurchases: true,
    sortOrder: 1
  },
  {
    name: 'Golds Doublés',
    description: 'Double les golds gagnés à la fin d\'un match classé pendant 3 matchs.',
    nameTranslations: {
      fr: 'Golds Doublés',
      en: 'Double Gold',
      de: 'Doppeltes Gold',
      it: 'Oro Raddoppiato'
    },
    descriptionTranslations: {
      fr: 'Double les golds gagnés à la fin d\'un match classé pendant 3 matchs.',
      en: 'Doubles gold earned at the end of a ranked match for 3 matches.',
      de: 'Verdoppelt das am Ende eines Ranglistenspiels verdiente Gold für 3 Spiele.',
      it: 'Raddoppia l\'oro guadagnato alla fine di una partita classificata per 3 partite.'
    },
    category: 'usable_item',
    price: 500,
    icon: 'Coins',
    color: 'amber',
    rarity: 'rare',
    isActive: true,
    mode: 'all',
    isUsable: true,
    effectType: 'double_gold',
    matchCount: 3, // 3 matches
    usableInMatch: false,
    allowMultiplePurchases: true,
    sortOrder: 2
  }
];

async function seedUsableItems() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    for (const item of usableItems) {
      const existingItem = await ShopItem.findOne({ name: item.name, category: 'usable_item' });
      
      if (existingItem) {
        await ShopItem.findByIdAndUpdate(existingItem._id, item);
        console.log(`Updated: ${item.name}`);
      } else {
        await ShopItem.create(item);
        console.log(`Created: ${item.name}`);
      }
    }

    console.log('\nUsable items seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding usable items:', error);
    process.exit(1);
  }
}

seedUsableItems();
