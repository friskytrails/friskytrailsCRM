const mongoose = require('mongoose');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const { formatDoc } = require('../utils/helpers');

async function getAgents() {
  const agents = await User.findAgents();
  return agents.map(formatDoc);
}

async function updateAgentStatus(id, status) {
  const validStatuses = ['Active', 'Inactive', 'Former Employee'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const user = await User.findById(id);
  if (!user) {
    throw new Error("Agent not found");
  }

  if (user.isAdmin) {
    throw new Error("Cannot update status of an admin user");
  }

  user.status = status;
  await user.save();
  return formatDoc(user);
}

async function updateAgentVerification(id, isVerified) {
  const user = await User.findById(id);
  if (!user) {
    throw new Error("Agent not found");
  }

  if (user.isAdmin) {
    throw new Error("Cannot update verification of an admin user");
  }

  if (typeof isVerified !== 'boolean') {
    if (isVerified === 'true') isVerified = true;
    else if (isVerified === 'false') isVerified = false;
    else throw new Error("isVerified must be a boolean value");
  }

  user.isVerified = isVerified;
  await user.save();
  return formatDoc(user);
}

async function updateAgentMetrics(id, monthlyTarget, targetCompleted, attendance, attendanceDate) {
  const user = await User.findById(id);
  if (!user) {
    throw new Error("Agent not found");
  }

  if (user.isAdmin) {
    throw new Error("Cannot update metrics of an admin user");
  }

  // Backup for manual rollback
  const originalState = {
    monthlyTarget: user.monthlyTarget,
    targetCompleted: user.targetCompleted,
    attendance: user.attendance
  };

  if (monthlyTarget !== undefined) {
    const num = Number(monthlyTarget);
    if (!Number.isFinite(num) || num < 0) throw new Error("Invalid monthlyTarget");
    user.monthlyTarget = num;
  }
  if (targetCompleted !== undefined) {
    const num = Number(targetCompleted);
    if (!Number.isFinite(num) || num < 0) throw new Error("Invalid targetCompleted");
    user.targetCompleted = num;
  }
  
  // Only overwrite current attendance if it is today
  const todayStr = new Date().toLocaleDateString('en-CA');
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

module.exports = {
  getAgents,
  updateAgentStatus,
  updateAgentVerification,
  updateAgentMetrics,
  getAgentAttendance
};
