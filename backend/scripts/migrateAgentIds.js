require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config');
const Lead = require('../models/Lead');

async function migrateAgentIds() {
  try {
    await mongoose.connect(config.MONGODB_URI || 'mongodb://localhost:27017/crm_website', { dbName: 'crm_website' });
    console.log('Connected to MongoDB');

    // Find leads that have a non-null agentId and empty agentIds array
    // Since we changed the schema, Mongoose might not load the old field easily if it's removed from schema,
    // but we can bypass mongoose strict mode or use native MongoDB collection.
    const collection = mongoose.connection.collection('leads');
    
    const leadsToMigrate = await collection.find({
      agentId: { $exists: true, $ne: null }
    }).toArray();

    console.log(`Found ${leadsToMigrate.length} leads to migrate.`);

    let modifiedCount = 0;
    for (const lead of leadsToMigrate) {
      const agentIds = Array.isArray(lead.agentIds) && lead.agentIds.length > 0 
        ? lead.agentIds 
        : [lead.agentId];
        
      await collection.updateOne(
        { _id: lead._id },
        { 
          $set: { agentIds },
          $unset: { agentId: "" } 
        }
      );
      modifiedCount++;
    }

    console.log(`Migration completed successfully. Modified ${modifiedCount} documents.`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

if (require.main === module) {
  migrateAgentIds().catch(err => {
    console.error('Unhandled rejection:', err);
    process.exit(1);
  });
}

module.exports = migrateAgentIds;
