const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { 
    type: String, 
    required: true,
    validate: {
      validator: function(v) {
        return /^\d{4}-\d{2}-\d{2}$/.test(v);
      },
      message: props => `${props.value} is not a valid date format! Use YYYY-MM-DD.`
    }
  }, // Format: 'YYYY-MM-DD'
  status: { type: String, enum: ['P', 'A'], required: true }
}, { timestamps: true });

// Compound unique index so an agent can only have one log entry per day
AttendanceSchema.index({ agentId: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model('Attendance', AttendanceSchema);

module.exports = Attendance;
