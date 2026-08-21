const mongoose = require('mongoose');
const config = require('../config');

let cachedConnection = null;
let isConnecting = false;
let connectPromise = null;

async function connectDB() {
  const uri = config.MONGODB_URI;
  if (!uri) {
    console.error("CRITICAL: MONGODB_URI is not set in environment variables!");
    return null;
  }

  // 1. If already fully connected, return immediately (0ms fast-path)
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // 2. If a connection is already in progress, reuse the in-flight promise
  if (isConnecting && connectPromise) {
    return connectPromise;
  }

  isConnecting = true;

  connectPromise = (async () => {
    try {
      const conn = await mongoose.connect(uri, { 
        dbName: 'crm_website',
        maxPoolSize: 5,
        minPoolSize: 0,
        serverSelectionTimeoutMS: 5000, // fail fast rather than hanging
        socketTimeoutMS: 45000
      });
      cachedConnection = conn;
      isConnecting = false;
      console.log("Connected to MongoDB successfully via Mongoose (crm_website)!");
      return cachedConnection;
    } catch (error) {
      isConnecting = false;
      connectPromise = null;
      console.error("Failed to connect to MongoDB:", error);
      throw error;
    }
  })();

  return connectPromise;
}

module.exports = {
  connectDB
};
