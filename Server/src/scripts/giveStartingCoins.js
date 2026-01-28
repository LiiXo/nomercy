import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from '../models/User.js';

const STARTING_COINS = 500;

const giveStartingCoins = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nomercy');

    // Update all users who have less than starting coins
    const result = await User.updateMany(
      { goldCoins: { $lt: STARTING_COINS } },
      { $set: { goldCoins: STARTING_COINS } }
    );


    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

giveStartingCoins();






