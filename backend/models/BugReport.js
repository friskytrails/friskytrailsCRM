const mongoose = require('mongoose');

const BugReportSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Bug report title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Bug report description is required'],
    trim: true
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reporterName: {
    type: String,
    default: 'Anonymous Agent'
  },
  reporterEmail: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Open', 'In Progress', 'Resolved'],
    default: 'Open'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

function formatDoc(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  obj.id = obj._id.toString();
  delete obj._id;
  delete obj.__v;
  return obj;
}

module.exports = {
  Schema: BugReportSchema,
  Model: mongoose.model('BugReport', BugReportSchema),
  formatDoc
};
