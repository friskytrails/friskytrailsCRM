const mongoose = require('mongoose');

const CallLogSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  duration: { 
    type: Number, // duration in seconds
    required: true,
    default: 0
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
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
});

module.exports = mongoose.model('CallLog', CallLogSchema);
