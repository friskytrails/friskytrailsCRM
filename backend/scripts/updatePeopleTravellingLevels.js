#!/usr/bin/env node

// Backfill peopleTravellingLevel from existing lead form-response notes.
// Usage: node scripts/updatePeopleTravellingLevels.js [--apply] [--overwrite]
// Default mode is a dry run. --overwrite also replaces levels already set.

require('dotenv').config();
const mongoose = require('mongoose');
const { Model: Lead } = require('../models/Lead');
const { connectDB } = require('../db');

const VALUE_TO_LEVEL = new Map([
  ['solo', 'solo_person'],
  ['solo_person', 'solo_person'],
  ['single', 'solo_person'],
  ['1', 'solo_person'],
  ['1_person', 'solo_person'],
  ['2', '2_people'],
  ['2_people', '2_people'],
  ['two', '2_people'],
  ['couple', '2_people'],
  ['3-4', '3-4_people'],
  ['3-4_people', '3-4_people'],
  ['3_4_people', '3-4_people'],
  ['5-6', '5-6_people'],
  ['5-6_people', '5-6_people'],
  ['5_6_people', '5-6_people'],
  ['7-9', '7-9_people'],
  ['7-9_people', '7-9_people'],
  ['7-10', '7-9_people'],
  ['7-10_people', '7-9_people'],
  ['7_10_people', '7-9_people'],
  ['10+', '10+_people'],
  ['10+_people', '10+_people'],
  ['10_plus', '10+_people'],
  ['10_plus_people', '10+_people'],
  ['more_than_10', '10+_people']
]);

function normalizeAnswer(answer) {
  return String(answer || '')
    .trim()
    .toLowerCase()
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, '_');
}

function parsePeopleTravellingLevel(lead) {
  const matches = [];

  // Check direct numberOfPersons/numberOfPeople fields on the lead document if present
  const directSources = [lead.numberOfPeople, lead.numberOfPersons, lead.pax];
  for (const src of directSources) {
    if (!src && src !== 0) continue;
    const norm = normalizeAnswer(src).replace(/[.,;]+$/, '');
    const directMatch = VALUE_TO_LEVEL.get(norm);
    if (directMatch) matches.push(directMatch);
  }

  // Check lead notes
  for (const note of lead.notes || []) {
    const text = typeof note === 'string' ? note : note?.text;
    if (!text) continue;
    const lines = String(text).split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/how\s+many\s+people(?:\s+are)?\s+travelling\s*\??\s*[:\-]?\s*(.+?)\s*$/i)
        || line.match(/how\s+many\s+people\s*\??\s*[:\-]?\s*(.+?)\s*$/i)
        || line.match(/passengers?\s*\??\s*[:\-]?\s*(.+?)\s*$/i)
        || line.match(/pax\s*\??\s*[:\-]?\s*(.+?)\s*$/i);
      if (!match) continue;
      const value = normalizeAnswer(match[1]).replace(/[.,;]+$/, '');
      const level = VALUE_TO_LEVEL.get(value);
      if (level) matches.push(level);
    }
  }

  // Fallback pattern matching if no exact map match
  if (matches.length === 0) {
    const allNotesText = (lead.notes || []).map(n => (typeof n === 'string' ? n : n?.text || '')).join('\n');
    const combined = `${directSources.filter(Boolean).join(' ')} ${allNotesText}`.toLowerCase();
    if (/\b(?:solo|single)\b/.test(combined)) matches.push('solo_person');
    else if (/\b(?:10\+|10\s*plus|more\s*than\s*10|10\s*or\s*more)\b/.test(combined)) matches.push('10+_people');
    else if (/\b(?:7\s*[-to\s]+\s*9|7\s*[-to\s]+\s*10)\b/.test(combined)) matches.push('7-9_people');
    else if (/\b(?:5\s*[-to\s]+\s*6)\b/.test(combined)) matches.push('5-6_people');
    else if (/\b(?:3\s*[-to\s]+\s*4)\b/.test(combined)) matches.push('3-4_people');
    else if (/\b(?:2\s*people|2\s*persons?|couple)\b/.test(combined)) matches.push('2_people');
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
    const cursor = Lead.find({}).select('_id leadId name notes numberOfPeople numberOfPersons pax peopleTravellingLevel').lean().cursor();
    for await (const lead of cursor) {
      scanned += 1;
      const level = parsePeopleTravellingLevel(lead);
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
