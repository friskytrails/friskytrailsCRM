const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

const JWT_SECRET = config.JWT_SECRET;

module.exports = async function (req, res, next) {
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ error: "No token, authorization denied" });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: "Token format is invalid" });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Dynamic Role Check
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (!user.isAdmin && user.status !== 'Active') {
       return res.status(403).json({ error: "Account is not active. Please contact administrator." });
    }

    req.user = {
      ...decoded,
      isAdmin: !!user.isAdmin,
      status: user.status
    };
    
    next();
  } catch (err) {
    res.status(401).json({ error: "Token is not valid" });
  }
};
