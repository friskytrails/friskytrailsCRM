const User = require('../models/User');
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

module.exports = {
  getAgents,
  updateAgentStatus,
  updateAgentVerification
};
