/**
 * Script pour corriger les index de la collection GameModeRules
 * 
 * Ce script supprime l'ancien index unique sur 'mode' seul
 * et s'assure que seul l'index composite { mode, location, subType } existe
 * 
 * Usage: node scripts/fix-gamemoderules-index.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nomercy';

async function fixIndexes() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('gamemoderules');

    // Lister tous les index existants
    console.log('\n📋 Index existants:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log(`  - ${index.name}:`, index.key);
    });

    // Liste des anciens index à supprimer
    const oldIndexesToRemove = [
      'mode_1',           // ancien index sur mode seul
      'mode_1_location_1' // ancien index sans subType
    ];

    for (const indexName of oldIndexesToRemove) {
      try {
        const oldIndex = indexes.find(idx => idx.name === indexName);

        if (oldIndex) {
          console.log(`\n🗑️  Suppression de l'ancien index ${indexName}...`);
          await collection.dropIndex(indexName);
          console.log(`✅ Index ${indexName} supprimé`);
        } else {
          console.log(`\n✅ Pas d'ancien index ${indexName} trouvé`);
        }
      } catch (error) {
        if (error.code === 27 || error.message.includes('index not found')) {
          console.log(`✅ Index ${indexName} n'existe pas (déjà supprimé)`);
        } else {
          throw error;
        }
      }
    }

    // Vérifier que l'index composite existe
    const compositeIndex = indexes.find(idx => 
      idx.name === 'mode_1_location_1_subType_1' ||
      (idx.key.mode === 1 && idx.key.location === 1 && idx.key.subType === 1)
    );

    if (!compositeIndex) {
      console.log('\n📝 Création de l\'index composite { mode, location, subType }...');
      await collection.createIndex(
        { mode: 1, location: 1, subType: 1 },
        { unique: true, name: 'mode_1_location_1_subType_1' }
      );
      console.log('✅ Index composite créé');
    } else {
      console.log('\n✅ Index composite existe déjà');
    }

    // Lister les index finaux
    console.log('\n📋 Index finaux:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, index.key, index.unique ? '(unique)' : '');
    });

    console.log('\n✅ Correction terminée avec succès!');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Déconnecté de MongoDB');
  }
}

// Exécuter le script
fixIndexes();



















