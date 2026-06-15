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
  leadId: {
    type: Number,
    unique: true,
    sparse: true
  },
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
  product: {
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
    const strId = id?.toString?.() || id;
    if (mongoose.Types.ObjectId.isValid(strId) && typeof strId === 'string' && strId.length === 24) {
      return Lead.findById(strId);
    }
    const numId = Number(strId);
    if (!isNaN(numId)) {
      return Lead.findOne({ leadId: numId });
    }
    return null;
  },
  insertLead: async (leadData) => {
    // Find the lead with the highest leadId
    const lastLead = await Lead.findOne({}, { leadId: 1 }).sort({ leadId: -1 });
    const nextId = lastLead && lastLead.leadId ? lastLead.leadId + 1 : 1;
    
    const lead = new Lead({
      ...leadData,
      leadId: nextId
    });
    await lead.save();
    return { insertedId: lead._id };
  },
  updateLead: async (id, data) => {
    let query = {};
    if (mongoose.Types.ObjectId.isValid(id) && typeof id === 'string' && id.length === 24) {
      query = { _id: id };
    } else {
      const numId = Number(id);
      if (!isNaN(numId)) {
        query = { leadId: numId };
      } else {
        return null;
      }
    }
    return Lead.findOneAndUpdate(
      query,
      { $set: data },
      { new: true }
    );
  },
  pushNote: async (id, note) => {
    let query = {};
    if (mongoose.Types.ObjectId.isValid(id) && typeof id === 'string' && id.length === 24) {
      query = { _id: id };
    } else {
      const numId = Number(id);
      if (!isNaN(numId)) {
        query = { leadId: numId };
      } else {
        return null;
      }
    }
    return Lead.findOneAndUpdate(
      query,
      { $push: { notes: note } },
      { new: true }
    );
  },
  deleteNote: async (id, noteId) => {
    let query = {};
    if (mongoose.Types.ObjectId.isValid(id) && typeof id === 'string' && id.length === 24) {
      query = { _id: id };
    } else {
      const numId = Number(id);
      if (!isNaN(numId)) {
        query = { leadId: numId };
      } else {
        return null;
      }
    }

    let noteObjectId;
    try {
      noteObjectId = new mongoose.Types.ObjectId(noteId);
    } catch(e) {
      noteObjectId = noteId;
    }

    return Lead.findOneAndUpdate(
      query,
      { $pull: { notes: { $or: [{ id: noteId }, { _id: noteObjectId }] } } },
      { new: true }
    );
  }
};
