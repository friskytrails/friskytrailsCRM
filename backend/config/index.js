require('dotenv').config();

function getMaxPoolSize() {
  const val = process.env.MONGODB_MAX_POOL_SIZE;
  if (val === undefined || val === null || val === '') {
    return 3; // Default pool size
  }
  const parsed = Number(val);
  // Ensure it's an integer, not NaN, and >= 1
  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.warn(`WARNING: Invalid MONGODB_MAX_POOL_SIZE "${val}". Defaulting to 3.`);
    return 3;
  }
  return parsed;
}

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI,
  BOOKING_MONGODB_URI: process.env.BOOKING_MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  MONGODB_MAX_POOL_SIZE: getMaxPoolSize()
};

