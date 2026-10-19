/**
 * Backfill script: Parses notes of existing leads for travel timeline answers
 * (e.g. "When are you planning to travel? within_7_days") and populates `leadLevel` (L1, L2, L3, L4).
 *
 * Usage:
 *   node backend/scripts/backfillLeadLevels.js [--dry-run]
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { connectDB } = require('../db');
const Lead = require('../models/Lead').Model;
const { parseLeadLevel } = require('../utils/helpers');

async function run() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`\n=== Starting Lead Level Backfill ${isDryRun ? '[DRY RUN]' : ''} ===`);

  await connectDB();
  console.log('MongoDB connected.');

  const cursor = Lead.find({
    'notes.0': { $exists: true }
  })
    .select('_id name phone leadLevel notes.text')
    .lean()
    .cursor({ batchSize: 500 });

  let scanned = 0;
  let matched = 0;
  let changed = 0;
  let bulkOps = [];
  const levelCounts = { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 };
  const BATCH_SIZE = 500;

  for await (const lead of cursor) {
    scanned++;
    if (!lead.notes || !Array.isArray(lead.notes)) continue;
    let detectedLevel = null;
    let matchedText = '';

    for (const note of lead.notes) {
      if (!note || !note.text) continue;
      const text = note.text;
      // 1. Check for form question format: "When are you planning to travel? within_7_days"
      const match = text.match(/(?:planning to travel|planning to leave|leavingWhen|timeline)[\?:\s]+([^\n\r]+)/i);
      if (match) {
        detectedLevel = parseLeadLevel(match[1]);
        if (detectedLevel) matchedText = match[0];
      }
      // 2. Check for exact form token values inside the note (avoids false-matching general agent notes)
      if (!detectedLevel) {
        const tokenMatch = text.match(/\b(within_7_days|within_15_days|within_30_days|1[–\-—]3_months_later|just_exploring)\b/i);
        if (tokenMatch) {
          detectedLevel = parseLeadLevel(tokenMatch[1]);
          if (detectedLevel) matchedText = tokenMatch[0];
        }
      }
      if (detectedLevel) break;
    }

    if (detectedLevel) {
      matched++;
      levelCounts[detectedLevel] = (levelCounts[detectedLevel] || 0) + 1;

      // Only write to DB if the lead doesn't already have this level
      if (detectedLevel !== lead.leadLevel) {
        changed++;
        if (changed <= 10) {
          console.log(`  Lead ${lead._id}: ${lead.leadLevel || '(empty)'} -> ${detectedLevel} [Matched: "${matchedText.trim()}"]`);
        }
        bulkOps.push({
          updateOne: {
            filter: { _id: lead._id },
            update: { $set: { leadLevel: detectedLevel } }
          }
        });
      }
    }

    if (bulkOps.length >= BATCH_SIZE) {
      if (!isDryRun) {
        await Lead.bulkWrite(bulkOps);
        process.stdout.write(`  Processed ${scanned} leads... (${changed} updated)\r`);
      }
      bulkOps = [];
    }
  }

  if (bulkOps.length > 0 && !isDryRun) {
    await Lead.bulkWrite(bulkOps);
  }

  console.log(`\n\nResults summary:`);
  console.log(`Total scanned: ${scanned}`);
  console.log(`Total matched with timeline in notes: ${matched}`);
  console.log(`Updated / Corrected: ${changed}`);
  console.log(`Current Breakdown: L1=${levelCounts.L1}, L2=${levelCounts.L2}, L3=${levelCounts.L3}, L4=${levelCounts.L4}, L5=${levelCounts.L5}`);

  if (isDryRun) {
    console.log(`Dry run complete. No changes were committed.`);
  } else {
    console.log(`Updates successfully saved.`);
  }

  await mongoose.disconnect();
  console.log('MongoDB disconnected. Done.\n');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
