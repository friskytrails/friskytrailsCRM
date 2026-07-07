const express = require('express');
const Lead = require('../models/Lead').Model;
const router = express.Router();

// GET /cron/reset-daily
// Vercel cron triggers this via HTTP GET
router.get('/reset-daily', async (req, res) => {
  // Check authorization header to ensure this is only called by Vercel
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await Lead.updateMany({}, {
      $set: {
        'booking.dailyDial': 0,
        'booking.dailyTalkTime': '0:0'
      }
    });
    console.log(`Cron Reset Daily: Successfully reset daily stats for ${result.modifiedCount} leads.`);
    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('Error during daily reset cron:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
