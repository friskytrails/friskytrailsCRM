const mongoose = require('mongoose');
const config = require('../config');

let cachedConnection = null;

async function migrateLeads() {
  try {
    const LeadModule = require('../models/Lead');
    const leadsWithoutId = await LeadModule.Model.find({
      $or: [
        { leadId: { $exists: false } },
        { leadId: null }
      ]
    }).sort({ createdAt: 1 });

    if (leadsWithoutId.length > 0) {
      console.log(`[Migration] Found ${leadsWithoutId.length} leads without sequential leadId. Migrating...`);
      const lastLead = await LeadModule.Model.findOne({ leadId: { $exists: true, $ne: null } }).sort({ leadId: -1 });
      let currentId = lastLead && lastLead.leadId ? lastLead.leadId : 0;

      for (const lead of leadsWithoutId) {
        currentId += 1;
        await LeadModule.Model.updateOne({ _id: lead._id }, { $set: { leadId: currentId } });
      }
      console.log(`[Migration] Successfully assigned sequential IDs to ${leadsWithoutId.length} leads.`);
    }
  } catch (error) {
    console.error("[Migration] Error migrating leadIds:", error);
  }
}

async function connectDB() {
  const uri = config.MONGODB_URI;
  if (!uri) {
    console.error("CRITICAL: MONGODB_URI is not set in environment variables!");
    return null;
  }

  // If already connected or connecting, return the connection
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  if (cachedConnection) {
    return cachedConnection;
  }

  try {
    const conn = await mongoose.connect(uri, { 
      dbName: 'crm_website',
      serverSelectionTimeoutMS: 5000 // fail fast rather than hanging
    });
    cachedConnection = conn;
    console.log("Connected to MongoDB successfully via Mongoose (crm_website)!");
    
    // Run migration for existing documents without blocking server startup
    migrateLeads().catch(err => console.error("Migration task background error:", err));

    return cachedConnection;
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw error;
  }
}

module.exports = {
  connectDB
};
