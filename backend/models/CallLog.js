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
  clientCallId: {
    type: String,
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

CallLogSchema.pre('validate', function(next) {
  if (this.status && typeof this.status === 'string') {
    const s = this.status.trim().toLowerCase();
    if (s === 'connected' || s === 'success' || s === 'answered') {
      this.status = 'Connected';
    } else if (s === 'missed' || s === 'no answer' || s === 'no_answer') {
      this.status = 'Missed';
    } else if (s === 'voicemail') {
      this.status = 'Voicemail';
    } else {
      this.status = 'Failed';
    }
  }
  next();
});

// Compound indexes for high-performance reporting & lead history queries
CallLogSchema.index({ agentId: 1, timestamp: -1 });
CallLogSchema.index({ leadId: 1, timestamp: -1 });
// Unique index to prevent duplicates from the app based on clientCallId
CallLogSchema.index(
  { agentId: 1, clientCallId: 1 },
  { unique: true, partialFilterExpression: { clientCallId: { $exists: true } } }
);

module.exports = mongoose.model('CallLog', CallLogSchema);
