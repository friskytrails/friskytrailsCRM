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

    // Helper to create and await connection
    const tryConnect = (uri, isFallback = false) => {
      return new Promise((resolve, reject) => {
        const label = isFallback ? 'Primary cluster (ft_booking_system)' : 'BOOKING_MONGODB_URI';
        console.log(`Connecting to Secondary MongoDB [${label}]...`);

        const conn = mongoose.createConnection(uri, {
          dbName: 'ft_booking_system',
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000
        });

        conn.once('open', () => {
          console.log(`Successfully connected to Secondary MongoDB [${label}]!`);
          resolve(conn);
        });

        conn.once('error', (err) => {
          console.error(`Connection failed for Secondary MongoDB [${label}]:`, err.message);
          conn.close().catch(() => {});
          reject(err);
        });
      });
    };

    try {
      if (customUri) {
        try {
          bookingDbConnection = await tryConnect(customUri, false);
          isConnecting = false;
          return bookingDbConnection;
        } catch (customErr) {
          console.warn("BOOKING_MONGODB_URI failed (auth/network). Attempting fallback to primary MongoDB cluster for ft_booking_system database...");
        }
      }

      if (primaryUri) {
        bookingDbConnection = await tryConnect(primaryUri, true);
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
