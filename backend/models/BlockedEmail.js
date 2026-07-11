const mongoose = require('mongoose');

const BlockedEmailSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  rejectedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('BlockedEmail', BlockedEmailSchema);
