const Lead = require('../models/Lead');
const { invalidateCountsCache } = require('../services/leadService');
const crypto = require('crypto');

function sanitizePhone(rawPhone) {
  if (!rawPhone) return '';
  // Convert to string and extract all numeric digits (strips 'p:', '+91', spaces, hyphens, etc.)
  const digits = String(rawPhone).replace(/\D/g, '');
  // Take last 10 digits
  return digits.slice(-10);
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
    travelDate,
    numberOfPersons,
    pax,
    notes,
    tripDetails,
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

  const cleanEmail = (mailId || email || '').trim();

  // Extract numeric pax if string like "2_people"
  let parsedPax = numberOfPersons || pax;
  if (typeof parsedPax === 'string') {
    const match = parsedPax.match(/\d+/);
    parsedPax = match ? Number(match[0]) : null;
  }

  // Auto-detect destination if omitted and product/destination contains package keywords
  let finalDestination = destination ? String(destination).trim() : '';
  if (!finalDestination && product) {
    if (/kerala/i.test(product)) finalDestination = 'Kerala';
    else if (/meghalaya/i.test(product)) finalDestination = 'Meghalaya';
    else if (/spiti/i.test(product)) finalDestination = 'Spiti';
    else if (/ladakh/i.test(product)) finalDestination = 'Ladakh';
    else if (/goa/i.test(product)) finalDestination = 'Goa';
  }

  // Check if lead with this phone already exists
  const existingLead = await Lead.Model.findOne({ phone: cleanPhone });
  if (existingLead) {
    if (campaignName || adName || notes || tripDetails) {
      const details = tripDetails || notes || '';
      const noteText = `Inquiry via Meta Ads / Sheet: ${details ? 'Preferences: ' + details + ' | ' : ''}Campaign: "${campaignName || 'N/A'}", Ad: "${adName || 'N/A'}"`.trim();
      try {
        await Lead.pushNote(existingLead._id, {
          id: crypto.randomUUID(),
          text: noteText,
          timestamp: new Date().toISOString(),
          author: 'Meta Ads Sync'
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
  if (tripDetails || notes) {
    initialNotes.push({
      id: crypto.randomUUID(),
      text: `Customer Preferences: ${tripDetails || notes}`,
      timestamp: new Date().toISOString(),
      author: 'Form Response'
    });
  }
  if (campaignName || adName || platform) {
    initialNotes.push({
      id: crypto.randomUUID(),
      text: `Meta Ad Source: Campaign "${campaignName || 'N/A'}" | Ad "${adName || 'N/A'}"${platform ? ' | Platform: ' + platform : ''}`,
      timestamp: new Date().toISOString(),
      author: 'Meta Ads'
    });
  }

  const leadPayload = {
    name: name ? String(name).trim() || 'NA' : 'NA',
    phone: cleanPhone,
    origin: origin ? String(origin).trim() : '',
    destination: finalDestination,
    leadSource: leadSource ? String(leadSource).trim() : 'Facebook Ads',
    product: product ? String(product).trim() : 'Kerala Trip',
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

module.exports = {
  handleLeadWebhook,
  testWebhook
};
