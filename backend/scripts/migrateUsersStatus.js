const mongoose = require('mongoose');
const config = require('../config');
const User = require('../models/User');

async function migrateUsersStatus() {
  try {
    await mongoose.connect(config.MONGODB_URI || 'mongodb://localhost:27017/crm_website', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    const result = await User.Model.updateMany(
      { status: { $exists: false } },
      { $set: { status: 'Active' } }
    );

    console.log(`Migration completed successfully. Modified ${result.nModified || result.modifiedCount} documents.`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

if (require.main === module) {
  migrateUsersStatus();
}

module.exports = migrateUsersStatus;
