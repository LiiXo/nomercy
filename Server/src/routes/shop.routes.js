import express from 'express';
import ShopItem from '../models/ShopItem.js';
import Purchase from '../models/Purchase.js';
import User from '../models/User.js';
import ItemUsage from '../models/ItemUsage.js';
import Match from '../models/Match.js';
import { verifyToken, requireAdmin, requireStaff } from '../middleware/auth.middleware.js';

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

// Get all active shop items (with optional auth for owned quantity)
router.get('/items', async (req, res) => {
  try {
    const { category, mode = 'all', sort = 'sortOrder' } = req.query;
    
    const query = { isActive: true };
    
    if (category) {
      query.category = category;
    }
    
    // Filter by mode (show 'all' items + mode-specific items)
    if (mode !== 'all') {
      query.$or = [{ mode: 'all' }, { mode }];
    }

    const items = await ShopItem.find(query)
      .sort(sort === 'price' ? { price: 1 } : sort === '-price' ? { price: -1 } : { sortOrder: 1, createdAt: -1 })
      .lean();

    // Filter out items that are not available (time-limited)
    const now = new Date();
    const availableItems = items.filter(item => {
      if (item.availableFrom && now < new Date(item.availableFrom)) return false;
      if (item.availableUntil && now > new Date(item.availableUntil)) return false;
      if (item.stock === 0) return false;
      return true;
    });

    // Add owned quantity for each item if user is authenticated (optional)
    // Try to get user from cookies if present
    let userId = null;
    try {
      const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {}) || {};
      
      const token = cookies.token || req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('_id');
        if (user) userId = user._id;
      }
    } catch (err) {
      // Token invalid or no token - continue without user
    }

    if (userId) {
      const itemIds = availableItems.map(item => item._id);
      const purchaseCounts = await Purchase.aggregate([
        {
          $match: {
            user: userId,
            item: { $in: itemIds },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: '$item',
            count: { $sum: 1 }
          }
        }
      ]);

      const quantityMap = new Map();
      purchaseCounts.forEach(pc => {
        quantityMap.set(pc._id.toString(), pc.count);
      });

      availableItems.forEach(item => {
        item.ownedQuantity = quantityMap.get(item._id.toString()) || 0;
      });
    } else {
      // Set to 0 if not authenticated
      availableItems.forEach(item => {
        item.ownedQuantity = 0;
      });
    }

    res.json({
      success: true,
      items: availableItems
    });
  } catch (error) {
    console.error('Error fetching shop items:', error);
    res.status(500).json({ success: false, message: 'Error fetching items' });
  }
});

// Get single item
router.get('/items/:id', async (req, res) => {
  try {
    const item = await ShopItem.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    res.json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching item' });
  }
});

// Get categories with counts
router.get('/categories', async (req, res) => {
  try {
    const categories = await ShopItem.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      categories: categories.map(c => ({ name: c._id, count: c.count }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching categories' });
  }
});

// ==================== USER ROUTES (Authenticated) ====================

// Purchase an item
router.post('/purchase/:itemId', verifyToken, async (req, res) => {
  try {
    const item = await ShopItem.findById(req.params.itemId);
    
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    if (!item.isAvailable) {
      return res.status(400).json({ success: false, message: 'This item is not available' });
    }

    // Check if user has enough gold
    if (req.user.goldCoins < item.price) {
      return res.status(400).json({ 
        success: false, 
        message: 'Not enough gold coins',
        required: item.price,
        current: req.user.goldCoins
      });
    }

    // Check if user already owns this item (for non-stackable items)
    if (!item.allowMultiplePurchases) {
      const existingPurchase = await Purchase.findOne({
        user: req.user._id,
        item: item._id,
        status: 'completed'
      });

      if (existingPurchase) {
        return res.status(400).json({ success: false, message: 'You already own this item' });
      }
    }

    // Process purchase
    req.user.goldCoins -= item.price;
    await req.user.save();

    // Update stock if limited
    if (item.stock > 0) {
      item.stock -= 1;
    }
    item.totalSold += 1;
    await item.save();

    // Create purchase record
    const purchase = new Purchase({
      user: req.user._id,
      item: item._id,
      itemSnapshot: {
        name: item.name,
        price: item.price,
        category: item.category,
        rarity: item.rarity
      },
      pricePaid: item.price
    });
    await purchase.save();

    res.json({
      success: true,
      message: 'Purchase successful!',
      purchase: {
        id: purchase._id,
        item: item.name,
        pricePaid: item.price
      },
      newBalance: req.user.goldCoins
    });
  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ success: false, message: 'Error processing purchase' });
  }
});

// Get user's purchases
router.get('/my-purchases', verifyToken, async (req, res) => {
  try {
    const purchases = await Purchase.find({ user: req.user._id })
      .populate('item', 'name image icon color category rarity nameTranslations descriptionTranslations')
      .sort({ createdAt: -1 });

    res.json({ 
      success: true, 
      purchases,
      equippedTitle: req.user.equippedTitle,
      equippedProfileAnimation: req.user.equippedProfileAnimation
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching purchases' });
  }
});

// Equip a title
router.post('/equip-title/:itemId', verifyToken, async (req, res) => {
  try {
    const { itemId } = req.params;

    // If itemId is 'none', unequip the title
    if (itemId === 'none') {
      req.user.equippedTitle = null;
      await req.user.save();
      return res.json({ success: true, message: 'Title unequipped', equippedTitle: null });
    }

    // Check if user owns this title
    const purchase = await Purchase.findOne({
      user: req.user._id,
      item: itemId,
      status: 'completed'
    }).populate('item');

    if (!purchase) {
      return res.status(404).json({ success: false, message: 'You do not own this title' });
    }

    // Check if it's a title category
    if (purchase.item.category !== 'title') {
      return res.status(400).json({ success: false, message: 'This item is not a title' });
    }

    // Equip the title
    req.user.equippedTitle = itemId;
    await req.user.save();

    res.json({ 
      success: true, 
      message: 'Title equipped successfully',
      equippedTitle: purchase.item
    });
  } catch (error) {
    console.error('Equip title error:', error);
    res.status(500).json({ success: false, message: 'Error equipping title' });
  }
});

// Equip a profile animation
router.post('/equip-profile-animation/:itemId', verifyToken, async (req, res) => {
  try {
    const { itemId } = req.params;

    // If itemId is 'none', unequip the animation
    if (itemId === 'none') {
      req.user.equippedProfileAnimation = null;
      await req.user.save();
      return res.json({ success: true, message: 'Profile animation unequipped', equippedProfileAnimation: null });
    }

    // Check if user owns this animation
    const purchase = await Purchase.findOne({
      user: req.user._id,
      item: itemId,
      status: 'completed'
    }).populate('item');

    if (!purchase) {
      return res.status(404).json({ success: false, message: 'You do not own this animation' });
    }

    // Check if it's a profile_animation category
    if (purchase.item.category !== 'profile_animation') {
      return res.status(400).json({ success: false, message: 'This item is not a profile animation' });
    }

    // Equip the animation
    req.user.equippedProfileAnimation = itemId;
    await req.user.save();

    res.json({ 
      success: true, 
      message: 'Profile animation equipped successfully',
      equippedProfileAnimation: purchase.item
    });
  } catch (error) {
    console.error('Equip profile animation error:', error);
    res.status(500).json({ success: false, message: 'Error equipping profile animation' });
  }
});

// ==================== ADMIN ROUTES ====================

// Get all items (including inactive) - Admin
router.get('/admin/items', verifyToken, requireStaff, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const items = await ShopItem.find()
      .sort({ sortOrder: 1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ShopItem.countDocuments();

    res.json({
      success: true,
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching items' });
  }
});

// Create new item - Admin/Staff
router.post('/admin/items', verifyToken, requireStaff, async (req, res) => {
  try {
    const {
      name, description, category, price, originalPrice,
      image, icon, color, rarity, isActive, stock, mode,
      availableFrom, availableUntil, effects, sortOrder,
      isUsable, effectType, matchCount, usableInMatch, allowMultiplePurchases,
      nameTranslations, descriptionTranslations, ornamentData
    } = req.body;

    if (!name || !description || !category || price === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, description, category, and price are required' 
      });
    }

    const item = new ShopItem({
      name,
      description,
      category,
      price,
      originalPrice,
      image,
      icon,
      color,
      rarity,
      isActive: isActive !== false,
      stock: stock || -1,
      mode: mode || 'all',
      availableFrom,
      availableUntil,
      effects,
      sortOrder: sortOrder || 0,
      isUsable,
      effectType,
      matchCount,
      usableInMatch,
      allowMultiplePurchases,
      nameTranslations,
      descriptionTranslations,
      ornamentData
    });

    await item.save();

    res.status(201).json({
      success: true,
      message: 'Item created successfully',
      item
    });
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({ success: false, message: 'Error creating item' });
  }
});

// Update item - Admin/Staff
router.put('/admin/items/:id', verifyToken, requireStaff, async (req, res) => {
  try {
    const item = await ShopItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const allowedUpdates = [
      'name', 'description', 'category', 'price', 'originalPrice',
      'image', 'icon', 'color', 'rarity', 'isActive', 'stock', 'mode',
      'availableFrom', 'availableUntil', 'effects', 'sortOrder',
      'isUsable', 'effectType', 'matchCount', 'usableInMatch', 'allowMultiplePurchases',
      'nameTranslations', 'descriptionTranslations', 'ornamentData'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        item[field] = req.body[field];
      }
    });

    await item.save();

    res.json({
      success: true,
      message: 'Item updated successfully',
      item
    });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ success: false, message: 'Error updating item' });
  }
});

// Delete item - Admin/Staff
router.delete('/admin/items/:id', verifyToken, requireStaff, async (req, res) => {
  try {
    const item = await ShopItem.findByIdAndDelete(req.params.id);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    res.json({
      success: true,
      message: 'Item deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting item' });
  }
});

// Use an item (for usable items like boosts, consumables)
router.post('/use-item/:purchaseId', verifyToken, async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const { matchId } = req.body; // Optional: for match-specific items

    // Find the purchase
    const purchase = await Purchase.findById(purchaseId)
      .populate('item')
      .populate('user');

    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }

    // Check if user owns this purchase
    if (purchase.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You do not own this item' });
    }

    const item = purchase.item;
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Check if item is usable
    if (!item.isUsable) {
      return res.status(400).json({ success: false, message: 'This item is not usable' });
    }

    // Check if item requires match context
    if (item.usableInMatch && !matchId) {
      return res.status(400).json({ success: false, message: 'This item must be used in a match' });
    }

    // Check if already used (for one-time use items)
    if (item.matchCount === 0) {
      const existingUsage = await ItemUsage.findOne({
        purchase: purchaseId,
        isActive: true
      });
      if (existingUsage) {
        return res.status(400).json({ success: false, message: 'This item has already been used' });
      }
    }

    // Handle different effect types
    let result = { success: true, message: 'Item used successfully' };

    switch (item.effectType) {
      case 'double_xp':
      case 'double_pts':
      case 'double_gold':
        // Create usage record with remainingMatches (count-based instead of time-based)
        const remainingMatches = item.matchCount > 0 
          ? item.matchCount // Number of matches
          : null; // null = unlimited
        
        await ItemUsage.create({
          user: req.user._id,
          purchase: purchaseId,
          item: item._id,
          effectType: item.effectType,
          match: matchId || null,
          remainingMatches, // Store remaining match count
          remainingMs: null, // Not using time-based anymore
          expiresAt: null,
          inMatch: false,
          matchStartTime: null,
          totalMatchesUsed: 0,
          isActive: true
        });
        
        // Mark purchase as used
        purchase.isUsed = true;
        purchase.usedAt = new Date();
        await purchase.save();
        
        const countText = item.matchCount > 0 ? `${item.matchCount} match${item.matchCount > 1 ? 'es' : ''}` : 'unlimited';
        result.message = item.effectType === 'double_xp' 
          ? `Double XP activated for ${countText}!`
          : item.effectType === 'double_pts'
          ? `Double Points activated for ${countText}!`
          : `Double Gold activated for ${countText}!`;
        result.remainingMatches = remainingMatches;
        break;

      case 'cancel_match':
        if (!matchId) {
          return res.status(400).json({ success: false, message: 'Match ID required' });
        }

        // Find match
        const match = await Match.findById(matchId)
          .populate('challenger')
          .populate('opponent');

        if (!match) {
          return res.status(404).json({ success: false, message: 'Match not found' });
        }

        // Check if user is part of the match
        const userSquad = await User.findById(req.user._id).select('squad');
        const isChallenger = match.challenger && match.challenger._id.toString() === userSquad.squad?.toString();
        const isOpponent = match.opponent && match.opponent._id.toString() === userSquad.squad?.toString();

        if (!isChallenger && !isOpponent) {
          return res.status(403).json({ success: false, message: 'You are not part of this match' });
        }

        // Check if match can be cancelled
        if (match.status === 'completed' || match.status === 'cancelled') {
          return res.status(400).json({ success: false, message: 'Match cannot be cancelled' });
        }

        // Check if maxStartTime has passed (10 minutes after acceptance or scheduled time)
        const now = new Date();
        const referenceTime = match.acceptedAt || match.scheduledAt || match.createdAt;
        const maxStartTime = new Date(new Date(referenceTime).getTime() + 10 * 60 * 1000); // 10 minutes
        
        if (now > maxStartTime) {
          return res.status(400).json({ 
            success: false, 
            message: req.headers['accept-language']?.includes('fr') 
              ? 'Le délai pour utiliser la Poudre de Perlinpinpin est dépassé. Le match doit être annulé avant l\'heure de début maximum.'
              : req.headers['accept-language']?.includes('de')
              ? 'Die Frist für die Verwendung des Zauberpulvers ist abgelaufen. Das Match muss vor der maximalen Startzeit abgebrochen werden.'
              : req.headers['accept-language']?.includes('it')
              ? 'Il termine per utilizzare la Polvere Magica è scaduto. La partita deve essere annullata prima dell\'ora di inizio massima.'
              : 'The deadline to use Magic Powder has passed. The match must be cancelled before the maximum start time.'
          });
        }

        // Cancel the match
        match.status = 'cancelled';
        match.cancelledBy = req.user._id;
        match.cancelledAt = new Date();
        await match.save();

        // Create usage record
        await ItemUsage.create({
          user: req.user._id,
          purchase: purchaseId,
          item: item._id,
          effectType: 'cancel_match',
          match: matchId,
          expiresAt: null,
          isActive: true
        });

        // Determine which team used the powder and which is the opponent
        const userSquadId = userSquad.squad?.toString();
        const isChallengerUsed = match.challenger && match.challenger._id.toString() === userSquadId;
        const opponentSquadId = isChallengerUsed 
          ? (match.opponent?._id?.toString() || null)
          : (match.challenger?._id?.toString() || null);

        // Emit socket event for cancellation
        const { getIO } = await import('../index.js');
        const io = getIO();
        if (io) {
          io.to(`match:${matchId}`).emit('matchCancelled', {
            cancelledBy: req.user.username,
            reason: 'Poudre de Perlinpinpin'
          });

          // Create two battle reports - one for each team
          // Report for the opponent team (they "fled like cowards")
          if (opponentSquadId) {
            const opponentReport = {
              matchId: matchId,
              winnerId: null, // No winner in a cancellation
              loserId: opponentSquadId,
              targetSquadId: opponentSquadId, // Which squad should see this report
              ladderId: match.ladderId,
              winnerRewards: { 
                coins: 0, 
                playerPoints: 0,
                ladderPoints: 0,
                generalSquadPoints: 0
              },
              loserRewards: { 
                coins: 0, 
                playerPoints: 0,
                ladderPoints: 0,
                generalSquadPoints: 0
              },
              isForfeit: false,
              isMagicPowder: true,
              message: 'Vos adversaires se sont enfuis comme des lâches. Ne vous inquiétez pas, vous retomberez dessus un jour.',
              messageEn: 'Your opponents fled like cowards. Don\'t worry, you\'ll catch up with them one day.',
              messageDe: 'Eure Gegner sind wie Feiglinge geflohen. Macht euch keine Sorgen, ihr werdet sie eines Tages einholen.',
              messageIt: 'I tuoi avversari sono fuggiti come codardi. Non preoccuparti, li raggiungerai un giorno.'
            };
            
            // Emit to match room - client will filter by targetSquadId
            io.to(`match:${matchId}`).emit('matchCompleted', opponentReport);
          }

          // Report for the team that used the powder (shame message)
          if (userSquadId) {
            const userReport = {
              matchId: matchId,
              winnerId: null, // No winner in a cancellation
              loserId: userSquadId,
              targetSquadId: userSquadId, // Which squad should see this report
              ladderId: match.ladderId,
              winnerRewards: { 
                coins: 0, 
                playerPoints: 0,
                ladderPoints: 0,
                generalSquadPoints: 0
              },
              loserRewards: { 
                coins: 0, 
                playerPoints: 0,
                ladderPoints: 0,
                generalSquadPoints: 0
              },
              isForfeit: false,
              isMagicPowder: true,
              message: 'Vous n\'avez pas honte de quitter le champ de bataille ? Réveillez-vous soldats !',
              messageEn: 'Aren\'t you ashamed to leave the battlefield? Wake up soldiers!',
              messageDe: 'Schämt ihr euch nicht, das Schlachtfeld zu verlassen? Wacht auf, Soldaten!',
              messageIt: 'Non vi vergognate di lasciare il campo di battaglia? Svegliatevi soldati!'
            };
            
            // Emit to match room - client will filter by targetSquadId
            io.to(`match:${matchId}`).emit('matchCompleted', userReport);
          }
        }

        result.message = 'Match cancelled successfully!';
        break;

      default:
        return res.status(400).json({ success: false, message: 'Unknown effect type' });
    }

    res.json(result);
  } catch (error) {
    console.error('Use item error:', error);
    res.status(500).json({ success: false, message: 'Error using item' });
  }
});

// Get user's usable items (for match)
router.get('/my-usable-items', verifyToken, async (req, res) => {
  try {
    const { matchId } = req.query;

    // Get all purchases of usable items
    const purchases = await Purchase.find({
      user: req.user._id,
      status: 'completed'
    })
      .populate({
        path: 'item',
        match: { isUsable: true }
      })
      .lean();

    // Filter to only usable items
    const usablePurchases = purchases.filter(p => p.item && p.item.isUsable);

    // Check which ones are already used
    const purchaseIds = usablePurchases.map(p => p._id);
    const usages = await ItemUsage.find({
      purchase: { $in: purchaseIds },
      isActive: true
    }).lean();

    const usedPurchaseIds = new Set(usages.map(u => u.purchase.toString()));

    // Group by item ID to count quantities
    const itemsMap = new Map();
    
    usablePurchases.forEach(purchase => {
      const itemId = purchase.item._id.toString();
      const isEmote = purchase.item.effectType === 'emote';
      const isUsed = usedPurchaseIds.has(purchase._id.toString());
      const usage = usages.find(u => u.purchase.toString() === purchase._id.toString());
      
      if (!itemsMap.has(itemId)) {
        itemsMap.set(itemId, {
          item: purchase.item,
          totalQuantity: 0,
          usedQuantity: 0,
          availableQuantity: 0,
          purchases: []
        });
      }
      
      const itemData = itemsMap.get(itemId);
      itemData.totalQuantity++;
      
      // Emotes are infinite use - always available if owned
      if (isEmote) {
        itemData.availableQuantity = 1; // Show as available (infinite)
        itemData.canUse = true;
      } else {
        if (isUsed) {
          itemData.usedQuantity++;
          // For match-count-based items, check if still active
          if (purchase.item.matchCount > 0 && usage && usage.isActive && (usage.remainingMatches === null || usage.remainingMatches > 0)) {
            // Still active, so it's available
            itemData.availableQuantity++;
          }
        } else {
          itemData.availableQuantity++;
        }
      }
      
      itemData.purchases.push({
        purchaseId: purchase._id,
        isUsed,
        usage: usage ? {
          usedAt: usage.usedAt,
          expiresAt: usage.expiresAt,
          match: usage.match
        } : null
      });
    });

    // Convert map to array
    const items = Array.from(itemsMap.values()).map(itemData => ({
      item: itemData.item,
      totalQuantity: itemData.totalQuantity,
      usedQuantity: itemData.usedQuantity,
      availableQuantity: itemData.availableQuantity,
      canUse: itemData.availableQuantity > 0,
      // Get first available purchase ID for use
      purchaseId: itemData.purchases.find(p => !p.isUsed || (itemData.item.matchCount > 0 && p.usage && p.usage.isActive))?.purchaseId || itemData.purchases[0]?.purchaseId
    }));

    res.json({ success: true, items });
  } catch (error) {
    console.error('Get usable items error:', error);
    res.status(500).json({ success: false, message: 'Error fetching usable items' });
  }
});

// Get user's active boosters (for ranked mode)
router.get('/my-active-boosters', verifyToken, async (req, res) => {
  try {
    // Find active boosters that have remaining matches and haven't been consumed
    // Now using match-based counting instead of time-based
    let activeBoosters = await ItemUsage.find({
      user: req.user._id,
      isActive: true,
      wasConsumed: false,
      effectType: { $in: ['double_pts', 'double_gold', 'double_xp'] }
    })
      .populate('item', 'name icon color effectType matchCount nameTranslations')
      .lean();

    // Filter and process boosters
    const validBoosters = [];
    const toMarkConsumed = [];

    for (const booster of activeBoosters) {
      // Case 1: New system - has remainingMatches set
      if (booster.remainingMatches !== undefined && booster.remainingMatches !== null) {
        if (booster.remainingMatches > 0) {
          validBoosters.push(booster);
        } else {
          // Depleted - mark for cleanup
          toMarkConsumed.push(booster._id);
        }
      }
      // Case 2: Legacy system - has remainingMs (convert to 1 remaining match per 5 min)
      else if (booster.remainingMs !== undefined && booster.remainingMs !== null && booster.remainingMs > 0) {
        // Convert legacy time-based to match-based (estimate: 1 match per 5 minutes)
        booster.remainingMatches = Math.max(1, Math.ceil(booster.remainingMs / (5 * 60 * 1000)));
        validBoosters.push(booster);
      }
      // Case 3: Legacy expiresAt
      else if (booster.expiresAt) {
        if (new Date(booster.expiresAt) > new Date()) {
          // Still valid - estimate remaining matches
          const remainingMs = new Date(booster.expiresAt).getTime() - Date.now();
          booster.remainingMatches = Math.max(1, Math.ceil(remainingMs / (5 * 60 * 1000)));
          validBoosters.push(booster);
        } else {
          // Expired - mark for cleanup
          toMarkConsumed.push(booster._id);
        }
      }
      // Case 4: No remainingMatches and no legacy fields - treat as unlimited
      else {
        booster.remainingMatches = null; // Unlimited
        validBoosters.push(booster);
      }
    }

    // Clean up depleted/expired boosters
    if (toMarkConsumed.length > 0) {
      await ItemUsage.updateMany(
        { _id: { $in: toMarkConsumed } },
        { $set: { isActive: false, wasConsumed: true } }
      );
    }

    res.json({
      success: true,
      boosters: validBoosters.map(b => ({
        usageId: b._id,
        item: b.item,
        effectType: b.effectType,
        usedAt: b.usedAt,
        remainingMatches: b.remainingMatches, // Number of matches remaining (null = unlimited)
        inMatch: b.inMatch || false, // Whether currently in a match
        totalMatchesUsed: b.totalMatchesUsed || 0 // Total matches used with this booster
      }))
    });
  } catch (error) {
    console.error('Get active boosters error:', error);
    res.status(500).json({ success: false, message: 'Error fetching active boosters' });
  }
});

// Get user's available boosters (purchased but not yet used)
router.get('/my-available-boosters', verifyToken, async (req, res) => {
  try {
    // Get all purchases of usable items that haven't been used
    const purchases = await Purchase.find({
      user: req.user._id,
      status: 'completed',
      isUsed: { $ne: true }
    })
      .populate({
        path: 'item',
        match: { 
          isUsable: true,
          effectType: { $in: ['double_pts', 'double_gold', 'double_xp'] }
        }
      })
      .lean();

    // Filter to only purchases with valid booster items
    const availableBoosters = purchases.filter(p => p.item);

    // Group by item type and count
    const boosterMap = new Map();
    availableBoosters.forEach(purchase => {
      const itemId = purchase.item._id.toString();
      if (!boosterMap.has(itemId)) {
        boosterMap.set(itemId, {
          item: purchase.item,
          quantity: 0,
          purchases: []
        });
      }
      const data = boosterMap.get(itemId);
      data.quantity++;
      data.purchases.push(purchase._id);
    });

    res.json({
      success: true,
      boosters: Array.from(boosterMap.values()).map(b => ({
        item: b.item,
        quantity: b.quantity,
        purchaseId: b.purchases[0] // First available purchase ID for activation
      }))
    });
  } catch (error) {
    console.error('Get available boosters error:', error);
    res.status(500).json({ success: false, message: 'Error fetching available boosters' });
  }
});

// Get shop statistics - Admin
router.get('/admin/stats', verifyToken, requireStaff, async (req, res) => {
  try {
    const totalItems = await ShopItem.countDocuments();
    const activeItems = await ShopItem.countDocuments({ isActive: true });
    const totalPurchases = await Purchase.countDocuments();
    
    const revenueAgg = await Purchase.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$pricePaid' } } }
    ]);
    const totalRevenue = revenueAgg[0]?.total || 0;

    const topItems = await ShopItem.find()
      .sort({ totalSold: -1 })
      .limit(5)
      .select('name totalSold price category');

    const recentPurchases = await Purchase.find()
      .populate('user', 'username')
      .populate('item', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      stats: {
        totalItems,
        activeItems,
        totalPurchases,
        totalRevenue,
        topItems,
        recentPurchases
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching stats' });
  }
});

// Get user's purchase history - Admin only
router.get('/admin/user-purchases/:userId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const purchases = await Purchase.find({ user: userId })
      .populate('item', 'name category rarity nameTranslations descriptionTranslations isUsable effectType matchCount')
      .sort({ createdAt: -1 })
      .lean();

    // Get ItemUsage data for usable items
    const itemUsages = await ItemUsage.find({ user: userId }).lean();
    const usageByPurchase = {};
    const usageByItem = {};
    
    itemUsages.forEach(usage => {
      if (usage.purchase) {
        usageByPurchase[usage.purchase.toString()] = usage;
      }
      if (usage.item) {
        usageByItem[usage.item.toString()] = usage;
      }
    });

    // Enrich purchases with usage data
    const enrichedPurchases = purchases.map(purchase => {
      const usage = usageByPurchase[purchase._id.toString()] || 
                    (purchase.item ? usageByItem[purchase.item._id.toString()] : null);
      
      return {
        ...purchase,
        usage: usage ? {
          isActive: usage.isActive,
          wasConsumed: usage.wasConsumed,
          remainingMatches: usage.remainingMatches,
          activatedAt: usage.activatedAt
        } : null
      };
    });

    res.json({
      success: true,
      purchases: enrichedPurchases
    });
  } catch (error) {
    console.error('Get user purchases error:', error);
    res.status(500).json({ success: false, message: 'Error fetching user purchases' });
  }
});

// Get all shop items (for admin give item feature)
router.get('/admin/all-items', verifyToken, requireAdmin, async (req, res) => {
  try {
    const items = await ShopItem.find()
      .select('name category rarity price nameTranslations isActive')
      .sort({ category: 1, name: 1 })
      .lean();

    res.json({
      success: true,
      items
    });
  } catch (error) {
    console.error('Get all items error:', error);
    res.status(500).json({ success: false, message: 'Error fetching items' });
  }
});

// Give item to user - Admin only
router.post('/admin/give-item', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { userId, itemId } = req.body;

    if (!userId || !itemId) {
      return res.status(400).json({ success: false, message: 'userId and itemId are required' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const item = await ShopItem.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Create purchase record (as a gift, price = 0)
    const purchase = new Purchase({
      user: userId,
      item: itemId,
      itemSnapshot: {
        name: item.name,
        price: item.price,
        category: item.category,
        rarity: item.rarity
      },
      pricePaid: 0, // Free gift
      giftedBy: req.user._id, // Track who gave the item
      isGift: true
    });
    await purchase.save();

    // Update item stats
    item.totalSold += 1;
    await item.save();

    // If it's a usable item, create ItemUsage record
    if (item.isUsable) {
      const remainingMatches = item.matchCount > 0 
        ? item.matchCount
        : null;

      const usage = new ItemUsage({
        user: userId,
        item: itemId,
        purchase: purchase._id,
        effectType: item.effectType,
        remainingMatches,
        isActive: false,
        wasConsumed: false
      });
      await usage.save();
    }

    console.log(`[Admin] ${req.user.username} gave ${item.name} to ${targetUser.username}`);

    res.json({
      success: true,
      message: `${item.name} has been given to ${targetUser.username}`,
      purchase
    });
  } catch (error) {
    console.error('Give item error:', error);
    res.status(500).json({ success: false, message: 'Error giving item' });
  }
});

// Delete/Refund a purchase - Admin only
router.delete('/admin/purchases/:purchaseId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const { refund = true } = req.query; // Default to refund

    const purchase = await Purchase.findById(purchaseId)
      .populate('user')
      .populate('item');

    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }

    const user = purchase.user;
    const item = purchase.item;
    const pricePaid = purchase.pricePaid || 0;

    // Refund gold if requested and price was paid
    if (refund === 'true' && pricePaid > 0 && user) {
      await User.findByIdAndUpdate(user._id, {
        $inc: { goldCoins: pricePaid }
      });
      console.log(`[Admin] Refunded ${pricePaid} gold to ${user.username}`);
    }

    // Unequip item from user's profile if it's equipped
    if (user && item) {
      const itemId = item._id.toString();
      const updateFields = {};

      // Check if this item is equipped as a title
      if (user.equippedTitle && user.equippedTitle.toString() === itemId) {
        updateFields.equippedTitle = null;
        console.log(`[Admin] Unequipped title ${item.name} from ${user.username}`);
      }

      // Check if this item is equipped as a profile animation
      if (user.equippedProfileAnimation && user.equippedProfileAnimation.toString() === itemId) {
        updateFields.equippedProfileAnimation = null;
        console.log(`[Admin] Unequipped profile animation ${item.name} from ${user.username}`);
      }

      // Apply unequip updates if any
      if (Object.keys(updateFields).length > 0) {
        await User.findByIdAndUpdate(user._id, updateFields);
      }
    }

    // Delete associated ItemUsage records (deactivates any active consumables)
    const deletedUsages = await ItemUsage.deleteMany({ purchase: purchaseId });
    if (deletedUsages.deletedCount > 0) {
      console.log(`[Admin] Deleted ${deletedUsages.deletedCount} ItemUsage records for purchase ${purchaseId}`);
    }

    // Also delete any ItemUsage that references this item for this user (in case purchase link is missing)
    if (user && item) {
      await ItemUsage.deleteMany({ user: user._id, item: item._id });
    }

    // Decrement item stats if possible
    if (item) {
      await ShopItem.findByIdAndUpdate(item._id, {
        $inc: { totalSold: -1 }
      });
    }

    // Delete the purchase
    await Purchase.findByIdAndDelete(purchaseId);

    console.log(`[Admin] ${req.user.username} deleted purchase ${purchaseId} for ${user?.username || 'unknown'} (item: ${item?.name || 'unknown'}, refund: ${refund === 'true' ? pricePaid : 0})`);

    res.json({
      success: true,
      message: refund === 'true' && pricePaid > 0 
        ? `Achat supprimé et ${pricePaid} gold remboursés`
        : 'Achat supprimé',
      refundedAmount: refund === 'true' ? pricePaid : 0
    });
  } catch (error) {
    console.error('Delete purchase error:', error);
    res.status(500).json({ success: false, message: 'Error deleting purchase' });
  }
});

export default router;

