const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

const JWT_SECRET = config.JWT_SECRET;

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
    // Dynamic Role Check
    const user = await User.findById(decoded.userId);
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
