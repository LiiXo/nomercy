import dotenv from 'dotenv';
import mongoose from 'mongoose';
import GameModeRules from '../models/GameModeRules.js';

// Load environment variables
dotenv.config();

const seedGameModeRules = async () => {
  try {
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);

    // Clear existing rules
    await GameModeRules.deleteMany({});

    // Hardcore Mode Rules
    const hardcoreRules = new GameModeRules({
      mode: 'hardcore',
      title: {
        fr: 'Règles du Mode Hardcore',
        en: 'Hardcore Mode Rules',
        it: 'Regole Modalità Hardcore',
        de: 'Hardcore-Modus-Regeln'
      },
      sections: [
        {
          title: {
            fr: 'Vue d\'ensemble',
            en: 'Overview',
            it: 'Panoramica',
            de: 'Überblick'
          },
          content: {
            fr: '<h2>Bienvenue dans le mode Hardcore</h2><p>Le mode Hardcore est le mode de jeu le plus compétitif de NoMercy. Ici, chaque élimination compte et chaque erreur peut coûter cher à votre équipe.</p><ul><li><strong>Pas de régénération automatique</strong></li><li><strong>Dégâts réalistes</strong></li><li><strong>Interface minimale</strong></li></ul>',
            en: '<h2>Welcome to Hardcore Mode</h2><p>Hardcore mode is the most competitive game mode in NoMercy. Here, every elimination counts and every mistake can cost your team dearly.</p><ul><li><strong>No automatic regeneration</strong></li><li><strong>Realistic damage</strong></li><li><strong>Minimal interface</strong></li></ul>',
            it: '<h2>Benvenuto in Modalità Hardcore</h2><p>La modalità Hardcore è la modalità di gioco più competitiva di NoMercy. Qui, ogni eliminazione conta e ogni errore può costare caro alla tua squadra.</p><ul><li><strong>Nessuna rigenerazione automatica</strong></li><li><strong>Danni realistici</strong></li><li><strong>Interfaccia minima</strong></li></ul>',
            de: '<h2>Willkommen im Hardcore-Modus</h2><p>Der Hardcore-Modus ist der wettbewerbsfähigste Spielmodus in NoMercy. Hier zählt jede Eliminierung und jeder Fehler kann Ihr Team teuer zu stehen kommen.</p><ul><li><strong>Keine automatische Regeneration</strong></li><li><strong>Realistische Schäden</strong></li><li><strong>Minimale Oberfläche</strong></li></ul>'
          },
          order: 0,
          icon: 'gamepad'
        },
        {
          title: {
            fr: 'Règles de match',
            en: 'Match Rules',
            it: 'Regole di partita',
            de: 'Match-Regeln'
          },
          content: {
            fr: '<h3>Format de match</h3><p>Tous les matchs se jouent en <strong>Best of 3</strong> (BO3) sauf indication contraire.</p><h3 style="text-align: center;">⚔️ Configuration recommandée ⚔️</h3><ul><li>Mode de jeu: Search & Destroy</li><li>Nombre de rounds: 6</li><li>Temps par round: 90 secondes</li><li>Temps de bombe: 45 secondes</li></ul><p style="text-align: center;"><em>Les deux équipes doivent s\'accorder sur les paramètres avant le début du match.</em></p>',
            en: '<h3>Match Format</h3><p>All matches are played in <strong>Best of 3</strong> (BO3) unless otherwise specified.</p><h3 style="text-align: center;">⚔️ Recommended Configuration ⚔️</h3><ul><li>Game mode: Search & Destroy</li><li>Number of rounds: 6</li><li>Time per round: 90 seconds</li><li>Bomb time: 45 seconds</li></ul><p style="text-align: center;"><em>Both teams must agree on settings before the match starts.</em></p>',
            it: '<h3>Formato partita</h3><p>Tutte le partite si giocano in <strong>Best of 3</strong> (BO3) salvo diversa indicazione.</p><h3 style="text-align: center;">⚔️ Configurazione consigliata ⚔️</h3><ul><li>Modalità di gioco: Search & Destroy</li><li>Numero di round: 6</li><li>Tempo per round: 90 secondi</li><li>Tempo bomba: 45 secondi</li></ul><p style="text-align: center;"><em>Entrambe le squadre devono accordarsi sulle impostazioni prima dell\'inizio della partita.</em></p>',
            de: '<h3>Match-Format</h3><p>Alle Matches werden im <strong>Best of 3</strong> (BO3) gespielt, sofern nicht anders angegeben.</p><h3 style="text-align: center;">⚔️ Empfohlene Konfiguration ⚔️</h3><ul><li>Spielmodus: Search & Destroy</li><li>Anzahl der Runden: 6</li><li>Zeit pro Runde: 90 Sekunden</li><li>Bombenzeit: 45 Sekunden</li></ul><p style="text-align: center;"><em>Beide Teams müssen sich vor Spielbeginn auf die Einstellungen einigen.</em></p>'
          },
          order: 1,
          icon: 'trophy'
        },
        {
          title: {
            fr: 'Armes et équipements interdits',
            en: 'Banned Weapons and Equipment',
            it: 'Armi e equipaggiamento vietati',
            de: 'Verbotene Waffen und Ausrüstung'
          },
          content: {
            fr: '<h3 style="text-align: center;">🚫 Liste des interdictions 🚫</h3><ol><li><strong>Armes:</strong> Shotguns, LMGs</li><li><strong>Équipements letaux:</strong> Claymores, Proximity Mines</li><li><strong>Équipements tactiques:</strong> Stun Grenades (max 1 par joueur)</li><li><strong>Killstreaks:</strong> Tous les killstreaks au-dessus de 5 éliminations</li></ol><p><em>L\'utilisation d\'un élément banni entraînera la disqualification de la manche ou du match.</em></p>',
            en: '<h3 style="text-align: center;">🚫 Ban List 🚫</h3><ol><li><strong>Weapons:</strong> Shotguns, LMGs</li><li><strong>Lethal Equipment:</strong> Claymores, Proximity Mines</li><li><strong>Tactical Equipment:</strong> Stun Grenades (max 1 per player)</li><li><strong>Killstreaks:</strong> All killstreaks above 5 eliminations</li></ol><p><em>Using a banned item will result in round or match disqualification.</em></p>',
            it: '<h3 style="text-align: center;">🚫 Lista ban 🚫</h3><ol><li><strong>Armi:</strong> Shotgun, LMG</li><li><strong>Equipaggiamento letale:</strong> Claymore, Mine di prossimità</li><li><strong>Equipaggiamento tattico:</strong> Granate stordenti (max 1 per giocatore)</li><li><strong>Killstreak:</strong> Tutti i killstreak sopra le 5 eliminazioni</li></ol><p><em>L\'uso di un elemento vietato comporterà la squalifica del round o della partita.</em></p>',
            de: '<h3 style="text-align: center;">🚫 Verbotsliste 🚫</h3><ol><li><strong>Waffen:</strong> Schrotflinten, LMGs</li><li><strong>Tödliche Ausrüstung:</strong> Claymores, Näherungsminen</li><li><strong>Taktische Ausrüstung:</strong> Blendgranaten (max. 1 pro Spieler)</li><li><strong>Killstreaks:</strong> Alle Killstreaks über 5 Eliminierungen</li></ol><p><em>Die Verwendung eines verbotenen Gegenstands führt zur Disqualifikation der Runde oder des Matches.</em></p>'
          },
          order: 2,
          icon: 'ban'
        }
      ],
      isActive: true
    });

    // CDL Mode Rules
    const cdlRules = new GameModeRules({
      mode: 'cdl',
      title: {
        fr: 'Règles du Mode CDL',
        en: 'CDL Mode Rules',
        it: 'Regole Modalità CDL',
        de: 'CDL-Modus-Regeln'
      },
      sections: [
        {
          title: {
            fr: 'Format professionnel',
            en: 'Professional Format',
            it: 'Formato professionale',
            de: 'Professionelles Format'
          },
          content: {
            fr: '<h2 style="text-align: center;">Call of Duty League Format</h2><p>Le mode CDL suit les règles officielles de la Call of Duty League. Ce mode est réservé aux joueurs expérimentés cherchant une expérience compétitive de haut niveau.</p><h3>Caractéristiques principales:</h3><ul><li>Format <strong>Best of 5</strong> (BO5)</li><li>Rotation des modes de jeu (Hardpoint, S&D, Control)</li><li>Règles strictes de la CDL</li><li>Draft des maps</li></ul>',
            en: '<h2 style="text-align: center;">Call of Duty League Format</h2><p>CDL mode follows the official Call of Duty League rules. This mode is reserved for experienced players seeking a high-level competitive experience.</p><h3>Main features:</h3><ul><li><strong>Best of 5</strong> (BO5) format</li><li>Game mode rotation (Hardpoint, S&D, Control)</li><li>Strict CDL rules</li><li>Map draft</li></ul>',
            it: '<h2 style="text-align: center;">Formato Call of Duty League</h2><p>La modalità CDL segue le regole ufficiali della Call of Duty League. Questa modalità è riservata ai giocatori esperti che cercano un\'esperienza competitiva di alto livello.</p><h3>Caratteristiche principali:</h3><ul><li>Formato <strong>Best of 5</strong> (BO5)</li><li>Rotazione delle modalità di gioco (Hardpoint, S&D, Control)</li><li>Regole rigorose della CDL</li><li>Draft delle mappe</li></ul>',
            de: '<h2 style="text-align: center;">Call of Duty League Format</h2><p>Der CDL-Modus folgt den offiziellen Regeln der Call of Duty League. Dieser Modus ist erfahrenen Spielern vorbehalten, die ein hochrangiges Wettkampferlebnis suchen.</p><h3>Hauptmerkmale:</h3><ul><li><strong>Best of 5</strong> (BO5) Format</li><li>Spielmodus-Rotation (Hardpoint, S&D, Control)</li><li>Strenge CDL-Regeln</li><li>Karten-Draft</li></ul>'
          },
          order: 0,
          icon: 'star'
        },
        {
          title: {
            fr: 'Gentlemen\'s Agreements',
            en: 'Gentlemen\'s Agreements',
            it: 'Accordi tra gentiluomini',
            de: 'Gentlemen\'s Agreements'
          },
          content: {
            fr: '<p>En plus des règles officielles, les équipes professionnelles respectent des <strong>Gentlemen\'s Agreements</strong> (GA) pour maintenir l\'intégrité compétitive.</p><h3>GA actuels:</h3><ol><li>Pas de camping excessif</li><li>Respect des timeouts (1 par équipe par map)</li><li>Communication respectueuse</li><li>Acceptation des décisions d\'arbitrage</li></ol><p style="text-align: center;"><strong>Note:</strong> Le non-respect des GA peut entraîner des sanctions de la communauté.</p>',
            en: '<p>In addition to official rules, professional teams respect <strong>Gentlemen\'s Agreements</strong> (GA) to maintain competitive integrity.</p><h3>Current GAs:</h3><ol><li>No excessive camping</li><li>Respect timeouts (1 per team per map)</li><li>Respectful communication</li><li>Accept referee decisions</li></ol><p style="text-align: center;"><strong>Note:</strong> Violation of GAs may result in community sanctions.</p>',
            it: '<p>Oltre alle regole ufficiali, le squadre professionali rispettano gli <strong>Accordi tra gentiluomini</strong> (GA) per mantenere l\'integrità competitiva.</p><h3>GA attuali:</h3><ol><li>Niente camping eccessivo</li><li>Rispetto dei timeout (1 per squadra per mappa)</li><li>Comunicazione rispettosa</li><li>Accettare le decisioni arbitrali</li></ol><p style="text-align: center;"><strong>Nota:</strong> La violazione dei GA può comportare sanzioni della comunità.</p>',
            de: '<p>Zusätzlich zu den offiziellen Regeln respektieren professionelle Teams <strong>Gentlemen\'s Agreements</strong> (GA), um die Wettbewerbsintegrität aufrechtzuerhalten.</p><h3>Aktuelle GAs:</h3><ol><li>Kein übermäßiges Camping</li><li>Timeouts respektieren (1 pro Team pro Karte)</li><li>Respektvolle Kommunikation</li><li>Schiedsrichterentscheidungen akzeptieren</li></ol><p style="text-align: center;"><strong>Hinweis:</strong> Verstöße gegen GAs können zu Community-Sanktionen führen.</p>'
          },
          order: 1,
          icon: 'handshake'
        }
      ],
      isActive: true
    });

    // Save all rules
    await hardcoreRules.save();
    await cdlRules.save();


    mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error seeding game mode rules:', error);
    process.exit(1);
  }
};

seedGameModeRules();

