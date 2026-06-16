const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  timestamp: {
    type: String,
    required: true
  },
  author: {
    type: String,
    required: true
  },
  authorId: {
    type: String,
    required: false
  },
  imageUrl: {
    type: String,
    required: false
  }
});

const LeadSchema = new mongoose.Schema({
  name: {
    type: String,
    required: false,
    default: ''
  },
  phone: {
    type: String,
    required: true
  },
  age: {
    type: Number,
    required: false
  },
  origin: {
    type: String,
    required: false,
    default: ''
  },
  destination: {
    type: String,
    required: false,
    default: ''
  },
  leadSource: {
    type: String,
    required: false,
    default: ''
  },
  mailId: {
    type: String,
    required: false,
    default: ''
  },
  agentId: {
    type: String,
    default: null
  },
  labels: {
    type: [String],
    default: []
  },
  dates: {
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null }
  },
  notes: {
    type: [NoteSchema],
    default: []
  },
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Follow Up', 'Interested', 'Booked', 'Rejected', 'Closed'],
    default: 'New'
  },
  booking: {
    totalDial: { type: Number, default: 0 },
    connected: { type: Number, default: 0 },
    talkTime: { type: String, default: '0:0' },
    firstCall: { type: Date, default: null },
    lastCall: { type: Date, default: null }
  }
}, { timestamps: true });

const Lead = mongoose.model('Lead', LeadSchema);

module.exports = {
  Schema: LeadSchema,
  Model: Lead,
  // Helper queries to retain service compatibility
  findAll: async () => {
    return Lead.find({});
  },
  findById: async (id) => {
    return Lead.findById(id);
  },
  insertLead: async (leadData) => {
    const lead = new Lead(leadData);
    await lead.save();
    return { insertedId: lead._id };
  },
  updateLead: async (id, data) => {
    return Lead.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true }
    );
  },
  pushNote: async (id, note) => {
    return Lead.findByIdAndUpdate(
      id,
      { $push: { notes: note } },
      { new: true }
    );
  },
  deleteNote: async (id, noteId) => {
    let noteObjectId;
    try {
      noteObjectId = new mongoose.Types.ObjectId(noteId);
    } catch(e) {
      noteObjectId = noteId;
    }

    return Lead.findByIdAndUpdate(
      id,
      { $pull: { notes: { $or: [{ id: noteId }, { _id: noteObjectId }] } } },
      { new: true }
    );
  }
};
