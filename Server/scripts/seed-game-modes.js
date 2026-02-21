import mongoose from 'mongoose';
import dotenv from 'dotenv';
import AppSettings from '../src/models/AppSettings.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nomercy';

const gameModes = [
  // ==================== SIMPLE MODES ====================
  {
    id: 'duel-1v1',
    name: {
      fr: 'Duel 1v1',
      en: 'Duel 1v1',
      de: 'Duell 1v1',
      it: 'Duello 1v1'
    },
    icon: '⚔',
    type: 'simple',
    enabled: true,
    minPlayers: 1,
    maxPlayers: 1,
    rules: {
      fr: 'Affrontement en 1 contre 1. Le premier à remporter le nombre de manches requis gagne.',
      en: '1 versus 1 showdown. First to win the required number of rounds wins.',
      de: '1 gegen 1 Duell. Wer zuerst die erforderliche Anzahl an Runden gewinnt, gewinnt.',
      it: 'Scontro 1 contro 1. Il primo a vincere il numero di round richiesti vince.'
    }
  },
  {
    id: 'snd-2v2',
    name: {
      fr: 'Recherche & Destruction 2v2',
      en: 'Search & Destroy 2v2',
      de: 'Suchen & Zerstören 2v2',
      it: 'Cerca e Distruggi 2v2'
    },
    icon: '💣',
    type: 'simple',
    enabled: true,
    minPlayers: 2,
    maxPlayers: 2,
    rules: {
      fr: 'Mode Recherche & Destruction en équipe de 2. Plantez ou désamorcez la bombe pour gagner.',
      en: 'Search & Destroy mode in teams of 2. Plant or defuse the bomb to win.',
      de: 'Suchen & Zerstören Modus in 2er Teams. Platziere oder entschärfe die Bombe um zu gewinnen.',
      it: 'Modalità Cerca e Distruggi in squadre da 2. Pianta o disinnesca la bomba per vincere.'
    }
  },
  {
    id: 'snd-3v3',
    name: {
      fr: 'Recherche & Destruction 3v3',
      en: 'Search & Destroy 3v3',
      de: 'Suchen & Zerstören 3v3',
      it: 'Cerca e Distruggi 3v3'
    },
    icon: '💣',
    type: 'simple',
    enabled: true,
    minPlayers: 3,
    maxPlayers: 3,
    rules: {
      fr: 'Mode Recherche & Destruction en équipe de 3. Plantez ou désamorcez la bombe pour gagner.',
      en: 'Search & Destroy mode in teams of 3. Plant or defuse the bomb to win.',
      de: 'Suchen & Zerstören Modus in 3er Teams. Platziere oder entschärfe die Bombe um zu gewinnen.',
      it: 'Modalità Cerca e Distruggi in squadre da 3. Pianta o disinnesca la bomba per vincere.'
    }
  },
  {
    id: 'snd-4v4',
    name: {
      fr: 'Recherche & Destruction 4v4',
      en: 'Search & Destroy 4v4',
      de: 'Suchen & Zerstören 4v4',
      it: 'Cerca e Distruggi 4v4'
    },
    icon: '💣',
    type: 'simple',
    enabled: true,
    minPlayers: 4,
    maxPlayers: 4,
    rules: {
      fr: 'Mode Recherche & Destruction en équipe de 4. Format CDL. Plantez ou désamorcez la bombe pour gagner.',
      en: 'Search & Destroy mode in teams of 4. CDL format. Plant or defuse the bomb to win.',
      de: 'Suchen & Zerstören Modus in 4er Teams. CDL Format. Platziere oder entschärfe die Bombe um zu gewinnen.',
      it: 'Modalità Cerca e Distruggi in squadre da 4. Formato CDL. Pianta o disinnesca la bomba per vincere.'
    }
  },
  {
    id: 'snd-5v5',
    name: {
      fr: 'Recherche & Destruction 5v5',
      en: 'Search & Destroy 5v5',
      de: 'Suchen & Zerstören 5v5',
      it: 'Cerca e Distruggi 5v5'
    },
    icon: '💣',
    type: 'simple',
    enabled: true,
    minPlayers: 5,
    maxPlayers: 5,
    rules: {
      fr: 'Mode Recherche & Destruction en équipe de 5. Plantez ou désamorcez la bombe pour gagner.',
      en: 'Search & Destroy mode in teams of 5. Plant or defuse the bomb to win.',
      de: 'Suchen & Zerstören Modus in 5er Teams. Platziere oder entschärfe die Bombe um zu gewinnen.',
      it: 'Modalità Cerca e Distruggi in squadre da 5. Pianta o disinnesca la bomba per vincere.'
    }
  },

  // ==================== HARDCORE MODES ====================
  {
    id: 'duel-1v1-hardcore',
    name: {
      fr: 'Duel 1v1',
      en: 'Duel 1v1',
      de: 'Duell 1v1',
      it: 'Duello 1v1'
    },
    icon: '⚔',
    type: 'hardcore',
    enabled: true,
    minPlayers: 1,
    maxPlayers: 1,
    rules: {
      fr: 'Affrontement classé en 1 contre 1. Le premier à remporter le nombre de manches requis gagne. XP et statistiques comptabilisés.',
      en: 'Ranked 1 versus 1 showdown. First to win the required number of rounds wins. XP and stats tracked.',
      de: 'Ranked 1 gegen 1 Duell. Wer zuerst die erforderliche Anzahl an Runden gewinnt, gewinnt. XP und Statistiken werden gezählt.',
      it: 'Scontro classificato 1 contro 1. Il primo a vincere il numero di round richiesti vince. XP e statistiche tracciate.'
    }
  },
  {
    id: 'snd-2v2-hardcore',
    name: {
      fr: 'Recherche & Destruction 2v2',
      en: 'Search & Destroy 2v2',
      de: 'Suchen & Zerstören 2v2',
      it: 'Cerca e Distruggi 2v2'
    },
    icon: '💣',
    type: 'hardcore',
    enabled: true,
    minPlayers: 2,
    maxPlayers: 2,
    rules: {
      fr: 'Mode Recherche & Destruction classé en équipe de 2. XP et statistiques comptabilisés.',
      en: 'Ranked Search & Destroy mode in teams of 2. XP and stats tracked.',
      de: 'Ranked Suchen & Zerstören Modus in 2er Teams. XP und Statistiken werden gezählt.',
      it: 'Modalità Cerca e Distruggi classificata in squadre da 2. XP e statistiche tracciate.'
    }
  },
  {
    id: 'snd-3v3-hardcore',
    name: {
      fr: 'Recherche & Destruction 3v3',
      en: 'Search & Destroy 3v3',
      de: 'Suchen & Zerstören 3v3',
      it: 'Cerca e Distruggi 3v3'
    },
    icon: '💣',
    type: 'hardcore',
    enabled: true,
    minPlayers: 3,
    maxPlayers: 3,
    rules: {
      fr: 'Mode Recherche & Destruction classé en équipe de 3. XP et statistiques comptabilisés.',
      en: 'Ranked Search & Destroy mode in teams of 3. XP and stats tracked.',
      de: 'Ranked Suchen & Zerstören Modus in 3er Teams. XP und Statistiken werden gezählt.',
      it: 'Modalità Cerca e Distruggi classificata in squadre da 3. XP e statistiche tracciate.'
    }
  },
  {
    id: 'snd-4v4-hardcore',
    name: {
      fr: 'Recherche & Destruction 4v4',
      en: 'Search & Destroy 4v4',
      de: 'Suchen & Zerstören 4v4',
      it: 'Cerca e Distruggi 4v4'
    },
    icon: '💣',
    type: 'hardcore',
    enabled: true,
    minPlayers: 4,
    maxPlayers: 4,
    rules: {
      fr: 'Mode Recherche & Destruction classé en équipe de 4. Format CDL. XP et statistiques comptabilisés.',
      en: 'Ranked Search & Destroy mode in teams of 4. CDL format. XP and stats tracked.',
      de: 'Ranked Suchen & Zerstören Modus in 4er Teams. CDL Format. XP und Statistiken werden gezählt.',
      it: 'Modalità Cerca e Distruggi classificata in squadre da 4. Formato CDL. XP e statistiche tracciate.'
    }
  },
  {
    id: 'snd-5v5-hardcore',
    name: {
      fr: 'Recherche & Destruction 5v5',
      en: 'Search & Destroy 5v5',
      de: 'Suchen & Zerstören 5v5',
      it: 'Cerca e Distruggi 5v5'
    },
    icon: '💣',
    type: 'hardcore',
    enabled: true,
    minPlayers: 5,
    maxPlayers: 5,
    rules: {
      fr: 'Mode Recherche & Destruction classé en équipe de 5. XP et statistiques comptabilisés.',
      en: 'Ranked Search & Destroy mode in teams of 5. XP and stats tracked.',
      de: 'Ranked Suchen & Zerstören Modus in 5er Teams. XP und Statistiken werden gezählt.',
      it: 'Modalità Cerca e Distruggi classificata in squadre da 5. XP e statistiche tracciate.'
    }
  }
];

async function seedGameModes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!\n');

    // Get or create AppSettings
    let settings = await AppSettings.findOne();
    if (!settings) {
      settings = new AppSettings();
    }

    // Set game modes
    settings.lobbyGameModes = gameModes;
    settings.markModified('lobbyGameModes');
    
    await settings.save();

    console.log('✅ Game modes seeded successfully!\n');
    console.log('Modes created:');
    console.log('─────────────────────────────────────────────────');
    
    console.log('\n📋 SIMPLE (Casual):');
    gameModes.filter(m => m.type === 'simple').forEach(mode => {
      console.log(`   • ${mode.name.en} [${mode.minPlayers === mode.maxPlayers ? mode.minPlayers + ' player(s)' : mode.minPlayers + '-' + mode.maxPlayers + ' players'}]`);
    });
    
    console.log('\n🔥 HARDCORE (Ranked):');
    gameModes.filter(m => m.type === 'hardcore').forEach(mode => {
      console.log(`   • ${mode.name.en} [${mode.minPlayers === mode.maxPlayers ? mode.minPlayers + ' player(s)' : mode.minPlayers + '-' + mode.maxPlayers + ' players'}]`);
    });

    console.log('\n─────────────────────────────────────────────────');
    console.log(`Total: ${gameModes.length} game modes`);

  } catch (error) {
    console.error('❌ Error seeding game modes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

seedGameModes();
