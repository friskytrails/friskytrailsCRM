const mongoose = require('mongoose');

const CallLogSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: false,
    index: true
  },
  duration: { 
    type: Number, // duration in seconds
    required: true,
    default: 0,
    min: 0
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['Connected', 'Missed', 'Failed', 'Voicemail'],
    required: true
  },
  contactNumber: {
    type: String,
    required: false
  }
}, { timestamps: true });

// Compound indexes for high-performance reporting & lead history queries
CallLogSchema.index({ agentId: 1, timestamp: -1 });
CallLogSchema.index({ leadId: 1, timestamp: -1 });

module.exports = mongoose.model('CallLog', CallLogSchema);
