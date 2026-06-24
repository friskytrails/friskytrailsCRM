const mongoose = require('mongoose');

const PendingUserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  verificationOtp: {
    type: String,
    required: true
  },
  otpExpiresAt: {
    type: Date,
    required: true
  },
  otpAttempts: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // Automatically delete pending user after 24 hours
  }
});

const PendingUser = mongoose.model('PendingUser', PendingUserSchema);

module.exports = PendingUser;
