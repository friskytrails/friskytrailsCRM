const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

const JWT_SECRET = config.JWT_SECRET;

// In-memory user cache with 60-second TTL to avoid DB lookup on every request
const userCache = new Map();
const CACHE_TTL = 60 * 1000; // 60 seconds

/** Invalidate a specific user from the auth cache (call on role/status changes) */
function invalidateUserCache(userId) {
  if (userId) userCache.delete(String(userId));
}

module.exports = async function (req, res, next) {
  let token;
  const authHeader = req.header('Authorization');
  
  if (!authHeader) {
    return res.status(401).json({ error: "No token, authorization denied" });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: "Token format is invalid" });
  }
  token = parts[1];
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: "Token is not valid" });
  }
  
  try {
    // Dynamic Role Check — use cache when available
    const cacheKey = String(decoded.userId);
    const cached = userCache.get(cacheKey);
    let user;

    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      user = cached.user;
    } else {
      user = await User.findById(decoded.userId);
      if (user) {
        userCache.set(cacheKey, { user, timestamp: Date.now() });
      }
    }

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (user.status !== 'Active') {
       return res.status(403).json({ error: "Account is not active. Please contact administrator." });
    }
    req.user = {
      ...decoded,
      name: user.name || decoded.name || 'Agent',
      email: user.email || decoded.email || '',
      isAdmin: !!user.isAdmin,
      isManager: !!user.isManager,
      isItinerary: !!user.isItinerary,
      status: user.status
    };
    next();
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports.invalidateUserCache = invalidateUserCache;
