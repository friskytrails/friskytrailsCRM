const mongoose = require('mongoose');
const config = require('../config');
const { connectDB } = require('./index');

let bookingDbConnection = null;
let isConnecting = false;
let connectPromise = null;

async function connectBookingDB() {
  const primaryUri = config.MONGODB_URI;
  const customUri = config.BOOKING_MONGODB_URI;

  // If different clusters, attempt to create a separate connection pool
  if (customUri && customUri !== primaryUri) {
    if (bookingDbConnection && bookingDbConnection.readyState === 1) {
      return bookingDbConnection;
    }

    if (isConnecting && connectPromise) {
      return connectPromise;
    }

    isConnecting = true;

    connectPromise = (async () => {
      const connOpts = {
        dbName: 'ft_booking_system',
        maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '3', 10),
        minPoolSize: 0,
        maxIdleTimeMS: 10000,       // close idle connections after 10s
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 45000
      };

      try {
        console.log('Connecting to Secondary MongoDB [BOOKING_MONGODB_URI]...');
        const conn = mongoose.createConnection(customUri, connOpts);
        bookingDbConnection = await conn.asPromise();
        console.log('Successfully connected to Secondary MongoDB [BOOKING_MONGODB_URI]!');
        isConnecting = false;
        return bookingDbConnection;
      } catch (customErr) {
        console.warn("BOOKING_MONGODB_URI failed (auth/network). Attempting fallback to primary MongoDB cluster for ft_booking_system database...");
        // Fall back to sharing the main connection pool
        await connectDB();
        bookingDbConnection = mongoose.connection.useDb('ft_booking_system', { useCache: true });
        isConnecting = false;
        return bookingDbConnection;
      }
    })();

    return connectPromise;
  } else {
    // Share connection pool to cut connections in half
    await connectDB();
    bookingDbConnection = mongoose.connection.useDb('ft_booking_system', { useCache: true });
    return bookingDbConnection;
  }
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
