const Lead = require('../models/Lead');
const GlobalConfig = require('../models/GlobalConfig');
const { invalidateCountsCache } = require('../services/leadService');
const mongoose = require('mongoose');
const crypto = require('crypto');

function sanitizePhone(rawPhone) {
  if (!rawPhone) return '';
  // Convert to string and extract all numeric digits (strips 'p:', '+91', spaces, hyphens, etc.)
  const digits = String(rawPhone).replace(/\D/g, '');
  // Take last 10 digits
  return digits.slice(-10);
}

// Safely parse passenger count from inputs like "3-4_people" -> 4, "solo_person" -> 1, "2_people" -> 2
function parsePax(raw) {
  if (!raw && raw !== 0) return null;
  const str = String(raw).trim().toLowerCase();
  if (str.includes('solo') || str.includes('single')) return 1;
  const rangeMatch = str.match(/(\d+)\s*(?:[-–—]|to)\s*(\d+)/i);
  if (rangeMatch) {
    return Number(rangeMatch[2]); // Return upper bound of range (e.g. 4 for "3-4", 10 for "7-10")
  }
  const match = str.match(/\d+/);
  return match ? Number(match[0]) : null;
}

// Dynamically check and map product against products available in GlobalConfig
async function resolveProductFromConfig(inputProduct, allowCreate = false) {
  let availableProducts = [
    "Meghalaya Package",
    "Hampta Pass Trek",
    "Rishikesh Activities",
    "Spiti Package",
    "Ladakh Package",
    "Kerala Trip"
  ];

  try {
    const config = await GlobalConfig.findOne({ key: 'GLOBAL_SETTINGS' });
    if (config && Array.isArray(config.products) && config.products.length > 0) {
      availableProducts = config.products;
    }
  } catch (err) {
    console.warn('Error fetching GlobalConfig for products:', err.message);
  }

  if (!inputProduct) {
    return { resolved: availableProducts[0] || 'Kerala Trip', matched: true };
  }

  const raw = String(inputProduct).trim();

  // 1. Exact match (case-insensitive)
  const exactMatch = availableProducts.find(p => p.toLowerCase() === raw.toLowerCase());
  if (exactMatch) return { resolved: exactMatch, matched: true };

  // 2. Substring match (e.g., "Kerala" -> "Kerala Trip", "Meghalaya" -> "Meghalaya Package")
  const subMatch = availableProducts.find(p => {
    const pLow = p.toLowerCase();
    const rawLow = raw.toLowerCase();
    return pLow.includes(rawLow) || rawLow.includes(pLow);
  });
  if (subMatch) return { resolved: subMatch, matched: true };

  // 3. Keyword matching for common tour regions
  for (const p of availableProducts) {
    const pLow = p.toLowerCase();
    const rawLow = raw.toLowerCase();
    if (rawLow.includes('kerala') && pLow.includes('kerala')) return { resolved: p, matched: true };
    if (rawLow.includes('meghalaya') && pLow.includes('meghalaya')) return { resolved: p, matched: true };
    if (rawLow.includes('spiti') && pLow.includes('spiti')) return { resolved: p, matched: true };
    if (rawLow.includes('ladakh') && pLow.includes('ladakh')) return { resolved: p, matched: true };
    if (rawLow.includes('hampta') && pLow.includes('hampta')) return { resolved: p, matched: true };
    if (rawLow.includes('rishikesh') && pLow.includes('rishikesh')) return { resolved: p, matched: true };
  }

  // 4. If user confirmed creating a new product
  if (allowCreate) {
    try {
      await GlobalConfig.findOneAndUpdate(
        { key: 'GLOBAL_SETTINGS' },
        { 
          $setOnInsert: { key: 'GLOBAL_SETTINGS' },
          $addToSet: { products: raw }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return { resolved: raw, matched: true, newlyCreated: true };
    } catch (err) {
      console.warn('Error adding new product to GlobalConfig:', err.message);
    }
  }

  // Not found in GlobalConfig
  return { resolved: raw, matched: false, availableProducts };
}

async function processSingleLead(data) {
  const {
    name,
    phone,
    email,
    mailId,
    origin,
    destination,
    leadSource,
    product,
    allowCreateProduct,
    travelDate,
    numberOfPersons,
    pax,
    notes,
    // Three separate travel-preference fields from Google Sheets form
    leavingWhen,        // "When are you planning to leave?"
    numberOfPeople,     // "How many people?"
    daysInDestination,  // "How many days do you want to spend in Kerala/Meghalaya?"
    tripDetails,        // Legacy merged field (kept for backward compat)
    platform,
    campaignName,
    adName
  } = data;

  const cleanPhone = sanitizePhone(phone);
  if (!cleanPhone || !/^\d{10}$/.test(cleanPhone)) {
    return {
      success: false,
      error: `Invalid phone number "${phone || ''}". Expected at least 10 valid digits.`
    };
  }

  // Resolve product against GlobalConfig products
  const productResult = await resolveProductFromConfig(product, Boolean(allowCreateProduct));
  if (!productResult.matched && !allowCreateProduct) {
    return {
      success: false,
      productNotFound: true,
      product: product ? String(product).trim() : '',
      availableProducts: productResult.availableProducts,
      error: `Product "${product || ''}" does not match any existing product in CRM Global Settings.`
    };
  }
  const resolvedProduct = productResult.resolved;
  const cleanEmail = (mailId || email || '').trim();

  // Extract numeric pax safely (e.g. "3-4_people" -> 4, "solo_person" -> 1, "2_people" -> 2)
  let parsedPax = parsePax(numberOfPeople) || parsePax(numberOfPersons) || parsePax(pax);

  // Auto-detect destination if omitted and product/destination contains package keywords
  let finalDestination = destination ? String(destination).trim() : '';
  if (!finalDestination && resolvedProduct) {
    if (/kerala/i.test(resolvedProduct)) finalDestination = 'Kerala';
    else if (/meghalaya/i.test(resolvedProduct)) finalDestination = 'Meghalaya';
    else if (/spiti/i.test(resolvedProduct)) finalDestination = 'Spiti';
    else if (/ladakh/i.test(resolvedProduct)) finalDestination = 'Ladakh';
    else if (/goa/i.test(resolvedProduct)) finalDestination = 'Goa';
  }

  // Check if lead with this phone already exists
  const existingLead = await Lead.Model.findOne({ phone: cleanPhone });
  if (existingLead) {
    // For duplicate leads, add new inquiry notes without overwriting anything
    const dupNow = new Date().toISOString();
    const dupNotes = [];
    if (leavingWhen && String(leavingWhen).trim())
      dupNotes.push(`When are you planning to leave? ${String(leavingWhen).trim()}`);
    if (numberOfPeople && String(numberOfPeople).trim())
      dupNotes.push(`How many people? ${String(numberOfPeople).trim()}`);
    if (daysInDestination && String(daysInDestination).trim())
      dupNotes.push(`How many days? ${String(daysInDestination).trim()}`);
    if (!dupNotes.length && (tripDetails || notes))
      dupNotes.push(`Preferences: ${tripDetails || notes}`);

    if (dupNotes.length) {
      try {
        await Lead.pushNote(existingLead._id, {
          id: new mongoose.Types.ObjectId().toString(),
          text: dupNotes.join('\n'),
          timestamp: dupNow,
          author: 'Form Response'
        });
      } catch (err) {
        console.warn('Could not push note to existing lead:', err.message);
      }
    }

    return {
      success: true,
      duplicate: true,
      leadId: existingLead.leadId,
      message: `Lead already exists in CRM (Lead ID: ${existingLead.leadId || existingLead._id})`
    };
  }

  // Create new lead
  const initialNotes = [];
  const now = new Date().toISOString();

  // Merge the 3 travel preference fields into notes as 3 lines
  const travelLines = [];
  if (leavingWhen && String(leavingWhen).trim()) {
    travelLines.push(`When are you planning to travel? ${String(leavingWhen).trim()}`);
  }
  if (numberOfPeople && String(numberOfPeople).trim()) {
    travelLines.push(`How many people are travelling? ${String(numberOfPeople).trim()}`);
  }
  if (daysInDestination && String(daysInDestination).trim()) {
    travelLines.push(`How many days do you want to spend? ${String(daysInDestination).trim()}`);
  }

  if (travelLines.length > 0) {
    initialNotes.push({
      id: new mongoose.Types.ObjectId().toString(),
      text: travelLines.join('\n'),
      timestamp: now,
      author: 'Form Response'
    });
  } else if (tripDetails || notes) {
    // Fallback: legacy merged tripDetails string
    initialNotes.push({
      id: new mongoose.Types.ObjectId().toString(),
      text: String(tripDetails || notes).replace(/\s*\|\s*/g, '\n'),
      timestamp: now,
      author: 'Form Response'
    });
  }

  const leadPayload = {
    name: name ? String(name).trim() || 'NA' : 'NA',
    phone: cleanPhone,
    origin: origin ? String(origin).trim() : '',
    destination: finalDestination,
    leadSource: leadSource ? String(leadSource).trim() : 'AdCampaign',
    product: resolvedProduct,
    travelDate: travelDate ? String(travelDate).trim() : '',
    numberOfPersons: parsedPax,
    agentIds: [],
    labels: [],
    status: 'Fresh Leads',
    notes: initialNotes,
    createdBy: {
      name: 'Google Sheets Webhook',
      email: 'system@friskytrails.com'
    }
  };

  if (cleanEmail) {
    // Check if email already belongs to another lead
    const emailExists = await Lead.Model.findOne({ mailId: cleanEmail });
    if (!emailExists) {
      leadPayload.mailId = cleanEmail;
    }
  }

  const insertResult = await Lead.insertLead(leadPayload);
  if (typeof invalidateCountsCache === 'function') {
    invalidateCountsCache();
  }

  return {
    success: true,
    duplicate: false,
    leadId: insertResult.leadId,
    message: `Lead created successfully (Lead ID: ${insertResult.leadId})`
  };
}

// POST /api/leads/webhook
async function handleLeadWebhook(req, res) {
  try {
    const body = req.body;

    // Handle bulk array of leads
    if (body.leads && Array.isArray(body.leads)) {
      const results = [];
      for (const leadData of body.leads) {
        try {
          const resSingle = await processSingleLead(leadData);
          results.push(resSingle);
        } catch (singleErr) {
          results.push({ success: false, error: singleErr.message });
        }
      }
      if (typeof invalidateCountsCache === 'function') {
        invalidateCountsCache();
      }
      return res.json({
        success: true,
        processed: results.length,
        results
      });
    }

    // Handle single lead
    const result = await processSingleLead(body);
    if (!result.success && !result.duplicate) {
      return res.status(400).json(result);
    }
    return res.status(result.duplicate ? 200 : 201).json(result);
  } catch (error) {
    console.error('Webhook Lead Ingestion Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// GET or POST /api/leads/webhook/test
async function testWebhook(req, res) {
  res.json({
    success: true,
    message: 'Frisky Trails CRM Webhook is active and connected!',
    timestamp: new Date().toISOString()
  });
}

// GET /api/leads/webhook/products
async function getProductsWebhook(req, res) {
  try {
    const config = await GlobalConfig.findOne({ key: 'GLOBAL_SETTINGS' });
    const products = (config && Array.isArray(config.products) && config.products.length > 0)
      ? config.products
      : [
          "Meghalaya Package",
          "Hampta Pass Trek",
          "Rishikesh Activities",
          "Spiti Package",
          "Ladakh Package",
          "Kerala Trip"
        ];
    return res.json({ success: true, products });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

// POST /api/leads/webhook/products
async function createProductWebhook(req, res) {
  try {
    const { product } = req.body;
    if (!product || !String(product).trim()) {
      return res.status(400).json({ success: false, error: 'Product name is required' });
    }
    const cleanProduct = String(product).trim();

    const config = await GlobalConfig.findOne({ key: 'GLOBAL_SETTINGS' });
    const currentProducts = (config && Array.isArray(config.products)) ? config.products : [];

    const existingMatch = currentProducts.find(p => p.toLowerCase() === cleanProduct.toLowerCase());
    if (existingMatch) {
      return res.json({
        success: true,
        alreadyExists: true,
        product: existingMatch,
        message: `Product "${existingMatch}" already exists in CRM Global Settings.`,
        products: currentProducts
      });
    }

    const updatedConfig = await GlobalConfig.findOneAndUpdate(
      { key: 'GLOBAL_SETTINGS' },
      { 
        $setOnInsert: { key: 'GLOBAL_SETTINGS' },
        $addToSet: { products: cleanProduct }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({
      success: true,
      created: true,
      product: cleanProduct,
      message: `Product "${cleanProduct}" successfully created in CRM Global Settings.`,
      products: updatedConfig.products
    });
  } catch (error) {
    console.error('Error creating product via webhook:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  handleLeadWebhook,
  testWebhook,
  getProductsWebhook,
  createProductWebhook
};
