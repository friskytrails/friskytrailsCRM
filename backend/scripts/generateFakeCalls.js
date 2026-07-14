require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const CallLog = require('../models/CallLog');

async function generateFakeCalls() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("No MONGODB_URI in .env");

    await mongoose.connect(uri, { dbName: 'crm_website' });
    console.log("Connected to MongoDB");

    // Clear existing calls just in case
    await CallLog.deleteMany({});
    console.log("Cleared existing CallLogs");

    const users = await User.Model.find({});
    if (users.length === 0) {
      console.log("No users found. Cannot generate calls.");
      process.exit(0);
    }
    
    console.log(`Found ${users.length} users. Generating calls...`);

    const statuses = ['Connected', 'Missed', 'Failed', 'Voicemail'];
    
    // Generate dates between June 20th and Today
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30); // past 30 days
    
    let totalCreated = 0;

    for (const user of users) {
      const numCalls = Math.floor(Math.random() * 50) + 10; // 10 to 60 calls per user
      for (let i = 0; i < numCalls; i++) {
        const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        // Only connected calls have duration > 0 (mostly)
        let duration = 0;
        if (status === 'Connected') {
          duration = Math.floor(Math.random() * 600) + 10; // 10 to 610 seconds
        }

        const contactNumber = "9" + Math.floor(100000000 + Math.random() * 900000000).toString(); // random 10 digit number starting with 9

        await CallLog.create({
          agentId: user._id,
          duration,
          timestamp: new Date(randomTime),
          status,
          contactNumber
        });
        totalCreated++;
      }
    }

    console.log(`Successfully generated ${totalCreated} fake call logs.`);
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

generateFakeCalls();
