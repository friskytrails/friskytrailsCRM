const express = require('express');
const Lead = require('../models/Lead').Model;
const { parseLeadLevel } = require('../utils/helpers');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const router = express.Router();

// GET /cron/ping
// Lightweight warm-up ping route (zero DB overhead)
router.get('/ping', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// GET /cron/reset-daily
// Vercel cron triggers this via HTTP GET
router.get('/reset-daily', async (req, res) => {
  // Check authorization header to ensure this is only called by Vercel
  const authHeader = req.headers.authorization;
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const leadResult = await Lead.updateMany({}, {
      $set: {
        'booking.dailyDial': 0,
        'booking.dailyTalkTime': '0:0'
      }
    });

    console.log(`Cron Reset Daily: Successfully reset daily stats for ${leadResult.modifiedCount} leads.`);
    res.json({ success: true, leadModifiedCount: leadResult.modifiedCount });
  } catch (error) {
    console.error('Error during daily reset cron:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / GET /cron/backfill-lead-levels
// Scans leads missing leadLevel, parses their notes for travel timeline answers, and updates leadLevel.
router.all('/backfill-lead-levels', async (req, res) => {
  const authHeader = req.headers.authorization;
  let isAuthorized = false;

  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    isAuthorized = true;
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, config.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      if (user && user.isAdmin) {
        isAuthorized = true;
      }
    } catch (_) {
      // not a valid admin token
    }
  }

  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized. Requires CRON_SECRET or Admin Bearer token.' });
  }

  try {
    const cursor = Lead.find({
      'notes.0': { $exists: true }
    })
      .select('_id leadLevel notes.text')
      .lean()
      .cursor({ batchSize: 500 });

    let scannedCount = 0;
    let updatedCount = 0;
    let bulkOps = [];
    const BATCH_SIZE = 500;

    for await (const lead of cursor) {
      scannedCount++;
      if (!lead.notes || !Array.isArray(lead.notes)) continue;
      let detectedLevel = null;

      for (const note of lead.notes) {
        if (!note || !note.text) continue;
        const text = note.text;
        const match = text.match(/(?:planning to travel|planning to leave|leavingWhen|timeline)[\?:\s]+([^\n\r]+)/i);
        if (match) {
          detectedLevel = parseLeadLevel(match[1]);
        }
        if (!detectedLevel) {
          const tokenMatch = text.match(/\b(within_7_days|within_15_days|within_30_days|1[–\-—]3_months_later|just_exploring)\b/i);
          if (tokenMatch) {
            detectedLevel = parseLeadLevel(tokenMatch[1]);
          }
        }
        if (detectedLevel) break;
      }

      // Update if a level was detected and it differs from the current leadLevel (e.g. correcting misclassified L4 to L3)
      if (detectedLevel && detectedLevel !== lead.leadLevel) {
        bulkOps.push({
          updateOne: {
            filter: { _id: lead._id },
            update: { $set: { leadLevel: detectedLevel } }
          }
        });
        updatedCount++;
      }

      if (bulkOps.length >= BATCH_SIZE) {
        await Lead.bulkWrite(bulkOps);
        bulkOps = [];
      }
    }

    if (bulkOps.length > 0) {
      await Lead.bulkWrite(bulkOps);
    }

    res.json({
      success: true,
      scannedLeads: scannedCount,
      updatedCount
    });
  } catch (error) {
    console.error('Error during lead level backfill:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
