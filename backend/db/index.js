const mongoose = require('mongoose');
const config = require('../config');

let cachedConnection = null;


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
    

    return cachedConnection;
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw error;
  }
}

module.exports = {
  connectDB
};
