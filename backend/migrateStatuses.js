require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('./models/Lead');

async function migrateStatuses() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const validStatuses = ['Fresh Leads', 'Interested Leads', 'Pre Prospect Leads', 'Prospect Leads', 'Booked', 'Rejected Leads'];
    
    console.log('Finding leads with invalid statuses...');
    const result = await Lead.Model.updateMany(
      { status: { $nin: validStatuses } },
      { $set: { status: 'Fresh Leads' } }
    );
    
    
    console.log('Migration complete!');
    console.log(`Matched ${result.matchedCount} leads.`);
    console.log(`Modified ${result.modifiedCount} leads.`);
    
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

migrateStatuses();
