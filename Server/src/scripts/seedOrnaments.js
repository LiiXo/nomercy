import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const seedOrnaments = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nomercy');
    console.log('Connected to MongoDB');

    const ShopItem = (await import('../models/ShopItem.js')).default;

    const ornaments = [
      {
        name: 'Flamme Dorée',
        description: 'Un ornement doré flamboyant pour les champions',
        category: 'ornament',
        price: 500,
        rarity: 'legendary',
        color: 'yellow',
        ornamentData: {
          borderColor: 'from-yellow-400 via-orange-500 to-red-500',
          glowColor: '0 0 25px rgba(251, 191, 36, 0.7)',
          borderWidth: 4,
          animated: true,
          animationType: 'glow'
        },
        sortOrder: 1
      },
      {
        name: 'Givre Arctique',
        description: 'Un ornement glacé aux reflets bleutés',
        category: 'ornament',
        price: 400,
        rarity: 'epic',
        color: 'cyan',
        ornamentData: {
          borderColor: 'from-cyan-400 via-blue-500 to-purple-500',
          glowColor: '0 0 20px rgba(6, 182, 212, 0.6)',
          borderWidth: 4,
          animated: false
        },
        sortOrder: 2
      },
      {
        name: 'Néon Violet',
        description: 'Un style cyberpunk avec des néons violets',
        category: 'ornament',
        price: 350,
        rarity: 'epic',
        color: 'purple',
        ornamentData: {
          borderColor: 'from-purple-500 via-pink-500 to-purple-500',
          glowColor: '0 0 20px rgba(168, 85, 247, 0.6)',
          borderWidth: 4,
          animated: true,
          animationType: 'pulse'
        },
        sortOrder: 3
      },
      {
        name: 'Emeraude',
        description: 'Un ornement vert émeraude élégant',
        category: 'ornament',
        price: 300,
        rarity: 'rare',
        color: 'green',
        ornamentData: {
          borderColor: 'from-green-400 via-emerald-500 to-teal-500',
          glowColor: '0 0 18px rgba(16, 185, 129, 0.5)',
          borderWidth: 4,
          animated: false
        },
        sortOrder: 4
      },
      {
        name: 'Sang Royal',
        description: 'Un ornement rouge sang pour les guerriers',
        category: 'ornament',
        price: 300,
        rarity: 'rare',
        color: 'red',
        ornamentData: {
          borderColor: 'from-red-500 via-red-600 to-orange-500',
          glowColor: '0 0 18px rgba(239, 68, 68, 0.5)',
          borderWidth: 4,
          animated: false
        },
        sortOrder: 5
      },
      {
        name: 'Argent Simple',
        description: 'Un ornement argenté sobre et élégant',
        category: 'ornament',
        price: 150,
        rarity: 'common',
        color: 'gray',
        ornamentData: {
          borderColor: 'from-gray-300 via-gray-400 to-gray-500',
          glowColor: '0 0 12px rgba(156, 163, 175, 0.4)',
          borderWidth: 3,
          animated: false
        },
        sortOrder: 6
      },
      {
        name: 'Bronze Antique',
        description: 'Un ornement bronze au style antique',
        category: 'ornament',
        price: 100,
        rarity: 'common',
        color: 'orange',
        ornamentData: {
          borderColor: 'from-orange-600 via-amber-600 to-yellow-700',
          glowColor: '0 0 10px rgba(180, 83, 9, 0.4)',
          borderWidth: 3,
          animated: false
        },
        sortOrder: 7
      },
      {
        name: 'Arc-en-ciel',
        description: 'Toutes les couleurs de l\'arc-en-ciel !',
        category: 'ornament',
        price: 750,
        rarity: 'legendary',
        color: 'pink',
        ornamentData: {
          borderColor: 'from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500',
          glowColor: '0 0 25px rgba(236, 72, 153, 0.6)',
          borderWidth: 4,
          animated: true,
          animationType: 'glow'
        },
        sortOrder: 0
      }
    ];

    // Delete existing ornaments
    await ShopItem.deleteMany({ category: 'ornament' });
    console.log('Deleted existing ornaments');

    // Insert new ornaments
    const result = await ShopItem.insertMany(ornaments);
    console.log(`Inserted ${result.length} ornaments`);

    console.log('Ornaments seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding ornaments:', error);
    process.exit(1);
  }
};

seedOrnaments();






















