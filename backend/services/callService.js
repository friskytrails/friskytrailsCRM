const CallLog = require('../models/CallLog');
const User = require('../models/User');

async function logCall(data) {
  const { agentId, leadId, clientCallId, duration, timestamp, status, contactNumber } = data;
  
  if (!agentId || !status) {
    throw new Error('agentId and status are required');
  }

  const callLogData = {
    agentId,
    duration: duration || 0,
    timestamp: timestamp || new Date(),
    status,
    contactNumber: contactNumber ? contactNumber.replace(/\s+/g, '') : ''
  };

  if (clientCallId) {
    callLogData.clientCallId = clientCallId;
  }

  if (leadId) {
    callLogData.leadId = leadId;
  }

  const matchQuery = { agentId };
  if (clientCallId) {
    matchQuery.clientCallId = clientCallId;
  } else {
    matchQuery.timestamp = callLogData.timestamp;
    matchQuery.contactNumber = callLogData.contactNumber;
    matchQuery.status = callLogData.status;
  }

  const callLog = await CallLog.findOneAndUpdate(
    matchQuery,
    { $setOnInsert: callLogData },
    { upsert: true, new: true }
  );
  return callLog;
}

async function getHistoricalReports(startDate, endDate, team, agentIdCondition) {
  let matchQuery = {};
  if (agentIdCondition !== undefined) {
    const mongoose = require('mongoose');
    matchQuery.agentId = typeof agentIdCondition === 'string' && mongoose.Types.ObjectId.isValid(agentIdCondition)
      ? new mongoose.Types.ObjectId(agentIdCondition)
      : agentIdCondition;
  }
  let start, end;
  if (startDate && endDate) {
    start = new Date(startDate.includes('T') ? startDate : `${startDate}T00:00:00.000`);
    end = new Date(endDate.includes('T') ? endDate : `${endDate}T23:59:59.999`);
  } else {
    // Default to Present Day if no explicit date range is provided
    end = new Date();
    start = new Date();
    start.setHours(0, 0, 0, 0);
  }

  matchQuery.timestamp = {
    $gte: start,
    $lte: end
  };

  const reports = await CallLog.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: "$agentId",
        talkTime: { $sum: "$duration" },
        totalDials: { $sum: 1 },
        uniqueContacts: { $addToSet: "$contactNumber" },
        connectedCalls: { 
          $sum: { $cond: [{ $eq: ["$status", "Connected"] }, 1, 0] }
        },
        longCalls: {
          $sum: { $cond: [{ $gte: ["$duration", 300] }, 1, 0] }
        }
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "agent"
      }
    },
    { $unwind: "$agent" },
    { $match: { "agent.status": { $nin: ["Inactive", "Former Employee"] } } }
  ]);

  const formattedReports = reports.map(r => {
    return {
      agentId: r._id,
      name: r.agent.name,
      tenure: Math.floor((new Date() - new Date(r.agent.createdAt)) / (1000 * 60 * 60 * 24)),
      talkTime: r.talkTime,
      totalDials: r.totalDials,
      uniqueCalls: r.uniqueContacts.filter(Boolean).length,
      connectedCalls: r.connectedCalls,
      longCalls: r.longCalls
    };
  });

  return formattedReports;
}

async function getLiveStatus(agentIdCondition) {
  const mongoose = require('mongoose');
  let matchQuery = {};
  if (agentIdCondition !== undefined) {
    matchQuery.agentId = typeof agentIdCondition === 'string' && mongoose.Types.ObjectId.isValid(agentIdCondition)
      ? new mongoose.Types.ObjectId(agentIdCondition)
      : agentIdCondition;
  }

  const recentCalls = await CallLog.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: "$agentId",
        lastCallTimestamp: { $max: "$timestamp" }
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "agent"
      }
    },
    { $unwind: "$agent" },
    { $match: { "agent.status": { $nin: ["Inactive", "Former Employee"] } } }
  ]);

  const now = new Date();
  const liveStatus = recentCalls.map(c => {
    const idleMs = now - new Date(c.lastCallTimestamp);
    return {
      agentId: c._id,
      name: c.agent.name,
      lastCallAt: c.lastCallTimestamp,
      idleMs: idleMs
    };
  });

  return liveStatus;
}

async function getLiveActivity(agentIdCondition) {
  const mongoose = require('mongoose');
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  let matchQuery = { timestamp: { $gte: startOfDay } };
  if (agentIdCondition !== undefined) {
    matchQuery.agentId = typeof agentIdCondition === 'string' && mongoose.Types.ObjectId.isValid(agentIdCondition)
      ? new mongoose.Types.ObjectId(agentIdCondition)
      : agentIdCondition;
  }

  const activity = await CallLog.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: "$agentId",
        firstCall: { $min: "$timestamp" },
        lastCall: { $max: "$timestamp" },
        talkTime: { $sum: "$duration" }
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "agent"
      }
    },
    { $unwind: "$agent" },
    { $match: { "agent.status": { $nin: ["Inactive", "Former Employee"] } } }
  ]);

  const formattedActivity = activity.map(a => ({
    agentId: a._id,
    name: a.agent.name,
    firstCall: a.firstCall,
    lastCall: a.lastCall,
    talkTime: a.talkTime || 0
  }));

  return formattedActivity;
}

async function getLongCallsDetails(agentId, startDate, endDate, metric = 'longCalls') {
  const mongoose = require('mongoose');
  let matchQuery = {};

  if (metric === 'longCalls') {
    matchQuery.duration = { $gte: 300 };
  } else if (metric === 'connected') {
    matchQuery.status = 'Connected';
  }

  if (agentId && agentId !== 'all') {
    if (mongoose.Types.ObjectId.isValid(agentId)) {
      matchQuery.agentId = new mongoose.Types.ObjectId(agentId);
    }
  }

  if (startDate && endDate) {
    const start = new Date(startDate.includes('T') ? startDate : `${startDate}T00:00:00.000`);
    const end = new Date(endDate.includes('T') ? endDate : `${endDate}T23:59:59.999`);
    matchQuery.timestamp = {
      $gte: start,
      $lte: end
    };
  }

  // Fetch call logs matching filter
  const longCalls = await CallLog.find(matchQuery)
    .populate('agentId', 'name email')
    .sort({ timestamp: -1 })
    .lean();

  if (longCalls.length === 0) return [];

  // Extract leadIds and 10-digit normalized phone numbers
  const leadIds = longCalls.map(c => c.leadId).filter(Boolean);
  const rawPhones = longCalls.map(c => c.contactNumber).filter(Boolean);
  const cleanPhones = rawPhones.map(p => p.replace(/[^0-9]/g, '').slice(-10)).filter(p => p.length === 10);

  const LeadObj = require('../models/Lead');
  const LeadModel = LeadObj.Model || mongoose.model('Lead');

  const phoneRegexes = cleanPhones.map(p => new RegExp(p + '$'));

  const leadQuery = { $or: [] };
  if (leadIds.length > 0) leadQuery.$or.push({ _id: { $in: leadIds } });
  if (phoneRegexes.length > 0) leadQuery.$or.push({ phone: { $in: phoneRegexes } });

  const leads = leadQuery.$or.length > 0 ? await LeadModel.find(leadQuery).lean() : [];

  const leadByIdMap = new Map();
  const leadByPhoneMap = new Map();

  leads.forEach(l => {
    if (l._id) leadByIdMap.set(l._id.toString(), l);
    if (l.phone) {
      const cleanP = l.phone.replace(/[^0-9]/g, '').slice(-10);
      if (cleanP) leadByPhoneMap.set(cleanP, l);
    }
  });

  return longCalls.map(c => {
    let matchedLead = null;
    if (c.leadId && leadByIdMap.has(c.leadId.toString())) {
      matchedLead = leadByIdMap.get(c.leadId.toString());
    } else if (c.contactNumber) {
      const cleanCallPhone = c.contactNumber.replace(/[^0-9]/g, '').slice(-10);
      if (cleanCallPhone && leadByPhoneMap.has(cleanCallPhone)) {
        matchedLead = leadByPhoneMap.get(cleanCallPhone);
      }
    }

    const leadNameDisplay = matchedLead 
      ? matchedLead.name 
      : (c.contactNumber ? `Call (${c.contactNumber})` : 'Direct Call');

    return {
      _id: c._id,
      agentId: c.agentId?._id || c.agentId,
      agentName: c.agentId?.name || 'Agent',
      leadId: matchedLead ? matchedLead._id : c.leadId,
      leadNumberId: matchedLead ? matchedLead.leadId : null,
      leadName: leadNameDisplay,
      contactNumber: c.contactNumber || (matchedLead ? matchedLead.phone : 'N/A'),
      duration: c.duration,
      timestamp: c.timestamp,
      status: c.status
    };
  });
}

module.exports = {
  logCall,
  getHistoricalReports,
  getLiveStatus,
  getLiveActivity,
  getLongCallsDetails
};
