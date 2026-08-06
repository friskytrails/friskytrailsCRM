const mongoose = require('mongoose');
const User = require('../models/User');
const BlockedEmail = require('../models/BlockedEmail');
const Attendance = require('../models/Attendance');
const { formatDoc } = require('../utils/helpers');
const { sendAgentApprovalEmail, sendAgentRejectionEmail } = require('../utils/sendEmail');

function createError(message, name = 'ValidationError') {
  const err = new Error(message);
  err.name = name;
  return err;
}

async function ensureCurrentMonthMetrics(user) {
  if (!user || user.isAdmin) return false;

  const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const currentMonthStr = `${nowIST.getFullYear()}-${String(nowIST.getMonth() + 1).padStart(2, '0')}`;
  const userId = user._id || user.id;

  // Backfill legacy statusChangedAt from createdAt if missing
  if (!user.statusChangedAt) {
    user.statusChangedAt = user.createdAt || user.updatedAt || new Date();
    modified = true;
  }

  if (!user.lastMetricsMonth) {
    const updated = await User.Model.findOneAndUpdate(
      { _id: userId, $or: [{ lastMetricsMonth: { $exists: false } }, { lastMetricsMonth: null }, { lastMetricsMonth: "" }] },
      { $set: { lastMetricsMonth: currentMonthStr } },
      { new: true }
    );
    if (updated) {
      if (typeof user.toObject === 'function') {
        Object.assign(user, updated.toObject());
      } else {
        user.lastMetricsMonth = currentMonthStr;
      }
      return true;
    }
    return false;
  }

  if (user.lastMetricsMonth !== currentMonthStr) {
    let attempts = 0;
    while (attempts < 3) {
      attempts++;
      const currentDoc = await User.Model.findById(userId);
      if (!currentDoc || currentDoc.lastMetricsMonth === currentMonthStr) {
        if (currentDoc) {
          if (typeof user.toObject === 'function') {
            Object.assign(user, currentDoc.toObject());
          } else {
            Object.assign(user, currentDoc);
          }
        }
        return false;
      }

      const prevMonthToArchive = currentDoc.lastMetricsMonth;
      if (prevMonthToArchive === currentMonthStr) break;

      const existsInHist = (currentDoc.historicalMetrics || []).some(m => m.month === prevMonthToArchive);
      let updateOp;

      if (!existsInHist && prevMonthToArchive) {
        updateOp = {
          $set: {
            bookingCount: 0,
            targetCompleted: 0,
            lastMetricsMonth: currentMonthStr
          },
          $push: {
            historicalMetrics: {
              month: prevMonthToArchive,
              monthlyTarget: currentDoc.monthlyTarget || 0,
              targetCompleted: currentDoc.targetCompleted || 0,
              bookingCount: currentDoc.bookingCount || 0
            }
          }
        };
      } else {
        updateOp = {
          $set: {
            bookingCount: 0,
            targetCompleted: 0,
            lastMetricsMonth: currentMonthStr
          }
        };
      }

      const res = await User.Model.findOneAndUpdate(
        { _id: userId, lastMetricsMonth: prevMonthToArchive },
        updateOp,
        { new: true }
      );

      if (res) {
        if (typeof user.toObject === 'function') {
          Object.assign(user, res.toObject());
        } else {
          Object.assign(user, res);
        }
        return true;
      }
    }
  }

  return false;
}

async function getAgents() {
  const agents = await User.findAgents();
  for (const agent of agents) {
    await ensureCurrentMonthMetrics(agent);
  }
  return agents.map(formatDoc);
}

async function updateAgentStatus(id, status, role) {
  const validStatuses = ['Active', 'Inactive', 'Former Employee', 'Rejected'];
  if (!validStatuses.includes(status)) {
    throw createError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const user = await User.findById(id);
  if (!user) {
    throw createError("Agent not found", "NotFoundError");
  }

  if (user.isAdmin) {
    throw createError("Cannot update status of an admin user");
  }

  if (role) {
    if (role === 'itinerary' || role === 'itenary') {
      user.isItinerary = true;
      user.isManager = false;
    } else if (role === 'agent') {
      user.isItinerary = false;
    }
  }

  if (status === 'Rejected') {
    if (user.status !== 'Pending') {
      throw new Error("Only pending agents can be rejected");
    }

    try {
      await BlockedEmail.create({ email: user.email });
    } catch (err) {
      if (err.code !== 11000) {
        throw err;
      }
    }
    
    await User.Model.deleteOne({ _id: user._id });
    
    try {
      await sendAgentRejectionEmail(user.email, user.name);
    } catch (err) {
      console.error("Failed to send rejection email", err);
    }
    
    return { id, message: "Agent rejected and moved to blocklist" };
  }

  const wasPending = user.status === 'Pending';
  const statusChanged = user.status !== status;
  user.status = status;
  if (statusChanged) {
    user.statusChangedAt = new Date();
  }
  await user.save();

  if (wasPending && status === 'Active') {
    try {
      await sendAgentApprovalEmail(user.email, user.name);
    } catch (err) {
      console.error("Failed to send approval email", err);
    }
  }

  return formatDoc(user);
}

async function updateAgentVerification(id, isVerified) {
  const user = await User.findById(id);
  if (!user) {
    throw createError("Agent not found", "NotFoundError");
  }

  if (user.isAdmin) {
    throw createError("Cannot update verification of an admin user");
  }

  if (typeof isVerified !== 'boolean') {
    if (isVerified === 'true') isVerified = true;
    else if (isVerified === 'false') isVerified = false;
    else throw createError("isVerified must be a boolean value");
  }

  user.isVerified = isVerified;
  await user.save();
  return formatDoc(user);
}

async function updateAgentMetrics(id, monthlyTarget, targetCompleted, attendance, attendanceDate, bookingCount) {
  const user = await User.findById(id);
  if (!user) {
    throw createError("Agent not found", "NotFoundError");
  }

  if (user.isAdmin) {
    throw createError("Cannot update metrics of an admin user");
  }

  // Ensure month rollover/archival before reading or modifying any metrics
  await ensureCurrentMonthMetrics(user);

  // Backup for manual rollback (captured after rollover so rollback restores correct state)
  const originalState = {
    monthlyTarget: user.monthlyTarget,
    targetCompleted: user.targetCompleted,
    attendance: user.attendance,
    bookingCount: user.bookingCount,
    historicalMetrics: JSON.parse(JSON.stringify(user.historicalMetrics || []))
  };

  // Get today's date in YYYY-MM-DD format using IST
  const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const todayStr = `${nowIST.getFullYear()}-${String(nowIST.getMonth() + 1).padStart(2, '0')}-${String(nowIST.getDate()).padStart(2, '0')}`;
  const dateToUse = attendanceDate || todayStr;
  const monthPrefix = dateToUse.substring(0, 7);

  if (monthlyTarget !== undefined) {
    const num = Number(monthlyTarget);
    if (!Number.isFinite(num) || num < 0) throw createError("Invalid monthlyTarget");
    if (monthPrefix === todayStr.substring(0, 7)) user.monthlyTarget = num;
  }
  if (targetCompleted !== undefined) {
    const num = Number(targetCompleted);
    if (!Number.isFinite(num) || num < 0) throw createError("Invalid targetCompleted");
    if (monthPrefix === todayStr.substring(0, 7)) user.targetCompleted = num;
  }
  
  // Historical metrics update
  if (monthlyTarget !== undefined || targetCompleted !== undefined || bookingCount !== undefined) {
    let histIdx = user.historicalMetrics.findIndex(m => m.month === monthPrefix);
    if (histIdx === -1) {
      user.historicalMetrics.push({ 
        month: monthPrefix, 
        monthlyTarget: user.monthlyTarget || 0, 
        targetCompleted: user.targetCompleted || 0,
        bookingCount: user.bookingCount || 0
      });
      histIdx = user.historicalMetrics.length - 1;
    }
    if (monthlyTarget !== undefined) user.historicalMetrics[histIdx].monthlyTarget = Number(monthlyTarget);
    if (targetCompleted !== undefined) user.historicalMetrics[histIdx].targetCompleted = Number(targetCompleted);
    if (bookingCount !== undefined) user.historicalMetrics[histIdx].bookingCount = Number(bookingCount);
  }

  if (bookingCount !== undefined) {
    const num = Number(bookingCount);
    if (!Number.isFinite(num) || num < 0) throw createError("Invalid bookingCount");
    if (monthPrefix === todayStr.substring(0, 7)) user.bookingCount = num;
  }

  if (attendance !== undefined) {
    user.attendance = attendance;
    user.attendanceDate = attendanceDate || todayStr;
  }

  await user.save();

  try {
    // Upsert or Delete attendance log for the specific date if provided
    if (attendanceDate) {
      if (attendance === 'P' || attendance === 'A') {
        await Attendance.findOneAndUpdate(
          { agentId: user._id, date: attendanceDate },
          { status: attendance },
          { upsert: true, new: true, runValidators: true }
        );
      } else if (attendance === '') {
        await Attendance.findOneAndDelete({ agentId: user._id, date: attendanceDate });
      }
    }
  } catch (error) {
    // Rollback
    user.monthlyTarget = originalState.monthlyTarget;
    user.targetCompleted = originalState.targetCompleted;
    user.attendance = originalState.attendance;
    user.bookingCount = originalState.bookingCount;
    user.historicalMetrics = originalState.historicalMetrics;
    await user.save();
    throw new Error("Failed to persist attendance log, update rolled back. " + error.message);
  }

  return formatDoc(user);
}

async function getAgentAttendance(agentId) {
  const logs = await Attendance.find({ agentId: new mongoose.Types.ObjectId(agentId) }).sort({ date: 1 });
  return logs.map(log => {
    const doc = log.toObject();
    doc.id = doc._id.toString();
    delete doc._id;
    return doc;
  });
}

async function getAgentMetrics(id) {
  const user = await User.findById(id);
  if (!user) {
    throw createError("Agent not found", "NotFoundError");
  }
  await ensureCurrentMonthMetrics(user);
  return {
    monthlyTarget: user.monthlyTarget || 0,
    targetCompleted: user.targetCompleted || 0,
    bookingCount: user.bookingCount || 0,
    attendance: user.attendance || '',
    historicalMetrics: user.historicalMetrics || []
  };
}

async function getAgentMonthlyAttendance(agentId, month, year) {
  // Sanitize inputs and pad month to 2 digits
  const safeYear = Number(year);
  const safeMonth = Number(month);
  
  if (isNaN(safeYear) || isNaN(safeMonth)) {
    throw new Error("Invalid year or month format");
  }

  const paddedMonth = String(safeMonth).padStart(2, '0');
  const monthPrefix = `${safeYear}-${paddedMonth}`;
  
  const logs = await Attendance.find({ 
    agentId: new mongoose.Types.ObjectId(agentId),
    date: { $regex: `^${monthPrefix}` }
  });
  
  let presentCount = 0;
  let absentCount = 0;
  
  logs.forEach(log => {
    if (log.status === 'P') presentCount++;
    if (log.status === 'A') absentCount++;
  });
  
  return {
    present: presentCount,
    absent: absentCount,
  };
}

module.exports = {
  getAgents,
  updateAgentStatus,
  updateAgentVerification,
  getAgentMetrics,
  updateAgentMetrics,
  getAgentAttendance,
  getAgentMonthlyAttendance,
  toggleManagerRole,
  toggleItineraryRole,
  assignAgentsToManager,
  getMyTeam,
  ensureCurrentMonthMetrics
};

async function toggleItineraryRole(id, isItinerary) {
  const user = await User.findById(id);
  if (!user) throw createError("Agent not found", "NotFoundError");
  if (user.isAdmin) throw createError("Cannot change role of an admin user");

  if (typeof isItinerary !== 'boolean') {
    if (isItinerary === 'true') isItinerary = true;
    else if (isItinerary === 'false') isItinerary = false;
    else throw createError("isItinerary must be a boolean value");
  }

  user.isItinerary = isItinerary;
  if (isItinerary) {
    user.isManager = false;
  }
  await user.save();
  return formatDoc(user);
}

async function toggleManagerRole(id, isManager) {
  const user = await User.findById(id);
  if (!user) throw createError("Agent not found", "NotFoundError");
  if (user.isAdmin) throw createError("Cannot change role of an admin user");

  if (typeof isManager !== 'boolean') {
    if (isManager === 'true') isManager = true;
    else if (isManager === 'false') isManager = false;
    else throw createError("isManager must be a boolean value");
  }

  // On demotion: clear managerId from all agents under this manager
  if (!isManager && user.isManager) {
    await User.Model.updateMany(
      { managerId: user._id },
      { $set: { managerId: null } }
    );
  }

  user.isManager = isManager;
  if (isManager) {
    user.isItinerary = false;
  }
  await user.save();
  return formatDoc(user);
}

async function assignAgentsToManager(managerId, agentIds) {
  const manager = await User.findById(managerId);
  if (!manager) throw createError("Manager not found", "NotFoundError");
  if (!manager.isManager) throw createError("Target user is not a manager");

  if (!Array.isArray(agentIds)) throw createError("agentIds must be an array");

  // Validate each agentId and ensure they are non-admin, non-manager agents
  for (const agentId of agentIds) {
    const agent = await User.findById(agentId);
    if (!agent) throw createError(`Agent ${agentId} not found`, "NotFoundError");
    if (agent.isAdmin) throw createError("Cannot assign admin users to a manager");
    if (agent.isManager) throw createError(`User ${agent.name} is a manager and cannot be assigned under another manager`);
  }

  // Clear any agents previously assigned to this manager
  await User.Model.updateMany(
    { managerId: manager._id },
    { $set: { managerId: null } }
  );

  // Assign new agents (one manager at a time — override previous manager)
  if (agentIds.length > 0) {
    await User.Model.updateMany(
      { _id: { $in: agentIds } },
      { $set: { managerId: manager._id } }
    );
  }

  const updatedAgents = await User.findAgentsByManager(manager._id);
  return {
    manager: formatDoc(manager),
    agents: updatedAgents.map(formatDoc)
  };
}

async function getMyTeam(managerId) {
  const manager = await User.findById(managerId);
  if (!manager) throw createError("Manager not found", "NotFoundError");
  if (!manager.isManager) throw createError("User is not a manager");

  const agents = await User.findAgentsByManager(manager._id);
  return agents.map(formatDoc);
}
