import express from 'express';
import Rule from '../models/Rule.js';
import { verifyToken, requireAdmin, requireStaff } from '../middleware/auth.middleware.js';

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

// Get all active rules (grouped by section)
router.get('/', async (req, res) => {
  try {
    const rules = await Rule.find({ isActive: true })
      .sort({ sectionKey: 1, order: 1 });
    
    // Group by section
    const grouped = rules.reduce((acc, rule) => {
      if (!acc[rule.sectionKey]) {
        acc[rule.sectionKey] = [];
      }
      acc[rule.sectionKey].push(rule);
      return acc;
    }, {});
    
    res.json({
      success: true,
      rules: grouped
    });
  } catch (error) {
    console.error('Error fetching rules:', error);
    res.status(500).json({ success: false, message: 'Error fetching rules' });
  }
});

// ==================== ADMIN ROUTES ====================

// Get all rules (including inactive) for admin
router.get('/admin/all', verifyToken, requireStaff, async (req, res) => {
  try {
    const rules = await Rule.find()
      .populate('createdBy', 'username')
      .populate('updatedBy', 'username')
      .sort({ sectionKey: 1, order: 1 });
    
    res.json({
      success: true,
      rules
    });
  } catch (error) {
    console.error('Error fetching admin rules:', error);
    res.status(500).json({ success: false, message: 'Error fetching rules' });
  }
});

// Create a new rule
router.post('/admin', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { sectionKey, content, order } = req.body;
    
    if (!sectionKey || !content?.fr || !content?.en) {
      return res.status(400).json({ 
        success: false, 
        message: 'Section key and content (fr, en) are required' 
      });
    }
    
    // Get the highest order in this section
    const maxOrderRule = await Rule.findOne({ sectionKey }).sort({ order: -1 });
    const newOrder = order !== undefined ? order : (maxOrderRule?.order || 0) + 1;
    
    const rule = new Rule({
      sectionKey,
      content,
      order: newOrder,
      createdBy: req.user._id
    });
    
    await rule.save();
    
    res.status(201).json({
      success: true,
      message: 'Rule created',
      rule
    });
  } catch (error) {
    console.error('Error creating rule:', error);
    res.status(500).json({ success: false, message: 'Error creating rule' });
  }
});

// Update a rule
router.put('/admin/:ruleId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { sectionKey, content, order, isActive } = req.body;
    
    const rule = await Rule.findById(ruleId);
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }
    
    if (sectionKey) rule.sectionKey = sectionKey;
    if (content) {
      if (content.fr) rule.content.fr = content.fr;
      if (content.en) rule.content.en = content.en;
      if (content.it !== undefined) rule.content.it = content.it;
      if (content.de !== undefined) rule.content.de = content.de;
    }
    if (order !== undefined) rule.order = order;
    if (isActive !== undefined) rule.isActive = isActive;
    rule.updatedBy = req.user._id;
    
    await rule.save();
    
    res.json({
      success: true,
      message: 'Rule updated',
      rule
    });
  } catch (error) {
    console.error('Error updating rule:', error);
    res.status(500).json({ success: false, message: 'Error updating rule' });
  }
});

// Delete a rule
router.delete('/admin/:ruleId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { ruleId } = req.params;
    
    const rule = await Rule.findByIdAndDelete(ruleId);
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }
    
    res.json({
      success: true,
      message: 'Rule deleted'
    });
  } catch (error) {
    console.error('Error deleting rule:', error);
    res.status(500).json({ success: false, message: 'Error deleting rule' });
  }
});

// Reorder rules within a section
router.put('/admin/reorder/:sectionKey', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { sectionKey } = req.params;
    const { ruleIds } = req.body; // Array of rule IDs in new order
    
    if (!ruleIds || !Array.isArray(ruleIds)) {
      return res.status(400).json({ success: false, message: 'ruleIds array required' });
    }
    
    // Update order for each rule
    for (let i = 0; i < ruleIds.length; i++) {
      await Rule.findByIdAndUpdate(ruleIds[i], { 
        order: i,
        updatedBy: req.user._id
      });
    }
    
    res.json({
      success: true,
      message: 'Rules reordered'
    });
  } catch (error) {
    console.error('Error reordering rules:', error);
    res.status(500).json({ success: false, message: 'Error reordering rules' });
  }
});

// Seed initial rules (one-time setup)
router.post('/admin/seed', verifyToken, requireStaff, async (req, res) => {
  try {
    // Check if rules already exist
    const existingCount = await Rule.countDocuments();
    if (existingCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `${existingCount} rules already exist. Delete them first if you want to reseed.` 
      });
    }
    
    const initialRules = [
      // General Rules
      {
        sectionKey: 'generalRules',
        order: 1,
        content: {
          fr: 'Respectez tous les joueurs. Les insultes, le harcèlement et les comportements toxiques sont strictement interdits.',
          en: 'Respect all players. Insults, harassment and toxic behavior are strictly prohibited.',
          it: 'Rispetta tutti i giocatori. Insulti, molestie e comportamenti tossici sono severamente vietati.',
          de: 'Respektiere alle Spieler. Beleidigungen, Belästigungen und toxisches Verhalten sind streng verboten.'
        },
        createdBy: req.user._id
      },
      {
        sectionKey: 'generalRules',
        order: 2,
        content: {
          fr: 'Tout compte est personnel et ne peut être partagé. Un seul compte par personne est autorisé.',
          en: 'Every account is personal and cannot be shared. Only one account per person is allowed.',
          it: 'Ogni account è personale e non può essere condiviso. È consentito un solo account per persona.',
          de: 'Jedes Konto ist persönlich und kann nicht geteilt werden. Pro Person ist nur ein Konto erlaubt.'
        },
        createdBy: req.user._id
      },
      {
        sectionKey: 'generalRules',
        order: 3,
        content: {
          fr: 'Les pseudonymes offensants, discriminatoires ou inappropriés sont interdits.',
          en: 'Offensive, discriminatory or inappropriate nicknames are prohibited.',
          it: 'Soprannomi offensivi, discriminatori o inappropriati sono vietati.',
          de: 'Beleidigende, diskriminierende oder unangemessene Spitznamen sind verboten.'
        },
        createdBy: req.user._id
      },
      // Match Rules
      {
        sectionKey: 'matchRules',
        order: 1,
        content: {
          fr: 'Les joueurs doivent être présents et prêts à jouer dans les 5 minutes suivant l\'heure prévue du match.',
          en: 'Players must be present and ready to play within 5 minutes of the scheduled match time.',
          it: 'I giocatori devono essere presenti e pronti a giocare entro 5 minuti dall\'orario previsto della partita.',
          de: 'Die Spieler müssen innerhalb von 5 Minuten nach der geplanten Spielzeit anwesend und spielbereit sein.'
        },
        createdBy: req.user._id
      },
      {
        sectionKey: 'matchRules',
        order: 2,
        content: {
          fr: 'En cas de déconnexion, le match peut être repris si les deux équipes sont d\'accord. Sinon, le score actuel est maintenu.',
          en: 'In case of disconnection, the match can be resumed if both teams agree. Otherwise, the current score is maintained.',
          it: 'In caso di disconnessione, la partita può essere ripresa se entrambe le squadre sono d\'accordo. Altrimenti, il punteggio attuale viene mantenuto.',
          de: 'Bei einer Trennung kann das Spiel fortgesetzt werden, wenn beide Teams zustimmen. Andernfalls wird der aktuelle Punktestand beibehalten.'
        },
        createdBy: req.user._id
      },
      {
        sectionKey: 'matchRules',
        order: 3,
        content: {
          fr: 'Les résultats doivent être signalés immédiatement après le match. Des preuves (screenshots, clips) peuvent être demandées.',
          en: 'Results must be reported immediately after the match. Evidence (screenshots, clips) may be requested.',
          it: 'I risultati devono essere segnalati immediatamente dopo la partita. Prove (screenshot, clip) possono essere richieste.',
          de: 'Ergebnisse müssen sofort nach dem Spiel gemeldet werden. Beweise (Screenshots, Clips) können angefordert werden.'
        },
        createdBy: req.user._id
      },
      {
        sectionKey: 'matchRules',
        order: 4,
        content: {
          fr: 'En cas de litige, contactez immédiatement le staff via Discord. Ne quittez pas le lobby avant résolution.',
          en: 'In case of dispute, contact staff immediately via Discord. Do not leave the lobby until resolved.',
          it: 'In caso di controversia, contatta immediatamente lo staff tramite Discord. Non abbandonare la lobby fino alla risoluzione.',
          de: 'Im Falle eines Streits wenden Sie sich sofort über Discord an das Personal. Verlassen Sie die Lobby nicht, bis das Problem gelöst ist.'
        },
        createdBy: req.user._id
      },
      // Squad Rules
      {
        sectionKey: 'squadRules',
        order: 1,
        content: {
          fr: 'Une escouade doit avoir un minimum de 2 joueurs et un maximum de 6 joueurs.',
          en: 'A squad must have a minimum of 2 players and a maximum of 6 players.',
          it: 'Una squadra deve avere un minimo di 2 giocatori e un massimo di 6 giocatori.',
          de: 'Ein Squad muss mindestens 2 Spieler und maximal 6 Spieler haben.'
        },
        createdBy: req.user._id
      },
      {
        sectionKey: 'squadRules',
        order: 2,
        content: {
          fr: 'Le capitaine est responsable de son équipe et de l\'inscription aux matchs.',
          en: 'The captain is responsible for their team and match registration.',
          it: 'Il capitano è responsabile della sua squadra e dell\'iscrizione alle partite.',
          de: 'Der Kapitän ist für sein Team und die Spielanmeldung verantwortlich.'
        },
        createdBy: req.user._id
      },
      {
        sectionKey: 'squadRules',
        order: 3,
        content: {
          fr: 'Un joueur ne peut faire partie que d\'une seule escouade active à la fois.',
          en: 'A player can only be part of one active squad at a time.',
          it: 'Un giocatore può far parte di una sola squadra attiva alla volta.',
          de: 'Ein Spieler kann nur Teil eines aktiven Squads gleichzeitig sein.'
        },
        createdBy: req.user._id
      },
      // Sanctions
      {
        sectionKey: 'sanctions',
        order: 1,
        content: {
          fr: 'Avertissement : Première infraction mineure',
          en: 'Warning: First minor offense',
          it: 'Avvertimento: Prima infrazione minore',
          de: 'Verwarnung: Erster geringfügiger Verstoß'
        },
        createdBy: req.user._id
      },
      {
        sectionKey: 'sanctions',
        order: 2,
        content: {
          fr: 'Suspension temporaire : Infractions répétées ou comportement toxique',
          en: 'Temporary suspension: Repeated offenses or toxic behavior',
          it: 'Sospensione temporanea: Infrazioni ripetute o comportamento tossico',
          de: 'Vorübergehende Sperre: Wiederholte Verstöße oder toxisches Verhalten'
        },
        createdBy: req.user._id
      },
      {
        sectionKey: 'sanctions',
        order: 3,
        content: {
          fr: 'Bannissement permanent : Triche, hacks ou infractions graves',
          en: 'Permanent ban: Cheating, hacks or serious offenses',
          it: 'Bando permanente: Cheating, hack o infrazioni gravi',
          de: 'Permanenter Bann: Cheating, Hacks oder schwere Verstöße'
        },
        createdBy: req.user._id
      },
      // Cheating
      {
        sectionKey: 'cheating',
        order: 1,
        content: {
          fr: 'Tout logiciel tiers modifiant le jeu (aimbot, wallhack, etc.) est strictement interdit.',
          en: 'Any third-party software modifying the game (aimbot, wallhack, etc.) is strictly prohibited.',
          it: 'Qualsiasi software di terze parti che modifica il gioco (aimbot, wallhack, ecc.) è severamente vietato.',
          de: 'Jegliche Drittanbieter-Software, die das Spiel modifiziert (Aimbot, Wallhack usw.), ist strengstens verboten.'
        },
        createdBy: req.user._id
      },
      {
        sectionKey: 'cheating',
        order: 2,
        content: {
          fr: 'L\'exploitation de bugs ou glitchs pour obtenir un avantage est interdite.',
          en: 'Exploiting bugs or glitches for an advantage is prohibited.',
          it: 'Lo sfruttamento di bug o glitch per ottenere un vantaggio è vietato.',
          de: 'Das Ausnutzen von Bugs oder Glitches für einen Vorteil ist verboten.'
        },
        createdBy: req.user._id
      },
      {
        sectionKey: 'cheating',
        order: 3,
        content: {
          fr: 'Tous les joueurs doivent utiliser notre système anti-cheat obligatoire.',
          en: 'All players must use our mandatory anti-cheat system.',
          it: 'Tutti i giocatori devono utilizzare il nostro sistema anti-cheat obbligatorio.',
          de: 'Alle Spieler müssen unser obligatorisches Anti-Cheat-System verwenden.'
        },
        createdBy: req.user._id
      }
    ];
    
    await Rule.insertMany(initialRules);
    
    res.json({
      success: true,
      message: `${initialRules.length} rules created`
    });
  } catch (error) {
    console.error('Error seeding rules:', error);
    res.status(500).json({ success: false, message: 'Error seeding rules' });
  }
});

export default router;


