const User = require('../models/User');
const BlockedEmail = require('../models/BlockedEmail');
const { formatDoc } = require('../utils/helpers');
const { sendAgentApprovalEmail, sendAgentRejectionEmail } = require('../utils/sendEmail');

async function getAgents() {
  const agents = await User.findAgents();
  return agents.map(formatDoc);
}

async function updateAgentStatus(id, status) {
  const validStatuses = ['Active', 'Inactive', 'Former Employee', 'Rejected'];
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
