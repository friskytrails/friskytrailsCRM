const CallLog = require('../models/CallLog');
const User = require('../models/User');

async function logCall(data) {
  const { agentId, duration, timestamp, status, contactNumber } = data;
  
  if (!agentId || !status) {
    throw new Error('agentId and status are required');
  }

  const callLog = new CallLog({
    agentId,
    duration: duration || 0,
    timestamp: timestamp || new Date(),
    status,
    contactNumber
  });

  await callLog.save();
  return callLog;
}

async function getHistoricalReports(startDate, endDate, team, agentIdCondition) {
  let matchQuery = {};
  if (agentIdCondition) {
    matchQuery.agentId = agentIdCondition;
  }
  if (startDate && endDate) {
    matchQuery.timestamp = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

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
    { $unwind: "$agent" }
  ]);

  const formattedReports = reports.map(r => {
    const tenureDays = Math.floor((new Date() - new Date(r.agent.createdAt)) / (1000 * 60 * 60 * 24));
    return {
      agentId: r._id,
      name: r.agent.name,
      tenure: tenureDays,
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
  let matchQuery = {};
  if (agentIdCondition) {
    matchQuery.agentId = agentIdCondition;
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
    { $unwind: "$agent" }
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
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  let matchQuery = { timestamp: { $gte: startOfDay } };
  if (agentIdCondition) {
    matchQuery.agentId = agentIdCondition;
  }

  const activity = await CallLog.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: "$agentId",
        firstCall: { $min: "$timestamp" },
        lastCall: { $max: "$timestamp" }
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
    { $unwind: "$agent" }
  ]);

  const formattedActivity = activity.map(a => ({
    agentId: a._id,
    name: a.agent.name,
    firstCall: a.firstCall,
    lastCall: a.lastCall
  }));

  return formattedActivity;
}

module.exports = {
  logCall,
  getHistoricalReports,
  getLiveStatus,
  getLiveActivity
};
