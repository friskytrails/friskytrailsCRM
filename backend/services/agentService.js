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

async function getAgents() {
  const agents = await User.findAgents();
  return agents.map(formatDoc);
}

async function updateAgentStatus(id, status) {
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
  user.status = status;
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

async function updateAgentMetrics(id, monthlyTarget, targetCompleted, attendance, attendanceDate) {
  const user = await User.findById(id);
  if (!user) {
    throw createError("Agent not found", "NotFoundError");
  }

  if (user.isAdmin) {
    throw createError("Cannot update metrics of an admin user");
  }

  // Backup for manual rollback
  const originalState = {
    monthlyTarget: user.monthlyTarget,
    targetCompleted: user.targetCompleted,
    attendance: user.attendance
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
  if (monthlyTarget !== undefined || targetCompleted !== undefined) {
    let histIdx = user.historicalMetrics.findIndex(m => m.month === monthPrefix);
    if (histIdx === -1) {
      user.historicalMetrics.push({ 
        month: monthPrefix, 
        monthlyTarget: user.monthlyTarget || 0, 
        targetCompleted: user.targetCompleted || 0 
      });
      histIdx = user.historicalMetrics.length - 1;
    }
    if (monthlyTarget !== undefined) user.historicalMetrics[histIdx].monthlyTarget = Number(monthlyTarget);
    if (targetCompleted !== undefined) user.historicalMetrics[histIdx].targetCompleted = Number(targetCompleted);
  }

  // Only overwrite current attendance if it is today
  if (attendance !== undefined && (!attendanceDate || attendanceDate === todayStr)) {
    user.attendance = attendance;
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
  return {
    monthlyTarget: user.monthlyTarget || 0,
    targetCompleted: user.targetCompleted || 0,
    attendance: user.attendance || '',
    historicalMetrics: user.historicalMetrics || []
  };
}

module.exports = {
  getAgents,
  updateAgentStatus,
  updateAgentVerification,
  getAgentMetrics,
  updateAgentMetrics,
  getAgentAttendance
};
