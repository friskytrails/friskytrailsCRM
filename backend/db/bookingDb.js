const mongoose = require('mongoose');
const config = require('../config');
const { connectDB } = require('./index');

let bookingDbConnection = null;
let isConnecting = false;
let connectPromise = null;

function isSameCluster(uri1, uri2) {
  if (!uri1 || !uri2) return false;
  try {
    const host1 = uri1.split('@')[1]?.split('/')[0]?.split('?')[0];
    const host2 = uri2.split('@')[1]?.split('/')[0]?.split('?')[0];
    return Boolean(host1 && host2 && host1 === host2);
  } catch {
    return false;
  }
}

async function connectBookingDB() {
  const primaryUri = config.MONGODB_URI;
  const customUri = config.BOOKING_MONGODB_URI;

  // If same cluster or no custom URI, share the main connection pool (0ms fast-path)
  if (!customUri || customUri === primaryUri || isSameCluster(primaryUri, customUri)) {
    const conn = await connectDB();
    if (!conn || mongoose.connection.readyState !== 1) {
      throw new Error("Cannot share connection pool: primary MongoDB connection is not established.");
    }
    bookingDbConnection = mongoose.connection.useDb('ft_booking_system', { useCache: true });
    return bookingDbConnection;
  }

  // If completely different external cluster, create separate pool
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
      maxPoolSize: config.MONGODB_MAX_POOL_SIZE,
      minPoolSize: 0,
      maxIdleTimeMS: 10000,
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
      console.warn("BOOKING_MONGODB_URI failed. Falling back to primary cluster for ft_booking_system...");
      const conn = await connectDB();
      if (!conn || mongoose.connection.readyState !== 1) {
        throw new Error("Cannot share connection pool: primary MongoDB connection is not established.");
      }
      bookingDbConnection = mongoose.connection.useDb('ft_booking_system', { useCache: true });
      isConnecting = false;
      return bookingDbConnection;
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
