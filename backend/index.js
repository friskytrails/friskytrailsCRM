const express = require('express');
const cors = require('cors');
const config = require('./config');
const { connectDB } = require('./db');
const apiRoutes = require('./routes');

const app = express();

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or postman)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      "https://friskytrails-crm.vercel.app",
      "http://localhost:5173"
    ];

    // Check if origin matches hardcoded list or is a Vercel preview URL for your project
    const isAllowed = allowedOrigins.includes(origin) ||
      (origin.startsWith("https://friskytrails-crm-") && origin.endsWith(".vercel.app"));

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(null, false); // Block CORS header injection without crashing Express
    }
  },
  credentials: true
};

app.use(cors(corsOptions));

app.use(express.json());

// Ensure database is connected before handling API routes
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Critical database connection failure:", error);
    res.status(500).json({ error: "Database connection failed. Check your MongoDB Atlas IP Access List." });
  }
}, apiRoutes);

// Start server if run directly (e.g. node index.js)
if (require.main === module) {
  app.listen(config.PORT, () => {
    console.log(`Backend server is running on http://localhost:${config.PORT}`);
  });
}

module.exports = app;
