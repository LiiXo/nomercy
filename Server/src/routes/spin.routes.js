import express from 'express';
import DailySpin from '../models/DailySpin.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Gold rewards avec probabilités (total = 1000 pour précision)
// Plus le poids est élevé, plus c'est probable
const GOLD_REWARDS = [
  { amount: 10, weight: 300 },    // 30%
  { amount: 25, weight: 250 },    // 25%
  { amount: 50, weight: 200 },    // 20%
  { amount: 75, weight: 100 },    // 10%
  { amount: 100, weight: 80 },    // 8%
  { amount: 150, weight: 50 },    // 5%
  { amount: 10000, weight: 1 },   // 0.1% - JACKPOT TRÈS RARE!
];

const TOTAL_WEIGHT = GOLD_REWARDS.reduce((sum, r) => sum + r.weight, 0);

// Get spin status (can spin every 12 hours - French time)
router.get('/status', verifyToken, async (req, res) => {
  try {
    let spinData = await DailySpin.findOne({ user: req.user._id });
    
    if (!spinData) {
      spinData = new DailySpin({ user: req.user._id });
      await spinData.save();
    }

    const now = new Date();
    const lastSpin = spinData.lastSpinDate ? new Date(spinData.lastSpinDate) : null;
    
    // Check if 12 hours have passed since last spin
    let canSpin = true;
    let nextSpinAt = null;
    
    if (lastSpin) {
      const timeSinceLastSpin = now.getTime() - lastSpin.getTime();
      const twelveHours = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
      
      if (timeSinceLastSpin < twelveHours) {
        canSpin = false;
        // Next spin available 12 hours after last spin
        nextSpinAt = new Date(lastSpin.getTime() + twelveHours);
      }
    }

    res.json({
      success: true,
      canSpin,
      nextSpinAt,
      totalSpins: spinData.totalSpins,
      totalGoldWon: spinData.goldWon
    });
  } catch (error) {
    console.error('Spin status error:', error);
    res.status(500).json({ success: false, message: 'Error checking spin status' });
  }
});

// Get wheel prizes (gold coins only)
router.get('/prizes', verifyToken, async (req, res) => {
  try {
    // Return the gold prizes for display
    const prizes = GOLD_REWARDS.map(r => ({
      type: 'gold',
      amount: r.amount,
      label: r.amount >= 10000 ? '10K' : r.amount.toString(),
      isJackpot: r.amount >= 10000
    }));

    res.json({ success: true, prizes });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching prizes' });
  }
});

// Spin the wheel
router.post('/spin', verifyToken, async (req, res) => {
  try {
    let spinData = await DailySpin.findOne({ user: req.user._id });
    
    if (!spinData) {
      spinData = new DailySpin({ user: req.user._id });
    }

    // Check if 12 hours have passed since last spin
    const now = new Date();
    const lastSpin = spinData.lastSpinDate ? new Date(spinData.lastSpinDate) : null;
    
    if (lastSpin) {
      const timeSinceLastSpin = now.getTime() - lastSpin.getTime();
      const twelveHours = 12 * 60 * 60 * 1000;
      
      if (timeSinceLastSpin < twelveHours) {
        return res.status(400).json({ 
          success: false, 
          message: 'Tu dois attendre 12h entre chaque tour !' 
        });
      }
    }

    // Determine prize based on weighted random selection
    let random = Math.random() * TOTAL_WEIGHT;
    let selectedReward = GOLD_REWARDS[0];

    for (const reward of GOLD_REWARDS) {
      random -= reward.weight;
      if (random <= 0) {
        selectedReward = reward;
        break;
      }
    }

    const goldAmount = selectedReward.amount;
    const isJackpot = goldAmount >= 10000;
    
    // Give gold
    req.user.goldCoins += goldAmount;
    await req.user.save();

    spinData.goldWon += goldAmount;

    const prize = {
      type: 'gold',
      amount: goldAmount,
      rarity: isJackpot ? 'jackpot' : goldAmount >= 100 ? 'rare' : 'common',
      label: `${goldAmount} Gold`,
      isJackpot
    };

    // Update spin data
    spinData.lastSpinDate = now;
    spinData.totalSpins += 1;
    await spinData.save();

    res.json({
      success: true,
      prize,
      newGoldBalance: req.user.goldCoins,
      totalSpins: spinData.totalSpins
    });
  } catch (error) {
    console.error('Spin error:', error);
    res.status(500).json({ success: false, message: 'Error spinning wheel' });
  }
});

// Get spin history
router.get('/history', verifyToken, async (req, res) => {
  try {
    const spinData = await DailySpin.findOne({ user: req.user._id });

    if (!spinData) {
      return res.json({ success: true, totalGoldWon: 0, totalSpins: 0 });
    }

    res.json({
      success: true,
      totalGoldWon: spinData.goldWon,
      totalSpins: spinData.totalSpins
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching history' });
  }
});

export default router;

