const mongoose = require('mongoose');
const config = require('../config');

let bookingDbConnection = null;
let isConnecting = false;
let connectPromise = null;

async function connectBookingDB() {
  if (bookingDbConnection && bookingDbConnection.readyState === 1) {
    return bookingDbConnection;
  }

  if (isConnecting && connectPromise) {
    return connectPromise;
  }

  isConnecting = true;

  connectPromise = (async () => {
    const primaryUri = config.MONGODB_URI;
    const customUri = config.BOOKING_MONGODB_URI;

    const connOpts = {
      dbName: 'ft_booking_system',
      maxPoolSize: 3,
      minPoolSize: 0,
      maxIdleTimeMS: 10000,       // close idle connections after 10s
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 45000
    };

    try {
      if (customUri) {
        try {
          console.log('Connecting to Secondary MongoDB [BOOKING_MONGODB_URI]...');
          const conn = mongoose.createConnection(customUri, connOpts);
          bookingDbConnection = await conn.asPromise();
          console.log('Successfully connected to Secondary MongoDB [BOOKING_MONGODB_URI]!');
          isConnecting = false;
          return bookingDbConnection;
        } catch (customErr) {
          console.warn("BOOKING_MONGODB_URI failed (auth/network). Attempting fallback to primary MongoDB cluster for ft_booking_system database...");
        }
      }

      if (primaryUri) {
        console.log('Connecting to Secondary MongoDB [Primary cluster (ft_booking_system)]...');
        const conn = mongoose.createConnection(primaryUri, connOpts);
        bookingDbConnection = await conn.asPromise();
        console.log('Successfully connected to Secondary MongoDB [Primary cluster (ft_booking_system)]!');
        isConnecting = false;
        return bookingDbConnection;
      }

      throw new Error("No MongoDB URI available for booking connection.");
    } catch (error) {
      isConnecting = false;
      connectPromise = null;
      console.error("Critical failure connecting to Secondary MongoDB:", error.message);
      throw error;
    }
  })();

  return connectPromise;
}

function getBookingDB() {
  if (!bookingDbConnection) {
    connectBookingDB().catch(err => console.error("Async booking DB connect error:", err.message));
  }
  return bookingDbConnection;
}

module.exports = {
  connectBookingDB,
  getBookingDB
};
