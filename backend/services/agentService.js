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

  if (monthlyTarget !== undefined) user.monthlyTarget = Number(monthlyTarget);
  if (targetCompleted !== undefined) user.targetCompleted = Number(targetCompleted);
  if (attendance !== undefined) user.attendance = attendance;

  await user.save();

  // Upsert or Delete attendance log for the specific date if provided
  if (attendanceDate) {
    if (attendance === 'P' || attendance === 'A') {
      await Attendance.findOneAndUpdate(
        { agentId: user._id, date: attendanceDate },
        { status: attendance },
        { upsert: true, new: true }
      );
    } else if (attendance === '') {
      await Attendance.findOneAndDelete({ agentId: user._id, date: attendanceDate });
    }
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
