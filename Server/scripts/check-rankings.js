import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const rankingSchema = new mongoose.Schema({}, { strict: false });
const Ranking = mongoose.model('Ranking', rankingSchema);

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nomercy');
  
  console.log('\n=== Season 2 Rankings in Database ===\n');
  
  const count = await Ranking.countDocuments({ season: 2 });
  console.log(`Total season 2 records: ${count}\n`);
  
  const top5 = await Ranking.find({ season: 2 })
    .sort({ points: -1 })
    .limit(5)
    .lean();
  
  console.log('Top 5:');
  top5.forEach((r, i) => {
    console.log(`${i+1}. ${r.points} pts (${r.wins}W/${r.losses}L) - user: ${r.user}`);
  });
  
  await mongoose.disconnect();
}

check();
