#!/usr/bin/env node

// Backfill peopleTravellingLevel from existing lead form-response notes.
// Usage: node scripts/updatePeopleTravellingLevels.js [--apply] [--overwrite]
// Default mode is a dry run. --overwrite also replaces levels already set.

require('dotenv').config();
const mongoose = require('mongoose');
const { Model: Lead } = require('../models/Lead');
const { connectDB } = require('../db');

const VALUE_TO_LEVEL = new Map([
  ['2_people', '2_people'],
  ['solo_person', 'solo_person'],
  ['7-9_people', '7-9_people'],
  ['7-10_people', '7-9_people'],
  ['3-4_people', '3-4_people'],
  ['5-6_people', '5-6_people'],
  ['10+_people', '10+_people']
]);

function normalizeAnswer(answer) {
  return String(answer || '')
    .trim()
    .toLowerCase()
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, '_');
}

function parsePeopleTravellingLevel(notes) {
  const matches = [];
  for (const note of notes || []) {
    const text = typeof note === 'string' ? note : note?.text;
    if (!text) continue;
    const lines = String(text).split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/how\s+many\s+people(?:\s+are)?\s+travelling\s*\??\s*[:\-]?\s*(.+?)\s*$/i)
        || line.match(/how\s+many\s+people\s*\??\s*[:\-]?\s*(.+?)\s*$/i);
      if (!match) continue;
      const value = normalizeAnswer(match[1]).replace(/[.,;]+$/, '');
      const level = VALUE_TO_LEVEL.get(value);
      if (level) matches.push(level);
    }
  }
  // Conflicting answers are ambiguous; leave the lead unchanged.
  const uniqueMatches = [...new Set(matches)];
  return uniqueMatches.length === 1 ? uniqueMatches[0] : null;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const overwrite = process.argv.includes('--overwrite');
  let scanned = 0;
  let matched = 0;
  let updated = 0;
  let skippedExisting = 0;

  try {
    await connectDB();
    const cursor = Lead.find({}).select('_id leadId name notes peopleTravellingLevel').lean().cursor();
    for await (const lead of cursor) {
      scanned += 1;
      const level = parsePeopleTravellingLevel(lead.notes);
      if (!level) continue;
      matched += 1;
      if (lead.peopleTravellingLevel && !overwrite) {
        skippedExisting += 1;
        continue;
      }

      console.log(`${apply ? 'UPDATE' : 'DRY RUN'} lead=${lead.leadId ?? lead._id} name=${JSON.stringify(lead.name || '')} level=${level}`);
      if (apply) {
        const filter = { _id: lead._id };
        if (!overwrite) {
          filter.peopleTravellingLevel = { $in: [null, ''] };
        }
        const result = await Lead.updateOne(filter, { $set: { peopleTravellingLevel: level } });
        if (result.modifiedCount > 0) {
          updated += 1;
        } else if (!overwrite) {
          skippedExisting += 1;
        }
      } else {
        updated += 1;
      }
    }

    console.log(`\n${apply ? 'Applied' : 'Dry run complete'}: scanned=${scanned}, matched=${matched}, updated=${updated}, skippedExisting=${skippedExisting}`);
    if (!apply) console.log('No database changes made. Re-run with --apply to save these updates.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('People travelling level update failed:', error);
  process.exitCode = 1;
});
